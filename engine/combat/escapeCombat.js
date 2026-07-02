/**
 * v1 Escape — classic-D&D combat resolver (hedge-caster build).
 *
 * Deliberately simple and legible. The deep engine (wounds/stress/conditions/
 * traits/resistances/legendary actions) stays parked for the open sandbox; the
 * shippable Escape game uses plain hit points and a familiar loop:
 *
 *   roll d20 + modifier vs the target's Armor Class
 *   on a hit, roll damage dice + modifier; subtract from hit points
 *   0 hit points = down
 *
 * The escapee is a *hedge-caster*: a found blade plus two cantrips. Combat is
 * driven entirely by typed intent — a few distinct verbs, each mechanically
 * different:
 *
 *   strike / attack / swing   → blade: d20 + MIGHT vs AC, d6 + MIGHT damage
 *   fire bolt / bolt / burn   → cantrip: d20 + WITS vs AC, d10 fire (no mod)
 *   ward / brace / guard      → defense: +4 AC until your next turn, no attack
 *
 * The player's hit points live in `world.meta.escapeHp` and persist ACROSS
 * fights (attrition — you patch up a little between fights, not fully). Enemy
 * hit points live in the shared `world.combat.enemies[].hp` so the existing UI
 * renders them unchanged.
 *
 * The resolver returns a `beats` array — one short line per exchange — so the UI
 * can reveal a round blow-by-blow with breathing room instead of dumping the
 * whole round at once.
 *
 * Pure and deterministic: every roll comes from a seeded RNG. No Math.random,
 * no Date.now, no LLM.
 */

import { ensureWorld } from '../state.js';
import { applyDeltas } from '../effectsCore.js';
import { endCombat } from './combatLifecycle.js';
import { statMod } from '../ruleset/core/stats.js';
import { makeRng, seedFromString } from '../rng.js';
import { rollLootForCR } from '../ruleset/core/loot/lootRoll.js';
import { rollDice } from './diceRoller.js';
import { coverForRoom, bestCover } from '../structures/coverFeatures.js';
import { coverAcBonus } from './tacticalMods.js';
import { moveCombatant } from './grid.js';
import { resolveSpatialMove, PLAYER_COMBAT_SPEED_FEET } from './spatialMove.js';
import { applyCondition, hasCondition, removeAllConditions } from './conditions.js';
import { parseGrappleVerb, resolveGrappleAction, enemyGrappleEscape } from './grapple.js';
import { parseHazard, resolveHazard } from './hazard.js';
import { xpForEnemies } from '../ruleset/core/xp.js';
import { getItemDef } from '../ruleset/core/items/index.js';
import { levelUpSheet, levelForXp } from '../chargen/srd/levelUp.js';
import { resolveBossActionPayload, resolveLairActionPayload, bossPhase, detectPhaseCrossings } from './bossActions.js';
import { sealLoot } from '../ruleset/core/items/magic.js';
import {
  applyTurnStartTraits,
  applyToHitTraits,
  applyDamageDealtTraits,
  applyDamageTakenTraits,
  applyACTraits,
  applyDeathTraits
} from './traitHooks.js';

// ── Player build (level-1 hedge-caster escapee) ──────────────────────────────
const PLAYER_BASE_HP = 14;   // + GRIT mod
const PLAYER_BASE_AC = 12;   // + AGILITY mod (unarmored)
const BLADE_ATK_BONUS = 2;   // + MIGHT mod (found blade proficiency)
const BLADE_DMG_DIE = 6;     // d6 + MIGHT mod
const FIREBOLT_ATK_BONUS = 2;// + WITS mod (cantrip attack)
const FIREBOLT_DMG_DIE = 10; // d10 fire, no ability mod (cantrip)
const WARD_AC_BONUS = 4;     // +4 AC for the enemy turn after you ward

// ── Enemy build (tamed; only fields that survive ensureCombat are used) ──────
const ENEMY_ATK_BONUS = 3;   // fixed to-hit; enemy `damage` field = damage die max

// ── Short rest (recover on a safe hop) ───────────────────────────────────────
const REST_DIE = 6;          // d6 + REST_FLAT healed per clear hop
const REST_FLAT = 2;

// ── Hedge-caster starting kit ────────────────────────────────────────────────
// The blade lives in inventory.weapons; the cantrips in spells.known (string
// refs — cantrips need no slots). `escapeKitView` re-joins these refs with the
// display metadata below so the UI can show a name, a verb to type, and a note.
export const ESCAPE_KIT = {
  weapon: {
    id: 'worn-blade',
    name: 'Worn Blade',
    kind: 'weapon',
    verb: 'strike',
    dmgDie: BLADE_DMG_DIE,
    note: 'A nicked blade pried loose on the way down. Type "strike".'
  },
  cantrips: [
    {
      ref: 'fire_bolt',
      name: 'Fire Bolt',
      kind: 'attack',
      verb: 'fire bolt',
      dmgDie: FIREBOLT_DMG_DIE,
      note: 'A mote of flame. Ranged spell attack. Type "fire bolt".'
    },
    {
      ref: 'ward',
      name: 'Ward',
      kind: 'defense',
      verb: 'ward',
      note: `A shimmer of force. +${WARD_AC_BONUS} AC until your next turn. Type "ward".`
    }
  ]
};

// ── SRD 5e sheet integration ─────────────────────────────────────────────────
// When the PC carries a canonical 5e sheet (pc.dnd, WORLD_VERSION 24+), combat
// reads it: real HP/AC, the class's actual weapon and damage die, the class's
// own attack cantrip with the sheet's spell attack bonus. Legacy characters
// (no sheet) keep the original hedge-caster math untouched.

// SRD weapon dice for the kit weapons that chargen can hand out.
const SRD_WEAPONS = [
  { match: /greataxe/i, name: 'Greataxe', die: 12 },
  { match: /greatsword/i, name: 'Greatsword', die: 12 },
  { match: /longsword/i, name: 'Longsword', die: 8 },
  { match: /battleaxe/i, name: 'Battleaxe', die: 8 },
  { match: /warhammer/i, name: 'Warhammer', die: 8 },
  { match: /rapier/i, name: 'Rapier', die: 8, finesse: true },
  { match: /longbow/i, name: 'Longbow', die: 8, ranged: true },
  { match: /light crossbow/i, name: 'Light Crossbow', die: 8, ranged: true },
  { match: /shortsword/i, name: 'Shortsword', die: 6, finesse: true },
  { match: /scimitar/i, name: 'Scimitar', die: 6, finesse: true },
  { match: /shortbow/i, name: 'Shortbow', die: 6, ranged: true },
  { match: /handaxe/i, name: 'Handaxe', die: 6 },
  { match: /mace/i, name: 'Mace', die: 6 },
  { match: /spear/i, name: 'Spear', die: 6 },
  { match: /javelin/i, name: 'Javelin', die: 6 },
  { match: /quarterstaff/i, name: 'Quarterstaff', die: 6 },
  { match: /dagger/i, name: 'Dagger', die: 4, finesse: true },
  { match: /club/i, name: 'Club', die: 4 },
  { match: /sickle/i, name: 'Sickle', die: 4 }
];

// Per-class attack cantrips (SRD). Spell attack bonus comes off the sheet.
const SRD_CANTRIPS = {
  wizard: { ref: 'fire_bolt', name: 'Fire Bolt', die: 10, type: 'fire', verb: 'fire bolt' },
  sorcerer: { ref: 'fire_bolt', name: 'Fire Bolt', die: 10, type: 'fire', verb: 'fire bolt' },
  warlock: { ref: 'eldritch_blast', name: 'Eldritch Blast', die: 10, type: 'force', verb: 'blast' },
  bard: { ref: 'vicious_mockery', name: 'Vicious Mockery', die: 4, type: 'psychic', verb: 'mock' },
  cleric: { ref: 'sacred_flame', name: 'Sacred Flame', die: 8, type: 'radiant', verb: 'sacred flame' },
  druid: { ref: 'produce_flame', name: 'Produce Flame', die: 8, type: 'fire', verb: 'flame' }
};

/**
 * meleeProfile(pc) -> { name, die, atkBonus, dmgMod, ranged }
 * The PC's best real weapon. 5e sheet: best die among kit weapons, finesse
 * uses DEX when better, + proficiency. Legacy: the Worn Blade.
 */
export function meleeProfile(pc) {
  const d = pc?.dnd;
  // P-69 — a typed item equipped in the main hand outranks the sheet strings:
  // loot you WIELD is what you swing, magic bonuses included.
  const equippedDef = (() => {
    const it = (pc?.inventory?.items || []).find(x => x.equipped === 'main_hand');
    const def = it ? getItemDef(it.defRef) : null;
    if (!def) return null;
    // P-77 — an attunement item answers only to an attuned bearer: unbonded,
    // it swings as plain steel (the magic bonus stays asleep).
    if (def.kind === 'weapon') {
      return (def.attunement && !it.attuned) ? { ...def, bonus: null } : def;
    }
    // P-70 — an improvised material in hand (a board, a stone) is a weapon
    // by RAW improvised rules: its die, your STR, no proficiency bonus.
    if (def.kind === 'material' && def.improvised) {
      return { ...def, damage: def.improvised, properties: [], improvisedWeapon: true };
    }
    return null;
  })();
  if (equippedDef) {
    const mods = d?.mods || {
      STR: statMod(pc?.stats?.MIGHT ?? 10),
      DEX: statMod(pc?.stats?.AGILITY ?? 10)
    };
    const props = equippedDef.properties || [];
    const ranged = props.includes('ranged');
    const finesse = props.includes('finesse');
    const statKey = equippedDef.stat === 'AGILITY' || ranged ? 'DEX'
      : finesse ? (mods.DEX > mods.STR ? 'DEX' : 'STR')
      : 'STR';
    const mod = Number(mods[statKey]) || 0;
    // 'NdM' → the resolver's single-die contract: N×M (2d6 → 12, same
    // compromise as the legacy sheet table's greatsword entry).
    const dm = String(equippedDef.damage?.dice || '1d6').match(/^(\d+)d(\d+)$/);
    const die = dm ? parseInt(dm[1], 10) * parseInt(dm[2], 10) : 6;
    const prof = equippedDef.improvisedWeapon ? 0 : (d?.profBonus ?? 2);
    const atkMagic = Number(equippedDef.bonus?.attack) || 0;
    const dmgMagic = Number(equippedDef.bonus?.damage) || 0;
    return {
      name: equippedDef.name,
      die,
      atkBonus: prof + mod + atkMagic,
      dmgMod: mod + dmgMagic,
      ranged,
      finesse,
      twoHanded: props.includes('two-handed')
    };
  }
  if (d && Array.isArray(d.equipment)) {
    // RAW ability per weapon: ranged uses DEX, finesse uses the better of
    // STR/DEX, everything else STR. Pick the weapon with the best EXPECTED
    // damage ((die+1)/2 + mod), not the biggest die — a STR cleric's mace
    // beats a crossbow it would fire at -1.
    let best = null;
    for (const item of d.equipment) {
      for (const wpn of SRD_WEAPONS) {
        if (!wpn.match.test(String(item))) continue;
        const mod = wpn.ranged ? d.mods.DEX
          : wpn.finesse ? Math.max(d.mods.STR, d.mods.DEX)
          : d.mods.STR;
        const expected = (wpn.die + 1) / 2 + mod;
        if (!best || expected > best.expected) best = { ...wpn, mod, expected };
        break;
      }
    }
    if (best) {
      return { name: best.name, die: best.die, atkBonus: d.profBonus + best.mod, dmgMod: best.mod, ranged: Boolean(best.ranged), finesse: Boolean(best.finesse), twoHanded: best.die >= 12 };
    }
    // Sheet but no table weapon (monk fists, darts): unarmed/simple strike.
    const mod = Math.max(d.mods.STR, d.mods.DEX);
    return { name: 'Unarmed Strike', die: 4, atkBonus: d.profBonus + mod, dmgMod: mod, ranged: false, finesse: true, twoHanded: false };
  }
  const might = pc?.stats?.MIGHT ?? 10;
  return {
    name: ESCAPE_KIT.weapon.name,
    die: BLADE_DMG_DIE,
    atkBonus: BLADE_ATK_BONUS + statMod(might),
    dmgMod: statMod(might),
    ranged: false
  };
}

function naturalStrikeProfile(text, base) {
  const t = String(text || '').toLowerCase();
  const label =
    /\bstomp\b/.test(t) ? 'Stomp' :
    /\bhead[\s-]?butt\b/.test(t) ? 'Headbutt' :
    /\bbite\b|\bteeth\b|\bfangs\b/.test(t) ? 'Bite' :
    /\bknee\b/.test(t) ? 'Knee' :
    /\belbow\b/.test(t) ? 'Elbow' :
    /\bclaw\b|\bclaws\b|\bscratch\b/.test(t) ? 'Claw' :
    /\bpunch\b|\bfist\b/.test(t) ? 'Punch' :
    /\bkick\b|\bboot\b/.test(t) ? 'Kick' :
    null;
  return label ? { ...base, name: label } : base;
}

function isFixtureEgressText(text) {
  const t = String(text || '').toLowerCase();
  if (!/\b(door|window|windowsill|sill|shutter|hinge)\b/.test(t)) return false;
  const directedAtFoe = /\b(?:at|into|onto|against)\s+(?:him|her|them|it|the\s+(?:foe|enemy|bandit|linger(?:er)?|monster|creature|guard|wolf|goblin|orc)|[a-z]+(?:fang|claw|hand|face|head|chest|gut|snout))\b/.test(t);
  if (directedAtFoe) return false;
  return /\b(open|opened|opening|through|out|outside|escape|egress|clear\s+the\s+street)\b/.test(t);
}

// An offensive physical action aimed at the LIVING FOE — a thrown weapon, a
// stab/jam/drive into the body, or a press/pin/shove that forces the foe. Used
// to RESCUE an attack that a movement verb (egress), a self-hazard (dive out a
// window), or a spell-less 'hold' would otherwise swallow, so a blow in active
// combat always resolves a roll instead of fizzling. The match requires an
// offensive verb AND a foe-directed object (a pronoun, a foe-noun, or a body
// part — incl. a possessive name like "Elske's chest"), so a pure scene-exit
// ("kick the door open and clear the street") never trips it. (Gate
// 2026-06-23 combat-truth: lethal hits & embedded attacks during egress/hold.)
function isAttackAtFoe(text) {
  const t = String(text || '').toLowerCase();
  const offensive = /\b(throw|throws|threw|hurl|hurls|hurled|fling|flings|flung|toss|tosses|tossed|lob|lobs|lobbed|jam|jams|jammed|drive|drives|drove|stab|stabs|stabbed|plunge|plunges|plunged|bury|buries|buried|sink|sinks|sank|ram|rams|rammed|thrust|thrusts|press|presses|pressed|pin|pins|pinned|shove|shoves|shoved|force|forces|forced|gouge|gouges|gouged|slam|slams|slammed)\b/;
  if (!offensive.test(t)) return false;
  const foeTarget = /\b(?:him|her|them|it|its)\b|\bthe\s+(?:foe|enemy|bandit|brute|linger(?:er)?|wanderer|monster|creature|beast|guard|wolf|goblin|orc|thing)\b|[a-z']+\s+(?:face|head|skull|throat|neck|chest|gut|belly|ribs|heart|eyes?|back|snout|fang|claw)\b/;
  return foeTarget.test(t);
}

function isImprovisedStrikeText(text) {
  const t = String(text || '').toLowerCase();
  if (!/\b(grab|snatch|smash|shatter|break|slam|bash|kick|boot|throw|hurl|fling|toss|lob|shove|ram|drive|wedge|tip|dump|splash|pour|swing)\b/.test(t)) return false;
  if (isFixtureEgressText(t)) return false;
  return /\b(oil|burning|lantern|lamp|torch|flame|fire|chair|stool|table|bottle|mug|rock|stone|beam|plank|board|door|window|windowsill|sill|shutter|hinge|wall|floor|ceiling|roof)\b/.test(t);
}

function improvisedStrikeProfile(text, base, pc) {
  const t = String(text || '').toLowerCase();
  if (!isImprovisedStrikeText(t)) return base;
  const label =
    /\b(oil|burning)\b/.test(t) ? 'Burning Oil' :
    /\b(lantern|lamp)\b/.test(t) ? 'Lantern' :
    /\b(torch|flame|fire)\b/.test(t) ? 'Flame' :
    /\b(chair|stool)\b/.test(t) ? 'Chair' :
    /\b(table)\b/.test(t) ? 'Table' :
    /\b(bottle|mug)\b/.test(t) ? 'Bottle' :
    /\b(rock|stone)\b/.test(t) ? 'Stone' :
    /\b(beam|plank|board)\b/.test(t) ? 'Timber' :
    /\b(door|window|windowsill|sill|shutter|hinge)\b/.test(t) ? 'Fixture' :
    /\b(wall|floor|ceiling|roof)\b/.test(t) ? 'Room Hazard' :
    null;
  if (!label) return base;

  const d = pc?.dnd;
  const might = d ? (Number(d.mods?.STR) || 0) : statMod(pc?.stats?.MIGHT ?? 10);
  return {
    ...base,
    name: `Improvised ${label}`,
    die: 4,
    atkBonus: might,
    dmgMod: might,
    ranged: /\b(throw|hurl|fling|toss|lob)\b/.test(t),
    finesse: false,
    twoHanded: false
  };
}

/**
 * cantripProfile(pc) -> { ref, name, die, type, verb, atkBonus } | null
 * The PC's attack cantrip. 5e sheet: the class cantrip with the sheet's spell
 * attack bonus (high elves of martial classes know fire bolt, INT-based).
 * Legacy: the hedge-caster's fire bolt. Martial sheets: null — no cantrip.
 */
export function cantripProfile(pc) {
  const d = pc?.dnd;
  if (d) {
    const byClass = SRD_CANTRIPS[d.class?.id];
    if (byClass && d.spellcasting) {
      return { ...byClass, atkBonus: d.spellcasting.attackBonus };
    }
    // High Elf bonus cantrip (one wizard cantrip, INT-based) for non-casters.
    if (d.species?.id === 'elf') {
      return { ...SRD_CANTRIPS.wizard, atkBonus: d.profBonus + d.mods.INT };
    }
    return null;
  }
  const wits = pc?.stats?.WITS ?? 10;
  return {
    ref: 'fire_bolt', name: 'Fire Bolt', die: FIREBOLT_DMG_DIE, type: 'fire', verb: 'fire bolt',
    atkBonus: FIREBOLT_ATK_BONUS + statMod(wits)
  };
}

function isCaster(pc) {
  return Boolean(cantripProfile(pc));
}

// ── Class & species features (v24) ──────────────────────────────────────────
// Feature state lives in meta.escapeFeats. Per-fight fields (rageActive,
// secondWindUsed, breathUsed) reset when combat.beganAt changes; layPool and
// relentlessUsed persist across fights and replenish on shortRest.

const LAY_ON_HANDS_PER_LEVEL = 5;
const LAY_ON_HANDS_PER_USE = 5;
const RAGE_DAMAGE_BONUS = 2;
const SECOND_WIND_DIE = 10;

function featState(w, beganAt) {
  const f = w.meta?.escapeFeats;
  if (f && f.beganAt === beganAt) {
    // Older saved shapes may predate the slot-spell fields — default them.
    return { blessActive: false, tempHp: 0, agathysActive: false, actionSurgeUsed: false, ...f };
  }
  // New fight: per-fight fields (rage, second wind, breath, bless, agathys)
  // reset; the paladin pool and relentless endurance carry over.
  return {
    beganAt,
    rageActive: false,
    secondWindUsed: false,
    breathUsed: false,
    actionSurgeUsed: false,
    blessActive: false,
    tempHp: 0,
    agathysActive: false,
    layPool: Number.isFinite(Number(f?.layPool)) ? f.layPool : -1,
    relentlessUsed: Boolean(f?.relentlessUsed)
  };
}

function hasFeature(pc, type) {
  const feats = pc?.dnd?.features;
  if (!Array.isArray(feats)) return false;
  return feats.some(f => f?.effect?.type === type);
}

function breathInfo(pc) {
  const d = pc?.dnd;
  if (!d || !hasFeature(pc, 'breathWeapon')) return null;
  const damage = d.species?.ancestry?.damage || 'fire';
  // Save DC 8 + CON mod + proficiency, per the SRD.
  return { damage, dc: 8 + d.mods.CON + d.profBonus, die: 6, count: 2 };
}

// Slot spells the escape resolver can cast directly. Each costs a 1st-level
// slot (consumeSpellSlot). Anything not in this table is known-but-deep-engine
// (charm person, entangle ride the full castSpell path, not the escape loop).
const SLOT_SPELLS = {
  magic_missile: { name: 'Magic Missile', verb: 'missile', kind: 'autohit', darts: 3, die: 4, flat: 1, type: 'force' },
  witch_bolt: { name: 'Witch Bolt', verb: 'witch bolt', kind: 'attack', die: 12, type: 'lightning' },
  bless: { name: 'Bless', verb: 'bless', kind: 'bless' },
  shield: { name: 'Shield', verb: 'shield', kind: 'shield', acBonus: 5 },
  armor_of_agathys: { name: 'Armor of Agathys', verb: 'agathys', kind: 'agathys', tempHp: 5, retaliate: 5 },
  charm_person: { name: 'Charm Person', verb: 'charm', kind: 'charm', rounds: 2 },
  entangle: { name: 'Entangle', verb: 'entangle', kind: 'entangle' },
  // Higher-tier spells learned through leveling. minSlot gates the cast: no
  // 2nd-level slot, no scorching ray.
  scorching_ray: { name: 'Scorching Ray', verb: 'scorch', kind: 'rays', minSlot: 2, rays: 3, dice: 2, die: 6, type: 'fire' },
  hold_person: { name: 'Hold Person', verb: 'hold', kind: 'hold', minSlot: 2, rounds: 2 },
  fireball: { name: 'Fireball', verb: 'fireball', kind: 'fireball', minSlot: 3, dice: 8, die: 6, type: 'fire' }
};

// Lowest live slot at or above a spell's tier (fireball needs a 3rd).
function lowestSlotAtLeast(pc, min) {
  const slots = pc?.spells?.slots || {};
  for (let lvl = Math.max(1, min || 1); lvl <= 5; lvl++) {
    if ((Number(slots[lvl]) || 0) > 0) return lvl;
  }
  return 0;
}

// Escape-model condition effects: a charmed foe won't raise a hand against
// you; a restrained one fights tangled (-4 to hit, +4 to be hit) and tries a
// STR save each round to rip free. Enemy save bonus is the flat +2 used
// everywhere in the tamed escape model.
const ENEMY_SAVE_BONUS = 2;
const RESTRAINED_PENALTY = 4;

function knownSlotSpell(pc, ref) {
  const d = pc?.dnd;
  if (!d || !d.spellcasting) return null;
  const known = Array.isArray(pc?.spells?.known) ? pc.spells.known : [];
  if (!known.includes(ref) || !SLOT_SPELLS[ref]) return null;
  return { ...SLOT_SPELLS[ref], ref, atkBonus: d.spellcasting.attackBonus };
}

// Lowest spell slot with a charge left (a level-3 warlock has ONLY 2nd-level
// pact slots, so "any slot" must look upward). 0 = dry. Spells cast through a
// higher slot upcast per the SRD (handled at each cast site).
function lowestSlot(pc) {
  const slots = pc?.spells?.slots || {};
  for (const lvl of [1, 2, 3, 4, 5]) {
    if ((Number(slots[lvl]) || 0) > 0) return lvl;
  }
  return 0;
}

function slotsLeft(pc) {
  return lowestSlot(pc) > 0 ? 1 : 0;
}

// P-68 — the bottle in your pack. Prefers what the text names; otherwise the
// first consumable that would do something right now.
function findConsumable(pc, text) {
  const t = String(text || '').toLowerCase();
  const items = (pc?.inventory?.items || [])
    .map(it => ({ it, def: getItemDef(it.defRef) }))
    .filter(x => x.def && x.def.kind === 'consumable' && x.def.effect);
  if (!items.length) return null;
  const named = items.find(x => x.def.name.toLowerCase().split(/\s+/).some(wd => wd.length > 3 && t.includes(wd)));
  return named || items[0];
}

function rollAmount(rng, spec) {
  const m = String(spec || '').match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!m) return Math.max(1, Math.trunc(Number(spec)) || 1);
  let total = parseInt(m[3] || '0', 10);
  for (let i = 0; i < parseInt(m[1], 10); i++) total += rng.int(1, parseInt(m[2], 10));
  return Math.max(1, total);
}

function cureInfo(pc) {
  const d = pc?.dnd;
  if (!d || !d.spellcasting) return null;
  const known = Array.isArray(pc?.spells?.known) ? pc.spells.known : [];
  if (!known.includes('cure_wounds')) return null;
  const mod = d.mods[d.spellcasting.ability] ?? 0;
  // Life Domain's Disciple of Life: +2 + spell level on healing spells.
  const discipleBonus = (d.class?.subclass === 'Life Domain') ? 3 : 0;
  return { mod, discipleBonus, slotLevel: 1 };
}

/**
 * featureActions(pc) -> [{id, name, verb, note}]
 * The class/species feature actions available to this character, for the kit
 * panel and the resolver. Empty for legacy (sheet-less) characters.
 */
export function featureActions(pc) {
  const d = pc?.dnd;
  if (!d) return [];
  const out = [];
  if (hasFeature(pc, 'rage')) {
    out.push({ id: 'rage', name: 'Rage', verb: 'rage', note: `+${RAGE_DAMAGE_BONUS} melee damage, take half from blows, this fight. Type "rage".` });
  }
  if (hasFeature(pc, 'secondWind')) {
    out.push({ id: 'secondWind', name: 'Second Wind', verb: 'second wind', note: `Catch your breath: heal 1d${SECOND_WIND_DIE}+${d.level}. Once per fight. Type "second wind".` });
  }
  const breath = breathInfo(pc);
  if (breath) {
    out.push({ id: 'breath', name: `Breath Weapon (${breath.damage})`, verb: 'breathe', note: `${breath.count}d${breath.die} ${breath.damage} to every foe, DC ${breath.dc} save for half. Once per fight. Type "breathe".` });
  }
  if (hasFeature(pc, 'layOnHands')) {
    out.push({ id: 'layHands', name: 'Lay on Hands', verb: 'lay on hands', note: `A pool of ${LAY_ON_HANDS_PER_LEVEL * d.level} healing. Type "lay on hands".` });
  }
  // Level-2 actions earned through play.
  if (hasFeature(pc, 'actionSurge')) {
    out.push({ id: 'actionSurge', name: 'Action Surge', verb: 'surge', note: 'Two attacks this turn. Once per fight. Type "surge".' });
  }
  if (hasFeature(pc, 'recklessAttack')) {
    out.push({ id: 'reckless', name: 'Reckless Attack', verb: 'reckless', note: 'Advantage on your melee swings; they get the same on you. Type "reckless".' });
  }
  if (hasFeature(pc, 'divineSmite')) {
    out.push({ id: 'smite', name: 'Divine Smite', verb: 'smite', note: 'Strike, and burn a slot for +2d8 radiant on the hit. Type "smite".' });
  }
  return out;
}

/**
 * playerMaxHp(pc) -> number
 * 5e sheet: the sheet's real maximum HP. Legacy: classic escape HP + GRIT.
 */
export function playerMaxHp(pc) {
  const sheetHP = Number(pc?.dnd?.maxHP);
  if (Number.isInteger(sheetHP) && sheetHP > 0) return sheetHP;
  const grit = pc?.stats?.GRIT ?? 10;
  return Math.max(1, PLAYER_BASE_HP + statMod(grit));
}

export function playerAc(pc) {
  // P-69 — typed equipped gear first. Worn armor sets the base; an equipped
  // shield and protective accessories stack on top of whichever base applies.
  const items = pc?.inventory?.items || [];
  const dexMod = pc?.dnd?.mods?.DEX ?? statMod(pc?.stats?.AGILITY ?? 10);
  let bonus = 0;
  let base = null;
  for (const it of items) {
    if (!it.equipped) continue;
    const def = getItemDef(it.defRef);
    if (!def) continue;
    // P-77 — attunement gates the MAGIC, not the steel: unbonded armor still
    // armors at its base; the bonus and accessory protection stay asleep.
    const asleep = def.attunement && !it.attuned;
    if (def.kind === 'armor' && def.shield) bonus += asleep ? Math.min(2, Number(def.ac) || 0) : Number(def.ac) || 0;
    else if (def.kind === 'armor' && it.equipped === 'armor') {
      const dexCap = def.maxDexBonus == null ? Infinity : Number(def.maxDexBonus);
      base = (Number(def.ac) || 10) + Math.min(dexMod, dexCap) + (asleep ? 0 : Number(def.bonus?.ac) || 0);
    } else if (def.acBonus && !asleep) bonus += Number(def.acBonus) || 0;
  }
  if (base != null) return base + bonus;
  const sheetAC = Number(pc?.dnd?.ac);
  if (Number.isInteger(sheetAC) && sheetAC > 0) return sheetAC + bonus;
  const agi = pc?.stats?.AGILITY ?? 10;
  return PLAYER_BASE_AC + statMod(agi) + bonus;
}

/**
 * currentRoomCover(world) -> coverFeature | null
 * The best piece of cover in the room the fight is happening in. Reads the
 * current interior room (world.scene.interior) and asks the shared cover module
 * what it holds. Returns null outdoors / when there's no room — outdoor cover is
 * a later slice, so an open-road ambush simply offers nothing to hide behind.
 */
function currentRoomCover(world) {
  const interior = world?.scene?.interior;
  if (!interior || typeof interior !== 'object') return null;
  const st = world?.structures?.byId?.[String(interior.structureKey || '')];
  const rooms = Array.isArray(st?.topology?.rooms) ? st.topology.rooms : [];
  const room = rooms.find(r => String(r?.id) === String(interior.roomId || ''));
  if (!room) return null;
  return bestCover(coverForRoom(room));
}

// DX-2c — source the enemy side's opening tactical positions, ONCE at fight start
// (the caller gates this on round === 1, then persists the result on the enemies
// array so it carries forward and stays contestable). Two-sided XCOM tension: some
// foes start behind cover (harder to hit) or holding the high ground (they strike
// with advantage). Seeded from a SEPARATE rng (world seed + beganAt), so it never
// perturbs the turn's combat stream — a fight whose roll yields no terrain edge for
// any foe keeps the identical rng stream it had before DX-2c. A perched / ranged
// foe (archer, slinger, harpy) is built to use ground and cover; others only
// sometimes do. THE LAW holds: this sets STATE the DM narrates, never a number.
function sourceEnemyTactical(enemies, world, beganAt) {
  const trng = makeRng(seedFromString(`${world?.meta?.seed || ''}|enemyTactical|${beganAt}`));
  const PERCHED = /\b(archer|bowman|bowwoman|slinger|sniper|gunner|marksman|crossbow|hawk|raven|harpy|eyrie|sentinel|watcher|gargoyle)\b/i;
  return enemies.map(e => {
    if (!e || typeof e !== 'object') return e;
    const base = (e.tactical && typeof e.tactical === 'object')
      ? e.tactical : { cover: 'none', flanked: false, highGround: false };
    // A defeated foe brought into the array (aftermath) takes no position.
    if (e.defeated || (Number(e.hp) || 0) <= 0) return e;
    const perched = PERCHED.test(String(e.name || ''));
    const coverRoll = trng.int(1, 6);
    const hgRoll = trng.int(1, 6);
    let cover = base.cover === 'half' || base.cover === 'full' ? base.cover : 'none';
    let highGround = Boolean(base.highGround);
    if (perched) {
      // The perched foe reliably has the terrain: cover on 3+, the heights on 4+.
      if (coverRoll >= 3) cover = coverRoll === 6 ? 'full' : 'half';
      if (hgRoll >= 4) highGround = true;
    } else {
      // A common foe only occasionally seizes terrain — kept rare so the bulk of
      // simple fights stay non-tactical (and stream-identical).
      if (coverRoll === 6) cover = 'half';
      if (hgRoll === 6) highGround = true;
    }
    if (cover === base.cover && highGround === Boolean(base.highGround)) return e;
    return { ...e, tactical: { ...base, cover, highGround } };
  });
}

/**
 * initEscapeHp(world) -> world
 * Set the player's starting hit points. Called once at beginAdventure for
 * escape mode. Idempotent-ish: only initializes when unset.
 */
export function initEscapeHp(world) {
  const w = ensureWorld(world);
  if (w.meta?.mode !== 'escape') return w;
  const pc = w.party?.[0] || {};
  const max = playerMaxHp(pc);
  return { ...w, meta: { ...w.meta, escapeHp: max, escapeMaxHp: max } };
}

/**
 * initEscapeKit(world) -> world
 * Equip the hedge-caster's found blade and two cantrips. Called once at
 * beginAdventure for escape mode. Idempotent: skips items already present.
 */
export function initEscapeKit(world) {
  const w = ensureWorld(world);
  if (w.meta?.mode !== 'escape') return w;
  const party = Array.isArray(w.party) ? w.party.slice() : [];
  const pc = party[0];
  if (!pc) return w;

  // 5e character: the class kit IS the kit. No found blade, no hedge-caster
  // cantrips — just register the class's own cantrip refs (casters only) so
  // the spellbook panel and combat verbs line up with the sheet.
  if (pc.dnd) {
    const cantrip = cantripProfile(pc);
    const known = Array.isArray(pc.spells?.known) ? pc.spells.known.slice() : [];
    if (cantrip && !known.includes(cantrip.ref)) known.push(cantrip.ref);
    if (cantrip && !known.includes('ward')) known.push('ward'); // casters keep the defensive ward
    party[0] = { ...pc, spells: { ...pc.spells, known } };
    return { ...w, party };
  }

  const weapons = Array.isArray(pc.inventory?.weapons) ? pc.inventory.weapons.slice() : [];
  const hasBlade = weapons.some(weapon => {
    const id = String(weapon?.id || '').toLowerCase();
    const name = String(weapon?.name || weapon || '').toLowerCase();
    return id === ESCAPE_KIT.weapon.id || name === ESCAPE_KIT.weapon.name.toLowerCase();
  });
  if (!hasBlade) weapons.push({ ...ESCAPE_KIT.weapon });

  const known = Array.isArray(pc.spells?.known) ? pc.spells.known.slice() : [];
  for (const c of ESCAPE_KIT.cantrips) {
    if (!known.includes(c.ref)) known.push(c.ref);
  }

  party[0] = {
    ...pc,
    inventory: { ...pc.inventory, weapons },
    spells: { ...pc.spells, known }
  };
  return { ...w, party };
}

/**
 * escapeKitView(pc) -> { weapons:[{name,verb,note}], spells:[{name,verb,note}] }
 * Re-join the PC's known weapon/spell refs with the kit display metadata so the
 * UI can render always-visible inventory + spellbook panels with typed verbs.
 */
export function escapeKitView(pc) {
  // 5e character: build the panel from the sheet's real weapon + class cantrip
  // + class/species feature actions.
  if (pc?.dnd) {
    const melee = meleeProfile(pc);
    const cantrip = cantripProfile(pc);
    const weapons = [{
      name: melee.name,
      verb: 'strike',
      note: `d20${fmtBonus(melee.atkBonus)} vs AC, d${melee.die}${fmtBonus(melee.dmgMod)} damage. Type "strike".`
    }];
    const spells = [];
    if (cantrip) {
      spells.push({
        name: cantrip.name,
        verb: cantrip.verb,
        note: `Ranged spell attack, d20${fmtBonus(cantrip.atkBonus)} vs AC, d${cantrip.die} ${cantrip.type}. Type "${cantrip.verb}".`
      });
      spells.push({
        name: 'Ward',
        verb: 'ward',
        note: `A shimmer of force. +${WARD_AC_BONUS} AC until your next turn. Type "ward".`
      });
    } else {
      // Martial classes guard with steel, not spells.
      weapons.push({
        name: 'Guard',
        verb: 'guard',
        note: `Set your feet and defend. +${WARD_AC_BONUS} AC until your next turn. Type "guard".`
      });
    }
    // Slot spells the resolver knows how to cast.
    const cure = cureInfo(pc);
    if (cure) {
      spells.push({
        name: 'Cure Wounds',
        verb: 'cure',
        note: `Heal 1d8${fmtBonus(cure.mod + cure.discipleBonus)}. Uses a 1st-level slot. Type "cure".`
      });
    }
    const slotNotes = {
      magic_missile: 'Three darts, 1d4+1 each, never miss. Uses a slot. Type "missile".',
      witch_bolt: 'Spell attack, 1d12 lightning. Uses a slot. Type "witch bolt".',
      bless: '+1d4 on your attack rolls this fight. Uses a slot. Type "bless".',
      shield: '+5 AC until your next turn. Uses a slot. Type "shield".',
      armor_of_agathys: '5 temp HP per slot level; melee attackers take 5 cold. Type "agathys".',
      charm_person: 'WIS save or the target sees a friend (2 rounds). Uses a slot. Type "charm".',
      entangle: 'Grasping weeds: STR save or restrained, every foe. Uses a slot. Type "entangle".',
      scorching_ray: 'Three rays, 2d6 fire each. Needs a 2nd-level slot. Type "scorch".',
      hold_person: 'WIS save or paralyzed — melee hits crit. Needs a 2nd-level slot. Type "hold".',
      fireball: '8d6 fire to every foe, DEX save for half. Needs a 3rd-level slot. Type "fireball".'
    };
    for (const ref of Object.keys(slotNotes)) {
      const spell = knownSlotSpell(pc, ref);
      if (spell) spells.push({ name: spell.name, verb: spell.verb, note: slotNotes[ref] });
    }
    // Feature actions ride in the weapons column — they're things you DO.
    for (const f of featureActions(pc)) {
      weapons.push({ name: f.name, verb: f.verb, note: f.note });
    }
    return { weapons, spells };
  }

  const weaponsOut = [];
  const seenW = new Set();
  for (const weapon of (Array.isArray(pc?.inventory?.weapons) ? pc.inventory.weapons : [])) {
    const id = String(weapon?.id || '').toLowerCase();
    const name = String(weapon?.name || weapon || '').toLowerCase();
    let meta = null;
    if (id === ESCAPE_KIT.weapon.id || name === ESCAPE_KIT.weapon.name.toLowerCase()) meta = ESCAPE_KIT.weapon;
    const label = meta?.name || String(weapon?.name || weapon || 'Weapon');
    if (seenW.has(label)) continue;
    seenW.add(label);
    weaponsOut.push({ name: label, verb: meta?.verb || 'strike', note: meta?.note || '' });
  }

  const spellsOut = [];
  const seenS = new Set();
  for (const ref of (Array.isArray(pc?.spells?.known) ? pc.spells.known : [])) {
    const meta = ESCAPE_KIT.cantrips.find(c => c.ref === ref);
    const label = meta?.name || String(ref).replace(/_/g, ' ');
    if (seenS.has(label)) continue;
    seenS.add(label);
    spellsOut.push({ name: label, verb: meta?.verb || String(ref).replace(/_/g, ' '), note: meta?.note || '' });
  }

  return { weapons: weaponsOut, spells: spellsOut };
}

// CMB-SINK-1 — a FORCEFUL ADVANCE: an aggressive closing / shove-through that bulls
// INTO the fight ("barrel through the doorway", "bull my way through", "shove past
// them", "force my way through", "push in", "rush them"). It is an ENGAGEMENT, not
// flight — so it resolves as a taken turn (move:toward: the round advances and the
// foes react), never as free table-talk and never as a phantom sword swing. Genuine
// flight ("flee"/"retreat"/"run away") is EXCLUDED by the caller's no-flee ruling,
// which stays intact. The barrel/bull tokens here are VERBS, not the cask noun: the
// article lookbehind rejects "the/a/an barrel", and callers check isImprovisedStrike-
// Text first, so "throw the barrel through the window" stays an improvised strike.
export function isForcefulAdvanceText(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;
  // barrel / bull / plow / plough THROUGH|PAST|INTO|IN|FORWARD… — a driving move,
  // guarded against the container noun ("the barrel", "a bull").
  if (/(?<!\b(?:the|a|an|this|that|another|each|every|one|some|no)\s)\b(?:barrel|bull|plough|plow)s?\s+(?:my\s+way\s+|our\s+way\s+|their\s+way\s+)?(?:through|past|into|in\b|forward|ahead|onward|on\b|toward|towards)\b/.test(t)) return true;
  // shove / push THROUGH|PAST|IN|FORWARD|INTO — a movement, not "shove HIM into the wall".
  if (/\b(?:shove|push)\s+(?:my\s+way\s+|our\s+way\s+)?(?:through|past|forward|into|onward|ahead|in\b)/.test(t)) return true;
  // force / barge / bust / muscle / power / carve MY|OUR|YOUR WAY — a bull-through.
  if (/\b(?:force|barge|bust|muscle|power|carve|shoulder)\s+(?:my|our|your)\s+way\b/.test(t)) return true;
  // rush THEM|HIM|HER|IT|THE|IN|FORWARD|THROUGH|PAST|INTO — extends the toward set.
  if (/\brush\s+(?:them|him|her|it|the\b|in\b|forward|through|past|into|at|toward|towards|on\b|ahead)/.test(t)) return true;
  return false;
}

/**
 * parseEscapeAction(text) -> { verb: 'strike'|'firebolt'|'ward'|'cover' }
 * Map a typed line to one of the hedge-caster's light verbs. Unrecognized
 * combat input defaults to a blade strike so the round always advances.
 */
export function parseEscapeAction(text) {
  const t = String(text || '').trim().toLowerCase();
  if (isFixtureEgressText(t)) return { verb: 'egress' };
  // DX-2c — drive a foe out of its cover. Checked FIRST, before the high-ground,
  // flank, and the broad cover match, so "circle its cover" / "flush it out" read
  // as breaking the foe's cover rather than the player taking cover themselves.
  if (/\bflush\s+(?:it|them|him|her|that)?\s*out\b|\b(?:drive|force|chase|smoke|root|push|drag)\s+(?:it|them|him|her|that\s+\w+)?\s*(?:out\s+)?(?:of|from)\s+(?:its|their|his|her|the)?\s*cover\b|\b(?:break|breach|strip|clear|deny|circle|flank|get\s+(?:past|around|behind)|around|past|behind)\s+(?:its|their|his|her|the)\s+cover\b|\bout\s+of\s+cover\b|\bno\s+(?:more\s+)?cover\b/.test(t)) return { verb: 'flushcover' };
  // DX-2b — positional tactical intents that grant advantage. Checked before the
  // broad cover match so "circle behind it" reads as a flank, not as cover.
  if (/\b(?:high|higher)\s+ground\b|\bhigh\s+point\b|\bthe\s+heights\b|\bget\s+(?:up\s+)?(?:high|above)\s+(?:it|them|him|her|the\b)/.test(t)) return { verb: 'highground' };
  if (/\bflank(?:s|ing|ed)?\b|\bcircle\s+(?:around\s+)?behind\b|\b(?:to|at|on|around)\s+(?:its|their|his|her)\s+(?:side|flank|rear|back)\b/.test(t)) return { verb: 'flank' };
  // Cover is a positional move — duck behind the room's furniture for +AC. Check
  // it before the attack verbs so "hide behind the pillar" reads as cover.
  if (/\b(take\s+cover|cover|behind|duck|hunker)\b/.test(t)) return { verb: 'cover' };
  // MX-4 — TALK→TOKEN: spoken spatial movement. These reposition the mini on the
  // board (no attack roll this turn); the resolver picks the cell deterministically
  // (engine/combat/spatialMove.js). Compass first (most specific), then fall-back,
  // then close-on. flank/highground/cover above keep their own precedence; these
  // only catch phrasings that previously defaulted to a blade strike.
  const compass = t.match(/\b(?:move|go|step|head|shift|slide|sidestep|reposition)\s+(?:to\s+the\s+)?(north|south|east|west)\b/);
  if (compass) return { verb: 'move', mode: `compass-${compass[1]}` };
  if (/\b(fall\s+back|retreat|pull\s+back|back\s+(?:away|off)|give\s+ground|disengage|withdraw|move\s+(?:away|back)|create\s+(?:some\s+)?distance|put\s+(?:some\s+)?distance)\b/.test(t)) return { verb: 'move', mode: 'away' };
  if (/\b(charge\s+(?:at|in|on|the|toward|towards|forward)|close\s+(?:on|in|with|the\s+distance|the\s+gap)|advance\s+on|rush\s+(?:at|toward|towards|in)|bear\s+down|press\s+(?:toward|towards|forward|in)|move\s+(?:up\s+)?(?:on|toward|towards|to|into|in\s+on)|get\s+(?:in\s+)?(?:close|closer))\b/.test(t)) return { verb: 'move', mode: 'toward' };
  // CMB-SINK-1 — a forceful advance / shove-through the toward-set above misses
  // ("barrel through", "bull my way through", "shove past them", "force my way
  // through", "push in", "rush them"). A CLOSING move, so it resolves as move:toward
  // (round advances, foes react) — never a phantom strike. isImprovisedStrikeText
  // wins first so "throw the barrel through the window" stays an improvised weapon.
  if (!isImprovisedStrikeText(t) && isForcefulAdvanceText(t)) return { verb: 'move', mode: 'toward' };
  // Class/species features — checked before the generic verbs so "breathe fire"
  // doesn't fall into the cantrip bucket and "rally" doesn't read as a guard.
  // Parley — talking is always an option at this table. Intimidation and
  // persuasion are different levers; the resolver picks the matching skill.
  if (/\b(intimidate|threaten|menace|scare\s+them|frighten)\b/.test(t)) return { verb: 'parley', mode: 'intimidate' };
  if (/\b(parley|negotiate|talk|persuade|convince|reason|surrender|truce|stand\s+down|let\s+us\s+pass|spare|mercy|call\s+(it|them)\s+off)\b/.test(t)) return { verb: 'parley', mode: 'persuade' };
  if (/\b(rage|enrage|berserk)\b/.test(t)) return { verb: 'rage' };
  if (/\b(action\s+surge|surge)\b/.test(t)) return { verb: 'surge' };
  if (/\breckless/.test(t)) return { verb: 'reckless' };
  if (/\bsmite\b/.test(t)) return { verb: 'smite' };
  if (/\b(second\s+wind|rally)\b/.test(t)) return { verb: 'secondwind' };
  if (/\b(breathe|breath|exhale)\b/.test(t)) return { verb: 'breath' };
  if (/\blay\s+(on\s+)?hands?\b/.test(t)) return { verb: 'layhands' };
  // P-68 — drinking something you carry beats casting: "drink the potion",
  // "quaff", "use the antidote". Checked before 'cure' so "drink a healing
  // potion" reaches the bottle, not the spell list.
  if (/\b(potions?|draught|quaff|elixir|antidote)\b/.test(t) || /\bdrink\b/.test(t)) return { verb: 'potion' };
  if (/\b(cure|heal|mend)\b/.test(t)) return { verb: 'cure' };
  // Slot spells. Witch bolt must outrank the generic "bolt" (a fire bolt
  // verb); shield gets its own verb so the resolver can decide spell vs guard.
  // 'Strongest attack' / 'everything I've got' / 'holy fire' — the resolver
  // picks the best available move for this character.
  if (/\b(strongest|hardest|biggest|best)\s+(attack|hit|blow|shot|move)|with everything|all (my|your) (strength|might)|holy (fire|wrath|light|judgment|fury)|full (power|strength)|unleash\b/.test(t)) return { verb: 'strongest' };
  if (/\bwitch\s*bolt\b/.test(t)) return { verb: 'witchbolt' };
  if (/\bfireball\b/.test(t)) return { verb: 'fireball' };
  if (/\b(scorch(ing)?\s*ray|scorch)\b/.test(t)) return { verb: 'scorch' };
  if (/\b(hold\s+(person|him|her|them|it)|paralyz)\w*/.test(t)) return { verb: 'hold' };
  if (/\b(magic\s+missile|missiles?|darts?\s+of\s+force)\b/.test(t)) return { verb: 'missile' };
  if (/\bbless\b/.test(t)) return { verb: 'bless' };
  if (/\b(agathys|frost\s+armou?r|armou?r\s+of\s+agathys)\b/.test(t)) return { verb: 'agathys' };
  if (/\b(charm|beguile)\b/.test(t)) return { verb: 'charm' };
  if (/\b(entangle|roots|vines|snare)\b/.test(t)) return { verb: 'entangle' };
  if (/\bshield\b/.test(t)) return { verb: 'shield' };
  if (/\b(ward|brace|defend|guard|block|parry)\b/.test(t)) return { verb: 'ward' };
  // Cantrip verbs — the hedge-caster's fire bolt plus every class cantrip
  // (eldritch blast, vicious mockery, sacred flame, produce flame) and the
  // generic "cast" so a player can just say "cast at it".
  // EXCLUDED: "burn", "flame", "fire" (standalone) — these match improvised
  // physical actions ("why won't anything burn?", "grab the flaming thatch",
  // "out of fire, I draw my blade"). Fire Bolt fires ONLY on explicit cast
  // intent. Commit 319d23b prior art; extended 2026-06-18 Rung-1 gate.
  if (/\b(fire\s*bolt|firebolt|bolt|ignite|blast|mock|cast|cantrip)\b/.test(t)) return { verb: 'firebolt' };
  // Unarmed / natural-weapon strikes — headbutt, bite, stomp, knee, elbow,
  // kick (as attack on a creature), punch. These must NOT resolve as the
  // equipped weapon; see unarmedProfile(). (H-3/4/5/6 class-a, 2026-06-18.)
  if (/\b(headbutt|head[\s-]butt|bite|bites|biting|bite\s+(?:at|into)|gnaw|gnaws|stomp|stomps|stomping|stamp|stamps|stamping|knee\s+(?:him|her|them|it|the)|elbow|elbows|punch|punches|pummel|pummels|kick\s+(?:him|her|them|it|the)|claw|claws|scratch)\b/.test(t)) return { verb: 'unarmed' };
  // strike verbs (and the default)
  return { verb: 'strike' };
}

function fmtBonus(n) {
  const x = Math.trunc(Number(n)) || 0;
  return (x >= 0 ? '+' : '') + String(x);
}

// DX-2b: a d20 with optional advantage (roll twice, keep the higher). The second
// die is drawn ONLY when advantage is active, so fights without a tactical edge
// keep the exact same rng stream as before.
function rollD20Adv(rng, advantage) {
  const a = rng.int(1, 20);
  return advantage ? Math.max(a, rng.int(1, 20)) : a;
}

// MX-4 — commit a resolved player move through moveCombatant (the grid's
// bounds/occupancy/reach validator). Builds a combat-shaped object from the live
// turn state, asks the grid to move the player token, and returns the committed
// cell — or null if the grid rejected it, so the narration stays honest.
function commitPlayerMove({ grid, playerCell, enemies }, cell) {
  if (!cell) return null;
  const combat = { grid, playerCell, enemies };
  const next = moveCombatant(combat, 'player', cell.cx, cell.cy, { speedFeet: PLAYER_COMBAT_SPEED_FEET });
  if (next === combat) return null;
  const pc = next.playerCell;
  if (!pc || (pc.cx === playerCell.cx && pc.cy === playerCell.cy)) return null;
  return { cx: pc.cx, cy: pc.cy };
}

// MX-4 — the structured tag for a spatial move (mechanicsLine, never prose).
function spatialMoveTag(mode) {
  if (typeof mode === 'string' && mode.startsWith('compass-')) return mode.slice('compass-'.length);
  return mode === 'away' ? 'fallback' : 'toward';
}

// MX-4 — narrate a spatial move as a READ. No cells, coords, or numbers; cardinal
// directions are fiction (a DM says "you fall back to the east"), not coordinates.
function spatialMoveBeat(mode, sm, moved) {
  const who = sm.targetName ? `the ${sm.targetName}` : 'it';
  if (typeof mode === 'string' && mode.startsWith('compass-')) {
    const dir = mode.slice('compass-'.length);
    return moved
      ? `You stride ${dir}, putting open ground under your boots.`
      : `You're already at the edge of the fray — no room to push ${dir}.`;
  }
  if (mode === 'away') {
    return moved
      ? 'You give ground, breaking contact and falling back to open space.'
      : 'There is nowhere left to fall back to — they have you boxed in.';
  }
  // toward / charge
  if (moved) {
    return sm.reached
      ? `You close on ${who}, blade ready.`
      : `You drive toward ${who}, eating up the ground — still a stride short.`;
  }
  if (sm.reason === 'no-target') return 'There is no one here to close on.';
  return `You are already in ${who}'s face — no ground left to close.`;
}

/**
 * shortRest(world, rng) -> world
 * Recover hit points on a clear (no-ambush) hop. Caps at escapeMaxHp.
 */
export function shortRest(world, rng) {
  let w = ensureWorld(world);
  if (w.meta?.mode !== 'escape') return w;
  // Rest also restores class/species reserves: the paladin's healing pool
  // refills (-1 = lazily re-seeded to full on next use) and relentless
  // endurance resets.
  const feats = w.meta?.escapeFeats
    ? { ...w.meta.escapeFeats, layPool: -1, relentlessUsed: false }
    : null;
  // Pact Magic (SRD): warlock spell slots come back on a SHORT rest — that is
  // the entire deal with the patron. Other casters wait for a long rest
  // (no long-rest surface yet; logged in the playtest report).
  const pc0 = w.party?.[0];
  if (pc0?.dnd?.spellcasting?.pact) {
    w = applyDeltas(w, [{ op: 'restoreSpellSlots', entityId: pc0.id || 'party' }]);
  }
  const max = Number(w.meta.escapeMaxHp) || 0;
  const cur = Number(w.meta.escapeHp) || 0;
  if (max <= 0 || cur >= max) {
    return feats ? { ...w, meta: { ...w.meta, escapeFeats: feats } } : w;
  }
  // Song of Rest (bard 2): your music adds 1d6 to short-rest healing.
  const song = (w.party?.[0]?.dnd?.features || []).some(f => f?.effect?.type === 'songOfRest') ? rng.int(1, 6) : 0;
  const heal = rng.int(1, REST_DIE) + REST_FLAT + song;
  const next = Math.min(max, cur + heal);
  return { ...w, meta: { ...w.meta, escapeHp: next, ...(feats ? { escapeFeats: feats } : {}) } };
}

/**
 * combatStatusAnswer(world) -> string
 * A free, in-fiction answer to any question asked mid-combat: who's still
 * standing and how they look, where you stand, and what you can do. Costs
 * nothing — a real DM answers the table's questions without taking their turn.
 */
export function combatStatusAnswer(world) {
  const w = ensureWorld(world);
  const pc = w.party?.[0] || {};
  const enemies = (w.combat?.enemies || []).filter(e => e && !e.defeated && (Number(e.hp) || 0) > 0);

  const foeLines = enemies.map(e => {
    const frac = (Number(e.hp) || 0) / Math.max(1, Number(e.maxHp) || 1);
    const shape = frac >= 1 ? 'unhurt' : frac > 0.6 ? 'bloodied a little' : frac > 0.3 ? 'staggering' : 'nearly done';
    const conds = [];
    if (hasCondition(e.conditions, 'charmed')) conds.push('charmed');
    if (hasCondition(e.conditions, 'restrained')) conds.push('tangled');
    if (hasCondition(e.conditions, 'paralyzed')) conds.push('held rigid');
    return `the ${e.name} (${shape}${conds.length ? ', ' + conds.join(', ') : ''})`;
  });
  const facing = foeLines.length
    ? `Facing you: ${foeLines.join('; ')}.`
    : 'Nothing still stands against you.';

  const hp = Number(w.meta?.escapeHp) || 0;
  const maxHp = Number(w.meta?.escapeMaxHp) || playerMaxHp(pc);
  // Dying state — must be stated explicitly so the LLM narrator cannot
  // interpret the status as ambiguous and generate an un-applied rescue.
  if (hp <= 0) {
    return `You are at 0 HP — down and dying. You cannot act. Only healing or stabilization can pull you back; without it, this is the end.`;
  }
  const you = `You're at ${hp} of ${maxHp} HP${(w.meta?.escapeFeats?.tempHp || 0) > 0 ? ` (+${w.meta.escapeFeats.tempHp} of ice)` : ''}.`;

  const kit = escapeKitView(pc);
  const verbs = [...kit.weapons, ...kit.spells].map(x => `"${x.verb}"`);
  const cover = currentRoomCover(w);
  const options = `You can ${verbs.join(', ')}${cover ? `, "take cover" behind the ${cover.label}` : ''}, or talk ("parley"). No running from this one — they're already on you.`;

  return `${facing} ${you} ${options} Asking costs you nothing — the round waits.`;
}

// Pick the target the player MEANT. Named foes win ("the wolf"); "the big
// one" reads size; "the weak/wounded one" reads hp. Default: first standing.
function pickTargetIdx(enemies, text) {
  const t = String(text || '').toLowerCase();
  const alive = (i) => enemies[i] && !enemies[i].defeated && (Number(enemies[i].hp) || 0) > 0;
  // Negated names don't count: 'kill the wolf, not the bandit' must not
  // target the bandit. Strip negation clauses before matching.
  const scrubbed = t.replace(/\b(?:not|don'?t|do not|except|leave|spare|ignore)\s+(?:the\s+|that\s+)?\w+/g, ' ');
  // By name (longest names first so 'dire wolf' beats 'wolf').
  const byName = enemies
    .map((e, i) => ({ i, name: String(e?.name || '').toLowerCase() }))
    .filter(x => x.name && alive(x.i))
    .sort((a, b) => b.name.length - a.name.length);
  for (const { i, name } of byName) {
    if (name && scrubbed.includes(name)) return i;
  }
  if (/\b(big(gest)?|large|huge)\b/.test(t)) {
    let best = -1;
    for (let i = 0; i < enemies.length; i++) {
      if (alive(i) && (best < 0 || (enemies[i].maxHp || 0) > (enemies[best].maxHp || 0))) best = i;
    }
    if (best >= 0) return best;
  }
  if (/\b(small(est)?|little|weak(est)?|wounded|hurt|bloodied)\b/.test(t)) {
    let best = -1;
    for (let i = 0; i < enemies.length; i++) {
      if (alive(i) && (best < 0 || (enemies[i].hp || 0) < (enemies[best].hp || 0))) best = i;
    }
    if (best >= 0) return best;
  }
  return enemies.findIndex((e, i) => alive(i));
}

/**
 * awardXpAndLevel(world, enemies, beats) -> world
 * Overcoming an encounter — by steel or by talk — earns the XP. Level-ups
 * apply immediately at the moment of triumph: HP/prof/slots/features
 * recomputed by the pure levelUpSheet, escape HP raised by the gain.
 */
function awardXpAndLevel(world, enemies, beats) {
  let w = world;
  const pc = w.party?.[0];
  if (!pc) return w;
  const xp = xpForEnemies(enemies);
  if (xp <= 0) return w;
  w = applyDeltas(w, [{ op: 'gainXp', amount: xp }]);
  beats.push(`(+${xp} XP)`);

  let cur = w.party[0];
  if (!cur.dnd) return w;
  let leveled = false;
  while (levelForXp(cur.xp) > cur.dnd.level && cur.dnd.level < 20) {
    const before = cur.dnd.maxHP;
    cur = levelUpSheet(cur);
    const gained = Array.isArray(cur.gainedFeatures) && cur.gainedFeatures.length
      ? ` New: ${cur.gainedFeatures.join(', ')}.`
      : '';
    beats.push(`LEVEL ${cur.dnd.level}! +${cur.dnd.maxHP - before} HP.${gained}`);
    leveled = true;
  }
  if (leveled) {
    const { gainedFeatures, ...clean } = cur;
    const party = [...w.party];
    party[0] = clean;
    const hpGain = clean.dnd.maxHP - (Number(w.meta.escapeMaxHp) || clean.dnd.maxHP);
    w = {
      ...w,
      party,
      meta: {
        ...w.meta,
        escapeMaxHp: clean.dnd.maxHP,
        escapeHp: Math.min(clean.dnd.maxHP, (Number(w.meta.escapeHp) || 0) + Math.max(0, hpGain))
      }
    };
  }
  return w;
}

/**
 * longRest(world) -> world
 * A real night's sleep at a settlement: full HP, all spell slots back, every
 * class/species reserve refilled. The long-rest counterpart to shortRest's
 * catch-your-breath. Caller gates on location (settlement) and combat.
 */
export function longRest(world) {
  const w = ensureWorld(world);
  if (w.meta?.mode !== 'escape') return w;
  const pc = w.party?.[0];
  const max = Number(w.meta.escapeMaxHp) || (pc ? playerMaxHp(pc) : 0);
  const feats = w.meta?.escapeFeats
    ? { ...w.meta.escapeFeats, layPool: -1, relentlessUsed: false }
    : null;
  let out = {
    ...w,
    meta: { ...w.meta, escapeHp: max, escapeMaxHp: max, ...(feats ? { escapeFeats: feats } : {}) }
  };
  if (pc?.dnd?.spellcasting) {
    out = applyDeltas(out, [{ op: 'restoreSpellSlots', entityId: pc.id || 'party' }]);
  }
  return out;
}

/**
 * applySurpriseRound(world, rng) -> { world, beats, hit }
 *
 * A surprise round before the victim can act: each living ambusher gets one free
 * opening strike against the player. Used by travel ambushes the party FAILED to
 * notice (the perception contest is decided by the caller in playloop). Reuses the
 * same to-hit/damage math as a normal enemy turn. Deterministic via `rng`.
 */
export function applySurpriseRound(world, rng) {
  const w0 = ensureWorld(world);
  if (!w0.combat?.active) return { world: w0, beats: [], hit: false };
  const pc = w0.party?.[0] || {};
  const ac = playerAc(pc);
  const enemies = Array.isArray(w0.combat.enemies) ? w0.combat.enemies : [];
  let hp = Number(w0.meta.escapeHp) || 0;
  const beats = [];
  let hit = false;
  for (const e of enemies) {
    if (!e || e.defeated || (Number(e.hp) || 0) <= 0) continue;
    const roll = rng.int(1, 20);
    const total = roll + ENEMY_ATK_BONUS;
    if (roll === 1) { beats.push(`The ${e.name} lunges from hiding but misses.`); continue; }
    if (roll === 20 || total >= ac) {
      const die = Math.max(2, Number(e.damage) || 4);
      const crit = roll === 20;
      let dmg = rng.int(1, die);
      if (crit) dmg += rng.int(1, die);
      dmg = Math.max(1, dmg);
      hp = Math.max(0, hp - dmg);
      beats.push(`The ${e.name} strikes from hiding for ${dmg}${crit ? ' (critical!)' : ''} before you can ready yourself.`);
      hit = true;
      if (hp <= 0) break;
    } else {
      beats.push(`The ${e.name} springs from cover, but you flinch aside just in time.`);
    }
  }
  let w = { ...w0, meta: { ...w0.meta, escapeHp: hp } };
  if (hp <= 0) w = endCombat(w, { reason: 'defeated-in-surprise' });
  return { world: w, beats, hit };
}

/**
 * resolveEscapeCombatTurn(world, actionText) -> { world, result }
 *
 * One full round: the player acts (strike / fire bolt / ward) on their typed
 * intent, then every living enemy strikes back. Ends combat on victory; locks
 * the loss ending on defeat.
 *
 * result.beats        — array of short lines, one per exchange (for paced reveal)
 * result.combatSummary— the beats joined (for AI narration / fallback)
 */
// A foe minted from a named NPC (sourceNpcId) carries a PROPER name — "Elske
// Nightherd", not "the goblin" — so combat prose must not stick an article on it.
// Rather than thread this through ~35 beat sites, strip "the/The {Name}" -> "{Name}"
// once on the way out, for the proper-named foes in THIS fight. Generic creatures
// ("the goblin") keep their article. Pre-turn enemy list, so a foe felled this turn
// still reads right.
// ── DX-2d-i: trait-aware enemy damage (live escape engine) ───────────────────
// Folds the foe's damage-taken traits (Evasion / Uncanny Dodge / fire-&-cold
// auras = DR) onto the already-rolled `rawDmg`, applies it to the enemy IN PLACE,
// then runs its onDeath traits (Undead Fortitude / Rejuvenation / Reassemble /
// Reforming…) so a foe can refuse to fall ONCE per fight (one-shot, enforced via
// the `_traitRevived` flag — mirrors combatResolve.processDeathTraits). Pure
// arithmetic on rolled values — it draws NO rng, so a trait-less foe stays
// byte-identical (the determinism guard). Returns the figures the caller's beat
// reads:
//   dmg        — damage after trait DR (what actually came off the foe)
//   hp         — enemy hp after (surviving hp, revived hp, or 0)
//   dropped    — the blow took it to 0 (the prose says "it drops")
//   defeated   — truly down (dropped and did NOT revive)
//   revived    — clawed back this hit
//   reviveBeat — fiction line for the comeback (no number/label — THE LAW)
function applyEnemyDamage(enemy, rawDmg, dmgType, world) {
  const base = Math.max(0, Number(rawDmg) || 0);
  if (base <= 0) {
    return { dmg: 0, hp: Math.max(0, Number(enemy.hp) || 0), dropped: false, defeated: false, revived: false, reviveBeat: '' };
  }
  const dmg = applyDamageTakenTraits(enemy, base, dmgType);
  let hp = Math.max(0, (Number(enemy.hp) || 0) - dmg);
  enemy.hp = hp;
  const dropped = hp <= 0;
  let defeated = false, revived = false, reviveBeat = '';
  if (dropped) {
    const death = (!enemy._traitRevived) ? applyDeathTraits(enemy, world) : { revive: false };
    if (death.revive) {
      hp = Math.max(1, Number(death.hpIfRevived) || 1);
      enemy.hp = hp;
      enemy._traitRevived = true;
      revived = true;
      reviveBeat = `The ${enemy.name} drops — then will not stay down, dragging itself back upright.`;
    } else {
      enemy.defeated = true;
      defeated = true;
    }
  }
  return { dmg, hp, dropped, defeated, revived, reviveBeat };
}

function stripFoeArticles(result, properNames) {
  if (!result || !properNames.length) return result;
  const fix = (s) => properNames.reduce((acc, nm) => {
    const esc = nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return acc.replace(new RegExp(`\\b[Tt]he ${esc}\\b`, 'g'), nm);
  }, String(s == null ? '' : s));
  return {
    ...result,
    beats: Array.isArray(result.beats) ? result.beats.map(fix) : result.beats,
    combatSummary: typeof result.combatSummary === 'string' ? fix(result.combatSummary) : result.combatSummary
  };
}

export function resolveEscapeCombatTurn(world, actionText = '') {
  const proper = ((world?.combat?.enemies) || [])
    .filter(e => e && e.sourceNpcId && e.name)
    .map(e => String(e.name));
  const out = resolveEscapeCombatTurnCore(world, actionText);
  return proper.length ? { ...out, result: stripFoeArticles(out.result, proper) } : out;
}

function resolveEscapeCombatTurnCore(world, actionText = '') {
  let w = ensureWorld(world);
  if (!w.combat?.active) {
    return { world: w, result: { beats: [], combatSummary: '', mechanicsLine: '', outcome: 'mixed' } };
  }

  const pc = w.party?.[0] || {};
  const round = Number(w.combat.round) || 1;
  const rng = makeRng(seedFromString(`${w.meta?.seed || ''}|escapeCombat|${w.timeline.length}|r${round}`));
  const beats = [];
  let actionMech = ''; // a grapple action surfaces its own mechanics line
  const { verb: rawVerb, mode } = parseEscapeAction(actionText);
  let verb = rawVerb;
  const grappleIntent = parseGrappleVerb(actionText);
  // Martial grapple intents only override the 'strike' DEFAULT — never a spell,
  // parley, cover, or ward verb. (Grapple slice, 2026-06-15.)
  if (verb === 'strike' && !isImprovisedStrikeText(actionText)) {
    if (grappleIntent) verb = grappleIntent;
  }
  // An attack aimed at the foe must RESOLVE even when phrased as an exit ("throw
  // the knife into its chest and dive out the window") or a wrestle ("press its
  // face into the flames and hold it there"). Without this, the egress branch and
  // the spell-less 'hold' branch swallow the blow — no roll, no damage, and a
  // lethal hit does nothing. Route those to the strike branch (which resolves the
  // roll, applies damage, and marks a lethal foe defeated). A real spell — "hold
  // person" / "paralyze" — keeps its caster path. (Gate 2026-06-23.)
  const attackAtFoe = isAttackAtFoe(actionText);
  if (attackAtFoe && (verb === 'egress'
    || (verb === 'hold' && !/\bhold\s+person\b|\bparaly/i.test(actionText)))) {
    verb = 'strike';
  }
  let warded = false;
  let wardBonus = 0;
  let recklessThisRound = false;

  // ── Cover state ─────────────────────────────────────────────────────────────
  // Cover persists across rounds within one fight, scoped to combat.beganAt so a
  // fresh fight always starts in the open. The combatState delta whitelists its
  // fields, so cover rides in meta alongside escapeHp instead of on combat.
  const beganAt = Number(w.combat.beganAt) || 0;
  const roomCover = currentRoomCover(w);
  const savedCover = w.meta?.escapeCover;
  let coverState = (savedCover && savedCover.active && savedCover.beganAt === beganAt)
    ? { ...savedCover } : null;

  // DX-2b: the player's tactical position (cover/flank/high-ground), persisted on
  // the combat object (DX-2a schema) so the DM's tactical read sees it and the
  // structured path shares one model. High-ground/flank are sourced by the verbs
  // below and grant advantage on the player's attack roll; cover is mirrored from
  // the escapeCover system above so the read is consistent.
  let playerTactical = { ...(w.combat?.playerTactical || { cover: 'none', flanked: false, highGround: false }) };

  // MX-4 — TALK→TOKEN: the player's mini cell on the tactical grid. A spoken
  // spatial-move command resolves a destination deterministically and commits it
  // through moveCombatant; the persisted playerCell is what the Battle board
  // reflects. Initialized from current combat state (ensureWorld normalized it).
  let playerCell = { ...(w.combat?.playerCell || { cx: 0, cy: 0 }) };

  // ── Feature state (v24) ─────────────────────────────────────────────────────
  // Rage / second wind / breath reset per fight (beganAt scope); the paladin's
  // pool and relentless endurance persist until a rest.
  const feats = featState(w, beganAt);

  // "Use my strongest attack" / "with everything I've got" — the DM picks
  // your best available move, in order of how hard it actually hits.
  if (rawVerb === 'strongest') {
    const m = meleeProfile(pc);
    if (knownSlotSpell(pc, 'fireball') && lowestSlotAtLeast(pc, 3) > 0) verb = 'fireball';
    else if (hasFeature(pc, 'divineSmite') && !m.ranged && slotsLeft(pc) > 0) verb = 'smite';
    else if (hasFeature(pc, 'actionSurge') && !feats.actionSurgeUsed) verb = 'surge';
    else if (knownSlotSpell(pc, 'scorching_ray') && lowestSlotAtLeast(pc, 2) > 0) verb = 'scorch';
    else if (knownSlotSpell(pc, 'magic_missile') && lowestSlot(pc) > 0) verb = 'missile';
    else if (hasFeature(pc, 'recklessAttack') && !m.ranged) verb = 'reckless';
    else verb = 'strike';
  }

  // ── Dying gate: 0-HP PC cannot take normal actions ──────────────────────────
  // A rescue/stabilize intent applies 1 HP (minimum stabilize) and ends the
  // player turn. Any other action at 0 HP is blocked — the PC is down/dying.
  // Self-healing verbs (cure/potion/layhands) bypass this gate so a paladin
  // or cleric can attempt a last-resort heal. (Rung-1 gate 2026-06-18.)
  const pcHpNow = Number(w.meta?.escapeHp) || 0;
  if (pcHpNow <= 0 && verb !== 'cure' && verb !== 'potion' && verb !== 'layhands') {
    const RESCUE_RE = /\b(?:healed?|stabil[iu]z(?:e[sd]?|ing|ed?)?|cured?|revived?|rescue(?:d)?|drag(?:ged)?\s+(?:\w+\s+)?(?:me|out)|pull(?:ed)?\s+(?:\w+\s+)?(?:me|out)|saved?\s+me)\b/i;
    if (RESCUE_RE.test(String(actionText || ''))) {
      w = { ...w, meta: { ...w.meta, escapeHp: 1 } };
      beats.push("You're pulled back — 1 HP. Stabilized.");
      actionMech = '[heal:stabilize | hp:0→1]';
    } else {
      beats.push('You are at 0 HP — down and dying. You cannot act. Healing or stabilization is the only way back.');
      actionMech = '[combat:dying | no-action]';
    }
    w = { ...w, meta: { ...w.meta, escapeFeats: { ...feats } } };
    w = applyDeltas(w, [{ op: 'combatState', set: { round: round + 1, turnIndex: 0 } }]);
    return {
      world: w,
      result: { beats, combatSummary: beats.join(' '), mechanicsLine: actionMech, outcome: 'failure' }
    };
  }

  // ── Player turn ────────────────────────────────────────────────────────────
  let enemies = (Array.isArray(w.combat.enemies) ? w.combat.enemies : []).map(e => ({
    ...e,
    // DX-2d-i (Step 0): every escape foe carries a traits array (default []), so
    // the trait hooks run for bestiary foes and are a clean no-op for trait-less
    // ones. mintEnemyFromNpc already threads this; the default covers legacy/
    // synthetic enemies from older saves.
    traits: Array.isArray(e.traits) ? e.traits : []
  }));
  // DX-2c: on the FIRST round of a fight, source the enemy side's opening tactical
  // positions (some foes hold cover / the high ground). Round === 1 marks the first
  // player turn (the surprise round doesn't advance it), so this runs exactly once;
  // the result rides the persisted enemies array forward and stays contestable. Uses
  // a separate rng (see sourceEnemyTactical), so the turn stream is untouched.
  if (round === 1) enemies = sourceEnemyTactical(enemies, w, beganAt);
  const hadAliveAtTurnStart = enemies.some(e => e && !e.defeated && (Number(e.hp) || 0) > 0);
  // P-75: snapshot boss hp before the player's strike for phase-crossing detection.
  const bossHpAtStart = new Map(enemies.map(e => [e.id, Number(e.hp) || 0]));
  // Named targeting: 'the wolf', 'the big one', 'the wounded one' all land
  // where the player pointed. Default: first standing foe.
  const targetIdx = pickTargetIdx(enemies, actionText);

  if (!hadAliveAtTurnStart) {
  const noTargetMech = (verb === 'grapple' || verb === 'throw' || verb === 'choke' || verb === 'escape')
      ? '[grapple:no-target]'
      : '[combat:no-live-target]';
    const noTargetBeat = noTargetMech === '[grapple:no-target]'
      ? 'There is no one here to lay hands on.'
      : 'There is no living foe here to fight.';
    return {
      world: w,
      result: { beats: [noTargetBeat], combatSummary: noTargetBeat, mechanicsLine: noTargetMech, outcome: 'mixed' }
    };
  }

  const hazardKind = parseHazard(actionText);
  if (verb === 'egress') {
    beats.push('You force the way open and shout for people to clear out — movement, not a blow aimed at the foe.');
    actionMech = '[combat:egress]';
  } else if (hazardKind && !attackAtFoe) {
    // Environmental hazard mid-fight (roof collapse / fire / fall): SRD damage to
    // the PC and everyone caught in the area. PC damage goes to meta.escapeHp (as
    // heals do — the enemy turn re-reads it); enemies mutate in place (area).
    const hres = resolveHazard({ kind: hazardKind, pc, escapeHp: Number(w.meta?.escapeHp) || 0, escMax: Number(w.meta?.escapeMaxHp) || 0, enemies, rng });
    w = { ...w, meta: { ...w.meta, escapeHp: hres.hp } };
    for (const b of hres.beats) beats.push(b);
    actionMech = hres.mechanicsLine || '';
  } else if (verb === 'grapple' || verb === 'throw' || verb === 'choke' || verb === 'escape') {
    // Martial grapple: state lives as conditions on the foe (grappled=clinch,
    // +prone=down); the choke ratchets to unconscious. See engine/combat/grapple.js.
    const gr = resolveGrappleAction({ pc, enemies, targetIdx, verb, rng });
    for (const b of gr.beats) beats.push(b);
    actionMech = gr.mechanicsLine || '';
  } else if (verb === 'cover') {
    if (roomCover) {
      coverState = { active: true, bonus: Number(roomCover.bonus) || 0, label: roomCover.label, tier: roomCover.tier, beganAt };
      // Mirror into the shared tactical model for the DM's read (DX-2b): a
      // +5-grade feature reads as full cover, anything lighter as half.
      playerTactical.cover = (Number(roomCover.bonus) || 0) >= 5 ? 'full' : 'half';
      beats.push(`You slip behind the ${roomCover.label} — ${roomCover.tier} cover (+${coverState.bonus} AC).`);
    } else {
      beats.push('There is nothing here to take cover behind.');
    }
  } else if (verb === 'highground') {
    // DX-2b: take the high ground — advantage on your attacks while you hold it
    // (until the fight ends). A positioning action; the foe still gets its turn.
    playerTactical.highGround = true;
    beats.push('You scramble up to the high ground — the better footing, the longer reach, the downward angle all yours.');
    actionMech = '[tactical:high-ground]';
  } else if (verb === 'flank') {
    // DX-2b: maneuver to the foe's flank — advantage attacking it (the defender
    // is caught between angles). Lands on the named/first standing foe.
    // MX-4: this is also a spatial move — the mini circles to a cell beside/behind
    // the foe on the board. The tag is set whenever there's a foe to flank
    // (geometry-gating the advantage is MX-2, deferred); the TOKEN moves only when
    // a flank cell is in reach.
    const fIdx = targetIdx >= 0 ? targetIdx : enemies.findIndex(e => e && !e.defeated && (Number(e.hp) || 0) > 0);
    if (fIdx >= 0) {
      enemies[fIdx] = { ...enemies[fIdx], tactical: { ...(enemies[fIdx].tactical || {}), flanked: true } };
      const sm = resolveSpatialMove({ kind: 'flank', playerCell, enemies, grid: w.combat.grid, targetIdx: fIdx });
      const moved = commitPlayerMove({ grid: w.combat.grid, playerCell, enemies }, sm.cell);
      if (moved) playerCell = moved;
      beats.push(moved
        ? `You circle to the ${enemies[fIdx].name}'s flank — its guard splits between you and the angle you've opened.`
        : `You slip to the ${enemies[fIdx].name}'s flank — its guard splits between you and the angle you've opened.`);
      actionMech = '[tactical:flank]';
    } else {
      beats.push('There is no one here to get around.');
    }
  } else if (verb === 'move') {
    // MX-4 — TALK→TOKEN: spoken repositioning. The resolver picks the destination
    // cell deterministically from current positions (engine/combat/spatialMove.js);
    // moveCombatant commits it; the Battle board reflects the new cell. A
    // positioning action — no attack roll — so the foe still gets its turn.
    // Narrated as a READ; no cells/coords/numbers ever surface.
    const sm = resolveSpatialMove({ kind: mode, playerCell, enemies, grid: w.combat.grid, targetIdx });
    const moved = commitPlayerMove({ grid: w.combat.grid, playerCell, enemies }, sm.cell);
    if (moved) {
      playerCell = moved;
      beats.push(spatialMoveBeat(mode, sm, true));
      actionMech = `[move:${spatialMoveTag(mode)}${sm.reached ? '' : ' | partial'}]`;
    } else {
      beats.push(spatialMoveBeat(mode, sm, false));
      actionMech = `[move:${spatialMoveTag(mode)} | ${sm.reason}]`;
    }
  } else if (verb === 'flushcover') {
    // DX-2c contest: drive a foe out of its cover — clears that enemy's
    // tactical.cover so your next strike lands clean. A positioning action (the
    // foe still gets its turn). Lands on the named/first COVERED foe; if the named
    // target has no cover, falls back to whichever standing foe does.
    const isCovered = (e) => e && !e.defeated && (Number(e.hp) || 0) > 0
      && (e.tactical?.cover === 'half' || e.tactical?.cover === 'full');
    let covIdx = (targetIdx >= 0 && isCovered(enemies[targetIdx])) ? targetIdx : -1;
    if (covIdx < 0) covIdx = enemies.findIndex(isCovered);
    if (covIdx >= 0) {
      enemies[covIdx] = { ...enemies[covIdx], tactical: { ...(enemies[covIdx].tactical || {}), cover: 'none' } };
      beats.push(`You sweep wide and drive the ${enemies[covIdx].name} out of its cover — nothing between you and it now.`);
      actionMech = '[tactical:flush-cover]';
    } else {
      const fIdx = targetIdx >= 0 ? targetIdx : enemies.findIndex(e => e && !e.defeated && (Number(e.hp) || 0) > 0);
      beats.push(fIdx >= 0
        ? `You move to flush it out, but the ${enemies[fIdx].name} has no cover to lose.`
        : 'There is no one here to flush out.');
      actionMech = '[tactical:flush-cover | no-cover]';
    }
  } else if (verb === 'rage') {
    if (hasFeature(pc, 'rage') && !feats.rageActive) {
      feats.rageActive = true;
      beats.push(`You let the red tide take you — RAGE. (+${RAGE_DAMAGE_BONUS} melee damage; blades and blows deal you half.)`);
    } else if (feats.rageActive) {
      beats.push('You are already raging.');
    } else {
      beats.push('You grit your teeth, but fury is not your discipline.');
    }
  } else if (verb === 'secondwind') {
    if (hasFeature(pc, 'secondWind') && !feats.secondWindUsed) {
      feats.secondWindUsed = true;
      const heal = rng.int(1, SECOND_WIND_DIE) + (Number(pc.dnd?.level) || 1);
      const maxHp = Number(w.meta.escapeMaxHp) || playerMaxHp(pc);
      const before = Number(w.meta.escapeHp) || 0;
      const after = Math.min(maxHp, before + heal);
      w = { ...w, meta: { ...w.meta, escapeHp: after } };
      beats.push(`You catch your second wind — ${after - before} HP back. (${after}/${maxHp})`);
    } else if (feats.secondWindUsed) {
      beats.push('You have no second wind left in this fight.');
    } else {
      beats.push('You suck air, but stamina like that is a fighter\'s trick.');
    }
  } else if (verb === 'layhands') {
    if (hasFeature(pc, 'layOnHands')) {
      if (feats.layPool < 0) feats.layPool = LAY_ON_HANDS_PER_LEVEL * (Number(pc.dnd?.level) || 1);
      const maxHp = Number(w.meta.escapeMaxHp) || playerMaxHp(pc);
      const before = Number(w.meta.escapeHp) || 0;
      const heal = Math.min(LAY_ON_HANDS_PER_USE, feats.layPool, maxHp - before);
      if (heal > 0) {
        feats.layPool -= heal;
        w = { ...w, meta: { ...w.meta, escapeHp: before + heal } };
        beats.push(`Light pools under your palms — ${heal} HP restored. (${feats.layPool} left in the well.)`);
      } else if (feats.layPool <= 0) {
        beats.push('The well of light is empty until you rest.');
      } else {
        beats.push('You are already whole.');
      }
    } else {
      beats.push('You press your hands to the wound, but no light answers.');
    }
  } else if (verb === 'potion') {
    const found = findConsumable(pc, actionText);
    if (!found) {
      beats.push('You slap your pockets — no potion, no draught, nothing to drink but resolve.');
    } else if (found.def.effect.kind === 'heal') {
      const maxHp = Number(w.meta.escapeMaxHp) || playerMaxHp(pc);
      const before = Number(w.meta.escapeHp) || 0;
      if (before >= maxHp) {
        beats.push(`You're already whole — the ${found.def.name.toLowerCase()} stays corked.`);
      } else {
        const heal = Math.min(maxHp - before, rollAmount(rng, found.def.effect.amount));
        w = applyDeltas(w, [{ op: 'removeItemById', entityId: pc.id || 'party', itemId: found.it.id }]);
        w = { ...w, meta: { ...w.meta, escapeHp: before + heal } };
        beats.push(`You pull the cork with your teeth and drink. The ${found.def.name.toLowerCase()} burns going down — ${heal} HP back. (${before + heal}/${maxHp}.)`);
      }
    } else if (found.def.effect.kind === 'removeCondition') {
      const cond = String(found.def.effect.condition || '');
      const had = hasCondition(pc.conditions, cond);
      w = applyDeltas(w, [{ op: 'removeItemById', entityId: pc.id || 'party', itemId: found.it.id }]);
      if (had) {
        const conditions = (pc.conditions || []).filter(c => String(c?.name || c) !== cond);
        w = { ...w, party: [{ ...w.party[0], conditions }, ...w.party.slice(1)] };
        beats.push(`The ${found.def.name.toLowerCase()} is bitter as bad news, but the ${cond} lifts like fog off a field.`);
      } else {
        beats.push(`You drink the ${found.def.name.toLowerCase()}. Bitter — and, as far as you can tell, unnecessary.`);
      }
    } else {
      beats.push(`The ${found.def.name.toLowerCase()} stays in your pack — no use for it here.`);
    }
  } else if (verb === 'cure') {
    const cure = cureInfo(pc);
    if (cure && lowestSlot(pc) > 0) {
      const maxHp = Number(w.meta.escapeMaxHp) || playerMaxHp(pc);
      const before = Number(w.meta.escapeHp) || 0;
      const slotLvl = lowestSlot(pc);
      // Upcast: +1d8 per slot level above 1st.
      let healRoll = 0;
      for (let i = 0; i < slotLvl; i++) healRoll += rng.int(1, 8);
      const heal = Math.min(maxHp - before, Math.max(1, healRoll + cure.mod + cure.discipleBonus));
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', entityId: pc.id || 'party', level: slotLvl }]);
      w = { ...w, meta: { ...w.meta, escapeHp: before + heal } };
      const slotObj = w.party?.[0]?.spells?.slots || {};
      const slotsAfter = [1, 2, 3, 4, 5].reduce((a, l) => a + (Number(slotObj[l]) || 0), 0);
      beats.push(`Cure wounds knits you back together — ${heal} HP${slotLvl > 1 ? ` (level-${slotLvl} slot)` : ''}. (${before + heal}/${maxHp}; ${slotsAfter} slot${slotsAfter === 1 ? '' : 's'} left.)`);
    } else if (cure) {
      beats.push('Your spell slots are spent. Steel will have to do.');
    } else if (hasFeature(pc, 'layOnHands')) {
      beats.push('Your healing flows through your hands, not spells — try "lay on hands".');
    } else {
      beats.push('You know no healing magic.');
    }
  } else if (verb === 'breath') {
    const breath = breathInfo(pc);
    if (breath && !feats.breathUsed) {
      feats.breathUsed = true;
      let dropped = 0;
      for (const e of enemies) {
        if (!e || e.defeated || (Number(e.hp) || 0) <= 0) continue;
        const save = rng.int(1, 20) + 2;
        let raw = rng.int(1, breath.die) + rng.int(1, breath.die);
        if (save >= breath.dc) raw = Math.floor(raw / 2);
        raw = Math.max(save >= breath.dc ? 0 : 1, raw);
        const hit = applyEnemyDamage(e, raw, breath.damage, w);
        if (hit.defeated) dropped++;
        beats.push(`The ${e.name} ${save >= breath.dc ? 'twists half-clear of' : 'takes the full force of'} your ${breath.damage} breath — ${hit.dmg} ${breath.damage}.${hit.dropped ? ' It drops.' : ''}`);
        if (hit.revived) beats.push(hit.reviveBeat);
      }
      if (dropped === 0 && !beats.length) beats.push('Your breath scorches empty air.');
    } else if (feats.breathUsed) {
      beats.push('Your breath is spent — it will return when the fight is done.');
    } else {
      beats.push('You huff. Nothing comes out. (No draconic ancestry.)');
    }
  } else if (verb === 'missile' || verb === 'witchbolt') {
    const ref = verb === 'missile' ? 'magic_missile' : 'witch_bolt';
    const spell = knownSlotSpell(pc, ref);
    if (spell && slotsLeft(pc) > 0 && targetIdx >= 0) {
      const target = enemies[targetIdx];
      const slotLvl = lowestSlot(pc);
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', entityId: pc.id || 'party', level: slotLvl }]);
      if (spell.kind === 'autohit') {
        // Magic missile: every dart hits. No roll, no mercy. Upcast: one
        // extra dart per slot level above 1st.
        const darts = spell.darts + Math.max(0, slotLvl - 1);
        let raw = 0;
        for (let i = 0; i < darts; i++) raw += rng.int(1, spell.die) + spell.flat;
        const hit = applyEnemyDamage(target, raw, 'force', w);
        beats.push(`${darts === 3 ? 'Three' : darts} darts of force streak unerringly into the ${target.name} — ${hit.dmg} force${slotLvl > 1 ? ` (level-${slotLvl} slot)` : ''}${hit.dropped ? ' — it drops.' : `. (${hit.hp} HP left)`}`);
        if (hit.revived) beats.push(hit.reviveBeat);
      } else {
        const roll = rng.int(1, 20);
        // DX-2d-i: effective AC folds the foe's Natural Armor / Shell / Magic
        // Resistance (applyACTraits is a no-op for trait-less foes).
        const ac = applyACTraits(target, Number(target.ac) || 10);
        const total = roll + spell.atkBonus + (feats.blessActive ? rng.int(1, 4) : 0) + (hasCondition(target.conditions, 'restrained') ? RESTRAINED_PENALTY : 0);
        if (roll !== 1 && (roll === 20 || total >= ac)) {
          const crit = roll === 20;
          // Witch bolt upcasts: +1d12 per slot level above 1st.
          const dice = 1 + Math.max(0, slotLvl - 1);
          let raw = 0;
          for (let i = 0; i < dice * (crit ? 2 : 1); i++) raw += rng.int(1, spell.die);
          const hit = applyEnemyDamage(target, raw, 'lightning', w);
          beats.push(`A crackling arc of lightning lashes the ${target.name} for ${hit.dmg}${crit ? ' (critical!)' : ''}${slotLvl > 1 ? ` (level-${slotLvl} slot)` : ''}${hit.dropped ? ' — it drops.' : `. (${hit.hp} HP left)`}`);
          if (hit.revived) beats.push(hit.reviveBeat);
        } else {
          beats.push(`Your witch bolt cracks past the ${target.name} and grounds out in the dirt.`);
        }
      }
    } else if (spell && slotsLeft(pc) <= 0) {
      beats.push('Your spell slots are spent. Cantrips will have to carry you.');
    } else {
      beats.push('You trace the sigil, but that spell is not yours.');
    }
  } else if (verb === 'parley') {
    const living = enemies.filter(e => e && !e.defeated && (Number(e.hp) || 0) > 0);
    const unbending = living.find(e => e.canParley === false);
    if (!living.length) {
      beats.push('There is no one left to talk to.');
    } else if (unbending) {
      beats.push(`The ${unbending.name} does not bargain. Words mean nothing to it.`);
    } else {
      // DC: 13 cold; 10 once you've dropped as many as still stand (they've
      // seen what you can do); 8 if one of them is charmed (your "friend"
      // vouches for you).
      const downed = enemies.filter(e => e && e.defeated).length;
      const anyCharmed = living.some(e => hasCondition(e.conditions, 'charmed'));
      let dc = 13;
      if (downed >= living.length && downed > 0) dc = 10;
      if (anyCharmed) dc = 8;
      // Skill off the sheet: Intimidation for threats, Persuasion for the
      // rest. Legacy characters use raw CHARM.
      const skill = mode === 'intimidate' ? 'Intimidation' : 'Persuasion';
      const bonus = pc?.dnd ? (Number(pc.dnd.skills?.[skill]) || 0) : statMod(pc?.stats?.CHARM ?? 10);
      const roll = rng.int(1, 20);
      const total = roll + bonus + (feats.blessActive ? rng.int(1, 4) : 0);
      if (roll !== 1 && total >= dc) {
        beats.push(mode === 'intimidate'
          ? `You let them see exactly what the next minute costs. (${skill} ${total} vs DC ${dc}) They weigh it — and back away, weapons low, until the dark takes them.`
          : `You keep your hands open and your voice level. (${skill} ${total} vs DC ${dc}) A long beat — then they ease off, and the road is yours.`);
        w = applyDeltas(w, [{
          op: 'combatState',
          set: { enemies, round, turnIndex: 0 }
        }]);
        w = { ...w, meta: { ...w.meta, escapeFeats: { ...feats } } };
        // You overcame the encounter — talked past it, but overcame it. Full XP.
        w = awardXpAndLevel(w, enemies, beats);
        w = endCombat(w, { reason: 'parley' });
        return {
          world: w,
          result: {
            beats,
            combatSummary: beats.join(' '),
            mechanicsLine: `[combat:parley | ${skill} ${total} vs DC ${dc}]`,
            outcome: 'success'
          }
        };
      }
      beats.push(mode === 'intimidate'
        ? `Your threat lands flat. (${skill} ${total} vs DC ${dc}) Steel answers.`
        : `Words fail. (${skill} ${total} vs DC ${dc}) Steel answers.`);
    }
  } else if (verb === 'charm') {
    const spell = knownSlotSpell(pc, 'charm_person');
    if (spell && slotsLeft(pc) > 0 && targetIdx >= 0) {
      const target = enemies[targetIdx];
      const slotLvl = lowestSlot(pc);
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', entityId: pc.id || 'party', level: slotLvl }]);
      const dc = pc.dnd.spellcasting.saveDC;
      const save = rng.int(1, 20) + ENEMY_SAVE_BONUS;
      if (save < dc) {
        target.conditions = applyCondition(
          target.conditions || [],
          { name: 'charmed', until: spell.rounds, source: 'charm_person', stackBehavior: 'replace' },
          target.conditionImmunities || []
        );
        if (hasCondition(target.conditions, 'charmed')) {
          beats.push(`The ${target.name}'s eyes soften — your charm takes hold. It sees a friend where you stand.`);
        } else {
          beats.push(`The ${target.name} is beyond charming — your magic slides off it.`);
        }
      } else {
        beats.push(`The ${target.name} blinks hard and shakes off your charm — and it knows what you tried.`);
      }
    } else if (spell && slotsLeft(pc) <= 0) {
      beats.push('Your spell slots are spent.');
    } else {
      beats.push('You smile your warmest smile. Nothing magical happens.');
    }
  } else if (verb === 'entangle') {
    const spell = knownSlotSpell(pc, 'entangle');
    if (spell && slotsLeft(pc) > 0) {
      const slotLvl = lowestSlot(pc);
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', entityId: pc.id || 'party', level: slotLvl }]);
      const dc = pc.dnd.spellcasting.saveDC;
      let caught = 0;
      for (const e of enemies) {
        if (!e || e.defeated || (Number(e.hp) || 0) <= 0) continue;
        const save = rng.int(1, 20) + ENEMY_SAVE_BONUS;
        if (save < dc) {
          e.conditions = applyCondition(
            e.conditions || [],
            { name: 'restrained', until: 'save_ends', source: 'entangle', saveToEnd: { stat: 'MIGHT', dc }, stackBehavior: 'replace' },
            e.conditionImmunities || []
          );
          if (hasCondition(e.conditions, 'restrained')) {
            caught++;
            beats.push(`Grasping weeds erupt and lash around the ${e.name} — restrained.`);
          }
        } else {
          beats.push(`The ${e.name} tears clear of the grasping weeds.`);
        }
      }
      if (!caught) beats.push('The ground writhes, but nothing holds.');
    } else if (spell && slotsLeft(pc) <= 0) {
      beats.push('Your spell slots are spent.');
    } else {
      beats.push('You call to the green. The green does not answer you.');
    }
  } else if (verb === 'scorch') {
    const spell = knownSlotSpell(pc, 'scorching_ray');
    const slotLvl = spell ? lowestSlotAtLeast(pc, spell.minSlot) : 0;
    if (spell && slotLvl > 0 && targetIdx >= 0) {
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', entityId: pc.id || 'party', level: slotLvl }]);
      // Three rays (+1 per slot level above 2nd), each its own attack roll,
      // walked across the line of foes — spillover rays seek the next target.
      const rays = spell.rays + Math.max(0, slotLvl - spell.minSlot);
      let anyBeat = false;
      for (let i = 0; i < rays; i++) {
        const tIdx = enemies.findIndex(e => e && !e.defeated && (Number(e.hp) || 0) > 0);
        if (tIdx < 0) break;
        const tgt = enemies[tIdx];
        const r = rng.int(1, 20);
        const tot = r + spell.atkBonus + (feats.blessActive ? rng.int(1, 4) : 0);
        if (r !== 1 && (r === 20 || tot >= applyACTraits(tgt, Number(tgt.ac) || 10))) {
          let raw = rng.int(1, spell.die) + rng.int(1, spell.die);
          if (r === 20) raw += rng.int(1, spell.die) + rng.int(1, spell.die);
          const hit = applyEnemyDamage(tgt, raw, 'fire', w);
          beats.push(`A ray of fire sears the ${tgt.name} for ${hit.dmg}${r === 20 ? ' (critical!)' : ''}${hit.dropped ? ' — it drops.' : `. (${hit.hp} HP left)`}`);
          if (hit.revived) beats.push(hit.reviveBeat);
        } else {
          beats.push(`A ray of fire hisses past the ${tgt.name}.`);
        }
        anyBeat = true;
      }
      if (!anyBeat) beats.push('Your rays sputter at empty air.');
    } else if (spell && lowestSlot(pc) > 0) {
      beats.push('Scorching ray needs a 2nd-level slot — yours are too thin.');
    } else if (spell) {
      beats.push('Your spell slots are spent.');
    } else {
      beats.push('You snap your fingers for the rays, but that spell is not yours.');
    }
  } else if (verb === 'hold') {
    const spell = knownSlotSpell(pc, 'hold_person');
    const slotLvl = spell ? lowestSlotAtLeast(pc, spell.minSlot) : 0;
    if (spell && slotLvl > 0 && targetIdx >= 0) {
      const target = enemies[targetIdx];
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', entityId: pc.id || 'party', level: slotLvl }]);
      const dc = pc.dnd.spellcasting.saveDC;
      const save = rng.int(1, 20) + ENEMY_SAVE_BONUS;
      if (save < dc) {
        target.conditions = applyCondition(
          target.conditions || [],
          { name: 'paralyzed', until: spell.rounds, source: 'hold_person', stackBehavior: 'replace' },
          target.conditionImmunities || []
        );
        if (hasCondition(target.conditions, 'paralyzed')) {
          beats.push(`The ${target.name} goes rigid mid-step — held fast, eyes wide, muscles locked.`);
        } else {
          beats.push(`The ${target.name} cannot be held — your magic finds nothing to grip.`);
        }
      } else {
        beats.push(`The ${target.name} shudders, strains — and breaks your hold before it sets.`);
      }
    } else if (spell && lowestSlot(pc) > 0) {
      beats.push('Hold person needs a 2nd-level slot — yours are too thin.');
    } else if (spell) {
      beats.push('Your spell slots are spent.');
    } else {
      beats.push('You clench a fist at them. Nothing holds.');
    }
  } else if (verb === 'fireball') {
    const spell = knownSlotSpell(pc, 'fireball');
    const slotLvl = spell ? lowestSlotAtLeast(pc, spell.minSlot) : 0;
    if (spell && slotLvl > 0) {
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', entityId: pc.id || 'party', level: slotLvl }]);
      const dc = pc.dnd.spellcasting.saveDC;
      const dice = spell.dice + Math.max(0, slotLvl - spell.minSlot);
      let base = 0;
      for (let i = 0; i < dice; i++) base += rng.int(1, spell.die);
      beats.push(`A bead of light streaks out and the world goes orange — FIREBALL (${dice}d6).`);
      for (const e of enemies) {
        if (!e || e.defeated || (Number(e.hp) || 0) <= 0) continue;
        const save = rng.int(1, 20) + ENEMY_SAVE_BONUS;
        const raw = save >= dc ? Math.floor(base / 2) : base;
        const hit = applyEnemyDamage(e, raw, 'fire', w);
        beats.push(`The ${e.name} ${save >= dc ? 'dives clear of the worst of it' : 'takes the blast full'} — ${hit.dmg} fire.${hit.dropped ? ' It drops.' : ''}`);
        if (hit.revived) beats.push(hit.reviveBeat);
      }
    } else if (spell && lowestSlot(pc) > 0) {
      beats.push('Fireball needs a 3rd-level slot. The bead of light refuses to form.');
    } else if (spell) {
      beats.push('Your spell slots are spent.');
    } else {
      beats.push('You sketch the rune for fire and get smoke. That spell is not yours.');
    }
  } else if (verb === 'bless') {
    const spell = knownSlotSpell(pc, 'bless');
    if (spell && slotsLeft(pc) > 0 && !feats.blessActive) {
      const slotLvl = lowestSlot(pc);
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', entityId: pc.id || 'party', level: slotLvl }]);
      feats.blessActive = true;
      beats.push('A quiet radiance settles over you — Bless (+1d4 on your attack rolls this fight).');
    } else if (feats.blessActive) {
      beats.push('You are already blessed. Greed is unbecoming.');
    } else if (spell) {
      beats.push('Your spell slots are spent.');
    } else {
      beats.push('You mouth the litany, but no god is listening.');
    }
  } else if (verb === 'agathys') {
    const spell = knownSlotSpell(pc, 'armor_of_agathys');
    if (spell && slotsLeft(pc) > 0 && !feats.agathysActive) {
      const slotLvl = lowestSlot(pc);
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', entityId: pc.id || 'party', level: slotLvl }]);
      feats.agathysActive = true;
      // Upcast: 5 temp HP per slot level — the warlock's pact slots make
      // this the signature of a deeper bargain.
      const ice = spell.tempHp * slotLvl;
      feats.tempHp += ice;
      beats.push(`Black ice sheathes you — Armor of Agathys (${ice} temp HP; melee attackers take ${spell.retaliate} cold while it holds).`);
    } else if (feats.agathysActive) {
      beats.push('The ice already holds.');
    } else if (spell) {
      beats.push('Your spell slots are spent.');
    } else {
      beats.push('You whisper to the void. The void declines.');
    }
  } else if (verb === 'shield' || verb === 'ward') {
    // "Shield" the word: if you know Shield the spell and have a slot, you get
    // the spell (+5). Otherwise it's a plain ward/guard (+4) — the DM reads
    // intent, not keywords.
    const spell = verb === 'shield' ? knownSlotSpell(pc, 'shield') : null;
    if (spell && slotsLeft(pc) > 0) {
      const slotLvl = lowestSlot(pc);
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', entityId: pc.id || 'party', level: slotLvl }]);
      warded = true;
      wardBonus = spell.acBonus;
      actionMech = `[ward:Shield | AC:${playerAc(pc) + wardBonus} | combat:r${round + 1}]`;
      beats.push(`An invisible plane of force snaps into being — Shield (+${spell.acBonus} AC until your next turn).`);
    } else {
      warded = true;
      wardBonus = WARD_AC_BONUS;
      actionMech = `[ward | AC:${playerAc(pc) + wardBonus} | combat:r${round + 1}]`;
      beats.push(isCaster(pc)
        ? `You raise a ward — a shimmer of force hardens the air around you (+${WARD_AC_BONUS} AC).`
        : `You set your feet and raise your guard (+${WARD_AC_BONUS} AC).`);
    }
  } else if (targetIdx >= 0) {
    const target = enemies[targetIdx];
    // DX-2c: honor the foe's own cover — a covered foe is harder to hit (+2 half /
    // +5 full effective AC), mirroring the player's escapeCover. coverAcBonus is 0
    // for an uncovered foe, so this is a no-op for fights without enemy cover.
    // DX-2d-i: fold the foe's AC traits (Natural Armor / Shell / Magic Resistance)
    // alongside the DX-2c cover bonus — both no-ops when absent.
    const ac = applyACTraits(target, Number(target.ac) || 10) + coverAcBonus(target?.tactical?.cover);
    // DX-2b: advantage from tactical position — the player holds the high ground
    // or strikes a flanked foe. True D&D advantage: roll 2d20, keep the higher.
    // The second die is only drawn when advantage is active, so the rng stream is
    // unchanged for fights without it.
    const tacticalAdv = Boolean(playerTactical.highGround) || Boolean(target?.tactical?.flanked);
    let roll = rollD20Adv(rng, tacticalAdv);
    // Halfling Lucky: reroll any natural 1 on an attack roll (SRD).
    if (roll === 1 && hasFeature(pc, 'rerollOnes')) {
      roll = rng.int(1, 20);
      beats.push(`(Lucky — the die clatters off the table on a 1; you roll again: ${roll}.)`);
    }
    const cantrip = verb === 'firebolt' ? cantripProfile(pc) : null;

    if (cantrip) {
      const total = roll + cantrip.atkBonus + (feats.blessActive ? rng.int(1, 4) : 0) + (hasCondition(target.conditions, 'restrained') ? RESTRAINED_PENALTY : 0);
      const cname = cantrip.name.toLowerCase();
      if (roll === 1) {
        beats.push(`Your ${cname} sputters wide of the ${target.name}.`);
        actionMech = `[cantrip:${cantrip.name} | atk:${total} vs AC:${ac} → miss]`;
      } else if (roll === 20 || total >= ac) {
        const crit = roll === 20;
        // Cantrips scale with character level (SRD): two dice at 5th.
        const cantripDice = ((pc?.dnd?.level || 1) >= 5 ? 2 : 1) * (crit ? 2 : 1);
        let raw = 0;
        for (let i = 0; i < cantripDice; i++) raw += rng.int(1, cantrip.die);
        // Agonizing Blast (warlock 2): CHA mod rides the eldritch blast.
        if (cantrip.ref === 'eldritch_blast' && hasFeature(pc, 'agonizingBlast')) raw += Math.max(0, pc.dnd.mods.CHA);
        raw = Math.max(1, raw);
        const hit = applyEnemyDamage(target, raw, cantrip.type, w);
        beats.push(`Your ${cname} sears the ${target.name} for ${hit.dmg} ${cantrip.type}${crit ? ' (critical!)' : ''}${hit.dropped ? ' — it drops.' : `. (${hit.hp} HP left)`}`);
        if (hit.revived) beats.push(hit.reviveBeat);
        actionMech = `[cantrip:${cantrip.name} | atk:${total} vs AC:${ac} → hit | ${hit.dmg} ${cantrip.type}${crit ? ' crit' : ''}]`;
      } else {
        beats.push(`Your ${cname} sputters wide of the ${target.name}.`);
        actionMech = `[cantrip:${cantrip.name} | atk:${total} vs AC:${ac} → miss]`;
      }
    } else {
      // weapon strike (default — also where a cantrip-less martial's "cast" lands)
      const melee = improvisedStrikeProfile(actionText, naturalStrikeProfile(actionText, meleeProfile(pc)), pc);
      const style = pc?.dnd?.fightingStyle || null;
      // Archery: +2 to ranged attack rolls (fighter style at 1, ranger at 2).
      // Dueling: +2 damage with a one-handed melee weapon.
      const archery = style === 'Archery' || hasFeature(pc, 'rangedAttackBonus');
      const styleAtk = (archery && melee.ranged) ? 2 : 0;
      const styleDmg = (style === 'Dueling' && !melee.ranged && !melee.twoHanded) ? 2 : 0;
      const rageDmg = (feats.rageActive && !melee.ranged) ? RAGE_DAMAGE_BONUS : 0;
      const wname = melee.name.toLowerCase();

      // Attack riders, levels 2-5. Extra Attack (5) makes every Attack action
      // two swings; Action Surge doubles whatever you have.
      const baseSwings = hasFeature(pc, 'extraAttack') ? 2 : 1;
      let swings = baseSwings;
      let recklessAtk = 0;
      if (verb === 'surge') {
        if (hasFeature(pc, 'actionSurge') && !feats.actionSurgeUsed) {
          feats.actionSurgeUsed = true;
          swings = baseSwings * 2;
          beats.push(`You push past your limits — ACTION SURGE. ${swings === 2 ? 'Two attacks' : `${swings} attacks`}.`);
        } else if (hasFeature(pc, 'actionSurge')) {
          beats.push('Your surge is spent for this fight. One swing will have to do.');
        } else {
          beats.push('You strain for a second wind of violence, but that burst is a fighter\'s trick.');
        }
      }
      if (verb === 'reckless') {
        if (hasFeature(pc, 'recklessAttack') && !melee.ranged) {
          recklessAtk = 4;
          recklessThisRound = true;
          beats.push('You throw your guard wide and swing with everything behind it.');
        } else if (!hasFeature(pc, 'recklessAttack')) {
          beats.push('You swing wild — recklessness without the fury to back it.');
        }
      }
      const wantSmite = verb === 'smite';

      // Surface the dice in the structured mechanics line (not just the prose
      // beats) so a strike never reads as a no-roll resolution. (Opus gate
      // follow-up 2026-06-16: a contested action looked like it resolved with
      // zero dice because the strike branch left actionMech empty, falling back
      // to the bare round marker `[combat:rN]`.)
      let firstTot = null, firstAc = null, anyHit = false, swingHits = 0, swingDmg = 0;

      for (let swing = 0; swing < swings; swing++) {
        const named = (targetIdx >= 0 && enemies[targetIdx] && !enemies[targetIdx].defeated && (Number(enemies[targetIdx].hp) || 0) > 0) ? targetIdx : -1;
        const tIdx = named >= 0 ? named : enemies.findIndex(e => e && !e.defeated && (Number(e.hp) || 0) > 0);
        if (tIdx < 0) break;
        const tgt = enemies[tIdx];
        // DX-2c: per-swing effective AC folds in the foe's cover (+2/+5; 0 if none).
        // DX-2d-i: …plus its AC traits (Natural Armor / Shell / Magic Resistance).
        const tAc = applyACTraits(tgt, Number(tgt.ac) || 10) + coverAcBonus(tgt?.tactical?.cover);
        // DX-2b: extra-attack swings each get advantage from high ground or the
        // swing's own flanked target (swing 0 already carries it via `roll`).
        const swingAdv = Boolean(playerTactical.highGround) || Boolean(tgt?.tactical?.flanked);
        let r = swing === 0 ? roll : rollD20Adv(rng, swingAdv);
        if (swing > 0 && r === 1 && hasFeature(pc, 'rerollOnes')) r = rng.int(1, 20);
        const heldFast = hasCondition(tgt.conditions, 'paralyzed');
        const tot = r + melee.atkBonus + styleAtk + recklessAtk
          + (feats.blessActive ? rng.int(1, 4) : 0)
          + ((hasCondition(tgt.conditions, 'restrained') || hasCondition(tgt.conditions, 'prone') || heldFast) ? RESTRAINED_PENALTY : 0);
        if (swing === 0) { firstTot = tot; firstAc = tAc; }
        if (r === 1) {
          beats.push(`You swing your ${wname} at the ${tgt.name} and miss.`);
          continue;
        }
        // Champion fighters (3) crit on 19-20; a natural 19 still has to hit.
        const critOn = (d => d?.features?.some(f => f.effect?.type === 'improvedCritical') ? 19 : 20)(pc?.dnd);
        if (r === 20 || tot >= tAc) {
          // A melee hit on a paralyzed foe is automatically a critical (SRD).
          const crit = r >= critOn || (heldFast && !melee.ranged);
          let dmg = rng.int(1, melee.die) + melee.dmgMod + styleDmg + rageDmg;
          if (crit) dmg += rng.int(1, melee.die);
          // Half-Orc Savage Attacks: one extra weapon die on a melee crit.
          if (crit && !melee.ranged && hasFeature(pc, 'critExtraDie')) {
            dmg += rng.int(1, melee.die);
          }
          // Rogue Sneak Attack: 1d6 per two levels rounded up (doubled on
          // crit) with a finesse or ranged weapon when the foe hasn't pinned
          // you down — striking from cover, or in the opening exchange before
          // they've sized you up. Once per turn.
          let sneak = 0;
          if (swing === 0 && hasFeature(pc, 'sneakAttack') && (melee.finesse || melee.ranged) && (coverState || round === 1)) {
            const sneakDice = Math.ceil((pc?.dnd?.level || 1) / 2) * (crit ? 2 : 1);
            for (let i = 0; i < sneakDice; i++) sneak += rng.int(1, 6);
            dmg += sneak;
          }
          // Hunter ranger's Colossus Slayer (3): once per turn, +1d8 against
          // a foe already off its hit point maximum.
          let colossus = 0;
          if (swing === 0 && hasFeature(pc, 'colossusSlayer') && (Number(tgt.hp) || 0) < (Number(tgt.maxHp) || 0)) {
            colossus = rng.int(1, 8);
            dmg += colossus;
          }
          // Paladin Divine Smite: burn a slot on the hit for 2d8 radiant +1d8
          // per slot level above 1st (doubled dice on a crit, like everything
          // holy).
          let smite = 0;
          if (wantSmite && hasFeature(pc, 'divineSmite') && !melee.ranged && slotsLeft(pc) > 0) {
            const smiteLvl = lowestSlot(pc);
            w = applyDeltas(w, [{ op: 'consumeSpellSlot', entityId: pc.id || 'party', level: smiteLvl }]);
            const smiteDice = (2 + Math.max(0, smiteLvl - 1)) * (crit ? 2 : 1);
            for (let i = 0; i < smiteDice; i++) smite += rng.int(1, 8);
            dmg += smite;
          }
          dmg = Math.max(1, dmg);
          anyHit = true; swingHits++;
          const hit = applyEnemyDamage(tgt, dmg, melee.damageType || 'physical', w);
          swingDmg += hit.dmg;
          const tags = [
            crit ? 'critical!' : '',
            sneak ? `sneak attack +${sneak}` : '',
            colossus ? `colossus slayer +${colossus}` : '',
            smite ? `divine smite +${smite}` : '',
            rageDmg ? 'raging' : ''
          ].filter(Boolean).join(', ');
          beats.push(`Your ${wname} ${smite ? 'falls like judgment on' : 'hits'} the ${tgt.name} for ${hit.dmg}${tags ? ` (${tags})` : ''}${hit.dropped ? ' — it drops.' : `. (${hit.hp} HP left)`}`);
          if (hit.revived) beats.push(hit.reviveBeat);
        } else {
          beats.push(`You swing your ${wname} at the ${tgt.name} and miss.`);
        }
      }
      if (wantSmite && hasFeature(pc, 'divineSmite') && slotsLeft(pc) <= 0) {
        beats.push('(No slots left to fuel the smite — the blow was steel alone.)');
      } else if (wantSmite && !hasFeature(pc, 'divineSmite')) {
        beats.push('(You call on powers that have made you no promises. Steel alone answers.)');
      }
      if (firstTot != null) {
        actionMech = swings > 1
          ? `[strike:${melee.name} | ${swings} swings, ${swingHits} hit | ${swingDmg} dmg]`
          : `[strike:${melee.name} | atk:${firstTot} vs AC:${firstAc} → ${anyHit ? 'hit' : 'miss'}${anyHit ? ` | ${swingDmg} dmg` : ''}]`;
      }
    }
  }

  // A melee strike means stepping out — it breaks cover. Ranged attacks
  // (cantrips, bows) loose from behind it, so cover holds. A cantrip-less
  // martial whose "cast" resolved as a weapon attack follows the weapon:
  // melee breaks cover, a bow does not.
  const attackedInMelee = coverState && targetIdx >= 0
    && (['strike', 'surge', 'reckless', 'smite', 'unarmed'].includes(verb) || (verb === 'firebolt' && !cantripProfile(pc)))
    && !meleeProfile(pc).ranged;
  if (attackedInMelee) {
    beats.push('You break from cover to strike.');
    coverState = null;
  }

  // Teach the tactic once: if the room offers cover and you haven't used it,
  // nudge on the opening round so the surroundings register as a real option.
  if (round === 1 && roomCover && !coverState && verb !== 'cover') {
    beats.push(`(A ${roomCover.label} here offers cover — type "take cover" for +${roomCover.bonus} AC.)`);
  }

  // Commit enemy HP changes through the canonical combat-state delta, and
  // persist feature state (rage flags, healing pools) alongside.
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { enemies, round, turnIndex: 0 }
  }]);
  w = { ...w, meta: { ...w.meta, escapeFeats: { ...feats } } };

  // P-75: a boss crossing its phase threshold this turn announces it — the
  // authored beat from the catalog, or the default bloodied line. Fires once
  // per crossing (detection compares turn-start hp), never for non-bosses.
  for (const crossing of detectPhaseCrossings(bossHpAtStart, enemies)) {
    beats.push(`${crossing.narration}.`);
  }

  // ── Victory check ──────────────────────────────────────────────────────────
  const anyAlive = enemies.some(e => e && !e.defeated && (Number(e.hp) || 0) > 0);
  if (!anyAlive) {
    // Roll CR-scaled loot for the cleared foes BEFORE endCombat clears the enemy
    // list. Tamed ambushers carry no lootTableRef, so this falls back to the CR
    // band table (cr_0_4) — modest drops fitting their tamed difficulty. Mirrors
    // the loot path in combatResolve.js so the existing loot popup just works.
    // Deterministic: the rng is seeded from world seed + timeline length + round,
    // so a replay yields identical drops (worldHash stays stable).
    const lootRng = makeRng(seedFromString(`${w.meta?.seed || ''}|escapeLoot|${w.timeline.length}|r${round}`));
    const lootResults = [];
    const lootDeltas = [];
    let lootCounter = 0;
    for (const e of enemies) {
      const drops = rollLootForCR(e.cr ?? 0, lootRng, e.lootTableRef || null);
      for (const drop of drops) {
        if (!drop) continue;
        if (drop.kind === 'currency' && drop.currency && drop.amount) {
          const amt = Math.max(0, rollDice(drop.amount, lootRng).total);
          if (amt > 0) {
            lootDeltas.push({ op: 'addCurrency', entityId: 'party', currency: drop.currency, amount: amt });
            lootResults.push({ kind: 'currency', currency: drop.currency, amount: amt, source: e.name });
          }
        } else if (drop.kind === 'item' && drop.defRef) {
          const itemId = `loot_${lootCounter++}_${String(e.id || e.name || 'foe')}`;
          // P-77 — magic gear lands SEALED: the pack holds something humming,
          // not a name the table hasn't earned. Identification opens it.
          const sealed = sealLoot({ id: itemId, defRef: drop.defRef, equipped: null }, getItemDef(drop.defRef));
          lootDeltas.push({ op: 'addItem', entityId: 'party', item: sealed });
          lootResults.push({ kind: 'item', defRef: sealed.defRef, rarity: drop.rarity || 'common', source: e.name });
        }
      }
    }
    if (lootDeltas.length > 0) w = applyDeltas(w, lootDeltas);

    // XP for the cleared encounter, level-ups at the moment of triumph.
    w = awardXpAndLevel(w, enemies, beats);

    w = endCombat(w, { reason: 'enemies-defeated' });

    // Emit a combat-end event carrying the loot list so the UI loot popup fires.
    // The UI scans the timeline for a combat-end with a `loot` field, so only
    // push when something actually dropped (no empty popup on a dry fight).
    if (lootResults.length > 0) {
      const tl = Array.isArray(w.timeline) ? w.timeline : [];
      w = { ...w, timeline: [...tl, { t: tl.length, kind: 'combat-end', data: { reason: 'combat-victory', loot: lootResults } }] };
    }

    beats.push(lootResults.length ? 'The way is clear. You search the fallen and pocket what they carried.' : 'The way is clear.');
    return {
      world: w,
      result: {
        beats,
        combatSummary: beats.join(' '),
        mechanicsLine: actionMech ? `${actionMech} [combat:victory]` : '[combat:victory]',
        outcome: 'success'
      }
    };
  }

  // ── Morale (P4): a badly wounded foe may break and run. ────────────────────
  // At ≤25% HP a foe checks morale at the start of its turn (d20 vs 10,
  // seeded). On a break it flees: you get its XP (driving a foe off IS
  // overcoming it), no loot (it kept its pockets), and the DM marks the
  // last-known position against a real cover feature — it may still be close.
  // Things with legendary actions don't run. Fled foes leave the enemy list.
  {
    const fled = [];
    for (const e of enemies) {
      if (!e || e.defeated || (Number(e.hp) || 0) <= 0) continue;
      // A foe in your grip can't run — it has to break free first.
      if (hasCondition(e.conditions, 'grappled')) continue;
      // A player-declared tackle/grab/pin is the table's current action. Do
      // not replace that declared control beat with same-turn morale flight.
      if (grappleIntent && (verb === 'grapple' || verb === 'throw' || verb === 'choke')) continue;
      // P-75: things with legendary actions don't run — match the NORMALIZED
      // shape ({perRound, options}, see ensureCombat), not just raw arrays.
      const eLeg = e.legendaryActions;
      if (eLeg && (Array.isArray(eLeg) ? eLeg.length > 0 : (Number(eLeg.perRound) || 0) > 0)) continue;
      const eMaxHp = Math.max(1, Number(e.maxHp) || 1);
      if ((Number(e.hp) || 0) / eMaxHp > 0.25) continue;
      if (rng.int(1, 20) >= 10) continue; // holds its nerve this round
      fled.push(e);
    }
    if (fled.length) {
      const where = roomCover ? `behind the ${roomCover.label}` : 'into the open country';
      for (const e of fled) {
        const xp = xpForEnemies([e]);
        w = applyDeltas(w, [
          { op: 'gainXp', amount: xp },
          { op: 'ledger', addThreat: `the ${e.name} fled — last seen ${where}; it may still be close`, level: 1 }
        ]);
        beats.push(`The ${e.name} has had enough — it breaks and runs. Last you saw, it ducked ${where}. It may still be close. (+${xp} XP — driven off counts.)`);
      }
      const fledIds = new Set(fled.map(e => e.id));
      enemies = enemies.filter(e => e && !fledIds.has(e.id));
      // If that was everyone, the fight is over — end combat WITHOUT writing
      // an empty enemy list into an active fight (invariant: active combat
      // must hold at least one foe). No loot from the fled.
      if (!enemies.some(e => e && !e.defeated && (Number(e.hp) || 0) > 0)) {
        w = { ...w, meta: { ...w.meta, escapeFeats: { ...feats } } };
        w = endCombat(w, { reason: 'enemies-fled' });
        beats.push('The road is yours again — though something out there remembers you.');
        return {
          world: w,
          result: { beats, combatSummary: beats.join(' '), mechanicsLine: '[combat:fled]', outcome: 'success' }
        };
      }
      w = applyDeltas(w, [{ op: 'combatState', set: { enemies, round, turnIndex: 0 } }]);
    }
  }

  // ── Enemy turns: each living enemy strikes the player ──────────────────────
  let hp = Number(w.meta.escapeHp) || 0;
  const coverBonus = coverState ? (Number(coverState.bonus) || 0) : 0;
  const ac = playerAc(pc) + (warded ? wardBonus : 0) + coverBonus;
  const enemyMech = [];
  // DX-2d-i: a world view whose combat.enemies is THIS turn's live (post-action,
  // post-morale) enemy array, so Pack/Flock Tactics counts only the foes still
  // standing. The local `enemies` array is mutated in place through the loop, so
  // the view tracks it without a rebuild. Pure read — no rng, no state write.
  const eWorld = { ...w, combat: { ...(w.combat || {}), enemies } };

  // ── P-75: boss beats between turns ──────────────────────────────────────────
  // The boss answers your turn (legendary action: one option per round, the
  // priciest its budget affords) and its seat fights beside it (lair action:
  // one per round, only at the lair). Payloads resolve through the same
  // machinery as the party-combat path. Save effects ignore AC and ward —
  // you dodge them with your body, not your guard. Non-boss fights take no
  // extra rng draws, so their streams stay byte-identical.
  const bossPayloadVsYou = (payload) => {
    if (payload.save && typeof payload.save.dc === 'number') {
      const stat = String(payload.save.stat || 'GRIT');
      const save = rng.int(1, 20) + statMod(pc?.stats?.[stat] ?? 10);
      const rolled = Math.max(1, rollDice(String(payload.damage || '1d6'), rng).total);
      if (save >= payload.save.dc) {
        const half = payload.save.halfOnSave ? Math.max(1, Math.floor(rolled / 2)) : 0;
        return {
          dmg: half,
          text: half > 0 ? `you twist aside (${stat} save ${save} vs DC ${payload.save.dc}) — half, ${half} ${payload.type || 'force'}` : `you shake it off (${stat} save ${save} vs DC ${payload.save.dc})`,
          mech: `${stat} save:${save} vs DC:${payload.save.dc}`
        };
      }
      return { dmg: rolled, text: `${stat} save ${save} vs DC ${payload.save.dc} fails — ${rolled} ${payload.type || 'force'}`, mech: `${stat} save:${save} vs DC:${payload.save.dc}` };
    }
    const raw = rng.int(1, 20);
    const atk = raw + (Number(payload.toHit) || 0);
    if (atk < ac) return { dmg: 0, text: 'it misses', mech: `atk:${atk} vs AC:${ac}` };
    const rolled = Math.max(1, rollDice(String(payload.damage || '1d6'), rng).total);
    return { dmg: rolled, text: `hits you for ${rolled} ${payload.type || 'bludgeoning'}`, mech: `atk:${atk} vs AC:${ac}` };
  };

  for (const e of enemies) {
    if (hp <= 0) break;
    if (!e || e.defeated || (Number(e.hp) || 0) <= 0) continue;
    if (hasCondition(e.conditions, 'charmed') || hasCondition(e.conditions, 'paralyzed')) continue;
    const la = e.legendaryActions;
    const budget = (la && !Array.isArray(la)) ? (Number(la.perRound) || 0) : 0;
    const options = budget > 0 && Array.isArray(la.options)
      ? la.options.filter(o => o && Math.max(1, Number(o.cost) || 1) <= budget)
      : [];
    if (!options.length) continue;
    const chosen = [...options].sort((a, b) => (Number(b.cost) || 1) - (Number(a.cost) || 1))[0];
    const r = bossPayloadVsYou(resolveBossActionPayload(e, chosen));
    if (r.dmg > 0) {
      const beforeHp = hp;
      hp = Math.max(0, hp - r.dmg);
      enemyMech.push(`[enemy:${e.name} legendary:${chosen.name} | ${r.mech} → hit | ${r.dmg} dmg | pcHp:${beforeHp}->${hp}]`);
    }
    beats.push(`The ${e.name} steals a beat that isn't its turn — ${chosen.name} (legendary): ${r.text}.`);
    if (hp <= 0 && hasFeature(pc, 'relentlessEndurance') && !feats.relentlessUsed) {
      feats.relentlessUsed = true; hp = 1;
      beats.push('You should fall — you do not. Sheer spite keeps you up. (1 HP)');
    }
  }

  {
    const hereNode = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
    const atSeat = /dungeon|lair/i.test(String(hereNode?.nodeType || ''))
      || (Array.isArray(hereNode?.tags) && hereNode.tags.some(t => /lair/i.test(String(t))))
      || /\blair\b/i.test(String(w.scene?.location || ''));
    if (atSeat && hp > 0) {
      for (const e of enemies) {
        if (!e || e.defeated || (Number(e.hp) || 0) <= 0) continue;
        if (!Array.isArray(e.lairActions) || !e.lairActions.length) continue;
        const lairEntry = e.lairActions[(round - 1) % e.lairActions.length];
        if (!lairEntry) continue;
        const r = bossPayloadVsYou(resolveLairActionPayload(e, lairEntry));
        if (r.dmg > 0) {
          const beforeHp = hp;
          hp = Math.max(0, hp - r.dmg);
          enemyMech.push(`[enemy:${e.name} lair:${lairEntry.name} | ${r.mech} → hit | ${r.dmg} dmg | pcHp:${beforeHp}->${hp}]`);
        }
        beats.push(`The lair itself answers its master — ${lairEntry.name}: ${r.text}.`);
        if (hp <= 0 && hasFeature(pc, 'relentlessEndurance') && !feats.relentlessUsed) {
          feats.relentlessUsed = true; hp = 1;
          beats.push('You should fall — you do not. Sheer spite keeps you up. (1 HP)');
        }
        break; // one lair action per round
      }
    }
  }

  // DX-2c: outnumbered = flanked. Count the foes that can actually press you —
  // conscious, not charmed, not paralyzed. Two or more closing on you splits your
  // guard, so every one of them strikes with advantage. Recomputed each turn from
  // the post-player-action enemy state, so thinning the pack down to one LIFTS the
  // flank — being surrounded is dangerous, but it is contestable by killing.
  const pressingFoes = enemies.filter(e => e && !e.defeated && (Number(e.hp) || 0) > 0
    && !hasCondition(e.conditions, 'charmed') && !hasCondition(e.conditions, 'paralyzed')).length;
  playerTactical.flanked = pressingFoes >= 2;

  for (const e of enemies) {
    if (hp <= 0) break;
    if (!e || e.defeated || (Number(e.hp) || 0) <= 0) continue;

    // DX-2d-i: start-of-turn regeneration (Regeneration / Dire / Fungal / Regrowing
    // Heads). Heals the LIVING foe only — a dropped foe is already past the guard
    // above; the hook clamps to maxHp. No rng draw, so a trait-less foe is
    // untouched. Fires even when charmed/held (regen is start-of-turn, not an
    // action). Narrated as fiction — no number, no label (THE LAW).
    const regen = applyTurnStartTraits(e, eWorld);
    if (regen.hpDelta > 0) {
      e.hp = Math.max(0, (Number(e.hp) || 0) + regen.hpDelta);
      beats.push(`The ${e.name}'s wounds close before your eyes — torn flesh crawling shut.`);
    }

    // Charmed: it will not raise a hand against you. The charm fades on a
    // countdown — when it breaks, the foe knows exactly what you did.
    if (hasCondition(e.conditions, 'charmed')) {
      const next = [];
      let broke = false;
      for (const c of (e.conditions || [])) {
        if (c.name !== 'charmed') { next.push(c); continue; }
        const left = (typeof c.until === 'number') ? c.until - 1 : 0;
        if (left > 0) next.push({ ...c, until: left });
        else broke = true;
      }
      e.conditions = next;
      beats.push(broke
        ? `The ${e.name}'s gaze hardens — the charm breaks, and it remembers.`
        : `The ${e.name} stands easy, sword loose — your charm holds.`);
      continue;
    }

    // Paralyzed (hold person): locked rigid — no action, and every melee blow
    // against it lands as a critical while it holds. Countdown like the charm.
    if (hasCondition(e.conditions, 'paralyzed')) {
      const next = [];
      let broke = false;
      for (const c of (e.conditions || [])) {
        if (c.name !== 'paralyzed') { next.push(c); continue; }
        const left = (typeof c.until === 'number') ? c.until - 1 : 0;
        if (left > 0) next.push({ ...c, until: left });
        else broke = true;
      }
      e.conditions = next;
      beats.push(broke
        ? `Feeling floods back into the ${e.name} — the hold breaks.`
        : `The ${e.name} stands rigid as a post, held fast.`);
      continue;
    }

    // Grappled: it spends its turn trying to break your grip (and any choke
    // goes with it). On a break it doesn't also attack; otherwise it fights from
    // a bad position (the restrained penalty). It never flees (guarded above).
    if (hasCondition(e.conditions, 'grappled') && verb !== 'choke') {
      const esc = enemyGrappleEscape(e, ENEMY_SAVE_BONUS, rng);
      if (esc.broke) { for (const b of esc.beats) beats.push(b); continue; }
    }
    // Restrained: it fights tangled, and spends its strength tearing free.
    // A grappled foe (that didn't break free above) fights from the same bad
    // position — same attack penalty, but NOT the entangle save below.
    const restrained = hasCondition(e.conditions, 'restrained');
    const grappledNow = hasCondition(e.conditions, 'grappled');
    // DX-2c: the enemy strikes with advantage from its own high ground OR when the
    // player is flanked (outnumbered). Not while it is tangled (restrained/grappled)
    // — it can't leverage position from a bad spot. rollD20Adv draws the 2nd die
    // ONLY when advantage is live, so a fight with no enemy terrain and one foe
    // keeps the identical rng stream it had before DX-2c.
    const enemyAdv = !(restrained || grappledNow)
      && (Boolean(e.tactical?.highGround) || Boolean(playerTactical.flanked));
    const roll = rollD20Adv(rng, enemyAdv);
    const baseToHit = roll + ENEMY_ATK_BONUS - ((restrained || grappledNow) ? RESTRAINED_PENALTY : 0) + (recklessThisRound ? 4 : 0);
    // DX-2d-i: fold the foe's to-hit traits — Pack/Flock Tactics (+2 while an ally
    // still stands, read from eWorld's live enemy list), Reckless/Aggressive.
    // Arithmetic on the already-rolled d20: no extra draw, and a trait-less foe's
    // `total` is identical to before.
    const total = applyToHitTraits(e, baseToHit, eWorld);
    if (restrained) {
      const cond = (e.conditions || []).find(c => c.name === 'restrained');
      const dc = cond?.saveToEnd?.dc || 13;
      const save = rng.int(1, 20) + ENEMY_SAVE_BONUS;
      if (save >= dc) {
        e.conditions = removeAllConditions(e.conditions || [], 'restrained');
        beats.push(`The ${e.name} rips free of the weeds.`);
      }
    }
    if (roll === 1) {
      beats.push(`The ${e.name} lunges and misses.`);
      continue;
    }
    if (roll === 20 || total >= ac) {
      // P-75: a bloodied boss fights wilder — its die runs two heavier.
      const fury = bossPhase(e) === 2;
      const die = Math.max(2, Number(e.damage) || 4) + (fury ? 2 : 0);
      const crit = roll === 20;
      let dmg = rng.int(1, die);
      if (crit) dmg += rng.int(1, die);
      dmg = Math.max(1, dmg);
      // DX-2d-i: the foe's damage-dealt traits (Brute, Sneak Attack, Precision
      // Strike…) ride the rolled damage, before the player's own defenses. No rng
      // draw — a trait-less foe is unchanged.
      dmg = applyDamageDealtTraits(e, dmg);
      // Rage: resistance to weapon damage — the blow lands at half force.
      if (feats.rageActive) dmg = Math.max(1, Math.floor(dmg / 2));
      // Armor of Agathys: while the black ice holds, it soaks the hit first
      // and bites back at whoever struck it.
      if (feats.tempHp > 0) {
        // DX-2d-i: the ice's cold retaliation runs the trait pipeline too —
        // Evasion/Uncanny Dodge halve it, an aura soaks a point, Undead Fortitude
        // can refuse to fall. applyEnemyDamage mutates e.hp/e.defeated in place.
        const iceHit = feats.agathysActive ? applyEnemyDamage(e, 5, 'cold', eWorld) : null;
        const soaked = Math.min(feats.tempHp, dmg);
        feats.tempHp -= soaked;
        dmg -= soaked;
        if (feats.tempHp <= 0) feats.agathysActive = false;
        if (soaked > 0) {
          beats.push(`The ${e.name} cracks into the black ice — ${soaked} swallowed by the armor${iceHit ? `, and the ice bites back for ${iceHit.dmg} cold${iceHit.dropped ? ' — it drops' : ''}` : ''}.`);
        }
        if (iceHit && iceHit.revived) beats.push(iceHit.reviveBeat);
        if (dmg <= 0) continue;
      }
      const beforeHp = hp;
      hp = Math.max(0, hp - dmg);
      enemyMech.push(`[enemy:${e.name} | atk:${total} vs AC:${ac} → hit | ${dmg} dmg${crit ? ' crit' : ''} | pcHp:${beforeHp}->${hp}]`);
      // Half-Orc Relentless Endurance: the blow that would drop you leaves you
      // standing at 1 HP instead. Once per rest.
      if (hp <= 0 && hasFeature(pc, 'relentlessEndurance') && !feats.relentlessUsed) {
        feats.relentlessUsed = true;
        hp = 1;
        beats.push(`The ${e.name} hits you for ${dmg}${feats.rageActive ? ' (halved by your rage)' : ''}${crit ? ' (critical!)' : ''} — you should fall, but you do not. You stay up on sheer spite. (1 HP)`);
        continue;
      }
      beats.push(`The ${e.name} hits you for ${dmg}${feats.rageActive ? ' (halved by your rage)' : ''}${crit ? ' (critical!)' : ''}${fury && !crit ? ' (bloodied fury)' : ''}.`);
      if (hp <= 0) break;
    } else {
      beats.push(`The ${e.name} ${warded ? 'rakes the ward and finds no purchase' : 'lunges and misses'}.`);
    }
  }

  // Commit player HP + feature state (relentless may have fired).
  w = { ...w, meta: { ...w.meta, escapeHp: hp, escapeFeats: { ...feats } } };

  // ── Defeat check ───────────────────────────────────────────────────────────
  if (hp <= 0) {
    if (enemies.some(e => e && !e.defeated && (Number(e.hp) || 0) > 0)) {
      w = applyDeltas(w, [{ op: 'combatState', set: { enemies, round: round + 1, turnIndex: 0, playerCell } }]);
      beats.push('You fall — the foe still stands. You are down and dying.');
      return {
        world: w,
        result: {
          beats,
          combatSummary: beats.join(' '),
          mechanicsLine: `${actionMech || `[combat:r${round}]`}${enemyMech.length ? ` ${enemyMech.join(' ')}` : ''} [combat:dying]`,
          outcome: 'failure'
        }
      };
    }
    w = endCombat(w, { reason: 'defeated-in-combat' });
    w = {
      ...w,
      ending: {
        ...(w.ending || {}),
        locked: true,
        reason: 'defeated-in-combat',
        epilogueLine: 'Your strength fails. The dark keeps you.'
      }
    };
    beats.push('You fall.');
    return {
      world: w,
      result: {
        beats,
        combatSummary: beats.join(' '),
        mechanicsLine: `${actionMech || `[combat:r${round}]`}${enemyMech.length ? ` ${enemyMech.join(' ')}` : ''} [combat:defeat]`,
        outcome: 'failure'
      }
    };
  }

  // ── Contest: the high ground is not permanent ───────────────────────────────
  // DX-2c: a single foe can't take the rise from you, but a pack closing from
  // every side does. When you're flanked (outnumbered) and didn't re-claim the
  // height THIS turn, the swarm overruns it and the high ground is lost. A lone
  // foe never breaks it — so a 1v1 high ground still holds within the fight
  // (DX-2b). You keep this turn's payoff: any strike already rolled with the edge.
  if (playerTactical.highGround && playerTactical.flanked && verb !== 'highground') {
    playerTactical.highGround = false;
    beats.push('They swarm up from every side — the high ground is gone.');
  }

  // ── Advance round ──────────────────────────────────────────────────────────
  // DX-2b/2c: persist the player's tactical position (high-ground/flank/cover-mirror)
  // and the enemies array (which carries any sourced/contested enemy tactical) so
  // position holds across rounds within the fight; beginCombat clears it for the
  // next fight.
  w = applyDeltas(w, [{ op: 'combatState', set: { enemies, round: round + 1, turnIndex: 0, playerTactical, playerCell } }]);
  w = { ...w, meta: { ...w.meta, escapeCover: coverState
    ? { active: true, bonus: coverState.bonus, label: coverState.label, tier: coverState.tier, beganAt }
    : { active: false, bonus: 0, label: '', tier: '', beganAt } } };
  beats.push(coverState ? `(You: ${hp} HP, behind ${coverState.label})` : `(You: ${hp} HP)`);
  return {
    world: w,
    result: {
      beats,
      combatSummary: beats.join(' '),
      mechanicsLine: `${actionMech || `[combat:r${Number(w.combat?.round) || round + 1}]`}${enemyMech.length ? ` ${enemyMech.join(' ')}` : ''}`,
      outcome: 'mixed'
    }
  };
}
