// U132 — dialogue stickiness (Tim's playtest bug, 2026-06-12).
// A conversation must SURVIVE conversation. The old breaking-intent gate
// ejected the player for saying "what's your name?" (apostrophe makes the
// trailing "s" read as the compass south), "is the road north safe?"
// (direction as a noun), and "take care of yourself" ("take" as a physics
// verb) — and the ejection was SILENT: the reply fell through and was
// d20-adjudicated as a world action. THE DM TEST: a real DM doesn't hang up
// because you used a word; and when you DO walk off mid-talk, the DM says so.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

// One world, one open conversation, reused across cases (playerMove is pure).
function openDialogue(seed = 'u132') {
  const w0 = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u132-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  const outside = playerMove(w0, packs, 'go outside').world;
  const here = outside.map.nodes.find(n => n.id === outside.map.currentNodeId);
  const npc = (here?.settlement?.npcs || []).find(n => n && n.name && !n.hostile);
  assert.ok(npc, 'an NPC lives at the start node');
  const opened = playerMove(outside, packs, `talk to ${npc.name}`);
  assert.ok(opened.world.scene?.dialogue, 'dialogue opens');
  return { base: opened.world, npcName: npc.name, here };
}
const { base, npcName, here } = openDialogue();

// The exact utterance classes that used to eject (regression: these FAIL
// without the fix — they ejected via compass-"s", direction-noun, and
// idiom-verb matches respectively).
const STICKY = [
  "what's your name?",          // apostrophe-s ≠ compass south
  "it's been a quiet morning",  // same
  'is the road north safe?',    // direction as a noun, not a command
  'tell me about the north field',
  'take care of yourself',      // "take" as idiom, no object named
  'I take it you have lived here long?',
  'anything I should check out around here?', // "check" as idiom
  'hello',
  'who are you?',
  'do you know the way to the next town?'
];

test('U132-01: natural conversation stays in dialogue — every reply is an ask', () => {
  for (const reply of STICKY) {
    const r = playerMove(base, packs, reply);
    assert.ok(r.world.scene?.dialogue, `still talking after: "${reply}"`);
    assert.match(r.output.mechanics, /dialogue ask/, `routed to askNpc: "${reply}"`);
    assertWorldInvariants(r.world);
  }
});

test('U132-02: commanded movement breaks dialogue OUT LOUD and the action resolves', () => {
  const r = playerMove(base, packs, 'go north');
  assert.ok(!r.world.scene?.dialogue, 'conversation over');
  assert.match(r.output.narration, new RegExp(`You step away from ${npcName}`), 'the DM says so');
  assert.ok(r.output.narration.length > `Wizard: You step away from ${npcName}. `.length, 'and the move itself is narrated');
  assert.ok(r.world.timeline.some(e => e.kind === 'dialogueExit'), 'exit is canon');
});

test('U132-03: naming a real object breaks dialogue; naming nothing stays conversation', () => {
  const realThing = (here.furniture || []).find(f => f && f.name);
  if (realThing) {
    const r = playerMove(base, packs, `smash the ${realThing.name}`);
    assert.ok(!r.world.scene?.dialogue, 'physics on a real object ends the talk');
    assert.match(r.output.narration, /You step away from/, 'audibly');
  }
  const ghost = playerMove(base, packs, 'smash the porcelain throne');
  assert.ok(ghost.world.scene?.dialogue, 'muttering about absent objects is just talk');
});

test('U132-04: explicit goodbye still exits; a question about leaving does not', () => {
  const bye = playerMove(base, packs, 'goodbye');
  assert.ok(!bye.world.scene?.dialogue);
  assert.match(bye.output.mechanics, /dialogue exit/);
  const q = playerMove(base, packs, 'when does the caravan leave?');
  assert.ok(q.world.scene?.dialogue, '"when does the caravan leave?" is a question, not a goodbye');
  assert.match(q.output.mechanics, /dialogue ask/);
});

test('U132-05: contractions no longer read as compass moves outside dialogue either', () => {
  const w0 = beginAdventure(newWorld({ seed: 'u132b', fate: 0.2, campaignId: 'u132b', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  const w = playerMove(w0, packs, 'go outside').world;
  const before = w.map.currentNodeId;
  const r = playerMove(w, packs, "what's in my pack?");
  assert.equal(r.world.map.currentNodeId, before, 'a contraction is not a travel order');
});

test('U132-06: multi-turn conversation survives several exchanges and is deterministic', () => {
  let w = base;
  for (const line of ['hello', "what's the news?", 'take care — anything I should know about the roads?']) {
    const r = playerMove(w, packs, line);
    assert.ok(r.world.scene?.dialogue, `turn survives: "${line}"`);
    w = r.world;
  }
  const a = playerMove(base, packs, "what's your name?");
  const b = playerMove(base, packs, "what's your name?");
  assert.equal(a.output.narration, b.output.narration, 'same words, same answer');
});
