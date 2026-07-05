import { ensureWorld } from '../state.js';
import { generateStructuresForNode } from './generateStructures.js';
import { ensureStructures } from './structuresState.js';
import { hasAuthoredPlan, makeAuthoredStructure } from './authoredPlans.js';
import { loadAuthoredStructure } from './authoredStructure.js';
import loaderDemoHouse from '../../packs/base/structures/authored/loader_demo.house.js';

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

  // The loader demo attaches its authored hut even at a node procgen skips (a node
  // whose id doesn't match generateStructures' `/^n\d+/` heuristic). So the "nothing
  // to do" early-out only fires when there are NO procgen candidates AND this isn't
  // the demo seed — otherwise the default game is byte-identical to before.
  const isLoaderDemo = seed === LOADER_DEMO_SEED;
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

  const merged = ensureStructures({ byId: mergedById, nextId: existing.nextId });

  return {
    ...w,
    structures: merged
  };
}
