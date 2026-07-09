// U661 — FUNC-MINIS-1: the barrel exemplar, end to end through the REAL turn path.
//
// Tim's acceptance bar (2026-07-09) #2/#3/#4/#6, driven via playerMove exactly as a
// player would: the placed barrel is present and interactable; smashing it changes
// real object state through effectsCore and tears off salvage parts (wood chunks);
// a wrecked barrel stops granting cover AND stops blocking its cell; and the cover/
// blocking reads consult the SAME stored node.furniture record the smash mutated.
//
// What actually fires (verified turn-by-turn): "smash the barrel" routes through
// the P-70 SALVAGE lane — the piece is destroyed outright (removed from
// node.furniture) and its material drops as a real item (defRef 'board' in
// inventory.items, id-prefixed 'sv_'). The rulings-lane parts progression
// (state 'damaged', parts torn off one by one) serves other verbs/paths; BOTH
// converge on the same live-state truth: a piece that is absent or terminal is
// destroyed (authoredFurniture.destroyedAuthoredPieceIds), so cover and blocking
// release either way. Deterministic by seed — same rolls every run, forever.
//
// Siblings: U659/U660 (the carriers), U662 (cover live-join unit).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { objectsHere } from '../engine/structures/roomObjects.js';
import { coverForRoom, bestCover } from '../engine/structures/coverFeatures.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { structCellFree, roomRectCells } from '../engine/map/spatial/tacticalPos.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { destroyedAuthoredPieceIds, isFurnitureDestroyed } from '../engine/structures/authoredFurniture.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));
const DEMO_SEED = 'loaderDemo';
const MAX_SMASHES = 24;

function boot() {
  return beginAdventure(newWorld({ seed: DEMO_SEED, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

function hutStructure(world) {
  return world.structures.byId[`authored:${String(world.map.currentNodeId)}`];
}

function hutRoom(world) {
  return normalizeTopology(hutStructure(world).topology).rooms[0];
}

function barrelPiece(world) {
  const nid = String(world.map.currentNodeId);
  const node = (world.map.nodes || []).find(n => n && String(n.id) === nid);
  return (node?.furniture || []).find(f => f && f.authored === true && String(f.name) === 'barrel') || null;
}

function coverCtx(world) {
  return { world, structureId: String(hutStructure(world).id) };
}

// Every walkable-rect cell of the hut room that the static mask blocks.
function blockedCells(world, excludeIds = null) {
  const st = hutStructure(world);
  const plan = floorPlan(st);
  const room = plan.rooms[0];
  const rect = roomRectCells(room);
  const out = new Set();
  for (let gx = rect.minX; gx <= rect.maxX; gx++) {
    for (let gy = rect.minY; gy <= rect.maxY; gy++) {
      if (!structCellFree(st, gx, gy, null, excludeIds)) out.add(`${gx},${gy}`);
    }
  }
  return out;
}

// Smash until the barrel is destroyed — absent (salvage lane) or terminal
// (rulings lane). Deterministic by seed.
function smashToWreck(world) {
  let w = world;
  let turns = 0;
  let lastOutput = null;
  for (let i = 0; i < MAX_SMASHES; i++) {
    const piece = barrelPiece(w);
    if (!piece || isFurnitureDestroyed(piece)) break;
    const r = playerMove(w, PACKS, 'I smash the barrel.');
    w = r.world;
    lastOutput = r.output;
    turns++;
  }
  return { world: w, turns, lastOutput };
}

test('U661: BEFORE — the placed barrel is present, grants cover, and blocks its cell', () => {
  const w = boot();

  const here = objectsHere(w).map(({ piece }) => String(piece.name));
  assert.ok(here.includes('barrel'), `the barrel is an interaction candidate (have: ${here.join(', ')})`);

  const cover = coverForRoom(hutRoom(w), coverCtx(w));
  assert.ok(cover.some(c => c.kind === 'barrel'), 'the placed barrel grants half cover');
  assert.equal(bestCover(cover)?.kind, 'barrel', 'the hut\'s best cover IS the barrel');

  const blocked = blockedCells(w);
  assert.ok(blocked.size >= 2, `bed + barrel anchors block their cells (blocked: ${blocked.size})`);
});

test('U661: smashing the barrel destroys REAL object state and yields wood salvage', () => {
  const w0 = boot();
  const invBefore = (w0.party?.[0]?.inventory?.items || []).length;
  const { world: w, turns, lastOutput } = smashToWreck(w0);

  assert.ok(turns >= 1 && turns <= MAX_SMASHES, `the smash resolves in real turns (took ${turns})`);

  // The world believes the destruction: the piece is gone from the live object
  // list (salvage lane removes it via effectsCore) or terminal (rulings lane).
  const piece = barrelPiece(w);
  assert.ok(!piece || isFurnitureDestroyed(piece),
    `the barrel is destroyed (${piece ? `state=${piece.state}, parts=${JSON.stringify(piece.parts)}` : 'removed from node.furniture'})`);

  // Salvage: destroying wood drops its material as a REAL item (P-70 lane —
  // defRef 'board', salvage-minted id) the player can craft/improvise with.
  const items = w.party?.[0]?.inventory?.items || [];
  const boards = items.filter(it => String(it?.defRef) === 'board');
  assert.ok(boards.length >= 1,
    `wood salvage drops (items: ${items.map(i => i.defRef).join(', ') || 'none'})`);
  assert.ok(items.length > invBefore, 'the salvage is NEW loot, not a pre-existing item');
  assert.match(String(lastOutput?.mechanics || ''), /salvage/i, 'the mechanics line names the salvage lane');
  assert.match(String(lastOutput?.narration || ''), /barrel/i, 'the narration resolves against the barrel');
});

test('U661: AFTER — the wrecked barrel no longer grants cover, and the read is the stored state the smash mutated', () => {
  const { world: w } = smashToWreck(boot());

  const cover = coverForRoom(hutRoom(w), coverCtx(w));
  assert.ok(!cover.some(c => c.kind === 'barrel'), 'a wreck shelters no one');
  assert.equal(bestCover(cover), null, 'the hut has no other cover — best cover is honestly nothing');

  // The same call WITHOUT the live ctx still lists the plan piece — proof the
  // suppression comes from the stored node.furniture state, not a plan rewrite.
  const staticCover = coverForRoom(hutRoom(w));
  assert.ok(staticCover.some(c => c.kind === 'barrel'), 'the static plan still knows the piece; the LIVE state is what kills the cover');
});

test('U661: AFTER — the wrecked barrel stops blocking its cell (walk mask released via live state)', () => {
  const w0 = boot();
  const before = blockedCells(w0);

  const { world: w } = smashToWreck(w0);
  const dead = destroyedAuthoredPieceIds(w, hutStructure(w));
  assert.equal(dead.size, 1, 'exactly the barrel is registered destroyed');

  const after = blockedCells(w, dead);
  assert.equal(before.size - after.size, 1, 'exactly one cell (the barrel\'s) frees up');
  for (const key of after) assert.ok(before.has(key), 'no new blocking appears from a destruction');
});
