import { seedFromString, makeRng } from '../rng.js';
import { rollStats } from './stats.js';
import { rollBackground, rollBackgroundOptions } from './backgrounds.js';
import { buildLoadout } from './gear.js';
import { rollDarkFate } from './fate.js';
import { rollDetailOptions, normalizeRitualPicks } from './details.js';

export function createCharacter({ seed = 'seed', packId = 'fantasy', fate = 0.2, packGear = null, name = '', archetype = '', statMethod = '2d6+2', darkFate = true, ritualPicks = null } = {}) {
  const baseSeed = `${seed}|chargen|${packId}|f${Math.round(Number(fate) * 100)}|m:${statMethod}`;
  const rng = makeRng(seedFromString(baseSeed));

  const nameFinal = name ? String(name) : (rng.pick(defaultNames(packId)) || 'Unnamed');

  const bgRng = makeRng(seedFromString(`${baseSeed}|bg`));
  const bg = archetype
    ? { name: String(archetype), tags: [], hook: '' }
    : rollBackground(packId, bgRng);

  const statsRng = makeRng(seedFromString(`${baseSeed}|stats`));
  const stats = rollStats({ method: statMethod, rng: statsRng });

  const gearRng = makeRng(seedFromString(`${baseSeed}|gear|${bg.name}`));
  const { inventory, signature } = buildLoadout({ packGear, tags: bg.tags, rng: gearRng });

  const fateRng = makeRng(seedFromString(`${baseSeed}|darkfate`));
  const df = darkFate ? rollDarkFate(fateRng) : null;

  const traits = rollTraits(packId, rng);

  const ritualOpts = rollDetailOptions(packId, baseSeed, makeRng(seedFromString(`${baseSeed}|ritual`)));
  const ritual = normalizeRitualPicks(ritualOpts, ritualPicks);

  const meaning = signature ? (rng.pick(['a reminder', 'a dare', 'a debt', 'an apology', 'a key to nowhere']) || 'a reminder') : '';

  return {
    id: `pc_${seedFromString(`${baseSeed}|id|${nameFinal}`)}`,
    name: nameFinal,
    archetype: bg.name,
    vibe: traits.vibe,
    stress: 0,
    wounds: 0,

    stats: stats.stats,
    mods: stats.mods,
    rollDetails: { method: statMethod, dice: stats.dice },

    inventory,

    traits: {
      vibe: traits.vibe,
      fear: traits.fear,
      flaw: traits.flaw,
      ideal: traits.ideal,
      detail: ritual.detail,
      keepsake: ritual.keepsake,
      lineYouWontCross: ritual.lineYouWontCross,
      rumor: ritual.rumor
    },

    background: {
      name: bg.name,
      tags: bg.tags,
      hook: bg.hook,
      darkFate: df
    },

    signature: signature ? { itemName: signature.name || 'Thing', meaning } : { itemName: 'Thing', meaning },

    // Back-compat fields expected by UI
    position: { zone: 'far' }
  };
}

export function rollGenesisOptions({ seed = 'seed', packId = 'fantasy' } = {}) {
  const baseSeed = `${seed}|chargen|${packId}|options`;
  const rng = makeRng(seedFromString(baseSeed));
  const options = rollBackgroundOptions(packId, rng, 3);
  return options;
}

function rollTraits(packId, rng) {
  const vibes = {
    fantasy: ['grave', 'curious', 'reckless', 'solemn', 'hungry'],
    haunted: ['wired', 'quiet', 'skeptical', 'obsessed', 'tender'],
    zombie: ['pragmatic', 'mean-funny', 'paranoid', 'tired', 'protective'],
    modern: ['sharp', 'burned', 'driven', 'jaded', 'nice-on-purpose'],
    'space-rift': ['spaced-out', 'alert', 'corporate-cold', 'stubborn', 'laughing-too-late']
  };
  const fears = ['dark water', 'closed doors', 'open skies', 'being watched', 'being needed'];
  const flaws = ['too honest', 'too loyal', 'too proud', 'too curious', 'too quick'];
  const ideals = ['mercy', 'truth', 'profit', 'revenge', 'duty'];

  const v = rng.pick(vibes[packId] || vibes.fantasy) || 'grim';
  return {
    vibe: v,
    fear: rng.pick(fears) || fears[0],
    flaw: rng.pick(flaws) || flaws[0],
    ideal: rng.pick(ideals) || ideals[0]
  };
}

function defaultNames(packId) {
  if (packId === 'space-rift') return ['Mara', 'Jax', 'Sable', 'Kite', 'Rin', 'Ollo', 'Voss', 'Irie'];
  if (packId === 'modern') return ['Casey', 'Drew', 'Morgan', 'Reese', 'Avery', 'Noah', 'Sam', 'Jules'];
  if (packId === 'zombie') return ['Harper', 'Gus', 'Lena', 'Vic', 'Tess', 'Miles', 'Pax', 'June'];
  if (packId === 'haunted') return ['Elowen', 'Nico', 'Mae', 'Silas', 'Ivy', 'Rowan', 'Clove', 'Bea'];
  return ['Thorn', 'Mira', 'Bran', 'Sera', 'Orin', 'Nyx', 'Garr', 'Lark'];
}
