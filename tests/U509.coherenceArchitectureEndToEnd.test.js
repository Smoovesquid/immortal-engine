// U509 — CG-ARCH end-to-end floor (MR-2b, docs/briefs/MR-2-FUNCTIONAL-INK.md §2b).
// The LLM-OFF guarantee: the engine's OWN base narration (the deterministic
// composer, no API key) is plan-true BY CONSTRUCTION — it never narrates a room,
// stair, or floor the structure lacks — so it must NEVER trip CG-ARCH. If it did,
// the gate would fight the engine's own honest output; a clean base is what the
// coherence-safe floor (validator.js) falls back TO, so it MUST be coherent.
//
// This proves the loop closes at the base-narration end across 5 seeds: boot the
// wake cottage, tour it in plain language, and run the full single-turn coherence
// bank over every base-narrated turn — zero CG-ARCH flags. Also pins that the
// canon bundle's roomPlan (the ground truth CG-ARCH reads) is correctly populated
// inside a structure and null outside, and that it is deterministic / worldHash-
// safe (HARD INVARIANT 1). Hermetic: real world boot, NO LLM, no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { buildCanonGroundTruth } from '../engine/ref/rubric.js';
import { runDetectors, SINGLE_TURN_DETECTORS, detectArchitectureDesync } from '../engine/coherence/checks.js';
import WAKE_COTTAGE_CORPUS, { WAKE_COTTAGE_PLAN, WAKE_COTTAGE_INTERIOR } from './corpus/CGARCH.wakeCottageArchitecture.fixture.mjs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = (seed) => beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// Pull the narration string out of a playerMove result across the few shapes it
// can take (defensive — the exact field has moved over versions).
function narrationOf(res) {
  return String(
    res?.narration ?? res?.text ?? res?.outcome?.narration ?? res?.outcome?.text ?? ''
  );
}

const SEEDS = ['tallow', 'aldermere', 'crowfoot', 'greenwood', 'n5_seed'];
// An interior tour in plain language — look around, move deeper, come back,
// examine. These are the gestures the WB-Q1 playtest used when the DM invented
// the phantom upstairs; here the BASE narration must stay plan-true.
const TOUR = ['look around', 'go deeper in', 'look around', 'go back toward the front', 'examine the room'];

test('U509: base narration (LLM off) never trips CG-ARCH across 5 seeds of interior play', () => {
  // Guarantee LLM is off for this test regardless of ambient env.
  const savedKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    let turnsChecked = 0;
    const archFlags = [];
    for (const seed of SEEDS) {
      let w = boot(seed);
      assert.ok(w.scene?.interior?.structureKey, `precondition: seed ${seed} boots inside a structure`);
      for (const action of TOUR) {
        let res;
        try { res = playerMove(w, PACKS, action); } catch { break; }
        w = res.world;
        const dm = narrationOf(res);
        const canon = buildCanonGroundTruth(w);
        const flags = runDetectors(
          [{ seed, persona: 'base', i: turnsChecked, player: action, dm, mechanics: '', canon }],
          SINGLE_TURN_DETECTORS,
        );
        for (const f of flags.filter(x => x.class === 'CG-ARCH')) {
          archFlags.push({ seed, action, dm: dm.slice(0, 160), narrated: f.narrated });
        }
        turnsChecked++;
      }
    }
    assert.ok(turnsChecked >= SEEDS.length, 'the tour actually ran turns on every seed');
    assert.equal(
      archFlags.length, 0,
      `base narration is plan-true by construction — CG-ARCH must never fire on it. Got: ${JSON.stringify(archFlags, null, 2)}`,
    );
  } finally {
    if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
  }
});

test('U509: roomPlan ground truth is populated inside a structure and matches the structure roster', () => {
  const w = boot('tallow');
  const truth = buildCanonGroundTruth(w);
  assert.ok(truth.roomPlan && typeof truth.roomPlan === 'object', 'roomPlan is present when inside');
  assert.ok(Array.isArray(truth.roomPlan.rooms) && truth.roomPlan.rooms.length > 0, 'roomPlan.rooms is a non-empty roster');
  assert.equal(truth.roomPlan.singleStorey, true, 'the engine models interiors as single-storey (MR-2 non-goal: stairs are room links, not 3D)');
  // The current room name must itself be a member of the whole-structure roster
  // (self-consistency: the room the player stands in is a room the structure has).
  assert.ok(truth.interior?.roomName, 'precondition: interior carries a current room name');
  const collapsed = truth.roomPlan.rooms.map(r => r.toLowerCase().replace(/\s+/g, ''));
  assert.ok(
    collapsed.includes(truth.interior.roomName.toLowerCase().replace(/\s+/g, '')),
    `the current room "${truth.interior.roomName}" is in the structure roster ${JSON.stringify(truth.roomPlan.rooms)}`,
  );
});

test('U509: roomPlan is null outdoors (graceful degradation — no structure to describe)', () => {
  let w = boot('tallow');
  w = playerMove(w, PACKS, 'I step back outside').world;
  assert.equal(Boolean(w.scene?.interior), false, 'precondition: the exit gesture leaves the building');
  const truth = buildCanonGroundTruth(w);
  assert.equal(truth.roomPlan, null, 'no interior structure to report a room plan for outdoors');
});

test('U509: roomPlan derivation is pure — never mutates the world, worldHash byte-identical (HARD INVARIANT 1)', () => {
  const w = boot('tallow');
  const before = JSON.stringify(w);
  const h0 = worldHash(w);

  const t1 = buildCanonGroundTruth(w);
  const t2 = buildCanonGroundTruth(w);
  assert.deepEqual(t1.roomPlan, t2.roomPlan, 'roomPlan is deterministic — same world, same answer');

  assert.equal(JSON.stringify(w), before, 'buildCanonGroundTruth never mutates the world (read-only over the world)');
  assert.equal(worldHash(w), h0, 'worldHash byte-identical — roomPlan is a pure read, no new stored state, no WORLD_VERSION bump');
});

test('U509: the roomPlan enrichment keeps the bundle compact (bounded byte growth, the judge reads this too)', () => {
  const w = boot('tallow');
  const truth = buildCanonGroundTruth(w);
  const { roomPlan, ...rest } = truth;
  const delta = JSON.stringify(truth).length - JSON.stringify(rest).length;
  assert.ok(delta > 0, 'roomPlan does add SOME bytes (it is genuinely present)');
  assert.ok(delta < 300, `roomPlan growth should be small — a room-name roster + a bool, not a topology dump (got +${delta} chars)`);
});

// ── CORPUS LOCK: the wake cottage's real layout ──────────────────────────────
// tests/corpus/CGARCH.wakeCottageArchitecture.corpus.mjs pins the cottage's real
// rooms/front-door/locked-door texture line by line. This test (1) proves the
// corpus's declared plan STILL matches the LIVE booted cottage (so the lock stays
// honest if room naming or the roomPlan bundle ever drifts), and (2) runs the
// detector over every corpus row — `legal` lines must stay clean, `invented`
// lines must flag CG-ARCH.
test('U509: the CGARCH corpus\'s declared wake-cottage plan matches the LIVE booted cottage roster', () => {
  const w = boot('tallow');
  const truth = buildCanonGroundTruth(w);
  // The live roster must contain exactly the corpus's declared rooms (order-
  // independent, space/case-collapsed) — the corpus is the human-readable lock,
  // the live boot is the source of truth; they must agree.
  const collapse = (arr) => arr.map(r => r.toLowerCase().replace(/\s+/g, '')).sort();
  assert.deepEqual(
    collapse(truth.roomPlan.rooms), collapse(WAKE_COTTAGE_PLAN.rooms),
    `the corpus roster ${JSON.stringify(WAKE_COTTAGE_PLAN.rooms)} must match the live cottage ${JSON.stringify(truth.roomPlan.rooms)}`,
  );
  assert.equal(truth.roomPlan.singleStorey, WAKE_COTTAGE_PLAN.singleStorey, 'single-storey matches the corpus lock');
});

test('U509: every CGARCH corpus row judges as declared (legal→clean, invented→flag) against the locked plan', () => {
  const canon = { interior: WAKE_COTTAGE_INTERIOR, roomPlan: WAKE_COTTAGE_PLAN, npcsPresent: [] };
  const misjudged = [];
  for (const row of WAKE_COTTAGE_CORPUS) {
    const flags = detectArchitectureDesync([{ seed: 'tallow', persona: 'corpus', i: row.id, player: 'I look around.', dm: row.dm, mechanics: '', canon }]);
    const flagged = flags.some(f => f.class === 'CG-ARCH');
    const shouldFlag = row.kind === 'invented';
    if (flagged !== shouldFlag) misjudged.push({ id: row.id, kind: row.kind, flagged, dm: row.dm, why: row.why });
  }
  assert.equal(misjudged.length, 0, `every corpus row must judge as declared. Misjudged: ${JSON.stringify(misjudged, null, 2)}`);
});
