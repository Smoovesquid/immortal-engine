import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { mintRumorForNpc, computeHopCount, deterministicBody } from '../engine/rumor/mint.js';
import { buildRumorPrompt } from '../engine/rumor/prompt.js';
import { computeTier } from '../engine/rumor/tier.js';
import { createCanonLog } from '../engine/csl/canonLog.js';
import { filterRumors } from '../engine/npc/perspectiveFilter.js';
import { beginDialogue, askNpc } from '../engine/npc/dialogue.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function mkWorld(overrides = {}) {
  const base = newWorld({ seed: 'u76', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({ ...base, ...overrides });
}

function mkWorldWithNpc(opts = {}) {
  const w = mkWorld();
  const nodeId = w.map.currentNodeId;
  const npcId = opts.npcId || 'npc-sage';
  const nodes = w.map.nodes.map(n => {
    if (n.id !== nodeId) return n;
    return {
      ...n,
      settlement: {
        ...n.settlement,
        npcs: [
          ...(n.settlement?.npcs || []),
          {
            id: npcId,
            name: opts.name || 'Old Sage',
            role: opts.role || 'scholar',
            rumorIds: opts.rumorIds || [],
            sophistication: opts.sophistication ?? 2,
            personality: { honesty: 0.6, trustOfOutsiders: 0.5, selfPreservation: 0.4 },
            knowledgeGraph: opts.knowledgeGraph || [{ factId: 'ruins' }],
            secrets: opts.secrets || [],
            conversationState: {
              metPlayer: false,
              topicsDiscussed: [],
              trustLevel: opts.trust ?? 5,
              lastInteraction: null
            }
          }
        ]
      }
    };
  });
  return ensureWorld({ ...w, map: { ...w.map, nodes } });
}

function mkSeed(overrides = {}) {
  return {
    id: 'seed-ancient-ruins',
    primaryName: 'Ancient Ruins',
    direction: 'north',
    tags: ['ruins', 'ancient'],
    truthBody: 'The ancient ruins north of here contain a sealed vault.',
    originNodeId: '',
    ...overrides
  };
}

// ── U76-01: Deterministic fallback body based on tier ───────────────────

test('U76-01: deterministic fallback produces tier-appropriate body', async () => {
  const seed = mkSeed();

  const t0 = deterministicBody(seed, 0);
  assert.ok(t0.includes('Ancient Ruins'), 'tier 0 includes primary name');
  assert.ok(t0.includes('ruins'), 'tier 0 includes first tag');

  const t1 = deterministicBody(seed, 1);
  assert.ok(t1.includes('Ancient Ruins'), 'tier 1 includes primary name');

  const t2 = deterministicBody(seed, 2);
  assert.ok(t2.includes('Ancient Ruins'), 'tier 2 mentions name');
  assert.ok(t2.includes('north'), 'tier 2 includes direction');

  const t3 = deterministicBody(seed, 3);
  assert.ok(!t3.includes('Ancient Ruins'), 'tier 3 omits specific name');
  assert.ok(t3.includes('ruins'), 'tier 3 mentions tag');
  assert.ok(t3.includes('north'), 'tier 3 includes direction');

  const t4 = deterministicBody(seed, 4);
  assert.ok(!t4.includes('Ancient Ruins'), 'tier 4 omits specific name');
  assert.ok(!t4.includes('ruins'), 'tier 4 omits tags');
  assert.ok(t4.includes('north'), 'tier 4 includes direction');
});

// ── U76-02: same inputs produce same deterministic body ─────────────────

test('U76-02: deterministic fallback is stable — same inputs same body', () => {
  const seed = mkSeed();
  for (let tier = 0; tier <= 4; tier++) {
    const a = deterministicBody(seed, tier);
    const b = deterministicBody(seed, tier);
    assert.equal(a, b, `tier ${tier} body is stable`);
  }
});

// ── U76-03: mintRumorForNpc with no LLM uses deterministic fallback ─────

test('U76-03: mintRumorForNpc falls back to deterministic body without LLM', async () => {
  const w = mkWorldWithNpc();
  const seed = mkSeed();
  const canonLog = createCanonLog();

  const result = await mintRumorForNpc(w, {
    npcId: 'npc-sage',
    seedId: 'seed-ancient-ruins',
    seed,
    canonLog
  });

  assert.ok(result.rumor, 'rumor was created');
  assert.equal(result.rumor.sourceSeedId, 'seed-ancient-ruins');
  assert.equal(result.rumor.carrierNpcId, 'npc-sage');
  assert.ok(result.rumor.body.length > 0, 'body is non-empty');

  // Verify it's the deterministic body (no LLM was provided)
  const expectedBody = deterministicBody(seed, result.rumor.tier);
  assert.equal(result.rumor.body, expectedBody);
});

// ── U76-04: Idempotency — second call returns existing rumor ────────────

test('U76-04: mintRumorForNpc is idempotent — same seed+npc+turn returns same rumor', async () => {
  const w = mkWorldWithNpc();
  const seed = mkSeed();
  const canonLog = createCanonLog();

  const r1 = await mintRumorForNpc(w, {
    npcId: 'npc-sage',
    seedId: 'seed-ancient-ruins',
    seed,
    canonLog
  });

  assert.ok(r1.rumor, 'first mint produces rumor');

  // Second call on the updated world
  const r2 = await mintRumorForNpc(r1.world, {
    npcId: 'npc-sage',
    seedId: 'seed-ancient-ruins',
    seed,
    canonLog: r1.canonLog
  });

  assert.ok(r2.rumor, 'second call returns rumor');
  assert.equal(r2.rumor.id, r1.rumor.id, 'same rumor ID');
  assert.equal(r2.rumor.body, r1.rumor.body, 'same body');

  // World should have exactly one rumor
  const rumors = Array.isArray(r2.world.rumors) ? r2.world.rumors : [];
  const matchCount = rumors.filter(r => r.id === r1.rumor.id).length;
  assert.equal(matchCount, 1, 'no duplicate rumor created');
});

// ── U76-05: Canon Log integration ──────────────────────────────────────

test('U76-05: mintRumorForNpc logs rumor.minted to Canon Log', async () => {
  const w = mkWorldWithNpc();
  const seed = mkSeed();
  const canonLog = createCanonLog();

  const result = await mintRumorForNpc(w, {
    npcId: 'npc-sage',
    seedId: 'seed-ancient-ruins',
    seed,
    canonLog
  });

  assert.ok(result.canonLog, 'canonLog returned');
  assert.ok(result.canonLog.events.length > 0, 'event was logged');

  const mintEvent = result.canonLog.events.find(e => e.type === 'rumor.minted');
  assert.ok(mintEvent, 'rumor.minted event exists');
  assert.equal(mintEvent.targetId, result.rumor.id, 'event targetId matches rumor id');
  assert.equal(mintEvent.seedId, 'seed-ancient-ruins');
  assert.equal(mintEvent.npcId, 'npc-sage');
});

// ── U76-06: LLM mock — uses LLM body when available ────────────────────

test('U76-06: mintRumorForNpc uses local LLM body when available', async () => {
  const w = mkWorldWithNpc();
  const seed = mkSeed();
  const canonLog = createCanonLog();

  const mockQueryLocal = async () => ({
    ok: true,
    result: { body: 'Whispers of cursed stone pillars to the north.' }
  });

  const result = await mintRumorForNpc(w, {
    npcId: 'npc-sage',
    seedId: 'seed-ancient-ruins',
    seed,
    canonLog,
    queryLocalFn: mockQueryLocal
  });

  assert.equal(result.rumor.body, 'Whispers of cursed stone pillars to the north.');
});

// ── U76-07: LLM failure falls through to deterministic ──────────────────

test('U76-07: LLM failure falls through to deterministic body', async () => {
  const w = mkWorldWithNpc();
  const seed = mkSeed();
  const canonLog = createCanonLog();

  const failingLocal = async () => ({ ok: false, reason: 'timeout' });
  const failingCloud = async () => { throw new Error('network error'); };

  const result = await mintRumorForNpc(w, {
    npcId: 'npc-sage',
    seedId: 'seed-ancient-ruins',
    seed,
    canonLog,
    queryLocalFn: failingLocal,
    cloudFetchFn: failingCloud
  });

  assert.ok(result.rumor, 'rumor still created');
  const expectedBody = deterministicBody(seed, result.rumor.tier);
  assert.equal(result.rumor.body, expectedBody, 'body is deterministic fallback');
});

// ── U76-08: buildRumorPrompt returns a string with tier instruction ─────

test('U76-08: buildRumorPrompt generates valid prompt for each tier', () => {
  const seed = mkSeed();
  const carrier = { name: 'Old Sage', archetype: 'scholar', sophistication: 2, traits: {} };

  for (let tier = 0; tier <= 4; tier++) {
    const prompt = buildRumorPrompt({ seed, tier, carrier, tone: 'grim' });
    assert.ok(typeof prompt === 'string', 'prompt is a string');
    assert.ok(prompt.length > 50, 'prompt has content');
    assert.ok(prompt.includes('Ancient Ruins'), 'prompt references seed name');
    assert.ok(prompt.includes('"body"'), 'prompt requests JSON body');
  }
});

// ── U76-09: computeHopCount returns 0 for same node ────────────────────

test('U76-09: computeHopCount returns 0 for same node, positive for different', () => {
  const map = {
    nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    edges: [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }]
  };

  assert.equal(computeHopCount(map, 'a', 'a'), 0, 'same node = 0 hops');
  assert.equal(computeHopCount(map, 'a', 'b'), 1, 'adjacent = 1 hop');
  assert.equal(computeHopCount(map, 'a', 'c'), 2, 'two edges = 2 hops');
  assert.equal(computeHopCount(map, 'c', 'a'), 2, 'symmetric');
});

// ── U76-10: filterRumors respects trust thresholds ──────────────────────

test('U76-10: filterRumors gates rumor visibility by trust level', () => {
  const rumors = [
    { id: 'r0', tier: 0, body: 'truth', tags: [] },
    { id: 'r2', tier: 2, body: 'distorted', tags: [] },
    { id: 'r3', tier: 3, body: 'vague', tags: [] },
    { id: 'r4', tier: 4, body: 'whisper', tags: [] }
  ];

  const speaker = {
    rumorIds: ['r0', 'r2', 'r3', 'r4'],
    sophistication: 3
  };

  // Low trust — only tier 3+
  const low = filterRumors(speaker, rumors, { trust: 2 });
  assert.ok(low.surfacedRumors.every(r => r.tier >= 3), 'low trust only sees tier 3+');

  // Mid trust — tier 2+
  const mid = filterRumors(speaker, rumors, { trust: 5 });
  assert.ok(mid.surfacedRumors.every(r => r.tier >= 2), 'mid trust sees tier 2+');

  // High trust — all tiers
  const high = filterRumors(speaker, rumors, { trust: 8 });
  assert.equal(high.surfacedRumors.length, 4, 'high trust sees all rumors');
});

// ── U76-11: rumor surfaces in dialogue outcome ──────────────────────────

test('U76-11: askNpc outcome includes rumorBodies when NPC has matching rumors', () => {
  // Create world with NPC (no rumorIds yet — invariants require rumor to exist first)
  let w = mkWorldWithNpc({ trust: 5 });

  // Mint a rumor via delta op — this also adds rumorId to the NPC
  w = applyDeltas(w, [{
    op: 'mintRumor',
    rumor: {
      id: 'r-ruins',
      sourceSeedId: 'seed-ancient-ruins',
      carrierNpcId: 'npc-sage',
      hopCount: 1,
      tier: 2,
      age: 0,
      mintedAt: 0,
      body: 'Something about Ancient Ruins... over in north.',
      tags: ['ruins', 'ancient']
    }
  }]);

  // Begin dialogue
  const { world: wd } = beginDialogue(w, 'npc-sage');

  // Ask about ruins
  const { outcome } = askNpc(wd, 'tell me about the ruins');

  assert.ok(Array.isArray(outcome.rumorBodies), 'rumorBodies is an array');
  assert.ok(outcome.rumorBodies.length > 0, 'at least one rumor body surfaced');
  assert.ok(outcome.rumorBodies[0].includes('Ruins'), 'body mentions the topic');
});

// ── U76-12: no NPC returns null rumor ───────────────────────────────────

test('U76-12: mintRumorForNpc returns null rumor when NPC not found', async () => {
  const w = mkWorld(); // no NPC injected
  const seed = mkSeed();
  const canonLog = createCanonLog();

  const result = await mintRumorForNpc(w, {
    npcId: 'nonexistent',
    seedId: 'seed-ancient-ruins',
    seed,
    canonLog
  });

  assert.equal(result.rumor, null);
});

// ── U76-13: cloud fallback used when local fails ────────────────────────

test('U76-13: cloud LLM used as fallback when local returns ok:false', async () => {
  const w = mkWorldWithNpc();
  const seed = mkSeed();
  const canonLog = createCanonLog();

  const failLocal = async () => ({ ok: false, reason: 'unavailable' });
  const successCloud = async () => ({ ok: true, body: 'Cloud says: dark omens from the north.' });

  const result = await mintRumorForNpc(w, {
    npcId: 'npc-sage',
    seedId: 'seed-ancient-ruins',
    seed,
    canonLog,
    queryLocalFn: failLocal,
    cloudFetchFn: successCloud
  });

  assert.equal(result.rumor.body, 'Cloud says: dark omens from the north.');
});
