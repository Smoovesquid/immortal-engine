// U108 — Morality M1: the multi-charge deed detector + the seven-axis soul.
//
// A deterministic detector reads the act the player declares and silently tunes the seven
// sin/virtue axes + records a deed. Multi-charge (the soldier's bargain: one act reaches
// several gods). Axes accumulate, never net. Context modulates severity, not category.
// INVISIBLE: the turn's narration/mechanics are unchanged; only hidden morality moves.
// Tight, false-positive-guarded. Deterministic / replay-safe.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { worldHash } from '../engine/worldHash.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u108-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
const act = (seed, cmd) => playerMove(begin(seed), packs, cmd);
const axes = (w) => w.party[0].morality.axes;
const movedAxes = (w) => Object.entries(axes(w)).filter(([, v]) => v > 0).map(([k]) => k).sort();
const deedKinds = (w) => w.deeds.map(d => d.kind);

describe('U108-A: deeds register the right charges', () => {
  it('a helpless kill is heavy Wrath (cruelty), no light', () => {
    const w = act('a', "I cut the bound prisoner's throat").world;
    assert.deepEqual(movedAxes(w), ['wrath']);
    assert.ok(axes(w).wrath >= 15);
    assert.deepEqual(deedKinds(w), ['cruelty']);
  });
  it('necromancy is forbidden (Gluttony)', () => {
    const w = act('a', 'I raise the dead to fight for me').world;
    assert.ok(axes(w).gluttony > 0);
    assert.deepEqual(deedKinds(w), ['forbidden']);
  });
  it('betrayal-for-gold is Pride + Greed', () => {
    const w = act('a', 'I betray my companion and take the gold').world;
    assert.deepEqual(movedAxes(w), ['greed', 'pride']);
  });
  it('giving to the starving is Charity (aid)', () => {
    const w = act('a', 'I give the starving man my last bread').world;
    assert.deepEqual(movedAxes(w), ['charity']);
    assert.deepEqual(deedKinds(w), ['aid']);
  });
  it('sparing the begging foe is Patience + Kindness (mercy)', () => {
    const w = act('a', 'I spare the man begging for mercy').world;
    assert.deepEqual(movedAxes(w), ['kindness', 'patience']);
    assert.deepEqual(deedKinds(w), ['mercy']);
  });
  it('tending a fallen enemy is the warrior\'s discipline (Kindness + Charity)', () => {
    const w = act('a', 'I tend the enemy I just felled').world;
    assert.deepEqual(movedAxes(w), ['charity', 'kindness']);
  });
});

describe('U108-B: the soldier\'s bargain — multi-charge, accumulate not net', () => {
  it('kill-to-save marks BOTH Wrath AND Charity/Kindness', () => {
    const w = act('b', 'I cut him down to save the children').world;
    assert.ok(axes(w).wrath > 0, 'killing reaches Khorrun');
    assert.ok(axes(w).charity > 0, 'saving reaches the light');
    assert.ok(axes(w).kindness > 0);
    // accumulate, never net: corruption and virtue are BOTH > 0
    assert.ok(w.party[0].morality.corruption > 0 && w.party[0].morality.virtue > 0);
  });
  it('the fair-kill-to-save Wrath charge is LIGHTER than a helpless-kill Wrath charge', () => {
    const save = act('b', 'I cut him down to save the children').world;
    const helpless = act('b', "I cut the bound prisoner's throat").world;
    assert.ok(axes(save).wrath < axes(helpless).wrath, 'context modulates severity, not category');
    assert.ok(axes(save).wrath > 0 && axes(helpless).wrath > 0, 'both still reach Khorrun');
  });
});

describe('U108-C: ordinary play is INVISIBLE (zero false positives)', () => {
  const ordinary = [
    'I attack the charging bandit', 'I take the lantern', 'I open the crate',
    'where am I?', 'I wait', 'examine the door', 'I eat the bread',
    'I talk to the elder', 'go to the Old Shrine', 'I draw my sword', 'look around',
  ];
  for (const cmd of ordinary) {
    it(`"${cmd}" moves no axis and records no deed`, () => {
      const w = act('c', cmd).world;
      assert.deepEqual(movedAxes(w), [], `axes moved: ${movedAxes(w)}`);
      assert.equal(w.deeds.length, 0);
    });
  }
});

describe('U108-D: M1 is invisible — output unchanged by deed detection', () => {
  it('the narration/mechanics of a cruel act are exactly what the core turn produced', () => {
    // Same input, deed detection on (real playerMove). The OUTPUT must be ordinary prose,
    // not a morality announcement. (We assert no morality leak into the player-facing text.)
    const r = act('d', "I cut the bound prisoner's throat");
    assert.ok(r.output.narration && r.output.narration.length > 0);
    assert.doesNotMatch(String(r.output.narration), /corruption|morality|wrath|sin|axis/i);
    assert.doesNotMatch(String(r.output.mechanics || ''), /corruption|axis|deed/i);
    // but the soul did move
    assert.ok(r.world.party[0].morality.corruption > 0);
  });
});

describe('U108-E: invariants + deterministic / replay-safe', () => {
  it('a moved soul still satisfies invariants', () => {
    const w = act('e', "I cut the bound prisoner's throat").world;
    assert.doesNotThrow(() => assertWorldInvariants(w));
  });
  it('same seed + input → identical axes, deeds, and hash', () => {
    const a = act('det', 'I betray my companion and take the gold').world;
    const b = act('det', 'I betray my companion and take the gold').world;
    assert.deepEqual(axes(a), axes(b));
    assert.deepEqual(a.deeds, b.deeds);
    assert.equal(worldHash(a), worldHash(b));
  });
  it('corruption/virtue derive from the axes (max of the poles)', () => {
    const w = act('det', "I cut the bound prisoner's throat").world;
    assert.equal(w.party[0].morality.corruption, axes(w).wrath); // dominant vice
  });
});
