// U330 — the debiased-gate regime scaffolding (docs/briefs/EVAL_REGIME_CONTRACT.md,
// packets P-EV1/P-EV2/P-EV4). Everything here is LLM-OFF and $0: pure-function
// checks over the atomic-verdict derivation + a full --dry-run spawn of the
// harness (mock judge, no server, no key) proving the report/JSONL/coverage
// pipeline runs end-to-end. The PAID gate is never touched by this file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  deriveVerdictFromAtoms, modeSignature, pickIssue, failedAtoms, mockAtoms,
  GATE_JUDGE_SYSTEM_V2, ATOM_NAMES,
} from '../scripts/dm-playtest.mjs';
import { BUG_CLASSES } from '../engine/ref/rubric.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const allPass = () => ({
  intent_addressed: true, resolved_in_fiction: true, no_machine_leak: true,
  dice_fiction_match: true, state_change_reflected: true, attack_declared_unresolved: false,
  factual_claim_made: false, claims_grounded: true,
});

// ── deriveVerdictFromAtoms — the deterministic verdict core ────────────────────
test('U330: all-pass atoms → NONE / none / all axes pass / no mode', () => {
  const v = deriveVerdictFromAtoms(allPass());
  assert.equal(v.bug_class, 'NONE');
  assert.equal(v.severity, 'none');
  assert.equal(v.vibe.pass, true);
  assert.equal(v.crunch.pass, true);
  assert.equal(v.rag.checked, false);
  assert.equal(modeSignature(v), null);
});

test('U330: an ungrounded specific outranks every other class (CANON_HALLUCINATION)', () => {
  const v = deriveVerdictFromAtoms({
    ...allPass(), factual_claim_made: true, claims_grounded: false,
    resolved_in_fiction: false, no_machine_leak: false, dice_fiction_match: false,
  });
  assert.equal(v.bug_class, 'CANON_HALLUCINATION');
  assert.equal(v.rag.checked, true);
  assert.equal(v.rag.grounded, false);
});

test('U330: a declared attack that fizzles → COMBAT_NOT_STARTED, crunch axis fails', () => {
  const v = deriveVerdictFromAtoms({ ...allPass(), attack_declared_unresolved: true });
  assert.equal(v.bug_class, 'COMBAT_NOT_STARTED');
  assert.equal(v.crunch.pass, false);
  assert.equal(v.vibe.pass, true);
});

test('U330: dice/fiction mismatch → CRUNCH_INCONSISTENCY; leak → DM_ARTIFACT_LEAK; bounce → DM_TEST_DEADEND', () => {
  assert.equal(deriveVerdictFromAtoms({ ...allPass(), dice_fiction_match: false }).bug_class, 'CRUNCH_INCONSISTENCY');
  assert.equal(deriveVerdictFromAtoms({ ...allPass(), state_change_reflected: false }).bug_class, 'CRUNCH_INCONSISTENCY');
  assert.equal(deriveVerdictFromAtoms({ ...allPass(), no_machine_leak: false }).bug_class, 'DM_ARTIFACT_LEAK');
  assert.equal(deriveVerdictFromAtoms({ ...allPass(), resolved_in_fiction: false }).bug_class, 'DM_TEST_DEADEND');
  assert.equal(deriveVerdictFromAtoms({ ...allPass(), intent_addressed: false }).bug_class, 'DM_TEST_DEADEND');
});

test('U330: severity is derived from failed-axis count — 1 axis med, ≥2 axes high', () => {
  assert.equal(deriveVerdictFromAtoms({ ...allPass(), resolved_in_fiction: false }).severity, 'med');
  assert.equal(deriveVerdictFromAtoms({ ...allPass(), resolved_in_fiction: false, dice_fiction_match: false }).severity, 'high');
  assert.equal(deriveVerdictFromAtoms({ ...allPass(), factual_claim_made: true, claims_grounded: false, no_machine_leak: false }).severity, 'high');
});

test('U330: totality — every one of the 256 atom combinations maps to a legal verdict', () => {
  const legalSeverity = new Set(['none', 'med', 'high']);
  for (let mask = 0; mask < 2 ** ATOM_NAMES.length; mask++) {
    const atoms = Object.fromEntries(ATOM_NAMES.map((k, i) => [k, Boolean(mask & (1 << i))]));
    const v = deriveVerdictFromAtoms(atoms);
    assert.ok(BUG_CLASSES.includes(v.bug_class), `illegal class ${v.bug_class}`);
    assert.notEqual(v.bug_class, 'CRASH', 'CRASH is harness-set, never derivable from atoms');
    assert.ok(legalSeverity.has(v.severity), `illegal severity ${v.severity}`);
    assert.equal(typeof v.vibe.pass, 'boolean');
    assert.equal(typeof v.crunch.pass, 'boolean');
    assert.equal(typeof v.rag.checked, 'boolean');
    // A derived failure always carries a mode; a NONE never does.
    const failing = v.vibe.pass === false || v.crunch.pass === false || (v.rag.checked && v.rag.grounded === false);
    assert.equal(v.bug_class === 'NONE', !failing);
    assert.equal(modeSignature(v) === null, v.bug_class === 'NONE');
  }
});

// ── failedAtoms / modeSignature — the coverage unit ────────────────────────────
test('U330: failedAtoms respects membership-atom semantics', () => {
  // factual_claim_made:false is NOT a failure; claims_grounded:false without a claim is NOT a failure.
  assert.deepEqual(failedAtoms({ ...allPass(), factual_claim_made: false, claims_grounded: false }), []);
  assert.deepEqual(failedAtoms({ ...allPass(), attack_declared_unresolved: true }), ['attack_declared_unresolved']);
  assert.deepEqual(failedAtoms({ ...allPass(), factual_claim_made: true, claims_grounded: false }), ['claims_grounded']);
});

test('U330: modeSignature — atoms give a stable fine signature; v1 verdicts fall back to class; JUDGE_ERROR yields none', () => {
  const v2 = deriveVerdictFromAtoms({ ...allPass(), resolved_in_fiction: false, intent_addressed: false });
  assert.equal(modeSignature(v2), 'DM_TEST_DEADEND:intent_addressed+resolved_in_fiction'); // sorted
  assert.equal(modeSignature({ bug_class: 'DM_TEST_DEADEND' }), 'DM_TEST_DEADEND');        // v1 coarse
  assert.equal(modeSignature({ bug_class: 'JUDGE_ERROR' }), null);
});

// ── pickIssue — the W4 report-attribution regression ───────────────────────────
test('U330: pickIssue prints the FAILING axis, never a passing axis\'s explanation', () => {
  const v = {
    vibe: { pass: false, issue: 'bounced intent as a nav prompt' },
    crunch: { pass: true, issue: 'No roll needed; reading a legible letter is consistent' },
    rag: { checked: false }, note: 'terse note',
  };
  assert.equal(pickIssue(v), 'bounced intent as a nav prompt'); // the old first-non-empty pick returned the crunch PASS text
  const ragFail = { vibe: { pass: true, issue: '' }, crunch: { pass: true, issue: '' }, rag: { checked: true, grounded: false, issue: 'invented a name' }, note: '' };
  assert.equal(pickIssue(ragFail), 'invented a name');
});

// ── Rubric lint (RIFT-style: test the rubric, not just the judge) ──────────────
test('U330: the v2 judge prompt is atomic, verdict-only, no elicited reasoning, carve-outs present', () => {
  for (const k of ATOM_NAMES) assert.ok(GATE_JUDGE_SYSTEM_V2.includes(k), `prompt missing atom ${k}`);
  assert.ok(/ONLY the JSON/i.test(GATE_JUDGE_SYSTEM_V2), 'must demand verdict-only output');
  assert.ok(!/step by step|think through|explain your reasoning|show your work/i.test(GATE_JUDGE_SYSTEM_V2), 'must not elicit reasoning');
  // The four production false-positive carve-outs (EVAL_REGIME_CONTRACT §1.2) are inherited:
  for (const marker of ['nearbyPlaces', 'lastRoll', 'consumables', 'hyperbole']) {
    assert.ok(GATE_JUDGE_SYSTEM_V2.includes(marker), `carve-out missing: ${marker}`);
  }
});

test('U330: mockAtoms is deterministic and exercises both pass and fail paths over the dry-run script', () => {
  assert.deepEqual(mockAtoms('can I look around?'), mockAtoms('can I look around?'));
  const script = ['can I look around?', 'who is here with me?', 'what am I carrying?',
    'I walk to the doorway and look through it.', 'I attack the nearest person here.', 'what do I know about this place?'];
  const classes = script.map(l => deriveVerdictFromAtoms(mockAtoms(l)).bug_class);
  assert.ok(classes.includes('NONE'), 'mock must pass some turns');
  assert.ok(classes.some(c => c !== 'NONE'), 'mock must fail some turns');
});

// ── End-to-end dry run: the whole pipeline for $0 (NO paid gate) ───────────────
test('U330: --dry-run bridge produces a report, a per-turn JSONL audit trail, and a mode ledger', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'u330-gate-'));
  try {
    const stdout = execFileSync(process.execPath, [
      path.join(ROOT, 'scripts', 'dm-playtest.mjs'),
      '--dry-run', '--turns', '3', '--personas', 'newbie', '--judge-regime', 'bridge',
      '--out-dir', outDir,
    ], { cwd: ROOT, encoding: 'utf-8', timeout: 120_000 });
    assert.match(stdout, /DRY-RUN/);
    assert.match(stdout, /FAILING TURNS: \d+\/\d+/);
    assert.match(stdout, /MODES: \d+ this run/);

    // Report: exists, marked as bridge + dry-run, agreement + coverage sections present.
    const report = fs.readdirSync(outDir).find(f => f.startsWith('opus-gate-') && f.endsWith('.md'));
    assert.ok(report, 'report written');
    const md = fs.readFileSync(path.join(outDir, report), 'utf-8');
    assert.match(md, /REGIME BRIDGE/);
    assert.match(md, /DRY-RUN/);
    assert.match(md, /judge = claude-opus-4-8 \(v1 holistic, headline\) \+ claude-fable-5 \(v2 atomic\)/);
    assert.match(md, /## Judge agreement/);
    assert.match(md, /## Coverage/);
    assert.match(md, /Chao1/);

    // JSONL audit trail: 1 run header + 3 turn lines, each carrying canon + BOTH verdicts.
    const runsDir = path.join(outDir, 'gate-runs');
    const jsonl = fs.readdirSync(runsDir).find(f => f.endsWith('.jsonl'));
    assert.ok(jsonl, 'jsonl written');
    const rows = fs.readFileSync(path.join(runsDir, jsonl), 'utf-8').trim().split('\n').map(l => JSON.parse(l));
    const header = rows[0];
    assert.equal(header.type, 'run');
    assert.equal(header.regime, 'bridge');
    assert.equal(header.playerModel, 'claude-opus-4-8');
    assert.equal(header.judgeModel, 'claude-fable-5');
    const turns = rows.filter(r => r.type === 'turn');
    assert.equal(turns.length, 3);
    for (const t of turns) {
      assert.ok(t.canon && typeof t.canon === 'object', 'canon bundle persisted');
      assert.ok(t.v1 && t.v2, 'bridge persists both verdicts');
      assert.ok(typeof t.dm === 'string' && t.dm.length > 0, 'full DM text persisted (no truncation)');
    }

    // Mode ledger: valid JSON, one run entry, modes match the JSONL's failing v2 verdicts.
    const ledger = JSON.parse(fs.readFileSync(path.join(outDir, 'gate-modes.json'), 'utf-8'));
    assert.equal(ledger.runs.length, 1);
    const expectedModes = [...new Set(turns.map(t => modeSignature(t.v2)).filter(Boolean))].sort();
    assert.deepEqual(ledger.runs[0].modes, expectedModes);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
