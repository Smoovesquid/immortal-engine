// U388 — coherence-gate.mjs Tier-D detector unit tests (docs/briefs/COHERENCE_GATE.md
// §3 taxonomy). Pure-function checks over synthetic turn fixtures: one positive
// (must flag) and one negative/guard (must NOT flag) per class, mirroring the
// U336 style for the sibling instrument (coherence-audit.mjs). No LLM calls, no
// server, no engine import — $0 and deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectPresenceDesync, detectPlaceDesync, detectObjectPhantomCommit,
  detectCombatDesync, detectAddresseeDesync, detectQuantityDesync,
  detectForbiddenTokens, runCoherenceGate, parseJsonl, renderReport, summaryLine,
} from '../scripts/coherence-gate.mjs';

// Minimal turn fixture builder — only the fields the detectors read.
function turn(i, persona, { player = '', dm = '', mechanics = '', canon = {} } = {}) {
  return {
    type: 'turn', seed: 's', persona, i, player, dm, mechanics, route: 'action',
    canon: { npcsPresent: [], ...canon }, judgeError: false, v1: null, v2: null,
  };
}

// ── CG-1a — presence erasure ────────────────────────────────────────────────
test('U388: CG-1a flags erasure ("no one here") while the scoped inside roster is non-empty', () => {
  const session = [
    turn(0, 'p', {
      player: 'Who else is here with me?',
      dm: 'No one. Little of note in this room.',
      canon: {
        interior: { roomId: 'r1', roomName: 'Bedchamber' },
        roomOccupants: [{ name: 'Asha' }],
        npcsPresent: [{ name: 'Asha' }],
      },
    }),
  ];
  const flags = detectPresenceDesync(session);
  const cg1a = flags.filter(f => f.class === 'CG-1a');
  assert.equal(cg1a.length, 1);
  assert.equal(cg1a[0].severity, 'fail');
});

test('U388: CG-1a does NOT flag erasure when the scoped roster genuinely is empty (guard)', () => {
  const session = [
    turn(0, 'p', {
      player: 'Who else is here with me?',
      dm: 'No one. You are alone.',
      canon: {
        interior: { roomId: 'r1', roomName: 'Bedchamber' },
        roomOccupants: [],
        npcsPresent: [{ name: 'Asha' }],
      },
    }),
  ];
  const flags = detectPresenceDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-1a').length, 0, 'an honestly empty room must never be flagged as erasure');
});

// ── CG-1b — presence ghost-voice ────────────────────────────────────────────
test('U388: CG-1b flags a named present-roster NPC speaking while roomOccupants is empty', () => {
  const session = [
    turn(0, 'p', {
      player: 'Who just said that?',
      dm: 'Elske Nightherd shrugs. "Can\'t say."',
      canon: {
        interior: { roomId: 'r1', roomName: 'Bedchamber' },
        roomOccupants: [],
        npcsPresent: [{ name: 'Elske Nightherd' }],
      },
    }),
  ];
  const flags = detectPresenceDesync(session);
  const cg1b = flags.filter(f => f.class === 'CG-1b');
  assert.equal(cg1b.length, 1);
  assert.equal(cg1b[0].canonField, 'roomOccupants');
});

test('U388: CG-1b does NOT flag a bare mention of a name with no speech/action verb (guard)', () => {
  const session = [
    turn(0, 'p', {
      player: 'Where is Elske Nightherd?',
      dm: 'Elske Nightherd is not in this room.',
      canon: {
        interior: { roomId: 'r1', roomName: 'Bedchamber' },
        roomOccupants: [],
        npcsPresent: [{ name: 'Elske Nightherd' }],
      },
    }),
  ];
  const flags = detectPresenceDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-1b').length, 0, 'a bare mention is not a speaking/acting ghost-voice claim');
});

test('U388: CG-1b stays dormant when `interior` is absent from the bundle (pre-ROM-3 negative control)', () => {
  const session = [
    turn(0, 'p', {
      player: 'Who just said that?',
      dm: 'Elske Nightherd shrugs. "Can\'t say."',
      canon: { npcsPresent: [{ name: 'Elske Nightherd' }] }, // no `interior` key at all
    }),
  ];
  const flags = detectPresenceDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-1b').length, 0, 'no interior field means no roomOccupants ground truth — must not fabricate a flag');
});

// ── CG-1c — presence omission (WARN only) ───────────────────────────────────
test('U388: CG-1c WARN-flags a direct ask answered with fewer names than the roster holds', () => {
  const session = [
    turn(0, 'p', {
      player: 'Who are these people milling about — anyone here got a name?',
      dm: 'Asha the guard is right here.',
      canon: { npcsPresent: [{ name: 'Asha' }, { name: 'Dalla' }] }, // outside — no interior
    }),
  ];
  const flags = detectPresenceDesync(session);
  const cg1c = flags.filter(f => f.class === 'CG-1c');
  assert.equal(cg1c.length, 1);
  assert.equal(cg1c[0].severity, 'warn', 'omission is a soft signal — never FAIL, a real DM need not enumerate everyone');
});

test('U388: CG-1c does NOT flag when every roster name is named (guard)', () => {
  const session = [
    turn(0, 'p', {
      player: 'Who are these people milling about — anyone here got a name?',
      dm: 'Asha the guard and Dalla the innkeeper are right here.',
      canon: { npcsPresent: [{ name: 'Asha' }, { name: 'Dalla' }] },
    }),
  ];
  const flags = detectPresenceDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-1c').length, 0);
});

// ── CG-2a — place-noun desync ───────────────────────────────────────────────
test('U388: CG-2a flags a narrated room-type noun that contradicts interior.roomName', () => {
  const session = [
    turn(0, 'p', {
      dm: 'The front room opens before you.',
      canon: { interior: { roomId: 'r2', roomName: 'Pantry' } },
    }),
  ];
  const flags = detectPlaceDesync(session);
  const cg2a = flags.filter(f => f.class === 'CG-2a');
  assert.equal(cg2a.length, 1);
  assert.equal(cg2a[0].expected, 'Pantry');
  assert.equal(cg2a[0].narrated, 'front room');
});

test('U388: CG-2a does NOT flag when the narrated noun matches roomName (guard)', () => {
  const session = [
    turn(0, 'p', {
      dm: 'The pantry shelves are bare.',
      canon: { interior: { roomId: 'r2', roomName: 'Pantry' } },
    }),
  ];
  const flags = detectPlaceDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-2a').length, 0);
});

test('U388: CG-2a does NOT fire on a spatial qualifier alone (guard — "back room" is not an identity claim)', () => {
  const session = [
    turn(0, 'p', {
      dm: 'You step into the back room.',
      canon: { interior: { roomId: 'r2', roomName: 'Pantry' } },
    }),
  ];
  const flags = detectPlaceDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-2a').length, 0, '"back room" is a qualifier, not a room-identity noun — C4 territory, not CG-2a');
});

// ── CG-2c — unnarrated relocation ───────────────────────────────────────────
test('U388: CG-2c flags roomId changing turn-over-turn with no movement intent in player or DM line', () => {
  const session = [
    turn(0, 'p', { dm: 'You look around the bedchamber.', canon: { interior: { roomId: 'r1', roomName: 'Bedchamber' } } }),
    turn(1, 'p', {
      player: 'What do I see in this front room?',
      dm: 'The front room is modest but tidy.',
      canon: { interior: { roomId: 'r2', roomName: 'Pantry' } },
    }),
  ];
  const flags = detectPlaceDesync(session);
  const cg2c = flags.filter(f => f.class === 'CG-2c');
  assert.equal(cg2c.length, 1);
});

test('U388: CG-2c does NOT flag a roomId change WITH explicit movement intent (guard)', () => {
  const session = [
    turn(0, 'p', { dm: 'You look around the bedchamber.', canon: { interior: { roomId: 'r1', roomName: 'Bedchamber' } } }),
    turn(1, 'p', {
      player: 'I head through the doorway toward the front of the cottage.',
      dm: 'You walk through into the pantry.',
      canon: { interior: { roomId: 'r2', roomName: 'Pantry' } },
    }),
  ];
  const flags = detectPlaceDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-2c').length, 0, 'a player-signaled move is a legitimate transition, not a teleport');
});

test('U388: CG-2c does NOT flag when interior is absent (dormant, pre-ROM-3 negative control)', () => {
  const session = [
    turn(0, 'p', { dm: 'You look around.', canon: {} }),
    turn(1, 'p', { player: 'What now?', dm: 'Something else.', canon: {} }),
  ];
  const flags = detectPlaceDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-2c').length, 0);
});

// ── CG-3a — object phantom-commit ───────────────────────────────────────────
test('U388: CG-3a flags an irreversible-change verb asserted on a non-committal mechanics route', () => {
  const session = [
    turn(0, 'p', {
      dm: 'It gives at last — but the wood splinters and the noise carries.',
      mechanics: '[info-check → no-record | nothing grounded to deliver, no roll]',
    }),
  ];
  const flags = detectObjectPhantomCommit(session);
  assert.equal(flags.filter(f => f.class === 'CG-3a').length, 1);
});

test('U388: CG-3a does NOT flag the same verb when mechanics shows a real committing roll (guard)', () => {
  const session = [
    turn(0, 'p', {
      dm: 'It gives at last — the wood splinters.',
      mechanics: '[roll:17 vs DC:13 → success | margin:4 | approach:force | stake:time | risk:0.57 | stat:MIGHT-2]',
    }),
  ];
  const flags = detectObjectPhantomCommit(session);
  assert.equal(flags.filter(f => f.class === 'CG-3a').length, 0, 'a real roll backing the commit is not a phantom commit');
});

test('U388: CG-3a stays silent when there is no mechanics line to compare against (guard — precision over recall)', () => {
  const session = [
    turn(0, 'p', { dm: 'It gives at last — the wood splinters.', mechanics: '' }),
  ];
  const flags = detectObjectPhantomCommit(session);
  assert.equal(flags.filter(f => f.class === 'CG-3a').length, 0);
});

// ── CG-4 — combat/health mirror ─────────────────────────────────────────────
test('U388: CG-4 flags a death claim with no matching defeated enemy or victory tag', () => {
  const session = [
    turn(0, 'p', {
      dm: 'The bandit falls dead at your feet.',
      mechanics: '[strike:Worn Blade | atk:15 vs AC:10 → hit | 4 dmg]',
      canon: { enemies: [{ name: 'Bandit', hp: 4, maxHp: 8, defeated: false }] },
    }),
  ];
  const flags = detectCombatDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-4' && f.canonField === 'enemies[]').length, 1);
});

test('U388: CG-4 does NOT flag a death claim when the enemy IS defeated in canon (guard)', () => {
  const session = [
    turn(0, 'p', {
      dm: 'The bandit falls dead at your feet.',
      mechanics: '[strike:Worn Blade | atk:20 vs AC:10 → hit | 8 dmg] [combat:victory]',
      canon: { enemies: [{ name: 'Bandit', hp: 0, maxHp: 8, defeated: true }] },
    }),
  ];
  const flags = detectCombatDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-4' && f.canonField === 'enemies[]').length, 0);
});

test('U388: CG-4 flags "unscathed" narration while mechanics shows an HP drop', () => {
  const session = [
    turn(0, 'p', {
      dm: 'You emerge from the exchange unscathed.',
      mechanics: '[enemy:Bandit | atk:15 vs AC:10 → hit | 3 dmg | pcHp:13->10]',
    }),
  ];
  const flags = detectCombatDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-4' && f.canonField === 'pc.hp').length, 1);
});

test('U388: CG-4 does NOT WARN-flag a strike tag that itself resolves combat this turn (guard — the chaos-t7 false positive this lane fixed)', () => {
  const session = [
    turn(0, 'p', {
      dm: 'Elske Nightherd crumples to the floor, still and silent.',
      mechanics: '[strike:Bite | atk:20 vs AC:10 → hit | 6 dmg] [combat:victory]',
      canon: { inCombat: false, enemies: [{ name: 'Elske Nightherd', hp: 0, maxHp: 8, defeated: true }] },
    }),
  ];
  const flags = detectCombatDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-4' && f.canonField === 'inCombat').length, 0, 'inCombat correctly flips false the instant the fight the strike just won is over');
});

// ── CG-5 — addressee desync ─────────────────────────────────────────────────
test('U388: CG-5 flags the DM voicing/binding a different NPC than the one the player addressed', () => {
  const session = [
    turn(0, 'p', {
      player: 'The Lingerer — what\'s your name, and how long have you lingered here?',
      dm: '"Asha. I watch the road so others don\'t have to." Asha watches to see what you make of that.',
      mechanics: '[dialogue enter | Asha | role:guard | trust:5/10]',
      canon: { npcsPresent: [{ name: 'Asha' }, { name: 'the Lingerer' }] },
    }),
  ];
  const flags = detectAddresseeDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-5').length, 1);
});

test('U388: CG-5 is case-insensitive on the addressed referent (guard — sentence-initial capitalization)', () => {
  // Regression: "The Lingerer" (capital T) vs roster's "the Lingerer" (lowercase)
  // must still match as the SAME referent — this is the exact lore-hound t6 case.
  const session = [
    turn(0, 'p', {
      player: 'The Lingerer, tell me your name.',
      dm: '"Asha." Asha watches you.',
      mechanics: '[dialogue enter | Asha]',
      canon: { npcsPresent: [{ name: 'Asha' }, { name: 'the Lingerer' }] },
    }),
  ];
  const flags = detectAddresseeDesync(session);
  assert.equal(flags.length, 1, 'capitalization difference alone must not hide a real addressee desync');
});

test('U388: CG-5 does NOT flag when the dialogue-bind matches the addressed NPC (guard)', () => {
  const session = [
    turn(0, 'p', {
      player: 'Asha, what do you watch for?',
      dm: '"The road," Asha says.',
      mechanics: '[dialogue enter | Asha | role:guard]',
      canon: { npcsPresent: [{ name: 'Asha' }] },
    }),
  ];
  const flags = detectAddresseeDesync(session);
  assert.equal(flags.length, 0);
});

// ── CG-7 — ungrounded quantity ───────────────────────────────────────────────
test('U388: CG-7 WARN-flags a cited headcount that contradicts the scoped roster size', () => {
  const session = [
    turn(0, 'p', {
      dm: 'Five people here, all watching you.',
      canon: { npcsPresent: [{ name: 'Asha' }, { name: 'Dalla' }] }, // 2, not 5
    }),
  ];
  const flags = detectQuantityDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-7').length, 1);
  assert.equal(flags[0].severity, 'warn');
});

test('U388: CG-7 does NOT flag a headcount that matches the roster size (guard)', () => {
  const session = [
    turn(0, 'p', {
      dm: 'Two people here, all watching you.',
      canon: { npcsPresent: [{ name: 'Asha' }, { name: 'Dalla' }] },
    }),
  ];
  const flags = detectQuantityDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-7').length, 0);
});

// ── §0 — forbidden-token scan ────────────────────────────────────────────────
test('U388: §0 flags a forbidden cosmology token surfacing in DM prose', () => {
  const session = [
    turn(0, 'p', { dm: 'The old man speaks of the universal AI that seeded the orbs.' }),
  ];
  const flags = detectForbiddenTokens(session);
  assert.equal(flags.filter(f => f.class === 'CG-0').length, 1);
});

test('U388: §0 does NOT flag ordinary fantasy vocabulary (guard — precision over recall)', () => {
  const session = [
    turn(0, 'p', { dm: 'The old ruins speak of some ancient cataclysm, long since forgotten.' }),
  ];
  const flags = detectForbiddenTokens(session);
  assert.equal(flags.filter(f => f.class === 'CG-0').length, 0, '"cataclysm" alone is common adventure-fiction vocabulary, not a named cosmology leak');
});

// ── runCoherenceGate / report rendering plumbing ────────────────────────────
test('U388: runCoherenceGate computes the honest floor as the de-duplicated union of judge-fails and flags', () => {
  const turns = [
    turn(0, 'chaos', {
      dm: 'The front room opens before you.',
      canon: { interior: { roomId: 'r2', roomName: 'Pantry' } },
    }),
  ];
  turns[0].v1 = { bug_class: 'NONE' }; // judge PASSED this turn — checker still flags it
  const result = runCoherenceGate({ run: null, turns });
  assert.equal(result.count, 1);
  assert.equal(result.judgeFailedCount, 0);
  assert.equal(result.honestFloor, 1);
  assert.equal(result.newSignalCount, 1);
});

test('U388: runCoherenceGate treats v2.bug_class "JUDGE_ERROR" as NOT a judge fail (regression — the bridge-file false-inflation this lane fixed)', () => {
  const turns = [
    turn(0, 'chaos', { dm: 'Nothing unusual here.' }),
  ];
  turns[0].v2 = { bug_class: 'JUDGE_ERROR' };
  const result = runCoherenceGate({ run: null, turns });
  assert.equal(result.judgeFailedCount, 0, 'a judge-call parse error is not a genuine per-turn verdict');
});

test('U388: renderReport + summaryLine produce non-empty, well-formed output', () => {
  const parsed = parseJsonl([
    JSON.stringify({ type: 'run', runId: 'fixture', regime: 'v1', personas: ['chaos'], seeds: ['s'], engineVersion: '0.0.0' }),
    JSON.stringify({ type: 'turn', seed: 's', persona: 'chaos', i: 0, player: 'look', dm: 'The front room opens.', mechanics: '', route: 'action', canon: { interior: { roomId: 'r2', roomName: 'Pantry' } }, judgeError: false, v1: { bug_class: 'NONE' }, v2: null }),
  ].join('\n'));
  const result = runCoherenceGate(parsed);
  const report = renderReport(result, { title: 'fixture report' });
  assert.match(report, /# fixture report/);
  assert.match(report, /CG-2a/);
  assert.match(report, /MACHINE:/);
  const summary = summaryLine(result);
  assert.match(summary, /^COHERENCE-GATE:/);
});
