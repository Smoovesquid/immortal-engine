// U97 — JOURNEY (fast-travel) ambush surprise.
//
// RELOCKED for JR-1 (2026-07-04): the journey verb is fast travel with a risk premium.
// You fast-forwarded ground you weren't watching, so a journey-triggered ambush ALWAYS
// opens on the enemy's terms — the ambusher takes a free opening strike before you act.
// This SUPERSEDES the old contested-surprise model (Stage C.2 slice 2), where a wary
// character could "spot" a travel ambush and meet it ready; that vigilance now belongs
// to WALKING the ground cell by cell (which accrues no premium and no surprise — see
// U420–U423), not to the journey verb. The old "[ambush | spotted]" branch is gone.
//
// U97-A — a journey ambush ALWAYS surprises (never "spotted"), regardless of WITS/skill.
// U97-B — a surprise round is mechanically real: HP drops before you act, or the free
//          strike visibly missed.
// U97-C — surprise resolution is deterministic (same seed + input → identical result).
//
// Deterministic, LLM-off.

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

// Journey once to a neighbor with a forced WITS/skill profile; return the mechanics,
// HP, and the combat.surprised flag.
function travelOnce(seed, { wits, vigilant }) {
  let w = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u97-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  if (w.scene?.interior) w = playerMove(w, packs, 'go outside').world;
  w = ensureWorld({ ...w, party: [{ ...w.party[0], stats: { ...w.party[0].stats, WITS: wits }, foci: vigilant ? ['Scout'] : [] }, ...w.party.slice(1)] });
  const nb = neighborsOf(w)[0];
  if (!nb) return null;
  const { world, output } = playerMove(w, packs, `go to ${nb.name}`);
  return { mech: String(output.mechanics || ''), hp: world.meta?.escapeHp ?? null, maxHp: world.meta?.escapeMaxHp ?? null, surprised: world.combat?.surprised ?? null, combat: Boolean(world.combat?.active), narration: output.narration };
}

function tally(profile) {
  let surprise = 0, spotted = 0, ambush = 0;
  for (let i = 0; i < 40; i++) {
    const r = travelOnce(`s${i}`, profile);
    if (!r) continue;
    if (/spotted/.test(r.mech)) { spotted++; ambush++; }
    else if (/surprise/.test(r.mech)) { surprise++; ambush++; }
  }
  return { surprise, spotted, ambush };
}

describe('U97-A: a journey ambush ALWAYS surprises — vigilance does not save the fast traveller', () => {
  it('a journey-triggered ambush is a surprise, never "spotted" (regardless of build)', () => {
    const sharp = tally({ wits: 16, vigilant: true });
    const oblivious = tally({ wits: 6, vigilant: false });
    assert.ok(sharp.ambush > 0 && oblivious.ambush > 0, 'both profiles must hit some journey ambushes across 40 trips');
    // The premium is unconditional: no journey ambush is ever spotted, for any build.
    assert.equal(sharp.spotted, 0, `no journey ambush is "spotted" even for a wary build: ${JSON.stringify(sharp)}`);
    assert.equal(oblivious.spotted, 0, `no journey ambush is "spotted" for an oblivious build: ${JSON.stringify(oblivious)}`);
    // Every journey ambush is a surprise.
    assert.equal(sharp.surprise, sharp.ambush, 'every journey ambush surprised the wary build too');
    assert.equal(oblivious.surprise, oblivious.ambush, 'every journey ambush surprised the oblivious build');
  });

  it('the surprise is recorded on combat state (combat.surprised === true)', () => {
    let checked = false;
    for (let i = 0; i < 60 && !checked; i++) {
      const r = travelOnce(`flag${i}`, { wits: 10, vigilant: false });
      if (r && r.combat && /surprise/.test(r.mech)) {
        checked = true;
        assert.equal(r.surprised, true, 'a journey ambush sets combat.surprised');
      }
    }
    assert.ok(checked, 'expected at least one journey ambush to inspect the flag');
  });
});

describe('U97-B: a surprise round costs HP before you act', () => {
  it('when surprised, escapeHp is below max (a free strike landed) or the strike visibly missed', () => {
    let checked = false;
    for (let i = 0; i < 60 && !checked; i++) {
      const r = travelOnce(`hp${i}`, { wits: 4, vigilant: false });
      if (r && /surprise/.test(r.mech)) {
        checked = true;
        const lost = r.maxHp != null && r.hp != null && r.hp < r.maxHp;
        assert.ok(lost || /flinch aside|misses/i.test(r.narration), `surprise should land a blow or visibly miss: hp=${r.hp}/${r.maxHp} | ${r.narration}`);
      }
    }
    assert.ok(checked, 'expected at least one surprise among a fast traveler');
  });
});

describe('U97-C: surprise resolution is deterministic', () => {
  it('same seed + input → identical mechanics and HP', () => {
    const a = travelOnce('detS', { wits: 8, vigilant: false });
    const b = travelOnce('detS', { wits: 8, vigilant: false });
    assert.deepEqual(a, b);
  });
});
