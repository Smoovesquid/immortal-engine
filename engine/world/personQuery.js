// engine/world/personQuery.js
//
// The World-Query Resolver — PERSON scope. Sibling of engine/world/placeQuery.js.
// See docs/WORLD_QUERY_RESOLVER.md.
//
// Category-first, same contract as placeQuery: map a person-targeted question to a TYPED
// slot, resolve it against GROUNDED present-NPC data, and return a structured fact — or null
// when there is no grounded answer (the caller then honest-declines / falls through; never
// invents). PURE and RENDER-FREE: classify + resolve only. The DM-narrator and the NPC-dialogue
// paths are RENDERERS over the same resolved fact (one fact, two voices).
//
// SLOT (P-1/P-2): `identity` only — name + role + presence of a RESOLVABLE present non-hostile
// NPC, asked by NAME ("who is Corwin?"), by SPECIFIC ROLE ("who is the tavern-keeper?"), or as
// "what do I know about <ref>". These currently FLOOR though the data exists (the Rung-1
// under-claim hole). DEFERRED (no grounded source, already declined elsewhere — do NOT classify):
// motive ("what do they want"), secrets/thoughts ("what are they hiding/thinking"), backstory,
// allegiance/faction ("who do they work for / part of the cult"), tenure/LEADERSHIP identity
// ("who is the elder", held back per the W-4/W-5 leadership-deferral).
//
// SOURCE: node.settlement.npcs — the SAME roster placeQuery.resolvePopulation reads (one source,
// many readers; not a second store). The referent matcher here MIRRORS playloop's
// resolvePresentNpcStrict / resolveNpcByRoleOrDescriptor (a future slice may extract a shared
// presence module); it reads the roster, it does not own it.
//
// REFERENT: never guess. A name/role that does NOT resolve to a present NPC returns null, so the
// narrator falls through to the existing [clarify:referent] guard (no duplication). Bare
// demonstratives ("who is that?") are flagged so the NARRATOR can leave them to dialogue-enter;
// the DIALOGUE voice may resolve a demonstrative to the sole present OTHER NPC.
//
// §0 (docs/DEMO_REGION.md hidden-why): identity surfaces name + role + presence only — never
// allegiance, faction, motive, or anything that could allude to the cosmology.

// "who is X" / "who's X" / "what do I know about X" / "tell me about X" (person-directed).
// Captures the referent X. Place/locative refs (here/there/around) are NOT persons → excluded
// in the resolver (mirrors resolvePresentNpcStrict's stop-list).
const PERSON_IDENTITY_QUERY_RE = new RegExp([
  /\bwho(?:'s| is| was| are)\s+([a-z][\w'’-]*(?:\s+[\w'’-]+){0,3})\b/,
  /\bwhat\s+do\s+i\s+know\s+about\s+([a-z][\w'’-]*(?:\s+[\w'’-]+){0,3})\b/,
  /\btell\s+me\s+about\s+(?:the\s+)?([a-z][\w'’-]*(?:\s+[\w'’-]+){0,3})\b/,
].map(r => r.source).join('|'), 'i');

// DEFER guard — a person-identity ask carrying any of these is NOT identity: it reaches for a
// motive / secret / backstory / allegiance / LEADERSHIP that has no grounded source. Excluded so
// it falls through to its own decline/floor (never an identity deliver, never an invention).
// Temporal/fate markers (before/former/previous/used-to/ago/happened/became/died/replaced/gone)
// make "who WAS the baker BEFORE Mira — what HAPPENED to them?" a HISTORY/fate ask with no grounded
// predecessor source → defer, never match the present NPC by a loose role token (C4/C9 non-invention).
const PERSON_DEFER_RE = /\b(?:want|wants|after|before|former(?:ly)?|previous(?:ly)?|prior|used\s+to|ago|happen(?:ed|s|ing)?|became|become|fate|died|dead|killed|replaced|gone|hiding|hide|secret|secrets|thinking|think|plotting|planning|backstory|back\s?story|history|past|origin|work(?:s|ing)?\s+for|serve|serves|loyal|allegiance|faction|cult|cultist|conspir|behind|controls?|controlling|spy|spying|elder|chief|mayor|leader|leads?|headman|master|lord|in\s+charge|how\s+long)\b/i;

// Bare demonstrative / generic-observer refs — grace's META_NPC_OBSERVER owns these in the
// NARRATOR voice (with hostile-observer safety), and bare "who is that?" routes to dialogue-enter.
// Flagged (not blocked) so the narrator can leave them be while the dialogue voice may still
// resolve them to the sole present other.
const PERSON_DEMONSTRATIVE_RE = /^(?:that|this|they|them|their|that\s+(?:one|person|guy|figure|fellow|man|woman|stranger|individual|character)|this\s+(?:one|person|guy|stranger)|the\s+(?:stranger|figure|person|one|man|woman|guy|fellow|individual|character|someone|anyone))$/i;

// Locative / non-person refs the matcher must never treat as a person (mirrors the strict stop-list).
const NON_PERSON_REF_RE = /^(?:here|there|inside|outside|around|nearby|north|south|east|west|up|down|left|right|back|home|onward|forward|away|on|it|this\s+place|this\s+town|this\s+village|everyone|everybody|anyone|anybody|nobody)$/i;

function presentSociableNpcs(world) {
  const nodeId = String(world?.map?.currentNodeId || '');
  if (!nodeId) return [];
  const node = (Array.isArray(world?.map?.nodes) ? world.map.nodes : []).find(n => n && n.id === nodeId);
  return (Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : []).filter(n => n && !n.hostile);
}

function cleanRef(raw) {
  return String(raw || '').trim().toLowerCase().replace(/^(?:the|a|an)\s+/, '').replace(/[?.!,]+$/, '').trim();
}

// Match a present non-hostile NPC by NAME (exact / prefix / first-word) or by ROLE / occupation /
// descriptor / archetype / title. Mirrors playloop's resolvePresentNpcStrict + resolveNpcByRoleOrDescriptor.
function matchPresentNpc(npcs, ref) {
  const r = cleanRef(ref);
  if (r.length < 3 || NON_PERSON_REF_RE.test(r)) return null;
  // by name
  for (const n of npcs) {
    const nm = String(n.name || '').toLowerCase();
    if (nm && (nm === r || nm.startsWith(r + ' ') || (nm.split(/\s+/)[0] || '') === r)) return n;
  }
  // by role / occupation / descriptor / archetype / title
  const norm = (s) => String(s || '').toLowerCase().replace(/_/g, ' ').trim();
  for (const n of npcs) {
    const vals = [n.role, n.occupation, n.descriptor, n.archetype, n.title].map(norm).filter(Boolean);
    if (vals.some(v => v === r || v.includes(r) || r.includes(v))) return n;
  }
  return null;
}

// describeNpc-equivalent (kept local so personQuery stays decoupled; mirrors grace's describeNpc:
// name + role, never doubling a title already in the name). §0-safe: name + role only.
function describeIdentity(npc) {
  const name = String(npc?.name ?? '').trim();
  const role = String(npc?.role ?? npc?.occupation ?? '').trim();
  if (name && /\bthe\b/i.test(name)) return name;     // "Brogan the Elder" — don't append a role
  if (name && role) return `${name}, ${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role}`;
  if (name) return name;
  if (role) return `${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role}`;
  return 'a stranger';
}

/**
 * classifyPersonQuery(text) → { type:'identity', ref, demonstrative } | null
 * ref = the captured referent string; demonstrative = true when it's a bare "that/them/the
 * stranger" form (the narrator leaves those to dialogue-enter / grace). A DEFER token (motive/
 * secret/leadership/…) yields null — that is not an identity ask.
 */
export function classifyPersonQuery(text) {
  const t = String(text || '');
  if (!t.trim()) return null;
  if (PERSON_DEFER_RE.test(t)) return null;
  const m = PERSON_IDENTITY_QUERY_RE.exec(t);
  if (!m) return null;
  const ref = (m[1] || m[2] || m[3] || '').trim();
  if (!ref) return null;
  const r = cleanRef(ref);
  if (!r || NON_PERSON_REF_RE.test(r)) return null;     // "who is here?" → place, not person
  return { type: 'identity', ref, demonstrative: PERSON_DEMONSTRATIVE_RE.test(r) };
}

/**
 * resolvePersonFact(world, query) → { type:'identity', body } | null
 * query = { type, ref, demonstrative?, excludeId? }. Resolves the referent to a present non-hostile
 * NPC (excluding excludeId — the speaking npc, in the dialogue voice). A demonstrative resolves
 * ONLY when exactly one other present sociable NPC exists. null = no grounded match → caller falls
 * through (the existing clarify/decline/floor handles it). Pure, deterministic, NO roll, NO mutation.
 */
export function resolvePersonFact(world, query) {
  if (!query || query.type !== 'identity') return null;
  const excludeId = query.excludeId ? String(query.excludeId) : '';
  const pool = presentSociableNpcs(world).filter(n => !excludeId || String(n.id || '') !== excludeId);
  if (!pool.length) return null;
  let npc = null;
  if (query.demonstrative) {
    if (pool.length === 1) npc = pool[0];               // "that / them" → the sole present other
  } else {
    npc = matchPresentNpc(pool, query.ref);
  }
  if (!npc) return null;
  return { type: 'identity', body: describeIdentity(npc) };
}
