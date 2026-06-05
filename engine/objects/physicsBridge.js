// Physics Bridge — connects object model to llmPhysics
// Replaces hardcoded break/take/burn logic with material-driven outcomes

import { schema } from './schema.js';
import { query } from './query.js';
import { outcomes } from './outcomes.js';

// Enhance llmPhysics offline fallback with material-aware outcomes
export function enhancedOfflineFallback(world, playerText, detection) {
  const w = world;
  const text = String(playerText || '').toLowerCase();

  // Find the best furniture match
  const furnitureMatch = detection.matches.find(mt => mt.type === 'furniture');
  if (!furnitureMatch) {
    return {
      plausible: true,
      deltas: [],
      description: `You interact with something.`,
      fallbackUsed: true
    };
  }

  // Look up the actual object
  const m = w.map?.nodes?.find(n => n.id === w.map.currentNodeId);
  if (!m) {
    return {
      plausible: true,
      deltas: [],
      description: `You interact with ${furnitureMatch.name}.`,
      fallbackUsed: true
    };
  }

  const furniture = Array.isArray(m.furniture) ? m.furniture : [];
  const fIdx = furnitureMatch.index;
  const f = furniture[fIdx];
  if (!f) {
    return {
      plausible: true,
      deltas: [],
      description: `You interact with ${furnitureMatch.name}.`,
      fallbackUsed: true
    };
  }

  // Build object view with material/category
  const obj = {
    name: String(f.name || ''),
    material: schema.inferMaterial(f.name, f.tags),
    category: schema.inferCategory(f.name, f.tags),
    state: String(f.state || 'intact'),
    parts: Array.isArray(f.parts) ? f.parts : [],
    bulk: Number(f.bulk) || 2,
    tags: Array.isArray(f.tags) ? f.tags : []
  };

  const party = Array.isArray(w.party) ? w.party : [];
  const actorId = party[0]?.id || 'party';
  const nodeId = w.map?.currentNodeId;

  // Detect action from text
  const isForce = /\b(rip|break|smash|tear|kick|punch|shatter|destroy|hit)\b/.test(text);
  const isExamine = /\b(search|examine|inspect|look at|check|investigate)\b/.test(text);
  const isTake = /\b(take|grab|pick up|steal|carry|get)\b/.test(text);
  const isBurn = /\b(burn|ignite|light|torch|set fire)\b/.test(text);

  // FORCE: material-driven break outcome
  if (isForce) {
    if (!query.canBreak(obj)) {
      return {
        plausible: true,
        deltas: [],
        description: `You strike the ${obj.name}, but it doesn't break.`,
        fallbackUsed: true
      };
    }

    const breakOut = outcomes.breakOutcome(obj);
    if (!breakOut.possible) {
      return {
        plausible: true,
        deltas: [],
        description: `The ${obj.name} is already destroyed.`,
        fallbackUsed: true
      };
    }

    const deltas = [
      {
        op: 'modifyFurniture',
        nodeId,
        furnitureId: fIdx,
        changes: {
          state: 'damaged',
          parts: obj.parts.slice(0, -1), // remove last part
          notes: `broken from impact`
        }
      }
    ];

    // Create item from the broken piece
    const piece = obj.parts[obj.parts.length - 1] || 'piece';
    const itemProps = outcomes.itemPropertiesFromObject(obj);
    deltas.push({
      op: 'createItem',
      entityId: actorId,
      bucket: 'junk',
      item: {
        name: piece,
        tags: [obj.material, ...obj.tags.slice(0, 2)],
        weight: itemProps.weight,
        noise: itemProps.noise,
        light: itemProps.light,
        bulk: itemProps.bulk,
        notes: `from ${obj.name}`
      }
    });

    const narrative = outcomes.outcomeNarrative(obj, 'break');
    return {
      plausible: true,
      deltas,
      description: narrative || `You break the ${obj.name}.`,
      fallbackUsed: true
    };
  }

  // EXAMINE: describe object with material details
  if (isExamine) {
    const partsDesc = obj.parts.length ? `Parts: ${obj.parts.join(', ')}.` : '';
    const materialDesc = `Material: ${obj.material}.`;
    const stateDesc = obj.state !== 'intact' ? `State: ${obj.state}.` : '';
    const desc = `${materialDesc} ${stateDesc} ${partsDesc}`.trim();
    return {
      plausible: true,
      deltas: [],
      description: `You examine the ${obj.name}. ${desc}`,
      fallbackUsed: true
    };
  }

  // TAKE: respect bulk, material durability
  if (isTake) {
    const takeOut = outcomes.takeOutcome(obj);
    if (!takeOut.possible) {
      return {
        plausible: true,
        deltas: [],
        description: `The ${obj.name} is too heavy to carry.`,
        fallbackUsed: true
      };
    }

    const deltas = [
      { op: 'removeFurniture', nodeId, furnitureId: fIdx },
      {
        op: 'createItem',
        entityId: actorId,
        bucket: 'junk',
        item: {
          name: obj.name,
          tags: [obj.material, ...obj.tags.slice(0, 3)],
          weight: takeOut.bulk > 0 ? 2 : 1,
          noise: takeOut.noise,
          light: 0,
          bulk: takeOut.bulk,
          notes: obj.state !== 'intact' ? `(${obj.state})` : ''
        }
      }
    ];

    return {
      plausible: true,
      deltas,
      description: `You take the ${obj.name}.`,
      fallbackUsed: true
    };
  }

  // BURN: flammability check
  if (isBurn) {
    const burnOut = outcomes.burnOutcome(obj);
    if (!burnOut.possible) {
      return {
        plausible: true,
        deltas: [],
        description: `The ${obj.name} doesn't ignite.`,
        fallbackUsed: true
      };
    }

    const deltas = [
      {
        op: 'modifyFurniture',
        nodeId,
        furnitureId: fIdx,
        changes: {
          state: 'burned',
          parts: [],
          notes: 'burned to ash'
        }
      }
    ];

    return {
      plausible: true,
      deltas,
      description: `The ${obj.name} catches fire and burns.`,
      fallbackUsed: true
    };
  }

  // Default: generic interaction
  return {
    plausible: true,
    deltas: [],
    description: `You interact with the ${obj.name}.`,
    fallbackUsed: true
  };
}

export const bridge = {
  enhancedOfflineFallback
};
