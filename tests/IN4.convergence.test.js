import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent } from '../engine/intent/parseIntent.js';
import { intentFromClick } from '../engine/intent/intentFromClick.js';
import { intentToMove } from '../engine/intent/intentSchema.js';

// The whole point of the intent layer: a typed sentence and a tap on the map are
// two faucets into one pipe. For the same action they must produce the SAME
// mechanical intent — only `source`, `text`, and `confidence` may differ.

const ctx = {
  entities: [{ id: 'e1', ref: 'dire_wolf_alpha', name: 'Dire Wolf Alpha', faction: 'enemy' }],
  abilities: ['sword', 'shortbow'],
  spells: ['fireball'],
  items: []
};

const mechanical = i => ({ verb: i.verb, target: i.target, with: i.with, approach: i.approach, stake: i.stake });

test('IN4: "attack the wolf with my sword" (text) == clicking the wolf, sword armed', () => {
  const typed = parseIntent('attack the wolf with my sword', ctx);
  const clicked = intentFromClick({ kind: 'enemy', target: 'e1', x: 9, y: 3, ability: 'sword' }, ctx);
  assert.deepEqual(mechanical(typed), mechanical(clicked));
});

test('IN4: "cast fireball at the wolf" (text) == clicking the wolf, fireball armed', () => {
  const typed = parseIntent('cast fireball at the wolf', ctx);
  const clicked = intentFromClick({ kind: 'enemy', target: 'e1', x: 9, y: 3, ability: 'fireball' }, ctx);
  assert.deepEqual(mechanical(typed), mechanical(clicked));
});

test('IN4: both faucets feed the same resolver move shape', () => {
  const typed = intentToMove(parseIntent('attack the wolf with my sword', ctx), { actorId: 'pc' });
  const clicked = intentToMove(intentFromClick({ kind: 'enemy', target: 'e1', ability: 'sword' }, ctx), { actorId: 'pc' });
  assert.equal(typed.approachTag, clicked.approachTag);
  assert.equal(typed.stakeTag, clicked.stakeTag);
  assert.equal(typed.targetId, clicked.targetId);
  assert.equal(typed.toolTag, clicked.toolTag);
});

test('IN4: source/text differ but never the mechanics', () => {
  const typed = parseIntent('attack the wolf with my sword', ctx);
  const clicked = intentFromClick({ kind: 'enemy', target: 'e1', ability: 'sword' }, ctx);
  assert.equal(typed.source, 'text');
  assert.equal(clicked.source, 'click');
  assert.notEqual(typed.text, clicked.text); // text carries the utterance; click doesn't
});
