// U641 — CARL-SELF-1: asked what he is, Carl OWNS being a chicken — proudly.
//
// Tim canon 2026-07-07: "He's a chicken... Yes, he knows what he is." Post-SOAPBOX-1,
// "are you a chicken?" made Carl EVANGELIZE his cause eagerly — but he never AFFIRMED
// that he is one — and "what are you?" made him clam up ("not a thing I talk about
// with strangers"). An avian-supremacy demagogue who IS one of the fowl he exalts,
// and knows it, must declare it with pride.
//
// The mechanics stay 'evangelize' (SOAPBOX-1's U637b holds) — only the WORDS change:
// the narration now says YES. Driven through the real player stack (playerMove),
// LLM-off / deterministic brain (node --test loads no .env).

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

function bootAtCarl() {
  const pc = buildPreRolledCharacter(PRE_ROLLED.find(e => /bryn/i.test(e.name || e.id)));
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  let { world } = beginAdventure(ensureWorld({ ...w0, party: [pc] }), PACKS);
  return playerMove(world, PACKS, 'go outside').world;
}

const AFFIRMS = /\bI am (?:the|a) chicken\b/i;             // the proud YES
const DEFLECT = /not a thing I talk about with strangers/i; // the old clam-up

test('U641: "are you a chicken?" → Carl proudly AFFIRMS he is a chicken', () => {
  let world = bootAtCarl();
  world = playerMove(world, PACKS, 'go talk to Carl').world;
  const ask = playerMove(world, PACKS, 'are you a chicken?');
  const mech = String(ask.output?.mechanics || '');
  const narr = String(ask.output?.narration || '');
  // Mechanics unchanged — SOAPBOX-1's U637b still sees 'evangelize'.
  assert.match(mech, /dialogue ask \| evangelize/, `mechanics unchanged (mech="${mech}")`);
  // The heart of the packet: he does not merely preach the cause — he OWNS it.
  assert.match(narr, AFFIRMS, `he must declare he IS a chicken, not just preach (got: "${narr}")`);
  assert.doesNotMatch(narr, DEFLECT, 'the awakened fowl never clams up about what he is');
});

test('U641b: "what are you?" → Carl names his nature in the first person, never deflects', () => {
  let world = bootAtCarl();
  world = playerMove(world, PACKS, 'go talk to Carl').world;
  const ask = playerMove(world, PACKS, 'what are you?');
  const narr = String(ask.output?.narration || '');
  assert.match(narr, /\bchicken\b/i, 'he names his nature');
  assert.match(narr, /\bI am\b/i, 'first-person ownership');
  assert.doesNotMatch(narr, DEFLECT, 'asked what he is, the awakened one answers — he does not clam up');
});
