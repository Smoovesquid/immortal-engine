// P-67 — the spend loop. Deterministic shop stock, economy-modulated prices,
// purse math. No menus: the playloop turns "I buy a healing potion" into a
// resolved trade; this module only answers what's in stock and what it costs.
//
// Stock is derived, never stored: seed + node + shop index + restock epoch
// (weekly) → the same shelves every time, minus whatever the timeline records
// as already bought this epoch. No new world-state shape, no version bump.

import { makeRng, seedFromString } from '../rng.js';
import { getItemDef, ITEM_CATALOG } from '../ruleset/core/items/index.js';

export const RESTOCK_HOURS = 168; // weekly

// 1 gp = 10 sp = 100 cp; 1 pp = 10 gp.
const COPPER_PER = { copper: 1, silver: 10, gold: 100, platinum: 1000 };

// Economy → price posture. Desperate places charge more and pay less.
const ECONOMY_BUY_MULT = { thriving: 0.9, stable: 1.0, struggling: 1.25, desperate: 1.5 };
const ECONOMY_SELL_MULT = { thriving: 0.5, stable: 0.5, struggling: 0.4, desperate: 0.3 };

// What each shop type stocks (defRefs from the catalog) and what it buys.
const SHOP_PROFILES = {
  'apothecary': {
    stocks: ['healing_potion_minor', 'antidote'],
    buys: ['consumable']
  },
  'armorer': {
    stocks: ['shortsword', 'longsword', 'longbow', 'leather_armor', 'studded_leather', 'hide_armor', 'scale_mail', 'chain_mail'],
    buys: ['weapon', 'armor']
  },
  'general store': {
    stocks: ['healing_potion_minor', 'shortsword', 'leather_armor', 'antidote'],
    buys: ['weapon', 'armor', 'consumable', 'accessory', 'material']
  },
  'supply shop': {
    stocks: ['healing_potion_minor', 'leather_armor', 'shortsword'],
    buys: ['weapon', 'armor', 'consumable', 'material']
  },
  'provisioner': {
    stocks: ['healing_potion_minor', 'antidote', 'hide_armor'],
    buys: ['consumable', 'material']
  }
};

// ── where am I shopping ─────────────────────────────────────────────────────

export function shopsHere(world) {
  const node = (world.map?.nodes || []).find(n => n.id === world.map?.currentNodeId);
  const shops = node?.settlement?.shops;
  if (!Array.isArray(shops) || !shops.length) return { node: node || null, shops: [] };
  return { node, shops };
}

export function economyAt(node) {
  const e = String(node?.settlement?.economy || 'stable');
  return ECONOMY_BUY_MULT[e] ? e : 'stable';
}

// ── stock ───────────────────────────────────────────────────────────────────

export function restockEpoch(world) {
  return Math.floor(Math.max(0, Number(world.time?.hours ?? 0)) / RESTOCK_HOURS);
}

/**
 * stockFor(world, shopIdx) -> [{ defRef, name, qty, priceCopper }]
 * Deterministic per seed/node/shop/epoch, minus purchases recorded in the
 * timeline this epoch (trade events are canon, so shelves stay honest).
 */
export function stockFor(world, shopIdx) {
  const { node, shops } = shopsHere(world);
  const shop = shops[shopIdx];
  if (!node || !shop) return [];
  const profile = SHOP_PROFILES[String(shop.type)] || SHOP_PROFILES['general store'];
  const epoch = restockEpoch(world);
  const rng = makeRng(seedFromString(`${world.meta?.seed || ''}|shop|${node.id}|${shopIdx}|${epoch}`));
  const economy = economyAt(node);

  // Scarce economies stock fewer lines.
  const maxLines = economy === 'desperate' ? 1 : economy === 'struggling' ? 2 : 3;

  const pool = profile.stocks.filter(ref => getItemDef(ref));
  const lines = [];
  const used = new Set();
  const lineCount = Math.min(maxLines, pool.length) > 1 ? rng.int(Math.min(2, maxLines), Math.min(maxLines, pool.length)) : 1;
  for (let i = 0; i < lineCount && used.size < pool.length; i++) {
    let ref = pool[rng.int(0, pool.length - 1)];
    let guard = 0;
    while (used.has(ref) && guard++ < 10) ref = pool[rng.int(0, pool.length - 1)];
    if (used.has(ref)) continue;
    used.add(ref);
    const def = getItemDef(ref);
    lines.push({
      defRef: ref,
      name: def.name,
      qty: def.kind === 'consumable' ? rng.int(1, 3) : 1,
      priceCopper: priceToBuy(def, economy)
    });
  }

  // Subtract what the timeline says was already bought here this epoch.
  const bought = {};
  for (const ev of (world.timeline || [])) {
    if (ev?.kind !== 'trade') continue;
    const d = ev.data || {};
    if (d.action !== 'buy' || d.nodeId !== node.id || d.shopIdx !== shopIdx || d.epoch !== epoch) continue;
    bought[d.defRef] = (bought[d.defRef] || 0) + (Number(d.qty) || 1);
  }
  return lines
    .map(l => ({ ...l, qty: l.qty - (bought[l.defRef] || 0) }))
    .filter(l => l.qty > 0);
}

/** All stock lines across this settlement's shops: [{shopIdx, shopType, ...line}] */
export function settlementStock(world) {
  const { shops } = shopsHere(world);
  const out = [];
  shops.forEach((shop, i) => {
    for (const line of stockFor(world, i)) {
      out.push({ shopIdx: i, shopType: String(shop.type), ...line });
    }
  });
  return out;
}

// ── prices ──────────────────────────────────────────────────────────────────

export function priceToBuy(def, economy) {
  const base = Math.max(1, Number(def?.basePrice ?? 1)) * 100; // basePrice is gp
  return Math.max(1, Math.round(base * (ECONOMY_BUY_MULT[economy] ?? 1)));
}

export function priceToSell(def, economy) {
  const base = Math.max(1, Number(def?.basePrice ?? 1)) * 100;
  return Math.max(1, Math.round(base * (ECONOMY_SELL_MULT[economy] ?? 0.5)));
}

export function shopBuys(shopType, def) {
  if (!def || def.kind === 'quest' || !(Number(def.basePrice) > 0)) return false;
  const profile = SHOP_PROFILES[String(shopType)] || SHOP_PROFILES['general store'];
  return profile.buys.includes(def.kind);
}

// ── purse math ──────────────────────────────────────────────────────────────

export function purseTotalCopper(purse) {
  const p = purse && typeof purse === 'object' ? purse : {};
  return Object.entries(COPPER_PER).reduce((s, [k, v]) => s + Math.max(0, Number(p[k]) || 0) * v, 0);
}

/**
 * pursePay(purse, costCopper) -> new purse | null if it can't cover.
 * Spends small coins first, breaks a larger coin when needed, and takes the
 * change back in silver + copper — the way an actual counter trade goes.
 */
export function pursePay(purse, costCopper) {
  const p = {
    copper: Math.max(0, Number(purse?.copper) || 0),
    silver: Math.max(0, Number(purse?.silver) || 0),
    gold: Math.max(0, Number(purse?.gold) || 0),
    platinum: Math.max(0, Number(purse?.platinum) || 0)
  };
  let remaining = Math.max(0, Math.trunc(costCopper));
  if (purseTotalCopper(p) < remaining) return null;

  for (const denom of ['copper', 'silver', 'gold', 'platinum']) {
    const value = COPPER_PER[denom];
    while (remaining > 0 && p[denom] > 0) {
      p[denom] -= 1;
      remaining -= value;
    }
    if (remaining <= 0) break;
  }
  // Overshoot comes back as change: silver first, coppers for the rest.
  let change = -remaining;
  if (change > 0) {
    p.silver += Math.floor(change / 10);
    p.copper += change % 10;
  }
  return p;
}

/** addCoins(purse, copperValue) -> new purse, paid out in sensible coins. */
export function purseReceive(purse, copperValue) {
  const p = {
    copper: Math.max(0, Number(purse?.copper) || 0),
    silver: Math.max(0, Number(purse?.silver) || 0),
    gold: Math.max(0, Number(purse?.gold) || 0),
    platinum: Math.max(0, Number(purse?.platinum) || 0)
  };
  let v = Math.max(0, Math.trunc(copperValue));
  p.gold += Math.floor(v / 100); v %= 100;
  p.silver += Math.floor(v / 10); v %= 10;
  p.copper += v;
  return p;
}

/** "1 gold, 2 silver and 5 copper" — the DM counts coins, not decimals. */
export function formatPrice(copperValue) {
  let v = Math.max(0, Math.trunc(copperValue));
  const parts = [];
  const gp = Math.floor(v / 100); v %= 100;
  const sp = Math.floor(v / 10); v %= 10;
  if (gp) parts.push(`${gp} gold`);
  if (sp) parts.push(`${sp} silver`);
  if (v) parts.push(`${v} copper`);
  if (!parts.length) return 'nothing';
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}

// ── name matching ───────────────────────────────────────────────────────────

const STOP = new Set(['a', 'an', 'the', 'some', 'of', 'my', 'this', 'that', 'one']);

function tokens(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9+]+/).filter(t => t && !STOP.has(t));
}

/** Best name match for a player phrase among candidates with .name; null if nothing scores. */
export function matchByName(phrase, candidates, getName) {
  const qt = tokens(phrase);
  if (!qt.length) return null;
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const nt = tokens(getName(c));
    let score = 0;
    for (const t of qt) {
      if (nt.includes(t)) score += 2;
      else if (nt.some(n => n.startsWith(t) || t.startsWith(n))) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore >= 2 ? best : null;
}
