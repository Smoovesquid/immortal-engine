// U133 — the common-knowledge tier (follow-up to U132's stickiness fix).
// A conversation that SURVIVES must also be worth having: any villager
// answers their own name, their village, the roads out, and the news they
// carry — without a check, without trust-farming, without a menu. The
// knowledge graph (personal facts, secrets, trust gates) outranks this tier;
// deflection remains the floor for things they genuinely wouldn't know.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { commonKnowledgeAnswer } from '../engine/npc/dialogue.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

function openDialogue(seed = 'u133') {
  const w0 = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u133-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  const outside = playerMove(w0, packs, 'go outside').world;
  const here = outside.map.nodes.find(n => n.id === outside.map.currentNodeId);
  const npc = (here?.settlement?.npcs || []).find(n => n && n.name && !n.hostile);
  const opened = playerMove(outside, packs, `talk to ${npc.name}`);
  assert.ok(opened.world.scene?.dialogue, 'dialogue opens');
  return { base: opened.world, npc, here };
}
const { base, npc, here } = openDialogue();

test('U133-01: they know their own name — and say it', () => {
  const r = playerMove(base, packs, "what's your name?");
  assert.match(r.output.mechanics, /dialogue ask \| self/);
  assert.ok(r.output.narration.includes(npc.name), 'the name is in the answer');
  assert.ok(r.world.scene?.dialogue, 'and the conversation continues');
});

test('U133-02: they know the ground under their feet', () => {
  const r = playerMove(base, packs, 'tell me about this place');
  assert.match(r.output.mechanics, /dialogue ask \| place/);
  assert.ok(r.output.narration.includes(here.name), 'names the settlement');
});

test('U133-03: they know the roads — real bearings to real places', () => {
  // WAYFINDING ("way to / next town") still earns a compass bearing.
  const r = playerMove(base, packs, 'do you know the way to the next town?');
  assert.match(r.output.mechanics, /dialogue ask \| directions/);
  assert.match(r.output.narration, /\b(north|south|east|west)\b/i, 'a compass bearing');
  // PW-5: "what do you know about <named place>" is a LORE ask, not wayfinding —
  // a local recounts that place's grounded founding (common_lore) rather than
  // just pointing (the audit's F1 win). The place is still named in the answer.
  // (A named place with NO grounded lore would fall back to a directions bearing.)
  const named = base.map.nodes.find(n => n.id !== here.id && n.name);
  const r2 = playerMove(base, packs, `what do you know about ${named.name}?`);
  assert.match(r2.output.mechanics, /dialogue ask \| common_lore/);
  assert.ok(r2.output.narration.includes(named.name), 'names the place it recounts');
});

test('U133-04: news surfaces a rumor they carry; quiet is honest when they have none', () => {
  // no rumors on this seed's NPC → the honest quiet line, not deflection prose
  const dry = playerMove(base, packs, 'got any news?');
  assert.match(dry.output.mechanics, /dialogue ask \| news/);
  assert.match(dry.output.narration, /quiet/i);
  assert.ok(!/Couldn't say/.test(dry.output.narration), 'not the deflection line');
  // plant a rumor on the NPC → it surfaces verbatim
  // tier 2: at default trust (5) the layer only surfaces garbled-tier rumors —
  // precise tier-0/1 word waits for trust ≥ 7 (perspectiveFilter design).
  const rumor = { id: 'ru_test', sourceSeedId: 'seed_test', carrierNpcId: String(npc.id), body: 'someone has been buying lamp oil by the barrel', tier: 2, age: 0, hopCount: 1, tags: ['oil'] };
  const planted = ensureWorld({
    ...base,
    rumors: [...(base.rumors || []), rumor],
    map: {
      ...base.map,
      nodes: base.map.nodes.map(n => n.id !== here.id ? n : {
        ...n,
        settlement: { ...n.settlement, npcs: n.settlement.npcs.map(x => x.id === npc.id ? { ...x, rumorIds: ['ru_test'] } : x) }
      })
    }
  });
  const wet = playerMove(planted, packs, 'heard anything strange lately?');
  assert.match(wet.output.mechanics, /dialogue ask \| news/);
  assert.match(wet.output.narration, /lamp oil by the barrel/, 'the rumor itself is spoken');
});

test('U133-05: common knowledge does not farm trust and mints no memories', () => {
  let w = base;
  for (let i = 0; i < 3; i++) w = playerMove(w, packs, 'hello').world;
  const after = (w.map.nodes.find(n => n.id === here.id).settlement.npcs).find(x => x.id === npc.id);
  assert.equal(Number(after.conversationState.trustLevel), Number(npc.conversationState?.trustLevel ?? 5), 'three hellos buy no trust');
  const mem = Array.isArray(after.memories) ? after.memories.length : 0;
  const before = Array.isArray(npc.memories) ? npc.memories.length : 0;
  assert.equal(mem, before, 'no memories minted for pleasantries');
});

test('U133-06: the knowledge graph outranks common knowledge', () => {
  // "neighbors" matches a real knowledge-graph fact on this seed — it must
  // stay a shared/deflected PERSONAL exchange, not a generic place answer.
  const r = playerMove(base, packs, 'what do you think of the neighbors?');
  assert.match(r.output.mechanics, /dialogue ask \| (shared|deflected|withheld|lied)/);
});

test('U133-07: deflection is still the floor for the genuinely unknown', () => {
  const r = playerMove(base, packs, 'what is the airspeed of an unladen swallow?');
  assert.match(r.output.mechanics, /dialogue ask \| deflected/);
  assert.ok(r.world.scene?.dialogue, 'still talking, though');
});

test('U133-08: deterministic — same question, same answer; invariants hold', () => {
  const a = playerMove(base, packs, 'tell me about this place');
  const b = playerMove(base, packs, 'tell me about this place');
  assert.equal(a.output.narration, b.output.narration);
  assertWorldInvariants(a.world);
});
