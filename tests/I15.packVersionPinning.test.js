import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { mergeSubRegion } from '../engine/playloop.js';

const PACK_DIR = resolve(import.meta.dirname, '..', 'packs', 'fantasy', 'westmarch');

// ── I15-01: westmarch pack validates ──────────────────────────────────────

test('I15-01: westmarch pack.json has required fields and minimum catalog sizes', () => {
  const raw = JSON.parse(readFileSync(resolve(PACK_DIR, 'pack.json'), 'utf8'));

  // Required scalar fields
  assert.equal(raw.id, 'westmarch');
  assert.equal(typeof raw.name, 'string');
  assert.ok(raw.name.length > 0);

  // toneWords buckets
  assert.ok(raw.toneWords);
  for (const bucket of ['cooperative', 'grim', 'blood']) {
    assert.ok(Array.isArray(raw.toneWords[bucket]), `toneWords.${bucket} must be an array`);
    assert.ok(raw.toneWords[bucket].length > 0, `toneWords.${bucket} must be non-empty`);
  }

  // starterLocations, starterObjectives, skills
  assert.ok(Array.isArray(raw.starterLocations) && raw.starterLocations.length >= 3);
  assert.ok(Array.isArray(raw.starterObjectives) && raw.starterObjectives.length >= 3);
  assert.ok(Array.isArray(raw.skills) && raw.skills.length >= 1);

  // Catalog arrays >= 10
  assert.ok(raw.locations.length >= 10, `locations: ${raw.locations.length} < 10`);
  assert.ok(raw.objectives.length >= 10, `objectives: ${raw.objectives.length} < 10`);
  assert.ok(raw.complications.length >= 10, `complications: ${raw.complications.length} < 10`);
  assert.ok(raw.npcArchetypes.length >= 10, `npcArchetypes: ${raw.npcArchetypes.length} < 10`);
  assert.ok(raw.sensoryMotifs.length >= 10, `sensoryMotifs: ${raw.sensoryMotifs.length} < 10`);
});

// ── I15-02: westmarch pack loads as sub-region ────────────────────────────

test('I15-02: mergeSubRegion appends westmarch catalogs to fantasy base', () => {
  const fantasy = JSON.parse(readFileSync(resolve(PACK_DIR, '..', 'pack.json'), 'utf8'));
  const westmarch = JSON.parse(readFileSync(resolve(PACK_DIR, 'pack.json'), 'utf8'));

  const merged = mergeSubRegion(fantasy, westmarch);

  // Merged pack keeps base identity
  assert.equal(merged.id, 'fantasy');
  assert.equal(merged.name, 'Fantasy');

  // Catalogs are strictly larger than either input
  assert.ok(merged.locations.length > fantasy.locations.length, 'merged locations must exceed base');
  assert.ok(merged.locations.length > westmarch.locations.length, 'merged locations must exceed region');
  assert.equal(merged.locations.length, fantasy.locations.length + westmarch.locations.length);

  assert.ok(merged.npcArchetypes.length > fantasy.npcArchetypes.length);
  assert.ok(merged.objectives.length > fantasy.objectives.length);
  assert.ok(merged.complications.length > fantasy.complications.length);
  assert.ok(merged.sensoryMotifs.length > fantasy.sensoryMotifs.length);

  // Verify westmarch locations appear in the merged set
  for (const loc of westmarch.locations) {
    assert.ok(merged.locations.includes(loc), `merged should contain westmarch location: ${loc}`);
  }
});

// ── I15-03: import.meta.json has correct shape ────────────────────────────

test('I15-03: import.meta.json has correct shape', () => {
  const meta = JSON.parse(readFileSync(resolve(PACK_DIR, 'import.meta.json'), 'utf8'));

  assert.equal(typeof meta.importerVersion, 'string');
  assert.ok(meta.importerVersion.length > 0);

  assert.equal(typeof meta.inputHash, 'string');
  assert.ok(meta.inputHash.length > 0);

  assert.equal(typeof meta.generatedAt, 'string');
  assert.ok(meta.generatedAt.length > 0);

  assert.equal(typeof meta.modelId, 'string');
  assert.ok(meta.modelId.length > 0);

  // Verify the importerVersion matches the importer's declared version
  assert.equal(meta.importerVersion, '0.1.0');
});

// ── I15-04: source.md exists and is non-empty prose ───────────────────────

test('I15-04: westmarch source.md exists and is non-empty prose', () => {
  const source = readFileSync(resolve(PACK_DIR, 'source.md'), 'utf8');

  assert.ok(source.length > 500, `source.md should be substantial prose, got ${source.length} chars`);
  assert.ok(source.includes('Westmarch'), 'source.md should mention Westmarch');
  assert.ok(source.includes('Thornwall'), 'source.md should mention a named location');
});

// ── I15-05: pack artifact determinism ─────────────────────────────────────

test('I15-05: loading pack.json twice produces identical data', () => {
  const raw1 = readFileSync(resolve(PACK_DIR, 'pack.json'), 'utf8');
  const raw2 = readFileSync(resolve(PACK_DIR, 'pack.json'), 'utf8');

  // Byte-identical reads
  assert.equal(raw1, raw2);

  // JSON roundtrip stability
  const parsed1 = JSON.parse(raw1);
  const parsed2 = JSON.parse(raw2);
  assert.deepStrictEqual(parsed1, parsed2);

  // Roundtrip through stringify preserves structure
  const restr = JSON.stringify(parsed1);
  assert.deepStrictEqual(JSON.parse(restr), parsed1);
});
