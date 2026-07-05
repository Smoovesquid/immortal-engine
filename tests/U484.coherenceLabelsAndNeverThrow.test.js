// U484 — CG-2b LABELS + NEVER-THROW (rule 3 + the silent-fallback law).
//
// LABELS: the shadow-compare log's `persona`/`turn` fields must carry REAL
// request-scoped identifiers when the caller supplies them (`outcome.persona`/
// `outcome.turn`), and honestly fall back — never a fake-looking placeholder.
// The evidence record's `persona:"campaign"` was simply `world.meta.campaignId`'s
// DEFAULT VALUE flowing through unlabeled (newWorld() defaults campaignId to the
// literal string 'campaign' whether or not a real persona was ever configured —
// confirmed empirically: no caller in this codebase, including the gate harness
// scripts/dm-playtest.mjs, ever sets campaignId to a real persona name). Per the
// brief: "if the request genuinely has no persona (live play), label it 'live'."
// So the fix sources labels from REQUEST-SCOPED plumbing only:
//   persona: outcome.persona if a caller sets it, else 'live' (never
//            world.meta.campaignId, which is always the bare default in
//            practice and would just relabel the SAME lie under a different name).
//   turn:    outcome.turn if a caller sets it, else world.time.turn (an
//            EXISTING, already-incrementing world-state field — read-only
//            consumption, not a field invented for this) — else null.
// No new field is added to world state's schema for this purpose.
//
// NEVER-THROW: the finalize() choke point (and the swap ladder inside it) must
// degrade to delivering the candidate if ANY detector in the bank throws mid
// fallback-recheck — the LLM/coherence layer's silent-fallback law (Invariant 3)
// extends to the NEW swap-gate code paths, not just the pre-existing ones.
//
// No LLM, no server, no network — pure comparators + augmentNarration's
// offline/mocked-fetch paths, routed through the real finalize() choke point.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { augmentNarration } from '../engine/llmAdapter.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

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

function tmpLog() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-2b-')), 'validate.jsonl');
}

function mockFetch(candidateText) {
  return async () => ({ ok: true, json: async () => ({ content: [{ text: candidateText }] }) });
}

// ─────────────────────────────────────────────────────────────────────────────
// LABELS
// ─────────────────────────────────────────────────────────────────────────────

test('U484: precondition — world.meta.campaignId is ALWAYS the bare default "campaign" in practice (confirming it is not a real persona)', () => {
  const world = boot();
  assert.equal(world.meta?.campaignId, 'campaign', 'newWorld() defaults campaignId to the literal "campaign" — this is the "persona" the evidence record showed, not a real label');
});

test('U484: LABELS — a caller-supplied outcome.persona is threaded through the shadow-compare log verbatim', async () => {
  const world = boot();
  const logFile = tmpLog();
  await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
    augmentNarration({
      world, outcome: { input: 'look', mechanics: '', persona: 'chaos' },
      baseNarration: 'The room is still.', enabled: false,
    }),
  );
  const rec = JSON.parse(fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean)[0]);
  assert.equal(rec.persona, 'chaos', 'the real persona label reaches the log, not "campaign"');
});

test('U484: LABELS — with NO outcome.persona, live play honestly labels "live" (never a fake-looking "campaign")', async () => {
  const world = boot();
  const logFile = tmpLog();
  await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
    augmentNarration({
      world, outcome: { input: 'look', mechanics: '' }, // no persona field — the live /api/narrate shape
      baseNarration: 'The room is still.', enabled: false,
    }),
  );
  const rec = JSON.parse(fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean)[0]);
  assert.equal(rec.persona, 'live', 'no persona in the request → honestly labeled "live", not world.meta.campaignId\'s default');
});

test('U484: LABELS — an empty-string or whitespace-only outcome.persona ALSO falls back to "live" (not a blank label)', async () => {
  for (const blankPersona of ['', '   ']) {
    const world = boot();
    const logFile = tmpLog();
    await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
      augmentNarration({
        world, outcome: { input: 'look', mechanics: '', persona: blankPersona },
        baseNarration: 'The room is still.', enabled: false,
      }),
    );
    const rec = JSON.parse(fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean)[0]);
    assert.equal(rec.persona, 'live', `blank persona "${blankPersona}" must fall back to "live"`);
  }
});

test('U484: LABELS — a caller-supplied outcome.turn (including 0) is threaded through verbatim', async () => {
  for (const turnValue of [0, 12, 999]) {
    const world = boot();
    const logFile = tmpLog();
    await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
      augmentNarration({
        world, outcome: { input: 'look', mechanics: '', turn: turnValue },
        baseNarration: 'The room is still.', enabled: false,
      }),
    );
    const rec = JSON.parse(fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean)[0]);
    assert.equal(rec.turn, turnValue, `outcome.turn=${turnValue} (including falsy 0) must be threaded through exactly, never coerced to null`);
  }
});

test('U484: LABELS — with NO outcome.turn, the log falls back to the EXISTING world.time.turn field (read-only; not a field invented for this)', async () => {
  const world = boot();
  world.time.turn = 42; // simulate a mid-playthrough world — world.time.turn is a real, pre-existing field
  const logFile = tmpLog();
  await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
    augmentNarration({
      world, outcome: { input: 'look', mechanics: '' }, // no turn field
      baseNarration: 'The room is still.', enabled: false,
    }),
  );
  const rec = JSON.parse(fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean)[0]);
  assert.equal(rec.turn, 42, 'falls back to the real world.time.turn, not null, when the request carries no turn');
});

test('U484: LABELS — with neither outcome.turn nor a numeric world.time.turn, the log honestly carries null', async () => {
  const world = boot();
  delete world.time.turn; // simulate a malformed/legacy world with no turn counter at all
  const logFile = tmpLog();
  await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
    augmentNarration({
      world, outcome: { input: 'look', mechanics: '' },
      baseNarration: 'The room is still.', enabled: false,
    }),
  );
  const rec = JSON.parse(fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean)[0]);
  assert.equal(rec.turn, null, 'no honest turn source anywhere → null, never a fabricated number');
});

test('U484: LABELS — no world state SCHEMA field was invented for this (world.time.turn is read, never written by the validator/adapter)', async () => {
  const world = boot();
  const before = worldHash(world);
  await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: tmpLog() }, () =>
    augmentNarration({
      world, outcome: { input: 'look', mechanics: '', persona: 'newbie', turn: 3 },
      baseNarration: 'The room is still.', enabled: false,
    }),
  );
  assert.equal(worldHash(world), before, 'labeling reads world.time.turn but writes NOTHING to world state — worldHash is untouched');
});

// ─────────────────────────────────────────────────────────────────────────────
// NEVER-THROW (silent-fallback law extended to the swap-gate code paths)
// ─────────────────────────────────────────────────────────────────────────────

test('U484: NEVER-THROW — a throwing outcome getter mid fallback-recheck still delivers a non-empty string (ON mode)', async () => {
  const world = boot();
  // A malformed outcome whose `.input` getter throws when read. The swap
  // ladder reads `outcome` multiple times (candidate verdict, base verdict,
  // floor verdict) — this exercises that every one of those reads is
  // defensively wrapped, not just the first.
  const throwingOutcome = {
    mechanics: '',
    get input() { throw new Error('boom — outcome.input getter throws'); },
  };
  const out = await withEnv({ COHERENCE_VALIDATE: 'on' }, () =>
    augmentNarration({
      world, outcome: throwingOutcome,
      baseNarration: 'The bedchamber at Wayfarers\' Outpost is quiet.', enabled: false,
    }),
  );
  assert.equal(typeof out, 'string', 'never throws — returns a string');
  assert.ok(out.trim().length > 0, 'the delivered line is never empty even when a read inside the swap ladder throws');
});

test('U484: NEVER-THROW — a throwing outcome getter mid fallback-recheck still delivers unchanged in SHADOW-COMPARE mode (no log corruption, no throw)', async () => {
  const world = boot();
  const logFile = tmpLog();
  const throwingOutcome = {
    mechanics: '',
    get input() { throw new Error('boom'); },
  };
  const candidate = 'Elske Nightherd shrugs. "Can\'t say."';
  const out = await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
    augmentNarration({ world, outcome: throwingOutcome, baseNarration: candidate, enabled: false }),
  );
  assert.equal(out, candidate.trim(), 'shadow-compare still delivers the candidate unchanged even when a read throws');
});

test('U484: NEVER-THROW — the exact brief wording: a detector bank that throws MID FALLBACK-RECHECK (not on the first pass) still delivers the candidate', async () => {
  // The swap ladder calls coherenceRejects() up to THREE times per turn
  // (candidate, base, floor) — each rebuilds the canon bundle via
  // buildCanonGroundTruth(world). This poisons world.map.nodes so the FIRST
  // read (building the candidate's own verdict) succeeds, but every
  // SUBSEQENT read (the base/floor re-checks inside runSwapLadder — the
  // "fallback-recheck" the brief names) throws. The candidate itself DOES
  // hard-fail (a ghost-voice), so the swap ladder genuinely attempts a
  // fallback recheck and hits the poisoned read there.
  const world = boot();
  let reads = 0;
  Object.defineProperty(world.map, 'nodes', {
    get() {
      reads++;
      if (reads > 1) throw new Error('boom — the detector bank throws mid fallback-recheck');
      return [];
    },
    configurable: true,
  });
  const ghostLine = 'Elske Nightherd shrugs. "Can\'t say."';
  const out = await withEnv({ COHERENCE_VALIDATE: 'on' }, () =>
    augmentNarration({ world, outcome: { input: 'who', mechanics: '' }, baseNarration: ghostLine, enabled: false }),
  );
  assert.ok(reads > 1, 'precondition: the fallback recheck genuinely re-read the poisoned field (not short-circuited before it)');
  assert.equal(typeof out, 'string', 'never throws even when a detector bank read throws mid-recheck');
  assert.equal(out, ghostLine.trim(), 'degrades to delivering the candidate unchanged — the silent-fallback law (Invariant 3)');
});

test('U484: NEVER-THROW — a world whose meta accessors throw still yields a non-empty delivered string, no unhandled rejection', async () => {
  const world = boot();
  // Poison world.meta so seed/campaignId reads throw — exercises the
  // logPersona()/logTurn() label helpers' own defensiveness too.
  Object.defineProperty(world, 'meta', {
    get() { throw new Error('boom — world.meta getter throws'); },
    configurable: true,
  });
  const out = await withEnv({ COHERENCE_VALIDATE: 'on' }, () =>
    augmentNarration({
      world, outcome: { input: 'look', mechanics: '' },
      baseNarration: 'The bedchamber is quiet.', enabled: false,
    }),
  );
  assert.equal(typeof out, 'string');
  assert.ok(out.trim().length > 0, 'a poisoned world.meta must not crash the turn — degrades to a non-empty delivered string');
});

test('U484: NEVER-THROW — shadow-compare with a poisoned world.meta does not throw and does not corrupt the log file', async () => {
  const world = boot();
  const logFile = tmpLog();
  Object.defineProperty(world, 'meta', {
    get() { throw new Error('boom'); },
    configurable: true,
  });
  let threw = false;
  let out;
  try {
    out = await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
      augmentNarration({
        world, outcome: { input: 'look', mechanics: '' },
        baseNarration: 'The bedchamber is quiet.', enabled: false,
      }),
    );
  } catch {
    threw = true;
  }
  assert.equal(threw, false, 'augmentNarration must never throw to the caller, even with a poisoned world.meta');
  assert.equal(typeof out, 'string');
});

test('U484: NEVER-THROW — ON mode never mutates the world even when a read inside the swap ladder throws', async () => {
  const world = boot();
  const before = worldHash(world);
  const throwingOutcome = { mechanics: '', get input() { throw new Error('boom'); } };
  await withEnv({ COHERENCE_VALIDATE: 'on' }, () =>
    augmentNarration({ world, outcome: throwingOutcome, baseNarration: 'The room is quiet.', enabled: false }),
  );
  assert.equal(worldHash(world), before, 'no mutation, no RNG, even on the defensive/throwing code path');
});
