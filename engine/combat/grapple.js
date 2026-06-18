// ─────────────────────────────────────────────────────────────────────────────
// grapple.js — martial grapple / throw / choke for the live escape engine.
//
// DESIGN (settled 2026-06-15):
// - ONE intent per round (no action economy). The grapple STATE persists across
//   rounds as CONDITIONS on the enemy — no new schema, no position/grid.
// - CONTROL is derived from the condition set, not a field:
//       grappled            → clinch
//       grappled + prone     → down (after a throw; you keep top control)
// - SUBMISSIONS ride the condition system. A choke is player-driven: each round
//   you hold it, `choked.severity` ratchets up; at CHOKE_ROUNDS the foe goes out.
// - The breath gate is data you already have: `enemy.conditionImmunities`. A foe
//   that can't fall unconscious can't be choked.
// - Every DC / clock / die is a NAMED constant below (SRD defaults) — tune freely.
//   v2: scale CHOKE_ROUNDS by the foe's CON once stats are surfaced engine-wide
//   (today the escape engine uses flat bonuses, so we keep the clock flat too).
//
// Pure: mutates the caller's local `enemies` array in place (the escapeCombat
// pattern) and returns { beats, mechanicsLine, outcome }. RNG is passed in.
// ─────────────────────────────────────────────────────────────────────────────

import { applyCondition, hasCondition, getCondition, removeAllConditions } from './conditions.js';
import { statMod } from '../ruleset/core/stats.js';

export const GRAPPLE_TUNABLES = {
  GRAPPLE_DC_BASE: 12,   // seize a clinch: player d20+MIGHT vs (this + round(enemy.cr))
  THROW_DC_BASE: 13,     // take a grappled foe down (applies prone)
  THROW_DAMAGE_DIE: 6,   // 1dN bludgeoning on a clean takedown (+MIGHT)
  CHOKE_ROUNDS: 3,       // rounds of choke held → unconscious (v2: + CON mod)
  ESCAPE_DC: 12,         // the foe's save to break your grip (their turn)
};

// Creatures that can't be choked unconscious (no breath / no nervous system).
const BREATHLESS_IMMUNITIES = ['unconscious', 'exhaustion', 'suffocation'];

// "grapple/grab/throw/choke/escape" — only the martial intents. Returns the
// canonical verb or null. Caller only overrides when parseEscapeAction fell to
// its 'strike' default, so spells/parley/cover are never clobbered.
export function parseGrappleVerb(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(?:grab|grabs|seize|seizes|hold|holds)\b.*\b(?:head|neck)\b.*\b(?:twist|twists|snap|snaps|break|breaks)\b/.test(t)) return null;
  if (/\b(choke|chokes|choking|strangle|throttle|rear[\s-]?naked|guillotine|sleeper|squeeze\s+(?:his|her|their|its)\s+throat)\b/.test(t)) return 'choke';
  if (/\b(throw|throws|throwing|takedown|take\s+(?:him|her|them|it)\s+down|suplex|body[\s-]?slam|sweep|trip|dump|toss\s+(?:him|her|them))\b/.test(t)) return 'throw';
  if (/\b(escape|break\s+free|break\s+(?:his|her|their|its)\s+grip|wriggle\s+(?:free|out)|squirm\s+(?:free|out)|get\s+(?:free|out)\s+of)\b/.test(t)) return 'escape';
  if (/\b(grapple|grapples|grappling|grab|grabs|clinch|seize|wrestle|tackle|pin\b|takedown)\b/.test(t)) return 'grapple';
  return null;
}

function mightMod(pc) { return statMod(Number(pc?.stats?.MIGHT) || 10); }
function isBreathless(enemy) {
  const imm = Array.isArray(enemy?.conditionImmunities) ? enemy.conditionImmunities.map(String) : [];
  return imm.some(c => BREATHLESS_IMMUNITIES.includes(c));
}
function grappleCond(dc) {
  return { name: 'grappled', until: 'save_ends', source: 'player-grapple', severity: 1, saveToEnd: { stat: 'MIGHT', dc } };
}

// resolveGrappleAction — one round of a martial grapple intent. Mutates `enemies`
// in place; returns { beats, mechanicsLine, outcome }.
export function resolveGrappleAction({ pc, enemies, targetIdx, verb, rng }, T = GRAPPLE_TUNABLES) {
  const beats = [];
  const idx = (targetIdx >= 0 && enemies[targetIdx] && !enemies[targetIdx].defeated && (Number(enemies[targetIdx].hp) || 0) > 0)
    ? targetIdx
    : enemies.findIndex(e => e && !e.defeated && (Number(e.hp) || 0) > 0);
  if (idx < 0) {
    return { beats: ['There is no one here to lay hands on.'], mechanicsLine: '[grapple:no-target]', outcome: 'mixed' };
  }
  const tgt = enemies[idx];
  const mod = mightMod(pc);
  const d20 = () => rng.int(1, 20);
  const cr = Math.max(0, Math.round(Number(tgt.cr) || 0));
  const gripped = hasCondition(tgt.conditions, 'grappled');

  if (verb === 'grapple') {
    if (gripped) {
      return { beats: [`You already have ${tgt.name} in your grip — wrenched tight.`], mechanicsLine: '[grapple:already-clinched]', outcome: 'mixed' };
    }
    const dc = T.GRAPPLE_DC_BASE + cr;
    const roll = d20();
    const total = roll + mod;
    if (roll === 20 || total >= dc) {
      tgt.conditions = applyCondition(tgt.conditions || [], grappleCond(T.ESCAPE_DC), tgt.conditionImmunities);
      return { beats: [`You drive in and clinch ${tgt.name} — grappled, and going nowhere.`], mechanicsLine: `[grapple:clinch | ${roll}+${mod} vs ${dc}]`, outcome: 'success' };
    }
    return { beats: [`${tgt.name} twists out before your grip closes.`], mechanicsLine: `[grapple:clinch-miss | ${roll}+${mod} vs ${dc}]`, outcome: 'failure' };
  }

  if (verb === 'throw') {
    if (!gripped) {
      return { beats: [`You need a grip first — clinch ${tgt.name} before you can throw them.`], mechanicsLine: '[grapple:throw-no-grip]', outcome: 'mixed' };
    }
    const dc = T.THROW_DC_BASE + cr;
    const roll = d20();
    const total = roll + mod;
    if (roll === 20 || total >= dc) {
      const dmg = Math.max(1, rng.int(1, T.THROW_DAMAGE_DIE) + Math.max(0, mod));
      tgt.hp = Math.max(0, (Number(tgt.hp) || 0) - dmg);
      if (tgt.hp <= 0) tgt.defeated = true;
      // Keep the clinch (top control) and add prone — control advances to "down".
      tgt.conditions = applyCondition(tgt.conditions || [], { name: 'prone', until: 'end_of_next_turn', source: 'player-throw', severity: 1 }, tgt.conditionImmunities);
      const out = tgt.defeated ? ' — and they don\'t get up' : ' — down and prone';
      return { beats: [`You load ${tgt.name} and slam them to the floor for ${dmg}${out}.`], mechanicsLine: `[grapple:throw | ${roll}+${mod} vs ${dc} | ${dmg} dmg]`, outcome: 'success' };
    }
    return { beats: [`${tgt.name} sprawls and stuffs the takedown, staying on their feet.`], mechanicsLine: `[grapple:throw-miss | ${roll}+${mod} vs ${dc}]`, outcome: 'failure' };
  }

  if (verb === 'choke') {
    if (!gripped) {
      return { beats: [`You can't choke air — get a grip on ${tgt.name} first.`], mechanicsLine: '[grapple:choke-no-grip]', outcome: 'mixed' };
    }
    if (isBreathless(tgt)) {
      return { beats: [`${tgt.name} doesn't breathe — the choke finds nothing to take.`], mechanicsLine: '[grapple:choke-immune]', outcome: 'mixed' };
    }
    const prev = getCondition(tgt.conditions, 'choked');
    const sev = Math.min(10, (Number(prev?.severity) || 0) + 1);
    tgt.conditions = applyCondition(
      tgt.conditions || [],
      { name: 'choked', until: 'save_ends', source: 'player-choke', severity: sev, saveToEnd: { stat: 'MIGHT', dc: T.ESCAPE_DC } },
      tgt.conditionImmunities
    );
    if (sev >= T.CHOKE_ROUNDS) {
      tgt.defeated = true;
      tgt.hp = 0;
      tgt.conditions = applyCondition(tgt.conditions || [], { name: 'unconscious', until: 'permanent', source: 'player-choke', severity: 1 }, tgt.conditionImmunities);
      return { beats: [`${tgt.name} bucks once, then goes slack — out cold.`], mechanicsLine: `[grapple:choke-out | ${sev}/${T.CHOKE_ROUNDS}]`, outcome: 'success' };
    }
    return { beats: [`You sink the choke deeper — ${tgt.name} strains against it (${sev}/${T.CHOKE_ROUNDS}).`], mechanicsLine: `[grapple:choke | ${sev}/${T.CHOKE_ROUNDS}]`, outcome: 'success' };
  }

  if (verb === 'escape') {
    // The PLAYER breaking an enemy-applied grapple/restraint on themselves.
    const held = hasCondition(pc?.conditions, 'grappled') || hasCondition(pc?.conditions, 'restrained');
    if (!held) {
      return { beats: ['Nothing has hold of you — you\'re free to move.'], mechanicsLine: '[grapple:escape-not-held]', outcome: 'mixed' };
    }
    const roll = d20();
    if (roll === 20 || roll + mod >= T.ESCAPE_DC) {
      return { beats: ['You wrench and twist — and break free of the hold.'], mechanicsLine: `[grapple:escape | ${roll}+${mod} vs ${T.ESCAPE_DC}]`, outcome: 'success', clearsPlayerHold: true };
    }
    return { beats: ['You strain against the hold but can\'t break it — not yet.'], mechanicsLine: `[grapple:escape-fail | ${roll}+${mod} vs ${T.ESCAPE_DC}]`, outcome: 'failure' };
  }

  return { beats: [], mechanicsLine: '', outcome: 'mixed' };
}

// For the enemy turn: a grappled foe spends its action trying to break the grip
// (save vs the grapple's DC, using the engine's flat enemy save bonus). On a
// break, the grip AND any choke go with it. Returns { broke, beats } and mutates
// the enemy's conditions in place. Grappled foes never flee (handled by caller).
export function enemyGrappleEscape(enemy, enemySaveBonus, rng) {
  if (!hasCondition(enemy.conditions, 'grappled')) return { broke: false, beats: [] };
  const cond = getCondition(enemy.conditions, 'grappled');
  const dc = Number(cond?.saveToEnd?.dc) || GRAPPLE_TUNABLES.ESCAPE_DC;
  const save = rng.int(1, 20) + (Number(enemySaveBonus) || 0);
  if (save >= dc) {
    enemy.conditions = removeAllConditions(removeAllConditions(enemy.conditions || [], 'grappled'), 'choked');
    return { broke: true, beats: [`${enemy.name} powers out of your grip and breaks free.`] };
  }
  return { broke: false, beats: [] };
}
