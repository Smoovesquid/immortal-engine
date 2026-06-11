// Self-test for cc-router.mjs — no external test framework.

import { inferRoute, buildCommandPreview, parseArgs } from './cc-router.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const ROUTER = path.join(path.dirname(__filename), 'cc-router.mjs');

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    console.error(`        expected: ${JSON.stringify(expected)}`);
    console.error(`        actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertNonzero(label, code) {
  if (typeof code === 'number' && code !== 0) {
    console.log(`  PASS  ${label} (exit ${code})`);
    passed++;
  } else {
    console.error(`  FAIL  ${label} — expected nonzero exit, got ${code}`);
    failed++;
  }
}

function run(...args) {
  return spawnSync(process.execPath, [ROUTER, ...args], { encoding: 'utf8' });
}

// --- inferRoute ---
console.log('\n[inferRoute]');
assert('"summarize this failing test"',                    inferRoute('summarize this failing test'),                                    'scout');
assert('"implement the smallest patch"',                   inferRoute('implement the smallest patch'),                                   'implement');
assert('"audit this deterministic event system"',          inferRoute('audit this deterministic event system'),                          'audit');
assert('"plan the next packets for a whole repo …"',       inferRoute('plan the next packets for a whole repo determinism drift audit'),  'lead');
assert('"urgent: fix typo" → implement (not lead)',        inferRoute('urgent: fix typo'),                                               'implement');
assert('"extract changed files"',                          inferRoute('extract changed files'),                                          'scout');
assert('"root cause of the crash"',                        inferRoute('root cause of the crash'),                                        'audit');
assert('"system-wide migration"',                          inferRoute('system-wide migration'),                                          'lead');
assert('"classify these log entries"',                     inferRoute('classify these log entries'),                                     'scout');
assert('no keywords → implement',                          inferRoute('do a thing'),                                                     'implement');

// --- buildCommandPreview ---
console.log('\n[buildCommandPreview]');
const prev = buildCommandPreview('implement', 'fix the bug');
assert('first element is "claude"',     prev[0], 'claude');
assert('--model sonnet',                prev[prev.indexOf('--model') + 1], 'sonnet');
assert('--max-turns 6',                 prev[prev.indexOf('--max-turns') + 1], '6');
assert('--permission-mode auto',        prev[prev.indexOf('--permission-mode') + 1], 'auto');
assert('includes --output-format json', prev.includes('--output-format'), true);
assert('task is last element',          prev[prev.length - 1], 'fix the bug');

const prevScout = buildCommandPreview('scout', 'list things');
assert('scout --max-turns 2',           prevScout[prevScout.indexOf('--max-turns') + 1], '2');

const prevLead = buildCommandPreview('lead', 'plan everything');
assert('lead --max-turns 12',           prevLead[prevLead.indexOf('--max-turns') + 1], '12');
assert('lead model is claude-fable-5',  prevLead[prevLead.indexOf('--model') + 1], 'claude-fable-5');

// --- parseArgs ---
console.log('\n[parseArgs]');
const p1 = parseArgs(['node', 'cc-router.mjs', '--dry-run', 'hello']);
assert('dryRun=true',        p1.dryRun, true);
assert('task=hello',         p1.task, 'hello');

const p2 = parseArgs(['node', 'cc-router.mjs', '--dry-run', '--route', 'scout', 'a task']);
assert('route=scout',        p2.route, 'scout');

const p3 = parseArgs(['node', 'cc-router.mjs', '--route', 'bogus', 'task']);
assert('bad route has error', p3.errors.length > 0, true);

// Live flag is off by default (dryRun=false)
const p4 = parseArgs(['node', 'cc-router.mjs', 'do the thing']);
assert('no --dry-run flag → dryRun=false', p4.dryRun, false);

// --- Exit-code tests (subprocess) ---
console.log('\n[exit codes]');

const r1 = run('--dry-run', '--route', 'bogus', 'task');
assertNonzero('invalid route exits nonzero', r1.status);

const r2 = run('--dry-run');
assertNonzero('no task exits nonzero', r2.status);

// --- Summary ---
console.log(`\n${passed + failed} checks — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
