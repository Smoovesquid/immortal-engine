// U231 — gate-14 full-panel (confused-newbie t4): "Who's the elder?" must identify the
// PRESENT NPC whose role matches the asked role (Kael, role=elder) — not whichever NPC
// happens to be first in the settlement roster (Corwin, role=representative).
//
// ROOT CAUSE (deterministic): META_NPC_OBSERVER's noun list includes role words
// (guard/merchant/trader/elder) alongside generic descriptors (stranger/figure/...).
// personQuery.js already resolves role nouns correctly EXCEPT "elder" — it deliberately
// defers "elder" (PERSON_DEFER_RE, W-4/W-5 leadership-deferral, since "elder" collides
// with leadership/authority questions), so "who is the elder" falls through to
// gracefulAdjudication.js's NPC-observer branch, which picked sociablePool[0] (the first
// non-hostile NPC) with no role match at all.
//
// Fix: when the asked noun is an actual role word, look up the present NPC whose role
// matches it and answer with THAT NPC; no present role-holder → an honest decline, never
// a wrong-NPC guess. Distinct from a leadership/authority ask ("who's in charge", "who
// leads this place?") — those never match META_NPC_OBSERVER (no "leader"/"chief"/
// "charge" token in its noun list) and stay deferred to W-5, unaffected by this fix.
//
// Sibling to U219 (ungrounded named referent) and U228 (empty-success siblings) — same
// council-world fixture shape (Kael=elder, Corwin=representative, Tove=settler).

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['village'], starterObjectives: ['survive'],
    skills: ['force'], locations: ['village'], objectives: ['survive'],
    complications: ['danger'], npcArchetypes: ['baker'], sensoryMotifs: ['flour']
  }
};

function worldWith(npcs) {
  const base = beginAdventure(newWorld({
    seed: 'u231', fate: 0.3, campaignId: 'u231', mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
  const node = {
    id: 'u231_settlement', name: "Pilgrim's Rest Test Village", nodeType: 'settlement', discovered: true,
    settlement: { npcs: npcs.map(n => ({ conversationState: { trustLevel: 4 }, ...n })) }
  };
  return ensureWorld({
    ...base,
    map: { ...base.map, currentNodeId: node.id, nodes: [...(base.map?.nodes || []), node] },
    scene: { ...(base.scene || {}), interior: null, dialogue: null }
  });
}

// Corwin (representative) is FIRST in the roster, Kael (elder) is second — the exact
// ordering that triggered the gate failure (first-NPC-wins instead of role-match).
function councilWorld() {
  return worldWith([
    { id: 'npc_corwin', name: 'Corwin Boneknit', role: 'representative', hostile: false },
    { id: 'npc_kael', name: 'Kael', role: 'elder', hostile: false },
    { id: 'npc_brae', name: 'Brae', role: 'smith', hostile: false },
    { id: 'npc_tove', name: 'Tove', role: 'settler', hostile: false }
  ]);
}

function surfaceOf(result) {
  return `${result.output?.narration || ''} ${result.output?.mechanics || ''}`;
}

// ── Required positives ───────────────────────────────────────────────────────

test('U231-01: "who is the elder?" identifies the present elder (Kael), not the first NPC', () => {
  const r = playerMove(councilWorld(), PACKS, "Who's the elder?");
  const surface = surfaceOf(r);
  assert.match(surface, /\bKael\b/, `must name the present elder: ${surface}`);
  assert.doesNotMatch(surface, /Corwin/i, `must not answer with the wrong (first) NPC: ${surface}`);
});

test('U231-02: "who is the smith?" identifies the present smith (Brae)', () => {
  const r = playerMove(councilWorld(), PACKS, 'Who is the smith?');
  const surface = surfaceOf(r);
  assert.match(surface, /\bBrae\b/, `must name the present smith: ${surface}`);
});

// ── Required negatives ───────────────────────────────────────────────────────

test('U231-03: "who is the elder?" with no present elder honestly declines, not a wrong NPC', () => {
  const noElder = worldWith([
    { id: 'npc_corwin', name: 'Corwin Boneknit', role: 'representative', hostile: false }
  ]);
  const r = playerMove(noElder, PACKS, "Who's the elder?");
  const surface = surfaceOf(r);
  assert.doesNotMatch(surface, /Corwin/i, `must not guess a wrong NPC: ${surface}`);
  assert.match(surface, /no elder/i, `must honestly decline: ${surface}`);
});

test('U231-04: "who\'s in charge here?" stays deferred (W-5), not answered by this branch', () => {
  const r = playerMove(councilWorld(), PACKS, "Who's in charge here?");
  const surface = surfaceOf(r);
  // A leadership/authority ask must not be served as an NPC-identity answer —
  // it still rolls (the existing W-5 deferral path), not a "the elder" identity line.
  assert.doesNotMatch(surface, /the elder —|the representative —/i, `must not be answered as NPC-identity: ${surface}`);
});

test('U231-05: a by-name query ("who is Corwin?") is unaffected', () => {
  const r = playerMove(councilWorld(), PACKS, 'Who is Corwin?');
  const surface = surfaceOf(r);
  assert.match(surface, /Corwin/i, `named query must still resolve to the named NPC: ${surface}`);
});
