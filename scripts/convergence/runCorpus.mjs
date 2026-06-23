#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { playerMove } from '../../engine/playloop.js';
import { FIXTURES, PACKS } from './fixtures.mjs';

const CORPUS_DIR = path.resolve('tests/corpus');

function asRegex(value) {
  if (value instanceof RegExp) return value;
  return new RegExp(String(value));
}

function surfaceOf(result) {
  return `${result.output?.narration || ''} ${result.output?.mechanics || ''}`;
}

function signatureHolds(assertions = {}, surface) {
  const matches = assertions.surface_matches || [];
  const excludes = assertions.surface_excludes || [];
  return matches.every(re => asRegex(re).test(surface)) && excludes.every(re => !asRegex(re).test(surface));
}

function describeRegexList(values = []) {
  return values.map(re => String(re)).join(', ');
}

function validateCase(testCase, file) {
  const errors = [];
  if (!testCase || typeof testCase !== 'object') errors.push('case must be an object');
  if (!testCase.id) errors.push('missing id');
  if (!testCase.capability) errors.push('missing capability');
  if (!['locked', 'target'].includes(testCase.status)) errors.push('status must be locked or target');
  if (!FIXTURES[testCase.fixture]) errors.push(`unknown fixture ${JSON.stringify(testCase.fixture)}`);
  if (!Array.isArray(testCase.paraphrases) || testCase.paraphrases.length === 0) errors.push('paraphrases must be a non-empty array');
  if (!testCase.assert || typeof testCase.assert !== 'object') errors.push('missing assert object');
  if (errors.length) throw new Error(`${file}: ${testCase?.id || '<unknown>'}: ${errors.join('; ')}`);
}

async function loadCorpusFiles() {
  if (!fs.existsSync(CORPUS_DIR)) return [];
  // Recurse so capability tracks can group cases in a subdir (e.g.
  // tests/corpus/narration/ for THE REF) while flat files still load. Sorted for
  // deterministic order.
  const out = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith('.corpus.mjs')) out.push(full);
    }
  };
  walk(CORPUS_DIR);
  return out.sort();
}

async function loadCases() {
  const files = await loadCorpusFiles();
  const cases = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(file).href);
    if (!Array.isArray(mod.default)) throw new Error(`${file}: default export must be an array`);
    for (const testCase of mod.default) {
      validateCase(testCase, file);
      cases.push({ ...testCase, file });
    }
  }
  return cases;
}

function runMove(fixtureName, text) {
  const world = FIXTURES[fixtureName]();
  const result = playerMove(world, PACKS, text);
  return surfaceOf(result);
}

function evaluateCase(testCase) {
  const failures = [];
  let passed = true;

  for (const text of testCase.paraphrases) {
    const surface = runMove(testCase.fixture, text);
    const matches = testCase.assert.surface_matches || [];
    const excludes = testCase.assert.surface_excludes || [];

    for (const re of matches) {
      const rx = asRegex(re);
      if (!rx.test(surface)) {
        passed = false;
        failures.push(`paraphrase ${JSON.stringify(text)} missed ${rx}: ${surface}`);
      }
    }
    for (const re of excludes) {
      const rx = asRegex(re);
      if (rx.test(surface)) {
        passed = false;
        failures.push(`paraphrase ${JSON.stringify(text)} matched excluded ${rx}: ${surface}`);
      }
    }
  }

  for (const diverge of testCase.diverge || []) {
    const surface = runMove(testCase.fixture, diverge.text);
    if (signatureHolds(testCase.assert, surface)) {
      passed = false;
      failures.push(`diverge ${JSON.stringify(diverge.text)} held signature (${diverge.reason || 'no reason'}): ${surface}`);
    }
  }

  return { passed, failures };
}

function emptyCapabilityStats() {
  return {
    lockedPass: 0,
    lockedTotal: 0,
    targetPass: 0,
    targetTotal: 0
  };
}

function printTable(stats) {
  const capabilities = [...stats.keys()].sort();
  console.log('Capability | locked | target');
  console.log('-----------|--------|-------');
  for (const cap of capabilities) {
    const s = stats.get(cap);
    console.log(`${cap} | ${s.lockedPass}/${s.lockedTotal} | ${s.targetPass}/${s.targetTotal}`);
  }
}

const cases = await loadCases();
const stats = new Map();
const lockedFailures = [];
const targetFailures = [];
const promotions = [];

for (const testCase of cases) {
  if (!stats.has(testCase.capability)) stats.set(testCase.capability, emptyCapabilityStats());
  const s = stats.get(testCase.capability);
  const result = evaluateCase(testCase);

  if (testCase.status === 'locked') {
    s.lockedTotal += 1;
    if (result.passed) s.lockedPass += 1;
    else lockedFailures.push({ testCase, failures: result.failures });
  } else {
    s.targetTotal += 1;
    if (result.passed) {
      s.targetPass += 1;
      promotions.push(testCase.id);
    } else {
      targetFailures.push({ testCase, failures: result.failures });
    }
  }
}

printTable(stats);

const lockedPass = [...stats.values()].reduce((sum, s) => sum + s.lockedPass, 0);
const lockedTotal = [...stats.values()].reduce((sum, s) => sum + s.lockedTotal, 0);
const pct = lockedTotal === 0 ? 100 : (lockedPass / lockedTotal) * 100;
console.log(`Overall locked-pass: ${pct.toFixed(1)}% (${lockedPass}/${lockedTotal})`);

for (const { testCase, failures } of lockedFailures) {
  console.error(`FAIL locked ${testCase.id} (${testCase.capability})`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(`  signature: matches [${describeRegexList(testCase.assert.surface_matches)}], excludes [${describeRegexList(testCase.assert.surface_excludes)}]`);
}

for (const { testCase, failures } of targetFailures) {
  console.log(`TARGET backlog ${testCase.id} (${testCase.capability})`);
  for (const failure of failures) console.log(`  - ${failure}`);
}

for (const id of promotions) console.log(`PROMOTE? ${id}`);

if (lockedFailures.length) process.exitCode = 1;
