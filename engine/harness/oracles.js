// ─────────────────────────────────────────────────────────────────────────────
// engine/harness/oracles.js — the deterministic oracle bank (Phase 1).
//
// "Coherent against WHAT?" → against the table (THE_TABLE_TEST). Each oracle reads
// COMMITTED state and the engine's narration and asks a yes/no question a real D&D
// table would answer. They are pure, free (ZERO API cost — the whole point), and
// deterministic: a finding replays exactly on the same seed + action log.
//
// Phase 1 ships the three the brief names — state-desync (the crown jewel),
// free-action, soft-lock/goal. Each is tuned for PRECISION over recall: a finder
// people will trust must not cry wolf, so a rule only fires on a high-confidence
// contradiction. Lower-recall extensions (spatial, consequence, §0) are left as
// labelled one-line registry slots for the "follow within the phase" work.
//
// HARD INVARIANT (narration ≠ canon): READ-ONLY over the world. No mutation, no
// RNG. The oracle reports; the engine remains the sole author of canon.
// ─────────────────────────────────────────────────────────────────────────────

import { buildCanonGroundTruth } from '../ref/rubric.js';
import { isInsideInterior } from './goals.js';

// The engine prefixes base narration with "Wizard:" (a speaker tag the UI renders
// via attribution, not literally). Strip it so the oracle judges what a player
// reads — otherwise the prefix itself looks like an artifact leak.
export function cleanNarration(s) {
  return String(s || '').replace(/^\s*Wizard:\s*/i, '').trim();
}

// A real check happened this turn iff the engine recorded a NEW roll
// (conversation.lastRoll changes — it carries an incrementing `turn`) OR the
// mechanics line shows the "[roll:N vs DC:M → …]" stamp. Both are deterministic.
export function rolledThisTurn(before, after, output) {
  const a = JSON.stringify(before?.conversation?.lastRoll ?? null);
  const b = JSON.stringify(after?.conversation?.lastRoll ?? null);
  if (a !== b) return true;
  return /\broll:\s*\d+\s*vs\s*DC\s*:?\s*\d+/i.test(String(output?.mechanics || ''));
}

function makeFinding(oracleId, severity, fields) {
  return { oracleId, severity, ...fields };
}

// ── Oracle: state-desync (the crown jewel) ────────────────────────────────────
// Diff what the narration CLAIMS happened against what the Canon Log COMMITTED,
// turn-over-turn. Phase 1 covers the highest-confidence claim→delta pairs:
//   • EXIT  — "you step outside" must clear the interior      (the flagship)
//   • ENTER — "you step inside the <building>" must set one
//   • DEATH — "<foe> falls dead/slain" must leave a defeated/removed enemy
// (Pouch/pickup inventory deltas need an item-level view buildCanonGroundTruth
//  doesn't yet expose without false-positives on "you take stock" — deferred.)

const EXIT_CLAIM = /\b(?:step(?:s|ped)?|head(?:s|ed)?|walk(?:s|ed)?|go|going|slip(?:s|ped)?|stride[sd]?|duck(?:s|ed)?|emerge[sd]?|exit(?:s|ed)?)\b[^.!?]{0,40}?\b(?:back\s+)?(?:outside|out\s+(?:the\s+door|into\s+the|of\s+(?:the|this)\s+\w+)|out\s+into)\b|\b(?:leave|leaving|left|exit)\b[^.!?]{0,24}?\b(?:building|house|cottage|hut|cabin|inn|tavern|hall|room|shop|store|lodge|temple|shrine)\b|\bback\s+outside\b/i;

const ENTER_CLAIM = /\b(?:step(?:s|ped)?|head(?:s|ed)?|walk(?:s|ed)?|go|going|duck(?:s|ed)?|slip(?:s|ped)?|enter(?:s|ed)?)\b[^.!?]{0,32}?\b(?:inside|indoors|in\s+through\s+the\s+door|into\s+the\s+(?:building|house|cottage|hut|cabin|inn|tavern|hall|shop|store|lodge|temple|shrine|keep|tower))\b/i;

const DEATH_CLAIM = /\b(?:falls?\s+(?:dead|lifeless)|drops?\s+dead|lies?\s+dead|is\s+(?:slain|killed|dead|cut\s+down|struck\s+down)|crumples?\s+(?:dead|lifeless)|you\s+(?:kill|slay|cut\s+down|strike\s+down|finish))\b/i;

export function runStateDesync({ before, after, output }) {
  const text = cleanNarration(output?.narration);
  if (!text) return [];
  const findings = [];

  // EXIT — if the narration says you went outside but you are STILL inside.
  if (EXIT_CLAIM.test(text) && isInsideInterior(before) && isInsideInterior(after)) {
    findings.push(makeFinding('state-desync', 'high', {
      claim: 'narration says the player stepped outside',
      expected: 'scene.interior cleared (now outdoors)',
      committed: `scene.interior still set (room ${after?.scene?.interior?.roomId})`,
      note: 'said-outside-still-inside — the DM lied about where you are (THE_TABLE_TEST: you go where you said)',
    }));
  }

  // ENTER — if the narration says you went inside but no interior was set.
  if (ENTER_CLAIM.test(text) && !isInsideInterior(before) && !isInsideInterior(after)) {
    findings.push(makeFinding('state-desync', 'high', {
      claim: 'narration says the player stepped inside a structure',
      expected: 'scene.interior set (now indoors)',
      committed: 'scene.interior still null (still outdoors)',
      note: 'said-inside-still-outside — entered a building the engine never put you in',
    }));
  }

  // DEATH — if the narration kills a foe but no enemy went defeated/removed.
  if (DEATH_CLAIM.test(text)) {
    const enemiesBefore = buildCanonGroundTruth(before).enemies || [];
    const enemiesAfter = buildCanonGroundTruth(after).enemies || [];
    const someDefeated = enemiesAfter.some(e => e.defeated);
    const someRemoved = enemiesAfter.length < enemiesBefore.length;
    if (enemiesBefore.length > 0 && !someDefeated && !someRemoved) {
      findings.push(makeFinding('state-desync', 'high', {
        claim: 'narration says a foe was slain',
        expected: 'an enemy marked defeated or removed from combat',
        committed: `enemies still standing: ${enemiesAfter.map(e => `${e.name}(${e.hp}/${e.maxHp})`).join(', ') || '(none tracked)'}`,
        note: 'narrated-a-kill-no-corpse — death in prose with no mechanical death (combat-lethality seam)',
      }));
    }
  }

  return findings;
}

// ── Oracle: free-action ───────────────────────────────────────────────────────
// Some intents must resolve with NO roll — a real DM does not call for a check to
// walk out a door or look around (THE_TABLE_TEST). If a clearly-free action rolled
// the dice, that is the bug. Tuned to the highest-confidence free intents only
// (the `tallow` start state shows the engine resolves all of these roll-free).
const FREE_INTENT = [
  /\bstep(?:s|ped)?\s+(?:out(?:side)?|in(?:side)?)\b/i,
  /\bgo(?:es|ing)?\s+(?:out(?:side)?|in(?:side)?|back\s+(?:out|in)(?:side)?)\b/i,
  /\bhead(?:s|ed)?\s+(?:out(?:side)?|in(?:side)?)\b/i,
  /\bget(?:s|ting)?\s+(?:out\s+of\s+bed|up)\b/i,
  /\bstand(?:s|ing)?\s+up\b/i,
  /\blook(?:s|ing)?\s+(?:around|about)\b/i,
  /\btake(?:s|ing)?\s+stock\b/i,
  /\bsurvey(?:s|ing)?\b/i,
  /\b(?:talk|speak)\s+(?:to|with)\b/i,
  /\b(?:greet|approach)\b[^.!?]{0,24}\b(?:to\s+talk|and\s+(?:say|greet))\b/i,
];

function isFreeIntent(action) {
  const t = String(action || '');
  return FREE_INTENT.some(re => re.test(t));
}

export function runFreeAction({ before, after, action, output }) {
  if (!isFreeIntent(action)) return [];
  if (!rolledThisTurn(before, after, output)) return [];
  return [makeFinding('free-action', 'med', {
    claim: `a free action resolved with a die roll: "${String(action).slice(0, 60)}"`,
    expected: 'no roll (a DM does not call a check to step out a door / look around / greet someone)',
    committed: `rolled — mech: ${String(output?.mechanics || '(none)').slice(0, 80)}`,
    note: 'rolled-a-free-action (intent-routing seam)',
  })];
}

// ── The per-turn oracle registry ──────────────────────────────────────────────
// Add a deterministic oracle as one { id, run } slot. run({before, after, action,
// output}) -> finding[]. (Phase-1 "follow" slots — spatial-correctness,
// consequence, §0 token-scan — drop in here unchanged.)
export const PER_TURN_ORACLES = Object.freeze([
  { id: 'state-desync', run: runStateDesync },
  { id: 'free-action', run: runFreeAction },
]);

// Run the whole per-turn bank; tag every finding with its turn + the action.
export function runOracleBank({ before, after, action, output, turn }) {
  const out = [];
  for (const oracle of PER_TURN_ORACLES) {
    let findings = [];
    try { findings = oracle.run({ before, after, action, output }) || []; }
    catch (e) { findings = [makeFinding(oracle.id, 'low', { note: `oracle threw: ${e?.message || e}` })]; }
    for (const f of findings) out.push({ ...f, turn, action });
  }
  return out;
}

// ── Oracle: soft-lock / goal (stateful, across turns) ─────────────────────────
// Pure over the per-turn progress series. The goal's progressMetric should climb
// toward completion; if its RUNNING MAX has not improved for `window` turns, the
// player is stuck — a dead-progress finding. Fires exactly ONCE, when the streak
// first reaches `window`, so a stuck session yields one finding, not a flood.
export const SOFT_LOCK_WINDOW = 8;

export function checkSoftLock(progressHistory, { window = SOFT_LOCK_WINDOW, goal, turn } = {}) {
  const hist = Array.isArray(progressHistory) ? progressHistory : [];
  const n = hist.length;
  if (n <= window) return null;
  let runningMax = -Infinity;
  let lastImproveIdx = -1;
  for (let i = 0; i < n; i++) {
    if (hist[i] > runningMax) { runningMax = hist[i]; lastImproveIdx = i; }
  }
  const flat = (n - 1) - lastImproveIdx; // turns since the running max last rose
  if (flat !== window) return null;       // emit only at the crossing
  return makeFinding('soft-lock', 'med', {
    turn: turn ?? n,
    claim: `no progress toward the goal for ${window} turns`,
    expected: `progressMetric to climb toward ${goal?.description || 'the goal'}`,
    committed: `progressMetric stuck at ${runningMax} since turn ${lastImproveIdx + 1}`,
    note: 'dead-progress — the player cannot make headway (soft-lock / can\'t-finish class)',
  });
}
