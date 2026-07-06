// U592 — NPC-DEED-1: THE DETERMINISM WALL (docs/MORAL_PHYSICS.md §1-I; IMMORTAL_INVARIANTS).
//
// NPC-committed deeds are real consequence, so they obey the spine (mirrors U585/U572/U565):
//   (I)   THE CARL GRIND replays byte-identical — worldHash equality across two independent runs of
//         the same N-tick grind, and across a serialize/deserialize roundtrip.
//   (II)  NO-CARL INVARIANCE — a seed with no Carl is UNCHANGED by this packet: zero NPC deeds, zero
//         NPC morality stamped, and byte-identical run-to-run. (This is the "nothing else moves"
//         guarantee: the additive NPC-morality field appears ONLY when a deed touches an NPC.)
//   (III) OLD-SAVE SAFETY — a save whose NPCs carry no `morality` (pre-NPC-DEED-1) normalizes to a
//         legal world (absence stays absence) and replays hash-stable; and a save with a legacy
//         NPC morality object normalizes to the lite shape.
//
// The default-boot anchor (U454-E) is NOT re-derived here — it is owned by U454-E alone, and this
// packet does not move it (Carl is absent from the tallow default's start node, and NPC morality is
// lazy → the tallow boot is byte-identical; verified separately). Duplicating that literal here would
// repeat the exact canary this repo has tripped four times. This file asserts what THIS packet owns:
// the replay-equality of the Carl grind and the invariance of a no-Carl world.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld, ensureWorld, ensureNpcMorality } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldTick } from '../engine/worldTick.js';
import { worldHash } from '../engine/worldHash.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path.replace(/^\//, '')), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const CARL = 'figure_carl';

function boot(seed) {
  return beginAdventure(newWorld({
    seed, fate: 0.3, campaignId: `u592-${seed}`, mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
}
// A full Carl grind under a fixed seed — deterministic input.
function carlGrind(seed, n = 40) {
  let w = boot(seed); // seed 'aldermere' places Carl
  for (let i = 0; i < n; i++) w = worldTick(w, `${seed}|grind|${i}`);
  return w;
}
function carlNpc(w) {
  for (const n of (w.map?.nodes || [])) {
    const c = (n.settlement?.npcs || []).find(x => x && String(x.id) === CARL);
    if (c) return c;
  }
  return null;
}
function anyNpcHasMorality(w) {
  return (w.map?.nodes || []).some(n => (n.settlement?.npcs || []).some(x => x && x.morality));
}

test('U592-01: THE CARL GRIND replays byte-identical (worldHash equality across two independent runs)', () => {
  const a = carlGrind('aldermere');
  const b = carlGrind('aldermere');
  assert.equal(worldHash(a), worldHash(b), 'two identical Carl grinds → identical worldHash');
  // Confirm the run genuinely exercised the cadence (else the wall would be vacuous).
  const carlDeeds = (a.deeds || []).filter(d => String(d.actorId) === CARL);
  assert.ok(carlDeeds.length >= 3, 'the grind actually fired Carl\'s cadence several times');
  assert.ok(carlNpc(a)?.morality?.heat > 0, 'Carl accrued heat — the accumulator moved');
  assertWorldInvariants(a);
});

test('U592-02: THE CARL GRIND survives a serialize/deserialize roundtrip with the same hash', () => {
  const w = carlGrind('aldermere');
  const h0 = worldHash(w);
  const clone = JSON.parse(JSON.stringify(w));
  assert.equal(worldHash(clone), h0, 'hash stable across a roundtrip (Carl\'s morality-lite survives)');
  assertWorldInvariants(ensureWorld(clone));
});

test('U592-03: NO-CARL INVARIANCE — a seed with no Carl is unchanged (zero NPC deeds, zero NPC morality, deterministic)', () => {
  // A procedural seed with no authored Carl overlay at the start.
  function noCarlRun(seed) {
    let w = boot(seed);
    for (let i = 0; i < 40; i++) w = worldTick(w, `${seed}|nc|${i}`);
    return w;
  }
  const a = noCarlRun('u592-nocarl');
  const b = noCarlRun('u592-nocarl');
  assert.equal(worldHash(a), worldHash(b), 'a no-Carl run is deterministic run-to-run');
  assert.equal((a.deeds || []).filter(d => String(d.actorId) === CARL).length, 0, 'no Carl deeds on a seed without Carl');
  assert.equal(anyNpcHasMorality(a), false, 'NO NPC gained a morality field — the additive field is lazy (nothing else moved)');
  assertWorldInvariants(a);
});

test('U592-04: OLD-SAVE — NPCs with no morality field normalize to a legal, hash-stable world (absence stays absence)', () => {
  // Grind Carl, then STRIP every NPC morality to simulate a pre-NPC-DEED-1 save.
  const fresh = carlGrind('aldermere', 24);
  const raw = JSON.parse(JSON.stringify(fresh));
  let stripped = 0;
  for (const n of (raw.map?.nodes || [])) {
    for (const npc of (n.settlement?.npcs || [])) {
      if (npc && npc.morality) { delete npc.morality; stripped++; }
    }
  }
  assert.ok(stripped > 0, 'the fixture had at least one NPC morality to strip (Carl\'s)');

  const normalized = ensureWorld(raw);
  assertWorldInvariants(normalized); // legal after normalize — absence is legal, no field re-added
  assert.equal(anyNpcHasMorality(normalized), false, 'ensureWorld does NOT resurrect a stripped NPC morality (lazy field: absence stays absence)');
  assert.equal(worldHash(ensureWorld(normalized)), worldHash(normalized), 'normalize is idempotent → hash stable');
});

test('U592-05: OLD-SAVE — a legacy NPC morality object normalizes to the lite shape (extra keys dropped, bounds clamped)', () => {
  // ensureNpcMorality is the normalizer the world-scope mutator applies on first touch; assert it
  // reduces a fat/dirty legacy object to exactly { corruption, heat, lastDeedT, huntedT }, clamped.
  // (huntedT joined the lite shape in MP-6 — the NPC hunt latch, docs/MORAL_PHYSICS.md §7 Arc A — so
  //  the reckoning can reach an NPC evildoer once and not re-spawn every tick, mirroring the player.)
  const legacy = ensureNpcMorality({
    corruption: 999, heat: -5, lastDeedT: 3, huntedT: -2,
    axes: { pride: 50 }, patrons: { x: 1 }, locked: true, cassandraArmed: true // player-only cruft that must not survive
  });
  assert.deepEqual(Object.keys(legacy).sort(), ['corruption', 'heat', 'huntedT', 'lastDeedT'], 'lite shape carries exactly four keys');
  assert.equal(legacy.corruption, 100, 'corruption clamped to 0..100');
  assert.equal(legacy.heat, 0, 'heat floored at 0');
  assert.equal(legacy.lastDeedT, 3, 'lastDeedT preserved');
  assert.equal(legacy.huntedT, 0, 'huntedT floored at 0');
  assert.equal(legacy.axes, undefined, 'player-only axes dropped');
  assert.equal(legacy.cassandraArmed, undefined, 'player-only Cassandra latch dropped');
  // A legacy huntedT within bounds is preserved (a mid-grind save with a latched NPC survives).
  assert.equal(ensureNpcMorality({ corruption: 0, heat: 50, lastDeedT: 2, huntedT: 7 }).huntedT, 7, 'in-bounds huntedT preserved');
  // An absent/garbage input yields safe zeros.
  assert.deepEqual(ensureNpcMorality(null), { corruption: 0, heat: 0, lastDeedT: 0, huntedT: 0 }, 'null → safe defaults');
  assert.deepEqual(ensureNpcMorality('nope'), { corruption: 0, heat: 0, lastDeedT: 0, huntedT: 0 }, 'garbage → safe defaults');
});
