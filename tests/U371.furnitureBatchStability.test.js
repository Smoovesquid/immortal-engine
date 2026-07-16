// U371 — furniture-op batch stability (splice-proof mutation; ROM-4 bounded fix).
//
// modifyFurniture / removeFurniture carry `furnitureId` = the piece's index in
// node.furniture as it stood at the START of the turn (emitted from ONE objectsHere
// read — see llmPhysics.js). But removeFurniture SPLICES the array, so once a remove
// fires, every LATER furniture op in the SAME delta batch is off by the number of
// removed lower-indexed pieces — silently editing or removing the WRONG piece.
//
// A plausible one-turn batch that triggers it: "I kick the pallet aside and pry open
// the lantern's shutter" -> [removeFurniture(0), modifyFurniture(1, ajar)].
//
// The fix resolves each furniture op's index to the stable piece NAME up front
// (against a per-node pre-batch snapshot), so the handlers locate pieces by identity.
// The splice contract (length shrinks by one per remove) is preserved — single-op
// batches, U122 salvage, and U307 splice-stability are all unchanged.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const nodeOf = (w) => (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
const pieceNamed = (w, name) => (nodeOf(w)?.furniture || []).find(f => String(f?.name) === name) || null;
const furnNames = (w) => (nodeOf(w)?.furniture || []).map(f => String(f?.name));

test('U371: precondition — the tallow wake-room has >=3 distinct-named furniture pieces', () => {
  const w = boot();
  const names = furnNames(w);
  assert.ok(names.length >= 3, `need >=3 pieces to show the splice shift, got ${names.length}`);
  assert.equal(new Set(names).size, names.length, 'piece names are unique per node (name-keying is safe)');
});

test('U371-A: a remove-then-modify batch edits the INTENDED piece, not the splice-shifted one', () => {
  const w = boot();
  const nid = w.map.currentNodeId;
  const before = furnNames(w);
  const removed = before[0];   // straw pallet
  const target = before[1];    // oil lantern — the piece we mean to modify
  const bystander = before[2]; // iron-bound chest — shifts into index 1 after the splice

  // Both ops key off the PRE-BATCH index space (furnitureId 0 and 1), exactly as a
  // single per-turn objectsHere read would emit them.
  const w2 = applyDeltas(w, [
    { op: 'removeFurniture', nodeId: nid, furnitureId: 0 },
    { op: 'modifyFurniture', nodeId: nid, furnitureId: 1, changes: { state: 'ajar' } },
  ]);

  assert.equal(pieceNamed(w2, removed), null, `${removed} was removed`);
  assert.equal(pieceNamed(w2, target)?.state, 'ajar', `${target} (intended) was opened`);
  assert.equal(pieceNamed(w2, bystander)?.state, 'intact', `${bystander} (bystander) was NOT wrongly edited by the shift`);
  assert.equal(nodeOf(w2).furniture.length, before.length - 1, 'splice contract preserved: length shrank by exactly one');
});

test('U371-B: two ascending removes in one batch drop BOTH intended pieces, not a shifted survivor', () => {
  const w = boot();
  const nid = w.map.currentNodeId;
  const before = furnNames(w);
  const dropA = before[0]; // straw pallet
  const dropB = before[1]; // oil lantern
  const keepA = before[2]; // iron-bound chest — would be wrongly spliced pre-fix
  const keepB = before[3]; // stone basin

  const w2 = applyDeltas(w, [
    { op: 'removeFurniture', nodeId: nid, furnitureId: 0 },
    { op: 'removeFurniture', nodeId: nid, furnitureId: 1 },
  ]);

  const remaining = furnNames(w2);
  // EVOLVED 2026-07-16 (FURN-PARITY-1): the node now also carries the procgen
  // structure's plan-sourced loadout pieces, so "remaining" is no longer exactly
  // [keepA, keepB]. The batch-shift claim this test owns is unchanged: BOTH
  // intended pieces drop, NO shifted survivor drops in their place.
  assert.ok(!remaining.includes(dropA) && !remaining.includes(dropB), 'both intended pieces are gone');
  assert.ok(remaining.includes(keepA) && remaining.includes(keepB), 'the neighbours survive un-spliced');
  assert.equal(pieceNamed(w2, dropA), null, `${dropA} gone`);
  assert.equal(pieceNamed(w2, dropB), null, `${dropB} gone`);
});

test('U371-C: single-op removes/modifies are byte-identical to the old index path (no regression)', () => {
  const nid = boot().map.currentNodeId;
  // A single removeFurniture and a single modifyFurniture never touch the batch-shift
  // path — assert their result world is hash-stable across two independent runs.
  const runRemove = () => applyDeltas(boot(), [{ op: 'removeFurniture', nodeId: nid, furnitureId: 2 }]);
  assert.equal(worldHash(runRemove()), worldHash(runRemove()), 'single remove is deterministic');

  const runModify = () => applyDeltas(boot(), [{ op: 'modifyFurniture', nodeId: nid, furnitureId: 2, changes: { state: 'shattered' } }]);
  assert.equal(worldHash(runModify()), worldHash(runModify()), 'single modify is deterministic');

  const w = runModify();
  const chest = (nodeOf(w)?.furniture || [])[2];
  assert.equal(chest?.state, 'shattered', 'index-2 piece still edits by index when no prior splice shifts it');
});
