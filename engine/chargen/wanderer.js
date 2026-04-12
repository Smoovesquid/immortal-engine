import { createCharacter } from './genesis.js';

/**
 * createWanderer — slice archetype for the Westmarch vertical slice.
 * A traveler arriving in the Westmarch, using the fantasy pack defaults.
 */
export function createWanderer({ seed = 'seed', fate = 0.2, name = '', ritualPicks = null } = {}) {
  return createCharacter({
    seed,
    packId: 'fantasy',
    fate,
    packGear: null,
    name: name || undefined,
    archetype: 'Wanderer',
    statMethod: '2d6+2',
    darkFate: true,
    ritualPicks
  });
}
