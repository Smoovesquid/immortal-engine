import test from 'node:test';
import assert from 'node:assert/strict';

import { makesAHome, lairProfileFor } from '../public/map/creatureHome.js';
import { getLair, LAIR_ARCHETYPES } from '../public/map/plans/lairs.js';
import { iconKindFor } from '../public/map/creatureIcons.js';
import { trivial } from '../engine/ruleset/core/bestiary/catalog/trivial.js';
import { minor } from '../engine/ruleset/core/bestiary/catalog/minor.js';
import { standard } from '../engine/ruleset/core/bestiary/catalog/standard.js';
import { elite } from '../engine/ruleset/core/bestiary/catalog/elite.js';

const ALL = [...trivial, ...minor, ...standard, ...elite];

test('U101: every home-making creature gets a resolvable lair profile', () => {
  let homed = 0, homeless = 0;
  for (const c of ALL) {
    const p = lairProfileFor(c);
    if (!makesAHome(c)) { assert.equal(p, null, `${c.ref} should be homeless`); homeless++; continue; }
    homed++;
    assert.ok(p, `${c.ref} should have a profile`);
    assert.ok(LAIR_ARCHETYPES.includes(p.archetype), `${c.ref} -> unknown archetype ${p.archetype}`);
    assert.ok(getLair(p.archetype), `${c.ref} archetype not resolvable`);
    assert.ok(p.tier >= 1 && p.tier <= 4, `${c.ref} tier`);
    assert.equal(p.iconKind, iconKindFor(c).kind, `${c.ref} icon mismatch`);
  }
  // The vast majority should den somewhere; only ephemera are homeless.
  assert.ok(homed > ALL.length * 0.9, `expected >90% homed, got ${homed}/${ALL.length}`);
});

test('U101: signature mappings are sensible', () => {
  const m = (ref, name, tags) => lairProfileFor({ ref, name, tags, tier: 'standard' }).archetype;
  assert.equal(m('giant_spider', 'Giant Spider', ['beast']), 'web_nest');
  assert.equal(m('dire_wolf', 'Dire Wolf', ['beast']), 'cave_den');
  assert.equal(m('skeleton', 'Skeleton', ['undead']), 'bone_pit');
  assert.equal(m('grave_wraith', 'Grave Wraith', ['undead', 'spirit']), 'ruin_haunt');
  assert.equal(m('cave_spider', 'Bog Hag', ['fey']), 'web_nest'); // spider keyword wins -> web
  assert.equal(m('fire_elemental', 'Fire Elemental', ['elemental']), 'ember_vent');
  assert.equal(m('roc', 'Roc', ['beast']), 'aerie');
  assert.equal(m('goblin', 'Goblin', ['humanoid']), 'warren');
  assert.equal(m('shrieker', 'Shrieker', ['plant']), 'thicket_den');
  assert.equal(m('young_dragon', 'Young Dragon', ['dragon']), 'cave_den');
});

test('U101: ephemera make no home', () => {
  assert.equal(makesAHome({ ref: 'fire_mote', name: 'Fire Mote', tags: ['elemental'] }), false);
  assert.equal(makesAHome({ ref: 'will_o_wisp', name: 'Will-o-Wisp', tags: ['spirit'] }), false);
  assert.equal(lairProfileFor({ ref: 'fire_mote', name: 'Fire Mote', tags: ['elemental'] }), null);
});

test('U101: deterministic', () => {
  assert.deepEqual(lairProfileFor(ALL[10]), lairProfileFor(ALL[10]));
});
