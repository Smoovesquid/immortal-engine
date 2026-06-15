// engine/substrate.js
// The true-event substrate — the structural descent from the world seed.
//
// CRITICAL: substrate events live in world.substrate, NEVER world.timeline.
// world.timeline.length feeds the RNG seed in resolve.js (resolve.js line 24).
// Adding rows to world.timeline corrupts determinism — we hit this exact bug
// when seeding the slice. The substrate is a parallel structure that RNG-sensitive
// code never sees.
//
// Layer order (causal descent — each caused by the one above):
//   cosmology → the age, the ascendant Governor, the world's opening condition
//   region    → founding and major events for each region cluster (5 regions from generateRegions)
//   node      → founding and local events per settlement node (lazy, on first visit)
//
// The sealed deep truth (deep:foundation) is author-held and never generated here.
// This module generates the structural descent the world bible implies: surfaceable,
// in-world-believable events that things, claims, and lore can anchor to via eventRef.
// All labels are drawn from the world bible's surfaceable layer — a young, devout world
// with a shallow past, no deep history, god-saturated. None allude to the sealed truth.
//
// Phase 2 (redirect existing generators) will call:
//   substrateEventsFor(world, nodeId) → SubstrateEvent[]
// and pass results to dungeon/settlement generators as anchoring context.

import { makeRng, seedFromString } from './rng.js';
import { ascendantAeon } from './magic/cosmology.js';

// ── Label pools ───────────────────────────────────────────────────────────────
// In-world-believable phrases anchored to the world bible's surfaceable layer.
// A young world with a shallow past. Founding events are recent (2–5 generations).
// None of these reveal or allude to the sealed deep truth.

const AGE_LABEL_FNS = [
  g => `The age of ${g.epithet}'s ascendancy — ${g.cult} have never been more listened to`,
  g => `The hour when ${g.mode} is the world's great gift — ${g.cult} carry the blessing`,
  g => `The ascendant age of the ${g.blessed} school — ${g.cult} keep the roads and the rites`,
  g => `${g.cult}'s hour: the opposite school is the age's great taboo and everyone knows it`,
  g => `The age of ${g.epithet}: ${g.mode} runs in every practitioner's blood this generation`,
];

const REGION_FOUNDING_LABELS = [
  'the charter drawn by the first Long Watch — the road cleared, the covenant signed',
  'the settling of the reaches by families displaced by a drought that consumed the eastern farms',
  'the founding compact between three clans who agreed to share the river crossing and its tolls',
  'the land cleared under the Virtue of Patience\'s covenant — the first wells dug, the first walls raised',
  'the season two peoples met at the ridge after a blight drove them west, and did not fight',
  'the summer a chapter house established a permanent garrison and the settlement grew around it',
  'the founding charter sealed under three god-witnesses — kept in the Long Watch archives today',
];

const REGION_CRISIS_LABELS = [
  'the plague that emptied the river settlements for two seasons before the healers broke it',
  'the disputed succession that split three towns before the Long Watch settled the matter',
  'the failed harvest that drove a migration and left the old southern holdings nearly empty',
  'the faction dispute that burned the mill district — never fully accounted for, still spoken of',
  'the winter the passes closed and four villages were cut off until the thaw came late',
  'the season a traveling army passed through and took more than it left — the debt remembered',
  'the fire that took the old chapter archives and restarted a boundary dispute that continues today',
];

const REGION_BLESSING_LABELS = [
  'the healing season when a Verdant Hand convoy broke a lingering illness across the whole reach',
  'the decade of unusually clear roads — bandits pulled back, trade ran free, no one asked why',
  'the restoration of the eastern ford after a governor paid out of covenant rather than tax',
  'the peace declared by both factions after a Long Watch arbitration — held longer than expected',
  'the blessing year — every well in the reach ran clean; the Verdant Hand claims credit still',
];

const NODE_FOUNDING_LABELS = [
  'settled where the road bends and the water table is reliably shallow — the well never runs dry',
  'founded when a chapter house needed a permanent garrison and the garrison needed roofs',
  'established by a merchant who saw the ford and decided the crossing needed a roof and a hearth',
  'built around a spring that three families shared before they became one settlement',
  'the waystation that grew — two generations of travelers, and the walls are stone now',
  'planted where two roads cross, which made it necessary before anyone decided to make it permanent',
  'settled in a hollow that broke the east wind, which turns out to matter more than the travel time',
];

const NODE_EVENT_LABELS = [
  'the fire that took the old chapter records — no one was hurt; what was lost is still debated',
  'the winter a stranger stayed three months and left something behind that no one agrees about',
  'the boundary dispute over the eastern field, settled badly, remembered poorly, still resented',
  'the season the Long Watch garrison doubled in size without explanation — no one pressed for one',
  'the death of the founding family\'s last elder — the name held the settlement; now the name is history',
  'the year two different traveling healers worked the same village and disagreed on everything',
  'the night a chapter house officer arrived with sealed orders and left the next morning without speaking',
];

// ── Internal helpers ──────────────────────────────────────────────────────────

// Assign a node to a region index deterministically.
// Pure function — reads no world state, fully reproducible.
export function nodeRegionIndex(worldSeed, nodeId, numRegions) {
  const n = Math.max(1, numRegions);
  return Math.abs(seedFromString(`${worldSeed}|substrate|region-assign|${nodeId}`)) % n;
}

// ── Cosmology layer ───────────────────────────────────────────────────────────

function buildCosmology(worldSeed) {
  const rng   = makeRng(seedFromString(`${worldSeed}|substrate|cosmology`));
  const aeon  = ascendantAeon(worldSeed);
  const g     = aeon.governor;
  const label = rng.pick(AGE_LABEL_FNS)(g);

  return {
    age: {
      id:       'age:current',
      kind:     'age',
      layer:    'cosmology',
      t:        -1200,
      label,
      governor: g.school,
      blessed:  aeon.blessed,
      taboo:    aeon.taboo,
      sealed:   false,
    },
  };
}

// ── Region layer ──────────────────────────────────────────────────────────────

const REGION_TIER_CONFIG = {
  origin:  { tFounding: -480, eventCount: 2 },
  mid:     { tFounding: -360, eventCount: 3 },
  high:    { tFounding: -300, eventCount: 3 },
  anomaly: { tFounding: -420, eventCount: 2 },
};

function buildRegionEvents(worldSeed, regionVec) {
  const { regionId, tier } = regionVec;
  const cfg = REGION_TIER_CONFIG[tier] || REGION_TIER_CONFIG.mid;
  const rng = makeRng(seedFromString(`${worldSeed}|substrate|region|${regionId}`));

  const events = [];

  // Founding — always the first event.
  const tFounding = cfg.tFounding + rng.int(-40, 40);
  events.push({
    id:       `${regionId}:founding`,
    kind:     'founding',
    layer:    'region',
    regionId,
    t:        tFounding,
    label:    rng.pick(REGION_FOUNDING_LABELS),
    sealed:   false,
  });

  // Additional events (crises or blessings) determined by tier.
  const extraCount = cfg.eventCount - 1;
  for (let i = 0; i < extraCount; i++) {
    const isCrisis = rng.int(0, 3) > 0; // 75% crisis, 25% blessing — matches shallow-past tone
    const t        = tFounding + rng.int(60, 220);
    events.push({
      id:       `${regionId}:event:${i}`,
      kind:     isCrisis ? 'crisis' : 'blessing',
      layer:    'region',
      regionId,
      t,
      label:    rng.pick(isCrisis ? REGION_CRISIS_LABELS : REGION_BLESSING_LABELS),
      sealed:   false,
    });
  }

  return events.sort((a, b) => a.t - b.t);
}

// ── Node layer (lazy) ─────────────────────────────────────────────────────────

function buildNodeEvents(worldSeed, nodeId) {
  const rng    = makeRng(seedFromString(`${worldSeed}|substrate|node|${nodeId}`));
  const events = [];

  // Founding — always present.
  const tFounding = rng.int(-80, -40);
  events.push({
    id:     `node:${nodeId}:founding`,
    kind:   'founding',
    layer:  'node',
    nodeId,
    t:      tFounding,
    label:  rng.pick(NODE_FOUNDING_LABELS),
    sealed: false,
  });

  // 1–2 local events, derived from RNG.
  const extraCount = 1 + (rng.int(0, 3) > 1 ? 1 : 0);
  for (let i = 0; i < extraCount; i++) {
    const t = tFounding + rng.int(10, 60);
    events.push({
      id:     `node:${nodeId}:event:${i}`,
      kind:   'local-event',
      layer:  'node',
      nodeId,
      t,
      label:  rng.pick(NODE_EVENT_LABELS),
      sealed: false,
    });
  }

  return events.sort((a, b) => a.t - b.t);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * generateSubstrate(world) → world
 *
 * Generates the cosmology and region layers from world.meta.seed.
 * Node events are NOT generated here — they're added lazily by ensureNodeSubstrate
 * when a node is first visited, matching how decompressAndCanonize already fires.
 *
 * Safe to call multiple times — idempotent (skips if substrate already present).
 * NEVER touches world.timeline.
 */
export function generateSubstrate(world) {
  if (world?.substrate?.cosmology) return world; // already generated

  const worldSeed = String(world?.meta?.seed ?? 'seed');
  const regions   = Array.isArray(world?.regions) ? world.regions : [];

  const regionEvents = {};
  for (const reg of regions) {
    regionEvents[reg.regionId] = buildRegionEvents(worldSeed, reg);
  }

  return {
    ...world,
    substrate: {
      worldSeed,
      cosmology: buildCosmology(worldSeed),
      regions:   regionEvents,
      nodes:     {},   // populated lazily by ensureNodeSubstrate
    },
  };
}

/**
 * ensureNodeSubstrate(world, nodeId) → world
 *
 * Lazily generates local true-events for a node on first visit.
 * Idempotent — safe to call on every visit; skips if already seeded.
 * NEVER touches world.timeline.
 */
export function ensureNodeSubstrate(world, nodeId) {
  const id  = String(nodeId || '');
  const sub = world?.substrate;
  if (!id || !sub) return world;
  if (sub.nodes?.[id]) return world; // already seeded

  const events = buildNodeEvents(String(sub.worldSeed ?? world?.meta?.seed ?? 'seed'), id);

  return {
    ...world,
    substrate: {
      ...sub,
      nodes: { ...(sub.nodes || {}), [id]: events },
    },
  };
}

/**
 * substrateEventsFor(world, nodeId) → SubstrateEvent[]
 *
 * Returns all true-events relevant to this node in chronological order:
 *   age event (cosmology) → this node's region events → this node's local events
 *
 * This is the function generators call in phase 2 to anchor their output.
 * Returns [] if substrate is not yet generated — generators proceed unanchored,
 * exactly as they do today before the cascade is wired. Safe fallback.
 */
export function substrateEventsFor(world, nodeId) {
  const sub = world?.substrate;
  if (!sub) return [];

  const worldSeed  = String(sub.worldSeed ?? world?.meta?.seed ?? 'seed');
  const numRegions = Object.keys(sub.regions || {}).length || 1;
  const regIdx     = nodeRegionIndex(worldSeed, String(nodeId || ''), numRegions);
  const regId      = `region-${regIdx}`;

  const cosmologyEvents = sub.cosmology?.age ? [sub.cosmology.age] : [];
  const regionEvents    = Array.isArray(sub.regions?.[regId]) ? sub.regions[regId] : [];
  const nodeEvents      = Array.isArray(sub.nodes?.[String(nodeId || '')]) ? sub.nodes[String(nodeId || '')] : [];

  return [...cosmologyEvents, ...regionEvents, ...nodeEvents].sort((a, b) => a.t - b.t);
}

/**
 * npcSubstrateContext(world, nodeId) → NpcSubstrateEntry[]
 *
 * Formats the substrate events for this node as cascade-weighted voice context.
 * Each entry carries a `clarity` field that encodes epistemic distance from the
 * NPC's vantage point on the cascade ladder:
 *
 *   node events  → clarity:'vivid'  — the NPC's own town; lived or heard young
 *   region events → clarity:'dim'   — common knowledge; rougher in the telling
 *   cosmology    → clarity:'myth'   — barely a whisper; faint myth at best
 *
 * The voice layer uses this to ground NPCs in their specific rung of the cascade
 * rather than flattening all history to the same epistemic weight.
 */
export function npcSubstrateContext(world, nodeId) {
  const events = substrateEventsFor(world, nodeId);
  return events.map(evt => ({
    layer:   String(evt.layer  || 'node'),
    kind:    String(evt.kind   || ''),
    label:   String(evt.label  || ''),
    clarity: evt.layer === 'node'      ? 'vivid'
           : evt.layer === 'region'    ? 'dim'
           :                             'myth',
  }));
}
