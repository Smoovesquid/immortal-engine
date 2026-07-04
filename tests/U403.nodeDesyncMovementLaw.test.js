// U403–U406 — NODE-DESYNC-1: THE MOVEMENT LAW enforcement.
//
// The live bug (v0.28.9, pre-rolled Bryn Holt slice boot): saying "go to the hearth
// room" while inside the Aldermere cottage SILENTLY flipped map.currentNodeId
// n0 (Aldermere) -> n1 (The Greenwood) while scene.interior stayed the cottage —
// and narrated "It falls short here in The Greenwood, and you're left where you
// started." (two lies in one line). From the flip onward every presence read came
// back empty (roster keys off the current node) — the ghost-town signature.
//
// THE LAW (Tim, 2026-07-04): self-powered movement is <= 6 cells / 30 ft per turn and
// can NEVER change your node. A movement command must be structurally unable to reach
// node travel. Node-scale travel survives only as the explicit journey verb (outdoors).
//
// U403 — "go to the hearth room" (indoors): node UNCHANGED, resolves interior-side.
// U404 — "walk out to the hearth room" (trivial-prefixed): moves interior-side, no
//         node change, and does NOT get eaten as a trivial auto-success.
// U405 — the invariant THROWS on a hand-built desynced world; outdoor "go to the
//         Greenwood" still routes to the journey verb (a legitimate node change).
// U406 — ensureWorld REPAIRS a legacy desynced save without throwing.
//
// Pure, LLM-off (deterministic). Boots the exact live slice via the pre-rolled hero.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld, ensureWorld } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadPacks() {
  const packsDir = path.join(ROOT, 'packs');
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf-8')));
  const out = {};
  for (const p of manifest.packs) out[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(ROOT, p.path), 'utf-8')));
  return out;
}
const PACKS = loadPacks();

// The exact live boot: pre-rolled Bryn Holt into the Aldermere slice. The boot drops
// the player INSIDE the cottage (scene.interior set at the n0 structure).
function bootIndoors() {
  const pc = buildPreRolledCharacter({ id: 'bryn' });
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const w1 = ensureWorld({ ...w0, party: [pc] });
  return beginAdventure(w1, PACKS).world;
}

function structureNodeOf(world) {
  const it = world.scene?.interior;
  if (!it) return null;
  const st = world.structures?.byId?.[String(it.structureKey || '')];
  return st ? String(st.nodeId || '') : null;
}

test('U403: "go to the hearth room" indoors NEVER changes the node — it resolves interior-side', () => {
  const w = bootIndoors();
  assert.ok(w.scene?.interior, 'boot is indoors (the live repro precondition)');
  const nodeBefore = String(w.map.currentNodeId);
  // The interior structure sits at the current node (a valid indoor state).
  assert.equal(structureNodeOf(w), nodeBefore, 'interior structure is at the current node');

  const r = playerMove(w, PACKS, 'go to the hearth room');
  const nodeAfter = String(r.world.map.currentNodeId);

  // THE LAW: node is structurally unchanged by a movement command.
  assert.equal(nodeAfter, nodeBefore, `node must not change on an interior room move (was ${nodeBefore}, got ${nodeAfter})`);
  // Still indoors, still consistent (no desync).
  assert.ok(r.world.scene?.interior, 'still indoors after the move');
  assert.equal(structureNodeOf(r.world), nodeAfter, 'interior structure still matches the current node (no desync)');
  // Resolved interior-side (a real room move, honest narration), NOT the old
  // "falls short here in The Greenwood" node-travel failure.
  assert.match(r.output.narration, /step through into the hearth room/i, `must move into the hearth room: ${r.output.narration}`);
  assert.doesNotMatch(r.output.narration, /falls short here|Greenwood|left where you started/i, `no false node-travel narration: ${r.output.narration}`);
  // The mech line must not be a node-travel resolution.
  assert.doesNotMatch(String(r.output.mechanics || ''), /journey|travel \|/i, `must not be node travel: ${r.output.mechanics}`);
});

test('U404: "I get up and walk out to the hearth room" moves interior-side, not eaten as trivial', () => {
  const w = bootIndoors();
  const nodeBefore = String(w.map.currentNodeId);
  const roomBefore = String(w.scene.interior.roomId);

  const r = playerMove(w, PACKS, 'I get up and walk out to the hearth room.');

  // The movement clause is honored — the player actually moved rooms.
  assert.notEqual(String(r.world.scene?.interior?.roomId || ''), roomBefore, 'the room actually changed (movement not dropped)');
  assert.match(r.output.narration, /step through into the hearth room/i, `must move into the hearth room: ${r.output.narration}`);
  // Not swallowed by the trivial-gate auto-success (the INT-4a live failure).
  assert.doesNotMatch(String(r.output.mechanics || ''), /trivial action/i, `must not be a trivial auto-success: ${r.output.mechanics}`);
  assert.doesNotMatch(r.output.narration, /You do so without difficulty/i, `must not be the trivial no-op line: ${r.output.narration}`);
  // Node unchanged, no desync.
  assert.equal(String(r.world.map.currentNodeId), nodeBefore, 'node unchanged');
  assert.equal(structureNodeOf(r.world), String(r.world.map.currentNodeId), 'no desync');
});

test('U405: a hand-built position-desync THROWS; outdoor "go to the Greenwood" still journeys', () => {
  const w = bootIndoors();
  const otherNode = (w.map.nodes || []).map(n => String(n.id)).find(id => id !== String(w.map.currentNodeId));
  assert.ok(otherNode, 'a second node exists in the slice');

  // Hand-build the desync: interior stays the n0 cottage, currentNodeId flipped away.
  // Assert directly on the invariant (ensureWorld would REPAIR it — see U406).
  const desynced = { ...w, map: { ...w.map, currentNodeId: otherNode } };
  assert.throws(
    () => assertWorldInvariants(desynced),
    /scene\.interior structure .* is at node .* but map\.currentNodeId/i,
    'the invariant must reject an interior-at-the-wrong-node desync'
  );

  // The one legitimate node mover — the explicit journey from OUTDOORS — still works.
  let out = playerMove(w, PACKS, 'step back outside').world;
  assert.equal(out.scene?.interior, null, 'outdoors after stepping out');
  const before = String(out.map.currentNodeId);
  const r = playerMove(out, PACKS, 'go to the Greenwood');
  // Journey either arrives or opens a road encounter; either way it is the journey
  // path and the node legitimately advances toward the named far place.
  assert.notEqual(String(r.world.map.currentNodeId), before, 'an explicit outdoor journey does change the node (legitimate)');
  assert.match(String(r.output.mechanics || ''), /journey|encounter|travel/i, `routes to the journey verb: ${r.output.mechanics}`);
});

test('U406: ensureWorld REPAIRS a legacy desynced save (clears the stale interior) without throwing', () => {
  const w = bootIndoors();
  const cottageNode = String(w.map.currentNodeId);
  const otherNode = (w.map.nodes || []).map(n => String(n.id)).find(id => id !== cottageNode);

  // A legacy save already in the desynced state: interior is the n0 cottage,
  // currentNodeId was flipped to another node by the old bug.
  const legacy = { ...w, map: { ...w.map, currentNodeId: otherNode } };

  let repaired;
  assert.doesNotThrow(() => { repaired = ensureWorld(legacy); }, 'a legacy desynced save must not throw on load');
  // Least-destructive repair: the stale interior is cleared, currentNodeId is kept.
  assert.equal(repaired.scene.interior, null, 'the stale interior is cleared');
  assert.equal(String(repaired.map.currentNodeId), otherNode, 'currentNodeId (the load-bearing truth) is preserved');
  // And the repaired world satisfies the invariant (would not throw again).
  assert.doesNotThrow(() => assertWorldInvariants(repaired), 'the repaired world is invariant-clean');

  // A save that is NOT desynced (interior matches node) is left exactly as-is.
  const healthy = ensureWorld(w);
  assert.ok(healthy.scene.interior, 'a healthy indoor save keeps its interior');
  assert.equal(structureNodeOf(healthy), String(healthy.map.currentNodeId), 'healthy save stays consistent');
});
