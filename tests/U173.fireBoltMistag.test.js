import test from 'node:test';
import assert from 'node:assert/strict';

import { parseEscapeAction } from '../engine/combat/escapeCombat.js';

// Rung-1 gate 2026-06-18 — mechanic-type mistag (3 HARD: H-14, H-16, glass-harbor/chaos).
// Declared melee/improvised/thrown attacks that MENTION fire must route to the
// physical/strike path, not auto-cast Fire Bolt. Fire Bolt fires only on
// explicit cast intent. Prior art: commit 319d23b.

// ── Improvised fire actions → strike (NOT firebolt) ─────────────────────────

test('U173-01: "grab flaming thatch and press into oil" → strike', () => {
  const { verb } = parseEscapeAction('I grab a fistful of flaming thatch and press it into the oil slick.');
  assert.equal(verb, 'strike', '"flaming thatch" improvised action must route to strike, not firebolt');
});

test('U173-02: "why won\'t anything burn?" → strike (question about fire, not a cast)', () => {
  const { verb } = parseEscapeAction("Why won't anything burn?");
  assert.equal(verb, 'strike', '"burn" in a question must not trigger Fire Bolt');
});

test('U173-03: "drag body into oil and torch it" → strike', () => {
  const { verb } = parseEscapeAction('I drag his body into the oil and torch it.');
  assert.equal(verb, 'strike', '"torch it" is physical, not a Fire Bolt cast');
});

test('U173-04: "I throw the torch at him" → strike', () => {
  const { verb } = parseEscapeAction('I throw the torch at him.');
  assert.equal(verb, 'strike', '"throw the torch" must route physical, not firebolt');
});

test('U173-05: "out of fire, I draw my blade and slash" → strike', () => {
  // "fire" standalone no longer routes to firebolt (was line 679, now removed)
  const { verb } = parseEscapeAction('Out of fire, are they? I draw my blade and slash the Coral Sentinel across the throat.');
  assert.equal(verb, 'strike', 'standalone "fire" in context of melee action must route to strike');
});

test('U173-06: "set fire to the curtains" → strike (physical arson)', () => {
  const { verb } = parseEscapeAction('I set fire to the curtains.');
  assert.equal(verb, 'strike', '"set fire to" is physical, not a cantrip cast');
});

// ── Explicit cast intent → firebolt (must still work) ───────────────────────

test('U173-10: "fire bolt" → firebolt', () => {
  assert.equal(parseEscapeAction('fire bolt').verb, 'firebolt', '"fire bolt" must still route to firebolt');
});

test('U173-11: "cast fire bolt at the sentinel" → firebolt', () => {
  assert.equal(parseEscapeAction('cast fire bolt at the sentinel').verb, 'firebolt', '"cast fire bolt" must route to firebolt');
});

test('U173-12: "firebolt" (one word) → firebolt', () => {
  assert.equal(parseEscapeAction('firebolt').verb, 'firebolt', 'single-word "firebolt" must route to firebolt');
});

test('U173-13: "cast at it" → firebolt (generic cast)', () => {
  assert.equal(parseEscapeAction('cast at it').verb, 'firebolt', '"cast at it" must still fire the cantrip');
});

test('U173-14: "bolt of fire" → firebolt (bolt is unambiguous)', () => {
  assert.equal(parseEscapeAction('I fire a bolt of fire at the enemy').verb, 'firebolt', '"bolt" should still route to firebolt');
});

// ── Regression: other verbs must not be disturbed ───────────────────────────

test('U173-20: "strike" → strike', () => {
  assert.equal(parseEscapeAction('I strike').verb, 'strike');
});

test('U173-21: "take cover" → cover', () => {
  assert.equal(parseEscapeAction('I take cover behind the pillar').verb, 'cover');
});

test('U173-22: "parley" → parley/persuade', () => {
  assert.equal(parseEscapeAction('I parley with them').verb, 'parley');
});

test('U173-23: "rage" → rage', () => {
  assert.equal(parseEscapeAction('I rage').verb, 'rage');
});

test('U173-24: "fireball" → fireball (slot spell, not cantrip)', () => {
  assert.equal(parseEscapeAction('fireball').verb, 'fireball');
});
