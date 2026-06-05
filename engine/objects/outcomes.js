// Object Outcomes — deterministic behavior when objects are manipulated
// No RNG: outcomes follow from object state + material properties.

import { schema } from './schema.js';

// What happens when an object is broken?
export function breakOutcome(obj) {
  if (!obj) return { pieces: [], noise: 2, damage: 0, possible: false };

  const material = obj.material || schema.MATERIALS.WOOD;
  const progression = schema.getStateProgression(material);

  // Can't break if already destroyed
  if (obj.state === 'destroyed' || !progression.includes('destroyed')) {
    return { pieces: [], noise: 0, damage: 0, possible: false };
  }

  const outcome = schema.getBreakOutcome(material);
  const parts = Array.isArray(obj.parts) ? obj.parts.length : 0;

  return {
    possible: true,
    pieces: outcome.pieces,
    noise: outcome.noise,
    damage: outcome.damage,
    partCount: parts,
    nextState: 'damaged' // or destroyed if already damaged
  };
}

// What happens when an object is taken?
export function takeOutcome(obj) {
  if (!obj) return { possible: false, noise: 0, bulk: 0, encumbrance: false };

  const bulk = Number(obj.bulk || 2);
  if (bulk > 2) {
    return {
      possible: false,
      reason: 'too-heavy',
      noise: 0,
      bulk
    };
  }

  return {
    possible: true,
    noise: bulk > 0 ? 1 : 0,
    bulk,
    encumbrance: bulk >= 2
  };
}

// What happens when an object burns?
export function burnOutcome(obj) {
  if (!obj) return { possible: false, damage: 0, ash: null };

  const material = obj.material || schema.MATERIALS.WOOD;
  const props = schema.MATERIAL_PROPERTIES[material];

  if (!props || props.flammable < 2) {
    return { possible: false, damage: 0 };
  }

  const flammability = props.flammable;
  return {
    possible: true,
    damage: Math.min(3, Math.ceil(flammability / 2)),
    noise: flammability * 1, // more flammable = louder
    ash: true,
    nextState: 'burned'
  };
}

// What happens when a part is extracted from an object?
export function extractPartOutcome(obj, partName) {
  if (!obj || !Array.isArray(obj.parts)) {
    return { possible: false };
  }

  const partIdx = obj.parts.indexOf(String(partName));
  if (partIdx === -1) {
    return { possible: false, reason: 'part-not-found' };
  }

  const material = obj.material || schema.MATERIALS.WOOD;
  const props = schema.MATERIAL_PROPERTIES[material];

  return {
    possible: true,
    partName,
    noise: props ? props.noise + 1 : 1, // louder than taking
    weight: props ? Math.ceil(props.weight / 2) : 1,
    remainingParts: obj.parts.length - 1,
    nextState: obj.parts.length <= 1 ? 'destroyed' : 'damaged'
  };
}

// Predict item properties when taken/created
export function itemPropertiesFromObject(obj) {
  if (!obj) {
    return { weight: 1, noise: 0, light: 0, bulk: 1 };
  }

  const material = obj.material || schema.MATERIALS.WOOD;
  const props = schema.MATERIAL_PROPERTIES[material];
  if (!props) {
    return { weight: 1, noise: 0, light: 0, bulk: 1 };
  }

  // Scale down item properties from object
  return {
    weight: Math.max(1, Math.ceil(props.weight / 2)),
    noise: Math.max(0, props.noise - 1),
    light: props.light > 4 ? 2 : props.light > 0 ? 1 : 0,
    bulk: Math.max(1, Math.ceil(props.bulk / 3))
  };
}

// Narrative flavor by material + outcome
export function outcomeNarrative(obj, actionType) {
  if (!obj) return '';

  const material = obj.material || schema.MATERIALS.WOOD;
  const name = String(obj.name || 'object');

  const narratives = {
    [schema.MATERIALS.WOOD]: {
      break: `You wrench the ${name} apart. Wood splinters crash down.`,
      burn: `The ${name} catches fire, flames licking up the wood.`,
      take: `You grab the wooden ${name}.`
    },
    [schema.MATERIALS.STONE]: {
      break: `You strike the ${name}. Stone cracks with a sharp sound.`,
      burn: `The ${name} resists the flames, unchanged.`,
      take: `You lift the heavy stone ${name}.`
    },
    [schema.MATERIALS.METAL]: {
      break: `You hit the ${name}. Metal rings out with a deafening clang.`,
      burn: `The ${name} glows in the heat but does not burn.`,
      take: `You heft the ${name}, feeling its weight.`
    },
    [schema.MATERIALS.GLASS]: {
      break: `The ${name} shatters into razor-sharp shards.`,
      burn: `The ${name} glows but does not ignite.`,
      take: `You carefully take the delicate ${name}.`
    },
    [schema.MATERIALS.CLOTH]: {
      break: `The ${name} tears easily in your hands.`,
      burn: `The ${name} catches fire and burns quickly.`,
      take: `You gather up the ${name}.`
    },
    [schema.MATERIALS.CERAMIC]: {
      break: `The ${name} breaks into rough pieces.`,
      burn: `The ${name} is unaffected by heat.`,
      take: `You take the ${name} carefully.`
    },
    [schema.MATERIALS.ORGANIC]: {
      break: `The ${name} crumbles in your hands.`,
      burn: `The ${name} ignites easily, burning to ash.`,
      take: `You take the ${name}.`
    }
  };

  const materialNarratives = narratives[material] || narratives[schema.MATERIALS.WOOD];
  return materialNarratives[actionType] || '';
}

export const outcomes = {
  breakOutcome,
  takeOutcome,
  burnOutcome,
  extractPartOutcome,
  itemPropertiesFromObject,
  outcomeNarrative
};
