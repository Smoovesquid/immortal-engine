// U425 — CG-1c: shared-core proof. The live shadow observer
// (engine/coherence/shadowObserver.js, gated by COHERENCE_SHADOW=1) and the CLI
// checker (scripts/coherence-gate.mjs, re-exporting engine/coherence/checks.js)
// already share ONE comparator core by construction (CG-LIVE-1). This test
// proves the absence guard landing in that shared core (this packet) produces
// IDENTICAL verdicts down both call paths over the SAME turn record — with the
// guard active, neither path may see the FP that the other doesn't, and both
// must still catch the true positive. A regenerator that ever gets wired to
// only one of these paths would silently diverge from the checker that graded
// it; this test is the tripwire for that class of drift.
//
// No LLM, no server, no network — deterministic. Uses the exact historical
// turns (persona=newbie, i=7 true-positive / i=10 false-positive) from
// docs/playtests/gate-runs/gate-2026-07-04T15-01-26-563Z-v1.jsonl, the same
// real corpus turns U424 locks at the detector-unit level — this test locks
// them at the two-CALL-PATH level instead.

import test from 'node:test';
import assert from 'node:assert/strict';

import { observeCoherenceShadow, __resetShadowState } from '../engine/coherence/shadowObserver.js';
import { runCoherenceGate } from '../scripts/coherence-gate.mjs';

function withShadow(env, fn) {
  const prevFlag = process.env.COHERENCE_SHADOW;
  Object.assign(process.env, env);
  try { return fn(); }
  finally {
    if (prevFlag === undefined) delete process.env.COHERENCE_SHADOW; else process.env.COHERENCE_SHADOW = prevFlag;
  }
}

// The real canon bundle from the historical newbie session (both the FP turn,
// i=10, and its true-positive sibling, i=7, share this exact roster/interior —
// verified against the checked-in gate-run jsonl).
const REAL_CANON = {
  location: { name: "Wayfarers' Outpost" },
  interior: { roomId: 'room:stgen:v27:n3_1515674724:0:2', roomName: 'Bedchamber' },
  roomOccupants: [],
  npcsPresent: [
    { name: 'Elske Nightherd', role: 'representative' },
    { name: 'Dalla', role: 'innkeeper' },
    { name: 'Asha', role: 'guard' },
    { name: 'Ashblade', role: 'bandit' },
    { name: 'the Lingerer', role: 'a wanderer who has stayed too long, asking questions no one wants to answer' },
  ],
};

// Runs the SAME turn down both the live-observer path and the CLI-checker
// path, with matching provenance (seed/persona/turn) so the resulting
// pointers are directly comparable field-for-field.
//
// NOTE on `persona` (pre-existing, unrelated to this packet's guard): the live
// observer stamps its pointer's `persona` with `sessionKeyOf(world)`, i.e.
// "${seed}::${campaignId}" (shadowObserver.js, `sessionKeyOf`/`persona:
// sessionKey`) — a session key, not the bare persona label a hand-authored
// JSONL uses. That enrichment is a documented, existing convention (U394 never
// asserts persona for exactly this reason) and is orthogonal to the absence
// guard under test here. To compare the two paths on genuinely IDENTICAL
// input/output, we feed the CLI path that SAME composed session-key string as
// its `persona` field — this is legitimate because `persona` is a free-form
// label on both sides (nothing downstream parses its shape), so aligning it
// isolates the one thing this test exists to prove: with the guard active, the
// shared detector core (engine/coherence/checks.js) returns byte-identical
// pointers down both call paths for the same prose+canon.
function runBothPaths({ seed, persona, i, player, dm, mechanics }) {
  __resetShadowState();
  const world = { meta: { seed, campaignId: persona } };
  // turnCounterOf(world) reads world.timeline.length when present — pin it so
  // the live path's `turn` provenance field matches `i` exactly, the same
  // value the CLI path receives directly.
  world.timeline = new Array(i);
  const sessionKey = `${seed}::${persona}`; // mirrors shadowObserver.js's sessionKeyOf()

  const liveFlags = withShadow({ COHERENCE_SHADOW: '1' }, () =>
    observeCoherenceShadow({
      world,
      candidate: dm,
      outcome: { input: player, mechanics },
      _canonForTest: REAL_CANON,
    }),
  );

  const cliRecord = {
    type: 'turn', seed, persona: sessionKey, i, player, dm, mechanics, route: 'action',
    canon: REAL_CANON, judgeError: false, v1: null, v2: null,
  };
  const cliResult = runCoherenceGate({ run: 'u425', turns: [cliRecord] });

  return { liveFlags: liveFlags || [], cliFlags: cliResult.flags };
}

test('U425: false-positive turn — live observer and CLI checker BOTH produce zero CG-1b pointers (byte-equal empty)', () => {
  const { liveFlags, cliFlags } = runBothPaths({
    seed: 'tallow', persona: 'newbie', i: 10,
    player: "Alright, well, hi Elske. Since you're here, can you tell me anything about that wedding letter I was just reading?",
    dm: "No one answers — Elske Nightherd is elsewhere in Wayfarers' Outpost, and the bedchamber holds only the quiet creak of timber walls and the open chest sitting empty of company.",
    mechanics: '[info-check → no-record | nothing grounded to deliver, no roll]',
  });
  assert.deepEqual(liveFlags.filter(f => f.class === 'CG-1b'), [], 'live observer: no CG-1b on the absence turn');
  assert.deepEqual(cliFlags.filter(f => f.class === 'CG-1b'), [], 'CLI checker: no CG-1b on the absence turn');
  assert.deepEqual(liveFlags, cliFlags, 'the two paths agree byte-for-byte (both empty) with the guard active');
});

test('U425: true-positive turn — live observer and CLI checker produce IDENTICAL CG-1b pointers', () => {
  const { liveFlags, cliFlags } = runBothPaths({
    seed: 'tallow', persona: 'newbie', i: 7,
    player: "Okay, that's weird, a second ago you told me I was reading a letter about a wedding. Where did it go?",
    dm: 'Elske Nightherd shrugs. "Can\'t say. No record I\'ve ever seen."',
    mechanics: '',
  });
  const liveCg1b = liveFlags.filter(f => f.class === 'CG-1b');
  const cliCg1b = cliFlags.filter(f => f.class === 'CG-1b');
  assert.equal(liveCg1b.length, 1, 'live observer fires the true positive');
  assert.equal(cliCg1b.length, 1, 'CLI checker fires the true positive');
  assert.deepEqual(liveCg1b, cliCg1b, 'both paths agree on the exact same pointer, field-for-field');
  assert.deepEqual(liveFlags, cliFlags, 'the two paths agree byte-for-byte over the whole flag set');
});

test('U425: the trap turn (absence in a different clause than the named action) — both paths still fire, identically', () => {
  const { liveFlags, cliFlags } = runBothPaths({
    seed: 'crafted', persona: 'trap', i: 0,
    player: 'Who just said that?',
    dm: 'Elske Nightherd scoffs — the rumor that she is elsewhere amuses her.',
    mechanics: '',
  });
  const liveCg1b = liveFlags.filter(f => f.class === 'CG-1b');
  const cliCg1b = cliFlags.filter(f => f.class === 'CG-1b');
  assert.equal(liveCg1b.length, 1, 'live observer still fires — she acted in her own clause');
  assert.equal(cliCg1b.length, 1, 'CLI checker still fires — she acted in her own clause');
  assert.deepEqual(liveFlags, cliFlags, 'both paths agree byte-for-byte on the trap case too');
});

test('U425: shadow OFF — the live path returns null (unaffected by this packet\'s guard, contract untouched)', () => {
  __resetShadowState();
  const world = { meta: { seed: 'tallow', campaignId: 'newbie' }, timeline: new Array(10) };
  const off = withShadow({ COHERENCE_SHADOW: '0' }, () =>
    observeCoherenceShadow({
      world,
      candidate: "No one answers — Elske Nightherd is elsewhere in Wayfarers' Outpost.",
      outcome: { input: '', mechanics: '' },
      _canonForTest: REAL_CANON,
    }),
  );
  assert.equal(off, null, 'disabled observer returns null regardless of the guard — default-OFF contract is untouched');
});
