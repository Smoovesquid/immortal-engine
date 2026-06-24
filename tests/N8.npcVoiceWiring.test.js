// N8: NPC voice wiring (Packet D-C1).
//
// The NPC voice layer (buildNpcVoicePrompt + retrieveChunks) is proven; this
// gates the WIRING: an ordinary NPC resolves to a corpus, the engine surfaces
// that corpus id on the askNpc outcome WITHOUT touching world state, and the new
// Opus call fn (callNpcVoice) renders one line through Opus 4.8 — omitting
// `temperature` (Opus 4.8 rejects it) — with a silent fallback when no key.
//
// Contracts asserted:
//   • Resolver: archetype/role hit, miss → null, explicit override honored.
//   • callNpcVoice: stub fetch → canned line; request omits temperature; uses
//     the Opus model and a system block; throws on !res.ok (caller catches).
//   • Road A / determinism: askNpc carries voiceCorpusId but worldHash is
//     identical to a control run (the engine never calls the LLM), and an
//     LLM-off dialogue turn does not throw.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';
import { beginDialogue, askNpc } from '../engine/npc/dialogue.js';
import { worldHash } from '../engine/worldHash.js';
import { npcVoiceCorpusId, normalizeCorpusKey, sanitizeCorpusId } from '../engine/npc/npcVoiceResolve.js';
import { callNpcVoice } from '../engine/llmAdapter.js';

// ── 1. Resolver unit ──────────────────────────────────────────────────────────

test('N8: resolver maps a known archetype/role to an existing corpus basename', () => {
  // 'smith' and 'merchant' are minted by npcGenesis BUILDING_ARCHETYPES.
  assert.equal(npcVoiceCorpusId({ role: 'smith' }), 'forge_master');
  assert.equal(npcVoiceCorpusId({ role: 'merchant' }), 'comus_merchant');
  // A GENERIC_ROLE.
  assert.equal(npcVoiceCorpusId({ role: 'elder' }), 'covenant_elder');
  // Free-form / cased / spaced forms normalize.
  assert.equal(npcVoiceCorpusId({ role: 'Blacksmith' }), 'forge_master');
  assert.equal(npcVoiceCorpusId({ archetype: 'tavern keeper' }), 'brevis_tavern');
});

test('N8: resolver returns null for an unmapped role (caller keeps the template)', () => {
  assert.equal(npcVoiceCorpusId({ role: 'wandering_oracle_of_the_ninth_void' }), null);
  assert.equal(npcVoiceCorpusId({ role: '' }), null);
  assert.equal(npcVoiceCorpusId({}), null);
  assert.equal(npcVoiceCorpusId(null), null);
});

test('N8: explicit npc.voiceCorpusId override is honored over role mapping', () => {
  // Reserved for the named figures (Joan/Jesus/…): the override wins even when
  // the role would otherwise map elsewhere. Hyphens are PRESERVED — the
  // named-figure corpora use them (joan-of-arc.json).
  assert.equal(
    npcVoiceCorpusId({ voiceCorpusId: 'joan-of-arc', role: 'smith' }),
    'joan-of-arc'
  );
  assert.equal(
    npcVoiceCorpusId({ voiceCorpusId: 'alexander-the-great' }),
    'alexander-the-great'
  );
  // Override is sanitized to a safe basename (path separators/dots stripped) so
  // it can't escape the corpus dir; hyphens/underscores survive.
  assert.equal(sanitizeCorpusId('../../etc/passwd'), 'etcpasswd');
  assert.equal(sanitizeCorpusId('Bram_Undertaker'), 'bram_undertaker');
  // Role-key normalization still folds hyphens to underscores (allowlist keys).
  assert.equal(normalizeCorpusKey('Kant Knight'), 'kant_knight');
});

test('N8: archetype is preferred over role when both map', () => {
  // archetype is the more specific signal; check it wins.
  assert.equal(npcVoiceCorpusId({ archetype: 'hunter', role: 'merchant' }), 'drass_hunter');
});

// ── 2. callNpcVoice (the Opus 4.8 call fn) ──────────────────────────────────────

function stubFetch(line, { ok = true, status = 200 } = {}) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts, body: JSON.parse(opts.body) });
    return {
      ok,
      status,
      json: async () => ({ content: [{ type: 'text', text: line }] })
    };
  };
  impl.calls = calls;
  return impl;
}

test('N8: callNpcVoice returns the model line and OMITS temperature (Opus 4.8 rejects it)', async () => {
  const fetchImpl = stubFetch('Aye, the forge is mine — has been twenty years.');
  const line = await callNpcVoice({ prompt: 'SYSTEM PROMPT HERE', apiKey: 'sk-test', fetchImpl });

  assert.equal(line, 'Aye, the forge is mine — has been twenty years.');
  assert.equal(fetchImpl.calls.length, 1);
  const body = fetchImpl.calls[0].body;
  // ⚠️ The load-bearing assertion: NO temperature field at all.
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'temperature'), false,
    'callNpcVoice must not send temperature — Opus 4.8 returns HTTP 400 if it does');
  // Uses the Opus voice model and the built prompt as the system block.
  assert.equal(body.model, 'claude-opus-4-8');
  assert.ok(Array.isArray(body.system) && body.system[0]?.text === 'SYSTEM PROMPT HERE');
  assert.equal(body.max_tokens, 120);
});

test('N8: callNpcVoice strips wrapping quotes and collapses to one line', async () => {
  const fetchImpl = stubFetch('  "Couldn\'t say."  \n  (extra)  ');
  const line = await callNpcVoice({ prompt: 'p', apiKey: 'sk', fetchImpl });
  // Leading/trailing quote stripped, whitespace collapsed.
  assert.ok(!line.startsWith('"'));
  assert.ok(line.startsWith("Couldn't say."));
});

test('N8: callNpcVoice throws on !res.ok so the caller can fall back', async () => {
  const fetchImpl = stubFetch('ignored', { ok: false, status: 400 });
  await assert.rejects(
    () => callNpcVoice({ prompt: 'p', apiKey: 'sk', fetchImpl }),
    /HTTP 400/
  );
});

// ── 3. Road A / determinism — askNpc surfaces the id but never mutates state ────

function makeWorldWithSettlement(seed = 'n8-seed') {
  let w = newWorld({ seed, fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } });
  const settlements = w.map.nodes.filter(n => n.nodeType === 'settlement');
  if (!settlements.length) throw new Error('No settlements in test world');
  const nodeId = settlements[0].id;
  w = { ...w, map: { ...w.map, currentNodeId: nodeId } };
  const pack = { objectives: ['survive'], factionPool: [{ id: 'civic', type: 'civic' }] };
  w = decompressAndCanonizeSync(w, nodeId, pack);
  return { w, nodeId };
}

function firstNpc(w, nodeId) {
  return w.map.nodes.find(n => n.id === nodeId).settlement.npcs[0];
}

test('N8: askNpc surfaces voiceCorpusId on the outcome (LLM-off, no throw)', () => {
  const { w, nodeId } = makeWorldWithSettlement();
  const npc0 = firstNpc(w, nodeId);
  const { world: w1 } = beginDialogue(w, npc0.id);

  // No key, no fetch — the pure engine path. Must not throw.
  let res;
  assert.doesNotThrow(() => { res = askNpc(w1, 'tell me about yourself'); });
  assert.equal(res.outcome.ok, true);
  // The handle carries a string voiceCorpusId — '' when the role doesn't map,
  // or a basename when it does. Either way it is present and a string.
  assert.equal(typeof res.outcome.voiceCorpusId, 'string');
  // The fixture's first NPC takes a building/generic role npcGenesis mints, all
  // of which the resolver maps — so it should be non-empty here.
  assert.equal(res.outcome.voiceCorpusId, npcVoiceCorpusId(npc0) || '');
});

test('N8: voiceCorpusId is a pure derivation — worldHash is unchanged by it', () => {
  // Two independent runs of the same seeded ask must produce the same world AND
  // the same hash. The voice id rides the outcome (presentation), never state.
  const a = makeWorldWithSettlement('n8-determinism');
  const b = makeWorldWithSettlement('n8-determinism');
  const npcA = firstNpc(a.w, a.nodeId);
  const npcB = firstNpc(b.w, b.nodeId);

  const { world: wa } = beginDialogue(a.w, npcA.id);
  const { world: wb } = beginDialogue(b.w, npcB.id);
  const ra = askNpc(wa, 'what do you know about this place');
  const rb = askNpc(wb, 'what do you know about this place');

  // Same id surfaced, identical resulting world hash (determinism preserved).
  assert.equal(ra.outcome.voiceCorpusId, rb.outcome.voiceCorpusId);
  assert.equal(worldHash(ra.world), worldHash(rb.world));
});
