// U195 — H-34 NPC-roster grounding (post-H-31/H-32 gate residual).
//
// R1 (engine/playloop.js)              — META_RECAP's unanchored "what happened"
//                                          swallows a direct historical question put
//                                          TO a present, named NPC before dialogue/
//                                          social routing ever sees it.
// R2a (engine/grace/gracefulAdjudication.js) — NPC-roster under-reporting: no general
//                                          "who's here" handler, and a real lurking
//                                          NPC gets denied outright instead of
//                                          acknowledged.
// R2b (engine/llmAdapter.js)            — CANON_HALLUCINATION: polish confidently
//                                          confirms the presence/arrival of a
//                                          specific role/species entity that exists
//                                          nowhere in the real NPC roster.
//
// Each rule's catch case is paired with a false-positive guard — the discipline
// this repo holds itself to for every grounding rule (mirrors U190/U192).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { validateNarrationCandidate, collectRosterTokens } from '../engine/llmAdapter.js';

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}
const packs = loadPacks();

// ── R1 fixtures — a real, named, present NPC out of combat/dialogue ────────

function withCorwin(seed) {
  let w = beginAdventure(newWorld({
    seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
  const nodeId = String(w.map?.currentNodeId ?? '');
  const nodes = Array.isArray(w.map?.nodes) ? [...w.map.nodes] : [];
  const idx = nodes.findIndex(n => n && n.id === nodeId);
  assert.ok(idx >= 0, 'test world has a current node');
  const node = nodes[idx];
  nodes[idx] = {
    ...node,
    settlement: {
      ...(node.settlement || {}),
      decompressed: true,
      npcs: [{
        id: 'npc_corwin', name: 'Corwin', role: 'healer', hostile: false,
        combatProfile: { maxHp: 20, damage: 1, canParley: false },
        personality: {}, conversationState: { metPlayer: false, trustLevel: 5, topicsDiscussed: [] },
        knowledgeGraph: [], secrets: []
      }]
    }
  };
  return ensureWorld({ ...w, map: { ...w.map, nodes } });
}

test('U195-01: R1 catch — a direct historical question addressed to a present NPC is not swallowed by the recap dead-end', () => {
  const w = withCorwin('glass-harbor-u195-1');
  assert.equal(w.combat?.active, false, 'sanity: out of combat');
  assert.equal(w.scene?.dialogue, null, 'sanity: out of dialogue');
  const out = playerMove(w, packs, 'What happened twelve years ago that made you settle here, Corwin?').output;
  assert.doesNotMatch(String(out.narration), /Nothing's happened yet/i,
    `must not fall to the bare recap dead-end: ${out.narration}`);
});

test('U195-02: R1 catch — a different recap-shaped phrasing addressed by name is also not swallowed', () => {
  const w = withCorwin('glass-harbor-u195-2');
  const out = playerMove(w, packs, 'What happened with the harvest this year, Corwin?').output;
  assert.doesNotMatch(String(out.narration), /Nothing's happened yet/i,
    `must not fall to the bare recap dead-end: ${out.narration}`);
});

test('U195-03: R1 false-positive guard — a genuine recap with no NPC addressed still gets the recap answer', () => {
  const w = withCorwin('glass-harbor-u195-3');
  const out = playerMove(w, packs, 'What happened? What did I just do?').output;
  assert.match(String(out.narration), /Nothing's happened yet/i,
    `a real recap ask with no NPC named must still recap: ${out.narration}`);
});

// ── R2a — NPC-roster grounding (gracefulAdjudication.js) ────────────────────

function rosterWorld(npcs) {
  return {
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { npcs } }] },
    party: [{ stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }]
  };
}

const SOCIABLE_NPCS = [{ id: 'corwin', name: 'Corwin', role: 'representative', hostile: false }];
const LURKER_NPCS = [{ id: 'lingerer', name: 'the Lingerer', role: 'stranger', hostile: true }];
const MIXED_NPCS = [...SOCIABLE_NPCS, ...LURKER_NPCS];

test('U195-10: R2a catch — "who are all these people?" lists the real roster instead of a generic non-answer', () => {
  const world = rosterWorld(MIXED_NPCS);
  const text = 'Um, who are all these people? Should I know them?';
  assert.equal(isMetaQuestion(text), true, 'must be recognized as a meta-question');
  const ans = handleMetaQuestion(text, world);
  // Earned knowledge for people: at a place you don't know (the player asks "should I know
  // them?"), the roster is delivered by ROLE, not name — but it IS a real roster, not a dodge.
  assert.match(ans, /right here/i, `must deliver the real roster (by role when unmet): ${ans}`);
  assert.doesNotMatch(ans, /yours to call|go with your gut/i, `must not be the generic advice non-answer: ${ans}`);
});

test('U195-11: R2a catch — "look at the stranger watching from the edges" acknowledges a real lurker instead of denying one', () => {
  const world = rosterWorld(LURKER_NPCS);
  const text = 'Okay, can I just look at the stranger watching from the edges?';
  assert.equal(isMetaQuestion(text), true, 'must be recognized as a meta-question');
  const ans = handleMetaQuestion(text, world);
  assert.doesNotMatch(ans, /no stranger lurks here/i, `must not deny a real lurking NPC: ${ans}`);
  assert.match(ans, /watching|edges/i, `must acknowledge someone is there: ${ans}`);
});

test('U195-12: R2a false-positive guard — a genuine advice question with no roster framing still gets the advice answer', () => {
  const world = rosterWorld(SOCIABLE_NPCS);
  const text = 'Should I talk to them, or is that a bad idea?';
  const ans = handleMetaQuestion(text, world);
  assert.match(ans, /worth a try|yours to call/i, `must still be the advice answer, unrelated to roster framing: ${ans}`);
});

test('U195-13: R2a false-positive guard — a genuine recap with no roster/NPC framing still recaps', () => {
  const world = rosterWorld(SOCIABLE_NPCS);
  world.conversation = { lastNarration: null };
  const ans = handleMetaQuestion('What happened? What did I just do?', world);
  assert.match(ans, /Nothing's happened yet/i, `must still be the recap answer: ${ans}`);
});

test('U195-14: R2a — with nobody present at all, the roster query answers honestly instead of inventing anyone', () => {
  const world = rosterWorld([]);
  const ans = handleMetaQuestion("Who's everyone here?", world);
  assert.match(ans, /no one/i, `must honestly report nobody's there: ${ans}`);
});

// ── R2b — CANON_HALLUCINATION (llmAdapter.js) ───────────────────────────────

const PLACE = "Pilgrim's Rest Village";
function rosterCtx(npcs = [{ name: 'Corwin Boneknit', role: 'representative' }]) {
  return { placeName: PLACE, location: PLACE, settlement: { npcs }, placeChunks: [] };
}
function rosterWorldFull() {
  return {
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', name: PLACE, nodeType: 'settlement' }] },
    scene: { location: PLACE, objective: '' },
    ledger: { facts: [] },
    combat: null
  };
}
function run(cand, opts = {}) {
  return validateNarrationCandidate(rosterWorldFull(), cand, {
    baseNarration: opts.base ?? cand,
    ctx: opts.ctx ?? rosterCtx()
  });
}

test('U195-20: R2b catch — confirms a wizard\'s arrival when no wizard exists anywhere in the NPC roster', () => {
  const base = `Your sharp eyes search the road beyond ${PLACE}, but it lies empty.`;
  const cand = `Your sharp eyes trace the wizard's path back through the open doorway to the road beyond, here at ${PLACE}, and he came from the east, not long ago.`;
  assert.equal(run(cand, { base }), false, 'must reject confirming an ungrounded entity\'s presence/origin');
});

test('U195-21: R2b false-positive guard — a real roster NPC mentioned by name passes unchanged', () => {
  const cand = `Corwin Boneknit nods at you from across the square at ${PLACE}.`;
  assert.equal(run(cand), true, 'a grounded NPC reference must not be flagged');
});

test('U195-22: R2b false-positive guard — a real roster NPC described by a generic synonym (not the curated role list) passes', () => {
  // Canon role is "elder"; the polish calls them "the old man" — a generic human
  // descriptor, not a specific occupation/species noun, so it's exempt by design
  // (the same synonym-tolerance Rules 4a/4b/4c hold for kinship/age/defeat claims).
  const ctx = rosterCtx([{ name: 'Maren', role: 'elder' }]);
  const cand = `The old man waves you over from the well at ${PLACE}.`;
  assert.equal(run(cand, { ctx }), true, 'a generic descriptor synonym for a real NPC must not be flagged');
});

test('U195-23: R2b false-positive guard — an explicit denial mentioning the role noun passes', () => {
  const cand = `No wizard answers your call here at ${PLACE}, only silence.`;
  assert.equal(run(cand), true, 'a denial must not be treated as a confirmation');
});

test('U195-24: R2b false-positive guard — a hypothetical mention passes', () => {
  const cand = `You wonder if a wizard showed up at ${PLACE}, things might be different.`;
  assert.equal(run(cand), true, 'a hypothetical/conditional mention must not be treated as a confirmation');
});

test('U195-25: R2b false-positive guard — a role noun that IS the real roster NPC, confirmed present, passes', () => {
  const ctx = rosterCtx([{ name: 'Old Tamsin', role: 'wizard' }]);
  const cand = `The wizard speaks at last, here at ${PLACE}, her voice low and certain.`;
  assert.equal(run(cand, { ctx }), true, 'a real roster entity confirmed present must not be flagged');
});

test('U195-26: R2b false-positive guard — base narration already grounds the same entity', () => {
  const base = `A wizard speaks from the doorway of ${PLACE}, voice low and certain.`;
  const cand = `A wizard speaks from the doorway of ${PLACE}, his voice low and certain, and waits for your answer.`;
  assert.equal(run(cand, { base }), true, 'an entity already present in the grounded base must not be flagged');
});

// ── collectRosterTokens helper ──────────────────────────────────────────────

test('U195-30: collectRosterTokens gathers names and roles from ctx.settlement.npcs, tokenized per word', () => {
  const ctx = rosterCtx([{ name: 'Old Gerren', role: 'village elder' }]);
  const tokens = collectRosterTokens(rosterWorldFull(), ctx);
  for (const t of ['old', 'gerren', 'village', 'elder']) {
    assert.ok(tokens.has(t), `expected token "${t}" in roster set`);
  }
});

test('U195-31: collectRosterTokens never throws on missing/malformed input', () => {
  assert.doesNotThrow(() => collectRosterTokens(null, null));
  assert.doesNotThrow(() => collectRosterTokens(undefined, undefined));
  const tokens = collectRosterTokens(null, null);
  assert.equal(tokens.size, 0);
});
