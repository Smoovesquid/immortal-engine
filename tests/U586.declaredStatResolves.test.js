import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { resolveMove } from '../engine/resolve.js';
import { parseIntent, declaredStat } from '../engine/intent/parseIntent.js';
import { makeIntent, intentToMove } from '../engine/intent/intentSchema.js';

// DECL-STAT-1 (gate 2026-07-06, 1× CRUNCH_INCONSISTENCY): a player who declares
// an ability to roll ("Set the DC and I'll roll Strength") had that declaration
// SILENTLY DROPPED — the resolver picked the stat purely from the inferred
// approach (approach:focus → WITS), so a declared-Strength lever resolved
// stat:WITS-2. The law (V7 — interpret richly, commit narrowly): an EXPLICITLY
// declared ability WINS over inference; absent a declaration, today's inference
// stands byte-identical.
//
// The fix lives across three modules THIS packet owns:
//   parseIntent.declaredStat() — reads the declared ability from the STRUCTURED
//     intent (never a raw-text regex at the resolver seam; house law INT-1..4).
//   intentSchema — Intent carries `stat`; intentToMove projects it to move.statTag.
//   resolve.js — statTag, when present + valid, is authoritative for the d20 math
//     AND the mech line; absent, statForApproach(approach) stands unchanged.
//
// These tests drive the exact production sequence the typed turn runs
// (parseIntent → intentToMove → resolveMove) minus the ONE playloop wire that
// sets move.statTag at the generic resolve floor (inferMoveFromText, playloop.js
// line ~3882 — WIN-EGRESS-1's live serial lane, off-limits to this packet). With
// that wire in place the gate utterance is honored end-to-end; the mechanism and
// the intent-layer plumbing are proven green here.

// Distinct stats so a declared MIGHT vs an inferred WITS roll is OBSERVABLE:
// MIGHT 18 → statMod +4, WITS 6 → statMod -2. A 6-point modifier gap can't be
// coincidence.
function worldWithStats() {
  const w = newWorld({ seed: 'decl-stat', fate: 0.3, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'outpost', objective: 'get out', time: 'start', promptSeed: '77', tags: [], thread: '' };
  w.party = [{
    id: 'party', name: 'Party', vibe: 'x', archetype: 'x', level: 1,
    wounds: 0, stress: 0,
    stats: { MIGHT: 18, AGILITY: 10, WITS: 6, GRIT: 10, CHARM: 10 },
    resources: { Supply: 5 }
  }];
  return w;
}

// ── (a) the detector reads the declared ability from the utterance ───────────

test('U586-01: the gate utterance declares Strength → MIGHT', () => {
  assert.equal(
    declaredStat("I jam the Worn Blade under the hasp and lever with my full weight. Set the DC and I'll roll Strength."),
    'MIGHT'
  );
});

test('U586-02: declaration synonyms all map to the engine stat', () => {
  assert.equal(declaredStat("I'll roll Strength"), 'MIGHT');
  assert.equal(declaredStat('let me make a Dexterity check'), 'AGILITY');
  assert.equal(declaredStat('a Constitution save to hold my breath'), 'GRIT');
  assert.equal(declaredStat('I want to roll against WITS'), 'WITS');
  assert.equal(declaredStat('using my Charisma to win them over'), 'CHARM');
  // engine stat names resolve directly
  assert.equal(declaredStat('roll GRIT'), 'GRIT');
});

test('U586-03: a bare action with NO declaration → null (inference still owns it)', () => {
  assert.equal(declaredStat('I jam the blade under the hasp and lever it open'), null);
  assert.equal(declaredStat('I strain with all my strength to shove the door'), null, 'flavor "strength" with no check cue must not fire');
  assert.equal(declaredStat('I look around the room'), null);
  assert.equal(declaredStat(''), null);
});

// ── (b) the declaration flows through the intent → move projection ───────────

test('U586-04: parseIntent carries the declared stat on the structured intent', () => {
  const i = parseIntent("I pry the hatch — set the DC and I'll roll Strength", {});
  assert.equal(i.stat, 'MIGHT', 'declared ability rides on the Intent regardless of verb');
});

test('U586-05: intentToMove projects intent.stat → move.statTag', () => {
  const m = intentToMove(makeIntent({ verb: 'use', text: "I'll roll Strength", stat: 'MIGHT' }));
  assert.equal(m.statTag, 'MIGHT');
  // undeclared intent leaves statTag null (the resolver then infers)
  const m2 = intentToMove(makeIntent({ verb: 'use', text: 'I open the hatch' }));
  assert.equal(m2.statTag, null);
});

// ── (c) the resolver honors the declared stat in the d20 math AND mech line ──

test('U586-06: a declared Strength check resolves stat:MIGHT (not the inferred WITS)', () => {
  const w = worldWithStats();
  // The move the generic floor WOULD build (approach:focus → WITS) PLUS the wire
  // this packet adds: statTag from the declaration.
  const declared = { actorId: 'party', intentText: "Set the DC and I'll roll Strength.", approachTag: 'focus', stakeTag: 'time', statTag: declaredStat("Set the DC and I'll roll Strength.") };
  const { result } = resolveMove(w, declared);
  assert.match(result.mechanicsLine, /stat:MIGHT\+4\b/, 'declared Strength must key the roll off MIGHT (+4), not WITS');
  assert.doesNotMatch(result.mechanicsLine, /stat:WITS/, 'the inferred WITS stat must NOT win over the declaration');
});

test('U586-07: a declared WITS check resolves WITS', () => {
  const w = worldWithStats();
  const declared = { actorId: 'party', intentText: 'I study the lock — let me roll WITS.', approachTag: 'force', stakeTag: 'time', statTag: declaredStat('I study the lock — let me roll WITS.') };
  const { result } = resolveMove(w, declared);
  // approach:force would infer MIGHT (+4); the declaration overrides to WITS (-2).
  assert.match(result.mechanicsLine, /stat:WITS-2\b/, 'declared WITS wins over the approach-inferred MIGHT');
});

test('U586-08: an UNDECLARED action resolves today\'s inference UNCHANGED', () => {
  const w = worldWithStats();
  const undeclaredMove = { actorId: 'party', intentText: 'I jam the blade under the hasp and lever it open.', approachTag: 'focus', stakeTag: 'time' };
  const before = resolveMove(w, undeclaredMove).result;
  // Same move with statTag explicitly absent/undefined — byte-identical result.
  const after = resolveMove(w, { ...undeclaredMove, statTag: undefined }).result;
  assert.deepEqual(after, before, 'undefined statTag must not alter the inference path at all');
  assert.match(before.mechanicsLine, /stat:WITS-2\b/, 'approach:focus still infers WITS unchanged');
});

test('U586-09: a malformed/garbage declared stat falls back to inference (never breaks the roll)', () => {
  const w = worldWithStats();
  const bogus = { actorId: 'party', intentText: 'I heave.', approachTag: 'force', stakeTag: 'harm', statTag: 'BANANA' };
  const { result } = resolveMove(w, bogus);
  // approach:force → MIGHT; the junk statTag is ignored, not honored.
  assert.match(result.mechanicsLine, /stat:MIGHT\+4\b/);
});
