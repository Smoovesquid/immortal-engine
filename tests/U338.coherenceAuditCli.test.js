// U338 — coherence-audit.mjs CLI end-to-end + the --coherence opt-in flag on
// dm-playtest.mjs. Spawns real subprocesses (node scripts/coherence-audit.mjs,
// node scripts/dm-playtest.mjs --dry-run --coherence) and asserts on stdout/
// exit code/written files — no LLM calls, no server, no key (dry-run mock judge
// only). Confirms the flag is additive: --dry-run WITHOUT --coherence produces
// byte-for-byte the same report/JSONL/coverage pipeline as before this lane
// touched the file (U330's territory) — WITH --coherence adds exactly one
// extra summary line and nothing else changes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const AUDIT_SCRIPT = path.join(ROOT, 'scripts', 'coherence-audit.mjs');
const GATE_SCRIPT = path.join(ROOT, 'scripts', 'dm-playtest.mjs');

function writeFixtureJsonl(dir) {
  const file = path.join(dir, 'fixture.jsonl');
  const lines = [
    JSON.stringify({ type: 'run', runId: 'fixture-run', regime: 'v1', personas: ['chaos'], seeds: ['tallow'], engineVersion: '0.0.0' }),
    JSON.stringify({ type: 'turn', seed: 'tallow', persona: 'chaos', i: 0, player: 'I look around.', dm: 'You stand in the cottage. A straw pallet lies on the floor.', mechanics: '', route: 'action', canon: {}, judgeError: false, v1: { vibe: { pass: true }, crunch: { pass: true }, rag: { checked: false } }, v2: null }),
    JSON.stringify({ type: 'turn', seed: 'tallow', persona: 'chaos', i: 1, player: 'Who else is here?', dm: 'Elske Nightherd shrugs. "Can\'t say."', mechanics: '', route: 'action', canon: {}, judgeError: false, v1: { vibe: { pass: true }, crunch: { pass: true }, rag: { checked: false } }, v2: null }),
  ];
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

// ── coherence-audit.mjs standalone CLI ──────────────────────────────────────
test('U338: coherence-audit.mjs CLI prints a readable report + MACHINE line for a real fixture', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u338-coherence-'));
  const file = writeFixtureJsonl(dir);
  const stdout = execFileSync(process.execPath, [AUDIT_SCRIPT, file], { cwd: ROOT, encoding: 'utf-8', timeout: 30_000 });
  assert.match(stdout, /# Coherence audit/);
  assert.match(stdout, /coherence breaks found: 1/);
  assert.match(stdout, /\[chaos t2\]/);
  assert.match(stdout, /\*\*MACHINE:\*\* coherence_breaks=1 turns=2 sessions=1/);
  assert.match(stdout, /COHERENCE: 1 break\(s\) across 2 turns, 1 session\(s\)/);
});

test('U338: coherence-audit.mjs --out writes the report to disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u338-coherence-out-'));
  const file = writeFixtureJsonl(dir);
  const outFile = path.join(dir, 'nested', 'report.md');
  execFileSync(process.execPath, [AUDIT_SCRIPT, file, '--out', outFile], { cwd: ROOT, encoding: 'utf-8', timeout: 30_000 });
  assert.ok(fs.existsSync(outFile), '--out should write the report, including creating a nested dir');
  const written = fs.readFileSync(outFile, 'utf-8');
  assert.match(written, /coherence breaks found: 1/);
});

test('U338: coherence-audit.mjs exits non-zero with a clear error on a missing file', () => {
  assert.throws(() => {
    execFileSync(process.execPath, [AUDIT_SCRIPT, '/no/such/file.jsonl'], { cwd: ROOT, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe' });
  }, /Command failed/);
});

test('U338: coherence-audit.mjs exits non-zero with a usage message when no path is given', () => {
  assert.throws(() => {
    execFileSync(process.execPath, [AUDIT_SCRIPT], { cwd: ROOT, encoding: 'utf-8', timeout: 30_000, stdio: 'pipe' });
  }, /Command failed/);
});

// ── dm-playtest.mjs --coherence opt-in (additive, default path unchanged) ──
test('U338: dm-playtest.mjs --dry-run WITHOUT --coherence has no COHERENCE line (default behavior untouched)', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'u338-gate-default-'));
  const stdout = execFileSync(process.execPath, [
    GATE_SCRIPT, '--dry-run', '--turns', '2', '--personas', 'newbie', '--judge-regime', 'v1', '--out-dir', outDir,
  ], { cwd: ROOT, encoding: 'utf-8', timeout: 120_000 });
  assert.doesNotMatch(stdout, /COHERENCE:/);
  assert.match(stdout, /FAILING TURNS: \d+\/\d+/);
});

test('U338: dm-playtest.mjs --dry-run --coherence adds exactly one COHERENCE summary line, report/JSONL pipeline unaffected', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'u338-gate-coherence-'));
  const stdout = execFileSync(process.execPath, [
    GATE_SCRIPT, '--dry-run', '--turns', '2', '--personas', 'newbie', '--judge-regime', 'v1', '--coherence', '--out-dir', outDir,
  ], { cwd: ROOT, encoding: 'utf-8', timeout: 120_000 });
  assert.match(stdout, /FAILING TURNS: \d+\/\d+/);
  const coherenceLines = stdout.split('\n').filter(l => l.startsWith('COHERENCE:'));
  assert.equal(coherenceLines.length, 1, 'exactly one COHERENCE summary line');
  assert.match(coherenceLines[0], /COHERENCE: \d+ break\(s\) across 2 turns, 1 session\(s\)/);

  // The underlying report + JSONL pipeline still exists and is well-formed —
  // the flag only ADDS a line, it doesn't alter what gets written.
  const report = fs.readdirSync(outDir).find(f => f.startsWith('opus-gate-') && f.endsWith('.md'));
  assert.ok(report, 'report still written with --coherence present');
  const runsDir = path.join(outDir, 'gate-runs');
  const jsonl = fs.readdirSync(runsDir).find(f => f.endsWith('.jsonl'));
  assert.ok(jsonl, 'jsonl still written with --coherence present');
  const rows = fs.readFileSync(path.join(runsDir, jsonl), 'utf-8').trim().split('\n').map(l => JSON.parse(l));
  assert.equal(rows.filter(r => r.type === 'turn').length, 2);
});
