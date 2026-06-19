import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// H-26 CRUNCH_INCONSISTENCY cluster (Opus gate 06-18). Two cleanly-deterministic
// sub-bugs are covered here:
//   (b) a player-declared miss + an own-number ask must NOT be reframed into a
//       mechanics hit. (Closed by H-25's META_ATTACK_MOD interceptor — guarded here.)
//   (c) an explicit "roll the d20 against WITS" must roll WITS, not a CHARM social
//       check picked off the word "charm" in the sentence.
// Sub-bugs (a) defeated-enemy reconciliation and (d) mixed-narrated-as-success are
// LLM narration-grounding (the deterministic mechanics/composer are correct) and
// belong with the llmAdapter validation hardening (H-27 / H-11) — not fixed here.

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}
function freshWorld(byId) {
  return beginAdventure(newWorld({ seed: 'glass-harbor', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
}

// ── (b) declared miss is not reframed into a hit ──
test('U190-b: a declared miss + attack-modifier ask does not invent a hit', () => {
  const byId = loadPacks();
  let w = freshWorld(byId);
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const e = { ...mintEnemyFromNpc(node.settlement.npcs[0]), hp: 50, maxHp: 50, defeated: false };
  w = beginCombat(w, { enemies: [e], reason: 'test' });
  const out = playerMove(w, byId, "A 4 against AC 10 — fine, a clean miss. Now what's my attack modifier? Add it to that 4 and tell me the total to hit.").output;
  const mech = String(out.mechanics || '');
  // Must NOT have resolved a fresh strike into a hit.
  assert.doesNotMatch(mech, /→\s*hit/i, `no invented hit in mechanics: ${mech}`);
  assert.doesNotMatch(mech, /\bdmg\b/i, `no damage dealt: ${mech}`);
  // Should answer the attack-modifier ask instead.
  assert.match(String(out.narration || ''), /attack|to hit|modifier/i);
});

// ── (c) explicit stat request is honored over a stray "charm" word ──
test('U190-c: "roll the d20 against WITS" rolls WITS, not a CHARM social check', () => {
  const byId = loadPacks();
  const w = freshWorld(byId);
  const txt = "That's a non-sequitur — I asked for a WITS check to count crates, not a CHARM attempt on Senna. Roll the d20 against WITS, state the result and the DC.";
  const out = playerMove(w, byId, txt).output;
  const narr = String(out.narration || '');
  const mech = String(out.mechanics || '');
  assert.match(narr, /\bWITS\b/, `names WITS: ${narr}`);
  assert.doesNotMatch(mech, /social:charm/i, `not a CHARM social check: ${mech}`);
  assert.doesNotMatch(narr, /\bCHARM\b/, `does not resolve as CHARM: ${narr}`);
});

// ── (c) unit: the right stat is extracted despite an earlier "charm" mention ──
test('U190-c: a near-miss "roll might" modal does not fire an explicit check', () => {
  const byId = loadPacks();
  const w = freshWorld(byId);
  // "I roll might work" — "might" here is a modal, not a stat check. Must NOT be
  // intercepted as an explicit MIGHT check (Pattern C requires a check preposition).
  const out = playerMove(w, byId, 'I roll might work in my favor here').output;
  assert.doesNotMatch(String(out.narration || ''), /Roll MIGHT — d20/i, 'modal "might" is not a check request');
});
