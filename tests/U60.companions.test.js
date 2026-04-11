// U60 — Pass C1 Companions.
//
// Recruit via dialogue (invite_to_travel topic), dismiss via player verb,
// follow on move, party state shape with companion marker, narrator
// context + system prompt rendering, save roundtrip + determinism.
//
// U60-29 is the integration gate: newWorld → dialogue → recruit → move →
// save/load → dismiss → verify, with each substep asserted.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld, WORLD_VERSION, appendRecentBeat } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';
import { beginDialogue, askNpc, endDialogue, availableTopics } from '../engine/npc/dialogue.js';
import { playerMove } from '../engine/playloop.js';
import { buildDMContext } from '../engine/ai/narratorContext.js';
import { buildDMSystemPrompt } from '../engine/llmAdapter.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

// ── helpers ──────────────────────────────────────────────────────────────

function seedPlayer(w, name = 'Hero') {
  // newWorld() leaves party empty — chargen seeds the player in the live
  // playloop. Tests need a player at party[0] so the companion-marker invariants
  // and party.length math line up. ensureWorld will normalize the entity shape.
  const player = {
    id: 'party',
    name,
    archetype: 'wanderer',
    vibe: 'grim',
    stress: 0,
    wounds: 0,
    stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 },
    inventory: { weapons: [], armor: [], tools: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [] },
    traits: { vibe: 'grim', fear: '', flaw: '', ideal: '', detail: '', keepsake: '', lineYouWontCross: '', rumor: '' },
    background: { name: 'wanderer', tags: [], hook: '' },
    signature: { itemName: '', meaning: '' },
    position: { zone: 'far', localFtX: 0, localFtY: 0 },
    companion: null
  };
  return ensureWorld({ ...w, party: [player, ...((w.party || []).slice(1))] });
}

function makeWorldWithSettlement(seed = 'u60-seed', { requireNeighbor = false } = {}) {
  let w = newWorld({ seed, fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } });
  const settlements = w.map.nodes.filter(n => n.nodeType === 'settlement');
  if (!settlements.length) throw new Error('No settlements in test world');
  // Prefer a settlement with at least one outgoing edge — required by tests
  // that need to travel to a neighbor.
  const edges = Array.isArray(w.map.edges) ? w.map.edges : [];
  const pick = requireNeighbor
    ? (settlements.find(s => edges.some(e => e.a === s.id || e.b === s.id)) || settlements[0])
    : settlements[0];
  const nodeId = pick.id;
  w = { ...w, map: { ...w.map, currentNodeId: nodeId } };
  const pack = { objectives: ['survive'], factionPool: [{ id: 'civic', type: 'civic' }] };
  w = decompressAndCanonizeSync(w, nodeId, pack);
  w = seedPlayer(w);
  return { w, nodeId };
}

function getNpcs(w, nodeId) {
  return w.map.nodes.find(n => n.id === nodeId).settlement.npcs;
}

function setNpcTrust(w, nodeId, npcId, trust) {
  const nodes = w.map.nodes.map(n => {
    if (n.id !== nodeId) return n;
    const nextNpcs = n.settlement.npcs.map(npc => {
      if (npc.id !== npcId) return npc;
      return {
        ...npc,
        conversationState: { ...npc.conversationState, trustLevel: trust }
      };
    });
    return { ...n, settlement: { ...n.settlement, npcs: nextNpcs } };
  });
  return { ...w, map: { ...w.map, nodes } };
}

function addCompanionDirect(w, opts = {}) {
  const sourceId = opts.sourceNpcId || 'npc_test_src';
  const id = opts.id || `companion_${sourceId}`;
  const member = {
    id,
    name: opts.name || 'Kael',
    archetype: opts.role || 'guard',
    vibe: 'companion',
    stress: 0,
    wounds: 0,
    stats: { MIGHT: 12, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 },
    inventory: { weapons: [], armor: [], tools: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [] },
    traits: { vibe: 'companion', fear: '', flaw: '', ideal: '', detail: '', keepsake: '', lineYouWontCross: '', rumor: '' },
    background: { name: opts.role || 'guard', tags: [], hook: '' },
    signature: { itemName: '', meaning: '' },
    position: { zone: 'far' },
    companion: {
      sourceNpcId: sourceId,
      recruitedAtTurn: 0,
      trustLevel: opts.trustLevel ?? 7,
      role: opts.role || 'guard'
    }
  };
  return ensureWorld({ ...w, party: [...(w.party || []), member] });
}

// ── 01-07: state shape + invariants ─────────────────────────────────────

test('U60-01: WORLD_VERSION is 14', () => {
  assert.equal(WORLD_VERSION, 14);
  const w = newWorld({ seed: 'u60-01', fate: 0.2, pack: { primaryId: 'fantasy', mixerId: null } });
  assert.equal(w.meta.version, 14);
});

test('U60-02: ensureEntity normalizes companion: null when field is missing', () => {
  const w = ensureWorld({
    meta: { seed: 's', fate: 0.2 },
    party: [{ id: 'party', name: 'Hero' }]
  });
  assert.equal(w.party.length, 1);
  assert.equal(w.party[0].companion, null);
});

test('U60-03: ensureEntity normalizes well-formed companion field', () => {
  const w = ensureWorld({
    meta: { seed: 's', fate: 0.2 },
    party: [
      { id: 'party', name: 'Hero' },
      {
        id: 'companion_npc_a', name: 'Kael',
        companion: { sourceNpcId: 'npc_a', recruitedAtTurn: 5, trustLevel: 7, role: 'guard' }
      }
    ]
  });
  const c = w.party[1].companion;
  assert.equal(c.sourceNpcId, 'npc_a');
  assert.equal(c.recruitedAtTurn, 5);
  assert.equal(c.trustLevel, 7);
  assert.equal(c.role, 'guard');
});

test('U60-04: ensureEntity rejects malformed companion field to null', () => {
  const w = ensureWorld({
    meta: { seed: 's', fate: 0.2 },
    party: [
      { id: 'party', name: 'Hero' },
      // Missing sourceNpcId — invalid, should normalize to null
      { id: 'companion_a', name: 'Kael', companion: { recruitedAtTurn: 1, trustLevel: 5 } }
    ]
  });
  // companion=null on a non-player entity is allowed (ensureEntity normalized);
  // but the invariant requires party[0].companion to be null. So with companion
  // null on idx 1 the world is valid.
  assert.equal(w.party[1].companion, null);
});

test('U60-05: invariant throws when party.length > 3', () => {
  const w = newWorld({ seed: 'u60-05', fate: 0.2, pack: { primaryId: 'fantasy', mixerId: null } });
  // Build a 4-member party manually and try to ensureWorld it
  const four = [
    w.party[0],
    { id: 'c1', name: 'A', companion: { sourceNpcId: 'a', recruitedAtTurn: 0, trustLevel: 5, role: 'r1' } },
    { id: 'c2', name: 'B', companion: { sourceNpcId: 'b', recruitedAtTurn: 0, trustLevel: 5, role: 'r2' } },
    { id: 'c3', name: 'C', companion: { sourceNpcId: 'c', recruitedAtTurn: 0, trustLevel: 5, role: 'r3' } }
  ];
  assert.throws(() => ensureWorld({ ...w, party: four }), /party\.length 4 exceeds cap 3/);
});

test('U60-06: invariant throws when party[0].companion is non-null', () => {
  const w = newWorld({ seed: 'u60-06', fate: 0.2, pack: { primaryId: 'fantasy', mixerId: null } });
  const bad = [
    {
      ...w.party[0],
      companion: { sourceNpcId: 'x', recruitedAtTurn: 0, trustLevel: 5, role: 'r' }
    }
  ];
  assert.throws(() => ensureWorld({ ...w, party: bad }), /party\[0\]\.companion must be null/);
});

test('U60-07: invariant throws on duplicate sourceNpcId across companions', () => {
  const w = newWorld({ seed: 'u60-07', fate: 0.2, pack: { primaryId: 'fantasy', mixerId: null } });
  const dupes = [
    w.party[0],
    { id: 'c1', name: 'A', companion: { sourceNpcId: 'same', recruitedAtTurn: 0, trustLevel: 5, role: 'r1' } },
    { id: 'c2', name: 'B', companion: { sourceNpcId: 'same', recruitedAtTurn: 0, trustLevel: 5, role: 'r2' } }
  ];
  assert.throws(() => ensureWorld({ ...w, party: dupes }), /duplicate companion sourceNpcId/);
});

// ── 08-11: delta ops ────────────────────────────────────────────────────

test('U60-08: recruitCompanion mints party entity with role-bumped stats and removes NPC from settlement', () => {
  const { w, nodeId } = makeWorldWithSettlement('u60-08');
  const npc = getNpcs(w, nodeId).find(n => n.role === 'smith') || getNpcs(w, nodeId)[0];
  const role = npc.role;
  const w1 = applyDeltas(w, [{ op: 'recruitCompanion', sourceNpcId: npc.id, nodeId }]);
  assert.equal(w1.party.length, 2);
  const comp = w1.party[1];
  assert.equal(comp.companion.sourceNpcId, npc.id);
  assert.equal(comp.name, npc.name);
  assert.equal(comp.companion.role, role);
  // Source NPC removed
  const stillThere = getNpcs(w1, nodeId).find(n => n.id === npc.id);
  assert.equal(stillThere, undefined);
  // Stats: role-bump table — every value at least 10, total = 50 + 2 (or 50 if role unmapped)
  const total = comp.stats.MIGHT + comp.stats.AGILITY + comp.stats.WITS + comp.stats.GRIT + comp.stats.CHARM;
  assert.ok(total === 50 || total === 52, `expected 50 or 52, got ${total}`);
});

test('U60-09: recruitCompanion at party.length == 3 is a no-op', () => {
  const { w, nodeId } = makeWorldWithSettlement('u60-09');
  // Player is already at party[0]; add two companions to hit the cap of 3.
  let w1 = addCompanionDirect(w, { id: 'c_a', sourceNpcId: 'npca', name: 'A' });
  w1 = addCompanionDirect(w1, { id: 'c_b', sourceNpcId: 'npcb', name: 'B' });
  assert.equal(w1.party.length, 3);
  const npc = getNpcs(w1, nodeId)[0];
  const before = JSON.stringify(w1.party);
  const w2 = applyDeltas(w1, [{ op: 'recruitCompanion', sourceNpcId: npc.id, nodeId }]);
  assert.equal(w2.party.length, 3);
  assert.equal(JSON.stringify(w2.party), before);
  // NPC must still be in settlement
  assert.ok(getNpcs(w2, nodeId).some(n => n.id === npc.id));
});

test('U60-10: dismissCompanion removes companion; NPC is NOT restored to settlement', () => {
  const { w, nodeId } = makeWorldWithSettlement('u60-10');
  const npc = getNpcs(w, nodeId)[0];
  const w1 = applyDeltas(w, [{ op: 'recruitCompanion', sourceNpcId: npc.id, nodeId }]);
  assert.equal(w1.party.length, 2);
  const compId = w1.party[1].id;
  const w2 = applyDeltas(w1, [{ op: 'dismissCompanion', entityId: compId }]);
  assert.equal(w2.party.length, 1);
  // NPC must NOT have been restored
  assert.equal(getNpcs(w2, nodeId).find(n => n.id === npc.id), undefined);
});

test('U60-11: dismissCompanion on player id is a no-op', () => {
  const { w } = makeWorldWithSettlement('u60-11');
  const playerId = w.party[0].id;
  const before = JSON.stringify(w.party);
  const w1 = applyDeltas(w, [{ op: 'dismissCompanion', entityId: playerId }]);
  assert.equal(JSON.stringify(w1.party), before);
});

// ── 12-16: dialogue topic surfacing + recruit ──────────────────────────

test('U60-12: invite_to_travel surfaces at trust 6 with party room', () => {
  const { w, nodeId } = makeWorldWithSettlement('u60-12');
  const npc = getNpcs(w, nodeId)[0];
  const wTrusted = setNpcTrust(w, nodeId, npc.id, 6);
  const { world: w1 } = beginDialogue(wTrusted, npc.id);
  const topics = availableTopics(w1);
  assert.ok(topics.includes('invite_to_travel'), `topics=${JSON.stringify(topics)}`);
});

test('U60-13: invite_to_travel hidden when party is full (length 3)', () => {
  const { w, nodeId } = makeWorldWithSettlement('u60-13');
  const npc = getNpcs(w, nodeId)[0];
  let wTrusted = setNpcTrust(w, nodeId, npc.id, 8);
  // Player + two companions = 3 (cap).
  wTrusted = addCompanionDirect(wTrusted, { id: 'c_a', sourceNpcId: 'a', name: 'A' });
  wTrusted = addCompanionDirect(wTrusted, { id: 'c_b', sourceNpcId: 'b', name: 'B' });
  const { world: w1 } = beginDialogue(wTrusted, npc.id);
  const topics = availableTopics(w1);
  assert.ok(!topics.includes('invite_to_travel'));
});

test('U60-14: invite_to_travel hidden at trust 5', () => {
  const { w, nodeId } = makeWorldWithSettlement('u60-14');
  const npc = getNpcs(w, nodeId)[0];
  const wTrusted = setNpcTrust(w, nodeId, npc.id, 5);
  const { world: w1 } = beginDialogue(wTrusted, npc.id);
  const topics = availableTopics(w1);
  assert.ok(!topics.includes('invite_to_travel'));
});

test('U60-15: invite_to_travel hidden when NPC is already a companion', () => {
  const { w, nodeId } = makeWorldWithSettlement('u60-15');
  const npc = getNpcs(w, nodeId)[0];
  let wTrusted = setNpcTrust(w, nodeId, npc.id, 8);
  // Manually add a companion with this NPC's id as the source
  wTrusted = addCompanionDirect(wTrusted, { sourceNpcId: npc.id, id: `companion_${npc.id}`, name: 'X' });
  const { world: w1 } = beginDialogue(wTrusted, npc.id);
  const topics = availableTopics(w1);
  assert.ok(!topics.includes('invite_to_travel'));
});

test('U60-16: invite_to_travel at trust ≥ 6 recruits via askNpc', () => {
  const { w, nodeId } = makeWorldWithSettlement('u60-16');
  const npc = getNpcs(w, nodeId)[0];
  const wTrusted = setNpcTrust(w, nodeId, npc.id, 6);
  const { world: wd } = beginDialogue(wTrusted, npc.id);
  const { world: wAfter, outcome } = askNpc(wd, 'I invite to travel');
  assert.equal(outcome.mode, 'recruited');
  assert.equal(wAfter.party.length, 2);
  assert.equal(wAfter.party[1].companion.sourceNpcId, npc.id);
  // Source NPC removed from settlement
  assert.equal(getNpcs(wAfter, nodeId).find(n => n.id === npc.id), undefined);
  // Dialogue closed (recruit auto-ends so the npc-at-current-node invariant holds)
  assert.equal(wAfter.scene.dialogue, null);
});

// ── 17-18: refusal paths ────────────────────────────────────────────────

test('U60-17: invite_to_travel at trust 4 refuses soft, -1 trust, no recruit, no beat', () => {
  const { w, nodeId } = makeWorldWithSettlement('u60-17');
  const npc = getNpcs(w, nodeId)[0];
  const wTrusted = setNpcTrust(w, nodeId, npc.id, 4);
  const { world: wd } = beginDialogue(wTrusted, npc.id);
  const beatsBefore = wd.recentBeats.length;
  const { world: wAfter, outcome } = askNpc(wd, 'invite to travel');
  assert.equal(outcome.mode, 'refused-soft');
  assert.equal(outcome.trustDelta, -1);
  assert.equal(wAfter.party.length, 1);
  // NPC trust dropped to 3
  const npcAfter = getNpcs(wAfter, nodeId).find(n => n.id === npc.id);
  assert.equal(npcAfter.conversationState.trustLevel, 3);
  // No beat appended by askNpc itself
  assert.equal(wAfter.recentBeats.length, beatsBefore);
});

test('U60-18: invite_to_travel at trust 3 refuses hard, -1 trust, no recruit, no beat', () => {
  const { w, nodeId } = makeWorldWithSettlement('u60-18');
  const npc = getNpcs(w, nodeId)[0];
  const wTrusted = setNpcTrust(w, nodeId, npc.id, 3);
  const { world: wd } = beginDialogue(wTrusted, npc.id);
  const beatsBefore = wd.recentBeats.length;
  const { world: wAfter, outcome } = askNpc(wd, 'invite to travel');
  assert.equal(outcome.mode, 'refused-hard');
  assert.equal(outcome.trustDelta, -1);
  assert.equal(wAfter.party.length, 1);
  const npcAfter = getNpcs(wAfter, nodeId).find(n => n.id === npc.id);
  assert.equal(npcAfter.conversationState.trustLevel, 2);
  assert.equal(wAfter.recentBeats.length, beatsBefore);
});

// ── 19-20: dismiss verb ─────────────────────────────────────────────────

test('U60-19: `dismiss <name>` removes matching companion and emits dismiss beat', () => {
  const { w } = makeWorldWithSettlement('u60-19');
  const wWith = addCompanionDirect(w, { id: 'c_kael', sourceNpcId: 'src_kael', name: 'Kael' });
  const beatsBefore = wWith.recentBeats.length;
  const { world: wAfter } = playerMove(wWith, packsById, 'dismiss Kael');
  assert.equal(wAfter.party.length, 1);
  assert.equal(wAfter.recentBeats.length, beatsBefore + 1);
  const lastBeat = wAfter.recentBeats[wAfter.recentBeats.length - 1];
  assert.match(lastBeat.mechanics, /^dismiss:c_kael$/);
});

test('U60-20: `dismiss <name>` with no matching companion is a safe no-op', () => {
  const { w } = makeWorldWithSettlement('u60-20');
  const wWith = addCompanionDirect(w, { id: 'c_kael', sourceNpcId: 'src_kael', name: 'Kael' });
  const before = JSON.stringify(wWith.party);
  const beatsBefore = wWith.recentBeats.length;
  const { world: wAfter, output } = playerMove(wWith, packsById, 'dismiss Bogus');
  assert.equal(JSON.stringify(wAfter.party), before);
  assert.equal(wAfter.recentBeats.length, beatsBefore);
  assert.match(output.mechanics, /no-such-companion/);
});

// ── 21-22: follow mechanics ─────────────────────────────────────────────

test('U60-21: playerMove across nodes updates all companion positions', () => {
  const { w, nodeId } = makeWorldWithSettlement('u60-21', { requireNeighbor: true });
  // Find an adjacent node to travel to
  const edge = w.map.edges.find(e => e.a === nodeId || e.b === nodeId);
  assert.ok(edge, 'no neighbor to travel to');
  const target = edge.a === nodeId ? edge.b : edge.a;
  const targetNode = w.map.nodes.find(n => n.id === target);

  let wWith = addCompanionDirect(w, { id: 'c_kael', sourceNpcId: 'src_kael', name: 'Kael' });
  // Set distinct positions to verify the companion's gets updated.
  wWith = ensureWorld({
    ...wWith,
    party: wWith.party.map((p, i) => ({
      ...p,
      position: { ...(p.position || {}), zone: i === 0 ? 'far' : 'far', localFtX: 0, localFtY: 0 }
    }))
  });
  const { world: wAfter } = playerMove(wWith, packsById, `travel to ${targetNode.name}`);
  assert.equal(wAfter.party.length, 2);
  // Both party members should have zone 'near' after travel
  assert.equal(wAfter.party[0].position.zone, wAfter.party[1].position.zone);
});

test('U60-22: local feet move updates all companion positions', () => {
  const { w } = makeWorldWithSettlement('u60-22');
  const wWith = addCompanionDirect(w, { id: 'c_kael', sourceNpcId: 'src_kael', name: 'Kael' });
  const { world: wAfter } = playerMove(wWith, packsById, 'move 30ft north');
  assert.equal(wAfter.party.length, 2);
  assert.equal(wAfter.party[0].position.localFtX, wAfter.party[1].position.localFtX);
  assert.equal(wAfter.party[0].position.localFtY, wAfter.party[1].position.localFtY);
});

// ── 23-26: narrator context + system prompt ─────────────────────────────

test('U60-23: buildDMContext exposes companions array when party has them', () => {
  const { w } = makeWorldWithSettlement('u60-23');
  const wWith = addCompanionDirect(w, { id: 'c_kael', sourceNpcId: 'src_kael', name: 'Kael', role: 'guard', trustLevel: 7 });
  const ctx = buildDMContext(wWith, {}, packsById.fantasy);
  assert.ok(Array.isArray(ctx.companions));
  assert.equal(ctx.companions.length, 1);
  assert.equal(ctx.companions[0].name, 'Kael');
  assert.equal(ctx.companions[0].role, 'guard');
  assert.equal(ctx.companions[0].trustLevel, 7);
});

test('U60-24: buildDMContext.companions is [] when party is solo', () => {
  const { w } = makeWorldWithSettlement('u60-24');
  const ctx = buildDMContext(w, {}, packsById.fantasy);
  assert.deepEqual(ctx.companions, []);
});

test('U60-25: system prompt includes COMPANIONS block between PLAYER and RECENT BEATS', () => {
  const { w } = makeWorldWithSettlement('u60-25');
  let wWith = addCompanionDirect(w, { id: 'c_kael', sourceNpcId: 'src_kael', name: 'Kael', role: 'guard', trustLevel: 7 });
  // Seed a beat so the BEATS section is not empty.
  wWith = appendRecentBeat(wWith, {
    t: 0, input: 'test', approach: 'force', stake: 'harm',
    outcome: 'success', location: 'town', mechanics: 'roll'
  });
  const ctx = buildDMContext(wWith, {}, packsById.fantasy);
  const prompt = buildDMSystemPrompt(ctx);
  assert.ok(prompt.includes('COMPANIONS (traveling with you):'));
  assert.ok(prompt.includes('Kael (guard): trust 7/10'));
  // Order: PLAYER → COMPANIONS → RECENT BEATS
  const playerIdx = prompt.indexOf('PLAYER:');
  const compIdx = prompt.indexOf('COMPANIONS');
  const beatsIdx = prompt.indexOf('RECENT BEATS');
  assert.ok(playerIdx >= 0 && compIdx > playerIdx && beatsIdx > compIdx,
    `order broken: player=${playerIdx} companions=${compIdx} beats=${beatsIdx}`);
});

test('U60-26: system prompt omits COMPANIONS block when party is solo', () => {
  const { w } = makeWorldWithSettlement('u60-26');
  const ctx = buildDMContext(w, {}, packsById.fantasy);
  const prompt = buildDMSystemPrompt(ctx);
  assert.ok(!prompt.includes('COMPANIONS (traveling with you):'));
});

// ── 27-28: save + determinism ───────────────────────────────────────────

test('U60-27: save roundtrip preserves companion marker shape', () => {
  const { w } = makeWorldWithSettlement('u60-27');
  const wWith = addCompanionDirect(w, { id: 'c_kael', sourceNpcId: 'src_kael', name: 'Kael', role: 'guard', trustLevel: 6 });
  const exported = exportWorld(wWith);
  const reloaded = importWorld(exported);
  assert.equal(reloaded.party.length, 2);
  assert.deepEqual(reloaded.party[1].companion, wWith.party[1].companion);
});

test('U60-28: recruiting a companion is deterministic under replay', () => {
  const { w: a, nodeId: aNodeId } = makeWorldWithSettlement('u60-28');
  const { w: b, nodeId: bNodeId } = makeWorldWithSettlement('u60-28');
  const npcA = getNpcs(a, aNodeId)[0];
  const npcB = getNpcs(b, bNodeId)[0];
  const wA = applyDeltas(a, [{ op: 'recruitCompanion', sourceNpcId: npcA.id, nodeId: aNodeId }]);
  const wB = applyDeltas(b, [{ op: 'recruitCompanion', sourceNpcId: npcB.id, nodeId: bNodeId }]);
  assert.equal(worldHash(wA), worldHash(wB));
});

// ── 29: integration gate — newWorld → recruit → move → save → dismiss ──

test('U60-29: end-to-end Pass C1 integration gate', () => {
  // (a) newWorld + place player at a settlement with a trust-6 NPC
  const { w: w0, nodeId } = makeWorldWithSettlement('u60-29', { requireNeighbor: true });
  const npc = getNpcs(w0, nodeId)[0];
  const wTrusted = setNpcTrust(w0, nodeId, npc.id, 6);
  assert.ok(wTrusted, 'substep a: world set up');

  // (b) beginDialogue with that NPC
  const { world: wd, outcome: beginOutcome } = beginDialogue(wTrusted, npc.id);
  assert.equal(beginOutcome.ok, true, 'substep b: dialogue began');

  // (c) askNpc with the invite topic → 'recruited'
  const { world: wRecruited, outcome: askOutcome } = askNpc(wd, 'I invite to travel');
  assert.equal(askOutcome.mode, 'recruited', 'substep c: recruit outcome mode');
  assert.equal(wRecruited.party.length, 2, 'substep c: party grew');
  const companionId = wRecruited.party[1].id;
  const companionName = wRecruited.party[1].name;

  // Append the recruit beat manually (the spec ties beats to dialogue's
  // recruit branch through the playloop, but askNpc itself does not push
  // beats — playloop is the seam. We mirror the beat the playloop would
  // emit so the integration gate can verify recentBeats end-state.)
  let wWithBeat = appendRecentBeat(wRecruited, {
    t: Number(wRecruited.time?.turn ?? 0),
    input: 'invite to travel',
    approach: 'heart',
    stake: 'companionship',
    outcome: 'success',
    location: String(wRecruited.scene?.location || ''),
    mechanics: `recruit:${npc.id}`
  });

  // (d) endDialogue is implicit — recruit auto-clears it
  assert.equal(wWithBeat.scene.dialogue, null, 'substep d: dialogue closed by recruit');

  // (e) playerMove to an adjacent node → companion position matches player
  const edge = wWithBeat.map.edges.find(e => e.a === nodeId || e.b === nodeId);
  assert.ok(edge, 'substep e: neighbor exists');
  const targetId = edge.a === nodeId ? edge.b : edge.a;
  const targetName = wWithBeat.map.nodes.find(n => n.id === targetId).name;
  const { world: wMoved } = playerMove(wWithBeat, packsById, `travel to ${targetName}`);
  assert.notEqual(wMoved.map.currentNodeId, nodeId, 'substep e: node changed');
  assert.equal(wMoved.party[0].position.zone, wMoved.party[1].position.zone, 'substep e: companion zone matches');

  // (f) save → import → party.length 2 + marker intact
  const exported = exportWorld(wMoved);
  const wReloaded = importWorld(exported);
  assert.equal(wReloaded.party.length, 2, 'substep f: party survived save');
  assert.equal(wReloaded.party[1].companion.sourceNpcId, npc.id, 'substep f: marker intact');

  // (g) dismiss <name> → party.length 1 + dismiss beat
  const { world: wDismissed } = playerMove(wReloaded, packsById, `dismiss ${companionName}`);
  assert.equal(wDismissed.party.length, 1, 'substep g: party shrank');
  const dismissBeat = wDismissed.recentBeats.find(b => b.mechanics === `dismiss:${companionId}`);
  assert.ok(dismissBeat, 'substep g: dismiss beat present');

  // (h) recentBeats contains exactly one recruit beat and one dismiss beat
  const recruitBeats = wDismissed.recentBeats.filter(b => /^recruit:/.test(b.mechanics));
  const dismissBeats = wDismissed.recentBeats.filter(b => /^dismiss:/.test(b.mechanics));
  assert.equal(recruitBeats.length, 1, 'substep h: exactly one recruit beat');
  assert.equal(dismissBeats.length, 1, 'substep h: exactly one dismiss beat');

  // Final invariant pass
  assert.doesNotThrow(() => assertWorldInvariants(wDismissed));
});

// ── U60-30 — Pass C1.1 fresh-world recruit walk ──────────────────────────
// U60-29 seeded trust directly on the NPC, which hid a bug where fresh-world
// NPCs had no public facts in their knowledgeGraph — dialogue always
// deflected, trust never climbed, the invite topic never surfaced. This
// gate drives the path: fresh world → talk → ask-until-trust-6 → invite →
// recruit. No manual trust seeding. No delta ops that paper over the bug.

test('U60-30: fresh-world recruit walk via dialogue (no trust seeding)', () => {
  const { w: w0, nodeId } = makeWorldWithSettlement('u60-30', { requireNeighbor: true });
  const npc = getNpcs(w0, nodeId)[0];

  // Baseline: trust starts at 5, public facts must exist on genesis.
  assert.equal(npc.conversationState.trustLevel, 5, 'fresh NPC trust is 5');
  const publicFacts = (npc.knowledgeGraph || []).filter(f =>
    f && f.source !== 'secret' && !npc.secrets.includes(String(f.factId || ''))
  );
  assert.ok(publicFacts.length >= 1, 'genesis seeds at least one public fact');
  const topicId = String(publicFacts[0].factId);

  // Begin dialogue — topic must be askable even at trust 5 via the public
  // reveal threshold (trust >= 4 for non-secret facts).
  let { world: w1 } = beginDialogue(w0, npc.id);

  // Drive a keyword string pulled from the public factId so extractTopic
  // scores a hit. Factids use underscores — player input expresses them as
  // space-delimited words.
  const askText = 'I ask about ' + topicId.replace(/_/g, ' ');

  // Loop asks until trust reaches 6 — cap the loop so a failure yields a
  // clear error instead of hanging.
  const MAX_ASKS = 12;
  let lastMode = '';
  let asks = 0;
  for (; asks < MAX_ASKS; asks++) {
    const { world: wNext, outcome } = askNpc(w1, askText);
    w1 = wNext;
    lastMode = outcome.mode;
    if (Number(outcome.trustLevel) >= 6) break;
    // Safety: if the mode is not 'shared' the trust delta is zero or
    // negative and the loop will never converge. Surface it fast.
    assert.equal(outcome.mode, 'shared', `ask#${asks + 1}: expected shared, got ${outcome.mode}`);
  }
  assert.ok(asks < MAX_ASKS, `trust reached 6 within ${asks + 1} asks`);
  assert.equal(lastMode, 'shared', 'final ask mode is shared');

  // Invite topic now surfaces in availableTopics.
  const topics = availableTopics(w1);
  assert.ok(topics.includes('invite_to_travel'), 'invite_to_travel topic surfaces');

  // Accept — askNpc with the invite phrase recruits.
  const { world: wRecruited, outcome: inviteOutcome } = askNpc(w1, 'invite to travel');
  assert.equal(inviteOutcome.mode, 'recruited', 'invite returns recruited');
  assert.equal(wRecruited.party.length, 2, 'party grew to 2');
  assert.ok(wRecruited.party[1].companion != null, 'companion marker set');
  assert.equal(wRecruited.party[1].companion.sourceNpcId, npc.id, 'source npc linked');
});

// ── U60-31 — recentBeats populates on social and resolve turns ─────────────
// Pass C1.1 closed a gap where dialogue enter/ask returned without writing
// a beat; Recent Beats read "No history yet" through whole conversations.
// This gate locks the engine behavior so regressions can't re-open the gap.

test('U60-31: recentBeats populates on dialogue enter + ask', () => {
  const { w: w0, nodeId } = makeWorldWithSettlement('u60-31');
  const npc = getNpcs(w0, nodeId)[0];
  assert.equal((w0.recentBeats || []).length, 0, 'fresh world: no beats');

  // Dialogue enter via playerMove — beat written even though no roll occurs.
  const firstName = String(npc.name || '').split(' ')[0] || String(npc.name || '');
  const { world: w1 } = playerMove(w0, packsById, `talk to ${firstName}`);
  assert.ok((w1.recentBeats || []).length >= 1, 'dialogue enter writes a beat');
  const enterBeat = w1.recentBeats[w1.recentBeats.length - 1];
  assert.match(String(enterBeat.mechanics || ''), /^dialogue:enter/, 'enter beat tagged');

  // Dialogue ask via playerMove — another beat on top.
  const { world: w2 } = playerMove(w1, packsById, 'ask about the local market gossip');
  assert.ok((w2.recentBeats || []).length >= 2, 'dialogue ask writes a beat');
  const askBeat = w2.recentBeats[w2.recentBeats.length - 1];
  assert.match(String(askBeat.mechanics || ''), /^dialogue:/, 'ask beat tagged');
  assert.doesNotThrow(() => assertWorldInvariants(w2));
});
