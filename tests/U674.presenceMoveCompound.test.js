// U674 — DM-GATE-1e R4: a presence+move compound answers the PRESENCE half —
// it never leaks into egress/travel-to-nowhere and never silently drops the
// question for a room move (Opus re-gate 2026-07-09, newbie: "is there anyone
// else around I could ask? Maybe I should head to the front." → "You step out
// into the open air. You know of no such place hereabouts"; the deterministic
// floor variant moved rooms and answered nothing).
//
// The standalone version of this exact question already passes — the sink
// exists; the compound has to reach it. Controls: a bare move still moves, and
// the U235 who-guard shape ("head outside… who do I see?") is untouched.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function boot() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

const GATE_TURN = 'Alright, well, is there anyone else around I could ask? Maybe I should head to the front.';
const LEAK_SHAPES = /no such place hereabouts|you know of no such place/i;

test('U674: the verbatim compound answers WHO is around — no egress leak, no silent drop', () => {
  const w = boot();
  const r = playerMove(w, PACKS, GATE_TURN);
  const narr = String(r.output?.narration || '');

  assert.doesNotMatch(narr, LEAK_SHAPES, 'never travel-to-nowhere');
  // The presence half is ANSWERED: either real people are named, or the honest
  // "no one else in here / folk are outside" shape — not a bare room move.
  assert.match(narr, /Elske|Dalla|Asha|no one else|nobody else|folk|anyone about|outside you'?d find/i,
    `the presence question is answered (got: ${narr.slice(0, 160)})`);
});

test('U674: control — a bare move to the front still moves', () => {
  const w = boot();
  const r = playerMove(w, PACKS, 'I head to the front room.');
  assert.doesNotMatch(String(r.output?.narration || ''), LEAK_SHAPES);
  assert.match(String(r.output?.narration || ''), /hearth|front|room|step/i, 'movement still works');
});

test('U674: control — the standalone presence question keeps passing', () => {
  const w = boot();
  const r = playerMove(w, PACKS, 'Is there anyone else around I could ask?');
  assert.match(String(r.output?.narration || ''), /Elske|Dalla|Asha|no one else|nobody|folk|outside/i);
});
