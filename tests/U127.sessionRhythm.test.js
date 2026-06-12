// U127 — P-79 session rhythm: recap on resume, the cliffhanger hook, and
// downtime verbs. A great DM opens with "previously…" and ends on the thing
// that has not finished happening; between adventures, weeks pass and pay
// one concrete outcome each.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { buildRecap } from '../engine/composer.js';
import { markResume, exportWorld, importWorld } from '../engine/save.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { getItemDef } from '../engine/ruleset/core/items/index.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u127-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;

function pushTl(w, kind, data) {
  return { ...w, timeline: [...w.timeline, { t: w.timeline.length, kind, data }] };
}

test('U127-01: a world too young has no past — recap is null', () => {
  const w = newWorld({ seed: 'u127a', campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  assert.equal(buildRecap(w, { getItemDef }), null);
});

test('U127-02: the recap names the deeds and closes on the hottest threat', () => {
  let w = begin('u127b');
  const dest = w.map.nodes.find(n => n.id !== w.map.currentNodeId && n.name);
  w = pushTl(w, 'travel', { from: 'x', to: dest.id, intent: 'go' });
  w = pushTl(w, 'identify', { defRef: 'greyfang', via: 'check' });
  w = pushTl(w, 'build', { plan: 'lean-to', labor: 'solo' });
  w = applyDeltas(w, [
    { op: 'ledger', addThreat: 'the gravekeeper has stopped answering his door', level: 2 },
    { op: 'ledger', addThreat: 'something follows you between towns', level: 4 }
  ]);
  const recap = buildRecap(w, { getItemDef });
  assert.ok(recap, 'a past produces a recap');
  assert.match(recap, /When the candle last burned/);
  assert.match(recap, new RegExp(dest.name), 'names where you went');
  assert.match(recap, /Greyfang/, 'names what you learned');
  assert.match(recap, /lean.to/i, 'names what you raised');
  assert.match(recap, /something follows you between towns/, 'closes on the HOTTEST threat');
  assert.equal(buildRecap(w, { getItemDef }), recap, 'deterministic');
});

test('U127-03: the resume stamp bounds the recap — last session only', () => {
  let w = begin('u127c');
  w = pushTl(w, 'build', { plan: 'palisade', labor: 'solo' });
  w = markResume(w);
  const dest = w.map.nodes.find(n => n.id !== w.map.currentNodeId && n.name);
  w = pushTl(w, 'travel', { from: 'x', to: dest.id, intent: 'go' });
  const recap = buildRecap(w, { getItemDef });
  assert.ok(recap.includes(dest.name), 'this session is in');
  assert.ok(!/palisade/.test(recap), 'last session is not');
  // and the stamp itself round-trips a save
  const back = importWorld(exportWorld(w));
  assert.ok(back.timeline.some(e => e.kind === 'sessionResume'));
  assertWorldInvariants(back);
});

test('U127-04: a week of research passes seven days and lands one concrete fact', () => {
  const w = begin('u127d');
  const h0 = w.time.hours;
  const facts0 = (w.ledger?.facts || []).length;
  const r = playerMove(w, packs, 'I spend a week researching the old shrine');
  assert.match(r.output.mechanics, /downtime \| research \| 7d \| fact/);
  assert.equal(r.world.time.hours, h0 + 168, 'seven days passed');
  const facts = r.world.ledger.facts;
  assert.ok(facts.length > facts0 || facts.some(f => /research:/.test(f.text)), 'a fact landed');
  assert.ok(facts.some(f => /research:.*shrine|research:/.test(f.text)), 'and it is the research');
  assert.match(r.output.narration, /world did not wait/i);
  // deterministic
  const again = playerMove(w, packs, 'I spend a week researching the old shrine');
  assert.equal(again.output.narration, r.output.narration);
  assertWorldInvariants(r.world);
});

test('U127-05: training banks an edge for the next contested moment', () => {
  const w = begin('u127e');
  const r = playerMove(w, packs, 'I spend a week training with the blade');
  assert.match(r.output.mechanics, /downtime \| training \| 7d \| advantage\+1/);
  const pcId = r.world.party[0].id;
  assert.ok((r.world.meta.advantageTokens?.[pcId] || 0) >= 1, 'advantage banked');
  assert.equal(r.world.time.hours, w.time.hours + 168);
});

test('U127-06: carousing needs a settlement — and pays a contact plus a question', () => {
  const w = begin('u127f'); // begin worlds start at a settlement
  const q0 = (w.ledger?.questions || []).length;
  const r = playerMove(w, packs, 'I spend a few days carousing in the tavern');
  assert.match(r.output.mechanics, /downtime \| carousing \| 3d/);
  assert.ok((r.world.ledger.questions || []).length > q0 || (r.world.ledger.questions || []).some(q => /tavern talk/.test(q.text)), 'a question worth asking');
  // out in the wild: honest refusal, no time lost
  const wild = { ...w, map: { ...w.map, currentNodeId: w.map.nodes.find(n => n.nodeType !== 'settlement').id } };
  const no = playerMove(wild, packs, 'I spend a few days carousing');
  assert.match(no.output.mechanics, /downtime:no-tavern/);
  assert.equal(no.world.time.hours, w.time.hours, 'the wind buys no rounds and costs no days');
});

test('U127-07: "spend a week raising a palisade" is construction, not downtime', () => {
  const w = begin('u127g');
  const r = playerMove(w, packs, 'I spend a week raising a palisade');
  assert.match(r.output.mechanics, /build/, 'tryBuild claims it first');
  assert.ok(!/downtime/.test(r.output.mechanics));
});

test('U127-08: downtime is canon — the timeline records it and the recap can say so', () => {
  const w = begin('u127h');
  const r = playerMove(w, packs, 'I spend a week training');
  assert.ok(r.world.timeline.some(e => e.kind === 'downtime' && e.data.verb === 'training'));
  const recap = buildRecap(r.world, { getItemDef });
  assert.match(recap, /a week to training/);
});
