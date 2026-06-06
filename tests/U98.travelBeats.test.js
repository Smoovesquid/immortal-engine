// U98 — Non-combat travel beats (Stage C.2).
//
// A clear journey (no ambush) sometimes has a terrain-typed, observational beat
// — a trader's cart, fresh tracks, a watcher at the treeline. Beats never start
// combat, never block arrival, don't presume player choices, and are deterministic.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

function neighborsOf(w) {
  const id = String(w.map?.currentNodeId || '');
  return (w.map?.edges || []).filter(e => e.a === id || e.b === id)
    .map(e => (e.a === id ? e.b : e.a))
    .map(nid => (w.map?.nodes || []).find(n => n && n.id === nid)).filter(Boolean);
}
function travelOnce(seed) {
  let w = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u98-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  if (w.scene?.interior) w = playerMove(w, packs, 'go outside').world;
  const nb = neighborsOf(w)[0];
  if (!nb) return null;
  const { world, output } = playerMove(w, packs, `go to ${nb.name}`);
  return { mech: String(output.mechanics || ''), narration: String(output.narration || ''), arrived: String(world.map?.currentNodeId || '') === String(nb.id), combat: !!world.combat?.active, destName: String(nb.name) };
}

describe('U98-A: beats occur, are non-combat, and never block arrival', () => {
  it('across many trips, some journeys show a beat and they always arrive without combat', () => {
    let beats = 0, quiet = 0, beatArrivedClean = 0;
    for (let i = 0; i < 60; i++) {
      const r = travelOnce(`b${i}`);
      if (!r) continue;
      if (/\bbeat\b/.test(r.mech)) {
        beats++;
        if (r.arrived && !r.combat) beatArrivedClean++;
      } else if (/journey-arrive/.test(r.mech) && !/beat/.test(r.mech)) {
        quiet++;
      }
    }
    assert.ok(beats > 0, 'some journeys should produce a non-combat beat');
    assert.ok(quiet > 0, 'some journeys should be plainly quiet');
    assert.equal(beats, beatArrivedClean, 'every beat journey arrives, with no combat');
  });

  it('a beat never presumes the player paid/fought (observational only)', () => {
    for (let i = 0; i < 60; i++) {
      const r = travelOnce(`p${i}`);
      if (r && /\bbeat\b/.test(r.mech)) {
        assert.doesNotMatch(r.narration, /you (pay|hand .* a coin|attack|kill|slay|draw your)/i, r.narration);
      }
    }
  });
});

describe('U98-B: beats are deterministic and clean prose', () => {
  it('same seed + trip → identical narration + mechanics', () => {
    const a = travelOnce('detbeat');
    const b = travelOnce('detbeat');
    assert.deepEqual(a, b);
  });

  it('no value leaks in beat prose', () => {
    for (let i = 0; i < 40; i++) {
      const r = travelOnce(`leak${i}`);
      if (r && /\bbeat\b/.test(r.mech)) {
        assert.doesNotMatch(r.narration, /undefined|null|NaN|\[object Object\]/, r.narration);
      }
    }
  });
});
