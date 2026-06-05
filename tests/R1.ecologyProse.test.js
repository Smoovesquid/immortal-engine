import test from 'node:test';
import assert from 'node:assert/strict';
import { ecologyRumorSeeds } from '../engine/ecology/rumorSeeds.js';
import { composeDMLine } from '../engine/ai/dmProse.js';
import { buildTacticalContext } from '../engine/ai/tacticalContext.js';

const events = [
  { type: 'predator_boom', biome: 'forest', ref: 'dire_wolf', text: 'Dire Wolves grow bold in the forest — travelers go missing.' },
  { type: 'famine', biome: 'marsh', text: 'Game thins and the green fails across the marsh; hunger spreads.' }
];

test('R1: ecology events become true rumor seeds for the mint pipeline', () => {
  const seeds = ecologyRumorSeeds(events, { seed: 'mira', nameOf: r => 'Dire Wolf' });
  assert.equal(seeds.length, 2);
  const boom = seeds.find(s => s.tags.includes('predator_boom'));
  assert.equal(boom.truthBody, events[0].text, 'the truth body is the real event');
  assert.ok(boom.tags.includes('ecology') && boom.tags.includes('forest'));
  assert.match(boom.primaryName, /bold in the forest/);
  assert.equal(new Set(seeds.map(s => s.id)).size, seeds.length, 'unique ids');
});

test('R1: rumor seeds are deterministic', () => {
  assert.deepEqual(ecologyRumorSeeds(events, { seed: 'mira' }), ecologyRumorSeeds(events, { seed: 'mira' }));
});

test('R1: DM prose names the seen, hints the sensed, never the hidden', () => {
  const player = { id: 'pc', x: 10, y: 10 };
  const actors = [
    { id: 'wolf', name: 'Gray Wolf', faction: 'enemy', x: 11, y: 10 }, // visible
    { id: 'bandit', name: 'Bandit', faction: 'enemy', x: 13, y: 6 }    // sensed, hidden
  ];
  const tactical = buildTacticalContext({ player, actors, visible: new Set(['11,10']), awareness: 12 });
  const seeds = ecologyRumorSeeds(events, { seed: 'mira' });
  const line = composeDMLine({ place: 'the Sunken Keep', tone: 'grim', tactical, rumors: seeds, lastAction: 'Your blade finds its mark.' });

  assert.match(line, /Gray Wolf/, 'seen creature is named');
  assert.ok(!/Bandit/.test(line), 'hidden creature is never named');
  assert.match(line, /stirs to the/, 'the hidden one becomes a sensed hint');
  assert.match(line, /Sunken Keep/);
  assert.match(line, /blade finds its mark/, 'last action included');
  assert.match(line, /recall the talk/, 'a rumor beat is woven in');
});

test('R1: prose is deterministic and offline (no API)', () => {
  const t = buildTacticalContext({ player: { id: 'pc', x: 0, y: 0 }, actors: [], visible: new Set() });
  const a = composeDMLine({ place: 'a quiet glade', tone: 'cooperative', tactical: t, seedKey: 'k' });
  const b = composeDMLine({ place: 'a quiet glade', tone: 'cooperative', tactical: t, seedKey: 'k' });
  assert.equal(a, b);
  assert.ok(a.length > 0);
});
