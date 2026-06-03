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

/**
 * playerMaxHp(pc) -> number
 * Classic hit points for the escape PC, scaled gently by GRIT.
 */
export function playerMaxHp(pc) {
  const grit = pc?.stats?.GRIT ?? 10;
  return Math.max(1, PLAYER_BASE_HP + statMod(grit));
}

function playerAc(pc) {
  const agi = pc?.stats?.AGILITY ?? 10;
  return PLAYER_BASE_AC + statMod(agi);
}

function bladeAtkBonus(pc) {
  const might = pc?.stats?.MIGHT ?? 10;
  return BLADE_ATK_BONUS + statMod(might);
}

function bladeDmgMod(pc) {
  const might = pc?.stats?.MIGHT ?? 10;
  return statMod(might);
}

function fireboltAtkBonus(pc) {
  const wits = pc?.stats?.WITS ?? 10;
  return FIREBOLT_ATK_BONUS + statMod(wits);
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
 * parseEscapeAction(text) -> { verb: 'strike'|'firebolt'|'ward' }
 * Map a typed line to one of the hedge-caster's light verbs. Unrecognized
 * combat input defaults to a blade strike so the round always advances.
 */
export function parseEscapeAction(text) {
  const t = String(text || '').trim().toLowerCase();
  if (/\b(ward|shield|brace|defend|guard|block|parry)\b/.test(t)) return { verb: 'ward' };
  if (/\b(fire\s*bolt|firebolt|bolt|burn|flame|scorch|ignite)\b/.test(t)) return { verb: 'firebolt' };
  if (/\b(fire)\b/.test(t)) return { verb: 'firebolt' };
  // strike verbs (and the default)
  return { verb: 'strike' };
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

  // ── Player turn ────────────────────────────────────────────────────────────
  let enemies = (Array.isArray(w.combat.enemies) ? w.combat.enemies : []).map(e => ({ ...e }));
  const targetIdx = enemies.findIndex(e => e && !e.defeated && (Number(e.hp) || 0) > 0);

  if (verb === 'ward') {
    warded = true;
    beats.push(`You raise a ward — a shimmer of force hardens the air around you (+${WARD_AC_BONUS} AC).`);
  } else if (targetIdx >= 0) {
    const target = enemies[targetIdx];
    const ac = Number(target.ac) || 10;
    const roll = rng.int(1, 20);

    if (verb === 'firebolt') {
      const total = roll + fireboltAtkBonus(pc);
      if (roll === 1) {
        beats.push(`Your fire bolt sputters wide of the ${target.name}.`);
      } else if (roll === 20 || total >= ac) {
        const crit = roll === 20;
        let dmg = rng.int(1, FIREBOLT_DMG_DIE);
        if (crit) dmg += rng.int(1, FIREBOLT_DMG_DIE);
        dmg = Math.max(1, dmg);
        const newHp = Math.max(0, (Number(target.hp) || 0) - dmg);
        target.hp = newHp;
        if (newHp <= 0) target.defeated = true;
        beats.push(`Your fire bolt sears the ${target.name} for ${dmg} fire${crit ? ' (critical!)' : ''}${newHp <= 0 ? ' — it drops.' : `. (${newHp} HP left)`}`);
      } else {
        beats.push(`Your fire bolt sputters wide of the ${target.name}.`);
      }
    } else {
      // blade strike (default)
      const total = roll + bladeAtkBonus(pc);
      if (roll === 1) {
        beats.push(`You swing at the ${target.name} and miss.`);
      } else if (roll === 20 || total >= ac) {
        const crit = roll === 20;
        let dmg = rng.int(1, BLADE_DMG_DIE) + bladeDmgMod(pc);
        if (crit) dmg += rng.int(1, BLADE_DMG_DIE);
        dmg = Math.max(1, dmg);
        const newHp = Math.max(0, (Number(target.hp) || 0) - dmg);
        target.hp = newHp;
        if (newHp <= 0) target.defeated = true;
        beats.push(`You hit the ${target.name} for ${dmg}${crit ? ' (critical!)' : ''}${newHp <= 0 ? ' — it drops.' : `. (${newHp} HP left)`}`);
      } else {
        beats.push(`You swing at the ${target.name} and miss.`);
      }
    }
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
  const ac = playerAc(pc) + (warded ? WARD_AC_BONUS : 0);
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
        epilogueLine: 'Your strength fails. The dungeon keeps you.'
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
  beats.push(`(You: ${hp} HP)`);
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
