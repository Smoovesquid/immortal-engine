// U121 — P-69: one item system + the grown catalog (WORLD_VERSION 26).
//
// The split this closes: loot landed in typed inventory.items while combat
// read the 5e sheet strings — a looted +1 longsword never changed your swing.
// Now: chargen mints typed instances (auto-equipped), meleeProfile/playerAc
// read equipped typed gear first (sheet strings remain the fallback), and
// "I equip the X" moves gear from pack to hand with the DM saying what changed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld, ensureWorld, WORLD_VERSION } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { meleeProfile, playerAc } from '../engine/combat/escapeCombat.js';
import { createCharacter5e } from '../engine/chargen/srd/index.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { ITEM_CATALOG, getItemDef, defsByRarity, findDefByName } from '../engine/ruleset/core/items/index.js';
import { rollLootForCR } from '../engine/ruleset/core/loot/lootRoll.js';
import { LOOT_TABLES } from '../engine/ruleset/core/loot/index.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { settlementStock } from '../engine/economy/shop.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u121-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;

test('U121-01: WORLD_VERSION is 35 and party conditions survive ensureWorld', () => {
  assert.equal(WORLD_VERSION, 35);
  const w = begin('u121v');
  const dirty = ensureWorld({
    ...w,
    party: [{ ...w.party[0], conditions: [{ name: 'poisoned', severity: 2 }, { junk: true }, null] }, ...w.party.slice(1)]
  });
  assert.equal(dirty.party[0].conditions.length, 1, 'malformed conditions dropped');
  assert.equal(dirty.party[0].conditions[0].name, 'poisoned');
  assertWorldInvariants(dirty);
});

test('U121-02: the catalog is grown and coherent — every def has the fields combat needs', () => {
  const defs = Object.values(ITEM_CATALOG);
  assert.ok(defs.length >= 70, `catalog has ${defs.length} defs`);
  for (const d of defs) {
    assert.ok(d.defRef && d.name && d.kind, `${d.defRef}: identity`);
    if (d.kind === 'weapon') {
      assert.match(String(d.damage?.dice), /^\d+d\d+$/, `${d.defRef}: dice`);
      assert.ok(Array.isArray(d.properties), `${d.defRef}: properties`);
    }
    if (d.kind === 'armor' && !d.shield) assert.ok(Number(d.ac) >= 10, `${d.defRef}: ac`);
    if (d.kind === 'consumable') assert.ok(d.effect?.kind, `${d.defRef}: effect`);
  }
  assert.ok(defsByRarity('uncommon').length >= 8, 'an uncommon tier exists');
  assert.ok(defsByRarity('very_rare').length >= 3, 'a very rare tier exists');
  assert.equal(findDefByName('Chain Mail')?.defRef, 'chain_mail');
});

test('U121-03: every loot-table defRef resolves to a real item', () => {
  for (const [tid, table] of Object.entries(LOOT_TABLES)) {
    for (const e of table.entries) {
      if (e.result?.kind === 'item') {
        assert.ok(getItemDef(e.result.defRef), `${tid}: unknown defRef ${e.result.defRef}`);
      }
    }
  }
});

test('U121-04: the rarity curve — magic is a rumor at CR 1, an event at CR 20', () => {
  const tally = (cr) => {
    const counts = { uncommon: 0, rare: 0, very_rare: 0, total: 0 };
    for (let i = 0; i < 600; i++) {
      const rng = makeRng(seedFromString(`u121curve|${cr}|${i}`));
      for (const r of rollLootForCR(cr, rng)) {
        counts.total++;
        if (r.kind !== 'item') continue;
        const rar = getItemDef(r.defRef)?.rarity;
        if (counts[rar] !== undefined) counts[rar]++;
      }
    }
    return counts;
  };
  const low = tally(1), high = tally(20);
  assert.equal(low.very_rare, 0, 'no very rares from rats');
  assert.ok(low.uncommon < 20, 'uncommon at CR 1 is a story');
  assert.ok(high.very_rare > 50, 'CR 20 drops legends');
  assert.ok(high.rare > high.very_rare, 'even at the top, +3 stays rarer than +2');
});

test('U121-05: chargen mints typed gear, auto-equipped, agreeing with the sheet', () => {
  const pc = createCharacter5e({ seed: 'u121cg', speciesId: 'human', classId: 'fighter', backgroundId: 'soldier' });
  const items = pc.inventory.items;
  assert.ok(items.some(it => it.equipped === 'main_hand'), 'a weapon is in hand');
  assert.ok(items.some(it => it.equipped === 'armor'), 'armor is worn');
  // typed path and sheet path agree at creation
  assert.equal(playerAc(pc), pc.dnd.ac, 'AC identical both ways');
  const prof = meleeProfile(pc);
  assert.ok(prof.name !== 'Worn Blade', 'real weapon, not the legacy kit');
  assert.equal(prof.atkBonus, pc.dnd.profBonus + pc.dnd.mods.STR, 'attack math off the sheet mods');
});

test('U121-06: a looted +1 sword, equipped by saying so, changes the attack line', () => {
  let w = begin('u121loot');
  w = { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, items: [{ id: 'loot1', defRef: 'longsword_magic_1', equipped: null }] } }, ...w.party.slice(1)] };
  const before = meleeProfile(w.party[0]);
  const r = playerMove(w, packs, 'I equip the Sword of Morning');
  assert.match(r.output.mechanics, /equip \| Sword of Morning \| main_hand/);
  const after = meleeProfile(r.world.party[0]);
  assert.equal(after.name, 'Sword of Morning');
  assert.ok(after.atkBonus > before.atkBonus, '+1 shows in the swing');
  assert.ok(r.world.timeline.some(e => e.kind === 'equip'), 'equipping is canon');
  assertWorldInvariants(r.world);
});

test('U121-07: AC stacks the D&D way — armor base, shield +2, ring +1', () => {
  let w = begin('u121ac');
  const items = [
    { id: 'a1', defRef: 'chain_mail', equipped: 'armor' },
    { id: 's1', defRef: 'shield', equipped: 'off_hand' },
    { id: 'r1', defRef: 'ring_of_protection', equipped: 'ring', attuned: true } // P-77: the ring protects only its bonded bearer
  ];
  w = { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, items } }, ...w.party.slice(1)] };
  // chain mail 16 (dex cap 0) + shield 2 + ring 1
  assert.equal(playerAc(w.party[0]), 19);
});

test('U121-08: swapping weapons un-equips the old one — one main hand', () => {
  let w = begin('u121swap');
  const items = [
    { id: 'w1', defRef: 'shortsword', equipped: 'main_hand' },
    { id: 'w2', defRef: 'greataxe', equipped: null }
  ];
  w = { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, items } }, ...w.party.slice(1)] };
  const r = playerMove(w, packs, 'I wield the greataxe');
  const inv = r.world.party[0].inventory.items;
  assert.equal(inv.find(i => i.id === 'w2').equipped, 'main_hand');
  assert.equal(inv.find(i => i.id === 'w1').equipped, null, 'shortsword back in the pack');
  assert.equal(meleeProfile(r.world.party[0]).name, 'Greataxe');
});

test('U121-09: a bought weapon is immediately wieldable — shop to swing, one loop', () => {
  // find a seed whose home settlement stocks any weapon
  for (let i = 0; i < 30; i++) {
    let w = begin(`u121s${i}`);
    w = { ...w, party: [{ ...w.party[0], purse: { copper: 0, silver: 0, gold: 200, platinum: 0 } }, ...w.party.slice(1)] };
    const stock = settlementStock(w);
    const wpn = stock.find(l => getItemDef(l.defRef)?.kind === 'weapon');
    if (!wpn) continue;
    let r = playerMove(w, packs, `I buy a ${wpn.name}`);
    assert.match(r.output.mechanics, /trade:buy/);
    r = playerMove(r.world, packs, `I wield the ${wpn.name}`);
    assert.match(r.output.mechanics, /equip \|/);
    assert.equal(meleeProfile(r.world.party[0]).name, wpn.name);
    return;
  }
  assert.fail('no seed stocked a weapon at home');
});
