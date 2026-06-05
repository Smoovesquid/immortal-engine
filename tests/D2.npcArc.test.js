import test from 'node:test';
import assert from 'node:assert/strict';
import { npcWant, npcArc, resolveArc } from '../engine/npc/npcArc.js';
import { discoveryFor } from '../engine/discovery/discovery.js';

const SEED = 'mira';
const idOfClass = cls => { for (let i = 0; i < 4000; i++) { const id = 'soul_' + i; const d = discoveryFor(id, SEED); if ((d ? d.payoffClass : 'none') === cls) return id; } throw new Error('no ' + cls); };
const npc = (id, role, trust = 5, met = true, topics = []) => ({ id, role, conversationState: { metPlayer: met, trustLevel: trust, topicsDiscussed: topics } });

test('D2: everyone has a surface want, even the mundane', () => {
  const none = idOfClass('none');
  const w = npcWant(npc(none, 'farmer'), SEED);
  assert.ok(typeof w.surface === 'string' && w.surface.length > 0);
  assert.equal(w.deeper, null, 'a person with no thread has no deeper want');
  assert.equal(npcArc(npc(none, 'farmer'), SEED).recruitable, false);
});

test('D2: role flavors the want', () => {
  const id = idOfClass('none');
  assert.match(npcWant(npc(id, 'town guard'), SEED).surface, /watch|posting|battle/);
  assert.match(npcWant(npc(id, 'tavern keeper'), SEED).surface, /night|brewer|road/);
});

test('D2: a bond stays hidden until trust is earned, then offers to join', () => {
  const id = idOfClass('bond');
  const lowTrust = resolveArc(npc(id, 'healer', 2), SEED, { wits: 8 });
  assert.equal(lowTrust.status, 'hidden');
  assert.equal(lowTrust.recruitOffer, false, 'no friendship without trust');

  const earned = resolveArc(npc(id, 'healer', 8), SEED, { wits: 8 });
  assert.equal(earned.status, 'revealed');
  assert.equal(earned.recruitOffer, true, 'a real bond can walk beside you');
  assert.equal(earned.reward.companionEligible, true);
  assert.equal(earned.reward.mechanical, null, 'friendship is the whole reward');
});

test('D2: a lead guards its deeper want until trust AND the right question', () => {
  const id = idOfClass('lead');
  const noTopic = resolveArc(npc(id, 'merchant', 6, true, []), SEED, { wits: 8 });
  assert.notEqual(noTopic.status, 'revealed', 'trust alone is not enough for a guarded lead');
  const pressed = resolveArc(npc(id, 'merchant', 6, true, ['secret']), SEED, { wits: 8 });
  assert.equal(pressed.status, 'revealed');
  assert.ok(pressed.reward.mechanical && pressed.reward.mechanical.kind, 'a lead pays mechanically');
  assert.equal(pressed.recruitOffer, false, 'a lead-holder is not a friend by default');
});

test('D2: perception surfaces an unreliable tell before the reveal', () => {
  const id = idOfClass('trap');
  const blind = resolveArc(npc(id, 'stranger', 2), SEED, { wits: 8 });
  assert.equal(blind.status, 'hidden', 'the dull sense nothing');
  const sharp = resolveArc(npc(id, 'stranger', 2), SEED, { wits: 18 });
  assert.equal(sharp.status, 'hinted');
  assert.ok(typeof sharp.tell === 'string' && /sense/i.test(sharp.tell));
});

test('D2: deterministic', () => {
  const id = idOfClass('bond');
  assert.deepEqual(resolveArc(npc(id, 'healer', 8), SEED, { wits: 12 }), resolveArc(npc(id, 'healer', 8), SEED, { wits: 12 }));
});
