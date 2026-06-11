// U123 — P-71 field crafting (docs/SALVAGE_AND_BUILD.md, rung two).
// Recipes are data; one check gates QUALITY, never possibility; time always
// passes; materials are always consumed; the DM never shows a menu.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { getRecipes, validateRecipe, matchRecipe, resolveCraft, craftBonus } from '../engine/craft/craft.js';
import { getItemDef } from '../engine/ruleset/core/items/index.js';
import { meleeProfile } from '../engine/combat/escapeCombat.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u123-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;

function withMats(w, items) {
  return { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, items } }, ...w.party.slice(1)] };
}
const MATS = [
  { id: 'b1', defRef: 'board', qty: 4, equipped: null },
  { id: 'c1', defRef: 'cloth_scrap', qty: 4, equipped: null }
];

test('U123-01: every shipped recipe validates and its refs resolve', () => {
  const recipes = getRecipes();
  assert.ok(recipes.length >= 4);
  for (const r of recipes) {
    assert.deepEqual(validateRecipe(r), [], r.id);
    assert.ok(getItemDef(r.output.defRef), `${r.id} output exists`);
  }
  assert.equal(matchRecipe('I make a torch out of this junk')?.id, 'torch');
  assert.equal(matchRecipe('whittle a stake')?.id, 'sharpened-stake');
  assert.equal(matchRecipe('craft a perpetual motion machine'), null);
});

test('U123-02: crafting consumes inputs, produces output, and the clock moves', () => {
  const w = withMats(begin('u123a'), MATS);
  const h0 = w.time.hours;
  const r = playerMove(w, packs, 'I make a torch from a board and a strip of cloth');
  assert.match(r.output.mechanics, /craft \| Torch/);
  const items = r.world.party[0].inventory.items;
  const qty = (ref) => items.filter(i => i.defRef === ref).reduce((s, i) => s + (i.qty || 1), 0);
  assert.equal(qty('board'), 3, 'a board went into it');
  assert.equal(qty('cloth_scrap'), 3, 'cloth went into it');
  assert.ok(qty('torch') >= 2, 'torches in the pack');
  assert.equal(r.world.time.hours, h0 + 1, 'an hour passed');
  assert.ok(r.world.timeline.some(e => e.kind === 'craft'), 'crafting is canon');
  assertWorldInvariants(r.world);
});

test('U123-03: missing materials get an honest itemized answer, not a roll', () => {
  const w = withMats(begin('u123b'), []);
  const r = playerMove(w, packs, 'I make a torch');
  assert.match(r.output.mechanics, /craft:missing \| torch/);
  assert.match(r.output.narration, /board/);
  assert.equal(r.world.time.hours, w.time.hours, 'no time wasted on inventory');
});

test('U123-04: the check gates quality, not possibility — poor work still produces', () => {
  // scan seeds for a poor-quality craft; it must still yield output
  for (let i = 0; i < 30; i++) {
    const w = withMats(begin(`u123q${i}`), MATS.map(m => ({ ...m })));
    const r = playerMove(w, packs, 'I make a torch');
    if (!/craft \| Torch/.test(r.output.mechanics)) continue;
    if (/\| poor \|/.test(r.output.mechanics)) {
      const torches = r.world.party[0].inventory.items.filter(i => i.defRef === 'torch');
      assert.ok(torches.length >= 1, 'poor work still produces');
      assert.match(r.output.narration, /serve/i, 'and the prose says so');
      return;
    }
  }
  assert.fail('no poor craft observed over 30 seeds');
});

test('U123-05: fine work yields more — and tools add +2 to the check', () => {
  // tool bonus is visible in craftBonus directly
  const w = begin('u123t');
  const pc = w.party[0];
  const torch = getRecipes().find(r => r.id === 'torch');
  const bare = craftBonus(pc, torch);
  const tooled = craftBonus({ ...pc, inventory: { ...pc.inventory, tools: ['tinderbox'] } }, torch);
  assert.equal(tooled.bonus, bare.bonus + 2, 'the right kit is worth +2');
  assert.ok(tooled.toolUsed);
  // fine quality yields fineQty
  const fine = resolveCraft(pc, torch, 20);
  assert.equal(fine.quality, 'fine');
  assert.equal(fine.qty, 3);
});

test('U123-06: a whittled stake is a real weapon — d6, thrown, wieldable by name', () => {
  const w = withMats(begin('u123s'), [{ id: 'b1', defRef: 'board', qty: 2, equipped: null }]);
  let r = playerMove(w, packs, 'I whittle a stake');
  assert.match(r.output.mechanics, /craft \| Sharpened Stake/);
  r = playerMove(r.world, packs, 'I wield the sharpened stake');
  assert.match(r.output.mechanics, /equip \| Sharpened Stake \| main_hand/);
  const prof = meleeProfile(r.world.party[0]);
  assert.equal(prof.name, 'Sharpened Stake');
  assert.equal(prof.die, 6);
});

test('U123-07: a splint binds on and heals — applied prose, not drinking prose', () => {
  let w = withMats(begin('u123h'), [{ id: 's1', defRef: 'splint', qty: 1, equipped: null }]);
  w = { ...w, meta: { ...w.meta, escapeHp: 4, escapeMaxHp: 11 } };
  const r = playerMove(w, packs, 'I apply the splint');
  assert.match(r.output.mechanics, /consume \| Splint \| heal/);
  assert.match(r.output.narration, /bind/i, 'splints bind, they are not drunk');
  assert.ok(r.world.meta.escapeHp > 4);
});

test('U123-08: crafting is deterministic — same world, same words, same torch', () => {
  const w = withMats(begin('u123d'), MATS);
  const a = playerMove(w, packs, 'I make a torch');
  const b = playerMove(w, packs, 'I make a torch');
  assert.equal(a.output.mechanics, b.output.mechanics);
  assert.equal(a.output.narration, b.output.narration);
});
