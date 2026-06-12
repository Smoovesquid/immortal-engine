// Pass B5 — full tier-pool shape validation.
//
// B01 only validates the eight hand-authored named creatures in BESTIARY_CATALOG.
// The bulk of the bestiary lives in the four tier catalogs (trivial/minor/standard/
// elite) and was historically unvalidated — which is how seven duplicate refs and
// drifting field shapes crept in. This guard locks the whole pool down:
//
//   • every creature carries EXACTLY the 32-field universal contract (no missing
//     fields, no stray extras),
//   • refs are unique across the entire pool (a ref collision shadows a creature —
//     getMonsterDef dedupes "first wins", so a dupe silently makes one unreachable),
//   • cr sits inside its tier's band,
//   • the `tier` field matches the catalog it lives in,
//   • the narrative fields that make a creature more than a stat block are present
//     and non-trivial (this is a "no stubs" bestiary), and
//   • actions are real (named, with a damage field) and tags are non-empty.
//
// New creatures must pass this on the way in. If you add a field to the contract,
// add it to UNIVERSAL_FIELDS here and backfill every creature.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { trivial } from '../engine/ruleset/core/bestiary/catalog/trivial.js';
import { minor } from '../engine/ruleset/core/bestiary/catalog/minor.js';
import { standard } from '../engine/ruleset/core/bestiary/catalog/standard.js';
import { elite } from '../engine/ruleset/core/bestiary/catalog/elite.js';

const TIERS = { trivial, minor, standard, elite };

// The 32-field universal contract shared by every tier creature. Tier creatures
// intentionally omit the named-creature `xp` / top-level `damage` fields — their
// actions carry the dice — so those are NOT in this set.
const UNIVERSAL_FIELDS = [
  'ac', 'actions', 'behavior', 'canParley', 'conditionImmunities', 'cr',
  'ecology', 'encounterSign', 'gear', 'habitat', 'lairActions', 'languages',
  'legendaryActions', 'lootTableRef', 'loreHook', 'maxHp', 'multiattack',
  'name', 'physicalDescription', 'reactions', 'ref', 'resistances',
  'saveProficiencies', 'senses', 'socialStructure', 'speed', 'spellcasting',
  'stats', 'tags', 'tier', 'traits', 'weakness'
];

// P-75: boss-tier creatures may additionally author `phases` — a ½-HP phase
// trigger with a narration beat and an unlocked action (see
// engine/combat/bossActions.js). Optional: absent entries get the default
// bloodied phase at runtime, so there is nothing to backfill.
const OPTIONAL_FIELDS = ['phases'];

// CR bands per tier (inclusive). Elite allows 6 per its documented header even
// though the current floor sits at 7.
const CR_BANDS = {
  trivial: [0, 0.5],
  minor: [0.5, 2],
  standard: [3, 5],
  elite: [6, 10]
};

// Narrative fields that must be present and substantive — this is what keeps the
// bestiary from degrading into stat-block stubs.
const NARRATIVE_FIELDS = ['ecology', 'behavior', 'encounterSign', 'physicalDescription', 'weakness', 'loreHook'];

describe('B05 — full tier-pool shape', () => {
  it('pool is large and every tier is populated', () => {
    for (const [tier, arr] of Object.entries(TIERS)) {
      assert.ok(Array.isArray(arr) && arr.length > 0, `${tier} tier is empty`);
    }
    const total = Object.values(TIERS).reduce((n, a) => n + a.length, 0);
    assert.ok(total >= 596, `expected >= 596 tier creatures, got ${total}`);
  });

  it('refs are unique across the entire pool', () => {
    const seen = new Map(); // ref -> tier
    const collisions = [];
    for (const [tier, arr] of Object.entries(TIERS)) {
      for (const c of arr) {
        if (seen.has(c.ref)) collisions.push(`${c.ref} (${seen.get(c.ref)} + ${tier})`);
        else seen.set(c.ref, tier);
      }
    }
    assert.deepEqual(collisions, [], `duplicate refs shadow creatures: ${collisions.join(', ')}`);
  });

  for (const [tier, arr] of Object.entries(TIERS)) {
    describe(`${tier} tier`, () => {
      for (const c of arr) {
        describe(c.ref || '(no ref)', () => {
          it('carries exactly the 32-field universal contract', () => {
            const keys = Object.keys(c);
            const missing = UNIVERSAL_FIELDS.filter(f => !(f in c));
            const extra = keys.filter(k => !UNIVERSAL_FIELDS.includes(k) && !OPTIONAL_FIELDS.includes(k));
            assert.deepEqual(missing, [], `missing fields: ${missing.join(', ')}`);
            assert.deepEqual(extra, [], `unexpected fields: ${extra.join(', ')}`);
          });

          it('tier field matches its catalog', () => {
            assert.equal(c.tier, tier, `tier field "${c.tier}" but lives in ${tier}`);
          });

          it('cr sits inside the tier band', () => {
            const [lo, hi] = CR_BANDS[tier];
            assert.equal(typeof c.cr, 'number', 'cr must be a number');
            assert.ok(c.cr >= lo && c.cr <= hi, `cr ${c.cr} outside [${lo}, ${hi}]`);
          });

          it('has sane core stats', () => {
            assert.ok(c.maxHp >= 1, `maxHp ${c.maxHp}`);
            assert.ok(c.ac >= 1, `ac ${c.ac}`);
            assert.ok(c.stats && typeof c.stats === 'object', 'stats object');
            assert.equal(typeof c.canParley, 'boolean', 'canParley boolean');
          });

          it('actions are real (named, with damage)', () => {
            assert.ok(Array.isArray(c.actions) && c.actions.length > 0, 'actions non-empty');
            for (const a of c.actions) {
              assert.ok(a && a.name, 'action needs a name');
              assert.ok('damage' in a, `action "${a.name}" needs a damage field`);
            }
          });

          it('has at least one tag', () => {
            assert.ok(Array.isArray(c.tags) && c.tags.length > 0, 'tags non-empty');
          });

          it('lootTableRef looks like {family}_{tier}', () => {
            assert.equal(typeof c.lootTableRef, 'string');
            assert.ok(c.lootTableRef.includes('_'), `loot "${c.lootTableRef}"`);
          });

          it('narrative fields are present and substantive', () => {
            for (const f of NARRATIVE_FIELDS) {
              assert.equal(typeof c[f], 'string', `${f} must be a string`);
              assert.ok(c[f].trim().length >= 10, `${f} too short to be real prose`);
            }
          });
        });
      }
    });
  }
});
