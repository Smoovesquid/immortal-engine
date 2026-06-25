// U275 — dialogue "who else lives here?" (W2·2, the Codex lane taken in-house 2026-06-24).
// A harness probe of the conversation slice found the dialogue layer already robust
// (the locked corpus C4/C9 encodes careful answer / deflect / withhold behaviour) —
// with ONE real gap: the `place` branch's regex matched "live here" / "lived here" but
// not the third-person "lives here", so "who else lives here?" fell through to a cagey
// withhold ("Couldn't say…") instead of the town's people-and-place answer that plain
// "who lives here?" already returns. The fix is a one-character regex widening
// (liv(?:e|ed) → liv(?:e|ed|es)); this locks the closed seam without disturbing the
// locked cases (C4-017 still answers with roles; C9-003 still deflects on privacy).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

function openDialogue(seed = 'u275') {
  const w0 = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u275-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  const outside = playerMove(w0, packs, 'go outside').world;
  const here = outside.map.nodes.find(n => n.id === outside.map.currentNodeId);
  const npc = (here?.settlement?.npcs || []).find(n => n && n.name && !n.hostile);
  assert.ok(npc, 'an NPC lives at the start node');
  const opened = playerMove(outside, packs, `talk to ${npc.name}`);
  assert.ok(opened.world.scene?.dialogue, 'dialogue opens');
  const others = (here.settlement?.npcs || [])
    .filter(n => n && n.name && !n.hostile && n.id !== npc.id)
    .map(n => String(n.name));
  return { base: opened.world, npcName: npc.name, here, others };
}

test('U275-01: "who else lives here?" is answered (place), not withheld', () => {
  const { base } = openDialogue();
  const r = playerMove(base, packs, 'who else lives here?');
  assert.ok(r.world.scene?.dialogue, 'still talking');
  assert.match(r.output.mechanics, /dialogue ask \| place/, 'routed to the place/people answer');
  assert.doesNotMatch(r.output.mechanics, /deflected/, 'not the cagey withhold');
  // It says something about the town/its folk — not a non-answer.
  assert.ok(/folk|find|live|small|hold|\bis\b/i.test(r.output.narration), `a real answer; got: ${r.output.narration}`);
  assertWorldInvariants(r.world);
});

test('U275-02: parity — "who else lives here?" matches plain "who lives here?" routing', () => {
  const { base } = openDialogue();
  const withElse = playerMove(base, packs, 'who else lives here?');
  const plain = playerMove(base, packs, 'who lives here?');
  // Both reach the place/people answer — the third-person "lives" no longer diverges.
  assert.match(plain.output.mechanics, /dialogue ask \| place/);
  assert.match(withElse.output.mechanics, /dialogue ask \| place/);
});

test('U275-03: deterministic — same ask, same answer', () => {
  const { base } = openDialogue();
  const a = playerMove(base, packs, 'who else lives here?');
  const b = playerMove(base, packs, 'who else lives here?');
  assert.equal(a.output.narration, b.output.narration, 'same words, same answer');
});

test('U275-04: §0 — the answer never leaks allegiance/secret/cosmology', () => {
  const { base } = openDialogue();
  const r = playerMove(base, packs, 'who else lives here?');
  assert.doesNotMatch(
    r.output.narration,
    /\b(?:allegiance|loyal to|the cult|secret|orb|substrate|cataclysm|conspir)/i,
    'common knowledge only — no hidden-why'
  );
});
