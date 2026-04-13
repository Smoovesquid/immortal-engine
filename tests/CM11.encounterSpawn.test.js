import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEncounter, selectCreatures, spawnEncounter } from '../engine/combat/encounterSpawn.js';
import { ensureWorld, newWorld } from '../engine/state.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { beginCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { playerMove, beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── helpers ──────────────────────────────────────────────────────────────

function makeWorld(overrides = {}) {
  const base = newWorld({ seed: 'cm11test', fate: 0.2, campaignId: 'test' });
  let w = ensureWorld({
    ...base,
    ...overrides,
    instrument: {
      ...base.instrument,
      inevitability: 0,
      threads: [],
      ...(overrides.instrument || {})
    },
    clocks: { dread: 0, pressure: 0, revelation: 0, ...(overrides.clocks || {}) },
    combat: { ...base.combat, ...(overrides.combat || {}) },
    ending: { ...base.ending, ...(overrides.ending || {}) },
    threads: overrides.threads || base.threads || []
  });
  return w;
}

function rng(seed = 'test') {
  return makeRng(seedFromString(seed));
}

const __dirname = path.dirname(new URL(import.meta.url).pathname);

function loadPacks() {
  const packsDir = path.join(__dirname, '..', 'packs');
  const manifestRaw = JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf8'));
  const manifest = normalizeManifest(manifestRaw);
  const byId = {};
  for (const p of manifest.packs) {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8'));
    byId[p.id] = normalizePack(raw);
  }
  return byId;
}

// ── evaluateEncounter ────────────────────────────────────────────────────

describe('CM11 — Encounter spawning', () => {
  it('CM11-01: confrontation beat at tension >= 3 spawns encounter', () => {
    const w = makeWorld({ instrument: { inevitability: 4 } });
    const plan = { beatType: 'confrontation' };
    const result = evaluateEncounter(w, plan, rng());
    assert.equal(result.spawn, true, 'should spawn');
    assert.ok(result.cr > 0, 'CR should be positive');
    assert.ok(result.count >= 1, 'count should be >= 1');
  });

  it('CM11-02: quiet beat does NOT spawn encounter', () => {
    const w = makeWorld({ instrument: { inevitability: 8 } });
    const plan = { beatType: 'quiet' };
    const result = evaluateEncounter(w, plan, rng());
    assert.equal(result.spawn, false);
  });

  it('CM11-03: escalation at low tension does NOT spawn', () => {
    const w = makeWorld({ instrument: { inevitability: 2 }, clocks: { dread: 0 } });
    const plan = { beatType: 'escalation' };
    const result = evaluateEncounter(w, plan, rng());
    assert.equal(result.spawn, false);
  });

  it('CM11-04: escalation at high tension + dread DOES spawn', () => {
    const w = makeWorld({
      instrument: { inevitability: 6 },
      clocks: { dread: 5, pressure: 0, revelation: 0 }
    });
    const plan = { beatType: 'escalation' };
    const result = evaluateEncounter(w, plan, rng());
    assert.equal(result.spawn, true, 'should spawn on escalation + tension 6 + dread 5');
    assert.equal(result.ambush, false, 'escalation encounters are not ambushes');
  });

  it('CM11-05: thread tension >= 6 forces ambush', () => {
    const w = makeWorld({
      instrument: { inevitability: 3 },
      threads: [
        { id: 'threat_1', objective: 'dark forces', tension: 7, trajectory: 'static', factionId: '', nodeId: '', active: true, age: 0 }
      ]
    });
    const plan = { beatType: 'confrontation' };
    const result = evaluateEncounter(w, plan, rng());
    assert.equal(result.spawn, true);
    assert.equal(result.ambush, true, 'high thread tension forces ambush');
  });

  it('CM11-06: no spawn during active combat', () => {
    let w = makeWorld({ instrument: { inevitability: 8 } });
    // Start combat properly so invariants hold
    w = beginCombat(w, {
      enemies: [mintEnemyFromNpc({ id: 'npc_test', name: 'Thug', hostile: true, combatProfile: { maxHp: 10, damage: 3 } })],
      reason: 'test'
    });
    assert.equal(w.combat.active, true, 'precondition: combat active');
    const plan = { beatType: 'confrontation' };
    const result = evaluateEncounter(w, plan, rng());
    assert.equal(result.spawn, false);
  });

  it('CM11-07: no spawn during locked ending', () => {
    const w = makeWorld({
      instrument: { inevitability: 8 },
      ending: { locked: true }
    });
    const plan = { beatType: 'confrontation' };
    const result = evaluateEncounter(w, plan, rng());
    assert.equal(result.spawn, false);
  });

  it('CM11-08: CR scales with player level', () => {
    const pc1 = { id: 'pc_1', name: 'Hero', level: 1, stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } };
    const pc5 = { ...pc1, level: 5 };

    const w1 = ensureWorld({ ...makeWorld({ instrument: { inevitability: 4 } }), party: [pc1] });
    const w5 = ensureWorld({ ...makeWorld({ instrument: { inevitability: 4 } }), party: [pc5] });

    const plan = { beatType: 'confrontation' };
    const r1 = evaluateEncounter(w1, plan, rng());
    const r5 = evaluateEncounter(w5, plan, rng());

    assert.ok(r1.cr > 0, `L1 CR should be positive, got ${r1.cr}`);
    assert.ok(r5.cr > r1.cr, `L5 CR (${r5.cr}) should be higher than L1 CR (${r1.cr})`);
    assert.ok(r1.cr < 1, 'L1 CR should be < 1');
    assert.ok(r5.cr < 2, 'L5 CR should be < 2');
  });

  it('CM11-09: creature count scales with tension', () => {
    const plan = { beatType: 'confrontation' };

    const w2 = makeWorld({ instrument: { inevitability: 3 } });
    const r2 = evaluateEncounter(w2, plan, rng());
    assert.equal(r2.count, 1, 'tension 3 → 1 creature');

    const w5 = makeWorld({ instrument: { inevitability: 5 } });
    const r5 = evaluateEncounter(w5, plan, rng());
    assert.equal(r5.count, 2, 'tension 5 → 2 creatures');

    const w5d = makeWorld({
      instrument: { inevitability: 5 },
      clocks: { dread: 7, pressure: 0, revelation: 0 }
    });
    const r5d = evaluateEncounter(w5d, plan, rng());
    assert.equal(r5d.count, 3, 'tension 5 + dread 7 → 3 creatures');
  });

  // ── selectCreatures ────────────────────────────────────────────────────

  it('CM11-10: selectCreatures returns valid bestiary creatures', () => {
    const creatures = selectCreatures(1, 2, null, rng());
    assert.equal(creatures.length, 2, 'should return 2 creatures');
    for (const c of creatures) {
      assert.ok(c.name, 'creature should have a name');
      assert.ok(typeof c.maxHp === 'number' && c.maxHp > 0, 'creature should have maxHp');
      assert.ok(typeof c.ac === 'number', 'creature should have ac');
      assert.ok(Array.isArray(c.actions), 'creature should have actions');
    }
  });

  it('CM11-11: encounter is deterministic', () => {
    const w = makeWorld({ instrument: { inevitability: 5 } });
    const plan = { beatType: 'confrontation' };

    const r1 = evaluateEncounter(w, plan, rng('determ'));
    const c1 = selectCreatures(r1.cr, r1.count, null, rng('determ_select'));

    const r2 = evaluateEncounter(w, plan, rng('determ'));
    const c2 = selectCreatures(r2.cr, r2.count, null, rng('determ_select'));

    assert.deepStrictEqual(r1, r2, 'evaluation should be deterministic');
    assert.equal(c1.length, c2.length, 'same creature count');
    for (let i = 0; i < c1.length; i++) {
      assert.equal(c1[i].ref, c2[i].ref, `creature ${i} should be the same`);
    }
  });

  // ── spawnEncounter ─────────────────────────────────────────────────────

  it('CM11-12: spawnEncounter with ambush auto-starts combat', () => {
    const w = makeWorld();
    const creatures = selectCreatures(1, 2, null, rng());
    const result = spawnEncounter(w, creatures, { ambush: true, reason: 'ambush' }, rng());
    assert.equal(result.combat.active, true, 'combat should be active');
    assert.ok(result.combat.enemies.length > 0, 'should have enemies');
    assert.ok(result.combat.initiativeOrder.length > 0, 'should have initiative order');
  });

  it('CM11-13: spawnEncounter without ambush places enemies but no active combat', () => {
    let w = makeWorld();
    // Ensure there's a current node with a settlement
    const nodeId = String(w.map?.currentNodeId ?? '');
    assert.ok(nodeId, 'world should have a current node');

    const creatures = selectCreatures(1, 2, null, rng());
    const result = spawnEncounter(w, creatures, { ambush: false, reason: 'encounter' }, rng('npc'));
    assert.equal(result.combat.active, false, 'combat should NOT be active');

    // Find the current node and check for hostile NPCs
    const node = (result.map?.nodes || []).find(n => n && n.id === nodeId);
    assert.ok(node, 'current node should exist');
    const npcs = node?.settlement?.npcs || [];
    const hostileNpcs = npcs.filter(n => n.hostile === true);
    assert.ok(hostileNpcs.length >= 2, `should have at least 2 hostile NPCs, got ${hostileNpcs.length}`);
  });

  // ── integration: existing manual attack path ───────────────────────────

  it('CM11-14: existing manual attack path still works', () => {
    const packs = loadPacks();
    let w = makeWorld();
    // Ensure a hostile NPC at the current node
    const nodeId = String(w.map?.currentNodeId ?? '');
    const nodes = [...w.map.nodes];
    const idx = nodes.findIndex(n => n && n.id === nodeId);
    if (idx >= 0) {
      const node = nodes[idx];
      const settlement = node.settlement || {};
      const npcs = Array.isArray(settlement.npcs) ? [...settlement.npcs] : [];
      npcs.push({
        id: 'npc_test_hostile',
        name: 'Thug',
        role: 'bandit',
        archetypeDesc: '',
        factionId: null,
        originTick: 0,
        disposition: {},
        hostile: true,
        combatProfile: { maxHp: 10, damage: 3, canParley: false },
        knowledgeGraph: [],
        conversationState: { metPlayer: false, topicsDiscussed: [], trustLevel: 0, lastInteraction: null },
        personality: { honesty: 0.3, trustOfOutsiders: 0.1, selfPreservation: 0.8 },
        witnessedEvents: [],
        secrets: [],
        playerRelationship: { trust: 0, meetings: 0, sharedFacts: [] }
      });
      nodes[idx] = { ...node, settlement: { ...settlement, npcs } };
      w = ensureWorld({ ...w, map: { ...w.map, nodes } });
    }

    const { world: after } = playerMove(w, packs, 'attack Thug');
    assert.equal(after.combat.active, true, 'combat should be active after attacking hostile NPC');
    assert.ok(after.combat.enemies.some(e => e.name === 'Thug'), 'Thug should be an enemy');
  });

  it('CM11-15: attack non-hostile NPC makes them hostile and starts combat', () => {
    const packs = loadPacks();
    let w = makeWorld();
    // Place a non-hostile NPC at current node
    const nodeId = String(w.map?.currentNodeId ?? '');
    const nodes = [...w.map.nodes];
    const idx = nodes.findIndex(n => n && n.id === nodeId);
    if (idx >= 0) {
      const node = nodes[idx];
      const settlement = node.settlement || {};
      const npcs = Array.isArray(settlement.npcs) ? [...settlement.npcs] : [];
      // Remove any existing hostile NPCs so the hostile-only path doesn't fire
      const filtered = npcs.filter(n => !n.hostile);
      filtered.push({
        id: 'npc_test_merchant',
        name: 'Merchant',
        role: 'merchant',
        archetypeDesc: '',
        factionId: null,
        originTick: 0,
        disposition: {},
        hostile: false,
        combatProfile: { maxHp: 8, damage: 2, canParley: true },
        knowledgeGraph: [],
        conversationState: { metPlayer: false, topicsDiscussed: [], trustLevel: 0, lastInteraction: null },
        personality: { honesty: 0.7, trustOfOutsiders: 0.5, selfPreservation: 0.6 },
        witnessedEvents: [],
        secrets: [],
        playerRelationship: { trust: 0, meetings: 0, sharedFacts: [] }
      });
      nodes[idx] = { ...node, settlement: { ...settlement, npcs: filtered } };
      w = ensureWorld({ ...w, map: { ...w.map, nodes } });
    }

    const { world: after } = playerMove(w, packs, 'attack Merchant');
    assert.equal(after.combat.active, true, 'combat should be active after attacking non-hostile NPC');
    assert.ok(after.combat.enemies.some(e => e.name === 'Merchant'), 'Merchant should be an enemy');
  });
});
