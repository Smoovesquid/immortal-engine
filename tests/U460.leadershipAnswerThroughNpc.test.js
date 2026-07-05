// U460 — ANS-2 (case 1): a "who runs / leads / is in charge of this place?" info-ask
// resolves THROUGH a present NPC, grounded in canon (the settlement's public
// leadership role), never a "no record" stonewall while the representative stands
// present. With NO plausible knower (no leadership role at the settlement) it
// honestly declines — never a fabrication (the DEFERRED-control slot, W-5 / U221).
//
// Opus gate 2026-07-04-3, Lore-hound: "Who runs this outpost, and how long have
// they held it?" → "no record of such things … the walls offer nothing" — while
// canon has Elske Nightherd (the outpost's REPRESENTATIVE) present and answerable.
//
// Fix: commonKnowledgeAnswer (dialogue.js) gains a PUBLIC-leadership branch, and
// isInfoSeekingText / directQuestionIntent recognize the leadership shape so it
// routes to the deliver-or-decline contract. Secret-control phrasings ("who
// secretly controls / really runs / pulls the strings") stay declined at the
// reveal sink (Biblioteca V12-13) — never leaked, never a blurb.
//
// Deterministic, LLM-off: ×2 identical boots resolve identically.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { commonKnowledgeAnswer } from '../engine/npc/dialogue.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const run = (text) => playerMove(boot(), PACKS, text).output;

// A "no record" stonewall = the DM denies the fact exists at all, rather than
// naming who holds authority here.
const STONEWALL_RE = /no record|walls offer nothing|whoever shaped this place left no answer|nothing to fill the gap/i;

test('U460: precondition — the tallow outpost has a present representative (Elske) and a non-leadership guard (Asha)', () => {
  const w = boot();
  const npcs = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId)?.settlement?.npcs || [];
  assert.ok(npcs.some(n => String(n.role).toLowerCase() === 'representative' && !n.hostile), 'a representative is present');
  assert.ok(npcs.some(n => String(n.role).toLowerCase() === 'guard' && !n.hostile), 'a non-leadership guard is present');
});

test('U460-01: "Who runs this outpost, and how long have they held it?" answers from canon — the representative — not a "no record" stonewall', () => {
  const out = run('Who runs this outpost, and how long have they held it?');
  const narr = String(out.narration);
  assert.doesNotMatch(narr, STONEWALL_RE, 'never a "no record" stonewall while the representative is present');
  assert.match(narr, /representative/i, 'the public leadership role is surfaced from canon');
});

test('U460-02: "who is in charge here?" (the "charge" collision) resolves as a leadership answer, not a rolled force action or a room survey', () => {
  const out = run('who is in charge here?');
  const narr = String(out.narration);
  assert.doesNotMatch(narr, STONEWALL_RE, 'not stonewalled');
  assert.doesNotMatch(String(out.mechanics), /approach:force/i, '"charge" is not read as the attack verb');
  assert.match(narr, /representative/i, 'names the public role-holder');
});

test('U460-03: a non-leadership present NPC names the known leader (answered THROUGH an NPC, grounded)', () => {
  const w = boot();
  const asha = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId).settlement.npcs.find(n => String(n.role).toLowerCase() === 'guard' && !n.hostile);
  const r = commonKnowledgeAnswer(w, asha, 'who runs this place?');
  assert.ok(r && r.mode === 'leadership', 'answered via the leadership branch');
  assert.match(r.body, /Elske Nightherd/i, 'names the actual representative, grounded in canon');
  assert.doesNotMatch(r.body, /\[roll:/, 'common knowledge is never rolled');
});

test('U460-04: NO plausible knower — a settlement with no leadership role honestly DECLINES (no fabrication)', () => {
  // Build a settlement whose present NPCs hold only non-leadership roles.
  const base = boot();
  const w = structuredClone(base);
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  // Demote EVERY leadership-capable role (representative, innkeeper, …) to a plain
  // laborer — a settlement where genuinely no one holds authority.
  const LEADERSHIP = new Set(['representative', 'elder', 'headman', 'chief', 'chieftain', 'reeve', 'warden', 'steward', 'mayor', 'matriarch', 'patriarch', 'innkeeper']);
  node.settlement.npcs = node.settlement.npcs
    .filter(n => !n.hostile)
    .map(n => ({ ...n, role: LEADERSHIP.has(String(n.role).toLowerCase()) ? 'laborer' : n.role }));
  const someone = node.settlement.npcs.find(n => !n.hostile);
  const r = commonKnowledgeAnswer(w, someone, 'who runs this place?');
  assert.equal(r, null, 'no leadership role → decline via the caller, never invent authority');
});

test('U460-05: SECRET-control phrasings never leak — they decline, and never fall to a place blurb', () => {
  const w = boot();
  const elske = w.map.nodes.find(n => n.id === w.map.currentNodeId).settlement.npcs.find(n => String(n.role).toLowerCase() === 'representative');
  for (const q of ['who secretly controls this outpost?', 'who really runs this place?', 'who pulls the strings around here?']) {
    const r = commonKnowledgeAnswer(w, elske, q);
    assert.equal(r, null, `secret-control "${q}" declines at the reveal sink (never a leadership answer or a blurb)`);
  }
  // End-to-end: the secret gets an honest in-fiction decline, not a fabricated controller.
  const out = run('who secretly controls this outpost?');
  assert.doesNotMatch(String(out.narration), /representative/i, 'the public role is not offered as the secret answer');
});

test('U460-06: deterministic ×2 — the leadership answer is byte-identical on repeat boots (LLM-off)', () => {
  const a = run('Who runs this outpost, and how long have they held it?');
  const b = run('Who runs this outpost, and how long have they held it?');
  assert.equal(String(a.narration), String(b.narration), 'identical narration on replay');
});
