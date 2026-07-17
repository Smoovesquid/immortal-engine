// U721 — RULING-DC-1 Stage B: the improvised-ruling difficulty judge.
//
// The model names a coarse difficulty BAND (never a number — V11 law); the
// engine maps band → DC through one fixed table in resolve.js and keeps the
// seeded d20, all outcome machinery, and the mech-line surface. The band
// applies ONLY at the generic resolve floor (the unmodeled gap); authored
// truth (object hardness, combat, trivial fast-path) never consults it.
// A player-declared ability (DECL-STAT-1) always outranks the judge's stat.
// 'impossible' declines in fiction before any die is thrown (DM Test).

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, newScene, playerMove } from '../engine/playloop.js';
import { resolveMove } from '../engine/resolve.js';
import { makeIntent } from '../engine/intent/intentSchema.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel'],
    locations: ['tower'],
    objectives: ['find the key'],
    complications: ['a clock starts'],
    npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust']
  }
};

function boot(seed = 'u721-seed') {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const begun = beginAdventure(w0, packsById).world;
  return newScene(begun, packsById).world;
}

function judgedPacket(text, band, dStat = null) {
  const p = makeIntent({ source: 'llm', verb: 'use', text, confidence: 0.9, difficultyBand: band, difficultyStat: dStat });
  return p;
}

const FLOOR_TEXT = 'I wrench the rusted grate loose with my bare hands.';
const BAND_DC = { trivial: 5, easy: 10, medium: 12, hard: 15, very_hard: 18 };

// ---------------------------------------------------------------------------
// A — band → DC is one fixed table in resolveMove (unit level)
// ---------------------------------------------------------------------------

test('U721-A1: each band maps to its fixed DC; null falls back to the formula', () => {
  const w = boot();
  const base = {
    actorId: 'party', intentText: 'test feat', approachTag: 'force',
    risk: 0.5, stakeTag: 'harm', targetId: null, toolTag: null
  };
  const formulaDc = resolveMove(w, { ...base }).result.dc;
  for (const [band, dc] of Object.entries(BAND_DC)) {
    const r = resolveMove(w, { ...base, difficultyBandTag: band });
    assert.equal(r.result.dc, dc, `band ${band} must resolve at DC ${dc}`);
  }
  assert.equal(resolveMove(w, { ...base, difficultyBandTag: null }).result.dc, formulaDc,
    'null band keeps the deterministic formula DC');
  assert.notEqual(formulaDc, BAND_DC.very_hard, 'fixture guard: formula DC must differ from very_hard');
});

test('U721-A2: a forged band value never reaches the table — junk and impossible coerce to the formula', () => {
  const w = boot();
  const base = {
    actorId: 'party', intentText: 'test feat', approachTag: 'force',
    risk: 0.5, stakeTag: 'harm', targetId: null, toolTag: null
  };
  const formulaDc = resolveMove(w, { ...base }).result.dc;
  for (const junk of ['legendary', 'DC:3', 'IMPOSSIBLE', 'impossible', 42, {}]) {
    assert.equal(resolveMove(w, { ...base, difficultyBandTag: junk }).result.dc, formulaDc,
      `junk band ${JSON.stringify(junk)} must fall back to the formula`);
  }
});

// ---------------------------------------------------------------------------
// B — the wire: a judged packet drives the generic floor's DC through playerMove
// ---------------------------------------------------------------------------

test('U721-B1: a very_hard judgment sets the floor DC to 18 and is recorded in canon', () => {
  const w = boot();
  const judged = playerMove(w, packsById, FLOOR_TEXT, { llmPacket: judgedPacket(FLOOR_TEXT, 'very_hard') });
  const mech = String(judged.output?.mechanics || '');
  assert.match(mech, /DC:18\b/, `judged mech line must roll against DC 18 (got: ${mech})`);
  const e = judged.world.timeline.slice(w.timeline.length).find(x => x.kind === 'resolution');
  assert.ok(e, 'judged floor turn must mint a resolution event');
  assert.equal(e.data.dc, 18, 'the judged DC is canon on the resolution event');
  assert.equal(e.data.resolvedIntent?.difficultyBand, 'very_hard', 'the band rides the persisted record');

  const plain = playerMove(w, packsById, FLOOR_TEXT);
  const plainMech = String(plain.output?.mechanics || '');
  assert.doesNotMatch(plainMech, /DC:18\b/, `unjudged same text must keep the formula DC (got: ${plainMech})`);
});

// ---------------------------------------------------------------------------
// C — stat precedence: declared (DECL-STAT-1) > judge > approach inference
// ---------------------------------------------------------------------------

test('U721-C1: the judge stat keys the die when the player declared nothing', () => {
  const w = boot();
  const judged = playerMove(w, packsById, FLOOR_TEXT, { llmPacket: judgedPacket(FLOOR_TEXT, 'medium', 'AGILITY') });
  assert.match(String(judged.output?.mechanics || ''), /stat:AGILITY\b/,
    'judge stat must key the roll when no declaration exists');
});

test('U721-C2: a player-declared ability always outranks the judge stat', () => {
  const w = boot();
  const text = "I wrench the rusted grate loose — I'll roll Strength.";
  const judged = playerMove(w, packsById, text, { llmPacket: judgedPacket(text, 'medium', 'AGILITY') });
  assert.match(String(judged.output?.mechanics || ''), /stat:MIGHT\b/,
    'declared MIGHT must beat the judge AGILITY suggestion');
});

// ---------------------------------------------------------------------------
// D — impossible declines in fiction: no die, no DC, no canon write
// ---------------------------------------------------------------------------

test('U721-D1: an impossible judgment declines in fiction without rolling', () => {
  const w = boot();
  const text = 'I lift the entire tower over my head and shake it.';
  const r = playerMove(w, packsById, text, { llmPacket: judgedPacket(text, 'impossible') });
  const narration = String(r.output?.narration || '');
  const mech = String(r.output?.mechanics || '');
  assert.ok(narration.length > 0, 'the decline must be narrated in fiction');
  assert.doesNotMatch(mech, /roll:\d+/, 'no die is thrown for an impossible feat');
  assert.doesNotMatch(mech, /DC:\d+/, 'no DC is surfaced for an impossible feat');
  assert.equal(r.world.timeline.length, w.timeline.length,
    'an impossible decline writes no canon — the world moves on');
});

// ---------------------------------------------------------------------------
// E — scope: the band cannot hijack a non-floor handler
// ---------------------------------------------------------------------------

test('U721-E1: a trivial fast-path action ignores the band entirely', () => {
  const w = boot();
  const text = 'I take a slow breath.';
  const r = playerMove(w, packsById, text, { llmPacket: judgedPacket(text, 'very_hard') });
  const mech = String(r.output?.mechanics || '');
  assert.doesNotMatch(mech, /DC:18\b/, `the trivial handler must not consult the judge (got: ${mech})`);
});
