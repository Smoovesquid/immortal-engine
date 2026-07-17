// U720 — RULING-DC-1 Stage A: the ruling rail.
//
// Every typed turn persists a compact, versioned projection of its grounded
// intent packet on the turn-initiating resolution/blocked event
// (data.resolvedIntent), and the replay drivers consume the RECORD instead of
// re-parsing raw text — so an LLM-translated turn replays hash-identical with
// zero model calls. worldHash covers the timeline (worldHash.js includes
// w.timeline), so these annotations are canon, not decoration.
//
// Section B2 is the packet's definition-of-done proof (written red-first for
// the WHOLE RULING-DC-1 packet): a deliberately divergent difficultyBand the
// deterministic parser would never pick changes the live outcome, and only
// replay-from-record reproduces it. It stays red until Stage B wires the band.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, newScene, playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { makeIntent, persistableIntent } from '../engine/intent/intentSchema.js';

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

function boot(seed = 'u720-seed') {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const begun = beginAdventure(w0, packsById).world;
  return newScene(begun, packsById).world;
}

// The upgraded replay driver shape: same as U19's, but a recorded llm packet
// rides back in through playerMove's existing {llmPacket} seam.
function replayFromTimeline(seedWorld, packs) {
  const seed = String(seedWorld.meta.seed);
  const fate = Number(seedWorld.meta.fate);
  const campaignId = String(seedWorld.meta.campaignId);
  const pack = { primaryId: seedWorld.pack.primaryId, mixerId: seedWorld.pack.mixerId ?? null };

  let w = newWorld({ seed, fate, campaignId, pack });
  for (const e of (seedWorld.timeline || [])) {
    const kind = String(e?.kind || '');
    if (kind === 'begin') {
      w = beginAdventure(w, packs).world;
    } else if (kind === 'scene') {
      w = newScene(w, packs).world;
    } else if (kind === 'resolution' || kind === 'blocked') {
      const txt = String(e?.data?.text ?? e?.data?.intent ?? '');
      const ri = e?.data?.resolvedIntent;
      const opts = ri && ri.source === 'llm' ? { llmPacket: ri } : undefined;
      w = playerMove(w, packs, txt, opts).world;
    }
  }
  return w;
}

// Remove every resolvedIntent record so two worlds can be compared on
// OUTCOME canon alone — the record itself is hash-covered, so comparing
// unstripped worlds would let metadata divergence masquerade as authority.
function stripRecords(world) {
  return {
    ...world,
    timeline: world.timeline.map(e => {
      if (!e.data?.resolvedIntent) return e;
      const { resolvedIntent, ...rest } = e.data;
      return { ...e, data: rest };
    })
  };
}

const RESOLVED_INTENT_KEYS = [
  'v', 'source', 'verb', 'kind', 'approach', 'stat', 'stake',
  'confidence', 'target', 'difficultyBand', 'difficultyStat'
].sort();

function firstNewTurnEvent(before, after) {
  const pre = before.timeline.length;
  return after.timeline.slice(pre).find(e => e.kind === 'resolution' || e.kind === 'blocked') || null;
}

// ---------------------------------------------------------------------------
// A — every typed turn persists a uniform resolvedIntent record
// ---------------------------------------------------------------------------

test('U720-A1: a deterministic action turn records its packet on the turn-initiating resolution event', () => {
  const w = boot();
  const r = playerMove(w, packsById, 'I take the torch.');
  const e = firstNewTurnEvent(w, r.world);
  assert.ok(e, 'the action turn must mint a resolution/blocked event');
  const ri = e.data?.resolvedIntent;
  assert.ok(ri && typeof ri === 'object', 'resolution event must carry data.resolvedIntent');
  assert.deepEqual(Object.keys(ri).sort(), RESOLVED_INTENT_KEYS, 'record shape is uniform and versioned');
  assert.equal(ri.v, 1);
  assert.equal(ri.source, 'text');
  assert.equal(typeof ri.verb, 'string');
  assert.equal(ri.difficultyBand, null, 'no judge ran — band is null, not absent');
  assert.equal(ri.difficultyStat, null);
});

test('U720-A2: boot events carry no resolvedIntent; only turn events do', () => {
  const w = boot();
  for (const e of w.timeline) {
    assert.equal(e.data?.resolvedIntent, undefined, `${e.kind} event must not carry resolvedIntent`);
  }
});

test('U720-A3: only the FIRST turn event of a turn is annotated (turn-initiating marker)', () => {
  const w = boot();
  const r = playerMove(w, packsById, 'I take the torch.');
  const news = r.world.timeline.slice(w.timeline.length).filter(e => (e.kind === 'resolution' || e.kind === 'blocked') && e.data?.resolvedIntent);
  assert.equal(news.length, 1, 'exactly one annotated turn-initiating event per turn');
});

// ---------------------------------------------------------------------------
// B — an LLM packet is persisted verbatim (grounded projection), and the
//     record round-trips through persistableIntent unchanged (idempotence:
//     what replay feeds back re-persists byte-identically)
// ---------------------------------------------------------------------------

test('U720-B1: an llm packet on a canon-writing turn is recorded with source llm and survives round-trip', () => {
  const w = boot();
  const pkt = makeIntent({ source: 'llm', verb: 'use', target: 'tower wall', text: 'Can I climb the tower wall?', confidence: 0.9 });
  const r = playerMove(w, packsById, 'Can I climb the tower wall?', { llmPacket: pkt });
  const e = firstNewTurnEvent(w, r.world);
  assert.ok(e, 'llm-translated action turn must still mint its turn event');
  const ri = e.data?.resolvedIntent;
  assert.ok(ri, 'llm turn must record resolvedIntent');
  assert.equal(ri.source, 'llm');
  assert.equal(ri.verb, 'use');
  assert.deepEqual(persistableIntent(ri), ri, 'record is a fixed point of persistableIntent (replay re-persists identically)');
});

test('U720-B2 [DoD — red until Stage B]: a divergent difficultyBand changes the live outcome and only replay-from-record reproduces it', () => {
  const w = boot();
  const text = 'I wrench the rusted grate loose with my bare hands.';
  // A band the deterministic parser would never pick: the judge calls it
  // trivial. Stage B maps trivial → DC 5 where no authored hardness exists;
  // the formula DC for this world is higher, so outcomes diverge.
  const judged = makeIntent({ source: 'llm', verb: 'use', target: 'rusted grate', text, confidence: 0.9 });
  judged.difficultyBand = 'trivial';
  const live = playerMove(w, packsById, text, { llmPacket: judged }).world;
  const plain = playerMove(w, packsById, text).world;
  // Compare with records STRIPPED: only a real outcome change can pass this —
  // the record itself diverging the hash must not count as authority.
  assert.notEqual(worldHash(stripRecords(live)), worldHash(stripRecords(plain)),
    'the judged band must change written canon beyond the record itself (Stage B authority)');
  // The rail: replay from the record reproduces the judged world exactly,
  // with zero model calls.
  assert.equal(worldHash(replayFromTimeline(live, packsById)), worldHash(live),
    'replay-from-record reproduces the judged outcome hash-identically');
  // And raw-text replay of a record-stripped save does NOT reproduce the
  // judged OUTCOME — this is the hole the rail closes.
  const rawReplay = replayFromTimeline(stripRecords(live), packsById);
  assert.notEqual(worldHash(stripRecords(rawReplay)), worldHash(stripRecords(live)),
    'raw-text replay cannot reproduce a judged outcome (guards against a vacuous fixture)');
});

// ---------------------------------------------------------------------------
// C — replay consumes the record across a mixed live sequence
// ---------------------------------------------------------------------------

test('U720-C1: a mixed live game (deterministic + llm turns) replays hash-identical from its records', () => {
  const w = boot();
  let live = playerMove(w, packsById, 'I take the torch.').world;
  const pkt = makeIntent({ source: 'llm', verb: 'use', target: 'tower wall', text: 'Can I climb the tower wall?', confidence: 0.9 });
  live = playerMove(live, packsById, 'Can I climb the tower wall?', { llmPacket: pkt }).world;
  // An llm question-kind flip that writes nothing: structurally replay-safe
  // (no event, nothing to replay) — documented here on purpose.
  const flip = makeIntent({ source: 'llm', verb: 'ask', kind: 'rules', text: 'Who is watching me right now?', confidence: 0.9 });
  const preFlipLen = live.timeline.length;
  live = playerMove(live, packsById, 'Who is watching me right now?', { llmPacket: flip }).world;
  assert.equal(live.timeline.length, preFlipLen, 'fixture expects the rules-kind flip to write nothing');
  live = playerMove(live, packsById, 'I search the room.').world;

  const replayed = replayFromTimeline(live, packsById);
  assert.equal(worldHash(replayed), worldHash(live), 'mixed sequence replays hash-identical from records');
});

// ---------------------------------------------------------------------------
// D — old saves (no resolvedIntent) keep replaying by raw text
// ---------------------------------------------------------------------------

test('U720-D1: events without resolvedIntent replay by raw text without error (old-save compatibility)', () => {
  const w = boot();
  let live = playerMove(w, packsById, 'I take the torch.').world;
  live = playerMove(live, packsById, 'I search the room.').world;
  const stripped = stripRecords(live);
  // Pre-rail worlds have no records; the driver must fall back to text.
  const replayed = replayFromTimeline(stripped, packsById);
  assert.ok(replayed && typeof replayed === 'object');
  // Deterministic-only sequences are text-replayable by definition — but the
  // REPLAYED world re-records packets, so strip the replayed side too before
  // comparing against the pre-rail save.
  assert.equal(worldHash(stripRecords(replayed)), worldHash(stripped),
    'old-save text replay still converges for deterministic sequences');
});
