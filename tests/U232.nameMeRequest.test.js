// U232 — gate-14 full-panel (lore-hound t4): "Corwin, name me one other old family in
// Pilgrim's Rest besides the Boneknits." rolled a success and returned the gen:s filler
// ("You manage it, and the way ahead opens a little.") instead of resolving the
// player's fact demand.
//
// ROOT CAUSE (deterministic): isInfoSeekingText had no anchor for the "name me <X>"
// request shape — no who/what/when/where opener (INFO_SEEKING_RE), no "give me (a/one/
// the) name" shape, no topic-recall verb phrase. It fell through every sub-RE to a
// generic WITS roll, whose success then hit genericGroundedOutcome's atmosphere-only
// pool. Fix: INFO_SEEKING_NAME_ME_RE anchors "name me one/another/a/an/the <X>" and
// routes it into the existing deliver-or-decline contract (delivers a grounded name if
// canon holds one, honestly declines if not — never inventing a family name, EK-1).
//
// Pure assertion on the exported genericGroundedOutcome + isInfoSeekingText — no LLM,
// deterministic. Sibling to U228 (THE_REF-3 empty-success siblings) — same council-world
// fixture shape (Kael=elder, Corwin=representative).

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, genericGroundedOutcome } from '../engine/playloop.js';
import { isInfoSeekingText } from '../engine/grace/gracefulAdjudication.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['village'], starterObjectives: ['survive'],
    skills: ['force'], locations: ['village'], objectives: ['survive'],
    complications: ['danger'], npcArchetypes: ['baker'], sensoryMotifs: ['flour']
  }
};

function councilWorld() {
  const base = beginAdventure(newWorld({
    seed: 'u232', fate: 0.3, campaignId: 'u232', mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
  const node = {
    id: 'u232_settlement', name: "Pilgrim's Rest Test Village", nodeType: 'settlement', discovered: true,
    settlement: {
      npcs: [
        { id: 'npc_kael', name: 'Kael', role: 'elder', hostile: false },
        { id: 'npc_corwin', name: 'Corwin Boneknit', role: 'representative', hostile: false }
      ].map(n => ({ conversationState: { trustLevel: 4 }, ...n }))
    }
  };
  return ensureWorld({
    ...base,
    map: { ...base.map, currentNodeId: node.id, nodes: [...(base.map?.nodes || []), node] },
    scene: { ...(base.scene || {}), interior: null, dialogue: null }
  });
}

const GEN_S_RE = /goes your way|comes off cleanly|way ahead opens a little/i;
const ggoSuccess = (text) => genericGroundedOutcome(councilWorld(), text, 'success');

// ── Required positives ───────────────────────────────────────────────────────

test('U232-01: "name me one other old family…" is recognized as info-seeking', () => {
  assert.equal(isInfoSeekingText("Corwin, name me one other old family in Pilgrim's Rest besides the Boneknits."), true);
});

test('U232-02: "give me the name of another founding family" is recognized as info-seeking', () => {
  assert.equal(isInfoSeekingText('Give me the name of another founding family.'), true);
});

test('U232-03: the "name me…" success is NOT the gen:s empty-success filler', () => {
  const out = ggoSuccess("Corwin, name me one other old family in Pilgrim's Rest besides the Boneknits.");
  assert.doesNotMatch(out, GEN_S_RE, `succeeded name-demand must not be "it goes your way": ${out}`);
});

test('U232-04: an ungrounded family-name demand honestly declines, never invents a name (EK-1)', () => {
  const out = ggoSuccess("Corwin, name me one other old family in Pilgrim's Rest besides the Boneknits.");
  assert.doesNotMatch(out, GEN_S_RE);
  assert.match(out, /can'?t say|no record|wouldn'?t know|nobody'?s ever told|can'?t rightly say|lost to me|not (?:written|recorded)|don'?t have it/i,
    `must honestly decline the ungrounded name: ${out}`);
  // No fabricated family name on the success path.
  assert.doesNotMatch(out, /\b[A-Z][a-z]+(?:son|ford|wick|stead|holt|mere|wright)\b/,
    `must not invent a plausible-sounding family name: ${out}`);
});

// ── Required negatives — diverge cases must stay unaffected ────────────────

test('U232-10: "name your price" is NOT swept into info-seeking', () => {
  assert.equal(isInfoSeekingText('Name your price.'), false);
});

test('U232-11: "name the time" is NOT swept into info-seeking', () => {
  assert.equal(isInfoSeekingText('Name the time and place.'), false);
});

test('U232-12: an ordinary grounded ask ("who founded this village?") stays handled as before', () => {
  assert.equal(isInfoSeekingText('Who founded this village?'), true);
});
