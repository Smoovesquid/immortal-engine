// U313 — DLG-1: a direct NPC-addressed question answers in voice on dialogue enter.
//
// Failure mode (2026-07-02 re-gate): "Who are you? Do you live here?" to Elske
// routed to [dialogue enter | Elske] but the NPC just turned and waited — a direct
// question got no answer. Root: the direct-address guard in playloop.js returned
// the stock "stops and turns — waiting" line unconditionally.
//
// Fix: when directQuestionIntent returns kind:'npc-addressed', the first line is
// the NPC's real name+role (for identity) or a residence answer (for "do you live
// here?"), or an in-voice decline. Acquaintance questions ("do I know you?",
// "have we met?") get a self-introduction. The "stops and turns — waiting" line
// is retired for all isDirectAddressIntent cases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { playerMove } from '../engine/playloop.js';
import { FIXTURES, PACKS } from '../scripts/convergence/fixtures.mjs';

function surface(result) {
  return `${result.output?.narration || ''} ${result.output?.mechanics || ''}`.trim();
}

function makeWorld() {
  return FIXTURES.village_baker();
}

// ── Identity: "who are you?" → NPC's name and role in first line ─────────────

test('U313-ID1: "who are you?" delivers the NPC\'s name in the first line', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'who are you?'));
  assert.match(s, /Mira(?:\s+Hearth)?/i,
    '"who are you?" must include the NPC\'s name (Mira Hearth) in the response');
  assert.doesNotMatch(s, /stops and turns.*waiting/i,
    '"who are you?" must not produce the silent enter-and-wait line');
});

test('U313-ID2: "who are you?" also enters dialogue', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'who are you?'));
  assert.match(s, /dialogue enter/i,
    '"who are you?" must still enter dialogue');
});

test('U313-ID3: identity questions answer in voice (no silent wait)', () => {
  const w = makeWorld();
  for (const q of [
    'who are you?',
    "sorry, I didn't catch that — who are you?",
    "what's your name?",
  ]) {
    const s = surface(playerMove(w, PACKS, q));
    assert.doesNotMatch(s, /stops and turns.*waiting/i,
      `"${q}" must not produce the silent enter-and-wait line`);
    assert.match(s, /dialogue enter/i, `"${q}" must enter dialogue`);
  }
});

// ── Compound: "Who are you? Do you live here?" → answers both ────────────────

test('U313-CP1: compound identity+residence question answers in voice', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'Who are you? Do you live here?'));
  assert.match(s, /Mira(?:\s+Hearth)?/i,
    'compound query must include the NPC\'s name');
  assert.doesNotMatch(s, /stops and turns.*waiting/i,
    'compound query must not silent-wait');
  assert.match(s, /dialogue enter/i, 'compound query must enter dialogue');
});

// ── Residence: "do you live here?" → role-based answer ───────────────────────

test('U313-RS1: "do you live here?" does not produce silent-wait narration', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'do you live here?'));
  assert.doesNotMatch(s, /stops and turns.*waiting/i,
    '"do you live here?" must not produce the silent enter-and-wait line');
});

test('U313-RS2: "do you work here?" does not silent-wait', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'do you work here?'));
  assert.doesNotMatch(s, /stops and turns.*waiting/i,
    '"do you work here?" must not silent-wait');
});

// ── Acquaintance: "do I know you?", "have we met?" → self-introduction ───────

test('U313-AQ1: "do I know you?" does not silent-wait', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'do I know you?'));
  assert.doesNotMatch(s, /stops and turns.*waiting/i,
    '"do I know you?" must not produce the silent enter-and-wait line');
  assert.match(s, /Mira(?:\s+Hearth)?/i,
    '"do I know you?" should include the NPC\'s name as part of self-introduction');
});

test('U313-AQ2: "have we met?" does not silent-wait', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'have we met?'));
  assert.doesNotMatch(s, /stops and turns.*waiting/i,
    '"have we met?" must not produce the silent enter-and-wait line');
});

// ── Hide/decline: unanswerable NPC-addressed question declines in voice ───────

test('U313-DC1: an NPC-addressed question with no answer declines in voice', () => {
  const w = makeWorld();
  // "do you have any enemies?" is npc-addressed (second-person "you") but
  // commonKnowledgeAnswer returns null — should produce a voice decline, not silent-wait.
  const s = surface(playerMove(w, PACKS, 'were you born here?'));
  assert.doesNotMatch(s, /stops and turns.*waiting/i,
    'an unanswerable direct question must not produce the silent-wait line');
  assert.doesNotMatch(s, /\[roll:/i, 'must not roll a d20');
});

// ── Diverge: bare greetings still greet; actions still act ───────────────────

test('U313-DV1: "hi" (bare greeting) does not roll', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'hi'));
  assert.doesNotMatch(s, /\[roll:/i, '"hi" must not roll a d20');
});

test('U313-DV2: "I attack Mira" is an action, not an NPC-addressed question', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'I attack Mira'));
  assert.doesNotMatch(s, /stops and turns.*waiting/i,
    'a declared action must not produce the silent-wait greeting');
});

test('U313-DV3: "who am I?" is self-identity, not an NPC-addressed question', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'who am I?'));
  assert.doesNotMatch(s, /\[dialogue enter/i,
    '"who am I?" is self-identity — must not enter dialogue');
});
