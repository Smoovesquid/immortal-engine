// U453 — INT-4-TRAVEL, the no-overreach guard: grounding a "go to <X>" against known
// map PLACES must not swallow the three neighbours of that behaviour —
//   (a) a genuine PERSON reference ("talk to Galen") still routes to DIALOGUE;
//   (b) a named INTERIOR-ROOM move ("go to the hearth room") still resolves on the
//       interior room graph and NEVER changes the node (NODE-DESYNC-1 regression);
//   (c) an UNKNOWN place ("go to Rivendell") gets the HONEST DM answer ("you know of
//       no such place hereabouts…") — never a person-clarify for something phrased as
//       a destination, and never a fabricated node change to nowhere.
//
// Pure, deterministic, LLM-off. Same boot as U452 / U403 (pre-rolled Bryn Holt into
// the Aldermere slice, dropped INSIDE the n0 cottage).

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

function bootAldermereIndoors() {
  const pc = buildPreRolledCharacter({ id: 'bryn' });
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const w1 = ensureWorld({ ...w0, party: [pc] });
  return beginAdventure(w1, PACKS).world;
}

const PERSON_CLARIFY = /haven't introduced anyone|who do you actually mean|no one by that name/i;

function structureNodeOf(world) {
  const it = world.scene?.interior;
  if (!it) return null;
  const st = world.structures?.byId?.[String(it.structureKey || '')];
  return st ? String(st.nodeId || '') : null;
}

test('U453: "talk to Galen" still routes to DIALOGUE — no travel, no person-clarify', () => {
  const w = bootAldermereIndoors();
  const before = String(w.map.currentNodeId);
  // Galen is a real NPC present at the boot node.
  const present = (w.map.nodes.find(n => String(n.id) === before)?.settlement?.npcs || []).map(n => n.name);
  assert.ok(present.includes('Galen'), `Galen is present at boot: ${present.join(', ')}`);

  const r = playerMove(w, PACKS, 'talk to Galen');
  assert.equal(String(r.world.map.currentNodeId), before, 'talking to a present NPC does not travel');
  assert.match(String(r.output.mechanics || ''), /dialogue|talk/i, `enters conversation: ${r.output.mechanics}`);
  assert.doesNotMatch(r.output.narration, PERSON_CLARIFY, `a real present NPC is never a person-clarify: ${r.output.narration}`);
});

test('U453: "go to the hearth room" still resolves on the INTERIOR room graph — node UNCHANGED (NODE-DESYNC-1)', () => {
  const w = bootAldermereIndoors();
  assert.ok(w.scene?.interior, 'indoors precondition');
  const before = String(w.map.currentNodeId);
  assert.equal(structureNodeOf(w), before, 'interior structure is at the current node');

  const r = playerMove(w, PACKS, 'go to the hearth room');
  // THE MOVEMENT LAW: an interior room move can never change the node.
  assert.equal(String(r.world.map.currentNodeId), before, `interior room move must NOT change the node (was ${before}, got ${r.world.map.currentNodeId})`);
  assert.ok(r.world.scene?.interior, 'still indoors after a room move');
  assert.equal(structureNodeOf(r.world), String(r.world.map.currentNodeId), 'no interior/node desync after the room move');
  // Resolved interior-side, not routed to the node-journey verb.
  assert.doesNotMatch(String(r.output.mechanics || ''), /journey|encounter|travel \|/i, `must not be node travel: ${r.output.mechanics}`);
  assert.doesNotMatch(r.output.narration, PERSON_CLARIFY, `an interior room is never a person-clarify: ${r.output.narration}`);
});

test('U453: unknown place "go to Rivendell" — honest non-travel answer, no person-clarify, no fabricated node change', () => {
  const w = bootAldermereIndoors();
  const before = String(w.map.currentNodeId);
  const r = playerMove(w, PACKS, 'go to Rivendell');

  // The honest DM answer, NEVER a person-disambiguation for something phrased as a place.
  assert.doesNotMatch(r.output.narration, PERSON_CLARIFY, `an unknown PLACE must not bounce as a person: ${r.output.narration}`);
  assert.match(r.output.narration, /no such place|no place|don'?t know|never heard/i, `an honest "no such place" answer: ${r.output.narration}`);
  // No fabricated travel to nowhere: the node does not change.
  assert.equal(String(r.world.map.currentNodeId), before, `unknown place must NOT fabricate a node change (was ${before}, got ${r.world.map.currentNodeId})`);
});

test('U453: deterministic ×2 — the no-overreach routing is replay-stable', () => {
  const cases = [
    { text: 'talk to Galen', want: (before, r) => String(r.world.map.currentNodeId) === before && /dialogue|talk/i.test(String(r.output.mechanics || '')) },
    { text: 'go to the hearth room', want: (before, r) => String(r.world.map.currentNodeId) === before && !!r.world.scene?.interior },
    { text: 'go to Rivendell', want: (before, r) => String(r.world.map.currentNodeId) === before && !PERSON_CLARIFY.test(r.output.narration) },
  ];
  for (const { text, want } of cases) {
    const runOnce = () => {
      const w = bootAldermereIndoors();
      const before = String(w.map.currentNodeId);
      const r = playerMove(w, PACKS, text);
      return { ok: want(before, r), mech: String(r.output.mechanics || ''), clarify: PERSON_CLARIFY.test(r.output.narration) };
    };
    const a = runOnce();
    const b = runOnce();
    assert.deepEqual(a, b, `routing for "${text}" is identical across two runs`);
    assert.ok(a.ok && !a.clarify, `"${text}" routes correctly and never person-clarifies`);
  }
});
