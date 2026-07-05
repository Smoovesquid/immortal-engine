import { ensureWorld } from '../state.js';
import { generateStructuresForNode } from './generateStructures.js';
import { ensureStructures } from './structuresState.js';
// LOADER-MERGE: authoredPlans.js was folded into authoredStructure.js (ONE loader, ONE
// registry). The registry API (hasAuthoredPlan / makeAuthoredStructure) and the direct
// loader (loadAuthoredStructure) now come from the same module.
import { hasAuthoredPlan, makeAuthoredStructure, loadAuthoredStructure } from './authoredStructure.js';
import loaderDemoHouse from '../../packs/base/structures/authored/loader_demo.house.js';
import threeRoomDemoHouse from '../../packs/base/structures/authored/three_room_demo.house.js';

// LOAD-1 — the smallest-loader DEMO (docs/briefs/LOAD-1-smallest-loader.md). Gated
// ENTIRELY on one opt-in seed so the DEFAULT game is byte-identical (any seed !==
// this returns before any of this code runs — see maybeInjectLoaderDemo). Under the
// seed, the hand-authored one-room hut (loader_demo.house.js) is loaded via
// loadAuthoredStructure and attached at whatever node the player is on, id-deduped so
// it's injected once. Because it sorts first by id ('authored:<node>' < 'stgen:...'),
// beginAdventure's enterStructureInterior('#1') drops the player straight into the
// authored room at boot — the room Tim drew is the room the game opens in, and
// go-outside / go-inside walk through its (engine-derived) front door.
const LOADER_DEMO_SEED = 'loaderDemo';

function maybeInjectLoaderDemo(world, nid, mergedById) {
  if (String(world?.meta?.seed || '') !== LOADER_DEMO_SEED) return; // default game untouched
  const demoId = `authored:${nid}`;
  if (mergedById[demoId]) return; // idempotent — already injected for this node
  try {
    const st = loadAuthoredStructure(loaderDemoHouse, { nodeId: nid });
    if (st && st.id) mergedById[st.id] = st;
  } catch (err) {
    // A broken demo house degrades to procgen with a warning (never crashes play) —
    // same failure posture as the MR-2c authored override below.
    console.warn(`applyGeneratedStructuresForNode: loader-demo house failed to load (${err?.message || err}); node keeps procgen`);
  }
}

// LOAD-2 — the multi-room DEMO (docs/briefs/LOAD-2-multiroom-realnode.md). Same
// seed-gated posture as LOAD-1: gated ENTIRELY on one opt-in seed so the DEFAULT game
// is byte-identical (any seed !== this returns before any of this runs). Under the
// seed, the hand-authored THREE-room cottage (three_room_demo.house.js) is loaded via
// loadAuthoredStructure and attached at whatever node the player is on. The whole
// building is walkable: the loader recovers the door→room adjacency, so from the Hall
// the player walks through a doorway into either side room and back.
const LOADER_DEMO2_SEED = 'loaderDemo2';

// ── Node-keyed authored registry (brief §3) ────────────────────────────────────────
// A small table mapping a NODE PREDICATE → an authored house export, so an authored
// building can sit at a REAL place on the map (matched by node name/tags rather than a
// seed-derived id, which isn't a stable string to key by). authoredHouseForNode(node)
// returns the house registered for a node, or null. This is the mechanism a content
// decision uses to drop one of Tim's houses onto, e.g., Crowfoot Camp; the DEMO wire-in
// below only consults it under the demo seed, so the default game is untouched.
const AUTHORED_AT_NODE = [
  // The three-room warden's cottage sits at Crowfoot Camp (a real slice place). Matched
  // by name so it lands on the right node regardless of the slice's seed-derived id.
  { match: (node) => /crowfoot camp/i.test(String(node?.name || '')), house: threeRoomDemoHouse },
];

/** authoredHouseForNode(node) -> the authored house export registered for this node, or null. */
export function authoredHouseForNode(node) {
  if (!node || typeof node !== 'object') return null;
  const hit = AUTHORED_AT_NODE.find(entry => { try { return entry.match(node); } catch { return false; } });
  return hit ? hit.house : null;
}

function maybeInjectLoaderDemo2(world, nid, node, mergedById) {
  if (String(world?.meta?.seed || '') !== LOADER_DEMO2_SEED) return; // default game untouched
  const demoId = `authored:${nid}`;
  if (mergedById[demoId]) return; // idempotent — already injected for this node
  // Prefer a node-registered house (a real place); else the boot-node demo cottage so
  // the seed is walkable at whatever settlement the player starts on.
  const house = authoredHouseForNode(node) || threeRoomDemoHouse;
  try {
    const st = loadAuthoredStructure(house, { nodeId: nid });
    if (st && st.id) mergedById[st.id] = st;
  } catch (err) {
    console.warn(`applyGeneratedStructuresForNode: LOAD-2 demo house failed to load (${err?.message || err}); node keeps procgen`);
  }
}

// MR-2c (docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2c) — AUTHORED OVERRIDE. The
// procgen candidate id for a node is fully deterministic (generateStructures.js:
// `stgen:v${ver}:${nid}:0`), so a plan Tim authored FOR that exact id can simply be
// substituted here, one id at a time, before the merge below runs — every other
// engine seam (movement, invariants, doors) sees the SAME id/nodeId/kind it would
// for a procgen structure, just with authored topology + geometry. Falls back to
// the procgen candidate untouched when nothing is registered for that id (the
// overwhelming common case — every un-authored structure is unaffected, byte-
// identical to before this packet). A candidate id that IS registered but whose
// authored build somehow fails to construct (should be unreachable — the registry
// validates at import time) degrades to the procgen candidate with a console.warn,
// never a crash.
function authoredOrProcgen(candidate) {
  const id = String(candidate?.id || '').trim();
  if (!id || !hasAuthoredPlan(id)) return candidate;
  try {
    const authored = makeAuthoredStructure(id, candidate.nodeId);
    if (authored) return authored;
  } catch (err) {
    console.warn(`applyGeneratedStructuresForNode: authored plan for '${id}' failed to build (${err?.message || err}); falling back to procgen`);
  }
  return candidate;
}

export function applyGeneratedStructuresForNode(world, nodeId) {
  if (!world || !nodeId) return world;

  const w = ensureWorld(world);
  const nid = String(nodeId || '').trim();
  if (!nid) return w;

  const seed = String(w.meta?.seed || '');
  const engineVersion = Number.isFinite(+w.meta?.version) ? Math.floor(+w.meta.version) : 0;

  const node = (w.map?.nodes || []).find(n => String(n?.id || '') === nid) || null;
  const nodeTags = Array.isArray(node?.tags) ? node.tags : [];

  const generated = generateStructuresForNode({
    seed,
    nodeId: nid,
    engineVersion,
    nodeTags
  });

  // The loader demos attach their authored house even at a node procgen skips (a node
  // whose id doesn't match generateStructures' `/^n\d+/` heuristic). So the "nothing
  // to do" early-out only fires when there are NO procgen candidates AND this isn't a
  // demo seed — otherwise the default game is byte-identical to before.
  const isLoaderDemo = seed === LOADER_DEMO_SEED || seed === LOADER_DEMO2_SEED;
  if (!generated.length && !isLoaderDemo) return w;

  const existing = ensureStructures(w.structures);
  const mergedById = { ...(existing.byId || {}) };
  for (const s of generated) {
    if (!s || typeof s !== 'object') continue;
    const id = String(s.id || '').trim();
    if (!id) continue;
    if (mergedById[id]) continue;
    mergedById[id] = authoredOrProcgen(s);
  }

  // LOAD-1 — inject the authored one-room demo (seed-gated; no-op on every other seed).
  maybeInjectLoaderDemo(w, nid, mergedById);
  // LOAD-2 — inject the authored multi-room demo (seed-gated; no-op on every other seed).
  maybeInjectLoaderDemo2(w, nid, node, mergedById);

  const merged = ensureStructures({ byId: mergedById, nextId: existing.nextId });

  return {
    ...w,
    structures: merged
  };
}
