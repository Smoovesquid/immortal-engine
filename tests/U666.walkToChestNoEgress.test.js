// U666 — DM-GATE-1d B2: walking to a named present OBJECT is contact, never egress
// (Opus gate 2026-07-07, rules-lawyer t4; re-proven LLM-off on b144).
//
// "I walk to the iron-bound chest and try to open it. What's inside?" — the interior
// movement parser claimed "walk to the chest" as a room move and LEAKED THROUGH
// EGRESS: "You step out into the open air. You enter the structure interior." The
// player was teleported out and back in; the chest was never touched. Movement must
// yield to a named present object — the turn belongs to the object-interaction lane
// (open → container reveal), the same law DM-GATE-1a-R1 set for attack verbs.
//
// Positive controls pin that real movement still moves.

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

const CHEST_TURN = "Twice now you've ignored the mirror. Fine — I walk to the iron-bound chest and try to open it. What's inside?";

test('U666: walking to the iron-bound chest does not leak through egress — position is unchanged', () => {
  const w0 = boot();
  const nodeBefore = String(w0.map.currentNodeId);
  const roomBefore = String(w0.scene?.interior?.roomId || '');
  assert.ok(roomBefore, 'tallow wakes inside a room (precondition)');

  const r = playerMove(w0, PACKS, CHEST_TURN);

  assert.equal(String(r.world.map.currentNodeId), nodeBefore, 'no node move');
  assert.equal(String(r.world.scene?.interior?.roomId || ''), roomBefore,
    'still in the wake room — a walk to furniture is contact, not a room transition');
  assert.doesNotMatch(String(r.output?.narration || ''), /open air|You enter the structure/i,
    'the egress/enter pair must not narrate');
});

test('U666: the turn answers from the chest — the container lane OPENS it and reveals what\'s inside', () => {
  const r = playerMove(boot(), PACKS, CHEST_TURN);
  const narr = String(r.output?.narration || '');

  assert.match(narr, /chest/i, `the narration resolves against the chest — got: ${narr.slice(0, 140)}`);
  assert.match(narr, /Inside:|stands open|lift the lid/i,
    `the chest is actually OPENED and its contents revealed (an examine is not an answer) — got: ${narr.slice(0, 160)}`);
  assert.match(String(r.output?.mechanics || ''), /container:open|auto-success/i,
    'the container lane owns the mechanics line');
});

test('U666: real movement still moves — the yield is object-scoped, not a movement nerf', () => {
  const w0 = boot();
  const r1 = playerMove(w0, PACKS, 'I step outside.');
  assert.equal(r1.world.scene?.interior ?? null, null, 'a genuine exit still exits');

  const r2 = playerMove(r1.world, PACKS, 'I go inside.');
  assert.ok(r2.world.scene?.interior, 'a genuine enter still enters');
});
