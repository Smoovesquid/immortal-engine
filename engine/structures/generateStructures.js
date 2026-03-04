/**
 * S1 — Deterministic Structure Generation (stub)
 * Pure function: no world mutation. No uncontrolled randomness.
 *
 * Inputs are explicit so determinism is obvious and testable.
 */
function isObject(x) { return x && typeof x === 'object'; }

export function generateStructuresForNode({ seed, nodeId, engineVersion, nodeTags }) {
  const s = String(seed ?? '');
  const nid = String(nodeId ?? '');
  const ver = Number.isFinite(+engineVersion) ? Math.floor(+engineVersion) : 0;
  const tags = Array.isArray(nodeTags) ? nodeTags.map(String) : [];

  // Deterministic stable id: derived solely from inputs (not from RNG).
  // NOTE: This is a stub “shape unlock” — future gates can replace with richer logic.
  const id = `stgen:v${ver}:${nid}:0`;

  // Deterministic rule: only emit a trivial building if a stable trigger is present.
  // Keeps behavior minimal and predictable while proving the pipeline.
  const trigger = tags.includes('structure:demo') || (s.length > 0 && nid.length > 0 && (s + '|' + nid).length % 2 === 0);
  if (!trigger) return [];

  return [{
    id,
    kind: 'building',
    nodeId: nid,
    anchors: { nodeId: nid },
    topology: null,
    surfaces: {},
    tags: ['generated', 'demo']
  }];
}
