// U393 — CG-P4 (docs/briefs/COHERENCE_GATE.md §7 "CG-P4"): activates the two
// comparators that were deliberately DORMANT waiting for the bundle fields
// U392 just added — CG-2b (invented exit/stair/door) and CG-6 (temporal
// desync). Pure-function unit tests over synthetic turn fixtures, mirroring
// U388's shape exactly: one positive (must flag) and one negative/guard (must
// NOT flag) per class, PLUS the graceful-degradation guard the packet calls
// load-bearing (old JSONLs lacking roomExits/clock -> DORMANT, never a false
// flag — the P-B negative-control discipline). No LLM calls, no server, no
// engine import — $0 and deterministic.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectExitDesync, detectTemporalDesync, runCoherenceGate, loadJsonlFile,
} from '../scripts/coherence-gate.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const GATE_RUNS = path.join(ROOT, 'docs', 'playtests', 'gate-runs');

// Minimal turn fixture builder — only the fields the detectors read (mirrors
// U388's `turn()` helper exactly).
function turn(i, persona, { player = '', dm = '', mechanics = '', canon = {} } = {}) {
  return {
    type: 'turn', seed: 's', persona, i, player, dm, mechanics, route: 'action',
    canon: { npcsPresent: [], ...canon }, judgeError: false, v1: null, v2: null,
  };
}

// ── CG-2b — invented exit/stair/door ────────────────────────────────────────
test('U393: CG-2b flags a narrated compass exit the room\'s real topology does not have', () => {
  const session = [
    turn(0, 'p', {
      player: 'I look around the room.',
      dm: 'A heavy door to the north leads onward.',
      canon: {
        interior: { roomId: 'r1', roomName: 'Bedchamber' },
        roomExits: { east: 'Brood Cell' }, // no north exit in canon
      },
    }),
  ];
  const flags = detectExitDesync(session);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].class, 'CG-2b');
  assert.equal(flags[0].canonField, 'roomExits');
  assert.equal(flags[0].severity, 'fail');
});

test('U393: CG-2b does NOT flag a narrated exit that genuinely exists in roomExits (guard)', () => {
  const session = [
    turn(0, 'p', {
      player: 'I look around the room.',
      dm: 'A doorway to the east leads to the brood cell.',
      canon: {
        interior: { roomId: 'r1', roomName: 'Bedchamber' },
        roomExits: { east: 'Brood Cell' },
      },
    }),
  ];
  const flags = detectExitDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-2b').length, 0, 'a real exit must never be flagged as invented');
});

test('U393: CG-2b does NOT flag a bare exit-noun with no compass direction (unresolvable claim, guard)', () => {
  const session = [
    turn(0, 'p', {
      player: 'What do I see?',
      dm: 'There is a door, half-open, at the far end.',
      canon: {
        interior: { roomId: 'r1', roomName: 'Bedchamber' },
        roomExits: { east: 'Brood Cell' },
      },
    }),
  ];
  const flags = detectExitDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-2b').length, 0, 'a directionless door mention is not a checkable claim');
});

test('U393: CG-2b stays DORMANT outdoors even if roomExits happens to be present (interior-only view, guard)', () => {
  const session = [
    turn(0, 'p', {
      player: 'What do I see?',
      dm: 'A path leads north into the woods.',
      canon: {
        interior: null,
        roomExits: { east: 'Brood Cell' }, // stale/irrelevant when not inside
      },
    }),
  ];
  const flags = detectExitDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-2b').length, 0, 'roomExits is an interior-only view; outdoor exits are a different surface');
});

test('U393: CG-2b is DORMANT (never a false flag) when roomExits is entirely absent from the bundle (P-B graceful degradation)', () => {
  const session = [
    turn(0, 'p', {
      player: 'I look around.',
      dm: 'A staircase to the west spirals down into darkness.',
      canon: {
        interior: { roomId: 'r1', roomName: 'Bedchamber' },
        // no roomExits key at all — pre-CG-P4 bundle shape
      },
    }),
  ];
  const flags = detectExitDesync(session);
  assert.equal(flags.length, 0, 'no roomExits field in the bundle means no ground truth — must stay silent, not fabricate a flag');
});

// ── CG-6 — temporal desync ──────────────────────────────────────────────────
test('U393: CG-6 flags a narrated time-of-day that contradicts canon.clock.segment', () => {
  const session = [
    turn(0, 'p', {
      player: 'What time is it?',
      dm: 'It is midnight, and the small hours press in around you. Wait — the sun is high; it must be midday after all.',
      canon: { clock: { hours: 6, day: 1, segment: 'morning' } },
    }),
  ];
  const flags = detectTemporalDesync(session);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].class, 'CG-6');
  assert.equal(flags[0].canonField, 'clock.segment');
  assert.equal(flags[0].expected, 'morning');
  assert.equal(flags[0].narrated, 'the small hours', 'first unambiguous match in the prose wins, precision-first');
});

test('U393: CG-6 does NOT flag when the narrated segment matches canon.clock.segment (guard)', () => {
  const session = [
    turn(0, 'p', {
      player: 'What time is it?',
      dm: 'It is morning — sunlight slants through the shutters.',
      canon: { clock: { hours: 8, day: 1, segment: 'morning' } },
    }),
  ];
  const flags = detectTemporalDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-6').length, 0, 'a correct time-of-day narration must never be flagged');
});

test('U393: CG-6 does NOT flag prose with no checkable time-phrase at all (guard)', () => {
  const session = [
    turn(0, 'p', {
      player: 'I draw my sword.',
      dm: 'Steel rasps free of its scabbard.',
      canon: { clock: { hours: 8, day: 1, segment: 'morning' } },
    }),
  ];
  const flags = detectTemporalDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-6').length, 0, 'no time-phrase means nothing to compare — must stay silent');
});

test('U393: CG-6 is DORMANT (never a false flag) when clock is entirely absent from the bundle (P-B graceful degradation)', () => {
  const session = [
    turn(0, 'p', {
      player: 'What time is it?',
      dm: 'Deep night has fallen, and the stars wheel overhead.',
      canon: {
        // no clock key at all — pre-CG-P4 bundle shape
      },
    }),
  ];
  const flags = detectTemporalDesync(session);
  assert.equal(flags.length, 0, 'no clock field in the bundle means no ground truth — must stay silent, not fabricate a flag');
});

// ── Full-instrument regression: the 4 real JSONLs still flag 0 on CG-2b/CG-6 ─
// (P-B negative control, restated at the runCoherenceGate level): none of the
// four committed JSONLs carry roomExits/clock yet (they all predate CG-P4), so
// both new comparators must contribute EXACTLY 0 flags to every one of them —
// proving degrade-gracefully holds at the full-instrument level, not just the
// unit level above.
const FILES = [
  'gate-2026-07-02T19-44-24-605Z-bridge.jsonl',
  'gate-2026-07-02T20-59-10-628Z-v1.jsonl',
  'gate-2026-07-03T03-56-04-236Z-v1.jsonl',
  'gate-2026-07-03T11-45-56-173Z-v1.jsonl',
].map(f => path.join(GATE_RUNS, f));

test('U393: all four existing gate JSONLs flag exactly 0 on CG-2b and CG-6 (none carry roomExits/clock yet)', () => {
  for (const file of FILES) {
    assert.ok(fs.existsSync(file), `missing fixture ${file}`);
    const result = runCoherenceGate(loadJsonlFile(file));
    assert.equal((result.byClass['CG-2b'] || []).length, 0, `${path.basename(file)}: CG-2b must stay dormant (no roomExits field yet)`);
    assert.equal((result.byClass['CG-6'] || []).length, 0, `${path.basename(file)}: CG-6 must stay dormant (no clock field yet)`);
  }
});
