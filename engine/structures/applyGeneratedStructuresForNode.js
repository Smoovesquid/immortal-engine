import { ensureWorld } from '../state.js';
import { generateStructuresForNode } from './generateStructures.js';
import { ensureStructures } from './structuresState.js';
import { hasAuthoredPlan, makeAuthoredStructure } from './authoredPlans.js';

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

  if (!generated.length) return w;

  const existing = ensureStructures(w.structures);
  const mergedById = { ...(existing.byId || {}) };
  for (const s of generated) {
    if (!s || typeof s !== 'object') continue;
    const id = String(s.id || '').trim();
    if (!id) continue;
    if (mergedById[id]) continue;
    mergedById[id] = authoredOrProcgen(s);
  }

  const merged = ensureStructures({ byId: mergedById, nextId: existing.nextId });

  return {
    ...w,
    structures: merged
  };
}
