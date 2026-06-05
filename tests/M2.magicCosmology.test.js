import test from 'node:test';
import assert from 'node:assert/strict';
import { GOVERNORS, governorFor, isCoercive, isForbidden, ascendantAeon } from '../engine/magic/cosmology.js';
import { castMoralCost, applyCastCost } from '../engine/magic/willCost.js';
import { daemonState, daemonCastBonus } from '../engine/magic/daemon.js';

const mkWorld = (deeds, seed = 'w', extra = {}) => ({ meta: { seed }, timeline: deeds.map((text, i) => ({ t: i, kind: 'resolution', data: { text } })), ecology: { corruption: 0, instability: 0, scarcity: 0 }, ...extra });

test('M2: a Governor for every school; coercive + forbidden flags are right', () => {
  assert.equal(GOVERNORS.length, 10);
  assert.equal(governorFor('evocation').epithet, 'The Unbound Flame');
  assert.equal(isCoercive('enchantment'), true);
  assert.equal(isCoercive('necromancy'), true);
  assert.equal(isCoercive('evocation'), false);
  assert.equal(isForbidden('chronomancy'), true);
  assert.equal(isForbidden('evocation'), false);
});

test('M2: an Aeon is ascendant per world, with a blessed school and a great taboo', () => {
  const a = ascendantAeon('mira');
  assert.ok(governorFor(a.blessed));
  assert.ok(a.taboo && a.taboo !== a.blessed);
  assert.deepEqual(ascendantAeon('mira'), ascendantAeon('mira'));
});

test('M2: coercing an unwilling will stains the world; the great sin scars it', () => {
  const w = mkWorld(['you speak softly']);
  const sin = castMoralCost({ world: w, school: 'enchantment', againstUnwilling: true });
  assert.ok(sin.corruption >= 6, 'overriding a True Will corrupts');
  assert.equal(sin.scar, 'will_broken');
  const necro = castMoralCost({ world: w, school: 'necromancy', againstUnwilling: true });
  assert.ok(necro.corruption > 0, 'dragging back the unwilling costs');
  const forbidden = castMoralCost({ world: w, school: 'chronomancy' });
  assert.ok(forbidden.corruption > 0 && forbidden.instability > 0, 'the forbidden Hour destabilises');
  const clean = castMoralCost({ world: mkWorld(Array(40).fill('you heal the hurt')), school: 'restoration' });
  assert.equal(clean.corruption, 0, 'aligned mending is clean');
});

test('M2: dissonant casting frays the caster; applyCastCost stains ecology + scars', () => {
  const wrath = mkWorld(Array(50).fill('you burn and slay'));
  const cost = castMoralCost({ world: wrath, school: 'restoration' });
  assert.ok(cost.fray > 0, 'forcing mending against a wrathful will frays you');

  const sin = castMoralCost({ world: wrath, school: 'enchantment', againstUnwilling: true });
  const after = applyCastCost(wrath, sin);
  assert.ok(after.ecology.corruption > wrath.ecology.corruption, 'the world darkens');
  assert.ok(after.scars && after.scars.some(s => s.id === 'will_broken'));
  assert.deepEqual(castMoralCost({ world: wrath, school: 'restoration' }), castMoralCost({ world: wrath, school: 'restoration' }));
});

test('M2: the Daemon stays hidden until deep play + the rite, then names the True Will', () => {
  const lived = mkWorld(Array(80).fill('you burn, you blast, you slay'));
  assert.equal(daemonState(lived, { riteAttained: false }).attained, false, 'no rite, no revelation');
  const shallow = mkWorld(['you slay one rat']);
  assert.equal(daemonState(shallow, { riteAttained: true }).attained, false, 'too little lived to have a Will worth knowing');

  const d = daemonState(lived, { riteAttained: true });
  assert.equal(d.attained, true);
  assert.equal(d.trueWill, 'evocation');
  assert.match(d.beat, /Unbound Flame/);
  assert.ok(daemonCastBonus(d, 'evocation') > 0 && daemonCastBonus(d, 'restoration') === 0, 'knowing yourself surews only your own magic');
});
