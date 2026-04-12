import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { generateSeeds, collectTargets } from '../scripts/import/stage3-seeds.js';

// ── Fixture data ──────────────────────────────────────────────────────────

const FIXTURE_STRUCTURE = {
  worldName: 'The Ashlands',
  tone: ['grim'],
  regions: [
    { id: 'ashlands', name: 'The Ashlands', vibe: 'Volcanic', threatLevel: 4, dominantFaction: 'ember-cult', adjacency: ['greenhollow'] },
    { id: 'greenhollow', name: 'Greenhollow', vibe: 'Forest', threatLevel: 2, dominantFaction: 'thornwatch', adjacency: ['ashlands'] }
  ],
  factions: [
    { id: 'ember-cult', name: 'Ember Cult', goal: 'Fire', personality: { scarcity: 7, curiosity: 3 } },
    { id: 'thornwatch', name: 'Thornwatch', goal: 'Guard', personality: { scarcity: 4, curiosity: 6 } }
  ],
  motifs: ['ash'],
  historicalEvents: [
    { id: 'the-shattering', description: 'The caldera cracked', impact: 'scar' }
  ]
};

const FIXTURE_ENTITIES = [
  {
    regionId: 'ashlands',
    places: [
      { id: 'forge-temple', name: 'The Forge Temple', nodeType: 'landmark', description: 'Smoldering', factionPresence: 'ember-cult' },
      { id: 'ash-market', name: 'Ash Market', nodeType: 'settlement', description: 'Trading post', factionPresence: '' }
    ],
    npcs: [
      { id: 'kira', name: 'Kira', role: 'forge-priest', archetype: 'zealot', factionId: 'ember-cult', hook: 'Needs ore', traits: {} },
      { id: 'dust', name: 'Dust', role: 'scavenger', archetype: 'survivor', factionId: '', hook: 'Knows a path', traits: {} }
    ],
    threads: []
  },
  {
    regionId: 'greenhollow',
    places: [
      { id: 'root-hall', name: 'Root Hall', nodeType: 'settlement', description: 'HQ', factionPresence: 'thornwatch' }
    ],
    npcs: [
      { id: 'wren', name: 'Wren', role: 'ranger', archetype: 'guardian', factionId: 'thornwatch', hook: 'Suspects traitor', traits: {} }
    ],
    threads: []
  }
];

// Build mock seeds — one per target
function buildMockSeeds() {
  const targets = collectTargets(FIXTURE_ENTITIES, FIXTURE_STRUCTURE);
  return targets.map(t => ({
    id: `seed-${t.id}`,
    targetId: t.id,
    targetType: t.type,
    publicTags: ['tag1', 'tag2'],
    privateTruth: `The truth about ${t.id}`,
    garblingHints: {
      nameVariants: [`${t.id}-variant`],
      detailGarble: 'Details get twisted'
    },
    toneWords: ['grim', 'ash'],
    tier0Body: `They say something about ${t.id}...`
  }));
}

// ── Mock fetch ────────────────────────────────────────────────────────────

function makeMockFetch(responseBody) {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount++;
    return {
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(responseBody) }]
      })
    };
  };
  fetchImpl.callCount = () => callCount;
  return fetchImpl;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('I12: Stage 3 — seed coverage', () => {
  it('collectTargets finds all places, NPCs, and events', () => {
    const targets = collectTargets(FIXTURE_ENTITIES, FIXTURE_STRUCTURE);

    const ids = targets.map(t => t.id);
    // 3 places + 3 NPCs + 1 event = 7
    assert.equal(targets.length, 7, 'should find 7 targets');
    assert.ok(ids.includes('forge-temple'));
    assert.ok(ids.includes('ash-market'));
    assert.ok(ids.includes('root-hall'));
    assert.ok(ids.includes('kira'));
    assert.ok(ids.includes('dust'));
    assert.ok(ids.includes('wren'));
    assert.ok(ids.includes('the-shattering'));
  });

  it('every place has a corresponding seed', async () => {
    const mockSeeds = buildMockSeeds();
    const mockFetch = makeMockFetch(mockSeeds);

    const result = await generateSeeds(FIXTURE_ENTITIES, FIXTURE_STRUCTURE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });

    const seedTargets = new Set(result.filter(s => s.targetType === 'place').map(s => s.targetId));
    for (const region of FIXTURE_ENTITIES) {
      for (const place of (region.places || [])) {
        assert.ok(seedTargets.has(place.id), `missing seed for place "${place.id}"`);
      }
    }
  });

  it('every NPC has a corresponding seed', async () => {
    const mockSeeds = buildMockSeeds();
    const mockFetch = makeMockFetch(mockSeeds);

    const result = await generateSeeds(FIXTURE_ENTITIES, FIXTURE_STRUCTURE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });

    const seedTargets = new Set(result.filter(s => s.targetType === 'npc').map(s => s.targetId));
    for (const region of FIXTURE_ENTITIES) {
      for (const npc of (region.npcs || [])) {
        assert.ok(seedTargets.has(npc.id), `missing seed for NPC "${npc.id}"`);
      }
    }
  });

  it('every historical event has a corresponding seed', async () => {
    const mockSeeds = buildMockSeeds();
    const mockFetch = makeMockFetch(mockSeeds);

    const result = await generateSeeds(FIXTURE_ENTITIES, FIXTURE_STRUCTURE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });

    const seedTargets = new Set(result.filter(s => s.targetType === 'event').map(s => s.targetId));
    for (const event of (FIXTURE_STRUCTURE.historicalEvents || [])) {
      assert.ok(seedTargets.has(event.id), `missing seed for event "${event.id}"`);
    }
  });

  it('seeds have all required fields', async () => {
    const mockSeeds = buildMockSeeds();
    const mockFetch = makeMockFetch(mockSeeds);

    const result = await generateSeeds(FIXTURE_ENTITIES, FIXTURE_STRUCTURE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });

    for (const seed of result) {
      assert.equal(typeof seed.id, 'string', 'seed.id must be string');
      assert.equal(typeof seed.targetId, 'string', 'seed.targetId must be string');
      assert.ok(['place', 'npc', 'event'].includes(seed.targetType),
        `targetType must be place|npc|event, got "${seed.targetType}"`);
      assert.ok(Array.isArray(seed.publicTags), 'publicTags must be array');
      assert.equal(typeof seed.privateTruth, 'string', 'privateTruth must be string');
      assert.ok(seed.garblingHints, 'garblingHints must exist');
      assert.ok(Array.isArray(seed.garblingHints.nameVariants), 'nameVariants must be array');
      assert.equal(typeof seed.garblingHints.detailGarble, 'string', 'detailGarble must be string');
      assert.ok(Array.isArray(seed.toneWords), 'toneWords must be array');
      assert.equal(typeof seed.tier0Body, 'string', 'tier0Body must be string');
    }
  });

  it('rejects when a target is missing its seed', async () => {
    const mockSeeds = buildMockSeeds();
    // Remove the last seed to create a gap
    mockSeeds.pop();

    const mockFetch = makeMockFetch(mockSeeds);
    await assert.rejects(
      () => generateSeeds(FIXTURE_ENTITIES, FIXTURE_STRUCTURE, {
        apiKey: 'test-key',
        fetchImpl: mockFetch
      }),
      /missing seed for/
    );
  });

  it('rejects seeds with dangling targetId', async () => {
    const mockSeeds = buildMockSeeds();
    mockSeeds.push({
      id: 'seed-phantom',
      targetId: 'nonexistent',
      targetType: 'npc',
      publicTags: [],
      privateTruth: '',
      garblingHints: { nameVariants: [], detailGarble: '' },
      toneWords: [],
      tier0Body: ''
    });

    const mockFetch = makeMockFetch(mockSeeds);
    await assert.rejects(
      () => generateSeeds(FIXTURE_ENTITIES, FIXTURE_STRUCTURE, {
        apiKey: 'test-key',
        fetchImpl: mockFetch
      }),
      /unknown target "nonexistent"/
    );
  });
});
