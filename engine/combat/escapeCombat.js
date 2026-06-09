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
      return { name: best.name, die: best.die, atkBonus: d.profBonus + best.mod, dmgMod: best.mod, ranged: Boolean(best.ranged) };
    }
    // Sheet but no table weapon (monk fists, darts): unarmed/simple strike.
    const mod = Math.max(d.mods.STR, d.mods.DEX);
    return { name: 'Unarmed Strike', die: 4, atkBonus: d.profBonus + mod, dmgMod: mod, ranged: false };
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
  const sheetAC = Number(pc?.dnd?.ac);
  if (Number.isInteger(sheetAC) && sheetAC > 0) return sheetAC;
  const agi = pc?.stats?.AGILITY ?? 10;
  return PLAYER_BASE_AC + statMod(agi);
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
  // 5e character: build the panel from the sheet's real weapon + class cantrip.
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

/**
 * parseEscapeAction(text) -> { verb: 'strike'|'firebolt'|'ward'|'cover' }
 * Map a typed line to one of the hedge-caster's light verbs. Unrecognized
 * combat input defaults to a blade strike so the round always advances.
 */
export function parseEscapeAction(text) {
  const t = String(text || '').trim().toLowerCase();
  // Cover is a positional move — duck behind the room's furniture for +AC. Check
  // it before the attack verbs so "hide behind the pillar" reads as cover.
  if (/\b(take\s+cover|cover|behind|duck|hunker)\b/.test(t)) return { verb: 'cover' };
  if (/\b(ward|shield|brace|defend|guard|block|parry)\b/.test(t)) return { verb: 'ward' };
  // Cantrip verbs — the hedge-caster's fire bolt plus every class cantrip
  // (eldritch blast, vicious mockery, sacred flame, produce flame) and the
  // generic "cast" so a player can just say "cast at it".
  if (/\b(fire\s*bolt|firebolt|bolt|burn|flame|scorch|ignite|blast|mock|cast|cantrip)\b/.test(t)) return { verb: 'firebolt' };
  if (/\b(fire)\b/.test(t)) return { verb: 'firebolt' };
  // strike verbs (and the default)
  return { verb: 'strike' };
}

function fmtBonus(n) {
  const x = Math.trunc(Number(n)) || 0;
  return (x >= 0 ? '+' : '') + String(x);
}

/**
 * shortRest(world, rng) -> world
 * Recover hit points on a clear (no-ambush) hop. Caps at escapeMaxHp.
 */
export function shortRest(world, rng) {
  const w = ensureWorld(world);
  if (w.meta?.mode !== 'escape') return w;
  const max = Number(w.meta.escapeMaxHp) || 0;
  const cur = Number(w.meta.escapeHp) || 0;
  if (max <= 0 || cur >= max) return w;
  const heal = rng.int(1, REST_DIE) + REST_FLAT;
  const next = Math.min(max, cur + heal);
  return { ...w, meta: { ...w.meta, escapeHp: next } };
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
export function resolveEscapeCombatTurn(world, actionText = '') {
  let w = ensureWorld(world);
  if (!w.combat?.active) {
    return { world: w, result: { beats: [], combatSummary: '', mechanicsLine: '', outcome: 'mixed' } };
  }

  const pc = w.party?.[0] || {};
  const round = Number(w.combat.round) || 1;
  const rng = makeRng(seedFromString(`${w.meta?.seed || ''}|escapeCombat|${w.timeline.length}|r${round}`));
  const beats = [];
  const { verb } = parseEscapeAction(actionText);
  let warded = false;

  // ── Cover state ─────────────────────────────────────────────────────────────
  // Cover persists across rounds within one fight, scoped to combat.beganAt so a
  // fresh fight always starts in the open. The combatState delta whitelists its
  // fields, so cover rides in meta alongside escapeHp instead of on combat.
  const beganAt = Number(w.combat.beganAt) || 0;
  const roomCover = currentRoomCover(w);
  const savedCover = w.meta?.escapeCover;
  let coverState = (savedCover && savedCover.active && savedCover.beganAt === beganAt)
    ? { ...savedCover } : null;

  // ── Player turn ────────────────────────────────────────────────────────────
  let enemies = (Array.isArray(w.combat.enemies) ? w.combat.enemies : []).map(e => ({ ...e }));
  const targetIdx = enemies.findIndex(e => e && !e.defeated && (Number(e.hp) || 0) > 0);

  if (verb === 'cover') {
    if (roomCover) {
      coverState = { active: true, bonus: Number(roomCover.bonus) || 0, label: roomCover.label, tier: roomCover.tier, beganAt };
      beats.push(`You slip behind the ${roomCover.label} — ${roomCover.tier} cover (+${coverState.bonus} AC).`);
    } else {
      beats.push('There is nothing here to take cover behind.');
    }
  } else if (verb === 'ward') {
    warded = true;
    beats.push(isCaster(pc)
      ? `You raise a ward — a shimmer of force hardens the air around you (+${WARD_AC_BONUS} AC).`
      : `You set your feet and raise your guard (+${WARD_AC_BONUS} AC).`);
  } else if (targetIdx >= 0) {
    const target = enemies[targetIdx];
    const ac = Number(target.ac) || 10;
    const roll = rng.int(1, 20);
    const cantrip = verb === 'firebolt' ? cantripProfile(pc) : null;

    if (cantrip) {
      const total = roll + cantrip.atkBonus;
      const cname = cantrip.name.toLowerCase();
      if (roll === 1) {
        beats.push(`Your ${cname} sputters wide of the ${target.name}.`);
      } else if (roll === 20 || total >= ac) {
        const crit = roll === 20;
        let dmg = rng.int(1, cantrip.die);
        if (crit) dmg += rng.int(1, cantrip.die);
        dmg = Math.max(1, dmg);
        const newHp = Math.max(0, (Number(target.hp) || 0) - dmg);
        target.hp = newHp;
        if (newHp <= 0) target.defeated = true;
        beats.push(`Your ${cname} sears the ${target.name} for ${dmg} ${cantrip.type}${crit ? ' (critical!)' : ''}${newHp <= 0 ? ' — it drops.' : `. (${newHp} HP left)`}`);
      } else {
        beats.push(`Your ${cname} sputters wide of the ${target.name}.`);
      }
    } else {
      // weapon strike (default — also where a cantrip-less martial's "cast" lands)
      const melee = meleeProfile(pc);
      const total = roll + melee.atkBonus;
      const wname = melee.name.toLowerCase();
      if (roll === 1) {
        beats.push(`You swing your ${wname} at the ${target.name} and miss.`);
      } else if (roll === 20 || total >= ac) {
        const crit = roll === 20;
        let dmg = rng.int(1, melee.die) + melee.dmgMod;
        if (crit) dmg += rng.int(1, melee.die);
        dmg = Math.max(1, dmg);
        const newHp = Math.max(0, (Number(target.hp) || 0) - dmg);
        target.hp = newHp;
        if (newHp <= 0) target.defeated = true;
        beats.push(`Your ${wname} hits the ${target.name} for ${dmg}${crit ? ' (critical!)' : ''}${newHp <= 0 ? ' — it drops.' : `. (${newHp} HP left)`}`);
      } else {
        beats.push(`You swing your ${wname} at the ${target.name} and miss.`);
      }
    }
  }

  // A melee strike means stepping out — it breaks cover. Ranged attacks
  // (cantrips, bows) loose from behind it, so cover holds. A cantrip-less
  // martial whose "cast" resolved as a weapon attack follows the weapon:
  // melee breaks cover, a bow does not.
  const attackedInMelee = coverState && targetIdx >= 0
    && (verb === 'strike' || (verb === 'firebolt' && !cantripProfile(pc)))
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

  // Commit enemy HP changes through the canonical combat-state delta.
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { enemies, round, turnIndex: 0 }
  }]);

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
          lootDeltas.push({ op: 'addItem', entityId: 'party', item: { id: itemId, defRef: drop.defRef, equipped: null } });
          lootResults.push({ kind: 'item', defRef: drop.defRef, rarity: drop.rarity || 'common', source: e.name });
        }
      }
    }
    if (lootDeltas.length > 0) w = applyDeltas(w, lootDeltas);

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
        mechanicsLine: '[combat:victory]',
        outcome: 'success'
      }
    };
  }

  // ── Enemy turns: each living enemy strikes the player ──────────────────────
  let hp = Number(w.meta.escapeHp) || 0;
  const coverBonus = coverState ? (Number(coverState.bonus) || 0) : 0;
  const ac = playerAc(pc) + (warded ? WARD_AC_BONUS : 0) + coverBonus;
  for (const e of enemies) {
    if (!e || e.defeated || (Number(e.hp) || 0) <= 0) continue;
    const roll = rng.int(1, 20);
    const total = roll + ENEMY_ATK_BONUS;
    if (roll === 1) {
      beats.push(`The ${e.name} lunges and misses.`);
      continue;
    }
    if (roll === 20 || total >= ac) {
      const die = Math.max(2, Number(e.damage) || 4);
      const crit = roll === 20;
      let dmg = rng.int(1, die);
      if (crit) dmg += rng.int(1, die);
      dmg = Math.max(1, dmg);
      hp = Math.max(0, hp - dmg);
      beats.push(`The ${e.name} hits you for ${dmg}${crit ? ' (critical!)' : ''}.`);
      if (hp <= 0) break;
    } else {
      beats.push(`The ${e.name} ${warded ? 'rakes the ward and finds no purchase' : 'lunges and misses'}.`);
    }
  }

  // Commit player HP.
  w = { ...w, meta: { ...w.meta, escapeHp: hp } };

  // ── Defeat check ───────────────────────────────────────────────────────────
  if (hp <= 0) {
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
        mechanicsLine: '[combat:defeat]',
        outcome: 'failure'
      }
    };
  }

  // ── Advance round ──────────────────────────────────────────────────────────
  w = applyDeltas(w, [{ op: 'combatState', set: { round: round + 1, turnIndex: 0 } }]);
  w = { ...w, meta: { ...w.meta, escapeCover: coverState
    ? { active: true, bonus: coverState.bonus, label: coverState.label, tier: coverState.tier, beganAt }
    : { active: false, bonus: 0, label: '', tier: '', beganAt } } };
  beats.push(coverState ? `(You: ${hp} HP, behind ${coverState.label})` : `(You: ${hp} HP)`);
  return {
    world: w,
    result: {
      beats,
      combatSummary: beats.join(' '),
      mechanicsLine: `[combat:r${round}]`,
      outcome: 'mixed'
    }
  };
}
