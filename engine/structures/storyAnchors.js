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

// The narratable reason taxonomy — a FIXED closed set. Every placement resolves to exactly one of
// these; U492 asserts membership so the vocabulary can't silently drift into free text.
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

/**
 * placementFor(world, npc) -> { where, key, roomHint, reason }
 *   where:   'building' | 'outdoors'
 *   key:     the anchor building key when where === 'building' (else null)
 *   reason:  a short narratable string from REASON_TAXONOMY
 *
 * The single source of truth for WHERE an NPC is right now and WHY. roomOccupancy composes this into
 * per-room / outdoor sets; it is exported so a caller can ask directly. Pure + deterministic.
 */
export function placementFor(world, npc, opts = {}) {
  const nodeId = String(opts.nodeId ?? world?.map?.currentNodeId ?? '');
  const seed = String(opts.seed ?? world?.meta?.seed ?? '');
  const wakeKey = String(opts.wakeKey ?? '');
  const phase = String(opts.phase || dayPhase(world));
  const buildings = opts.buildings || drawnBuildings(world, nodeId);

  // No drawn buildings at all → the bare fixture case: everyone is simply "here".
  if (!buildings.length) return { where: 'outdoors', key: null, reason: 'here' };

  const hostile = !!npc?.hostile;
  const anchor = anchorFor(seed, buildings, npc, wakeKey);

  // Hostiles NEVER idle inside an unrelated interior — they take a purpose spot at the margins,
  // outside, in every phase. That's where a bandit would actually be.
  if (hostile) return { where: 'outdoors', key: null, reason: 'keeping to the edges' };

  // No eligible anchor (e.g. the only building is the wake cottage) → out in the open on business.
  if (!anchor) return { where: 'outdoors', key: null, reason: 'about their errands' };

  // The seeded off-anchor minority — loitering / watching / meeting somewhere they don't belong.
  if (upToSomething(seed, npc, phase)) {
    return { where: 'outdoors', key: null, reason: 'up to something' };
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
    return { where: 'outdoors', key: null, reason: (phase === 'night' || phase === 'dusk') ? 'taking the evening air' : 'about their errands' };
  }
  if (phase === 'night' || phase === 'dusk') {
    // Retired home or to a common house (their anchor doubles as their evening base).
    return { where: 'building', key: anchor.key, reason: 'retired for the evening' };
  }
  // Day / dawn, at their anchor: kind-matched → "at their post"; otherwise going about the settlement.
  return {
    where: 'building',
    key: anchor.key,
    reason: anchor.kindMatched ? 'at their post' : 'about the settlement'
  };
}

export { drawnBuildings };
