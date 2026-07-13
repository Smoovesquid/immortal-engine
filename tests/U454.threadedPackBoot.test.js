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

test('U454-E: default fantasy/tallow boot (real normalizePack idiom) — post-PACK-1, threads are admitted and seed deterministically', () => {
  const PACKS = loadNormalizedPacks();
  // PACK-1 (2026-07-04) admitted `threads`/`factions` through normalizePack's
  // whitelist, so the crashing branch this file guards IS now reachable via the
  // production idiom — and the raw-pack safety proven in U454-A..D is what keeps
  // it from throwing. normalizePack now carries a (possibly empty) threads array
  // rather than dropping the field entirely.
  assert.ok(Array.isArray(PACKS.fantasy.threads), 'PACK-1: normalizePack now carries a threads array (fantasy base = empty)');
  assert.ok(Array.isArray(PACKS.crownlands.threads) && PACKS.crownlands.threads.length >= 2,
    'PACK-1: normalizePack now carries crownlands story threads through intact');

  const w = newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } });
  const result = beginAdventure(w, PACKS);
  // The fantasy default merges the four threaded sub-regions, so the tallow boot
  // now seeds authored story threads into the instrument (fate 0.3 => 1 thread).
  assert.ok((result.world.instrument?.threads || []).length >= 1,
    'PACK-1: default tallow boot must now seed at least one pack thread into the instrument');

  // RELOCKED for OCC-STORY-1 (2026-07-05): the default boot's worldHash shifts ONCE MORE (from the
  // MR-2a value ea4a2fec… to 86432691…) because settlement-NPC PLACEMENT is now story-driven, and the
  // boot MATERIALIZES each present NPC's tactical position (pos) from that placement (see
  // engine/map/spatial/tacticalPos.placementForWorld, fed by roomOccupancy). Previously every indoor
  // NPC piled into the one materialized building — the player's wake cottage — so e.g. "the Lingerer"
  // was stored at pos {frame:"struct:…cottage…"}; now the wake cottage holds no strangers and the
  // Lingerer stands out in the settlement, stored at pos {frame:"region",…}. worldHash includes those
  // NPC positions, so it moves. This is a deliberate PLACEMENT correction (occupancy stays a pure
  // derived read — no new stored fields, no WORLD_VERSION bump), NOT a determinism break: the boot
  // remains byte-identical to itself under replay (asserted ×2 below; U19/U21/U22/U27/U30 green).
  // (Prior anchors: PACK-3 ca6c4b5d… → FACT-1 7aa7b987… → MR-2a ea4a2fec… → OCC-STORY-1 86432691….)
  //
  // RE-PINNED for MP-3 (2026-07-06): the default boot's worldHash shifts ONCE MORE (86432691… →
  // d06096ee…) because MP-3 adds two additive morality fields — `huntedT` (the hunt latch) and
  // `heatCoolTicks` (the decay counter) — both defaulting to 0 on a no-deed boot. worldHash
  // projects the full party morality, so two new zero-valued keys move the fingerprint. This is a
  // deliberate additive-state re-pin (deterministically derived, old saves normalize to 0, NO
  // WORLD_VERSION bump), NOT a determinism break: heat is still 0 on this no-deed boot, no hunt
  // fires, and the boot is byte-identical to itself under replay (asserted ×2 below; MP-3's own
  // U565 pins the replay-equality of a scripted OVER-threshold hunt run).
  //
  // RE-PINNED AGAIN same day for CONSEQ-1 (2026-07-06, integration-time combined delta): MP-3 and
  // CONSEQ-1 landed in the same integration window, each carrying its own single-delta re-pin
  // computed WITHOUT the other's fields (MP-3 → d06096ee…; CONSEQ-1's worktree value likewise
  // partial). CONSEQ-1's normalizeThread now PRESERVES `age`/`objective`/`trajectory` (the fix —
  // they were stripped every ensureWorld), so three thread keys enter the fingerprint at their
  // boot defaults (0/''/'static'). The combined tree therefore pins 56d52255… — recomputed and
  // ×2-replay-asserted at integration by Basecamp; behavior on a no-deed, unaged boot is
  // otherwise identical. (Anchor chain: … OCC-STORY-1 86432691… → MP-3 d06096ee… →
  // MP-3+CONSEQ-1 56d52255….)
  //
  // RE-PINNED for MP-4 (2026-07-06): the default boot's worldHash shifts ONCE MORE (56d52255… →
  // db503a11…) because MP-4 adds ONE additive morality field — `pactT` (the pact latch: the
  // world-tick index at which the unbidden dark gift last arrived) — defaulting to 0 on a no-deed
  // boot. worldHash projects the full party morality, so one new zero-valued key moves the
  // fingerprint. This is a deliberate additive-state re-pin (deterministically derived, old saves
  // normalize to 0, NO WORLD_VERSION bump), NOT a determinism break: corruption is still 0 on this
  // no-deed boot, no gift fires, and the boot is byte-identical to itself under replay (asserted ×2
  // below; MP-4's own U572 pins the replay-equality of a scripted OVER-threshold pact run). SOLE
  // DELTA vs the MP-3+CONSEQ-1 tree is the pactT:0 key.
  // (Anchor chain: … MP-3 d06096ee… → MP-3+CONSEQ-1 56d52255… → MP-4 db503a11….)
  //
  // RE-PINNED for MP-5b (2026-07-06): the default boot's worldHash shifts ONCE MORE (db503a11… →
  // bbf2ef13…) because MP-5b adds TWO additive morality fields — `cassandraArmed` (the Cassandra's
  // HOLD flag) and `cassandraT` (the Cassandra's delivery latch, mirroring huntedT/pactT) — both
  // defaulting to false/0 on a no-deed boot. worldHash projects the full party morality, so two new
  // zero/false-valued keys move the fingerprint. This is a deliberate additive-state re-pin
  // (deterministically derived, old saves normalize to false/0, NO WORLD_VERSION bump), NOT a
  // determinism break: heat is still 0 on this no-deed boot, no Cassandra ever arms, and the boot is
  // byte-identical to itself under replay (asserted ×2 below; MP-5b's own U585 pins the
  // replay-equality of scripted warned-then-cooled and warned-then-hunted runs). SOLE DELTA vs the
  // MP-4 tree is the cassandraArmed:false + cassandraT:0 keys. NOTE: if another packet's fields land
  // ahead of this at integration, Basecamp recomputes this anchor (it has happened twice already
  // today, per this file's own history).
  // (Anchor chain: … MP-3+CONSEQ-1 56d52255… → MP-4 db503a11… → MP-5b bbf2ef13….)
  //
  // RE-PINNED for SP-2 (2026-07-06, WORLD_VERSION 31 → 32): the default boot's worldHash shifts ONCE
  // MORE (bbf2ef13… → 7fc17002…) because SP-2 adds ONE additive faction field — `ethos`
  // ('lawful'|'outlaw'|'neutral', the differential-reaction sign selector) — to every entry of
  // w.factions[]. worldHash projects w.factions WHOLESALE (worldHash.js:28 / .browser.js:26), so the
  // new key on each of the 12 booted factions moves the fingerprint. ethos is DERIVED
  // deterministically from each faction's id+goal (ensureFactions → deriveFactionEthos), defaulting to
  // 'neutral'; on this boot civic=lawful, shadow=outlaw, the pack factions split by their authored
  // agendas. This is a deliberate additive-state re-pin (the ONE named WORLD_VERSION bump in the
  // Social Physics Contract), NOT a determinism break: the boot is byte-identical to itself under
  // replay (asserted ×2 below; SP-2's own U615 pins the replay-equality of a scripted differential
  // atrocity run, U616 the save-upgrade path). SOLE DELTA vs the MP-5b tree is the per-faction ethos
  // key. NOTE: if another packet's fields land ahead of this at integration, Basecamp recomputes this
  // anchor (it has happened repeatedly, per this file's own history).
  // RE-PINNED for OBJ-STATE-1 (2026-07-13, WORLD_VERSION 32 → 33): the default boot's
  // worldHash shifts ONCE MORE. Sole deltas: meta.version 32→33 and the canonical
  // live-object overlay `world.objects` (empty {} on a fresh boot, but hash-visible via
  // projectForHash) — plus a stable `objectId` on any node.furniture piece, though the
  // tallow boot has no seeded furniture yet so that channel is inert here. Deliberate
  // additive-state re-pin (the ONE named WORLD_VERSION bump of the object-physics arc),
  // NOT a determinism break: the boot is byte-identical to itself under replay (asserted
  // ×2 below; U694-I pins the v32→v33 migration + save round-trip).
  // (Anchor chain: … MP-4 db503a11… → MP-5b bbf2ef13… → SP-2 7fc17002… → OBJ-STATE-1 7f911937….)
  const HASH_AFTER_OBJSTATE1 = '7f911937f2150a8d25cb489559c4ff74bb2956548bdba08e57f8e33b94a975ae';
  assert.equal(worldHash(result.world), HASH_AFTER_OBJSTATE1,
    'default fantasy/tallow boot worldHash re-pinned post-OBJ-STATE-1 (additive world.objects + objectId, WORLD_VERSION 33)');

  // Same seed => identical world (the placement is deterministic).
  const w2 = newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } });
  assert.equal(worldHash(beginAdventure(w2, PACKS).world), HASH_AFTER_OBJSTATE1,
    'default tallow boot must be deterministic ×2 after OBJ-STATE-1');
});
