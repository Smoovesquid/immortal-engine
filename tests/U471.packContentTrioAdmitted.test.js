// U471 — PACK-3: the authored content trio (`locations`, `objectives`,
// `sensoryMotifs`) is admitted through normalizePack's whitelist, so it finally
// reaches the live engine consumers that were falling back to thin defaults.
//
// Context: normalizePack() dropped these three fields before the engine ever saw
// them, so every consumer silently used its fallback: playloop drew from the
// 3-item starterLocations/starterObjectives pools, and sensory motifs collapsed
// to the single hardcoded 'a low hum…' string. A SECOND, compounding break hid
// underneath: mergeSubRegion() appends base+subregion for each field, but both
// sides arrived pre-stripped, so it silently produced []. This test proves both
// halves heal: the trio is carried through AND the sub-region merge yields the
// real base+subregion unions.
//
// The four non-fantasy genre packs (haunted/modern/space-rift/zombie) never got
// a hand-authored tail, so this enrichment is fantasy-scoped by content — but the
// whitelist admission itself is genre-agnostic.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { newWorld } from '../engine/state.js';
import { beginAdventure, mergeSubRegion } from '../engine/playloop.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.join(__dirname, '..');

// Production idiom: every real caller routes packs through normalizePack.
function loadNormalizedPacks() {
  const m = normalizeManifest(
    JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packs', 'manifest.json'), 'utf8'))
  );
  const byId = {};
  for (const p of m.packs) {
    byId[p.id] = normalizePack(
      JSON.parse(fs.readFileSync(path.join(REPO_ROOT, p.path.replace(/^\//, '')), 'utf8'))
    );
  }
  return byId;
}

// Mirror beginAdventure's sub-region merge order so the pools we assert against
// match what the engine actually assembles for a fantasy-primary boot.
function mergedFantasyPack(P) {
  let pack = P.fantasy;
  for (const sr of ['westmarch', 'ashenmoor', 'crownlands', 'hallowed_reaches']) {
    if (P[sr]) pack = mergeSubRegion(pack, P[sr]);
  }
  return pack;
}

// Non-escape boot: scene.objective is the raw pickFrom(pack,'objectives') draw
// (escape mode overwrites it with a fixed "your life is your own" line, so we use
// the pure-engine mode to observe the authored draw directly).
function bootPure(seed, fate = 0.3) {
  const P = loadNormalizedPacks();
  const w = newWorld({ seed, fate, mode: '', pack: { primaryId: 'fantasy', mixerId: null } });
  return beginAdventure(w, P).world;
}

test('U471-A: normalizePack now CARRIES the trio (was dropped by the whitelist)', () => {
  const P = loadNormalizedPacks();
  for (const field of ['locations', 'objectives', 'sensoryMotifs']) {
    assert.ok(Array.isArray(P.fantasy[field]), `fantasy.${field} must be an array`);
    assert.ok(P.fantasy[field].length >= 50, `fantasy.${field} must carry its authored pool (got ${P.fantasy[field].length})`);
  }
  // Sub-regions carry their hand-authored tails through intact.
  assert.ok(P.westmarch.locations.length >= 20, 'westmarch carries locations');
  assert.ok(P.westmarch.objectives.length >= 15, 'westmarch carries objectives');
  assert.ok(P.hallowed_reaches.locations.length >= 24, 'hallowed_reaches carries locations');
});

test('U471-B: mergeSubRegion HEALS — yields non-empty base+subregion unions (was [] due to double-stripping)', () => {
  const P = loadNormalizedPacks();
  const merged = mergeSubRegion(P.fantasy, P.westmarch);
  // The append() union: base 75 + westmarch 20 = 95 locations, 75 + 15 = 90 for the rest.
  assert.equal(merged.locations.length, P.fantasy.locations.length + P.westmarch.locations.length,
    'merged locations must be the full base+subregion union, not empty');
  assert.equal(merged.objectives.length, P.fantasy.objectives.length + P.westmarch.objectives.length,
    'merged objectives must be the full base+subregion union');
  assert.equal(merged.sensoryMotifs.length, P.fantasy.sensoryMotifs.length + P.westmarch.sensoryMotifs.length,
    'merged sensoryMotifs must be the full base+subregion union');
  // Authored sub-region content is actually present in the merge (not just count).
  assert.ok(merged.locations.some(l => /Thornwall/.test(l)),
    'a hand-authored westmarch location (Thornwall…) must appear in the merged pool');
});

test('U471-C: a fantasy boot draws its objective from the AUTHORED pool, not the 3-item fallback', () => {
  const P = loadNormalizedPacks();
  const merged = mergedFantasyPack(P);
  const authored = new Set(merged.objectives);
  const fallback = new Set(P.fantasy.starterObjectives); // ["find the missing courier", ...]
  // The starter and authored pools are disjoint, so membership cleanly proves the source.
  for (const seed of ['tallow', 'w1', 'abc', 'xyz42']) {
    const obj = bootPure(seed).scene?.objective;
    assert.ok(typeof obj === 'string' && obj.length > 0, `[${seed}] scene.objective must be a non-empty string`);
    assert.ok(authored.has(obj), `[${seed}] scene.objective "${obj}" must come from the authored pool`);
    assert.ok(!fallback.has(obj), `[${seed}] scene.objective must NOT be one of the 3 generic starterObjectives`);
  }
});

test('U471-D: the merged location pool feeds map/location naming from authored content (fallback no longer the only source)', () => {
  const P = loadNormalizedPacks();
  const merged = mergedFantasyPack(P);
  // The authored merged pool is far larger than the 3-item starter fallback and
  // is now what pickFrom('locations')/generateMap draw from.
  assert.ok(merged.locations.length > P.fantasy.starterLocations.length * 10,
    `merged authored location pool (${merged.locations.length}) must dwarf the 3-item starter fallback`);
  // No overlap between the generic starter pool and the authored pool — the two
  // are genuinely different sources, so admission changes what the engine draws.
  const starter = new Set(P.fantasy.starterLocations);
  assert.ok(!merged.locations.some(l => starter.has(l)),
    'authored location pool must be disjoint from the generic starter fallback');
});

test('U471-E: malformed trio fields degrade to safe empty arrays — never throw', () => {
  const malformed = normalizePack({
    id: 'broken',
    locations: 'not-an-array',
    objectives: { nope: true },
    sensoryMotifs: [null, 42, undefined, '', 'a real motif', { obj: 1 }]
  });
  assert.deepEqual(malformed.locations, [], 'non-array locations => []');
  assert.deepEqual(malformed.objectives, [], 'non-array objectives => []');
  // arrayStrings coerces + filters falsy: [null,42,undefined,'','a real motif',{}] -> ['42','a real motif','[object Object]']
  assert.ok(Array.isArray(malformed.sensoryMotifs), 'sensoryMotifs stays an array');
  assert.ok(malformed.sensoryMotifs.includes('a real motif'), 'the valid entry survives');
  assert.ok(!malformed.sensoryMotifs.includes(''), 'falsy entries are dropped');
  // A totally-missing trio is fine too (base shape stable).
  assert.doesNotThrow(() => normalizePack({ id: 'empty' }), 'missing trio must not throw');
  const empty = normalizePack({ id: 'empty' });
  assert.deepEqual(empty.locations, []);
  assert.deepEqual(empty.objectives, []);
  assert.deepEqual(empty.sensoryMotifs, []);
});

test('U471-F: admission is deterministic ×2 (same seed => identical objective draw, both modes)', () => {
  assert.equal(bootPure('tallow').scene?.objective, bootPure('tallow').scene?.objective,
    'tallow objective draw must be identical ×2');
  assert.equal(bootPure('driftwood', 0.6).scene?.objective, bootPure('driftwood', 0.6).scene?.objective,
    'driftwood objective draw must be identical ×2');
});
