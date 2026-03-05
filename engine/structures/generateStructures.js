/**
 * S1 — Deterministic Structure Generation (stub)
 * Pure function: no world mutation. No uncontrolled randomness.
 *
 * Inputs are explicit so determinism is obvious and testable.
 */
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
  const trigger = tags.includes('structure:demo') || /^n\d+(?:_|$)/.test(nid);
  if (!trigger) return [];

  const roomCount = 3 + ((s.length + nid.length + ver) % 2); // 3..4 deterministic
  const rooms = [];
  for (let i = 0; i < roomCount; i++) {
    rooms.push({ id: `room:${id}:${i + 1}`, tags: i === 0 ? ['entry'] : [] });
  }

  // Deterministic sparse connectivity: chain + one shortcut to create doors/path choices.
  const edges = [];
  for (let i = 0; i < roomCount - 1; i++) {
    edges.push({ a: rooms[i].id, b: rooms[i + 1].id, kind: 'door' });
  }
  if (roomCount >= 4) {
    edges.push({ a: rooms[0].id, b: rooms[2].id, kind: 'door' });
  }

  return [{
    id,
    kind: 'building',
    nodeId: nid,
    anchors: { nodeId: nid },
    topology: { kind: 'rooms', rooms, edges },
    surfaces: {},
    tags: ['generated', 'demo']
  }];
}
