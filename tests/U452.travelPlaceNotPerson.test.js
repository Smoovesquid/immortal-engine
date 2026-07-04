// U452 — INT-4-TRAVEL: "go to <a known map PLACE>" starts the JOURNEY, and is NEVER
// bounced back as a person-disambiguation ("who do you actually mean?").
//
// The live sighting (2026-07-04-pm5, v0.28.15 boot): the player typed "go to The
// Greenwood" — The Greenwood is a neighboring map NODE on the aldermere slice — and
// the game answered "I haven't introduced anyone named The Greenwood, and there's no
// one by that name here. … who do you actually mean?". The referent-disambiguation
// sink treated a KNOWN PLACE as a PERSON. THE_DM_TEST: a DM hears "go to the
// Greenwood" and starts the journey.
//
// Root cause (found by tracing): the boot drops the player INSIDE the n0 cottage
// (scene.interior set). The "indoor→travel bridge" that steps the player outside and
// runs the journey only fired for a narrow verb whitelist (toward/head/make for/set
// off) — it OMITTED the most common travel phrasing "go to <place>" / "walk to
// <place>" / "travel to <place>". So an indoor "go to The Greenwood" fell PAST the
// (interior-guarded) travel resolver, down to the ungrounded-NPC-referent sink, which
// extracted the capitalized "Greenwood" as a person name and bounced. The fix grounds
// the destination against REAL map places FIRST: a direct neighbor (discovery-
// independent) or a known discovered node makes the bridge fire and the existing JR-1
// journey path carry it. Case/article variants ("The Greenwood"/"the greenwood"/
// "Greenwood") all resolve to the same journey.
//
// LLM-off floor: this is the deterministic parseIntent/travel-resolver path. Pure,
// deterministic, replay-stable (the journey legs run the real seeded encounter table,
// but the ROUTING decision — journey vs person-clarify — never varies). Asserted ×2.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadPacks() {
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(ROOT, 'packs', 'manifest.json'), 'utf-8')));
  const out = {};
  for (const p of manifest.packs) out[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(ROOT, p.path), 'utf-8')));
  return out;
}
const PACKS = loadPacks();

// The EXACT live boot: pre-rolled Bryn Holt into the Aldermere slice, dropped INSIDE
// the n0 cottage (scene.interior set) — the sighting's precondition (mirrors U403).
function bootAldermereIndoors() {
  const pc = buildPreRolledCharacter({ id: 'bryn' });
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const w1 = ensureWorld({ ...w0, party: [pc] });
  return beginAdventure(w1, PACKS).world;
}
// The second boot the brief pins (the tallow campaign sandbox; also starts indoors).
function bootTallow() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

// The person-disambiguation signature — the shape that must NEVER answer a place.
const PERSON_CLARIFY = /haven't introduced anyone|who do you actually mean|no one by that name/i;

// A neighboring node name for the current node (undiscovered is fine — the movement
// LAW lets you set off for a place you can see is adjacent).
function neighborName(world) {
  const cur = String(world.map.currentNodeId);
  const nbId = (world.map.edges || [])
    .map(e => (e.a === cur ? e.b : e.b === cur ? e.a : null))
    .find(Boolean);
  return (world.map.nodes || []).find(n => String(n.id) === String(nbId))?.name || '';
}

// Did this turn engage the TRAVEL/journey path? Either the node advanced (arrival),
// or the JR-1 premium opened a road encounter / ambush, or the mech line is a travel
// resolution. (A person-clarify does none of these.)
function engagedJourney(before, r) {
  const moved = String(r.world.map.currentNodeId) !== String(before);
  const journeyMech = /encounter:pending|ambush|journey-arrive|travel \||\[travel/i.test(String(r.output.mechanics || ''));
  return moved || journeyMech;
}

test('U452: the sighting, dead — indoor "go to The Greenwood" engages the journey, never a person-clarify', () => {
  const w = bootAldermereIndoors();
  assert.ok(w.scene?.interior, 'boot is indoors (the live sighting precondition)');
  const dest = neighborName(w);
  assert.equal(dest, 'The Greenwood', 'the neighboring node is The Greenwood (slice layout)');
  const before = String(w.map.currentNodeId);

  const r = playerMove(w, PACKS, 'go to The Greenwood');
  assert.ok(engagedJourney(before, r), `must engage the journey path: mech="${r.output.mechanics}" nar="${r.output.narration}"`);
  assert.doesNotMatch(r.output.narration, PERSON_CLARIFY, `must NOT bounce a known place as a person: ${r.output.narration}`);
});

test('U452: case/article variant — indoor "go to the greenwood" also engages the journey (not a person-clarify)', () => {
  const w = bootAldermereIndoors();
  const before = String(w.map.currentNodeId);
  const r = playerMove(w, PACKS, 'go to the greenwood');
  assert.ok(engagedJourney(before, r), `lowercase variant must engage the journey: mech="${r.output.mechanics}"`);
  assert.doesNotMatch(r.output.narration, PERSON_CLARIFY, `no person-clarify on the lowercase variant: ${r.output.narration}`);
});

test('U452: article-stripped — indoor "go to Greenwood" (no "the") still engages the journey', () => {
  const w = bootAldermereIndoors();
  const before = String(w.map.currentNodeId);
  const r = playerMove(w, PACKS, 'go to Greenwood');
  assert.ok(engagedJourney(before, r), `article-stripped variant must engage the journey: mech="${r.output.mechanics}"`);
  assert.doesNotMatch(r.output.narration, PERSON_CLARIFY, `no person-clarify on the article-stripped variant: ${r.output.narration}`);
});

test('U452: "walk to The Greenwood" and "travel to The Greenwood" also route to the journey', () => {
  for (const phrase of ['walk to The Greenwood', 'travel to The Greenwood']) {
    const w = bootAldermereIndoors();
    const before = String(w.map.currentNodeId);
    const r = playerMove(w, PACKS, phrase);
    assert.ok(engagedJourney(before, r), `[${phrase}] must engage the journey: mech="${r.output.mechanics}"`);
    assert.doesNotMatch(r.output.narration, PERSON_CLARIFY, `[${phrase}] no person-clarify: ${r.output.narration}`);
  }
});

test('U452: second boot (tallow) — indoor "go to <neighbor place>" engages the journey, never a person-clarify', () => {
  const w = bootTallow();
  const dest = neighborName(w);
  assert.ok(dest, 'tallow boot has a neighboring node to travel to');
  const before = String(w.map.currentNodeId);
  const r = playerMove(w, PACKS, `go to ${dest}`);
  assert.ok(engagedJourney(before, r), `[go to ${dest}] must engage the journey on tallow: mech="${r.output.mechanics}"`);
  assert.doesNotMatch(r.output.narration, PERSON_CLARIFY, `[go to ${dest}] no person-clarify on tallow: ${r.output.narration}`);
});

test('U452: deterministic ×2 — the routing decision (journey vs clarify) is replay-stable on both boots', () => {
  const trials = [
    { boot: bootAldermereIndoors, text: 'go to The Greenwood' },
    { boot: bootAldermereIndoors, text: 'go to Greenwood' },
  ];
  for (const { boot, text } of trials) {
    const runOnce = () => {
      const w = boot();
      const before = String(w.map.currentNodeId);
      const r = playerMove(w, PACKS, text);
      return { journey: engagedJourney(before, r), clarify: PERSON_CLARIFY.test(r.output.narration) };
    };
    const a = runOnce();
    const b = runOnce();
    assert.deepEqual(a, b, `routing for "${text}" must be identical across two runs`);
    assert.ok(a.journey && !a.clarify, `"${text}" routes to the journey, not a person-clarify`);
  }
});
