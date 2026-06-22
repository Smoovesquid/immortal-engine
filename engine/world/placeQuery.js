// engine/world/placeQuery.js
//
// The World-Query Resolver — PLACE scope. See docs/WORLD_QUERY_RESOLVER.md.
//
// Category-first structure for the world-wiring (W-#) track: ONE resolver maps any
// place-knowledge question to a TYPED slot, looks the answer up from that type's data
// source, and returns a structured grounded fact — or null when the data has no answer
// (the known/unknown boundary IS the data's absence; callers honest-decline, never invent).
//
// This module is PURE and RENDER-FREE: classify + resolve only. The DM-narrator and the
// NPC-dialogue paths are RENDERERS over the same resolved fact (one fact, two voices) —
// they live with their voice (playloop / dialogue), not here. This module OWNS place
// knowledge; the voices do not.
//
// WorldQuery umbrella (named, not built): the same shape will later extend to `person`-
// and `object`-queries. Only `place` exists now (demand-pulled). Do NOT add person/object
// resolvers here speculatively — and add a place TYPE only when a real question needs it.
//
// Roll policy (settled at the category level — docs/WORLD_QUERY_RESOLVER.md §2):
//   - common / public / visible place facts → delivered with NO roll (this resolver).
//   - unknown / unmodeled facts → honest decline, NO roll (caller; resolver returns null).
//   - guarded / secret / NPC-withheld facts → NOT this resolver; the existing social /
//     pressing path may roll (playloop lookupGroundedFact).
// §0 (docs/DEMO_REGION.md hidden-why): every fact this resolver surfaces is symptom / fact
// level, never the cosmology. Substrate-backed types are safe by construction (labels are
// authored never to allude). Folk-level types added later (rumor/dangers) get a §0 check.

import { substrateEventsFor } from '../substrate.js';

// ── Type: founding ───────────────────────────────────────────────────────────
// "How/why was this place founded/settled?" / "the history of this town" / "how old is
// this place" → the node's substrate founding event (NODE layer = this settlement's own
// founding, 'vivid' clarity). CIRCUMSTANCE forms only — who/whose/how-many/which-family
// asks request an AGENT or COUNT the founding label never holds; they are NOT classified
// here, so the caller honest-declines them (non-invention, C9). NODE-scoped: region /
// cosmology events are never returned, so a node with no node-substrate (the bare
// village_baker fixture) correctly declines its founding questions.
const PLACE_FOUNDING_QUERY_RE = new RegExp([
  // how/why was this <place> founded/settled/built/established/raised/came to be/grew
  /\b(?:how|why)\b[^.?!]{0,30}?\bthis\b[^.?!]{0,18}?\b(?:place|town|village|settlement|hamlet|city|outpost|crossing|hold|here)\b[^.?!]{0,18}?\b(?:found\w*|settled|settling|settlement|built|build|establish\w*|raised|(?:come|came)\s+to\s+be|begin|began|grew|grow)\b/,
  // how/why was it/here founded/settled/built/established (bare subject, place context)
  /\b(?:how|why)\b[^.?!]{0,20}?\b(?:it|here)\b[^.?!]{0,14}?\b(?:found\w*|settled|settling|establish\w*|built)\b/,
  // (the) founding/history/story/past of this <place>
  /\b(?:founding|history|story|past)\s+of\s+(?:this|the)\b[^.?!]{0,18}?\b(?:place|town|village|settlement|hamlet|city|outpost|crossing|hold|inn|tavern)\b/,
  // how old is this <place>
  /\bhow\s+old\s+is\s+(?:this|the)\b[^.?!]{0,18}?\b(?:place|town|village|settlement|hamlet|city|outpost|crossing|hold)\b/,
].map(r => r.source).join('|'), 'i');

// An AGENT or COUNT ask wants a name/number the substrate founding label never holds —
// excluded here so it routes to honest-decline (C9 non-invention), never the founding deliver.
const PLACE_FOUNDING_AGENT_COUNT_RE = /\b(?:who|whose|whom|how\s+many|which\s+famil|by\s+name|named?\b|what\s+year|what\s+date)\b/i;

function isFoundingCircumstance(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (PLACE_FOUNDING_AGENT_COUNT_RE.test(t)) return false;
  return PLACE_FOUNDING_QUERY_RE.test(t);
}

function resolveFounding(world) {
  const nodeId = String(world?.map?.currentNodeId || '');
  if (!nodeId) return null;
  const ev = substrateEventsFor(world, nodeId).find(e => e && e.layer === 'node' && e.kind === 'founding');
  return ev?.label ? { type: 'founding', body: String(ev.label), clarity: 'vivid' } : null;
}

// ── The resolver (one mechanism) ───────────────────────────────────────────────
// Add a place TYPE as one { type, classify, resolve } slot — never a bespoke handler.
const PLACE_TYPES = [
  { type: 'founding', classify: isFoundingCircumstance, resolve: resolveFounding },
];

/**
 * classifyPlaceQuery(text) → { scope:'here', type } | null
 * Maps a phrasing to a typed place-knowledge slot. null = not a place-knowledge query
 * (the caller leaves the turn to its other handlers). Phrasings are ABSORBED here.
 */
export function classifyPlaceQuery(text) {
  for (const slot of PLACE_TYPES) {
    if (slot.classify(text)) return { scope: 'here', type: slot.type };
  }
  return null;
}

/**
 * resolvePlaceFact(world, query) → { type, body, clarity } | null
 * Looks the typed slot up from its data source. null = the data has no answer → the caller
 * honest-declines (never invents). Pure, deterministic, NO roll, NO mutation.
 */
export function resolvePlaceFact(world, query) {
  const slot = PLACE_TYPES.find(s => s.type === (query && query.type));
  return slot ? slot.resolve(world) : null;
}
