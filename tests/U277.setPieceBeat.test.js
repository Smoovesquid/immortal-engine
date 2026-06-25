// U277 — set-piece beat detection: the three threshold moments worth a vivid
// paragraph instead of one terse line. detectSetPieceBeat compares the world BEFORE
// vs AFTER a move and names the beat ('death' | 'combat-start' | 'arrival' | '').
// Pure + hermetic — no packs, no world boot, no network. The beat is transient
// (carried on output.beat) and never touches canon or the world hash.

import test from 'node:test';
import assert from 'node:assert/strict';

import { detectSetPieceBeat, setPieceCooldownGate } from '../engine/playloop.js';

test('U277: death — live HP (escapeHp) crossing to zero is the death beat', () => {
  const before = { meta: { escapeHp: 4 }, map: { currentNodeId: 'n1' } };
  const after  = { meta: { escapeHp: 0 }, map: { currentNodeId: 'n1' } };
  assert.equal(detectSetPieceBeat(before, after), 'death');
});

test('U277: combat-start — combat going active is the fight beat', () => {
  const before = { meta: { escapeHp: 10 }, combat: { active: false }, map: { currentNodeId: 'n1' } };
  const after  = { meta: { escapeHp: 10 }, combat: { active: true  }, map: { currentNodeId: 'n1' } };
  assert.equal(detectSetPieceBeat(before, after), 'combat-start');
});

test('U277: arrival — a node change is the arrival beat', () => {
  const before = { meta: { escapeHp: 10 }, map: { currentNodeId: 'n1' } };
  const after  = { meta: { escapeHp: 10 }, map: { currentNodeId: 'n2' } };
  assert.equal(detectSetPieceBeat(before, after), 'arrival');
});

test('U277: priority — death outranks a simultaneous combat-start / arrival', () => {
  const before = { meta: { escapeHp: 5 }, combat: { active: false }, map: { currentNodeId: 'n1' } };
  const after  = { meta: { escapeHp: 0 }, combat: { active: true  }, map: { currentNodeId: 'n2' } };
  assert.equal(detectSetPieceBeat(before, after), 'death');
});

test('U277: an ordinary in-place turn produces NO beat (default register holds)', () => {
  const w = { meta: { escapeHp: 10 }, combat: { active: false }, map: { currentNodeId: 'n1' } };
  assert.equal(detectSetPieceBeat(w, { ...w }), '');
  // already mid-fight on the NEXT turn is not a fresh combat-start (only the ignition fires)
  const inFight = { meta: { escapeHp: 8 }, combat: { active: true }, map: { currentNodeId: 'n1' } };
  assert.equal(detectSetPieceBeat(inFight, { ...inFight, meta: { escapeHp: 6 } }), '');
});

test('U277: HP healing / staying alive is never a death beat', () => {
  const before = { meta: { escapeHp: 6 }, map: { currentNodeId: 'n1' } };
  const after  = { meta: { escapeHp: 9 }, map: { currentNodeId: 'n1' } };
  assert.equal(detectSetPieceBeat(before, after), '');
});

test('U277: non-escape mode (no escapeHp field) never false-fires a death beat', () => {
  const before = { map: { currentNodeId: 'n1' } };
  const after  = { map: { currentNodeId: 'n1' } };
  assert.equal(detectSetPieceBeat(before, after), '');
  // escapeHp absent on both sides → no spurious 0-crossing
  assert.equal(detectSetPieceBeat({ meta: {}, map: { currentNodeId: 'n1' } }, { meta: {}, map: { currentNodeId: 'n1' } }), '');
});

test('U277: missing world(s) is safe (returns no beat, never throws)', () => {
  assert.equal(detectSetPieceBeat(null, { meta: { escapeHp: 1 } }), '');
  assert.equal(detectSetPieceBeat({ meta: { escapeHp: 1 } }, null), '');
  assert.equal(detectSetPieceBeat(undefined, undefined), '');
});

// ── Cooldown gate — keep set-pieces rare so they stay special ──────────────────
test('U277: cooldown gate — a beat fires only once the window has passed', () => {
  assert.equal(setPieceCooldownGate('arrival', 5, 3), 'arrival');  // gap > window → fires
  assert.equal(setPieceCooldownGate('arrival', 3, 3), 'arrival');  // gap == window → fires
  assert.equal(setPieceCooldownGate('arrival', 2, 3), '');         // within window → suppressed
  assert.equal(setPieceCooldownGate('combat-start', 0, 3), '');    // just fired → suppressed
  assert.equal(setPieceCooldownGate('death', 999, 3), 'death');    // first ever → always fires
});

test('U277: cooldown gate — no beat in, no beat out (regardless of gap)', () => {
  assert.equal(setPieceCooldownGate('', 999, 3), '');
  assert.equal(setPieceCooldownGate(null, 999, 3), '');
  assert.equal(setPieceCooldownGate(undefined, 0, 3), '');
});

test('U277: cooldown gate — the window is configurable', () => {
  assert.equal(setPieceCooldownGate('arrival', 1, 1), 'arrival'); // window 1 → fires every turn
  assert.equal(setPieceCooldownGate('arrival', 4, 5), '');        // tighter window holds it back
});
