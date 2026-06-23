// The locked demo region — DEMO_BUILD_PLAN D-A3, hypothesis A (a fixed seed).
//
// The walk-in demo rides ONE fixed, curated seed so authored content (the five
// figures, the named concerns, the orb dungeon) can be placed on KNOWN ground and
// replay the same way every time. 'tallow' (→ the plan's "Tallow Cross") generated
// the richest walkable valley of the searched seeds via the existing deterministic
// generator + biome projection (no parallel system built):
//   8 settlements · 6 dungeon-entrances · fully reachable from the start node ·
//   4 biomes with heavy biome-bleed (DEMO_REGION §3 — coast/arctic/etc. impossibly
//   adjacent) · biomes surfaced on arrival via biomeFlavor · replay-stable.
//
// The structural shape is LOCKED by tests/U246 so authored overlays can rely on it.
// Fuller biome packing (all 8) is a richness deepening — the node-count knob
// (generateMap nodeCountOverride) reaches 6–7 biomes at higher counts, and the
// authored-preset layer can hand-place biomes — neither is a skeleton blocker, so
// both are deferred. §0 holds region-wide (the cosmology is never surfaced).
export const DEMO_SEED = 'tallow';

// The guarantees the demo region must keep (asserted by tests/U246). Minimums, not
// exact counts, so minor generator tuning can't break the lock while the walkable,
// biome-bled valley stays intact.
export const DEMO_REGION_SPEC = {
  minSettlements: 5,
  minDungeons: 2,
  minBiomes: 3,
  minBleedEdges: 10,
  fullyReachable: true,
};
