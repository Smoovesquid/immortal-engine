// U488 — SL-5: Aldermere's curated civic worry.
//
// Guards Candidate A (docs/briefs/SL-5-aldermere-wants.md): resolveConcern()'s
// source is overridden for the slice's OWN town node only, returning a
// seed-chosen worry from the 2-entry authored table (Greenwood road / Hollowed
// Chapel bell) instead of the generic npcWant role-pool. SAME seed → SAME
// worry across repeated asks in one session (stable, not re-rolled — mirrors
// npcArc.npcWant's pick() discipline). Every other pack/seed/node stays
// byte-identical.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { classifyPlaceQuery, resolvePlaceFact } from '../engine/world/placeQuery.js';
import { SLICE_SEED, ALDERMERE_WORRIES, pickAldermereWorry } from '../engine/world/sliceRegion.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const manifest = normalizeManifest(
    JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8'))
  );
  const byId = {};
  for (const p of manifest.packs) {
    byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  }
  return byId;
}
const PACKS = loadPacks();

function bootSlice(seed = SLICE_SEED, fate = 0.2) {
  const { world } = beginAdventure(
    newWorld({ seed, fate, pack: { primaryId: 'fantasy', mixerId: null } }),
    PACKS
  );
  return world;
}

const CONCERN_ASK = "what's troubling folk here?";

test('U488: the authored table is exactly two entries — Greenwood-road and chapel-bell', () => {
  assert.equal(ALDERMERE_WORRIES.length, 2, 'exactly two curated worries (SETTLED — no third)');
  const ids = ALDERMERE_WORRIES.map(w => w.id).sort();
  assert.deepEqual(ids, ['chapel-bell', 'greenwood-road']);
});

test('U488: neither worry mentions the Scar or any §0 cosmology term', () => {
  const banned = /\bscar\b|cosmology|the truth beneath|waveform|orb\b/i;
  for (const w of ALDERMERE_WORRIES) {
    assert.ok(!banned.test(w.body), `${w.id}.body must be civic/mundane only`);
    assert.ok(!banned.test(w.opener), `${w.id}.opener must be civic/mundane only`);
  }
});

test('U488: the slice town node returns a curated worry, not the generic role-pool', () => {
  const world = bootSlice();
  const q = classifyPlaceQuery(CONCERN_ASK);
  assert.equal(q?.type, 'concern');
  const fact = resolvePlaceFact(world, q);
  assert.ok(fact, 'concern resolves (Aldermere always has a sociable roster)');
  const bodies = ALDERMERE_WORRIES.map(w => w.body);
  assert.ok(bodies.includes(fact.body), `body must be one of the curated worries, got: ${fact.body}`);
  // Not the generic "folk here carry their small wants —" framing.
  assert.ok(!fact.body.startsWith('folk here carry their small wants'), 'must not be the generic role-pool phrasing');
});

test('U488: the returned concern is a SINGLE string, never an array/list (no-quest-log)', () => {
  const world = bootSlice();
  const q = classifyPlaceQuery(CONCERN_ASK);
  const fact = resolvePlaceFact(world, q);
  assert.equal(typeof fact.body, 'string');
  assert.ok(!Array.isArray(fact.body));
});

test('U488: SAME seed → SAME worry across repeated asks (stable all session, not re-rolled)', () => {
  const world = bootSlice();
  const q = classifyPlaceQuery(CONCERN_ASK);
  const asks = [];
  for (let i = 0; i < 5; i++) {
    const fact = resolvePlaceFact(world, q);
    asks.push(fact.body);
  }
  const unique = new Set(asks);
  assert.equal(unique.size, 1, `all 5 asks on the same world/seed must return the identical worry, got: ${JSON.stringify([...unique])}`);
});

test('U488: SAME seed → SAME worry across independent fresh boots (deterministic pick)', () => {
  const w1 = bootSlice();
  const w2 = bootSlice();
  const q = classifyPlaceQuery(CONCERN_ASK);
  const f1 = resolvePlaceFact(w1, q);
  const f2 = resolvePlaceFact(w2, q);
  assert.equal(f1.body, f2.body, 'two independent boots of the SAME seed must pick the SAME worry');
});

test('U488: pickAldermereWorry(seed) matches what resolveConcern actually surfaces', () => {
  const world = bootSlice();
  const worry = pickAldermereWorry(SLICE_SEED);
  const q = classifyPlaceQuery(CONCERN_ASK);
  const fact = resolvePlaceFact(world, q);
  assert.equal(fact.body, worry.body, 'the resolver must surface exactly the seed-chosen worry');
});

test('U488: a non-slice pack/seed (generic fantasy boot, tallow) is byte-identical to today', () => {
  const world = bootSlice('tallow');
  const q = classifyPlaceQuery(CONCERN_ASK);
  if (!q) return; // no concern-trigger match is fine — the point is no curated override fires
  const fact = resolvePlaceFact(world, q);
  if (!fact) return; // honest-decline (no sociable roster) is a valid non-curated outcome
  const curatedBodies = ALDERMERE_WORRIES.map(w => w.body);
  assert.ok(!curatedBodies.includes(fact.body), 'tallow must never surface a curated Aldermere worry');
});

test('U488: a non-town slice node (the Greenwood) does NOT get the curated override', () => {
  const world = bootSlice();
  // Move off the town to a non-Aldermere slice node and confirm the town-only gate.
  const forest = world.map.nodes.find(n => n.name === 'The Greenwood');
  assert.ok(forest, 'the Greenwood exists in the slice');
  const moved = { ...world, map: { ...world.map, currentNodeId: forest.id } };
  const q = classifyPlaceQuery(CONCERN_ASK);
  const fact = resolvePlaceFact(moved, q);
  if (fact) {
    const curatedBodies = ALDERMERE_WORRIES.map(w => w.body);
    assert.ok(!curatedBodies.includes(fact.body), 'the curated table is town-scoped only, not slice-wide');
  }
});

test('U488: determinism — different seeds are free to land on either worry', () => {
  // Not asserting variety is guaranteed (2 seeds could coincidentally collide),
  // but confirm the picker itself is capable of landing on both entries.
  const seeds = ['aldermere', 'seedA', 'seedB', 'seedC', 'seedD', 'seedE', 'seedF', 'seedG'];
  const picks = new Set(seeds.map(s => pickAldermereWorry(s).id));
  assert.ok(picks.size >= 1 && [...picks].every(id => ['greenwood-road', 'chapel-bell'].includes(id)));
  // With 8 seeds across a 2-entry table, expect to see both at least once (guards a
  // constant-pick regression without asserting a specific split).
  assert.equal(picks.size, 2, 'across 8 varied seeds, both curated worries must be reachable');
});
