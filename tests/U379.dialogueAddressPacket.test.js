// U379 — INT-4b: dialogue-address consumes the shared packet (auto-seek-invariant).
//
// Two more of playerMoveCore's directQuestionIntent(text, w) call-sites (~2579
// "daDqKind" — the object-referent guard that keeps "who's this letter from?"
// from being swallowed as a person-address, and ~2594 "dqEnterIntent" — the
// direct-address dialogue-enter guard) re-derived directQuestionIntent(text, w)
// a second time on the exact (text, world) pair playerMoveTraced already
// classified as __dqIntent. Both now consume the shared packet via the same
// `dqIntent !== undefined ? dqIntent : directQuestionIntent(text, w)` pattern
// INT-4a established.
//
// THE HAZARD (why this isn't a copy-paste of INT-4a): both target sites sit
// AFTER the `if (talkRef) { ... }` block, which — for a NAMED target in
// ANOTHER ROOM of the same building — calls autoSeekWithinStructure and
// reassigns `w` (walks the player there) BEFORE attempting beginDialogue.
// If beginDialogue then fell through without returning, a shared dqIntent
// computed against the pre-move world could in principle be stale against
// the post-move world.
//
// The proof (verified by reading the code, not asserted): directQuestionIntent
// reads world state ONLY via world.map.currentNodeId and that node's
// settlement.npcs (plus the raw, never-reassigned `text`). autoSeekWithinStructure
// / moveWithinInterior mutate ONLY w.scene.interior.roomId (+ w.map.currentRoomId/
// currentStructureId + the party entity's position) — never w.map.currentNodeId,
// never any node's settlement.npcs. Both the pre-seek `resolveNpcAtCurrentNode`
// (used to find the seek target) and beginDialogue's OWN internal
// resolveNpcAtCurrentNode call read the identical (currentNodeId, roster) pair,
// so beginDialogue always succeeds whenever the pre-seek resolve succeeded —
// meaning the function returns at the dialogue-enter branch BEFORE reaching
// either target line whenever the seek actually moved `w`. Either way — whether
// the graduated lines are reached with entry-`w` (no seek) or are structurally
// unreachable post-seek (seek always resolves to a return) — the shared packet
// and a fresh recompute are provably identical.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beginAdventure, playerMove } from '../engine/playloop.js';
import { newWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { directQuestionIntent } from '../engine/grace/answerability.js';
import { moveWithinInterior } from '../engine/structures/interiors.js';
import { coLocatePlayerNearNpcInBuilding } from './support/presence.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

const boot = (seed = 'tallow') =>
  beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// A non-interior settlement world (several real NPCs present, no combat, no dialogue) —
// same fixture shape as U378's settlementWorld, used for the plain dialogue-address utterances.
function settlementWorld(seed = 'ashfen-reach') {
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  return { ...w, scene: { ...(w.scene || {}), interior: null, dialogue: null }, combat: { ...(w.combat || {}), active: false } };
}

const surface = (r) => `${r.output?.narration || ''} ${r.output?.mechanics || ''}`.trim();

// OCC-STORY-1: the wake cottage is now empty of strangers by design, so the auto-seek "named target
// elsewhere under the same roof" fixture is built by co-locating the player and a real settlement NPC
// in DIFFERENT rooms of the same materialized building (a constructed, deterministic co-location) —
// the ROM-1 same-structure auto-seek pattern, same as U372-C. Returns { w, target } where target is
// { npc, roomId, structureKey }.
function hazardWorld() {
  const near = coLocatePlayerNearNpcInBuilding(boot());
  if (!near) return null;
  return { w: near.w, target: { npc: near.npc, roomId: near.targetRoomId, structureKey: String(near.w.scene.interior.structureKey || '') } };
}

// ── (a) THE HAZARD — the mandatory auto-seek-invariance proof ───────────────

test('U379-hazard: precondition — a named NPC stands in another room of the player\'s building (auto-seek fixture)', () => {
  const hz = hazardWorld();
  assert.ok(hz && hz.target, 'the co-located fixture must have an auto-seekable same-structure NPC');
});

test('U379-hazard: "talk to <same-structure NPC>" auto-seeks (moves the room) AND resolves via the dialogue-enter return — never reaches the graduated call-sites\' fresh-vs-shared fork on a moved world', () => {
  const hz = hazardWorld();
  assert.ok(hz && hz.target, 'precondition: same-structure target exists');
  const { w, target } = hz;
  const startRoom = String(w.scene.interior.roomId);
  assert.notEqual(target.roomId, startRoom, 'precondition: the target is genuinely in a different room');

  const r = playerMove(w, PACKS, `talk to ${target.npc.name}`);
  // The auto-seek walked the player into the target's room.
  assert.equal(String(r.world.scene?.interior?.roomId || ''), target.roomId, 'auto-seek moved the player token into the target NPC\'s room');
  // Dialogue is now active — proving beginDialogue's own resolve succeeded on the
  // POST-seek world exactly as the PRE-seek resolve did (same currentNodeId, same roster).
  assert.ok(r.world.scene?.dialogue, 'dialogue began — the talkRef block returned before reaching the graduated daDqKind/dqEnterIntent lines this turn');
  assert.match(r.output.narration, /You (?:step|cross) (?:into|through into) the/i, surface(r));
});

test('U379-hazard: byte-identical + deterministic auto-seek-then-dialogue turn across two independent runs', () => {
  const hz1 = hazardWorld();
  const hz2 = hazardWorld();
  assert.equal(hz1.target.npc.name, hz2.target.npc.name, 'same seed must yield the same auto-seek target across independent boots');

  const r1 = playerMove(hz1.w, PACKS, `talk to ${hz1.target.npc.name}`);
  const r2 = playerMove(hz2.w, PACKS, `talk to ${hz2.target.npc.name}`);
  assert.equal(surface(r1), surface(r2), 'identical auto-seek-then-dialogue input must produce identical surface across runs');
  assert.equal(worldHash(r1.world), worldHash(r2.world), 'identical auto-seek-then-dialogue input must produce identical worldHash across runs');
});

// ── (b) the direct invariance proof on directQuestionIntent itself ─────────
//
// Even though the integration turn above never reaches the graduated lines on
// a moved world (beginDialogue always succeeds first), prove the underlying
// packet-sharing safety directly: manually walk the player with
// moveWithinInterior (the same primitive autoSeekWithinStructure uses) and
// show directQuestionIntent(text, w) is IDENTICAL before and after the move,
// for both a rules-shaped utterance and an object-referent utterance (the two
// text shapes the graduated sites care about).

test('U379-hazard: directQuestionIntent(text, w) is invariant across a same-structure room move (the actual mechanism autoSeekWithinStructure uses)', () => {
  const hz = hazardWorld();
  assert.ok(hz && hz.target, 'precondition: same-structure target exists');
  const { w, target } = hz;

  const moved = moveWithinInterior(w, target.roomId);
  assert.equal(String(moved.scene?.interior?.roomId || ''), target.roomId, 'precondition: the move actually changed rooms');
  assert.equal(String(moved.map?.currentNodeId || ''), String(w.map?.currentNodeId || ''), 'precondition: currentNodeId is untouched by the room move');

  for (const text of [
    "who's this letter from?",
    'what class is that spell?',
    `who are you?`,
    `${target.npc.name}, were you born here?`
  ]) {
    const before = directQuestionIntent(text, w);
    const after = directQuestionIntent(text, moved);
    assert.deepEqual(after, before, `directQuestionIntent must be invariant across the room move for "${text}"`);
  }
});

// ── (c) before/after byte-identical on >=3 plain dialogue-address utterances ──

test('U379-a: "who are you?" (unnamed direct address) byte-identical pre/post-refactor', () => {
  const r1 = playerMove(settlementWorld(), PACKS, 'who are you?');
  const r2 = playerMove(settlementWorld(), PACKS, 'who are you?');
  assert.equal(surface(r1), surface(r2), 'identical input must produce identical surface across runs');
  assert.equal(worldHash(r1.world), worldHash(r2.world), 'identical input must produce identical worldHash across runs');
});

test('U379-a: "who\'s this letter from?" (object-referent, must NOT be swallowed as a person-address) byte-identical pre/post-refactor', () => {
  const r1 = playerMove(settlementWorld(), PACKS, "who's this letter from?");
  const r2 = playerMove(settlementWorld(), PACKS, "who's this letter from?");
  assert.equal(surface(r1), surface(r2), 'identical input must produce identical surface across runs');
  assert.equal(worldHash(r1.world), worldHash(r2.world), 'identical input must produce identical worldHash across runs');
});

test('U379-a: "talk to <present NPC>" (dialogue enter) byte-identical pre/post-refactor', () => {
  const w = settlementWorld();
  const node = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
  const npc = (node?.settlement?.npcs || []).find(n => n && !n.hostile);
  assert.ok(npc, 'settlement fixture must have a present, non-hostile NPC');

  const r1 = playerMove(settlementWorld(), PACKS, `talk to ${npc.name}`);
  const r2 = playerMove(settlementWorld(), PACKS, `talk to ${npc.name}`);
  assert.equal(surface(r1), surface(r2), 'identical input must produce identical surface across runs');
  assert.equal(worldHash(r1.world), worldHash(r2.world), 'identical input must produce identical worldHash across runs');
});
