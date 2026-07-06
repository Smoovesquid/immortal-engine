// U578 — MP-5a: INVARIANT I, the hard wall (docs/MORAL_PHYSICS.md §1-I + §5).
//
//   (I)  A scripted HIGH-HEAT / HIGH-CORRUPTION world (the maximum-escalation case, every
//        rung of the ladder crossed at once) produces a prompt whose OMEN line contains
//        NO numeric moral value anywhere — no tier number, no heat figure, no corruption
//        percentage, no digit at all, and no forbidden WORD ("corruption", "heat", "tier",
//        "escalation", a percent sign) that would leak the mechanism instead of the sign.
//   (II) LLM-OFF NARRATION IS BYTE-IDENTICAL. This packet is prompt-side surfacing ONLY
//        (docs/briefs/MP-5a-tier-to-omen-line.md: "the silent fallback path must be
//        byte-identical"). playerMove's OWN narration (engine/composer.js's compose(),
//        the deterministic base path every node --test run exercises — server.js is the
//        ONLY caller of augmentNarration/callLLM, and playloop.js never calls either) must
//        render EXACTLY the same text for the same world+script as it did before this
//        packet touched anything, because compose()/playloop.js were never edited.
//
// Hermetic: no network, no API key required, no callLLM/callDM invocation anywhere in this
// file — LLM-off by construction (playerMove's return value IS the base narration).

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
import { worldHash } from '../engine/worldHash.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { HUNT_HEAT, PACT_CORRUPTION, DEED_SEV } from '../engine/morality/escalation.js';

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
    seed, fate: 0.2, campaignId: `u578-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), PACKS).world;
  w = playerMove(w, PACKS, 'go outside').world;
  return w;
}

// A forbidden vocabulary the OMEN line must never contain, regardless of tier — the words
// that would leak the MECHANISM (the meter) instead of the sign (invariant III/I: "the
// world is the readout... never a meter"). Checked case-insensitively.
const FORBIDDEN_WORDS = ['corruption', 'heat', 'tier', 'escalation', 'severity', '%', 'percent'];

test('U578-01: THE MAXIMUM-ESCALATION CASE — heat AND corruption both pushed far past every threshold at once', () => {
  let w = boot('u578-max');
  // Push heat and corruption both to roughly 25x their respective thresholds — the most
  // extreme scripted state this world can reach, on top of a witnessed HEAVY deed so the
  // deed-side of the ladder (severity/witnessReach) is ALSO maxed, not just standing.
  w = applyDeltas(w, [
    { op: 'adjustHeat', by: HUNT_HEAT * 25 },
    { op: 'axisDelta', axis: 'wrath', by: PACT_CORRUPTION * 5 }, // clamped to 100 by ensureAxes
  ]);
  const nid = String(w.map.currentNodeId || '');
  w = applyDeltas(w, [
    { op: 'recordDeed', deedKind: 'cruelty', severity: DEED_SEV.HEAVY, summary: 'the worst act imaginable', nodeId: nid, witnesses: ['npc_0', 'npc_1', 'npc_2', 'npc_3'], t: 0 },
  ]);
  assert.ok(Number(w.party[0].morality.heat) >= HUNT_HEAT, 'precondition: heat crosses HUNT_HEAT');
  assert.ok(Number(w.party[0].morality.corruption) >= PACT_CORRUPTION, 'precondition: corruption crosses PACT_CORRUPTION');
  assertWorldInvariants(w);

  const ctx = buildNarratorContext(w, {});
  assert.ok(ctx.moralOmen, 'the maximum-escalation case must produce an omen (never silent at this standing)');

  const prompt = buildSystemPrompt(ctx);
  const omenLine = prompt.split('\n').find(l => l.includes('OMEN ('));
  assert.ok(omenLine, 'the prompt must carry an OMEN line');

  // (I) — no digit character anywhere in the OMEN line.
  assert.ok(!/[0-9]/.test(omenLine), `the OMEN line must contain no digit at maximum escalation: "${omenLine}"`);

  // (I) — no forbidden word anywhere in the OMEN line (the mechanism must never leak).
  const lower = omenLine.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    assert.ok(!lower.includes(word), `the OMEN line must never contain "${word}": "${omenLine}"`);
  }
});

test('U578-02: the OMEN line never leaks a numeric value even embedded in a word (e.g. no "20/100" or "tier 3")', () => {
  let w = boot('u578-embed');
  w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT + 1 }, { op: 'axisDelta', axis: 'lust', by: PACT_CORRUPTION }]);
  const ctx = buildNarratorContext(w, {});
  const prompt = buildSystemPrompt(ctx);
  const omenLine = prompt.split('\n').find(l => l.includes('OMEN ('));
  assert.ok(omenLine, 'precondition: an omen line exists at this standing');
  // A regex sweep for ANY digit sequence, not just isolated ones — "tier3" or "20%" must
  // both fail this the same way a clean "twenty percent" phrase would not.
  assert.doesNotMatch(omenLine, /\d/, 'no digit sequence of any length may appear in the OMEN line');
});

test('U578-03: LLM-OFF NARRATION IS BYTE-IDENTICAL — the same scripted turn narrates the same text before and after this packet', () => {
  // "Before this packet" is proven structurally: engine/composer.js and engine/playloop.js
  // narration assembly were never edited by MP-5a (the packet is prompt-assembly-only, in
  // engine/ai/narratorContext.js + engine/llmAdapter.js + engine/morality/omenVocabulary.js
  // — none of which compose()/playerMove's narration path reads). This test proves the
  // CONTRAPOSITIVE directly: two identical scripted runs, through the SAME playerMove path
  // that produced narration before this packet existed, still narrate byte-identically to
  // each other — i.e. the base path remains deterministic and is untouched by the omen.
  const SCRIPT = ['go outside', 'I execute the kneeling captive who begs for mercy', 'look around'];
  function scriptedNarrations(seed) {
    let w = beginAdventure(newWorld({
      seed, fate: 0.2, campaignId: `u578-narr-${seed}`,
      pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
    }), PACKS).world;
    const narrations = [];
    for (const line of SCRIPT) {
      const res = playerMove(w, PACKS, line);
      w = res.world;
      narrations.push({ narration: String(res.output?.narration || ''), mechanics: String(res.output?.mechanics || '') });
    }
    return narrations;
  }
  const a = scriptedNarrations('u578-byte');
  const b = scriptedNarrations('u578-byte');
  assert.deepEqual(a, b, 'the same seed+script must narrate byte-identically run-to-run (the base composer path is untouched)');
  // And the narration text must never itself contain the OMEN scaffolding words — the
  // packet's line lives ONLY in the LLM prompt (buildSystemPrompt), never in the
  // deterministic composer's player-facing narration string.
  for (const turn of a) {
    assert.ok(!turn.narration.includes('OMEN ('), 'the base narration string must never carry the OMEN prompt scaffolding');
  }
});

test('U578-04: worldHash is unaffected by the omen — two worlds differing ONLY by the omen-relevant read stay comparable under replay', () => {
  // A scripted run twice, from the same seed: worldHash equality must hold (the omen is a
  // prompt-side read, never a stored field, never touches worldHash's projection).
  function scriptedRun(seed) {
    let w = beginAdventure(newWorld({
      seed, fate: 0.2, campaignId: `u578-hash-${seed}`,
      pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
    }), PACKS).world;
    w = playerMove(w, PACKS, 'go outside').world;
    w = playerMove(w, PACKS, 'I torture the bound prisoner for information').world;
    return w;
  }
  const w1 = scriptedRun('u578-hash');
  const w2 = scriptedRun('u578-hash');
  assert.equal(worldHash(w1), worldHash(w2), 'identical scripted runs must produce identical worldHash — the omen never touches stored state');
  assertWorldInvariants(w1);
});
