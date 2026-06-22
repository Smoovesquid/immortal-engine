// U221 — the W-6 NPC-dialogue renderer over the place-query resolver.
//
// W-6 contract: NPC dialogue RENDERS the SAME grounded fact the DM-narrator renders (one
// fact, two voices). dialogue.js's commonKnowledgeAnswer calls resolvePlaceFact for the
// filled public place slots (founding/events/population) and frames the body in NPC voice —
// it does NOT classify or look facts up itself (no second source of truth). Guarded/secret
// and the DEFERRED `control` slot (W-5) never surface through common knowledge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commonKnowledgeAnswer } from '../engine/npc/dialogue.js';
import { resolvePlaceFact } from '../engine/world/placeQuery.js';
import { FIXTURES } from '../scripts/convergence/fixtures.mjs';

function keeperOf(w) {
  return w.map.nodes.find(n => n.id === w.map.currentNodeId).settlement.npcs.find(n => n.id === 'npc_keeper');
}

test('U221 place dialogue — NPC voices the founding fact (same grounded fact as the narrator)', () => {
  const w = FIXTURES.trade_town_tavern_dialogue();
  const r = commonKnowledgeAnswer(w, keeperOf(w), 'how was this place founded?');
  assert.ok(r && r.mode === 'place', 'should answer via the place renderer');
  assert.match(r.body, /merchant who saw the ford/i, 'voices the substrate founding label');
  assert.doesNotMatch(r.body, /\[roll:/, 'common knowledge is never rolled');
});

test('U221 place dialogue — NPC voices a node local-event', () => {
  const w = FIXTURES.trade_town_tavern_dialogue();
  const r = commonKnowledgeAnswer(w, keeperOf(w), 'what happened here?');
  assert.ok(r && r.mode === 'place');
  assert.match(r.body, /traveling healers/i, 'voices the substrate local-event label');
});

test('U221 place dialogue — population EXCLUDES the speaker (no third-person self-listing)', () => {
  const w = FIXTURES.trade_town_tavern_dialogue();
  const r = commonKnowledgeAnswer(w, keeperOf(w), 'who lives here?');
  assert.ok(r && r.mode === 'place');
  assert.match(r.body, /Pell Riven the trader/i, 'names the neighbor');
  assert.doesNotMatch(r.body, /Bram Cask/i, 'the speaking NPC never lists itself as a resident');
});

test('U221 place dialogue — control is DEFERRED (W-5): NPC declines, never invents authority', () => {
  const w = FIXTURES.trade_town_tavern_dialogue();
  for (const q of ['who runs this place?', 'who secretly controls this town?', 'who runs the cult?']) {
    assert.equal(commonKnowledgeAnswer(w, keeperOf(w), q), null, `control "${q}" must not answer via common knowledge`);
  }
});

test('U221 place dialogue — unknown node (no substrate) honestly declines founding (no invention)', () => {
  const w = FIXTURES.dialogue_active(); // village_baker: no node-level substrate
  const baker = w.map.nodes.find(n => n.id === w.map.currentNodeId).settlement.npcs[0];
  assert.equal(commonKnowledgeAnswer(w, baker, 'how was this village founded?'), null, 'no founding to give → fall through to honest decline');
});

test('U221 placeQuery — population excludeId perspective drops the named speaker from the roster', () => {
  const w = FIXTURES.trade_town_tavern_dialogue();
  const all = resolvePlaceFact(w, { type: 'population' });            // narrator voice: names everyone
  assert.match(all.body, /Bram Cask the tavern-keeper/i);
  assert.match(all.body, /Pell Riven/i);
  const excl = resolvePlaceFact(w, { type: 'population', excludeId: 'npc_keeper' }); // NPC voice: speaker-excluded
  assert.doesNotMatch(excl.body, /Bram Cask/i, 'excludeId drops the speaker — same fact, two voices');
  assert.match(excl.body, /Pell Riven/i);
});
