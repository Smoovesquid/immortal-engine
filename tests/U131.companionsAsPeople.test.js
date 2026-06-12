// U131 / P-78: Companions as people — voice, loyalty, the objection arc.
//
// Tests assert:
//   * loyalty: a witnessed cruelty erodes the companion's trustLevel; a mercy
//     rebuilds it (companions see everything the party does)
//   * interjection: a scene-shaped trigger (combat victory) produces at most
//     ONE line, deterministically (same world → same line)
//   * objection arc: a heavy dark deed (the coerced-labor shape) triggers
//     confrontation; the second, ultimatum; the third — departure, the
//     companion leaves the party and the timeline says so
//   * the most loyal companion is the one who objects
//   * the companion side-quest arc validates, and casts ONLY once a
//     companion travels with the party (requiresCompanion)
//   * no companions → companionPass is a no-op (same world reference)

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { companionPass } from '../engine/npc/companionVoice.js';
import { validateArc } from '../engine/story/registry.js';
import debtArc from '../content/arcs/the_debt_that_walks.arc.js';

function mkWorld(seed) {
  const w = newWorld({ seed, fate: 0.2, campaignId: 'u131', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Hero', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 },
      stats: { MIGHT: 12, AGILITY: 12, WITS: 12, GRIT: 12, CHARM: 12 }
    }]
  });
}

/** Attach a companion directly (marker shape mirrors ensureCompanionMarker). */
function withCompanion(w, { id = 'comp_1', name = 'Maren', trustLevel = 5 } = {}) {
  return ensureWorld({
    ...w,
    party: [...w.party, {
      id, name, vibe: 'steady', archetype: 'companion',
      wounds: 0, stress: 0, resources: {},
      stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 },
      companion: { sourceNpcId: `npc_${id}`, recruitedAtTurn: 0, trustLevel, role: 'laborer' }
    }]
  });
}

function withDeed(w, kind, severity = 2) {
  return applyDeltas(w, [{
    op: 'recordDeed', deedKind: kind, severity, actorId: 'party',
    nodeId: '', summary: `test ${kind}`, witnesses: [], t: w.timeline.length
  }]);
}

const companionOf = (w) => w.party.find(p => p?.companion);

test('U131-01 loyalty moves on witnessed deeds', () => {
  const base = withCompanion(mkWorld('u131-loyal'), { trustLevel: 5 });

  const afterCruelty = companionPass(withDeed(base, 'cruelty', 1), { prevWorld: base, oldCorruption: 0, newCorruption: 0 });
  assert.ok(companionOf(afterCruelty.world).companion.trustLevel < 5, 'cruelty erodes trust');

  const afterMercy = companionPass(withDeed(base, 'mercy', 1), { prevWorld: base, oldCorruption: 0, newCorruption: 0 });
  assert.ok(companionOf(afterMercy.world).companion.trustLevel > 5, 'mercy rebuilds trust');
});

test('U131-02 interjection: one line on a victory, deterministic', () => {
  const base = withCompanion(mkWorld('u131-voice'), { trustLevel: 8 });
  // A victory this turn (timeline event the detector watches for).
  const won = ensureWorld({
    ...base,
    timeline: [...base.timeline, { t: base.timeline.length, kind: 'combat-end', data: { reason: 'combat-victory' } }]
  });

  // Deterministic: identical inputs, identical output — and at most one line.
  const a = companionPass(won, { prevWorld: base, oldCorruption: 0, newCorruption: 0 });
  const b = companionPass(won, { prevWorld: base, oldCorruption: 0, newCorruption: 0 });
  assert.equal(a.line, b.line);
  if (a.line) {
    assert.ok(a.line.includes('Maren'), 'the companion speaks by name');
    assert.equal((a.world.timeline || []).filter(e => e.kind === 'companionInterjection').length, 1);
  }

  // Across many distinct moments, the companion sometimes speaks and
  // sometimes holds their tongue — a person, not a narration faucet.
  let spoke = 0, held = 0;
  for (let i = 0; i < 12; i++) {
    let w = withCompanion(mkWorld(`u131-voice-${i}`), { trustLevel: 8 });
    const prev = w;
    w = ensureWorld({ ...w, timeline: [...w.timeline, { t: w.timeline.length, kind: 'combat-end', data: { reason: 'combat-victory' } }] });
    const out = companionPass(w, { prevWorld: prev, oldCorruption: 0, newCorruption: 0 });
    if (out.line) spoke++; else held++;
  }
  assert.ok(spoke >= 1, 'speaks sometimes');
  assert.ok(held >= 1, 'holds their tongue sometimes');
});

test('U131-03 the objection arc: confrontation → ultimatum → departure, twice ignored', () => {
  let w = withCompanion(mkWorld('u131-object'), { trustLevel: 9 });

  // First heavy dark deed (the coerced-labor build records cruelty at heavy severity).
  let prev = w;
  w = withDeed(w, 'cruelty', 2);
  let out = companionPass(w, { prevWorld: prev, oldCorruption: 0, newCorruption: 0 });
  w = out.world;
  assert.ok(out.line && /stop|didn't follow you/i.test(out.line), `confrontation line (got: ${out.line})`);
  assert.equal(w.timeline.filter(e => e.kind === 'companionObjection').length, 1);
  assert.ok(companionOf(w), 'still travels with you');

  // Second — the ultimatum.
  prev = w;
  w = withDeed(w, 'cruelty', 2);
  out = companionPass(w, { prevWorld: prev, oldCorruption: 0, newCorruption: 0 });
  w = out.world;
  assert.ok(out.line && /warned|once more|gone/i.test(out.line), `ultimatum line (got: ${out.line})`);
  assert.equal(w.timeline.filter(e => e.kind === 'companionObjection').length, 2);
  assert.ok(companionOf(w), 'one last chance');

  // Third — they leave, and the timeline says so.
  prev = w;
  w = withDeed(w, 'cruelty', 2);
  out = companionPass(w, { prevWorld: prev, oldCorruption: 0, newCorruption: 0 });
  w = out.world;
  assert.ok(out.line && /do not look back|walk/i.test(out.line), `departure line (got: ${out.line})`);
  assert.equal(w.timeline.filter(e => e.kind === 'companionLeft').length, 1);
  assert.equal(companionOf(w), undefined, 'the party is smaller now');
  assertWorldInvariants(ensureWorld(w));
});

test('U131-04 a corruption-tier crossing also triggers the objection', () => {
  const w = withCompanion(mkWorld('u131-tier'), { trustLevel: 6 });
  const out = companionPass(w, { prevWorld: w, oldCorruption: 15, newCorruption: 25 });
  assert.ok(out.line, 'crossing 20 draws the objection');
  assert.equal(out.world.timeline.filter(e => e.kind === 'companionObjection').length, 1);
});

test('U131-05 the most loyal companion objects', () => {
  let w = withCompanion(mkWorld('u131-two'), { id: 'comp_a', name: 'Aldous', trustLevel: 3 });
  w = withCompanion(w, { id: 'comp_b', name: 'Ysolde', trustLevel: 9 });
  const out = companionPass(w, { prevWorld: w, oldCorruption: 15, newCorruption: 25 });
  assert.ok(out.line && out.line.includes('Ysolde'), `the one who cares most speaks (got: ${out.line})`);
});

test('U131-06 companion side-quest arc validates and waits for a companion', () => {
  assert.deepEqual(validateArc(debtArc), []);
  assert.equal(debtArc.requiresCompanion, true, 'gated on someone traveling with you');
});

test('U131-07 no companions → no-op (same reference)', () => {
  const w = mkWorld('u131-solo');
  const out = companionPass(w, { prevWorld: w, oldCorruption: 0, newCorruption: 50 });
  assert.equal(out.world, w);
  assert.equal(out.line, null);
});
