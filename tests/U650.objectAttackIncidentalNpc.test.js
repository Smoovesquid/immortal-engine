// U650 — DM-GATE-1a-R1: an object attack that only INCIDENTALLY mentions a present
// NPC ("attack the chest while the bandit watches") must resolve as object damage-state,
// not start combat against that NPC. A real NPC target still starts combat.
//
// Regression: with a present hostile NPC + present furniture, the NPC-combat detectors
// matched the incidentally-named NPC anywhere in the utterance and stole the turn.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove, detectObjectAttackIntent } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

// The tallow wake interior has BOTH a present furniture piece (iron-bound chest) and a
// present hostile NPC (Ashblade, role bandit) — exactly the collision this packet fixes.
function boot() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

const OBJECT_INCIDENTAL = [
  'I attack the iron-bound chest while the bandit watches.',
  'I attack the iron-bound chest, ignoring the bandit.',
  'I hit the iron-bound chest with my Worn Blade, not Ashblade. Does it take damage?',
];
const REAL_NPC = [
  'I attack Ashblade with my Worn Blade. What is my attack roll?',
  'I attack the bandit.',
  'I hit Ashblade.',
];

test('U650-01: object attack with an incidental NPC mention does NOT start combat — routes to object damage-state', () => {
  for (const text of OBJECT_INCIDENTAL) {
    const w = boot();
    assert.equal(detectObjectAttackIntent(w, text), true, `object-primary target detected: ${text}`);
    const r = playerMove(w, PACKS, text);
    assert.equal(r.world.combat?.active ?? false, false, `no combat started: ${text}`);
    assert.equal((r.world.combat?.enemies || []).length, 0, `no enemy minted: ${text}`);
    assert.match(String(r.output?.mechanics || ''), /approach:force/i, `resolves through the object/force path: ${text}`);
    assert.doesNotMatch(String(r.output?.narration || ''), /\bAshblade\b|swing your worn blade at/i, `narration hits the object, not the NPC: ${text}`);
    assert.match(String(r.output?.narration || ''), /chest/i, `narration resolves against the chest: ${text}`);
  }
});

test('U650-02: a real NPC attack still starts combat (incidental-clause fix does not disarm NPC combat)', () => {
  for (const text of REAL_NPC) {
    const w = boot();
    assert.equal(detectObjectAttackIntent(w, text), false, `NPC-primary target is not an object attack: ${text}`);
    const r = playerMove(w, PACKS, text);
    assert.equal(r.world.combat?.active, true, `combat starts against the NPC: ${text}`);
  }
});
