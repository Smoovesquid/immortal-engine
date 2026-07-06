// Story Anchors — WHERE a settlement NPC is, and WHY, derived from who they are.
//
// The old placement was a seeded hash-scatter over whatever buildings happened to be MATERIALIZED.
// At the dawn wake exactly one is materialized — the player's own cottage — so everyone indoors piled
// into it, the seeded hostile bandit included: an armed robber in your entry room at first light, by
// accident, with no story attached. Tim's ruling (2026-07-05): folk show up in places explained by
// their personal story. The test for every placement: if the player asks "why is he here?", the
// answer must already exist. Placement becomes narration fuel.
//
// So: each roster NPC gets ONE ANCHOR among the settlement's DRAWN buildings (materialized structures
// AND the decorative settlement buildings — the well/smithy/workshop the map actually draws), derived
// deterministically from their ROLE (the smith's anchor is a smithy, the innkeeper's an inn) and,
// failing a kind match, a seed-stable pick that is permanently "theirs" for this world. The player's
// wake structure is NEVER a stranger's anchor. Time of day moves them (anchor by day, home/common by
// evening, errand spots at dawn), a seeded minority is "up to something" off-anchor, and hostiles
// always take a PURPOSE SPOT (an edge, a shadow, outside) — never idle inside an unrelated interior.
// Every placement carries a short, narratable, deterministic REASON.
//
// This is a PURE DERIVED read like roomOccupancy / roomWindows: a function of (seed + roster + drawn
// buildings + day phase), never a stored field — no WORLD_VERSION bump, worldHash untouched. All
// randomness flows through engine/rng.js. Consumers get the same NPC records plus an additive
// `reason` field; nothing about who-sees-whom changes, only who-is-where.
//
// OCC-STORY-2 (thread-aware placement): the world's live PLOTS now place its people. A living thread
// in world.instrument.threads (READ-ONLY — this module never writes threads) that has grown HOT —
// aged past a named threshold AND at high tension — biases the anchors of the NPCs whose story ties
// them to that thread's LOCUS (the place the plot is about): the Lingerer haunts the chapel path
// because the chapel thread is hot; a road-worry draws a watcher toward the gate. The relation reuses
// OCC-STORY-1's seed-stable role/epithet/faction machinery (biasReason below) — it is an EXTENSION of
// this derivation, not a fork. When the locus's building is drawn at the node the related NPC anchors
// INTO it; when it isn't (the home settlement has no chapel), they stand OUT in the open, WATCHING
// toward the locus. Their narratable `reason` reflects the thread's CURRENT objective as it mutates
// (CONSEQ-1 makes that real) — prose only, never a number. A HOSTILE indoors is a BURGLARY IN
// PROGRESS, its reason says so (the deed-recording follow-up is flagged, not built — no NPC-actor
// deed organ exists to carry it; see placementFor's hostile branch). THE HASH DISCIPLINE: at boot
// every thread is age-0 and cold, so NO bias fires — default-boot placement is byte-identical to
// OCC-STORY-1 (the U454-E anchor and the seven screen goldens are the canary). Post-boot, hot-thread
// placement shifts are deterministic per (seed + thread state) and replay byte-identical.

import { seedFromString, makeRng } from '../rng.js';
import { settlementBuildingType } from './settlementFootprint.js';
import { dayPhase } from '../dayNight.js';

// ── ROLE → the building KIND that NPC belongs in ────────────────────────────
// Mirrors npcGenesis.BUILDING_ARCHETYPES (building → role) inverted, plus the sensible home for the
// generic roles. A kind here is a canonical settlement building type (see settlementFootprint's
// SETTLEMENT_FOOTPRINTS / NAME_TO_TYPE and roomDetail's BUILDING_LIST). When a role's kind is present
// among the drawn buildings, that's the anchor; otherwise we fall back seed-stably (see anchorFor).
const ROLE_KIND = Object.freeze({
  // building-specific archetypes (npcGenesis)
  tavern_keeper: 'tavern',
  innkeeper:     'inn',
  smith:         'smithy',
  priest:        'chapel',
  merchant:      'market',
  guard_captain: 'barracks',
  stable_hand:   'stable',
  scholar:       'library',
  hedge_witch:   'apothecary',
  artisan:       'workshop',
  // generic roles → their natural haunt
  elder:         'longhouse',
  laborer:       'workshop',
  veteran:       'tavern',
  trader:        'market',
  healer:        'apothecary',
  scavenger:     'barn',
  mediator:      'longhouse',
  guard:         'barracks',
  representative:'longhouse'
});

// The narratable reason taxonomy — the FIXED closed set of COLD-path reasons (no live thread is hot).
// Every OCC-STORY-1 placement resolves to exactly one of these; U492 asserts membership so the base
// vocabulary can't silently drift into free text. OCC-STORY-2's hot-thread reasons are DYNAMIC prose
// (they carry the thread's mutating objective, which cannot be a fixed enum member), so they are NOT
// in this set — instead every placement also carries a fixed `reasonKind` category (REASON_KINDS
// below) for programmatic assertion, while `reason` stays the rich narratable string. The cold path
// (every thread age-0) only ever emits these strings, so U492 and the boot/goldens are untouched.
export const REASON_TAXONOMY = Object.freeze([
  'at their post',        // day: at their trade/anchor building (kind-matched)
  'about the settlement', // day: anchored somewhere, no kind match — going about the town
  'retired for the evening', // evening/night: home or the common house
  'about their errands',  // day/dawn: out on daytime errands
  'taking the evening air', // dusk/night: out in the open after dark
  'up to something',      // the seeded off-anchor minority (loitering / watching / meeting)
  'keeping to the edges', // hostile purpose-spot: lurking outside / at the margins
  'here'                  // fallback single-space (no drawn buildings) — everyone at the node
]);

// The FIXED category every placement carries as `reasonKind` — a closed enum spanning BOTH the
// cold-path taxonomy above (mapped 1:1 by the string itself) AND the three OCC-STORY-2 categories
// whose `reason` prose is dynamic. Tests assert on this enum; players read `reason`.
export const REASON_KINDS = Object.freeze([
  ...REASON_TAXONOMY,   // cold-path reasons double as their own kind
  'drawn to the thread',   // hot-thread bias: anchored INTO the locus building, thread-reflecting reason
  'watching the locus',    // hot-thread bias: out in the open, watching toward a locus with no building here
  'burglary in progress'   // hostile INDOORS at the locus: a break-in, not an accident
]);

// ── the anchor universe: every DRAWN building at the node, with a kind ───────
// Two sources, exactly what public/map/placeFromNode.js draws: the materialized structures
// (world.structures.byId, which carry an interior + a buildingType) and the decorative settlement
// buildings (node.settlement.buildings, name-only, sized by settlementFootprint). The ENGINE never
// imports from public/; we read the same two engine-owned sources placeFromNode reads.
function drawnBuildings(world, nodeId) {
  const out = [];
  const byId = world?.structures?.byId || {};
  for (const s of Object.values(byId)) {
    if (!s || String(s.nodeId || '') !== String(nodeId)) continue;
    const kind = String(s.buildingType || '').toLowerCase() || null;
    out.push({ key: String(s.id), kind, materialized: true, name: kind || 'building' });
  }
  const node = (world?.map?.nodes || []).find(n => n && String(n.id) === String(nodeId)) || null;
  const sbld = Array.isArray(node?.settlement?.buildings) ? node.settlement.buildings : [];
  sbld.forEach((b, i) => {
    const nm = String(b?.name || '');
    // A ruined building houses no one — skip it as an anchor.
    if (String(b?.state || 'intact') === 'ruined') return;
    out.push({ key: `sbld:${nm}:${i}`, kind: settlementBuildingType(nm), materialized: false, name: nm });
  });
  // Stable order for deterministic indexing (materialized first by id, then settlement by key).
  return out.sort((a, b) => (Number(b.materialized) - Number(a.materialized)) || a.key.localeCompare(b.key));
}

function npcKey(npc) {
  return String(npc?.id || npc?.name || '');
}

function kindForRole(role) {
  return ROLE_KIND[String(role || '').toLowerCase()] || null;
}

// The ONE anchor building this NPC belongs to, permanently, for this world. Kind-matched to their
// role where such a building is drawn; otherwise a seed-stable pick among the eligible buildings.
// `wakeKey` (the player's home structure) is excluded so no stranger is ever anchored there.
// Returns a building object from `buildings`, or null if there are no eligible buildings.
function anchorFor(seed, buildings, npc, wakeKey) {
  const eligible = buildings.filter(b => b.key !== wakeKey);
  if (!eligible.length) return null;

  const wantKind = kindForRole(npc?.role);
  const matches = wantKind ? eligible.filter(b => b.kind === wantKind) : [];
  const pool = matches.length ? matches : eligible;

  // Seed-stable pick within the chosen pool — permanently theirs. Keyed on the pool identity so a
  // kind-matched NPC and a fallback NPC draw from independent streams (no accidental correlation).
  const rng = makeRng(seedFromString(`${seed}|${npcKey(npc)}|anchor|${matches.length ? 'kind' : 'any'}`));
  const chosen = pool[rng.int(0, pool.length - 1)];
  return { ...chosen, kindMatched: matches.length > 0 };
}

// Is this NPC part of the seeded "up to something" minority for this day phase? Deterministic per
// (npc, phase): the same person is up to something at the same time in the same world, and it shifts
// as the day turns. ~1 in 6.
function upToSomething(seed, npc, phase) {
  const rng = makeRng(seedFromString(`${seed}|${npcKey(npc)}|${phase}|scheme`));
  return rng.nextFloat() < 1 / 6;
}

// ── OCC-STORY-2: the world's live plots place its people ─────────────────────
// A thread biases placement only once it has grown HOT: aged past HOT_AGE ticks AND standing at
// HIGH TENSION. Both floors sit strictly ABOVE the boot state (every thread boots at age 0, tension
// 1 — worldTick climbs tension 1/tick and age 1/tick; the objective only mutates at age 6). Picking
// age ≥ 3 keeps the bias dark for the first few unattended turns and — critically — for the default
// boot and the seven screen goldens (all age-0), so the U454-E hash and the goldens never move. If
// you ever conclude boot-hot tension SHOULD bias, that is a re-pin decision — stop and flag it.
const HOT_AGE = 3;       // ticks of neglect before a thread starts pulling people toward it
const HOT_TENSION = 3;   // tension floor (of 5) — an escalating/near-crisis worry, not a quiet one

function threadIsHot(t) {
  if (!t || typeof t !== 'object') return false;
  if (String(t.status || '') === 'resolved') return false;
  return Number(t.age ?? 0) >= HOT_AGE && Number(t.tension ?? 0) >= HOT_TENSION;
}

// A thread's LOCUS: the place-concept its story is about, resolved from its label + live objective
// text against a FIXED keyword table. `kind` is a settlement building type (chapel/market/smithy/…)
// so a drawn building of that kind is the anchor when present; `phrase` is the short narratable
// place-noun a watcher's reason names ("the chapel path", "the gate", "the toll road"). Threads whose
// text names no known locus return null (they simply don't bias placement — not every plot is
// spatial). Keyword order matters: earlier, more specific phrases win. This is the thread-side mirror
// of ROLE_KIND — closed vocabulary, no free-text drift.
const LOCUS_TABLE = Object.freeze([
  { rx: /\bchapel|\bbell\b|shrine|temple|church/i, kind: 'chapel',  phrase: 'the chapel path' },
  { rx: /\bbridge\b/i,                              kind: 'market',  phrase: 'the bridge' },
  { rx: /toll|\bgate\b|\broad\b|\bwoods?\b|greenwood|highway/i, kind: null, phrase: 'the gate' },
  { rx: /crossroad|crossway/i,                      kind: null,      phrase: 'the crossroads' },
  { rx: /market|\bstall|storehouse|merchant|trade|estate|harbor/i, kind: 'market', phrase: 'the market' },
  { rx: /forge|smith|anvil/i,                       kind: 'smithy',  phrase: 'the forge' },
  { rx: /well\b|water/i,                             kind: 'well',    phrase: 'the well' },
]);
function threadLocus(t) {
  const text = `${String(t?.label || '')} ${String(t?.objective || '')}`;
  for (const e of LOCUS_TABLE) if (e.rx.test(text)) return { kind: e.kind, phrase: e.phrase };
  return null;
}

// The single HOTTEST thread that has a spatial locus — the one plot loud enough to pull people right
// now. Deterministic ordering: highest tension, then oldest, then id — a total order so the chosen
// thread is stable per world state and identical under replay. Returns { thread, locus } or null.
function hottestLocusThread(world) {
  const threads = Array.isArray(world?.instrument?.threads) ? world.instrument.threads : [];
  let best = null;
  for (const t of threads) {
    if (!threadIsHot(t)) continue;
    const locus = threadLocus(t);
    if (!locus) continue;
    if (!best) { best = { thread: t, locus }; continue; }
    const b = best.thread;
    const better =
      Number(t.tension ?? 0) !== Number(b.tension ?? 0) ? Number(t.tension ?? 0) > Number(b.tension ?? 0)
      : Number(t.age ?? 0) !== Number(b.age ?? 0)         ? Number(t.age ?? 0) > Number(b.age ?? 0)
      : String(t.id || '') < String(b.id || '');
    if (better) best = { thread: t, locus };
  }
  return best;
}

// The watcher-signal words: folk who, at a real table, would take an interest in a hot local worry —
// a wanderer asking questions (the Lingerer), a guard/watch, a veteran, a scout. Global flag so we can
// COUNT how many distinct signals an NPC's role/epithet carries — signal STRENGTH graduates the pull
// (below). Roles here are free descriptive strings, e.g. the Lingerer's "a wanderer who has stayed too
// long, asking questions no one wants to answer" (two signals: wander + question).
const WATCHER_RX = /wander|linger|watch|question|guard|sentinel|veteran|scout|ranger|warden|patrol|inquisit|curious|stranger/gi;
function watcherSignalCount(npc) {
  const m = `${String(npc?.role || '')} ${String(npc?.epithet || '')}`.match(WATCHER_RX);
  return m ? m.length : 0;
}

// Does this NPC's STORY tie them to the hot thread's locus? Seed-stable relations, reusing
// OCC-STORY-1's own machinery:
//   1. role→kind match  — their trade IS the locus (the priest ↔ the chapel thread);
//   2. faction match    — they belong to a faction the thread names (factionId on the thread's list);
//   3. watcher archetype — their role/epithet marks them as someone who'd be drawn to WATCH, graduated
//      by SIGNAL STRENGTH: a STRONG watcher (2+ signal words, e.g. the Lingerer — "wanderer … asking
//      questions") is DEFINED by drawing toward trouble, so a hot worry reliably pulls them; a single
//      -signal watcher (a lone "guard") is a seeded SUBSET (~1 in 2) so not every guardsman converges;
//   4. hostile → a hot locus is a TARGET — a bandit is drawn to rob a place a loud plot has made
//      valuable (the break-in), a seeded subset so a hot market doesn't summon every brigand.
// Ordinary folk with no kind/faction/watcher tie are NOT pulled — the town keeps living its day.
function relatesToThread(seed, npc, thread, locus) {
  if (locus.kind && kindForRole(npc?.role) === locus.kind) return true;
  const facs = Array.isArray(thread?.factions) ? thread.factions.map(String) : [];
  if (npc?.factionId && facs.includes(String(npc.factionId))) return true;
  // Seeded subset keyed on (npc, thread) so the SAME people are drawn to the SAME thread every time
  // in this world, and it's a minority — the plot draws a few, not a mob. Hostiles and watchers each
  // get their own stream (independent rolls) so a lurker and an onlooker don't correlate.
  if (npc?.hostile) {
    return makeRng(seedFromString(`${seed}|${npcKey(npc)}|${String(thread?.id || '')}|target`)).nextFloat() < 0.5;
  }
  const signals = watcherSignalCount(npc);
  if (signals >= 2) return true;   // a strong watcher is reliably drawn to a hot worry
  if (signals === 1) {
    return makeRng(seedFromString(`${seed}|${npcKey(npc)}|${String(thread?.id || '')}|drawn`)).nextFloat() < 0.5;
  }
  return false;
}

// The narratable, thread-reflecting reason a drawn onlooker carries — prose only, ZERO numerics.
// Surfaces the thread's LIVE objective as it mutates (CONSEQ-1) when present, else its label; the
// verb differs for someone standing AT the locus vs WATCHING toward it from afar.
function threadReason(thread, locus, atLocus) {
  const detail = String(thread?.objective || '').trim() || String(thread?.label || '').trim();
  const tail = detail ? ` — ${detail.toLowerCase()}` : '';
  return atLocus
    ? `drawn to ${locus.phrase}${tail}`
    : `watching ${locus.phrase}${tail}`;
}

// A COLD-path placement result: `reason` is one of REASON_TAXONOMY, and `reasonKind` mirrors it 1:1
// (the string IS its own category). Additive only — existing callers reading where/key/reason see no
// change; the field simply rides along like `reason` did for OCC-STORY-1.
function cold(where, key, reason) {
  return { where, key, reason, reasonKind: reason };
}

// The building drawn at THIS node matching the locus kind (when the plot's place is here), or null
// (the locus is elsewhere — the chapel is at another node, so onlookers watch toward it from afar).
function locusBuildingHere(buildings, wakeKey, locus) {
  if (!locus?.kind) return null;
  const pool = buildings.filter(b => b.key !== wakeKey && b.kind === locus.kind);
  return pool.length ? pool : null;
}

/**
 * placementFor(world, npc) -> { where, key, reason, reasonKind }
 *   where:      'building' | 'outdoors'
 *   key:        the anchor building key when where === 'building' (else null)
 *   reason:     a short narratable string (cold path: a REASON_TAXONOMY member; hot-thread path: rich
 *               prose carrying the thread's live objective)
 *   reasonKind: a fixed REASON_KINDS category — always present, safe to assert on programmatically
 *
 * The single source of truth for WHERE an NPC is right now and WHY. roomOccupancy composes this into
 * per-room / outdoor sets; it is exported so a caller can ask directly. Pure + deterministic.
 *
 * OCC-STORY-2 layers a hot-thread BIAS over the OCC-STORY-1 base: when the world's hottest spatial
 * plot pulls an NPC whose story ties them to it, that NPC is drawn to the plot's locus (into the
 * locus building if drawn here, else out watching toward it) and a hostile INDOORS at the locus is a
 * burglary in progress. Cold worlds (every thread age-0, incl. the default boot and the goldens) take
 * NONE of these branches — the base result is byte-identical to OCC-STORY-1.
 */
export function placementFor(world, npc, opts = {}) {
  const nodeId = String(opts.nodeId ?? world?.map?.currentNodeId ?? '');
  const seed = String(opts.seed ?? world?.meta?.seed ?? '');
  const wakeKey = String(opts.wakeKey ?? '');
  const phase = String(opts.phase || dayPhase(world));
  const buildings = opts.buildings || drawnBuildings(world, nodeId);

  // No drawn buildings at all → the bare fixture case: everyone is simply "here".
  if (!buildings.length) return cold('outdoors', null, 'here');

  const hostile = !!npc?.hostile;
  const anchor = anchorFor(seed, buildings, npc, wakeKey);

  // ── the world's hottest spatial plot, if any is hot (null on every cold/boot world) ──
  const hot = opts.hot !== undefined ? opts.hot : hottestLocusThread(world);

  // Hostiles NEVER idle inside an unrelated interior. OCC-STORY-1 keeps them at the margins. But when
  // a plot is hot AND this hostile is drawn to its locus, they are a BURGLARY IN PROGRESS: if the
  // locus building is drawn HERE they are inside it breaking in; otherwise still at the edges, but
  // their reason names the crime toward the locus. (The witnessed-burglary → NPC-deed wiring is a
  // flagged MP-arc follow-up — no NPC-actor deed organ exists to carry it, so this ships placement +
  // reason only, per the brief's reversible option.)
  if (hostile) {
    if (hot && relatesToThread(seed, npc, hot.thread, hot.locus)) {
      const here = locusBuildingHere(buildings, wakeKey, hot.locus);
      if (here) {
        // Seed-stable pick of WHICH matching building he's breaking into — permanently his for this
        // world+thread, independent of the honest anchor stream.
        const rng = makeRng(seedFromString(`${seed}|${npcKey(npc)}|${String(hot.thread.id || '')}|burgle`));
        const b = here[rng.int(0, here.length - 1)];
        return { where: 'building', key: b.key, reason: `breaking into ${hot.locus.phrase} — a burglary in progress`, reasonKind: 'burglary in progress' };
      }
      return { where: 'outdoors', key: null, reason: `casing ${hot.locus.phrase} — a burglary in the making`, reasonKind: 'burglary in progress' };
    }
    return cold('outdoors', null, 'keeping to the edges');
  }

  // ── OCC-STORY-2 non-hostile bias: a hot plot draws its people to its locus ──
  // Runs BEFORE the errand/anchor split so the pull is decisive (a hot worry outweighs a normal day).
  // Only NPCs whose story relates to the thread are moved; everyone else lives their ordinary day
  // through the unchanged OCC-STORY-1 path below.
  if (hot && relatesToThread(seed, npc, hot.thread, hot.locus)) {
    const here = locusBuildingHere(buildings, wakeKey, hot.locus);
    if (here) {
      const rng = makeRng(seedFromString(`${seed}|${npcKey(npc)}|${String(hot.thread.id || '')}|converge`));
      const b = here[rng.int(0, here.length - 1)];
      return { where: 'building', key: b.key, reason: threadReason(hot.thread, hot.locus, true), reasonKind: 'drawn to the thread' };
    }
    // Locus is elsewhere (no such building here) → stand out in the open, watching toward it.
    return { where: 'outdoors', key: null, reason: threadReason(hot.thread, hot.locus, false), reasonKind: 'watching the locus' };
  }

  // No eligible anchor (e.g. the only building is the wake cottage) → out in the open on business.
  if (!anchor) return cold('outdoors', null, 'about their errands');

  // The seeded off-anchor minority — loitering / watching / meeting somewhere they don't belong.
  if (upToSomething(seed, npc, phase)) {
    return cold('outdoors', null, 'up to something');
  }

  // Time-of-day movement is a MIX, never an evacuation: at every phase some folk are at their anchor
  // and some are out in the open. The share OUTDOORS shifts with the phase — a town waking at dawn
  // has many out on errands; midday most are at their posts; evening most have retired but a few
  // linger out. A seeded per-(npc,phase) roll decides which side of the split each person is on, so
  // the same person is in the same place at the same time in the same world, and it turns with the
  // day. Crucially this is independent of the wake cottage: strangers never anchor there, so it can't
  // repopulate — this only moves folk between their OWN anchor and the open.
  const OUTDOOR_SHARE = { dawn: 0.5, day: 0.2, dusk: 0.2, night: 0.12 };
  const outShare = OUTDOOR_SHARE[phase] ?? 0.2;
  const outRng = makeRng(seedFromString(`${seed}|${npcKey(npc)}|${phase}|whereabouts`));
  const outdoors = outRng.nextFloat() < outShare;

  if (outdoors) {
    // Out in the open — on errands by day, taking the evening air after dark.
    return cold('outdoors', null, (phase === 'night' || phase === 'dusk') ? 'taking the evening air' : 'about their errands');
  }
  if (phase === 'night' || phase === 'dusk') {
    // Retired home or to a common house (their anchor doubles as their evening base).
    return cold('building', anchor.key, 'retired for the evening');
  }
  // Day / dawn, at their anchor: kind-matched → "at their post"; otherwise going about the settlement.
  return cold('building', anchor.key, anchor.kindMatched ? 'at their post' : 'about the settlement');
}

// Exported for the OCC-STORY-2 tests (U580–U582): the thread-side derivation is unit-testable in
// isolation, and callers can ask "is any plot hot, and where?" directly.
export { drawnBuildings, threadIsHot, threadLocus, hottestLocusThread, relatesToThread, HOT_AGE, HOT_TENSION };
