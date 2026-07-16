// U709 — CORPSE-TRUTH-1 finish: a killed monster leaves a PERSISTENT, PASSIVE,
// VISIBLE corpse projection — not prose alone.
//
// THE GAP THIS CLOSES (DEATH-TRUTH-1 finish, evidence 2026-07-16): kill a Vein
// Crawler through the production route and canon knew (remainsAtNode listed it,
// presence answered) but NO surface ever drew the body — sheet tokens
// [player,npc,npc,npc], 3D people feed without it, interior sheet blank. The
// fact also recorded no room/pos although the engine OWNED both at the killing
// moment (scene.interior + the player's canonical tactical pos).
//
// THE FIX: the fact mints `loc` ({ structureId, roomId, pos }) + the victim's
// `archetype` (deriveArchetype — the SAME derivation the combat board's living
// figure used, now engine-side) + `corpseKey` (the board's own corpse-GLB hash
// key). remainsAtNode passes them through; every token surface projects them:
// interior sheets pin the body in its death room; the village sheet pins
// outdoor deaths at an identity-keyed spot (never the roster scatter); the 3D
// people feed carries archetype/corpseKey so render3d shows the creature's own
// corpse (authored GLB, else toppled archetype — the documented fallback).
// The combat grid's cells are deliberately NOT recorded: that board is an
// abstract frame that dissolves at endCombat (never fabricate precision).

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { PACKS } from '../scripts/convergence/fixtures.mjs';
import { spawnEncounter, selectCreatures } from '../engine/combat/encounterSpawn.js';
import { findDeathFacts, remainsAtNode } from '../engine/combat/deathFact.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { placedTokenModel } from '../public/map/drawModel.js';
import { interiorPeopleTokens } from '../public/map/interiorTokens.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';

const boot = () => beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const say = (w, t) => playerMove(w, PACKS, t).world;

// Kill one real bestiary monster through the production route (the U705
// technique: spawn ambush → strikes → the finish verb; HP pinned to 1).
function killOneMonster(w) {
  const rng = makeRng(seedFromString('death-truth-evidence'));
  const defs = selectCreatures(1, 1, null, rng) || [];
  w = spawnEncounter(w, defs, { ambush: true, reason: 'u709-ambush' }, rng);
  assert.equal(w.combat?.active, true, 'setup: ambush combat began');
  const monsterName = String(w.combat.enemies[0].name || '');
  w = { ...w, combat: { ...w.combat, enemies: w.combat.enemies.map(e => ({ ...e, hp: 1, ac: 1 })) } };
  for (let i = 0; i < 8 && w.combat?.active; i++) w = say(w, 'I strike at it with everything I have.');
  if ((w.combat?.enemies || []).some(e => e && !e.defeated && (Number(e.hp) || 0) <= 0)) {
    w = say(w, 'I finish it off.');
  }
  assert.equal(w.combat?.active, false, 'setup: combat over');
  return { w, monsterName };
}

// ── A. the fact captures the killing-moment location + corpse identity ──────
test('U709-A an interior kill mints loc (structure+room+pos), archetype, and corpseKey', () => {
  const w0 = boot(); // wakes INTERIOR — the fight happens inside
  const structureKey = String(w0.scene.interior.structureKey);
  const roomId = String(w0.scene.interior.roomId);
  const { w, monsterName } = killOneMonster(w0);
  const fact = findDeathFacts(w).find(f => f?.victim && !f.victim.isPlayer);
  assert.ok(fact, 'the kill minted a fact');
  assert.equal(String(fact.loc?.structureId), structureKey, 'loc.structureId = the interior at the kill');
  assert.equal(String(fact.loc?.roomId), roomId, 'loc.roomId = the room at the kill');
  assert.ok(fact.loc?.pos && /^struct:/.test(String(fact.loc.pos.frame)), 'loc.pos = the canonical struct-frame position');
  assert.ok(fact.victim.archetype, 'the victim archetype is minted (never null on a fresh kill)');
  assert.equal(String(fact.victim.corpseKey), String(w.combat.enemies[0].id || monsterName),
    'corpseKey = the exact key the combat board hashed for this foe');
  const rem = remainsAtNode(w, String(w.map.currentNodeId)).find(r => r.kind === 'monster');
  assert.ok(rem.loc && rem.corpseKey && rem.archetype, 'remainsAtNode passes loc/corpseKey/archetype through');
});

// ── B. the interior sheet draws the body in its DEATH room ──────────────────
test('U709-B interiorPeopleTokens pins the monster corpse in the death room', () => {
  const w0 = boot();
  const structureKey = String(w0.scene.interior.structureKey);
  const roomId = String(w0.scene.interior.roomId);
  const { w } = killOneMonster(w0);
  const toks = interiorPeopleTokens(w, structureKey, [roomId]);
  const corpse = toks.find(t => t.dead && /^remains:/.test(String(t.nkey)));
  assert.ok(corpse, `the death room lists the monster corpse token (${JSON.stringify(toks)})`);
  assert.equal(String(corpse.roomId), roomId, 'in the death room, exactly');
  // knowledge rule: an undiscovered room keeps its dead off the sheet
  const undiscovered = interiorPeopleTokens(w, structureKey, []);
  assert.ok(!undiscovered.some(t => /^remains:/.test(String(t.nkey))), 'undiscovered rooms show nothing');
});

// ── C. an OUTDOOR kill pins a corpse token on the village sheet, stably ─────
test('U709-C outdoor monster corpse: pinned token, never re-scattered, rides the 3D feed', () => {
  let w = boot();
  w = say(w, 'I go outside.');
  const killed = killOneMonster(w);
  w = killed.w;
  const nid = String(w.map.currentNodeId);
  const toks = () => (placeFromWorldNode(w, nid)?.tokens || []).filter(t => t.type === 'npc' && t.dead && t.monster);
  const corpse = toks()[0];
  assert.ok(corpse, 'the sheet carries the monster corpse token');
  assert.ok(corpse.corpseKey && corpse.archetype, 'with its persisted corpse identity');
  const p1 = { ux: corpse.ux, uy: corpse.uy };
  // world moves on (turns tick, occupancy shifts) — the body does not
  w = say(w, 'I look around.');
  w = say(w, 'I wait and catch my breath.');
  const after = toks()[0];
  assert.ok(after, 'the corpse token persists across turns');
  assert.deepEqual({ ux: after.ux, uy: after.uy }, p1, 'pinned by identity — no re-scatter, ever');
  // the 3D people feed carries it too, with the selection identity
  const people = placedTokenModel(w, nid).people || [];
  const dead = people.find(p => p.dead && p.corpseKey);
  assert.ok(dead, `the diorama feed carries the corpse (${JSON.stringify(people.map(p => ({ id: p.id, dead: p.dead })))})`);
  assert.ok(dead.archetype, 'with the toppled-figure fallback family');
});

// ── D. the corpse is PASSIVE: no roster entry, no combat restart ────────────
test('U709-D the dead monster cannot rejoin the fight or the roster', () => {
  const w0 = boot();
  const { w, monsterName } = killOneMonster(w0);
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  assert.ok(!(node.settlement?.npcs || []).some(n => String(n.name) === monsterName),
    'the corpse never joins the living roster');
  const r = playerMove(w, PACKS, `I attack the ${monsterName.toLowerCase()} again.`);
  assert.notEqual(r.world.combat?.active, true, 'attacking the corpse restarts nothing');
});

// ── E. save/load + determinism ───────────────────────────────────────────────
test('U709-E the corpse projection survives save/load; the route replays to one hash', () => {
  let w = boot();
  w = say(w, 'I go outside.');
  w = killOneMonster(w).w;
  const nid = String(w.map.currentNodeId);
  const before = (placeFromWorldNode(w, nid)?.tokens || []).find(t => t.dead && t.monster);
  const w2 = importWorld(exportWorld(w));
  const after = (placeFromWorldNode(w2, nid)?.tokens || []).find(t => t.dead && t.monster);
  assert.ok(after, 'the corpse token survives the round-trip');
  assert.deepEqual({ ux: after.ux, uy: after.uy }, { ux: before.ux, uy: before.uy }, 'at the same spot');

  const run = () => { let x = boot(); x = playerMove(x, PACKS, 'I go outside.').world; return killOneMonster(x).w; };
  assert.equal(worldHash(run()), worldHash(run()), 'same seed, same script, same hash');
});
