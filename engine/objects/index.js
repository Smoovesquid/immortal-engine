// Object System — unified first-class object model for physical world
// Export: schema, query, outcomes, bridge

export { schema } from './schema.js';
export { query } from './query.js';
export { outcomes } from './outcomes.js';
export { bridge } from './physicsBridge.js';

// OBJ-STATE-1 — stable identity + live-placement resolver.
export { authoredObjectId, procgenObjectId, hasObjectId, deriveObjectId } from './identity.js';
export { resolvedObjectPlacement, findFurnitureByObjectId, barricadeOnDoor, barricadeRecordOf } from './placement.js';

// OBJ-STRENGTH-1 — object mobility, actor-agnostic capacity, physics-actor lookup.
export { mobilityForObject, objectPhysics, IDENTITY_MOBILITY, normalizeIdentity } from './mobility.js';
export { actorObjectCapacity, baseCapacity } from './capacity.js';
export { findPhysicsActor, actorSize, actorMight, actorFacts } from './physicsActor.js';

// OBJ-DURABILITY-1 — material-derived AC/HP/threshold profiles for object strikes.
export { durabilityProfile, initialDurability, hasDurabilityProfile } from './durability.js';

// OBJ-THROW-6B — the pure throw layer (grammar, product constants, impact filter).
// NOTE: map/spatial/tacticalPos.js imports MAX_THROW_CELLS from './throwing.js'
// DIRECTLY, never through this barrel — the same convention it already uses for
// placement.js — so the throw constants cannot drag the whole object barrel into
// the spatial layer's evaluation order.
export {
  MAX_THROW_CELLS, THROW_NOISE, THROW_VERB_RE,
  isHardSurface, wallPhysicalMaterial, filterImpact, impactMaterialOf,
  isThrowIdiom, isSelfThrow, parseThrowPhrases, hasExplicitOrdinal, drawThrowOutcome,
} from './throwing.js';

// OBJ-BARRICADE-6C — the pure barricade layer (grammar, constants, qualification).
// Same barrel convention as throwing.js: map/spatial/tacticalPos.js and
// effectsCore.js import from './barricade.js' DIRECTLY, never through here.
export {
  BARRICADE_VERB_RE, BARRICADE_BUILD_IDIOM_RE, BARRICADE_ACTION, BARRICADE_NOISE,
  MIN_BARRICADE_BULK, parseBarricadePhrases, portalIsEntrance, qualifiesAsBarricade,
  namesDoorPortal,
} from './barricade.js';
