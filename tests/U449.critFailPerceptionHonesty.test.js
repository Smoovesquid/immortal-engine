// U449 — PERC-1: a CRIT-FAIL (natural 1) perception check renders doubt WITHOUT
// asserting any false canonical fact in EITHER direction — and the pre-existing
// honest-search SUCCESS branch (baf1b51, nonObjectSkillOutcome) still renders its
// accurate, room-grounded read untouched (regression guard).
//
// classifyOutcome (engine/resolve.js) collapses a natural-1 roll into the plain
// 'failure' bucket — there is no distinct "crit-fail" outcome string. rawDie is
// preserved on resolveMove's result object (result.rawDie), so a crit-fail is
// detected as outcome==='failure' && rawDie===1. hedgedPerceptionRead reads it to
// render a MORE disoriented hedge than an ordinary miss — but never a confident
// claim either way. Two things a crit-fail must NEVER do: assert a false
// all-clear ("no trace of flame"), or assert a false confirmed hazard ("yes, it's
// still burning") — uncertainty must not become misinformation in the OTHER
// direction either (the packet's explicit "never plant a FALSE fact" law).

import test from 'node:test';
import assert from 'node:assert/strict';

import { hedgedPerceptionRead } from '../engine/grace/gracefulAdjudication.js';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { emptyRoomWorld } from '../scripts/convergence/fixtures.mjs';
import { validateNarrationCandidate } from '../engine/llmAdapter.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

const GATE_TEXT = 'Wait — is the ceiling still on fire or not? I stand in the middle of the room and look up.';

// Neither direction of a confident, invented verdict may ever appear.
const FALSE_ALL_CLEAR_RE = /\bno\s+trace\s+of\b|\bunburnt\b|\bdry\s+and\s+unburnt\b|\bplain\s+wattle|\bnothing\s+wrong\b|\ball[\s-]clear\b|\bsafe\s+and\s+sound\b/i;
const FALSE_HAZARD_CONFIRM_RE = /\byes,?\s+it'?s\s+(?:still\s+)?(?:burning|on\s+fire|aflame)\b|\bstill\s+ablaze\b|\bconfirmed\s+burning\b|\bthe\s+fire\s+(?:rages|still\s+burns)\b/i;

test('U449-01: a crit-fail (rawDie=1) renders doubt, asserting NEITHER a false all-clear NOR a false confirmed hazard', () => {
  const world = emptyRoomWorld();
  const narr = hedgedPerceptionRead(world, GATE_TEXT, 'failure', 1);
  assert.ok(narr && narr.startsWith('Wizard:'), 'renders a narration string');
  assert.doesNotMatch(narr, FALSE_ALL_CLEAR_RE, 'must never assert a false all-clear');
  assert.doesNotMatch(narr, FALSE_HAZARD_CONFIRM_RE, 'must never assert a false confirmed hazard either');
});

test('U449-02: a crit-fail (nat 1) reads as MORE disoriented than an ordinary non-crit failure — a distinguishable narration', () => {
  const world = emptyRoomWorld();
  const critFail = hedgedPerceptionRead(world, GATE_TEXT, 'failure', 1);
  const ordinaryFail = hedgedPerceptionRead(world, GATE_TEXT, 'failure', 9);
  assert.notEqual(critFail, ordinaryFail, 'a nat-1 crit-fail must read differently than an ordinary miss');
  // Both are still hedges, never verdicts.
  for (const narr of [critFail, ordinaryFail]) {
    assert.doesNotMatch(narr, FALSE_ALL_CLEAR_RE);
    assert.doesNotMatch(narr, FALSE_HAZARD_CONFIRM_RE);
  }
});

test('U449-03: deterministic — the crit-fail hedge is reproducible across two independent calls', () => {
  const world = emptyRoomWorld();
  const a = hedgedPerceptionRead(world, GATE_TEXT, 'failure', 1);
  const b = hedgedPerceptionRead(world, GATE_TEXT, 'failure', 1);
  assert.equal(a, b, 'no hidden randomness on a crit-fail render');
});

// ── Regression guard: baf1b51's honest-search SUCCESS branch is untouched ──
// Seed 'a3' + "I search the room carefully" deterministically rolls 15 vs DC 12
// (success, margin 3) on the real boot pipeline — nonObjectSkillOutcome's search
// branch names the room's real object (the straw pallet), never a phantom find.
// This proves PERC-1's new failure-only hedge did not shadow or alter the
// pre-existing, correct SUCCESS narration for a sibling capability.

test('U449-04: REGRESSION GUARD — the honest-search SUCCESS branch (baf1b51) still renders its accurate, room-grounded read', () => {
  const world = beginAdventure(newWorld({ seed: 'a3', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const r = playerMove(world, PACKS, 'I search the room carefully');
  assert.match(r.output.mechanics, /success/, `precondition: seed 'a3' must roll a search success — got ${r.output.mechanics}`);
  assert.match(r.output.narration, /straw pallet/i, `honest-search must still name the room's real object: ${r.output.narration}`);
  assert.match(r.output.narration, /plain in view|nothing's hidden/i, `honest-search's grounded phrasing must survive: ${r.output.narration}`);
});

test('U449-05: REGRESSION GUARD — a crit-fail on an UNRELATED action (not a perception recheck) is untouched by PERC-1', () => {
  // hedgedPerceptionRead must return null for any text outside its narrow scope,
  // regardless of outcome/rawDie — it must never become a blanket crit-fail hedge
  // net that shadows other capabilities (search, combat, dialogue, etc.).
  const world = emptyRoomWorld();
  assert.equal(hedgedPerceptionRead(world, 'I search the room carefully', 'failure', 1), null);
  assert.equal(hedgedPerceptionRead(world, 'I swing my sword at the bandit', 'failure', 1), null);
});

// ── The LLM-polish safety net: validateNarrationCandidate must not un-hedge ──
// The deterministic floor above is the primary fix (LLM-off first, per scope). This
// is the companion safety net: engine/llmAdapter.js's validateNarrationCandidate
// gained a PERC-1 guard mirroring the pre-existing fled-foe kill-claim guard
// (U245/baseFled) — when the BASE narration is one of hedgedPerceptionRead's two
// hedge shapes, a polish candidate asserting a confident verdict (either direction)
// is rejected, falling back to the honest, hedged base. Never fires on unrelated
// base narration (the fled-foe guard, and ordinary calm narration, are unaffected).

const HEDGE_BASE_NONCRIT = 'Wizard: You look, but the read is murky — a haze of smoke-shadow and lamplight from the bedchamber; you honestly can\'t tell one way or the other from here.';
const HEDGE_BASE_CRIT = 'Wizard: You crane to look, but between the sting in your eyes and the shift of shadow and lamplight, you can\'t make out anything for certain from the bedchamber — could be nothing, could be something you\'re missing.';

test('U449-06: validateNarrationCandidate REJECTS an invented all-clear when the base is a PERC-1 hedge (either hedge shape)', () => {
  const invented = 'The ceiling above is plain wattle-and-daub, dry and unburnt, with no trace of flame or scorch.';
  assert.equal(validateNarrationCandidate(null, invented, { baseNarration: HEDGE_BASE_NONCRIT }), false);
  assert.equal(validateNarrationCandidate(null, invented, { baseNarration: HEDGE_BASE_CRIT }), false);
});

test('U449-07: validateNarrationCandidate REJECTS an invented hazard-CONFIRMATION just as readily (both directions guarded)', () => {
  assert.equal(validateNarrationCandidate(null, 'Yes, it is still burning up there, flames licking the beams.', { baseNarration: HEDGE_BASE_CRIT }), false);
  assert.equal(validateNarrationCandidate(null, 'Yes, it\'s still ablaze up there.', { baseNarration: HEDGE_BASE_CRIT }), false);
});

test('U449-08: validateNarrationCandidate ACCEPTS a faithful reword of doubt (polish may reword, never resolve, the hedge)', () => {
  const faithfulReword = 'You squint upward, but the shifting light plays tricks and you cannot be sure what you are seeing.';
  assert.equal(validateNarrationCandidate(null, faithfulReword, { baseNarration: HEDGE_BASE_NONCRIT }), true);
});

test('U449-09: the PERC-1 guard does NOT fire on unrelated base narration (fled-foe guard, U245, still works)', () => {
  const fledBase = 'The Lingerer has had enough — it breaks and runs.';
  assert.equal(validateNarrationCandidate(null, 'You cut the Lingerer down, dead at your feet.', { baseNarration: fledBase }), false);
  const calmBase = 'You step into the market square; the stalls are busy this morning.';
  assert.equal(validateNarrationCandidate(null, 'You wander past the alley into the square.', { baseNarration: calmBase }), true);
});
