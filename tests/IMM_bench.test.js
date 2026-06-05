/**
 * IMM_bench — Immortal Engine canon-integrity benchmark.
 *
 * One legible home for the 8 machine-checkable invariants from the research
 * packet (RPGBench, arxiv 2502.00595, §2 + Priority 5). These properties are
 * also exercised in depth elsewhere (U19/U21 replay, U20 ending lock, U14
 * travel, guard.test, the C-series NPC tests); this suite states each one
 * explicitly, by name, against real engine surfaces so the "the engine makes
 * truth impossible to violate" claim is auditable at a glance.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { addFact } from '../engine/ledger.js';
import { beginAdventure, playerMove, newScene } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { guardPlayerText } from '../engine/guard.js';
import { filterContext } from '../engine/npc/perspectiveFilter.js';
import { validatePolish } from '../engine/ai/polishValidation.js';
import { createCanonLog, appendCanonEvent } from '../engine/csl/canonLog.js';
import { applyConductDeltas } from '../engine/ai/conductContract.js';
import { triggerEnding } from '../engine/ending.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel'],
    locations: ['tower'],
    objectives: ['find the key'],
    complications: ['a clock starts'],
    npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust']
  }
};

function fresh(seed = 'imm') {
  const w0 = newWorld({ seed, fate: 0.3, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  return beginAdventure(w0, packsById).world;
}

// U-IMM-001 — same seed + same transcript => same canon (worldHash).
test('U-IMM-001: determinism — identical inputs produce an identical world hash', () => {
  const run = () => {
    let w = fresh('imm001');
    w = playerMove(w, packsById, 'I search the room.').world;
    w = newScene(w, packsById).world;
    w = playerMove(w, packsById, 'I press onward.').world;
    return worldHash(w);
  };
  assert.equal(run(), run());
});

// U-IMM-002 — an illegal action produces a blocked event, not an invented success.
test('U-IMM-002: illegal action is blocked, never silently succeeds', () => {
  let w = fresh('imm002');
  // Establish canon the player will then try to contradict.
  w = addFact(w, 'not the king is dead', 'gm');
  assert.equal(guardPlayerText(w, 'The king is dead.').ok, false, 'guard should reject the contradiction');

  const before = w.timeline.length;
  const w2 = playerMove(w, packsById, 'The king is dead.').world; // declarative canon claim that conflicts
  const added = w2.timeline.slice(before);
  assert.ok(added.some(e => e.kind === 'blocked'), 'expected a blocked event');
  assert.ok(!added.some(e => e.kind === 'resolution'), 'must not invent a resolution success');
});

// U-IMM-003 — inventory cannot be mutated by the narration/proposal layer.
test('U-IMM-003: narration/proposal layer cannot mutate inventory', () => {
  const w = fresh('imm003');
  const invBefore = JSON.stringify(w.party?.[0]?.inventory ?? {});
  // The conduct contract exposes no inventory channel; unknown keys are ignored.
  const w2 = applyConductDeltas(w, { narration: 'You pocket it.', deltas: { addItem: 'Excalibur', inventory: { weapons: ['sword'] } } });
  const invAfter = JSON.stringify(w2.party?.[0]?.inventory ?? {});
  assert.equal(invAfter, invBefore, 'inventory must only change through a dedicated engine event');
});

// U-IMM-004 — an NPC cannot surface a fact outside its knowledge.
test('U-IMM-004: NPC cannot know an unrevealed fact', () => {
  const speaker = {
    personality: { honesty: 0.9, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
    knowledgeGraph: [{ factId: 'A' }],
    secrets: []
  };
  const facts = [{ factId: 'A', text: 'the gate is barred' }, { factId: 'B', text: 'the body in the cellar' }];
  const { filteredFacts } = filterContext(speaker, facts, { trust: 0.5, interactions: 0 });
  const ids = filteredFacts.map(f => f.factId || f.id);
  assert.ok(ids.includes('A'), 'known fact should pass through');
  assert.ok(!ids.includes('B'), 'unknown fact must be omitted');
});

// U-IMM-005 — a local (non-traveling) move does not emit a travel event.
test('U-IMM-005: local action does not trigger a travel event', () => {
  const w = fresh('imm005');
  const before = w.timeline.length;
  const w2 = playerMove(w, packsById, 'I look around the room.').world;
  const added = w2.timeline.slice(before);
  assert.ok(!added.some(e => e.kind === 'travel'), 'a look-around must not be logged as travel');
});

// U-IMM-006 — narration cannot introduce a canonical object/location, and only
// allowlisted event types can become canon.
test('U-IMM-006: narration cannot create canon; canon log rejects unknown event types', () => {
  const worldProxy = { ledger: { facts: [] }, scene: { location: '' }, meta: { seed: 's', fate: 0.2 } };
  assert.equal(
    validatePolish({ world: worldProxy, composerLine: 'You wait.', candidateText: 'You open the [Hidden Vault].' }).ok,
    false, 'bracketed fabrication rejected'
  );
  assert.equal(
    validatePolish({ world: worldProxy, composerLine: 'You wait.', candidateText: 'The location is the Crystal Throne Room.' }).ok,
    false, 'fabricated location claim rejected'
  );
  let log = createCanonLog();
  assert.throws(() => appendCanonEvent(log, { id: 'e1', type: 'update', targetId: 'sword' }), /event type/i);
  log = appendCanonEvent(log, { id: 'e1', type: 'CANON_CREATE', targetId: 'sword' });
  assert.equal(log.events.length, 1, 'allowlisted event is accepted');
});

// U-IMM-007 — clocks move only through the clock delta channel.
test('U-IMM-007: clocks mutate only through clock events', () => {
  const w = fresh('imm007');
  const dread0 = Number(w.clocks?.dread ?? 0);
  const withClock = applyConductDeltas(w, { narration: 'Dread rises.', deltas: { clock: { dread: 1 } } });
  assert.equal(Number(withClock.clocks?.dread ?? 0), dread0 + 1, 'clock delta advances the clock');
  const withoutClock = applyConductDeltas(w, { narration: 'A quiet beat.', deltas: { addFact: 'a calm moment' } });
  assert.equal(Number(withoutClock.clocks?.dread ?? 0), dread0, 'non-clock deltas leave clocks untouched');
});

// U-IMM-008 — once an ending is locked, play surfaces cannot mutate the world.
test('U-IMM-008: ending lock is stable after trigger', () => {
  let w = fresh('imm008');
  w = { ...w, clocks: { ...w.clocks, dread: 8 } };
  w = triggerEnding(w);
  assert.equal(Boolean(w.ending?.locked), true, 'ending should be locked');
  const before = w;
  assert.deepEqual(playerMove(w, packsById, 'I keep going anyway.').world, before, 'playerMove must not mutate after ending');
  assert.deepEqual(newScene(w, packsById).world, before, 'newScene must not mutate after ending');
});
