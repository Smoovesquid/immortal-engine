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

import { substrateEventsFor, substrateEventsPeek } from '../substrate.js';
import { npcWant } from '../npc/npcArc.js';
import { SLICE_SEED, pickAldermereWorry, isAldermereTownNode } from './sliceRegion.js';

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

// Event source for a resolver, honouring an OPTIONAL explicit target node.
// query.nodeId absent (or === currentNodeId) → the current node via substrateEventsFor
// (unchanged behaviour). query.nodeId naming a DIFFERENT node → substrateEventsPeek
// (READ-ONLY: the neighbouring node's grounded events, derived without caching — the
// same labels a visit would surface). This is the ONLY difference between resolving
// "here" and resolving a named neighbour; the fact logic below is shared verbatim.
function eventsForQuery(world, query) {
  const cur    = String(world?.map?.currentNodeId || '');
  const target = query && query.nodeId != null ? String(query.nodeId) : cur;
  if (!target) return { nodeId: '', events: [] };
  const events = target === cur ? substrateEventsFor(world, target) : substrateEventsPeek(world, target);
  return { nodeId: target, events };
}

function resolveFounding(world, query) {
  const { nodeId, events } = eventsForQuery(world, query);
  if (!nodeId) return null;
  const ev = events.find(e => e && e.layer === 'node' && e.kind === 'founding');
  return ev?.label ? { type: 'founding', body: String(ev.label), clarity: 'vivid' } : null;
}

// ── Type: events ───────────────────────────────────────────────────────────────
// "What happened here? / what goes on in this town? / any trouble here?" → ALL node substrate
// LOCAL-EVENTs (NODE layer, 'vivid'), joined. A node may have 1–2 local events; returning them
// all means "what happened the winter a stranger stayed?" surfaces the right label even when it
// is the second event, not the first. PLACE-ANCHORED on purpose (here / this <place>): that
// anchor is the GUARD that keeps RELATIONAL history ("the history between X and Y") and PERSON
// questions ("what happened to the baker") OFF this type — they carry no place anchor, so they
// fall to their own deflect/decline paths (the C9-002/003 dialogue deflects stay green). The
// bare "what happened?" (no anchor) keeps its own handler. Agent/count asks are excluded too
// (shared boundary). A node with no local-event honest-declines. §0-safe.
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

function resolveEvents(world, query) {
  const { nodeId, events } = eventsForQuery(world, query);
  if (!nodeId) return null;
  const evs = events.filter(e => e && e.layer === 'node' && e.kind === 'local-event');
  if (!evs.length) return null;
  const body = evs.map(e => String(e.label)).join('; also, ');
  return { type: 'events', body, clarity: 'vivid' };
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

// ── Type: concern ────────────────────────────────────────────────────────────
// "Anything I can help with? / what does the town need? / is anyone in trouble? /
// what's troubling folk here?" → the town's FORWARD-LOOKING public concern: the
// readable surface WANTS the present people carry (engine/npc/npcArc.npcWant — the
// shallow "what you read after a word or two" layer, role-shaped + deterministic). This
// is the bridge from a legible town into the talk→quest loop (D-B1): a want a player
// offers to help with becomes a goal. DISTINCT from `events` (PAST history / "what
// happened") — this is what's UNSETTLED now. SIGHT-SCOPED safety (mirrors population): a
// hostile lurker is never a concern-bearer. A node with no sociable roster honest-declines.
// §0-safe: npcWant draws only from the mundane role/default want pools (a harvest that
// holds, a quiet night, a caravan that arrives whole) — authored never to allude to the
// cosmology. Curated, town-level concerns (SL-5, landed): the slice's own Aldermere town
// node overrides this resolver's source with a seed-stable 2-entry authored table (see
// resolveConcern below) — every other pack/seed/node stays on the generic pool untouched.
const PLACE_CONCERN_QUERY_RE = new RegExp([
  // anything I can/could help with · how can I help · can I be of help/use
  /\b(?:any|some)thing\b[^.?!]{0,20}?\bi\b[^.?!]{0,8}?\b(?:can|could|might)\b[^.?!]{0,8}?\bhelp\b/,
  /\bhow\s+(?:can|could|might)\s+i\s+(?:help|be\s+of\s+(?:help|use)|lend\s+a\s+hand)\b/,
  /\b(?:can|could)\s+i\s+(?:help|be\s+of\s+(?:help|use)|lend\s+a\s+hand)\b/,
  // what does the town/people/folk need
  /\bwhat\s+do(?:es)?\s+(?:this\s+)?(?:town|village|settlement|place|people|folk|everyone)\s+need\b/,
  // is anyone in trouble/need/danger · does anyone need help/a hand
  /\b(?:is|are)\s+(?:any(?:one|body)|the\s+people|folk)\s+in\s+(?:trouble|need|danger)\b/,
  /\bdo(?:es)?\s+(?:any(?:one|body)|the\s+people|folk)\s+need\s+(?:help|a\s+hand|anything)\b/,
  /\bany(?:one|body)\s+need(?:s|ing)?\s+(?:help|a\s+hand)\b/,
  // what's troubling/worrying/bothering the people/folk/town
  /\bwhat(?:'?s| is|\s+are)\b[^.?!]{0,12}?\b(?:troubling|worrying|bothering|weighing\s+on|eating)\b[^.?!]{0,12}?\b(?:the\s+)?(?:people|folk|town|village|everyone|locals)\b/,
].map(r => r.source).join('|'), 'i');

function isConcernQuery(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  return PLACE_CONCERN_QUERY_RE.test(t);
}

function resolveConcern(world) {
  const nodeId = String(world?.map?.currentNodeId || '');
  if (!nodeId) return null;
  const node = (Array.isArray(world?.map?.nodes) ? world.map.nodes : []).find(n => n && n.id === nodeId);
  const seed = String(world?.meta?.seed || '');
  // SL-5 — Aldermere's curated civic worry. Gated to the SAME "is this the
  // authored slice" signal sliceRegion.js/demoFigures.js already establish
  // (seed === SLICE_SEED) AND the current node being Aldermere itself (the
  // town) — every other slice node (forest/camp/chapel) and every other
  // pack/seed falls through to the generic role-pool below, byte-identical.
  if (seed === SLICE_SEED && isAldermereTownNode(node)) {
    const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
    const sociable = npcs.some(n => n && !n.hostile);
    if (!sociable) return null; // no one to carry a concern → caller honest-declines
    const worry = pickAldermereWorry(seed);
    return { type: 'concern', body: worry.body, clarity: 'vivid' };
  }
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  // present sociable NPCs only — never surface a hostile lurker as a concern-bearer
  const sociable = npcs.filter(n => n && !n.hostile)
    .slice()
    .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
  if (!sociable.length) return null; // no one to carry a concern → caller honest-declines
  const seen = new Set();
  const bits = [];
  for (const n of sociable) {
    const want = npcWant(n, seed)?.surface;
    if (!want || seen.has(want)) continue;
    seen.add(want);
    bits.push(`${describePresentNpc(n)} wants ${want}`);
    if (bits.length >= 2) break;
  }
  if (!bits.length) return null;
  return { type: 'concern', body: `folk here carry their small wants — ${joinNames(bits)}`, clarity: 'vivid' };
}

// ── Type: history ─────────────────────────────────────────────────────────────
// "What troubles has this land seen? / what hardships hit this region? / any
// crises in the past?" → REGION-layer substrate events (crises + blessings). These
// are buried one level above the node: events that shaped the WHOLE valley, not just
// this settlement. DISTINCT from `events` (node local-events, THIS settlement's past)
// and from `founding` (how/why THIS place started). Agent/count asks are excluded
// (shared boundary). A region with no crisis/blessing events honest-declines.
// §0-safe: region labels never allude to the cosmology.
const PLACE_HISTORY_QUERY_RE = new RegExp([
  // what troubles / hardships / crises has this land / region / area seen
  /\bwhat\b[^.?!]{0,20}?\b(?:troubles?|hardships?|crises?|crisis|catastrophe|calamity|plagues?|disasters?|strife|wars?|conflicts?|blight|drought|famine)\b[^.?!]{0,20}?\b(?:this\s+(?:land|region|area|valley|country|realm|place|province)|here|around\s+here)\b/,
  // what has this land / region seen / endured / suffered
  /\bwhat\b[^.?!]{0,12}?\bthis\s+(?:land|region|area|valley|country|realm|province)\b[^.?!]{0,16}?\b(?:seen|endured|suffered|survived|faced|gone\s+through|experienced)\b/,
  // what crises / blessings / events shaped this region
  /\bwhat\b[^.?!]{0,16}?\b(?:crises?|crisis|blessings?|events?|history|past)\b[^.?!]{0,20}?\b(?:shaped|marked|defined|struck|hit|befell|came\s+to)\b[^.?!]{0,16}?\b(?:this\s+(?:land|region|area|valley|country|realm|place|province)|here)\b/,
  // what is the history of this land / region / area
  /\bwhat\b[^.?!]{0,12}?\bhistory\b[^.?!]{0,16}?\bthis\s+(?:land|region|area|valley|country|realm|province)\b/,
  // has this region / land known trouble / crisis / war / plague
  /\bhas\b[^.?!]{0,12}?\bthis\s+(?:land|region|area|valley|country|realm)\b[^.?!]{0,16}?\b(?:known|seen|endured|suffered|faced|had)\b/,
].map(r => r.source).join('|'), 'i');

function isHistoryQuery(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (PLACE_AGENT_COUNT_RE.test(t)) return false;
  return PLACE_HISTORY_QUERY_RE.test(t);
}

function resolveHistory(world, query) {
  const { nodeId, events } = eventsForQuery(world, query);
  if (!nodeId) return null;
  // Region events only — node events surface through the `events` type. (Region
  // events are keyed by the node's region, so a neighbour in the same region
  // shares this history — still grounded, never invented.)
  const evs = events.filter(
    e => e && e.layer === 'region' && (e.kind === 'crisis' || e.kind === 'blessing')
  );
  if (!evs.length) return null;
  const body = evs.map(e => String(e.label)).join('; ');
  return { type: 'history', body, clarity: 'distant' };
}

// ── The resolver (one mechanism) ───────────────────────────────────────────────
// Add a place TYPE as one { type, classify, resolve } slot — never a bespoke handler.
// The types are disjoint by design: founding = "history of THIS settlement"; events =
// "what happened at THIS node"; history = "what shaped the REGION"; concern = "what
// folk need now"; population = "who's here"; overview = "what this place is".
const PLACE_TYPES = [
  { type: 'founding',   classify: isFoundingCircumstance, resolve: resolveFounding },
  { type: 'events',     classify: isEventsQuery,          resolve: resolveEvents },
  { type: 'history',    classify: isHistoryQuery,         resolve: resolveHistory },
  { type: 'concern',    classify: isConcernQuery,         resolve: resolveConcern },
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

// The LORE types a NEIGHBOURING node can honestly answer: its founding, its local
// events, and its region's history. NOT population/concern/overview — those are
// live-roster / civic-now / here-name facts that only hold for where you STAND (a
// local doesn't know who is in the next town this moment, nor its present worry).
const NEIGHBOUR_LORE_TYPES = new Set(['founding', 'events', 'history']);

/**
 * resolvePlaceFactForNode(world, nodeId, query) → { type, body, clarity } | null
 *
 * PW-5's region-common-knowledge read: resolve a grounded LORE fact for a NAMED node
 * (a neighbouring settlement), reusing the exact same resolvers as resolvePlaceFact so
 * the NPC voice and the DM narrator render one identical canon fact — never a second
 * source, never a fabrication. READ-ONLY and deterministic: for an unvisited node it
 * derives the node layer through substrateEventsPeek (pure, no cache write, no world.rng
 * draw). Restricted to founding/events/history; any other type returns null. A node with
 * no such grounded fact returns null → the caller honest-declines.
 */
export function resolvePlaceFactForNode(world, nodeId, query) {
  const id   = String(nodeId || '');
  const type = query && query.type;
  if (!id || !NEIGHBOUR_LORE_TYPES.has(type)) return null;
  const slot = PLACE_TYPES.find(s => s.type === type);
  return slot ? slot.resolve(world, { ...query, nodeId: id }) : null;
}
