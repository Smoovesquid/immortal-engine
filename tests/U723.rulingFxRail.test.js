// U723 — RULING-FX-1: the consequence-proposal rail.
//
// A grounded fx proposal (sealed-vocabulary deltas + census-taker description)
// replaces WHAT the offline template says happens on a physics turn; the
// engine keeps everything that decides WHETHER it happens (seeded roll,
// outcome gating, noise, applyDeltas). The consumed proposal is recorded on
// the resolution event (data.rulingFx) and replay feeds the record back —
// zero model calls. One illegal op voids the whole proposal (Invariant 22,
// all-or-nothing) and the template stands untouched.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, newScene, playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { groundFxProposal } from '../engine/llmPhysics.js';

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

// Same text, three seeds, three deterministic outcomes (probed):
// u723-seed → success · u723-b → failure · u723-c → mixed.
const FX_TEXT = 'I break the crate open.';

function boot(seed) {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const begun = beginAdventure(w0, packsById).world;
  return newScene(begun, packsById).world;
}

function crateIndex(w) {
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  return (node.furniture || []).findIndex(f => f && f.name === 'crate');
}

function fxFor(w) {
  const nodeId = w.map.currentNodeId;
  const entityId = String(w.party[0].id);
  return {
    plausible: true,
    deltas: [
      { op: 'modifyFurniture', nodeId, furnitureId: crateIndex(w), changes: { state: 'damaged', notes: 'split along the grain' } },
      { op: 'createItem', entityId, bucket: 'junk', item: { name: 'Splintered crate slat', tags: ['wood'], weight: 1, noise: 0, light: 0, bulk: 1 } }
    ],
    result: 'The crate splits along the grain, one slat coming free.'
  };
}

function hasSlat(w) {
  return (w.party?.[0]?.inventory?.junk || []).some(i => String(i?.name) === 'Splintered crate slat');
}

function fxRecordOf(before, after) {
  return after.timeline.slice(before.timeline.length)
    .find(e => e.kind === 'resolution' && e.data?.rulingFx)?.data?.rulingFx ?? null;
}

function stripRecords(world) {
  return {
    ...world,
    timeline: world.timeline.map(e => {
      if (!e.data?.resolvedIntent && !e.data?.rulingFx) return e;
      const { resolvedIntent, rulingFx, ...rest } = e.data;
      return { ...e, data: rest };
    })
  };
}

function replayFromTimeline(seedWorld, packs) {
  const seed = String(seedWorld.meta.seed);
  const fate = Number(seedWorld.meta.fate);
  const campaignId = String(seedWorld.meta.campaignId);
  const pack = { primaryId: seedWorld.pack.primaryId, mixerId: seedWorld.pack.mixerId ?? null };
  let w = newWorld({ seed, fate, campaignId, pack });
  for (const e of (seedWorld.timeline || [])) {
    const kind = String(e?.kind || '');
    if (kind === 'begin') w = beginAdventure(w, packs).world;
    else if (kind === 'scene') w = newScene(w, packs).world;
    else if (kind === 'resolution' || kind === 'blocked') {
      const txt = String(e?.data?.text ?? e?.data?.intent ?? '');
      const ri = e?.data?.resolvedIntent;
      const opts = {};
      if (ri && ri.source === 'llm') opts.llmPacket = ri;
      if (e?.data?.rulingFx) opts.fxProposal = e.data.rulingFx;
      w = playerMove(w, packs, txt, Object.keys(opts).length ? opts : undefined).world;
    }
  }
  return w;
}

// ---------------------------------------------------------------------------
// A — a grounded proposal replaces the template content and is recorded
// ---------------------------------------------------------------------------

test('U723-A1: on a success turn the proposal deltas/description become canon and data.rulingFx records them', () => {
  const w = boot('u723-seed');
  const fx = fxFor(w);
  const live = playerMove(w, packsById, FX_TEXT, { fxProposal: fx }).world;
  assert.ok(hasSlat(live), 'the proposed item is real in inventory');
  const rec = fxRecordOf(w, live);
  assert.ok(rec, 'the consumed proposal is recorded on the resolution event');
  assert.equal(rec.v, 1);
  assert.equal(rec.description, fx.result);
  assert.equal(rec.deltas.length, 2, 'the PRE-FILTER grounded set is recorded');

  const plain = playerMove(w, packsById, FX_TEXT).world;
  assert.ok(!hasSlat(plain), 'the template would never mint the proposed item');
  assert.notEqual(worldHash(stripRecords(live)), worldHash(stripRecords(plain)),
    'the proposal changes OUTCOME canon, not just the record');
});

// ---------------------------------------------------------------------------
// B — replay: the record replays hash-identical; stripping it loses the ruling
// ---------------------------------------------------------------------------

test('U723-B1: replay-from-record reproduces the fx world exactly; a stripped save falls back to the template', () => {
  const w = boot('u723-seed');
  let live = playerMove(w, packsById, FX_TEXT, { fxProposal: fxFor(w) }).world;
  live = playerMove(live, packsById, 'I look around the camp.').world;

  assert.equal(worldHash(replayFromTimeline(live, packsById)), worldHash(live),
    'replay-from-record is hash-identical with zero model calls');

  const stripped = stripRecords(live);
  const rawReplay = replayFromTimeline(stripped, packsById);
  assert.ok(!hasSlat(rawReplay), 'without the record, the template rules again');
  assert.notEqual(worldHash(stripRecords(rawReplay)), worldHash(stripRecords(live)),
    'raw-text replay cannot reproduce the fx outcome (anti-vacuity guard)');
});

// ---------------------------------------------------------------------------
// C — all-or-nothing: one illegal op or word voids the whole proposal
// ---------------------------------------------------------------------------

test('U723-C1: one op outside the object vocabulary voids the batch — template stands, nothing recorded', () => {
  const w = boot('u723-seed');
  const fx = fxFor(w);
  fx.deltas.push({ op: 'env', key: 'noise', by: 2 });
  const live = playerMove(w, packsById, FX_TEXT, { fxProposal: fx }).world;
  assert.ok(!hasSlat(live), 'no proposed delta may survive a poisoned batch');
  assert.equal(fxRecordOf(w, live), null, 'a rejected proposal is never recorded');
  const plain = playerMove(w, packsById, FX_TEXT).world;
  assert.equal(worldHash(live), worldHash(plain), 'a rejected proposal leaves the turn byte-identical to template play');
});

test('U723-C2: a banned drama word, an unreal target, or a false plausible all die at grounding', () => {
  const w = boot('u723-seed');
  const base = fxFor(w);
  const cases = [
    { ...base, result: 'Suddenly the crate explodes dramatically.' },
    { ...base, deltas: [{ op: 'removeItem', entityId: String(w.party[0].id), bucket: 'junk', itemName: 'No Such Thing' }] },
    { ...base, plausible: false },
    { ...base, deltas: 'not-an-array' },
    null,
    'string'
  ];
  for (const bad of cases) {
    assert.equal(groundFxProposal(w, bad), null, `must reject: ${JSON.stringify(bad)?.slice(0, 60)}`);
  }
  assert.ok(groundFxProposal(w, base), 'the clean base proposal grounds (guard against a vacuous loop)');
});
