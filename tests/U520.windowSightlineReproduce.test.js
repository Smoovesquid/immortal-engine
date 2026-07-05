// U520 — MR-2d REPRODUCTION: windows are apertures — sight passes through the glass
// they actually face, and the people seen through them come with their STORY REASON.
// (docs/briefs/MR-2-FUNCTIONAL-INK.md §2d; docs/MAP_REAL.md promise 1 "Windows are
// true apertures".)
//
// The dead-ink symptom this file pins, written FIRST (must FAIL before the fix):
// look-around inside a windowed room dumped EVERY outdoor occupant through the glass,
// regardless of which way the window faces — the room's west+north windows "saw"
// people standing on the south and east sides, sight passing through walls. And the
// folk seen carried no reason (the OCC-STORY-1 anchors, v0.29.5, never reached the
// window view). After MR-2d a window shows only the outdoor occupants within its
// FACING ARC, each named WITH the reason they're out there ("through the window …
// Elske Nightherd, up to something").
//
// Ground truth (seed tallow, verified live): the wake cottage's entry room (:1) has
// unshuttered windows facing WEST + NORTH. Of the outdoor folk, exactly one —
// Elske Nightherd — is on the NORTH side; Dalla (south) and Asha (east) are on sides
// this room's windows do NOT face. The REAL seeded folk are used (not fixtures), per
// the brief's positive-case rule. Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { visibleThroughWindows, outdoorOccupants } from '../engine/structures/roomOccupancy.js';
import { roomWindowFacings } from '../engine/structures/roomWindows.js';
import { buildLocationSurvey } from '../engine/grace/gracefulAdjudication.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// Put the player in a SPECIFIC room of the wake cottage (the entry room, which is the
// one with unshuttered exterior-facing windows).
function inRoom(w, roomId) {
  return { ...w, scene: { ...w.scene, interior: { ...w.scene.interior, roomId } } };
}
// The unshuttered, windowed entry room of the wake cottage (verified: 2 windows, W+N).
function windowedEntryRoom(w) {
  const sk = w.scene.interior.structureKey;
  const ids = [
    'room:stgen:v27:n3_1515674724:0:1',
    'room:stgen:v27:n3_1515674724:0:2',
    'room:stgen:v27:n3_1515674724:0:3',
  ];
  // Find the room whose windows face somewhere AND currently sees at least one outdoor
  // person through them — robust to seed detail, but for tallow this is room :1.
  for (const rid of ids) {
    const facings = roomWindowFacings(w, { structureKey: sk, roomId: rid });
    if (facings.length && visibleThroughWindows(w, sk, rid).length) return rid;
  }
  return null;
}

test('U520: a window shows the outdoor person within its FACING ARC — with their story reason', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const rid = windowedEntryRoom(w);
  assert.ok(rid, 'precondition: the wake cottage has an unshuttered windowed room that sees outdoor folk');

  const seen = visibleThroughWindows(w, sk, rid);
  assert.ok(seen.length >= 1, 'at least one outdoor person is within the window arc');

  // Every returned occupant carries the additive OCC-STORY reason (narration fuel).
  for (const occ of seen) {
    assert.ok(typeof occ.reason === 'string' && occ.reason.length > 0,
      `a window-visible occupant must carry a story reason, got ${JSON.stringify(occ)}`);
    // ...and a per-window direction label (which side the glass looks onto).
    assert.ok(typeof occ.side === 'string' && occ.side.length > 0,
      `a window-visible occupant must carry a side label, got ${JSON.stringify(occ)}`);
  }
});

test('U520: sight does NOT pass through a wall — an outdoor person OFF the window arc is not seen', () => {
  // The reproduction heart: the old code dumped EVERY outdoor occupant through any
  // window. Here the room's windows face W+N; an outdoor person on the S/E side must
  // NOT appear. We assert the visible set is a STRICT SUBSET of all outdoor folk (the
  // arc genuinely filters) and that at least one outdoor person is correctly excluded.
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const rid = windowedEntryRoom(w);
  assert.ok(rid, 'precondition');

  const allOutdoor = outdoorOccupants(w).filter(n => n && !n.hostile).map(n => String(n.name));
  const seenNames = visibleThroughWindows(w, sk, rid).map(n => String(n.name));

  assert.ok(allOutdoor.length > seenNames.length,
    `the window arc must EXCLUDE at least one outdoor person (sight not through walls); ` +
    `all=${JSON.stringify(allOutdoor)} seen=${JSON.stringify(seenNames)}`);
  for (const nm of seenNames) {
    assert.ok(allOutdoor.includes(nm), `a window-seen person must be an actual outdoor occupant: ${nm}`);
  }
});

test('U520: the look-around survey renders the window view honestly — the in-arc name + reason, NOT the off-arc folk', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const rid = windowedEntryRoom(w);
  assert.ok(rid, 'precondition');

  const seen = visibleThroughWindows(w, sk, rid);
  const inArc = new Set(seen.map(n => String(n.name)));
  const allOutdoor = outdoorOccupants(w).filter(n => n && !n.hostile).map(n => String(n.name));
  const offArc = allOutdoor.filter(nm => !inArc.has(nm));
  assert.ok(offArc.length >= 1, 'precondition: at least one outdoor person is off the arc');

  const survey = buildLocationSurvey(inRoom(w, rid));

  // The in-arc person is named through the window...
  for (const nm of inArc) {
    assert.ok(survey.includes(nm), `the in-arc person ${nm} must appear in the look-around: ${survey}`);
  }
  // ...and the survey keeps the load-bearing "through the window" phrasing (the same
  // line-of-sight phrase CG-1b's carve-out recognizes).
  assert.match(survey, /through the (?:window|shutter|glass)/i, survey);

  // The OFF-arc folk must NOT be narrated as seen through this room's glass. (This is
  // the assertion the old dump fails: it listed every outdoor occupant.)
  for (const nm of offArc) {
    assert.ok(!survey.includes(nm),
      `an off-arc outdoor person (${nm}) must NOT be seen through a window that doesn't face them: ${survey}`);
  }
});
