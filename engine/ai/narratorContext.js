/**
 * N1 — Narrator Context Builder
 *
 * Assembles everything the AI narrator is allowed to know.
 * Canonical facts only — no invented detail.
 * Pure function: no world mutation, no API calls.
 */

import { ensureWorld } from '../state.js';
import { filterContext } from '../npc/perspectiveFilter.js';

/**
 * buildNarratorContext(world, outcome) → NarratorContext
 *
 * @param {object} world   — canonical world state
 * @param {object} outcome — result of the last engine action (from playloop)
 * @returns {NarratorContext}
 */
export function buildNarratorContext(world, outcome = {}) {
  const w = ensureWorld(world);

  // ── Place ─────────────────────────────────────────────────────────────
  const nodeId      = String(w.map?.currentNodeId ?? '');
  const currentNode = (w.map?.nodes ?? []).find(n => n.id === nodeId) ?? null;
  const placeName   = String(currentNode?.name ?? 'Unknown');
  const nodeType    = String(currentNode?.nodeType ?? 'wilderness');

  // ── Structures at this node ───────────────────────────────────────────
  const allStructures = Object.values(w.structures?.byId ?? {});
  const structuresHere = allStructures
    .filter(s => s?.nodeId === nodeId || s?.anchors?.nodeId === nodeId)
    .map((s, i) => ({ index: i + 1, kind: String(s.kind ?? 'structure') }));

  // ── Interior state ────────────────────────────────────────────────────
  const interior = (w.scene?.interior && typeof w.scene.interior === 'object')
    ? { structureKey: String(w.scene.interior.structureKey ?? ''), roomId: String(w.scene.interior.roomId ?? '') }
    : null;

  // ── Pack tone ─────────────────────────────────────────────────────────
  // toneWords live on the resolved pack, passed separately via outcome or world
  const toneWords = outcome?.pack?.toneWords ?? w._resolvedPack?.toneWords ?? null;
  const tone = deriveTone(toneWords, w.meta?.fate);

  // ── Scene context ─────────────────────────────────────────────────────
  const location  = String(w.scene?.location  ?? placeName);
  const objective = String(w.scene?.objective ?? '');

  // ── Last action ───────────────────────────────────────────────────────
  const actionText    = String(outcome?.input  ?? outcome?.text ?? '');
  const mechanicsText = String(outcome?.mechanics ?? '');

  // ── Settlement data (from decompression) ───────────────────────────
  const settlement = currentNode?.settlement?.decompressed ? currentNode.settlement : null;
  const settlementContext = settlement ? {
    npcs: (settlement.npcs || []).map(n => ({
      name: n.name || `the ${n.role}`,
      role: n.role,
      factionId: n.factionId || null,
      disposition: n.disposition
    })),
    factions: settlement.factions || [],
    tensions: (settlement.tensions || []).map(t => ({ type: t.type, severity: t.severity })),
    economy: settlement.economy || 'stable',
    population: settlement.population || 0
  } : null;

  return {
    placeName,
    nodeType,
    location,
    objective,
    structuresHere,
    interior,
    tone,
    actionText,
    mechanicsText,
    fate: Number(w.meta?.fate ?? 0.5),
    settlement: settlementContext
  };
}

/**
 * Derive a single tone label from pack toneWords + fate.
 * Returns 'blood' | 'grim' | 'cooperative'
 */
function deriveTone(toneWords, fate) {
  const f = Number(fate ?? 0.5);
  if (!toneWords || typeof toneWords !== 'object') {
    return f >= 0.7 ? 'blood' : f >= 0.4 ? 'grim' : 'cooperative';
  }
  if (f >= 0.7 && Array.isArray(toneWords.blood)  && toneWords.blood.length)  return 'blood';
  if (f >= 0.4 && Array.isArray(toneWords.grim)   && toneWords.grim.length)   return 'grim';
  return 'cooperative';
}

/**
 * buildSpeakerContext(npc, allFacts) → speaker context for narrator prompt
 *
 * Runs the perspective filter for a specific NPC and returns the data
 * needed by the narrator system prompt's SPEAKER PERSPECTIVE block.
 *
 * @param {object} npc — enriched NPC with depth fields
 * @param {object[]} allFacts — all settlement facts (from knowledgeGraph entries)
 * @returns {object|null} — speaker context or null if NPC has no depth
 */
export function buildSpeakerContext(npc, allFacts) {
  if (!npc?.personality || !npc?.knowledgeGraph) return null;

  const { filteredFacts, emotionalColoring } = filterContext(
    npc,
    allFacts,
    npc.playerRelationship
  );

  // Compute omitted facts (things the NPC doesn't know or is hiding)
  const filteredIds = new Set(filteredFacts.map(f => f.factId || f.id || ''));
  const omittedFacts = allFacts
    .filter(f => !filteredIds.has(f.factId || f.id || ''))
    .map(f => describeFactBriefly(f));

  // Describe secrets the NPC is actively hiding
  const secrets = (npc.secrets || [])
    .filter(s => !filteredIds.has(s))
    .map(s => s.replace(/_/g, ' ').replace(/era\d+/, '').trim());

  return {
    name: npc.name || `the ${npc.role}`,
    role: npc.role,
    personality: npc.personality,
    filteredFacts,
    omittedFacts,
    secrets,
    emotionalColoring
  };
}

function describeFactBriefly(fact) {
  if (!fact?.event) return fact?.factId || 'unknown event';
  const eventId = fact.event.eventId || '';
  const era = fact.event.era ?? '?';
  return `${eventId.replace(/_/g, ' ')} (era ${era})`;
}
