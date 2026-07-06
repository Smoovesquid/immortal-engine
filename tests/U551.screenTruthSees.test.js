// U551 — VIS-ORACLE: the screen-truth assertions can SEE.
//
// Proves the oracle's five assertion classes (scripts/screenTruth.assertions.mjs)
// each flag a synthetic scene that VIOLATES that class, and pass a clean one. This
// is the "can the oracle see?" guarantee — it holds GREEN forever, independent of
// whatever the live renderer's wake projection happens to be doing (it caught the
// PLAN-SPLIT-1 bug when the wake projection WAS buggy; U553 + the runtime probe
// (npm run playtest:screen) exercise the live renderer's actual current state).
//
// Each fixture is a hand-built { drawnModel, engineTruth } pair where the test
// controls every position exactly (mirrors U496's synthetic-fixture discipline).
// Nothing here is Math.random; nothing is hashed.
//
// docs/briefs/VIS-ORACLE.md. Siblings: U552 (determinism), U553 (live RED),
// U554 (accept ritual).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertProjectionEquality, assertPhantom, assertMissing,
  assertLayerOrigin, assertInkExclusion, runAllAssertions,
  ASSERTION_CLASSES,
} from '../scripts/screenTruth.assertions.mjs';

// ── A clean baseline drawn model + truth (a one-structure settlement, one person
//    well clear of the ink, player marker inside the structure's rect). Every
//    class passes on this; each violation fixture perturbs exactly one thing.
function cleanModel() {
  return {
    nodeId: 'nHome', inCombat: false, placeUnit: null,
    wu: {
      player: { wx: 5, wy: 5 },                                   // inside the structure rect below
      structures: [{ structureKey: 'S1', rect: { minX: 0, minY: 0, maxX: 10, maxY: 10 } }],
      decoratives: [],
      people: [{ id: 'p_carl', name: 'Carl', wx: 40, wy: 40, hostile: false }], // far outside the ink
      props: [],
    },
    scene3d: { people: [], props: [], player: null },
    combat: null,
  };
}
function cleanTruth() {
  return {
    nodeId: 'nHome',
    interior: { structureKey: 'S1', roomId: 'r1' },
    playerCell: { frame: 'struct:S1', gx: 2, gy: 2 },
    playerRect: { minX: 0, minY: 0, maxX: 10, maxY: 10 },         // matches the drawn structure rect
    playerPlaceUnitRect: null,
    outdoorNames: ['Carl'],
    structureKeys: ['S1'],
    combat: { active: false, enemies: [] },
  };
}

test('U551: clean scene — all five classes pass', () => {
  const m = cleanModel(), t = cleanTruth();
  assert.deepEqual(runAllAssertions(m, t, 'clean'), [], 'a coherent scene yields zero findings');
});

// ── PROJECTION_EQUALITY — the player marker drawn OUTSIDE its own structure rect ──
test('U551: PROJECTION_EQUALITY fires when the player marker is off its own building', () => {
  const m = cleanModel(), t = cleanTruth();
  m.wu.player = { wx: 99, wy: 99 };                               // way outside the S1 rect
  const f = assertProjectionEquality(m, t, 'proj');
  assert.equal(f.length, 1, 'exactly one projection finding');
  assert.equal(f[0].class, 'PROJECTION_EQUALITY');
  assert.match(f[0].detail, /OUTSIDE its own structure/);
  // and it's clean when the marker is inside:
  assert.deepEqual(assertProjectionEquality(cleanModel(), cleanTruth(), 'proj'), []);
});

// ── PROJECTION_EQUALITY (combat) — a drawn enemy cell != engine cell ──────────
test('U551: PROJECTION_EQUALITY fires when a combat mini is off its engine cell', () => {
  const m = { ...cleanModel(), inCombat: true, combat: { grid: { w: 12, h: 10 }, player: { cx: 1, cy: 4 }, enemies: [{ id: 'e1', name: 'Bandit', cx: 9, cy: 9, defeated: false }] } };
  m.__world = { combat: { playerCell: { cx: 1, cy: 4 }, enemies: [{ id: 'e1', cx: 4, cy: 3, defeated: false }] } }; // engine says (4,3)
  const t = { ...cleanTruth(), combat: { active: true, enemies: [{ id: 'e1', name: 'Bandit', defeated: false }] } };
  const f = assertProjectionEquality(m, t, 'combat');
  assert.ok(f.some(x => x.class === 'PROJECTION_EQUALITY' && /enemy e1 cell/.test(x.detail)), 'flags the off-cell enemy');
});

// ── PROJECTION_EQUALITY (combat) — corpse-swap out of step ────────────────────
test('U551: PROJECTION_EQUALITY fires when drawn defeated-state disagrees with engine', () => {
  const m = { ...cleanModel(), inCombat: true, combat: { grid: { w: 12, h: 10 }, player: { cx: 1, cy: 4 }, enemies: [{ id: 'e1', name: 'Bandit', cx: 4, cy: 3, defeated: false }] } };
  m.__world = { combat: { playerCell: { cx: 1, cy: 4 }, enemies: [{ id: 'e1', cx: 4, cy: 3, defeated: true }] } }; // engine says DOWN
  const t = { ...cleanTruth(), combat: { active: true, enemies: [{ id: 'e1', name: 'Bandit', defeated: true }] } };
  const f = assertProjectionEquality(m, t, 'combat');
  assert.ok(f.some(x => /corpse-swap out of step/.test(x.detail)), 'flags the corpse-swap mismatch');
});

// ── PHANTOM — a drawn person with no engine occupant source ───────────────────
test('U551: PHANTOM fires when a person is drawn with no engine source', () => {
  const m = cleanModel(), t = cleanTruth();
  m.wu.people.push({ id: 'p_ghost', name: 'Ghost', wx: 60, wy: 60, hostile: false }); // not in outdoorNames
  const f = assertPhantom(m, t, 'phantom');
  assert.equal(f.length, 1);
  assert.equal(f[0].class, 'PHANTOM');
  assert.match(f[0].detail, /no engine outdoor-occupant source/);
});

test('U551: PHANTOM fires when a structure is drawn with no engine structure at the node', () => {
  const m = cleanModel(), t = cleanTruth();
  m.wu.structures.push({ structureKey: 'S_FAKE', rect: { minX: 20, minY: 20, maxX: 22, maxY: 22 } });
  const f = assertPhantom(m, t, 'phantom');
  assert.ok(f.some(x => x.class === 'PHANTOM' && /S_FAKE/.test(x.detail)), 'flags the phantom structure');
});

// ── MISSING — an engine structure in frame that is not drawn ───────────────────
test('U551: MISSING fires when an engine structure is not drawn', () => {
  const m = cleanModel(), t = cleanTruth();
  t.structureKeys = ['S1', 'S2'];                                  // S2 exists in the engine
  m.__world = { structures: { byId: { S2: { rooms: [{ id: 'r1' }] } } } }; // has a drawable plan
  const f = assertMissing(m, t, 'missing');
  assert.ok(f.some(x => x.class === 'MISSING' && /S2/.test(x.detail)), 'flags the undrawn engine structure');
});

test('U551: MISSING fires when an engine combat enemy is not on the board', () => {
  const m = { ...cleanModel(), inCombat: true, combat: { grid: { w: 12, h: 10 }, player: { cx: 1, cy: 4 }, enemies: [{ id: 'e1', name: 'Bandit', cx: 4, cy: 3, defeated: false }] } };
  const t = { ...cleanTruth(), combat: { active: true, enemies: [{ id: 'e1', name: 'Bandit', defeated: false }, { id: 'e2', name: 'Wolf', defeated: false }] } };
  const f = assertMissing(m, t, 'missing');
  assert.ok(f.some(x => x.class === 'MISSING' && /e2/.test(x.detail)), 'flags the missing board enemy');
});

// ── LAYER_ORIGIN — marker-layer rect != ink-layer rect for the same structure ──
test('U551: LAYER_ORIGIN fires when the marker layer and ink layer disagree on a structure rect', () => {
  const m = cleanModel(), t = cleanTruth();
  // The drawn (ink) rect is shifted from the marker-layer rect (playerRect) — the
  // two layers were placed from different origins.
  m.wu.structures = [{ structureKey: 'S1', rect: { minX: 3, minY: 3, maxX: 13, maxY: 13 } }];
  const f = assertLayerOrigin(m, t, 'origin');
  assert.equal(f.length, 1);
  assert.equal(f[0].class, 'LAYER_ORIGIN');
  assert.match(f[0].detail, /do not share one origin/);
  // clean when they coincide:
  assert.deepEqual(assertLayerOrigin(cleanModel(), cleanTruth(), 'origin'), []);
});

// ── INK_EXCLUSION — a person rendered inside foreign plan ink ──────────────────
test('U551: INK_EXCLUSION fires when a person renders inside a structure that is not theirs', () => {
  const m = cleanModel(), t = cleanTruth();
  m.wu.people = [{ id: 'p_carl', name: 'Carl', wx: 5, wy: 5, hostile: false }]; // dead centre of the S1 rect
  const f = assertInkExclusion(m, t, 'ink');
  assert.equal(f.length, 1);
  assert.equal(f[0].class, 'INK_EXCLUSION');
  assert.match(f[0].detail, /inside foreign ink/);
});

test('U551: INK_EXCLUSION also guards decorative building ink', () => {
  const m = cleanModel(), t = cleanTruth();
  m.wu.decoratives = [{ key: 'deco:0', name: 'well', rect: { minX: 38, minY: 38, maxX: 42, maxY: 42 } }];
  m.wu.people = [{ id: 'p_carl', name: 'Carl', wx: 40, wy: 40, hostile: false }]; // inside the well rect
  const f = assertInkExclusion(m, t, 'ink');
  assert.ok(f.some(x => x.class === 'INK_EXCLUSION' && /well/.test(x.detail)), 'flags a figure inside decorative ink');
});

// ── A masked hostile ('?') is exempt from PHANTOM's name match (present, hidden) ─
test('U551: a masked hostile (name "?") does not trip PHANTOM — presence is real, identity is hidden', () => {
  const m = cleanModel(), t = cleanTruth();
  m.wu.people.push({ id: 'p_x', name: '?', wx: 55, wy: 55, hostile: true });
  const f = assertPhantom(m, t, 'phantom');
  assert.deepEqual(f, [], 'the masked hostile is a real occupant, not a phantom');
});

// ── The class registry is complete (each class has a description) ─────────────
test('U551: every assertion class has a human description', () => {
  for (const c of ['PROJECTION_EQUALITY', 'PHANTOM', 'MISSING', 'LAYER_ORIGIN', 'INK_EXCLUSION']) {
    assert.ok(ASSERTION_CLASSES[c] && ASSERTION_CLASSES[c].length > 0, `${c} has a description`);
  }
});
