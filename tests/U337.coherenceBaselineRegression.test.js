// U337 — coherence-audit.mjs REAL-CORPUS regression (docs/playtests/COHERENCE_SEAMS_2026-07-02.md
// + docs/playtests/COHERENCE_BASELINE_2026-07-02.md). Runs the analyzer over the
// two actual gate JSONLs this repo already has and asserts the EXACT counts this
// lane hand-verified against the seam catalog's cited turns (C1 chaos t9-10,
// bridge RL t9, lore-hound t1 both files; C2 chaos t2->t7; C3 bridge chaos t9->
// t11 the letter; C4 chaos t9 + newbie back-room; C5 RL t3->t9 scale flip). If
// this regresses, either a real detector change happened (update the baseline
// deliberately) or a detector broke silently (investigate before touching the
// asserted numbers). No LLM calls — reads committed fixture files only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadJsonlFile, analyzeCoherence } from '../scripts/coherence-audit.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const GATE_RUNS = path.join(ROOT, 'docs', 'playtests', 'gate-runs');

const V1_FILE = path.join(GATE_RUNS, 'gate-2026-07-02T20-59-10-628Z-v1.jsonl');
const BRIDGE_FILE = path.join(GATE_RUNS, 'gate-2026-07-02T19-44-24-605Z-bridge.jsonl');

test('U337: fixture JSONLs are present (skip guard for anyone pruning gate-runs/)', () => {
  assert.ok(fs.existsSync(V1_FILE), `missing ${V1_FILE} — this test asserts the honest Phase-0 baseline over it`);
  assert.ok(fs.existsSync(BRIDGE_FILE), `missing ${BRIDGE_FILE} — this test asserts the honest Phase-0 baseline over it`);
});

test('U337: v1 gate (gate-...-v1.jsonl) — 48 turns, 6 coherence breaks by seam', () => {
  const result = analyzeCoherence(loadJsonlFile(V1_FILE));
  assert.equal(result.totalTurns, 48);
  assert.equal(result.sessionCount, 4);
  assert.equal(result.count, 6, `coherence break count drifted — was 6 (C1:2 C2:1 C3:0 C4:2 C5:1) at baseline time; got ${result.count}`);
  assert.equal((result.bySeam.C1 || []).length, 2, 'C1 materialization: chaos t10 (Elske mid-scene) + lore-hound t1 (opens mid-conversation)');
  assert.equal((result.bySeam.C2 || []).length, 1, 'C2 material flip: chaos wall wooden(t2)->stone(t7)');
  assert.equal((result.bySeam.C3 || []).length, 0, 'C3 object relocation: no absence->reappearance pattern in this file');
  assert.equal((result.bySeam.C4 || []).length, 2, 'C4 location teleport: chaos t9 + newbie t2, both "back room" with no travel mechanics');
  assert.equal((result.bySeam.C5 || []).length, 1, 'C5 scale contradiction: rules-lawyer single building(t3)->handful of buildings(t9)');
});

test('U337: bridge gate (gate-...-bridge.jsonl) — 48 turns, 4 coherence breaks by seam', () => {
  const result = analyzeCoherence(loadJsonlFile(BRIDGE_FILE));
  assert.equal(result.totalTurns, 48);
  assert.equal(result.sessionCount, 4);
  assert.equal(result.count, 4, `coherence break count drifted — was 4 (C1:2 C2:0 C3:1 C4:1 C5:0) at baseline time; got ${result.count}`);
  assert.equal((result.bySeam.C1 || []).length, 2, 'C1 materialization: lore-hound t1 + rules-lawyer t9 (Elske answers though player says "I was alone")');
  assert.equal((result.bySeam.C2 || []).length, 0, 'C2 material flip: no tracked material contradiction in this file');
  assert.equal((result.bySeam.C3 || []).length, 1, 'C3 object relocation: chaos — letter absent(t9)->reappears in chest(t11)');
  assert.equal((result.bySeam.C4 || []).length, 1, 'C4 location teleport: newbie t2 "back room" with no travel mechanics');
  assert.equal((result.bySeam.C5 || []).length, 0, 'C5 scale contradiction: no scale-flip phrasing in this file');
});

test('U337: every flag on both files carries a resolvable persona + turn citation (no orphan flags)', () => {
  for (const file of [V1_FILE, BRIDGE_FILE]) {
    const parsed = loadJsonlFile(file);
    const result = analyzeCoherence(parsed);
    const validPersonas = new Set(parsed.turns.map(t => t.persona));
    for (const f of result.flags) {
      assert.ok(validPersonas.has(f.persona), `flag persona "${f.persona}" must be a real persona in ${path.basename(file)}`);
      assert.ok(Number.isInteger(f.turn) && f.turn >= 0, `flag turn index must be a valid non-negative integer, got ${f.turn}`);
      assert.ok(f.evidence && f.evidence.length > 0, 'every flag must carry quoted evidence text');
      assert.ok(f.detail && f.detail.length > 0, 'every flag must carry a human-readable detail string');
    }
  }
});

// The whole point of this instrument: the judge scored these runs 3/48 (v1) and
// (headline v1 leg) 9/48 (bridge) — VIBE/CRUNCH/RAG only. Assert the coherence
// analyzer is finding breaks the judge did not count, i.e. it adds signal rather
// than just re-deriving the existing bug_class fails.
test('U337: coherence breaks are NOT a subset of the judge-flagged (v1) failing turns — this instrument adds signal', () => {
  for (const file of [V1_FILE, BRIDGE_FILE]) {
    const parsed = loadJsonlFile(file);
    const result = analyzeCoherence(parsed);
    const judgeFailedTurns = new Set(
      parsed.turns
        .filter(t => t.v1 && (t.v1.vibe?.pass === false || t.v1.crunch?.pass === false || (t.v1.rag?.checked && t.v1.rag?.grounded === false)))
        .map(t => `${t.persona}::${t.i}`),
    );
    const newSignal = result.flags.filter(f => !judgeFailedTurns.has(`${f.persona}::${f.turn}`));
    assert.ok(newSignal.length > 0, `${path.basename(file)}: expected at least one coherence break on a turn the v1 judge scored as passing`);
  }
});
