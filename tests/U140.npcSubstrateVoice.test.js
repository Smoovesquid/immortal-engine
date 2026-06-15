// U140 — NPC substrate voice: each NPC is grounded in their cascade rung.
//
// Two NPCs from different towns must have different local (vivid) substrate
// events in their dialogue handle. Region events may overlap (same region
// assignment is possible but not guaranteed). The voice prompt must render
// vivid/dim/myth sections correctly and two NPCs from different places must
// produce different world-knowledge blocks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { npcSubstrateContext } from '../engine/substrate.js';
import { buildNpcVoicePrompt } from '../server/npcVoicePrompt.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

function worldAtNode(seed) {
  const w0 = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u140-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  return playerMove(w0, packs, 'go outside').world;
}

test('U140-01: npcSubstrateContext returns vivid/dim/myth events in correct proportions', () => {
  const w = worldAtNode('u140a');
  const nodeId = w.map.currentNodeId;
  const ctx = npcSubstrateContext(w, nodeId);

  assert.ok(Array.isArray(ctx), 'returns array');
  assert.ok(ctx.length > 0, 'returns at least one event');

  const vivid = ctx.filter(e => e.clarity === 'vivid');
  const dim   = ctx.filter(e => e.clarity === 'dim');
  const myth  = ctx.filter(e => e.clarity === 'myth');

  assert.ok(vivid.length >= 1, `at least one vivid (node) event; got ${vivid.length}`);
  assert.ok(dim.length   >= 1, `at least one dim (region) event; got ${dim.length}`);
  assert.ok(myth.length  >= 1, `at least one myth (cosmology) event; got ${myth.length}`);

  // Every entry must have required fields.
  for (const e of ctx) {
    assert.ok(e.layer,   'entry has layer');
    assert.ok(e.kind,    'entry has kind');
    assert.ok(e.label,   'entry has label');
    assert.ok(e.clarity, 'entry has clarity');
    assert.ok(['vivid', 'dim', 'myth'].includes(e.clarity), `clarity is valid: ${e.clarity}`);
  }
});

test('U140-02: two NPCs from different towns have different vivid (local) events', () => {
  // Use two different seeds so the towns are definitely distinct nodes.
  const wA = worldAtNode('u140a');
  const wB = worldAtNode('u140b');
  const nodeA = wA.map.currentNodeId;
  const nodeB = wB.map.currentNodeId;

  const ctxA = npcSubstrateContext(wA, nodeA);
  const ctxB = npcSubstrateContext(wB, nodeB);

  const vividA = ctxA.filter(e => e.clarity === 'vivid').map(e => e.label);
  const vividB = ctxB.filter(e => e.clarity === 'vivid').map(e => e.label);

  // Vivid events are node-local — they must differ across different nodes.
  const overlap = vividA.filter(l => vividB.includes(l));
  assert.ok(
    overlap.length < Math.min(vividA.length, vividB.length),
    `vivid events differ across towns (overlap: ${overlap.length}/${Math.min(vividA.length, vividB.length)})`
  );
});

test('U140-03: the dialogue handle carries substrateContext on a real NPC ask', () => {
  const w = worldAtNode('u140a');
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npc = here?.settlement?.npcs?.[0];
  assert.ok(npc, 'settlement has at least one NPC');

  const opened = playerMove(w, packs, `talk to ${npc.name}`);
  const asked  = playerMove(opened.world, packs, 'any news?');

  const d = asked.output?.dialogue;
  assert.ok(d, 'dialogue handle present in output');
  assert.ok(Array.isArray(d.substrateContext), 'substrateContext is an array');
  assert.ok(d.substrateContext.length > 0, 'substrateContext has entries');

  const vivid = d.substrateContext.filter(e => e.clarity === 'vivid');
  const dim   = d.substrateContext.filter(e => e.clarity === 'dim');
  assert.ok(vivid.length >= 1, 'at least one vivid entry on handle');
  assert.ok(dim.length   >= 1, 'at least one dim entry on handle');

  assertWorldInvariants(asked.world);
});

test('U140-04: buildNpcVoicePrompt renders cascade-weighted WORLD KNOWLEDGE block', () => {
  const substrateContext = [
    { layer: 'node',      clarity: 'vivid', kind: 'founding',    label: 'settled where the road bends and the water table is reliably shallow' },
    { layer: 'node',      clarity: 'vivid', kind: 'local-event', label: 'the boundary dispute over the eastern field, settled badly, still resented' },
    { layer: 'region',    clarity: 'dim',   kind: 'crisis',      label: 'the plague that emptied the river settlements for two seasons' },
    { layer: 'cosmology', clarity: 'myth',  kind: 'age',         label: "The age of Patience's ascendancy — Verdant Hand have never been more listened to" },
  ];

  const prompt = buildNpcVoicePrompt({
    npcName: 'Maret',
    role: 'miller',
    mood: 'wary',
    manner: 'blunt',
    mode: 'deflected',
    playerLine: 'what happened here?',
    substrateContext
  });

  assert.ok(prompt, 'prompt is generated');
  assert.match(prompt, /WHAT MARET KNOWS/,        'world knowledge header names the NPC');
  assert.match(prompt, /VIVID/,                   'vivid section present');
  assert.match(prompt, /road bends/,              'vivid local event in prompt');
  assert.match(prompt, /eastern field/,           'second vivid event in prompt');
  assert.match(prompt, /DIM/,                     'dim section present');
  assert.match(prompt, /plague/,                  'dim region event in prompt');
  assert.match(prompt, /MYTH/,                    'myth section present');
  assert.match(prompt, /Patience/,                'myth cosmology event in prompt');
  assert.match(prompt, /cascade rung/i,           'cascade instruction present');
  // The decision still governs.
  assert.match(prompt, /DEFLECT/,                 'engine decision is still law');
  assert.match(prompt, /BLUNT/,                   'manner still present');
});

test('U140-05: empty substrateContext produces no world knowledge block', () => {
  const prompt = buildNpcVoicePrompt({
    npcName: 'Torin',
    role: 'farmer',
    manner: 'even',
    mode: 'deflected',
    playerLine: 'x',
    substrateContext: []
  });
  assert.ok(prompt, 'prompt still generated');
  assert.ok(!/WHAT TORIN KNOWS/.test(prompt), 'no world knowledge block when substrate empty');
});

test('U140-06: two NPCs from different towns produce different world-knowledge blocks in voice prompt', () => {
  const wA = worldAtNode('u140c');
  const wB = worldAtNode('u140d');
  const ctxA = npcSubstrateContext(wA, wA.map.currentNodeId);
  const ctxB = npcSubstrateContext(wB, wB.map.currentNodeId);

  const baseArgs = { role: 'laborer', manner: 'even', mode: 'deflected', playerLine: 'any news?' };
  const promptA = buildNpcVoicePrompt({ npcName: 'Aldric', ...baseArgs, substrateContext: ctxA });
  const promptB = buildNpcVoicePrompt({ npcName: 'Sela',   ...baseArgs, substrateContext: ctxB });

  assert.ok(promptA, 'prompt A generated');
  assert.ok(promptB, 'prompt B generated');

  // Extract the world knowledge block from each prompt.
  const wkA = promptA.match(/WHAT ALDRIC KNOWS[\s\S]*?Ground your speech/)?.[0] || '';
  const wkB = promptB.match(/WHAT SELA KNOWS[\s\S]*?Ground your speech/)?.[0] || '';

  assert.ok(wkA.length > 0, 'world knowledge block present in A');
  assert.ok(wkB.length > 0, 'world knowledge block present in B');

  // The two NPCs are from different nodes — their local (vivid) events must differ.
  const vividLinesA = (wkA.match(/•[^•]*/g) || []).filter(l => l).map(l => l.trim());
  const vividLinesB = (wkB.match(/•[^•]*/g) || []).filter(l => l).map(l => l.trim());
  const identical = vividLinesA.filter(l => vividLinesB.includes(l));
  assert.ok(
    identical.length < vividLinesA.length,
    `NPCs from different towns have different world-knowledge lines (shared: ${identical.length}/${vividLinesA.length})`
  );
});
