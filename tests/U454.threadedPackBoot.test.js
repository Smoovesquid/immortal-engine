// U454 — PL-RNG-1: threadRng.float → nextFloat (threaded-pack boot crash guard).
//
// engine/playloop.js's pack-threads seam (beginAdventure, ~line 292) called
// `threadRng.float()` to shuffle a merged pack's story threads, but
// engine/rng.js's makeRng() only ever exposed `nextFloat` — there is no
// `.float` method. `Array.prototype.sort` only invokes its comparator when
// the array has 2+ elements, so this was dormant on any boot where
// pack.threads ended up empty or singleton, and it CRASHED
// ("threadRng.float is not a function") on any boot where a threaded
// sub-region (crownlands/ashenmoor/hallowed_reaches/westmarch) contributed
// 2+ threads to the merged pack.
//
// Reachability note: today's real loaders (public/v1.js live app,
// scripts/playtest.js harness, and the tests/U429-style pack-loading idiom)
// all route packs through engine/rulesets.js's normalizePack(), which is a
// strict field whitelist that does NOT include `threads`, `locations`,
// `npcArchetypes`, `objectives`, `complications`, `sensoryMotifs`, `seeds`,
// `factions`, or `npcs` — so `pack.threads` is always undefined post-merge
// through that idiom, and the crashing branch (`Array.isArray(pack.threads)
// && pack.threads.length`) never fires in the current shipped app. The bug
// is real and live in the CODE (any caller that hands beginAdventure a raw,
// un-normalized pack object — e.g. a future loader, a save/import path, or
// a script that reads pack.json directly — hits it immediately), so this
// test exercises the seam directly with raw pack JSON (bypassing
// normalizePack) to prove the actual vulnerable line is now safe, rather
// than asserting on a path that was never reachable to begin with.
//
// Determinism: the default fantasy/tallow boot (through the real
// normalizePack idiom) never reaches the pack-threads branch, so its
// worldHash is provably unchanged by this fix. The threaded raw-pack boot
// is asserted deterministic ×2 under the same seed so this fix can't drift.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { makeRng, seedFromString } from '../engine/rng.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.join(__dirname, '..');

function loadManifest() {
  return normalizeManifest(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packs', 'manifest.json'), 'utf8')));
}

// Normalized packs — the idiom every real caller (public/v1.js, playtest.js,
// the rest of the test suite) uses. `threads` does not survive this.
function loadNormalizedPacks() {
  const m = loadManifest();
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, p.path), 'utf8')));
  return byId;
}

// Raw packs — bypasses normalizePack so `threads` (and every other
// whitelist-dropped field) survives intact. This is what actually reaches
// the crashing line: mergeSubRegion's `append('threads')` only has
// something to append when the source object still has a `threads` array.
function loadRawPacks() {
  const m = loadManifest();
  const byId = {};
  for (const p of m.packs) byId[p.id] = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, p.path), 'utf8'));
  return byId;
}

test('U454-A: raw threaded pack (crownlands merged into fantasy) boots without throwing', () => {
  const PACKS = loadRawPacks();
  assert.ok(Array.isArray(PACKS.crownlands.threads) && PACKS.crownlands.threads.length >= 2,
    'fixture check: crownlands pack.json must carry 2+ threads to exercise the sort() comparator');

  const w = newWorld({ seed: 'crownseed', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } });
  assert.doesNotThrow(() => beginAdventure(w, PACKS), /threadRng\.float is not a function/);

  const result = beginAdventure(w, PACKS);
  // Prove the seam actually ran (branch taken, not skipped) — a thread got seeded.
  assert.ok((result.world.instrument?.threads || []).length >= 1,
    'pack-threads seam should have seeded at least one thread into the instrument');
});

test('U454-B: raw threaded pack (ashenmoor merged into fantasy) boots without throwing', () => {
  const PACKS = loadRawPacks();
  assert.ok(Array.isArray(PACKS.ashenmoor.threads) && PACKS.ashenmoor.threads.length >= 2,
    'fixture check: ashenmoor pack.json must carry 2+ threads to exercise the sort() comparator');

  const w = newWorld({ seed: 'ashseed', fate: 0.5, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } });
  assert.doesNotThrow(() => beginAdventure(w, PACKS), /threadRng\.float is not a function/);
});

test('U454-C: threadRng seam returns a finite number in [0,1) — the actual API contract makeRng() honors', () => {
  const threadRng = makeRng(seedFromString('crownseed|pack-threads'));
  const v = threadRng.nextFloat();
  assert.equal(typeof v, 'number');
  assert.ok(Number.isFinite(v), 'nextFloat() must return a finite number');
  assert.ok(v >= 0 && v < 1, 'nextFloat() must return a value in [0,1)');
  // threadRng has no .float — confirms the old call site would have thrown,
  // and guards against the typo silently returning (e.g. via a stray shim).
  assert.equal(threadRng.float, undefined, 'makeRng() must not expose a .float method — nextFloat is the only API');
});

test('U454-D: deterministic ×2 — same seed through the threaded (raw-pack) crashing path yields identical worldHash', () => {
  const PACKS = loadRawPacks();
  const boot = () => {
    const w = newWorld({ seed: 'crownseed', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } });
    return beginAdventure(w, PACKS).world;
  };
  const h1 = worldHash(boot());
  const h2 = worldHash(boot());
  assert.equal(h1, h2, 'threaded pack boot must be deterministic under a fixed seed');
});

test('U454-E: default fantasy/tallow boot (real normalizePack idiom) is untouched by this fix — worldHash unchanged', () => {
  const PACKS = loadNormalizedPacks();
  // Confirm the reachability argument in code: normalizePack drops `threads`,
  // so the crashing branch is provably not taken on this path.
  assert.equal(PACKS.fantasy.threads, undefined, 'normalizePack must not carry a threads field through');
  assert.equal(PACKS.crownlands.threads, undefined, 'normalizePack must not carry a threads field through');

  const w = newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } });
  const result = beginAdventure(w, PACKS);
  // Captured from HEAD (pre-fix, via the identical normalizePack idiom) on
  // 2026-07-04 before editing engine/playloop.js line ~292:
  const HASH_BEFORE_FIX = '1de2d18248adf6a30d6e5673f77ac7670960e88a0da74f047a56071a3c20ce0a';
  assert.equal(worldHash(result.world), HASH_BEFORE_FIX,
    'default fantasy/tallow boot worldHash must be byte-identical before/after the threadRng.float->nextFloat fix (this path never reaches pack.threads)');
});
