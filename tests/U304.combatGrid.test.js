// U304 — MX-1 combat tactical grid.
//
// The combat engine owns integer cells (x=east, y=south) for the player and
// every enemy. Rendering minis and talk-to-token movement build on this schema.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld, ensureCombat, WORLD_VERSION } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { beginCombat } from '../engine/combat/combatLifecycle.js';
import { combatGridDistance, moveCombatant } from '../engine/combat/grid.js';
import { worldHash } from '../engine/worldHash.js';

function mkEnemy(over = {}) {
  return {
    id: 'enemy_0',
    name: 'Brigand',
    hp: 10,
    maxHp: 10,
    damage: 3,
    ac: 12,
    cr: 0.25,
    damageType: 'bludgeoning',
    resistances: {},
    conditionImmunities: [],
    conditions: [],
    actions: [],
    multiattack: null,
    saveProficiencies: [],
    canParley: true,
    defeated: false,
    sourceNpcId: '',
    lootTableRef: null,
    initMod: 0,
    legendaryActions: null,
    reactions: null,
    lairActions: null,
    senses: { darkvision: null, blindsight: null, tremorsense: null, truesight: null },
    ...over
  };
}

function mkWorld(seed = 'u304') {
  return newWorld({
    seed,
    fate: 0.2,
    campaignId: `c-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }
  });
}

function cellKey(cell) {
  return `${cell.cx},${cell.cy}`;
}

function assertGridCells(combat) {
  const cells = [combat.playerCell, ...(combat.enemies || [])];
  const seen = new Set();
  for (const cell of cells) {
    assert.equal(Number.isInteger(cell.cx), true, 'cx is integer');
    assert.equal(Number.isInteger(cell.cy), true, 'cy is integer');
    assert.ok(cell.cx >= 0 && cell.cx < combat.grid.w, `cx ${cell.cx} in bounds`);
    assert.ok(cell.cy >= 0 && cell.cy < combat.grid.h, `cy ${cell.cy} in bounds`);
    assert.equal(seen.has(cellKey(cell)), false, `duplicate cell ${cellKey(cell)}`);
    seen.add(cellKey(cell));
  }
}

test('U304-01: WORLD_VERSION is 32 and ensureCombat preserves grid + cells', () => {
  assert.equal(WORLD_VERSION, 32);
  const raw = {
    active: true,
    round: 1,
    turnIndex: 0,
    beganAt: 0,
    reason: 'test',
    playerGuard: false,
    companionGuard: false,
    initiativeOrder: [],
    grid: { w: 14, h: 11 },
    playerCell: { cx: 1, cy: 5 },
    enemies: [mkEnemy({ cx: 9, cy: 5 })]
  };

  const c = ensureCombat(raw);
  assert.deepEqual(c.grid, { w: 14, h: 11 });
  assert.deepEqual(c.playerCell, { cx: 1, cy: 5 });
  assert.equal(c.enemies[0].cx, 9);
  assert.equal(c.enemies[0].cy, 5);

  let w = mkWorld('u304-roundtrip');
  w = applyDeltas(w, [{ op: 'combatState', set: raw }]);
  assert.deepEqual(w.combat.grid, { w: 14, h: 11 });
  assert.deepEqual(w.combat.playerCell, { cx: 1, cy: 5 });
  assert.equal(w.combat.enemies[0].cx, 9);
  assert.equal(w.combat.enemies[0].cy, 5);
  assert.doesNotThrow(() => assertWorldInvariants(w));
});

test('U304-02: beginCombat places every combatant deterministically in bounds', () => {
  const enemies = [
    mkEnemy({ name: 'Brigand' }),
    mkEnemy({ name: 'Cutpurse' }),
    mkEnemy({ name: 'Scout' })
  ];
  const start = (reason) => beginCombat(mkWorld('u304-placement'), { enemies, reason });

  const ambushA = start('road ambush');
  const ambushB = start('road ambush');
  assert.deepEqual(ambushA.combat.grid, ambushB.combat.grid);
  assert.deepEqual(ambushA.combat.playerCell, ambushB.combat.playerCell);
  assert.deepEqual(
    ambushA.combat.enemies.map(e => ({ id: e.id, cx: e.cx, cy: e.cy })),
    ambushB.combat.enemies.map(e => ({ id: e.id, cx: e.cx, cy: e.cy }))
  );
  assertGridCells(ambushA.combat);
  assert.ok(ambushA.combat.playerCell.cx <= 2, 'player starts near the west edge');

  const normal = start('player-attack');
  const ambushNearest = Math.min(...ambushA.combat.enemies.map(e => combatGridDistance(ambushA.combat.playerCell, e)));
  const normalNearest = Math.min(...normal.combat.enemies.map(e => combatGridDistance(normal.combat.playerCell, e)));
  assert.ok(ambushNearest >= 3, 'ambush still has tactical separation');
  assert.ok(normalNearest >= ambushNearest, 'non-surprise starts no closer than an ambush');
});

test('U304-03: moveCombatant validates bounds, occupancy, and reach', () => {
  const combat = ensureCombat({
    active: true,
    round: 1,
    turnIndex: 0,
    beganAt: 0,
    reason: 'test',
    playerGuard: false,
    companionGuard: false,
    initiativeOrder: [],
    grid: { w: 12, h: 10 },
    playerCell: { cx: 1, cy: 5 },
    enemies: [
      mkEnemy({ id: 'enemy_0', cx: 8, cy: 5 }),
      mkEnemy({ id: 'enemy_1', cx: 4, cy: 5 })
    ]
  });

  const playerMoved = moveCombatant(combat, 'player', 2, 5);
  assert.deepEqual(playerMoved.playerCell, { cx: 2, cy: 5 });
  assert.strictEqual(moveCombatant(combat, 'player', -1, 5), combat, 'out of bounds rejected');
  assert.strictEqual(moveCombatant(combat, 'player', 4, 5), combat, 'occupied target rejected');
  assert.strictEqual(moveCombatant(combat, 'player', 9, 5), combat, 'beyond 30-foot reach rejected');

  const enemyMoved = moveCombatant(combat, 'enemy_0', 7, 5);
  assert.equal(enemyMoved.enemies[0].cx, 7);
  assert.equal(enemyMoved.enemies[0].cy, 5);
});

test('U304-04: active combat invariants reject overlapping and out-of-bounds cells', () => {
  const w = beginCombat(mkWorld('u304-invariants'), {
    enemies: [mkEnemy({ name: 'Wolf' }), mkEnemy({ name: 'Boar' })],
    reason: 'ambush'
  });

  const overlap = {
    ...w,
    combat: {
      ...w.combat,
      enemies: [
        { ...w.combat.enemies[0], cx: w.combat.playerCell.cx, cy: w.combat.playerCell.cy },
        w.combat.enemies[1]
      ]
    }
  };
  assert.throws(() => assertWorldInvariants(overlap), /occupied by multiple combatants/);

  const outOfBounds = {
    ...w,
    combat: {
      ...w.combat,
      enemies: [{ ...w.combat.enemies[0], cx: w.combat.grid.w, cy: 0 }]
    }
  };
  assert.throws(() => assertWorldInvariants(outOfBounds), /in combat\.grid bounds/);
});

test('U304-05: combat grid and movement are worldHash-stable under replay', () => {
  const run = () => {
    let w = beginCombat(mkWorld('u304-hash'), {
      enemies: [mkEnemy({ name: 'Wolf' }), mkEnemy({ name: 'Boar' })],
      reason: 'road ambush'
    });
    w = ensureWorld({
      ...w,
      combat: moveCombatant(w.combat, 'player', w.combat.playerCell.cx + 1, w.combat.playerCell.cy)
    });
    return worldHash(w);
  };
  assert.equal(run(), run());
});
