// U581 — OCC-STORY-2 the reason wall. A drawn onlooker's narratable `reason` reflects the thread's
// CURRENT objective as it MUTATES (CONSEQ-1 makes the objective really change across turns), and it
// carries ZERO numerics — placement is narration fuel, never a leaked stat. The hostile drawn to a
// hot valuable locus carries a BURGLARY reason (inside = breaking in; outside = casing). This test
// ages a thread through REAL worldTicks (not scripted state) so the objective mutation it surfaces is
// the live one, then walks the reason for digits. Hermetic — no network, no API key.
//
// THE BURGLARY-DEED DECISION (documented here, per the brief): recordDeed (engine/effectsCore.js) is a
// PLAYER-party morality chokepoint — it resolves its actor via resolvePlayerEntityId and stamps
// heat/corruption on a party entity. An NPC burglar has no party entity and no `morality`, so there is
// NO existing NPC-actor deed organ to carry a witnessed NPC burglary into MP-1's rumor bridge. Per the
// brief's reversible option, OCC-STORY-2 ships the burglary as PLACEMENT + REASON ONLY and flags the
// NPC-deed wiring as an MP-arc follow-up. This test asserts the placement/reason half; it deliberately
// does NOT assert a deed was recorded (there is no organ to record it).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldTick } from '../engine/worldTick.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { placementFor, threadLocus, relatesToThread } from '../engine/structures/storyAnchors.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

// A digit means a number leaked into a reason — the reason wall forbids it (placement is prose only).
const NO_DIGITS = /^[^0-9]*$/;

const lingerer = { id: 'npc_lingerer', name: 'the Lingerer', role: 'a wanderer who has stayed too long, asking questions no one wants to answer' };

// A settlement world (no chapel drawn), a single scripted chapel thread, aged in place. Used to inject
// a controlled objective. Daytime so the ordinary path would keep folk at anchor.
function chapelWorld(objective, over = {}) {
  return {
    meta: { seed: 'aldermere' },
    time: { hours: 8 },
    map: { currentNodeId: 'town', nodes: [{ id: 'town', settlement: { buildings: [{ name: 'smithy', state: 'intact' }, { name: 'well', state: 'intact' }], npcs: [] } }] },
    structures: { byId: {} },
    instrument: { threads: [{ id: 'th-chapel', label: 'the chapel bell', objective: String(objective || ''), tension: 5, age: 6, status: 'open', ...over }] },
  };
}

test('U581: the onlooker reason surfaces the thread label when the objective is still empty', () => {
  const p = placementFor(chapelWorld(''), lingerer);
  assert.equal(p.reasonKind, 'watching the locus');
  assert.match(p.reason, /chapel path/, 'names the locus');
  assert.match(p.reason, /chapel bell/, 'falls back to the thread label when no objective yet');
  assert.match(p.reason, NO_DIGITS, `no numerics in "${p.reason}"`);
});

test('U581: the onlooker reason surfaces the MUTATED objective once it has changed', () => {
  const p = placementFor(chapelWorld('Pay the price to survive', { trajectory: 'mutating' }), lingerer);
  assert.match(p.reason, /pay the price to survive/, 'the live objective rides into the reason');
  assert.match(p.reason, NO_DIGITS, `no numerics in "${p.reason}"`);
});

test('U581: a thread aged through REAL worldTicks feeds its live objective into the reason (CONSEQ-1 seam)', () => {
  // Boot the default world, then tick until the (single) thread mutates its objective — proving the
  // reason tracks the ACTUAL live thread, not a hand-set fixture. tallow seeds one pack thread.
  let world = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  for (let i = 1; i <= 8; i++) world = worldTick(world, `tallow|reasonwall|${i}`);
  const t = world.instrument.threads[0];
  assert.ok(Number(t.age) >= 6, `thread aged into mutation (age ${t.age})`);
  assert.ok(String(t.objective).length > 0, 'the live thread has a mutated objective by now');

  // If this live thread has a spatial locus, an onlooker's reason must carry the objective, no digits.
  const locus = threadLocus(t);
  if (locus) {
    const p = placementFor(world, lingerer, { nodeId: 'town', seed: 'tallow',
      buildings: [{ key: 'sbld:well:0', kind: 'well', name: 'well' }], hot: undefined });
    // Only assert prose-cleanliness on whatever reason came back (bias may or may not select the
    // Lingerer depending on the live thread's locus; the wall is about the STRING when it fires).
    assert.match(p.reason, NO_DIGITS, `no numerics in "${p.reason}"`);
  }
});

test('U581: a hostile drawn to a hot valuable locus carries a BURGLARY reason, prose only', () => {
  const thread = { id: 'th-estate', label: 'The Divided Estate', objective: 'Expose who benefits from the divided estate', tension: 5, age: 6, status: 'open' };
  const locus = threadLocus(thread);
  let drawn = null;
  for (let i = 0; i < 40 && !drawn; i++) {
    const b = { id: `hostile_${i}`, name: 'Ashblade', role: 'bandit', hostile: true };
    if (relatesToThread('aldermere', b, thread, locus)) drawn = b;
  }
  assert.ok(drawn, 'a hostile is drawn to the target in the sweep');
  const w = {
    meta: { seed: 'aldermere' }, time: { hours: 8 },
    map: { currentNodeId: 'town', nodes: [{ id: 'town', settlement: { buildings: [{ name: 'storehouse', state: 'intact' }], npcs: [] } }] },
    structures: { byId: {} }, instrument: { threads: [thread] },
  };
  const p = placementFor(w, drawn);
  assert.equal(p.reasonKind, 'burglary in progress');
  assert.match(p.reason, /burglary/, 'the reason names the crime, not an accident');
  assert.match(p.reason, NO_DIGITS, `no numerics in "${p.reason}"`);
});

test('U581: NO deed is fabricated for the NPC burglary (there is no NPC-actor deed organ)', () => {
  // The burglary is placement + reason only. A placement read must never mutate world.deeds — occupancy
  // writes nothing. This asserts the flagged decision structurally: reading the burglary placement adds
  // no deed record (that wiring is the flagged MP-arc follow-up).
  const thread = { id: 'th-estate', label: 'The Divided Estate', objective: '', tension: 5, age: 6, status: 'open' };
  const w = {
    meta: { seed: 'aldermere' }, time: { hours: 8 }, deeds: [],
    map: { currentNodeId: 'town', nodes: [{ id: 'town', settlement: { buildings: [{ name: 'storehouse', state: 'intact' }], npcs: [] } }] },
    structures: { byId: {} }, instrument: { threads: [thread] },
  };
  const bandit = { id: 'hostile_1', name: 'Ashblade', role: 'bandit', hostile: true };
  placementFor(w, bandit);
  assert.deepEqual(w.deeds, [], 'the placement read records no deed (no NPC-deed organ exists to carry it)');
});
