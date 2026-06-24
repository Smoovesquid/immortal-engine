// engine/harness/object-interaction.test.js — the object-interaction oracle
// (look / search / take / examine) + the probe-room coverage goal. Hermetic: the
// oracle is pure, the goal is pure over (world, actionsLog), and the integration
// run uses a scripted player on the locked `tallow` seed (NO network, NO key).
//
// The engine's real object path is well-behaved (it honestly denies absent objects,
// refuses heavy takes, reports empty searches — verified live), so the oracle is a
// GUARD: the NEGATIVE tests feed it the engine's ACTUAL good behavior and assert
// silence; the POSITIVE tests feed it a crafted contradiction and assert it fires.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runObjectInteraction, runOracleBank } from './oracles.js';
import { getGoal, probeCoverage, presentRoomObjects, GOAL_PROBE_ROOM } from './goals.js';
import { runSession, makeScriptedPlayer, bootWorld, loadPacks } from '../../scripts/playtest-harness.mjs';

// ── Fixtures (the oracle reads only inventory counts, node furniture, mechanics) ─
const invWorld = (n) => ({ party: [{ inventory: { tools: Array.from({ length: n }, (_, i) => ({ name: `item${i}` })) } }], map: {} });
const roomWorld = (names) => ({
  party: [{ inventory: {} }],
  map: { currentNodeId: 'n', nodes: [{ id: 'n', furniture: names.map(name => ({ name, parts: [] })) }] },
});
const run = (over) => runObjectInteraction({ before: invWorld(2), after: invWorld(2), action: '', output: {}, ...over });

// ── Check A — acquisition that didn't land ───────────────────────────────────
test('A/neg: a real take (inventory grew) raises NO finding', () => {
  const f = run({ before: invWorld(1), after: invWorld(2), output: { narration: 'You take the straw pallet.' } });
  assert.equal(f.length, 0);
});

test('A/pos: a take the engine never committed (inventory flat) is caught', () => {
  const f = run({ before: invWorld(2), after: invWorld(2), output: { narration: 'You pocket the brass key.' } });
  assert.equal(f.length, 1);
  assert.equal(f[0].oracleId, 'object-interaction');
  assert.equal(f[0].severity, 'high');
  assert.match(f[0].note, /^acquired-nothing/);
});

test('A/neg: a refused heavy take ("too heavy") is not a phantom acquisition', () => {
  const f = run({ output: { narration: "You try to take iron-bound chest, but it's too heavy to carry." } });
  assert.equal(f.length, 0);
});

test('A/neg: take-idioms with no object ("take cover", "take stock") never fire', () => {
  assert.equal(run({ output: { narration: 'You take cover behind the wall.' } }).length, 0);
  assert.equal(run({ output: { narration: 'You take stock of your surroundings. Exits: north.' } }).length, 0);
  assert.equal(run({ output: { narration: 'You take a seat by the fire and take a breath.' } }).length, 0);
  assert.equal(run({ output: { narration: 'You take the stairs down and take the lead.' } }).length, 0);
});

test('A/neg: adjective-led idioms ("take a real bed", "deep breath", "long look") never fire (IT-2)', () => {
  // The oracle keyed STOP_NOUNS on a LEADING ADJECTIVE ("real"), so a rest narration
  // ("you take a real bed and a real night") read as taking an item named "real".
  // It now skips known adjectives and keys the HEAD noun (bed/breath/look = stop-nouns).
  assert.equal(run({ output: { narration: 'You take a real bed and a real night. You wake whole.', mechanics: '[rest:long]' } }).length, 0, 'rest idiom + [rest:] guard');
  assert.equal(run({ output: { narration: 'You take a deep breath and steady yourself.' } }).length, 0, 'deep breath');
  assert.equal(run({ output: { narration: 'You take a long look around the room.' } }).length, 0, 'long look');
  assert.equal(run({ output: { narration: 'You take a quick breather, then press on.' } }).length, 0, 'quick breather');
  assert.equal(run({ output: { narration: 'You take her meaning and say no more.' } }).length, 0, 'take her meaning (dialogue idiom)');
});

test('A/neg: "reach INTO your pocket … fingers close on nothing" is not a phantom (IT-2 follow-up)', () => {
  // Paying a coin you don't have: the DM correctly narrates an EMPTY hand. The bare
  // "into your pocket" used to read as an acquisition (it's retrieval) — now it doesn't.
  const narr = "You reach into your pocket with a practiced motion, but your fingers close on nothing—not even lint—and you stand there, hand outstretched and empty.";
  assert.equal(run({ output: { narration: narr } }).length, 0, 'reaching into an empty pocket is not acquiring');
  // …but a real drop INTO the pocket still fires (recall preserved).
  assert.equal(run({ output: { narration: 'The brass key slides into your pocket.' } }).length, 1, 'slides into pocket = acquisition');
  assert.equal(run({ output: { narration: 'You slip the coin into your pocket.' } }).length, 1, 'verb-form take still fires');
});

test('A/pos: recall preserved — a real adjective+noun take ("the brass key") still fires (IT-2)', () => {
  // Skipping the adjective must NOT suppress a genuine phantom: the HEAD noun (key) is
  // a real object, so an ungranted "you take the brass key" is still caught.
  const f = run({ output: { narration: 'You take the brass key and pocket it.' } });
  assert.equal(f.length, 1, 'brass key is a real object — phantom still caught');
  assert.match(f[0].note, /^acquired-nothing/);
  // A multi-word object phrase resolves to its head noun, too.
  assert.equal(run({ output: { narration: 'You take the small wooden box.' } }).length, 1, 'wooden box still fires');
});

test('A/neg: "lift the lid" of a container is NOT a phantom acquisition (the lift-verb regression)', () => {
  const f = run({ output: { narration: "You lift the iron-bound chest's heavy lid and find it holds bundled bedding, three waterskins, a tinderbox, and a coil of rope." } });
  assert.equal(f.length, 0, 'lifting a lid is not acquiring the object — "lift" was dropped from the acquire verbs');
});

test('A/pos: a phrase-form acquisition ("the X is yours now") with no delta is caught', () => {
  const f = run({ output: { narration: 'The silver locket is yours now.' } });
  assert.equal(f.length, 1);
  assert.match(f[0].note, /^acquired-nothing/);
});

test('A/neg: figurative "the road is yours" is not an acquisition (IT-2 follow-up)', () => {
  // A combat-fled narration ("The road is yours again") used to read as taking an item.
  assert.equal(run({ output: { narration: 'The Highwaymen breaks and runs. The road is yours again.', mechanics: '[combat:fled]' } }).length, 0, 'the road is not an item');
  assert.equal(run({ output: { narration: 'The day is yours; the field is yours.' } }).length, 0, 'figurative victory phrasings');
  // …but a concrete object "is yours" still fires (recall preserved).
  assert.equal(run({ output: { narration: 'The brass key is yours now.' } }).length, 1, 'a real object still fires');
});

// ── Check B — a present object denied ────────────────────────────────────────
test('B/pos: denying a present object ("there is no X here") is caught', () => {
  const before = roomWorld(['straw pallet', 'oil lantern']);
  const f = runObjectInteraction({ before, after: before, action: 'I examine the straw pallet', output: { narration: 'There is no straw pallet here.' } });
  assert.equal(f.length, 1);
  assert.match(f[0].note, /^denied-present-object/);
});

test('B/pos: the engine\'s "look for X, but what\'s here is …" denial of a PRESENT object is caught', () => {
  const before = roomWorld(['iron-bound chest', 'oil lantern']);
  const f = runObjectInteraction({ before, after: before, action: 'I examine the chest', output: { narration: "You look for a chest, but what's here is an oil lantern." } });
  assert.equal(f.length, 1);
  assert.match(f[0].note, /^denied-present-object/);
});

test('B/neg: honestly denying an ABSENT object raises NO finding (not present → not a desync)', () => {
  const before = roomWorld(['straw pallet', 'oil lantern']);
  const f = runObjectInteraction({ before, after: before, action: 'I examine the anvil', output: { narration: "You look for an anvil, but what's here is a straw pallet, an oil lantern." } });
  assert.equal(f.length, 0);
});

test('B/neg: a correct examine of a present object raises NO finding', () => {
  const before = roomWorld(['straw pallet']);
  const f = runObjectInteraction({ before, after: before, action: 'I examine the straw pallet', output: { narration: 'You look the straw pallet over: flat from many sleepers. You make out its ticking, straw.' } });
  assert.equal(f.length, 0);
});

// ── Check C — a failed search that conjured loot ─────────────────────────────
test('C/pos: a FAILED search that narrates a find is caught (roll↔fiction contradiction)', () => {
  const f = runObjectInteraction({ before: invWorld(2), after: invWorld(2), action: 'I search the chest', output: { narration: 'You find a silver ring tucked in the lining.', mechanics: '[roll:3 vs DC:12 → failure | margin:-9]' } });
  assert.equal(f.length, 1);
  assert.match(f[0].note, /^failed-search-claimed-loot/);
});

test('C/neg: a failed search that turns up nothing is clean', () => {
  const f = runObjectInteraction({ before: invWorld(2), after: invWorld(2), action: 'I search the room for traps', output: { narration: 'You search high and low and turn up nothing worth the effort.', mechanics: '[roll:6 vs DC:12 → failure | margin:-6]' } });
  assert.equal(f.length, 0);
});

test('C/neg: a SUCCESSFUL search that reveals a find is fine (only failures contradict)', () => {
  const f = runObjectInteraction({ before: invWorld(2), after: invWorld(2), action: 'I search the chest', output: { narration: 'You find a silver ring.', mechanics: '[roll:17 vs DC:12 → success]' } });
  assert.equal(f.length, 0);
});

// ── Registry wiring ──────────────────────────────────────────────────────────
test('bank: the object-interaction oracle is registered and tags turn + action', () => {
  const findings = runOracleBank({ before: invWorld(2), after: invWorld(2), action: 'I grab the golden idol', output: { narration: 'You grab the golden idol.' }, turn: 4 });
  const oi = findings.filter(f => f.oracleId === 'object-interaction');
  assert.equal(oi.length, 1);
  assert.equal(oi[0].turn, 4);
  assert.equal(oi[0].action, 'I grab the golden idol');
});

// ── probe-room goal (pure over world + actionsLog) ───────────────────────────
test('probe-room: progress is the fraction of present objects probed; satisfied when all are', () => {
  const world = roomWorld(['straw pallet', 'oil lantern']);
  assert.equal(GOAL_PROBE_ROOM.progressMetric(world, { actionsLog: [] }), 0);
  assert.equal(GOAL_PROBE_ROOM.satisfied(world, { actionsLog: [] }), false);
  assert.equal(GOAL_PROBE_ROOM.progressMetric(world, { actionsLog: ['I examine the straw pallet'] }), 0.5);
  const all = { actionsLog: ['I examine the straw pallet', 'I look at the oil lantern'] };
  assert.equal(GOAL_PROBE_ROOM.progressMetric(world, all), 1);
  assert.equal(GOAL_PROBE_ROOM.satisfied(world, all), true);
});

test('probe-room: probeCoverage matches on head noun ("iron-bound chest" ← "the chest")', () => {
  const world = roomWorld(['iron-bound chest']);
  const cov = probeCoverage(world, { actionsLog: ['I search the chest'] });
  assert.equal(cov.universe.length, 1);
  assert.equal(cov.probed.length, 1);
});

// ── End-to-end: a scripted probe-room session on `tallow` covers the room clean ─
test('session: a scripted player probes every object on tallow and reaches the goal, clean', async () => {
  const packs = loadPacks();
  const goal = getGoal('probe-room');
  const begun = bootWorld('tallow', packs);

  // Read the room's real furniture and script an examine for each (self-adjusting
  // to whatever tallow seeds). Step out of bed first for a settled state.
  const names = presentRoomObjects(begun.world).map(o => o.name);
  assert.ok(names.length >= 2, `tallow's first room should hold objects (got ${JSON.stringify(names)})`);
  const player = makeScriptedPlayer(['I get out of bed', ...names.map(n => `I examine the ${n}`)]);

  const r = await runSession({ world: begun.world, packs, goal, player, turns: 12, openerNarration: begun.output?.narration || '' });

  assert.equal(r.goalCompleted, true, 'probing every object should satisfy the goal');
  // The honest, well-behaved engine path must be CLEAN — no false positives.
  const oi = r.findings.filter(f => f.oracleId === 'object-interaction');
  assert.equal(oi.length, 0, `unexpected object-interaction findings: ${JSON.stringify(oi)}`);
});
