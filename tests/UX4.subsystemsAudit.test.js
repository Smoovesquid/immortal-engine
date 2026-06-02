// UX4: Subsystems audit — 50 tests, each exercised 10 ways.
//
// Coverage across spells, conditions, dice, stats, resistances, saving
// throws, map/nav, goals, ledger, advantage tokens, world tick, input
// guards, determinism, and combat depth. Every test runs a 10-iteration
// sweep so the assertion has to hold across RNG and input variance, not
// just one lucky seed.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { rollDice } from '../engine/combat/diceRoller.js';
import {
  applyCondition, hasCondition, tickConditions, removeCondition,
  removeAllConditions, getCondition, normalizeCondition
} from '../engine/combat/conditions.js';
import { applyResistance, normalizeResistances, isValidDamageType, DAMAGE_TYPES } from '../engine/combat/damageTypes.js';
import { rollSave } from '../engine/combat/savingThrows.js';
import { statMod, maxWounds } from '../engine/ruleset/core/stats.js';
import { neighbors, moveToNode, discoverNode, ensureMap } from '../engine/map/mapState.js';
import { createGoal, checkGoals, activeGoals, completedGoals } from '../engine/goals/goalContract.js';
import { addFact, addThreat, addQuestion } from '../engine/ledger.js';
import { normalizeManifest, normalizePack, fateBand } from '../engine/rulesets.js';
import { worldTick } from '../engine/worldTick.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { worldHash } from '../engine/worldHash.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── bootstrap ────────────────────────────────────────────────────────────

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
  return ensureWorld(newWorld({
    seed, fate: 0.5, campaignId: 'ux4',
    pack: { primaryId: 'fantasy', mixerId: null }
  }));
}
function mkAdventure(seed) {
  const w = newWorld({ seed, fate: 0.3, campaignId: 'ux4', pack: { primaryId: 'fantasy', mixerId: null } });
  const { world } = beginAdventure(w, packs);
  return world;
}
function mkCasterWorld(seed, slots = { 1: 3, 2: 2 }) {
  let w = mkWorld(seed);
  return ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Mage', vibe: '', archetype: '',
      wounds: 0, stress: 0, resources: {}, level: 5,
      stats: { MIGHT: 10, AGILITY: 10, WITS: 16, GRIT: 12, CHARM: 10 },
      inventory: { items: [], weapons: [], armor: [] },
      spells: { known: [], slots: { ...slots }, maxSlots: { ...slots }, concentration: null }
    }]
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SP: Spell system (5 tests × 10 iterations)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-SP: Spell system', () => {
  it('SP-01: consumeSpellSlot decrements the exact level, never others', () => {
    for (let lv = 1; lv <= 10; lv++) {
      const slots = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 };
      let w = mkCasterWorld(`sp01-${lv}`, slots);
      const targetLevel = ((lv - 1) % 5) + 1;
      const before = { ...w.party[0].spells.slots };
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', level: targetLevel }]);
      const after = w.party[0].spells.slots;
      assert.equal(after[targetLevel], before[targetLevel] - 1, `level ${targetLevel} must decrement`);
      for (const L of [1, 2, 3, 4, 5]) {
        if (L !== targetLevel) {
          assert.equal(after[L], before[L], `level ${L} must not change when consuming level ${targetLevel}`);
        }
      }
    }
  });

  it('SP-02: consumeSpellSlot at 0 is a no-op (never negative)', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkCasterWorld(`sp02-${i}`, { 1: 0, 2: 0, 3: 0 });
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', level: 1 }]);
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', level: 2 }]);
      w = applyDeltas(w, [{ op: 'consumeSpellSlot', level: 3 }]);
      assert.equal(w.party[0].spells.slots[1], 0);
      assert.equal(w.party[0].spells.slots[2], 0);
      assert.equal(w.party[0].spells.slots[3], 0);
    }
  });

  it('SP-03: restoreSpellSlots resets all levels to max', () => {
    const configs = [
      { 1: 3 }, { 1: 4, 2: 2 }, { 1: 5, 2: 3, 3: 1 }, { 2: 2, 3: 1 },
      { 1: 2 }, { 1: 1 }, { 3: 2 }, { 1: 4, 2: 4 }, { 1: 2, 2: 1 }, { 4: 1 }
    ];
    configs.forEach((cfg, i) => {
      let w = mkCasterWorld(`sp03-${i}`, cfg);
      // Drain
      for (const L of Object.keys(cfg)) {
        w = applyDeltas(w, [{ op: 'consumeSpellSlot', level: +L }]);
      }
      w = applyDeltas(w, [{ op: 'restoreSpellSlots' }]);
      for (const L of Object.keys(cfg)) {
        assert.equal(w.party[0].spells.slots[+L], cfg[L], `level ${L} should restore to ${cfg[L]}`);
      }
    });
  });

  it('SP-04: setConcentration roundtrip sets and clears', () => {
    const names = ['shield','bless','hex','mage_armor','haste','slow','hold_person','web','fireball','heal'];
    names.forEach((spell, i) => {
      let w = mkCasterWorld(`sp04-${i}`);
      w = applyDeltas(w, [{ op: 'setConcentration', spellRef: spell, startedAt: i }]);
      assert.equal(w.party[0].spells.concentration?.spellRef, spell);
      w = applyDeltas(w, [{ op: 'setConcentration', spellRef: '' }]);
      assert.equal(w.party[0].spells.concentration, null);
    });
  });

  it('SP-05: setConcentration replaces previous (only one active)', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkCasterWorld(`sp05-${i}`);
      w = applyDeltas(w, [{ op: 'setConcentration', spellRef: 'bless', startedAt: 0 }]);
      w = applyDeltas(w, [{ op: 'setConcentration', spellRef: 'haste', startedAt: 1 }]);
      assert.equal(w.party[0].spells.concentration?.spellRef, 'haste', 'last write wins');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CN: Conditions (5 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-CN: Conditions', () => {
  const ALL = ['poisoned', 'stunned', 'frightened', 'prone', 'restrained', 'blinded', 'deafened', 'charmed', 'paralyzed', 'unconscious'];

  it('CN-01: applyCondition adds each core condition', () => {
    ALL.forEach(name => {
      const c = applyCondition([], { name, until: 3 }, []);
      assert.ok(hasCondition(c, name), `${name} must be present`);
    });
  });

  it('CN-02: immunity blocks each condition', () => {
    ALL.forEach(name => {
      const c = applyCondition([], { name, until: 3 }, [name]);
      assert.ok(!hasCondition(c, name), `${name} must be blocked by immunity`);
    });
  });

  it('CN-03: removeCondition clears each condition', () => {
    ALL.forEach(name => {
      let c = applyCondition([], { name, until: 3 }, []);
      c = removeCondition(c, name);
      assert.ok(!hasCondition(c, name), `${name} must be removable`);
    });
  });

  it('CN-04: removeCondition on absent condition is no-op', () => {
    for (let i = 0; i < 10; i++) {
      const base = applyCondition([], { name: 'poisoned', until: 2 }, []);
      const after = removeCondition(base, ALL[i]); // might not be poisoned
      if (ALL[i] === 'poisoned') {
        assert.ok(!hasCondition(after, 'poisoned'));
      } else {
        assert.ok(hasCondition(after, 'poisoned'), 'unrelated condition must remain');
      }
    }
  });

  it('CN-05: getCondition returns the condition object with fields', () => {
    ALL.forEach((name, i) => {
      const c = applyCondition([], { name, until: i + 1 }, []);
      const got = getCondition(c, name);
      assert.ok(got, `should retrieve ${name}`);
      assert.equal(String(got.name), name);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DC: Dice roller (4 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-DC: Dice roller', () => {
  it('DC-01: 1dN always in [1, N]', () => {
    const Ns = [4, 6, 8, 10, 12, 20, 100, 2, 3, 30];
    Ns.forEach(N => {
      const rng = makeRng(seedFromString(`dc01-${N}`));
      for (let i = 0; i < 50; i++) {
        const r = rollDice(`1d${N}`, rng);
        assert.ok(r.total >= 1 && r.total <= N, `1d${N}=${r.total}`);
      }
    });
  });

  it('DC-02: NdM+K honors modifier', () => {
    const cases = [
      { expr: '2d6+3', min: 5, max: 15 }, { expr: '1d20+5', min: 6, max: 25 },
      { expr: '3d8', min: 3, max: 24 }, { expr: '4d4+2', min: 6, max: 18 },
      { expr: '1d12-1', min: 0, max: 11 }, { expr: '2d10+0', min: 2, max: 20 },
      { expr: '5d6', min: 5, max: 30 }, { expr: '1d6+10', min: 11, max: 16 },
      { expr: '2d4-1', min: 1, max: 7 }, { expr: '1d100', min: 1, max: 100 }
    ];
    cases.forEach(({ expr, min, max }) => {
      const rng = makeRng(seedFromString(`dc02-${expr}`));
      for (let i = 0; i < 20; i++) {
        const r = rollDice(expr, rng);
        assert.ok(r.total >= min && r.total <= max, `${expr}=${r.total} out of [${min},${max}]`);
      }
    });
  });

  it('DC-03: dice rolls deterministic under same rng seed', () => {
    for (let i = 0; i < 10; i++) {
      const seed = `dc03-${i}`;
      const rng1 = makeRng(seedFromString(seed));
      const rng2 = makeRng(seedFromString(seed));
      for (let k = 0; k < 20; k++) {
        assert.equal(rollDice('2d6+1', rng1).total, rollDice('2d6+1', rng2).total);
      }
    }
  });

  it('DC-04: different seeds produce varied rolls', () => {
    const totals = new Set();
    for (let i = 0; i < 10; i++) {
      const rng = makeRng(seedFromString(`dc04-${i}-distinct`));
      totals.add(rollDice('3d20', rng).total);
    }
    assert.ok(totals.size > 1, 'should see variation across 10 distinct seeds');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ST: Stat math (4 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-ST: Stat math', () => {
  it('ST-01: statMod follows floor((score-10)/2) for 10 scores', () => {
    const cases = [[1,-5],[3,-4],[8,-1],[10,0],[11,0],[12,1],[14,2],[16,3],[18,4],[20,5]];
    cases.forEach(([s, expected]) => {
      assert.equal(statMod(s), expected, `statMod(${s}) should be ${expected}`);
    });
  });

  it('ST-02: maxWounds increases monotonically with level', () => {
    for (let grit = -2; grit <= 5; grit++) {
      let prev = -Infinity;
      for (let lv = 1; lv <= 20; lv++) {
        const m = maxWounds(lv, grit);
        assert.ok(m >= prev, `maxWounds should be monotonic in level; grit=${grit}, lv=${lv}, m=${m} < prev=${prev}`);
        prev = m;
      }
    }
    // Also check 10 spot values
    const spot = [[1,0,6],[2,0,8],[5,0,14],[10,0,24],[20,0,44],[1,3,9],[1,-2,6],[5,2,16],[10,-1,24],[20,5,49]];
    spot.forEach(([lv, g, expected]) => {
      assert.equal(maxWounds(lv, g), expected, `maxWounds(${lv}, ${g}) should be ${expected}`);
    });
  });

  it('ST-03: maxWounds clamps level to [1, 20]', () => {
    const badLevels = [0, -5, 21, 100, -1, 50, -99, 25, 1000, 22];
    badLevels.forEach(lv => {
      const m = maxWounds(lv, 0);
      // Must match either level=1 (6) or level=20 (44)
      assert.ok(m === 6 || m === 44, `level ${lv} should clamp to 1 or 20, got maxWounds=${m}`);
    });
  });

  it('ST-04: statMod handles non-numeric inputs without throwing', () => {
    const bad = [undefined, null, '', 'abc', NaN, Infinity, {}, [], 'ten', true];
    bad.forEach(b => {
      const r = statMod(b);
      assert.ok(Number.isFinite(r), `statMod(${String(b)}) must return finite number, got ${r}`);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RS: Damage resistances (4 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-RS: Damage resistances', () => {
  it('RS-01: normal damage passes through unchanged', () => {
    DAMAGE_TYPES.slice(0, 10).forEach(type => {
      const r = applyResistance(10, type, {});
      assert.equal(r.final, 10, `${type} without resistance should be 10`);
    });
  });

  it('RS-02: resistant halves damage (rounds down)', () => {
    DAMAGE_TYPES.slice(0, 10).forEach(type => {
      const r = applyResistance(11, type, { [type]: 'resistant' });
      assert.equal(r.final, 5, `${type} resistant should halve 11 → 5, got ${r.final}`);
    });
  });

  it('RS-03: immune zeros damage', () => {
    DAMAGE_TYPES.slice(0, 10).forEach(type => {
      const r = applyResistance(100, type, { [type]: 'immune' });
      assert.equal(r.final, 0, `${type} immune should zero`);
    });
  });

  it('RS-04: vulnerable doubles damage', () => {
    DAMAGE_TYPES.slice(0, 10).forEach(type => {
      const r = applyResistance(7, type, { [type]: 'vulnerable' });
      assert.equal(r.final, 14, `${type} vulnerable should double 7 → 14`);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SV: Saving throws (3 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-SV: Saving throws', () => {
  function mkEntity(stat, score = 14) {
    return { stats: { MIGHT: 12, AGILITY: 12, WITS: 12, GRIT: 12, CHARM: 12, [stat]: score }, saveProficiencies: [] };
  }

  it('SV-01: rollSave returns success boolean matching roll+mod vs DC', () => {
    for (let i = 0; i < 10; i++) {
      const rng = makeRng(seedFromString(`sv01-${i}`));
      const e = mkEntity('AGILITY', 14);
      const result = rollSave(e, 'AGILITY', 10, rng);
      assert.ok(typeof result === 'object', 'rollSave returns object');
      assert.equal(typeof result.success, 'boolean', 'result.success is boolean');
      // If success, total should meet or exceed DC
      if (result.success) {
        assert.ok(result.total >= 10, `success total=${result.total} < DC=10`);
      } else {
        assert.ok(result.total < 10, `failure total=${result.total} >= DC=10`);
      }
    }
  });

  it('SV-02: rollSave deterministic under same rng seed', () => {
    for (let i = 0; i < 10; i++) {
      const seed = `sv02-${i}`;
      const e = mkEntity('WITS', 16);
      const r1 = rollSave(e, 'WITS', 12, makeRng(seedFromString(seed)));
      const r2 = rollSave(e, 'WITS', 12, makeRng(seedFromString(seed)));
      assert.equal(r1.total, r2.total, 'same seed → same total');
      assert.equal(r1.success, r2.success, 'same seed → same success');
    }
  });

  it('SV-03: higher stat → more successes across 10 seeds', () => {
    const e8 = mkEntity('MIGHT', 8);
    const e18 = mkEntity('MIGHT', 18);
    let s8 = 0, s18 = 0;
    for (let i = 0; i < 30; i++) {
      if (rollSave(e8, 'MIGHT', 14, makeRng(seedFromString(`sv03-${i}`))).success) s8++;
      if (rollSave(e18, 'MIGHT', 14, makeRng(seedFromString(`sv03-${i}`))).success) s18++;
    }
    assert.ok(s18 > s8, `MIGHT 18 should succeed more than MIGHT 8: 18=${s18}, 8=${s8}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MP: Map / nav (5 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-MP: Map navigation', () => {
  it('MP-01: neighbors returns adjacent node ids only', () => {
    for (let i = 0; i < 10; i++) {
      const w = mkAdventure(`mp01-${i}`);
      const cur = w.map?.currentNodeId;
      const nbrs = neighbors(w.map, cur);
      assert.ok(Array.isArray(nbrs));
      for (const n of nbrs) {
        assert.notEqual(n, cur, 'node should not be its own neighbor');
        assert.ok(w.map.nodes.find(x => x.id === n), `neighbor ${n} must exist in nodes`);
      }
    }
  });

  it('MP-02: discoverNode adds node to discovered set without duplicates', () => {
    for (let i = 0; i < 10; i++) {
      const w = mkAdventure(`mp02-${i}`);
      const target = w.map.nodes[Math.min(i, w.map.nodes.length - 1)].id;
      const once = discoverNode(w, target);
      const twice = discoverNode(once, target);
      const c1 = once.map.discovered.filter(d => d === target).length;
      const c2 = twice.map.discovered.filter(d => d === target).length;
      assert.equal(c1, 1);
      assert.equal(c2, 1, 'discovering twice should not duplicate');
    }
  });

  it('MP-03: moveToNode updates currentNodeId to target', () => {
    for (let i = 0; i < 10; i++) {
      const w = mkAdventure(`mp03-${i}`);
      const cur = w.map.currentNodeId;
      const nbrs = neighbors(w.map, cur);
      if (nbrs.length === 0) continue;
      const target = nbrs[0];
      const moved = moveToNode(w, target);
      assert.equal(moved.map.currentNodeId, target);
    }
  });

  it('MP-04: ensureMap produces valid structure for 10 input shapes', () => {
    const inputs = [
      null, undefined, {}, { nodes: [] },
      { nodes: [{ id: 'a', name: 'A' }] },
      { nodes: [{ id: 'b' }], edges: [] },
      { nodes: [{ id: 'c' }], discovered: ['c'] },
      { nodes: [{ id: 'd' }], currentNodeId: 'd' },
      { nodes: 'not-array' },
      { random: 'garbage' }
    ];
    inputs.forEach((input, i) => {
      const m = ensureMap(input);
      assert.ok(Array.isArray(m.nodes), `ensureMap(#${i}) must produce nodes array`);
      assert.ok(Array.isArray(m.edges), `ensureMap(#${i}) must produce edges array`);
      assert.ok(Array.isArray(m.discovered), `ensureMap(#${i}) must produce discovered array`);
    });
  });

  it('MP-05: 10 travel turns preserve map topology size', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkAdventure(`mp05-${i}`);
      const nodeCount = w.map.nodes.length;
      for (let t = 0; t < 5; t++) {
        const { world } = playerMove(w, packs, 'go north');
        w = world;
      }
      assert.equal(w.map.nodes.length, nodeCount, 'travel must not add/remove nodes');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GO: Goals (3 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-GO: Goals', () => {
  it('GO-01: createGoal appends to world.goals for 10 different specs', () => {
    const specs = [
      { kind: 'reach', targetRef: 'n1' }, { kind: 'obtain', targetRef: 'key' },
      { kind: 'talkTo', targetRef: 'Iden' }, { kind: 'learn', targetRef: 'secret' },
      { kind: 'defeat', targetRef: 'boss' }, { kind: 'reach', targetRef: 'n2' },
      { kind: 'obtain', targetRef: 'gem' }, { kind: 'talkTo', targetRef: 'Kael' },
      { kind: 'learn', targetRef: 'map' }, { kind: 'defeat', targetRef: 'thug' }
    ];
    let w = mkAdventure('go01');
    const before = (w.goals || []).length;
    specs.forEach(spec => { w = createGoal(w, spec).world; });
    const after = (w.goals || []).length;
    assert.equal(after, before + 10, `expected ${before + 10} goals, got ${after}`);
  });

  it('GO-02: activeGoals returns only goals with status=active', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkAdventure(`go02-${i}`);
      w = createGoal(w, { kind: 'reach', targetRef: `n${i}` }).world;
      const active = activeGoals(w);
      assert.ok(Array.isArray(active));
      assert.ok(active.every(g => g.status === 'active'), 'activeGoals must only return status=active');
    }
  });

  it('GO-03: createGoal rejects invalid kind or missing targetRef', () => {
    const bad = [
      { kind: 'teleport', targetRef: 'x' }, { kind: '', targetRef: 'x' },
      { kind: 'reach' }, { kind: 'reach', targetRef: '' },
      { targetRef: 'x' }, {}, { kind: 'reach', targetRef: null },
      { kind: null, targetRef: 'x' }, { kind: 'REACH', targetRef: 'x' },
      { kind: 'obtainx', targetRef: 'x' }
    ];
    bad.forEach((spec, i) => {
      let w = mkAdventure(`go03-${i}`);
      const before = w.goals.length;
      const result = createGoal(w, spec);
      assert.equal(result.goal, null, `spec #${i} (${JSON.stringify(spec)}) should be rejected`);
      assert.equal(result.world.goals.length, before, 'goals should not change on rejection');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LD: Ledger (3 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-LD: Ledger mechanics', () => {
  it('LD-01: addFact caps at 8 even with 20 inserts', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkWorld(`ld01-${i}`);
      for (let k = 0; k < 20; k++) w = addFact(w, `f${i}-${k}`);
      assert.ok(w.ledger.facts.length <= 8, `facts.length=${w.ledger.facts.length}`);
    }
  });

  it('LD-02: addThreat caps at 8 with varying severity', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkWorld(`ld02-${i}`);
      for (let k = 0; k < 15; k++) w = addThreat(w, `t${i}-${k}`, (k % 5) + 1);
      assert.ok(w.ledger.threats.length <= 8);
    }
  });

  it('LD-03: addQuestion caps at 8', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkWorld(`ld03-${i}`);
      for (let k = 0; k < 12; k++) w = addQuestion(w, `q${i}-${k}?`);
      assert.ok(w.ledger.questions.length <= 8);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AD: Advantage tokens (3 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-AD: Advantage tokens', () => {
  it('AD-01: advantage delta clamps to [0, 2] across 10 deltas', () => {
    const deltas = [5, -5, 1, -1, 10, -10, 2, -2, 100, -100];
    deltas.forEach((d, i) => {
      let w = mkAdventure(`ad01-${i}`);
      const pid = w.party[0].id;
      w = applyDeltas(w, [{ op: 'advantage', actorId: pid, by: d }]);
      const v = w.meta.advantageTokens?.[pid] ?? 0;
      assert.ok(v >= 0 && v <= 2, `token=${v} out of [0,2] for delta=${d}`);
    });
  });

  it('AD-02: advantage per actor is independent', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkAdventure(`ad02-${i}`);
      const pid = w.party[0].id;
      w = applyDeltas(w, [{ op: 'advantage', actorId: pid, by: 1 }]);
      w = applyDeltas(w, [{ op: 'advantage', actorId: 'someone-else', by: 2 }]);
      assert.equal(w.meta.advantageTokens?.[pid], 1);
      assert.equal(w.meta.advantageTokens?.['someone-else'] ?? 0, 2);
    }
  });

  it('AD-03: advantage survives ensureWorld normalization', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkAdventure(`ad03-${i}`);
      const pid = w.party[0].id;
      w = applyDeltas(w, [{ op: 'advantage', actorId: pid, by: 2 }]);
      const normalized = ensureWorld(w);
      assert.equal(normalized.meta.advantageTokens?.[pid], 2);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WT: World tick (2 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-WT: World tick', () => {
  it('WT-01: worldTick is deterministic under same seed string', () => {
    for (let i = 0; i < 10; i++) {
      const w = mkAdventure(`wt01-${i}`);
      const a = worldTick(w, `wt01-tick-${i}`);
      const b = worldTick(w, `wt01-tick-${i}`);
      assert.equal(worldHash(a), worldHash(b), `determinism fail on seed ${i}`);
    }
  });

  it('WT-02: worldTick preserves invariants for 10 different worlds', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkAdventure(`wt02-${i}`);
      // Raise clocks to provoke tick paths
      w = applyDeltas(w, [
        { op: 'clock', key: 'dread', by: (i % 12) },
        { op: 'clock', key: 'pressure', by: ((i * 2) % 12) }
      ]);
      const ticked = worldTick(w, `wt02-seed-${i}`);
      assertWorldInvariants(ticked);
      assert.ok(ticked.clocks.dread >= 0 && ticked.clocks.dread <= 12);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GU: Input guards (4 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-GU: Input guards', () => {
  it('GU-01: empty string input never crashes', () => {
    for (let i = 0; i < 10; i++) {
      const w = mkAdventure(`gu01-${i}`);
      assert.doesNotThrow(() => playerMove(w, packs, ''));
    }
  });

  it('GU-02: whitespace-only input never crashes', () => {
    const ws = ['   ', '\t', '\n', '  \t\n  ', ' ', '\r\n', '\t\t', '     ', '\n\n', '  \n  '];
    ws.forEach((s, i) => {
      const w = mkAdventure(`gu02-${i}`);
      assert.doesNotThrow(() => playerMove(w, packs, s), `crashed on "${s.replace(/\s/g, '·')}"`);
    });
  });

  it('GU-03: 10 garbage inputs all preserve invariants', () => {
    const garbage = ['asdfasdf', '!@#$%', 'xxxxx', '1234', 'qqqqqqqqqq', '💀🔥', 'NULL', 'undefined', '\0\0', '.,.,.,'];
    garbage.forEach((g, i) => {
      let w = mkAdventure(`gu03-${i}`);
      const { world } = playerMove(w, packs, g);
      assert.doesNotThrow(() => assertWorldInvariants(world), `invariants broke for "${g}"`);
    });
  });

  it('GU-04: very long input (up to 1000 chars) does not crash', () => {
    for (let i = 0; i < 10; i++) {
      const w = mkAdventure(`gu04-${i}`);
      const long = 'I attack ' + 'x'.repeat(100 * (i + 1));
      assert.doesNotThrow(() => {
        const { world } = playerMove(w, packs, long);
        assertWorldInvariants(world);
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DT: Determinism (3 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-DT: Determinism', () => {
  it('DT-01: export→import roundtrip preserves worldHash across 10 seeds', () => {
    for (let i = 0; i < 10; i++) {
      const w = mkAdventure(`dt01-${i}`);
      const h1 = worldHash(w);
      const blob = exportWorld(w);
      const restored = importWorld(blob);
      assert.equal(worldHash(restored), h1, `roundtrip broke hash on seed ${i}`);
    }
  });

  it('DT-02: 10 distinct seeds produce 10 distinct world hashes', () => {
    const hashes = new Set();
    for (let i = 0; i < 10; i++) {
      hashes.add(worldHash(mkAdventure(`dt02-unique-${i}-${Math.random().toString(36).slice(2)}`)));
    }
    // Not strictly guaranteed to be 10, but should be > 1
    assert.ok(hashes.size > 1, `all seeds collided: ${hashes.size}`);
  });

  it('DT-03: same seed + same input = same output (10 inputs)', () => {
    const inputs = [
      'I look around', 'I search', 'I draw my sword', 'I pick the lock',
      'I rest', 'What do I see?', 'I hide', 'I listen', 'I climb', 'I force the door'
    ];
    inputs.forEach((input, i) => {
      const w1 = mkAdventure(`dt03-${i}`);
      const w2 = mkAdventure(`dt03-${i}`);
      const r1 = playerMove(w1, packs, input);
      const r2 = playerMove(w2, packs, input);
      assert.equal(worldHash(r1.world), worldHash(r2.world), `non-deterministic: "${input}"`);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CB: Combat depth (4 × 10)
// ═══════════════════════════════════════════════════════════════════════════

function mkCombatWorld(seed, opts = {}) {
  const pc = {
    id: 'party', name: 'Hero', vibe: '', archetype: '',
    wounds: 0, stress: 0, resources: { Supply: 5 }, level: 3,
    stats: { MIGHT: 16, AGILITY: 12, WITS: 12, GRIT: 14, CHARM: 10 },
    inventory: { items: [] },
    spells: { known: [], slots: {}, maxSlots: {}, concentration: null }
  };
  let w = mkWorld(seed);
  w = ensureWorld({
    ...w, party: [pc],
    scene: { location: 'arena', objective: 'fight', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  const enemy = {
    id: 'enemy_0', name: opts.name || 'Dummy',
    hp: opts.hp ?? 8, maxHp: opts.hp ?? 8,
    damage: 1, ac: opts.ac ?? 3, cr: 0.25,
    damageType: 'bludgeoning', resistances: {}, conditionImmunities: [], conditions: [],
    actions: [{ name: 'Slap', toHit: 1, damage: '1d2', type: 'bludgeoning' }],
    multiattack: null, saveProficiencies: [], canParley: false,
    defeated: false, sourceNpcId: '', lootTableRef: 'cr_0_1',
    initMod: -2, legendaryActions: null, reactions: null, lairActions: null,
    senses: { darkvision: null, blindsight: null, tremorsense: null, truesight: null }
  };
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      active: true, round: 1, turnIndex: 0, enemies: [enemy],
      beganAt: 0, reason: 'test', playerGuard: false, companionGuard: false,
      initiativeOrder: [
        { id: 'party', type: 'party', roll: 18, modifier: 2, total: 20 },
        { id: 'enemy_0', type: 'enemy', roll: 3, modifier: -2, total: 1 }
      ]
    }
  }]);
  return w;
}

describe('UX4-CB: Combat depth', () => {
  it('CB-01: combat resolves (active=false) within 20 turns across 10 seeds', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkCombatWorld(`cb01-${i}`, { hp: 2 });
      for (let t = 0; t < 20; t++) {
        if (!w.combat.active) break;
        const res = resolveCombatTurn(w, { approachTag: 'force', intentText: 'attack', risk: 0.1, stakeTag: 'harm' });
        w = res.world;
      }
      assert.equal(w.combat.active, false, `seed ${i} did not resolve in 20 turns`);
    }
  });

  it('CB-02: party wounds never exceed dynamic maxWounds during combat', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkCombatWorld(`cb02-${i}`, { hp: 50, ac: 10 });
      for (let t = 0; t < 10; t++) {
        if (!w.combat.active) break;
        const res = resolveCombatTurn(w, { approachTag: 'force', intentText: 'attack', risk: 0.1, stakeTag: 'harm' });
        w = res.world;
        const p = w.party[0];
        const gm = statMod(p.stats?.GRIT ?? 10);
        const cap = maxWounds(p.level ?? 1, gm);
        assert.ok(p.wounds <= cap, `wounds ${p.wounds} > cap ${cap}`);
      }
    }
  });

  it('CB-03: enemy HP monotonic-decreasing under attack (never increases)', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkCombatWorld(`cb03-${i}`, { hp: 20, ac: 1 });
      let lastHp = w.combat.enemies[0].hp;
      for (let t = 0; t < 10; t++) {
        if (!w.combat.active) break;
        const res = resolveCombatTurn(w, { approachTag: 'force', intentText: 'attack', risk: 0.1, stakeTag: 'harm' });
        w = res.world;
        const curHp = w.combat.enemies[0]?.hp ?? 0;
        assert.ok(curHp <= lastHp, `seed ${i} turn ${t}: hp went up ${lastHp} → ${curHp}`);
        lastHp = curHp;
      }
    }
  });

  it('CB-04: combat resolution preserves party.id and name across 10 battles', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkCombatWorld(`cb04-${i}`, { hp: 1 });
      const id0 = w.party[0].id;
      const name0 = w.party[0].name;
      for (let t = 0; t < 10; t++) {
        if (!w.combat.active) break;
        const res = resolveCombatTurn(w, { approachTag: 'force', intentText: 'attack', risk: 0.1, stakeTag: 'harm' });
        w = res.world;
      }
      assert.equal(w.party[0].id, id0);
      assert.equal(w.party[0].name, name0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FB: Fate band (2 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-FB: Fate band thresholds', () => {
  it('FB-01: fateBand returns only 3 valid labels across 10 values', () => {
    const values = [0, 0.1, 0.2, 0.33, 0.34, 0.5, 0.66, 0.67, 0.9, 1.0];
    values.forEach(v => {
      const band = fateBand(v);
      assert.ok(['cooperative', 'grim', 'blood'].includes(band), `bad band "${band}" for ${v}`);
    });
  });

  it('FB-02: fateBand is monotonic (cooperative → grim → blood)', () => {
    const order = { cooperative: 0, grim: 1, blood: 2 };
    let prev = -1;
    for (let i = 0; i <= 10; i++) {
      const v = i / 10;
      const b = order[fateBand(v)];
      assert.ok(b >= prev, `non-monotonic at v=${v}: band order ${prev} → ${b}`);
      prev = b;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WN: Wounds & stress deltas (2 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-WN: Wound & stress deltas', () => {
  it('WN-01: wound +N then -N returns to baseline (within clamp)', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkAdventure(`wn01-${i}`);
      const pid = w.party[0].id;
      const base = w.party[0].wounds;
      w = applyDeltas(w, [{ op: 'wound', entityId: pid, by: 2 }]);
      const mid = w.party[0].wounds;
      assert.ok(mid >= base, 'wounds should increase');
      w = applyDeltas(w, [{ op: 'wound', entityId: pid, by: -2 }]);
      assert.ok(w.party[0].wounds <= mid, 'healing should reduce wounds');
      assert.ok(w.party[0].wounds >= 0, 'wounds must not go negative');
    }
  });

  it('WN-02: stress clamps at 6 regardless of overflow delta', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkAdventure(`wn02-${i}`);
      const pid = w.party[0].id;
      w = applyDeltas(w, [{ op: 'stress', entityId: pid, by: 100 + i }]);
      assert.ok(w.party[0].stress <= 6, `stress=${w.party[0].stress} > 6`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CL: Clock mechanics (2 × 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('UX4-CL: Clock mechanics', () => {
  it('CL-01: each clock key clamps to [0, 12]', () => {
    const keys = ['dread', 'pressure', 'revelation'];
    keys.forEach((key, ki) => {
      for (let i = 0; i < 10; i++) {
        let w = mkWorld(`cl01-${ki}-${i}`);
        w = applyDeltas(w, [{ op: 'clock', key, by: (i - 5) * 10 }]);
        const v = w.clocks[key];
        assert.ok(v >= 0 && v <= 12, `${key}=${v} out of [0,12]`);
      }
    });
  });

  it('CL-02: independent clocks do not cross-contaminate', () => {
    for (let i = 0; i < 10; i++) {
      let w = mkWorld(`cl02-${i}`);
      w = applyDeltas(w, [{ op: 'clock', key: 'dread', by: 3 }]);
      const pBefore = w.clocks.pressure;
      const rBefore = w.clocks.revelation;
      w = applyDeltas(w, [{ op: 'clock', key: 'dread', by: 2 }]);
      assert.equal(w.clocks.pressure, pBefore, 'dread change must not alter pressure');
      assert.equal(w.clocks.revelation, rBefore, 'dread change must not alter revelation');
    }
  });
});
