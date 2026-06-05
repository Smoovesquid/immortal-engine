import test from 'node:test';
import assert from 'node:assert/strict';
import { makeIntent, validateIntent, intentToMove, isTacticalVerb, defaultApproachForVerb, VERBS, APPROACHES } from '../engine/intent/intentSchema.js';

test('IN1: makeIntent normalizes garbage into a well-formed intent', () => {
  const i = makeIntent({ verb: 'ATTACK', target: 'dire_wolf', with: 'sword' });
  assert.equal(i.verb, 'attack');
  assert.equal(i.target, 'dire_wolf');
  assert.equal(i.approach, 'force', 'melee attack defaults to force/MIGHT');
  assert.equal(i.stake, 'harm');
  assert.equal(i.source, 'text');
  assert.equal(i.confidence, 1);
});

test('IN1: unknown verb degrades to ask, never throws', () => {
  const i = makeIntent({ verb: 'flibbertigibbet', text: 'I ponder the void' });
  assert.equal(i.verb, 'ask');
  assert.equal(i.text, 'I ponder the void');
});

test('IN1: ranged weapon flips attack approach to finesse', () => {
  assert.equal(defaultApproachForVerb('attack', 'shortbow'), 'finesse');
  assert.equal(defaultApproachForVerb('attack', 'sword'), 'force');
  assert.equal(defaultApproachForVerb('cast'), 'focus');
});

test('IN1: validateIntent flags attack with no target and no position', () => {
  assert.equal(validateIntent(makeIntent({ verb: 'attack' })).ok, false);
  assert.equal(validateIntent(makeIntent({ verb: 'attack', target: 'wolf' })).ok, true);
  assert.equal(validateIntent(makeIntent({ verb: 'cast', at: { x: 3, y: 4 } })).ok, true, 'blind-fire AoE at a tile is valid');
  assert.equal(validateIntent(makeIntent({ verb: 'wait' })).ok, true);
});

test('IN1: intentToMove projects into the resolveMove shape', () => {
  const m = intentToMove(makeIntent({ verb: 'talk', target: 'guard', text: 'I greet the guard warmly' }), { actorId: 'pc' });
  assert.equal(m.actorId, 'pc');
  assert.equal(m.approachTag, 'heart');
  assert.equal(m.stakeTag, 'time');
  assert.equal(m.targetId, 'guard');
  assert.equal(m.intentText, 'I greet the guard warmly');
});

test('IN1: tactical verbs are tagged for the battle engine', () => {
  assert.equal(isTacticalVerb('attack'), true);
  assert.equal(isTacticalVerb('move'), true);
  assert.equal(isTacticalVerb('talk'), false);
  assert.equal(isTacticalVerb('search'), false);
});

test('IN1: every verb has a sane default approach in the known set', () => {
  for (const v of VERBS) assert.ok(APPROACHES.includes(defaultApproachForVerb(v)), `${v} -> known approach`);
});

test('IN1: deterministic — same input, same intent', () => {
  const a = makeIntent({ verb: 'cast', with: 'fireball', at: { x: 2, y: 3 } });
  const b = makeIntent({ verb: 'cast', with: 'fireball', at: { x: 2, y: 3 } });
  assert.deepEqual(a, b);
});
