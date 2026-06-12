// U129 / P-74b: The Adversary — reaction loop in worldTick.
//
// Tests assert:
//   * worldTick lazily mints the villain (idempotent) and advances the agenda
//     on its clock — a long headless run climbs stages, with villainStage
//     events on the timeline
//   * stage changes mint a rumor AND a ledger threat (the county feels it)
//   * goal completions accelerate the agenda (villainAdapts — reaction #1)
//   * crossing an M4 corruption tier triggers ONE recruitment overture per
//     tier (villainOverture + rumor + threat — reaction #2)
//   * a defeated villain stops moving
//   * rumor-first law: nothing minted (events, rumors, threats) names the villain
//   * determinism: same seed + same play → identical villain state and rumors

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { worldTick } from '../engine/worldTick.js';
import { VILLAIN_STAGE_COST } from '../engine/story/villain.js';

function mkWorld(seed) {
  const w = newWorld({ seed, fate: 0.2, campaignId: 'u129', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Hero', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 },
      stats: { MIGHT: 12, AGILITY: 12, WITS: 12, GRIT: 12, CHARM: 12 }
    }]
  });
}

function withCorruption(w, corruption) {
  return ensureWorld({
    ...w,
    party: [{ ...w.party[0], morality: { ...w.party[0].morality, corruption } }, ...w.party.slice(1)]
  });
}

function tickN(w, n) {
  for (let i = 0; i < n; i++) w = worldTick(w);
  return w;
}

function eventsOf(w, kind) {
  return (w.timeline || []).filter(e => e?.kind === kind);
}

test('U129-01 worldTick mints the villain and the agenda advances over a long run', () => {
  let w = mkWorld('u129-run');
  assert.equal(w.villain, null, 'no villain before the first tick');
  w = worldTick(w);
  assert.ok(w.villain, 'first tick mints');
  assert.equal(w.villain.agenda.stage, 0);

  w = tickN(w, 199);
  assert.ok(w.villain.agenda.stage >= 2, `200 ticks should climb stages (got ${w.villain.agenda.stage})`);
  const stageEvents = eventsOf(w, 'villainStage');
  assert.equal(stageEvents.length, w.villain.agenda.stage, 'one villainStage event per advance');
});

test('U129-02 stage change mints a rumor and a ledger threat', () => {
  let w = tickN(mkWorld('u129-stage'), VILLAIN_STAGE_COST + 2);
  assert.ok(w.villain.agenda.stage >= 1, 'agenda advanced');
  const sign = w.villain.agenda.stages[1].sign;
  assert.ok(w.rumors.some(r => r.tags.includes('villain') && r.body === sign), 'stage rumor minted');
  assert.ok(w.ledger.threats.some(t => t.text.includes(sign.slice(0, 40))), 'stage threat on the ledger');
});

test('U129-03 goal completions accelerate the agenda', () => {
  const seed = 'u129-goals';
  // Control: no goals.
  const control = tickN(mkWorld(seed), 12);
  // Played: same world, but goals complete along the way.
  let played = mkWorld(seed);
  for (let i = 0; i < 12; i++) {
    if (i === 3 || i === 6) {
      played = { ...played, timeline: [...played.timeline, { t: played.timeline.length, kind: 'goalCompleted', data: { goalId: `g${i}`, kind: 'reach', targetRef: 'x' } }] };
    }
    played = worldTick(played);
  }
  assert.ok(played.villain.agenda.clock > control.villain.agenda.clock || played.villain.agenda.stage > control.villain.agenda.stage,
    'completed goals feed the villain clock');
  assert.equal(eventsOf(played, 'villainAdapts').length, 2, 'one adapt reaction per goal batch');
  assert.equal(eventsOf(control, 'villainAdapts').length, 0);
});

test('U129-04 corruption tier crossing triggers exactly one overture per tier', () => {
  let w = tickN(mkWorld('u129-dark'), 2);
  assert.equal(eventsOf(w, 'villainOverture').length, 0, 'no overture while clean');

  // Cross the first M4 threshold (corruption 20).
  w = withCorruption(w, 25);
  w = worldTick(w);
  assert.equal(eventsOf(w, 'villainOverture').length, 1, 'overture on crossing');
  assert.ok(w.rumors.some(r => r.tags.includes('overture')), 'overture rumor minted');

  w = tickN(w, 3);
  assert.equal(eventsOf(w, 'villainOverture').length, 1, 'never repeats within the tier');

  // Cross the second threshold (40).
  w = withCorruption(w, 45);
  w = worldTick(w);
  assert.equal(eventsOf(w, 'villainOverture').length, 2, 'next tier, next overture');
});

test('U129-05 a defeated villain stops moving', () => {
  let w = tickN(mkWorld('u129-dead'), 3);
  const frozen = { ...w.villain, defeated: true };
  w = ensureWorld({ ...w, villain: frozen });
  const before = w.villain.agenda.clock;
  w = tickN(w, 5);
  assert.equal(w.villain.agenda.clock, before, 'clock holds after defeat');
});

test('U129-06 rumor-first law: nothing minted names the villain', () => {
  let w = mkWorld('u129-law');
  w = withCorruption(w, 65);
  w = tickN(w, VILLAIN_STAGE_COST * 2 + 4);
  const name = w.villain.name;
  const epithet = w.villain.epithet;
  assert.ok(w.villain.agenda.stage >= 1 && eventsOf(w, 'villainOverture').length >= 1, 'both mint paths exercised');
  for (const r of w.rumors.filter(r => r.tags.includes('villain'))) {
    assert.ok(!r.body.includes(name) && !r.body.includes(epithet), `rumor must not name: ${r.body}`);
  }
  for (const t of w.ledger.threats) {
    assert.ok(!t.text.includes(name), `threat must not name: ${t.text}`);
  }
  for (const e of [...eventsOf(w, 'villainStage'), ...eventsOf(w, 'villainAdapts'), ...eventsOf(w, 'villainOverture')]) {
    assert.ok(!JSON.stringify(e.data).includes(name), 'timeline data must not name');
  }
});

test('U129-07 determinism: same seed + same play → identical villain and rumors', () => {
  const run = () => {
    let w = mkWorld('u129-det');
    w = tickN(w, 40);
    return JSON.stringify({ v: w.villain, r: w.rumors.filter(r => r.tags.includes('villain')) });
  };
  assert.equal(run(), run());
});
