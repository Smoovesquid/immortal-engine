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

// An AGENT or COUNT ask wants a name/number a circumstance/event label never holds —
// excluded so it routes to honest-decline (C9 non-invention), never a place-fact deliver.
// SHARED across place types: the circumstance-vs-agent boundary is a property of the DATA,
// uniform — not a per-type trick (docs/WORLD_QUERY_RESOLVER.md §2).
const PLACE_AGENT_COUNT_RE = /\b(?:who|whose|whom|how\s+many|which\s+famil|by\s+name|named?\b|what\s+year|what\s+date)\b/i;

function isFoundingCircumstance(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (PLACE_AGENT_COUNT_RE.test(t)) return false;
  return PLACE_FOUNDING_QUERY_RE.test(t);
}

function resolveFounding(world) {
  const nodeId = String(world?.map?.currentNodeId || '');
  if (!nodeId) return null;
  const ev = substrateEventsFor(world, nodeId).find(e => e && e.layer === 'node' && e.kind === 'founding');
  return ev?.label ? { type: 'founding', body: String(ev.label), clarity: 'vivid' } : null;
}

// ── Type: events ───────────────────────────────────────────────────────────────
// "What happened here? / what goes on in this town? / any trouble here?" → a node substrate
// LOCAL-EVENT (NODE layer, 'vivid'). PLACE-ANCHORED on purpose (here / this <place>): that
// anchor is the GUARD that keeps RELATIONAL history ("the history between X and Y") and PERSON
// questions ("what happened to the baker") OFF this type — they carry no place anchor, so they
// fall to their own deflect/decline paths (the C9-002/003 dialogue deflects stay green). The
// bare "what happened?" (no anchor) keeps its own handler. Agent/count asks are excluded too
// (shared boundary). Delivers ONE event deterministically (the earliest local-event); a node
// with no local-event honest-declines. §0-safe (substrate labels never allude to the cosmology).
const PLACE_EVENTS_QUERY_RE = new RegExp([
  // what happened / what's happened / has anything happened … here / in this <place>
  /\bwhat(?:'?s| has| have| had)?\b[^.?!]{0,24}?\bhappen(?:ed|s|ing)?\b[^.?!]{0,16}?\b(?:here|around\s+here|in\s+this\s+(?:place|town|village|settlement|hamlet|city|outpost|crossing))\b/,
  // anything/something happen(ed) … here
  /\b(?:any|some)thing\s+happen(?:ed|ing|s)?\b[^.?!]{0,16}?\b(?:here|around\s+here|in\s+this\s+(?:place|town|village|settlement))\b/,
  // what/any trouble … here / this <place>
  /\b(?:what|any)\s+troubles?\b[^.?!]{0,20}?\b(?:here|this\s+(?:place|town|village|settlement))\b/,
  // what goes on / went on / going on … (around) here / in this <place>
  /\bwhat(?:'?s)?\b[^.?!]{0,12}?\b(?:goes?\s+on|going\s+on|gone\s+on|went\s+on)\b[^.?!]{0,16}?\b(?:here|around\s+here|in\s+this\s+(?:place|town|village|settlement))\b/,
].map(r => r.source).join('|'), 'i');

function isEventsQuery(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (PLACE_AGENT_COUNT_RE.test(t)) return false; // "who caused …" = agent → decline, not an event deliver
  return PLACE_EVENTS_QUERY_RE.test(t);
}

function resolveEvents(world) {
  const nodeId = String(world?.map?.currentNodeId || '');
  if (!nodeId) return null;
  const ev = substrateEventsFor(world, nodeId).find(e => e && e.layer === 'node' && e.kind === 'local-event');
  return ev?.label ? { type: 'events', body: String(ev.label), clarity: 'vivid' } : null;
}

// ── The resolver (one mechanism) ───────────────────────────────────────────────
// Add a place TYPE as one { type, classify, resolve } slot — never a bespoke handler.
// Order matters only for overlap; founding ("history of this place") and events ("what
// happened here") are disjoint by design, so first-match is unambiguous.
const PLACE_TYPES = [
  { type: 'founding', classify: isFoundingCircumstance, resolve: resolveFounding },
  { type: 'events',   classify: isEventsQuery,          resolve: resolveEvents },
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
