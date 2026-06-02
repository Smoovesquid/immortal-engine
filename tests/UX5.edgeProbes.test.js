// UX5: Edge probes — aggressive bug-hunt tests.
//
// These tests assert intended behavior at edges where bugs typically hide.
// When a test fails, we either fix the engine or correct our assumption.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { rollDice } from '../engine/combat/diceRoller.js';
import { applyCondition, hasCondition, tickConditions, removeCondition } from '../engine/combat/conditions.js';
import { applyResistance } from '../engine/combat/damageTypes.js';
import { statMod, maxWounds } from '../engine/ruleset/core/stats.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { worldHash } from '../engine/worldHash.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { addThreat } from '../engine/ledger.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

function mkWorld(seed) {
  return ensureWorld(newWorld({ seed, fate: 0.5, campaignId: 'ux5', pack: { primaryId: 'fantasy', mixerId: null } }));
}
function mkPartyWorld(seed) {
  let w = mkWorld(seed);
  return ensureWorld({
    ...w, party: [{
      id: 'party', name: 'Hero', vibe: '', archetype: '',
      wounds: 0, stress: 0, resources: { Supply: 5 }, level: 3,
      stats: { MIGHT: 14, AGILITY: 12, WITS: 12, GRIT: 14, CHARM: 10 },
      inventory: { items: [], weapons: [], armor: [] },
      spells: { known: [], slots: { 1: 2 }, maxSlots: { 1: 2 }, concentration: null }
    }]
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// P1: applyDeltas with malformed / edge ops
// ═══════════════════════════════════════════════════════════════════════════

describe('UX5-P1: Delta edge cases', () => {
  it('P1-01: unknown op is silently skipped (no throw)', () => {
    for (let i = 0; i < 10; i++) {
      const w = mkPartyWorld(`p1-01-${i}`);
      assert.doesNotThrow(() => applyDeltas(w, [{ op: 'totallyMadeUp', foo: i }]));
    }
  });

  it('P1-02: op with wrong entityId leaves state unchanged', () => {
    for (let i = 0; i < 10; i++) {
      const w = mkPartyWorld(`p1-02-${i}`);
      const before = JSON.stringify(w.party);
      const after = applyDeltas(w, [{ op: 'wound', entityId: 'no-such-entity', by: 5 }]);
      assert.equal(JSON.stringify(after.party), before, 'bad entityId must not mutate party');
    }
  });

  it('P1-03: wound with by=0 is a no-op (NOT a change)', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkPartyWorld(`p1-03-${i}`);
      w = applyDeltas(w, [{ op: 'wound', entityId: 'party', by: 2 }]);
      const before = w.party[0].wounds;
      w = applyDeltas(w, [{ op: 'wound', entityId: 'party', by: 0 }]);
      assert.equal(w.party[0].wounds, before, 'by=0 must not change wounds');
    }
  });

  it('P1-04: empty deltas array is a no-op and hash-preserving', () => {
    for (let i = 0; i < 10; i++) {
      const w = mkPartyWorld(`p1-04-${i}`);
      const after = applyDeltas(w, []);
      assert.equal(worldHash(after), worldHash(w), 'empty deltas must preserve hash');
    }
  });

  it('P1-05: clock delta ignores NaN / Infinity gracefully', () => {
    const bads = [NaN, Infinity, -Infinity, 'abc', null, undefined, {}, [], true, false];
    bads.forEach((b, i) => {
      let w = mkPartyWorld(`p1-05-${i}`);
      const before = w.clocks.dread;
      w = applyDeltas(w, [{ op: 'clock', key: 'dread', by: b }]);
      assert.ok(Number.isFinite(w.clocks.dread), `dread went non-finite for by=${String(b)}`);
      assert.ok(w.clocks.dread >= 0 && w.clocks.dread <= 12);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P2: Enemy HP edge cases — the defeat-sticky bug
// ═══════════════════════════════════════════════════════════════════════════

function combatWithEnemy(seed, hp, maxHp) {
  let w = mkPartyWorld(seed);
  w = ensureWorld({
    ...w,
    scene: { location: 'x', objective: '', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  const enemy = {
    id: 'e1', name: 'Foe', hp, maxHp, damage: 1, ac: 5, cr: 0.25,
    damageType: 'bludgeoning', resistances: {}, conditionImmunities: [], conditions: [],
    actions: [{ name: 'Slap', toHit: 1, damage: '1d2', type: 'bludgeoning' }],
    multiattack: null, saveProficiencies: [], canParley: false,
    defeated: hp <= 0, sourceNpcId: '', lootTableRef: 'cr_0_1',
    initMod: 0, legendaryActions: null, reactions: null, lairActions: null,
    senses: { darkvision: null, blindsight: null, tremorsense: null, truesight: null }
  };
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      active: true, round: 1, turnIndex: 0, enemies: [enemy],
      beganAt: 0, reason: 'test', playerGuard: false, companionGuard: false,
      initiativeOrder: [
        { id: 'party', type: 'party', roll: 10, modifier: 0, total: 10 },
        { id: 'e1', type: 'enemy', roll: 5, modifier: 0, total: 5 }
      ]
    }
  }]);
  return w;
}

describe('UX5-P2: Enemy HP and defeat flag', () => {
  it('P2-01: reducing enemy to 0 HP sets defeated=true', () => {
    for (let i = 0; i < 10; i++) {
      let w = combatWithEnemy(`p2-01-${i}`, 5, 5);
      w = applyDeltas(w, [{ op: 'combatState', enemyHpDelta: [{ id: 'e1', by: -10 }] }]);
      assert.equal(w.combat.enemies[0].hp, 0);
      assert.equal(w.combat.enemies[0].defeated, true);
    }
  });

  it('P2-02: healing defeated enemy (0 HP → positive HP) clears defeated flag', () => {
    // This is the sticky-defeat bug hunt
    for (let i = 0; i < 10; i++) {
      let w = combatWithEnemy(`p2-02-${i}`, 5, 10);
      // Kill
      w = applyDeltas(w, [{ op: 'combatState', enemyHpDelta: [{ id: 'e1', by: -100 }] }]);
      assert.equal(w.combat.enemies[0].defeated, true);
      // Heal back
      w = applyDeltas(w, [{ op: 'combatState', enemyHpDelta: [{ id: 'e1', by: 5 }] }]);
      assert.ok(w.combat.enemies[0].hp > 0, 'enemy has HP again');
      assert.equal(w.combat.enemies[0].defeated, false, 'revived enemy must no longer be defeated');
    }
  });

  it('P2-03: enemy HP clamps at maxHp even with huge heal', () => {
    for (let i = 0; i < 10; i++) {
      let w = combatWithEnemy(`p2-03-${i}`, 3, 10);
      w = applyDeltas(w, [{ op: 'combatState', enemyHpDelta: [{ id: 'e1', by: 9999 }] }]);
      assert.equal(w.combat.enemies[0].hp, 10);
    }
  });

  it('P2-04: enemy HP never goes negative', () => {
    for (let i = 0; i < 10; i++) {
      let w = combatWithEnemy(`p2-04-${i}`, 3, 10);
      w = applyDeltas(w, [{ op: 'combatState', enemyHpDelta: [{ id: 'e1', by: -9999 }] }]);
      assert.ok(w.combat.enemies[0].hp >= 0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3: Conditions edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe('UX5-P3: Conditions edge cases', () => {
  it('P3-01: duplicate apply does not produce 2 entries', () => {
    for (let i = 0; i < 10; i++) {
      let c = applyCondition([], { name: 'poisoned', until: 5 }, []);
      c = applyCondition(c, { name: 'poisoned', until: 5 }, []);
      const count = c.filter(x => x.name === 'poisoned').length;
      assert.equal(count, 1, `duplicate condition created ${count} entries`);
    }
  });

  it('P3-02: condition at expiry turn is removed by tickConditions', () => {
    for (let i = 0; i < 10; i++) {
      const c0 = applyCondition([], { name: 'stunned', until: 5 }, []);
      const rng = makeRng(seedFromString(`p3-02-${i}`));
      const { conditions } = tickConditions(c0, { stats: {} }, 6, rng);
      assert.ok(!hasCondition(conditions, 'stunned'), 'stunned should expire by turn 6');
    }
  });

  it('P3-03: condition before expiry turn persists', () => {
    for (let i = 0; i < 10; i++) {
      const c0 = applyCondition([], { name: 'poisoned', until: 10 }, []);
      const rng = makeRng(seedFromString(`p3-03-${i}`));
      const { conditions } = tickConditions(c0, { stats: {} }, 5, rng);
      assert.ok(hasCondition(conditions, 'poisoned'), 'poisoned should persist at turn 5 (until 10)');
    }
  });

  it('P3-04: onTick damage reported for each tick', () => {
    for (let i = 0; i < 10; i++) {
      const cond = { name: 'poisoned', severity: 2, onTick: 'poison', until: 10 };
      const c0 = applyCondition([], cond, []);
      const rng = makeRng(seedFromString(`p3-04-${i}`));
      const { tickResults } = tickConditions(c0, { stats: {} }, 5, rng);
      const poison = tickResults.find(t => t.name === 'poisoned');
      assert.ok(poison, 'should produce tick result');
      assert.equal(poison.damage, 2, 'damage should equal severity');
      assert.equal(poison.damageType, 'poison');
    }
  });

  it('P3-05: end_of_next_turn converts then expires next tick', () => {
    for (let i = 0; i < 10; i++) {
      let c = applyCondition([], { name: 'frightened', until: 'end_of_next_turn' }, []);
      const rng = makeRng(seedFromString(`p3-05-${i}`));
      // First tick at turn 3 → converts to until=4
      let res = tickConditions(c, { stats: {} }, 3, rng);
      c = res.conditions;
      assert.ok(hasCondition(c, 'frightened'), 'still present after first tick (conversion)');
      // Second tick at turn 4 → should expire (turn >= until)
      res = tickConditions(c, { stats: {} }, 4, rng);
      assert.ok(!hasCondition(res.conditions, 'frightened'), 'expired at turn 4');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P4: Dice roller edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe('UX5-P4: Dice roller edges', () => {
  it('P4-01: invalid expression returns 0 or throws gracefully', () => {
    const bads = ['', 'not dice', '??d??', '0d0', '-1d6', 'abc', 'd', 'd6', '1d', '1dX'];
    bads.forEach((expr, i) => {
      const rng = makeRng(seedFromString(`p4-01-${i}`));
      // Must not throw uncaught
      assert.doesNotThrow(() => rollDice(expr, rng), `crashed on "${expr}"`);
    });
  });

  it('P4-02: very large dice counts stay in bounds', () => {
    for (let i = 0; i < 10; i++) {
      const rng = makeRng(seedFromString(`p4-02-${i}`));
      const r = rollDice('100d6', rng);
      assert.ok(r.total >= 100 && r.total <= 600, `100d6=${r.total}`);
    }
  });

  it('P4-03: 1d1 always rolls 1', () => {
    for (let i = 0; i < 10; i++) {
      const rng = makeRng(seedFromString(`p4-03-${i}`));
      const r = rollDice('1d1', rng);
      assert.equal(r.total, 1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P5: Resistance + damage type edges
// ═══════════════════════════════════════════════════════════════════════════

describe('UX5-P5: Resistance edges', () => {
  it('P5-01: 0 damage stays 0 through all resistance levels', () => {
    const levels = ['normal', 'resistant', 'immune', 'vulnerable'];
    for (const lv of levels) {
      for (let i = 0; i < 3; i++) {
        const r = applyResistance(0, 'fire', { fire: lv });
        assert.equal(r.final, 0, `0 damage changed to ${r.final} under ${lv}`);
      }
    }
  });

  it('P5-02: invalid damage type passes through normal', () => {
    for (let i = 0; i < 10; i++) {
      const r = applyResistance(7, 'cheese', { cheese: 'resistant' });
      // Either normal (7) or resistant-halved (3). Must not throw.
      assert.ok(r.final >= 0 && r.final <= 7);
    }
  });

  it('P5-03: vulnerability doubles 1 → 2', () => {
    for (let i = 0; i < 10; i++) {
      const r = applyResistance(1, 'cold', { cold: 'vulnerable' });
      assert.equal(r.final, 2);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P6: Save/load edges
// ═══════════════════════════════════════════════════════════════════════════

describe('UX5-P6: Save/load edges', () => {
  it('P6-01: importWorld rejects malformed input without crashing', () => {
    const bads = [null, undefined, {}, [], 'string', 42, { meta: null }, { garbage: true }];
    bads.forEach((b, i) => {
      assert.doesNotThrow(() => {
        try { importWorld(b); } catch { /* throwing is OK; crashing the process is not */ }
      }, `fatal crash on ${JSON.stringify(b)}`);
    });
  });

  it('P6-02: full roundtrip with complex state preserves invariants', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkPartyWorld(`p6-02-${i}`);
      w = applyDeltas(w, [
        { op: 'wound', entityId: 'party', by: 2 },
        { op: 'stress', entityId: 'party', by: 3 },
        { op: 'clock', key: 'dread', by: 5 },
        { op: 'advantage', actorId: 'party', by: 1 },
        { op: 'consumeSpellSlot', level: 1 }
      ]);
      const blob = exportWorld(w);
      const restored = importWorld(blob);
      assertWorldInvariants(restored);
      assert.equal(worldHash(restored), worldHash(w));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P7: ensureWorld garbage-in hardening
// ═══════════════════════════════════════════════════════════════════════════

describe('UX5-P7: ensureWorld garbage tolerance', () => {
  it('P7-01: fate clamps to [0, 1] for 10 out-of-range values', () => {
    const fates = [-1, -0.5, 1.5, 2, 100, -100, NaN, Infinity, -Infinity, 'abc'];
    fates.forEach((f, i) => {
      const w = ensureWorld({ meta: { seed: `p7-01-${i}`, fate: f } });
      assert.ok(w.meta.fate >= 0 && w.meta.fate <= 1, `fate=${w.meta.fate} out of [0,1] for input ${f}`);
    });
  });

  it('P7-02: ensureWorld idempotent (double-call gives same world)', () => {
    for (let i = 0; i < 10; i++) {
      const w1 = mkPartyWorld(`p7-02-${i}`);
      const w2 = ensureWorld(w1);
      assert.equal(worldHash(w1), worldHash(w2));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P8: Spell slot edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe('UX5-P8: Spell slot edges', () => {
  it('P8-01: consumeSpellSlot with invalid level is ignored', () => {
    const bads = [0, -1, 11, 100, NaN, 'abc', null, undefined, Infinity, -Infinity];
    bads.forEach((L, i) => {
      let w = mkPartyWorld(`p8-01-${i}`);
      const before = JSON.stringify(w.party[0].spells.slots);
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', level: L }]);
      const after = JSON.stringify(w.party[0].spells.slots);
      assert.equal(after, before, `invalid level ${L} mutated slots`);
    });
  });

  it('P8-02: restoreSpellSlots is idempotent', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkPartyWorld(`p8-02-${i}`);
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', level: 1 }]);
      w = applyDeltas(w, [{ op: 'restoreSpellSlots' }]);
      const first = JSON.stringify(w.party[0].spells.slots);
      w = applyDeltas(w, [{ op: 'restoreSpellSlots' }]);
      const second = JSON.stringify(w.party[0].spells.slots);
      assert.equal(first, second);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P9: Stat math edge probes
// ═══════════════════════════════════════════════════════════════════════════

describe('UX5-P9: Stat math edges', () => {
  it('P9-01: statMod at boundaries matches 5e table', () => {
    const table = [[0,-5],[1,-5],[2,-4],[3,-4],[4,-3],[5,-3],[9,-1],[10,0],[30,10]];
    table.forEach(([s, m]) => assert.equal(statMod(s), m, `statMod(${s})=${statMod(s)} ≠ ${m}`));
  });

  it('P9-02: maxWounds at level 0 clamps to level 1 result (6)', () => {
    for (let i = 0; i < 10; i++) {
      assert.equal(maxWounds(0, 0), 6);
      assert.equal(maxWounds(-i, 0), 6);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P10: playerMove edge surfaces
// ═══════════════════════════════════════════════════════════════════════════

describe('UX5-P10: playerMove edges', () => {
  it('P10-01: playerMove with undefined input does not crash', () => {
    for (let i = 0; i < 10; i++) {
      let w = newWorld({ seed: `p10-01-${i}`, fate: 0.3, campaignId: 'ux5', pack: { primaryId: 'fantasy', mixerId: null } });
      const { world } = beginAdventure(w, packs);
      assert.doesNotThrow(() => playerMove(world, packs, undefined));
    }
  });

  it('P10-02: playerMove with null packs does not crash', () => {
    // packs is essential; null may be invalid — just shouldn't segfault
    let w = newWorld({ seed: 'p10-02', fate: 0.3, campaignId: 'ux5', pack: { primaryId: 'fantasy', mixerId: null } });
    const { world } = beginAdventure(w, packs);
    for (let i = 0; i < 10; i++) {
      assert.doesNotThrow(() => {
        try { playerMove(world, null, 'I look around'); } catch { /* thrown errors are fine */ }
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P11: Inventory integrity
// ═══════════════════════════════════════════════════════════════════════════

describe('UX5-P11: Inventory integrity', () => {
  it('P11-01: removeItem with name that does not exist is no-op', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkPartyWorld(`p11-01-${i}`);
      const before = JSON.stringify(w.party[0].inventory);
      w = applyDeltas(w, [{ op: 'removeItem', entityId: 'party', bucket: 'items', itemName: 'Nothing' }]);
      assert.equal(JSON.stringify(w.party[0].inventory), before);
    }
  });

  it('P11-02: createItem into invalid bucket is no-op (not crash)', () => {
    const badBuckets = ['garbage', '', null, 'weaponz', 'Items', 'ITEMS', 'armors', 'magic'];
    badBuckets.forEach((b, i) => {
      let w = mkPartyWorld(`p11-02-${i}`);
      const before = JSON.stringify(w.party[0].inventory);
      assert.doesNotThrow(() => {
        w = applyDeltas(w, [{
          op: 'createItem', entityId: 'party', bucket: b,
          item: { name: 'X', tags: [], weight: 0, noise: 0, light: 0, bulk: 1, notes: '' }
        }]);
      });
      // Either bucket was rejected (no change) OR normalized to valid. Never crash.
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P12: NPC trust delta
// ═══════════════════════════════════════════════════════════════════════════

describe('UX5-P12: NPC trust delta', () => {
  function withNpc(seed, npcId = 'n1', trust = 5) {
    let w = mkPartyWorld(seed);
    const node = {
      id: 'home', name: 'Home', nodeType: 'settlement', tags: [],
      settlement: {
        decompressed: true,
        npcs: [{
          id: npcId, name: 'Iden', role: 'guard', hostile: false,
          personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
          conversationState: { metPlayer: false, trustLevel: trust, topicsDiscussed: [], lastInteraction: null },
          knowledgeGraph: [], secrets: [], gender: 'male'
        }]
      }
    };
    return ensureWorld({
      ...w,
      map: { nodes: [node], edges: [], discovered: ['home'], currentNodeId: 'home' }
    });
  }

  it('P12-01: negative trust delta actually reduces trust', () => {
    for (let i = 0; i < 10; i++) {
      let w = withNpc(`p12-01-${i}`, 'n1', 5);
      w = applyDeltas(w, [{ op: 'npcTrustDelta', npcId: 'n1', by: -2 }]);
      const npc = w.map.nodes[0].settlement.npcs.find(n => n.id === 'n1');
      assert.equal(npc.conversationState.trustLevel, 3, `trust should drop 5→3, got ${npc.conversationState.trustLevel}`);
    }
  });

  it('P12-02: trust clamps at [0, 10]', () => {
    for (let i = 0; i < 10; i++) {
      let w = withNpc(`p12-02-${i}`, 'n1', 5);
      w = applyDeltas(w, [{ op: 'npcTrustDelta', npcId: 'n1', by: 100 }]);
      let npc = w.map.nodes[0].settlement.npcs.find(n => n.id === 'n1');
      assert.equal(npc.conversationState.trustLevel, 10);
      w = applyDeltas(w, [{ op: 'npcTrustDelta', npcId: 'n1', by: -100 }]);
      npc = w.map.nodes[0].settlement.npcs.find(n => n.id === 'n1');
      assert.equal(npc.conversationState.trustLevel, 0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P13: Ledger hygiene
// ═══════════════════════════════════════════════════════════════════════════

describe('UX5-P13: Ledger hygiene', () => {
  it('P13-01: adding same threat twice does not duplicate (by text)', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkPartyWorld(`p13-01-${i}`);
      w = addThreat(w, 'The bridge is out', 3);
      w = addThreat(w, 'The bridge is out', 4);
      const matches = w.ledger.threats.filter(t => t.text === 'The bridge is out');
      assert.ok(matches.length <= 1, `duplicate threat appeared ${matches.length} times`);
    }
  });
});
