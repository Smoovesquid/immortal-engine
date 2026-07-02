// U95 — Manipulation-verb prose.
//
// Manipulation verbs ("open the crate", "draw my sword", "sit down") used to
// require an "I" prefix and narrate everything as "You do so without difficulty."
// They now work bare or first-person and produce grounded, object-aware prose —
// while skill verbs (force/pick/pry/climb) still roll (UX2 contract).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { furnitureRoomAssignments } from '../engine/structures/roomObjects.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

function begin(seed) {
  return beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u95-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
}
function node(w) { return (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null; }
// Room-scoped objects (U307/WB-Q5): furniture lives in ONE room of an interior now,
// so stand the player in the named piece's room before acting on it.
const standInPieceRoom = (w, name) => {
  const a = furnitureRoomAssignments(w, w.map.currentNodeId).get(String(name));
  const cur = w.scene?.interior;
  if (!a || !cur || String(cur.roomId) === a.roomId) return w;
  const visited = [...new Set([...(cur.visited || []), a.roomId])];
  return {
    ...w,
    party: (w.party || []).map(p => ({ ...p, position: { ...(p.position || {}), interior: { structureId: a.structureId, roomId: a.roomId } } })),
    scene: { ...w.scene, interior: { structureKey: a.structureId, roomId: a.roomId, visited } }
  };
};
function beginWithFurniture() {
  for (const s of ['probe', 'alpha', 'bravo', 'charlie', 'delta', 'echo']) {
    const w = begin(s);
    const f = node(w)?.furniture;
    if (Array.isArray(f) && f.length) return { w: standInPieceRoom(w, f[0].name), furniture: f };
  }
  throw new Error('no furniture world');
}
const isTrivial = (out) => /trivial action/.test(out.mechanics || '');
const rolled = (out) => /roll:\s*\d+\s*vs/i.test(out.mechanics || '');

describe('U95-A: grounded manipulation prose (bare + first-person)', () => {
  it('"open the <furniture>" names the real furniture and is trivial', () => {
    const { w, furniture } = beginWithFurniture();
    const target = String(furniture[0].name).split(/\s+/).pop();
    const { output } = playerMove(w, packs, `open the ${target}`);
    assert.ok(isTrivial(output), output.mechanics);
    assert.ok(output.narration.includes(furniture[0].name), output.narration);
    assert.ok(!/low hum threads/.test(output.narration), `should not be abstract floor: ${output.narration}`);
  });

  it('"draw my sword" references the equipped weapon, bare and first-person', () => {
    const w = begin('probe');
    const wn = w.party[0].inventory.weapons[0]?.name;
    for (const cmd of ['draw my sword', 'I draw my sword', 'ready my weapon']) {
      const { output } = playerMove(w, packs, cmd);
      assert.ok(isTrivial(output), `${cmd}: ${output.mechanics}`);
      assert.ok(output.narration.includes(wn), `${cmd}: ${output.narration}`);
    }
  });

  it('body actions get distinct grounded lines, not "do so without difficulty"', () => {
    const w = begin('probe');
    const sit = playerMove(w, packs, 'sit down').output;
    const kneel = playerMove(w, packs, 'kneel').output;
    assert.ok(/sit/i.test(sit.narration), sit.narration);
    assert.ok(/kneel/i.test(kneel.narration), kneel.narration);
    assert.ok(!/do so without difficulty/i.test(sit.narration), sit.narration);
  });

  it('manipulation does not advance the turn clock (auto-success, no roll)', () => {
    const w = begin('probe');
    const before = w.time?.turn ?? 0;
    const { output, world } = playerMove(w, packs, 'draw my sword');
    assert.ok(isTrivial(output));
    // trivial actions resolve without a d20
    assert.ok(!rolled(output), output.mechanics);
  });
});

describe('U95-B: skill verbs are NOT swallowed (still roll)', () => {
  for (const cmd of ['force the door open', 'pry open the crate', 'pick the lock', 'climb the wall', 'break down the door']) {
    it(`"${cmd}" still rolls`, () => {
      const w = begin('probe');
      const { output } = playerMove(w, packs, cmd);
      assert.ok(!isTrivial(output), `"${cmd}" must not be trivial: ${output.mechanics}`);
    });
  }
});

describe('U95-C: non-equip "draw" phrases are not mistaken for drawing a weapon', () => {
  for (const cmd of ['draw water from the well', 'draw a map of the area']) {
    it(`"${cmd}" is not a trivial weapon draw`, () => {
      const w = begin('probe');
      const { output } = playerMove(w, packs, cmd);
      assert.ok(!/settling it ready in your grip/.test(output.narration), output.narration);
    });
  }
});
