// U638 — SOAPBOX-1: the soapbox opens ONLY the cause. Off-topic is byte-unchanged,
// and an NPC without a soapbox is completely unaffected (the feature is opt-in).
//
// Two guards:
//   A) Carl, asked something OFF his cause, still runs the ordinary trust ladder
//      (deflects a stranger) — the soapbox did not blow the trust system open.
//   B) fallbackRules with NO soapbox is inert to soapbox-keyword text: the exact
//      same decision whether the player says "chickens" or "hello". Adding a
//      soapbox is the ONLY thing that flips the gate.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { PRE_ROLLED, buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { fallbackRules } from '../engine/npc/npcBrain.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
function bootAtCarl() {
  const pc = buildPreRolledCharacter(PRE_ROLLED.find(e => /bryn/i.test(e.name || e.id)));
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  let { world } = beginAdventure(ensureWorld({ ...w0, party: [pc] }), PACKS);
  return playerMove(world, PACKS, 'go outside').world;
}

// A minimal fallbackRules context (fallbackRules takes a context, not an npc).
function ctx(overrides = {}) {
  return {
    npcId: 'x', trust: 0, secrets: new Set(),
    knownFacts: [], carriedRumors: [], memories: [],
    playerInput: '', turn: 0, factionStanding: null, soapbox: null,
    ...overrides
  };
}

test('U638A: Carl still DEFLECTS an off-topic ask from a stranger (trust ladder intact)', () => {
  let world = bootAtCarl();
  world = playerMove(world, PACKS, 'go talk to Carl').world;
  // First thing off his cause — a fresh turn, no evangelize cache in play.
  const ask = playerMove(world, PACKS, 'what is your opinion of the tax collector?');
  const mech = String(ask.output?.mechanics || '');
  assert.match(mech, /dialogue ask \| deflected/, `off-topic stays on the trust ladder (mech="${mech}")`);
  assert.doesNotMatch(mech, /evangelize/, 'off-topic must NOT evangelize');
});

test('U638B: with NO soapbox, soapbox-keyword text is completely inert (byte-unchanged)', () => {
  // Same decision whether or not the input contains a soapbox keyword.
  const onKeyword = fallbackRules(ctx({ playerInput: 'tell me about chickens' }));
  const neutral   = fallbackRules(ctx({ playerInput: 'hello there, friend' }));
  assert.deepEqual(onKeyword, neutral, 'no soapbox → keyword text changes nothing');
  assert.equal(onKeyword.approach, 'deflect', 'trust 0 with no soapbox → the unchanged deflect');

  // And the trust ladder itself is unchanged for a no-soapbox NPC across bands.
  assert.equal(fallbackRules(ctx({ trust: 5, playerInput: 'chickens' })).approach, 'wait_to_be_asked');
  assert.equal(fallbackRules(ctx({ trust: 8, playerInput: 'chickens' })).approach, 'volunteer');
});

test('U638C: the SAME chicken text flips to evangelize the moment a soapbox is present', () => {
  const soapbox = { cause: 'avian supremacy', eager: true, topics: ['chicken', 'chickens'] };
  const withSoap = fallbackRules(ctx({ trust: 0, playerInput: 'tell me about chickens', soapbox }));
  assert.equal(withSoap.approach, 'evangelize', 'soapbox present + on-topic → evangelize at trust 0');
  assert.equal(withSoap.mood, 'fervent');
});
