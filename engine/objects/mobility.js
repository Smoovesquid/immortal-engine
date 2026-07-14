// OBJ-STRENGTH-1 — the ONE object-mobility authority.
//
// mobilityForObject(piece) answers a single question about a physical object:
// can it be moved at all, and if so is it heavy? It is the seam every strength
// check consults FIRST, and it works for all three furniture sources uniformly:
//   • authored Builder pieces      — carry a `kind` (engine/structures/authoredFurniture.js)
//   • procgen pieces               — carry a `name` (engine/decompression/generateFurniture.js)
//   • room-plan fixtures           — carry a FURN `kind`/`label` (engine/structures/roomDetail.js)
//
// A fixture (hearth, well, altar, anvil, a stone basin) is `fixed` by WHAT IT IS,
// not by how heavy it happens to be — so masonry-ness is encoded by NAMING the
// actual fixtures, because a generic procgen piece carries no `fixture` flag, only
// name/material/bulk/weight. The classifier therefore keys on a canonical identity
// map (kind OR name), and only falls back to weight/bulk for identities the catalog
// does not yet contain. U695's coverage test enumerates the LIVE roomDetail.FURN
// keys+labels and generateFurniture.TEMPLATES[].name and requires every one to be
// mapped here — so a newly-added catalog item FAILS the test until its mobility is
// chosen (fail-closed).
//
// Only `fixed` hard-gates a take (→ impossible for everyone). The `heavy`/`portable`
// split is forward-looking (the drag/throw packets): who can lift a `portable`
// cast-iron cookpot or a `heavy` table is decided by the capacity math, not here.

import { clampInt } from '../util.js';

/**
 * normalizeIdentity(s) — lowercase, trim, collapse any run of whitespace /
 * underscore / hyphen to a single space. So 'iron-bound chest' and 'iron_bound
 * chest' both become 'iron bound chest', while 'fire pit' and 'firepit' stay the
 * distinct strings they are (a space is not inserted where the source has none).
 */
export function normalizeIdentity(s) {
  return String(s || '').toLowerCase().trim().replace(/[\s_-]+/g, ' ');
}

// ── Canonical identity → mobility. Keys are already in normalized form. Every
// alias present in the three live sources is enumerated with a chosen class
// (documented judgment calls live in docs/PACKETS.md OBJ-STRENGTH-1 row). ──
const IDENTITY_MOBILITY = Object.freeze({
  // fixed — set masonry, built-in, stone monument, or the smithy's anvil. No one
  // carries these off (a pry/detach mechanic is a later packet).
  hearth: 'fixed', firepit: 'fixed', 'fire pit': 'fixed', anvil: 'fixed',
  basin: 'fixed', 'stone basin': 'fixed', font: 'fixed', well: 'fixed',
  fountain: 'fixed', altar: 'fixed', throne: 'fixed', sarcoph: 'fixed',
  sarcophagus: 'fixed', pillar: 'fixed', 'stone pillar': 'fixed', statue: 'fixed',

  // heavy — movable only by the strong; big/dense but NOT a fixture.
  longtable: 'heavy', 'long table': 'heavy', table: 'heavy', 'wooden table': 'heavy',
  counter: 'heavy', stall: 'heavy', 'market stall': 'heavy', loom: 'heavy',
  barrel: 'heavy', bed: 'heavy', chest: 'heavy', 'iron bound chest': 'heavy',
  wardrobe: 'heavy', dresser: 'heavy', lectern: 'heavy', bench: 'heavy',
  pew: 'heavy', shelf: 'heavy', shelves: 'heavy', rack: 'heavy',
  'weapon rack': 'heavy', brazier: 'heavy', 'iron brazier': 'heavy', rubble: 'heavy',

  // portable — light, takeable by ordinary folk (capacity still gates the weak).
  chair: 'portable', 'wooden chair': 'portable', crate: 'portable', 'wooden crate': 'portable',
  nightstand: 'portable', rug: 'portable', runner: 'portable', 'aisle runner': 'portable',
  lantern: 'portable', 'oil lantern': 'portable', candles: 'portable', cookpot: 'portable',
  'cooking pot': 'portable', 'tool rack': 'portable', 'straw pallet': 'portable', pallet: 'portable',
  bedding: 'portable', 'straw bedding': 'portable', bones: 'portable', 'bone pile': 'portable',
  web: 'portable', 'web mass': 'portable', eggsac: 'portable', 'egg sac': 'portable',
});

export { IDENTITY_MOBILITY };

/**
 * mobilityForObject(piece) → 'fixed' | 'heavy' | 'portable'
 * Identity first (kind, then name/label), each looked up in IDENTITY_MOBILITY;
 * the first hit wins. Only an identity the map does not know falls back to
 * weight/bulk (weight >= 4 || bulk >= 4 → heavy, else portable).
 */
export function mobilityForObject(piece) {
  const p = piece && typeof piece === 'object' ? piece : {};
  const kind = normalizeIdentity(p.kind);
  if (kind && IDENTITY_MOBILITY[kind]) return IDENTITY_MOBILITY[kind];
  const name = normalizeIdentity(p.name ?? p.label);
  if (name && IDENTITY_MOBILITY[name]) return IDENTITY_MOBILITY[name];
  const weight = Number(p.weight);
  const bulk = Number(p.bulk);
  if ((Number.isFinite(weight) && weight >= 4) || (Number.isFinite(bulk) && bulk >= 4)) return 'heavy';
  return 'portable';
}

/**
 * objectPhysics(piece) → { weight, bulk, material, mobility }
 * The unified physics fact the capacity resolver consumes. Weight/bulk default to
 * a middling 3 for a piece that carries neither.
 */
export function objectPhysics(piece) {
  const p = piece && typeof piece === 'object' ? piece : {};
  return {
    weight: clampInt(p.weight ?? 3, 0, 5),
    bulk: clampInt(p.bulk ?? 3, 0, 5),
    material: String(p.material || 'wood'),
    mobility: mobilityForObject(p),
  };
}
