// U134 — NPC voice: they reply in their personality (Tim, 2026-06-12).
// Voice derives purely from the personality floats every NPC already carries
// (trustOfOutsiders → warmth, selfPreservation → nerve): no new state, no
// version bump, deterministic forever. The dominant leaning picks the manner;
// the manner picks the prose — so a guarded clerk and an open farmhand dodge
// the same question in different words, and a village never speaks in one
// shared stock voice.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { npcVoice, voiceManner } from '../engine/npc/dialogue.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

const mk = (personality) => ({ id: 'x', name: 'X', role: 'laborer', personality });

test('U134-01: manner derives from the dominant personality leaning', () => {
  assert.equal(voiceManner(npcVoice(mk({ trustOfOutsiders: 0.9, selfPreservation: 0.5 }))), 'open');
  assert.equal(voiceManner(npcVoice(mk({ trustOfOutsiders: 0.1, selfPreservation: 0.5 }))), 'guarded');
  assert.equal(voiceManner(npcVoice(mk({ trustOfOutsiders: 0.5, selfPreservation: 0.9 }))), 'skittish');
  assert.equal(voiceManner(npcVoice(mk({ trustOfOutsiders: 0.5, selfPreservation: 0.1 }))), 'blunt');
  assert.equal(voiceManner(npcVoice(mk({ trustOfOutsiders: 0.51, selfPreservation: 0.49 }))), 'even');
  // the larger leaning wins when both lean
  assert.equal(voiceManner(npcVoice(mk({ trustOfOutsiders: 0.4, selfPreservation: 0.9 }))), 'skittish');
});

function villageWithVoices(seed = 'u134') {
  const w0 = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u134-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  const outside = playerMove(w0, packs, 'go outside').world;
  const hereId = outside.map.currentNodeId;
  // Plant two extreme personalities so the contrast is guaranteed on any seed.
  const planted = {
    ...outside,
    map: {
      ...outside.map,
      nodes: outside.map.nodes.map(n => n.id !== hereId ? n : {
        ...n,
        settlement: {
          ...n.settlement,
          npcs: n.settlement.npcs.map((x, i) => {
            if (i === 0) return { ...x, personality: { ...x.personality, trustOfOutsiders: 0.05, selfPreservation: 0.5 } };  // guarded
            if (i === 1) return { ...x, personality: { ...x.personality, trustOfOutsiders: 0.95, selfPreservation: 0.5 } };  // open
            return x;
          })
        }
      })
    }
  };
  const here = planted.map.nodes.find(n => n.id === hereId);
  const [guarded, open] = here.settlement.npcs;
  return { planted, guarded, open };
}
const { planted, guarded, open } = villageWithVoices();

test('U134-02: two villagers dodge the same question in different words', () => {
  const ask = (npc) => {
    const opened = playerMove(planted, packs, `talk to ${npc.name}`);
    assert.ok(opened.world.scene?.dialogue, `dialogue opens with ${npc.name}`);
    return playerMove(opened.world, packs, 'what is the airspeed of an unladen swallow?');
  };
  const a = ask(guarded);
  const b = ask(open);
  assert.match(a.output.mechanics, /dialogue ask \| deflected/);
  assert.match(b.output.mechanics, /dialogue ask \| deflected/);
  const aLine = a.output.narration.replace(guarded.name, 'NPC');
  const bLine = b.output.narration.replace(open.name, 'NPC');
  assert.notEqual(aLine, bLine, 'same dodge, different voices');
});

test('U134-03: greetings, news, and the meeting itself carry the manner', () => {
  const openHello = playerMove(playerMove(planted, packs, `talk to ${open.name}`).world, packs, 'hello');
  const guardHello = playerMove(playerMove(planted, packs, `talk to ${guarded.name}`).world, packs, 'hello');
  assert.notEqual(
    openHello.output.narration.replace(open.name, 'NPC'),
    guardHello.output.narration.replace(guarded.name, 'NPC'),
    'a warm hello and a cold one'
  );
  const openMeet = playerMove(planted, packs, `talk to ${open.name}`);
  assert.match(openMeet.output.narration, /already half-smiling/, 'the first impression is the personality');
  const guardMeet = playerMove(planted, packs, `talk to ${guarded.name}`);
  assert.match(guardMeet.output.narration, /don't step closer/, 'and so is the cold shoulder');
  const news = playerMove(playerMove(planted, packs, `talk to ${guarded.name}`).world, packs, 'any news?');
  assert.match(news.output.mechanics, /dialogue ask \| news/);
  assert.match(news.output.narration, /wouldn't be the one spreading it/i, 'guarded quiet-line, not stock');
});

test('U134-04: voice is stable — same NPC, same manner, same words, every time', () => {
  const once = playerMove(playerMove(planted, packs, `talk to ${guarded.name}`).world, packs, 'hello');
  const twice = playerMove(playerMove(planted, packs, `talk to ${guarded.name}`).world, packs, 'hello');
  assert.equal(once.output.narration, twice.output.narration);
  assertWorldInvariants(once.world);
});

test('U134-05: a real village is not a chorus — manners vary across seeds', () => {
  const seen = new Set();
  for (const seed of ['u134a', 'u134b', 'u134c']) {
    const w0 = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: seed, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
    const w = playerMove(w0, packs, 'go outside').world;
    const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
    for (const npc of (here.settlement?.npcs || [])) {
      if (npc && !npc.hostile) seen.add(voiceManner(npcVoice(npc)));
    }
  }
  assert.ok(seen.size >= 3, `at least three manners across villages (saw: ${[...seen].join(', ')})`);
});
