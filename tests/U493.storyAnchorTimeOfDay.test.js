// U493 — OCC-STORY-1 time-of-day movement. The SAME world at a DIFFERENT hour moves folk: at dawn a
// waking town has many out on errands; by midday most are at their posts; by evening most have retired
// indoors. The movement is deterministic (same seed + same phase → same placement, every time) and
// the reasons track the phase. Throughout, the sleeping player's wake cottage holds no strangers, and
// hostiles keep to the edges at every hour. Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { occupantsOfRoom } from '../engine/structures/roomOccupancy.js';
import { placementFor } from '../engine/structures/storyAnchors.js';
import { dayPhase } from '../engine/dayNight.js';
import { normalizeTopology } from '../engine/structures/topology.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const nodeNpcs = (w) => (w.map.nodes.find(n => n.id === w.map.currentNodeId)?.settlement?.npcs) || [];
const rooms = (w, sk) => (normalizeTopology(w.structures?.byId?.[sk]?.topology)?.rooms || []).map(r => r.id);
const atHour = (w, hours) => ({ ...w, time: { ...w.time, hours } });

// A snapshot of every roster NPC's placement string at a given hour.
const snapshot = (w, wakeKey) => nodeNpcs(w).map(n => {
  const p = placementFor(w, n, { nodeId: w.map.currentNodeId, seed: w.meta.seed, wakeKey });
  return `${n.name}:${p.where}:${p.key || '-'}:${p.reason}`;
}).join('|');

test('U493: the placement responds to the hour — dawn and midday differ', () => {
  const w = boot();
  const wakeKey = w.scene.interior.structureKey;
  const dawn = atHour(w, 0);   // phase dawn
  const midday = atHour(w, 5); // phase day
  assert.equal(dayPhase(dawn), 'dawn');
  assert.equal(dayPhase(midday), 'day');
  assert.notEqual(snapshot(dawn, wakeKey), snapshot(midday, wakeKey), 'the town at dawn is not arranged like the town at midday');
});

test('U493: fewer folk are OUT in the open at midday than at dawn (the town settles into its posts)', () => {
  const w = boot();
  const wakeKey = w.scene.interior.structureKey;
  const outAt = (hours) => nodeNpcs(atHour(w, hours)).filter(n => {
    const p = placementFor(atHour(w, hours), n, { nodeId: w.map.currentNodeId, seed: w.meta.seed, wakeKey });
    return p.where === 'outdoors' && !n.hostile; // count sociable folk out in the open
  }).length;
  const dawnOut = outAt(0), dayOut = outAt(5);
  assert.ok(dawnOut >= dayOut, `dawn (${dawnOut} out) should have at least as many out in the open as midday (${dayOut} out)`);
});

test('U493: movement is deterministic — the same world at the same hour always arranges the same way', () => {
  const a = boot(), b = boot();
  for (const hours of [0, 5, 12, 18]) {
    assert.equal(
      snapshot(atHour(a, hours), a.scene.interior.structureKey),
      snapshot(atHour(b, hours), b.scene.interior.structureKey),
      `hour ${hours}: identical arrangement across two boots`
    );
  }
});

test('U493: reasons track the phase — daytime says "errands/post", nighttime says "retired/evening air"', () => {
  const w = boot();
  const wakeKey = w.scene.interior.structureKey;
  const reasonsAt = (hours) => new Set(nodeNpcs(atHour(w, hours)).map(n =>
    placementFor(atHour(w, hours), n, { nodeId: w.map.currentNodeId, seed: w.meta.seed, wakeKey }).reason));
  const day = reasonsAt(5);
  const night = reasonsAt(18);
  // No daytime NPC is ever "retired for the evening" or "taking the evening air".
  assert.ok(!day.has('retired for the evening') && !day.has('taking the evening air'), `daytime reasons must not be evening ones: ${[...day].join(', ')}`);
  // The evening set draws on the night vocabulary (retired / evening air), never daytime errands-at-post only.
  const nightVocab = ['retired for the evening', 'taking the evening air', 'keeping to the edges', 'up to something'];
  assert.ok([...night].every(r => nightVocab.includes(r)), `nighttime reasons should be evening/edge vocabulary: ${[...night].join(', ')}`);
});

test('U493: the wake cottage stays empty of strangers, and hostiles keep to the edges, at EVERY hour', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  for (const hours of [0, 3, 5, 9, 12, 15, 18, 22]) {
    const wh = atHour(w, hours);
    let inside = [];
    for (const rid of rooms(wh, sk)) inside = inside.concat(occupantsOfRoom(wh, sk, rid));
    assert.deepEqual(inside.map(n => n.name), [], `hour ${hours}: the wake cottage must hold no strangers, found ${inside.map(n => n.name).join(', ')}`);
    for (const n of nodeNpcs(wh).filter(x => x.hostile)) {
      const p = placementFor(wh, n, { nodeId: wh.map.currentNodeId, seed: wh.meta.seed, wakeKey: sk });
      assert.equal(p.where, 'outdoors', `hour ${hours}: hostile ${n.name} must keep to the edges (outdoors)`);
    }
  }
});
