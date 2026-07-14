// U503 — MR-2a: the door schema, seeded defaults, migration + invariants.
//
// docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2a. WORLD_VERSION 30→31 adds a per-door
// canon record list `doors[]` on every registered structure: for each room-to-room
// doorway of its floorPlan PLUS exactly one exterior/front door,
// { id, a, b, orient, exterior, state } with state ∈ {open|shut|barred|locked}.
// This file locks: the version bump, the authored shape + seeded defaults, old-save
// backfill, idempotent re-ensure, and the new invariants (state enum, door cells in
// the plan, exactly one exterior door).
//
// Siblings: U504 (mask + door op), U505 (front-door record + refusal), U506 (no soft-lock).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld, WORLD_VERSION } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { loadSlot } from '../engine/save.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { DOOR_STATES, doorsOf, exteriorDoorOf, deriveDoors } from '../engine/structures/doors.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'], starterObjectives: ['find the key'],
    skills: ['Steel'], locations: ['tower'], objectives: ['find the key'],
    complications: ['a clock starts'], npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust'],
  },
};

function bootSlice() {
  const w0 = newWorld({
    seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape',
  });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

const registeredStructures = (w) => Object.values(w.structures?.byId || {});

// ── version + enum ───────────────────────────────────────────────────────────
test('U503: WORLD_VERSION is 34 (MR-2a doors → 31; SP-2 faction ethos → 32; OBJ-STATE-1 objects → 33; OBJ-DURABILITY-1 → 34)', () => {
  assert.equal(WORLD_VERSION, 34);
  const w = ensureWorld(newWorld({ seed: 'u503' }));
  assert.equal(w.meta.version, 34);
});

test('U503: the door-state enum is exactly {open,shut,barred,locked}', () => {
  assert.deepEqual([...DOOR_STATES].sort(), ['barred', 'locked', 'open', 'shut']);
});

// ── authored shape + seeded defaults ─────────────────────────────────────────
test('U503: every registered structure with rooms gets a doors[] with exactly one exterior door', () => {
  const w = bootSlice();
  const structs = registeredStructures(w).filter(s => (deriveDoors(w, s) || []).length > 0);
  assert.ok(structs.length > 0, 'the slice boot has at least one doored structure');
  for (const st of structs) {
    const doors = doorsOf(st);
    assert.ok(doors.length > 0, `structure ${st.id} carries door records`);
    const ext = doors.filter(d => d.exterior);
    assert.equal(ext.length, 1, `structure ${st.id} has exactly one exterior door`);
    for (const d of doors) {
      assert.ok(DOOR_STATES.includes(d.state), `door ${d.id} state is in the enum`);
      assert.ok(typeof d.id === 'string' && d.id, `door has a stable id`);
      assert.ok(d.orient === 'ns' || d.orient === 'ew', `door orient is ns|ew`);
    }
  }
});

test('U503: seeded defaults — interior doors open, the wake cottage front door shut-not-locked', () => {
  const w = bootSlice();
  const sk = String(w.scene.interior.structureKey);
  const st = w.structures.byId[sk];
  // Interior doors of an ordinary dwelling stand open.
  for (const d of doorsOf(st).filter(d => !d.exterior)) {
    assert.equal(d.state, 'open', `interior door ${d.id} seeds open`);
  }
  // The wake cottage's front door is shut — and specifically NOT locked/barred.
  const front = exteriorDoorOf(st);
  assert.equal(front.state, 'shut', 'wake cottage front door seeds shut');
  assert.notEqual(front.state, 'locked', 'the wake front door is not locked at boot');
});

test('U503: door defaults are deterministic (two boots author identical door records)', () => {
  const a = bootSlice();
  const b = bootSlice();
  const sa = String(a.scene.interior.structureKey);
  assert.deepEqual(doorsOf(a.structures.byId[sa]), doorsOf(b.structures.byId[sa]),
    'the same seed authors byte-identical doors[]');
});

// ── idempotent re-ensure (hash stability) ────────────────────────────────────
test('U503: re-ensuring an already-doored world is a no-op (hash + doors byte-identical)', () => {
  const w = bootSlice();
  const h1 = worldHash(w);
  const w2 = ensureWorld(w);
  assert.equal(worldHash(w2), h1, 'worldHash is stable across a re-ensure (doors are canon, not re-authored)');
  const sk = String(w.scene.interior.structureKey);
  // The door records are byte-identical across the re-ensure — the tail backfill
  // keeps the stored state rather than re-deriving the seeded default (so a flipped
  // door survives, and an unchanged one does not drift). (ensureStructures rebuilds
  // byId every ensure, so reference identity is not expected — content identity is.)
  assert.deepEqual(w.structures.byId[sk].doors, w2.structures.byId[sk].doors,
    'an unchanged structure keeps byte-identical doors[] across ensure');
});

// ── old-save backfill + warn ─────────────────────────────────────────────────
test('U503: a pre-v31 save (no doors[]) backfills door records on load AND warns', () => {
  // Build a real boot, then strip doors[] + downgrade the version to mimic a legacy save.
  const live = bootSlice();
  const legacy = JSON.parse(JSON.stringify(live));
  legacy.meta.version = 30;
  for (const st of Object.values(legacy.structures.byId)) delete st.doors;

  const data = {};
  const storage = {
    getItem(k) { return data[k] ?? null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
  };
  storage.setItem('ai-dm-v2:slot:slot1', JSON.stringify(legacy));

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  let loaded;
  try { loaded = loadSlot(storage, 'slot1'); }
  finally { console.warn = origWarn; }

  assert.ok(loaded, 'the legacy save loads');
  assert.equal(loaded.meta.version, WORLD_VERSION, 'upgraded to the current version');
  // The upgrade AUTHORED door records where there were none.
  const sk = String(loaded.scene.interior.structureKey);
  assert.ok(doorsOf(loaded.structures.byId[sk]).length > 0, 'doors[] backfilled on the wake structure');
  assert.equal(doorsOf(loaded.structures.byId[sk]).filter(d => d.exterior).length, 1, 'exactly one exterior door after upgrade');
  // Old saves must WARN before upgrade (protocol step 4).
  assert.ok(warnings.length > 0, 'a version-mismatch warning fired');
  assert.ok(warnings[0].includes('v30') && warnings[0].includes('v34'),
    `the warn names both versions: ${warnings[0]}`);
  // The upgraded world is invariant-clean.
  assert.doesNotThrow(() => assertWorldInvariants(loaded), 'the backfilled world is invariant-clean');
});

// ── invariants ───────────────────────────────────────────────────────────────
test('U503: invariant — an invalid door state throws', () => {
  const w = bootSlice();
  const sk = String(w.scene.interior.structureKey);
  const bad = JSON.parse(JSON.stringify(w));
  bad.structures.byId[sk].doors[0].state = 'ajar'; // not in the enum
  assert.throws(() => assertWorldInvariants(bad), /invalid state|open\|shut\|barred\|locked/,
    'a door state outside the enum is a hard invariant failure');
});

test('U503: invariant — an interior door joining a non-existent room throws', () => {
  const w = bootSlice();
  const sk = String(w.scene.interior.structureKey);
  const bad = JSON.parse(JSON.stringify(w));
  const interior = doorsOf(bad.structures.byId[sk]).find(d => !d.exterior);
  interior.b = 'room:does:not:exist';
  assert.throws(() => assertWorldInvariants(bad), /not both in the plan|door cells must exist/,
    'a door whose cells are not in the plan is an invariant failure');
});

test('U503: invariant — a structure with two exterior doors throws', () => {
  const w = bootSlice();
  const sk = String(w.scene.interior.structureKey);
  const bad = JSON.parse(JSON.stringify(w));
  const doors = bad.structures.byId[sk].doors;
  const ext = doors.find(d => d.exterior);
  // Duplicate the exterior door under a new id → two exterior doors.
  doors.push({ ...ext, id: ext.id + ':dup' });
  assert.throws(() => assertWorldInvariants(bad), /exactly one exterior door/,
    'more than one exterior door is an invariant failure');
});
