// U620 — PW-5: precedence — grounded common knowledge beats hearsay (docs/briefs/PW-5-audit.md §Q3).
//
// Ordering law: a local who KNOWS a fact firsthand states it; only if the bank ALSO misses does the
// turn fall to PW-3's rumour pickup, then to the shrug. This is automatic, not a special case:
// commonKnowledgeAnswer returning non-null yields a NON-'deflected' mode, and tryPickUpRumor fires
// ONLY on a bare 'deflected' (playloop.js:5538). This gate proves BOTH directions:
//   F5a — an ask the bank answers (a neighbour's lore) resolves as common_lore and mints NO rumour
//         (the pickup is skipped because the turn is not deflected).
//   F5b — an ask the bank does NOT answer but a latent rumour seed does STILL fires PW-3's pickup
//         (the bank does not swallow the rumour path). PW-3 is unbroken.
// Plus the mode/beat plumbing: common_lore rides the commonBody channel out to output.dialogue and
// mints no NPC memory (a pleasantry-grade public fact, like directions).
//
// The slice boots with two arc rumours (Galen carries cold-well; Brogan carries what-the-fire-left),
// so Galen has a REACHABLE latent seed on "the fire" he does not himself carry — the exact PW-3 shape.
//
// Hermetic — no network/API. Driven through the real playerMove path.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(
  newWorld({ seed: SLICE_SEED, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
  PACKS
).world;
const carrierRumors = (w) => (w.rumors || []).filter(r => String(r.carrierNpcId || '') !== '');

test('U620-01: F5a — a bank answer resolves as common_lore and mints NO carrier rumour (pickup skipped)', () => {
  let w = boot();
  w = playerMove(w, PACKS, 'talk to Galen').world;
  const before = carrierRumors(w).length;
  const r = playerMove(w, PACKS, 'tell me about Crowfoot Camp');
  assert.equal(String(r.output?.dialogue?.mode || ''), 'common_lore', 'the bank answers → common_lore');
  assert.equal(carrierRumors(r.world).length, before, 'no rumour minted — the pickup did not fire on a non-deflected turn');
  assert.ok(!/rumor_pickup/.test(r.output?.mechanics || ''), 'mechanics does not tag a pickup');
});

test('U620-02: F5b — when the bank MISSES, PW-3\'s rumour pickup still fires (the bank did not swallow it)', () => {
  let w = boot();
  w = playerMove(w, PACKS, 'talk to Galen').world;
  const before = carrierRumors(w).length;
  // "the fire" names no node → the bank misses → the turn deflects → PW-3 picks up Brogan's seed.
  const r = playerMove(w, PACKS, 'what do you know about the fire?');
  assert.equal(String(r.output?.dialogue?.mode || ''), 'rumor_pickup', 'a true miss still reaches PW-3');
  assert.ok(carrierRumors(r.world).length > before, 'a carrier rumour was minted on the true miss');
});

test('U620-03: the common_lore turn carries commonBody out to output.dialogue and mints no NPC memory', () => {
  let w = boot();
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npc = (here.settlement.npcs || []).find(n => n && !n.hostile);
  w = playerMove(w, PACKS, `talk to ${npc.name}`).world;

  const memBefore = JSON.stringify(
    (w.map.nodes.find(n => n.id === here.id).settlement.npcs.find(n => String(n.id) === String(npc.id))?.memory) || null
  );
  const r = playerMove(w, PACKS, 'tell me about Crowfoot Camp');

  // commonBody is the data-true answer, surfaced on the structured handle for the voice layer.
  assert.ok(String(r.output?.dialogue?.commonBody || '').length > 0, 'commonBody carries the grounded answer');
  assert.equal(String(r.output?.dialogue?.mode || ''), 'common_lore', 'payload mode is common_lore');

  // No memory minted — common_lore is not a CLASSIC_MODE (like directions, it is pleasantry-grade).
  const npcAfter = r.world.map.nodes.find(n => n.id === here.id).settlement.npcs.find(n => String(n.id) === String(npc.id));
  const memAfter = JSON.stringify(npcAfter?.memory || null);
  assert.equal(memAfter, memBefore, 'the bank answer mints no NPC memory');
});
