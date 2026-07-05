// U517 — LOAD-1: malformed authored JSON FAILS LOUDLY, and the demo is fully
// seed-gated so the DEFAULT game is byte-identical.
//
// docs/briefs/LOAD-1-smallest-loader.md hard constraints:
//   • "malformed authored JSON must fail loudly (validate via a clear error), never
//     silently corrupt state" — loadAuthoredStructure throws a clear Error on every
//     ill-formed input (no schema, wrong schema, no rooms, a room with no id or a
//     non-positive footprint, an unsupported shape, a non-object, an unparseable
//     string);
//   • "default boot byte-identical (demo behind flag/seed)" — an ORDINARY seed's
//     structures carry NO authored/loader tag and NO authoredPlan, the demo id is
//     absent, and two ordinary boots replay worldHash-identical (the demo wire-in in
//     applyGeneratedStructuresForNode is a no-op on every non-demo seed).
//
// Siblings: U513 (the load), U514 (enterable), U515 (furniture + material), U516
// (determinism).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';

const OK_ROOM = { id: 'hut', name: 'Hut', role: 'quarters', shape: 'rect', material: 'timber', x: 10, y: 10, w: 6, h: 5 };
const OK = { kind: 'authored-structure', schema: 'house-builder/v6', name: 'Hut', grid: { cols: 120, rows: 90, cell: 28 }, rooms: [OK_ROOM], walls: [], openings: [], tunnels: [], corridors: [], furniture: [], secrets: [] };

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

function boot(worldSeed) {
  const w0 = newWorld({ seed: worldSeed, fate: 0.2, campaignId: `campaign-${worldSeed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

// ── malformed input fails loudly ──────────────────────────────────────────────────

test('U517: a valid fixture is the control — it does NOT throw', () => {
  assert.doesNotThrow(() => loadAuthoredStructure(OK, { nodeId: 'n_ok' }));
});

test('U517: every malformed authored input throws a clear authoredStructure error', () => {
  const bad = [
    ['null', null],
    ['a number', 42],
    ['an array', []],
    ['no schema', { rooms: [OK_ROOM] }],
    ['wrong schema', { schema: 'house-builder/v4', rooms: [OK_ROOM] }],
    ['no rooms key', { schema: 'house-builder/v6' }],
    ['empty rooms', { schema: 'house-builder/v6', rooms: [] }],
    ['room missing id', { schema: 'house-builder/v6', rooms: [{ w: 6, h: 5 }] }],
    ['room zero width', { schema: 'house-builder/v6', rooms: [{ id: 'r', w: 0, h: 5 }] }],
    ['room negative height', { schema: 'house-builder/v6', rooms: [{ id: 'r', w: 6, h: -1 }] }],
    ['unsupported shape', { schema: 'house-builder/v6', rooms: [{ id: 'r', w: 6, h: 5, shape: 'blob' }] }],
    ['unparseable string', '{ this is not json'],
  ];
  for (const [label, input] of bad) {
    assert.throws(
      () => loadAuthoredStructure(input, { nodeId: 'n_x' }),
      /authoredStructure: malformed authored plan/,
      `expected a loud throw for: ${label}`
    );
  }
});

test('U517: the loud failure NEVER returns a partial structure (it throws, it does not degrade to junk)', () => {
  let returned;
  try { returned = loadAuthoredStructure({ schema: 'house-builder/v6', rooms: [] }, { nodeId: 'n_x' }); }
  catch { returned = 'threw'; }
  assert.equal(returned, 'threw', 'malformed input throws rather than yielding a corrupt structure');
});

// ── the default game stays byte-identical (demo behind the seed) ────────────────

test('U517: an ORDINARY seed materializes NO authored/loader structure', () => {
  const w = boot('U517-ordinary');
  const structs = Object.values(w.structures.byId);
  assert.ok(structs.length > 0, 'the ordinary world still has its procgen structures');
  for (const st of structs) {
    assert.equal(st.authoredPlan, undefined, `no procgen structure carries an authoredPlan (${st.id})`);
    const tags = Array.isArray(st.tags) ? st.tags : [];
    assert.ok(!tags.includes('loader'), `no procgen structure carries the loader tag (${st.id})`);
  }
  assert.equal(w.structures.byId[`authored:${String(w.map.currentNodeId)}`], undefined, 'the demo id is absent on an ordinary seed');
});

test('U517: two ordinary boots replay worldHash-identical (the demo wire-in is a no-op off-seed)', () => {
  const a = boot('U517-nochange');
  const b = boot('U517-nochange');
  assert.equal(worldHash(a), worldHash(b), 'the default game is byte-identical — LOAD-1 adds nothing off its seed');
});

test('U517: a second ordinary seed is also untouched (the no-op holds across seeds)', () => {
  const a = boot('U517-seedA');
  const b = boot('U517-seedA');
  assert.equal(worldHash(a), worldHash(b));
  // And it is a DIFFERENT world than the demo (sanity: the demo seed really is special).
  const demo = boot('loaderDemo');
  assert.notEqual(worldHash(a), worldHash(demo), 'the demo seed diverges from an ordinary seed (the wire-in is real under it)');
});
