// U642 — CARL-SELF-1 guard: self-identity is OPT-IN, narrow, and vault-safe.
//
// The proud-affirmation path (U641) must not bleed into NPCs that were never given
// an authored nature, must not fire on off-identity asks, and must never crack a
// personal secret. Four guards:
//   A) matchesSelfIdentity is inert without species/selfConcept, and precise —
//      it fires on identity FRAMES only ("are you a chicken", "what are you"), not
//      on soapbox-topic / trade / foil asks, and is contraction-safe.
//   B) an ordinary minted NPC (no authored nature) is byte-unchanged — asked
//      "what are you?" it behaves exactly as before, never affirming a species.
//   C) SOAPBOX-1 intact — Carl's "tell me about chickens" still evangelizes the
//      CAUSE (generic), distinct from the identity affirmation.
//   D) the identity affirmation opens no vault — it shares no stored fact, and a
//      self-aware NPC with a personal secret still withholds that secret.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginDialogue, askNpc } from '../engine/npc/dialogue.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';
import { matchesSelfIdentity } from '../engine/npc/npcBrain.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { PRE_ROLLED, buildPreRolledCharacter } from '../engine/chargen/preRolled.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

// ── A) matchesSelfIdentity — opt-in + precise ───────────────────────────────

const CHICK = { species: 'chicken' };
const CONCEPT = { selfConcept: 'a being who knows what it is' };
const AFFIRM_TXT = /\bI am (?:the|a) chicken\b/i;

test('U642A: matchesSelfIdentity is INERT without an authored nature', () => {
  assert.equal(matchesSelfIdentity({}, 'are you a chicken?'), false, 'no species/selfConcept → never fires');
  assert.equal(matchesSelfIdentity({}, 'what are you?'), false);
  assert.equal(matchesSelfIdentity(null, 'what are you?'), false, 'null npc is safe');
  assert.equal(matchesSelfIdentity(CHICK, ''), false, 'empty input never fires');
});

test('U642A: fires on identity FRAMES only, for a self-aware NPC', () => {
  // Closed + open identity questions → fire.
  assert.equal(matchesSelfIdentity(CHICK, 'are you a chicken?'), true);
  assert.equal(matchesSelfIdentity(CHICK, 'are you a bird?'), true);
  assert.equal(matchesSelfIdentity(CHICK, 'Are you a HEN?'), true, 'case-insensitive');
  assert.equal(matchesSelfIdentity(CHICK, "you're a chicken, aren't you?"), true, 'assertion form (contraction split)');
  assert.equal(matchesSelfIdentity(CHICK, 'what are you?'), true);
  assert.equal(matchesSelfIdentity(CHICK, 'what kind of creature are you?'), true);
  assert.equal(matchesSelfIdentity(CONCEPT, 'what are you?'), true, 'selfConcept answers the open question');
});

test('U642A: does NOT fire on soapbox-topic / trade / foil / open-verb asks', () => {
  assert.equal(matchesSelfIdentity(CHICK, 'tell me about chickens'), false, 'soapbox topic, not identity');
  assert.equal(matchesSelfIdentity(CHICK, 'are you selling chickens?'), false, 'trade, not identity');
  assert.equal(matchesSelfIdentity(CHICK, 'do you like chickens?'), false);
  assert.equal(matchesSelfIdentity(CHICK, 'are you a duck?'), false, 'a chicken is no duck (foil)');
  assert.equal(matchesSelfIdentity(CHICK, 'what are you doing?'), false, 'open verb, not identity');
  assert.equal(matchesSelfIdentity(CHICK, 'what are you selling?'), false);
  assert.equal(matchesSelfIdentity(CHICK, "isn't the weather fine?"), false, 'contraction pitfall stays shut');
  assert.equal(matchesSelfIdentity(CONCEPT, 'are you a chicken?'), false, 'selfConcept alone claims no species');
});

// ── B) an ordinary minted NPC is byte-unchanged ─────────────────────────────

function makeWorldWithSettlement(seed = 'u642-seed') {
  let w = newWorld({ seed, fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } });
  const nodeId = w.map.nodes.filter(n => n.nodeType === 'settlement')[0].id;
  w = { ...w, map: { ...w.map, currentNodeId: nodeId } };
  const pack = { objectives: ['survive'], factionPool: [{ id: 'civic', type: 'civic' }] };
  w = decompressAndCanonizeSync(w, nodeId, pack);
  return { w, nodeId };
}
const npcsAt = (w, nodeId) => w.map.nodes.find(n => n.id === nodeId).settlement.npcs;

test('U642B: an ordinary minted NPC has no authored nature and never affirms one', () => {
  const { w, nodeId } = makeWorldWithSettlement();
  const npc0 = npcsAt(w, nodeId)[0];
  assert.equal('species' in npc0, false, 'minted NPCs carry no species (opt-in only)');
  assert.equal('selfConcept' in npc0, false, 'minted NPCs carry no selfConcept');
  assert.equal(matchesSelfIdentity(npc0, 'what are you?'), false, 'the gate is closed for ordinary NPCs');

  const { world: w1 } = beginDialogue(w, npc0.id);
  const { outcome } = askNpc(w1, 'what are you?');
  assert.equal(outcome.selfAffirm, false, 'ordinary NPC never sets selfAffirm');
  assert.doesNotMatch(String(outcome.factBody || ''), AFFIRM_TXT, 'no fabricated chicken identity');
});

// ── C) SOAPBOX-1 preserved (Carl still preaches the CAUSE off-identity) ──────

function bootAtCarl() {
  const pc = buildPreRolledCharacter(PRE_ROLLED.find(e => /bryn/i.test(e.name || e.id)));
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  let { world } = beginAdventure(ensureWorld({ ...w0, party: [pc] }), PACKS);
  return playerMove(world, PACKS, 'go outside').world;
}

test('U642C: Carl "tell me about chickens" still evangelizes the CAUSE, not the identity', () => {
  let world = bootAtCarl();
  world = playerMove(world, PACKS, 'go talk to Carl').world;
  const ask = playerMove(world, PACKS, 'tell me about chickens');
  const mech = String(ask.output?.mechanics || '');
  const narr = String(ask.output?.narration || '');
  assert.match(mech, /dialogue ask \| evangelize/, 'the cause still evangelizes (SOAPBOX-1 intact)');
  assert.doesNotMatch(narr, AFFIRM_TXT, 'a TOPIC ask is not an identity claim — no "I am a chicken"');
  assert.match(narr, /avian supremacy/i, 'he holds forth on the cause');
});

// ── D) the affirmation opens no vault ───────────────────────────────────────

test('U642D: Carl\'s identity affirmation shares no stored fact (opens no vault)', () => {
  let world = bootAtCarl();
  world = playerMove(world, PACKS, 'go talk to Carl').world;
  const ask = playerMove(world, PACKS, 'are you a chicken?');
  const mech = String(ask.output?.mechanics || '');
  // A shared fact would add a "| <factId>" segment; the affirmation adds none.
  assert.match(mech, /^\[dialogue ask \| evangelize \| trust:\d+\]$/, `pure voice turn, no fact shared (mech="${mech}")`);
});

test('U642D: a self-aware NPC with a personal secret still WITHHOLDS it', () => {
  const { w, nodeId } = makeWorldWithSettlement('u642-secret');
  const node = w.map.nodes.find(n => n.id === nodeId);
  const SECRET_BODY = 'HE-WAS-RUN-OUT-OF-THE-LAST-TOWN';
  // Make the first NPC a self-aware chicken who ALSO guards a personal secret.
  const npcs = node.settlement.npcs.map((n, i) => {
    if (i !== 0) return n;
    return {
      ...n,
      species: 'chicken',
      selfConcept: 'a chicken who knows it',
      conversationState: { ...n.conversationState, trustLevel: 0 },
      secrets: [...(n.secrets || []), 'sec_shame'],
      knowledgeGraph: [...(n.knowledgeGraph || []), { factId: 'sec_shame', body: SECRET_BODY, kind: 'secret', keywords: ['shame', 'town'] }],
    };
  });
  const w2 = { ...w, map: { ...w.map, nodes: w.map.nodes.map(n => n.id === nodeId ? { ...n, settlement: { ...n.settlement, npcs } } : n) } };

  const { world: wd } = beginDialogue(w2, npcs[0].id);

  // Identity question → proudly affirms species, but the secret body never surfaces.
  const affirm = askNpc(wd, 'what are you?');
  assert.equal(affirm.outcome.selfAffirm, true, 'the self-aware NPC affirms its nature');
  assert.equal(affirm.outcome.factId || '', '', 'the affirmation shares no fact id');
  assert.notEqual(affirm.outcome.mode, 'shared', 'affirming a nature is never a fact-share');

  // And a direct probe of the secret at trust 0 does NOT reveal it. factId proves
  // the secret topic WAS matched (non-vacuous); mode !== 'shared' proves it is sealed
  // (withheld/lied both refuse to speak the body — only 'shared' would leak it).
  const probe = askNpc(wd, 'tell me your shame about the town');
  assert.equal(probe.outcome.factId, 'sec_shame', 'the secret topic was matched (non-vacuous probe)');
  assert.notEqual(probe.outcome.mode, 'shared', 'the personal secret stays sealed at trust 0 — the vault holds');
  assert.equal(probe.outcome.selfAffirm, false, 'a secret probe is never hijacked by the identity path');
});
