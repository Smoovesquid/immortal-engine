// U203 — H-40 number-transparency (post-H-39 Opus gate, Rules Lawyer cluster, 4/7).
//
// A player asking for their OWN number — a skill modifier, a compound
// stats+gear ask, or "give me my numbers ... and my attack bonus" — must get
// real numbers off the sheet, never a raw system artifact (the modifier
// breakpoint table) and never a half-answer that drops half of what was
// asked. Three shapes, grounded in the real failing transcript
// (docs/playtests/opus-gate-2026-06-19-postH39.md):
//
//   (i)   DM_ARTIFACT_LEAK — "...d20 plus my tracking modifier, and tell me
//         what the modifier even is" got the raw breakpoint table + a full
//         stat dump instead of just "tracking is WITS-based, +1".
//   (ii)  CRUNCH_INCONSISTENCY — "what are my actual stats and what weapons
//         am I carrying?" returned the inventory only, dropping stats.
//   (iii) DM_TEST_DEADEND — "give me my numbers ... and my attack bonus with
//         the Worn Blade" got a rules-lecture (MIGHT +1 / AGILITY -1) with no
//         ability scores and no final attack-bonus number.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

// Real escape-mode world (gives a real "Worn Blade" in inventory via the
// hedge-caster kit) with the exact stats from the failing transcript.
function escWorld(seed = 'glass-harbor') {
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), packs()).world;
  w.party[0].stats = { MIGHT: 12, AGILITY: 9, WITS: 13, GRIT: 9, CHARM: 11 };
  return w;
}

// Lightweight unit-level sheet, no inventory — mirrors U189's SHEET fixture.
const SHEET = { party: [{ level: 1, stats: { MIGHT: 12, AGILITY: 9, WITS: 13, GRIT: 9, CHARM: 11 }, foci: [] }] };

// ── (i) DM_ARTIFACT_LEAK — raw modifier-table leak ──────────────────────────

test('U203-i: a tracking-modifier ask is a recognized meta-question', () => {
  const q = 'Roll it fresh in front of me: d20 plus my tracking modifier, and tell me what the modifier even is.';
  assert.ok(isMetaQuestion(q), 'must be recognized as a meta-question');
});

test('U203-i: tracking-modifier ask gets the clean WITS number, never the breakpoint table', () => {
  const q = 'Roll it fresh in front of me: d20 plus my tracking modifier, and tell me what the modifier even is.';
  const ans = handleMetaQuestion(q, SHEET);
  assert.ok(ans, 'must return an answer');
  assert.doesNotMatch(ans, /breakpoint/i, 'must never leak the breakpoint-table system artifact');
  assert.doesNotMatch(ans, /9\s*→|10–11|12–13|14–15/, 'must never leak the raw breakpoint table');
  assert.match(ans, /WITS/, 'must name the governing stat (WITS)');
  assert.match(ans, /\+1\b/, 'must give the real computed modifier (+1)');
});

test('U203-i: a generic "the modifier" formula ask with no named target still answers (no crash, no regression)', () => {
  // Unlike a SKILL-named ask, a truly generic "what's the formula" question
  // has no specific number to single out — the existing full-measures
  // fallback (U172-23) is untouched by this packet.
  const ans = handleMetaQuestion("What's the formula for modifiers?", SHEET);
  assert.ok(ans, 'must return an answer');
});

// ── (ii) CRUNCH_INCONSISTENCY — compound stats+weapons drop ────────────────

test('U203-ii: compound stats+weapons ask is a recognized meta-question', () => {
  const q = 'What are my actual stats and what weapons am I carrying?';
  assert.ok(isMetaQuestion(q), 'must be recognized as a meta-question');
});

test('U203-ii: compound stats+weapons ask answers BOTH halves, not just gear', () => {
  const w = escWorld();
  const ans = handleMetaQuestion('What are my actual stats and what weapons am I carrying?', w);
  assert.ok(ans, 'must return an answer');
  assert.match(ans, /MIGHT\s+12/, 'stat half answered (MIGHT score present)');
  assert.match(ans, /worn blade/i, 'gear half answered (real inventory item present)');
});

// ── (iii) DM_TEST_DEADEND — "give me my numbers" partial ───────────────────

test('U203-iii: "give me my numbers ... and my attack bonus" is a recognized meta-question', () => {
  const q = "Stats — give me my numbers. Strength, Dexterity, whatever system we're using, and my attack bonus with the Worn Blade.";
  assert.ok(isMetaQuestion(q), 'must be recognized as a meta-question');
});

test('U203-iii: "give me my numbers ... and my attack bonus" returns full scores + a final attack-bonus number', () => {
  const w = escWorld();
  const q = "Stats — give me my numbers. Strength, Dexterity, whatever system we're using, and my attack bonus with the Worn Blade.";
  const ans = handleMetaQuestion(q, w);
  assert.ok(ans, 'must return an answer');
  // Full ability scores — not just MIGHT/AGILITY, the whole block.
  assert.match(ans, /MIGHT\s+12/, 'has MIGHT score');
  assert.match(ans, /AGILITY\s+9/, 'has AGILITY score');
  assert.match(ans, /WITS\s+13/, 'has WITS score');
  // A real, FINAL computed attack-bonus number for the named weapon — not
  // just the abstract "add MIGHT or AGILITY" rules-lecture.
  assert.match(ans, /worn blade/i, 'names the weapon');
  assert.match(ans, /attack bonus is [+-]\d/i, 'gives a final computed attack-bonus number');
});

// ── False-positive guards ───────────────────────────────────────────────────

test('U203-guard: a bare single-stat ask still answers just that stat', () => {
  const ans = handleMetaQuestion("what's my Might?", SHEET);
  assert.match(ans, /MIGHT is 12/);
  assert.doesNotMatch(ans, /breakpoint/i);
});

test('U203-guard: a plain action is not intercepted as a meta-question', () => {
  assert.equal(isMetaQuestion('I search the room'), false);
});

test('U203-guard: a bare attack-modifier ask with no weapon named keeps the existing melee/finesse explanation (U189/U190)', () => {
  // No weapon is named and no stats were requested — this exact shape is
  // locked in by U189/U190; H-40 must not regress it.
  const ans = handleMetaQuestion('what is my attack modifier', SHEET);
  assert.match(ans, /MIGHT modifier \(\+1\)/);
  assert.match(ans, /AGILITY \(-1\)/);
});

test('U203-guard: a bare gear-only ask (no stats requested) is unaffected — no unsolicited stat dump', () => {
  const w = escWorld();
  const ans = handleMetaQuestion('What weapons am I carrying?', w);
  assert.match(ans, /worn blade/i);
  assert.doesNotMatch(ans, /MIGHT\s+12/, 'must not dump ability scores when none were asked for');
});
