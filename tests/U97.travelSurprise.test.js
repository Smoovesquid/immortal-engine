// U97 — Contested ambush surprise on travel (Stage C.2 slice 2).
//
// A travel ambush does NOT automatically surprise you. Surprise is contested by
// vigilance (WITS + a perception/scout/wary skill or trait): a sharp, wary
// character is rarely caught; an oblivious one is caught more often. When
// surprised, the attacker lands a free opening strike (HP drops before you act).
// Deterministic.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
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

// Travel once with a forced WITS/skill profile; return the result mechanics + HP.
function travelOnce(seed, { wits, vigilant }) {
  let w = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u97-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  if (w.scene?.interior) w = playerMove(w, packs, 'go outside').world;
  w = ensureWorld({ ...w, party: [{ ...w.party[0], stats: { ...w.party[0].stats, WITS: wits }, foci: vigilant ? ['Scout'] : [] }, ...w.party.slice(1)] });
  const nb = neighborsOf(w)[0];
  if (!nb) return null;
  const { world, output } = playerMove(w, packs, `go to ${nb.name}`);
  return { mech: String(output.mechanics || ''), hp: world.meta?.escapeHp ?? null, maxHp: world.meta?.escapeMaxHp ?? null, narration: output.narration };
}

function tally(profile) {
  let surprise = 0, spotted = 0, ambush = 0;
  for (let i = 0; i < 40; i++) {
    const r = travelOnce(`s${i}`, profile);
    if (!r) continue;
    if (/surprise/.test(r.mech)) { surprise++; ambush++; }
    else if (/spotted/.test(r.mech)) { spotted++; ambush++; }
  }
  return { surprise, spotted, ambush };
}

describe('U97-A: surprise is the exception, and skill makes you hard to surprise', () => {
  const sharp = tally({ wits: 16, vigilant: true });
  const oblivious = tally({ wits: 6, vigilant: false });

  it('an ambush usually does NOT surprise you (most ambushes are spotted)', () => {
    const avg = tally({ wits: 10, vigilant: false });
    assert.ok(avg.ambush > 0, 'some ambushes should occur across 40 trips');
    assert.ok(avg.spotted >= avg.surprise, `most ambushes spotted, not surprises: ${JSON.stringify(avg)}`);
  });

  it('a sharp, wary character is surprised far less than an oblivious one', () => {
    assert.ok(sharp.ambush > 0 && oblivious.ambush > 0, 'both profiles must hit some ambushes');
    assert.ok(sharp.surprise <= oblivious.surprise, `sharp(${sharp.surprise}) <= oblivious(${oblivious.surprise})`);
    assert.ok(sharp.surprise <= 2, `a WITS16+Scout build is rarely surprised: ${sharp.surprise}/40`);
  });
});

describe('U97-B: a surprise round costs HP before you act', () => {
  it('when surprised, escapeHp is below max (a free strike landed) or it was a clean miss', () => {
    // Find a seed where an oblivious character is surprised, and assert the
    // surprise was mechanically real (HP loss) — unless the free strike missed.
    let checked = false;
    for (let i = 0; i < 60 && !checked; i++) {
      const r = travelOnce(`hp${i}`, { wits: 4, vigilant: false });
      if (r && /surprise/.test(r.mech)) {
        checked = true;
        // Either HP dropped, or the narration shows the opening strike missed.
        const lost = r.maxHp != null && r.hp != null && r.hp < r.maxHp;
        assert.ok(lost || /flinch aside|misses/i.test(r.narration), `surprise should land a blow or visibly miss: hp=${r.hp}/${r.maxHp} | ${r.narration}`);
      }
    }
    assert.ok(checked, 'expected at least one surprise among an oblivious traveler');
  });
});

describe('U97-C: surprise resolution is deterministic', () => {
  it('same seed + input → identical mechanics and HP', () => {
    const a = travelOnce('detS', { wits: 8, vigilant: false });
    const b = travelOnce('detS', { wits: 8, vigilant: false });
    assert.deepEqual(a, b);
  });
});
