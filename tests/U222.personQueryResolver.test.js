// U222 — the P-2 PersonQuery resolver (engine/world/personQuery.js) + dialogue renderer.
//
// Contract (sibling of placeQuery, person scope): map a person-targeted question to the typed
// `identity` slot, resolve the REFERENT against the present non-hostile roster (the same source
// placeQuery.resolvePopulation reads), and return a grounded { name, role } fact — or null when
// the referent doesn't resolve (caller falls through to the existing clarify/decline/floor; never
// invents). Deferred slots (motive/secret/backstory/allegiance/leadership) are NOT classified.
// Narrator + NPC dialogue RENDER the same fact (one fact, two voices). §0-safe: name + role only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPersonQuery, resolvePersonFact } from '../engine/world/personQuery.js';
import { commonKnowledgeAnswer } from '../engine/npc/dialogue.js';
import { FIXTURES } from '../scripts/convergence/fixtures.mjs';

function keeperOf(w) {
  return w.map.nodes.find(n => n.id === w.map.currentNodeId).settlement.npcs.find(n => n.id === 'npc_keeper');
}

test('U222 personQuery — identity resolves a present NPC by name and by role (grounded)', () => {
  const w = FIXTURES.trade_town_tavern_dialogue(); // Bram (keeper) + Pell (trader)
  for (const q of ['who is Pell?', 'who is the trader?', 'what do I know about Pell?']) {
    const cq = classifyPersonQuery(q);
    assert.ok(cq && cq.type === 'identity', `${q} classifies identity`);
    const f = resolvePersonFact(w, cq);
    assert.ok(f, `${q} resolves`);
    assert.match(f.body, /Pell Riven, a trader/i);
  }
});

test('U222 personQuery — deferred slots (motive/secret/backstory/allegiance/leadership) classify null', () => {
  for (const q of ['what does Pell want?', 'what is Pell hiding?', 'what is the trader backstory?',
                   'who does Pell work for?', 'is Pell part of the cult?', 'who is the elder?', 'what is Pell thinking?']) {
    assert.equal(classifyPersonQuery(q), null, `${q} must NOT classify as identity (deferred)`);
  }
});

test('U222 personQuery — place/object queries are not poached', () => {
  const w = FIXTURES.trade_town_tavern_dialogue();
  for (const q of ['who is here?', 'who lives here?', 'who founded this place?', 'what is this object?', 'who runs this place?']) {
    const cq = classifyPersonQuery(q);
    assert.ok(!cq || !resolvePersonFact(w, cq), `${q} must not become a person identity`);
  }
});

test('U222 personQuery — NEVER identifies a hostile (sight-scoped safety)', () => {
  const world = { map: { currentNodeId: 'n', nodes: [{ id: 'n', settlement: { npcs: [
    { id: 'h', name: 'Grik', role: 'bandit', hostile: true },
  ] } }] } };
  assert.equal(resolvePersonFact(world, classifyPersonQuery('who is the bandit?')), null);
  assert.equal(resolvePersonFact(world, { type: 'identity', ref: 'that', demonstrative: true }), null);
});

test('U222 personQuery — unknown/absent referent returns null (→ caller declines, no invention)', () => {
  const w = FIXTURES.trade_town_tavern_dialogue();
  assert.equal(resolvePersonFact(w, classifyPersonQuery('who is Kael?')), null);
});

test('U222 personQuery — excludeId drops the speaker (a speaker never self-identifies)', () => {
  const w = FIXTURES.trade_town_tavern_dialogue();
  assert.equal(resolvePersonFact(w, { ...classifyPersonQuery('who is Bram?'), excludeId: 'npc_keeper' }), null);
  assert.ok(resolvePersonFact(w, { ...classifyPersonQuery('who is Pell?'), excludeId: 'npc_keeper' }), 'Pell still resolves');
});

test('U222 dialogue — NPC voices a present-other identity; self/defer unchanged', () => {
  const w = FIXTURES.trade_town_tavern_dialogue();
  const r = commonKnowledgeAnswer(w, keeperOf(w), 'who is Pell?');
  assert.ok(r && r.mode === 'identity');
  assert.match(r.body, /Pell Riven, a trader/i);
  assert.doesNotMatch(r.body, /Bram Cask/i, 'the speaker never identifies itself');
  assert.equal(commonKnowledgeAnswer(w, keeperOf(w), 'who are you?').mode, 'self', 'self stays self');
  assert.equal(commonKnowledgeAnswer(w, keeperOf(w), 'what does Pell want?'), null, 'motive defers → null');
});
