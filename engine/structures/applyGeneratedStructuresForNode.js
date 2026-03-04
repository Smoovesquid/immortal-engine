import { ensureWorld } from '../state.js';
import { generateStructuresForNode } from './generateStructures.js';
import { ensureStructures } from './structuresState.js';

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
    mergedById[id] = s;
  }

  const merged = ensureStructures({ byId: mergedById, nextId: existing.nextId });

  return {
    ...w,
    structures: merged
  };
}
