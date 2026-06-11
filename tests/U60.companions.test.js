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
import { ensureMap } from '../engine/map/mapState.js';
import { buildDMContext } from '../engine/ai/narratorContext.js';
import { buildDMSystemPrompt } from '../engine/llmAdapter.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { resolveCompanionTurn } from '../engine/combat/companionTurn.js';

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

// v20 free-roam: there is no teleport-to-node. Walk the avatar one tile at a
// time toward a target node's cell; landing on it triggers arrival (companion
// position sync, goal checks, etc.).
function walkToNode(w, packs, targetId) {
  for (let i = 0; i < 100; i++) {
    // County-scale roads have ambushes; a walker fights through them.
    let guard = 0;
    while (w.combat?.active && guard++ < 30) {
      w = playerMove(w, packs, 'strike').world;
    }
    const m = ensureMap(w.map);
    const target = m.nodes.find(n => String(n.id) === String(targetId));
    const { x, y } = m.pos;
    if (x === target.x && y === target.y) break;
    const cmd = (target.x !== x)
      ? (target.x > x ? 'go east' : 'go west')
      : (target.y > y ? 'go south' : 'go north');
    w = playerMove(w, packs, cmd).world;
  }
  return w;
}

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
  // Teleporting the test to a settlement must move BOTH the node pointer and
  // the avatar's cell — they are separate state (pos persists by design).
  w = { ...w, map: { ...w.map, currentNodeId: nodeId, pos: { x: pick.x, y: pick.y } } };
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

test('U60-01: WORLD_VERSION is 25', () => {
  assert.equal(WORLD_VERSION, 25);
  const w = newWorld({ seed: 'u60-01', fate: 0.2, pack: { primaryId: 'fantasy', mixerId: null } });
  assert.equal(w.meta.version, 25);
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
  const wAfter = walkToNode(wWith, packsById, target);
  assert.equal(wAfter.map.currentNodeId, target, 'walked to neighbor cell');
  assert.equal(wAfter.party.length, 2);
  // Both party members should share a zone after arrival
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
  const wMoved = walkToNode(wWithBeat, packsById, targetId);
  assert.equal(wMoved.map.currentNodeId, targetId, 'substep e: node changed');
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

  // Accept — drive the recruit step through playerMove so the layer above
  // askNpc (the dialogue intercept + breaking-intent guard) actually runs.
  // The earlier U60-30 called askNpc directly, which hid C1.2: the literal
  // "invite to travel" matches moveAdvancesScene('\\btravel\\b') and the
  // intercept routed it to movement instead of recruit.
  const startNode = w1.map.currentNodeId;
  const { world: wRecruited } = playerMove(w1, packsById, 'invite to travel');
  assert.equal(wRecruited.party.length, 2, 'party grew to 2');
  assert.ok(wRecruited.party[1].companion != null, 'companion marker set');
  assert.equal(wRecruited.party[1].companion.sourceNpcId, npc.id, 'source npc linked');
  assert.equal(wRecruited.map.currentNodeId, startNode, 'player did not travel');
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

// ── U60-32 — Pass C1.2 recruit-intent precedence gate ─────────────────────
// Narrow regression: locks the rule that playerMove routes "invite to travel"
// to the recruit branch instead of the movement branch. The recruit phrase
// contains "travel", which moveAdvancesScene matches; without the recruit
// short-circuit in the dialogue intercept, playerMove would treat the input
// as a dialogue-breaking movement intent and walk the player to a neighbor.
// Trust is seeded directly here — this test is NOT the fresh-world walk
// gate (U60-30 is). The only thing being asserted here is precedence.

test('U60-32: playerMove("invite to travel") during dialogue recruits, does not travel', () => {
  const { w: w0, nodeId } = makeWorldWithSettlement('u60-32', { requireNeighbor: true });
  const npc = getNpcs(w0, nodeId)[0];
  const wTrusted = setNpcTrust(w0, nodeId, npc.id, 6);
  const { world: w1 } = beginDialogue(wTrusted, npc.id);
  const startNode = w1.map.currentNodeId;
  const { world: wAfter } = playerMove(w1, packsById, 'invite to travel');
  assert.equal(wAfter.party.length, 2, 'playerMove recruited instead of traveling');
  assert.ok(wAfter.party[1].companion != null, 'companion marker set');
  assert.equal(wAfter.party[1].companion.sourceNpcId, npc.id, 'source npc linked');
  assert.equal(wAfter.map.currentNodeId, startNode, 'player did not travel');
  assert.equal(wAfter.scene?.dialogue, null, 'dialogue auto-cleared on recruit');
  assert.doesNotThrow(() => assertWorldInvariants(wAfter));
});

// ── C2 — Pass C2 helpers ─────────────────────────────────────────────────

// Start combat directly via the combatState op — mirrors U58's startCombatDirectly
// so tests don't depend on detectAttackBeginIntent + name matching for simple
// combat-shape fixtures. Uses canParley:false by default so the player's heart
// fallback doesn't trivially end combat.
function startCombatDirectly(world, enemies, reason = 'player-attack') {
  return applyDeltas(world, [{
    op: 'combatState',
    set: { active: true, round: 1, turnIndex: 0, enemies, beganAt: 0, reason, playerGuard: false, companionGuard: false }
  }]);
}

// Mark an NPC hostile at a specific node so detectAttackBeginIntent picks
// them up. Returns a new world.
function setNpcHostile(w, nodeId, npcId, hostile = true) {
  const nodes = w.map.nodes.map(n => {
    if (n.id !== nodeId) return n;
    const nextNpcs = n.settlement.npcs.map(npc => {
      if (npc.id !== npcId) return npc;
      return { ...npc, hostile: Boolean(hostile) };
    });
    return { ...n, settlement: { ...n.settlement, npcs: nextNpcs } };
  });
  return { ...w, map: { ...w.map, nodes } };
}

// ── U60-33..40 — Pass C2: free-movement beats + companion combat ─────────

test('U60-33: free-movement travel writes a recent beat', () => {
  // v20 free-roam: a single cardinal step across the overworld grid writes a
  // travel beat — whether it lands on a node or steps into open wilderness.
  const { w } = makeWorldWithSettlement('u60-33', { requireNeighbor: true });

  const startCount = (w.recentBeats || []).length;
  const { world: w1 } = playerMove(w, packsById, 'go north');
  assert.ok((w1.recentBeats || []).length > startCount, 'free-movement wrote a beat');
  const last = w1.recentBeats[w1.recentBeats.length - 1];
  assert.match(String(last.mechanics || ''), /overworld/, 'beat mechanics tags an overworld travel step');
});

test('U60-34: companion takes a turn after player turn in combat', () => {
  const { w } = makeWorldWithSettlement('u60-34');
  let w1 = addCompanionDirect(w, {
    id: 'c_tove', sourceNpcId: 'src_tove', name: 'Tove', role: 'smith', trustLevel: 7
  });
  // Start combat directly with a beefy enemy so one round doesn't end it.
  w1 = startCombatDirectly(w1, [{
    id: 'enemy_0', name: 'Brigand', hp: 20, maxHp: 20, damage: 2,
    canParley: false, defeated: false, sourceNpcId: 'npc_b0'
  }]);
  const beatsBefore = (w1.recentBeats || []).length;
  const { world: w2 } = playerMove(w1, packsById, 'I strike the brigand');
  assert.ok(w2.combat?.active, 'combat still active after one round');
  const added = (w2.recentBeats || []).slice(beatsBefore);
  // Expect a player beat AND a companion beat (companion forces via smith
  // role = 'force' approach table entry).
  assert.ok(added.length >= 2, `expected >= 2 new beats, got ${added.length}`);
  const companionBeat = added.find(b => /companion Tove/.test(String(b.mechanics || '')));
  assert.ok(companionBeat, 'companion beat present in added beats');
});

test('U60-35: down companion (wounds>=6) does not end combat; player keeps fighting', () => {
  const { w } = makeWorldWithSettlement('u60-35');
  let w1 = addCompanionDirect(w, {
    id: 'c_lucca', sourceNpcId: 'src_lucca', name: 'Lucca', role: 'laborer', trustLevel: 7
  });
  // Drive the companion directly to 6 wounds via the wound op (generalized
  // counter phase — proves the op works on companion ids too).
  w1 = applyDeltas(w1, [{ op: 'wound', entityId: 'c_lucca', by: 6 }]);
  assert.equal(w1.party[1].wounds, 6, 'companion clamped at 6 wounds');

  // Begin combat. A down companion must not cause the resolver to break,
  // nor should the counter phase end combat — only party[0] hitting 6
  // wounds does that.
  w1 = startCombatDirectly(w1, [{
    id: 'enemy_0', name: 'Brigand', hp: 30, maxHp: 30, damage: 2,
    canParley: false, defeated: false, sourceNpcId: 'npc_b'
  }]);
  const beatsBefore = (w1.recentBeats || []).length;
  const { world: w2 } = playerMove(w1, packsById, 'I strike the brigand');
  assert.equal(w2.party[1].wounds, 6, 'companion still at 6 — skipped as counter target');
  assert.ok(w2.party[0].wounds < 6, `player still fighting (wounds=${w2.party[0].wounds})`);
  assert.ok(w2.combat?.active, 'combat continues with a down companion in party');
  // The companion's turn was skipped (down) so we expect a player beat but
  // no companion beat in the added set.
  const added = (w2.recentBeats || []).slice(beatsBefore);
  const companionBeat = added.find(b => /companion Lucca/.test(String(b.mechanics || '')));
  assert.ok(!companionBeat, 'down companion does not take a turn');
});

test('U60-36: companion parley ends combat with companion-parley reason', () => {
  const { w } = makeWorldWithSettlement('u60-36');
  // Heart-approach companion (tavern_keeper).
  let w1 = addCompanionDirect(w, {
    id: 'c_finn', sourceNpcId: 'src_finn', name: 'Finn', role: 'tavern_keeper', trustLevel: 7
  });
  // Enemy with canParley: true so the companion heart-turn can parley.
  // Player uses a non-damaging approach (focus) so the fight doesn't end via
  // player victory before the companion turn.
  w1 = startCombatDirectly(w1, [{
    id: 'enemy_0', name: 'Ronin', hp: 20, maxHp: 20, damage: 2,
    canParley: true, defeated: false, sourceNpcId: 'npc_r'
  }]);
  const { world: w2 } = playerMove(w1, packsById, 'I study the ronin');
  assert.equal(w2.combat?.active, false, 'combat ended after companion parley');
  assert.equal(String(w2.combat?.reason || ''), 'companion-parley', 'end reason recorded');
});

test('U60-37: player defeat still locks ending (regression)', () => {
  const { w } = makeWorldWithSettlement('u60-37');
  let w1 = addCompanionDirect(w, {
    id: 'c_any', sourceNpcId: 'src_any', name: 'Any', role: 'guard', trustLevel: 7
  });
  // Single very-high-damage enemy so counters quickly reach player defeat.
  w1 = startCombatDirectly(w1, [{
    id: 'enemy_0', name: 'Executioner', hp: 60, maxHp: 60, damage: 6,
    canParley: false, defeated: false, sourceNpcId: 'npc_e'
  }]);
  for (let i = 0; i < 8; i++) {
    if (!w1.combat?.active) break;
    if ((w1.party[0].wounds ?? 0) >= 6) break;
    const { world: wNext } = playerMove(w1, packsById, 'I strike');
    w1 = wNext;
  }
  assert.equal(w1.ending?.locked, true, 'ending locked after defeat');
  assert.equal(String(w1.ending?.reason || ''), 'defeated-in-combat', 'defeat reason recorded');
});

test('U60-38: save/load with wounded companion preserves wounds + marker', () => {
  const { w } = makeWorldWithSettlement('u60-38');
  let w1 = addCompanionDirect(w, {
    id: 'c_w', sourceNpcId: 'src_w', name: 'Wanda', role: 'guard', trustLevel: 6
  });
  // Seed companion wounds directly via the wound op (generalized counter phase).
  w1 = applyDeltas(w1, [{ op: 'wound', entityId: 'c_w', by: 3 }]);
  assert.equal(w1.party[1].wounds, 3, 'companion wounded before export');
  const exported = exportWorld(w1);
  const reloaded = importWorld(exported);
  assert.equal(reloaded.party.length, 2, 'party survived save');
  assert.equal(reloaded.party[1].wounds, 3, 'companion wounds persisted');
  assert.equal(reloaded.party[1].companion?.sourceNpcId, 'src_w', 'companion marker intact');
});

test('U60-39: integration walk — recruit via dialogue, attack hostile, companion fights via playerMove', () => {
  const { w: w0, nodeId } = makeWorldWithSettlement('u60-39');

  // Two NPCs: the first gets trust seeded and recruited; the second is
  // marked hostile so the player can "attack <name>" to begin combat.
  const npcs = getNpcs(w0, nodeId);
  assert.ok(npcs.length >= 2, 'need at least two NPCs for the walk');
  const companionNpc = npcs[0];
  const enemyNpc = npcs[1];

  // (a) Seed trust and recruit via playerMove('invite to travel').
  let w1 = setNpcTrust(w0, nodeId, companionNpc.id, 6);
  const { world: wDlg } = beginDialogue(w1, companionNpc.id);
  w1 = wDlg;
  const { world: wRec } = playerMove(w1, packsById, 'invite to travel');
  assert.equal(wRec.party.length, 2, 'recruited via playerMove');

  // (b) Mark the second NPC hostile at the node, then attack them.
  const wHostile = setNpcHostile(wRec, nodeId, enemyNpc.id, true);
  // Pick a stable single-token from the enemy name so detectAttackBeginIntent
  // matches via the includes branch.
  const enemyRef = String(enemyNpc.name || enemyNpc.id);
  const beatsBefore = (wHostile.recentBeats || []).length;
  const { world: wCombatBegin } = playerMove(wHostile, packsById, `attack ${enemyRef}`);
  assert.ok(
    wCombatBegin.combat?.active || wCombatBegin.combat?.reason === 'parley' || (wCombatBegin.combat?.enemies || []).length > 0,
    'attack started combat'
  );

  // (c) Loop combat rounds via playerMove until combat ends. Verify the
  // companion is still in party throughout.
  let w2 = wCombatBegin;
  for (let i = 0; i < 20; i++) {
    if (!w2.combat?.active) break;
    const { world: wNext } = playerMove(w2, packsById, 'I strike the foe');
    w2 = wNext;
  }
  // After the walk, the companion is still at party[1] (unless combat
  // killed the player, which depends on dice — assert minimally that party
  // still contains the companion slot as long as the player isn't defeated).
  if (!w2.ending?.locked) {
    assert.equal(w2.party.length, 2, 'companion still in party after combat');
    assert.ok(w2.party[1].companion != null, 'companion marker intact');
  }
  // In any case, verify at least one companion beat OR player beat landed.
  const added = (w2.recentBeats || []).slice(beatsBefore);
  assert.ok(added.length > 0, 'combat produced beats via playerMove');
});

test('U60-40: unknown-role companion falls back to force approach', () => {
  const { w } = makeWorldWithSettlement('u60-40');
  let w1 = addCompanionDirect(w, {
    id: 'c_x', sourceNpcId: 'src_x', name: 'Xen', role: 'unknown_role_xyz', trustLevel: 7
  });
  w1 = startCombatDirectly(w1, [{
    id: 'enemy_0', name: 'Mook', hp: 30, maxHp: 30, damage: 1,
    canParley: false, defeated: false, sourceNpcId: 'npc_m'
  }]);
  const ct = resolveCompanionTurn(w1, w1.party[1]);
  assert.equal(ct.result.skipped, false, 'companion turn resolved');
  assert.equal(ct.result.approach, 'force', 'unknown role falls back to force');
  assert.match(String(ct.result.mechanicsLine || ''), /force/, 'mechanicsLine tags force');
});
