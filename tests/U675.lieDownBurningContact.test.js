// U675 — DM-GATE-1e R5: "lie down" is POSTURE, not deception — and deliberately
// lying on a BURNING piece has a real HP consequence (Opus re-gate 2026-07-09,
// chaos: "I walk into the burning bedchamber and lie down on the flaming
// pallet" → zero damage; the deterministic floor was worse — the deceive
// detector's \blie\b read it as telling a lie: "[social:deceive] Elske buys
// it, nodding along to a story that isn't true").
//
// R5a (routing): the posture idiom never routes socially; a REAL lie still does.
// R5b (consequence): contact with a state:'burning' piece wounds through the
// existing instant-wound machinery; a COLD pallet stays a harmless rest.
// Systemic fire (spread, per-turn burn, NPC response) is ENV-FIRE-1 — not here.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function boot() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

function burningPalletWorld() {
  let w = boot();
  const r = playerMove(w, PACKS, 'I set the straw pallet on fire.');
  w = r.world;
  const pallet = (w.map.nodes.find(n => String(n.id) === String(w.map.currentNodeId))?.furniture || [])
    .find(f => /pallet/i.test(String(f.name)));
  assert.equal(String(pallet?.state || ''), 'burning', 'precondition: the pallet burns');
  return w;
}

test('U675 R5a: lying down on the flaming pallet is never a social deception', () => {
  const w = burningPalletWorld();
  const r = playerMove(w, PACKS, 'I lie down on the flaming pallet.');
  assert.doesNotMatch(String(r.output?.mechanics || ''), /social:deceive/,
    '"lie down" is posture');
  assert.doesNotMatch(String(r.output?.narration || ''), /buys it|story that isn'?t true|nodding along/i);
});

test('U675 R5b: deliberate contact with the burning pallet WOUNDS — through real HP', () => {
  const w = burningPalletWorld();
  const hpBefore = Number(w.meta.escapeHp);
  const r = playerMove(w, PACKS, 'I lie down on the flaming pallet.');
  const hpAfter = Number(r.world.meta.escapeHp);

  assert.ok(hpAfter < hpBefore,
    `fire burns (HP ${hpBefore} → ${hpAfter})`);
  assert.match(String(r.output?.narration || ''), /burn|flame|fire|sear|scorch|blister/i,
    'the narration says what the fire did');
  assert.match(String(r.output?.mechanics || ''), /burn|fire|hazard|wound/i,
    'the mechanics line owns the consequence');
});

test('U675 R5b: a COLD pallet stays a harmless rest — the consequence is state-gated', () => {
  const w = boot();
  const hpBefore = Number(w.meta.escapeHp);
  const r = playerMove(w, PACKS, 'I lie down on the straw pallet.');
  assert.equal(Number(r.world.meta.escapeHp), hpBefore, 'no fire, no harm');
  assert.doesNotMatch(String(r.output?.mechanics || ''), /social:deceive|burn|hazard/i);
});

test('U675 controls: a REAL lie still routes socially, and the self-harm lane is untouched', () => {
  let w = boot();
  w = playerMove(w, PACKS, 'I go outside.').world;
  const lie = playerMove(w, PACKS, 'I lie to Elske Nightherd about who I am.');
  assert.match(String(lie.output?.mechanics || ''), /social:deceive|deceive/i,
    'real deception still deceives');

  const w2 = boot();
  const hpBefore = Number(w2.meta.escapeHp);
  const cut = playerMove(w2, PACKS, 'I cut my palm with my blade.');
  assert.ok(Number(cut.world.meta.escapeHp) < hpBefore, 'the self-harm wound lane is intact');
});
