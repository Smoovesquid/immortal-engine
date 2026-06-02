/**
 * v1 Escape — classic-D&D combat resolver.
 *
 * Deliberately simple and legible. The deep engine (wounds/stress/conditions/
 * traits/resistances/legendary actions) stays parked for the open sandbox; the
 * shippable Escape game uses plain hit points and the familiar loop:
 *
 *   roll d20 + modifier vs the target's Armor Class
 *   on a hit, roll damage dice + modifier; subtract from hit points
 *   0 hit points = down
 *
 * The player's hit points live in `world.meta.escapeHp` and persist ACROSS
 * fights (attrition — you patch up a little between fights, not fully). Enemy
 * hit points live in the shared `world.combat.enemies[].hp` so the existing UI
 * renders them unchanged.
 *
 * Pure and deterministic: every roll comes from a seeded RNG. No Math.random,
 * no Date.now, no LLM.
 */

import { ensureWorld } from '../state.js';
import { applyDeltas } from '../effectsCore.js';
import { endCombat } from './combatLifecycle.js';
import { statMod } from '../ruleset/core/stats.js';
import { makeRng, seedFromString } from '../rng.js';

// ── Player build (level-1 escapee, no gear) ──────────────────────────────────
const PLAYER_BASE_HP = 14;   // + GRIT mod
const PLAYER_BASE_AC = 12;   // + AGILITY mod (unarmored)
const PLAYER_ATK_BONUS = 2;  // + MIGHT mod (improvised proficiency)
const PLAYER_DMG_DIE = 6;    // d6 + MIGHT mod (fists / found weapon)

// ── Enemy build (tamed; only fields that survive ensureCombat are used) ──────
const ENEMY_ATK_BONUS = 3;   // fixed to-hit; enemy `damage` field = damage die max

// ── Short rest (recover on a safe hop) ───────────────────────────────────────
const REST_DIE = 6;          // d6 + REST_FLAT healed per clear hop
const REST_FLAT = 2;

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

function playerAtkBonus(pc) {
  const might = pc?.stats?.MIGHT ?? 10;
  return PLAYER_ATK_BONUS + statMod(might);
}

function playerDmgMod(pc) {
  const might = pc?.stats?.MIGHT ?? 10;
  return statMod(might);
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
 * resolveEscapeCombatTurn(world) -> { world, result }
 *
 * One full round: the player strikes the first living enemy, then every living
 * enemy strikes back. Ends combat on victory; locks the loss ending on defeat.
 * `result.combatSummary` is a plain-language blow-by-blow for the transcript.
 */
export function resolveEscapeCombatTurn(world) {
  let w = ensureWorld(world);
  if (!w.combat?.active) {
    return { world: w, result: { combatSummary: '', mechanicsLine: '', outcome: 'mixed' } };
  }

  const pc = w.party?.[0] || {};
  const round = Number(w.combat.round) || 1;
  const rng = makeRng(seedFromString(`${w.meta?.seed || ''}|escapeCombat|${w.timeline.length}|r${round}`));
  const lines = [];

  // ── Player turn: attack the first living enemy ─────────────────────────────
  let enemies = (Array.isArray(w.combat.enemies) ? w.combat.enemies : []).map(e => ({ ...e }));
  const targetIdx = enemies.findIndex(e => e && !e.defeated && (Number(e.hp) || 0) > 0);

  if (targetIdx >= 0) {
    const target = enemies[targetIdx];
    const roll = rng.int(1, 20);
    const total = roll + playerAtkBonus(pc);
    const ac = Number(target.ac) || 10;
    if (roll === 1) {
      lines.push(`You swing at the ${target.name} and miss.`);
    } else if (roll === 20 || total >= ac) {
      const crit = roll === 20;
      let dmg = rng.int(1, PLAYER_DMG_DIE) + playerDmgMod(pc);
      if (crit) dmg += rng.int(1, PLAYER_DMG_DIE);
      dmg = Math.max(1, dmg);
      const newHp = Math.max(0, (Number(target.hp) || 0) - dmg);
      target.hp = newHp;
      if (newHp <= 0) target.defeated = true;
      lines.push(`You hit the ${target.name} for ${dmg}${crit ? ' (critical!)' : ''}${newHp <= 0 ? ' — it drops.' : `. (${newHp} HP left)`}`);
    } else {
      lines.push(`You swing at the ${target.name} and miss.`);
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
    w = endCombat(w, { reason: 'enemies-defeated' });
    return {
      world: w,
      result: {
        combatSummary: lines.join(' ') + ' The way is clear.',
        mechanicsLine: '[combat:victory]',
        outcome: 'success'
      }
    };
  }

  // ── Enemy turns: each living enemy strikes the player ──────────────────────
  let hp = Number(w.meta.escapeHp) || 0;
  const ac = playerAc(pc);
  for (const e of enemies) {
    if (!e || e.defeated || (Number(e.hp) || 0) <= 0) continue;
    const roll = rng.int(1, 20);
    const total = roll + ENEMY_ATK_BONUS;
    if (roll === 1) {
      lines.push(`The ${e.name} lunges and misses.`);
      continue;
    }
    if (roll === 20 || total >= ac) {
      const die = Math.max(2, Number(e.damage) || 4);
      const crit = roll === 20;
      let dmg = rng.int(1, die);
      if (crit) dmg += rng.int(1, die);
      dmg = Math.max(1, dmg);
      hp = Math.max(0, hp - dmg);
      lines.push(`The ${e.name} hits you for ${dmg}${crit ? ' (critical!)' : ''}.`);
      if (hp <= 0) break;
    } else {
      lines.push(`The ${e.name} lunges and misses.`);
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
    return {
      world: w,
      result: {
        combatSummary: lines.join(' ') + ' You fall.',
        mechanicsLine: '[combat:defeat]',
        outcome: 'failure'
      }
    };
  }

  // ── Advance round ──────────────────────────────────────────────────────────
  w = applyDeltas(w, [{ op: 'combatState', set: { round: round + 1, turnIndex: 0 } }]);
  return {
    world: w,
    result: {
      combatSummary: lines.join(' ') + ` (You: ${hp} HP)`,
      mechanicsLine: `[combat:r${round}]`,
      outcome: 'mixed'
    }
  };
}
