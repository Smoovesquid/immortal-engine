// U290 — exit leaves a valid EXTERIOR ANCHOR (BUG 1a state/render fork).
//
// S4/U257 already prove a structure exit CLEARS interior state (scene.interior →
// null, map.currentStructureId/currentRoomId → ''). What no test asserts is the
// POSITIVE side: after exit, does the world name where you now stand outside?
//
// A valid exterior anchor =
//   (1) scene.interior null,
//   (2) map.currentNodeId resolves to a real, discovered node,
//   (3) scene.location == that node's canonical display name (cleanPlaceName),
//   (4) party[0].position.interior cleared.
//
// exitStructureInterior (engine/structures/interiors.js:109) clears (1) and the
// interior map-pointers and calls clearPartyInterior for (4), but writes
// scene.location NOWHERE — so (3) is the open question. This test SPLITS the fork:
//   FAIL on (3)  -> BUG 1a has a STATE cause (exit never syncs the exterior location)
//   PASS         -> state is sound; BUG 1a lives in the renderer/surface-switch.
//
// Canonical naming: cleanPlaceName (engine/map/mapState.js) — the engine's own
// exported helper, used by the travel paths to set scene.location. Not invented.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { cleanPlaceName } from '../engine/map/mapState.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U290: after a structure exit, the world presents a valid exterior anchor', () => {
  const w0 = boot();
  assert.ok(w0.scene?.interior, 'precondition: tallow must boot the player indoors');

  const w2 = playerMove(w0, PACKS, 'step outside').world;

  // (1) canonical interior state cleared
  assert.equal(Boolean(w2.scene?.interior), false, 'scene.interior must be null after exit');

  // (2) currentNodeId resolves to a real node (needed to name where you stand)
  const nodeId = String(w2.map?.currentNodeId || '');
  assert.ok(nodeId, 'map.currentNodeId must be set after exit');
  const node = (w2.map?.nodes || []).find(n => n && String(n.id) === nodeId) || null;
  assert.ok(node, `map.currentNodeId (${nodeId}) must resolve to a real node`);

  // (4) party interior position cleared
  assert.equal(w2.party?.[0]?.position?.interior, undefined, 'party[0].position.interior must be cleared on exit');

  // (3) THE FORK — scene.location must name the exterior node you now stand at
  const expectedLoc = cleanPlaceName(node?.name);
  assert.equal(
    w2.scene?.location,
    expectedLoc,
    `scene.location must name the exterior node after exit (got "${w2.scene?.location}", node "${node?.name}" -> "${expectedLoc}")`
  );

  // (2b) ...and that node must be discovered (secondary; checked after the fork so
  // a discovery edge-case can't mask the scene.location result)
  assert.ok((w2.map?.discovered || []).includes(nodeId), `current node (${nodeId}) must be discovered`);
});
