import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { resolveMove } from '../engine/resolve.js';
import { parseIntent, declaredStat } from '../engine/intent/parseIntent.js';
import { makeIntent, intentToMove } from '../engine/intent/intentSchema.js';

// U587 — DECL-STAT-1: determinism + the wall.
//
// Three guarantees the declared-stat fix must not break:
//   (I)   DETERMINISM — the same declaration + same seed + same actor replays
//         BYTE-IDENTICAL (the declared stat changes the MODIFIER, never the die;
//         the raw d20 seed is unchanged, so undeclared replays are untouched too).
//   (II)  THE WALL — no player-facing numeric leaks BEYOND the mech line's
//         pre-existing `stat:XXX±N` contract. The declared stat only swaps WHICH
//         stat labels an already-present token; it never mints a new number and
//         the resolver surfaces no extra numeric field.
//   (III) LLM-OFF FLOOR — declaredStat is a PURE text parser with no network and
//         no rng; the declaration is honored with no model in the loop (INT-1..4).

function worldWithStats(seed = 'u587') {
  const w = newWorld({ seed, fate: 0.3, campaignId: `${seed}-c`, pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'outpost', objective: 'get out', time: 'start', promptSeed: '77', tags: [], thread: '' };
  w.party = [{
    id: 'party', name: 'Party', vibe: 'x', archetype: 'x', level: 1,
    wounds: 0, stress: 0,
    stats: { MIGHT: 18, AGILITY: 10, WITS: 6, GRIT: 10, CHARM: 10 },
    resources: { Supply: 5 }
  }];
  return w;
}

const DECLARED = { actorId: 'party', intentText: "Set the DC and I'll roll Strength.", approachTag: 'focus', stakeTag: 'time', statTag: 'MIGHT' };

// ── (I) determinism ──────────────────────────────────────────────────────────

test('U587-01: a declared-stat move replays byte-identical', () => {
  const a = resolveMove(worldWithStats(), DECLARED).result;
  const b = resolveMove(worldWithStats(), DECLARED).result;
  assert.deepEqual(a, b);
});

test('U587-02: declaring the stat changes the MODIFIER, not the raw die', () => {
  const w = worldWithStats();
  const declared = resolveMove(w, DECLARED).result;                          // MIGHT +4
  const inferred = resolveMove(w, { ...DECLARED, statTag: undefined }).result; // approach:focus → WITS -2
  assert.equal(declared.rawDie, inferred.rawDie, 'same seed → same d20; only the modifier differs');
  // The 6-point stat gap (MIGHT+4 vs WITS-2) must move the final roll by exactly 6,
  // clamps aside (rawDie is mid-range here so no clamp).
  assert.equal(declared.roll - inferred.roll, 6);
});

test('U587-03: declaredStat is pure — same input, same output, order-independent', () => {
  const s = "I brace the beam and roll Constitution";
  assert.equal(declaredStat(s), declaredStat(s));
  // ambiguity (two stats named) resolves to the FIRST, stably.
  const two = 'roll Strength or maybe Dexterity';
  assert.equal(declaredStat(two), 'MIGHT');
  assert.equal(declaredStat(two), 'MIGHT');
});

// ── (II) the wall — no numeric leak beyond the existing mech-line contract ───

test('U587-04: no NEW numeric field on the result beyond the pre-existing contract', () => {
  const declared = resolveMove(worldWithStats(), DECLARED).result;
  const inferred = resolveMove(worldWithStats(), { ...DECLARED, statTag: undefined }).result;
  // The result's own key set must be identical whether or not a stat was declared
  // — the declaration adds no extra surfaced numeric field.
  assert.deepEqual(Object.keys(declared).sort(), Object.keys(inferred).sort());
});

test('U587-05: the mech line keeps its exact shape — one stat token, correctly signed', () => {
  const declared = resolveMove(worldWithStats(), DECLARED).result;
  // Exactly one stat token, format unchanged (STAT±N). The declaration swaps the
  // label, never the grammar.
  const statTokens = declared.mechanicsLine.match(/stat:[A-Z]+[+-]?\d*/g) || [];
  assert.equal(statTokens.length, 1, 'exactly one stat token in the mech line');
  assert.match(statTokens[0], /^stat:MIGHT\+4$/);
});

test('U587-06: undeclared resolution is BYTE-IDENTICAL to the pre-DECL-STAT-1 path', () => {
  // A move with no statTag key at all must resolve exactly as a move whose
  // statTag is explicitly undefined — proving the added field is inert when absent.
  const w = worldWithStats();
  const noKey = { actorId: 'party', intentText: 'I lever it open.', approachTag: 'force', stakeTag: 'harm' };
  const undef = { ...noKey, statTag: undefined };
  assert.deepEqual(resolveMove(w, undef).result, resolveMove(w, noKey).result);
});

// ── (III) the LLM-off floor still honors the declaration ─────────────────────

test('U587-07: parseIntent (no model, no network) carries the declared stat end-to-end', () => {
  // The deterministic floor alone (INTENT_LLM=off equivalent — parseIntent is the
  // floor; declaredStat never calls out) produces a move whose statTag is the
  // declared ability.
  const intent = parseIntent("I wedge the bar under it — set the DC and I'll roll Strength", {});
  const move = intentToMove(intent, { actorId: 'party' });
  assert.equal(move.statTag, 'MIGHT');
  const { result } = resolveMove(worldWithStats(), { ...move, approachTag: 'focus', stakeTag: 'time' });
  assert.match(result.mechanicsLine, /stat:MIGHT\+4\b/);
});

test('U587-08: an undeclared typed action carries NO stat through the floor', () => {
  const intent = parseIntent('I shove the door with my shoulder', {});
  assert.equal(intent.stat, null);
  assert.equal(intentToMove(intent).statTag, null);
});
