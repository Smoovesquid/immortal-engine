/**
 * CM11 — Encounter spawning.
 *
 * Bridges the narrative tension system to the combat engine.
 * Confrontation beats spawn hostile creatures from the bestiary
 * when narrative conditions are right. All decisions are deterministic
 * via seeded RNG. No Math.random, no LLM.
 */

import { BESTIARY_CATALOG } from '../ruleset/core/bestiary/index.js';
import { biomeOf } from '../ecology/foodweb.js';
import { trivial } from '../ruleset/core/bestiary/catalog/trivial.js';
import { minor } from '../ruleset/core/bestiary/catalog/minor.js';
import { standard } from '../ruleset/core/bestiary/catalog/standard.js';
import { elite } from '../ruleset/core/bestiary/catalog/elite.js';
import { beginCombat } from './combatLifecycle.js';
import { applyDeltas } from '../effectsCore.js';

// Build the full creature pool: named bestiary + all catalog tiers.
const ALL_CREATURES = [
  ...Object.values(BESTIARY_CATALOG),
  ...trivial,
  ...minor,
  ...standard,
  ...elite
];

/**
 * Decide whether this scene transition should spawn an encounter.
 * Spawn chance is driven by dread and fate — beat type is irrelevant.
 *   chance = (dread / 12) * fate
 * Ambush (auto-start combat) only when dread >= 8 AND tension >= 6.
 *
 * @param {object} world
 * @param {object} _scenePlan - unused (kept for call-site compat)
 * @param {object} rng - seeded RNG from engine/rng.js
 * @returns {{ spawn: boolean, ambush: boolean, cr: number, count: number }}
 */
export function evaluateEncounter(world, _scenePlan, rng) {
  const noSpawn = { spawn: false, ambush: false, cr: 0, count: 0 };

  // Guard: no spawning during active combat or locked ending
  if (world?.combat?.active) return noSpawn;
  if (world?.ending?.locked) return noSpawn;

  const tension = Number(world?.instrument?.inevitability ?? 0);
  const dread = Number(world?.clocks?.dread ?? 0);
  const fate = Number(world?.meta?.fate ?? 0.2);

  // Base spawn chance = (dread / 12) × fate
  const chance = (dread / 12) * fate;
  const spawn = chance > 0 && rng.nextFloat() < chance;

  if (!spawn) return noSpawn;

  // Ambush only if dread >= 8 AND tension >= 6
  const ambush = dread >= 8 && tension >= 6;

  // CR scaling
  const playerLevel = Number(world?.party?.[0]?.level ?? 1);
  const baseCR = Math.max(0.125, Math.min(5, 0.125 * (1 + playerLevel)));
  const tensionMult = 1 + (tension / 12);
  const fateMult = 0.5 + fate;
  const cr = Math.max(0.125, Math.min(5, baseCR * tensionMult * fateMult));

  // Creature count
  let count = 1;
  if (tension >= 4) count++;
  if (dread >= 6) count++;
  count = Math.min(4, count);

  return { spawn, ambush, cr, count };
}

/**
 * Pick creatures from the bestiary for this encounter.
 * @param {number} cr - target CR budget
 * @param {number} count - number of creatures (1-4)
 * @param {string|null} region - current region id for thematic filtering
 * @param {object} rng - seeded RNG
 * @returns {Array<object>} - array of creature definitions
 */
export function selectCreatures(cr, count, region, rng, biome = null) {
  const targetCR = Number(cr) || 1;
  const n = Math.max(1, Math.min(4, Number(count) || 1));

  // Filter to creatures with CR <= target budget
  const eligible = ALL_CREATURES.filter(
    c => c && typeof c.cr === 'number' && c.cr <= targetCR && c.cr > 0
  );

  if (eligible.length === 0) {
    // Absolute fallback: bandit from named bestiary
    const fallback = BESTIARY_CATALOG.bandit || Object.values(BESTIARY_CATALOG)[0];
    return Array.from({ length: n }, () => fallback);
  }

  // If region provided, prefer creatures whose regions include it
  let pool = eligible;
  if (region) {
    const regionStr = String(region);
    const regional = eligible.filter(
      c => Array.isArray(c.regions) && c.regions.includes(regionStr)
    );
    if (regional.length > 0) pool = regional;
  }

  // Living-World P2: prefer creatures native to this biome (plus biome-agnostic
  // 'any' dwellers), so forests hold forest things and marshes hold marsh things.
  // Falls back to the broader pool when nothing native is in CR budget.
  if (biome) {
    const b = String(biome);
    const native = pool.filter(c => { const cb = biomeOf(c); return cb === b || cb === 'any'; });
    if (native.length > 0) pool = native;
  }

  const picked = [];
  for (let i = 0; i < n; i++) {
    const idx = rng.int(0, pool.length - 1);
    picked.push(pool[idx]);
  }
  return picked;
}

/**
 * Mint enemy objects from creature defs and inject into world.
 * If ambush is true, also call beginCombat().
 * @param {object} world
 * @param {Array<object>} creatureDefs
 * @param {{ ambush: boolean, reason: string }} opts
 * @param {object} rng
 * @returns {object} world (mutated)
 */
export function spawnEncounter(world, creatureDefs, opts, rng) {
  let w = world;
  const defs = Array.isArray(creatureDefs) ? creatureDefs : [];
  if (defs.length === 0) return w;

  const ambush = Boolean(opts?.ambush);
  const reason = String(opts?.reason || (ambush ? 'ambush' : 'encounter'));

  // Mint enemy objects from creature defs
  const enemies = defs.map(def => mintEnemyFromDef(def));

  if (ambush) {
    // Auto-start combat
    w = beginCombat(w, { enemies, reason });
  } else {
    // Place as hostile NPCs at the current node so player can choose to engage
    const nodeId = String(w?.map?.currentNodeId ?? '');
    const nodes = Array.isArray(w?.map?.nodes) ? w.map.nodes : [];
    const nodeIdx = nodes.findIndex(n => n && n.id === nodeId);
    if (nodeIdx >= 0) {
      const node = nodes[nodeIdx];
      const settlement = node.settlement || {};
      const npcs = Array.isArray(settlement.npcs) ? [...settlement.npcs] : [];
      for (const def of defs) {
        npcs.push(mintNpcFromDef(def, nodeId, rng));
      }
      const updatedNode = {
        ...node,
        settlement: { ...settlement, npcs }
      };
      const updatedNodes = [...nodes];
      updatedNodes[nodeIdx] = updatedNode;
      w = { ...w, map: { ...w.map, nodes: updatedNodes } };
    }
  }

  return w;
}

// ── internals ──────────────────────────────────────────────────────────────

/**
 * Create an enemy record from a bestiary creature def.
 * Similar to mintEnemyFromNpc in combatLifecycle.js but works from
 * bestiary defs directly rather than NPC objects.
 */
function mintEnemyFromDef(def) {
  const d = def && typeof def === 'object' ? def : {};
  return {
    id: '',   // assigned by beginCombat
    name: String(d.name || 'Creature'),
    hp: Number(d.maxHp) || 8,
    maxHp: Number(d.maxHp) || 8,
    damage: Number(d.damage) || 3,
    ac: Number(d.ac) || 10,
    cr: typeof d.cr === 'number' ? d.cr : 0,
    damageType: d.actions?.[0]?.type || 'bludgeoning',
    resistances: d.resistances || {},
    conditionImmunities: d.conditionImmunities || [],
    actions: d.actions || [],
    multiattack: d.multiattack || null,
    saveProficiencies: d.saveProficiencies || [],
    canParley: Boolean(d.canParley ?? false),
    defeated: false,
    sourceNpcId: '',
    lootTableRef: d.lootTableRef || null,
    initMod: typeof d.initMod === 'number' ? d.initMod : 0,
    legendaryActions: d.legendaryActions || null,
    reactions: d.reactions || null,
    lairActions: d.lairActions || null,
    senses: d.senses || { darkvision: null, blindsight: null, tremorsense: null, truesight: null },
    stats: d.stats || {},
    traits: Array.isArray(d.traits) ? d.traits : [],
    level: typeof d.level === 'number' ? d.level : Math.max(1, Math.ceil(typeof d.cr === 'number' ? d.cr : 1))
  };
}

/**
 * Create a hostile NPC record from a bestiary def (for non-ambush encounters).
 * Matches the shape expected by detectAttackBeginIntent and mintEnemyFromNpc.
 */
function mintNpcFromDef(def, nodeId, rng) {
  const d = def && typeof def === 'object' ? def : {};
  const ref = String(d.ref || 'creature');
  return {
    id: `npc_${nodeId}_encounter_${rng.int(0, 99999)}`,
    name: String(d.name || 'Creature'),
    role: 'hostile',
    archetypeDesc: '',
    factionId: null,
    originTick: 0,
    disposition: {},
    hostile: true,
    bestiaryRef: ref,
    combatProfile: {
      maxHp: Number(d.maxHp) || 8,
      damage: Number(d.damage) || 3,
      canParley: Boolean(d.canParley ?? false)
    },
    knowledgeGraph: [],
    conversationState: {
      metPlayer: false,
      topicsDiscussed: [],
      trustLevel: 0,
      lastInteraction: null
    },
    personality: { honesty: 0.3, trustOfOutsiders: 0.1, selfPreservation: 0.8 },
    witnessedEvents: [],
    secrets: [],
    playerRelationship: { trust: 0, meetings: 0, sharedFacts: [] }
  };
}
