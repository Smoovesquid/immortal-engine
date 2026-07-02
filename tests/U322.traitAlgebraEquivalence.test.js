// U322: TA-1 — the trait algebra migration is byte-identical to the legacy hooks.
//
// docs/briefs/COMBAT_TRAIT_ALGEBRA.md packet TA-1: engine/combat/traitHooks.js
// became a DATA registry (effect atoms) with the legacy hook API generated from
// the atoms. This suite is the oracle: it diffs the live module against the
// frozen pre-TA-1 implementation (tests/fixtures/traitHooksLegacy.fixture.js,
// verbatim copy) across EVERY creature in all four bestiary catalogs plus
// synthetic trait sets, over a value grid covering every clamp/param path.
// Any atom edit that changes a legacy trait's number or fiction line fails here.
//
// Full return objects are compared — hpDelta, revive hp, AND summaryPart
// strings (the fiction the DM receives; THE LAW's surface).

import test from 'node:test';
import assert from 'node:assert/strict';

import * as live from '../engine/combat/traitHooks.js';
import * as legacy from './fixtures/traitHooksLegacy.fixture.js';

import { trivial } from '../engine/ruleset/core/bestiary/catalog/trivial.js';
import { minor } from '../engine/ruleset/core/bestiary/catalog/minor.js';
import { standard } from '../engine/ruleset/core/bestiary/catalog/standard.js';
import { elite } from '../engine/ruleset/core/bestiary/catalog/elite.js';

const CATALOG = [...trivial, ...minor, ...standard, ...elite];

// The 45 names registered pre-TA-1 (pins the registry contents — adding or
// dropping a name is a deliberate act that must touch this list).
const REGISTERED = [
  'Regeneration', 'Dire Regeneration', 'Fungal Regeneration', 'Regenerative Heads',
  'Pack Tactics', 'Flock Tactics', 'Reckless', 'Reckless Attack', 'Aggressive', 'Aggressive Charge',
  'Brute', 'Sneak Attack', 'Assassinate', 'Surprise Strike', 'Death Strike', 'Precision Strike',
  'Natural Armor', 'Armored', 'Shell Armor', 'Crystal Hide', 'Metal Hide', 'Iron Body',
  'Ironwood Body', 'Spectral Armor', 'Barbed Hide', 'Thorn Armor', 'Adaptive Armor', 'Rune Armor',
  'Magic Resistance', 'Spell Resistance',
  'Evasion', 'Avoidance', 'Uncanny Dodge',
  'Heated Body', 'Fire Form', 'Fire Aura', 'Acid Blood', 'Corrosive Body', 'Cold Aura', 'Storm Aura',
  'Undead Fortitude', 'Undead Persistence', 'Rejuvenation', 'Reassemble', 'Reforming'
];

// Synthetic trait sets exercising param parsing, stacking, mixed ops, and the
// unknown-name pass-through.
const SYNTHETIC = [
  ...REGISTERED.map(n => [n]),                                   // every name singly
  ['Regeneration (15 HP/round, stops with radiant)'],            // param parse
  ['Dire Regeneration (25 HP)'],                                 // param parse
  ['Regeneration (0 HP)'],                                       // Number('0')||10 fallback quirk
  ['Fungal Regeneration (8 HP)'],                                // param IGNORED (no parse spec)
  ['Regeneration', 'Dire Regeneration'],                         // same-channel stacking (dire_troll)
  ['Natural Armor', 'Natural Armor'],                            // duplicate-name stacking
  ['Evasion', 'Uncanny Dodge'],                                  // the mixed-op creature (wind_dancer)
  ['Uncanny Dodge', 'Evasion'],                                  // reversed declaration order
  ['Undead Fortitude', 'Rejuvenation'],                          // FIRST-WINS revive
  ['Rejuvenation', 'Undead Fortitude'],                          // reversed
  ['Pack Tactics', 'Reckless', 'Brute', 'Shell Armor', 'Evasion', 'Undead Fortitude'], // all channels at once
  ['False Appearance', 'Keen Smell', 'Totally Made Up Trait'],   // unknown → inert
  [],                                                            // trait-less
  ['Magic Resistance (advantage on saves)']                      // parenthetical on a non-param trait
];

// Worlds for the allyStanding predicate: an ally up / self only / no combat.
const mkWorld = (enemies) => ({ combat: { enemies } });
const WORLDS = (self) => [
  mkWorld([{ id: self.id, hp: self.hp }, { id: 'ally', hp: 9 }, { id: 'down', hp: 0 }]),
  mkWorld([{ id: self.id, hp: self.hp }]),
  {}
];

const AC_GRID = [8, 10, 14, 20];
const TOHIT_GRID = [5, 12, 25];
const DEALT_GRID = [0, 1, 2, 3, 5, 8, 13, 21, 30];
const TAKEN_GRID_FULL = Array.from({ length: 61 }, (_, i) => i); // 0..60
const TAKEN_GRID_FAST = [0, 1, 2, 3, 4, 5, 7, 10, 13, 25, 60];
const DMG_TYPES = ['slashing', 'fire', 'cold'];
const HP_STATES = [
  { hp: 1, maxHp: 30 }, { hp: 15, maxHp: 30 }, { hp: 30, maxHp: 30 },
  { hp: 0, maxHp: 30 }, { hp: 5, maxHp: undefined }
];
const DEATH_MAXHP = [1, 7, 30, undefined];

function diffOneTraitSet(traits, label, takenGrid) {
  // AC
  for (const base of AC_GRID) {
    const e = { id: 'e1', name: 'Foe', traits };
    assert.deepStrictEqual(live.applyACTraits(e, base), legacy.applyACTraits(e, base), `${label} · applyACTraits(${base})`);
  }
  // to-hit (ally present / solo / no combat)
  for (const base of TOHIT_GRID) {
    const e = { id: 'e1', name: 'Foe', hp: 12, traits };
    for (const w of WORLDS(e)) {
      assert.deepStrictEqual(live.applyToHitTraits(e, base, w), legacy.applyToHitTraits(e, base, w), `${label} · applyToHitTraits(${base})`);
    }
  }
  // damage dealt
  for (const base of DEALT_GRID) {
    const e = { id: 'e1', name: 'Foe', traits };
    assert.deepStrictEqual(live.applyDamageDealtTraits(e, base), legacy.applyDamageDealtTraits(e, base), `${label} · applyDamageDealtTraits(${base})`);
  }
  // damage taken × type
  for (const base of takenGrid) {
    for (const t of DMG_TYPES) {
      const e = { id: 'e1', name: 'Foe', traits };
      assert.deepStrictEqual(live.applyDamageTakenTraits(e, base, t), legacy.applyDamageTakenTraits(e, base, t), `${label} · applyDamageTakenTraits(${base}, ${t})`);
    }
  }
  // turn start (clamp paths: wounded / mid / full / down / no maxHp)
  for (const hs of HP_STATES) {
    const e = { id: 'e1', name: 'The Foe', traits, ...hs };
    assert.deepStrictEqual(live.applyTurnStartTraits(e, {}), legacy.applyTurnStartTraits(e, {}), `${label} · applyTurnStartTraits(hp:${hs.hp}/${hs.maxHp})`);
  }
  // death (revive fractions across maxHp, incl. the undefined→NaN→1 path)
  for (const maxHp of DEATH_MAXHP) {
    const e = { id: 'e1', name: 'The Foe', traits, hp: 0, maxHp };
    assert.deepStrictEqual(live.applyDeathTraits(e, {}), legacy.applyDeathTraits(e, {}), `${label} · applyDeathTraits(maxHp:${maxHp})`);
  }
  // hook-shape equality: same channels populated, same traitStr attribution
  const shape = (h) => Object.fromEntries(Object.entries(h).map(([ch, list]) => [ch, list.map(x => x.traitStr)]));
  assert.deepStrictEqual(shape(live.getTraitHooks(traits)), shape(legacy.getTraitHooks(traits)), `${label} · getTraitHooks shape`);
}

test('U322-01: registry census matches the frozen oracle (45 names, hasTraitHook agrees)', () => {
  assert.equal(live.REGISTERED_TRAIT_COUNT, legacy.REGISTERED_TRAIT_COUNT, 'REGISTERED_TRAIT_COUNT');
  assert.equal(live.REGISTERED_TRAIT_COUNT, 45, 'the TA-1 registry holds exactly the 45 legacy names');
  for (const n of REGISTERED) {
    assert.equal(live.hasTraitHook(n), true, `live registers '${n}'`);
    assert.equal(legacy.hasTraitHook(n), true, `oracle registers '${n}'`);
  }
  // every distinct name in the whole catalog classifies identically
  const seen = new Set();
  for (const c of CATALOG) for (const t of (c.traits || [])) seen.add(String(t));
  for (const t of seen) {
    assert.equal(live.hasTraitHook(t), legacy.hasTraitHook(t), `hasTraitHook('${t}')`);
  }
});

test('U322-02: synthetic trait sets — every name, param strings, stacking, mixed ops, unknowns', () => {
  for (const traits of SYNTHETIC) {
    diffOneTraitSet(traits, `[${traits.join(' + ') || 'none'}]`, TAKEN_GRID_FULL);
  }
});

test('U322-03: the full bestiary catalog — all four tiers, every creature trait set, byte-identical', () => {
  assert.ok(CATALOG.length >= 600, `catalog loaded (${CATALOG.length} creatures)`);
  for (const c of CATALOG) {
    const traits = Array.isArray(c.traits) ? c.traits : [];
    diffOneTraitSet(traits, c.ref || c.name, TAKEN_GRID_FAST);
  }
});

test('U322-04: getTraitAtoms (the new algebra surface) agrees with the legacy channel census', () => {
  // For every catalog creature: the atoms' channels must match exactly the
  // channels the legacy implementation populated, in the same trait order.
  const CH_TO_HOOK = {
    turnStart: 'onTurnStart', toHit: 'modifyToHit', dmgDealt: 'modifyDamageDealt',
    dmgTaken: 'modifyDamageTaken', ac: 'modifyAC', death: 'onDeath'
  };
  for (const c of CATALOG) {
    const traits = Array.isArray(c.traits) ? c.traits : [];
    const atoms = live.getTraitAtoms(traits);
    const legacyHooks = legacy.getTraitHooks(traits);
    const fromAtoms = {};
    for (const { atom, traitStr } of atoms) {
      const key = CH_TO_HOOK[atom.ch];
      (fromAtoms[key] = fromAtoms[key] || []).push(traitStr);
    }
    for (const [ch, list] of Object.entries(legacyHooks)) {
      assert.deepStrictEqual(fromAtoms[ch] || [], list.map(x => x.traitStr), `${c.ref} · atoms cover legacy channel ${ch}`);
    }
  }
});
