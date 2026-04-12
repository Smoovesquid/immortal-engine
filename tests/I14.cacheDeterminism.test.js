import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { cacheKey, readCache, writeCache } from '../scripts/import/cache.js';
import { runPipeline, IMPORTER_VERSION } from '../scripts/import/index.js';

// ── Fixture data ──────────────────────────────────────────────────────────

const FIXTURE_PROSE = 'The Ashlands stretch east of the Pale River, a volcanic waste.';

const MOCK_STRUCTURE = {
  worldName: 'The Ashlands',
  tone: ['grim'],
  regions: [
    { id: 'ashlands', name: 'The Ashlands', vibe: 'Volcanic', threatLevel: 4, dominantFaction: 'ember-cult', adjacency: [] }
  ],
  factions: [
    { id: 'ember-cult', name: 'Ember Cult', goal: 'Fire', personality: { scarcity: 7, curiosity: 3 } }
  ],
  motifs: ['ash'],
  historicalEvents: [
    { id: 'the-shattering', description: 'Caldera cracked', impact: 'scar' }
  ]
};

const MOCK_ENTITIES = [
  {
    regionId: 'ashlands',
    places: [
      { id: 'forge-temple', name: 'Forge Temple', nodeType: 'landmark', description: 'Smoldering', factionPresence: 'ember-cult' }
    ],
    npcs: [
      { id: 'kira', name: 'Kira', role: 'priest', archetype: 'zealot', factionId: 'ember-cult', hook: 'Needs ore', traits: {} }
    ],
    threads: []
  }
];

const MOCK_SEEDS = [
  {
    id: 'seed-forge-temple', targetId: 'forge-temple', targetType: 'place',
    publicTags: ['fire'], privateTruth: 'truth', garblingHints: { nameVariants: ['forge'], detailGarble: 'garble' },
    toneWords: ['grim'], tier0Body: 'rumor'
  },
  {
    id: 'seed-kira', targetId: 'kira', targetType: 'npc',
    publicTags: ['cult'], privateTruth: 'truth', garblingHints: { nameVariants: ['kiri'], detailGarble: 'garble' },
    toneWords: ['ash'], tier0Body: 'rumor'
  },
  {
    id: 'seed-shattering', targetId: 'the-shattering', targetType: 'event',
    publicTags: ['disaster'], privateTruth: 'truth', garblingHints: { nameVariants: ['crack'], detailGarble: 'garble' },
    toneWords: ['doom'], tier0Body: 'rumor'
  }
];

// ── Mock fetch that sequences through 3 stage responses ──────────────────

function makeSequencedMockFetch() {
  let callIndex = 0;
  const responses = [MOCK_STRUCTURE, MOCK_ENTITIES, MOCK_SEEDS];

  const fetchImpl = async () => {
    const body = responses[callIndex % responses.length];
    callIndex++;
    return {
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(body) }]
      })
    };
  };

  fetchImpl.callCount = () => callIndex;
  return fetchImpl;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('I14: cache determinism', () => {
  let tmpDir;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  it('cacheKey is deterministic for same inputs', () => {
    const k1 = cacheKey('hello', '1.0', 'model-a');
    const k2 = cacheKey('hello', '1.0', 'model-a');
    assert.equal(k1, k2, 'same inputs must produce same key');
  });

  it('cacheKey differs when any input changes', () => {
    const base = cacheKey('hello', '1.0', 'model-a');
    assert.notEqual(base, cacheKey('world', '1.0', 'model-a'), 'different prose');
    assert.notEqual(base, cacheKey('hello', '2.0', 'model-a'), 'different version');
    assert.notEqual(base, cacheKey('hello', '1.0', 'model-b'), 'different model');
  });

  it('readCache returns null on miss', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'i14-'));
    const result = await readCache('nonexistent-key', { baseDir: tmpDir });
    assert.equal(result, null);
  });

  it('writeCache + readCache round-trips data', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'i14-'));
    const key = 'test-key-abc';
    const data = { foo: 'bar', num: 42, arr: [1, 2, 3] };

    await writeCache(key, data, { baseDir: tmpDir });
    const result = await readCache(key, { baseDir: tmpDir });

    assert.deepEqual(result, data);
  });

  it('pipeline caches result and skips API on second run', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'i14-'));
    const mockFetch = makeSequencedMockFetch();

    // First run — should make API calls
    const result1 = await runPipeline(FIXTURE_PROSE, {
      apiKey: 'test-key',
      model: 'claude-sonnet-4-6',
      baseDir: tmpDir,
      fetchImpl: mockFetch
    });

    const callsAfterFirst = mockFetch.callCount();
    assert.ok(callsAfterFirst >= 3, 'first run should make at least 3 API calls (one per stage)');

    // Second run — should hit cache, no new API calls
    const mockFetch2 = makeSequencedMockFetch();
    const result2 = await runPipeline(FIXTURE_PROSE, {
      apiKey: 'test-key',
      model: 'claude-sonnet-4-6',
      baseDir: tmpDir,
      fetchImpl: mockFetch2
    });

    assert.equal(mockFetch2.callCount(), 0, 'second run must not make any API calls (cache hit)');

    // Results must be byte-equal
    assert.deepEqual(result1, result2, 'cached result must equal first-run result');
  });

  it('cache key changes when model changes — no false hit', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'i14-'));
    const mockFetch = makeSequencedMockFetch();

    // Run with model-a
    await runPipeline(FIXTURE_PROSE, {
      apiKey: 'test-key',
      model: 'model-a',
      baseDir: tmpDir,
      fetchImpl: mockFetch
    });

    // Run with model-b — should NOT hit cache
    const mockFetch2 = makeSequencedMockFetch();
    await runPipeline(FIXTURE_PROSE, {
      apiKey: 'test-key',
      model: 'model-b',
      baseDir: tmpDir,
      fetchImpl: mockFetch2
    });

    assert.ok(mockFetch2.callCount() >= 3,
      'different model must not hit cache — should make API calls');
  });
});
