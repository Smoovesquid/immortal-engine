// U706 — CORPSE-TRUTH-1b: a dead NPC stops walking the player map.
//
// THE LIE THIS CLOSES (DEATH-TRUTH-1 front 3, evidence 2026-07-16): kill Jorin at
// Trader's Camp through the full production route (exit the hut → attack → combat
// → the finish verb) and the live player sheet (placeFromWorldNode tokens →
// handDrawnPlace) keeps drawing him as a LIVING figure — and because an attacked
// NPC flips hostile, his corpse draws MASKED as a live ambusher token ('?').
// public/map consulted no death truth at all (zero npcCombatHp reads).
//
// THE FIX: the token projection consults remainsAtNode (the ONE canonical corpse
// read, CORPSE-TRUTH-1a) and flags dead NPCs' tokens `dead: 1`; the draw renders
// a fallen mark instead of a living circle. The flag rides the SAME iteration and
// the SAME rng draws — no token moves, nothing is filtered (filtering would shift
// the seeded scatter of every neighbour). Mechanics were already honest (roster
// kept, npcCombatHp down, status/pulse reads) — this front is the map's turn.
// Death LOCATION holds by construction: an NPC dies in combat at the player's
// node, which is the node its roster entry lives on; the fact's nodeId (U705-A)
// pins it in canon.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { PACKS } from '../scripts/convergence/fixtures.mjs';
import { remainsAtNode, findDeathFacts } from '../engine/combat/deathFact.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { worldHash } from '../engine/worldHash.js';

const boot = () => beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// The full production route: outside → attack Jorin → pin hp (U604's fixture
// technique) → strike → finish if downed-dying. Deterministic by seed.
function killJorin() {
  let w = boot();
  w = playerMove(w, PACKS, 'I go outside.').world;
  const wAlive = w; // the pre-death world, same node, for the token-stability proof
  w = playerMove(w, PACKS, 'I attack Jorin with my blade.').world;
  assert.equal(w.combat?.active, true, 'setup: the assault began combat');
  assert.equal(String(w.combat.enemies[0]?.sourceNpcId || ''), 'npc_1', 'setup: Jorin is the sourced foe');
  w = { ...w, combat: { ...w.combat, enemies: w.combat.enemies.map(e => ({ ...e, hp: 1, ac: 1 })) } };
  for (let i = 0; i < 8 && w.combat?.active; i++) w = playerMove(w, PACKS, 'I strike him down.').world;
  if ((w.combat?.enemies || []).some(e => e && !e.defeated && (Number(e.hp) || 0) <= 0)) {
    w = playerMove(w, PACKS, 'I finish him off.').world;
  }
  assert.equal(w.combat?.active, false, 'setup: combat over');
  assert.ok(w.meta?.npcCombatHp?.npc_1?.down, 'setup: the persisted record says down');
  return { w, wAlive };
}

const npcTokens = (w) => (placeFromWorldNode(w, String(w.map.currentNodeId))?.tokens || []).filter(t => t && t.type === 'npc');

// ── U706-A the dead NPC's token is flagged; the living stay unflagged ──
test('U706-A dead Jorin tokens dead:1; living neighbours carry no flag', () => {
  const { w } = killJorin();
  const toks = npcTokens(w);
  const jorin = toks.find(t => String(t.npc?.id || '') === 'npc_1');
  assert.ok(jorin, 'Jorin still has a token — a corpse is present, not erased');
  assert.ok(jorin.dead, 'and it is flagged dead — never again a living figure (nor a masked live ambusher)');
  for (const t of toks) {
    if (String(t.npc?.id || '') === 'npc_1') continue;
    assert.ok(!t.dead, `living NPC ${t.npc?.id} carries no dead flag`);
  }
});

// ── U706-B flagging is not filtering: the corpse keeps its token slot ──
// (NOTE, learned red-first: the ATTACK itself reorders the scatter — a flipped-
// hostile NPC changes shown-list lanes long before death — so alive-vs-dead
// position equality was never this packet's claim. The claims that ARE ours:
// no token disappears at death, and the dead-world projection is deterministic.)
test('U706-B the death removes no token; the dead-world projection replays identically', () => {
  // (Learned red-first, second lesson: combat TURNS tick the world — the route's
  // extra rounds let a hunt spawn a fresh hostile at the node, so alive-vs-dead
  // token COUNTS aren't comparable either. The corpse-keeps-its-slot claim is
  // U706-A's jorin-token existence; here we pin pure replay determinism.)
  const { w } = killJorin();
  const again = killJorin().w;
  assert.deepEqual(
    npcTokens(w).map(t => ({ id: String(t.npc?.id || ''), ux: t.ux, uy: t.uy, dead: Boolean(t.dead) })),
    npcTokens(again).map(t => ({ id: String(t.npc?.id || ''), ux: t.ux, uy: t.uy, dead: Boolean(t.dead) })),
    'two fresh runs project byte-equal tokens, flags included');
});

// ── U706-C the production-route NPC corpse is ONE locatable body in canon ──
test('U706-C remainsAtNode lists Jorin once, kind npc, at the real node', () => {
  const { w } = killJorin();
  const nid = String(w.map.currentNodeId);
  const rem = remainsAtNode(w, nid).filter(r => /jorin/i.test(String(r.name || '')));
  assert.equal(rem.length, 1, `Jorin's body lists exactly once (${JSON.stringify(rem)})`);
  assert.equal(rem[0].kind, 'npc', 'an NPC corpse, distinct from a monster in the fiction');
  const fact = findDeathFacts(w).find(f => /jorin/i.test(String(f?.victim?.name || '')));
  assert.ok(fact, 'the kill minted a death fact');
  assert.equal(String(fact.nodeId || ''), nid, 'whose canon records the death node');
});

// ── U706-D determinism: the whole route replays to the same hash ──
test('U706-D worldHash equality across two fresh runs of the full route', () => {
  const h1 = worldHash(killJorin().w);
  const h2 = worldHash(killJorin().w);
  assert.equal(h1, h2, 'same seed, same script, same hash');
});
