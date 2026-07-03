// U389 — coherence-gate.mjs REAL-CORPUS regression lock (docs/briefs/COHERENCE_GATE.md
// §3/§6/§7 CG-P1). Runs the Tier-D checker over the four actual gate JSONLs this
// repo already has and asserts the EXACT counts this lane hand-verified turn by
// turn (see the per-class citations below — each traces to a specific persona+
// turn in docs/briefs/COHERENCE_GATE.md's evidence table). If this regresses,
// either a real detector change happened (update the baseline deliberately) or
// a detector broke silently (investigate before touching the asserted numbers).
// No LLM calls — reads committed fixture files only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadJsonlFile, runCoherenceGate } from '../scripts/coherence-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const GATE_RUNS = path.join(ROOT, 'docs', 'playtests', 'gate-runs');

const BRIDGE_FILE = path.join(GATE_RUNS, 'gate-2026-07-02T19-44-24-605Z-bridge.jsonl');
const V1_0702_FILE = path.join(GATE_RUNS, 'gate-2026-07-02T20-59-10-628Z-v1.jsonl');
const V1_0356_FILE = path.join(GATE_RUNS, 'gate-2026-07-03T03-56-04-236Z-v1.jsonl');
const V1_1145_FILE = path.join(GATE_RUNS, 'gate-2026-07-03T11-45-56-173Z-v1.jsonl');

test('U389: fixture JSONLs are present (skip guard for anyone pruning gate-runs/)', () => {
  for (const f of [BRIDGE_FILE, V1_0702_FILE, V1_0356_FILE, V1_1145_FILE]) {
    assert.ok(fs.existsSync(f), `missing ${f} — this test asserts the honest CG-P1 baseline over it`);
  }
});

// ── the headline file: gate-2026-07-03T11-45-...-v1.jsonl (post-ROM-3, carries
// interior/roomOccupants/material) — the design doc's P-A prediction target.
test('U389: 11-45 v1 run (post-ROM-3) — 48 turns, 7 state-grounded flags, honest floor 14/48', () => {
  const result = runCoherenceGate(loadJsonlFile(V1_1145_FILE));
  assert.equal(result.totalTurns, 48);
  assert.equal(result.sessionCount, 4);
  assert.equal(result.count, 7, `state-grounded flag count drifted — was 7 (CG-1b:2 CG-2a:2 CG-2c:1 CG-3a:1 CG-5:1) at CG-P1 baseline time; got ${result.count}`);
  assert.equal((result.byClass['CG-1a'] || []).length, 0);
  assert.equal((result.byClass['CG-1b'] || []).length, 2, 'CG-1b ghost-voice: rules-lawyer t8 (Elske) + chaos t3 (the Lingerer), both roomOccupants:[]');
  assert.equal((result.byClass['CG-1c'] || []).length, 0);
  assert.equal((result.byClass['CG-2a'] || []).length, 2, 'CG-2a place-noun: newbie t8 (Pantry narrated "front room") + newbie t9 (Bedchamber narrated "front room")');
  assert.equal((result.byClass['CG-2c'] || []).length, 1, 'CG-2c unnarrated relocation: newbie t9 (Pantry->Bedchamber, zero movement intent) — the overlap-confirmation turn');
  assert.equal((result.byClass['CG-3a'] || []).length, 1, 'CG-3a phantom-commit: rules-lawyer t10 (chest "gives"/"splinters" on an info-check/no-record route)');
  assert.equal((result.byClass['CG-4'] || []).length, 0);
  assert.equal((result.byClass['CG-5'] || []).length, 1, 'CG-5 addressee: lore-hound t6 (player addresses "The Lingerer", dialogue binds + DM voices Asha)');
  assert.equal((result.byClass['CG-7'] || []).length, 0);
  assert.equal((result.byClass['CG-0'] || []).length, 0);
  assert.equal(result.judgeFailedCount, 9, 'the v1 judge failed 9/48 turns on this run (unchanged from the Opus gate report)');
  assert.equal(result.honestFloor, 14, 'honest floor = |9 judge-fails ∪ 7 flags|, de-duplicated (newbie t9 double-counts once, not twice)');
  assert.equal(result.newSignalCount, 5, 'P-A: 5 distinct judge-PASSED turns newly flagged — rules-lawyer t8, chaos t3, lore-hound t6, newbie t8, rules-lawyer t10');
});

// ── the two 07-02 negative-control files: pre-ROM-3, NO interior/roomOccupants
// field at all. P-B: room/presence-dependent comparators must be dormant (0),
// not merely quiet — proving the checker degrades gracefully instead of
// fabricating structure it has no ground truth for.
test('U389: bridge run (pre-ROM-3, no interior field) — 48 turns, 0 state-grounded flags (negative control)', () => {
  const result = runCoherenceGate(loadJsonlFile(BRIDGE_FILE));
  assert.equal(result.totalTurns, 48);
  assert.equal(result.sessionCount, 4);
  assert.equal(result.count, 0, `expected the room/presence comparators to stay DORMANT with no interior field in the bundle; got ${result.count} flags — a comparator is fabricating structure it has no ground truth for`);
  assert.equal((result.byClass['CG-1b'] || []).length, 0);
  assert.equal((result.byClass['CG-2a'] || []).length, 0);
  assert.equal((result.byClass['CG-2c'] || []).length, 0);
  assert.equal(result.judgeFailedCount, 9, 'v1.bug_class fails on this run; v2.bug_class is uniformly JUDGE_ERROR and must NOT count as a judge fail');
  assert.equal(result.honestFloor, 9);
});

test('U389: 07-02 v1 run (pre-ROM-3, no interior field) — 48 turns, 1 state-grounded flag (CG-1c omission, outside-scope WARN)', () => {
  const result = runCoherenceGate(loadJsonlFile(V1_0702_FILE));
  assert.equal(result.totalTurns, 48);
  assert.equal(result.sessionCount, 4);
  assert.equal(result.count, 1, `expected only the outside-scope CG-1c WARN (rules-lawyer t4, npcsPresent-based, no interior needed); got ${result.count}`);
  assert.equal((result.byClass['CG-1c'] || []).length, 1);
  assert.equal((result.byClass['CG-1b'] || []).length, 0, 'CG-1b requires interior — must stay dormant');
  assert.equal((result.byClass['CG-2a'] || []).length, 0, 'CG-2a requires interior.roomName — must stay dormant');
  assert.equal(result.judgeFailedCount, 3);
  assert.equal(result.honestFloor, 4);
  assert.equal(result.newSignalCount, 1);
});

test('U389: 03-56 v1 run (pre-ROM-3, no interior field) — 48 turns, 0 state-grounded flags (third negative control)', () => {
  const result = runCoherenceGate(loadJsonlFile(V1_0356_FILE));
  assert.equal(result.totalTurns, 48);
  assert.equal(result.sessionCount, 4);
  assert.equal(result.count, 0, `all room/presence comparators must stay dormant with no interior field; got ${result.count}`);
  assert.equal(result.judgeFailedCount, 10);
  assert.equal(result.honestFloor, 10);
});

// The whole point of the instrument: assert the checker adds signal beyond the
// judge's own fails, on the one file where the design predicted it would (P-A).
test('U389: on the 11-45 run, coherence flags are NOT a subset of the v1-judge-failed turns — this instrument adds signal', () => {
  const parsed = loadJsonlFile(V1_1145_FILE);
  const result = runCoherenceGate(parsed);
  const judgeFailedTurns = new Set(
    parsed.turns
      .filter(t => t.v1 && t.v1.bug_class && t.v1.bug_class !== 'NONE')
      .map(t => `${t.persona}::${t.i}`),
  );
  const newSignal = result.flags.filter(f => !judgeFailedTurns.has(`${f.persona}::${f.turn}`));
  assert.ok(newSignal.length >= 2, `P-A falsification bar: expected >=2 new flags on judge-PASSED turns, got ${newSignal.length}`);
  assert.equal(newSignal.length, 5);
});

test('U389: every flag on all four files carries a resolvable persona + turn citation (no orphan flags)', () => {
  for (const file of [BRIDGE_FILE, V1_0702_FILE, V1_0356_FILE, V1_1145_FILE]) {
    const parsed = loadJsonlFile(file);
    const result = runCoherenceGate(parsed);
    const validPersonas = new Set(parsed.turns.map(t => t.persona));
    for (const f of result.flags) {
      assert.ok(validPersonas.has(f.persona), `flag persona "${f.persona}" must be a real persona in ${path.basename(file)}`);
      assert.ok(Number.isInteger(f.turn) && f.turn >= 0, `flag turn index must be a valid non-negative integer, got ${f.turn}`);
      assert.ok(f.span && f.span.length > 0, 'every flag must carry quoted offending prose');
      assert.ok(f.canonField, 'every flag must name the exact canon field it compared against');
      assert.ok(f.severity === 'fail' || f.severity === 'warn', `severity must be derived in code as fail/warn, got "${f.severity}"`);
    }
  }
});
