// E1: Emotional Response — brain mood drives emotional coloring + narrator context
import test from 'node:test';
import assert from 'node:assert/strict';

import { applyMoodOverlay } from '../engine/npc/perspectiveFilter.js';
import { newWorld } from '../engine/state.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';
import { beginDialogue, askNpc } from '../engine/npc/dialogue.js';
import { buildDMContext, buildDialogueTurn } from '../engine/ai/narratorContext.js';

// ── Pure applyMoodOverlay tests ─────────────────────────────────────────────

test('E1-01: hostile mood amplifies guarded/evasive intensity', () => {
  const coloring = [
    { emotion: 'guarded', intensity: 0.5, trigger: null },
    { emotion: 'evasive', intensity: 0.4, trigger: 'secret_1' },
    { emotion: 'nervous', intensity: 0.6, trigger: null }
  ];

  const result = applyMoodOverlay(coloring, 'hostile');

  const guarded = result.find(c => c.trigger === null && c.emotion === 'guarded');
  assert.ok(guarded, 'guarded entry still present');
  assert.equal(guarded.intensity, 0.75, 'guarded intensity amplified by 1.5x');

  const evasive = result.find(c => c.emotion === 'evasive');
  assert.ok(Math.abs(evasive.intensity - 0.6) < 0.001, 'evasive intensity amplified by 1.5x');

  // Nervous should be unchanged by hostile mood
  const nervous = result.find(c => c.emotion === 'nervous');
  assert.equal(nervous.intensity, 0.6, 'nervous intensity unchanged under hostile');

  // Hostile undertone added
  const undertone = result.find(c => c.emotion === 'hostile');
  assert.ok(undertone, 'hostile undertone was added');
  assert.equal(undertone.intensity, 0.7, 'hostile undertone intensity is 0.7');
  assert.equal(undertone.trigger, null, 'undertone has no trigger');
});

test('E1-02: warm mood reduces negative intensities and caps nervousness at 0.3', () => {
  const coloring = [
    { emotion: 'nervous', intensity: 0.8, trigger: 'secret_2' },
    { emotion: 'guarded', intensity: 0.6, trigger: null }
  ];

  const result = applyMoodOverlay(coloring, 'warm');

  const nervous = result.find(c => c.emotion === 'nervous');
  assert.ok(nervous, 'nervous entry still present');
  assert.equal(nervous.intensity, 0.3, 'nervous capped at 0.3 under warm mood');

  const guarded = result.find(c => c.emotion === 'guarded');
  // 0.6 * 0.7 = 0.42
  assert.ok(Math.abs(guarded.intensity - 0.42) < 0.001, 'guarded reduced by 0.7x');

  const undertone = result.find(c => c.emotion === 'warm');
  assert.ok(undertone, 'warm undertone was added');
  assert.equal(undertone.intensity, 0.4, 'warm undertone intensity is 0.4');
});

test('E1-03: wary mood leaves coloring unchanged and adds no undertone', () => {
  const coloring = [
    { emotion: 'guarded', intensity: 0.5, trigger: null },
    { emotion: 'nervous', intensity: 0.3, trigger: 'fact_1' }
  ];

  const result = applyMoodOverlay(coloring, 'wary');

  assert.equal(result.length, 2, 'same number of entries');
  assert.equal(result[0].emotion, 'guarded');
  assert.equal(result[0].intensity, 0.5, 'guarded unchanged');
  assert.equal(result[1].emotion, 'nervous');
  assert.equal(result[1].intensity, 0.3, 'nervous unchanged');

  // No undertone added
  const undertone = result.find(c => c.emotion === 'wary');
  assert.equal(undertone, undefined, 'no wary undertone added');
});

test('E1-04: amused mood reduces guarded intensity', () => {
  const coloring = [
    { emotion: 'guarded', intensity: 0.6, trigger: null },
    { emotion: 'nervous', intensity: 0.5, trigger: null }
  ];

  const result = applyMoodOverlay(coloring, 'amused');

  const guarded = result.find(c => c.emotion === 'guarded');
  assert.equal(guarded.intensity, 0.3, 'guarded halved by amused mood');

  // Nervous should not be affected by amused
  const nervous = result.find(c => c.emotion === 'nervous');
  assert.equal(nervous.intensity, 0.5, 'nervous unchanged under amused');

  const undertone = result.find(c => c.emotion === 'amused');
  assert.ok(undertone, 'amused undertone was added');
  assert.equal(undertone.intensity, 0.4, 'amused undertone intensity is 0.4');
});

test('E1-05: mood overlay on empty coloring adds undertone only', () => {
  const result = applyMoodOverlay([], 'hostile');

  assert.equal(result.length, 1, 'exactly one entry');
  assert.equal(result[0].emotion, 'hostile');
  assert.equal(result[0].intensity, 0.7);
  assert.equal(result[0].trigger, null);
});

test('E1-05b: fearful mood on empty coloring adds fearful undertone', () => {
  const result = applyMoodOverlay([], 'fearful');

  assert.equal(result.length, 1);
  assert.equal(result[0].emotion, 'fearful');
  assert.equal(result[0].intensity, 0.6);
});

test('E1-05c: wary mood on empty coloring returns empty array', () => {
  const result = applyMoodOverlay([], 'wary');
  assert.equal(result.length, 0, 'wary mood on empty coloring returns empty');
});

test('E1-05d: applyMoodOverlay never mutates input array', () => {
  const original = [{ emotion: 'guarded', intensity: 0.5, trigger: null }];
  const frozen = JSON.parse(JSON.stringify(original));

  applyMoodOverlay(original, 'hostile');

  assert.deepEqual(original, frozen, 'original array was not mutated');
});

test('E1-05e: applyMoodOverlay handles null/undefined inputs gracefully', () => {
  const r1 = applyMoodOverlay(null, 'hostile');
  assert.ok(Array.isArray(r1), 'returns array for null coloring');
  assert.equal(r1.length, 1, 'hostile undertone on null coloring');

  const r2 = applyMoodOverlay(undefined, null);
  assert.ok(Array.isArray(r2), 'returns array for undefined coloring + null mood');
  assert.equal(r2.length, 0, 'null mood treated as wary');
});

test('E1-05f: fearful mood amplifies nervous intensity', () => {
  const coloring = [
    { emotion: 'nervous', intensity: 0.4, trigger: null },
    { emotion: 'guarded', intensity: 0.5, trigger: null }
  ];

  const result = applyMoodOverlay(coloring, 'fearful');

  const nervous = result.find(c => c.emotion === 'nervous');
  assert.ok(Math.abs(nervous.intensity - 0.6) < 0.001, 'nervous amplified by 1.5x under fearful');

  // Guarded should be unchanged by fearful
  const guarded = result.find(c => c.emotion === 'guarded');
  assert.equal(guarded.intensity, 0.5, 'guarded unchanged under fearful');

  const undertone = result.find(c => c.emotion === 'fearful');
  assert.ok(undertone, 'fearful undertone was added');
  assert.equal(undertone.intensity, 0.6);
});

// ── Integration tests ───────────────────────────────────────────────────────

function makeWorldWithSettlement(seed = 'e1-seed') {
  let w = newWorld({ seed, fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } });
  const settlements = w.map.nodes.filter(n => n.nodeType === 'settlement');
  if (!settlements.length) throw new Error('No settlements in test world');
  const nodeId = settlements[0].id;
  w = { ...w, map: { ...w.map, currentNodeId: nodeId } };
  const pack = { objectives: ['survive'], factionPool: [{ id: 'civic', type: 'civic' }] };
  w = decompressAndCanonizeSync(w, nodeId, pack);
  return { w, nodeId, pack };
}

function getNpcs(w, nodeId) {
  return w.map.nodes.find(n => n.id === nodeId).settlement.npcs;
}

test('E1-06: brainMood appears in dialogue outcome', () => {
  const { w, nodeId } = makeWorldWithSettlement();
  const npc0 = getNpcs(w, nodeId)[0];

  const { world: w1 } = beginDialogue(w, npc0.id);
  const { outcome } = askNpc(w1, 'tell me about this place');

  assert.equal(outcome.ok, true, 'askNpc succeeded');
  // brainMood should be present in outcome (may be null if brain returns no mood,
  // but the field itself must exist)
  assert.ok('brainMood' in outcome, 'outcome has brainMood field');
  // brainDecision should also be present
  assert.ok(outcome.brainDecision, 'outcome has brainDecision');
  // If brainDecision has mood, brainMood should match
  if (outcome.brainDecision?.mood) {
    assert.equal(outcome.brainMood, outcome.brainDecision.mood, 'brainMood matches brainDecision.mood');
  }
});

test('E1-07: DM context dialogueTurn includes mood from outcome', () => {
  const { w, nodeId, pack } = makeWorldWithSettlement();
  const npc0 = getNpcs(w, nodeId)[0];

  const { world: w1 } = beginDialogue(w, npc0.id);
  const { world: w2, outcome } = askNpc(w1, 'tell me about this place');

  // Build DM context with the outcome that has brainMood
  const ctx = buildDMContext(w2, outcome, pack);

  assert.ok(ctx.dialogueTurn, 'DM context has dialogueTurn');
  assert.ok(ctx.dialogueTurn.npc, 'dialogueTurn has npc');
  assert.ok(ctx.dialogueTurn.npc.mood, 'dialogueTurn.npc has mood field');
  // The mood should either be from the brain decision or the fallback dialogueMood
  assert.ok(typeof ctx.dialogueTurn.npc.mood === 'string', 'mood is a string');
});

test('E1-07b: buildDialogueTurn uses brainMood from outcome when provided', () => {
  const { w, nodeId } = makeWorldWithSettlement();
  const npc0 = getNpcs(w, nodeId)[0];

  const { world: w1 } = beginDialogue(w, npc0.id);

  // Build dialogueTurn with a synthetic outcome that has brainMood
  const fakeOutcome = { brainMood: 'hostile' };
  const dt = buildDialogueTurn(w1, fakeOutcome);

  assert.ok(dt, 'dialogueTurn returned');
  assert.equal(dt.npc.mood, 'hostile', 'mood overridden by outcome brainMood');
});

test('E1-07c: buildDialogueTurn falls back to derived mood when no outcome', () => {
  const { w, nodeId } = makeWorldWithSettlement();
  const npc0 = getNpcs(w, nodeId)[0];

  const { world: w1 } = beginDialogue(w, npc0.id);

  // Build dialogueTurn without outcome
  const dt = buildDialogueTurn(w1);

  assert.ok(dt, 'dialogueTurn returned');
  assert.ok(typeof dt.npc.mood === 'string', 'mood is still derived');
});
