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
  const fate = overrides.meta?.fate ?? 0.2;
  const base = newWorld({ seed: 'cm11test', fate, campaignId: 'test' });
  let w = ensureWorld({
    ...base,
    ...overrides,
    meta: { ...base.meta, ...(overrides.meta || {}) },
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
  it('CM11-01: high dread + fate spawns encounter', () => {
    // dread 8, fate 0.8 → chance = (8/12)*0.8 = 0.533
    // Use a seed that yields nextFloat < 0.533
    const w = makeWorld({
      clocks: { dread: 8, pressure: 0, revelation: 0 },
      meta: { fate: 0.8 }
    });
    // Try many seeds — at 53% chance, most will spawn
    let spawned = false;
    for (let i = 0; i < 20; i++) {
      const result = evaluateEncounter(w, {}, rng(`spawn-${i}`));
      if (result.spawn) { spawned = true; break; }
    }
    assert.ok(spawned, 'high dread + fate should spawn encounters');
  });

  it('CM11-02: dread 0 never spawns regardless of fate', () => {
    const w = makeWorld({
      clocks: { dread: 0, pressure: 0, revelation: 0 },
      meta: { fate: 1.0 }
    });
    for (let i = 0; i < 20; i++) {
      const result = evaluateEncounter(w, {}, rng(`zero-${i}`));
      assert.equal(result.spawn, false, `dread 0 should never spawn (seed ${i})`);
    }
  });

  it('CM11-03: fate 0 never spawns regardless of dread', () => {
    const w = makeWorld({
      clocks: { dread: 12, pressure: 0, revelation: 0 },
      meta: { fate: 0 }
    });
    for (let i = 0; i < 20; i++) {
      const result = evaluateEncounter(w, {}, rng(`fate0-${i}`));
      assert.equal(result.spawn, false, `fate 0 should never spawn (seed ${i})`);
    }
  });

  it('CM11-04: beat type is irrelevant to spawning', () => {
    // Same dread/fate, different beat types — spawn chance is identical
    const base = { clocks: { dread: 10, pressure: 0, revelation: 0 }, meta: { fate: 0.8 } };
    const w = makeWorld(base);

    const r1 = evaluateEncounter(w, { beatType: 'quiet' }, rng('beat'));
    const r2 = evaluateEncounter(w, { beatType: 'confrontation' }, rng('beat'));
    const r3 = evaluateEncounter(w, { beatType: 'escalation' }, rng('beat'));
    const r4 = evaluateEncounter(w, {}, rng('beat'));

    assert.equal(r1.spawn, r2.spawn, 'quiet and confrontation should give same result');
    assert.equal(r2.spawn, r3.spawn, 'confrontation and escalation should give same result');
    assert.equal(r3.spawn, r4.spawn, 'escalation and no beat should give same result');
  });

  it('CM11-05: ambush only when dread >= 8 AND tension >= 6', () => {
    // High dread + high tension → ambush
    const wAmbush = makeWorld({
      instrument: { inevitability: 7 },
      clocks: { dread: 10, pressure: 0, revelation: 0 },
      meta: { fate: 0.9 }
    });
    let foundAmbush = false;
    for (let i = 0; i < 30; i++) {
      const r = evaluateEncounter(wAmbush, {}, rng(`amb-${i}`));
      if (r.spawn) { assert.equal(r.ambush, true, 'dread 10 + tension 7 → ambush'); foundAmbush = true; break; }
    }
    assert.ok(foundAmbush, 'should have found a spawn');

    // High dread but low tension → spawn but NOT ambush
    const wNoAmb = makeWorld({
      instrument: { inevitability: 3 },
      clocks: { dread: 10, pressure: 0, revelation: 0 },
      meta: { fate: 0.9 }
    });
    let foundNoAmb = false;
    for (let i = 0; i < 30; i++) {
      const r = evaluateEncounter(wNoAmb, {}, rng(`noamb-${i}`));
      if (r.spawn) { assert.equal(r.ambush, false, 'dread 10 + tension 3 → no ambush'); foundNoAmb = true; break; }
    }
    assert.ok(foundNoAmb, 'should have found a spawn');
  });

  it('CM11-06: no spawn during active combat', () => {
    let w = makeWorld({
      clocks: { dread: 12, pressure: 0, revelation: 0 },
      meta: { fate: 1.0 }
    });
    w = beginCombat(w, {
      enemies: [mintEnemyFromNpc({ id: 'npc_test', name: 'Thug', hostile: true, combatProfile: { maxHp: 10, damage: 3 } })],
      reason: 'test'
    });
    assert.equal(w.combat.active, true, 'precondition: combat active');
    const result = evaluateEncounter(w, {}, rng());
    assert.equal(result.spawn, false);
  });

  it('CM11-07: no spawn during locked ending', () => {
    const w = makeWorld({
      clocks: { dread: 12, pressure: 0, revelation: 0 },
      meta: { fate: 1.0 },
      ending: { locked: true }
    });
    const result = evaluateEncounter(w, {}, rng());
    assert.equal(result.spawn, false);
  });

  it('CM11-08: CR scales with player level', () => {
    const pc1 = { id: 'pc_1', name: 'Hero', level: 1, stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } };
    const pc5 = { ...pc1, level: 5 };

    // Use high dread/fate to guarantee spawn
    const base = { clocks: { dread: 12, pressure: 0, revelation: 0 }, meta: { fate: 1.0 }, instrument: { inevitability: 4 } };
    let w1, w5, r1, r5;
    // Find seeds that spawn for both
    for (let i = 0; i < 50; i++) {
      w1 = ensureWorld({ ...makeWorld(base), party: [pc1] });
      w5 = ensureWorld({ ...makeWorld(base), party: [pc5] });
      r1 = evaluateEncounter(w1, {}, rng(`cr-${i}`));
      r5 = evaluateEncounter(w5, {}, rng(`cr-${i}`));
      if (r1.spawn && r5.spawn) break;
    }
    assert.ok(r1.spawn, 'L1 should spawn');
    assert.ok(r5.spawn, 'L5 should spawn');
    assert.ok(r1.cr > 0, `L1 CR should be positive, got ${r1.cr}`);
    assert.ok(r5.cr > r1.cr, `L5 CR (${r5.cr}) should be higher than L1 CR (${r1.cr})`);
  });

  it('CM11-09: creature count scales with tension and dread', () => {
    // tension < 4, dread < 6 → count 1
    const base = { clocks: { dread: 12, pressure: 0, revelation: 0 }, meta: { fate: 1.0 } };

    function getSpawnedResult(overrides) {
      const w = makeWorld({ ...base, ...overrides });
      for (let i = 0; i < 50; i++) {
        const r = evaluateEncounter(w, {}, rng(`cnt-${JSON.stringify(overrides)}-${i}`));
        if (r.spawn) return r;
      }
      return null;
    }

    // tension 2 (no +1), dread 3 (< 6, no +1) → count 1
    const r1 = getSpawnedResult({ instrument: { inevitability: 2 }, clocks: { dread: 3, pressure: 0, revelation: 0 }, meta: { fate: 1.0 } });
    assert.ok(r1, 'should spawn');
    assert.equal(r1.count, 1, 'tension 2 + dread 3 → 1 creature');

    // tension 5 (+1), dread 3 (< 6, no +1) → count 2
    const r2 = getSpawnedResult({ instrument: { inevitability: 5 }, clocks: { dread: 3, pressure: 0, revelation: 0 }, meta: { fate: 1.0 } });
    assert.ok(r2, 'should spawn');
    assert.equal(r2.count, 2, 'tension 5 (+1) → 2 creatures');

    // tension 5 (+1), dread 8 (+1) → count 3
    const r3 = getSpawnedResult({ instrument: { inevitability: 5 }, clocks: { dread: 8, pressure: 0, revelation: 0 }, meta: { fate: 1.0 } });
    assert.ok(r3, 'should spawn');
    assert.equal(r3.count, 3, 'tension 5 (+1) + dread 8 (+1) → 3 creatures');
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
    const w = makeWorld({
      instrument: { inevitability: 5 },
      clocks: { dread: 10, pressure: 0, revelation: 0 },
      meta: { fate: 0.9 }
    });

    const r1 = evaluateEncounter(w, {}, rng('determ'));
    const c1 = selectCreatures(r1.cr, r1.count, null, rng('determ_select'));

    const r2 = evaluateEncounter(w, {}, rng('determ'));
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
