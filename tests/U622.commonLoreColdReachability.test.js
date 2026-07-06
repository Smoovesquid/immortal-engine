// U622 — PW-5 re-open: the bank must be reachable through the REAL player gesture
// (docs/PACKETS.md PW-5 bounce, 2026-07-06; the verify-real-input lesson).
//
// The first PW-5 build was engine-sound but DARK: from the default wake state (cold — no
// dialogue open), "tell me about Crowfoot Camp" never reached the dialogue path at all.
// The person-ask disambiguator (`ungroundedNpcReferentForText` → `npcReferentClarify`)
// extracted the capitalized place name as a PERSON referent — `isKnownPlaceNameFragment`
// only filtered single tokens of DISCOVERED node names, so a multi-word, not-yet-visited
// neighbour ("Crowfoot Camp") fell straight into "I haven't introduced anyone named…".
//
// The routing law this gate pins (coordinator ruling, 2026-07-06):
//   1. A KNOWN place name — any full node name on the map, the same set resolveCommonLore
//      serves — routes to the PLACE/LORE path BEFORE person disambiguation.
//   2. Ambiguity (an NPC and a place sharing a name): the PERSON wins when present;
//      otherwise the place.
//   3. A person-named ask stays person-routed (clarify for unknown, dialogue for known).
//
// Every probe here drives playerMove COLD from the default boot (LLM-off floor) — the
// exact utterances from the integration bounce, ×2 for determinism.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(
  newWorld({ seed: SLICE_SEED, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
  PACKS
).world;

const BOUNCE_RE = /haven't introduced anyone named|who do you actually mean|who do you mean/i;

test('U622-01: cold "tell me about Crowfoot Camp" answers the LORE, not the person-disambiguator', () => {
  const r = playerMove(boot(), PACKS, 'tell me about Crowfoot Camp');
  assert.ok(!BOUNCE_RE.test(r.output.narration), 'no "who do you mean?" bounce');
  assert.ok(!/clarify:referent|clarify:who/.test(r.output.mechanics), 'not routed to the person clarify');
  assert.match(r.output.mechanics, /place-lore → grounded/, 'routed to the grounded place-lore path');
  assert.ok(r.output.narration.includes('Crowfoot Camp'), 'names the place it recounts');
  assert.ok(!/\d/.test(r.output.narration), 'zero numerics in the surfaced lore');
});

test('U622-02: cold "what do you know about Crowfoot Camp" (the U133 phrasing) answers the lore too', () => {
  const r = playerMove(boot(), PACKS, 'what do you know about Crowfoot Camp');
  assert.ok(!BOUNCE_RE.test(r.output.narration), 'no bounce');
  assert.match(r.output.mechanics, /place-lore → grounded/, 'the lore path claims it');
  assert.ok(r.output.narration.includes('Crowfoot Camp'), 'names the place');
});

test('U622-03: cold "how was The Greenwood founded?" reaches the lore, not the explore floor', () => {
  const r = playerMove(boot(), PACKS, 'how was The Greenwood founded?');
  assert.ok(!BOUNCE_RE.test(r.output.narration), 'no bounce');
  assert.ok(!/eyes move slow/i.test(r.output.narration), 'not swallowed by the generic look-around');
  assert.match(r.output.mechanics, /place-lore → grounded/, 'the lore path claims it');
  assert.ok(r.output.narration.includes('The Greenwood'), 'names the place');
});

test('U622-04: determinism — the cold transcript is byte-identical across two fresh boots (×2)', () => {
  const lines = ['tell me about Crowfoot Camp', 'what do you know about Crowfoot Camp', 'how was The Greenwood founded?'];
  const run = () => {
    let w = boot();
    const narr = [];
    for (const t of lines) { const r = playerMove(w, PACKS, t); w = r.world; narr.push(String(r.output?.narration || '')); }
    return { hash: worldHash(w), narr: narr.join('\n') };
  };
  const a = run(); const b = run();
  assert.equal(a.hash, b.hash, 'worldHash byte-identical across two fresh runs');
  assert.equal(a.narr, b.narr, 'every surfaced answer byte-identical across two fresh runs');
});

test('U622-05: person-routing intact — an unknown PERSON still clarifies; a known person still opens dialogue', () => {
  // (3) A person-named ask stays person-routed. "ask <Name> …" carries the person
  // signal; the invented name is nobody here → the clarify must still fire.
  const rUnknown = playerMove(boot(), PACKS, 'ask Vexmorn about the weather');
  assert.ok(/clarify/.test(rUnknown.output.mechanics), 'unknown person-signalled name still clarifies');
  assert.ok(!/place-lore/.test(rUnknown.output.mechanics), 'the lore path never claims a person ask');
  // A real present person still opens dialogue exactly as before.
  const rKnown = playerMove(boot(), PACKS, 'talk to Carl');
  assert.match(rKnown.output.mechanics, /dialogue enter/, 'a known person still opens dialogue');
});

test('U622-06: ambiguity — an NPC sharing the place name and PRESENT wins over the place', () => {
  // Stage the collision: a (non-hostile) person literally named "Crowfoot Camp" standing
  // at the node. The routing law says the PERSON wins while present — the lore bank must
  // NOT claim the ask. (Absent the person — every other test here — the place wins.)
  let w = boot();
  const nodeId = w.map.currentNodeId;
  w = {
    ...w,
    map: {
      ...w.map,
      nodes: w.map.nodes.map(n => n.id !== nodeId ? n : ({
        ...n,
        settlement: {
          ...n.settlement,
          npcs: [...n.settlement.npcs, { id: 'npc_collision', name: 'Crowfoot Camp', role: 'wanderer', hostile: false }]
        }
      }))
    }
  };
  const r = playerMove(w, PACKS, 'tell me about Crowfoot Camp');
  assert.ok(!/place-lore/.test(r.output.mechanics), 'the person present wins — the bank does not claim the shared name');
});
