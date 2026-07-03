// U383 — INT-2R-u: a junk `kind` on an LLM-proposed packet must NEVER hijack
// the turn.
//
// The 07-03 live bug: playerMove derived the shared question-verdict from ANY
// truthy packet.kind — so a small model stamping kind:'string'/'action' on an
// ordinary action sentence ("Smash the window") routed the turn into the
// question machinery, which resolved as a silent no-op ("everything I type
// does nothing"). Two deterministic guards close it, both tested here:
//   1. grounding (groundPacket.js) whitelists `kind` to the classifier's own
//      vocabulary — anything else grounds to null;
//   2. playerMove honors a (legal) kind only when the text is question-shaped
//      (isQuestionShaped) — the LLM proposes, the engine validates.
//
// Zero network: packets are hand-made; no provider is consulted.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { groundPacket } from '../engine/intent/groundPacket.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

const BUNDLE = {
  entities: [{ id: 'goblin_1', name: 'goblin', ref: null }],
  abilities: ['Worn Blade'],
  spells: [],
  items: ['torch']
};

test('U383: grounding whitelists kind — junk values ground to null, legal ones survive', () => {
  for (const junk of ['string', 'action', 'move', 'ATTACK', 7, {}, 'question']) {
    const g = groundPacket({ verb: 'attack', target: 'goblin', kind: junk, text: 'Smash the window' }, BUNDLE);
    assert.ok(g, `packet with junk kind ${JSON.stringify(junk)} must still survive grounding`);
    assert.equal(g.kind, null, `junk kind ${JSON.stringify(junk)} must ground to null, not pass through`);
  }
  for (const legal of ['npc-addressed', 'rules', 'referent-followup', 'place']) {
    const g = groundPacket({ verb: 'talk', kind: legal, text: 'who lit the lantern?' }, BUNDLE);
    assert.equal(g.kind, legal, `legal classifier kind '${legal}' must survive grounding`);
  }
});

test('U383: a legal-kind packet on an ACTION sentence cannot hijack the turn — output matches the packet-less turn', () => {
  const w = boot();
  const text = 'Smash the window';
  // kind:'place' is LEGAL vocabulary — the hallucination case grounding alone
  // cannot catch. The isQuestionShaped gate in playerMove must refuse it
  // because the sentence is not a question.
  const hijacker = { source: 'llm', verb: 'use', kind: 'place', text, targets: [], objects: [], compoundParts: [] };
  const bare = playerMove(w, PACKS, text);
  const withPacket = playerMove(w, PACKS, text, { llmPacket: hijacker });
  assert.equal(
    String(withPacket.output?.narration || ''),
    String(bare.output?.narration || ''),
    'an action sentence must resolve identically with or without a question-kind packet riding along'
  );
  assert.equal(
    String(withPacket.output?.mechanics || ''),
    String(bare.output?.mechanics || ''),
    'mechanics must match too — the window still breaks'
  );
});

test('U383: a legal-kind packet on a QUESTION sentence is honored — the ear can still steer real questions', () => {
  const w = boot();
  const text = 'who lit that lantern?';
  const packet = { source: 'llm', verb: 'ask', kind: 'place', text, targets: [], objects: [], compoundParts: [] };
  const res = playerMove(w, PACKS, text, { llmPacket: packet });
  assert.ok(res && res.world, 'question turn with a kind-bearing packet must resolve without throwing');
  assert.ok(String(res.output?.narration || '').length > 0, 'question turn must produce narration');
});
