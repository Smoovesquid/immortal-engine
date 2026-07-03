// U348 — structureMaterial (ROM-0, docs/briefs/ROOM_OCCUPANCY_MODEL.md).
// The C2 seam: narration said "wooden wall" then "stone wall" then "it was always
// stone" because no prose-side canon pinned the building's material while the map
// renderer always drew one (floorPlan BUILDING_SHELL). This module is the one
// table both surfaces read. These tests pin:
//   1. map↔prose alignment — floorPlan's drawn shell === the material fact's
//      shell, for every known type, for forced types, and for the derived-type
//      fallback (unknown/missing buildingType).
//   2. the derivation is pure, deterministic, and never mutates the world.
//   3. worldHash is byte-identical across derivation (nothing stored — the
//      ROM-0 determinism contract; no WORLD_VERSION bump).
//   4. getRoomState carries the material inside a structure and null outdoors,
//      and on the live tallow seed the wake cottage is TIMBER — so any "stone
//      wall" narrated inside it is a contradiction the lexicon must catch.
//   5. the forbidden lexicon is wall-scoped and never bans the building's own
//      family ("stone basin" in a timber cottage must stay narratable).
// Hermetic: pure functions over a booted world; no LLM, no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import {
  SHELL_BY_TYPE,
  effectiveBuildingType,
  materialForType,
  structureMaterial
} from '../engine/structures/structureMaterial.js';
import { getRoomState } from '../engine/structures/roomState.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

const KNOWN_TYPES = ['chapel', 'tavern', 'market', 'keep', 'cottage', 'longhouse', 'lair', 'tower', 'hive'];

// The historical floorPlan BUILDING_SHELL values, pinned verbatim — the renderer
// must keep drawing exactly what it drew before the table moved (ROM-0 promised
// byte-identical shells).
const HISTORICAL_SHELL = {
  chapel: 'stone', tavern: 'timber', market: 'open', keep: 'fortified',
  cottage: 'timber', longhouse: 'timber', lair: 'cave', tower: 'round', hive: 'chitin'
};

function syntheticStructure(id, buildingType) {
  const s = { id, kind: 'building', topology: { rooms: [{ id: `${id}:r1` }, { id: `${id}:r2` }], edges: [{ from: `${id}:r1`, to: `${id}:r2`, dir: 'north' }] } };
  if (buildingType != null) s.buildingType = buildingType;
  return s;
}

test('U348a: the shared shell table is byte-identical to the historical renderer values', () => {
  assert.deepEqual({ ...SHELL_BY_TYPE }, HISTORICAL_SHELL);
});

test('U348b: map↔prose alignment — floorPlan draws the SAME shell the material fact states', () => {
  // Every known type, declared explicitly.
  for (const type of KNOWN_TYPES) {
    const st = syntheticStructure(`u348:${type}`, type);
    const plan = floorPlan(st);
    const mat = materialForType(effectiveBuildingType(st));
    assert.equal(plan.shell, mat.shell, `declared type ${type}: map shell ${plan.shell} != prose shell ${mat.shell}`);
  }
  // Unknown/missing declared type — both sides must fall back through the SAME
  // id-hash derivation and land on the same shell.
  for (const id of ['u348:underived-1', 'u348:underived-2', 'stgen:v27:n3_1515674724:0']) {
    for (const declared of [undefined, 'not-a-real-type']) {
      const st = syntheticStructure(id, declared);
      const plan = floorPlan(st);
      const mat = materialForType(effectiveBuildingType(st));
      assert.equal(plan.shell, mat.shell, `id ${id} declared=${declared}: map ${plan.shell} != prose ${mat.shell}`);
    }
  }
});

test('U348c: pure + deterministic — same world, same answer, world untouched, hash stable', () => {
  const w = boot();
  const before = JSON.stringify(w);
  const h0 = worldHash(w);

  const sid = String(w.scene?.interior?.structureKey || '');
  assert.ok(sid, 'precondition: tallow boots inside a structure');
  const m1 = structureMaterial(w, sid);
  const m2 = structureMaterial(w, sid);
  const rs1 = getRoomState(w);
  const rs2 = getRoomState(w);

  assert.deepEqual(m1, m2, 'structureMaterial is deterministic');
  assert.deepEqual(rs1.material, rs2.material, 'getRoomState().material is deterministic');
  assert.deepEqual(rs1.material, m1, 'the façade returns the deriver\'s answer');
  assert.equal(JSON.stringify(w), before, 'derivation never mutates the world');
  assert.equal(worldHash(w), h0, 'worldHash byte-identical across derivation (nothing stored)');
});

test('U348d: getRoomState carries the material inside; null outdoors; missing structure -> null', () => {
  let w = boot();
  const inside = getRoomState(w);
  assert.equal(inside.inside, true, 'precondition: booted inside');
  assert.ok(inside.material && typeof inside.material === 'object', 'material present inside');
  assert.ok(typeof inside.material.line === 'string' && inside.material.line.length > 0, 'prompt-ready line present');

  // Walk outside through the real player gesture (the U260 exit phrasing).
  w = playerMove(w, PACKS, 'I step back outside').world;
  assert.equal(Boolean(w.scene?.interior), false, 'precondition: the exit gesture leaves the building');
  const out = getRoomState(w);
  assert.equal(out.inside, false);
  assert.equal(out.material, null, 'no structure, no material fact');

  assert.equal(structureMaterial(w, 'no-such-structure'), null);
});

test('U348e: the live tallow cottage is TIMBER, and its lexicon bans stone walls (the C2 transcript case)', () => {
  const w = boot();
  const sid = String(w.scene?.interior?.structureKey || '');
  const st = w.structures.byId[sid];
  assert.equal(String(st?.buildingType || ''), 'cottage', 'precondition: the tallow wake building is the cottage');
  const m = getRoomState(w).material;
  assert.equal(m.shell, 'timber');
  assert.equal(m.family, 'timber');
  // The exact drift from gate v1/chaos t6-t8 ("stone wall" narrated inside the
  // timber cottage) must be in the contradiction lexicon…
  assert.ok(m.forbidden.includes('stone wall'), 'lexicon bans "stone wall" in a timber build');
  assert.ok(m.forbidden.includes('walls of stone'), 'lexicon bans "walls of stone" in a timber build');
  // …while the building's own family, and non-wall objects, stay narratable.
  assert.ok(!m.forbidden.includes('wooden wall'), 'own family is never forbidden');
  assert.ok(!m.forbidden.some(p => p === 'stone' || p === 'stone basin'), 'lexicon is wall-scoped — a stone basin stays narratable');
});

test('U348f: lexicon shape across families — stone builds ban timber walls; market polices nothing; entries frozen', () => {
  const chapel = materialForType('chapel');
  assert.equal(chapel.family, 'stone');
  assert.ok(chapel.forbidden.includes('wooden wall'));
  assert.ok(!chapel.forbidden.includes('stone wall'));

  const market = materialForType('market');
  assert.deepEqual([...market.forbidden], [], 'open builds have no wall lexicon');

  const hive = materialForType('hive');
  assert.ok(hive.forbidden.includes('stone wall') && hive.forbidden.includes('wooden wall'));
  assert.ok(!hive.forbidden.includes('chitin wall'));

  assert.ok(Object.isFrozen(chapel) && Object.isFrozen(chapel.forbidden), 'shared material objects are frozen');
});
