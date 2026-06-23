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

// ── Type: population ───────────────────────────────────────────────────────────
// Broad PUBLIC roster — "who lives here? / who's in town? / is anyone around? / what kind
// of people live here?" → name the present SOCIABLE (non-hostile) settlement roster from
// node.settlement.npcs; a node with none honest-declines. Unlike founding/events (which
// EXCLUDE "who"), population IS a who-question, so it carries its OWN exclusion of the
// LOADED who-asks it must never answer:
//   - founder ("who founded/built/settled")        → founding type / honest-decline
//   - cause/agent ("who caused / is behind")        → not the roster
//   - secret/control ("who secretly controls / really runs / runs the cult / in charge /
//     pulls the strings")                           → guarded; NEVER invent a controller
//   - services ("who sells / buys / the blacksmith")→ stays the services/shops path
//   - leadership ("who leads / the leader / elder")  → left to existing handlers
// SIGHT-SCOPED SAFETY (mirrors the location survey): hostiles are NEVER named — a lurking
// bandit is not a neighbor; he reads as "a stranger keeping to the edges, watching".
// The existing META_NPC_ROSTER ("who are all these people / who's everyone") fires first
// (playloop isMetaQuestion) and is untouched — population takes the GAP phrasings. (A future
// slice may unify META_NPC_ROSTER + the location-survey roster INTO this slot.) §0-safe:
// names/roles only; no affiliation, no cosmology.
const PLACE_POPULATION_QUERY_RE = new RegExp([
  /\bwho(?:'s| is| are)\s+(?:here|about|around|in\s+(?:town|this\s+(?:town|village|place|settlement|hamlet)))\b/,
  /\bwho\s+lives\s+(?:here|around\s+here|in\s+this\s+(?:town|village|place|settlement|hamlet))\b/,
  /\bwhat\s+(?:kind|sort|manner)\s+of\s+(?:people|folk|folks)\b/,
  /\b(?:is|are)\s+(?:there\s+)?(?:any(?:one|body)|some(?:one|body)|people|folk)\s+(?:here|around|about|in\s+town)\b/,
  /\banyone\s+(?:here|around|about)\b/,
].map(r => r.source).join('|'), 'i');

// LOADED who-asks population must never answer — founder / cause / secret-control / services
// / leadership. Excluded so they route to their own paths (founding type, decline, services).
// Also excludes SINGLING-OUT a specific/hidden person ("the one …", spying/watching me) —
// "is anyone here the one who's been watching me?" is a hidden-agent / surveillance question
// (its own decline path), NOT a broad "who lives here" roster ask. Bare presence ("is anyone
// around?") has no such predicate and still resolves.
const PLACE_POPULATION_EXCLUDE_RE = /\b(?:found(?:ed|er|ers|ing)|built|settled|caused|responsible|behind\s+(?:this|it|all|everything)|controls?|controlling|secretly|really\s+runs?|runs?\s+(?:the\s+cult|this|things)|in\s+charge|in\s+control|pulls?\s+the\s+strings|the\s+boss|sells?|selling|buys?|buying|blacksmith|smith|merchant|leads?|leader|leading|elder|chief|mayor|in\s+power|the\s+one|spy(?:ing|ied|ed)?|watching\s+me|watched\s+me|been\s+(?:watching|following|spying)|following\s+me|spied\s+on)\b/i;

function isPopulationQuery(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (PLACE_POPULATION_EXCLUDE_RE.test(t)) return false;
  return PLACE_POPULATION_QUERY_RE.test(t);
}

// describeNpc-equivalent (kept local so placeQuery stays decoupled from grace's helpers).
// Name + role, with the same "don't double a title already in the name" guard.
function describePresentNpc(npc) {
  const name = String(npc?.name ?? '').trim();
  const role = String(npc?.role ?? npc?.occupation ?? '').trim();
  if (name && /\bthe\b/i.test(name)) return name;     // "Brogan the Elder" — don't append a role
  if (name && role) return `${name} the ${role}`;
  if (name) return name;
  if (role) return `a ${role}`;
  return 'a stranger';
}

function joinNames(arr) {
  const a = arr.filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(', ')}, and ${a[a.length - 1]}`;
}

// `query.excludeId` is the PERSPECTIVE param (one fact, two voices): the DM-narrator passes
// none (names everyone), the NPC-dialogue renderer passes the SPEAKING npc's id so a local
// doesn't list itself in third person. Same roster, speaker-adjusted — not a second source.
function resolvePopulation(world, query) {
  const nodeId = String(world?.map?.currentNodeId || '');
  if (!nodeId) return null;
  const node = (Array.isArray(world?.map?.nodes) ? world.map.nodes : []).find(n => n && n.id === nodeId);
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  const excludeId = query?.excludeId ? String(query.excludeId) : '';
  // Only exclude when a speaker id is actually given — an empty excludeId must never drop
  // id-less roster entries (it would equal their String(undefined) === '').
  const sociable = npcs.filter(n => n && !n.hostile && (!excludeId || String(n.id || '') !== excludeId));
  if (!sociable.length) return null; // not a populated place (or only the speaker / lurkers) → honest-decline; never name a hostile
  const lurkers = npcs.filter(n => n && n.hostile).length;
  const named = sociable.slice(0, 4).map(describePresentNpc);
  const remainder = sociable.length - Math.min(4, sociable.length);
  if (remainder > 0) named.push(`${remainder} other${remainder === 1 ? '' : 's'}`);
  let body = `${joinNames(named)} ${sociable.length === 1 ? 'lives' : 'live'} here`;
  if (lurkers > 0) body += lurkers === 1
    ? ', and a stranger keeps to the edges, watching'
    : `, and ${lurkers} strangers keep to the edges, watching`;
  return { type: 'population', body, clarity: 'vivid' };
}

// ── Type: overview ───────────────────────────────────────────────────────────
// "What is this place? / tell me about this town / describe this village / what's
// this town like / what kind of place is this" → the broad IDENTITY of where you
// stand: the node's NAME + its founding line (the place's character in one fact).
// This is the natural "tell me about here" ask that is NOT a founding-HISTORY
// question (how/why founded), NOT an events question (what happened), NOT a roster
// (who's here) — disjoint from those, so it carries its own classifier. PLACE-ANCHORED
// on purpose (this <place> / here): "tell me about Corwin" (a person) and "tell me
// about the orb" (a topic) carry no place anchor → they fall to their own paths. A
// settlement always has a name, so this almost always DELIVERS (you can always say
// where you stand); the founding line is appended only when the substrate has it.
// §0-safe: name + founding label only, authored never to allude to the cosmology.
const PLACE_OVERVIEW_QUERY_RE = new RegExp([
  // what is / what's this <place> (… like)
  /\bwhat(?:'?s| is)\s+(?:this|the)\s+(?:place|town|village|settlement|hamlet|city|outpost|crossing|hold)\b/,
  // tell me about this <place> / tell me about here
  /\btell\s+me\s+about\s+(?:this\s+(?:place|town|village|settlement|hamlet|city|outpost|crossing|hold)|here)\b/,
  // describe this <place>
  /\bdescribe\s+(?:this|the)\s+(?:place|town|village|settlement|hamlet|city|outpost|crossing|hold)\b/,
  // what kind/sort/manner of place is this
  /\bwhat\s+(?:kind|sort|manner)\s+of\s+(?:place|town|village|settlement|hamlet)\s+is\s+this\b/,
].map(r => r.source).join('|'), 'i');

function isOverviewQuery(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (PLACE_AGENT_COUNT_RE.test(t)) return false; // "who/whose/how many …" is not an overview
  return PLACE_OVERVIEW_QUERY_RE.test(t);
}

function resolveOverview(world) {
  const nodeId = String(world?.map?.currentNodeId || '');
  if (!nodeId) return null;
  const node = (Array.isArray(world?.map?.nodes) ? world.map.nodes : []).find(n => n && n.id === nodeId);
  const name = String(node?.name || '').trim();
  if (!name) return null; // nowhere named → honest-decline (never invent a place)
  const ev = substrateEventsFor(world, nodeId).find(e => e && e.layer === 'node' && e.kind === 'founding');
  const founding = ev?.label ? String(ev.label) : '';
  const body = founding ? `this is ${name} — ${founding}` : `this is ${name}`;
  return { type: 'overview', body, clarity: 'vivid' };
}

// ── The resolver (one mechanism) ───────────────────────────────────────────────
// Add a place TYPE as one { type, classify, resolve } slot — never a bespoke handler.
// The types are disjoint by design (founding = "history of this place", events = "what
// happened here", population = "who's here", overview = "what this place is"), so
// first-match is unambiguous.
const PLACE_TYPES = [
  { type: 'founding',   classify: isFoundingCircumstance, resolve: resolveFounding },
  { type: 'events',     classify: isEventsQuery,          resolve: resolveEvents },
  { type: 'population', classify: isPopulationQuery,      resolve: resolvePopulation },
  { type: 'overview',   classify: isOverviewQuery,        resolve: resolveOverview },
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
  return slot ? slot.resolve(world, query) : null;
}
