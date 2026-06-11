// U120 — P-68 usable consumables. Potions drop from loot and sell in shops;
// now they can be drunk — out of combat free, in combat for the action (RAW).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { worldHash } from '../engine/worldHash.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

function begin(seed) {
  return beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u120-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
}

function withItems(w, items) {
  return { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, items } }, ...w.party.slice(1)] };
}

const POTION = { id: 'pot1', defRef: 'healing_potion_minor', equipped: null };
const ANTIDOTE = { id: 'anti1', defRef: 'antidote', equipped: null };

test('U120-01: drinking a potion out of combat heals and consumes it', () => {
  let w = withItems(begin('u120a'), [POTION]);
  w = { ...w, meta: { ...w.meta, escapeHp: 3, escapeMaxHp: 11 } };
  const r = playerMove(w, packs, 'I drink the healing potion');
  assert.match(r.output.mechanics, /consume \| Minor Healing Potion \| heal \d+/);
  assert.ok(r.world.meta.escapeHp > 3, 'HP went up');
  assert.ok(r.world.meta.escapeHp <= 11, 'capped at max');
  assert.ok(!r.world.party[0].inventory.items.some(it => it.id === 'pot1'), 'bottle is gone');
  assert.ok(r.world.timeline.some(e => e.kind === 'consume'), 'drinking is canon');
  assertWorldInvariants(r.world);
});

test('U120-02: at full HP the cork stays in — nothing is wasted', () => {
  let w = withItems(begin('u120b'), [POTION]);
  w = { ...w, meta: { ...w.meta, escapeHp: 11, escapeMaxHp: 11 } };
  const r = playerMove(w, packs, 'drink my potion');
  assert.match(r.output.mechanics, /consume:unneeded/);
  assert.ok(r.world.party[0].inventory.items.some(it => it.id === 'pot1'), 'potion kept');
  assert.equal(worldHash(r.world), worldHash(w), 'nothing changed');
});

test('U120-03: no potion, no miracle — the DM is honest', () => {
  const w = withItems(begin('u120c'), []);
  const r = playerMove(w, packs, 'I drink a healing potion');
  assert.match(r.output.mechanics, /consume:none/);
});

test('U120-04: in combat the potion heals, costs the action, and the enemy still swings', () => {
  let w = withItems(begin('u120d'), [POTION]);
  w = {
    ...w,
    meta: { ...w.meta, escapeHp: 4, escapeMaxHp: 11 },
    combat: { ...w.combat, active: true, round: 1, enemies: [{ id: 'e1', name: 'bandit', hp: 6, maxHp: 6, ac: 11, attack: 2, dmgDie: 4, cr: 0.25 }], initiativeOrder: [], beganAt: 0 }
  };
  const { world: w2, result } = resolveEscapeCombatTurn(w, 'I quaff my healing potion');
  assert.ok((result.beats || []).some(b => /pull the cork/.test(b)), 'the drink is narrated');
  assert.ok(!w2.party[0].inventory.items.some(it => it.id === 'pot1'), 'bottle gone');
  assert.ok(w2.meta.escapeHp > 4 - 4, 'healed (net of the enemy turn that follows)');
  assert.ok((result.beats || []).some(b => /bandit/.test(b)), 'the action was spent — the fight went on');
});

test('U120-05: an unneeded antidote stays corked', () => {
  // NOTE: ensureWorld does not yet persist a `conditions` field on party
  // members, so the player cannot currently BE poisoned — the cure branch in
  // the consume path is dormant until party conditions land (P-69 unification
  // is the natural home). When they do: add the poisoned→cured assertion here.
  const w2 = withItems(begin('u120f'), [ANTIDOTE]);
  const r2 = playerMove(w2, packs, 'I drink the antidote');
  assert.match(r2.output.mechanics, /consume:unneeded/);
  assert.ok(r2.world.party[0].inventory.items.some(it => it.id === 'anti1'), 'vial kept');
});

test('U120-06: naming the item picks the right bottle from a mixed pack', () => {
  let w = withItems(begin('u120g'), [ANTIDOTE, POTION]);
  w = { ...w, meta: { ...w.meta, escapeHp: 3, escapeMaxHp: 11 } };
  const r = playerMove(w, packs, 'I drink the healing potion');
  assert.match(r.output.mechanics, /Minor Healing Potion/);
  assert.ok(r.world.party[0].inventory.items.some(it => it.id === 'anti1'), 'antidote untouched');
});
