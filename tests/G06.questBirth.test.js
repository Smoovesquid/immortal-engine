// G06 — D-B1 quest-birth bridge. proposeGoalFromDialogue maps a player's DECLARED intent
// in conversation to a goal spec; with goalContract it mints a tracked goal that completes
// on the deed — the talk→quest loop (rung 3). This locks the PURE module; the playloop
// wiring (mint + in-fiction acknowledgment) lands separately.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proposeGoalFromDialogue } from '../engine/goals/proposeGoal.js';
import { createGoal, checkGoals, activeGoals } from '../engine/goals/goalContract.js';
import { villageBakerWorld } from '../scripts/convergence/fixtures.mjs';
import { ensureWorld } from '../engine/state.js';

const baker = () => villageBakerWorld();          // node h56_settlement, Mira Hearth (npc_baker), + county nodes
const SALT = 'n2_4074001344';                      // "Saltmarket Town"

test('G06 — H2 reach: "I\'ll travel to <place>" → a reach goal toward that node', () => {
  const spec = proposeGoalFromDialogue(baker(), "I'll travel to Saltmarket Town.");
  assert.ok(spec, 'expected a goal spec');
  assert.equal(spec.kind, 'reach');
  assert.equal(spec.targetRef, SALT);
  assert.match(spec.label, /Saltmarket Town/);
});

test('G06 — H2 talkTo: "I\'ll go talk to <present NPC>" resolves to that NPC', () => {
  const spec = proposeGoalFromDialogue(baker(), "I'll go talk to Mira.");
  assert.ok(spec);
  assert.equal(spec.kind, 'talkTo');
  assert.equal(spec.targetRef, 'npc_baker');
});

test('G06 — H2 defeat: "I\'ll deal with <foe>" resolves to a present hostile', () => {
  let w = baker();
  w.map.nodes.find(n => n.id === w.map.currentNodeId).settlement.npcs.push(
    { id: 'npc_bandit', name: 'Brokefang', role: 'bandit', hostile: true }
  );
  w = ensureWorld(w);
  const spec = proposeGoalFromDialogue(w, "I'll drive off Brokefang.");
  assert.ok(spec);
  assert.equal(spec.kind, 'defeat');
  assert.equal(spec.targetRef, 'npc_bandit');
});

test('G06 — H2 learn vs obtain: a fact ask is learn; a real thing is obtain', () => {
  const learn = proposeGoalFromDialogue(baker(), "I'll find out who owes the debt.");
  assert.equal(learn?.kind, 'learn');
  const obtain = proposeGoalFromDialogue(baker(), "I'll find the missing ledger.");
  assert.equal(obtain?.kind, 'obtain');           // "missing ledger" is neither a present NPC nor a node
  assert.equal(obtain.targetRef, 'missing ledger');
});

test('G06 — H1 want: a bare help-offer to a present NPC adopts the NPC\'s own want', () => {
  const w = baker();
  const mira = w.map.nodes.find(n => n.id === w.map.currentNodeId).settlement.npcs[0];
  const spec = proposeGoalFromDialogue(w, "I'll help you however I can.", mira);
  assert.ok(spec, 'a help-offer mints a want-goal');
  assert.equal(spec.kind, 'learn');
  assert.match(spec.targetRef, /^helped:npc_baker/);
  assert.match(spec.label, /^Help Mira Hearth — /);  // labelled with the NPC's own surfaced want
});

test('G06 — NO false births: musings, questions, non-declarations, unresolved targets', () => {
  const w = baker();
  for (const t of [
    'Maybe I\'ll help out later.',          // musing
    'Should I help her?',                   // a question
    'What\'s troubling the town?',          // not a declaration
    'I\'ll think about it.',                // explicit non-commit
    'I\'ll find a way.',                    // vague-object idiom
    'I\'ll talk to Gorok the Unseen.',      // person not present → no phantom quest
    'I\'ll travel to Atlantis.',            // place not on the map → no phantom journey
  ]) {
    assert.equal(proposeGoalFromDialogue(w, t), null, t);
  }
});

test('G06 — the loop: a declared goal is minted, tracked, and completes on the deed', () => {
  let w = baker();
  const spec = proposeGoalFromDialogue(w, "I'll travel to Saltmarket Town.");
  const made = createGoal(w, spec);
  w = made.world;
  assert.ok(made.goal, 'goal minted');
  assert.equal(activeGoals(w).length, 1, 'one active goal');
  // do the deed — arrive at the node
  w = ensureWorld({ ...w, map: { ...w.map, currentNodeId: SALT } });
  const checked = checkGoals(w);
  assert.equal(checked.completed.length, 1, 'the goal completes on arrival');
  assert.equal(checked.completed[0].kind, 'reach');
});

test('G06 — deterministic: same input, same spec', () => {
  const a = proposeGoalFromDialogue(baker(), "I'll travel to Saltmarket Town.");
  const b = proposeGoalFromDialogue(baker(), "I'll travel to Saltmarket Town.");
  assert.deepEqual(a, b);
});
