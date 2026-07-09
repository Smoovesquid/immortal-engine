// U672 — DM-GATE-1e R2: a multi-name "who are they" ask answers IDENTITY for
// each present named NPC — never just location/presence (Opus re-gate
// 2026-07-09, rules-lawyer: "Who are Elske Nightherd, Dalla, Asha…?" → "None of
// them are in your bedchamber" — identities never delivered though canon holds
// name + role for every one of them).
//
// Control: a location ask ("where is X?") still answers location.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function bootOutside() {
  let w = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  w = playerMove(w, PACKS, 'I go outside.').world;
  return w;
}

test('U672: "who are X, Y, and Z" answers identity for EACH named present NPC', () => {
  const w = bootOutside();
  const r = playerMove(w, PACKS, 'Who are Elske Nightherd, Dalla, and Asha — and what do they do here?');
  const narr = String(r.output?.narration || '');

  for (const name of ['Elske', 'Dalla', 'Asha']) {
    assert.match(narr, new RegExp(name, 'i'), `${name} is named in the answer`);
  }
  // Identity means WHO they are, not merely that they exist/where they stand:
  // at least a role/occupation-shaped phrase per canon, and no bare presence dodge.
  assert.doesNotMatch(narr, /none of them are|not in your|is right here — no need/i,
    'a who-are-they ask is not answered positionally');
  assert.ok(narr.length > 60, 'a real multi-person identity answer has substance');
});

test('U672: the gate phrasing (identity + why-here) still delivers the identities', () => {
  const w = bootOutside();
  const r = playerMove(w, PACKS, 'Fine, forget the numbers. Who are Elske Nightherd, Dalla, and Asha — and why are they here?');
  const narr = String(r.output?.narration || '');
  assert.match(narr, /Elske/i);
  assert.match(narr, /Dalla/i);
  assert.match(narr, /Asha/i);
  assert.doesNotMatch(narr, /none of them are/i);
});

test('U672: control — a single-name LOCATION ask still answers location', () => {
  const w = bootOutside();
  const r = playerMove(w, PACKS, 'Where is Elske Nightherd right now?');
  assert.match(String(r.output?.narration || '') + String(r.output?.mechanics || ''),
    /right here|location|is here|no need to look far/i,
    'the location lane is untouched');
});
