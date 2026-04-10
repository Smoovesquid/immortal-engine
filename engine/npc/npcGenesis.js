// NPC Genesis — Deterministic NPC generation for settlements.
// Same seed + same node = same NPCs. Always.

import { seedFromString, makeRng } from '../rng.js';

// ── Archetype-to-building mapping ───────────────────────────────────────────
// When a settlement has specific building types, assign matching archetypes.

const BUILDING_ARCHETYPES = {
  tavern:    'tavern_keeper',
  inn:       'innkeeper',
  smithy:    'smith',
  temple:    'priest',
  market:    'merchant',
  barracks:  'guard_captain',
  stable:    'stable_hand',
  library:   'scholar',
  apothecary:'hedge_witch',
  workshop:  'artisan'
};

// Roles used when no building-specific archetype applies.
const GENERIC_ROLES = [
  'elder', 'laborer', 'veteran', 'trader', 'healer',
  'scavenger', 'mediator', 'guard', 'artisan', 'representative'
];

// ── Name tables (seeded, pack-agnostic for now) ─────────────────────────────
const FIRST_NAMES = [
  'Marta', 'Kael', 'Senna', 'Brogan', 'Lyssa', 'Fenn', 'Torva', 'Iden',
  'Dalla', 'Rook', 'Hael', 'Jorin', 'Nessa', 'Corwin', 'Brae', 'Tove',
  'Wynn', 'Aldric', 'Sera', 'Galen', 'Orla', 'Theron', 'Miriel', 'Dax',
  'Elske', 'Brennan', 'Yara', 'Lucca', 'Asha', 'Kellan', 'Petra', 'Milo'
];

const EPITHETS = [
  'the Quiet', 'Halfhand', 'Ironside', 'the Crow', 'Redcloak',
  'Ashborn', 'the Mender', 'Longstride', 'the Fox', 'Shieldwall',
  'Duskwalker', 'the Wary', 'Boneknit', 'Thornmouth', 'the Younger',
  'the Elder', 'Copperforge', 'the Faithful', 'Nightherd', 'the Borrowed'
];

/**
 * generateSettlementNPCs(nodeId, seed, pack, factionState, ecology)
 *
 * Produces 3-5 NPCs for a settlement node. Deterministic.
 *
 * @param {string} nodeId - Settlement node ID
 * @param {string} seed - World seed
 * @param {object} pack - Pack data (may contain npcArchetypes)
 * @param {object[]} factionState - Array of faction objects
 * @param {object} ecology - { corruption, instability, scarcity }
 * @param {object} [opts] - Optional: { buildings: string[] } building types at this node
 * @returns {object[]} Array of NPC base records
 */
export function generateSettlementNPCs(nodeId, seed, pack, factionState, ecology, opts = {}) {
  const nid = String(nodeId || '');
  const s = String(seed || 'seed');
  const rng = makeRng(seedFromString(`${s}|settlement|${nid}|npcs`));

  const factions = Array.isArray(factionState) ? factionState : [];
  const eco = ecology && typeof ecology === 'object' ? ecology : { corruption: 0, instability: 0, scarcity: 0 };
  const buildings = Array.isArray(opts.buildings) ? opts.buildings.map(b => String(b).toLowerCase()) : [];

  // 3-5 NPCs per settlement. Scarcity reduces count.
  const baseCount = 3 + rng.int(0, 2);
  const count = eco.scarcity >= 75 ? Math.max(2, baseCount - 1) : baseCount;

  const npcs = [];
  const usedNames = new Set();

  // First pass: assign building-specific archetypes
  const buildingRoles = [];
  for (const b of buildings) {
    const role = BUILDING_ARCHETYPES[b];
    if (role && buildingRoles.length < count) {
      buildingRoles.push(role);
    }
  }

  for (let i = 0; i < count; i++) {
    const npcRng = makeRng(seedFromString(`${s}|settlement|${nid}|npc|${i}`));

    // Role: building-specific or generic
    const role = i < buildingRoles.length
      ? buildingRoles[i]
      : rng.pick(GENERIC_ROLES);

    // Name: seeded, unique within settlement
    let name = '';
    let attempts = 0;
    while (!name || usedNames.has(name)) {
      const first = npcRng.pick(FIRST_NAMES);
      // ~40% chance of epithet
      const useEpithet = npcRng.nextFloat() < 0.4;
      name = useEpithet ? `${first} ${npcRng.pick(EPITHETS)}` : first;
      attempts++;
      if (attempts > 20) { name = `${npcRng.pick(FIRST_NAMES)}_${i}`; break; }
    }
    usedNames.add(name);

    // Faction affiliation: deterministic assignment.
    // First NPC gets dominant faction if one exists, others may or may not.
    let factionId = null;
    if (factions.length > 0) {
      if (i === 0) {
        // Highest pressure faction
        const sorted = [...factions].sort((a, b) => (b.pressure - a.pressure) || a.id.localeCompare(b.id));
        factionId = sorted[0].id;
      } else if (npcRng.nextFloat() < 0.4) {
        factionId = npcRng.pick(factions).id;
      }
    }

    // Disposition toward factions: derived from faction state + ecology
    const disposition = {};
    for (const f of factions) {
      const base = factionId === f.id ? 50 : 0;
      const hostilityPenalty = Math.round((f.hostility ?? 0) * -0.3);
      const ecoPenalty = Math.round((eco.corruption + eco.instability) * -0.1);
      disposition[f.id] = clampInt(base + hostilityPenalty + ecoPenalty + npcRng.int(-10, 10), -100, 100);
    }

    // Pack archetype description (flavor text for LLM)
    const packArchetypes = Array.isArray(pack?.npcArchetypes) ? pack.npcArchetypes : [];
    const archetypeDesc = packArchetypes.length > 0
      ? npcRng.pick(packArchetypes)
      : '';

    // Origin tick: when this NPC "arrived" in the settlement history
    // Earlier NPCs are founding members, later ones are newer arrivals
    const originTick = i < 2 ? 0 : npcRng.int(1, 9);

    npcs.push({
      id: `npc_${nid}_${i}`,
      name,
      role,
      archetypeDesc,
      factionId,
      originTick,
      disposition,
      // Pass 5: optional hostile flag — defaults false. NPC genesis does not
      // mint hostile NPCs on its own; tests/scripts can set this directly to
      // make a settlement NPC attackable. No bestiary, no autogen of hostility.
      hostile: false,
      conversationState: {
        metPlayer: false,
        topicsDiscussed: [],
        trustLevel: 5, // starts neutral (0-10 scale)
        lastInteraction: null
      }
    });
  }

  return npcs;
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
