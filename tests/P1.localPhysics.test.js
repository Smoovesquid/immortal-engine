import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePhysics } from '../engine/llmPhysics.js';
import { ensureWorld } from '../engine/state.js';

// --- Fixture ---

function makeWorld() {
  return ensureWorld({
    map: {
      currentNodeId: 'n1',
      nodes: [{
        id: 'n1',
        name: 'Room',
        furniture: [{
          name: 'wooden table',
          parts: ['leg'],
          state: 'intact',
          tags: ['wood'],
          weight: 3,
          bulk: 3
        }],
        edges: []
      }]
    },
    party: [{
      id: 'party',
      stats: { MIGHT: 14, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 },
      inventory: { weapons: [], armor: [], tools: [], junk: [], items: [] }
    }],
    scene: { tags: ['dungeon', 'dark'] }
  });
}

// --- Mock helpers ---

function mockLocalOk(result) {
  return async ({ prompt, schema, timeout }) => {
    assert.ok(prompt, 'prompt must be provided');
    assert.ok(timeout <= 2000, 'timeout should be <= 2000');
    return { ok: true, result };
  };
}

function mockLocalFail(reason = 'unavailable') {
  return async () => ({ ok: false, reason });
}

function mockLocalThrow() {
  return async () => { throw new Error('AbortError'); };
}

function mockCloudOk(response) {
  return async ({ messages }) => {
    assert.ok(messages.length > 0);
    return { content: JSON.stringify(response) };
  };
}

// --- Tests ---

describe('P1 — local LLM physics classification', () => {
  it('P1-01: local LLM returns valid classification', async () => {
    const world = makeWorld();
    const result = await evaluatePhysics({
      world,
      playerText: 'I smash the wooden table',
      queryLocalFn: mockLocalOk({ possible: true, difficulty: 'medium', stat: 'MIGHT' })
    });

    assert.ok(result.classification, 'classification should be attached');
    assert.equal(result.classification.possible, true);
    assert.equal(result.classification.difficulty, 'medium');
    assert.equal(result.classification.stat, 'MIGHT');
    // With no cloud LLM, should fall back to offline heuristics
    assert.equal(result.fallbackUsed, true);
  });

  it('P1-02: falls back to cloud on local failure', async () => {
    const world = makeWorld();
    let cloudCalled = false;
    const result = await evaluatePhysics({
      world,
      playerText: 'I smash the wooden table',
      queryLocalFn: mockLocalFail(),
      chatCompletionFn: async ({ messages }) => {
        cloudCalled = true;
        return {
          content: JSON.stringify({
            plausible: true,
            result: 'The table cracks.',
            deltas: []
          })
        };
      }
    });

    assert.ok(cloudCalled, 'cloud LLM should have been called');
    assert.equal(result.plausible, true);
    assert.equal(result.classification, null, 'classification should be null when local fails');
  });

  it('P1-03: falls back to heuristics when both fail', async () => {
    const world = makeWorld();
    const result = await evaluatePhysics({
      world,
      playerText: 'I smash the wooden table',
      queryLocalFn: mockLocalFail()
      // no chatCompletionFn, no apiKey
    });

    assert.equal(result.fallbackUsed, true);
    assert.ok(result.deltas.length > 0, 'force heuristic should produce deltas');
    assert.equal(result.classification, null);
  });

  it('P1-04: timeout/throw produces fallback', async () => {
    const world = makeWorld();
    const result = await evaluatePhysics({
      world,
      playerText: 'I examine the wooden table',
      queryLocalFn: mockLocalThrow()
    });

    // Should still get a result from offline fallback
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.classification, null);
  });

  it('P1-05: response shape validation rejects invalid shape', async () => {
    const world = makeWorld();
    // Missing 'possible' field
    const result = await evaluatePhysics({
      world,
      playerText: 'I examine the wooden table',
      queryLocalFn: mockLocalOk({ difficulty: 'easy', stat: 'WITS' })
    });

    assert.equal(result.classification, null, 'invalid shape should yield null classification');
    assert.equal(result.fallbackUsed, true);
  });

  it('P1-06: impossible classification short-circuits', async () => {
    const world = makeWorld();
    let cloudCalled = false;
    const result = await evaluatePhysics({
      world,
      playerText: 'I smash the wooden table',
      queryLocalFn: mockLocalOk({ possible: false, difficulty: 'impossible', stat: 'MIGHT' }),
      chatCompletionFn: async () => {
        cloudCalled = true;
        return { content: '{}' };
      }
    });

    assert.equal(cloudCalled, false, 'cloud should NOT be called when local says impossible');
    assert.equal(result.plausible, false);
    assert.ok(result.classification);
    assert.equal(result.classification.possible, false);
    assert.equal(result.classification.difficulty, 'impossible');
  });

  it('P1-07: classification enriches cloud LLM result', async () => {
    const world = makeWorld();
    const result = await evaluatePhysics({
      world,
      playerText: 'I smash the wooden table',
      queryLocalFn: mockLocalOk({ possible: true, difficulty: 'easy', stat: 'MIGHT' }),
      chatCompletionFn: mockCloudOk({
        plausible: true,
        result: 'The table splinters.',
        deltas: []
      })
    });

    assert.equal(result.plausible, true);
    assert.ok(result.classification);
    assert.equal(result.classification.difficulty, 'easy');
    assert.equal(result.fallbackUsed, false);
  });

  it('P1-08: unknown difficulty is normalized to medium', async () => {
    const world = makeWorld();
    const result = await evaluatePhysics({
      world,
      playerText: 'I examine the wooden table',
      queryLocalFn: mockLocalOk({ possible: true, difficulty: 'legendary', stat: 'WITS' })
    });

    assert.ok(result.classification);
    assert.equal(result.classification.difficulty, 'medium');
  });

  it('P1-09: unknown stat is normalized to MIGHT', async () => {
    const world = makeWorld();
    const result = await evaluatePhysics({
      world,
      playerText: 'I examine the wooden table',
      queryLocalFn: mockLocalOk({ possible: true, difficulty: 'easy', stat: 'LUCK' })
    });

    assert.ok(result.classification);
    assert.equal(result.classification.stat, 'MIGHT');
  });
});
