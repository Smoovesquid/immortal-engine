import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { expandEntities } from '../scripts/import/stage2-expansion.js';

// ── Fixture data ──────────────────────────────────────────────────────────

const FIXTURE_STRUCTURE = {
  worldName: 'The Ashlands',
  tone: ['grim'],
  regions: [
    {
      id: 'ashlands',
      name: 'The Ashlands',
      vibe: 'Volcanic waste',
      threatLevel: 4,
      dominantFaction: 'ember-cult',
      adjacency: ['greenhollow']
    },
    {
      id: 'greenhollow',
      name: 'Greenhollow Marches',
      vibe: 'Ancient forest',
      threatLevel: 2,
      dominantFaction: 'thornwatch',
      adjacency: ['ashlands']
    }
  ],
  factions: [
    { id: 'ember-cult', name: 'Ember Cult', goal: 'Harness fire', personality: { scarcity: 7, curiosity: 3 } },
    { id: 'thornwatch', name: 'Thornwatch', goal: 'Guard forest', personality: { scarcity: 4, curiosity: 6 } }
  ],
  motifs: ['ash', 'roots'],
  historicalEvents: [
    { id: 'the-shattering', description: 'The caldera cracked', impact: 'scar' }
  ]
};

const FIXTURE_PROSE = 'The Ashlands stretch east. The Greenhollow Marches lie west.';

const MOCK_ENTITIES = [
  {
    regionId: 'ashlands',
    places: [
      { id: 'forge-temple', name: 'The Forge Temple', nodeType: 'landmark', description: 'A smoldering temple', factionPresence: 'ember-cult' },
      { id: 'ash-market', name: 'Ash Market', nodeType: 'settlement', description: 'A trading post in the waste', factionPresence: '' }
    ],
    npcs: [
      { id: 'kira', name: 'Kira', role: 'forge-priest', archetype: 'zealot', factionId: 'ember-cult', hook: 'Needs rare ore', traits: { devotion: 'high' } },
      { id: 'dust', name: 'Dust', role: 'scavenger', archetype: 'survivor', factionId: '', hook: 'Knows a safe passage', traits: { trust: 'low' } },
      { id: 'maro', name: 'Maro', role: 'guide', archetype: 'reluctant hero', factionId: '', hook: 'Lost something in the marches', traits: {} }
    ],
    threads: [
      { id: 'forge-ignition', name: 'Forge Ignition', description: 'The cult prepares a dangerous ritual', nodeId: 'forge-temple' }
    ]
  },
  {
    regionId: 'greenhollow',
    places: [
      { id: 'root-hall', name: 'Root Hall', nodeType: 'settlement', description: 'Thornwatch headquarters', factionPresence: 'thornwatch' },
      { id: 'pale-crossing', name: 'Pale Crossing', nodeType: 'wilderness', description: 'A contested ford', factionPresence: '' },
      { id: 'old-stump', name: 'The Old Stump', nodeType: 'landmark', description: 'An ancient tree stump', factionPresence: '' }
    ],
    npcs: [
      { id: 'wren', name: 'Wren', role: 'ranger', archetype: 'guardian', factionId: 'thornwatch', hook: 'Suspects a traitor', traits: { vigilance: 'high' } },
      { id: 'thalo', name: 'Thalo', role: 'herbalist', archetype: 'healer', factionId: '', hook: 'Needs ingredients from the Ashlands', traits: {} },
      { id: 'brin', name: 'Brin', role: 'scout', archetype: 'trickster', factionId: 'thornwatch', hook: 'Wants to defect', traits: { loyalty: 'wavering' } }
    ],
    threads: [
      { id: 'traitor-hunt', name: 'Traitor Hunt', description: 'Someone in the Thornwatch is leaking info', nodeId: 'root-hall' }
    ]
  }
];

// ── Mock fetch ────────────────────────────────────────────────────────────

function makeMockFetch(responseBody) {
  return async () => ({
    ok: true,
    json: async () => ({
      content: [{ text: JSON.stringify(responseBody) }]
    })
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('I11: Stage 2 — no orphan references', () => {
  it('returns expanded entities with valid shape', async () => {
    const mockFetch = makeMockFetch(MOCK_ENTITIES);
    const result = await expandEntities(FIXTURE_STRUCTURE, FIXTURE_PROSE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });

    assert.ok(Array.isArray(result), 'result must be an array');
    assert.equal(result.length, 2, 'one entry per region');
  });

  it('every regionId matches a defined region', async () => {
    const mockFetch = makeMockFetch(MOCK_ENTITIES);
    const result = await expandEntities(FIXTURE_STRUCTURE, FIXTURE_PROSE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });

    const regionIds = new Set(FIXTURE_STRUCTURE.regions.map(r => r.id));
    for (const entry of result) {
      assert.ok(regionIds.has(entry.regionId),
        `regionId "${entry.regionId}" must match a defined region`);
    }
  });

  it('no NPC factionId references an undefined faction', async () => {
    const mockFetch = makeMockFetch(MOCK_ENTITIES);
    const result = await expandEntities(FIXTURE_STRUCTURE, FIXTURE_PROSE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });

    const factionIds = new Set(FIXTURE_STRUCTURE.factions.map(f => f.id));
    for (const region of result) {
      for (const npc of (region.npcs || [])) {
        if (npc.factionId) {
          assert.ok(factionIds.has(npc.factionId),
            `NPC "${npc.id}" references unknown faction "${npc.factionId}"`);
        }
      }
    }
  });

  it('no place factionPresence references an undefined faction', async () => {
    const mockFetch = makeMockFetch(MOCK_ENTITIES);
    const result = await expandEntities(FIXTURE_STRUCTURE, FIXTURE_PROSE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });

    const factionIds = new Set(FIXTURE_STRUCTURE.factions.map(f => f.id));
    for (const region of result) {
      for (const place of (region.places || [])) {
        if (place.factionPresence) {
          assert.ok(factionIds.has(place.factionPresence),
            `place "${place.id}" references unknown faction "${place.factionPresence}"`);
        }
      }
    }
  });

  it('no thread nodeId references an undefined place', async () => {
    const mockFetch = makeMockFetch(MOCK_ENTITIES);
    const result = await expandEntities(FIXTURE_STRUCTURE, FIXTURE_PROSE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });

    for (const region of result) {
      const placeIds = new Set((region.places || []).map(p => p.id));
      for (const thread of (region.threads || [])) {
        if (thread.nodeId) {
          assert.ok(placeIds.has(thread.nodeId),
            `thread "${thread.id}" references unknown nodeId "${thread.nodeId}"`);
        }
      }
    }
  });

  it('rejects entities with dangling faction ref', async () => {
    const badEntities = JSON.parse(JSON.stringify(MOCK_ENTITIES));
    badEntities[0].npcs[0].factionId = 'nonexistent-faction';

    const mockFetch = makeMockFetch(badEntities);
    await assert.rejects(
      () => expandEntities(FIXTURE_STRUCTURE, FIXTURE_PROSE, {
        apiKey: 'test-key',
        fetchImpl: mockFetch
      }),
      /unknown faction "nonexistent-faction"/
    );
  });

  it('rejects entities with dangling thread nodeId', async () => {
    const badEntities = JSON.parse(JSON.stringify(MOCK_ENTITIES));
    badEntities[0].threads[0].nodeId = 'nonexistent-place';

    const mockFetch = makeMockFetch(badEntities);
    await assert.rejects(
      () => expandEntities(FIXTURE_STRUCTURE, FIXTURE_PROSE, {
        apiKey: 'test-key',
        fetchImpl: mockFetch
      }),
      /unknown nodeId "nonexistent-place"/
    );
  });

  it('places have valid nodeType', async () => {
    const mockFetch = makeMockFetch(MOCK_ENTITIES);
    const result = await expandEntities(FIXTURE_STRUCTURE, FIXTURE_PROSE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });

    const validTypes = new Set(['settlement', 'wilderness', 'landmark']);
    for (const region of result) {
      for (const place of (region.places || [])) {
        assert.ok(validTypes.has(place.nodeType),
          `place "${place.id}" has invalid nodeType "${place.nodeType}"`);
      }
    }
  });
});
