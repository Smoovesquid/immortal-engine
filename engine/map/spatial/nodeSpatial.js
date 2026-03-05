import { hashString } from "../../utils/hash.js";

/*
Node Spatial Identity

Produces deterministic spatial metadata for a node.
Used as the seed source for all spatial generation.
*/

export function generateNodeSpatialIdentity({ worldSeed, nodeId, nodeType }) {

  const baseSeed = hashString(`${worldSeed}:${nodeId}:spatial`);

  const sizeTier = (baseSeed % 3) + 1;

  const factionTable = [
    "neutral",
    "trade",
    "religious",
    "military"
  ];

  const factionPresence = factionTable[
    baseSeed % factionTable.length
  ];

  return {
    nodeId,
    type: nodeType,
    seed: baseSeed,
    sizeTier,
    factionPresence
  };
}

/*
Compatibility wrapper
- localProjection.js currently calls generateNodeSpatial(seed, nodeId)
- Keep identity generator as the canonical source; expose a stable shim.
*/
export function generateNodeSpatial(worldSeed, nodeId, nodeType = "node") {
  return generateNodeSpatialIdentity({ worldSeed, nodeId, nodeType });
}
