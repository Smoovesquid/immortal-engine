// U466 — PACK-1: admitted pack `threads` seed into the default game and survive
// a multi-turn tick without breaking invariants or ledger caps.
//
// Before PACK-1, engine/rulesets.js's normalizePack() whitelist silently
// dropped every pack's `threads` field, so the four authored fantasy
// sub-regions (westmarch/ashenmoor/crownlands/hallowed_reaches) that
// beginAdventure unconditionally merges into any fantasy-primary boot never
// reached the seeding seam at playloop.js:~287 — the default game booted with
// zero authored story threads. PACK-1 admits `threads` (shape-normalized) so
// those arcs go live. This test proves, through the REAL normalizePack idiom
// (the one public/v1.js and scripts/playtest.js use — not the raw-pack bypass
// U454 uses), that:
//   1. the default tallow demo boot AND the aldermere shippable-slice boot now
//      carry seeded threads (count > 0),
//   2. the seeding is deterministic (same seed => identical threads ×2),
//   3. a 20-turn worldTick run stays invariant-clean and honours ledger caps
//      (the THREAD_STARVATION / TIMELINE_RUNAWAY bug classes exist for exactly
//      this content pressure).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldTick } from '../engine/worldTick.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.join(__dirname, '..');

// The production idiom: every real caller routes packs through normalizePack.
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

function boot(seed, fate) {
  const PACKS = loadNormalizedPacks();
  const w = newWorld({ seed, fate, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } });
  return beginAdventure(w, PACKS).world;
}

const threadLabels = (w) => (w.instrument?.threads || []).map(t => t.label);

test('U466-A: default tallow boot now seeds authored pack threads (was 0 before PACK-1)', () => {
  const w = boot('tallow', 0.3);
  const labels = threadLabels(w);
  assert.ok(labels.length > 0, `default tallow boot must seed >=1 pack thread, got ${labels.length}`);
  // Sanity: the label is a real authored arc name (non-empty string), not a stub.
  assert.ok(labels.every(l => typeof l === 'string' && l.length > 0), 'thread labels must be non-empty strings');
});

test('U466-B: aldermere shippable-slice boot also seeds authored pack threads', () => {
  const w = boot('aldermere', 0.3);
  const labels = threadLabels(w);
  assert.ok(labels.length > 0, `aldermere-slice boot must seed >=1 pack thread, got ${labels.length}`);
});

test('U466-C: thread seeding is deterministic ×2 under a fixed seed (both boots)', () => {
  assert.deepEqual(threadLabels(boot('tallow', 0.3)), threadLabels(boot('tallow', 0.3)),
    'tallow thread seeding must be identical ×2');
  assert.deepEqual(threadLabels(boot('aldermere', 0.3)), threadLabels(boot('aldermere', 0.3)),
    'aldermere thread seeding must be identical ×2');
});

test('U466-D: thread count scales with fate (more inevitability => more open arcs)', () => {
  // playloop seeds 1 thread below fate 0.4, 2 at 0.4-0.69, 3 at >=0.7.
  assert.equal(threadLabels(boot('tallow', 0.3)).length, 1, 'fate 0.3 => 1 thread');
  assert.equal(threadLabels(boot('tallow', 0.5)).length, 2, 'fate 0.5 => 2 threads');
  assert.equal(threadLabels(boot('tallow', 0.8)).length, 3, 'fate 0.8 => 3 threads');
});

test('U466-E: a 20-turn worldTick run on a threaded boot stays invariant-clean and caps-honest', () => {
  let w = boot('tallow', 0.8); // blood band => max thread pressure, hardest case
  assert.ok(threadLabels(w).length >= 1, 'precondition: boot carries threads to tick against');

  for (let turn = 0; turn < 20; turn++) {
    w = worldTick(w, `${w.meta.seed}|u466|t${turn}`);
    // ensureWorld (called inside worldTick) already runs assertWorldInvariants,
    // but assert explicitly so a regression names THIS test.
    assert.doesNotThrow(() => assertWorldInvariants(w), `invariants must hold after tick ${turn}`);
    // Ledger caps: threats never exceed 8 (THREAD_STARVATION/RUNAWAY guard class).
    assert.ok((w.ledger?.threats || []).length <= 8, `threats cap (<=8) violated after tick ${turn}`);
    assert.ok((w.ledger?.facts || []).length <= 8, `facts cap (<=8) violated after tick ${turn}`);
    assert.ok((w.ledger?.questions || []).length <= 8, `questions cap (<=8) violated after tick ${turn}`);
    // Instrument thread cap holds (ensureInstrumentLayer caps at 12).
    assert.ok((w.instrument?.threads || []).length <= 12, `instrument thread cap (<=12) violated after tick ${turn}`);
  }
});

test('U466-F: a 20-turn tick run is itself deterministic (same seed => same thread labels end-state)', () => {
  const run = () => {
    let w = boot('tallow', 0.8);
    for (let turn = 0; turn < 20; turn++) w = worldTick(w, `${w.meta.seed}|u466det|t${turn}`);
    return threadLabels(w);
  };
  assert.deepEqual(run(), run(), '20-turn threaded tick run must be deterministic under a fixed seed');
});
