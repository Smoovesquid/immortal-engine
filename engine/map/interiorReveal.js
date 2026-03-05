export function shouldRevealInterior(structureId, enteredStructureId) {
  if (!enteredStructureId) return false;
  return structureId === enteredStructureId;
}

export function revealInteriorTopology(seed, structureId) {
  const rooms = [];

  const roomCount = (hash(seed + ':' + structureId) % 6) + 3;

  for (let i = 0; i < roomCount; i++) {
    const h = hash(seed + ':' + structureId + ':' + i);

    rooms.push({
      roomId: i,
      type: ['hall','chamber','vault','passage'][h % 4],
      x: (h % 100) / 100,
      y: ((h >> 4) % 100) / 100
    });
  }

  return {
    structureId,
    roomCount,
    rooms
  };
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
