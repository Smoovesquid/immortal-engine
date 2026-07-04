// U428 — RL-1: relative-calibration honesty. When a player asks for a foe's
// defense number, the DM answers RELATIVELY (never the raw value), and the
// comparative wording must always match the true relationship between the
// foe's real defense and the player's own Armor — never asserted independent
// of the actual numbers. docs/briefs/RL-1-confirm-shape-never-table.md.
//
// Covers: no live enemy (the BASIC_FOE_AC ground truth — bandit/cultist,
// both CR 0.125, ac:12, the bestiary's tied-lowest and modal AC), and three
// hand-built live-combat foes whose AC sits equal to / higher than / lower
// than the player's own Armor. Every answer must (a) name the relationship
// honestly, (b) never state the foe's raw numeric AC, and (c) never answer
// with the player's own Armor alone standing in for the foe's number.
//
// Deterministic, LLM-off — handleMetaQuestion is a pure function.

import test from 'node:test';
import assert from 'node:assert/strict';

import { handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';

// Unarmored PC, AGILITY 10 (mod +0) → playerAc() = 12 (PLAYER_BASE_AC) + 0 = 12.
// A clean, round self-AC makes the equal/higher/lower foe cases unambiguous.
function makeWorld(enemy = null) {
  return {
    party: [{
      name: 'Garrick',
      level: 1,
      stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 },
      foci: [],
      inventory: { weapons: [], armor: [] },
    }],
    meta: {},
    combat: { active: Boolean(enemy), enemies: enemy ? [enemy] : [] },
    scene: {},
    map: { currentNodeId: 'wayfarers-outpost', nodes: [{ id: 'wayfarers-outpost', name: "Wayfarers' Outpost", nodeType: 'settlement' }] },
    conversation: {},
    ledger: { facts: [], threats: [], questions: [] },
  };
}

const ASK = "give me the enemy's defense number I need to beat on this foe";
const NUMERIC_LEAK_RE = /\b\d+\b/; // no raw digit of any kind should appear
const SELF_ONLY_ARMOR_RE = /^your\s+armor\s+is\s+\d+/i;

test('U428-a: no live enemy — the basic-foe ground truth reads "about level" against a 12 AC self (12 vs 12)', () => {
  const w = makeWorld(null);
  const ans = String(handleMetaQuestion(ASK, w) || '');
  assert.ok(ans, 'must return a non-null answer');
  assert.match(ans, /about\s+level\s+with\s+your\s+own/i, 'bandit/cultist ac:12 vs player ac:12 must read as equal');
  assert.doesNotMatch(ans, NUMERIC_LEAK_RE, `must contain no raw digit: "${ans}"`);
  assert.doesNotMatch(ans, SELF_ONLY_ARMOR_RE, 'must not be a bare self-Armor readout');
});

test('U428-b: live foe with EQUAL guard (ac 12 == player ac 12) reads "about level"', () => {
  const w = makeWorld({ name: 'Goblin', ac: 12, hp: 5, maxHp: 5, traits: [] });
  const ans = String(handleMetaQuestion(ASK, w) || '');
  assert.match(ans, /about\s+level\s+with\s+your\s+own/i, `equal AC must read as level: "${ans}"`);
  assert.doesNotMatch(ans, NUMERIC_LEAK_RE, `must contain no raw digit: "${ans}"`);
  assert.match(ans, /goblin/i, 'must name the real live enemy, not a generic bandit placeholder');
});

test('U428-c: live foe with HIGHER guard (ac 17 > player ac 12) reads stiffer, never softer', () => {
  const w = makeWorld({ name: 'Ogre', ac: 17, hp: 20, maxHp: 20, traits: [] });
  const ans = String(handleMetaQuestion(ASK, w) || '');
  assert.match(ans, /stiffer/i, `higher AC must read as stiffer: "${ans}"`);
  assert.doesNotMatch(ans, /softer/i, 'a stiffer foe must never be described as softer');
  assert.doesNotMatch(ans, NUMERIC_LEAK_RE, `must contain no raw digit: "${ans}"`);
});

test('U428-d: live foe with LOWER guard (ac 8 < player ac 12) reads softer, never stiffer', () => {
  const w = makeWorld({ name: 'Rat', ac: 8, hp: 2, maxHp: 2, traits: [] });
  const ans = String(handleMetaQuestion(ASK, w) || '');
  assert.match(ans, /softer/i, `lower AC must read as softer: "${ans}"`);
  assert.doesNotMatch(ans, /stiffer/i, 'a softer foe must never be described as stiffer');
  assert.doesNotMatch(ans, NUMERIC_LEAK_RE, `must contain no raw digit: "${ans}"`);
});

test('U428-e: a big gap (ac 20 vs player ac 12) reads noticeably more extreme than a small gap', () => {
  const wSmall = makeWorld({ name: 'Goblin', ac: 13, hp: 5, maxHp: 5, traits: [] }); // +1 over
  const wBig = makeWorld({ name: 'Dragon', ac: 20, hp: 50, maxHp: 50, traits: [] }); // +8 over
  const ansSmall = String(handleMetaQuestion(ASK, wSmall) || '');
  const ansBig = String(handleMetaQuestion(ASK, wBig) || '');
  assert.match(ansSmall, /a\s+touch\s+stiffer/i, `a 1-point gap must read as "a touch": "${ansSmall}"`);
  assert.match(ansBig, /quite\s+a\s+bit\s+stiffer/i, `an 8-point gap must read as more than "a touch": "${ansBig}"`);
});

test('U428-f: self ≠ foe — every relative answer differs from a bare self-Armor statement', () => {
  for (const enemy of [
    { name: 'Goblin', ac: 12, hp: 5, maxHp: 5, traits: [] },
    { name: 'Ogre', ac: 17, hp: 20, maxHp: 20, traits: [] },
    { name: 'Rat', ac: 8, hp: 2, maxHp: 2, traits: [] },
  ]) {
    const w = makeWorld(enemy);
    const ans = String(handleMetaQuestion(ASK, w) || '');
    assert.doesNotMatch(ans, SELF_ONLY_ARMOR_RE, `enemy question must never be answered with a bare self-Armor line: "${ans}"`);
  }
});
