// U96 — DM-resolved named travel (Stage C.2 slice 1).
//
// "I head to the Old Shrine" runs a journey to a known neighbor: it actually
// moves you there, advances time (turns/hours) and distance (leagues), and an
// unknown place gets an in-fiction clarification — never "which way?" / "a step
// at a time" (THE_DM_TEST).

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

function outside(seed) {
  let w = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u96-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  if (w.scene?.interior) w = playerMove(w, packs, 'go outside').world;
  return w;
}
function curId(w) { return String(w.map?.currentNodeId || ''); }
function neighborsOf(w) {
  const id = curId(w);
  return (w.map?.edges || [])
    .filter(e => e.a === id || e.b === id)
    .map(e => (e.a === id ? e.b : e.a))
    .map(nid => (w.map?.nodes || []).find(n => n && n.id === nid))
    .filter(Boolean);
}

describe('U96-A: named travel reaches the place and time/distance advance', () => {
  it('"go to <neighbor>" moves you there and advances turns/hours/leagues', () => {
    let found = false;
    for (const seed of ['t1', 't2', 't3', 't4', 't5']) {
      const w = outside(seed);
      const nbs = neighborsOf(w);
      const named = nbs.find(n => String(n.name || '').trim());
      if (!named) continue;
      found = true;
      const t0 = { turn: w.time.turn, hours: w.time.hours, leagues: w.time.leagues };
      const { world: w1, output } = playerMove(w, packs, `go to ${named.name}`);
      assert.equal(curId(w1), String(named.id), `should arrive at ${named.name}: ${output.narration}`);
      assert.ok(w1.time.hours > t0.hours, `hours should advance: ${JSON.stringify(w1.time)}`);
      assert.ok(w1.time.leagues > t0.leagues, 'leagues should advance');
      assert.ok(w1.time.turn > t0.turn, 'turn should advance');
      assert.ok(!/which way|a step at a time/i.test(output.narration), `no deflection: ${output.narration}`);
      break;
    }
    assert.ok(found, 'expected a begun world with a named neighbor');
  });

  it('"head to <neighbor>" phrasing variant also travels', () => {
    for (const seed of ['t1', 't2', 't3', 't4', 't5']) {
      const w = outside(seed);
      const named = neighborsOf(w).find(n => String(n.name || '').trim());
      if (!named) continue;
      const { world: w1 } = playerMove(w, packs, `head to ${named.name}`);
      assert.equal(curId(w1), String(named.id));
      return;
    }
  });
});

describe('U96-B: unknown place — DM clarifies, does not move or deflect', () => {
  it('does not move and names the real roads in fiction', () => {
    const w = outside('t1');
    const before = curId(w);
    const { world: w1, output } = playerMove(w, packs, 'go to the obsidian tower of zix');
    assert.equal(curId(w1), before, 'must not move to a place that does not exist');
    assert.match(output.narration, /no such place|where will you make for/i, output.narration);
    assert.doesNotMatch(output.narration, /a step at a time|which way — north/i, output.narration);
  });
});

describe('U96-C: named travel is deterministic', () => {
  it('same seed + same input → identical destination and clock', () => {
    const run = () => {
      const w = outside('detSeed');
      const named = neighborsOf(w).find(n => String(n.name || '').trim());
      if (!named) return null;
      const { world } = playerMove(w, packs, `go to ${named.name}`);
      return { id: curId(world), time: world.time };
    };
    const a = run(), b = run();
    assert.ok(a, 'needs a neighbor');
    assert.deepEqual(a, b, 'identical seed + input must yield identical result');
  });
});
