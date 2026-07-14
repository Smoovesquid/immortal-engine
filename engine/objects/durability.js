// OBJ-DURABILITY-1 / DM-GATE-1b — persistent object durability.
//
// A DECLARED FURNITURE ATTACK (detectObjectAttackIntent — a swing aimed at a
// present furniture piece, weapon named or not) resolves against the object's
// AC; damage past a material damageThreshold subtracts from a persistent HP
// pool tracked on world.objects[objectId].durability. HP 0 mirrors the Model A
// piece to the terminal 'wrecked' state (never deletion, never rubble — that is
// a later packet). Bare smash/break/kick keeps the LEGACY force resolver.
//
// This module is PURE of world state and RNG: it maps a piece's (kind, material)
// to a durability profile. The roll happens seeded in playloop; the write happens
// in effectsCore's damageObject delta. Both read this table.
//
// ── The material seam (data-derived, fail-closed) ──────────────────────────
// Physical material is resolved by EXPLICIT KIND PRECEDENCE first, then the
// piece's own material, else a safe fallback:
//   - A roomDetail 'fire' material is a LIGHT/FIRE RENDER TAG, never a physical
//     substance. The five light-bearing kinds resolve to what they are actually
//     built of: hearth/firepit are set masonry (stone); brazier/lantern are
//     ironwork (iron); candles are wax.
//   - Any recognized physical material (wood/iron/stone/cloth/glass/bone/web/wax)
//     retains its identity.
//   - Anything else (an unknown legacy/modded material, or a leftover 'fire' on a
//     non-light kind) falls back safely — reported as source:'fallback' so the
//     catalog-coverage test can prove no LIVE kind ever ships as fallback.
// There is no 'ceramic' catalog material; none is fabricated here.

// Light-bearing kinds whose render material ('fire') is not their physical one.
// Kind precedence: these win over the piece's material field.
const KIND_MATERIAL_OVERRIDE = Object.freeze({
  hearth: 'stone',
  firepit: 'stone',
  brazier: 'iron',
  lantern: 'iron',
  candles: 'wax',
});

// PROPOSED INITIAL DURABILITY BALANCE TABLE — approved by Tim 2026-07-14 as the
// initial tuning pass (OBJ-DURABILITY-1 brief rev 3). AC / maxHp / damageThreshold
// per physical-material class. These are a product/rules decision, not a repo
// fact: the repo establishes the live materials, not these numbers. Amend here.
const PROFILE = Object.freeze({
  wax:   Object.freeze({ ac: 8,  maxHp: 3,  threshold: 0 }),
  web:   Object.freeze({ ac: 10, maxHp: 5,  threshold: 0 }),
  cloth: Object.freeze({ ac: 11, maxHp: 6,  threshold: 0 }),
  glass: Object.freeze({ ac: 13, maxHp: 4,  threshold: 0 }),
  bone:  Object.freeze({ ac: 13, maxHp: 8,  threshold: 0 }),
  wood:  Object.freeze({ ac: 15, maxHp: 15, threshold: 3 }),
  stone: Object.freeze({ ac: 17, maxHp: 40, threshold: 10 }),
  iron:  Object.freeze({ ac: 19, maxHp: 30, threshold: 8 }),
});

// Safe fallback for unknown/leftover-'fire' identities. Deliberately distinct from
// wood so a fallback is never mistaken for a real material decision.
const FALLBACK = Object.freeze({ ac: 13, maxHp: 10, threshold: 2 });

// True iff this class has an explicit reviewed profile (used by the coverage test
// to assert every live catalog identity is a deliberate decision).
export function hasDurabilityProfile(material) {
  return Object.prototype.hasOwnProperty.call(PROFILE, String(material || '').toLowerCase());
}

/**
 * durabilityProfile(kind, material) -> { profile, physicalMaterial, source }
 *   profile          — { ac, maxHp, threshold } (a fresh copy)
 *   physicalMaterial — the resolved physical-material class, or 'unknown' on fallback
 *   source           — 'explicit' (kind override or a recognized material) | 'fallback'
 *
 * Pure. Never throws. The `source` field is what makes coverage fail-closed:
 * a NEW catalog material resolves as 'fallback' until someone adds a profile row,
 * and the coverage test requires every current catalog identity to be 'explicit'.
 */
export function durabilityProfile(kind, material) {
  const k = String(kind || '').toLowerCase();
  const m = String(material || '').toLowerCase();

  let physical = null;
  let source = 'fallback';
  if (KIND_MATERIAL_OVERRIDE[k]) {
    physical = KIND_MATERIAL_OVERRIDE[k];      // kind precedence (fire render tag → real substance)
    source = 'explicit';
  } else if (hasDurabilityProfile(m)) {
    physical = m;                               // recognized physical material
    source = 'explicit';
  }

  const base = physical ? PROFILE[physical] : FALLBACK;
  return {
    profile: { ac: base.ac, maxHp: base.maxHp, threshold: base.threshold },
    physicalMaterial: physical || 'unknown',
    source,
  };
}

/**
 * initialDurability(kind, material) -> { material, ac, maxHp, hp, threshold }
 * The full-HP snapshot written to the overlay on a piece's FIRST strike (lazy).
 */
export function initialDurability(kind, material) {
  const { profile, physicalMaterial } = durabilityProfile(kind, material);
  return {
    material: physicalMaterial,
    ac: profile.ac,
    maxHp: profile.maxHp,
    hp: profile.maxHp,
    threshold: profile.threshold,
  };
}
