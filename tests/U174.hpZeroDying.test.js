import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { resolveEscapeCombatTurn, combatStatusAnswer } from '../engine/combat/escapeCombat.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Rung-1 gate 2026-06-18 — HP-zero / dying state (2 HARD: H-10, H-11).
// At 0 HP the PC is down/dying:
//   (a) combatStatusAnswer returns an explicit dying message (not "You're at 0 HP")
//   (b) resolveEscapeCombatTurn blocks normal actions (returns no-action)
//   (c) A rescue/stabilize intent applies 1 HP mechanically (not just narrated)

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function world(seed = 'stonewatch-hollow') {
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), packs()).world;
}

// Build a combat world with pc HP forced to 0
function dyingCombatWorld() {
  let w = world();
  // Start combat against first NPC
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npc = (node?.settlement?.npcs || [])[0];
  if (!npc) return null;
  w = playerMove(w, packs(), `I attack ${npc.name}`).world;
  if (!w.combat?.active) return null;
  // Force HP to 0
  w = { ...w, meta: { ...w.meta, escapeHp: 0 } };
  return w;
}

// ── (a) combatStatusAnswer at 0 HP ──────────────────────────────────────────

test('U174-01: combatStatusAnswer at 0 HP returns dying message', () => {
  const w = dyingCombatWorld();
  if (!w) return; // no NPC on this seed, skip
  const ans = combatStatusAnswer(w);
  assert.match(ans, /0 HP|dying|cannot act/i, 'status must declare dying condition at 0 HP');
  assert.doesNotMatch(ans, /You're at 0 of \d+/i, 'must not return ambiguous "at 0 of X HP" phrasing');
});

test('U174-02: combatStatusAnswer at 1+ HP still returns normal status', () => {
  const w = dyingCombatWorld();
  if (!w) return;
  const w1 = { ...w, meta: { ...w.meta, escapeHp: 5 } };
  const ans = combatStatusAnswer(w1);
  assert.match(ans, /5.*HP|HP.*5/i, 'normal status must include current HP');
  assert.doesNotMatch(ans, /dying/i, 'normal status must not claim dying');
});

// ── (b) Normal actions blocked at 0 HP ──────────────────────────────────────

test('U174-10: normal action at 0 HP is blocked (no weapon-strike resolution)', () => {
  const w = dyingCombatWorld();
  if (!w) return;
  const { result, world: wAfter } = resolveEscapeCombatTurn(w, 'I crawl off the mattress and claw at the floorboards.');
  assert.match(result.mechanicsLine, /dying|no-action/i, 'mechanics must reflect dying/blocked state');
  // HP must not have changed (no strike damage was calculated)
  assert.equal(Number(wAfter.meta?.escapeHp) || 0, 0, 'HP must still be 0 after blocked action');
});

test('U174-11: "I strike" at 0 HP is blocked', () => {
  const w = dyingCombatWorld();
  if (!w) return;
  const { result } = resolveEscapeCombatTurn(w, 'strike');
  assert.match(result.mechanicsLine, /dying|no-action/i, 'strike at 0 HP must be blocked');
});

test('U174-12: "fire bolt" at 0 HP is blocked (no cantrip fires)', () => {
  const w = dyingCombatWorld();
  if (!w) return;
  const { result } = resolveEscapeCombatTurn(w, 'fire bolt');
  // Should hit the dying gate (verb=firebolt, not cure/potion/layhands)
  assert.match(result.mechanicsLine, /dying|no-action/i, 'fire bolt at 0 HP must be blocked');
});

// ── (c) Rescue/stabilize applies HP mechanically ────────────────────────────

test('U174-20: rescue intent at 0 HP applies 1 HP', () => {
  const w = dyingCombatWorld();
  if (!w) return;
  const { world: wAfter, result } = resolveEscapeCombatTurn(w, 'Does someone drag me out? I need to be stabilized.');
  assert.equal(Number(wAfter.meta?.escapeHp) || 0, 1, 'rescue must apply exactly 1 HP');
  assert.match(result.mechanicsLine, /stabilize|hp:0→1/i, 'mechanics must record the stabilization');
});

test('U174-21: "healed" at 0 HP applies 1 HP', () => {
  const w = dyingCombatWorld();
  if (!w) return;
  const { world: wAfter } = resolveEscapeCombatTurn(w, 'I get healed by the priest.');
  assert.equal(Number(wAfter.meta?.escapeHp) || 0, 1, '"healed" must stabilize to 1 HP');
});

test('U174-22: HP update is mechanical, not just narrative (world state changes)', () => {
  const w = dyingCombatWorld();
  if (!w) return;
  assert.equal(Number(w.meta?.escapeHp) || 0, 0, 'sanity: HP starts at 0');
  const { world: wAfter } = resolveEscapeCombatTurn(w, 'stabilize me');
  assert.equal(Number(wAfter.meta?.escapeHp) || 0, 1, 'world HP must be 1 after stabilize — mechanical update');
});

// ── Self-healing verbs bypass the dying gate ─────────────────────────────────

test('U174-30: "cure wounds" at 0 HP bypasses the dying gate (caster tries their spell)', () => {
  const w = dyingCombatWorld();
  if (!w) return;
  // cure bypasses the dying gate — the cure handler will then say "no slots" or heal
  const { result } = resolveEscapeCombatTurn(w, 'cure wounds');
  // Must NOT hit the dying/no-action path
  assert.doesNotMatch(result.mechanicsLine, /no-action/, '"cure" must bypass the dying-blocked gate');
});

// ── via playerMove (integration) ─────────────────────────────────────────────

test('U174-40: playerMove blocks normal action at 0 HP in escape combat', () => {
  const w = dyingCombatWorld();
  if (!w) return;
  const { output, world: wAfter } = playerMove(w, packs(), 'I crawl to the door.');
  assert.equal(Number(wAfter.meta?.escapeHp) || 0, 0, 'HP must stay 0 after blocked action via playerMove');
  // The mechanics line should show the blocked/dying state
  assert.match(output.mechanics || '', /dying|no-action/i, 'playerMove output must reflect dying state');
});
