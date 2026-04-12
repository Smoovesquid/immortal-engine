// Pass B1 — bestiary shape validation.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BESTIARY_CATALOG } from '../engine/ruleset/core/bestiary/index.js';

const REQUIRED_FIELDS = ['ref', 'name', 'cr', 'xp', 'maxHp', 'ac', 'damage', 'actions', 'lootTableRef'];

describe('B01 — bestiary shape', () => {
  const entries = Object.entries(BESTIARY_CATALOG);

  it('catalog is non-empty', () => {
    assert.ok(entries.length >= 8, `expected at least 8 monsters, got ${entries.length}`);
  });

  for (const [key, def] of entries) {
    describe(key, () => {
      it('has all required fields', () => {
        for (const field of REQUIRED_FIELDS) {
          assert.ok(field in def, `missing field: ${field}`);
        }
      });

      it('ref matches catalog key', () => {
        assert.equal(def.ref, key);
      });

      it('cr is a positive number', () => {
        assert.equal(typeof def.cr, 'number');
        assert.ok(def.cr > 0, `cr must be positive, got ${def.cr}`);
      });

      it('maxHp >= 1', () => {
        assert.ok(def.maxHp >= 1);
      });

      it('ac >= 1', () => {
        assert.ok(def.ac >= 1);
      });

      it('damage >= 1', () => {
        assert.ok(def.damage >= 1);
      });

      it('actions is a non-empty array with name and damage', () => {
        assert.ok(Array.isArray(def.actions), 'actions must be an array');
        assert.ok(def.actions.length > 0, 'actions must be non-empty');
        for (const action of def.actions) {
          assert.ok(action.name, 'action must have a name');
          assert.ok(action.damage, 'action must have a damage field');
        }
      });
    });
  }
});
