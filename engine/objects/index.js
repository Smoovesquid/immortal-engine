// Object System — unified first-class object model for physical world
// Export: schema, query, outcomes, bridge

export { schema } from './schema.js';
export { query } from './query.js';
export { outcomes } from './outcomes.js';
export { bridge } from './physicsBridge.js';

// OBJ-STATE-1 — stable identity + live-placement resolver.
export { authoredObjectId, procgenObjectId, hasObjectId, deriveObjectId } from './identity.js';
export { resolvedObjectPlacement, findFurnitureByObjectId } from './placement.js';
