function isObject(x) { return x && typeof x === 'object'; }

/**
 * Projection-only structure layer for MinimalWorld tests.
 * Deterministic: depends only on nodeId + surfaces content/order.
 *
 * Returns: Array<{ id, name, tags, surfaces:[{id}] }>
 */
export function projectStructuresForNode({ nodeId, surfaces }) {
  const nid = String(nodeId ?? '');
  const list = Array.isArray(surfaces) ? surfaces : [];

  // Deterministic ordering: by surface id string.
  const ordered = list
    .map(s => (isObject(s) ? s : null))
    .filter(Boolean)
    .slice()
    .sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')));

  // Pick up to 2 latent (non-canonical) surfaces to "belong" to a simple structure.
  const latent = ordered.filter(s => s.canonical === false).slice(0, 2);
  const refs = latent.map(s => ({ id: String(s.id ?? '') })).filter(r => r.id);

  // If there are no surfaces, still return a deterministic empty list.
  if (refs.length === 0) return [];

  return [{
    id: `st:${nid}:0`,
    name: 'Local Structure',
    tags: ['structure', 'local'],
    surfaces: refs
  }];
}
