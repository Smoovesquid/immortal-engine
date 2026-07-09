// U667 — DM-GATE-1d B3: a continuity challenge is answered from canon — never
// re-executed, never retconned (Opus gate 2026-07-07, rules-lawyer t7 +
// lore-hound t9 "has always burned" gaslight; re-proven LLM-off on b144: the
// deterministic route RE-LIGHTS the lantern instead — "The oil lantern catches").
//
// Tim's hard instruction: "B3 must never re-execute the lighting action. It
// answers/reconciles from canon only." Two canon cases:
//   WARM — the player DID light it (the timeline recorded the act): cite it.
//   COLD — nothing in canon lit it: concede honestly ("You're right — nothing
//   lit it"), never invent a history, never mutate state to cover the seam.
// Both cases: the challenge turn changes NO furniture state (worldly no-op).

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

function nodeFurniture(w) {
  const nid = String(w.map.currentNodeId);
  const node = (w.map.nodes || []).find(n => n && String(n.id) === nid);
  return Array.isArray(node?.furniture) ? node.furniture : [];
}

const RE_EXECUTE_SHAPE = /lantern catches|warm light spreads/i;
const RETCON_SHAPE = /always burned|has always|lit before you arrived/i;

test('U667 WARM: after the player lit it, the challenge cites the recorded act — no re-execution, no state change', () => {
  let w = boot();
  w = playerMove(w, PACKS, 'I take the candle stub and light it with the oil lantern.').world;

  const before = JSON.stringify(nodeFurniture(w));
  const r = playerMove(w, PACKS, 'Wait — the lantern was cold and unlit when I woke. How did I light the candle off an unlit lantern?');
  const narr = String(r.output?.narration || '');

  assert.doesNotMatch(narr, RE_EXECUTE_SHAPE, 'the challenge must not run the lighting again');
  assert.doesNotMatch(narr, RETCON_SHAPE, 'no invented history');
  assert.match(narr, /you lit|you struck|your own hand|yourself/i,
    `canon recorded the player's act — the answer cites it (got: ${narr.slice(0, 140)})`);
  assert.equal(JSON.stringify(nodeFurniture(r.world)), before,
    'a continuity question is a worldly no-op — no furniture state changes');
});

test('U667 WARM: the "when did I light that lantern" phrasing reconciles the same way', () => {
  let w = boot();
  w = playerMove(w, PACKS, 'I take the candle stub and light it with the oil lantern.').world;

  const before = JSON.stringify(nodeFurniture(w));
  const r = playerMove(w, PACKS, 'When did I light that lantern? A moment ago you said it sat unlit — I never struck it.');
  const narr = String(r.output?.narration || '');

  assert.doesNotMatch(narr, RE_EXECUTE_SHAPE);
  assert.doesNotMatch(narr, RETCON_SHAPE);
  assert.match(narr, /you lit|you struck|candle|yourself/i);
  assert.equal(JSON.stringify(nodeFurniture(r.world)), before);
});

test('U667 COLD: with no lighting in canon, the DM concedes honestly — never invents, never mutates', () => {
  const w = boot(); // nothing has been lit
  const before = JSON.stringify(nodeFurniture(w));
  const r = playerMove(w, PACKS, 'When did I light that lantern? You said it sat unlit — I never struck it.');
  const narr = String(r.output?.narration || '');

  assert.doesNotMatch(narr, RE_EXECUTE_SHAPE, 'the cold challenge must not light the lantern');
  assert.doesNotMatch(narr, RETCON_SHAPE, 'no gaslight');
  assert.match(narr, /you'?re right|no one lit|nothing lit|unlit|never lit/i,
    `the honest concession (got: ${narr.slice(0, 140)})`);
  assert.equal(JSON.stringify(nodeFurniture(r.world)), before, 'state untouched');
});

test('U667: a genuine lighting command still lights — the reconcile gate is question-scoped', () => {
  const w = boot();
  const r = playerMove(w, PACKS, 'I light the oil lantern.');
  assert.match(String(r.output?.narration || ''), /catches|flame|light/i, 'real physics still runs');
  const lantern = nodeFurniture(r.world).find(f => /lantern/i.test(String(f.name)));
  assert.equal(String(lantern?.state || ''), 'lit', 'the declarative act still mutates state');
});
