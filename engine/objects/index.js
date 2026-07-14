// Object System — unified first-class object model for physical world
// Export: schema, query, outcomes, bridge

export { schema } from './schema.js';
export { query } from './query.js';
export { outcomes } from './outcomes.js';
export { bridge } from './physicsBridge.js';

// OBJ-STATE-1 — stable identity + live-placement resolver.
export { authoredObjectId, procgenObjectId, hasObjectId, deriveObjectId } from './identity.js';
export { resolvedObjectPlacement, findFurnitureByObjectId } from './placement.js';

// OBJ-STRENGTH-1 — object mobility, actor-agnostic capacity, physics-actor lookup.
export { mobilityForObject, objectPhysics, IDENTITY_MOBILITY, normalizeIdentity } from './mobility.js';
export { actorObjectCapacity, baseCapacity } from './capacity.js';
export { findPhysicsActor, actorSize, actorMight, actorFacts } from './physicsActor.js';
