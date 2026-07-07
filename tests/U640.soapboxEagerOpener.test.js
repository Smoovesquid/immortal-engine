// U640 — SOAPBOX-1: a soapbox+eager NPC greets you already reaching for his cause.
//
// Carl's manner is 'guarded', so WITHOUT the soapbox his dialogue-enter opener
// would be the closed "they don't step closer, and they don't ask your name." With
// the eager soapbox he brightens on sight and starts bending your ear instead. The
// opener is manner/soapbox-derived and deterministic.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { PRE_ROLLED, buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { npcVoice, voiceManner } from '../engine/npc/dialogue.js';

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
function carlAt(world) {
  const node = (world.map.nodes || []).find(n => n.id === world.map.currentNodeId);
  return (node?.settlement?.npcs || []).find(n => /carl/i.test(n.name || ''));
}

const GUARDED_OPENER = /don't ask your name/i;   // the closed manner default
const EAGER_MARKER = /brighten|aching to say/i;  // the soapbox greeting

test('U640: Carl is a guarded-manner NPC (so his DEFAULT opener would be the closed one)', () => {
  const carl = carlAt(bootAtCarl());
  assert.ok(carl, 'Carl present');
  assert.equal(voiceManner(npcVoice(carl)), 'guarded', 'manner is guarded — default opener would be closed');
  assert.equal(carl.soapbox?.eager, true, 'Carl carries an eager soapbox');
});

test('U640: the dialogue-enter opener is the EAGER one, not the guarded one', () => {
  const world = bootAtCarl();
  const enter = playerMove(world, PACKS, 'go talk to Carl');
  const narr = String(enter.output?.narration || '');
  assert.match(narr, EAGER_MARKER, `soapbox NPC greets you reaching for his cause (got: "${narr}")`);
  assert.doesNotMatch(narr, GUARDED_OPENER, 'the eager opener replaces the guarded manner default');
});
