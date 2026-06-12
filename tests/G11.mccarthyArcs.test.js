// G11 — The McCarthy arcs (Blood Meridian-toned storyline content).
//
// Three arcs join The Cold Well: the-judge-passes (an encounter with a
// doctrine), the-wages-of-blood (the scalp economy; the offer is the dark
// path), what-the-fire-left (witness as deed). Per the McCarthy law in
// docs/MORALITY_SYSTEM.md: evil arrives cold and flat — weight and
// consequence, never spectacle. No arc gamifies the violence.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { getArcs, validateArc } from '../engine/story/registry.js';
import { castArcs } from '../engine/story/storyEngine.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';
import theJudge from '../content/arcs/the_judge_passes.arc.js';
import theWages from '../content/arcs/the_wages_of_blood.arc.js';
import theFire from '../content/arcs/what_the_fire_left.arc.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `g11-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;

// Materialize two extra settlements so dormant arcs can find their casts —
// the headless stand-in for "the player traveled there".
function withCounty(seed) {
  let w = begin(seed);
  for (const t of w.map.nodes.filter(n => n.nodeType === 'settlement' && n.id !== w.map.currentNodeId).slice(0, 2)) {
    w = decompressAndCanonizeSync(w, t.id, packs.fantasy);
  }
  return castArcs(w);
}

const npcOf = (w, arcId, role) => {
  const ref = String(w.story?.arcs?.[arcId]?.castIds?.[role] || '');
  const [npcId, nodeId] = ref.split('@');
  const node = w.map.nodes.find(n => n.id === nodeId);
  return { npc: node?.settlement?.npcs?.find(n => String(n.id) === npcId) || null, nodeId };
};

test('G11-01: all three McCarthy arcs validate and load (6 arcs total)', () => {
  for (const a of [theJudge, theWages, theFire]) assert.deepEqual(validateArc(a), [], a.arc);
  const ids = getArcs().map(a => a.arc);
  assert.deepEqual(ids, ['the-cold-well', 'what-the-fire-left', 'the-judge-passes', 'the-wages-of-blood', 'the-named-dark', 'the-debt-that-walks']);
});

test('G11-02: on a materialized county every arc casts, with no shared NPCs', () => {
  let anyAllCast = 0;
  for (const seed of ['bm0', 'bm5', 'bm7']) {
    const w = withCounty(seed);
    assertWorldInvariants(w);
    const states = Object.values(w.story.arcs);
    const refs = states.flatMap(a => Object.values(a.castIds || {}));
    assert.equal(new Set(refs).size, refs.length, `${seed}: an NPC stars in two arcs`);
    if (states.every(a => a.status === 'cast')) anyAllCast++;
    // every cast arc's hook rumor exists and is carried
    for (const [id, st] of Object.entries(w.story.arcs)) {
      if (st.status !== 'cast') continue;
      const rumor = w.rumors.find(r => r.id === `rumor:arc:${id}:0`);
      assert.ok(rumor, `${seed}/${id}: hook rumor`);
      assert.ok(!/\{home\}|\{carrier\}/.test(rumor.body), `${seed}/${id}: template filled`);
    }
  }
  assert.ok(anyAllCast >= 2, 'all four arcs should cast on most county-materialized seeds');
});

test('G11-03: the Judge arc walks end to end — two testimonies, no fight, no reward', () => {
  // Find a seed where both Judge roles cast at the player's starting node.
  let w = null, witness = null, judge = null;
  for (let i = 0; i < 30 && !w; i++) {
    const cand = withCounty(`gj${i}`);
    const st = cand.story.arcs['the-judge-passes'];
    if (st?.status !== 'cast') continue;
    const a = npcOf(cand, 'the-judge-passes', 'the-witness');
    const b = npcOf(cand, 'the-judge-passes', 'the-judge');
    if (a.nodeId === cand.map.currentNodeId && b.nodeId === cand.map.currentNodeId && a.npc && b.npc) {
      w = cand; witness = a.npc; judge = b.npc;
    }
  }
  assert.ok(w, 'no seed cast both Judge roles at the start node (binds too narrow?)');

  let r = playerMove(w, packs, `Hello ${witness.name}`);
  r = playerMove(r.world, packs, 'Tell me about the pale stranger and his ledger');
  assert.match(String(r.output.mechanics), /shared \| pale_stranger_ledger/);
  // authored testimony is spoken VERBATIM — no template paraphrase
  assert.match(String(r.output.narration), /drew a wren in his book, exact to the feather/);
  assert.equal(r.world.story.arcs['the-judge-passes'].stage, 'sit-with-him');

  r = playerMove(r.world, packs, 'goodbye');
  r = playerMove(r.world, packs, `Hello ${judge.name}`);
  r = playerMove(r.world, packs, 'Ask about the war and his doctrine');
  assert.match(String(r.output.mechanics), /shared \| judge_doctrine_war/);

  const st = r.world.story.arcs['the-judge-passes'];
  assert.equal(st.status, 'resolved');
  // an encounter with a doctrine: no deed written, no XP, no loot — only talk
  assert.ok(!r.world.deeds.some(d => /ledger|judge/i.test(d.summary)), 'no deed for witnessing the Judge');
  const res = r.world.rumors.find(x => x.id === 'rumor:arc:the-judge-passes:91');
  assert.ok(res && /never die/.test(res.body), 'the county repeats what he said');
  assertWorldInvariants(r.world);
});

test('G11-04: abandonment voices are McCarthy-cold — each arc ends without the player', () => {
  for (const a of [theJudge, theWages, theFire]) {
    assert.ok(a.abandonment.afterDays > 0, a.arc);
    assert.ok(a.abandonment.rumor.length > 40, `${a.arc}: abandonment rumor must carry weight`);
    // the law: no gratification — no exclamation marks in the dark beats
    assert.ok(!/!/.test(a.abandonment.rumor), `${a.arc}: abandonment stays flat`);
  }
});

test('G11-05: the wages arc resolves in the meeting, not in a kill count', () => {
  const last = theWages.stages[theWages.stages.length - 1];
  assert.deepEqual(Object.keys(last.doneWhen), ['learned'], 'resolution is hearing the terms');
  assert.deepEqual(last.branches.default.deeds, [], 'no deed for hearing an offer — what you do after is judged like any other act');
});
