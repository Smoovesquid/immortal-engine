// U62 — escape-combat loot drops.
//
// Escape-mode fights used to end with `endCombat` and nothing else: no loot, no
// reward, so winning had no point. The loot system (CR-scaled tables + roller +
// the victory popup) already existed for the deep combat path; escape combat was
// simply never wired to it. This guard locks the wiring:
//
//   • winning an escape fight rolls CR-scaled loot and emits a `combat-end`
//     timeline event carrying a non-empty `loot` array (what the UI popup reads),
//   • dropped currency lands in the party purse and dropped items in the party
//     inventory,
//   • the whole thing is deterministic by seed (replay → identical drops), so it
//     never threatens worldHash stability.
//
// Loot is probabilistic (~65% of cr_0_4 rolls drop something), so the "loot
// happens" assertion runs across many seeds and asserts the aggregate, not any
// single fight.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginCombat } from '../engine/combat/combatLifecycle.js';
import { resolveEscapeCombatTurn, initEscapeHp, initEscapeKit } from '../engine/combat/escapeCombat.js';

function mkEscapeFight(seedKey) {
  let w = newWorld({ seed: seedKey, fate: 0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{ id: 'party', name: 'Escapee', stats: { MIGHT: 18, AGILITY: 14, GRIT: 14, CHARM: 10, WITS: 18 } }]
  });
  w = initEscapeHp(w);
  w = initEscapeKit(w);
  // High HP so the player always survives long enough to win the test fight.
  w = { ...w, meta: { ...w.meta, escapeHp: 9999 } };
  const enemy = {
    name: 'Husk', hp: 5, maxHp: 5, damage: 2, ac: 8,
    cr: 0.125, lootTableRef: null, canParley: false, defeated: false
  };
  return beginCombat(w, { enemies: [enemy], reason: 'ambush' });
}

function fightToVictory(w) {
  for (let i = 0; i < 50 && w.combat?.active; i++) {
    w = resolveEscapeCombatTurn(w, 'strike').world;
  }
  return w;
}

function lootEventsOf(w) {
  const tl = Array.isArray(w.timeline) ? w.timeline : [];
  return tl.filter(e => e && e.kind === 'combat-end' && Array.isArray(e.data?.loot) && e.data.loot.length > 0);
}

describe('U62 — escape combat loot', () => {
  it('a clear win ends combat (sanity)', () => {
    const w = fightToVictory(mkEscapeFight('u62-sanity'));
    assert.equal(w.combat?.active, false, 'combat should be over after victory');
  });

  it('winning fights drop loot across seeds (aggregate)', () => {
    let withLoot = 0;
    let totalCoins = 0;
    let totalItems = 0;
    for (let s = 0; s < 24; s++) {
      const w = fightToVictory(mkEscapeFight(`u62-drop-${s}`));
      const evts = lootEventsOf(w);
      if (evts.length) {
        withLoot++;
        for (const e of evts) for (const d of e.data.loot) {
          if (d.kind === 'currency') totalCoins += Number(d.amount) || 0;
          if (d.kind === 'item') totalItems++;
        }
      }
    }
    // ~65% drop rate over 24 fights → essentially certain to see several.
    assert.ok(withLoot >= 5, `expected several fights to drop loot, got ${withLoot}/24`);
    assert.ok(totalCoins + totalItems > 0, 'expected some coins or items overall');
  });

  it('loot lands in the party purse / inventory', () => {
    // Hunt for a seed that drops currency and one that drops an item, then
    // assert the party actually received them (not just the popup payload).
    let sawCurrencyInPurse = false;
    let sawItemInInventory = false;
    for (let s = 0; s < 60 && !(sawCurrencyInPurse && sawItemInInventory); s++) {
      const w = fightToVictory(mkEscapeFight(`u62-bag-${s}`));
      const evts = lootEventsOf(w);
      if (!evts.length) continue;
      const pc = w.party[0];
      const drops = evts.flatMap(e => e.data.loot);
      if (drops.some(d => d.kind === 'currency')) {
        const purse = pc.purse || {};
        const total = (purse.copper || 0) + (purse.silver || 0) + (purse.gold || 0) + (purse.platinum || 0);
        if (total > 0) sawCurrencyInPurse = true;
      }
      if (drops.some(d => d.kind === 'item')) {
        const items = pc.inventory?.items || [];
        if (items.length > 0) sawItemInInventory = true;
      }
    }
    assert.ok(sawCurrencyInPurse, 'dropped currency should reach the party purse');
    assert.ok(sawItemInInventory, 'dropped items should reach the party inventory');
  });

  it('loot is deterministic by seed (replay identical)', () => {
    const a = fightToVictory(mkEscapeFight('u62-determinism'));
    const b = fightToVictory(mkEscapeFight('u62-determinism'));
    const lootA = JSON.stringify(lootEventsOf(a).map(e => e.data.loot));
    const lootB = JSON.stringify(lootEventsOf(b).map(e => e.data.loot));
    assert.equal(lootA, lootB, 'same seed must yield identical loot');
  });
});
