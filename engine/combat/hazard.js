// ─────────────────────────────────────────────────────────────────────────────
// hazard.js — environmental hazards (collapse / fire / fall) for the escape engine.
//
// PRINCIPLE (settled with Tim 2026-06-16): reach for D&D 5e SRD first; where it's
// silent, a real-world analog. Bringing a roof down on yourself, leaping into a
// fire, or going out a window must DO something — the gate caught these narrated
// with zero mechanical effect.
//
// SRD grounding (every value a named, tunable constant):
//   collapse → DC 15 Dexterity save, 4d6 bludgeoning, half on a save; AREA (the
//              roof falls on everyone present, PC and foes alike).
//   fire     → 2d6 fire for walking/leaping into flames (real-world: it burns).
//   fall     → 1d6 per 10 ft (SRD falling), a window/ledge ≈ 15 ft.
//
// Pure: applies damage to the passed escapeHp (returned) and mutates present
// enemies' hp in place (the escapeCombat pattern). RNG passed in.
// ─────────────────────────────────────────────────────────────────────────────

import { statMod } from '../ruleset/core/stats.js';

export const HAZARD_TUNABLES = {
  COLLAPSE_DC: 15,                  // SRD-typical hazard save DC
  COLLAPSE_DICE: { n: 4, d: 6 },    // 4d6 bludgeoning (half on save)
  FIRE_DICE: { n: 2, d: 6 },        // 2d6 fire
  FALL_DIE: 6,                      // 1d6 per 10 ft
  FALL_FEET: 15,                    // a window/ledge
};

// A collapse the player brings down on themselves / everyone, or kicks loose.
const COLLAPSE_RE = /\b(?:roof|ceiling|rafters?|building|structure|walls?)\b[^.]*\b(?:come|comes|coming|bring|crash|crashing|collaps|cave|cav(?:e|ing)\s+in|down\s+(?:on|onto))\b|\b(?:kick|smash|knock|topple|cut|chop|break|buckle)\b[^.]*\b(?:support|beam|pillar|column|post|load-?bearing)\b|\bbring\s+(?:the|this)\b[^.]*\b(?:roof|ceiling|house|building|place)\b[^.]*\bdown\b|\bcollapse\s+(?:the|this)\b/i;
// The PC putting THEMSELVES into fire (foe-into-fire is a grapple/throw concern).
const FIRE_RE = /\b(?:leap|jump|dive|throw\s+myself|hurl\s+myself|fling\s+myself|plunge|charge|run|step|walk)\b[^.]*\b(?:into|through|across)\b[^.]*\b(?:fire|flames?|blaze|inferno|burning|the\s+hearth|the\s+pyre)\b|\bset\s+myself\b[^.]*\b(?:alight|ablaze|on\s+fire)\b/i;
// The PC going off a height.
const FALL_RE = /\b(?:leap|jump|dive|throw\s+myself|hurl\s+myself|fling\s+myself|step|plunge|drop|vault)\b[^.]*\b(?:out|off|over|from|through|down)\b[^.]*\b(?:window|ledge|edge|cliff|roof|balcony|rooftop|height|tower|wall|parapet|battlement)\b/i;

export function parseHazard(text) {
  const t = String(text || '');
  if (COLLAPSE_RE.test(t)) return 'collapse';
  if (FIRE_RE.test(t)) return 'fire';
  if (FALL_RE.test(t)) return 'fall';
  return null;
}

function rollDice(n, d, rng) { let s = 0; for (let i = 0; i < n; i++) s += rng.int(1, d); return s; }

// resolveHazard — apply an environmental hazard. Mutates `enemies` in place for
// area effects; returns { hp (new escapeHp), beats, mechanicsLine, outcome }.
export function resolveHazard({ kind, pc, escapeHp, escMax, enemies = [], rng }, T = HAZARD_TUNABLES) {
  const beats = [];
  const max = Number(escMax) || 0;
  let hp = Number(escapeHp) || 0;
  const agi = statMod(Number(pc?.stats?.AGILITY) || 10);
  const hpTag = () => max > 0 ? ` (You: ${hp}${'/' + max} HP)` : '';

  if (kind === 'collapse') {
    const full = rollDice(T.COLLAPSE_DICE.n, T.COLLAPSE_DICE.d, rng);
    const saved = (rng.int(1, 20) + agi) >= T.COLLAPSE_DC;
    const dmg = saved ? Math.floor(full / 2) : full;
    hp = Math.max(0, hp - dmg);
    beats.push(`The structure gives way — timber and stone come down on you. You ${saved ? 'twist clear of the worst' : 'take the full weight'} for ${dmg} bludgeoning${saved ? ' (DEX save)' : ''}.${hpTag()}`);
    for (const e of enemies) {
      if (!e || e.defeated || (Number(e.hp) || 0) <= 0) continue;
      const ef = rollDice(T.COLLAPSE_DICE.n, T.COLLAPSE_DICE.d, rng);
      const ed = (rng.int(1, 20) >= 10) ? Math.floor(ef / 2) : ef;
      e.hp = Math.max(0, (Number(e.hp) || 0) - ed);
      if (e.hp <= 0) e.defeated = true;
      beats.push(`${e.name} is caught under the falling debris for ${ed}${e.defeated ? ' — and does not get back up' : ''}.`);
    }
    return { hp, beats, mechanicsLine: `[hazard:collapse | ${dmg} to you${saved ? ' (saved)' : ''}]`, outcome: hp <= 0 ? 'failure' : 'mixed' };
  }

  if (kind === 'fire') {
    const dmg = rollDice(T.FIRE_DICE.n, T.FIRE_DICE.d, rng);
    hp = Math.max(0, hp - dmg);
    beats.push(`The flames take you the instant you reach them — ${dmg} fire, and the heat clings.${hpTag()}`);
    return { hp, beats, mechanicsLine: `[hazard:fire | ${dmg}]`, outcome: hp <= 0 ? 'failure' : 'mixed' };
  }

  if (kind === 'fall') {
    const dice = Math.max(1, Math.round(T.FALL_FEET / 10));
    const dmg = rollDice(dice, T.FALL_DIE, rng);
    hp = Math.max(0, hp - dmg);
    beats.push(`You go over and the ground comes up hard — ${dmg} bludgeoning, and you land in a heap.${hpTag()}`);
    return { hp, beats, mechanicsLine: `[hazard:fall | ${dmg}]`, outcome: hp <= 0 ? 'failure' : 'mixed' };
  }

  return { hp, beats: [], mechanicsLine: '', outcome: 'mixed' };
}
