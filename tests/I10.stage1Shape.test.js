import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { extractStructure } from '../scripts/import/stage1-structure.js';

// ── Fixture data ──────────────────────────────────────────────────────────

const FIXTURE_PROSE = `The Ashlands stretch east of the Pale River, a volcanic waste where the Ember Cult
tends their forge-temples. To the west lie the Greenhollow Marches, claimed by the
Thornwatch rangers who guard the old growth from loggers and worse. The two regions
share a contested border along the river. A century ago, the Shattering cracked the
caldera and birthed the ash storms that define the east to this day.`;

const MOCK_STRUCTURE = {
  worldName: 'The Ashlands',
  tone: ['grim', 'volcanic', 'contested'],
  regions: [
    {
      id: 'ashlands',
      name: 'The Ashlands',
      vibe: 'Volcanic waste wreathed in perpetual ash',
      threatLevel: 4,
      dominantFaction: 'ember-cult',
      adjacency: ['greenhollow-marches']
    },
    {
      id: 'greenhollow-marches',
      name: 'Greenhollow Marches',
      vibe: 'Ancient forest under siege',
      threatLevel: 2,
      dominantFaction: 'thornwatch',
      adjacency: ['ashlands']
    }
  ],
  factions: [
    {
      id: 'ember-cult',
      name: 'The Ember Cult',
      goal: 'Harness volcanic energy to fuel their forge-temples',
      personality: { scarcity: 7, curiosity: 3 }
    },
    {
      id: 'thornwatch',
      name: 'The Thornwatch',
      goal: 'Protect the old growth from all threats',
      personality: { scarcity: 4, curiosity: 6 }
    }
  ],
  motifs: ['ash storms', 'ancient roots', 'contested rivers'],
  historicalEvents: [
    {
      id: 'the-shattering',
      description: 'The caldera cracked a century ago, birthing the ash storms',
      impact: 'scar'
    }
  ]
};

// ── Mock fetch ────────────────────────────────────────────────────────────

function makeMockFetch(responseBody) {
  let callCount = 0;
  let lastRequest = null;

  const fetchImpl = async (url, opts) => {
    callCount++;
    lastRequest = { url, opts };
    return {
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(responseBody) }]
      })
    };
  };

  fetchImpl.callCount = () => callCount;
  fetchImpl.lastRequest = () => lastRequest;
  return fetchImpl;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('I10: Stage 1 — structure extraction shape', () => {
  it('returns a valid structure manifest from mocked API', async () => {
    const mockFetch = makeMockFetch(MOCK_STRUCTURE);

    const result = await extractStructure(FIXTURE_PROSE, {
      apiKey: 'test-key',
      model: 'claude-sonnet-4-6',
      fetchImpl: mockFetch
    });

    assert.equal(typeof result.worldName, 'string', 'worldName must be a string');
    assert.ok(result.worldName.length > 0, 'worldName must be non-empty');

    assert.ok(Array.isArray(result.tone), 'tone must be an array');
    assert.ok(result.tone.length > 0, 'tone must have entries');

    assert.ok(Array.isArray(result.regions), 'regions must be an array');
    assert.ok(result.regions.length > 0, 'regions must have entries');

    assert.ok(Array.isArray(result.factions), 'factions must be an array');
    assert.ok(result.factions.length > 0, 'factions must have entries');

    assert.ok(Array.isArray(result.motifs), 'motifs must be an array');
    assert.ok(Array.isArray(result.historicalEvents), 'historicalEvents must be an array');
  });

  it('regions have required fields', async () => {
    const mockFetch = makeMockFetch(MOCK_STRUCTURE);
    const result = await extractStructure(FIXTURE_PROSE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });

    for (const region of result.regions) {
      assert.equal(typeof region.id, 'string', 'region.id must be a string');
      assert.equal(typeof region.name, 'string', 'region.name must be a string');
      assert.equal(typeof region.vibe, 'string', 'region.vibe must be a string');
      assert.equal(typeof region.threatLevel, 'number', 'region.threatLevel must be a number');
      assert.ok(region.threatLevel >= 1 && region.threatLevel <= 5, 'threatLevel in [1,5]');
      assert.ok(Array.isArray(region.adjacency), 'region.adjacency must be an array');
    }
  });

  it('factions have required fields', async () => {
    const mockFetch = makeMockFetch(MOCK_STRUCTURE);
    const result = await extractStructure(FIXTURE_PROSE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });

    for (const faction of result.factions) {
      assert.equal(typeof faction.id, 'string', 'faction.id must be a string');
      assert.equal(typeof faction.name, 'string', 'faction.name must be a string');
      assert.equal(typeof faction.goal, 'string', 'faction.goal must be a string');
      assert.ok(faction.personality, 'faction must have personality');
      assert.equal(typeof faction.personality.scarcity, 'number');
      assert.equal(typeof faction.personality.curiosity, 'number');
    }
  });

  it('historicalEvents have required fields', async () => {
    const mockFetch = makeMockFetch(MOCK_STRUCTURE);
    const result = await extractStructure(FIXTURE_PROSE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });

    for (const event of result.historicalEvents) {
      assert.equal(typeof event.id, 'string');
      assert.equal(typeof event.description, 'string');
      assert.ok(['scar', 'thread', 'myth'].includes(event.impact),
        `impact must be scar|thread|myth, got "${event.impact}"`);
    }
  });

  it('makes exactly one API call', async () => {
    const mockFetch = makeMockFetch(MOCK_STRUCTURE);
    await extractStructure(FIXTURE_PROSE, {
      apiKey: 'test-key',
      fetchImpl: mockFetch
    });
    assert.equal(mockFetch.callCount(), 1, 'should make exactly one API call');
  });

  it('throws when apiKey is missing', async () => {
    await assert.rejects(
      () => extractStructure(FIXTURE_PROSE, { apiKey: '' }),
      /apiKey is required/
    );
  });

  it('throws when prose is empty', async () => {
    await assert.rejects(
      () => extractStructure('', { apiKey: 'test-key' }),
      /prose must be a non-empty string/
    );
  });

  it('throws on API error', async () => {
    const errorFetch = async () => ({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    });

    await assert.rejects(
      () => extractStructure(FIXTURE_PROSE, { apiKey: 'test-key', fetchImpl: errorFetch }),
      /Anthropic API HTTP 500/
    );
  });
});
