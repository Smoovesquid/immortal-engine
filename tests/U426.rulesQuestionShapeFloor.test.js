// U426 — RL-1: rules questions get the SHAPE, never the table.
// docs/briefs/RL-1-confirm-shape-never-table.md · Tim's ruling (2026-07-04-pm3,
// verbatim): "confirm the shape, never the table."
//
// The four exchanges this locks (quoted verbatim from
// docs/playtests/opus-gate-2026-07-04-2.md, Rules-Lawyer persona, seed
// tallow, DM_ARTIFACT_LEAK ×2 + DM_TEST_DEADEND ×2 — all reproduced LLM-OFF,
// `route: "meta"` in the gate JSONL, confirming these four answers come
// SOLELY from handleMetaQuestion; no LLM is ever in the loop for them):
//
//   1. "Level 1 with three penalties across the board? Let me get the
//      mechanics straight — what does the modifier in parentheses mean, and
//      how do I roll to hit something?"
//      → was: raw "Modifier breakpoints: 3 → -4, 4–5 → -3, ..." table dump.
//   2. "So a MIGHT attack rolls d20, minus 2, versus the target's defense?
//      Confirm the to-hit formula and what number I need against a basic foe."
//      → was: the identical breakpoint-table dump, again.
//   3. "You're repeating the same table without answering. Plainly: is my
//      attack roll d20 minus 2 versus a target number, yes or no, and what's
//      the TN for a basic foe?"
//      → was: "To hit you add your MIGHT modifier..." — dodged the yes/no,
//        never gave a TN.
//   4. "And the target number — what defense value do I need to meet or beat
//      with that roll against a basic foe?"
//      → was: "Your Armor is 10..." — the PLAYER'S OWN Armor, not the foe's.
//   5. "That's my Armor. Now what's the enemy's — give me the defense number
//      I need to beat on a basic foe so I can actually resolve a swing."
//      → was: "Your Armor is 10..." again — self answered for foe, twice.
//
// Deterministic, LLM-off — handleMetaQuestion is a pure function of
// (text, world); no fetch, no API key, no randomness.

import test from 'node:test';
import assert from 'node:assert/strict';

import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';

// Tallow world matching the gate harness's PC at the failing turns: Level 1,
// three -2 penalties (MIGHT/AGILITY/WITS), no armor equipped (playerAc → 10),
// standing in the Bedchamber, not in combat (inCombat:false, enemies:[] —
// the gate transcript's own canon bundle at these turns).
function makeWorld(overrides = {}) {
  return {
    party: [{
      name: 'Garrick',
      archetype: 'Escaped Prisoner',
      level: 1,
      stats: { MIGHT: 6, AGILITY: 6, WITS: 6, GRIT: 8, CHARM: 6 },
      foci: [],
      inventory: { weapons: [{ name: 'Worn Blade', damage: '1d6' }], armor: [] },
    }],
    meta: { mode: 'escape', escapeHp: 13, escapeMaxHp: 13 },
    combat: { active: false, enemies: [] },
    scene: {},
    map: { currentNodeId: 'wayfarers-outpost', nodes: [{ id: 'wayfarers-outpost', name: "Wayfarers' Outpost", nodeType: 'settlement' }] },
    conversation: {},
    ledger: { facts: [], threats: [], questions: [] },
    ...overrides
  };
}

const Q1 = "Level 1 with three penalties across the board? Let me get the mechanics straight — what does the modifier in parentheses mean, and how do I roll to hit something?";
const Q2 = "So a MIGHT attack rolls d20, minus 2, versus the target's defense? Confirm the to-hit formula and what number I need against a basic foe.";
const Q3 = "You're repeating the same table without answering. Plainly: is my attack roll d20 minus 2 versus a target number, yes or no, and what's the TN for a basic foe?";
const Q4 = "And the target number — what defense value do I need to meet or beat with that roll against a basic foe?";
const Q5 = "That's my Armor. Now what's the enemy's — give me the defense number I need to beat on a basic foe so I can actually resolve a swing.";

const ALL = [Q1, Q2, Q3, Q4, Q5];

// A raw modifier-breakpoint dump: "N(–N)? → [+-]N" repeated, or the literal
// "Modifier breakpoints:" lead-in the old code hard-coded.
const TABLE_DUMP_RE = /modifier\s+breakpoints\s*:|\d+(?:[–-]\d+)?\s*(?:→|->)\s*[+-]\d/i;
const NUMERIC_TN_DC_RE = /\bTN\s*\d+\b|\bDC\s*\d+\b/i;
// The old, wrong self-answer that leaked the PC's own Armor when the ENEMY's
// defense was asked for.
const SELF_ARMOR_LEAK_RE = /your\s+armor\s+is\s+\d+/i;

test('U426-a: all four gate utterances are classified as meta-questions (never reach the d20 resolver)', () => {
  for (const q of ALL) assert.ok(isMetaQuestion(q), `must classify as meta: "${q.slice(0, 40)}..."`);
});

test('U426-b: Q1/Q2 ("how do I roll to hit") get the SHAPE, never the breakpoint table', () => {
  const w = makeWorld();
  for (const q of [Q1, Q2]) {
    const ans = String(handleMetaQuestion(q, w) || '');
    assert.ok(ans, 'must return a non-null answer');
    assert.doesNotMatch(ans, TABLE_DUMP_RE, `must not leak the breakpoint table: "${ans}"`);
    assert.match(ans, /\bd\s?20\b/i, 'must name the die (d20)');
    assert.match(ans, /\bmight\b/i, 'must name the governing stat (MIGHT)');
    assert.match(ans, /\bfoe'?s?\s+guard\b|\bguard\b/i, "must confirm what it's rolled against (the foe's guard)");
  }
});

test('U426-c: Q3 (direct yes/no) is confirmed YES/NO FIRST, not dodged', () => {
  const w = makeWorld();
  const ans = String(handleMetaQuestion(Q3, w) || '');
  assert.ok(ans, 'must return a non-null answer');
  assert.match(ans, /^yes\s*—/i, 'a direct yes/no ask must lead with the confirmation');
  assert.doesNotMatch(ans, TABLE_DUMP_RE, 'must not fall back to the breakpoint table');
});

test('U426-d: Q4/Q5 (foe defense number) are answered about the FOE, never the player\'s own Armor', () => {
  const w = makeWorld();
  for (const q of [Q4, Q5]) {
    const ans = String(handleMetaQuestion(q, w) || '');
    assert.ok(ans, 'must return a non-null answer');
    assert.doesNotMatch(ans, SELF_ARMOR_LEAK_RE, `must not answer the enemy question with the player's own Armor: "${ans}"`);
    assert.match(ans, /\bfoe|bandit|enemy|guard\b/i, 'must reference the foe/enemy, not just the player');
  }
});

test('U426-e: no numeric TN/DC/defense value appears anywhere across all five answers', () => {
  const w = makeWorld();
  for (const q of ALL) {
    const ans = String(handleMetaQuestion(q, w) || '');
    assert.doesNotMatch(ans, NUMERIC_TN_DC_RE, `must not state a bare numeric TN/DC: "${ans}"`);
    assert.doesNotMatch(ans, TABLE_DUMP_RE, `must not leak a breakpoint table: "${ans}"`);
  }
});

test('U426-f: a genuine self-only AC ask ("what\'s my AC?") is UNAFFECTED — still answers the player\'s own Armor', () => {
  const w = makeWorld();
  const ans = String(handleMetaQuestion("what's my AC?", w) || '');
  assert.match(ans, /your\s+armor\s+is\s+\d+/i, "a bare self-AC ask must still get the player's own number — this is allowed (their own sheet), only the FOE question was ever wrong");
});

test('U426-g: a genuine own-stat modifier ask ("what\'s my MIGHT modifier?") still gets the real number, not the table', () => {
  const w = makeWorld();
  const ans = String(handleMetaQuestion("what's my MIGHT modifier?", w) || '');
  assert.match(ans, /-2/, 'must report the real MIGHT modifier (-2) for this sheet');
  assert.doesNotMatch(ans, TABLE_DUMP_RE, 'must not fall back to the breakpoint table when a specific stat is named');
});
