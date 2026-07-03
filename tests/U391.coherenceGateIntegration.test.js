// U391 — CG-P3: standing-gate integration (docs/briefs/COHERENCE_GATE.md §5,
// docs/PACKETS.md "CG-P3"). Everything here is LLM-OFF and $0: a full --dry-run
// spawn of the harness proving `--coherence` runs BOTH tiers (the transcript
// auditor + CG-P1's state-grounded checker) over the JSONL the run just wrote,
// prints the "Coherence (state-grounded)" section + the honest-floor line, and
// appends the namespaced coherence-modes.json ledger — all for $0, with the
// default (un-flagged) gate output staying byte-identical except for the
// run-id/timestamp that's already non-deterministic across any two runs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function runDry(outDir, extraArgs = []) {
  return execFileSync(process.execPath, [
    path.join(ROOT, 'scripts', 'dm-playtest.mjs'),
    '--dry-run', '--turns', '5', '--personas', 'newbie',
    '--out-dir', outDir,
    ...extraArgs,
  ], { cwd: ROOT, encoding: 'utf-8', timeout: 120_000 });
}

// Strip the parts of stdout that are legitimately non-deterministic across
// two separate spawns (runId embeds a millisecond timestamp) so the rest can
// be compared for byte-identity.
function stripVolatile(stdout) {
  return stdout
    .replace(/gate-[0-9TZ:.\-]+-v1(-dryrun)?/g, 'gate-<RUNID>')
    .replace(/opus-gate-\d{4}-\d{2}-\d{2}(-dryrun)?\.md/g, 'opus-gate-<DATE>.md')
    .replace(/u391-baseline-[A-Za-z0-9]+/g, 'u391-baseline-<TMP>');
}

test('U391: --dry-run --coherence exercises the FULL path for $0 and prints the honest-floor line', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'u391-coherence-'));
  try {
    const stdout = runDry(outDir, ['--coherence']);

    // Both tiers ran and printed.
    assert.match(stdout, /^COHERENCE: \d+ break\(s\) across \d+ turns/m, 'transcript-tier summary printed');
    assert.match(stdout, /## Coherence \(state-grounded\)/, 'state-grounded section header printed');
    assert.match(stdout, /^COHERENCE-GATE: \d+ flag\(s\) across \d+ turns — honest floor \d+\/\d+/m, 'CG-P1 summary line printed');
    assert.match(stdout, /^HONEST FLOOR \(judge ∪ transcript ∪ state-grounded, de-duped\): \d+\/5$/m, 'combined honest-floor line printed');
    assert.match(stdout, /^CG MODES: \d+ this run/m, 'CG modes line printed');

    // The namespaced ledger was created (additive, never touching gate-modes.json).
    const cgLedgerPath = path.join(outDir, 'coherence-modes.json');
    assert.ok(fs.existsSync(cgLedgerPath), 'coherence-modes.json written');
    const cgLedger = JSON.parse(fs.readFileSync(cgLedgerPath, 'utf-8'));
    assert.equal(cgLedger.runs.length, 1);
    assert.equal(cgLedger.runs[0].regime, 'v1');
    assert.equal(cgLedger.runs[0].dryRun, true);
    assert.ok(Array.isArray(cgLedger.runs[0].modes));
    assert.ok(cgLedger.classCounts && typeof cgLedger.classCounts === 'object');
    assert.match(cgLedger.note, /CG-\*/);

    // gate-modes.json (the OTHER instrument's ledger) still exists and is untouched
    // in shape — this run must not leak CG-* signatures into it.
    const gateLedgerPath = path.join(outDir, 'gate-modes.json');
    assert.ok(fs.existsSync(gateLedgerPath), 'gate-modes.json still written by the existing pipeline');
    const gateLedger = JSON.parse(fs.readFileSync(gateLedgerPath, 'utf-8'));
    for (const run of gateLedger.runs) {
      for (const m of run.modes || []) {
        assert.ok(!String(m).startsWith('CG-'), `gate-modes.json must never carry a CG-* mode, saw ${m}`);
      }
    }
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('U391: the un-flagged --dry-run path is unchanged by the --coherence integration', () => {
  const outDirA = fs.mkdtempSync(path.join(os.tmpdir(), 'u391-baseline-'));
  const outDirB = fs.mkdtempSync(path.join(os.tmpdir(), 'u391-baseline-'));
  try {
    const withoutFlag = stripVolatile(runDry(outDirA));
    const withFlagButStrippedOfExtras = stripVolatile(runDry(outDirB))
      .split('\n')
      .filter(line => !/^COHERENCE|^## Coherence|^COHERENCE-GATE|^HONEST FLOOR|^CG MODES/.test(line))
      .join('\n');

    assert.equal(withFlagButStrippedOfExtras, withoutFlag,
      'once the coherence-only lines are removed, the two stdout streams must be byte-identical');

    // Neither run's coherence ledger exists when the flag is absent.
    assert.ok(!fs.existsSync(path.join(outDirA, 'coherence-modes.json')), 'no CG ledger written without --coherence');
  } finally {
    fs.rmSync(outDirA, { recursive: true, force: true });
    fs.rmSync(outDirB, { recursive: true, force: true });
  }
});
