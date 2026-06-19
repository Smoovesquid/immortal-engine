import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// H-25 (Opus gate 06-18, DM_TEST_DEADEND): a player asking for their OWN number —
// a D&D skill modifier ("what's my Insight modifier? I need a number"), their
// attack modifier, or a bare DC — got deflected into atmosphere instead of an
// answer, for several turns straight. These are now recognized meta-questions and
// answered from the sheet, intercepted before general narration.

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

// ── Unit level: the grace-layer recognizes + answers own-number asks ──
const SHEET = {
  party: [{ level: 3, stats: { MIGHT: 12, AGILITY: 14, WITS: 16, GRIT: 10, CHARM: 8 }, foci: ['perception', 'athletics'] }],
  conversation: { lastRoll: { roll: 14, dc: 12, outcome: 'success' } }
};

test('U189: skill-modifier asks are recognized as meta-questions', () => {
  for (const q of ['what is my Insight modifier? I need a number', 'what is my Perception modifier',
    'what is my attack modifier', 'give me the DC', 'what is my sleight of hand bonus']) {
    assert.equal(isMetaQuestion(q), true, `recognized: ${q}`);
  }
});

test('U189: an untrained skill reports the governing stat modifier', () => {
  // Insight → CHARM (8 → -1), not trained.
  const ans = handleMetaQuestion('what is my Insight modifier? I need a number', SHEET);
  assert.match(ans, /Insight modifier is -1/);
  assert.match(ans, /CHARM/);
});

test('U189: a trained skill adds the proficiency bonus', () => {
  // Perception → WITS (16 → +3), trained, level 3 prof +2 → +5.
  const ans = handleMetaQuestion('what is my Perception modifier', SHEET);
  assert.match(ans, /Perception modifier is \+5/);
  assert.match(ans, /proficiency \+2/);
});

test('U189: attack modifier reports melee and finesse numbers', () => {
  const ans = handleMetaQuestion('what is my attack modifier', SHEET);
  assert.match(ans, /MIGHT modifier \(\+1\)/);
  assert.match(ans, /AGILITY \(\+2\)/);
});

test('U189: a bare DC ask cites the last DC on record', () => {
  const ans = handleMetaQuestion('give me the DC', SHEET);
  assert.match(ans, /last DC I set was 12/);
});

test('U189: a bare DC ask with no roll on record explains, never deflects', () => {
  const ans = handleMetaQuestion('what is the DC', { party: [{ stats: {} }] });
  assert.match(ans, /no standing DC/);
});

// ── End to end: the live resolver answers instead of deflecting ──
test('U189: playerMove answers an own-number ask out of combat', () => {
  const byId = loadPacks();
  const w = beginAdventure(newWorld({ seed: 'glass-harbor', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  const out = playerMove(w, byId, "Pull up my character sheet — what's my Insight modifier? I need a number").output;
  const narr = String(out?.narration || '');
  assert.match(narr, /Insight modifier is [+-]\d/, `answered with a number, got: ${narr}`);
});
