// U722 — RULING-DC-1: the judge's trust boundary and the rail's durability.
//
// The model proposes difficulty as free JSON; ONLY the enum survives grounding
// (a hallucinated band/stat can never reach the resolver), a deterministic
// packet can never carry a judgment at all, and a judged turn's record
// survives a full export/import save cycle and still replays hash-identical.
// Paraphrase stability of the MODEL itself ("gently force the door") is a
// live-model property and lives in the shadow instrument
// (scripts/ruling-shadow.mjs), not in this offline suite.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, newScene, playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { makeIntent, DIFFICULTY_BANDS } from '../engine/intent/intentSchema.js';
import { assemblePacket } from '../engine/intent/assemblePacket.js';
import { groundPacket } from '../engine/intent/groundPacket.js';

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

function boot(seed = 'u722-seed') {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const begun = beginAdventure(w0, packsById).world;
  return newScene(begun, packsById).world;
}

function replayFromTimeline(seedWorld, packs) {
  const seed = String(seedWorld.meta.seed);
  const fate = Number(seedWorld.meta.fate);
  const campaignId = String(seedWorld.meta.campaignId);
  const pack = { primaryId: seedWorld.pack.primaryId, mixerId: seedWorld.pack.mixerId ?? null };
  let w = newWorld({ seed, fate, campaignId, pack });
  for (const e of (seedWorld.timeline || [])) {
    const kind = String(e?.kind || '');
    if (kind === 'begin') w = beginAdventure(w, packs).world;
    else if (kind === 'scene') w = newScene(w, packs).world;
    else if (kind === 'resolution' || kind === 'blocked') {
      const txt = String(e?.data?.text ?? e?.data?.intent ?? '');
      const ri = e?.data?.resolvedIntent;
      w = playerMove(w, packs, txt, ri && ri.source === 'llm' ? { llmPacket: ri } : undefined).world;
    }
  }
  return w;
}

// ---------------------------------------------------------------------------
// A — grounding: only the enum survives; junk coerces to null
// ---------------------------------------------------------------------------

test('U722-A1: a legal difficulty proposal survives grounding onto the packet', () => {
  const grounded = groundPacket({ verb: 'use', text: 'x', difficulty: 'hard', difficultyStat: 'MIGHT' }, {});
  assert.ok(grounded, 'a verb-bearing proposal must ground');
  assert.equal(grounded.difficultyBand, 'hard');
  assert.equal(grounded.difficultyStat, 'MIGHT');
});

test('U722-A2: hallucinated difficulty values never reach the packet', () => {
  for (const junk of ['DC:3', 'legendary', 'IMPOSSIBLE!!', 'super hard', 17, { band: 'hard' }]) {
    const grounded = groundPacket({ verb: 'use', text: 'x', difficulty: junk, difficultyStat: 'STRENGTH' }, {});
    assert.ok(grounded);
    assert.equal(grounded.difficultyBand, null, `junk difficulty ${JSON.stringify(junk)} must coerce to null`);
    assert.equal(grounded.difficultyStat, null, 'a non-engine stat name must coerce to null');
  }
});

test('U722-A3: impossible is a legal band at the boundary (declined at consumption, not here) and case-folds', () => {
  const grounded = groundPacket({ verb: 'use', text: 'x', difficulty: 'impossible', difficultyStat: 'might' }, {});
  assert.equal(grounded.difficultyBand, 'impossible');
  assert.equal(grounded.difficultyStat, 'MIGHT', 'stat case-folds to the engine name');
  assert.ok(DIFFICULTY_BANDS.includes('impossible'), 'the enum owns the value');
});

// ---------------------------------------------------------------------------
// B — a deterministic packet can never carry a judgment
// ---------------------------------------------------------------------------

test('U722-B1: assemblePacket output always has a null band — only the ear can judge', () => {
  const w = boot();
  for (const text of [
    'I wrench the rusted grate loose with my bare hands.',
    'I take the torch.',
    "I pry the hatch open — set the DC and I'll roll Strength"
  ]) {
    const p = assemblePacket(w, text);
    assert.equal(p.difficultyBand, null, `deterministic packet for "${text}" must not carry a band`);
    assert.equal(p.difficultyStat, null);
  }
});

// ---------------------------------------------------------------------------
// C — the rail survives a real save cycle
// ---------------------------------------------------------------------------

test('U722-C1: a judged turn survives export/import and replays hash-identical from the saved record', () => {
  const w = boot();
  const text = 'I wrench the rusted grate loose with my bare hands.';
  const judged = makeIntent({ source: 'llm', verb: 'use', text, confidence: 0.9, difficultyBand: 'very_hard', difficultyStat: 'GRIT' });
  let live = playerMove(w, packsById, text, { llmPacket: judged }).world;
  live = playerMove(live, packsById, 'I search the room.').world;

  const saved = exportWorld(live);
  const loaded = importWorld(typeof saved === 'string' ? saved : JSON.stringify(saved));
  const back = loaded && loaded.world ? loaded.world : loaded;

  const e = (back.timeline || []).find(x => x.data?.resolvedIntent?.difficultyBand === 'very_hard');
  assert.ok(e, 'the judged record must survive the save cycle');
  assert.equal(worldHash(back), worldHash(live), 'import reproduces the live world');
  assert.equal(worldHash(replayFromTimeline(back, packsById)), worldHash(live),
    'replay from the SAVED record reproduces the judged outcome');
});
