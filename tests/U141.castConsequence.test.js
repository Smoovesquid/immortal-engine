// U141 — P-80: the world testifies (gratuitous-magic consequence).
// P-80a classify + ward; P-80b social (witness trust) + environmental (scar +
// ecology); P-80c divine (good-god avengers on repeat; chaos pact on a dedicated
// innocent-kill via the existing dark-gift hook). Deterministic; no regression to
// non-offensive input.

import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { classifyOffensiveCast, castConsequence } from '../engine/magic/castConsequence.js';

const PACKS = { fantasy: { id: 'fantasy', toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] }, starterLocations: ['t'], starterObjectives: ['k'], skills: ['S'], locations: ['t'], objectives: ['k'], complications: ['c'], npcArchetypes: ['g'], sensoryMotifs: ['d'] } };

// A real, populated world (beginAdventure gives a party) whose CURRENT node is a
// settlement holding the given non-hostile NPCs — so the player exists for
// corruption/axis deltas and witnesses/scars resolve against actual state.
function worldWith(npcs = []) {
  let w = beginAdventure(newWorld({ seed: 'p80', fate: 0.3, campaignId: 'p80', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const node = { id: 'n1', nodeType: 'settlement', settlement: { npcs: npcs.map(n => ({ conversationState: { trustLevel: 5 }, ...n })) } };
  return ensureWorld({ ...w, map: { ...w.map, currentNodeId: 'n1', nodes: [...(w.map.nodes || []), node] } });
}
const villager = (id, name, extra = {}) => ({ id, name, hostile: false, ...extra });

// ── P-80a: classification ──────────────────────────────────────────────────

test('U141-01: benign + non-magical inputs are not offensive', () => {
  const w = worldWith();
  for (const s of ['cast mage armor', 'cast light', 'I heal myself', 'look around', 'go north', 'talk to the smith']) {
    assert.equal(classifyOffensiveCast(w, s).offensive, false, `"${s}" must not be offensive`);
  }
});

test('U141-02: the child ward is absolute, matched first, and applies no delta', () => {
  const w = worldWith();
  for (const s of ['cast flame at the child', 'burn the little girl', 'fire bolt that kid', 'incinerate the baby']) {
    assert.equal(classifyOffensiveCast(w, s).target, 'child', `"${s}" → child`);
  }
  const r = castConsequence(w, 'cast flame at the child', classifyOffensiveCast(w, 'cast flame at the child'));
  assert.ok(r && /ward|stays your hand|will not come|Not this/i.test(r.narration), 'the ward is rendered');
  assert.equal(r.world, w, 'no world mutation for the ward');
});

test('U141-03: a present innocent NPC is classified person-innocent by name', () => {
  const w = worldWith([villager('npc:ald', 'Aldrich Vane')]);
  const c = classifyOffensiveCast(w, 'cast flame at Aldrich');
  assert.equal(c.target, 'person-innocent');
  assert.equal(c.reason, 'present-npc');
});

test('U141-04: a hostile NPC is NOT an innocent', () => {
  const w = worldWith([villager('npc:bad', 'Grull', { hostile: true })]);
  assert.notEqual(classifyOffensiveCast(w, 'blast Grull').reason, 'present-npc');
});

test('U141-05: person-words and living-world words classify by tier', () => {
  const w = worldWith();
  assert.equal(classifyOffensiveCast(w, 'fire bolt the villager').target, 'person-innocent');
  assert.equal(classifyOffensiveCast(w, 'burn the trees').target, 'living-world');
  assert.equal(classifyOffensiveCast(w, 'blast the old well').target, 'living-world');
});

test('U141-06: venting at the void falls through (no consequence)', () => {
  const w = worldWith();
  const c = classifyOffensiveCast(w, 'cast flame at the sky');
  assert.equal(c.target, 'void');
  assert.equal(castConsequence(w, 'cast flame at the sky', c), null);
  assert.equal(castConsequence(w, 'blast', classifyOffensiveCast(w, 'blast')), null);
});

// ── P-80b: environmental + social ───────────────────────────────────────────

test('U141-07: blasting the living world scars the node and raises ecology corruption', () => {
  const w = worldWith();
  const before = w.ecology.corruption;
  const r = castConsequence(w, 'burn the trees', classifyOffensiveCast(w, 'burn the trees'));
  const n1 = r.world.map.nodes.find(n => n.id === 'n1');
  assert.ok((n1.scars || []).includes('magic_scorch'), 'the node is scarred');
  assert.ok(r.world.ecology.corruption > before, 'ecology corruption rose');
  assert.match(r.mechanics, /living-world/);
});

test('U141-08: blasting an innocent crashes witness trust', () => {
  const w = worldWith([villager('npc:ald', 'Aldrich'), villager('npc:mae', 'Mae')]);
  const r = castConsequence(w, 'fire bolt the villager', classifyOffensiveCast(w, 'fire bolt the villager'));
  const n1 = r.world.map.nodes.find(n => n.id === 'n1');
  const trust = n1.settlement.npcs.map(n => n.conversationState.trustLevel);
  assert.ok(trust.every(t => t < 5), 'every witness lost trust');
  assert.match(r.mechanics, /recoil/);
});

// ── P-80c: divine ───────────────────────────────────────────────────────────

test('U141-09: repeated harm to innocents draws the good gods\' avengers', () => {
  let w = worldWith([villager('npc:ald', 'Aldrich')]);
  let last;
  for (let i = 0; i < 3; i++) {
    last = castConsequence(w, 'fire bolt the villager', classifyOffensiveCast(w, 'fire bolt the villager'));
    w = last.world;
  }
  assert.ok(w.combat?.active, 'the avengers arrive and combat begins');
  assert.match(last.mechanics, /divine-retribution/);
});

test('U141-10: a dedicated innocent-kill spikes corruption (engaging the chaos pact)', () => {
  const w = worldWith([villager('npc:ald', 'Aldrich')]);
  const r = castConsequence(w, 'incinerate the villager', classifyOffensiveCast(w, 'incinerate the villager'));
  assert.ok((r.world.party[0].morality?.corruption ?? 0) >= 20, 'corruption crosses the first dark-gift threshold');
  assert.ok(Array.isArray(r.world.deeds) && r.world.deeds.some(d => d.kind === 'cruelty'), 'the deed is recorded');
  assert.match(r.mechanics, /DEDICATED-KILL|chaos/i);
});

test('U141-11: end-to-end via playerMove, the chaos pact dark-gift is granted', () => {
  const w = worldWith([villager('npc:ald', 'Aldrich')]);
  const r = playerMove(w, PACKS, 'incinerate the villager');
  assert.ok((r.world.party[0].morality?.corruption ?? 0) >= 20, 'the wrapper sees the corruption spike');
  const known = r.world.party?.[0]?.spells?.known || [];
  assert.ok(known.length > (w.party?.[0]?.spells?.known || []).length, 'a forbidden gift arrived (the pact)');
});

test('U141-12: non-offensive input is untouched by the new branch (no regression)', () => {
  const w = worldWith([villager('npc:ald', 'Aldrich')]);
  const r = playerMove(w, PACKS, 'look around');
  assert.ok(!/cast-consequence/.test(r.output.mechanics || ''), 'no consequence on a benign look');
});

test('U141-13: routing is deterministic (same world+text → same prose)', () => {
  const w = worldWith();
  const a = castConsequence(w, 'burn the trees', classifyOffensiveCast(w, 'burn the trees'));
  const b = castConsequence(w, 'burn the trees', classifyOffensiveCast(w, 'burn the trees'));
  assert.deepEqual(a.narration, b.narration);
});
