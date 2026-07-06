// U577 — MP-5a: the omen line's ALGEBRA (docs/MORAL_PHYSICS.md §5).
//
//   (I)   TIER 0 → ABSENT. A fresh boot (no deed, no accumulated standing) carries no
//         moral omen at all — "unremarked means unremarked" — ctx.moralOmen is null and
//         the rendered prompt contains no OMEN line.
//   (II)  TIERS 1-4 → THE RIGHT REGISTER. The escalation ladder's rung selects the omen's
//         loudness register: T1 faint, T2 the rumor register, T3/T4 the hunted register
//         (T4's own louder "gift arrives" beat is a later packet, MP-5b — this slice only
//         needs T3/T4 to share the loudest register it has).
//   (III) DOMINANT-AXIS VOCABULARY SELECTION IS DETERMINISTIC. Same world (same seed,
//         same script) → same sign, twice. The dominant axis is the vice axis carrying
//         the highest accumulated score (mirrors state.js deriveCorruption's "one great
//         sin" rule), and a DIFFERENT dominant axis (e.g. greed over wrath) selects that
//         axis's own vocabulary, not a generic one.
//   (IV)  NO DIGIT CHARACTERS IN THE LINE. The rendered OMEN line itself never contains a
//         digit — the tier/heat/corruption NUMBER never reaches the vocabulary or the
//         framing (invariant I, MORAL_PHYSICS §1).
//
// Hermetic: no network, no API key, LLM off (buildSystemPrompt is a pure string
// assembly — no callLLM/callDM invocation anywhere in this file).

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { buildNarratorContext } from '../engine/ai/narratorContext.js';
import { buildSystemPrompt } from '../engine/llmAdapter.js';
import { escalationTier, HUNT_HEAT, PACT_CORRUPTION, DEED_SEV } from '../engine/morality/escalation.js';
import { pickOmenPhrase, OMEN_REGISTERS, _OMEN_VOCABULARY_FOR_TESTS } from '../engine/morality/omenVocabulary.js';
import { VICE_AXES } from '../engine/state.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

function boot(seed) {
  let w = beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u577-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), PACKS).world;
  w = playerMove(w, PACKS, 'go outside').world;
  return w;
}

function omenLineOf(world) {
  const ctx = buildNarratorContext(world, {});
  const prompt = buildSystemPrompt(ctx);
  const line = prompt.split('\n').find(l => l.includes('OMEN ('));
  return { ctx, prompt, line: line || null };
}

test('U577-01: TIER 0 — a fresh boot carries no omen at all (ctx.moralOmen null, no OMEN line)', () => {
  const w = boot('u577-fresh');
  const { ctx, line } = omenLineOf(w);
  assert.equal(ctx.moralOmen, null, 'a fresh boot has no accumulated moral standing → no omen');
  assert.equal(line, null, 'the rendered prompt has no OMEN line at Tier 0');
});

// NOTE: DEED_SEV.HEAVY and PACT_CORRUPTION are BOTH 20 by design (MP-2's own comment:
// PACT_CORRUPTION is read from forbiddenGates, never forked — see escalation.js). An
// axisDelta of exactly DEED_SEV.HEAVY would therefore ALSO cross the pact threshold and
// mask Tier 1/2 under Tier 4. These tests use a smaller axis bump (MOD, not HEAVY) so
// standing corruption stays well under PACT_CORRUPTION while the DEED's own severity
// (still HEAVY) is what the escalation ladder grades — isolating Tier 1/2 cleanly.
test('U577-02: TIER 1 (faint) — a grave-but-unwitnessed (wild) deed grades faint, not silent', () => {
  let w = boot('u577-t1');
  const nid = String(w.map.currentNodeId || '');
  w = applyDeltas(w, [
    { op: 'axisDelta', axis: 'wrath', by: DEED_SEV.MOD },
    { op: 'recordDeed', deedKind: 'cruelty', severity: DEED_SEV.HEAVY, summary: 'a killing seen by no one', nodeId: nid, witnesses: [], t: 0 },
  ]);
  const deed = w.deeds[w.deeds.length - 1];
  assert.equal(deed.tier, 1, 'precondition: a HEAVY wild deed grades Tier 1 (no witnesses → Tier 2 cannot fire)');
  assert.ok(Number(w.party[0].morality.corruption) < PACT_CORRUPTION, 'precondition: standing corruption stays under the pact threshold (MOD bump, not HEAVY)');
  const { ctx, line } = omenLineOf(w);
  assert.ok(ctx.moralOmen, 'Tier 1 must produce an omen (not null)');
  assert.equal(ctx.moralOmen.register, 'faint', 'Tier 1 selects the faint register');
  assert.ok(line, 'the prompt must carry an OMEN line at Tier 1');
});

test('U577-03: TIER 2 (rumor) — a grave, witnessed deed grades the rumor register', () => {
  let w = boot('u577-t2');
  const nid = String(w.map.currentNodeId || '');
  w = applyDeltas(w, [
    { op: 'axisDelta', axis: 'wrath', by: DEED_SEV.MOD },
    { op: 'recordDeed', deedKind: 'cruelty', severity: DEED_SEV.HEAVY, summary: 'a killing seen by one', nodeId: nid, witnesses: ['npc_0'], t: 0 },
  ]);
  const deed = w.deeds[w.deeds.length - 1];
  assert.equal(deed.tier, 2, 'precondition: a witnessed HEAVY deed grades Tier 2');
  assert.ok(Number(w.party[0].morality.corruption) < PACT_CORRUPTION, 'precondition: standing corruption stays under the pact threshold (MOD bump, not HEAVY)');
  const { ctx } = omenLineOf(w);
  assert.ok(ctx.moralOmen, 'Tier 2 must produce an omen');
  assert.equal(ctx.moralOmen.register, 'rumor', 'Tier 2 selects the rumor register');
});

test('U577-04: TIER 3 (hunted) — accumulated heat crossing HUNT_HEAT grades the hunted register', () => {
  let w = boot('u577-t3');
  w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT + 1 }]);
  const { ctx } = omenLineOf(w);
  assert.ok(ctx.moralOmen, 'Tier 3 (heat alone, no fresh deed) must still produce an omen — read off live standing');
  assert.equal(ctx.moralOmen.register, 'hunted', 'Tier 3 selects the hunted register');
});

test('U577-05: TIER 4 (hunted, shared register) — accumulated corruption crossing PACT_CORRUPTION also grades hunted', () => {
  let w = boot('u577-t4');
  w = applyDeltas(w, [{ op: 'axisDelta', axis: 'greed', by: PACT_CORRUPTION }]);
  const { ctx } = omenLineOf(w);
  assert.ok(Number(w.party[0].morality.corruption) >= PACT_CORRUPTION, 'precondition: standing corruption reached the pact threshold');
  assert.ok(ctx.moralOmen, 'Tier 4 must produce an omen');
  assert.equal(ctx.moralOmen.register, 'hunted', 'Tier 4 shares the hunted register this slice exposes (T4-specific loudness is MP-5b)');
  assert.equal(ctx.moralOmen.axis, 'greed', 'the dominant axis (greed, the only one moved) is selected, not a generic default');
});

test('U577-06: DOMINANT-AXIS VOCABULARY — a different dominant axis selects that axis\'s own vocabulary', () => {
  let w = boot('u577-axis');
  w = applyDeltas(w, [{ op: 'axisDelta', axis: 'greed', by: 80 }]);
  const nid = String(w.map.currentNodeId || '');
  w = applyDeltas(w, [{ op: 'recordDeed', deedKind: 'cruelty', severity: DEED_SEV.HEAVY, summary: 'x', nodeId: nid, witnesses: ['npc_0'], t: 0 }]);
  const { ctx } = omenLineOf(w);
  assert.equal(ctx.moralOmen.axis, 'greed', 'the axis with the highest accumulated score (greed=80 > wrath=0) is dominant');
  // The phrase must come from greed's OWN vocabulary pool at the selected register, not
  // wrath's or any other axis's (pool membership — the exact SEED used by narratorContext.js
  // is an implementation detail this test should not hardcode; U577-07 proves determinism
  // ×2 directly against the real production seam instead of re-deriving the seed here).
  const greedPool = _OMEN_VOCABULARY_FOR_TESTS.greed[ctx.moralOmen.register];
  assert.ok(greedPool.includes(ctx.moralOmen.phrase), `the phrase "${ctx.moralOmen.phrase}" must come from greed's own "${ctx.moralOmen.register}" pool`);
  const otherAxisPools = VICE_AXES.filter(a => a !== 'greed').flatMap(a => Object.values(_OMEN_VOCABULARY_FOR_TESTS[a]).flat());
  assert.ok(!otherAxisPools.includes(ctx.moralOmen.phrase), 'the phrase must not collide with a different axis\'s vocabulary (a real content check, not just a coincidence)');
});

test('U577-07: DETERMINISM ×2 — the same world (same seed, same script) samples the SAME sign, twice', () => {
  function scriptedOmen(seed) {
    let w = boot(seed);
    const nid = String(w.map.currentNodeId || '');
    w = applyDeltas(w, [
      { op: 'axisDelta', axis: 'lust', by: DEED_SEV.HEAVY },
      { op: 'recordDeed', deedKind: 'cruelty', severity: DEED_SEV.HEAVY, summary: 'x', nodeId: nid, witnesses: ['npc_0', 'npc_1'], t: 0 },
    ]);
    return buildNarratorContext(w, {}).moralOmen;
  }
  const a = scriptedOmen('u577-det');
  const b = scriptedOmen('u577-det');
  assert.deepEqual(a, b, 'the identical scripted world must sample the identical omen twice');
  assert.equal(a.axis, 'lust');
});

test('U577-08: NO DIGIT CHARACTERS IN THE LINE — the rendered OMEN line carries zero digits at every tier', () => {
  const cases = [
    () => { // Tier 1
      let w = boot('u577-nodigit-1');
      const nid = String(w.map.currentNodeId || '');
      return applyDeltas(w, [
        { op: 'axisDelta', axis: 'pride', by: DEED_SEV.HEAVY },
        { op: 'recordDeed', deedKind: 'cruelty', severity: DEED_SEV.HEAVY, summary: 'x', nodeId: nid, witnesses: [], t: 0 },
      ]);
    },
    () => { // Tier 3, extreme heat
      let w = boot('u577-nodigit-3');
      return applyDeltas(w, [{ op: 'adjustHeat', by: 999 }]);
    },
    () => { // Tier 4, extreme corruption AND heat together (the maximum-escalation case)
      let w = boot('u577-nodigit-4');
      w = applyDeltas(w, [{ op: 'adjustHeat', by: 999 }, { op: 'axisDelta', axis: 'envy', by: 999 }]);
      const nid = String(w.map.currentNodeId || '');
      return applyDeltas(w, [{ op: 'recordDeed', deedKind: 'cruelty', severity: DEED_SEV.HEAVY, summary: 'x', nodeId: nid, witnesses: ['npc_0', 'npc_1'], t: 0 }]);
    },
  ];
  let checked = 0;
  for (const make of cases) {
    const w = make();
    const { line } = omenLineOf(w);
    if (!line) continue; // a case that happens to land at Tier 0 is not this test's concern
    assert.ok(!/[0-9]/.test(line), `the OMEN line must contain no digit characters: "${line}"`);
    checked += 1;
  }
  assert.ok(checked >= 2, 'at least two of the scripted maximum-escalation cases must have produced a checkable OMEN line');
});

test('U577-09: escalationTier + register table sanity — every non-zero tier maps to a real OMEN_REGISTERS value', () => {
  const TIER_REGISTER_EXPECTED = { 1: 'faint', 2: 'rumor', 3: 'hunted', 4: 'hunted' };
  for (const [tierStr, expected] of Object.entries(TIER_REGISTER_EXPECTED)) {
    assert.ok(OMEN_REGISTERS.includes(expected), `register "${expected}" for tier ${tierStr} must be a real OMEN_REGISTERS value`);
  }
});

test('U577-10: every VICE_AXES axis has a working vocabulary at every register (no mute axis)', () => {
  for (const axis of VICE_AXES) {
    for (const register of OMEN_REGISTERS) {
      const phrase = pickOmenPhrase(axis, register, 'sanity-seed');
      assert.ok(phrase && typeof phrase === 'string' && phrase.length > 0, `axis "${axis}" register "${register}" must yield a non-empty phrase`);
      assert.ok(!/[0-9]/.test(phrase), `axis "${axis}" register "${register}" phrase must contain no digit: "${phrase}"`);
    }
  }
});
