// UX1: Play Experience integration tests.
//
// Verifies:
// - Dev info hidden by default / visible when toggled
// - Combat flow end-to-end (programmatic): spawn, fight, victory, loot

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, newScene } from '../engine/playloop.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { beginCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── helpers ──────────────────────────────────────────────────────────────

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

function mkWorld(overrides = {}) {
  const w = newWorld({
    seed: overrides.seed || 'ux1-test',
    fate: overrides.fate ?? 0.5,
    campaignId: 'ux1',
    pack: { primaryId: 'fantasy', mixerId: null }
  });
  return ensureWorld({ ...w, ...overrides });
}

function mkCombatWorld(seedKey, enemyHp) {
  const pc = {
    id: 'party', name: 'Hero', vibe: 'steady', archetype: 'wanderer',
    wounds: 0, stress: 0, resources: { Supply: 5 },
    level: 5,
    stats: { MIGHT: 18, AGILITY: 14, WITS: 12, GRIT: 14, CHARM: 10 },
    inventory: { items: [] },
    spells: { known: [], slots: {}, maxSlots: {}, concentration: null }
  };

  let w = newWorld({
    seed: `ux1-${seedKey}`, fate: 0.5, campaignId: 'ux1',
    pack: { primaryId: 'fantasy', mixerId: null }
  });
  w = ensureWorld({
    ...w,
    party: [pc],
    scene: { location: 'arena', objective: 'fight', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });

  const enemy = {
    id: 'enemy_0',
    name: 'Training Dummy',
    hp: enemyHp || 6,
    maxHp: enemyHp || 6,
    damage: 1,
    ac: 5,
    cr: 0.25,
    damageType: 'bludgeoning',
    resistances: {},
    conditionImmunities: [],
    conditions: [],
    actions: [{ name: 'Slap', toHit: 1, damage: '1d4', type: 'bludgeoning' }],
    multiattack: null,
    saveProficiencies: [],
    canParley: false,
    defeated: false,
    sourceNpcId: '',
    lootTableRef: 'cr_0_1',
    initMod: -2,
    legendaryActions: null,
    reactions: null,
    lairActions: null,
    senses: { darkvision: null, blindsight: null, tremorsense: null, truesight: null }
  };

  const initOrder = [
    { id: 'party', type: 'party', roll: 18, modifier: 2, total: 20 },
    { id: 'enemy_0', type: 'enemy', roll: 3, modifier: -2, total: 1 }
  ];

  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      active: true, round: 1, turnIndex: 0, enemies: [enemy],
      beganAt: 0, reason: 'test', playerGuard: false, companionGuard: false,
      initiativeOrder: initOrder
    }
  }]);

  return w;
}

// ── UX1 tests ───────────────────────────────────────────────────────────

describe('UX1 — Play experience', () => {
  it('UX1-01: dev info is hidden by default (dev-only class present)', () => {
    // The v1.js UI uses the class 'dev-only' for dev info elements.
    // Default state: devMode = false → elements get 'dev-only' (display:none).
    // This test verifies the CSS contract: 'dev-only' without 'dev-visible'
    // means display:none per styles.css.
    const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');
    assert.ok(css.includes('.dev-only{display:none}'), 'dev-only class should hide elements');
    assert.ok(css.includes('.dev-only.dev-visible{display:revert}'), 'dev-visible should show dev elements');
  });

  it('UX1-02: dev toggle exists in nav and controls devMode state', () => {
    // Verify v1.js contains the Dev toggle button and devMode flag.
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'v1.js'), 'utf8');
    assert.ok(js.includes('devMode'), 'v1.js should have devMode state');
    assert.ok(js.includes("'Dev'"), 'v1.js should render Dev toggle button');
    assert.ok(js.includes('dev-toggle'), 'v1.js should use dev-toggle class');
    assert.ok(js.includes('dev-only'), 'v1.js should use dev-only class for hidden dev info');
  });

  it('UX1-03: combat flow end-to-end — fight resolves cleanly', () => {
    // Try multiple seeds to find one where the player wins (deterministic but seed-dependent)
    let won = false;
    for (const seed of ['win1', 'win2', 'win3', 'win4', 'win5', 'win6', 'win7', 'win8']) {
      let w = mkCombatWorld(seed, 1);
      assert.equal(w.combat.active, true, 'combat should be active');

      for (let round = 0; round < 10; round++) {
        if (!w.combat.active) break;
        const res = resolveCombatTurn(w, {
          approachTag: 'force', intentText: 'finish it', risk: 0.1, stakeTag: 'harm'
        });
        w = res.world;
        assertWorldInvariants(w);
      }

      // Combat should have ended one way or another
      assert.equal(w.combat.active, false, 'combat should resolve');

      // Check for victory loot
      const timeline = Array.isArray(w.timeline) ? w.timeline : [];
      const victoryEvent = timeline.find(ev => ev?.kind === 'combat-end' && ev?.data?.reason === 'combat-victory');
      if (victoryEvent) {
        won = true;
        // Loot should exist (even if empty array)
        assert.ok('loot' in (victoryEvent.data || {}), 'victory event should have loot key');
        break;
      }
    }
    assert.ok(won, 'at least one seed should produce a victory against a 1HP enemy');
  });

  it('UX1-04: combat flow via playerMove attack path', () => {
    const packs = loadPacks();
    let w = mkWorld({ seed: 'ux1-attack' });
    const { world: w1 } = beginAdventure(w, packs);

    // Place hostile NPC
    const nodeId = String(w1.map?.currentNodeId ?? '');
    const nodes = [...w1.map.nodes];
    const idx = nodes.findIndex(n => n && n.id === nodeId);
    assert.ok(idx >= 0, 'should have current node');

    const node = nodes[idx];
    const settlement = node.settlement || {};
    const npcs = Array.isArray(settlement.npcs) ? [...settlement.npcs] : [];
    npcs.push({
      id: 'npc_goblin', name: 'Goblin', role: 'hostile', archetypeDesc: '',
      factionId: null, originTick: 0, disposition: {}, hostile: true,
      combatProfile: { maxHp: 4, damage: 1, canParley: false },
      knowledgeGraph: [],
      conversationState: { metPlayer: false, topicsDiscussed: [], trustLevel: 0, lastInteraction: null },
      personality: { honesty: 0.3, trustOfOutsiders: 0.1, selfPreservation: 0.8 },
      witnessedEvents: [], secrets: [],
      playerRelationship: { trust: 0, meetings: 0, sharedFacts: [] }
    });
    nodes[idx] = { ...node, settlement: { ...settlement, npcs } };
    const w2 = ensureWorld({ ...w1, map: { ...w1.map, nodes } });

    // Attack the goblin
    const { world: w3 } = playerMove(w2, packs, 'attack Goblin');
    assert.equal(w3.combat.active, true, 'combat should start after attacking hostile NPC');
    assert.ok(w3.combat.enemies.some(e => e.name === 'Goblin'), 'Goblin should be enemy');
  });

  it('UX1-05: Wizard prefix stripped from narration text', () => {
    // Verify v1.js strips "Wizard: " prefix from narration
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'v1.js'), 'utf8');
    assert.ok(
      js.includes("text.startsWith('Wizard: ')"),
      'v1.js should strip Wizard: prefix from narration'
    );
    // Verify hardcoded lines no longer start with "Wizard:"
    assert.ok(
      !js.includes("text: 'Wizard: The world steadies"),
      'startup line should not have Wizard: prefix'
    );
    assert.ok(
      !js.includes("text: 'Wizard: Welcome back"),
      'continue line should not have Wizard: prefix'
    );
  });
});
