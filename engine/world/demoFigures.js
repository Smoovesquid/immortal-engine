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
// SCOPE: FIVE of six figures are placed via `nodeSelector` — the steward-king at the
// tagged seat (D-C2a), and (Tier-2 follow-on) Cassandra / the Kant-Knight / Goldblum-
// Socrates / the Host at the frontier / trade / faith / outlier towns, matched by the
// locked layout's on-the-nose names. ONLY the Goat is deferred: it belongs in the
// wilderness, but `injectDemoFigures` runs inside the SETTLEMENT decompress pipeline,
// so a wild node never reaches it — the Goat waits on a wilderness-encounter hook.

import { DEMO_SEED } from './demoRegion.js';
import { SLICE_SEED } from './sliceRegion.js';

// Node selectors. A selector is `(node) => boolean` evaluated against a map node.
//   seat        — the kingdom seat (tag 'city'/'seat'). Steward-king's home.
//   frontierFar — the far frontier outpost (NOT the start node). Cassandra.
//   trade       — the market town. The Kant-Knight scholar.
//   faith       — the pilgrim town. The clown-leader's congregation.
//   outlier     — the set-apart hamlet. The cannibal-prophet Host.
//
// The locked 'tallow' layout names are thematically on-the-nose (Pilgrim's Rest =
// faith, Saltmarket = trade, Wayfarers' Outpost = frontier), so a name-substring
// selector lands each figure where the fiction already points. We match on
// apostrophe-free substrings (the names carry a "'", style-fragile) and include the
// "(2)" suffix to disambiguate the duplicated twin names ("Wayfarers' Outpost" vs
// "… (2)"). Each substring is verified unique across the 8 tallow settlements.
const nameContains = (sub) => (node) =>
  String(node?.name || '').toLowerCase().includes(sub);

const SELECTORS = {
  // Tolerant of either tag — generateMap pushes BOTH 'city' (tier) and 'seat'.
  seat: (node) => {
    const tags = Array.isArray(node?.tags) ? node.tags : [];
    return tags.includes('seat') || tags.includes('city');
  },
  frontierFar: nameContains('outpost (2)'),   // n31 "Wayfarers' Outpost (2)"
  trade: nameContains('saltmarket'),          // n14 "Saltmarket Town"
  faith: nameContains('pilgrim'),             // n21 "Pilgrim's Rest Village"
  outlier: nameContains('crossway village (2)'), // n34 "Crossway Village (2)"
  aldermere: nameContains('aldermere'),       // slice seed opening town
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
    note: 'Frontier outpost (the far twin, not the start node). Joan of Arc voice. PLACED.',
    nodeSelector: SELECTORS.frontierFar,
  },
  {
    key: 'scholar',
    name: 'The Kant-Knight',
    role: 'scholar',
    voiceCorpusId: 'kant-knight',
    personality: { trustOfOutsiders: 0.4, selfPreservation: 0.5, honesty: 0.9 },
    note: 'The market town (Saltmarket). Kant×Knight voice. PLACED.',
    nodeSelector: SELECTORS.trade,
  },
  {
    key: 'clown-leader',
    name: 'Goldblum-Socrates',
    role: 'clown-leader',
    voiceCorpusId: 'goldblum-socrates',
    personality: { trustOfOutsiders: 0.6, selfPreservation: 0.4, honesty: 0.6 },
    note: 'The pilgrim town (Pilgrim\'s Rest). Goldblum-Socrates voice. PLACED.',
    nodeSelector: SELECTORS.faith,
  },
  {
    key: 'cannibal-prophet',
    name: 'The Host',
    role: 'cannibal-prophet',
    voiceCorpusId: 'jesus',
    personality: { trustOfOutsiders: 0.3, selfPreservation: 0.5, honesty: 0.7 },
    note: 'The set-apart outlier hamlet (Crossway Village (2)). Jesus/Host voice. PLACED.',
    nodeSelector: SELECTORS.outlier,
  },
  {
    key: 'the-goat',
    name: 'The Goat of the Blasted Heath',
    role: 'wilderness-hermit',
    voiceCorpusId: 'twain',
    personality: { trustOfOutsiders: 0.2, selfPreservation: 0.6, honesty: 0.5 },
    note: 'Wilderness (the Blasted Heath). DEFERRED — injectDemoFigures runs only in the '
        + 'SETTLEMENT decompress pipeline, so a wilderness node never reaches it. Needs a '
        + 'wilderness-encounter hook before the Goat can wander; placing him in a town would '
        + 'break the fiction. Selector stays null until that hook exists.',
    nodeSelector: null /* DEFERRED: needs a non-settlement (wilderness) injection hook */,
  },
  {
    key: 'carl',
    name: 'Carl',
    role: 'failed sculptor; avian theorist',
    voiceCorpusId: 'carl_manifesto',
    personality: { trustOfOutsiders: 0.2, selfPreservation: 0.7, honesty: 0.9 },
    // SOAPBOX-1 — Carl's cause. He EVANGELIZES avian supremacy to any stranger
    // (share gate opens on-topic regardless of trust); `eager` makes him greet
    // you already reaching for it. Personal secrets stay trust-gated. Topics are
    // explicit surface forms (whole-word match, no stemming) — the manifesto's
    // foils (duck, pigeon) included so a dismissive mention still lights him up.
    soapbox: {
      cause: 'avian supremacy',
      eager: true,
      topics: [
        'chicken', 'chickens', 'avian', 'avians', 'bird', 'birds',
        'feather', 'feathers', 'feathered', 'poultry',
        'rooster', 'roosters', 'hen', 'hens', 'comb', 'combs',
        'beak', 'beaks', 'fowl', 'fowls', 'wattle', 'plumage', 'plume',
        'sculpt', 'sculptor', 'sculptors', 'sculpture', 'sculptures', 'sculpting', 'sculpted',
        'art', 'arts', 'artist', 'form', 'forms', 'proportion', 'proportions',
        'supremacy', 'supreme', 'hierarchy', 'hierarchies', 'skull', 'skulls',
        'duck', 'ducks', 'pigeon', 'pigeons',
      ],
    },
    // CARL-SELF-1 — Carl IS a chicken and KNOWS it (Tim canon 2026-07-07: "He's a
    // chicken... Yes, he knows what he is"). `species` is the machine-checkable
    // nature the identity matcher keys on (matchesSelfIdentity) and the deterministic
    // proud affirmation is built from; `selfConcept` is the authored line that grounds
    // the live LLM voice. Both OPTIONAL — an NPC without them is byte-unchanged (U642).
    species: 'chicken',
    selfConcept: 'He is himself a chicken — the awakened fowl, living proof of his own '
      + 'thesis on avian supremacy — and he declares it with pride when asked what he is.',
    note: 'Aldermere (slice seed opening town). Obsessive pseudo-scholar. RAG corpus: 8k-word avian-supremacy manifesto.',
    nodeSelector: SELECTORS.aldermere,
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
    // SOAPBOX-1 — the authored cause rides onto the live NPC so buildNpcContext
    // (and the eager opener) can see it. Absent on figures without one → the NPC
    // behaves exactly as before. Frozen shape: { cause, eager, topics:[...] }.
    ...(figure.soapbox ? { soapbox: figure.soapbox } : {}),
    // CARL-SELF-1 — the authored self-knowledge rides onto the live NPC. `species`
    // feeds the identity matcher + the deterministic proud affirmation; `selfConcept`
    // grounds the live LLM voice (buildNpcContext → prompt). Absent on figures without
    // them → the NPC is byte-unchanged (U642).
    ...(figure.species ? { species: figure.species } : {}),
    ...(figure.selfConcept ? { selfConcept: figure.selfConcept } : {}),
    // Mark provenance so a later pass / debug can tell authored figures apart from
    // minted NPCs without re-matching the table.
    authoredFigure: figure.key,
  };
}

/**
 * injectDemoFigures({ world, node, npcs }) -> npcs (possibly with a figure prepended)
 *
 * Returns the settlement's NPC list with any authored figure whose live
 * `nodeSelector` matches this node PREPENDED. Gated to authored seeds
 * (`world.meta.seed === DEMO_SEED` or `SLICE_SEED`) — every other seed is returned untouched.
 * Deterministic and idempotent: a figure id is stable, and we never add the same
 * figure twice (id-dedup against the incoming list).
 *
 * Only figures with a non-null `nodeSelector` are ever considered, so unplaced
 * figures are inert until a selector is assigned.
 */
export function injectDemoFigures({ world, node, npcs }) {
  const list = Array.isArray(npcs) ? npcs : [];
  // Gate: only authored seeds (demo or slice) get the overlay. Anything else is byte-identical.
  const isAuthoredSeed = world?.meta?.seed === DEMO_SEED || world?.meta?.seed === SLICE_SEED;
  if (!world || !isAuthoredSeed) return list;
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
