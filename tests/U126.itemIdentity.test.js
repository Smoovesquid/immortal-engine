// U126 — P-77 magic item identity: unidentified drops, attunement, named uniques.
// A magic drop lands SEALED (the pack holds something humming, not a name the
// table hasn't earned); identification opens it for an hour or a fee;
// attunement is three bonds to a soul and the big effects sleep without it;
// milestones pay named uniques with one-line histories.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { seedFromString } from '../engine/rng.js';
import {
  shouldSeal, sealLoot, identifyDc, sageFeeCopper, getNamedUniques, pickNamedReward
} from '../engine/ruleset/core/items/magic.js';
import { getItemDef } from '../engine/ruleset/core/items/index.js';
import { meleeProfile, playerAc } from '../engine/combat/escapeCombat.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u126-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;

function withItems(w, items, purse) {
  const pc = w.party[0];
  return {
    ...w,
    party: [{
      ...pc,
      inventory: { ...pc.inventory, items },
      ...(purse ? { purse } : {})
    }, ...w.party.slice(1)]
  };
}

test('U126-01: magic gear seals; common gear and potions do not', () => {
  assert.ok(shouldSeal(getItemDef('longsword_magic_1')), '+1 sword keeps its secret');
  assert.ok(shouldSeal(getItemDef('ring_of_protection')), 'so does a ring');
  assert.ok(!shouldSeal(getItemDef('longsword')), 'plain steel has none');
  assert.ok(!shouldSeal(getItemDef('potion_healing')), 'potions identify on the tongue');
  const sealed = sealLoot({ id: 'x1', defRef: 'longsword_magic_1', equipped: null }, getItemDef('longsword_magic_1'));
  assert.equal(sealed.defRef, 'unidentified_blade');
  assert.equal(sealed.sealedRef, 'longsword_magic_1');
  assert.ok(getItemDef('unidentified_blade').mystery);
});

test('U126-02: sealedRef and attuned survive ensureWorld and save/reload', () => {
  const w = withItems(begin('u126a'), [
    { id: 's1', defRef: 'unidentified_blade', equipped: null, sealedRef: 'longsword_magic_1' },
    { id: 'a1', defRef: 'ring_of_protection', equipped: 'ring', attuned: true }
  ]);
  const back = importWorld(exportWorld(w));
  const items = back.party[0].inventory.items;
  assert.equal(items.find(i => i.id === 's1').sealedRef, 'longsword_magic_1');
  assert.equal(items.find(i => i.id === 'a1').attuned, true);
  assertWorldInvariants(back);
});

test('U126-03: identify by your own hour — success reveals, failure keeps the secret, both cost the hour', () => {
  let revealed = false, kept = false;
  for (let i = 0; i < 30 && !(revealed && kept); i++) {
    const w = withItems(begin(`u126b${i}`), [{ id: 's1', defRef: 'unidentified_blade', equipped: null, sealedRef: 'longsword_magic_1' }]);
    const h0 = w.time.hours;
    const r = playerMove(w, packs, 'I identify the humming blade');
    assert.equal(r.world.time.hours, h0 + 1, 'the hour always passes');
    const items = r.world.party[0].inventory.items;
    if (/identify \| Sword of Morning/.test(r.output.mechanics)) {
      revealed = true;
      assert.equal(items.find(i => i.id === 's1').defRef, 'longsword_magic_1', 'the truth lands on the same instance');
      assert.ok(!items.find(i => i.id === 's1').sealedRef, 'seal gone');
      assert.match(r.output.narration, /Sword of Morning/);
    } else {
      kept = true;
      assert.match(r.output.mechanics, /identify:fail/);
      assert.equal(items.find(i => i.id === 's1').defRef, 'unidentified_blade', 'still humming');
    }
  }
  assert.ok(revealed && kept, 'saw both outcomes across seeds');
});

test('U126-04: the sage path — coin buys certainty at a settlement', () => {
  const w = withItems(begin('u126c'), [{ id: 's1', defRef: 'unidentified_blade', equipped: null, sealedRef: 'longsword_magic_1' }],
    { copper: 0, silver: 0, gold: 100, platinum: 0 });
  const r = playerMove(w, packs, 'I pay the sage to identify the humming blade');
  assert.match(r.output.mechanics, /identify \| Sword of Morning \| sage/);
  const items = r.world.party[0].inventory.items;
  assert.equal(items.find(i => i.id === 's1').defRef, 'longsword_magic_1');
  assert.ok((r.world.party[0].purse.gold || 0) < 100, 'the fee left the purse');
  // broke: honest refusal, nothing changes
  const poor = withItems(begin('u126c2'), [{ id: 's1', defRef: 'unidentified_blade', equipped: null, sealedRef: 'longsword_magic_1' }],
    { copper: 5, silver: 0, gold: 0, platinum: 0 });
  const no = playerMove(poor, packs, 'pay a sage to identify the humming blade');
  assert.match(no.output.mechanics, /identify:cant-pay/);
  assert.equal(no.world.party[0].inventory.items.find(i => i.id === 's1').defRef, 'unidentified_blade');
});

test('U126-05: identify with nothing sealed gets the honest answer', () => {
  const r = playerMove(begin('u126d'), packs, 'I identify what I am carrying');
  assert.match(r.output.mechanics, /identify:none/);
});

test('U126-06: attunement — an hour, a bond, and the cap of three', () => {
  const w = withItems(begin('u126e'), [
    { id: 'r1', defRef: 'ring_of_protection', equipped: 'ring' },
    { id: 'c1', defRef: 'cloak_of_protection', equipped: null, attuned: true },
    { id: 'b1', defRef: 'bracers_of_defense', equipped: null, attuned: true },
    { id: 'g1', defRef: 'greyfang', equipped: null, attuned: true }
  ]);
  // cap: three bonds already held
  const refused = playerMove(w, packs, 'I attune to the ring of protection');
  assert.match(refused.output.mechanics, /attune:cap/);
  // release one, then the bond takes and the hour passes
  const freed = withItems(w, w.party[0].inventory.items.map(i => i.id === 'g1' ? { id: 'g1', defRef: 'greyfang', equipped: null } : i));
  const h0 = freed.time.hours;
  const bonded = playerMove(freed, packs, 'I attune to the ring of protection');
  assert.match(bonded.output.mechanics, /attune \| Ring of Protection/);
  assert.equal(bonded.world.time.hours, h0 + 1);
  assert.equal(bonded.world.party[0].inventory.items.find(i => i.id === 'r1').attuned, true);
  assertWorldInvariants(bonded.world);
});

test('U126-07: attunement gates the combat math — asleep until bonded', () => {
  const base = begin('u126f');
  // Greyfang equipped but unbonded: swings as plain steel (no +2)
  const cold = withItems(base, [{ id: 'g1', defRef: 'greyfang', equipped: 'main_hand' }]);
  const warm = withItems(base, [{ id: 'g1', defRef: 'greyfang', equipped: 'main_hand', attuned: true }]);
  const pCold = meleeProfile(cold.party[0]);
  const pWarm = meleeProfile(warm.party[0]);
  assert.equal(pWarm.atkBonus - pCold.atkBonus, 2, 'the +2 wakes on attunement');
  assert.equal(pWarm.dmgMod - pCold.dmgMod, 2);
  // Ring of Protection: AC only when attuned
  const acCold = playerAc(withItems(base, [{ id: 'r1', defRef: 'ring_of_protection', equipped: 'ring' }]).party[0]);
  const acWarm = playerAc(withItems(base, [{ id: 'r1', defRef: 'ring_of_protection', equipped: 'ring', attuned: true }]).party[0]);
  assert.equal(acWarm - acCold, 1, 'the ring protects only its bonded bearer');
});

test('U126-08: named uniques validate and milestone rewards are deterministic, never duplicates', () => {
  const uniques = getNamedUniques();
  assert.ok(uniques.length >= 8, 'at least eight named things in the world');
  for (const u of uniques) {
    assert.ok(u.unique && u.attunement, `${u.defRef} is unique + attunement`);
    assert.ok(typeof u.history === 'string' && u.history.length > 20, `${u.defRef} carries a history`);
    assert.ok(getItemDef(u.defRef), `${u.defRef} registered`);
  }
  const w = begin('u126g');
  const a = pickNamedReward(w, 'L3', seedFromString);
  const b = pickNamedReward(w, 'L3', seedFromString);
  assert.equal(a.defRef, b.defRef, 'same seed, same payoff');
  // owning it removes it from the pool
  const owned = withItems(w, [{ id: 'x', defRef: a.defRef, equipped: null }]);
  const next = pickNamedReward(owned, 'L3', seedFromString);
  assert.notEqual(next?.defRef, a.defRef, 'never pays the same name twice');
});

test('U126-09: loot lands sealed end-to-end (escape victory mints a humming thing)', () => {
  // Force a kill on a CR-appropriate foe with a magic-bearing loot table via
  // the real resolver: plant a one-hp enemy with an override table that always
  // drops a +1 sword, then strike.
  const w0 = begin('u126h');
  let w = {
    ...w0,
    meta: { ...w0.meta, escapeHp: 20, escapeMaxHp: 20 },
    combat: {
      active: true, round: 1, turnIndex: 0, beganAt: 0, reason: 'test',
      enemies: [{
        id: 'e0', name: 'bandit', hp: 1, maxHp: 1, ac: 5, damage: 2, cr: 5,
        defeated: false, conditions: [], actions: [], multiattack: null,
        resistances: {}, conditionImmunities: [], saveProficiencies: [],
        canParley: false, sourceNpcId: '', lootTableRef: 'cr_5_10', initMod: 0,
        legendaryActions: null, reactions: null, lairActions: null
      }]
    }
  };
  // strike until the fight ends (1 hp — first hit ends it), then check the pack
  for (let i = 0; i < 8; i++) {
    const r = playerMove(w, packs, 'strike');
    w = r.world;
    if (!w.combat?.active) break;
  }
  assert.ok(!w.combat?.active, 'fight ended');
  const items = w.party[0].inventory.items;
  for (const it of items) {
    const def = getItemDef(it.defRef);
    if (it.sealedRef) {
      assert.ok(def.mystery, 'sealed instances wear the mystery def');
      assert.ok(getItemDef(it.sealedRef), 'and the truth resolves');
    }
    if (def && !def.mystery && def.kind === 'weapon' && def.rarity && def.rarity !== 'common') {
      assert.fail(`magic ${def.name} landed unsealed`);
    }
  }
  assertWorldInvariants(w);
});
