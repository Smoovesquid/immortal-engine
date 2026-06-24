// U273 — Pantheon data integrity.
// Asserts roster counts, axis coverage, sign presence, rite shape, and deed→axis mapping
// before Lane D wires any of this into engine state. Pure data — no engine imports.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  AXES,
  ALL_AXIS_POLES,
  CONTRARY_VIRTUES,
  CREATOR,
  SIN_GODS,
  VIRTUE_GODS,
  GODS_BY_ID,
  DEMON_BY_AXIS,
  ANGEL_BY_AXIS,
  DEED_CHARGES,
} from '../engine/morality/pantheon.js';

const VALID_POLARITIES = new Set(['dark', 'light']);
const VALID_SEVERITIES = new Set(['light', 'moderate', 'heavy']);
const VALID_TIERS      = new Set(['creator', 'demon', 'angel']);
const VALID_RITE_KINDS = new Set(['sigil', 'vigil']);

// ─── Roster counts ─────────────────────────────────────────────────────────────

describe('U273-A: roster counts', () => {
  it('there are exactly 7 axes', () => assert.equal(AXES.length, 7));
  it('every axis has a contrary virtue', () => {
    for (const ax of AXES) assert.ok(CONTRARY_VIRTUES[ax], `missing contrary for ${ax}`);
  });
  it('there are exactly 7 sin gods', () => assert.equal(SIN_GODS.length, 7));
  it('there are exactly 7 virtue gods', () => assert.equal(VIRTUE_GODS.length, 7));
  it('GODS_BY_ID has exactly 14 entries', () => assert.equal(Object.keys(GODS_BY_ID).length, 14));
});

// ─── Axis coverage ─────────────────────────────────────────────────────────────

describe('U273-B: every axis has exactly one demon and one angel', () => {
  for (const ax of AXES) {
    it(`axis "${ax}" has a demon`, () => {
      const demon = SIN_GODS.find(g => g.axis === ax);
      assert.ok(demon, `no sin god for axis ${ax}`);
      assert.equal(demon.tier, 'demon');
    });
    it(`axis "${ax}" has an angel (keyed by virtue name)`, () => {
      const virtueAxis = CONTRARY_VIRTUES[ax];
      const angel = VIRTUE_GODS.find(g => g.axis === virtueAxis);
      assert.ok(angel, `no virtue god for virtue axis "${virtueAxis}" (sin axis: ${ax})`);
      assert.equal(angel.tier, 'angel');
    });
  }
  it('DEMON_BY_AXIS covers all sin axes', () => {
    for (const ax of AXES) assert.ok(DEMON_BY_AXIS[ax], `DEMON_BY_AXIS missing ${ax}`);
  });
  it('ANGEL_BY_AXIS covers all virtue axes', () => {
    for (const ax of AXES) {
      const virtueAxis = CONTRARY_VIRTUES[ax];
      assert.ok(ANGEL_BY_AXIS[virtueAxis], `ANGEL_BY_AXIS missing virtue axis "${virtueAxis}"`);
    }
  });
});

// ─── God shape ─────────────────────────────────────────────────────────────────

describe('U273-C: every god has required fields', () => {
  const allGods = [...SIN_GODS, ...VIRTUE_GODS];
  for (const g of allGods) {
    it(`${g.id} has valid tier`, () => assert.ok(VALID_TIERS.has(g.tier)));
    it(`${g.id} has a name string`, () => assert.equal(typeof g.name, 'string'));
    it(`${g.id} has an axis in ALL_AXIS_POLES`, () => assert.ok(ALL_AXIS_POLES.includes(g.axis), `${g.id}.axis="${g.axis}" not in ALL_AXIS_POLES`));
    it(`${g.id} has at least one sign`, () => assert.ok(Array.isArray(g.signs) && g.signs.length > 0));
    it(`${g.id} has at least one drawnBy`, () => assert.ok(Array.isArray(g.drawnBy) && g.drawnBy.length > 0));
    it(`${g.id} has a gift string`, () => assert.ok(g.gift));
    it(`${g.id} has a rite with valid kind`, () => {
      assert.ok(g.rite, `${g.id} missing rite`);
      assert.ok(VALID_RITE_KINDS.has(g.rite.kind), `${g.id}.rite.kind="${g.rite.kind}" not valid`);
      assert.equal(typeof g.rite.name, 'string');
      assert.equal(typeof g.rite.act, 'string');
    });
  }
});

describe('U273-D: sin gods have betrayal and whim tables', () => {
  for (const g of SIN_GODS) {
    it(`${g.id} has betrayalTable (≥1 entry)`, () =>
      assert.ok(Array.isArray(g.betrayalTable) && g.betrayalTable.length >= 1));
    it(`${g.id} has whimTable (≥1 entry)`, () =>
      assert.ok(Array.isArray(g.whimTable) && g.whimTable.length >= 1));
  }
});

describe('U273-E: virtue gods have rite.works field', () => {
  for (const g of VIRTUE_GODS) {
    it(`${g.id} rite has a works string ("the vigil works")`, () =>
      assert.equal(typeof g.rite.works, 'string'));
  }
});

// ─── Creator shape ─────────────────────────────────────────────────────────────

describe('U273-F: Creator shape', () => {
  it('Creator tier is "creator"', () => assert.equal(CREATOR.tier, 'creator'));
  it('Creator axis is null', () => assert.equal(CREATOR.axis, null));
  it('Creator rite is null (cannot be petitioned)', () => assert.equal(CREATOR.rite, null));
  it('Creator has a ward string', () => assert.equal(typeof CREATOR.ward, 'string'));
  it('Creator ward mentions children', () => assert.ok(CREATOR.ward.toLowerCase().includes('child')));
});

// ─── Deed charges ──────────────────────────────────────────────────────────────

describe('U273-G: deed→axis mapping integrity', () => {
  it('DEED_CHARGES is a non-empty array', () => assert.ok(Array.isArray(DEED_CHARGES) && DEED_CHARGES.length > 0));

  for (const deed of DEED_CHARGES) {
    it(`deed "${deed.id}" has valid charges`, () => {
      assert.ok(Array.isArray(deed.charges) && deed.charges.length > 0,
        `${deed.id} has no charges`);
      for (const ch of deed.charges) {
        assert.ok(ALL_AXIS_POLES.includes(ch.axis),
          `${deed.id}: charge axis "${ch.axis}" not in ALL_AXIS_POLES`);
        assert.ok(VALID_POLARITIES.has(ch.polarity),
          `${deed.id}: charge polarity "${ch.polarity}" not valid`);
        assert.ok(VALID_SEVERITIES.has(ch.severity),
          `${deed.id}: charge severity "${ch.severity}" not valid`);
      }
    });
  }

  it('every axis pole appears in at least one deed charge', () => {
    const covered = new Set(DEED_CHARGES.flatMap(d => d.charges.map(c => c.axis)));
    for (const ax of ALL_AXIS_POLES) {
      assert.ok(covered.has(ax), `axis pole "${ax}" never appears in DEED_CHARGES`);
    }
  });

  it('both polarities appear in deed charges', () => {
    const pols = new Set(DEED_CHARGES.flatMap(d => d.charges.map(c => c.polarity)));
    assert.ok(pols.has('dark'));
    assert.ok(pols.has('light'));
  });
});

// ─── No engine imports, no side effects ────────────────────────────────────────

describe('U273-H: module is pure data (structural)', () => {
  it('SIN_GODS entries have no function values', () => {
    for (const g of SIN_GODS) {
      for (const [k, v] of Object.entries(g)) {
        if (k === 'rite') continue; // nested object — checked above
        assert.notEqual(typeof v, 'function', `${g.id}.${k} is a function`);
      }
    }
  });
  it('VIRTUE_GODS entries have no function values', () => {
    for (const g of VIRTUE_GODS) {
      for (const [k, v] of Object.entries(g)) {
        if (k === 'rite') continue;
        assert.notEqual(typeof v, 'function', `${g.id}.${k} is a function`);
      }
    }
  });
});
