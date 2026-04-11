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

    // Pass C1.1 — seed at least one public (non-secret) fact per NPC so the
    // dialogue path can reach mode:'shared' on a fresh world. Without this
    // seed, settlement history on turn 0 is empty → computeNpcDepth returns
    // an empty or secret-only knowledgeGraph → askNpc always deflects →
    // trust never climbs to the invite threshold. Facts are derived
    // deterministically from local context (building types, factions,
    // neighbor npc indices) and carry source:'public' so computeSecrets
    // never marks them secret. Shape mirrors buildKnowledgeGraph output.
    const publicFacts = seedPublicFacts({
      nid, i, count, role, factionId, buildings, factions, originTick, npcRng
    });

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
      knowledgeGraph: publicFacts,
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

// ── Public-fact seeding (Pass C1.1) ─────────────────────────────────────────
// Derives 1-3 deterministic non-secret facts per NPC from local context.
// Facts are non-secret (source:'public'), topic-extractable (multi-word
// factId tokens that survive the STOP_TOKENS filter in dialogue.js), and
// seeded from npcRng so same seed+node+index → same facts across runs.
function seedPublicFacts({ nid, i, count, role, factionId, buildings, factions, originTick, npcRng }) {
  const facts = [];

  // Fact 1 — always present. Local building if any, else settlement trade/life.
  // Building facts like "local_market_gossip" tokenize to ['local','market','gossip']
  // so player inputs like "ask about the market" score a hit in extractTopic.
  if (buildings.length > 0) {
    const b = buildings[npcRng.int(0, buildings.length - 1)];
    const safe = String(b).replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    facts.push({
      factId: `local_${safe}_gossip`,
      source: 'public',
      confidence: 0.9,
      event: { era: 0, eventId: `local_${safe}_gossip`, worldState: null }
    });
  } else {
    facts.push({
      factId: `settlement_daily_rumor`,
      source: 'public',
      confidence: 0.8,
      event: { era: 0, eventId: `settlement_daily_rumor`, worldState: null }
    });
  }

  // Fact 2 — faction context. Factionless NPCs still know which faction holds
  // local pressure, so derive from dominant faction if any factions exist.
  if (Array.isArray(factions) && factions.length > 0) {
    const facRef = factionId
      ? factions.find(f => f.id === factionId)
      : [...factions].sort((a, b) => (b.pressure - a.pressure) || a.id.localeCompare(b.id))[0];
    if (facRef && facRef.id) {
      const safe = String(facRef.id).replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      facts.push({
        factId: `faction_${safe}_standing`,
        source: 'public',
        confidence: 0.85,
        event: { era: 0, eventId: `faction_${safe}_standing`, worldState: null }
      });
    }
  }

  // Fact 3 — neighbor awareness. NPCs at the same settlement know one another
  // by role. Seed a "neighbor_<role>" fact pointing at another index.
  if (count > 1) {
    const otherIdx = (i + 1) % count;
    facts.push({
      factId: `neighbor_${otherIdx}_presence`,
      source: 'public',
      confidence: 0.75,
      event: { era: 0, eventId: `neighbor_${otherIdx}_presence`, worldState: null }
    });
  }

  // Fact 4 — role-flavored trade fact. "market_trade_talk",
  // "smithy_trade_talk" etc. so "ask about the trade" finds a hit.
  facts.push({
    factId: `role_${String(role || 'townsfolk').toLowerCase()}_trade_talk`,
    source: 'public',
    confidence: 0.7,
    event: { era: 0, eventId: `role_${role || 'townsfolk'}_trade_talk`, worldState: null }
  });

  void nid; void originTick;
  return facts;
}
