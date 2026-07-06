// engine/world/commonKnowledge.js
//
// The region-common-knowledge bank (PW-5). See docs/briefs/PW-5-audit.md.
//
// Closes the residual dialogue dead-end: when a local is asked about a NEIGHBOURING
// settlement's grounded lore — its founding, its history, what happened there — the
// engine used to shrug ("couldn't say, ask someone older") because the fact lives on
// ANOTHER node, not in this NPC's head, not as a rumour, and not as a current-node
// place-fact. A co-located local plausibly KNOWS the next town's founding story, so
// answering it is what a real DM would do (THE_TABLE_TEST). This module is the classifier
// + resolver for that one case.
//
// It is PURE and RENDER-FREE (the placeQuery / personQuery contract): classify the ask,
// resolve a TYPED grounded fact for the named node from canon, or return null. The NPC
// voice layer (dialogue.renderCommonLoreNpc) is a RENDERER over the same fact — one fact,
// two voices, no second source of truth. It reuses placeQuery's resolvers verbatim via
// resolvePlaceFactForNode, so a neighbour's founding reads identically whether the DM
// narrates it on arrival or a local recounts it here.
//
// READ-ONLY: mutates nothing, mints nothing, invents no lore, touches no reputation, makes
// no rng draw. resolvePlaceFactForNode derives an unvisited node's grounded events through
// substrateEventsPeek (pure) without caching them — so worldHash is unaffected and the
// determinism gates stay green (the answer is byte-identical for the same world + ask).
//
// LAW_OF_EARNED_KNOWLEDGE:
//   - Tier 1 (earnable local knowledge): delivers ONLY a fact a resolver pulls from canon;
//     resolver null → the caller honest-declines. No fabrication.
//   - Tier 2 (unknown): an ungrounded place ask (a node canon never authored) → no node
//     match or null fact → deflect. A roll can never manufacture it (there is no roll here).
//   - Tier 3 (§0 / protected mystery): whitelisted to founding/history/events labels, which
//     are authored never to allude to the cosmology. Secret/control phrasings are EXCLUDED
//     up front (LEADERSHIP_SECRET_RE) and never classified.
//   - Tier 4 (other minds): answers WORLD facts about a PLACE, never a person's motive or
//     secret allegiance — PERSON_DEFER guards drop "who does <leader> really serve" asks.

import { resolvePlaceFactForNode } from './placeQuery.js';

// ── Exclusion guards (mirror dialogue.js / personQuery.js verbatim) ──────────────
// Any ask that trips one of these is NOT common lore — it is a secret / motive / §0 /
// control / danger ask that MUST stay deferred. We drop it before classifying, so the
// caller's honest decline (and the reveal-sink law) own it. These are copied from the
// existing gates (personQuery.PERSON_DEFER_RE, dialogue.LEADERSHIP_SECRET_RE, and the
// history/control exclusions in dialogue.NOT_PLACE_DESCRIPTION_RE) so the three sinks agree.

// Secret CONTROL / hidden power ("who really runs / secretly controls / pulls the strings /
// the cult / behind it") — reveal-sink law (Biblioteca V12-13): never a free answer.
const LORE_SECRET_RE = /\b(?:secretly|really\s+(?:runs?|controls?)|controls?|controlling|pulls?\s+the\s+strings|behind\s+(?:it|this|everything|the\s+curtain)|the\s+cult|cultist|shadow|puppet|true\s+power|actually\s+in\s+(?:charge|control)|conspir)\b/i;

// Other-minds / motive / allegiance / secret-state ("who serves / loyal to / plotting /
// hiding / what does X want / thinking") — Tier 4: comes from the source, never the narrator.
const LORE_MOTIVE_RE = /\b(?:serves?|serving|loyal|allegiance|faction|plott?ing|planning|scheming|hiding|hide|thinking|thinks?|wants?|plotting|betray|traitor|spy(?:ing)?|working\s+for)\b/i;

// ── Lore intent → place-query type ───────────────────────────────────────────────
// Each pattern keys off a lore VERB (found/history/happened/tell-me-about). The NAMED
// node supplies the "which place"; these supply the "what about it". Ordered: a founding/
// history ask wins over the generic "tell me about", and an events ask ("what happened in
// <town>") maps to the events type. Agent/count asks ("who founded / what year") are left
// UNMATCHED here so they route to honest-decline (the founding label holds no name/number).

const AGENT_COUNT_RE = /\b(?:who|whose|whom|how\s+many|which\s+famil|by\s+name|what\s+year|what\s+date|named\b)\b/i;

const FOUNDING_INTENT_RE = /\b(?:found(?:ed|ing)?|settled|settling|built|establish(?:ed|ing)?|history|story|past|how\s+old|origins?|came\s+to\s+be)\b/i;
const EVENTS_INTENT_RE   = /\b(?:happen(?:ed|s|ing)?|goes?\s+on|going\s+on|went\s+on|trouble|troubles?)\b/i;
// The bare "tell me about / what about / know about / what's <place> like / heard of" ask —
// treated as a founding/overview-grade lore ask about the named place.
const ABOUT_INTENT_RE    = /\b(?:tell\s+me\s+about|what\s+about|know\s+about|heard\s+of|what(?:'?s| is)\s+.*\blike|describe)\b/i;

/**
 * findNamedOtherNode(world, text, hereId) → node | null
 * The named settlement/place in the ask that is NOT the node you stand on. Longest
 * name wins (so "Crowfoot Camp" beats a stray "Camp"). Deterministic: name-length
 * desc, then id asc for ties. Only real nodes in world.map.nodes qualify — an
 * unmodelled place name matches nothing and the caller deflects (Tier 2).
 */
export function findNamedOtherNode(world, text, hereId) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  const here = String(hereId || world?.map?.currentNodeId || '');
  const matches = nodes.filter(n => {
    if (!n || String(n.id) === here) return false;
    const name = String(n.name || '').trim().toLowerCase();
    if (!name) return false;
    // Word-boundary match so "Greenwood" isn't matched inside an unrelated token.
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return re.test(t);
  });
  if (!matches.length) return null;
  matches.sort((a, b) =>
    String(b.name).length - String(a.name).length ||
    String(a.id).localeCompare(String(b.id)));
  return matches[0];
}

/**
 * classifyCommonLoreQuery(world, text, hereId) → { nodeId, nodeName, type } | null
 * Detects "ask about a NAMED neighbouring place's grounded lore". null unless the ask
 * (a) names another real node, (b) carries a lore intent, and (c) trips NONE of the
 * secret/motive/agent-count guards. Pure; no world read beyond the node roster.
 */
export function classifyCommonLoreQuery(world, text, hereId) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;

  // Guards first — a secret/motive/agent ask is NEVER common lore (stays deferred).
  if (LORE_SECRET_RE.test(t) || LORE_MOTIVE_RE.test(t) || AGENT_COUNT_RE.test(t)) return null;

  const node = findNamedOtherNode(world, t, hereId);
  if (!node) return null;

  let type = null;
  if (EVENTS_INTENT_RE.test(t))        type = 'events';
  else if (FOUNDING_INTENT_RE.test(t)) type = 'founding';
  else if (ABOUT_INTENT_RE.test(t))    type = 'founding'; // "tell me about <town>" → its founding/character
  if (!type) return null;

  return { nodeId: String(node.id), nodeName: String(node.name || ''), type };
}

/**
 * resolveCommonLore(world, { text, hereId }) → { type, body, nodeName } | null
 * The bank's read: classify the ask, resolve the named node's grounded lore fact from
 * canon (reusing placeQuery's resolvers), return it — or null (→ honest decline / PW-3
 * rumour pickup). READ-ONLY, deterministic, no mutation, no rng, no reputation touch.
 * A classified ask whose node has no such grounded fact (e.g. an authored node with no
 * region crisis for a `history` ask) still returns null → the turn deflects honestly.
 */
export function resolveCommonLore(world, { text, hereId } = {}) {
  const q = classifyCommonLoreQuery(world, text, hereId);
  if (!q) return null;
  const fact = resolvePlaceFactForNode(world, q.nodeId, { type: q.type });
  if (!fact || !fact.body) return null;
  return { type: fact.type, body: String(fact.body), nodeName: q.nodeName };
}
