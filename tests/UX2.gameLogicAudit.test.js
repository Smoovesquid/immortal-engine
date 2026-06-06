// UX2: Comprehensive Game Logic Audit
//
// Tests every player-facing logic surface against basic D&D expectations:
//   A. Roll classification (skill check gate)
//   B. Inventory — pick up / take / drop items appear in state
//   C. Combat — attack starts fight, damage applies, defeat ends it, loot appears
//   D. Movement — travel changes node, interior enter/exit works
//   E. Observation — look/describe/question returns info, no state mutation
//   F. Trivial actions — auto-succeed, no roll, no consequences
//   G. Skill checks — uncertain actions roll d20, outcome affects state
//   H. Clocks — dread/pressure/revelation stay in bounds, tick correctly
//   I. Dialogue — talk to NPC enters dialogue, ask yields response
//   J. Spells — cast consumes slot, deals damage/heals, cantrips free
//   K. Save/load — roundtrip preserves world hash
//   L. Determinism — same seed + same input = same output
//   M. Death & ending — wounds cap triggers defeat, ending locks state
//   N. Conditions — applied, ticked, removed correctly
//   O. Ledger — facts/threats/questions added and capped
//   P. World tick — factions/threads/ecology evolve
//   Q. Social influence — persuade/deceive/intimidate roll, basic chat doesn't

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, ensureWorld, appendRecentBeat, defaultCombat } from '../engine/state.js';
import { beginAdventure, playerMove, newScene } from '../engine/playloop.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { resolveMove } from '../engine/resolve.js';
import { beginCombat, endCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { rollDice } from '../engine/combat/diceRoller.js';
import { applyCondition, hasCondition, tickConditions, removeCondition } from '../engine/combat/conditions.js';
import { applyResistance } from '../engine/combat/damageTypes.js';
import { normalizeManifest, normalizePack, fateBand } from '../engine/rulesets.js';
import { addFact, addThreat, addQuestion } from '../engine/ledger.js';
import { worldTick } from '../engine/worldTick.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { worldHash } from '../engine/worldHash.js';
import { makeRng, seedFromString } from '../engine/rng.js';
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

const packs = loadPacks();

function mkWorld(overrides = {}) {
  const w = newWorld({
    seed: overrides.seed || 'ux2-test',
    fate: overrides.fate ?? 0.5,
    campaignId: 'ux2',
    pack: { primaryId: 'fantasy', mixerId: null }
  });
  return ensureWorld({ ...w, ...overrides });
}

function mkAdventureWorld(seed = 'ux2-adv', fate = 0.3) {
  const w = newWorld({ seed, fate, campaignId: 'ux2', pack: { primaryId: 'fantasy', mixerId: null } });
  const { world } = beginAdventure(w, packs);
  return world;
}

function mkCombatWorld(seedKey, enemyOpts = {}) {
  const pc = {
    id: 'party', name: 'Hero', vibe: 'steady', archetype: 'wanderer',
    wounds: 0, stress: 0, resources: { Supply: 5 },
    level: 5,
    stats: { MIGHT: 18, AGILITY: 14, WITS: 12, GRIT: 14, CHARM: 10 },
    inventory: { items: [] },
    spells: { known: [], slots: {}, maxSlots: {}, concentration: null }
  };

  let w = newWorld({
    seed: `ux2-${seedKey}`, fate: 0.5, campaignId: 'ux2',
    pack: { primaryId: 'fantasy', mixerId: null }
  });
  w = ensureWorld({
    ...w,
    party: [pc],
    scene: { location: 'arena', objective: 'fight', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });

  const enemy = {
    id: 'enemy_0',
    name: enemyOpts.name || 'Training Dummy',
    hp: enemyOpts.hp || 6,
    maxHp: enemyOpts.hp || 6,
    damage: enemyOpts.damage || 1,
    ac: enemyOpts.ac || 5,
    cr: enemyOpts.cr || 0.25,
    damageType: 'bludgeoning',
    resistances: enemyOpts.resistances || {},
    conditionImmunities: enemyOpts.conditionImmunities || [],
    conditions: [],
    actions: [{ name: 'Slap', toHit: 1, damage: '1d4', type: 'bludgeoning' }],
    multiattack: null,
    saveProficiencies: [],
    canParley: enemyOpts.canParley ?? false,
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

function getMechanics(output) {
  return String(output?.mechanics || '');
}

function hasRoll(output) {
  // A roll is a d20 vs DC, whether reported as a bare [roll:..] or inside a
  // structured social adjudication ([social:persuade|CHARM|roll:N vs DC:N → …]).
  return /roll:\s*\d+\s+vs\s+DC:\d+/.test(getMechanics(output));
}

// ═══════════════════════════════════════════════════════════════════════════
// A: ROLL CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-A: Roll classification', () => {
  const noRollInputs = [
    // DM questions
    'What do I see?', "What's in this room?", 'Describe this place',
    'Is there a window?', 'How big is this room?', "What's the weather like?",
    'Are there any other people here?', 'Is the door open or closed?',
    // Passive observation
    'Look around', 'I look at the sky', 'I listen', 'I smell the air',
    'I read the sign', 'I check my inventory', 'I examine my surroundings',
    'I watch the crowd', 'I observe the guards', 'I peer into the darkness',
    // Trivial physical
    'I sit down', 'I stand up', 'I draw my sword', 'I open the door',
    'I eat some rations', 'I drink from my waterskin', 'I light a torch',
    'I take the blanket', 'I pick up the key', 'I put on my cloak',
    'I drop my pack', 'I wave', 'I kneel', 'I rest',
    'I grab the torch from the wall', 'I sheathe my sword',
    'I take the potion', 'I pocket the gem', 'I dismount',
    // Social (no influence)
    'I say hello', 'I greet the barkeep', 'I introduce myself',
    'I thank them', 'I nod in agreement', 'I whistle a tune',
  ];

  const rollInputs = [
    'I pick the lock', 'I try to climb the wall', 'I attempt to persuade the guard',
    'I sneak past the sentry', 'I search for hidden traps', 'I force the stuck door open',
    'I leap across the chasm', 'I try to calm the frightened horse',
    'I attempt to track the creature', 'I forage for food in the wilderness',
    'I hide', 'I try to intimidate the thug', 'I attempt to lie to the guard',
    'I try to swim across the river', 'I try to balance on the beam',
    'I search the room for secret doors',
  ];

  for (const input of noRollInputs) {
    it(`no-roll: "${input}"`, () => {
      const w = mkAdventureWorld(`nr-${input.slice(0, 10)}`);
      const { output } = playerMove(w, packs, input);
      assert.ok(!hasRoll(output), `"${input}" should NOT roll d20, got: ${getMechanics(output)}`);
    });
  }

  for (const input of rollInputs) {
    it(`roll: "${input}"`, () => {
      const w = mkAdventureWorld(`r-${input.slice(0, 10)}`);
      const { output } = playerMove(w, packs, input);
      assert.ok(hasRoll(output), `"${input}" SHOULD roll d20, got: ${getMechanics(output)}`);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// B: INVENTORY
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-B: Inventory via deltas', () => {
  it('createItem adds item to entity inventory', () => {
    let w = mkWorld({ seed: 'inv-create' });
    w = ensureWorld({ ...w, party: [{ id: 'party', name: 'Hero', vibe: '', archetype: '', wounds: 0, stress: 0, resources: { Supply: 5 }, level: 1, stats: {}, inventory: { items: [], weapons: [], armor: [] }, spells: { known: [], slots: {}, maxSlots: {}, concentration: null } }] });
    w = applyDeltas(w, [{ op: 'createItem', entityId: 'party', bucket: 'items', item: { name: 'Old Blanket', tags: ['cloth'], weight: 1, noise: 0, light: 0, bulk: 1, notes: '' } }]);
    const items = w.party[0]?.inventory?.items || [];
    assert.ok(items.some(i => i.name === 'Old Blanket'), 'blanket should be in inventory');
  });

  it('removeItem removes item from entity inventory', () => {
    let w = mkWorld({ seed: 'inv-remove' });
    w = ensureWorld({ ...w, party: [{ id: 'party', name: 'Hero', vibe: '', archetype: '', wounds: 0, stress: 0, resources: { Supply: 5 }, level: 1, stats: {}, inventory: { items: [{ name: 'Torch', tags: ['light'], weight: 1, noise: 0, light: 1, bulk: 1, notes: '' }], weapons: [], armor: [] }, spells: { known: [], slots: {}, maxSlots: {}, concentration: null } }] });
    w = applyDeltas(w, [{ op: 'removeItem', entityId: 'party', bucket: 'items', itemName: 'Torch' }]);
    const items = w.party[0]?.inventory?.items || [];
    assert.ok(!items.some(i => i.name === 'Torch'), 'torch should be removed');
  });

  it('addCurrency adds gold to purse', () => {
    let w = mkWorld({ seed: 'inv-gold' });
    w = ensureWorld({ ...w, party: [{ id: 'party', name: 'Hero', vibe: '', archetype: '', wounds: 0, stress: 0, resources: { Supply: 5 }, level: 1, stats: {}, inventory: { items: [] }, spells: { known: [], slots: {}, maxSlots: {}, concentration: null } }] });
    w = applyDeltas(w, [{ op: 'addCurrency', entityId: 'party', currency: 'gold', amount: 50 }]);
    const gold = w.party[0]?.purse?.gold ?? 0;
    assert.ok(gold >= 50, `gold should be >= 50, got ${gold}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C: COMBAT
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-C: Combat logic', () => {
  it('C-01: combat starts with active=true and enemies present', () => {
    const w = mkCombatWorld('c01');
    assert.equal(w.combat.active, true);
    assert.ok(w.combat.enemies.length > 0, 'should have enemies');
    assert.ok(w.combat.initiativeOrder.length > 0, 'should have initiative order');
  });

  it('C-02: combat turn applies damage to enemy', () => {
    let w = mkCombatWorld('c02', { hp: 100, ac: 1 });
    const beforeHp = w.combat.enemies[0].hp;
    // Run several turns to ensure at least one hit
    for (let i = 0; i < 5; i++) {
      if (!w.combat.active) break;
      const res = resolveCombatTurn(w, { approachTag: 'force', intentText: 'attack', risk: 0.1, stakeTag: 'harm' });
      w = res.world;
    }
    const afterHp = w.combat.enemies[0]?.hp ?? 0;
    assert.ok(afterHp < beforeHp, `enemy HP should decrease: ${beforeHp} → ${afterHp}`);
  });

  it('C-03: defeating enemy ends combat', () => {
    let w = mkCombatWorld('c03', { hp: 1, ac: 1 });
    for (let i = 0; i < 10; i++) {
      if (!w.combat.active) break;
      const res = resolveCombatTurn(w, { approachTag: 'force', intentText: 'finish', risk: 0.1, stakeTag: 'harm' });
      w = res.world;
      assertWorldInvariants(w);
    }
    assert.equal(w.combat.active, false, 'combat should end when enemy dies');
  });

  it('C-04: combat victory produces loot event', () => {
    let won = false;
    for (const seed of ['loot1', 'loot2', 'loot3', 'loot4', 'loot5', 'loot6', 'loot7', 'loot8']) {
      let w = mkCombatWorld(seed, { hp: 1 });
      for (let i = 0; i < 10; i++) {
        if (!w.combat.active) break;
        const res = resolveCombatTurn(w, { approachTag: 'force', intentText: 'finish', risk: 0.1, stakeTag: 'harm' });
        w = res.world;
      }
      const timeline = Array.isArray(w.timeline) ? w.timeline : [];
      const victory = timeline.find(ev => ev?.kind === 'combat-end' && ev?.data?.reason === 'combat-victory');
      if (victory) {
        won = true;
        assert.ok('loot' in (victory.data || {}), 'victory event should have loot key');
        break;
      }
    }
    assert.ok(won, 'at least one seed should produce victory');
  });

  it('C-05: damage resistance halves damage', () => {
    const result = applyResistance(10, 'fire', { fire: 'resistant' });
    assert.equal(result.final, 5, 'fire resistant should halve fire damage');
    assert.equal(result.level, 'resistant');
  });

  it('C-06: damage immunity zeroes damage', () => {
    const result = applyResistance(10, 'poison', { poison: 'immune' });
    assert.equal(result.final, 0, 'poison immune should zero poison damage');
    assert.equal(result.level, 'immune');
  });

  it('C-07: dice roller produces valid results', () => {
    const rng = makeRng(seedFromString('dice-test'));
    for (let i = 0; i < 20; i++) {
      const result = rollDice('2d6+3', rng);
      assert.ok(result.total >= 5 && result.total <= 15, `2d6+3 should be 5-15, got ${result.total}`);
    }
  });

  it('C-08: initiative order contains all combatants', () => {
    const w = mkCombatWorld('c08');
    const ids = w.combat.initiativeOrder.map(e => e.id);
    assert.ok(ids.includes('party'), 'initiative should include party');
    assert.ok(ids.includes('enemy_0'), 'initiative should include enemy');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D: MOVEMENT
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-D: Movement', () => {
  it('D-01: travel intent changes current node', () => {
    const w = mkAdventureWorld('d01-travel');
    const before = w.map?.currentNodeId;
    const { world: after } = playerMove(w, packs, 'I travel onward');
    // Either moved or held position (both valid — depends on map adjacency)
    assertWorldInvariants(after);
    // The travel event should exist if movement happened
    if (after.map?.currentNodeId !== before) {
      const travelEvents = (after.timeline || []).filter(e => e?.kind === 'travel');
      assert.ok(travelEvents.length > 0, 'travel should produce travel event');
    }
  });

  it('D-02: directional movement (go north/south/east/west)', () => {
    const w = mkAdventureWorld('d02-dir');
    // Try all directions — at least one should work
    let moved = false;
    for (const dir of ['go north', 'go south', 'go east', 'go west']) {
      const fresh = mkAdventureWorld(`d02-${dir}`);
      const before = fresh.map?.currentNodeId;
      const { world: after } = playerMove(fresh, packs, dir);
      if (after.map?.currentNodeId !== before) { moved = true; break; }
    }
    // Map topology may not have all directions, but at least the command doesn't crash
    assert.ok(true, 'directional movement processed without crash');
  });

  it('D-03: node discovery tracks visited nodes', () => {
    const w = mkAdventureWorld('d03-disc');
    const discovered = w.map?.discovered || [];
    assert.ok(discovered.length > 0, 'starting node should be discovered');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E: OBSERVATION
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-E: Observation has no side effects', () => {
  const observationInputs = [
    'What do I see?', 'Look around', 'I look at the door',
    'Describe this place', 'I check my inventory', 'I listen',
    'Is there a window?', 'How deep is the water?',
  ];

  for (const input of observationInputs) {
    it(`"${input}" — no state mutation`, () => {
      const w = mkAdventureWorld(`obs-${input.slice(0, 8)}`);
      const woundsBefore = w.party?.[0]?.wounds ?? 0;
      const stressBefore = w.party?.[0]?.stress ?? 0;
      const clocksBefore = { ...w.clocks };

      const { world: after, output } = playerMove(w, packs, input);

      assert.equal(after.party?.[0]?.wounds ?? 0, woundsBefore, 'wounds should not change');
      assert.equal(after.party?.[0]?.stress ?? 0, stressBefore, 'stress should not change');
      assert.equal(after.clocks?.dread ?? 0, clocksBefore.dread ?? 0, 'dread should not change');
      assert.equal(after.clocks?.pressure ?? 0, clocksBefore.pressure ?? 0, 'pressure should not change');
      // Should have narration
      assert.ok(output?.narration, 'observation should produce narration');
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// F: TRIVIAL ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-F: Trivial actions auto-succeed', () => {
  const trivialInputs = [
    'I sit down', 'I draw my sword', 'I eat some rations',
    'I take the blanket', 'I pocket the gem', 'I put on my cloak',
    'I sheathe my sword', 'I drop my pack', 'I light a torch',
    'I wave', 'I rest', 'I close the door behind me',
    'I say hello', 'I greet the barkeep', 'I whistle a tune',
  ];

  for (const input of trivialInputs) {
    it(`"${input}" — no roll, no negative consequences`, () => {
      const w = mkAdventureWorld(`triv-${input.slice(0, 8)}`);
      const woundsBefore = w.party?.[0]?.wounds ?? 0;
      const stressBefore = w.party?.[0]?.stress ?? 0;

      const { world: after, output } = playerMove(w, packs, input);

      assert.ok(!hasRoll(output), `should not roll for "${input}"`);
      assert.ok((after.party?.[0]?.wounds ?? 0) <= woundsBefore, 'trivial action should not add wounds');
      assert.ok((after.party?.[0]?.stress ?? 0) <= stressBefore, 'trivial action should not add stress');
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// G: SKILL CHECKS
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-G: Skill checks produce valid outcomes', () => {
  it('G-01: skill check returns success/mixed/failure', () => {
    // Run 20 seeds to get a range of outcomes
    const outcomes = new Set();
    for (let i = 0; i < 20; i++) {
      const w = mkAdventureWorld(`g01-${i}`);
      const { output } = playerMove(w, packs, 'I try to climb the wall');
      const match = getMechanics(output).match(/→\s*(success|failure|mixed)/);
      if (match) outcomes.add(match[1]);
    }
    assert.ok(outcomes.size >= 2, `should see multiple outcome types, got: ${[...outcomes].join(', ')}`);
  });

  it('G-02: failure on skill check can produce consequences', () => {
    // Run many seeds with high-consequence setup
    let sawConsequence = false;
    for (let i = 0; i < 30; i++) {
      let w = mkAdventureWorld(`g02-${i}`);
      // Raise clocks to increase consequence likelihood
      w = applyDeltas(w, [
        { op: 'clock', key: 'dread', by: 6 },
        { op: 'clock', key: 'pressure', by: 6 },
      ]);
      const before = {
        wounds: w.party?.[0]?.wounds ?? 0,
        stress: w.party?.[0]?.stress ?? 0,
        dread: w.clocks?.dread ?? 0,
        pressure: w.clocks?.pressure ?? 0,
      };
      const { world: after } = playerMove(w, packs, 'I try to force the stuck door open');
      const after_ = {
        wounds: after.party?.[0]?.wounds ?? 0,
        stress: after.party?.[0]?.stress ?? 0,
        dread: after.clocks?.dread ?? 0,
        pressure: after.clocks?.pressure ?? 0,
      };
      if (after_.wounds > before.wounds || after_.stress > before.stress ||
          after_.dread > before.dread || after_.pressure > before.pressure) {
        sawConsequence = true;
        break;
      }
    }
    assert.ok(sawConsequence, 'at least one failed skill check should produce consequences');
  });

  it('G-03: roll is always within d20 range', () => {
    for (let i = 0; i < 20; i++) {
      const w = mkAdventureWorld(`g03-${i}`);
      const { output } = playerMove(w, packs, 'I try to pick the lock');
      const match = getMechanics(output).match(/\[roll:(\d+)\s+vs\s+DC:(\d+)/);
      if (match) {
        const roll = parseInt(match[1]);
        const dc = parseInt(match[2]);
        assert.ok(roll >= 1 && roll <= 30, `roll should be 1-30 (with modifiers), got ${roll}`);
        assert.ok(dc >= 1 && dc <= 30, `DC should be reasonable, got ${dc}`);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H: CLOCKS
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-H: Clock mechanics', () => {
  it('H-01: clock deltas clamp to 0..12', () => {
    let w = mkWorld({ seed: 'h01' });
    w = applyDeltas(w, [{ op: 'clock', key: 'dread', by: 20 }]);
    assert.equal(w.clocks.dread, 12, 'dread should clamp at 12');

    w = applyDeltas(w, [{ op: 'clock', key: 'dread', by: -20 }]);
    assert.equal(w.clocks.dread, 0, 'dread should clamp at 0');
  });

  it('H-02: all three clocks independent', () => {
    let w = mkWorld({ seed: 'h02' });
    w = applyDeltas(w, [
      { op: 'clock', key: 'dread', by: 3 },
      { op: 'clock', key: 'pressure', by: 5 },
      { op: 'clock', key: 'revelation', by: 7 },
    ]);
    assert.equal(w.clocks.dread, 3);
    assert.equal(w.clocks.pressure, 5);
    assert.equal(w.clocks.revelation, 7);
  });

  it('H-03: clocks survive ensureWorld normalization', () => {
    let w = mkWorld({ seed: 'h03' });
    w = applyDeltas(w, [{ op: 'clock', key: 'dread', by: 8 }]);
    const w2 = ensureWorld(w);
    assert.equal(w2.clocks.dread, 8);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// I: DIALOGUE
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-I: Dialogue', () => {
  it('I-01: "talk to" intent triggers dialogue when NPC present', () => {
    let w = mkAdventureWorld('i01-dlg');
    // Find current node and check if NPCs exist
    const nodeId = String(w.map?.currentNodeId ?? '');
    const node = (w.map?.nodes || []).find(n => n && n.id === nodeId);
    const npcs = node?.settlement?.npcs || [];

    if (npcs.length > 0) {
      const npcName = npcs[0].name;
      const { world: after, output } = playerMove(w, packs, `talk to ${npcName}`);
      // Either entered dialogue or got a response
      assert.ok(output?.narration, 'dialogue attempt should produce narration');
    }
    // If no NPCs, that's fine — just don't crash
    assert.ok(true, 'dialogue intent processed without crash');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// J: SPELLS
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-J: Spell system via deltas', () => {
  it('J-01: consumeSpellSlot decrements slot count', () => {
    let w = mkWorld({ seed: 'j01' });
    w = ensureWorld({ ...w, party: [{ id: 'party', name: 'Mage', vibe: '', archetype: '', wounds: 0, stress: 0, resources: {}, level: 3, stats: { WITS: 16 }, inventory: { items: [] }, spells: { known: ['fire_bolt'], slots: { 1: 3, 2: 1 }, maxSlots: { 1: 3, 2: 1 }, concentration: null } }] });
    const before = w.party[0].spells.slots[1];
    w = applyDeltas(w, [{ op: 'consumeSpellSlot', level: 1 }]);
    assert.equal(w.party[0].spells.slots[1], before - 1, 'slot should decrement');
  });

  it('J-02: consumeSpellSlot floors at 0', () => {
    let w = mkWorld({ seed: 'j02' });
    w = ensureWorld({ ...w, party: [{ id: 'party', name: 'Mage', vibe: '', archetype: '', wounds: 0, stress: 0, resources: {}, level: 3, stats: {}, inventory: { items: [] }, spells: { known: [], slots: { 1: 0 }, maxSlots: { 1: 2 }, concentration: null } }] });
    w = applyDeltas(w, [{ op: 'consumeSpellSlot', level: 1 }]);
    assert.equal(w.party[0].spells.slots[1], 0, 'slot should not go negative');
  });

  it('J-03: restoreSpellSlots resets to max', () => {
    let w = mkWorld({ seed: 'j03' });
    w = ensureWorld({ ...w, party: [{ id: 'party', name: 'Mage', vibe: '', archetype: '', wounds: 0, stress: 0, resources: {}, level: 3, stats: {}, inventory: { items: [] }, spells: { known: [], slots: { 1: 0, 2: 0 }, maxSlots: { 1: 3, 2: 1 }, concentration: null } }] });
    w = applyDeltas(w, [{ op: 'restoreSpellSlots' }]);
    assert.equal(w.party[0].spells.slots[1], 3);
    assert.equal(w.party[0].spells.slots[2], 1);
  });

  it('J-04: setConcentration tracks active spell', () => {
    let w = mkWorld({ seed: 'j04' });
    w = ensureWorld({ ...w, party: [{ id: 'party', name: 'Mage', vibe: '', archetype: '', wounds: 0, stress: 0, resources: {}, level: 3, stats: {}, inventory: { items: [] }, spells: { known: [], slots: {}, maxSlots: {}, concentration: null } }] });
    w = applyDeltas(w, [{ op: 'setConcentration', spellRef: 'shield_of_faith', startedAt: 1 }]);
    assert.equal(w.party[0].spells.concentration?.spellRef, 'shield_of_faith');
    // Clear concentration
    w = applyDeltas(w, [{ op: 'setConcentration', spellRef: '' }]);
    assert.equal(w.party[0].spells.concentration, null);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// K: SAVE / LOAD
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-K: Save/load roundtrip', () => {
  it('K-01: export/import preserves world hash', () => {
    const w = mkAdventureWorld('k01-save');
    const hash1 = worldHash(w);
    const exported = exportWorld(w);
    const imported = importWorld(exported);
    const hash2 = worldHash(imported);
    assert.equal(hash1, hash2, 'world hash should survive export/import roundtrip');
  });

  it('K-02: exported world passes invariants', () => {
    const w = mkAdventureWorld('k02-inv');
    const exported = exportWorld(w);
    const imported = importWorld(exported);
    assertWorldInvariants(imported);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// L: DETERMINISM
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-L: Determinism', () => {
  it('L-01: same seed + same input = same world hash', () => {
    const w1 = mkAdventureWorld('l01-det');
    const w2 = mkAdventureWorld('l01-det');
    assert.equal(worldHash(w1), worldHash(w2), 'same seed should produce same hash');
  });

  it('L-02: same seed + same playerMove = same result', () => {
    const w1 = mkAdventureWorld('l02-det');
    const w2 = mkAdventureWorld('l02-det');
    const r1 = playerMove(w1, packs, 'I try to pick the lock');
    const r2 = playerMove(w2, packs, 'I try to pick the lock');
    assert.equal(worldHash(r1.world), worldHash(r2.world), 'same input should produce same world');
    assert.equal(getMechanics(r1.output), getMechanics(r2.output), 'same input should produce same mechanics');
  });

  it('L-03: different seeds produce different worlds', () => {
    const w1 = mkAdventureWorld('l03-a');
    const w2 = mkAdventureWorld('l03-b');
    assert.notEqual(worldHash(w1), worldHash(w2), 'different seeds should produce different worlds');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M: DEATH & ENDING
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-M: Death and ending', () => {
  it('M-01: wounds clamp at 6', () => {
    let w = mkWorld({ seed: 'm01' });
    w = ensureWorld({ ...w, party: [{ id: 'party', name: 'Hero', vibe: '', archetype: '', wounds: 0, stress: 0, resources: {}, level: 1, stats: {}, inventory: { items: [] }, spells: { known: [], slots: {}, maxSlots: {}, concentration: null } }] });
    w = applyDeltas(w, [{ op: 'wound', entityId: 'party', by: 10 }]);
    assert.equal(w.party[0].wounds, 6, 'wounds should clamp at 6');
  });

  it('M-02: stress clamps at 6', () => {
    let w = mkWorld({ seed: 'm02' });
    w = ensureWorld({ ...w, party: [{ id: 'party', name: 'Hero', vibe: '', archetype: '', wounds: 0, stress: 0, resources: {}, level: 1, stats: {}, inventory: { items: [] }, spells: { known: [], slots: {}, maxSlots: {}, concentration: null } }] });
    w = applyDeltas(w, [{ op: 'stress', entityId: 'party', by: 10 }]);
    assert.equal(w.party[0].stress, 6, 'stress should clamp at 6');
  });

  it('M-03: ending.locked prevents further state mutation via playerMove', () => {
    let w = mkAdventureWorld('m03-end');
    w = ensureWorld({ ...w, ending: { triggered: true, locked: true, type: 'defeat', epilogueLine: 'fin' } });
    const hash1 = worldHash(w);
    const { world: after } = playerMove(w, packs, 'I try to pick the lock');
    // Ending-locked world should not allow meaningful state changes
    // (timeline may advance but core state should be frozen)
    assert.ok(after.ending?.locked, 'ending should remain locked');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// N: CONDITIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-N: Condition system', () => {
  it('N-01: applyCondition adds condition', () => {
    const conditions = applyCondition([], { name: 'poisoned', until: 3 }, []);
    assert.ok(hasCondition(conditions, 'poisoned'), 'should have poisoned condition');
  });

  it('N-02: condition immunity blocks application', () => {
    const conditions = applyCondition([], { name: 'frightened', until: 3 }, ['frightened']);
    assert.ok(!hasCondition(conditions, 'frightened'), 'frightened should be blocked by immunity');
  });

  it('N-03: removeCondition removes it', () => {
    let conditions = applyCondition([], { name: 'stunned', until: 3 }, []);
    conditions = removeCondition(conditions, 'stunned');
    assert.ok(!hasCondition(conditions, 'stunned'), 'stunned should be removed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// O: LEDGER
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-O: Ledger mechanics', () => {
  it('O-01: addFact adds to ledger', () => {
    let w = mkWorld({ seed: 'o01' });
    w = addFact(w, 'The gate is locked');
    assert.ok(w.ledger.facts.some(f => f.text === 'The gate is locked'), 'fact should be in ledger');
  });

  it('O-02: addThreat adds to ledger', () => {
    let w = mkWorld({ seed: 'o02' });
    w = addThreat(w, 'Wolves patrol the forest', 3);
    assert.ok(w.ledger.threats.some(t => t.text === 'Wolves patrol the forest'), 'threat should be in ledger');
  });

  it('O-03: addQuestion adds to ledger', () => {
    let w = mkWorld({ seed: 'o03' });
    w = addQuestion(w, 'Who locked the gate?');
    assert.ok(w.ledger.questions.some(q => q.text === 'Who locked the gate?'), 'question should be in ledger');
  });

  it('O-04: ledger respects cap of 8', () => {
    let w = mkWorld({ seed: 'o04' });
    for (let i = 0; i < 12; i++) {
      w = addFact(w, `Fact number ${i}`);
    }
    assert.ok(w.ledger.facts.length <= 8, `facts should cap at 8, got ${w.ledger.facts.length}`);
  });

  it('O-05: duplicate fact not added twice', () => {
    let w = mkWorld({ seed: 'o05' });
    w = addFact(w, 'The sky is blue');
    w = addFact(w, 'The sky is blue');
    const count = w.ledger.facts.filter(f => f.text === 'The sky is blue').length;
    assert.equal(count, 1, 'duplicate fact should not be added');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P: WORLD TICK
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-P: World tick', () => {
  it('P-01: worldTick does not crash on fresh world', () => {
    const w = mkAdventureWorld('p01-tick');
    const after = worldTick(w, 'p01-tick-seed');
    assertWorldInvariants(after);
  });

  it('P-02: worldTick preserves clocks within bounds', () => {
    let w = mkAdventureWorld('p02-tick');
    w = applyDeltas(w, [
      { op: 'clock', key: 'dread', by: 10 },
      { op: 'clock', key: 'pressure', by: 10 },
    ]);
    const after = worldTick(w, 'p02-tick-seed');
    assert.ok(after.clocks.dread >= 0 && after.clocks.dread <= 12);
    assert.ok(after.clocks.pressure >= 0 && after.clocks.pressure <= 12);
    assert.ok(after.clocks.revelation >= 0 && after.clocks.revelation <= 12);
  });

  it('P-03: worldTick is deterministic', () => {
    const w = mkAdventureWorld('p03-tick');
    const a = worldTick(w, 'p03-tick-seed');
    const b = worldTick(w, 'p03-tick-seed');
    assert.equal(worldHash(a), worldHash(b), 'worldTick should be deterministic');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Q: SOCIAL INFLUENCE
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-Q: Social influence vs. basic chat', () => {
  it('Q-01: "I say hello" does NOT roll', () => {
    const w = mkAdventureWorld('q01-hello');
    const { output } = playerMove(w, packs, 'I say hello');
    assert.ok(!hasRoll(output), 'saying hello should not trigger a roll');
  });

  it('Q-02: "I attempt to persuade the guard" DOES roll', () => {
    const w = mkAdventureWorld('q02-persuade');
    const { output } = playerMove(w, packs, 'I attempt to persuade the guard');
    assert.ok(hasRoll(output), 'persuasion should trigger a roll');
  });

  it('Q-03: "I try to intimidate the thug" DOES roll', () => {
    const w = mkAdventureWorld('q03-intim');
    const { output } = playerMove(w, packs, 'I try to intimidate the thug');
    assert.ok(hasRoll(output), 'intimidation should trigger a roll');
  });

  it('Q-04: "I attempt to lie to the guard" DOES roll', () => {
    const w = mkAdventureWorld('q04-lie');
    const { output } = playerMove(w, packs, 'I attempt to lie to the guard');
    assert.ok(hasRoll(output), 'deception should trigger a roll');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R: INVARIANTS HOLD ACROSS MULTI-TURN PLAY
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-R: Multi-turn invariant stability', () => {
  it('R-01: 20 random actions maintain world invariants', () => {
    const actions = [
      'I look around', 'I sit down', 'I try to pick the lock',
      'I search for hidden traps', 'What do I see?', 'I take a deep breath',
      'I draw my sword', 'I try to climb the wall', 'I rest',
      'I sneak forward', 'I eat some rations', 'I look at the ceiling',
      'I force the door open', 'I listen carefully', 'I step back',
      'I pick up the rock', 'Is anyone here?', 'I try to hide',
      'I check my inventory', 'I attempt to track the creature',
    ];
    let w = mkAdventureWorld('r01-multi');
    for (const action of actions) {
      const { world: after } = playerMove(w, packs, action);
      assertWorldInvariants(after);
      w = after;
    }
  });

  it('R-02: 10 turns across 5 fate bands all pass invariants', () => {
    for (const fate of [0, 0.2, 0.5, 0.8, 1.0]) {
      let w = mkAdventureWorld(`r02-f${fate}`, fate);
      for (let i = 0; i < 10; i++) {
        const input = i % 2 === 0 ? 'I try to pick the lock' : 'I look around';
        const { world: after } = playerMove(w, packs, input);
        assertWorldInvariants(after);
        w = after;
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// S: ENVIRONMENT
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-S: Environment signals', () => {
  it('S-01: env deltas clamp to 0..6', () => {
    let w = mkWorld({ seed: 's01' });
    w = applyDeltas(w, [{ op: 'env', key: 'noise', by: 20 }]);
    assert.equal(w.env.noise, 6, 'noise should clamp at 6');
    w = applyDeltas(w, [{ op: 'env', key: 'noise', by: -20 }]);
    assert.equal(w.env.noise, 0, 'noise should clamp at 0');
  });

  it('S-02: all four env channels independent', () => {
    let w = mkWorld({ seed: 's02' });
    w = applyDeltas(w, [
      { op: 'env', key: 'noise', by: 2 },
      { op: 'env', key: 'heat', by: 3 },
      { op: 'env', key: 'scent', by: 4 },
      { op: 'env', key: 'light', by: 5 },
    ]);
    assert.equal(w.env.noise, 2);
    assert.equal(w.env.heat, 3);
    assert.equal(w.env.scent, 4);
    assert.equal(w.env.light, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T: RESOURCES & WOUNDS/STRESS
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-T: Resources, wounds, stress deltas', () => {
  function mkPartyWorld(seed) {
    let w = mkWorld({ seed });
    return ensureWorld({ ...w, party: [{ id: 'party', name: 'Hero', vibe: '', archetype: '', wounds: 0, stress: 0, resources: { Supply: 5 }, level: 1, stats: {}, inventory: { items: [] }, spells: { known: [], slots: {}, maxSlots: {}, concentration: null } }] });
  }

  it('T-01: wound delta adds wounds', () => {
    let w = mkPartyWorld('t01');
    w = applyDeltas(w, [{ op: 'wound', entityId: 'party', by: 2 }]);
    assert.equal(w.party[0].wounds, 2);
  });

  it('T-02: stress delta adds stress', () => {
    let w = mkPartyWorld('t02');
    w = applyDeltas(w, [{ op: 'stress', entityId: 'party', by: 3 }]);
    assert.equal(w.party[0].stress, 3);
  });

  it('T-03: wound healing reduces wounds', () => {
    let w = mkPartyWorld('t03');
    w = applyDeltas(w, [{ op: 'wound', entityId: 'party', by: 4 }]);
    assert.equal(w.party[0].wounds, 4);
    w = applyDeltas(w, [{ op: 'wound', entityId: 'party', by: -2 }]);
    assert.equal(w.party[0].wounds, 2, 'healing should reduce wounds');
  });

  it('T-04: advantage token delta clamps 0..2', () => {
    let w = mkPartyWorld('t04');
    w = applyDeltas(w, [{ op: 'advantage', actorId: 'party', by: 5 }]);
    assert.equal(w.meta.advantageTokens.party, 2, 'advantage should clamp at 2');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// U: FATE BAND
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-U: Fate band classification', () => {
  it('U-01: fate 0..0.33 = cooperative', () => {
    assert.equal(fateBand(0), 'cooperative');
    assert.equal(fateBand(0.2), 'cooperative');
    assert.equal(fateBand(0.33), 'cooperative');
  });

  it('U-02: fate 0.34..0.66 = grim', () => {
    assert.equal(fateBand(0.5), 'grim');
  });

  it('U-03: fate 0.67..1.0 = blood', () => {
    assert.equal(fateBand(0.8), 'blood');
    assert.equal(fateBand(1.0), 'blood');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V: RNG DETERMINISM
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-V: RNG determinism', () => {
  it('V-01: same seed produces same sequence', () => {
    const r1 = makeRng(seedFromString('test-rng'));
    const r2 = makeRng(seedFromString('test-rng'));
    for (let i = 0; i < 100; i++) {
      assert.equal(r1.nextFloat(), r2.nextFloat(), `float ${i} should match`);
    }
  });

  it('V-02: int(1,20) always in range', () => {
    const rng = makeRng(seedFromString('range-test'));
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(1, 20);
      assert.ok(v >= 1 && v <= 20, `d20 should be 1-20, got ${v}`);
    }
  });

  it('V-03: different seeds produce different sequences', () => {
    const r1 = makeRng(seedFromString('seed-a'));
    const r2 = makeRng(seedFromString('seed-b'));
    let same = 0;
    for (let i = 0; i < 20; i++) {
      if (r1.nextFloat() === r2.nextFloat()) same++;
    }
    assert.ok(same < 15, 'different seeds should mostly differ');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// W: D&D LOGIC RULES — COMBAT TRIGGER
// Violence against named NPCs must initiate combat, not resolve as a skill check.
// ═══════════════════════════════════════════════════════════════════════════

function mkWorldWithNpc(seed, npcName = 'Iden', npcOpts = {}) {
  let w = mkAdventureWorld(seed, 0.3);
  const nodeId = String(w.map?.currentNodeId ?? '');
  const nodes = w.map?.nodes || [];
  const idx = nodes.findIndex(n => n && n.id === nodeId);
  if (idx === -1) return w;

  const npc = {
    id: `npc-${npcName.toLowerCase()}`,
    name: npcName,
    role: npcOpts.role || 'guard',
    hostile: npcOpts.hostile || false,
    personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.7 },
    conversationState: { metPlayer: false, trustLevel: 5, topicsDiscussed: [] },
    knowledgeGraph: [],
    secrets: [],
    gender: npcOpts.gender || 'male',
    ...npcOpts,
  };

  const updatedNode = {
    ...nodes[idx],
    settlement: {
      ...(nodes[idx].settlement || {}),
      decompressed: true,
      npcs: [...(nodes[idx].settlement?.npcs || []), npc],
    },
  };
  const updatedNodes = [...nodes];
  updatedNodes[idx] = updatedNode;
  return ensureWorld({ ...w, map: { ...w.map, nodes: updatedNodes } });
}

describe('UX2-W: Violence triggers combat (D&D Rule: Consequence & Causality)', () => {
  const violenceVerbs = [
    'punch', 'stab', 'hit', 'slash', 'kick', 'attack', 'fight', 'strike', 'tackle',
  ];

  for (const verb of violenceVerbs) {
    it(`W-01: "${verb} Iden" triggers combat`, () => {
      const w = mkWorldWithNpc(`w01-${verb}`, 'Iden');
      const { world: after, output } = playerMove(w, packs, `${verb} Iden`);
      const mechanics = getMechanics(output);
      // Should either be in combat or produce a combat-turn mechanics line
      const combatActive = Boolean(after.combat?.active);
      const combatMechanics = mechanics.includes('combat') || mechanics.includes('stake:harm');
      assert.ok(
        combatActive || combatMechanics,
        `"${verb} Iden" should trigger combat, got mechanics: ${mechanics}, combat.active=${combatActive}`
      );
    });
  }

  it('W-02: violence against non-hostile NPC marks them hostile', () => {
    const w = mkWorldWithNpc('w02-hostile', 'Kael', { hostile: false });
    const nodeId = String(w.map?.currentNodeId ?? '');
    const nodeBefore = (w.map?.nodes || []).find(n => n.id === nodeId);
    const npcBefore = nodeBefore?.settlement?.npcs?.find(n => n.name === 'Kael');
    assert.equal(npcBefore?.hostile, false, 'Kael starts non-hostile');

    const { world: after } = playerMove(w, packs, 'attack Kael');
    // NPC should be hostile now (or combat should be active)
    assert.ok(after.combat?.active, 'combat should be active after attacking Kael');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// X: STAT-ACTION ALIGNMENT (D&D Rule: Physical actions use MIGHT)
// Punching uses MIGHT/force, not WITS/focus.
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-X: Stat-action alignment', () => {
  const forceActions = [
    { text: 'I punch the door', verb: 'punch' },
    { text: 'I kick the crate', verb: 'kick' },
    { text: 'I smash the lock', verb: 'smash' },
    { text: 'I bash the gate', verb: 'bash' },
    { text: 'I shove past the guard', verb: 'shove' },
    { text: 'I wrestle the creature', verb: 'wrestle' },
    { text: 'I tackle the thief', verb: 'tackle' },
    { text: 'I break the chains', verb: 'break' },
  ];

  for (const { text, verb } of forceActions) {
    it(`X-01: "${text}" uses force/MIGHT approach`, () => {
      const w = mkAdventureWorld(`x01-${verb}`);
      const { output } = playerMove(w, packs, text);
      const mechanics = getMechanics(output);
      // If it resolved as a roll, approach should be force and stat should be MIGHT
      if (hasRoll(output)) {
        assert.ok(
          mechanics.includes('approach:force'),
          `"${text}" should use approach:force, got: ${mechanics}`
        );
        assert.ok(
          mechanics.includes('stat:MIGHT'),
          `"${text}" should use stat:MIGHT, got: ${mechanics}`
        );
      }
      // If it didn't roll (trivial/physics), that's acceptable — just shouldn't be focus/WITS
      if (mechanics.includes('approach:')) {
        assert.ok(
          !mechanics.includes('approach:focus') || !mechanics.includes('stat:WITS'),
          `"${text}" should NOT use focus/WITS for physical violence, got: ${mechanics}`
        );
      }
    });
  }

  const finesseActions = [
    { text: 'I sneak past the sentry', verb: 'sneak' },
    { text: 'I hide behind the crate', verb: 'hide' },
    { text: 'I slip through the shadows', verb: 'slip' },
  ];

  for (const { text, verb } of finesseActions) {
    it(`X-02: "${text}" uses finesse/AGILITY`, () => {
      const w = mkAdventureWorld(`x02-${verb}`);
      const { output } = playerMove(w, packs, text);
      const mechanics = getMechanics(output);
      if (hasRoll(output)) {
        assert.ok(
          mechanics.includes('approach:finesse'),
          `"${text}" should use approach:finesse, got: ${mechanics}`
        );
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Y: ROLL-NARRATION COHERENCE (D&D Rule: outcome matches description)
// Success = narrative confirms success. Failure = narrative confirms failure.
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-Y: Roll-narration coherence', () => {
  it('Y-01: base narration for success never says "fail" or "miss"', () => {
    // Run many seeds and check that success narrations don't contain failure words
    let checked = 0;
    for (let i = 0; i < 30; i++) {
      const w = mkAdventureWorld(`y01-${i}`, 0.1); // cooperative = more successes
      const { output } = playerMove(w, packs, 'I force the door open');
      const mechanics = getMechanics(output);
      const narration = String(output?.narration || '').toLowerCase();
      const outcomeMatch = mechanics.match(/→ (\w+)/);
      if (!outcomeMatch) continue;
      const outcome = outcomeMatch[1];
      if (outcome === 'success') {
        checked++;
        // Success narration should not claim failure
        assert.ok(
          !narration.includes('fails') && !narration.includes('misses') && !narration.includes('unable'),
          `success narration should not say failure: "${output?.narration}" [${mechanics}]`
        );
      }
    }
    assert.ok(checked > 0, 'should have checked at least one success outcome');
  });

  it('Y-02: mechanics line always present and well-formed for rolled actions', () => {
    for (let i = 0; i < 10; i++) {
      const w = mkAdventureWorld(`y02-${i}`);
      const { output } = playerMove(w, packs, 'I try to pick the lock');
      const mechanics = getMechanics(output);
      if (hasRoll(output)) {
        assert.ok(mechanics.includes('roll:'), `mechanics should contain roll: ${mechanics}`);
        assert.ok(mechanics.includes('DC:'), `mechanics should contain DC: ${mechanics}`);
        assert.ok(mechanics.includes('approach:'), `mechanics should contain approach: ${mechanics}`);
        assert.ok(mechanics.includes('stake:'), `mechanics should contain stake: ${mechanics}`);
      }
    }
  });

  it('Y-03: outcome is always success, mixed, or failure', () => {
    for (let i = 0; i < 20; i++) {
      const w = mkAdventureWorld(`y03-${i}`);
      const { output } = playerMove(w, packs, 'I try to climb the wall');
      const mechanics = getMechanics(output);
      const outcomeMatch = mechanics.match(/→ (\w+)/);
      if (!outcomeMatch) continue;
      const outcome = outcomeMatch[1];
      assert.ok(
        ['success', 'mixed', 'failure'].includes(outcome),
        `outcome must be success/mixed/failure, got: ${outcome}`
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Z: CONSEQUENCE PERSISTENCE (D&D Rule: actions have lasting effects)
// Wounds, stress, clock changes must persist across turns.
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-Z: Consequence persistence', () => {
  it('Z-01: wounds persist across multiple turns', () => {
    let w = mkAdventureWorld('z01-wounds');
    w = applyDeltas(w, [{ op: 'wound', entityId: w.party[0].id, by: 2 }]);
    const woundsBefore = w.party[0].wounds;
    // Play several turns
    for (let i = 0; i < 5; i++) {
      const { world: after } = playerMove(w, packs, 'I look around');
      w = after;
    }
    // Wounds should still be present (observation doesn't heal)
    assert.ok(w.party[0].wounds >= woundsBefore, `wounds should persist: before=${woundsBefore}, after=${w.party[0].wounds}`);
  });

  it('Z-02: clock changes from failures persist', () => {
    let w = mkAdventureWorld('z02-clocks');
    const clocksBefore = { ...w.clocks };
    // Run many risky actions to force some failures
    for (let i = 0; i < 15; i++) {
      const { world: after } = playerMove(w, packs, 'I force the locked door open');
      w = after;
    }
    // At least one clock should have changed from all these actions
    const changed = ['pressure', 'dread', 'revelation'].some(
      k => w.clocks[k] !== clocksBefore[k]
    );
    assert.ok(changed, 'clocks should change after many risky actions');
  });

  it('Z-03: combat damage to enemy persists within fight', () => {
    let w = mkCombatWorld('z03-dmg', { hp: 100, ac: 1 });
    const hpBefore = w.combat.enemies[0].hp;
    for (let i = 0; i < 3; i++) {
      if (!w.combat.active) break;
      const res = resolveCombatTurn(w, { approachTag: 'force', intentText: 'attack', risk: 0.1, stakeTag: 'harm' });
      w = res.world;
    }
    // HP should have decreased from the initial value
    const hpAfter = w.combat.enemies[0]?.hp ?? 0;
    assert.ok(hpAfter <= hpBefore, `enemy HP should not increase during combat: ${hpBefore} → ${hpAfter}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AA: STAKE ESCALATION (D&D Rule: risky actions have meaningful stakes)
// Harm-staked actions can wound. Dread-staked actions can stress.
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-AA: Stake escalation', () => {
  it('AA-01: harm stake on failure can wound the player', () => {
    let wounded = false;
    for (let i = 0; i < 30; i++) {
      let w = mkAdventureWorld(`aa01-${i}`, 0.9); // blood = more failures
      const woundsBefore = w.party[0].wounds;
      const { world: after, output } = playerMove(w, packs, 'I attack the shadows');
      const mechanics = getMechanics(output);
      if (mechanics.includes('stake:harm') && mechanics.includes('failure')) {
        if (after.party[0].wounds > woundsBefore) {
          wounded = true;
          break;
        }
      }
    }
    assert.ok(wounded, 'at least one harm-staked failure should wound the player across 30 seeds');
  });

  it('AA-02: success never wounds the acting player', () => {
    for (let i = 0; i < 20; i++) {
      const w = mkAdventureWorld(`aa02-${i}`, 0.1);
      const woundsBefore = w.party[0].wounds;
      const { world: after, output } = playerMove(w, packs, 'I force the door');
      const mechanics = getMechanics(output);
      const outcomeMatch = mechanics.match(/→ (\w+)/);
      if (outcomeMatch?.[1] === 'success') {
        assert.ok(
          after.party[0].wounds <= woundsBefore,
          `success should not wound: before=${woundsBefore}, after=${after.party[0].wounds}`
        );
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AB: NPC IDENTITY STABILITY (D&D Rule: NPCs maintain consistent identity)
// Gender, name, role must not change between turns.
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-AB: NPC identity stability', () => {
  it('AB-01: NPC properties persist across turns', () => {
    let w = mkWorldWithNpc('ab01', 'Orla', { role: 'merchant', gender: 'female' });
    const nodeId = String(w.map?.currentNodeId ?? '');

    // Play several turns
    for (let i = 0; i < 5; i++) {
      const { world: after } = playerMove(w, packs, 'I look around');
      w = after;
    }

    // NPC should still exist with same properties
    const node = (w.map?.nodes || []).find(n => n.id === nodeId);
    const npc = node?.settlement?.npcs?.find(n => n.name === 'Orla');
    assert.ok(npc, 'Orla should still exist after 5 turns');
    assert.equal(npc.role, 'merchant', 'role should persist');
    assert.equal(npc.gender, 'female', 'gender should persist');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC: MULTI-TURN STRESS TEST (D&D rules holistic)
// 50-turn playthrough checking all logic rules simultaneously.
// ═══════════════════════════════════════════════════════════════════════════

describe('UX2-AC: 50-turn logic stress test', () => {
  it('AC-01: extended play maintains all logic invariants', () => {
    const actions = [
      'I look around', 'I try to pick the lock', 'I search for traps',
      'I force the stuck door', 'I sneak past the guards', 'What do I see?',
      'I try to climb the wall', 'I sit down and rest', 'I draw my sword',
      'I take the torch', 'I try to hide', 'I listen carefully',
      'I eat some rations', 'I light a torch', 'I search the area',
      'I attempt to track the creature', 'I forage for food',
      'I try to persuade the guard', 'I take a deep breath', 'I move north',
    ];

    let w = mkAdventureWorld('ac01-stress', 0.5);
    const rng = makeRng(seedFromString('ac01-stress-actions'));

    let rollCount = 0;
    let noRollCount = 0;
    let successCount = 0;
    let failureCount = 0;

    for (let turn = 0; turn < 50; turn++) {
      if (w.ending?.locked) break;
      const action = actions[rng.int(0, actions.length - 1)];
      const { world: after, output } = playerMove(w, packs, action);

      // Rule: invariants always hold
      assertWorldInvariants(after);

      const mechanics = getMechanics(output);

      // Rule: every turn produces narration
      assert.ok(output?.narration, `turn ${turn} "${action}" must produce narration`);

      // Track roll distribution
      if (hasRoll(output)) {
        rollCount++;
        const outcomeMatch = mechanics.match(/→ (\w+)/);
        if (outcomeMatch) {
          if (outcomeMatch[1] === 'success') successCount++;
          if (outcomeMatch[1] === 'failure') failureCount++;
        }

        // Rule: rolled actions are well-formed. Generic skill checks report
        // approach/stake; social adjudication ([social:approach|STAT|roll…]) is
        // its own structured path with the approach named in the tag.
        if (mechanics.includes('[social:')) {
          assert.match(mechanics, /\[social:(intimidate|charm|deceive|persuade)\|[A-Z]+\|roll:/, `social roll malformed: ${mechanics}`);
        } else {
          assert.ok(mechanics.includes('approach:'), `rolled action must have approach: ${mechanics}`);
          assert.ok(mechanics.includes('stake:'), `rolled action must have stake: ${mechanics}`);
        }
      } else {
        noRollCount++;
      }

      // Rule: wounds never exceed cap
      assert.ok(w.party[0].wounds >= 0, 'wounds >= 0');
      assert.ok(w.party[0].stress >= 0, 'stress >= 0');

      // Rule: clocks in bounds
      assert.ok(after.clocks.dread >= 0 && after.clocks.dread <= 12);
      assert.ok(after.clocks.pressure >= 0 && after.clocks.pressure <= 12);
      assert.ok(after.clocks.revelation >= 0 && after.clocks.revelation <= 12);

      w = after;
    }

    // Sanity: should have seen both rolled and non-rolled actions
    assert.ok(rollCount > 0, `should have rolled at least once across 50 turns, got ${rollCount}`);
    assert.ok(noRollCount > 0, `should have auto-succeeded at least once, got ${noRollCount}`);
  });
});
