import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Rung-1 gate 2026-06-18 — stat synonym + HP pipeline (H-17, H-18).
// The stat-answerer must:
//   (a) "What is my Strength?" → fires, returns MIGHT value
//   (b) "What's my STR, DEX, CON, INT, WIS, CHA?" → all six returned in IE terms
//   (c) "What are my stats and how many hit points do I have?" → stats + HP; no formula
//   (d) Control: "I use my Strength to push the boulder" → stat-answerer does NOT fire

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function world() {
  const p = packs();
  const w = beginAdventure(newWorld({ seed: 'stonewatch-hollow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), p).world;
  // Pin stats so assertions on specific values are stable
  w.party[0].stats = { MIGHT: 12, AGILITY: 9, WITS: 13, GRIT: 9, CHARM: 11 };
  return { w, p };
}

// ── (a) Single D&D synonym ───────────────────────────────────────────────────

test('U181-01: "What is my Strength?" is detected as a meta-question', () => {
  assert.ok(isMetaQuestion('What is my Strength?'), '"Strength" synonym must trigger meta-question gate');
});

test('U181-02: "What is my Strength?" returns MIGHT value', () => {
  const { w } = world();
  const ans = handleMetaQuestion('What is my Strength?', w);
  assert.ok(ans, 'must return a non-null answer');
  assert.match(ans, /MIGHT/, 'answer must name MIGHT');
  assert.match(ans, /12/, 'answer must include the MIGHT score (12)');
});

test('U181-03: "STR" abbreviation is detected as a meta-question', () => {
  assert.ok(isMetaQuestion("What's my STR?"), '"STR" abbreviation must trigger meta-question gate');
});

test('U181-04: "STR" resolves to MIGHT', () => {
  const { w } = world();
  const ans = handleMetaQuestion("What's my STR?", w);
  assert.ok(ans, 'must return a non-null answer');
  assert.match(ans, /MIGHT/, '"STR" must resolve to MIGHT');
});

test('U181-05: "DEX" abbreviation resolves to AGILITY', () => {
  const { w } = world();
  assert.ok(isMetaQuestion("What's my DEX?"));
  const ans = handleMetaQuestion("What's my DEX?", w);
  assert.match(ans, /AGILITY/, '"DEX" must resolve to AGILITY');
});

// ── (b) Multiple D&D synonym names in one query ───────────────────────────────

test('U181-10: "What\'s my STR, DEX, CON, INT, WIS, CHA?" is detected as meta-question', () => {
  assert.ok(isMetaQuestion("What's my STR, DEX, CON, INT, WIS, CHA?"), 'full abbreviation list must be a meta-question');
});

test('U181-11: "What\'s my STR, DEX, CON, INT, WIS, CHA?" returns all five IE stat names', () => {
  const { w } = world();
  const ans = handleMetaQuestion("What's my STR, DEX, CON, INT, WIS, CHA?", w);
  assert.ok(ans, 'must return an answer');
  assert.match(ans, /MIGHT/, 'must include MIGHT (STR)');
  assert.match(ans, /AGILITY/, 'must include AGILITY (DEX)');
  assert.match(ans, /WITS/, 'must include WITS (INT/WIS)');
  assert.match(ans, /GRIT/, 'must include GRIT (CON)');
  assert.match(ans, /CHARM/, 'must include CHARM (CHA)');
});

test('U181-12: full D&D long names request returns all five IE stat names', () => {
  const { w } = world();
  const q = 'What\'s my Strength, Dexterity, Constitution, Intelligence, Wisdom, and Charisma?';
  assert.ok(isMetaQuestion(q), 'long D&D stat list must be a meta-question');
  const ans = handleMetaQuestion(q, w);
  assert.match(ans, /MIGHT/, 'must include MIGHT');
  assert.match(ans, /AGILITY/, 'must include AGILITY');
  assert.match(ans, /GRIT/, 'must include GRIT');
  assert.match(ans, /CHARM/, 'must include CHARM');
});

test('U181-13: full stat list query includes HP in escape mode', () => {
  const { w } = world();
  const ans = handleMetaQuestion("What's my STR, DEX, CON, INT, WIS, CHA?", w);
  // In escape mode, HP must be included when asking for the full stat block
  assert.match(ans, /[Hh]it\s+points?|HP/i, 'must include HP in full stat-list response');
});

// ── (c) Full stat block + HP, no formula ────────────────────────────────────

test('U181-20: "What are my stats and how many hit points do I have?" is a meta-question', () => {
  assert.ok(isMetaQuestion('What are my stats and how many hit points do I have?'));
});

test('U181-21: "What are my stats and how many hit points do I have?" returns stats + HP', () => {
  const { w } = world();
  const ans = handleMetaQuestion('What are my stats and how many hit points do I have?', w);
  assert.ok(ans, 'must return an answer');
  assert.match(ans, /MIGHT|AGILITY|WITS|GRIT|CHARM/, 'answer must include stat names');
  assert.match(ans, /[Hh]it\s+points?|HP/i, 'answer must include HP');
});

test('U181-22: stats + HP answer does NOT include formula text', () => {
  const { w } = world();
  const ans = handleMetaQuestion('What are my stats and how many hit points do I have?', w);
  // The formula "(score − 10) ÷ 2, rounded down" is a system artifact — must not appear
  assert.doesNotMatch(ans, /score\s*[−-]\s*10/i, 'answer must not expose the modifier formula');
  assert.doesNotMatch(ans, /÷\s*2/i, 'answer must not expose division operator');
});

test('U181-23: full stat + HP query produces no dice roll via playerMove', () => {
  const { w, p } = world();
  const { output } = playerMove(w, p, 'What are my stats and how many hit points do I have?');
  assert.doesNotMatch(output.mechanics || '', /roll:/i, 'must not produce a dice roll');
  assert.match(output.narration, /MIGHT|AGILITY|WITS|GRIT|CHARM/, 'narration must contain stat names');
});

// ── (d) Control: action with stat name must NOT hijack to stat-answerer ─────

test('U181-30: "I use my Strength to push the boulder" is NOT a meta-question', () => {
  assert.ok(!isMetaQuestion('I use my Strength to push the boulder'),
    '"I use my Strength to push the boulder" is an action, not a stat query');
});

test('U181-31: "I swing with all my Strength" is NOT a meta-question', () => {
  assert.ok(!isMetaQuestion('I swing with all my Strength'),
    '"I swing with all my Strength" is an action, not a stat query');
});

test('U181-32: "I rely on my CON to resist the poison" is NOT a meta-question', () => {
  // This should NOT fire the stat-answerer — "I rely on my X to do Y" is action framing
  // META_STAT_SYNONYM requires "what's my X" or "give me my X" prefix
  assert.ok(!isMetaQuestion('I rely on my CON to resist the poison'),
    'action-framed stat reference must not trigger stat-answerer');
});
