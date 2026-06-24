// Authored-figure overlay for the locked demo region (Packet D-C2a).
//
// The walk-in demo rides ONE fixed seed ('tallow', see demoRegion.js) so authored
// content can be hand-placed on KNOWN ground. This module is that overlay: a static
// data table of the six named figures plus a deterministic injector that drops a
// matching figure into a settlement's NPC list at decompress time.
//
// PURE + deterministic by design: `engine/` runs in the browser and must stay
// seed-deterministic, so this module NEVER touches the filesystem and NEVER calls
// rng / Math.random. A figure has a stable id (`figure_<key>`), fixed personality,
// and a fixed conversationState — same seed → same figure → same world hash.
//
// Road A — placement only, no LLM authority. The figure is plain canon (a real NPC).
// Its authored VOICE is handled downstream: `voiceCorpusId` routes the spoken line
// through npcVoiceResolve.js → the server's existence-gated corpus retrieval (D-C1).
// §0: a figure surfaces NO cosmology; the authored voice carries tone, nothing more.
//
// SCOPE (D-C2a): only the steward-king has a live `nodeSelector` and is placed.
// The kingdom seat is the ONE node the map already identifies (generateMap tags
// exactly one settlement `'city'` / `'seat'`). The other five figures' homes
// (frontier / trade / faith / cannibal-outlier / wilderness) are NOT semantically
// tagged yet — assigning them needs a node-role map that does not exist. They are
// recorded here with `nodeSelector: null` so the follow-on packet can place them
// without re-deriving the table, but they are NOT injected by this overlay.

import { DEMO_SEED } from './demoRegion.js';

// Node selectors. A selector is `(node) => boolean` evaluated against a map node.
// Only `seat` is live in this packet.
//   seat — the kingdom seat: the one settlement tagged 'city'/'seat' by generateMap
//          (generateMap.js M7-S3). Steward-king's home.
const SELECTORS = {
  // Tolerant of either tag — generateMap pushes BOTH 'city' (tier) and 'seat'.
  seat: (node) => {
    const tags = Array.isArray(node?.tags) ? node.tags : [];
    return tags.includes('seat') || tags.includes('city');
  },
};

// The six authored figures. ORDER and KEYS are stable (the follow-on relies on them).
// Each: { key, name, role, voiceCorpusId, personality, note, nodeSelector }.
//   - personality matches npcDepth's axes {trustOfOutsiders, selfPreservation, honesty}.
//   - nodeSelector is a live SELECTORS.* fn ONLY for a placed figure; otherwise null.
export const DEMO_FIGURES = [
  {
    key: 'steward-king',
    name: 'Theodore Augustus',
    role: 'steward-king',
    voiceCorpusId: 'marcus-aurelius',
    // Stoic, dutiful, forthright-but-guarded — a philosopher-king who rules as a
    // burden of office, not a prize. Moderate trust of outsiders, low self-
    // preservation (duty over self), high honesty.
    personality: { trustOfOutsiders: 0.4, selfPreservation: 0.4, honesty: 0.7 },
    note: 'The kingdom seat. Marcus Aurelius voice. PLACED in this packet.',
    nodeSelector: SELECTORS.seat,
  },
  {
    key: 'cassandra',
    name: 'Cassandra',
    role: 'frontier-watcher',
    voiceCorpusId: 'joan-of-arc',
    personality: { trustOfOutsiders: 0.5, selfPreservation: 0.3, honesty: 0.8 },
    note: 'Frontier town. NOT placed — needs a node-role map (frontier).',
    nodeSelector: null /* TODO: node-role map */,
  },
  {
    key: 'scholar',
    name: 'The Kant-Knight',
    role: 'scholar',
    voiceCorpusId: 'kant-knight',
    personality: { trustOfOutsiders: 0.4, selfPreservation: 0.5, honesty: 0.9 },
    note: 'Trade/academy town. NOT placed — needs a node-role map (trade).',
    nodeSelector: null /* TODO: node-role map */,
  },
  {
    key: 'clown-leader',
    name: 'Goldblum-Socrates',
    role: 'clown-leader',
    voiceCorpusId: 'goldblum-socrates',
    personality: { trustOfOutsiders: 0.6, selfPreservation: 0.4, honesty: 0.6 },
    note: 'Faith town. NOT placed — needs a node-role map (faith).',
    nodeSelector: null /* TODO: node-role map */,
  },
  {
    key: 'cannibal-prophet',
    name: 'The Host',
    role: 'cannibal-prophet',
    voiceCorpusId: 'jesus',
    personality: { trustOfOutsiders: 0.3, selfPreservation: 0.5, honesty: 0.7 },
    note: 'Cannibal outlier. NOT placed — needs a node-role map (outlier).',
    nodeSelector: null /* TODO: node-role map */,
  },
  {
    key: 'the-goat',
    name: 'The Goat of the Blasted Heath',
    role: 'wilderness-hermit',
    voiceCorpusId: 'twain',
    personality: { trustOfOutsiders: 0.2, selfPreservation: 0.6, honesty: 0.5 },
    note: 'Wilderness. NOT placed — needs a wilderness-node map.',
    nodeSelector: null /* TODO: node-role map */,
  },
];

// Build the full NPC object for an authored figure. Deterministic — stable id,
// fixed conversationState, no rng. Shaped to match the decompress namedNpcs output
// so downstream consumers (dialogue.js npcVoice / askNpc, the voiceCorpusId surface)
// treat it like any minted NPC.
function buildFigureNpc(figure) {
  return {
    id: `figure_${figure.key}`,
    name: figure.name,
    role: figure.role,
    archetypeDesc: '',
    factionId: null,
    originTick: 0,
    disposition: {},
    hostile: false,
    // The authored voice override — npcVoiceResolve honors this first and routes
    // the spoken line to the figure's primary-source corpus (D-C1).
    voiceCorpusId: figure.voiceCorpusId,
    personality: { ...figure.personality },
    knowledgeGraph: [],
    witnessedEvents: [],
    secrets: [],
    playerRelationship: { trust: 0, meetings: 0, sharedFacts: [] },
    revealedSecrets: [],
    // A full conversation state — a person without one can't accrue trust.
    conversationState: {
      metPlayer: false,
      topicsDiscussed: [],
      trustLevel: 5,
      lastInteraction: null,
    },
    description: '',
    factualDetail: '',
    // Mark provenance so a later pass / debug can tell authored figures apart from
    // minted NPCs without re-matching the table.
    authoredFigure: figure.key,
  };
}

/**
 * injectDemoFigures({ world, node, npcs }) -> npcs (possibly with a figure prepended)
 *
 * Returns the settlement's NPC list with any authored figure whose live
 * `nodeSelector` matches this node PREPENDED. Strictly gated to the demo seed
 * (`world.meta.seed === DEMO_SEED`) — every other seed is returned untouched.
 * Deterministic and idempotent: a figure id is stable, and we never add the same
 * figure twice (id-dedup against the incoming list).
 *
 * Only figures with a non-null `nodeSelector` are ever considered, so the five
 * unplaced figures are inert until a follow-on packet gives them a selector.
 */
export function injectDemoFigures({ world, node, npcs }) {
  const list = Array.isArray(npcs) ? npcs : [];
  // Gate: only the locked demo seed gets the overlay. Anything else is byte-identical.
  if (!world || world.meta?.seed !== DEMO_SEED) return list;
  if (!node) return list;

  const existingIds = new Set(list.map(n => n && n.id).filter(Boolean));
  const toPrepend = [];
  for (const figure of DEMO_FIGURES) {
    if (typeof figure.nodeSelector !== 'function') continue; // unplaced — skip
    if (!figure.nodeSelector(node)) continue;                // wrong node
    const npc = buildFigureNpc(figure);
    if (existingIds.has(npc.id)) continue;                   // idempotent
    existingIds.add(npc.id);
    toPrepend.push(npc);
  }
  if (!toPrepend.length) return list;
  return [...toPrepend, ...list];
}
