// U678 — OBJ-PRESENCE-1: a wrecked-but-PRESENT object answers as wreckage,
// never as an intact object (the second bug the routing fix must not ship
// without — found independently while diagnosing this packet).
//
// The rulings-lane wreck (state:'damaged', parts:[]) stays IN node.furniture
// (unlike the salvage lane's full removal). Even the WORKING phrasing
// ("is there a barrel here?") currently says "Yes — there's a barrel here:
// battered apart" — true words, false impression. Both fixed call sites
// (the "still here" NPC-presence branch AND the "where's" object-location
// branch) must recognize isFurnitureDestroyed() and answer honestly.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function bootAuthoredWreckedBarrel() {
  let w = beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const nid = String(w.map.currentNodeId);
  const idx = (w.map.nodes.find(n => String(n.id) === nid).furniture || []).findIndex(f => f && f.authored === true && String(f.name) === 'barrel');
  return applyDeltas(w, [{ op: 'modifyFurniture', nodeId: nid, furnitureId: idx, changes: { state: 'damaged', parts: [], notes: 'battered apart' } }]);
}
function bootProcgenWreckedChest() {
  let w = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const nid = String(w.map.currentNodeId);
  const node = w.map.nodes.find(n => String(n.id) === nid);
  const idx = (node.furniture || []).findIndex(f => /chest/i.test(String(f?.name)));
  return applyDeltas(w, [{ op: 'modifyFurniture', nodeId: nid, furnitureId: idx, changes: { state: 'damaged', parts: [], notes: 'staved in' } }]);
}

const INTACT_CLAIM_RE = /Yes\s*—\s*there'?s\s+(?:a|an)\s+\w+\s+here(?!.*wreck)/i;

test('U678 (still-here site, authored): a wrecked barrel answers wrecked, not intact', () => {
  const w = bootAuthoredWreckedBarrel();
  const r = playerMove(w, PACKS, 'Is the barrel still here?');
  const narr = String(r.output?.narration || '');
  assert.doesNotMatch(narr, /^Wizard: Still here — (?:Senna|Jorin|Elske|Dalla)/i, 'not the NPC miss');
  assert.doesNotMatch(narr, INTACT_CLAIM_RE, 'not phrased as a plain intact object');
  assert.match(narr, /wreck|debris|battered|ruin|no longer|not (?:as it was|whole)/i,
    `must honestly convey the wrecked state — got: ${narr}`);
});

test('U678 (where\'s site, procgen): "where\'s the chest?" on a wreck answers wrecked, not intact', () => {
  const w = bootProcgenWreckedChest();
  const r = playerMove(w, PACKS, "Where's the chest?");
  const narr = String(r.output?.narration || '');
  assert.doesNotMatch(narr, /not carrying any chest/i, 'must not treat a real wrecked room object as an invented item');
  assert.doesNotMatch(narr, INTACT_CLAIM_RE);
  assert.match(narr, /wreck|debris|staved|ruin|no longer|not (?:as it was|whole)/i,
    `must honestly convey the wrecked state — got: ${narr}`);
});

test('U678: the wreck answer is GROUNDED — cites the piece\'s real notes, invents nothing', () => {
  const w = bootAuthoredWreckedBarrel();
  const r = playerMove(w, PACKS, 'Is the barrel still here?');
  assert.match(String(r.output?.narration || ''), /battered apart/i,
    'the real stored damage note is what grounds the wreck answer, not an invented detail');
});
