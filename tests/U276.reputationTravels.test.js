// U276 — reputation that travels (W2·3 / Morality M2, the Codex lane taken in-house).
// A notable ATROCITY the player commits in one place becomes a rumor that reaches the
// next (engine/rumor/rumorsReaching.js, the W1·3 producer). engine/npc/reputation.js
// reads that traveled gossip; the dialogue greeting then turns wary and KNOWING — a
// stranger receives you differently because they've "heard about you." DISCOVERED in
// the fiction (the greeting just changes), never a "reputation −N" meter
// (memory/project_obscure_goals_no_quest_log.md). A clean player is byte-identical to
// before — the branch only fires for the notorious.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { notorietyReaching } from '../engine/npc/reputation.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

// An atrocity committed at a DIFFERENT node than where we now stand → it "traveled"
// (rumorsReaching grades it tier 2, heard secondhand).
const ATROCITY = {
  t: 1, actorId: 'party', kind: 'cruelty', severity: 60, witnesses: ['npc_w'],
  nodeId: 'far_hollow', summary: 'put the granary at Dunmoor to the torch with folk still inside',
};
const KINDNESS = { ...ATROCITY, kind: 'mercy', summary: 'pulled three children from the flood at Dunmoor' };

function setup(seed = 'u276', deeds = null) {
  const outside = playerMove(
    beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u276-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world,
    packs, 'go outside'
  ).world;
  const w = deeds ? ensureWorld({ ...outside, deeds }) : outside;
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npc = (here.settlement?.npcs || []).find(n => n && n.name && !n.hostile);
  assert.ok(npc, 'a stranger lives at the start node');
  const base = playerMove(w, packs, `talk to ${npc.name}`).world;
  return { w, here, npc, base };
}

const KNOWING_RE = /heard about you|word (?:came|travels|reached)|know (?:who you are|your name)|so you're the one|we heard/i;

test('U276-01: notorietyReaching — clean = unheard, a traveled atrocity = heard', () => {
  const clean = setup('u276');
  assert.equal(notorietyReaching(clean.w, clean.here.id).heard, false, 'a clean name is unheard');

  const notorious = setup('u276', [ATROCITY]);
  const n = notorietyReaching(notorious.w, notorious.here.id);
  assert.equal(n.heard, true, 'the atrocity reached this town');
  assert.ok(n.score > 0, 'with a non-zero notoriety');
});

test('U276-02: only ATROCITIES travel as notoriety — a mercy does not sour a greeting', () => {
  const kind = setup('u276', [KINDNESS]);
  assert.equal(notorietyReaching(kind.w, kind.here.id).heard, false, 'mercy is not notoriety');
});

test('U276-03: the stranger greets the notorious player KNOWINGLY; the clean player normally', () => {
  const clean = setup('u276');
  const cleanGreet = playerMove(clean.base, packs, 'hello').output.narration;
  assert.doesNotMatch(cleanGreet, KNOWING_RE, `a clean greeting is ordinary; got: ${cleanGreet}`);

  const notorious = setup('u276', [ATROCITY]);
  const r = playerMove(notorious.base, packs, 'hello');
  assert.match(r.output.narration, KNOWING_RE, `the notorious are received knowingly; got: ${r.output.narration}`);
  assert.ok(r.world.scene?.dialogue, 'still a conversation');
  assertWorldInvariants(r.world);
});

test('U276-04: no popup/meter — the shift is DISCOVERED, not announced', () => {
  const notorious = setup('u276', [ATROCITY]);
  const r = playerMove(notorious.base, packs, 'hello');
  assert.doesNotMatch(r.output.narration, /reputation\s*[-−:]\s*\d|notoriety|\[reputation/i, 'no meter leaks');
  // §0: a deed-reputation must never drag in cosmology.
  assert.doesNotMatch(r.output.narration, /\b(?:orb|substrate|cataclysm|the fade)\b/i, 'no hidden-why');
});

test('U276-05: deterministic — same notorious greeting twice is identical', () => {
  const a = setup('u276', [ATROCITY]);
  const b = setup('u276', [ATROCITY]);
  assert.equal(
    playerMove(a.base, packs, 'hello').output.narration,
    playerMove(b.base, packs, 'hello').output.narration
  );
});
