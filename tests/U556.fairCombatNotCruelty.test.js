// U556 — MP-1 F6 guard (docs/MORAL_PHYSICS.md §6 · contradiction-hunt F6).
//
// THE LAW: a FAIR fight — combat where the opponent is armed and hostile — must NEVER tag as
// cruelty, and must NEVER mint travelling cruelty-reputation. Only a HELPLESS/surrendered target
// tags cruelty (tryDarkDeed's `helpless`-context gate, playloop.js:8734). If the escalation ladder
// (MP-2+) ever fired on ordinary XCOM-style combat blood, it would over-fire on every fight — this
// test pins the boundary BEFORE that ladder lands, so the guard can never silently rot.
//
// Two cases, per the brief: a fair-combat NEGATIVE case (no cruelty, no rumor) and a helpless-victim
// POSITIVE case (cruelty deed + travelling rumor). Both driven through the real playerMove path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { rumorsReaching } from '../engine/rumor/rumorsReaching.js';
import { notorietyReaching } from '../engine/npc/reputation.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

function atSettlement(seed = 'u556') {
  const begun = beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u556-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  const w = playerMove(begun, packs, 'go outside').world;
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const distant = w.map.nodes.find(n => n.id !== here.id);
  return { w, here, distant };
}

// Does ANY travelling cruelty-rumor reach the scene or a distant node?
function anyCrueltyRumorReaching(world, here, distant) {
  const at = (nid) => rumorsReaching(world, nid, { subjectPrefix: 'deed:' });
  const all = [...at(here.id), ...at(distant.id)];
  return all.some(r => String(r.deedRef || '').includes(':cruelty:'));
}

const FAIR_KILLS = [
  'I cut down the armed bandit who is attacking me',
  'I kill the hostile soldier in the fight',
  'I slay the charging orc with my sword',
];

test('U556-01: NEGATIVE — a fair fight tags NO cruelty deed and mints NO cruelty rumor', () => {
  for (const utter of FAIR_KILLS) {
    const { w, here, distant } = atSettlement();
    const r = playerMove(w, packs, utter);

    const cruelties = (r.world.deeds || []).filter(d => d.kind === 'cruelty');
    assert.equal(cruelties.length, 0, `fair combat must tag no cruelty deed — but "${utter}" did`);

    assert.equal(anyCrueltyRumorReaching(r.world, here, distant), false,
      `fair combat must mint no travelling cruelty-reputation — but "${utter}" did`);

    assert.equal(notorietyReaching(r.world, here.id).heard, false,
      `a fair kill leaves the player's name clean — "${utter}"`);
    assert.equal(notorietyReaching(r.world, distant.id).heard, false,
      `and nothing travels to strangers — "${utter}"`);
  }
});

test('U556-02: POSITIVE — a helpless victim DOES tag cruelty and DOES travel', () => {
  const { w, here, distant } = atSettlement();
  const r = playerMove(w, packs, 'I execute the kneeling captive who begs for mercy');

  const cruelties = (r.world.deeds || []).filter(d => d.kind === 'cruelty');
  assert.equal(cruelties.length, 1, 'killing a helpless, begging captive IS cruelty');
  assert.equal(cruelties[0].severity, 20, 'and it is HEAVY');

  assert.equal(anyCrueltyRumorReaching(r.world, here, distant), true,
    'the cruelty becomes travelling reputation (the positive control for the F6 guard)');
  assert.equal(notorietyReaching(r.world, distant.id).heard, true,
    'a distant stranger has heard of the atrocity');
});

test('U556-03: the SAME verb differs only by helplessness (the gate is context, not the kill)', () => {
  // "I cut him down" — fair (armed foe) vs helpless (bound) — same weapon-verb, opposite verdict.
  const fair = atSettlement('u556-fair');
  const rf = playerMove(fair.w, packs, 'I cut down the armed raider swinging at me');
  assert.equal((rf.world.deeds || []).filter(d => d.kind === 'cruelty').length, 0,
    'cutting down an armed attacker is not cruelty');

  const foul = atSettlement('u556-foul');
  const rF = playerMove(foul.w, packs, 'I cut down the bound, unarmed prisoner');
  assert.equal((rF.world.deeds || []).filter(d => d.kind === 'cruelty').length, 1,
    'cutting down a bound, unarmed prisoner IS cruelty — helplessness is the gate');
});
