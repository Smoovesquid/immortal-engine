// U637 — SOAPBOX-1: a zealot evangelizes his cause to a stranger at trust 0.
//
// Carl the failed sculptor is an avian-supremacy demagogue whose 8k-word manifesto
// is wired as his voice (voiceCorpusId:'carl_manifesto'). But he DEFLECTED his own
// obsession because the deterministic NPC brain gated ALL sharing on trust, and a
// stranger starts cold. A proselytizer is EAGER to preach his cause to anyone while
// staying guarded about personal things — the soapbox models exactly that.
//
// THE DM TEST: ask Carl about chickens and a real DM has him LIGHT UP, not clam up.
//
// Driven through the real player stack (playerMove), LLM-off / deterministic brain.
// node --test does not load .env, so the intent + brain paths run on their
// deterministic floors — this is the LLM-OFF target.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { PRE_ROLLED, buildPreRolledCharacter } from '../engine/chargen/preRolled.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

// Boot the aldermere slice with the Bryn quickstart and step outside to the
// settlement node where Carl stands.
function bootAtCarl() {
  const pc = buildPreRolledCharacter(PRE_ROLLED.find(e => /bryn/i.test(e.name || e.id)));
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  let { world } = beginAdventure(ensureWorld({ ...w0, party: [pc] }), PACKS);
  world = playerMove(world, PACKS, 'go outside').world;
  return world;
}
function carlAt(world) {
  const node = (world.map.nodes || []).find(n => n.id === world.map.currentNodeId);
  return (node?.settlement?.npcs || []).find(n => /carl/i.test(n.name || ''));
}

test('U637: Carl evangelizes his cause on-topic at trust 0 (was: deflected)', () => {
  let world = bootAtCarl();
  const carl = carlAt(world);
  assert.ok(carl, 'Carl is present at Aldermere');
  assert.equal(Number(carl.playerRelationship?.trust ?? -1), 0, 'Carl starts a stranger — player-trust 0');

  const enter = playerMove(world, PACKS, 'go talk to Carl');
  world = enter.world;
  assert.ok(world.scene?.dialogue?.npcId, 'dialogue opened with Carl');

  const ask = playerMove(world, PACKS, 'tell me about chickens');
  const mech = String(ask.output?.mechanics || '');
  const narr = String(ask.output?.narration || '');

  // The heart of the packet: on his cause, a stranger gets a SERMON, not a brush-off.
  assert.match(mech, /dialogue ask \| evangelize/, `on-topic ask must evangelize, not deflect (mech="${mech}")`);
  assert.doesNotMatch(narr, /not a thing I talk about with strangers/i, 'must NOT deflect his own obsession');
});

test('U637b: "are you a chicken?" ENGAGES the cause eagerly, never denies/deflects', () => {
  let world = bootAtCarl();
  world = playerMove(world, PACKS, 'go talk to Carl').world;
  const ask = playerMove(world, PACKS, 'are you a chicken?');
  const mech = String(ask.output?.mechanics || '');
  const narr = String(ask.output?.narration || '');
  assert.match(mech, /dialogue ask \| evangelize/, `on-topic engages eagerly (mech="${mech}")`);
  assert.doesNotMatch(narr, /not a thing I talk about with strangers/i, 'the prophet does not clam up');
});
