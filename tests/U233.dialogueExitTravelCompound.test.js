// U233 — "leave X and walk to Y" must resolve the TRAVEL, not just the exit.
// Gate-14 full-panel (Rules-Lawyer t11): "I leave Corwin and walk to the guard
// post..." returned a bare [dialogue exit | turns | topics] stub — the dialogue
// ended but the trailing travel/seek clause was silently DROPPED. THE DM TEST:
// a compound "leave X AND <travel/seek Y>" ends the conversation AND then
// resolves the move; it does not stop at "you step away."
//
// The fix: isDialogueExitIntent still matches "leave …", but when the exit also
// carries a travel clause (exitCarriesTravel), the explicit-exit early-return
// cedes to the breaking-intent path — which closes the dialogue out loud and
// re-resolves the residual travel through the normal movement system. A bare
// goodbye with no destination stays a plain [dialogue exit].

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

// One world, one open conversation, reused across cases (playerMove is pure).
function openDialogue(seed = 'u233') {
  const w0 = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u233-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  const outside = playerMove(w0, packs, 'go outside').world;
  const here = outside.map.nodes.find(n => n.id === outside.map.currentNodeId);
  const npc = (here?.settlement?.npcs || []).find(n => n && n.name && !n.hostile);
  assert.ok(npc, 'an NPC lives at the start node');
  const opened = playerMove(outside, packs, `talk to ${npc.name}`);
  assert.ok(opened.world.scene?.dialogue, 'dialogue opens');
  return { base: opened.world, npcName: npc.name };
}
const { base, npcName } = openDialogue();

// ── Positives: the compound ends the dialogue AND resolves the move ──────────

test('U233-01: "leave X and walk to Y" exits the dialogue AND resolves the travel', () => {
  const r = playerMove(base, packs, `I leave ${npcName} and walk to the guard post to find that guard.`);
  // The ORIGINAL conversation closes out loud (its exit is canon). The residual
  // "find that guard" may then resolve into a grounded affordance — moving, or
  // approaching a guard who is actually present — but it must NOT stop at the
  // bare exit, dropping the travel/seek clause.
  assert.match(r.output.narration, new RegExp(`You step away from ${npcName}`), 'the exit is narrated out loud');
  assert.ok(r.world.timeline.some(e => e.kind === 'dialogueExit'), 'the exit is canon');
  assert.doesNotMatch(r.output.mechanics, /dialogue exit \|/, 'not a bare dialogue-exit stub — the turn carries the residual');
  assert.ok(
    r.output.narration.length > `Wizard: You step away from ${npcName}.`.length,
    'the residual travel/seek is resolved, not dropped'
  );
  // If a fresh dialogue opened, it is with a DIFFERENT NPC (the original ended).
  if (r.world.scene?.dialogue) {
    assert.notEqual(r.world.scene.dialogue.npcId, base.scene.dialogue.npcId, 'the original conversation ended');
  }
  assertWorldInvariants(r.world);
});

test('U233-02: "leave the elder and head to the market" — same end-dialogue-then-move', () => {
  const r = playerMove(base, packs, 'leave the elder and head to the market');
  assert.ok(!r.world.scene?.dialogue, 'the conversation is over');
  assert.match(r.output.narration, new RegExp(`You step away from ${npcName}`), 'the exit is narrated');
  assert.doesNotMatch(r.output.mechanics, /dialogue exit/, 'not a bare dialogue-exit stub');
  assert.ok(
    r.output.narration.length > `Wizard: You step away from ${npcName}.`.length,
    'the move is resolved, not dropped'
  );
  assertWorldInvariants(r.world);
});

test('U233-03: determinism — same compound, same narration', () => {
  const a = playerMove(base, packs, `I leave ${npcName} and walk to the guard post.`);
  const b = playerMove(base, packs, `I leave ${npcName} and walk to the guard post.`);
  assert.equal(a.output.narration, b.output.narration, 'same words, same resolution');
});

// ── Negatives: a bare exit with no travel clause stays a plain exit ──────────

test('U233-04: bare exits without a travel clause remain [dialogue exit] stubs', () => {
  for (const bye of ['I step away', "I'm done talking", 'goodbye', 'I leave it at that', 'leave me alone']) {
    const r = playerMove(base, packs, bye);
    assert.ok(!r.world.scene?.dialogue, `"${bye}" still exits`);
    assert.match(r.output.mechanics, /dialogue exit/, `"${bye}" is a bare exit, no fabricated travel`);
    assertWorldInvariants(r.world);
  }
});

test('U233-05: an ungrounded destination is handled honestly, never fabricated as a real node', () => {
  const before = base.map.currentNodeId;
  const r = playerMove(base, packs, `I leave ${npcName} and walk to the guard post.`);
  // The guard post is not a node on the map: the engine must NOT invent one.
  const nodeIds = (r.world.map?.nodes || []).map(n => n.id);
  assert.ok(!nodeIds.some(id => /guard.?post/i.test(String(id))), 'no fabricated guard-post node');
  // Honest handling = the existing movement/seek path's behavior. It may approach
  // a guard who is actually present, or move toward a real node, but it never
  // teleports the player into a place that does not exist.
  assert.ok(typeof r.world.map.currentNodeId === 'string', 'world remains coherent');
  void before;
  assertWorldInvariants(r.world);
});
