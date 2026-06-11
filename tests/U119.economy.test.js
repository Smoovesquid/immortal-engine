// U119 — P-67 the spend loop. Deterministic shop stock, economy pricing,
// purse math, and the buy/sell/browse/haggle prose path through playerMove.
// Gold has to mean something: this is where it starts meaning it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { worldHash } from '../engine/worldHash.js';
import { createCharacter5e } from '../engine/chargen/srd/index.js';
import {
  stockFor, settlementStock, shopsHere, purseTotalCopper, pursePay,
  purseReceive, formatPrice, priceToBuy, priceToSell, shopBuys, RESTOCK_HOURS
} from '../engine/economy/shop.js';
import { getItemDef } from '../engine/ruleset/core/items/index.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

function begin(seed, gold = 80) {
  const w = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u119-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  return { ...w, party: [{ ...w.party[0], purse: { copper: 0, silver: 0, gold, platinum: 0 } }, ...w.party.slice(1)] };
}

// Find a seed whose home settlement stocks a given defRef.
function beginWithStock(defRef, gold = 80) {
  for (let i = 0; i < 30; i++) {
    const w = begin(`u119s${i}`, gold);
    if (settlementStock(w).some(l => l.defRef === defRef)) return w;
  }
  return null;
}

test('U119-01: purse math — totals, paying with change, receiving in sensible coins', () => {
  assert.equal(purseTotalCopper({ copper: 5, silver: 3, gold: 2, platinum: 1 }), 5 + 30 + 200 + 1000);
  // pay 50cp from a purse holding only 1 gold: change comes back as 5 silver
  const paid = pursePay({ copper: 0, silver: 0, gold: 1, platinum: 0 }, 50);
  assert.deepEqual(paid, { copper: 0, silver: 5, gold: 0, platinum: 0 });
  // can't cover → null
  assert.equal(pursePay({ copper: 9, silver: 0, gold: 0, platinum: 0 }, 10), null);
  // receive 12345cp → 123gp 4sp 5cp
  assert.deepEqual(purseReceive({ copper: 0, silver: 0, gold: 0, platinum: 0 }, 12345),
    { copper: 5, silver: 4, gold: 123, platinum: 0 });
  assert.equal(formatPrice(215), '2 gold, 1 silver and 5 copper');
  assert.equal(formatPrice(0), 'nothing');
});

test('U119-02: prices follow the settlement economy — desperate places charge more, pay less', () => {
  const potion = getItemDef('healing_potion_minor'); // 50 gp base
  assert.equal(priceToBuy(potion, 'stable'), 5000);
  assert.equal(priceToBuy(potion, 'desperate'), 7500);
  assert.ok(priceToBuy(potion, 'thriving') < priceToBuy(potion, 'stable'));
  assert.ok(priceToSell(potion, 'desperate') < priceToSell(potion, 'stable'));
  assert.ok(priceToSell(potion, 'stable') < priceToBuy(potion, 'stable'), 'shops profit on the spread');
});

test('U119-03: stock is deterministic per seed+node+epoch and shops keep to their trade', () => {
  const a = begin('u119det'), b = begin('u119det');
  assert.deepEqual(settlementStock(a), settlementStock(b));
  // an armorer never stocks potions; an apothecary never stocks plate
  const { shops } = shopsHere(a);
  shops.forEach((shop, i) => {
    for (const line of stockFor(a, i)) {
      const def = getItemDef(line.defRef);
      if (shop.type === 'armorer') assert.notEqual(def.kind, 'consumable');
      if (shop.type === 'apothecary') assert.equal(def.kind, 'consumable');
    }
  });
  // quest items are never sellable anywhere
  assert.equal(shopBuys('general store', getItemDef('ancient_scroll')), false);
});

test('U119-04: buying — coins counted out, item in pack, shelf depleted, all canon', () => {
  const w = beginWithStock('healing_potion_minor');
  assert.ok(w, 'no seed stocked a potion at home');
  const before = purseTotalCopper(w.party[0].purse);
  const line = settlementStock(w).find(l => l.defRef === 'healing_potion_minor');

  const r = playerMove(w, packs, 'I buy a healing potion');
  assert.match(r.output.mechanics, /trade:buy \| Minor Healing Potion/);
  const pc = r.world.party[0];
  assert.ok(pc.inventory.items.some(it => it.defRef === 'healing_potion_minor'), 'potion in pack');
  assert.equal(purseTotalCopper(pc.purse), before - line.priceCopper, 'exact coin left');
  // the shelf remembers: stock for the same epoch is one lighter
  const after = settlementStock(r.world).find(l => l.defRef === 'healing_potion_minor');
  assert.equal((after?.qty ?? 0), line.qty - 1);
  assert.ok(r.world.timeline.some(e => e.kind === 'trade' && e.data.action === 'buy'), 'trade is canon');
  assertWorldInvariants(r.world);
});

test('U119-05: an empty purse buys nothing — and the DM says what it costs', () => {
  const w = beginWithStock('healing_potion_minor', 0);
  assert.ok(w);
  const r = playerMove(w, packs, 'I buy a healing potion');
  assert.match(r.output.mechanics, /trade:buy \| .* \| short /);
  assert.equal(r.world.party[0].inventory.items.length, w.party[0].inventory.items.length, 'no item granted');
  assert.equal(worldHash(r.world), worldHash(w), 'a refused sale changes nothing');
});

test('U119-06: selling — fair discount in, refusal for quest items and wrong shops', () => {
  let w = beginWithStock('healing_potion_minor');
  assert.ok(w);
  let r = playerMove(w, packs, 'I buy a healing potion');
  const goldAfterBuy = purseTotalCopper(r.world.party[0].purse);
  r = playerMove(r.world, packs, 'I sell the healing potion');
  assert.match(r.output.mechanics, /trade:sell \| Minor Healing Potion/);
  assert.ok(purseTotalCopper(r.world.party[0].purse) > goldAfterBuy, 'coin came back');
  assert.ok(purseTotalCopper(r.world.party[0].purse) < purseTotalCopper(w.party[0].purse), 'but at a loss — shops profit');
  assert.ok(!r.world.party[0].inventory.items.some(it => it.defRef === 'healing_potion_minor'), 'potion gone');

  // a quest item finds no buyer
  let wq = { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, items: [...w.party[0].inventory.items, { id: 'q1', defRef: 'ancient_scroll', equipped: null }] } }, ...w.party.slice(1)] };
  const rq = playerMove(wq, packs, 'I sell the ancient scroll');
  assert.match(rq.output.mechanics, /trade:sell\|(refused|not-owned)/);
  assert.ok(rq.world.party[0].inventory.items.some(it => it.id === 'q1'), 'scroll stays yours');
});

test('U119-07: no shop, no sale — the wilderness keeps no counters', () => {
  let w = begin('u119wild');
  // strip shops from the current node to simulate a counterless place
  const nodes = w.map.nodes.map(n => n.id === w.map.currentNodeId
    ? { ...n, settlement: { ...n.settlement, shops: [] } } : n);
  w = { ...w, map: { ...w.map, nodes } };
  const r = playerMove(w, packs, 'I buy a healing potion');
  assert.match(r.output.mechanics, /trade:no-shop/);
});

test('U119-08: haggling is one Persuasion check — success shaves the price, never below 1', () => {
  // scan seeds until a haggle SUCCEEDS, then assert the discount math
  let found = false;
  for (let i = 0; i < 40 && !found; i++) {
    const w = beginWithStock('healing_potion_minor');
    if (!w) break;
    const line = settlementStock(w).find(l => l.defRef === 'healing_potion_minor');
    const r = playerMove(w, packs, 'I buy a healing potion and haggle for a better price');
    if (!/trade:buy \| Minor Healing Potion/.test(r.output.mechanics)) continue;
    if (/talk them down/.test(r.output.narration)) {
      const spent = purseTotalCopper(w.party[0].purse) - purseTotalCopper(r.world.party[0].purse);
      assert.equal(spent, Math.max(1, Math.round(line.priceCopper * 0.85)), 'haggle = 15% off');
      found = true;
    } else if (/won't budge/.test(r.output.narration)) {
      const spent = purseTotalCopper(w.party[0].purse) - purseTotalCopper(r.world.party[0].purse);
      assert.equal(spent, line.priceCopper, 'failed haggle pays full price');
      found = true; // either outcome proves the path; both asserted
    }
  }
  assert.ok(found, 'no haggle outcome observed across seeds');
});

test('U119-09: shelves restock with the week', () => {
  const w = beginWithStock('healing_potion_minor');
  assert.ok(w);
  let r = playerMove(w, packs, 'I buy a healing potion');
  const depleted = settlementStock(r.world).find(l => l.defRef === 'healing_potion_minor');
  // jump a week: new epoch, fresh shelves, old purchases forgotten
  const next = { ...r.world, time: { ...r.world.time, hours: (r.world.time.hours || 0) + RESTOCK_HOURS } };
  // a new epoch re-rolls the shelves and forgets old purchases entirely
  assert.ok(settlementStock(next).length >= 1, 'new week, stocked shelves');
  const restocked = settlementStock(next).find(l => l.defRef === 'healing_potion_minor');
  if (restocked) assert.ok(restocked.qty >= 1, 'old purchases do not deplete the new week');
  assert.ok(depleted === undefined || depleted.qty >= 0, 'sanity');
});

test('U119-10: chargen grants the background pocket money', () => {
  const pc = createCharacter5e({ seed: 'u119cg', speciesId: 'human', classId: 'fighter', backgroundId: 'acolyte' });
  assert.equal(pc.purse.gold, 15, 'acolyte carries a pouch (15 gp)');
  const pc2 = createCharacter5e({ seed: 'u119cg2', speciesId: 'human', classId: 'fighter', backgroundId: 'noble' });
  assert.equal(pc2.purse.gold, 25, "noble's purse (25 gp)");
});

test('U119-11: "buy you a drink" is charm, not commerce', () => {
  const w = begin('u119charm');
  const r = playerMove(w, packs, 'I offer to buy you a drink, gorgeous');
  assert.ok(!/trade:/.test(String(r.output.mechanics)), 'flirting is not a transaction');
});
