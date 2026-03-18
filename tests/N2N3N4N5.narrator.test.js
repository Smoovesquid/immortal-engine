/**
 * Gates N2–N5 — Anthropic API, grounded prompt, validator, tone
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSystemPrompt, validateNarrationCandidate, augmentNarration } from '../engine/llmAdapter.js';
import { buildNarratorContext } from '../engine/ai/narratorContext.js';
import { ensureWorld } from '../engine/state.js';

function ctx(nodeType, opts = {}) {
  return {
    placeName:      opts.placeName ?? 'Test Place',
    nodeType,
    location:       opts.placeName ?? 'Test Place',
    objective:      '',
    structuresHere: opts.structures ?? [],
    interior:       opts.interior ?? null,
    tone:           opts.tone ?? 'grim',
    actionText:     opts.action ?? 'go north',
    mechanicsText:  '',
    fate:           opts.fate ?? 0.5
  };
}

// ── N3: System prompt is grounded ────────────────────────────────────────────

test('N3: system prompt contains place name', () => {
  const prompt = buildSystemPrompt(ctx('settlement', { placeName: 'River Town' }));
  assert.ok(prompt.includes('River Town'), 'prompt must reference place name');
});

test('N3: system prompt contains node type description', () => {
  const prompt = buildSystemPrompt(ctx('wilderness', { placeName: 'The Moor' }));
  assert.ok(prompt.includes('wilderness'), 'prompt must name the place type');
  assert.ok(prompt.includes('no roads'), 'prompt must state wilderness has no roads');
});

test('N3: system prompt contains "do not invent"', () => {
  const prompt = buildSystemPrompt(ctx('settlement', { placeName: 'Fort' }));
  assert.ok(/do not invent/i.test(prompt), 'prompt must forbid inventing topology');
});

test('N3: all 4 nodeTypes produce distinct system prompts', () => {
  const types = ['settlement', 'wilderness', 'landmark', 'dungeon_entrance'];
  const prompts = types.map(t => buildSystemPrompt(ctx(t, { placeName: 'Place' })));
  const unique = new Set(prompts);
  assert.equal(unique.size, 4, 'each nodeType must produce a distinct system prompt');
});

test('N3: interior state appears in system prompt', () => {
  const c = ctx('settlement', {
    placeName: 'Keep',
    interior: { structureKey: 'st:1', roomId: 'room:st:1:1' }
  });
  const prompt = buildSystemPrompt(c);
  assert.ok(prompt.includes('room:st:1:1'), 'prompt must name the current room');
});

test('N3: structures listed in system prompt', () => {
  const c = ctx('settlement', {
    placeName: 'Village',
    structures: [{ index: 1, kind: 'building' }, { index: 2, kind: 'shop' }]
  });
  const prompt = buildSystemPrompt(c);
  assert.ok(prompt.includes('building #1'), 'prompt must list structure 1');
  assert.ok(prompt.includes('shop #2'), 'prompt must list structure 2');
});

// ── N4: Grounding validator catches node-type violations ─────────────────────

test('N4: wilderness narration mentioning "roads" is rejected', () => {
  const c = ctx('wilderness', { placeName: 'Dark Moor' });
  const ok = validateNarrationCandidate(null, 'You walk down the roads of Dark Moor.', { ctx: c });
  assert.equal(ok, false, 'roads in wilderness must be rejected');
});

test('N4: wilderness narration mentioning "buildings" is rejected', () => {
  const c = ctx('wilderness', { placeName: 'Dark Moor' });
  const ok = validateNarrationCandidate(null, 'You see several buildings at Dark Moor.', { ctx: c });
  assert.equal(ok, false, 'buildings in wilderness must be rejected');
});

test('N4: dungeon narration mentioning "open sky" is rejected', () => {
  const c = ctx('dungeon_entrance', { placeName: 'The Pit' });
  const ok = validateNarrationCandidate(null, 'You descend beneath the open sky of The Pit.', { ctx: c });
  assert.equal(ok, false, 'open sky in dungeon must be rejected');
});

test('N4: valid settlement narration is accepted', () => {
  const c = ctx('settlement', { placeName: 'Market Town' });
  const ok = validateNarrationCandidate(null, 'You arrive at Market Town.', { ctx: c });
  assert.equal(ok, true, 'clean settlement narration should pass');
});

test('N4: valid wilderness narration is accepted', () => {
  const c = ctx('wilderness', { placeName: 'The Moor' });
  const ok = validateNarrationCandidate(null, 'You stand in the grey expanse of The Moor.', { ctx: c });
  assert.equal(ok, true, 'clean wilderness narration should pass');
});

test('N4: narration missing location name is rejected', () => {
  const w = ensureWorld({
    meta: { seed: 'n4', fate: 0.5 },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [{ id: 'n0', name: 'Iron Gate', nodeType: 'landmark', tags: [] }],
      edges: [], discovered: ['n0'], currentNodeId: 'n0'
    },
    scene: { location: 'Iron Gate', objective: '' }
  });
  const c = ctx('landmark', { placeName: 'Iron Gate' });
  const ok = validateNarrationCandidate(w, 'You walk through a ruined arch.', { ctx: c });
  assert.equal(ok, false, 'narration missing location name must be rejected');
});

// ── N5: Tone shapes the system prompt ────────────────────────────────────────

test('N5: blood tone includes visceral language in prompt', () => {
  const prompt = buildSystemPrompt(ctx('wilderness', { tone: 'blood', placeName: 'The Waste' }));
  assert.ok(/brutal|visceral|cheap/i.test(prompt), 'blood tone must inject visceral cues');
});

test('N5: cooperative tone includes warm language in prompt', () => {
  const prompt = buildSystemPrompt(ctx('settlement', { tone: 'cooperative', placeName: 'Haven' }));
  assert.ok(/warm|optimism/i.test(prompt), 'cooperative tone must inject warm cues');
});

test('N5: grim and cooperative tones produce different prompts', () => {
  const grimPrompt = buildSystemPrompt(ctx('wilderness', { tone: 'grim',        placeName: 'P' }));
  const coopPrompt = buildSystemPrompt(ctx('wilderness', { tone: 'cooperative', placeName: 'P' }));
  assert.notEqual(grimPrompt, coopPrompt, 'grim and cooperative must produce distinct prompts');
});

// ── N6 offline fallback (no API key) ─────────────────────────────────────────

test('N6: augmentNarration returns base when no API key', async () => {
  const w = ensureWorld({
    meta: { seed: 'n6', fate: 0.5 },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [{ id: 'n0', name: 'Start', nodeType: 'settlement', tags: [] }],
      edges: [], discovered: ['n0'], currentNodeId: 'n0'
    }
  });
  const result = await augmentNarration({
    world: w,
    outcome: {},
    baseNarration: 'You stand at the crossroads.',
    enabled: true,
    apiKey: ''          // no key → silent fallback
  });
  assert.equal(result, 'You stand at the crossroads.', 'missing API key must return base narration');
});

test('N6: augmentNarration returns base when enabled=false', async () => {
  const w = ensureWorld({
    meta: { seed: 'n6b', fate: 0.5 },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [{ id: 'n0', name: 'Start', nodeType: 'settlement', tags: [] }],
      edges: [], discovered: ['n0'], currentNodeId: 'n0'
    }
  });
  const result = await augmentNarration({
    world: w,
    outcome: {},
    baseNarration: 'The torchlight flickers.',
    enabled: false,
    apiKey: 'sk-fake'
  });
  assert.equal(result, 'The torchlight flickers.', 'disabled mode must return base narration');
});

// ── N2: Live Anthropic API call ───────────────────────────────────────────────
// Skipped if ANTHROPIC_API_KEY not set in env.

test('N2: live Anthropic API returns non-empty narration', async () => {
  const key = process.env.ANTHROPIC_API_KEY ?? '';
  if (!key) {
    console.log('  [SKIP] ANTHROPIC_API_KEY not set — skipping live API test');
    return;
  }

  const w = ensureWorld({
    meta: { seed: 'n2-live', fate: 0.5 },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [{ id: 'n0', name: 'Thornwall', nodeType: 'settlement', tags: [] }],
      edges: [], discovered: ['n0'], currentNodeId: 'n0'
    },
    scene: { location: 'Thornwall', objective: 'find the key' }
  });

  const result = await augmentNarration({
    world: w,
    outcome: { input: 'look around', pack: { toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] } } },
    baseNarration: 'You arrive at Thornwall.',
    enabled: true,
    apiKey: key
  });

  assert.ok(typeof result === 'string' && result.length > 0, 'live API must return non-empty string');
  console.log(`  [N2 live] narration: "${result}"`);
});
