// U253 — D-B4 gate residual (b): the object-presence query ("is there a mirror?").
//
// In the 2026-06-24 Opus gate the Confused-newbie twice asked "is there a mirror
// around here?" and got a roster-list / a generic exits-survey ("Ways lead off
// east and south. What do you do?") — the yes/no was never answered. A real DM
// tracks what's in the room: an honest "no mirror here, but there's a basin"
// beats a navigation prompt, and must never invent an object canon doesn't hold
// (narration != canon).
//
// Fix: inside an interior, an object-presence query is answered from this node's
// furniture — affirm with the real piece if present, honestly decline (grounded
// in what IS there) if absent — before the generic survey claims the turn.
//
// docs/playtests/opus-gate-2026-06-24.md (Confused newbie — DM_TEST_DEADEND ×2).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

// The locked demo region — a Wayfarers' Outpost interior with known furniture
// (straw pallet, oil lantern, iron-bound chest, stone basin), NO mirror.
function world() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } }), packs()).world;
}

// ── (a) the absent object — honest "no", never a navigation bounce ──────────

test('U253-a: "is there a mirror here?" gets an honest no, not an exits-survey', () => {
  const P = packs();
  for (const q of [
    'Is there a mirror around here I could look at?',
    'Is there a mirror anywhere I can find? I really want to see my own face.',
  ]) {
    const { output } = playerMove(world(), P, q);
    assert.match(output.narration, /no mirror here/i, `must answer no mirror: ${q}`);
    // The exact gate bounce shapes must be gone.
    assert.doesNotMatch(output.narration, /Ways lead off/i, 'must not bounce a cardinal-exit recap');
    assert.doesNotMatch(output.narration, /What do you do\?/i, 'must not bounce a navigation prompt');
  }
});

test('U253-a: the honest no is grounded in what IS present (never invents canon)', () => {
  const { output } = playerMove(world(), packs(), 'Is there a mirror around here?');
  // Names real furniture from the node, not an invented object.
  assert.match(output.narration, /What's here is/i, 'pivots to the real furniture');
  assert.match(output.narration, /pallet|lantern|chest|basin/i, 'names an actual furniture piece');
});

// ── (b) the present object — affirm with the real piece ─────────────────────

test('U253-b: "is there a chest here?" affirms the real furniture piece', () => {
  const { output } = playerMove(world(), packs(), 'Is there a chest here?');
  assert.match(output.narration, /yes/i, 'affirms presence');
  assert.match(output.narration, /chest/i, 'names the chest');
});

test('U253-b: "is there a basin around here?" affirms the basin', () => {
  const { output } = playerMove(world(), packs(), 'Is there a basin around here?');
  assert.match(output.narration, /yes/i);
  assert.match(output.narration, /basin/i);
});

// ── (c) guards — exits, people, and generic surveys are unaffected ──────────

test('U253-c: "is there a way out?" is NOT a false "no way out" — stays on the exits path', () => {
  const { output } = playerMove(world(), packs(), 'Is there a way out of here?');
  assert.doesNotMatch(output.narration, /no way here|no way out here/i, 'must not honest-decline an exits query');
});

test('U253-c: "is there anyone here?" still lists the roster, not "no anyone"', () => {
  const { output } = playerMove(world(), packs(), 'Is there anyone here?');
  assert.doesNotMatch(output.narration, /no anyone here|no one here/i, 'people-presence must route to the roster');
  // Real NPCs at the outpost are named.
  assert.match(output.narration, /Elske|Dalla|Asha|representative|innkeeper|guard/i, 'names present NPCs');
});

test('U253-c: a generic "where can I go?" still gets the survey', () => {
  const { output } = playerMove(world(), packs(), 'Where can I go?');
  // Not intercepted as an object-presence query.
  assert.doesNotMatch(output.narration, /no .* here\. What's here is/i, 'must not become an object-presence answer');
});
