import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld, WORLD_VERSION } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld, loadSlot } from '../engine/save.js';
import { computeTier } from '../engine/rumor/tier.js';
import { assertWorldInvariants } from '../engine/invariants.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function mkWorld(overrides = {}) {
  const base = newWorld({ seed: 'u70', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({ ...base, ...overrides });
}

function mkWorldWithNpc() {
  const w = mkWorld();
  // Inject an NPC at the current node for carrier linking.
  const nodeId = w.map.currentNodeId;
  const nodes = w.map.nodes.map(n => {
    if (n.id !== nodeId) return n;
    return {
      ...n,
      settlement: {
        ...n.settlement,
        npcs: [
          ...(n.settlement?.npcs || []),
          {
            id: 'npc-barkeep',
            name: 'Barkeep',
            role: 'tavern_keeper',
            rumorIds: [],
            sophistication: 2,
            conversationState: { metPlayer: false, topicsDiscussed: [], trustLevel: 5, lastInteraction: null }
          }
        ]
      }
    };
  });
  return ensureWorld({ ...w, map: { ...w.map, nodes } });
}

function mkRumor(overrides = {}) {
  return {
    id: 'rumor:seed1:npc-barkeep:1',
    sourceSeedId: 'seed1',
    carrierNpcId: 'npc-barkeep',
    hopCount: 1,
    tier: 1,
    age: 0,
    mintedAt: 0,
    body: 'They say the old well is cursed.',
    tags: ['well', 'curse'],
    ...overrides
  };
}

function mkStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(k) { return data[k] ?? null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; }
  };
}

// ── U70 — rumor mint determinism ─────────────────────────────────────────

test('U70-01: mintRumor adds rumor to world.rumors with correct shape', () => {
  const w = mkWorldWithNpc();
  const rumor = mkRumor();
  const w2 = applyDeltas(w, [{ op: 'mintRumor', rumor }]);
  assert.equal(w2.rumors.length, 1);
  assert.equal(w2.rumors[0].id, rumor.id);
  assert.equal(w2.rumors[0].sourceSeedId, 'seed1');
  assert.equal(w2.rumors[0].carrierNpcId, 'npc-barkeep');
  assert.equal(w2.rumors[0].body, 'They say the old well is cursed.');
  assert.deepEqual(w2.rumors[0].tags, ['well', 'curse']);
  assert.equal(w2.rumors[0].tier, 1);
  assert.equal(w2.rumors[0].hopCount, 1);
});

test('U70-02: mintRumor links rumor to carrier NPC rumorIds', () => {
  const w = mkWorldWithNpc();
  const rumor = mkRumor();
  const w2 = applyDeltas(w, [{ op: 'mintRumor', rumor }]);
  const node = w2.map.nodes.find(n => n.id === w2.map.currentNodeId);
  const npc = node.settlement.npcs.find(n => n.id === 'npc-barkeep');
  assert.ok(npc.rumorIds.includes(rumor.id));
});

test('U70-03: mintRumor deduplicates — same id is no-op', () => {
  const w = mkWorldWithNpc();
  const rumor = mkRumor();
  const w2 = applyDeltas(w, [{ op: 'mintRumor', rumor }]);
  const w3 = applyDeltas(w2, [{ op: 'mintRumor', rumor }]);
  assert.equal(w3.rumors.length, 1);
});

test('U70-04: mintRumor caps at 64', () => {
  let w = mkWorldWithNpc();
  const rumors = [];
  for (let i = 0; i < 65; i++) {
    rumors.push({
      op: 'mintRumor',
      rumor: mkRumor({ id: `rumor:seed1:npc-barkeep:${i}`, body: `Rumor ${i}` })
    });
  }
  w = applyDeltas(w, rumors);
  assert.equal(w.rumors.length, 64);
});

test('U70-05: mintRumor with missing body is silently dropped', () => {
  const w = mkWorldWithNpc();
  const rumor = mkRumor({ body: '' });
  const w2 = applyDeltas(w, [{ op: 'mintRumor', rumor }]);
  assert.equal(w2.rumors.length, 0);
});

test('U70-06: mintRumor with missing sourceSeedId is silently dropped', () => {
  const w = mkWorldWithNpc();
  const rumor = mkRumor({ sourceSeedId: '' });
  const w2 = applyDeltas(w, [{ op: 'mintRumor', rumor }]);
  assert.equal(w2.rumors.length, 0);
});

test('U70-07: forgetRumor removes rumor from world.rumors', () => {
  const w = mkWorldWithNpc();
  const rumor = mkRumor();
  const w2 = applyDeltas(w, [{ op: 'mintRumor', rumor }]);
  assert.equal(w2.rumors.length, 1);
  const w3 = applyDeltas(w2, [{ op: 'forgetRumor', rumorId: rumor.id }]);
  assert.equal(w3.rumors.length, 0);
});

test('U70-08: forgetRumor removes from carrier NPC rumorIds', () => {
  const w = mkWorldWithNpc();
  const rumor = mkRumor();
  const w2 = applyDeltas(w, [{ op: 'mintRumor', rumor }]);
  const w3 = applyDeltas(w2, [{ op: 'forgetRumor', rumorId: rumor.id }]);
  const node = w3.map.nodes.find(n => n.id === w3.map.currentNodeId);
  const npc = node.settlement.npcs.find(n => n.id === 'npc-barkeep');
  assert.ok(!npc.rumorIds.includes(rumor.id));
});

test('U70-09: forgetRumor for non-existent id is no-op', () => {
  const w = mkWorldWithNpc();
  const w2 = applyDeltas(w, [{ op: 'forgetRumor', rumorId: 'nonexistent' }]);
  assert.equal(w2.rumors.length, 0);
});

test('U70-10: newWorld has empty rumors array', () => {
  const w = mkWorld();
  assert.deepEqual(w.rumors, []);
});

// ── U71 — save roundtrip ────────────────────────────────────────────────

test('U71-01: export/import preserves rumors and worldHash', () => {
  const w = mkWorldWithNpc();
  const rumor = mkRumor();
  const w2 = applyDeltas(w, [{ op: 'mintRumor', rumor }]);
  const hash1 = worldHash(w2);
  const exported = exportWorld(w2);
  const w3 = importWorld(exported);
  const hash2 = worldHash(w3);
  assert.equal(hash1, hash2);
  assert.equal(w3.rumors.length, 1);
  assert.equal(w3.rumors[0].id, rumor.id);
});

// ── U72 — tier computation ──────────────────────────────────────────────

test('U72-01: computeTier fixtures', () => {
  const fixtures = [
    { hopCount: 0, age: 0,  sophistication: 0, expected: 0 },
    { hopCount: 1, age: 0,  sophistication: 0, expected: 1 },
    { hopCount: 3, age: 0,  sophistication: 2, expected: 1 },
    { hopCount: 0, age: 15, sophistication: 0, expected: 1 },
    { hopCount: 2, age: 25, sophistication: 0, expected: 4 },
    { hopCount: 4, age: 0,  sophistication: 0, expected: 4 },
    { hopCount: 0, age: 0,  sophistication: 4, expected: 0 },
  ];
  for (const f of fixtures) {
    const result = computeTier(f.hopCount, f.age, f.sophistication);
    assert.equal(result, f.expected,
      `computeTier(${f.hopCount}, ${f.age}, ${f.sophistication}) = ${result}, expected ${f.expected}`);
  }
});

test('U72-02: computeTier clamps to 0..4', () => {
  assert.equal(computeTier(100, 100, 0), 4);
  assert.equal(computeTier(0, 0, 100), 0);
  assert.equal(computeTier(-1, -1, -1), 0);
});

// ── U73 — invariant: rumor references ───────────────────────────────────

test('U73-01: NPC with rumorIds referencing non-existent rumor throws invariant', () => {
  const w = mkWorldWithNpc();
  // Bypass ensureWorld to inject bad state
  const nodeId = w.map.currentNodeId;
  const nodes = w.map.nodes.map(n => {
    if (n.id !== nodeId) return n;
    const npcs = n.settlement.npcs.map(npc => {
      if (npc.id !== 'npc-barkeep') return npc;
      return { ...npc, rumorIds: ['nonexistent'] };
    });
    return { ...n, settlement: { ...n.settlement, npcs } };
  });
  assert.throws(() => {
    ensureWorld({ ...w, map: { ...w.map, nodes } });
  }, /non-existent rumor/);
});

test('U73-02: rumor with empty body throws invariant', () => {
  // Build a valid world, then inject bad data post-normalization
  const w = mkWorld();
  const bad = { ...w, rumors: [{ id: 'r1', sourceSeedId: 's1', carrierNpcId: '', hopCount: 0, tier: 0, age: 0, mintedAt: 0, body: '', tags: [] }] };
  assert.throws(() => {
    assertWorldInvariants(bad);
  }, /empty body|has empty body/);
});

test('U73-03: rumor with tier out of range throws invariant', () => {
  const w = mkWorld();
  const bad = { ...w, rumors: [{ id: 'r1', sourceSeedId: 's1', carrierNpcId: '', hopCount: 0, tier: 5, age: 0, mintedAt: 0, body: 'text', tags: [] }] };
  assert.throws(() => {
    assertWorldInvariants(bad);
  }, /tier must be integer 0\.\.4/);
});

test('U73-04: duplicate rumor ids throws invariant', () => {
  const w = mkWorld();
  const rumor = { id: 'dup', sourceSeedId: 's', carrierNpcId: '', hopCount: 0, tier: 0, age: 0, mintedAt: 0, body: 'text', tags: [] };
  const bad = { ...w, rumors: [rumor, { ...rumor }] };
  assert.throws(() => {
    assertWorldInvariants(bad);
  }, /duplicate rumor/);
});

test('U73-05: NPC with invalid sophistication throws invariant', () => {
  const w = mkWorldWithNpc();
  const nodeId = w.map.currentNodeId;
  const nodes = w.map.nodes.map(n => {
    if (n.id !== nodeId) return n;
    const npcs = n.settlement.npcs.map(npc => {
      if (npc.id !== 'npc-barkeep') return npc;
      return { ...npc, sophistication: 5 };
    });
    return { ...n, settlement: { ...n.settlement, npcs } };
  });
  assert.throws(() => {
    ensureWorld({ ...w, map: { ...w.map, nodes } });
  }, /sophistication must be integer 0\.\.4/);
});

// ── Migration v16 → v21 ────────────────────────────────────────────────

test('U70-11: loading a v16 save upgrades to current version with empty rumors', () => {
  const v16Save = {
    meta: { version: 16, seed: 'u70-mig', fate: 0.2, campaignId: 'c' },
    party: [{
      id: 'party',
      name: 'Hero',
      stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 }
    }]
  };
  const storage = mkStorage();
  storage.setItem('ai-dm-v2:slot:slot1', JSON.stringify(v16Save));
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const loaded = loadSlot(storage, 'slot1');
    assert.ok(loaded);
    assert.equal(loaded.meta.version, WORLD_VERSION);
    assert.deepEqual(loaded.rumors, []);
    assert.ok(warnings.length > 0, 'expected a version-mismatch warning');
    assert.ok(warnings[0].includes('v16'));
    assert.ok(warnings[0].includes('v31'));
  } finally {
    console.warn = origWarn;
  }
});

// ── worldHash stability ─────────────────────────────────────────────────

test('U70-12: worldHash changes when rumors are added', () => {
  const w = mkWorldWithNpc();
  const h1 = worldHash(w);
  const w2 = applyDeltas(w, [{ op: 'mintRumor', rumor: mkRumor() }]);
  const h2 = worldHash(w2);
  assert.notEqual(h1, h2);
});

test('U70-13: worldHash stable across ensureWorld roundtrip', () => {
  const w = mkWorldWithNpc();
  const w2 = applyDeltas(w, [{ op: 'mintRumor', rumor: mkRumor() }]);
  const h1 = worldHash(w2);
  const w3 = ensureWorld(w2);
  const h2 = worldHash(w3);
  assert.equal(h1, h2);
});
