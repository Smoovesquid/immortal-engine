// U450 — TAC-4: the map marker SNAPS to the canonical tactical square.
//
// TAC-2 (landed v0.28.15) gave the engine a walkable canonical tactical position:
// a typed cardinal ("go east", "walk east") slides party[0].pos cell-by-cell (5 ft
// per cell) within the current frame. But the map marker didn't show it — the
// renderer's WS-2 resolver (public/map/worldSpace.js) resolved the player indoors
// from scene.interior.roomId (room-granular) and never read `pos`. A WITHIN-room
// walk moved canon but not the marker. Tim's map-fidelity law: a fix isn't done
// until it registers on the player map.
//
// TAC-4 (this) makes resolveEntityWuFromWorld read `pos` when present: a struct-frame
// cell projects through the SAME footprint-centered chain the drawn plan uses
// (structCellToWu ↔ drawModel.js's planPointToWu), a region-frame cell through the
// SAME node lattice the map draws. This test proves the marker MOVES with the walk
// and lands inside the room the engine says you're in — driven through the REAL
// player gesture (playerMove) from the live slice boot.
//
// Pure, LLM-off (deterministic), renderer read-only. No engine writes, no
// Math.random, no network, no API key. worldHash is untouched by the projection
// (the marker READS engine truth, never writes it — asserted in U451).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { roomOfStructCell } from '../engine/map/spatial/tacticalPos.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import {
  PLACE_WU,
  placeFrame, buildingAnchorInPlace, structCellToWu
} from '../public/map/worldSpace.js';
import { playerFocusWu } from '../public/map/oneMap.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadPacks() {
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(ROOT, 'packs', 'manifest.json'), 'utf-8')));
  const out = {};
  for (const p of manifest.packs) out[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(ROOT, p.path), 'utf-8')));
  return out;
}
const PACKS = loadPacks();

// The exact live boot: pre-rolled hero into the Aldermere slice — INSIDE the wake
// room (scene.interior set, party[0].pos placed in that room), a fresh campaignId so
// oneMap.js's per-campaign camera singleton never leaks across cases.
let __camSeq = 0;
function bootIndoors() {
  const pc = buildPreRolledCharacter({ id: 'bryn' });
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-U450-${++__camSeq}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const w1 = ensureWorld({ ...w0, party: [pc] });
  return beginAdventure(w1, PACKS).world;
}

// The drawn world-unit box of a room, computed from the SAME structCellToWu
// projection the marker uses (room layout box → its two corner cells → wu). A marker
// resolved for any cell inside this room must land inside this box.
function roomDrawnBoxWu(world, roomId) {
  const nodeId = String(world.map.currentNodeId);
  const node = world.map.nodes.find(n => String(n.id) === nodeId);
  const stKey = String(world.scene.interior.structureKey);
  const plan = floorPlan(world.structures.byId[stKey]);
  const place = node.settlement ? placeFromWorldNode(world, nodeId) : null;
  const frame = place ? placeFrame(place) : null;
  const anchor = buildingAnchorInPlace(place, stKey) || { ox: 0, oy: 0 };
  const room = plan.rooms.find(r => String(r.id) === String(roomId));
  // Corners in cells (layout units × PLACE_WU cells-per-unit), projected to wu.
  const c0 = structCellToWu(node, frame, anchor, plan, (room.cx - room.w / 2) * PLACE_WU, (room.cy - room.h / 2) * PLACE_WU);
  const c1 = structCellToWu(node, frame, anchor, plan, (room.cx + room.w / 2) * PLACE_WU, (room.cy + room.h / 2) * PLACE_WU);
  return {
    minX: Math.min(c0.wx, c1.wx), maxX: Math.max(c0.wx, c1.wx),
    minY: Math.min(c0.wy, c1.wy), maxY: Math.max(c0.wy, c1.wy)
  };
}
function inBox(p, b) { return p.wx >= b.minX && p.wx <= b.maxX && p.wy >= b.minY && p.wy <= b.maxY; }

// ── U450-01 — a cross-room walk moves the marker into the new room ──────────────

test('U450-01: "go east" moves the marker to a NEW wu point that lands inside the room the engine now says you are in', () => {
  const w = bootIndoors();
  const before = playerFocusWu(w);
  assert.ok(before && Number.isFinite(before.wx) && Number.isFinite(before.wy), 'the player resolves to a finite marker point at boot');

  // "go east" from the wake room crosses a real doorway into the adjacent room
  // (proven in U442/U444); pos slides into that room, and the marker must follow.
  const r = playerMove(w, PACKS, 'go east');
  const after = playerFocusWu(r.world);
  assert.ok(after && Number.isFinite(after.wx) && Number.isFinite(after.wy), 'resolves after the move');

  // The wu point actually CHANGED (the marker moved — not a stale room-center read).
  assert.ok(after.wx !== before.wx || after.wy !== before.wy, `marker moved (${JSON.stringify(before)} -> ${JSON.stringify(after)})`);

  // And it lands INSIDE the drawn room rect the engine now says the player is in —
  // the pos invariant (roomOf(pos) === scene.interior.roomId) makes this hold by
  // construction; we assert it end-to-end through the marker's own projection.
  const roomId = String(r.world.scene.interior.roomId);
  const st = r.world.structures.byId[String(r.world.scene.interior.structureKey)];
  assert.equal(roomOfStructCell(floorPlan(st), r.world.party[0].pos.gx, r.world.party[0].pos.gy), roomId,
    'precondition: the committed pos is in the room scene.interior names');
  assert.ok(inBox(after, roomDrawnBoxWu(r.world, roomId)), `marker ${JSON.stringify(after)} lands inside the drawn room ${roomId}`);
});

// ── U450-02 — a WITHIN-room walk moves the marker WITHIN the room (the core fix) ─

test('U450-02: a same-room walk moves the marker WITHIN the room (no room-label change, marker still moves)', () => {
  // Get into the 3-wide adjacent room first (go east), then walk east AGAIN — the
  // room has east headroom (proven in the TAC-2 probes), so this is a within-room
  // pos walk: the roomId does NOT change, but pos advances one cell and the marker
  // must move with it. This is exactly the bug TAC-4 fixes.
  const w0 = bootIndoors();
  const inRoom = playerMove(w0, PACKS, 'go east').world;
  const roomId = String(inRoom.scene.interior.roomId);
  const box = roomDrawnBoxWu(inRoom, roomId);
  const before = playerFocusWu(inRoom);
  assert.ok(inBox(before, box), 'precondition: the marker is inside the room before the same-room walk');

  const r = playerMove(inRoom, PACKS, 'walk east');
  assert.equal(String(r.world.scene.interior.roomId), roomId, 'stayed in the same room (walked the floor, not through a doorway)');

  const after = playerFocusWu(r.world);
  // The marker moved even though the room label is unchanged — the room-granular
  // resolver used to freeze here; the pos-aware resolver moves it.
  assert.ok(after.wx !== before.wx || after.wy !== before.wy, `within-room marker moved (${JSON.stringify(before)} -> ${JSON.stringify(after)})`);
  assert.ok(inBox(after, box), `within-room marker ${JSON.stringify(after)} still inside room ${roomId}`);

  // The follow-camera reads the SAME resolver: its signature must change on a within-
  // room walk (a pos walk IS a real move), so the camera recenters instead of freezing.
  assert.notEqual(before.sig, after.sig, 'the focus signature changed on the within-room walk (camera will recenter)');
  // …but the inside/outside prefix is unchanged, so WS-3 never re-snaps the ZOOM on a
  // same-frame step (a same-room walk must not fight a reader who wheeled in).
  assert.equal(before.sig.split('|')[0], after.sig.split('|')[0], 'inside/outside prefix unchanged (no spurious zoom re-snap)');
});

// ── U450-03 — determinism: the whole marker rail is a pure function of the seed ──

test('U450-03: the resolved marker point is deterministic across two independent boots of the same seed', () => {
  const run = () => {
    let w = bootIndoors();
    const a = playerFocusWu(w);
    w = playerMove(w, PACKS, 'go east').world;
    const b = playerFocusWu(w);
    w = playerMove(w, PACKS, 'walk east').world;
    const c = playerFocusWu(w);
    // Strip the sig (it carries the campaignId-free pos, still deterministic) and
    // compare the wu points, the load-bearing thing the marker draws.
    return [a, b, c].map(f => ({ wx: f.wx, wy: f.wy }));
  };
  assert.deepEqual(run(), run(), 'the same seed yields identical marker points every build');
});
