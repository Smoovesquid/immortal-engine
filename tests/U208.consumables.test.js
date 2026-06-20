// U208 — H-45: starting consumables (Bandages, Tonic of grit, Holy water
// (questionable)) are wired to real catalog effects (heal / removeCondition)
// instead of being flavor-only dead ends. The post-H-43/H-44 gate found the
// DM whiffing on "what does the Tonic of grit do?" / "I drink the Tonic" /
// "list my consumables" — root cause was unplugged content, not a missing
// mechanic: tryUseConsumable already resolves effect.kind heal/removeCondition
// from inventory.items, but the chargen-default loadout (packs/fantasy/gear.json
// via engine/chargen/fantasyGear.js) never gave these three a defRef, so they
// never reached inventory.items at all.
//
// U208-01/01b test the chargen bridge directly (engine/chargen/gear.js
// buildLoadout): a defRef-bearing flavor pick must mint a structured
// inventory.items entry (so tryUseConsumable can find it) and must NOT be
// duplicated into the legacy flavor bucket (so it can't zombie-list there
// after being consumed). A flavor-only pick (no defRef — Rations, Lamp oil)
// must stay in the legacy bucket, untouched.
//
// U208-02..05 force-carry a real item (mirrors U120's withItems pattern) to
// exercise tryUseConsumable end-to-end against the three new catalog defs.
//
// U208-06..08 exercise the grace layer: an item-effect query must describe
// the REAL effect when one exists, an honest no-effect line when it doesn't
// (never an invented effect, never auto-success), and a new "list my
// consumables" meta-query must enumerate the real consumables.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { buildLoadout } from '../engine/chargen/gear.js';
import { makeRng, seedFromString } from '../engine/rng.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

function begin(seed) {
  return beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u208-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
}

// Force-carry EXACTLY one known structured item by defRef — replaces
// inventory.items outright (mirrors U120's withItems) so the test is hermetic
// and never collides with whatever chargen's RNG happened to also roll for
// that seed (e.g. the same consumable rolled twice into the starting kit).
function withItem(w, defRef, id = 'forced1') {
  const items = [{ id, defRef, equipped: null }];
  return { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, items } }, ...w.party.slice(1)] };
}

// Force a flavor-only (no-defRef) consumable directly into the legacy
// bucket — replaces it outright for the same hermeticity reason.
function withFlavorConsumable(w, flavorItem) {
  return { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, consumables: [flavorItem] } }, ...w.party.slice(1)] };
}

const LAMP_OIL = { name: 'Lamp oil', tags: ['consumable'], notes: 'Light in a bottle.', weight: 1, noise: 0, light: 0, bulk: 1 };

// ── chargen bridge (engine/chargen/gear.js buildLoadout) ────────────────────

test('U208-01: a defRef-bearing consumable pick is bridged into inventory.items, not duplicated in the flavor bucket', () => {
  const packGear = {
    consumables: [
      { name: 'Tonic of grit', defRef: 'tonic_of_grit', tags: ['consumable'], notes: 'Tastes like regret.', weight: 1, noise: 0, light: 0, bulk: 1 }
    ]
  };
  const rng = makeRng(seedFromString('u208-buildLoadout-bridge'));
  const { inventory } = buildLoadout({ packGear, tags: [], rng });
  assert.ok(inventory.items.some(it => it.defRef === 'tonic_of_grit'), 'bridged into items[] with a resolvable defRef');
  assert.ok(!inventory.consumables.some(it => String(it?.name || it) === 'Tonic of grit'), 'not zombie-duplicated in the flavor bucket');
});

test('U208-01b: a flavor-only consumable (no defRef) stays in the legacy bucket and items[] stays empty', () => {
  const packGear = {
    consumables: [
      { name: 'Rations', tags: ['consumable'], notes: 'Hard bread, harder choices.', weight: 1, noise: 0, light: 0, bulk: 1 }
    ]
  };
  const rng = makeRng(seedFromString('u208-buildLoadout-flavor'));
  const { inventory } = buildLoadout({ packGear, tags: [], rng });
  assert.ok(inventory.consumables.some(it => it.name === 'Rations'), 'stays in the flavor bucket');
  assert.equal(inventory.items.length, 0, 'no structured item minted for a flavor-only pick');
});

test('U208-01c: the live fantasy pack actually wires at least one of the three to a real defRef somewhere across seeds', () => {
  const bridgedDefRefs = new Set(['tonic_of_grit', 'bandages', 'holy_water_questionable']);
  let sawBridged = false;
  for (const seed of ['u208-s1', 'u208-s2', 'u208-s3', 'u208-s4', 'u208-s5', 'u208-s6', 'u208-s7', 'u208-s8']) {
    const w = begin(seed);
    if ((w.party[0].inventory.items || []).some(it => bridgedDefRefs.has(it.defRef))) { sawBridged = true; break; }
  }
  assert.ok(sawBridged, 'at least one fixed seed surfaces a bridged starting consumable via the real fantasy pack');
});

// ── tryUseConsumable against the new catalog defs ───────────────────────────

test('U208-02: drinking the Tonic of grit heals, removes it, and leaves a real mechanics line (no d20, not consume:none)', () => {
  let w = withItem(begin('u208a'), 'tonic_of_grit');
  w = { ...w, meta: { ...w.meta, escapeHp: 3, escapeMaxHp: 11 } };
  const r = playerMove(w, packs, 'I drink the Tonic of grit');
  assert.match(r.output.mechanics, /consume \| Tonic of grit \| heal \d+/);
  assert.doesNotMatch(r.output.mechanics, /consume:none/);
  assert.doesNotMatch(r.output.mechanics, /d20|🎲/i);
  assert.doesNotMatch(r.output.narration, /\bMIGHT\b|\bAGILITY\b|\bWITS\b|\bGRIT\b|\bCHARM\b/, 'no raw stat-block leak on an item-use turn');
  assert.ok(r.world.meta.escapeHp > 3, 'HP went up');
  assert.ok(r.world.meta.escapeHp <= 11, 'capped at max');
  assert.ok(!r.world.party[0].inventory.items.some(it => it.id === 'forced1'), 'the tonic is gone');
  assert.ok(r.world.timeline.some(e => e.kind === 'consume'), 'drinking is canon');
  assertWorldInvariants(r.world);
});

test('U208-03: drinking the Tonic of grit is deterministic — same seed/turn heals the same amount', () => {
  function setup() {
    let w = withItem(begin('u208b'), 'tonic_of_grit');
    return { ...w, meta: { ...w.meta, escapeHp: 3, escapeMaxHp: 11 } };
  }
  const r1 = playerMove(setup(), packs, 'I drink the Tonic of grit');
  const r2 = playerMove(setup(), packs, 'I drink the Tonic of grit');
  assert.equal(r1.world.meta.escapeHp, r2.world.meta.escapeHp, 'same heal amount');
  assert.equal(r1.output.mechanics, r2.output.mechanics);
});

test('U208-04: binding the bandages heals and is narrated as applied, not drunk', () => {
  let w = withItem(begin('u208c'), 'bandages');
  w = { ...w, meta: { ...w.meta, escapeHp: 3, escapeMaxHp: 11 } };
  const r = playerMove(w, packs, 'I bind the bandages');
  assert.match(r.output.mechanics, /consume \| Bandages \| heal \d+/);
  assert.match(r.output.narration, /bind/i);
  assert.ok(!r.world.party[0].inventory.items.some(it => it.id === 'forced1'), 'bandages used up');
});

test('U208-05: holy water cures the cursed condition', () => {
  let w = withItem(begin('u208d'), 'holy_water_questionable');
  w = { ...w, party: [{ ...w.party[0], conditions: [{ name: 'cursed', source: 'test', severity: 1 }] }, ...w.party.slice(1)] };
  const r = playerMove(w, packs, 'I drink the holy water');
  assert.match(r.output.mechanics, /consume \| Holy water \(questionable\) \| cured cursed/);
  assert.ok(!(r.world.party[0].conditions || []).some(c => (c?.name || c) === 'cursed'), 'curse lifted');
  assert.ok(!r.world.party[0].inventory.items.some(it => it.id === 'forced1'), 'vial spent');
});

// ── grace: honest item-effect queries + consumables list ───────────────────

test('U208-06: "what does the Tonic of grit do?" describes the real heal, never auto-success or an invented effect', () => {
  const w = withItem(begin('u208e'), 'tonic_of_grit');
  const ans = handleMetaQuestion('what does the Tonic of grit do?', w);
  assert.ok(ans, 'answered');
  assert.match(ans, /tonic of grit/i);
  assert.match(ans, /heal|restorative|mend|wound/i, 'describes the real restorative effect');
  assert.doesNotMatch(ans, /nothing special fires|no special effect/i, 'must not give the generic no-effect line for an item that has a real effect');
});

test('U208-07: "what does the lamp oil do?" is an honest no-effect answer — no invented heal/cure', () => {
  const w = withFlavorConsumable(begin('u208f'), LAMP_OIL);
  const ans = handleMetaQuestion('what does the lamp oil do?', w);
  assert.ok(ans, 'answered');
  assert.match(ans, /lamp oil/i);
  assert.doesNotMatch(ans, /\bheals?\b|restorative|\bcures?\b/i, 'must not invent an effect lamp oil does not have');
});

test('U208-08: "is the Tonic of grit in my pack?" still gives a real yes once it lives in inventory.items', () => {
  const w = withItem(begin('u208h'), 'tonic_of_grit');
  const ans = handleMetaQuestion('is the Tonic of grit in my pack?', w);
  assert.match(ans, /yes/i);
});

test('U208-09: "list my consumables" lists the real consumables from inventory', () => {
  let w = withItem(begin('u208g'), 'tonic_of_grit');
  w = withFlavorConsumable(w, LAMP_OIL);
  const ans = handleMetaQuestion('list my consumables', w);
  assert.ok(ans, 'answered');
  assert.match(ans, /tonic of grit/i, 'includes the bridged structured item');
  assert.match(ans, /lamp oil/i, 'includes the flavor-only item');
});

test('U208-10: "list my consumables" with an empty pack is honest, not invented', () => {
  const w = begin('u208i');
  const empty = { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, consumables: [], items: [] } }, ...w.party.slice(1)] };
  const ans = handleMetaQuestion('list my consumables', empty);
  assert.ok(ans, 'answered');
  assert.doesNotMatch(ans, /tonic|bandage|lamp oil|holy water|rations/i);
});
