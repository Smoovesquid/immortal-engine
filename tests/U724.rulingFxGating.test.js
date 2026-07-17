// U724 — RULING-FX-1: the dice still rule, and the proposal cannot leave its lane.
//
// The fx proposal only supplies CONTENT (which deltas, which sentence). The
// engine's outcome machinery still decides application: a failed roll voids
// every proposed delta, a mixed roll strips createItem, and no handler
// outside the offline physics lane (salvage, object-strike, non-physics
// turns) ever consumes a proposal. The record persists whenever the proposal
// was consumed — the ruling is the proposal; the dice decide what it bought.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, newScene, playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';

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

const FX_TEXT = 'I break the crate open.'; // u723-b → failure · u723-c → mixed (probed)

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

function crateState(w) {
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const crate = (node.furniture || []).find(f => f && f.name === 'crate');
  return crate ? { state: crate.state ?? null, notes: crate.notes ?? null } : null;
}

function fxRecordOf(before, after) {
  return after.timeline.slice(before.timeline.length)
    .find(e => e.kind === 'resolution' && e.data?.rulingFx)?.data?.rulingFx ?? null;
}

test('U724-A1: a failed roll voids every proposed delta — the ruling was made, the dice said no', () => {
  const w = boot('u723-b');
  const before = crateState(w);
  const r = playerMove(w, packsById, FX_TEXT, { fxProposal: fxFor(w) });
  assert.match(String(r.output?.mechanics || ''), /failure/, 'fixture guard: this seed must fail the roll');
  assert.ok(!hasSlat(r.world), 'no proposed item on a failed roll');
  assert.deepEqual(crateState(r.world), before, 'no proposed furniture change on a failed roll');
  assert.ok(fxRecordOf(w, r.world), 'the consumed proposal is still recorded (replay re-rolls the same failure)');
});

test('U724-A2: a mixed roll strips createItem but keeps the state change', () => {
  const w = boot('u723-c');
  const r = playerMove(w, packsById, FX_TEXT, { fxProposal: fxFor(w) });
  assert.match(String(r.output?.mechanics || ''), /mixed/, 'fixture guard: this seed must roll mixed');
  assert.ok(!hasSlat(r.world), 'mixed strips the item drop');
  assert.equal(crateState(r.world)?.notes, 'split along the grain', 'mixed keeps the furniture change');
});

test('U724-A3: a failure turn replays hash-identical from its record', () => {
  const w = boot('u723-b');
  const live = playerMove(w, packsById, FX_TEXT, { fxProposal: fxFor(w) }).world;
  let rw = newWorld({ seed: 'u723-b', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  for (const e of live.timeline) {
    const kind = String(e?.kind || '');
    if (kind === 'begin') rw = beginAdventure(rw, packsById).world;
    else if (kind === 'scene') rw = newScene(rw, packsById).world;
    else if (kind === 'resolution' || kind === 'blocked') {
      const opts = {};
      if (e.data?.resolvedIntent?.source === 'llm') opts.llmPacket = e.data.resolvedIntent;
      if (e.data?.rulingFx) opts.fxProposal = e.data.rulingFx;
      rw = playerMove(rw, packsById, String(e.data?.text ?? ''), Object.keys(opts).length ? opts : undefined).world;
    }
  }
  assert.equal(worldHash(rw), worldHash(live));
});

test('U724-B1: handlers outside the offline physics lane never consume a proposal', () => {
  const w = boot('u723-seed');
  // Salvage path claims this phrasing (probed: '[salvage | crate | …]').
  const salvage = playerMove(w, packsById, 'I smash the crate to pieces.', { fxProposal: fxFor(w) });
  assert.match(String(salvage.output?.mechanics || ''), /salvage/, 'fixture guard: salvage owns this text');
  assert.ok(!hasSlat(salvage.world), 'salvage path ignores the proposal');
  assert.equal(fxRecordOf(w, salvage.world), null, 'nothing recorded when nothing consumed');
  // A non-physics turn ignores it entirely and stays byte-identical.
  const looked = playerMove(w, packsById, 'I look around the camp.', { fxProposal: fxFor(w) });
  assert.equal(fxRecordOf(w, looked.world), null);
  assert.equal(worldHash(looked.world), worldHash(playerMove(w, packsById, 'I look around the camp.').world),
    'a stray proposal on a non-physics turn changes nothing');
});
