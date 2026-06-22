// U220 — the World-Query Resolver (place scope). docs/WORLD_QUERY_RESOLVER.md.
// Locks the resolver module's contract directly (the typed-handler the W-# track graduates
// into), complementing the end-to-end corpus cases C4-012 (deliver) / C9-008 (decline boundary).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPlaceQuery, resolvePlaceFact } from '../engine/world/placeQuery.js';
import { FIXTURES } from '../scripts/convergence/fixtures.mjs';

test('U220 placeQuery — classifyPlaceQuery maps a founding CIRCUMSTANCE to the typed slot', () => {
  for (const t of [
    'how was this town founded?',
    'why was this place settled here?',
    'what is the history of this place?',
    "what's the story of this town?",
    'how did this town come to be?',
    'how old is this town?',
  ]) {
    assert.deepEqual(classifyPlaceQuery(t), { scope: 'here', type: 'founding' }, t);
  }
});

test('U220 placeQuery — AGENT/COUNT + non-place queries are NOT classified (caller declines/handles)', () => {
  for (const t of [
    'who founded this town?',            // agent → C9 decline path, not the resolver
    'how many founders were there?',     // count
    'which family built this town?',     // agent
    'name the founders of this town',    // agent
    'I look around',                     // survey
    'what is this place?',               // look-around, not a founding circumstance
    'how do I get this town to settle down?', // "settle down" idiom, not founding
  ]) {
    assert.equal(classifyPlaceQuery(t), null, t);
  }
});

test('U220 placeQuery — resolvePlaceFact delivers the node substrate founding fact when present', () => {
  const fact = resolvePlaceFact(FIXTURES.trade_town_tavern(), { scope: 'here', type: 'founding' });
  assert.ok(fact, 'expected a grounded fact');
  assert.equal(fact.type, 'founding');
  assert.equal(fact.clarity, 'vivid');           // NODE layer = this town's own founding
  assert.match(fact.body, /merchant who saw the ford/);
});

test('U220 placeQuery — resolvePlaceFact returns null when the node has no founding event (→ honest decline)', () => {
  // village_baker deliberately has NO node-level substrate — the C9-005/006/007 lock.
  assert.equal(resolvePlaceFact(FIXTURES.village_baker(), { scope: 'here', type: 'founding' }), null);
});

test('U220 placeQuery — events: "what happened here?" classifies to the events slot', () => {
  for (const t of [
    'what happened here?',
    "what's happened in this town?",
    'anything happen here lately?',
    'what goes on around here?',
    'what trouble has this town seen?',
  ]) {
    assert.deepEqual(classifyPlaceQuery(t), { scope: 'here', type: 'events' }, t);
  }
});

test('U220 placeQuery — events: person/relational/bare/agent forms do NOT classify (the place-anchor guard)', () => {
  for (const t of [
    'what happened to the baker?',                  // person — no place anchor
    'what is the history between the two families?', // relational — keeps deflecting (C9-002)
    'what happened?',                                // bare — its own handler
    'who caused the trouble here?',                  // agent — decline, not an event deliver
  ]) {
    assert.equal(classifyPlaceQuery(t), null, t);
  }
});

test('U220 placeQuery — events: resolvePlaceFact delivers a node local-event when present, null when not', () => {
  const fact = resolvePlaceFact(FIXTURES.trade_town_tavern(), { scope: 'here', type: 'events' });
  assert.ok(fact, 'expected a grounded local-event');
  assert.equal(fact.type, 'events');
  assert.equal(fact.clarity, 'vivid');
  assert.match(fact.body, /traveling healers/);
  assert.equal(resolvePlaceFact(FIXTURES.village_baker(), { scope: 'here', type: 'events' }), null);
});

test('U220 placeQuery — unknown/missing type resolves to null, never throws', () => {
  const w = FIXTURES.trade_town_tavern();
  assert.equal(resolvePlaceFact(w, { type: 'nonesuch' }), null);
  assert.equal(resolvePlaceFact(w, null), null);
  assert.equal(resolvePlaceFact(w, {}), null);
});
