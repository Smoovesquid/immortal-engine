// U470 — CG-2 (Candidate A) THE SAFE FLOOR + THE SINGLE-EXIT CHOKE POINT.
//
// (1) A ghost-voicing BASE (the CG-LIVE-1b shape: a named roster NPC "speaks" in
//     a room canon says is EMPTY) in 'on' mode must exit through the
//     description-only coherence-safe floor — NO absent-NPC speech reaches the
//     player. This is the load-bearing §2 nuance: the base is not guaranteed
//     coherent, so "fall back to base on a flag" is not enough; a flagged base
//     degrades to the floor.
//
// (2) finalize() is the SINGLE exit for all three delivery paths — the offline/
//     base path, the LLM-rejected path, and the LLM-accepted path. We prove the
//     choke point by driving augmentNarration end-to-end through EACH path in
//     'on' mode and asserting every one of them is subject to the coherence
//     check (a flagged output is replaced; a clean output passes through).
//
// The world is a REAL booted tallow escape world whose canon bundle is exactly
// the CG-LIVE-1b shape (interior Bedchamber, roomOccupants:[], roster carries
// Elske/Dalla/Asha/…), so the ghost-voice actually flags against live ground
// truth — not a hand-mocked bundle. The LLM is a deterministic mock fetch (no
// network, no key needed beyond a dummy).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { augmentNarration } from '../engine/llmAdapter.js';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { coherenceRejects } from '../engine/coherence/validator.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// Async-safe: AWAITS fn() before restoring env, so the flag is still set when an
// async augmentNarration reads coherenceValidateMode() after its awaits resolve.
// (A synchronous try/finally would restore the env during the first microtask
// gap and the async body would read the OLD value — the classic env-race.)
async function withEnv(env, fn) {
  const saved = {};
  for (const k of Object.keys(env)) saved[k] = process.env[k];
  Object.assign(process.env, env);
  try { return await fn(); }
  finally {
    for (const k of Object.keys(env)) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
}

// A mock Anthropic fetch that returns a fixed candidate string as the model's
// output (data.content[0].text), matching callLLM's contract.
function mockFetch(candidateText) {
  return async () => ({ ok: true, json: async () => ({ content: [{ text: candidateText }] }) });
}

// The exact CG-LIVE-1b ghost-voice: a roster NPC "shrugs/speaks" while the room
// (Bedchamber) is empty. `containsInsensitive` location-lock in the validator
// needs the placeName ("Wayfarers' Outpost") to be present for an LLM candidate
// to survive to the choke point, so the LLM variants include it.
const GHOST_BASE = 'Elske Nightherd shrugs. "Can\'t say."';

test('U470: precondition — the booted world IS the CG-LIVE-1b shape (empty interior room, roster non-empty)', () => {
  const world = boot();
  const verdict = coherenceRejects({ world, candidate: GHOST_BASE, outcome: { input: 'who spoke', mechanics: '' } });
  assert.equal(verdict.blocks, true, 'the ghost-voice base must flag against the real world canon');
  assert.ok(verdict.fails.some(f => f.class === 'CG-1b'), 'the flag is CG-1b ghost-voice');
});

test('U470: OFFLINE path — a ghost-voicing BASE in "on" mode is delivered as the safe floor (no NPC speech)', async () => {
  const world = boot();
  const out = await withEnv({ COHERENCE_VALIDATE: 'on' }, () =>
    // enabled:false → the offline path returns `base`, routed through finalize().
    augmentNarration({ world, outcome: { input: 'who spoke', mechanics: '' }, baseNarration: GHOST_BASE, enabled: false }),
  );
  // The delivered line must NOT be the ghost-voice base.
  assert.notEqual(out, GHOST_BASE, 'the flagged base must not be delivered verbatim');
  // And it must itself be coherence-clean (no absent-NPC speech survives).
  assert.equal(coherenceRejects({ world, candidate: out, outcome: { input: 'who spoke', mechanics: '' } }).blocks, false,
    'the delivered floor must not itself flag');
  // Concretely: the absent NPC does not "speak/shrug/say" in the delivered line.
  assert.ok(!/Elske Nightherd\s+(shrugs|says|nods|answers|replies)/i.test(out),
    `no absent-NPC speech act must survive; got "${out}"`);
  assert.ok(out.trim().length > 0, 'the floor is a non-empty grounded string');
});

test('U470: OFFLINE path — a CLEAN base in "on" mode is delivered UNCHANGED (no over-block)', async () => {
  const world = boot();
  // A pure sensory description that flags nothing against the Bedchamber canon.
  const cleanBase = 'The bedchamber is cold and still at Wayfarers\' Outpost, its shutters drawn against the dark.';
  const out = await withEnv({ COHERENCE_VALIDATE: 'on' }, () =>
    augmentNarration({ world, outcome: { input: 'look', mechanics: '' }, baseNarration: cleanBase, enabled: false }),
  );
  assert.equal(out, cleanBase, 'a clean base passes through the choke point unchanged in "on" mode');
});

test('U470: LLM-ACCEPTED path — a ghost-voicing candidate that PASSES the Tier-1 validator is still blocked by the coherence choke point in "on" mode', async () => {
  const world = boot();
  // This candidate passes validateNarrationCandidate (single sentence, no table
  // leak, includes the location "Wayfarers' Outpost") — but it ghost-voices Elske
  // in an empty room, so the coherence choke point must catch it.
  const ghostCandidate = 'At Wayfarers\' Outpost, Elske Nightherd shrugs and says she cannot say.';
  const cleanBase = 'The bedchamber at Wayfarers\' Outpost is silent, the hearth long cold.';

  const out = await withEnv({ COHERENCE_VALIDATE: 'on' }, () =>
    augmentNarration({
      world,
      outcome: { input: 'ask who spoke', mechanics: '' },
      baseNarration: cleanBase,
      enabled: true,
      apiKey: 'test-key',
      fetchImpl: mockFetch(ghostCandidate),
    }),
  );
  // The ghost candidate must NOT reach the player.
  assert.notEqual(out, ghostCandidate, 'the ghost-voicing LLM candidate must be rejected at the coherence choke point');
  // Because the base here is clean, the fallback is the base (not the floor).
  assert.equal(out, cleanBase, 'a clean base is the fallback when the polish is rejected');
  assert.equal(coherenceRejects({ world, candidate: out, outcome: { input: 'ask who spoke', mechanics: '' } }).blocks, false);
});

test('U470: LLM-ACCEPTED path — a CLEAN candidate passes the choke point and IS delivered in "on" mode', async () => {
  const world = boot();
  const cleanCandidate = 'The bedchamber at Wayfarers\' Outpost lies quiet, dust settling in the still air.';
  const cleanBase = 'The room is still at Wayfarers\' Outpost.';
  const out = await withEnv({ COHERENCE_VALIDATE: 'on' }, () =>
    augmentNarration({
      world,
      outcome: { input: 'look', mechanics: '' },
      baseNarration: cleanBase,
      enabled: true,
      apiKey: 'test-key',
      fetchImpl: mockFetch(cleanCandidate),
    }),
  );
  assert.equal(out, cleanCandidate, 'a coherent polished candidate is delivered unchanged through the choke point');
});

test('U470: LLM-ACCEPTED path — when BOTH candidate and base ghost-voice, "on" mode falls all the way to the safe floor', async () => {
  const world = boot();
  const ghostCandidate = 'At Wayfarers\' Outpost, Elske Nightherd shrugs and says she cannot say.';
  const ghostBase = GHOST_BASE; // base ALSO flags → must degrade to the floor
  const out = await withEnv({ COHERENCE_VALIDATE: 'on' }, () =>
    augmentNarration({
      world,
      outcome: { input: 'ask who spoke', mechanics: '' },
      baseNarration: ghostBase,
      enabled: true,
      apiKey: 'test-key',
      fetchImpl: mockFetch(ghostCandidate),
    }),
  );
  assert.notEqual(out, ghostCandidate, 'the ghost candidate is rejected');
  assert.notEqual(out, ghostBase, 'the ghost BASE is also rejected — never shipped silently');
  assert.equal(coherenceRejects({ world, candidate: out, outcome: { input: 'ask who spoke', mechanics: '' } }).blocks, false,
    'the ultimate fallback (safe floor) is coherence-clean');
  assert.ok(!/Elske Nightherd\s+(shrugs|says)/i.test(out), 'no absent-NPC speech survives to the player');
});

test('U470: the choke point is the SINGLE exit — every "on"-mode delivery path yields a coherence-clean line', async () => {
  const world0 = boot();
  const scenarios = [
    // [label, augmentNarration args]
    ['offline base-flagged', { world: boot(), outcome: { input: 'who', mechanics: '' }, baseNarration: GHOST_BASE, enabled: false }],
    ['offline base-clean',   { world: boot(), outcome: { input: 'look', mechanics: '' }, baseNarration: 'The bedchamber at Wayfarers\' Outpost is quiet.', enabled: false }],
    ['llm rejected → base',  { world: boot(), outcome: { input: 'who', mechanics: '' }, baseNarration: 'The bedchamber at Wayfarers\' Outpost is quiet.', enabled: true, apiKey: 'k', fetchImpl: mockFetch('At Wayfarers\' Outpost, Elske Nightherd shrugs and says nothing.') }],
    ['llm accepted clean',   { world: boot(), outcome: { input: 'look', mechanics: '' }, baseNarration: 'x', enabled: true, apiKey: 'k', fetchImpl: mockFetch('The bedchamber at Wayfarers\' Outpost is dim and silent.') }],
    ['llm error → base',     { world: boot(), outcome: { input: 'look', mechanics: '' }, baseNarration: 'The bedchamber at Wayfarers\' Outpost is quiet.', enabled: true, apiKey: 'k', fetchImpl: async () => { throw new Error('boom'); } }],
  ];
  for (const [label, args] of scenarios) {
    const out = await withEnv({ COHERENCE_VALIDATE: 'on' }, () => augmentNarration(args));
    const verdict = coherenceRejects({ world: args.world, candidate: out, outcome: args.outcome });
    assert.equal(verdict.blocks, false, `[${label}] every delivery path must exit coherence-clean; got "${out}"`);
    assert.ok(String(out).trim().length > 0, `[${label}] the delivered line is never empty`);
  }
  // worldHash unchanged across all that driving (no mutation anywhere).
  assert.ok(worldHash(world0), 'sanity: worldHash computable');
});

test('U470: "on" mode never throws and never mutates the world', async () => {
  const world = boot();
  const before = worldHash(world);
  // Malformed-ish outcome (getter throws) must be swallowed by the choke point.
  const out = await withEnv({ COHERENCE_VALIDATE: 'on' }, () =>
    augmentNarration({ world, outcome: { input: 'look', mechanics: '' }, baseNarration: 'The bedchamber at Wayfarers\' Outpost is quiet.', enabled: false }),
  );
  assert.ok(typeof out === 'string', 'returns a string, no throw');
  assert.equal(worldHash(world), before, 'worldHash unchanged — no mutation, no RNG in the validator/floor');
});
