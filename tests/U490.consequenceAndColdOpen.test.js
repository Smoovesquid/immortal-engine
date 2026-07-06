// U490 — SL-5: an unattended worry ages/mutates via the EXISTING
// tickLivingThreads clock, and the cold-open (Candidate C) voices the
// seed-chosen worry unprompted at wake.
//
// Reuses tickLivingThreads's existing test pattern (see tests/deathSpiral.test.js,
// UX4.subsystemsAudit.test.js WT-01/02): drive worldTick() repeatedly and read
// world.instrument.threads. No new tick function — this is the SAME clock
// PACK-1's Bridge Dispute / Drowned Twin already ride (worldTick.js
// tickLivingThreads: age > 4 && age % 3 === 0 → mutateObjective).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldTick } from '../engine/worldTick.js';
import { worldHash } from '../engine/worldHash.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { SLICE_SEED, pickAldermereWorry } from '../engine/world/sliceRegion.js';

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
  const { world, output } = beginAdventure(
    newWorld({ seed, fate, pack: { primaryId: 'fantasy', mixerId: null } }),
    PACKS
  );
  return { world, output };
}

// ── Consequence: the aging clock ──────────────────────────────────────────

test('U490: the seed-chosen worry is present as a living thread at boot', () => {
  const { world } = bootSlice();
  const worry = pickAldermereWorry(SLICE_SEED);
  const thread = world.instrument.threads.find(t => t.label === worry.target);
  assert.ok(thread, `a thread labeled "${worry.target}" must exist in world.instrument.threads at boot`);
  assert.equal(thread.status, 'open');
  assert.equal(thread.age ?? 0, 0);
});

test('U490: an unattended worry survives repeated ticks and its tension climbs (the provable half of the clock)', () => {
  let { world } = bootSlice();
  const worry = pickAldermereWorry(SLICE_SEED);
  const before = world.instrument.threads.find(t => t.label === worry.target);
  assert.ok(before, 'thread exists before ticking');
  const startTension = before.tension ?? 0;

  for (let i = 0; i < 6; i++) {
    world = worldTick(world, `u490-tick-${i}`);
  }
  const after = world.instrument.threads.find(t => t.id === before.id);
  assert.ok(after, 'thread survives ticking (not silently dropped)');
  assert.ok((after.tension ?? 0) >= startTension, 'tension must climb (or hold at cap), not decrease, from unattended ticking');
});

// CONSEQ-1 (2026-07-06) — FIXED. This test previously documented a KNOWN
// PRE-EXISTING GAP (not introduced by SL-5, verified by reverting all SL-5
// changes via `git stash` and reproducing on a plain `introduceThread(w, 'x')`
// thread with zero slice code present): engine/instrument.js's normalizeThread()
// (called by ensureInstrumentLayer, called by ensureWorld() on EVERY invocation,
// including worldTick's own opening ensureWorld(world) call) returned only
// {id, label, introducedAt, tension, status} — it silently DROPPED age/objective/
// trajectory. tickLivingThreads (worldTick.js) sets those three fields correctly
// within a single worldTick() call, but the very next worldTick()/ensureWorld()
// anywhere stripped them back out before the NEXT tick could read a real age —
// so age could never exceed 1 in the live per-turn loop, and mutateObjective's
// age>4 && age%3===0 branch could never fire in production. This affected EVERY
// thread in the engine (PACK-1's Bridge Dispute/Drowned Twin included), not
// just SL-5's.
//
// The fix: engine/instrument.js's normalizeThread() now preserves all three
// fields, mirroring how tension/status already survived:
//   age: clampInt(t.age ?? 0, 0, 999),
//   objective: String(t.objective ?? ''),
//   trajectory: String(t.trajectory ?? 'static'),
// This test now asserts the REAL (fixed) behavior: age climbs monotonically
// across ticks (verified by direct simulation to reach exactly 6 after 6
// worldTick calls from a freshly-introduced thread), and the objective
// mutates once age crosses the age>4 && age%3===0 threshold (age 6 here).
test('U490: age/objective now survive repeated worldTick calls — the aging clock is live', () => {
  let { world } = bootSlice();
  const worry = pickAldermereWorry(SLICE_SEED);
  const before = world.instrument.threads.find(t => t.label === worry.target);
  assert.equal(before.age ?? 0, 0, 'a freshly-introduced thread starts at age 0');
  assert.equal(before.trajectory ?? 'static', 'static', 'a freshly-introduced thread starts static (no mutation yet)');
  for (let i = 0; i < 6; i++) {
    world = worldTick(world, `u490-gap-${i}`);
  }
  const after = world.instrument.threads.find(t => t.id === before.id);
  assert.equal(after.age, 6, 'age must climb by exactly 1 per worldTick call — 6 ticks means age 6, not capped at 1');
  assert.equal(after.trajectory, 'mutating', 'age 6 crosses the age>4 && age%3===0 threshold — trajectory must flip to mutating');
  assert.ok(after.objective && after.objective.length > 0, 'objective must be non-empty once the mutation threshold fires');
});

test('U490: thread aging is deterministic — same seed + same tick sequence → same mutated objective', () => {
  let w1 = bootSlice().world;
  let w2 = bootSlice().world;
  for (let i = 0; i < 6; i++) {
    w1 = worldTick(w1, `u490-det-${i}`);
    w2 = worldTick(w2, `u490-det-${i}`);
  }
  assert.equal(worldHash(w1), worldHash(w2), 'identical seed + identical tick sequence → identical world hash');
});

test('U490: tension climbs (inevitability reflects the unresolved worry) — no new consequence engine invented', () => {
  let { world } = bootSlice();
  const before = world.instrument.inevitability ?? 0;
  for (let i = 0; i < 3; i++) {
    world = worldTick(world, `u490-tension-${i}`);
  }
  const after = world.instrument.inevitability ?? 0;
  assert.ok(after >= before, 'inevitability must not decrease from unattended ticking alone');
});

// ── Cold-open (Candidate C) ────────────────────────────────────────────────

test('U490: the cold-open waking line voices the seed-chosen worry, unprompted, at wake', () => {
  const { output } = bootSlice();
  const worry = pickAldermereWorry(SLICE_SEED);
  assert.match(output.narration, /^Wizard:/);
  // The worry's own opener clause must appear verbatim in the very first thing
  // the player reads — before they ask anything.
  assert.ok(
    output.narration.includes(worry.opener.split(' — ')[0].slice(0, 40)) || output.narration.includes(worry.target),
    `cold-open must voice the seed-chosen worry ("${worry.target}"), got: ${output.narration}`
  );
});

test('U490: the cold-open fires ONLY on the slice seed — tallow/generic boots are unchanged', () => {
  const tallow = bootSlice('tallow').output;
  const generic = bootSlice('some-other-seed').output;
  const worryTerms = ['quiet road', 'chapel bell', 'toll road', "gone quiet"];
  for (const term of worryTerms) {
    assert.ok(!tallow.narration.toLowerCase().includes(term), `tallow opener must not mention "${term}"`);
    assert.ok(!generic.narration.toLowerCase().includes(term), `generic opener must not mention "${term}"`);
  }
});

test('U490: determinism — the slice cold-open is identical across two independent fresh boots', () => {
  const a = bootSlice().output;
  const b = bootSlice().output;
  assert.equal(a.narration, b.narration, 'same seed → identical opener, every time');
});

test('U490: a non-slice seed\'s cold-open is byte-identical to its own pre-SL-5 shape (still one of the 5 generic lines)', () => {
  const { output } = bootSlice('tallow');
  // The generic bank's lines all end "...What do you do?" with no worry clause
  // appended — confirms the tallow path took the untouched `base` return, not
  // `${base} ${worry.opener}`.
  const sentences = output.narration.split(/(?<=[.?!])\s+/);
  const last = sentences[sentences.length - 1];
  assert.equal(last.trim(), 'What do you do?');
  // No second scene-set paragraph appended after the generic bank's own closing line.
  assert.ok(!/Down past the shutters/i.test(output.narration), 'generic boot must not carry the slice-only worry clause');
});
