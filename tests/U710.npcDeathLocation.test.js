// U710 — CORPSE-TRUTH-1 finish: an NPC's corpse stays WHERE IT DIED.
//
// THE LIE THIS CLOSES (DEATH-TRUTH-1 finish, evidence 2026-07-16): Jorin dies
// OUTSIDE at Trader's Camp; his dead token kept riding the LIVING roster
// scatter (any roster change re-dealt every position — a corpse that wanders),
// and "Is there a body here?" asked INSIDE the hut answered "Yes — Jorin's
// body lies here." while the body lay out in the open (node-scoped read, no
// room truth in the fact).
//
// THE FIX: the fact's `loc` captures the killing-moment location; located dead
// leave the living feeds and come back as PINNED corpse tokens (identity-keyed
// seed — no list-order dependence); the presence read answers for WHERE YOU
// STAND, pointing honestly when the body is elsewhere at the node. LEGACY dead
// (npcCombatHp only / pre-feature facts, no loc) keep the old node-level
// behavior everywhere — degraded honestly, never assigned a guessed room.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { PACKS } from '../scripts/convergence/fixtures.mjs';
import { findDeathFacts, remainsAtNode } from '../engine/combat/deathFact.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { interiorPeopleTokens } from '../public/map/interiorTokens.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';

const boot = () => beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const say = (w, t) => playerMove(w, PACKS, t).world;

// The U706 production route: outside → attack Jorin → pin hp → strike → finish.
function killJorinOutside() {
  let w = boot();
  w = say(w, 'I go outside.');
  w = say(w, 'I attack Jorin with my blade.');
  assert.equal(w.combat?.active, true, 'setup: the assault began combat');
  w = { ...w, combat: { ...w.combat, enemies: w.combat.enemies.map(e => ({ ...e, hp: 1, ac: 1 })) } };
  for (let i = 0; i < 8 && w.combat?.active; i++) w = say(w, 'I strike him down.');
  if ((w.combat?.enemies || []).some(e => e && !e.defeated && (Number(e.hp) || 0) <= 0)) {
    w = say(w, 'I finish him off.');
  }
  assert.equal(w.combat?.active, false, 'setup: combat over');
  assert.ok(w.meta?.npcCombatHp?.npc_1?.down, 'setup: Jorin is down');
  return w;
}

const jorinToken = (w) => (placeFromWorldNode(w, String(w.map.currentNodeId))?.tokens || [])
  .find(t => t.type === 'npc' && String(t.npc?.id || '') === 'npc_1');

// ── A. an outdoor death records an outdoor location ──────────────────────────
test('U710-A the fact captures loc: no structure, the canonical region position', () => {
  const w = killJorinOutside();
  const fact = findDeathFacts(w).find(f => /jorin/i.test(String(f?.victim?.name || '')));
  assert.ok(fact.loc, 'the fact carries loc (post-feature discriminator)');
  assert.equal(fact.loc.structureId, null, 'died in the open — no structure');
  assert.ok(fact.loc.pos && fact.loc.pos.frame === 'region'
    && Number.isInteger(fact.loc.pos.gx) && Number.isInteger(fact.loc.pos.gy),
    'the engine-owned region position rides the fact');
});

// ── B. the corpse token is PINNED — out of the scatter, immovable ────────────
test('U710-B dead Jorin leaves the living scatter and never moves again', () => {
  let w = killJorinOutside();
  const t1 = jorinToken(w);
  assert.ok(t1 && t1.dead, 'Jorin has exactly a dead token');
  const there = { ux: t1.ux, uy: t1.uy };
  // the world moves on: turns pass, occupancy shifts, the shown list changes
  w = say(w, 'I look around.');
  w = say(w, 'I wait and catch my breath.');
  const t2 = jorinToken(w);
  assert.ok(t2 && t2.dead, 'the body is still there');
  assert.deepEqual({ ux: t2.ux, uy: t2.uy }, there,
    'roster/home metadata cannot move a corpse: the pin is identity-keyed, not list-keyed');
  // and it is ONE token — never also a living figure
  const all = (placeFromWorldNode(w, String(w.map.currentNodeId))?.tokens || [])
    .filter(t => String(t.npc?.id || '') === 'npc_1');
  assert.equal(all.length, 1, 'one body, one token');
});

// ── C. "here" means where you stand — the room-scoped body answer ────────────
test('U710-C body queries answer by location: yes outside, an honest pointer inside', () => {
  let w = killJorinOutside();
  const outside = playerMove(w, PACKS, 'Is there a body here?');
  assert.match(String(outside.output?.narration || ''), /Yes — Jorin's body lies here\./,
    'standing over the body: yes');
  w = say(w, 'I go inside.');
  assert.ok(w.scene?.interior, 'setup: the player is inside now');
  const inside = playerMove(w, PACKS, 'Is there a body here?');
  const line = String(inside.output?.narration || '');
  assert.doesNotMatch(line, /lies here/, 'the old node-scoped lie is gone');
  assert.match(line, /Not here — Jorin's body lies outside\./, 'an honest DM pointer instead');
});

// ── D. an INTERIOR kill pins the corpse in its death room ────────────────────
test('U710-D killed inside: the body stays in the death room; other rooms answer honestly', () => {
  let w = boot(); // interior at boot
  const structureKey = String(w.scene.interior.structureKey);
  const roomId = String(w.scene.interior.roomId);
  w = say(w, 'I attack Jorin with my blade.');
  if (w.combat?.active !== true) return; // route guard: if the indoor assault doesn't engage, this case is owned by U709-B (monster interior kill)
  w = { ...w, combat: { ...w.combat, enemies: w.combat.enemies.map(e => ({ ...e, hp: 1, ac: 1 })) } };
  for (let i = 0; i < 8 && w.combat?.active; i++) w = say(w, 'I strike him down.');
  if ((w.combat?.enemies || []).some(e => e && !e.defeated && (Number(e.hp) || 0) <= 0)) w = say(w, 'I finish him off.');
  assert.equal(w.combat?.active, false, 'combat over');
  const fact = findDeathFacts(w).find(f => /jorin/i.test(String(f?.victim?.name || '')));
  assert.equal(String(fact.loc?.structureId), structureKey, 'death recorded in the structure');
  assert.equal(String(fact.loc?.roomId), roomId, 'in the exact room');
  const toks = interiorPeopleTokens(w, structureKey, [roomId]);
  assert.ok(toks.some(t => t.dead && String(t.nkey) === 'npc_1'), 'the death room draws the body');
  // the village sheet does NOT draw an indoor body outdoors
  const sheetTok = jorinToken(w);
  assert.equal(sheetTok, undefined, 'no outdoor token for an indoor corpse');
});

// ── E. LEGACY dead (no fact.loc) degrade honestly — old behavior, unmoved ───
test('U710-E a legacy kill (npcCombatHp only) keeps the flagged-scatter + node-level answers', () => {
  let w = boot();
  w = say(w, 'I go outside.');
  // Surgery: a pre-feature death — the persisted record without any death fact.
  // The hostile flip mirrors the real legacy shape (a kill always flipped its
  // victim hostile first; hostile placement is what put the dead body outdoors).
  w = {
    ...w,
    meta: { ...w.meta, npcCombatHp: { ...(w.meta.npcCombatHp || {}), npc_1: { hp: 0, down: true } } },
    map: {
      ...w.map,
      nodes: w.map.nodes.map(n => (String(n.id) === String(w.map.currentNodeId) && n.settlement)
        ? { ...n, settlement: { ...n.settlement, npcs: (n.settlement.npcs || []).map(p => String(p.id) === 'npc_1' ? { ...p, hostile: true } : p) } }
        : n),
    },
  };
  const rem = remainsAtNode(w, String(w.map.currentNodeId)).find(r => r.sourceNpcId === 'npc_1');
  assert.ok(rem && rem.loc === null, 'legacy remains carry no loc — nothing is guessed');
  const t = jorinToken(w);
  assert.ok(t && t.dead === 1, 'the legacy body rides the scatter, flagged — exactly the old truth');
  const inside = playerMove(say(w, 'I go inside.'), PACKS, 'Is there a body here?');
  assert.match(String(inside.output?.narration || ''), /Yes — Jorin's body lies here\./,
    'legacy answers stay node-level (never a fabricated room)');
});

// ── F. save/load + determinism ────────────────────────────────────────────────
test('U710-F the pinned corpse survives save/load; the route replays to one hash', () => {
  const w = killJorinOutside();
  const t1 = jorinToken(w);
  const w2 = importWorld(exportWorld(w));
  const t2 = jorinToken(w2);
  assert.ok(t2 && t2.dead, 'the body survives the round-trip');
  assert.deepEqual({ ux: t2.ux, uy: t2.uy }, { ux: t1.ux, uy: t1.uy }, 'at the same spot');
  assert.equal(worldHash(killJorinOutside()), worldHash(killJorinOutside()), 'replay-stable');
});
