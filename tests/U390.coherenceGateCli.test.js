// U390 — coherence-gate.mjs CLI end-to-end. Spawns real subprocesses (node
// scripts/coherence-gate.mjs <jsonl...>) and asserts on stdout/exit code/
// written files — no LLM calls, no server, no network, no engine import.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const GATE_SCRIPT = path.join(ROOT, 'scripts', 'coherence-gate.mjs');
const GATE_RUNS = path.join(ROOT, 'docs', 'playtests', 'gate-runs');
const V1_1145_FILE = path.join(GATE_RUNS, 'gate-2026-07-03T11-45-56-173Z-v1.jsonl');

function writeFixtureJsonl(dir) {
  const file = path.join(dir, 'fixture.jsonl');
  const lines = [
    JSON.stringify({ type: 'run', runId: 'fixture-run', regime: 'v1', personas: ['chaos'], seeds: ['tallow'], engineVersion: '0.0.0' }),
    JSON.stringify({
      type: 'turn', seed: 'tallow', persona: 'chaos', i: 0,
      player: 'I look around.', dm: 'The front room opens before you.', mechanics: '', route: 'action',
      canon: { interior: { roomId: 'r2', roomName: 'Pantry' }, npcsPresent: [] },
      judgeError: false, v1: { bug_class: 'NONE' }, v2: null,
    }),
  ];
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

test('U390: coherence-gate.mjs CLI prints a readable report + MACHINE line for a real fixture', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u390-coherence-'));
  const file = writeFixtureJsonl(dir);
  const stdout = execFileSync(process.execPath, [GATE_SCRIPT, file], { cwd: ROOT, encoding: 'utf-8', timeout: 30_000 });
  assert.match(stdout, /# Coherence Gate/);
  assert.match(stdout, /State-grounded flags:\*\* 1/);
  assert.match(stdout, /\[chaos t1\]/);
  assert.match(stdout, /CG-2a/);
  assert.match(stdout, /\*\*MACHINE:\*\* coherence_flags=1/);
  assert.match(stdout, /^COHERENCE-GATE: 1 flag\(s\)/m);
});

test('U390: coherence-gate.mjs --out (single input) writes exactly to the given path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u390-coherence-out-'));
  const file = writeFixtureJsonl(dir);
  const outFile = path.join(dir, 'nested', 'report.md');
  execFileSync(process.execPath, [GATE_SCRIPT, file, '--out', outFile], { cwd: ROOT, encoding: 'utf-8', timeout: 30_000 });
  assert.ok(fs.existsSync(outFile), '--out should write the report, including creating a nested dir');
  const written = fs.readFileSync(outFile, 'utf-8');
  assert.match(written, /State-grounded flags:\*\* 1/);
});

test('U390: coherence-gate.mjs --out (multiple inputs) treats --out as a directory, one report per input', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u390-coherence-multi-'));
  const file1 = writeFixtureJsonl(dir);
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'u390-coherence-multi2-'));
  const file2 = writeFixtureJsonl(dir2);
  const outDir = path.join(dir, 'reports');
  execFileSync(process.execPath, [GATE_SCRIPT, file1, file2, '--out', outDir], { cwd: ROOT, encoding: 'utf-8', timeout: 30_000 });
  const written = fs.readdirSync(outDir);
  assert.equal(written.length, 2, 'one report per input file, non-clobbering');
});

test('U390: coherence-gate.mjs exits non-zero with a clear error on a missing file', () => {
  assert.throws(() => {
    execFileSync(process.execPath, [GATE_SCRIPT, '/no/such/file.jsonl'], { cwd: ROOT, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe' });
  }, /Command failed/);
});

test('U390: coherence-gate.mjs exits non-zero with a usage message when no path is given', () => {
  assert.throws(() => {
    execFileSync(process.execPath, [GATE_SCRIPT], { cwd: ROOT, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe' });
  }, /Command failed/);
});

// ── the real thing: run over all four committed gate JSONLs at once (the exact
// invocation named in the packet's verification ladder) ──────────────────────
test('U390: coherence-gate.mjs runs over all four real gate JSONLs and prints the honest floor for each', () => {
  const files = fs.readdirSync(GATE_RUNS).filter(f => f.endsWith('.jsonl')).map(f => path.join(GATE_RUNS, f));
  assert.equal(files.length, 4, 'expected exactly the four committed gate-runs JSONLs this packet targets');
  const stdout = execFileSync(process.execPath, [GATE_SCRIPT, ...files], { cwd: ROOT, encoding: 'utf-8', timeout: 60_000 });
  const coherenceLines = stdout.split('\n').filter(l => l.startsWith('COHERENCE-GATE:'));
  assert.equal(coherenceLines.length, 4, 'one summary line per input file');
  for (const line of coherenceLines) {
    assert.match(line, /honest floor \d+\/48/);
  }
});

test('U390: the 11-45 (post-ROM-3) file CLI run reports the P-A new-signal count', () => {
  const stdout = execFileSync(process.execPath, [GATE_SCRIPT, V1_1145_FILE], { cwd: ROOT, encoding: 'utf-8', timeout: 30_000 });
  assert.match(stdout, /new signal \(flagged, judge-PASSED\): 5/);
  assert.match(stdout, /^COHERENCE-GATE: 7 flag\(s\) across 48 turns — honest floor 14\/48/m);
});
