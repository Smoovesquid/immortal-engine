// ── SPATIAL POSITIONING ────────────────────────────────────────────────────
//
// Position calculations for board-aware adjudication.
// All distances in 0-100 node coordinate space.

// Distance between two positions (Euclidean, same node only)
export function distance(p1, p2) {
  if (!p1 || !p2) return Infinity;
  const dx = p1.ux - p2.ux;
  const dy = p1.uy - p2.uy;
  return Math.sqrt(dx * dx + dy * dy);
}

// Adjacent = within 15 units (5 feet at ~3 units per foot)
export function isAdjacent(p1, p2, threshold = 15) {
  return distance(p1, p2) < threshold;
}

// Same elevation (can interact without climbing)
export function sameLevel(p1, p2) {
  if (!p1 || !p2) return false;
  return (p1.elevation ?? 0) === (p2.elevation ?? 0);
}

// Can move between two positions in same node
export function canMove(start, end, obstacles = []) {
  if (!start || !end) return false;

  // Check line of movement against obstacles
  const dx = end.ux - start.ux;
  const dy = end.uy - start.uy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // No obstacles = can always move
  if (!obstacles || obstacles.length === 0) return true;

  // Check each obstacle
  for (const obs of obstacles) {
    if (blocksMovement(start, end, obs)) {
      return false;
    }
  }

  return true;
}

// Does object block movement from start to end?
function blocksMovement(start, end, object) {
  if (!object.position) return false;

  // Object blocks if it's roughly on the line between start and end
  const dx = end.ux - start.ux;
  const dy = end.uy - start.uy;

  const dox = object.position.ux - start.ux;
  const doy = object.position.uy - start.uy;

  // Cross product to find distance from object to line
  const cross = Math.abs(dx * doy - dy * dox);
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  if (lineLength === 0) return false;

  const distanceToLine = cross / lineLength;

  // Object blocks if within 5 units of line (and on the path)
  return distanceToLine < 5;
}

// Line of sight: is target visible from position?
export function hasLineOfSight(from, to, obstacles = []) {
  if (!from || !to) return false;

  // Blocked if any obstacle is between from and to
  for (const obs of obstacles) {
    if (obs.position && blocksLineOfSight(from, to, obs.position)) {
      return false;
    }
  }

  return true;
}

// Does object block line of sight from 'from' to 'to'?
function blocksLineOfSight(from, to, objPos) {
  if (!objPos) return false;

  // Object blocks if it's roughly on the line
  const dx = to.ux - from.ux;
  const dy = to.uy - from.uy;

  const dox = objPos.ux - from.ux;
  const doy = objPos.uy - from.uy;

  // Cross product
  const cross = Math.abs(dx * doy - dy * dox);
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  if (lineLength === 0) return false;

  const distanceToLine = cross / lineLength;

  // Object blocks if within 8 units of line
  return distanceToLine < 8;
}

// Get all furniture objects at a node
export function furnitureAtNode(world, nodeId) {
  const node = world.map?.nodes?.find(n => n.id === nodeId);
  if (!node || !node.furniture) return [];
  return node.furniture.map(f => ({
    ...f,
    position: {
      ux: f.ux ?? 50,
      uy: f.uy ?? 50,
      elevation: f.elevation ?? 0
    }
  }));
}

// Find closest furniture to position
export function findClosestFurniture(position, furniture) {
  if (!furniture || furniture.length === 0) return null;

  let closest = null;
  let closestDist = Infinity;

  for (const item of furniture) {
    const d = distance(position, item.position || { ux: 50, uy: 50 });
    if (d < closestDist) {
      closestDist = d;
      closest = item;
    }
  }

  return closest;
}

// Compute DC modifier based on distance
export function dcModifierForDistance(dist) {
  if (dist < 1) return 0; // Adjacent
  if (dist < 30) return 1; // Close
  if (dist < 60) return 2; // Medium
  return 3; // Far
}

// Check if flanked (enemies on opposite sides)
export function isFlanked(position, enemies = []) {
  if (enemies.length < 2) return false;

  // Flanked if enemies are roughly on opposite sides
  const e1 = enemies[0];
  const e2 = enemies[1];

  const d1 = {
    ux: (e1.position?.ux ?? 50) - position.ux,
    uy: (e1.position?.uy ?? 50) - position.uy
  };

  const d2 = {
    ux: (e2.position?.ux ?? 50) - position.ux,
    uy: (e2.position?.uy ?? 50) - position.uy
  };

  // Dot product - negative means opposite directions
  const dotProduct = d1.ux * d2.ux + d1.uy * d2.uy;

  return dotProduct < 0; // Opposite sides
}

// New position after moving toward target
export function moveToward(from, to, maxDistance = 30) {
  const d = distance(from, to);
  if (d <= maxDistance) {
    return to; // Can reach target
  }

  // Move partway toward target
  const ratio = maxDistance / d;
  return {
    ux: from.ux + (to.ux - from.ux) * ratio,
    uy: from.uy + (to.uy - from.uy) * ratio,
    elevation: from.elevation ?? 0
  };
}

// New position offset (used for positioning around a point)
export function positionAround(center, angle, radius = 10) {
  return {
    ux: center.ux + Math.cos(angle) * radius,
    uy: center.uy + Math.sin(angle) * radius,
    elevation: center.elevation ?? 0
  };
}
