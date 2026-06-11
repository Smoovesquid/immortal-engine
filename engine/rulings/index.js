// Standard DM ruling library — material + verb class → delta vocabulary.
// Pure functions: no world state, no RNG. Input is furniture context,
// output is { deltas, description, noiseBy }.
//
// The playloop calls these from the physics gate (offline path).
// When the async LLM path is enabled (R3 async), the LLM will propose
// rulings using this vocabulary and the engine validates against it.

// ── Break ────────────────────────────────────────────────────────────────────

/**
 * resolveBreakRuling(f, ctx)
 * What happens when you apply force to f?
 * ctx: { actorId, nodeId, fIdx, mentionedPart? }
 */
export function resolveBreakRuling(f, { actorId, nodeId, fIdx, mentionedPart = null } = {}) {
  const material = String(f.material || 'wood');
  const name = String(f.name || 'the object');
  const parts = Array.isArray(f.parts) ? f.parts : [];

  switch (material) {

    case 'glass': {
      // Shatters loudly; two shards, nothing usable as a weapon
      return {
        deltas: [
          { op: 'modifyFurniture', nodeId, furnitureId: fIdx,
            changes: { state: 'shattered', parts: [], notes: 'broken glass on the floor' } },
          { op: 'createItem', entityId: actorId, bucket: 'junk',
            item: { name: 'glass shard', tags: ['glass', 'sharp'], weight: 0, noise: 0, light: 0, bulk: 0, notes: `from ${name}` } },
          { op: 'createItem', entityId: actorId, bucket: 'junk',
            item: { name: 'glass shard', tags: ['glass', 'sharp'], weight: 0, noise: 0, light: 0, bulk: 0, notes: `from ${name}` } }
        ],
        description: `${name} shatters. Glass shards scatter across the floor.`,
        noiseBy: 3
      };
    }

    case 'stone': {
      // Too hard; nothing happens
      return {
        deltas: [],
        description: `${name} is solid stone. It doesn't budge.`,
        noiseBy: 0
      };
    }

    case 'iron': {
      // Dents but doesn't break; no yield
      return {
        deltas: [
          { op: 'modifyFurniture', nodeId, furnitureId: fIdx,
            changes: { state: 'damaged', notes: 'bent and dented' } }
        ],
        description: `${name} bends slightly under the blow but holds. Your hands ache.`,
        noiseBy: 1
      };
    }

    case 'cloth': {
      // Tears silently into a usable strip
      return {
        deltas: [
          { op: 'modifyFurniture', nodeId, furnitureId: fIdx,
            changes: { state: 'torn', parts: [], notes: 'shredded' } },
          { op: 'createItem', entityId: actorId, bucket: 'tools',
            item: { name: 'strip of cloth', tags: ['cloth'], weight: 0, noise: 0, light: 0, bulk: 0, notes: `torn from ${name}` } }
        ],
        description: `${name} tears apart. You're left with a strip of cloth.`,
        noiseBy: 0
      };
    }

    default:
    case 'wood': {
      // Find the mentioned part or fall back to the first part
      const partToRemove = (mentionedPart && parts.includes(mentionedPart))
        ? mentionedPart
        : parts[0] || null;

      if (partToRemove) {
        const remaining = parts.filter(p => p !== partToRemove);
        return {
          deltas: [
            { op: 'modifyFurniture', nodeId, furnitureId: fIdx,
              changes: { state: 'damaged', parts: remaining, notes: `${partToRemove} torn off` } },
            { op: 'createItem', entityId: actorId, bucket: 'weapons',
              item: { name: partToRemove, tags: ['wood', 'blunt'], weight: 1, noise: 0, light: 0, bulk: 1, notes: `torn from ${name}` } }
          ],
          description: `You wrench the ${partToRemove} from ${name}. Wood splinters.`,
          noiseBy: 2
        };
      }

      // No parts left — just crack it
      return {
        deltas: [
          { op: 'modifyFurniture', nodeId, furnitureId: fIdx,
            changes: { state: 'damaged', notes: 'battered and cracked' } }
        ],
        description: `${name} cracks but holds.`,
        noiseBy: 2
      };
    }
  }
}

// ── Fire ─────────────────────────────────────────────────────────────────────

/**
 * resolveFireRuling(f, ctx)
 * What happens when you try to light or ignite f?
 * ctx: { actorId, nodeId, fIdx }
 */
export function resolveFireRuling(f, { nodeId, fIdx } = {}) {
  const material = String(f.material || 'wood');
  const category = String(f.category || 'furniture');
  const name = String(f.name || 'the object');

  // Light sources: lanterns, torches, braziers — light up brightly
  if (category === 'light-source') {
    return {
      deltas: [
        { op: 'modifyFurniture', nodeId, furnitureId: fIdx,
          changes: { state: 'lit', notes: 'flame burning steadily' } },
        { op: 'env', key: 'light', by: 3 },
        { op: 'env', key: 'heat', by: 1 }
      ],
      description: `${name} flickers to life. Warm light fills the area.`,
      noiseBy: 0
    };
  }

  // Flammable materials: wood, cloth
  const FLAMMABLE = new Set(['wood', 'cloth']);
  if (FLAMMABLE.has(material)) {
    return {
      deltas: [
        { op: 'modifyFurniture', nodeId, furnitureId: fIdx,
          changes: { state: 'burning', notes: 'flames spreading' } },
        { op: 'env', key: 'heat', by: 2 },
        { op: 'env', key: 'light', by: 2 }
      ],
      description: `${name} catches fire. Smoke and heat fill the air.`,
      noiseBy: 0
    };
  }

  // Non-flammable
  return {
    deltas: [],
    description: `${name} won't catch fire.`,
    noiseBy: 0
  };
}

// ── Cover ────────────────────────────────────────────────────────────────────

/**
 * resolveCoverRuling(f, ctx)
 * What happens when the player tries to hide behind or brace against f?
 * ctx: { actorId }
 *
 * Grants advantage (+2 to next finesse/stealth roll) and moves player zone
 * to 'near'. Fails silently for objects too small to provide cover.
 */
export function resolveCoverRuling(f, { actorId } = {}) {
  const name = String(f.name || 'the object');
  const bulk = typeof f.bulk === 'number' ? f.bulk : 2;

  // Objects with bulk < 2 (lantern, small items) are too small
  if (bulk < 2) {
    return {
      deltas: [],
      description: `${name} is too small to hide behind.`,
      noiseBy: 0,
      verbClass: 'cover'
    };
  }

  const description = bulk >= 4
    ? `You duck behind ${name}. It gives solid cover.`
    : `You press against ${name}, shielding yourself from sight.`;

  return {
    deltas: [
      // Move player into the near zone (crouching by the object)
      { op: 'position', entityId: actorId, set: { zone: 'near' } },
      // Advantage token: +2 to their next finesse/stealth roll
      { op: 'advantage', actorId, by: +1 }
    ],
    description,
    noiseBy: 0,
    verbClass: 'cover'
  };
}

// ── Noise ────────────────────────────────────────────────────────────────────

/**
 * noiseForMaterial(material)
 * Base noise level when force is applied to this material.
 */
export function noiseForMaterial(material) {
  const MAP = { glass: 3, stone: 1, iron: 1, cloth: 0, wood: 2 };
  return MAP[String(material || 'wood')] ?? 2;
}
