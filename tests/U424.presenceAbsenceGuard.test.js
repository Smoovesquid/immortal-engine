// U424 — CG-1c: the absence/negation guard on CG-1b's presence comparator
// (docs/briefs/CG-1c-absence-guard.md). A name-mention does NOT count as
// in-room presence when the CLAUSE containing the name asserts absence,
// distance, or negation.
//
// THE LIVE FALSE POSITIVE THIS PACKET FIXES (verbatim, PACKETS.md §GATE
// 2026-07-04-2's last bullet / shadow observer's ONLY fire in 36 live turns):
//   "No one answers — Elske Nightherd is elsewhere in Wayfarers' Outpost, and
//   the bedchamber holds only the quiet creak of timber walls and the open
//   chest sitting em…" (real turn: docs/playtests/gate-runs/
//   gate-2026-07-04T15-01-26-563Z-v1.jsonl, persona=newbie, i=10)
// This is a CORRECT absence statement. Before this guard, CG-1b counted the
// bare name-mention + a nearby SPEECH_ACTION_VERB-window match as in-room
// speech. This test locks BOTH directions: the guard table of absence
// phrasings must NOT fire, and true in-room speech/action (including the
// tricky "the rumor that she is elsewhere" trap, where the absence language
// sits in a DIFFERENT clause than the named action) must STILL fire.
//
// Pure-function unit tests over synthetic + one real (corpus-verbatim) turn
// fixture. No LLM, no server, no engine import — $0 and deterministic.

import test from 'node:test';
import assert from 'node:assert/strict';

import { detectPresenceDesync } from '../engine/coherence/checks.js';

// Minimal turn fixture builder — mirrors U388's `turn()` helper exactly, with
// the empty-room CG-1b scope already wired (interior set, roomOccupants: []).
function turn(dm, npcsPresent = ['Elske Nightherd'], player = '') {
  return {
    type: 'turn', seed: 's', persona: 'p', i: 0, player, dm, mechanics: '', route: 'action',
    canon: {
      interior: { roomId: 'r1', roomName: 'Bedchamber' },
      roomOccupants: [],
      npcsPresent: npcsPresent.map(name => ({ name })),
    },
    judgeError: false, v1: null, v2: null,
  };
}

function cg1bFires(dm, npcsPresent, player) {
  const flags = detectPresenceDesync([turn(dm, npcsPresent, player)]);
  return flags.filter(f => f.class === 'CG-1b').length > 0;
}

// ── table of absence-phrasings — must NOT fire ──────────────────────────────
const ABSENCE_TABLE = [
  [
    'the live FP line, VERBATIM (real corpus turn — must not regress)',
    "No one answers — Elske Nightherd is elsewhere in Wayfarers' Outpost, and the bedchamber holds only the quiet creak of timber walls and the open chest sitting empty of company.",
  ],
  ['"is elsewhere"', 'Elske Nightherd is elsewhere in the settlement, tending to other business.'],
  ['"not here"', 'Elske Nightherd is not here — she left before you arrived.'],
  ["\"isn't here\" (contraction)", "Elske Nightherd isn't here right now."],
  ['"is away"', 'Elske Nightherd is away on business at the shrine.'],
  ['"is gone"', 'Elske Nightherd is gone — the room has been empty for hours.'],
  ['"has left"', 'Elske Nightherd has left the bedchamber; only silence remains.'],
  ['"stepped out"', 'Elske Nightherd stepped out a moment ago and has not returned.'],
  ['"is out at <place>"', 'Elske Nightherd is out at the well, drawing water for the evening.'],
  ['"is out in <place>"', 'Elske Nightherd is out in the yard, out of earshot.'],
  ['"no one answers — X" construction', 'No one answers — Elske Nightherd is not here, only the empty chest and quiet walls remain.'],
  ['"somewhere else"', 'Elske Nightherd is somewhere else in the settlement this morning.'],
  [
    '"through the window" line-of-sight (explicitly out-of-room)',
    'Through the window you can see Elske Nightherd crossing the yard below, oblivious to your call.',
  ],
];

for (const [label, dm] of ABSENCE_TABLE) {
  test(`U424: CG-1b does NOT fire on absence phrasing — ${label}`, () => {
    assert.equal(cg1bFires(dm), false, `expected no CG-1b flag for: "${dm}"`);
  });
}

// ── in-room speech/action phrasings — MUST still fire ───────────────────────
// Each row: [label, dm, npcsPresent (defaults to ['Elske Nightherd'])].
const IN_ROOM_TABLE = [
  ['real corpus true positive — "shrugs"', 'Elske Nightherd shrugs. "Can\'t say. No record I\'ve ever seen."'],
  ['real corpus true positive — "sighs"', 'Elske Nightherd sighs. "I told you — I don\'t know. Won\'t change by asking twice."'],
  ['real corpus true positive — "shakes their head"', 'Elske Nightherd shakes their head. "Wouldn\'t know — nobody\'s ever told me."'],
  [
    'real corpus true positive — "the Lingerer" acting mid-scene',
    "The straw pallet at Wayfarers' Outpost catches fast, flames spreading across the plank floor and licking the wattle-and-daub walls as the Lingerer stumbles back with a sharp cry.",
    ['the Lingerer'],
  ],
  [
    // THE TRAP (docs/briefs/CG-1c-absence-guard.md, verbatim intent): "Elske
    // snorts — the rumor that she is elsewhere amuses her" — the absence
    // language ("she is elsewhere") sits in a DIFFERENT clause (about "the
    // rumor", after the dash) than the named action ("Elske snorts", her own
    // clause) and must NOT suppress the real in-room action. "Scoffs" stands
    // in for "snorts" here — a same-meaning action-tell already on the
    // provenance-locked SPEECH_ACTION_VERBS list (kept byte-identical to
    // coherence-audit.mjs's sibling list by design; "snorts" isn't on either,
    // and adding a verb only here would break that documented parity). The
    // clause-scoping mechanism under test is identical either way.
    'THE TRAP — absence language in a DIFFERENT clause than the named action (must still fire)',
    'Elske Nightherd scoffs — the rumor that she is elsewhere amuses her.',
  ],
];

for (const [label, dm, npcsPresent] of IN_ROOM_TABLE) {
  test(`U424: CG-1b still FIRES on in-room speech/action — ${label}`, () => {
    assert.equal(cg1bFires(dm, npcsPresent), true, `expected a CG-1b flag for: "${dm}"`);
  });
}

// ── the trap case, verified precisely (not just true/false) ────────────────
test('U424: the "rumor that she is elsewhere" trap fires with the CORRECT narrated name, not a false negative dressed as a pass', () => {
  const dm = 'Elske Nightherd scoffs — the rumor that she is elsewhere amuses her.';
  const flags = detectPresenceDesync([turn(dm)]);
  const cg1b = flags.filter(f => f.class === 'CG-1b');
  assert.equal(cg1b.length, 1, 'exactly one CG-1b flag');
  assert.match(cg1b[0].narrated, /Elske Nightherd/, 'the flag names the NPC who actually acted in-room');
});

// ── the guard is CLAUSE-scoped, not text-wide (load-bearing precision claim) ─
test('U424: an absence phrase elsewhere in the SAME dm text does not suppress a real ghost-voice in an unrelated clause', () => {
  // Two independent clauses: the first names Dalla as away (true, elsewhere),
  // the second has Elske actually speak in-room. The guard must only cancel
  // the clause that is actually about the named absence, never the whole line.
  const dm = 'Dalla is elsewhere in the settlement today. Elske Nightherd shrugs. "Can\'t say."';
  const flags = detectPresenceDesync([turn(dm, ['Dalla', 'Elske Nightherd'])]);
  const cg1b = flags.filter(f => f.class === 'CG-1b');
  const names = cg1b.map(f => f.narrated);
  assert.ok(names.some(n => /Elske Nightherd/.test(n)), 'Elske\'s real in-room speech still fires');
  assert.ok(!names.some(n => /Dalla/.test(n)), "Dalla's absence clause must not fire — she never spoke/acted");
});

// ── guard does not touch the pre-existing bare-mention guard (U388) ─────────
test('U424: a bare mention with no speech/action verb still does not fire (unrelated, pre-existing guard — must be untouched)', () => {
  const dm = 'Elske Nightherd is not in this room.';
  assert.equal(cg1bFires(dm), false);
});

// ── the exact historical FP turn, replayed with its FULL real canon bundle ──
test('U424: the real gate-run FP turn (persona=newbie, i=10) produces ZERO CG-1b flags with the guard active', () => {
  const realCanon = {
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
  const dm = "No one answers — Elske Nightherd is elsewhere in Wayfarers' Outpost, and the bedchamber holds only the quiet creak of timber walls and the open chest sitting empty of company.";
  const session = [{
    type: 'turn', seed: 'tallow', persona: 'newbie', i: 10,
    player: "Alright, well, hi Elske. Since you're here, can you tell me anything about that wedding letter I was just reading?",
    dm, mechanics: '[info-check → no-record | nothing grounded to deliver, no roll]', route: 'action',
    canon: realCanon, judgeError: false, v1: null, v2: null,
  }];
  const flags = detectPresenceDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-1b').length, 0, 'the real historical false positive must not fire anymore');
});

// ── the real gate-run TRUE POSITIVE turn (persona=newbie, i=7) must be unaffected ──
test('U424: the real gate-run true-positive turn (persona=newbie, i=7, "shrugs") still fires CG-1b', () => {
  const realCanon = {
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
  const dm = 'Elske Nightherd shrugs. "Can\'t say. No record I\'ve ever seen."';
  const session = [{
    type: 'turn', seed: 'tallow', persona: 'newbie', i: 7,
    player: "Okay, that's weird, a second ago you told me I was reading a letter about a wedding. Where did it go?",
    dm, mechanics: '', route: 'action',
    canon: realCanon, judgeError: false, v1: null, v2: null,
  }];
  const flags = detectPresenceDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-1b').length, 1, 'the real historical true positive must still fire');
});
