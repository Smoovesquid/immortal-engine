// Pass I1 — Pack Validator tests (gate group I13).
//
// I13a fantasy pack passes
// I13b broken adjacency rejected
// I13c broken faction ref rejected
// I13d orphaned seed rejected
// I13e duplicate id rejected
// I13f missing manifest rejected
// I13g tone out of range rejected

import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

import { validatePack, ERROR_CODES } from '../packValidator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const FIXTURES = join(__dirname, 'fixtures', 'packs');

function hasErrorCode(result, code) {
  return result.errors.some(e => e.code === code);
}

// ── I13a — fantasy pack passes ─────────────────────────────────────────

test('I13a fantasy pack passes packValidator', () => {
  const result = validatePack(join(REPO_ROOT, 'packs', 'fantasy'));
  assert.equal(result.ok, true, `fantasy pack should be valid, got errors: ${JSON.stringify(result.errors, null, 2)}`);
  assert.deepEqual(result.errors, []);
});

test('I13a all shipped packs pass packValidator', () => {
  for (const id of ['fantasy', 'zombie', 'haunted', 'modern', 'space-rift']) {
    const result = validatePack(join(REPO_ROOT, 'packs', id));
    assert.equal(result.ok, true, `pack "${id}" should be valid, got errors: ${JSON.stringify(result.errors)}`);
  }
});

test('I13a validator returns ok=true with an empty errors array for valid minimal fixture', () => {
  const result = validatePack(join(FIXTURES, 'valid-minimal'));
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

// ── I13b — broken adjacency ────────────────────────────────────────────

test('I13b broken adjacency rejected with ADJACENCY_DANGLING', () => {
  const result = validatePack(join(FIXTURES, 'broken-adjacency'));
  assert.equal(result.ok, false);
  assert.ok(hasErrorCode(result, ERROR_CODES.ADJACENCY_DANGLING),
    `expected ADJACENCY_DANGLING, got: ${result.errors.map(e => e.code).join(',')}`);
  const danglers = result.errors.filter(e => e.code === ERROR_CODES.ADJACENCY_DANGLING);
  assert.ok(danglers.some(e => e.message.includes('region-ghost')),
    'dangling error should mention the unknown region id');
});

// ── I13c — broken faction ref ──────────────────────────────────────────

test('I13c broken faction ref rejected with FACTION_REF_DANGLING', () => {
  const result = validatePack(join(FIXTURES, 'broken-faction'));
  assert.equal(result.ok, false);
  assert.ok(hasErrorCode(result, ERROR_CODES.FACTION_REF_DANGLING),
    `expected FACTION_REF_DANGLING, got: ${result.errors.map(e => e.code).join(',')}`);
  const dangling = result.errors.find(e => e.code === ERROR_CODES.FACTION_REF_DANGLING);
  assert.ok(dangling.message.includes('silent-choir'),
    'dangling error should mention the unknown faction id');
});

// ── I13d — orphan seed ─────────────────────────────────────────────────

test('I13d orphaned seed rejected with SEED_ORPHAN', () => {
  const result = validatePack(join(FIXTURES, 'orphan-seed'));
  assert.equal(result.ok, false);
  assert.ok(hasErrorCode(result, ERROR_CODES.SEED_ORPHAN),
    `expected SEED_ORPHAN, got: ${result.errors.map(e => e.code).join(',')}`);
  const orphan = result.errors.find(e => e.code === ERROR_CODES.SEED_ORPHAN);
  assert.ok(orphan.message.includes('seed-orphaned'),
    'orphan error should name the unreferenced seed');
});

// ── I13e — duplicate id ────────────────────────────────────────────────

test('I13e duplicate id rejected with DUPLICATE_ID', () => {
  const result = validatePack(join(FIXTURES, 'duplicate-id'));
  assert.equal(result.ok, false);
  assert.ok(hasErrorCode(result, ERROR_CODES.DUPLICATE_ID),
    `expected DUPLICATE_ID, got: ${result.errors.map(e => e.code).join(',')}`);
});

// ── I13f — missing manifest ────────────────────────────────────────────

test('I13f missing manifest rejected with MANIFEST_MISSING', () => {
  const result = validatePack(join(FIXTURES, 'missing-manifest'));
  assert.equal(result.ok, false);
  assert.ok(hasErrorCode(result, ERROR_CODES.MANIFEST_MISSING),
    `expected MANIFEST_MISSING, got: ${result.errors.map(e => e.code).join(',')}`);
});

test('I13f nonexistent directory rejected with MANIFEST_MISSING', () => {
  const result = validatePack(join(FIXTURES, 'does-not-exist-xyz'));
  assert.equal(result.ok, false);
  assert.ok(hasErrorCode(result, ERROR_CODES.MANIFEST_MISSING));
});

// ── I13g — tone out of range ───────────────────────────────────────────

test('I13g numeric tone vector out of range rejected with TONE_OUT_OF_RANGE', () => {
  const result = validatePack(join(FIXTURES, 'tone-out-of-range'));
  assert.equal(result.ok, false);
  assert.ok(hasErrorCode(result, ERROR_CODES.TONE_OUT_OF_RANGE),
    `expected TONE_OUT_OF_RANGE, got: ${result.errors.map(e => e.code).join(',')}`);
  const oor = result.errors.find(e => e.code === ERROR_CODES.TONE_OUT_OF_RANGE);
  assert.ok(oor.path.includes('blood'), 'error path should point at the offending bucket');
});

// ── Contract tests ─────────────────────────────────────────────────────

test('validatePack returns a plain result object (no throws) for bad input', () => {
  // Pure function / enumerated errors contract: never throw on missing path.
  const result = validatePack(join(FIXTURES, 'nonexistent-pack-name'));
  assert.equal(typeof result, 'object');
  assert.equal(result.ok, false);
  assert.ok(Array.isArray(result.errors));
  assert.ok(Array.isArray(result.warnings));
});

test('validatePack is deterministic — same input yields same result shape', () => {
  const a = validatePack(join(REPO_ROOT, 'packs', 'fantasy'));
  const b = validatePack(join(REPO_ROOT, 'packs', 'fantasy'));
  assert.deepEqual(a, b);
});

test('ERROR_CODES contract surface is stable', () => {
  // The importer will depend on this contract — check the known codes exist.
  const required = [
    'MANIFEST_MISSING',
    'MANIFEST_PARSE_ERROR',
    'MISSING_FIELD',
    'INVALID_FIELD_TYPE',
    'EMPTY_STRING',
    'MOTIF_EMPTY',
    'DUPLICATE_ID',
    'ADJACENCY_DANGLING',
    'FACTION_REF_DANGLING',
    'THREAD_NODEREF_DANGLING',
    'SEED_ORPHAN',
    'SEED_REF_DANGLING',
    'TONE_OUT_OF_RANGE',
    'TONE_INVALID_BUCKET'
  ];
  for (const code of required) {
    assert.equal(ERROR_CODES[code], code, `ERROR_CODES.${code} missing`);
  }
});
