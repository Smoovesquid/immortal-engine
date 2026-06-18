import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyOffensiveCast } from '../engine/magic/castConsequence.js';

// H-21 gate 2026-06-18 — "dump a torch into the well" must NOT trigger
// cast-consequence (torch as physical noun, not offensive spell).
// The "torch" token in OFFENSIVE_RE is meant for the verb form only.

const nullWorld = { map: { nodes: [] } };

// ── Noun forms — must be non-offensive ──────────────────────────────────────

test('U178-01: "dump a torch into the well near the villager" → not offensive', () => {
  const r = classifyOffensiveCast(nullWorld, 'I dump a torch into the well near the villager');
  assert.equal(r.offensive, false, 'physical torch near NPC must not trigger cast-consequence');
});

test('U178-02: "grab the torch and walk past the guard" → not offensive', () => {
  const r = classifyOffensiveCast(nullWorld, 'I grab the torch and walk past the guard');
  assert.equal(r.offensive, false, '"the torch" is a noun');
});

test('U178-03: "hold my torch up to see the shrine" → not offensive', () => {
  const r = classifyOffensiveCast(nullWorld, 'I hold my torch up to see the shrine');
  assert.equal(r.offensive, false, '"my torch" is a noun');
});

test('U178-04: "throw a torch at the door" → not offensive (physical action, not spell)', () => {
  const r = classifyOffensiveCast(nullWorld, 'I throw a torch at the door');
  assert.equal(r.offensive, false, '"a torch" thrown is physical, not cast-consequence');
});

// ── Verb forms — must still fire as offensive ────────────────────────────────

test('U178-10: "I torch the barn" → offensive, living-world', () => {
  const r = classifyOffensiveCast(nullWorld, 'I torch the barn');
  assert.equal(r.offensive, true, '"torch the barn" is verb → offensive');
  assert.equal(r.target, 'living-world');
});

test('U178-11: "torch every house in the village" → offensive', () => {
  const r = classifyOffensiveCast(nullWorld, 'I torch every house in the village');
  assert.equal(r.offensive, true, 'no article before torch → verb form');
});

// ── Compound: noun torch + other spell — other spell should still fire ───────

test('U178-20: "cast firebolt, drop the torch" → offensive (cast fires HOSTILE_CAST_RE)', () => {
  const r = classifyOffensiveCast(nullWorld, 'I cast firebolt and drop the torch');
  assert.equal(r.offensive, true, 'cast firebolt is still offensive regardless of noun torch');
});

test('U178-21: "produce flame and hurl the torch at the tree" → offensive (flame fires OFFENSIVE_RE)', () => {
  const r = classifyOffensiveCast(nullWorld, 'produce flame and hurl the torch at the tree');
  assert.equal(r.offensive, true, 'produce flame in OFFENSIVE_RE still makes this offensive');
});
