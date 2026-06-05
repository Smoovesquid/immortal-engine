import test from 'node:test';
import assert from 'node:assert/strict';

import { iconKindFor } from '../public/map/creatureIcons.js';
import { trivial } from '../engine/ruleset/core/bestiary/catalog/trivial.js';
import { minor } from '../engine/ruleset/core/bestiary/catalog/minor.js';
import { standard } from '../engine/ruleset/core/bestiary/catalog/standard.js';
import { elite } from '../engine/ruleset/core/bestiary/catalog/elite.js';

const ALL = [...trivial, ...minor, ...standard, ...elite];
const VALID = new Set(['quadruped', 'predator', 'ursine', 'monstrosity', 'biped', 'brute', 'fiend', 'undead', 'serpent', 'arachnid', 'swarm', 'ooze', 'flyer', 'dragon', 'construct', 'elemental', 'aberration', 'parasite', 'plant', 'wraith']);

test('U99: every bestiary creature classifies to a valid icon kind + color', () => {
  assert.ok(ALL.length > 600, `expected the full bestiary, got ${ALL.length}`);
  let bad = 0;
  for (const c of ALL) {
    const ic = iconKindFor(c);
    if (!VALID.has(ic.kind)) { bad++; if (bad < 6) console.error('bad kind', c.ref, ic.kind); }
    assert.match(ic.color, /^#[0-9a-f]{6}$/i, `${c.ref} color`);
  }
  assert.equal(bad, 0, `${bad} creatures got an invalid icon kind`);
});

test('U99: keyword overrides beat the tag (a giant spider is an arachnid)', () => {
  assert.equal(iconKindFor({ ref: 'giant_spider', name: 'Giant Spider', tags: ['beast'] }).kind, 'arachnid');
  assert.equal(iconKindFor({ ref: 'cave_viper', name: 'Cave Viper', tags: ['beast'] }).kind, 'serpent');
  assert.equal(iconKindFor({ ref: 'brown_bear', name: 'Brown Bear', tags: ['beast'] }).kind, 'ursine');
  assert.equal(iconKindFor({ ref: 'dire_wolf', name: 'Dire Wolf', tags: ['beast'] }).kind, 'predator');
  assert.equal(iconKindFor({ ref: 'rot_grub', name: 'Rot Grub', tags: ['beast', 'parasite'] }).kind, 'parasite');
});

test('U99: tag fallback covers the major families', () => {
  assert.equal(iconKindFor({ ref: 'x', tags: ['undead'] }).kind, 'undead');
  assert.equal(iconKindFor({ ref: 'x', tags: ['ooze'] }).kind, 'ooze');
  assert.equal(iconKindFor({ ref: 'x', tags: ['construct'] }).kind, 'construct');
  assert.equal(iconKindFor({ ref: 'x', tags: ['elemental'] }).kind, 'elemental');
  assert.equal(iconKindFor({ ref: 'x', tags: ['aberration'] }).kind, 'aberration');
  assert.equal(iconKindFor({ ref: 'x', tags: ['plant'] }).kind, 'plant');
  assert.equal(iconKindFor({ ref: 'x', tags: ['giant'] }).kind, 'brute');
  assert.equal(iconKindFor({ ref: 'x', tags: ['spirit'] }).kind, 'wraith');
  assert.equal(iconKindFor({ ref: 'x', tags: ['fiend'] }).kind, 'fiend');
});

test('U99: feature modifiers — elite is large, dragons are winged, fiends horned', () => {
  assert.equal(iconKindFor({ ref: 'x', tags: ['dragon'], tier: 'elite' }).large, true);
  assert.equal(iconKindFor({ ref: 'red_dragon', tags: ['dragon'] }).winged, true);
  assert.equal(iconKindFor({ ref: 'pit_fiend', tags: ['fiend'] }).horned, true);
});

test('U99: deterministic', () => {
  const a = iconKindFor(ALL[0]); const b = iconKindFor(ALL[0]);
  assert.deepEqual(a, b);
});
