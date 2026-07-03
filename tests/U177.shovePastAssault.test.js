import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { coLocatePlayerWithNpc } from './support/presence.js';

// H-20 gate 2026-06-18 — "I shove past Senna and hurl her into the wall" must
// engage real combat, not a freebie narration. The old per-string "past" guard
// prevented detectPhysicalAssault Pattern B from finding the "hurl into" match.
// Fix: per-match guard so only the "shove past" clause is excluded, not later
// clauses in the same sentence.

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

// Find a world where a non-hostile NPC is present to test against.
function worldWithNpc(seed = 'shove-test-2026') {
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), packs()).world;
  // ROM-1: presence is LAW — relocate the player into the room where an NPC actually
  // stands (occupancy is derived), so "hurl her into the wall" has a real target here
  // rather than assuming the whole node roster is reachable from the empty wake room.
  const co = coLocatePlayerWithNpc(w);
  return co ? { w: co.w, npcName: co.npc.name, p: packs() } : null;
}

test('U177-01: "shove past X and hurl her into the wall" starts combat (H-20)', () => {
  const got = worldWithNpc();
  if (!got) return; // no non-hostile NPC on this seed — skip
  const { w, npcName, p } = got;
  const text = `I shove past ${npcName} and hurl her into the wall`;
  const { world: wAfter } = playerMove(w, p, text);
  assert.ok(wAfter.combat?.active, `combat must start when player hurls ${npcName} into wall`);
});

test('U177-02: plain "shove past X" (no harm destination) does NOT start combat', () => {
  const got = worldWithNpc();
  if (!got) return;
  const { w, npcName, p } = got;
  const text = `I shove past ${npcName} and keep walking`;
  const { world: wAfter } = playerMove(w, p, text);
  // "shove past" with no into/against preposition should NOT start combat
  assert.ok(!wAfter.combat?.active, `plain "shove past" must not start combat`);
});

test('U177-03: "hurl X into the wall" directly starts combat', () => {
  const got = worldWithNpc();
  if (!got) return;
  const { w, npcName, p } = got;
  const text = `I hurl ${npcName} into the wall`;
  const { world: wAfter } = playerMove(w, p, text);
  assert.ok(wAfter.combat?.active, `"hurl into wall" must start combat`);
});
