// engine/harness/oracles.test.js — the Phase-1 harness oracle bank + a hermetic
// end-to-end scripted session on the locked demo seed. NO network, NO API key:
// the deterministic oracles are pure, and the integration run uses a scripted
// player (zero cost). Proves: a hand-injected narration/state desync is caught,
// free-action + soft-lock fire correctly, and the loop drives a full session to
// goal completion on `tallow`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  runStateDesync, runFreeAction, runOracleBank, checkSoftLock, rolledThisTurn, cleanNarration,
} from './oracles.js';
import { getGoal, isInsideInterior } from './goals.js';
import { runSession, makeScriptedPlayer, bootWorld, loadPacks } from '../../scripts/playtest-harness.mjs';

// Minimal world fixtures (the oracles read only the fields they touch).
const inside = () => ({ scene: { interior: { roomId: 'room:2' } }, conversation: {} });
const outside = () => ({ scene: {}, conversation: {} });

test('state-desync: "step outside" while still inside is caught (the flagship)', () => {
  const findings = runStateDesync({
    before: inside(),
    after: inside(), // STILL inside — the contradiction
    output: { narration: 'Wizard: You step back outside.' },
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].oracleId, 'state-desync');
  assert.equal(findings[0].severity, 'high');
  assert.match(findings[0].note, /still-inside/);
});

test('state-desync: a real exit (interior cleared) raises NO finding', () => {
  const findings = runStateDesync({
    before: inside(),
    after: outside(), // correctly outdoors now
    output: { narration: 'Wizard: You step back outside.' },
  });
  assert.equal(findings.length, 0);
});

test('state-desync: FUTURE intent ("ready yourself to step out") is NOT a desync (J-Q1)', () => {
  // The DM describing the player getting READY to leave/enter is not a lie about where
  // they are — only a COMMITTED move that contradicts canon should fire. (Journey run t2.)
  assert.equal(runStateDesync({
    before: inside(), after: inside(),
    output: { narration: 'Wizard: You pull on your clothes as you ready yourself to step out into the settlement.' },
  }).length, 0, 'readiness to step out is not a committed exit');
  assert.equal(runStateDesync({
    before: outside(), after: outside(),
    output: { narration: 'Wizard: You ready yourself to step inside the inn.' },
  }).length, 0, 'readiness to step inside is not a committed entry');
  // …but the committed forms still fire.
  assert.equal(runStateDesync({ before: inside(), after: inside(), output: { narration: 'You step outside into the cold.' } }).length, 1, 'a real exit still fires');
  assert.equal(runStateDesync({ before: outside(), after: outside(), output: { narration: 'You step inside the inn and nod.' } }).length, 1, 'a real entry still fires');
});

test('state-desync: narrated kill with every foe still standing is caught', () => {
  const before = { scene: {}, combat: { active: true, enemies: [{ name: 'Rook', hp: 5, maxHp: 5, defeated: false }] } };
  const after = { scene: {}, combat: { active: true, enemies: [{ name: 'Rook', hp: 5, maxHp: 5, defeated: false }] } };
  const findings = runStateDesync({ before, after, output: { narration: 'Rook falls dead at your feet.' } });
  assert.equal(findings.length, 1);
  assert.match(findings[0].note, /no-corpse/);
});

test('free-action: a free intent that rolled the dice is caught', () => {
  const findings = runFreeAction({
    before: { conversation: {} },
    after: { conversation: { lastRoll: { roll: 14, dc: 12, turn: 3 } } },
    action: 'I step outside',
    output: { mechanics: '[roll:14 vs DC:12 → success]' },
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].oracleId, 'free-action');
});

test('free-action: a free intent with no roll is clean', () => {
  const w = { conversation: {} };
  const findings = runFreeAction({ before: w, after: w, action: 'I step outside', output: { mechanics: '' } });
  assert.equal(findings.length, 0);
});

test('free-action: a contested action (search) that rolls is NOT flagged', () => {
  const findings = runFreeAction({
    before: { conversation: {} },
    after: { conversation: { lastRoll: { roll: 12, dc: 12, turn: 4 } } },
    action: 'I search the chest for traps',
    output: { mechanics: '[roll:12 vs DC:12 → mixed]' },
  });
  assert.equal(findings.length, 0);
});

test('rolledThisTurn: detects a new lastRoll and the mechanics stamp', () => {
  assert.equal(rolledThisTurn({ conversation: {} }, { conversation: { lastRoll: { turn: 1 } } }, {}), true);
  assert.equal(rolledThisTurn({ conversation: {} }, { conversation: {} }, { mechanics: '[roll:9 vs DC:10 → fail]' }), true);
  assert.equal(rolledThisTurn({ conversation: {} }, { conversation: {} }, { mechanics: 'observe only — no roll' }), false);
});

test('soft-lock: a flat progress series fires exactly once at the window crossing', () => {
  const goal = getGoal('reach-first-concern');
  assert.equal(checkSoftLock([1, 1, 1], { window: 3, goal }), null);              // n == window → not yet
  const hit = checkSoftLock([1, 1, 1, 1], { window: 3, goal, turn: 4 });          // n == window+1 → fire
  assert.ok(hit && hit.oracleId === 'soft-lock');
  assert.equal(checkSoftLock([1, 1, 1, 1, 1], { window: 3, goal }), null);        // already fired → silent
});

test('soft-lock: a series that keeps improving never fires', () => {
  const goal = getGoal('reach-first-concern');
  assert.equal(checkSoftLock([0, 1, 1, 2], { window: 3, goal }), null);
});

test('oracle bank: tags hand-injected desync with its turn + action', () => {
  const findings = runOracleBank({
    before: inside(), after: inside(),
    action: 'head out the door', output: { narration: 'You head out the door into the sun.' }, turn: 7,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].turn, 7);
  assert.equal(findings[0].action, 'head out the door');
});

test('cleanNarration strips the engine speaker prefix', () => {
  assert.equal(cleanNarration('Wizard: You step outside.'), 'You step outside.');
});

// ── End-to-end: a full scripted session on `tallow` reaches the goal, clean ────
test('session: scripted player leaves the building and reaches a concern-bearer on tallow', async () => {
  const packs = loadPacks();
  const goal = getGoal('reach-first-concern');
  const begun = bootWorld('tallow', packs);
  assert.equal(isInsideInterior(begun.world), true, 'player should start inside the first building');

  const player = makeScriptedPlayer(['I get out of bed and step outside', 'I talk to Dalla']);
  const r = await runSession({
    world: begun.world, packs, goal, player, turns: 6,
    openerNarration: begun.output?.narration || '',
  });

  assert.equal(r.goalCompleted, true, 'goal should complete (out of building + talking to a concern-bearer)');
  assert.equal(r.progressMax, 2);
  // The happy path must be CLEAN — no false positives from the deterministic bank.
  const desync = r.findings.filter(f => f.oracleId === 'state-desync');
  const free = r.findings.filter(f => f.oracleId === 'free-action');
  assert.equal(desync.length, 0, `unexpected desync findings: ${JSON.stringify(desync)}`);
  assert.equal(free.length, 0, `unexpected free-action findings: ${JSON.stringify(free)}`);
});
