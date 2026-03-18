/**
 * Gate N1 — Surface context reaches the narrator
 *
 * buildNarratorContext() must emit a structured object containing all
 * canonical facts the narrator is allowed to know. Pure function — no API.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNarratorContext } from '../engine/ai/narratorContext.js';
import { ensureWorld } from '../engine/state.js';

function worldWithNode(nodeType, opts = {}) {
  return ensureWorld({
    meta: { seed: 'n1', fate: opts.fate ?? 0.5 },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [{ id: 'n0', name: opts.name ?? 'The Place', nodeType, tags: [] }],
      edges: [],
      discovered: ['n0'],
      currentNodeId: 'n0'
    }
  });
}

// ── Basic field contract ─────────────────────────────────────────────────

test('N1: context includes placeName, nodeType, location, objective', () => {
  const w = worldWithNode('settlement', { name: 'River Town' });
  const ctx = buildNarratorContext(w, {});
  assert.equal(ctx.placeName, 'River Town');
  assert.equal(ctx.nodeType, 'settlement');
  assert.ok(typeof ctx.location  === 'string');
  assert.ok(typeof ctx.objective === 'string');
});

test('N1: context includes structuresHere array', () => {
  const w = worldWithNode('settlement', { name: 'Fort' });
  const ctx = buildNarratorContext(w, {});
  assert.ok(Array.isArray(ctx.structuresHere));
});

test('N1: context includes interior null when outside', () => {
  const w = worldWithNode('settlement');
  const ctx = buildNarratorContext(w, {});
  assert.equal(ctx.interior, null);
});

test('N1: context reflects interior when inside a structure', () => {
  let w = worldWithNode('settlement');
  w = {
    ...w,
    scene: { ...w.scene, interior: { structureKey: 'stgen:v8:n0:0', roomId: 'room:stgen:v8:n0:0:1' } }
  };
  const ctx = buildNarratorContext(w, {});
  assert.ok(ctx.interior !== null);
  assert.equal(ctx.interior.structureKey, 'stgen:v8:n0:0');
  assert.equal(ctx.interior.roomId, 'room:stgen:v8:n0:0:1');
});

// ── All 4 nodeTypes produce distinct contexts ────────────────────────────

test('N1: all 4 nodeTypes produce distinct nodeType fields', () => {
  const types = ['settlement', 'wilderness', 'landmark', 'dungeon_entrance'];
  const seen = new Set();
  for (const t of types) {
    const ctx = buildNarratorContext(worldWithNode(t, { name: `Place ${t}` }), {});
    assert.equal(ctx.nodeType, t);
    seen.add(ctx.nodeType);
  }
  assert.equal(seen.size, 4, 'all 4 nodeTypes must produce distinct context.nodeType values');
});

// ── Tone derivation ──────────────────────────────────────────────────────

test('N1: low fate with toneWords => cooperative tone', () => {
  const w = worldWithNode('wilderness', { fate: 0.1 });
  const toneWords = { cooperative: ['warm'], grim: ['cold'], blood: ['black'] };
  const ctx = buildNarratorContext(w, { pack: { toneWords } });
  assert.equal(ctx.tone, 'cooperative');
});

test('N1: mid fate with toneWords => grim tone', () => {
  const w = worldWithNode('wilderness', { fate: 0.5 });
  const toneWords = { cooperative: ['warm'], grim: ['cold'], blood: ['black'] };
  const ctx = buildNarratorContext(w, { pack: { toneWords } });
  assert.equal(ctx.tone, 'grim');
});

test('N1: high fate with toneWords => blood tone', () => {
  const w = worldWithNode('wilderness', { fate: 0.8 });
  const toneWords = { cooperative: ['warm'], grim: ['cold'], blood: ['black'] };
  const ctx = buildNarratorContext(w, { pack: { toneWords } });
  assert.equal(ctx.tone, 'blood');
});

// ── Action passthrough ───────────────────────────────────────────────────

test('N1: actionText passes through from outcome', () => {
  const w = worldWithNode('settlement');
  const ctx = buildNarratorContext(w, { input: 'go north' });
  assert.equal(ctx.actionText, 'go north');
});

test('N1: fate field present and numeric', () => {
  const w = worldWithNode('settlement', { fate: 0.6 });
  const ctx = buildNarratorContext(w, {});
  assert.ok(typeof ctx.fate === 'number');
  assert.ok(ctx.fate >= 0 && ctx.fate <= 1);
});
