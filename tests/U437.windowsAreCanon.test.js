// U437 — FP-2 windows are CANON, not decoration
// (docs/briefs/FP-2-walls-with-mass.md #3).
//
// The windows the map draws are the SAME ones the fiction already binds: roomWindows.js
// gives the count + shuttered state (you can climb out the east window, shutters lock
// at night — timeline canon), roomWindowFacings.js the compass facings. FP-2 draws
// exactly `count` windows per room, on the room's EXTERIOR wall only (never a shared /
// interior wall — that's where doorways live), dark rooms draw NONE, and the shuttered
// state changes the drawn variant. This test asserts the DRAWN window model equals the
// engine canon, room by room.
//
// Model-level (no canvas): structureWindowModel()/drawnStructureModel().windows are the
// pure derivations the oneMap.js window glyphs draw from. Pure, deterministic,
// read-only — no engine writes, no Math.random, no network. worldHash untouched.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { roomWindows } from '../engine/structures/roomWindows.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { drawnStructureModel, structureWindowModel, pointInWallBand } from '../public/map/drawModel.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const COTTAGE = 'stgen:v27:n3_1515674724:0';

function cottageStruct(world) {
  return drawnStructureModel(world, String(world.map.currentNodeId)).structures.find(s => s.structureKey === COTTAGE);
}

test('U437-A: per-room drawn window COUNT equals roomWindows() count for every discovered room (dark rooms draw NONE)', () => {
  const w = boot();
  const st = cottageStruct(w);
  assert.ok(st, 'precondition: the boot cottage is in the drawn model');
  let litChecked = 0, darkChecked = 0;
  for (const room of st.rooms) {
    const canon = roomWindows(w, { structureKey: COTTAGE, roomId: room.id }).count;
    const drawn = (st.windows[room.id] || []).length;
    assert.equal(drawn, canon, `room ${room.name}: drawn window count (${drawn}) must equal canon (${canon})`);
    if (canon === 0) darkChecked++; else litChecked++;
  }
  assert.ok(litChecked >= 1, 'precondition: at least one lit room with windows');
  assert.ok(darkChecked >= 1, 'precondition: the cottage Pantry is a dark room with zero windows');
});

test('U437-B: every drawn window sits on an EXTERIOR wall — never inside another room, always on the shell edge', () => {
  const w = boot();
  const st = cottageStruct(w);
  const plan = floorPlan(w.structures.byId[COTTAGE]);
  const EPS = 0.30 * 4; // exterior tolerance in world units (~ layout EPS * PLACE_WU)
  // A window point must be at/near the shell boundary (an exterior wall) and must
  // NOT lie inside any OTHER room's floor (that would be an interior/shared wall).
  const nearShell = (x, y) => (
    Math.min(Math.abs(x - st.rect.minX), Math.abs(x - st.rect.maxX)) < EPS ||
    Math.min(Math.abs(y - st.rect.minY), Math.abs(y - st.rect.maxY)) < EPS
  );
  const pointInRoom = (room, x, y) => {
    const segs = room.walls; if (!segs || !segs.length) return false;
    const pts = [[segs[0].a.wx, segs[0].a.wy]]; for (const s of segs) pts.push([s.b.wx, s.b.wy]);
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi)) inside = !inside;
    }
    return inside;
  };
  let total = 0;
  for (const [roomId, list] of Object.entries(st.windows)) {
    for (const win of list) {
      total++;
      assert.ok(nearShell(win.wx, win.wy), `a ${win.dir} window of room ${roomId} must sit on the shell (exterior) edge`);
      for (const other of st.rooms) {
        if (String(other.id) === String(roomId)) continue;
        assert.equal(pointInRoom(other, win.wx, win.wy), false,
          `a ${win.dir} window must NOT land inside another room (${other.name}) — no windows on shared walls`);
      }
    }
  }
  assert.ok(total >= 2, 'precondition: at least two windows were checked');
});

test('U437-C: the SHUTTERED state changes the drawn variant — a shuttered room\'s windows carry shuttered:true', () => {
  const w = boot();
  const st = cottageStruct(w);
  let sawShuttered = false, sawOpen = false;
  for (const room of st.rooms) {
    const canon = roomWindows(w, { structureKey: COTTAGE, roomId: room.id });
    const drawn = st.windows[room.id] || [];
    for (const win of drawn) {
      assert.equal(win.shuttered, !!canon.shuttered, `room ${room.name}: drawn shuttered flag must match canon`);
      if (win.shuttered) sawShuttered = true; else sawOpen = true;
    }
  }
  // The tallow cottage boots with one shuttered room (Bedchamber) and one open
  // (Hearth Room) — both variants are exercised.
  assert.ok(sawShuttered, 'precondition: at least one shuttered window (the Bedchamber boots shuttered)');
  assert.ok(sawOpen, 'precondition: at least one open (glazed) window (the Hearth Room)');
});

test('U437-D: structureWindowModel and the drawnStructureModel.windows field agree, and both are deterministic ×2', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const standalone = structureWindowModel(w, nodeId).byKey[COTTAGE] || {};
  const folded = cottageStruct(w).windows;
  assert.deepEqual(folded, standalone, 'the folded-in windows equal the standalone structureWindowModel');
  // Determinism across two independent boots of the same seed.
  const a = structureWindowModel(boot(), nodeId).byKey[COTTAGE];
  const b = structureWindowModel(boot(), nodeId).byKey[COTTAGE];
  assert.deepEqual(a, b, 'the window model is identical across two boots of seed tallow');
});

test('U437-E: window derivation is PURE — worldHash unchanged', () => {
  const w = boot();
  const h0 = worldHash(w);
  structureWindowModel(w, String(w.map.currentNodeId));
  drawnStructureModel(w, String(w.map.currentNodeId));
  assert.equal(worldHash(w), h0, 'deriving windows must never mutate anything worldHash covers');
});
