// U274 — the combat-slice harness goal (W2·1). GOAL_PREVAIL points the Human
// Playtest Harness at the live escape engine: get outside, fight the lurking
// hostile, win. The win signal is the DURABLE committed trace endCombat leaves —
// meta.npcCombatHp[id].down — not combat.enemies (cleared on victory). Read-only,
// deterministic, no RNG.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GOALS, GOAL_PREVAIL, getGoal } from '../engine/harness/goals.js';

// Minimal world shapes — the goal only reads scene.interior, combat, meta.
const inside = () => ({ scene: { interior: { roomId: 'r0' } }, combat: { active: false }, meta: {} });
const outside = () => ({ scene: {}, combat: { active: false }, meta: { escapeHp: 13 } });
const fighting = (hp, maxHp = 10) => ({ scene: {}, combat: { active: true, enemies: [{ id: 'e', hp, maxHp, defeated: false }] }, meta: { escapeHp: 8 } });
const won = () => ({ scene: {}, combat: { active: false, enemies: [] }, meta: { escapeHp: 6, npcCombatHp: { npc1: { hp: 0, down: true } } } });
const died = () => ({ scene: {}, combat: { active: false, enemies: [] }, meta: { escapeHp: 0, npcCombatHp: { npc1: { hp: 4, down: false } } } });

test('U274: GOAL_PREVAIL is registered in the goal table', () => {
  assert.equal(getGoal('prevail-in-fight'), GOAL_PREVAIL);
  assert.ok(GOALS['prevail-in-fight']);
});

test('U274: not satisfied while inside / outside / mid-fight', () => {
  assert.equal(GOAL_PREVAIL.satisfied(inside()), false);
  assert.equal(GOAL_PREVAIL.satisfied(outside()), false);
  assert.equal(GOAL_PREVAIL.satisfied(fighting(10)), false);
});

test('U274: satisfied only when a foe was downed, the fight is over, and the PC lives', () => {
  assert.equal(GOAL_PREVAIL.satisfied(won()), true);
  assert.equal(GOAL_PREVAIL.satisfied(died()), false, 'a downed PC has not prevailed');
});

test('U274: progress climbs inside → outside → wearing the foe down → win', () => {
  const pInside = GOAL_PREVAIL.progressMetric(inside());
  const pOutside = GOAL_PREVAIL.progressMetric(outside());
  const pFull = GOAL_PREVAIL.progressMetric(fighting(10));   // foe untouched
  const pHurt = GOAL_PREVAIL.progressMetric(fighting(2));    // foe nearly down
  const pWon = GOAL_PREVAIL.progressMetric(won());
  assert.ok(pInside < pOutside, `${pInside} < ${pOutside}`);
  assert.ok(pOutside < pFull, `${pOutside} < ${pFull}`);
  assert.ok(pFull < pHurt, `wearing the foe down must raise progress: ${pFull} < ${pHurt}`);
  assert.ok(pHurt < pWon, `${pHurt} < ${pWon}`);
  assert.equal(pWon, 1);
});
