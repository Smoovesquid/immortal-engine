// U469 — CG-2 (Candidate A) THE REGRESSION FLOOR: every historical TRUE catch the
// shadow proved must STILL be rejected by the promoted validator in 'on' mode,
// fall back correctly, AND a clean grounded polish must pass. Plus: the CG-1c
// absence/negation guard still prevents the "X is elsewhere" false positive.
//
// PROVENANCE — the catch set is REAL corpus, not invented. These are the exact
// {player, dm, mechanics, canon} records from the committed regression corpus
// docs/playtests/gate-runs/gate-2026-07-03T11-45-56-173Z-v1.jsonl — the same
// turns U389 hand-verified turn-by-turn as the honest CG-P1 baseline. That file
// carries 7 fail-severity flags across 6 turns; SIX are SINGLE-TURN reproducible
// (CG-1b×2, CG-2a×2, CG-3a×1, CG-5×1) and are what the promoted single-turn
// validator locks. The 7th, CG-2c (newbie t8, unnarrated relocation), is
// CROSS-TURN — it needs a prev-canon side-channel the validator position has no
// honest access to, so it stays with the shadow OBSERVER (which keeps its
// module-level PREV_CANON map). U388/U389 remain the cross-turn CG-2c lock;
// this file locks the single-turn floor the validator actually enforces.
//
// No LLM, no server, no network — pure comparators over embedded fixtures.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { coherenceRejects, coherenceSafeFloor } from '../engine/coherence/validator.js';
import { loadJsonlFile } from '../scripts/coherence-gate.mjs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const CORPUS = path.join(__dirname, '..', 'docs', 'playtests', 'gate-runs', 'gate-2026-07-03T11-45-56-173Z-v1.jsonl');

// ── the SIX single-turn true catches (real corpus prose + real canon bundle) ──
// Each entry cites its persona::turn in the corpus so a reviewer can confirm the
// prose against gate-runs/…-v1.jsonl. `expectClass` is the fail-class the shadow
// proved on this turn (U389's per-class citations).
const TRUE_CATCHES = [
  {
    id: 'rules-lawyer::7', expectClass: 'CG-1b',
    player: 'So if Elske isn\'t here, who just said "that\'s lost to me" when I asked about the chest?',
    dm: 'Elske Nightherd shrugs. "Can\'t say. No record I\'ve ever seen."',
    mechanics: '[info-check → no-record | nothing grounded to deliver, no roll]',
    canon: {
      interior: { roomId: 'room:stgen:v27:n3_1515674724:0:2', roomName: 'Bedchamber' },
      roomOccupants: [], npcsPresent: [{ name: 'Elske Nightherd' }, { name: 'Dalla' }, { name: 'Asha' }, { name: 'Ashblade' }, { name: 'the Lingerer' }],
      enemies: [], inCombat: false,
    },
  },
  {
    id: 'rules-lawyer::9', expectClass: 'CG-3a',
    player: 'I reach out, grip the lid of the iron-bound chest, and lift. Does it open?',
    dm: 'It gives at last — but the wood splinters and the noise carries further than you\'d like.',
    mechanics: '[info-check → no-record | nothing grounded to deliver, no roll]',
    canon: {
      interior: { roomId: 'room:stgen:v27:n3_1515674724:0:2', roomName: 'Bedchamber' },
      roomOccupants: [], npcsPresent: [{ name: 'Elske Nightherd' }, { name: 'Dalla' }, { name: 'Asha' }, { name: 'Ashblade' }, { name: 'the Lingerer' }],
      enemies: [], inCombat: false,
    },
  },
  {
    id: 'chaos::2', expectClass: 'CG-1b',
    player: 'I set fire to the straw pallet and watch the cottage burn.',
    dm: 'The straw pallet at Wayfarers\' Outpost catches fast, flames spreading across the plank floor and licking the wattle-and-daub walls as the Lingerer stumbles back with a sharp cry, and the air around you takes on a weight that wasn\'t there before — as though something beyond the firelight has turned its attention your way.',
    mechanics: '[cast-consequence: person-innocent | the Lingerer | recoil]',
    canon: {
      interior: { roomId: 'room:stgen:v27:n3_1515674724:0:2', roomName: 'Bedchamber' },
      roomOccupants: [], npcsPresent: [{ name: 'Elske Nightherd' }, { name: 'Dalla' }, { name: 'Asha' }, { name: 'Ashblade' }, { name: 'the Lingerer' }],
      enemies: [], inCombat: false,
    },
  },
  {
    id: 'lore-hound::5', expectClass: 'CG-5',
    player: 'The Lingerer — what\'s your name, and how long have you lingered here at Wayfarers\' Outpost?',
    dm: '"Asha. I watch the road so others don\'t have to." Asha watches to see what you make of that.',
    mechanics: '[dialogue enter | Asha]',
    canon: {
      roomOccupants: [{ name: 'Asha', role: 'guard' }],
      npcsPresent: [{ name: 'Elske Nightherd' }, { name: 'Dalla' }, { name: 'Asha' }, { name: 'Ashblade' }, { name: 'the Lingerer' }],
      enemies: [], inCombat: false,
    },
  },
  {
    id: 'newbie::7', expectClass: 'CG-2a',
    player: 'I\'ll head through the doorway toward the front of the cottage.',
    dm: 'The doorway leads you forward through the Wayfarers\' Outpost cottage, the plank-and-earth floor creaking softly underfoot as the front room opens before you.',
    mechanics: '',
    canon: {
      interior: { roomId: 'room:stgen:v27:n3_1515674724:0:3', roomName: 'Pantry' },
      roomOccupants: [], npcsPresent: [{ name: 'Elske Nightherd' }, { name: 'Dalla' }, { name: 'Asha' }, { name: 'Ashblade' }, { name: 'the Lingerer' }],
      enemies: [], inCombat: false,
    },
  },
  {
    id: 'newbie::8', expectClass: 'CG-2a',
    player: 'Oh good, it worked. What do I see in this front room?',
    dm: 'The front room of the cottage at Wayfarers\' Outpost is modest but tidy: a plank-and-earth floor worn smooth by habitual traffic, wattle-and-daub walls bearing a few iron hooks, and the outward-facing door that opens onto the settlement\'s roads and people beyond.',
    mechanics: '',
    canon: {
      interior: { roomId: 'room:stgen:v27:n3_1515674724:0:2', roomName: 'Bedchamber' },
      roomOccupants: [], npcsPresent: [{ name: 'Elske Nightherd' }, { name: 'Dalla' }, { name: 'Asha' }, { name: 'Ashblade' }, { name: 'the Lingerer' }],
      enemies: [], inCombat: false,
    },
  },
];

test('U469: all SIX single-turn historical true catches are REJECTED by the promoted validator', () => {
  for (const c of TRUE_CATCHES) {
    const verdict = coherenceRejects({
      world: {},
      candidate: c.dm,
      outcome: { input: c.player, mechanics: c.mechanics },
      _canonForTest: c.canon,
    });
    assert.equal(verdict.blocks, true, `${c.id} (${c.expectClass}) must be rejected — recall regression if not`);
    assert.ok(
      verdict.fails.some(f => f.class === c.expectClass),
      `${c.id} must carry a ${c.expectClass} fail pointer; got [${verdict.fails.map(f => f.class).join(', ')}]`,
    );
  }
});

test('U469: the corpus itself still yields exactly these 6 single-turn fail catches (guards against silent recall drift)', () => {
  // Re-derive the catch set from the LIVE corpus file the same way the validator
  // would see each turn (one-turn record). If a comparator silently loses a catch,
  // this count drops and the test fails BEFORE the embedded fixtures can mask it.
  assert.ok(fs.existsSync(CORPUS), `missing regression corpus ${CORPUS}`);
  const parsed = loadJsonlFile(CORPUS);
  let singleTurnFails = 0;
  const seen = [];
  for (const t of parsed.turns) {
    const verdict = coherenceRejects({
      world: {},
      candidate: t.dm,
      outcome: { input: t.player, mechanics: t.mechanics },
      _canonForTest: t.canon,
    });
    if (verdict.blocks) {
      singleTurnFails += verdict.fails.length;
      seen.push(`${t.persona}::${t.i}:${verdict.fails.map(f => f.class).join('+')}`);
    }
  }
  assert.equal(singleTurnFails, 6, `promoted single-turn validator must reproduce exactly 6 fail catches on the corpus; got ${singleTurnFails} [${seen.join(', ')}]`);
});

test('U469: in "on"-mode fallback, a REJECTED candidate is replaced by a grounded string (base or safe floor), never empty', () => {
  // Simulate the finalize() fallback ladder directly: reject candidate → try base
  // → if base flags too, the coherence-safe floor. Every rung yields a non-empty
  // grounded string. (finalize() itself is exercised end-to-end in U470.)
  for (const c of TRUE_CATCHES) {
    const opts = { world: {}, outcome: { input: c.player, mechanics: c.mechanics }, _canonForTest: c.canon };
    // A grounded base that does NOT itself flag against this canon (pure description).
    const cleanBase = 'The air is close and still, and the floorboards are cool underfoot.';
    const baseVerdict = coherenceRejects({ ...opts, candidate: cleanBase });
    const fallback = baseVerdict.blocks ? coherenceSafeFloor(cleanBase, opts) : cleanBase;
    assert.ok(fallback && fallback.trim().length > 0, `${c.id}: fallback must be a non-empty grounded string`);
    // And the fallback itself must not flag.
    assert.equal(coherenceRejects({ ...opts, candidate: fallback }).blocks, false, `${c.id}: the fallback must be coherence-clean`);
  }
});

test('U469: a CLEAN grounded polish PASSES (no over-block) — precision holds', () => {
  const canon = {
    interior: { roomId: 'r1', roomName: 'Pantry' },
    roomOccupants: [{ name: 'Asha' }], npcsPresent: [{ name: 'Asha' }],
    enemies: [], inCombat: false,
  };
  // Asha IS in the room; a line voicing Asha is coherent, and a pure description is coherent.
  const cleanLines = [
    'The pantry is dim, its shelves stripped nearly bare, and Asha keeps her post by the door.',
    'Dust hangs in the light from the one high window; the pantry smells of old flour.',
    '"The road stays quiet tonight," Asha says, not looking away from the shutters.',
  ];
  for (const dm of cleanLines) {
    const verdict = coherenceRejects({ world: {}, candidate: dm, outcome: { input: 'look', mechanics: '' }, _canonForTest: canon });
    assert.equal(verdict.blocks, false, `a coherent line must not be blocked: "${dm}"`);
  }
});

test('U469: the CG-1c absence/negation guard still prevents the "X is elsewhere" FALSE positive', () => {
  // The exact live false-positive class CG-1c fixed (checks.js provenance): a name
  // in the SAME clause as an absence phrase is a correct absence statement, NOT a
  // ghost-voice. Room here IS the Bedchamber (so no CG-2a noise) and roomOccupants
  // is empty — the presence axis is the only one in play.
  const canon = {
    interior: { roomId: 'r1', roomName: 'Bedchamber' },
    roomOccupants: [], npcsPresent: [{ name: 'Elske Nightherd' }],
    enemies: [], inCombat: false,
  };
  const absenceLines = [
    'No one answers — Elske Nightherd is elsewhere in the outpost, and the bedchamber holds only the quiet creak of timber walls.',
    'Elske Nightherd is not here; the bedchamber is empty and still.',
    'The bedchamber is dark. Elske Nightherd has stepped out, and no one else stirs.',
  ];
  for (const dm of absenceLines) {
    const verdict = coherenceRejects({ world: {}, candidate: dm, outcome: { input: 'who is here', mechanics: '' }, _canonForTest: canon });
    assert.equal(verdict.blocks, false, `absence statement must NOT be flagged as a ghost-voice: "${dm}"`);
  }
});

test('U469: the clause-scoped guard STILL fires on a real ghost-voice even when an absence phrase sits in a DIFFERENT clause', () => {
  // The load-bearing precision case from checks.js: an NPC ACTS in-room in her own
  // clause while the absence language is in a DIFFERENT clause — the absence phrase
  // must NOT reach across the clause boundary to suppress the real ghost-voice.
  // ("scoffs" is a recognized speech/action verb in SPEECH_ACTION_VERBS; the
  // checks.js comment's illustrative "snorts" is not, so we use a real one.)
  const canon = {
    interior: { roomId: 'r1', roomName: 'Bedchamber' },
    roomOccupants: [], npcsPresent: [{ name: 'Elske Nightherd' }],
    enemies: [], inCombat: false,
  };
  const dm = 'Elske Nightherd scoffs — the rumor that she is elsewhere amuses her.';
  const verdict = coherenceRejects({ world: {}, candidate: dm, outcome: { input: 'who is here', mechanics: '' }, _canonForTest: canon });
  assert.equal(verdict.blocks, true, 'a real in-room action must still be caught despite an unrelated absence clause');
  assert.ok(verdict.fails.some(f => f.class === 'CG-1b'), 'the catch is CG-1b ghost-voice');
});
