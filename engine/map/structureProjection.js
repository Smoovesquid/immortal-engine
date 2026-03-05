import { ensureWorld } from '../state.js';
import { edgeKey } from '../structures/discoveryState.js';
import { generateStructuresForNode } from '../structures/generateStructures.js';

export const MAP_STRUCTURE_KINDS = new Set(['road', 'building', 'wall', 'bridge', 'ruin', 'tower', 'shrine']);

function normalizeKind(kind, tags) {
  const k = String(kind || '').trim().toLowerCase();
  if (MAP_STRUCTURE_KINDS.has(k)) return k;
  const tagArr = Array.isArray(tags) ? tags.map(x => String(x).toLowerCase()) : [];
  for (const t of tagArr) {
    if (t.startsWith('kind:')) {
      const v = t.slice(5);
      if (MAP_STRUCTURE_KINDS.has(v)) return v;
    }
    if (MAP_STRUCTURE_KINDS.has(t)) return t;
  }
  return 'building';
}

function anchorFromStructure(s) {
  const a = s?.anchors || {};
  if (a && typeof a === 'object') {
    if (a.nodeId) return { anchorType: 'node', anchorRef: String(a.nodeId) };
    if (a.edge && typeof a.edge === 'object') return { anchorType: 'edge', anchorRef: edgeKey(a.edge.a, a.edge.b) };
    if (a.coord && typeof a.coord === 'object') {
      const x = Number.isFinite(+a.coord.x) ? Math.floor(+a.coord.x) : 0;
      const y = Number.isFinite(+a.coord.y) ? Math.floor(+a.coord.y) : 0;
      return { anchorType: 'coord', anchorRef: `${x},${y}` };
    }
  }
  return { anchorType: 'node', anchorRef: String(s?.nodeId || '') };
}

export function projectStructuresForMap(world) {
  const w = ensureWorld(world);
  const nodeId = String(w.map?.currentNodeId || '');
  const byId = w.structures?.byId || {};
  const out = [];

  for (const s of Object.values(byId)) {
    if (String(s?.nodeId || '') !== nodeId) continue;
    const { anchorType, anchorRef } = anchorFromStructure(s);
    out.push({
      id: String(s.id),
      kind: normalizeKind(s.kind, s.tags),
      anchorType,
      anchorRef,
      tags: Array.isArray(s.tags) ? [...s.tags].map(String).sort((a, b) => a.localeCompare(b)) : []
    });
  }

  const mapNodes = Array.isArray(w.map?.nodes) ? w.map.nodes : [];
  const engineVersion = Number.isFinite(+w.meta?.version) ? Math.floor(+w.meta.version) : 0;
  const generated = generateStructuresForNode({
    seed: String(w.meta?.seed || ''),
    nodeId,
    engineVersion,
    nodeTags: (mapNodes.find(n => String(n?.id || '') === nodeId)?.tags || [])
  });

  for (const s of generated) {
    if (!s || typeof s !== 'object') continue;
    const id = String(s.id || '');
    if (!id) continue;
    if (out.some(x => x.id === id)) continue;
    const { anchorType, anchorRef } = anchorFromStructure(s);
    out.push({
      id,
      kind: normalizeKind(s.kind, s.tags),
      anchorType,
      anchorRef,
      tags: Array.isArray(s.tags) ? [...s.tags].map(String).sort((a, b) => a.localeCompare(b)) : []
    });
  }

  out.sort((a, b) => {
    const ka = `${a.kind}|${a.anchorType}|${a.anchorRef}|${a.id}`;
    const kb = `${b.kind}|${b.anchorType}|${b.anchorRef}|${b.id}`;
    return ka.localeCompare(kb);
  });

  return { nodeId, structures: out };
}
