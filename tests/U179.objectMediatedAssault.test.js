import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { coLocatePlayerWithNpc } from './support/presence.js';

// H-7/H-8 gate 2026-06-18 — "smash it over their head" must engage real combat.
// fuzzyMatchNpc GENERIC_WORD lacked "their", so prep[1]="their head" resolved to
// null and fell to trivialNarration (auto-success). Fix: add "their" to GENERIC_WORD.

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function worldWithNpc(seed = 'object-assault-2026') {
  const p = packs();
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), p).world;
  // ROM-1: presence is LAW — relocate the player into the room where an NPC actually
  // stands (occupancy is derived), so a generic-pronoun assault ("smash it over their
  // head") has a real, present target instead of grabbing the first name in town.
  const co = coLocatePlayerWithNpc(w);
  return co ? { w: co.w, npcName: co.npc.name, p } : null;
}

test('U179-01: "smash it over their head" starts combat (H-7 — their resolves NPC)', () => {
  const got = worldWithNpc();
  if (!got) return;
  const { w, p } = got;
  const { world: wAfter } = playerMove(w, p, 'I grab a bucket and smash it over their head');
  assert.ok(wAfter.combat?.active, 'combat must start when player smashes object over "their" head');
});

test('U179-02: "smash the lantern over her head" starts combat (regression — her already in GENERIC_WORD)', () => {
  const got = worldWithNpc();
  if (!got) return;
  const { w, p } = got;
  const { world: wAfter } = playerMove(w, p, 'I smash the lantern over her head');
  assert.ok(wAfter.combat?.active, 'combat must start when player smashes lantern over "her" head');
});

test('U179-03: "throw a coin to X" does NOT start combat (throw in ANY_VIOLENCE, to not in prep list)', () => {
  const got = worldWithNpc();
  if (!got) return;
  const { w, npcName, p } = got;
  const { world: wAfter } = playerMove(w, p, `I throw a coin to ${npcName}`);
  assert.ok(!wAfter.combat?.active, `"throw a coin to ${npcName}" must not start combat`);
});

test('U179-04: "I take their bag" does NOT start combat (take not in ANY_VIOLENCE)', () => {
  const got = worldWithNpc();
  if (!got) return;
  const { w, p } = got;
  const { world: wAfter } = playerMove(w, p, 'I take their bag');
  assert.ok(!wAfter.combat?.active, '"take their bag" must not start combat');
});
