// Pass T1 — party projection used by both worldHash variants so their
// hash images agree byte-for-byte. The core principle (see CLAUDE.md
// "Determinism"): any array whose order is not load-bearing must be
// sorted in the hash image so that trivial re-orderings do not break
// replay equality.
//
// Load-bearing arrays on a party member that we keep in their given
// order:
//   - inventory.weapons/armor/... (these are legacy string arrays;
//     order may matter to display and will migrate under T2)
//   - traits, background, signature, position, companion — structured
//     fields, not arrays we touched.
//
// Sorted-for-hash arrays (T1 additions where order is semantically
// irrelevant):
//   - foci
//   - inventory.items (by id)
//   - spells.known
//
// MAP-OCC-2 — position.ux/uy are renderer-owned pixel render coordinates
// (the on-screen walk position), not canon. They must NOT affect the
// world's determinism fingerprint: two replays that end at the same
// nodeId/zone but differ in exact pixel offset are the same world. Drop
// them from the hash image; keep nodeId/zone/interior, which ARE canon.

export function projectPartyForHash(party) {
  if (!Array.isArray(party)) return party;
  return party.map(projectMember);
}

function projectMember(m) {
  if (!m || typeof m !== 'object') return m;
  const inv = m.inventory && typeof m.inventory === 'object' ? m.inventory : {};
  const spells = m.spells && typeof m.spells === 'object' ? m.spells : {};
  return {
    ...m,
    position: projectPosition(m.position),
    foci: Array.isArray(m.foci) ? [...m.foci].sort() : m.foci,
    inventory: {
      ...inv,
      items: Array.isArray(inv.items)
        ? [...inv.items].sort(compareById)
        : inv.items
    },
    spells: {
      ...spells,
      known: Array.isArray(spells.known) ? [...spells.known].sort() : spells.known
    }
  };
}

// MAP-OCC-2 — strip renderer-owned pixel coordinates (ux/uy) from a
// party member's position before hashing. Everything else on position
// (zone, nodeId, interior, ...) is canon and stays.
function projectPosition(position) {
  if (!position || typeof position !== 'object') return position;
  const { ux, uy, ...rest } = position;
  return rest;
}

function compareById(a, b) {
  const ai = String(a?.id ?? '');
  const bi = String(b?.id ?? '');
  if (ai < bi) return -1;
  if (ai > bi) return 1;
  return 0;
}
