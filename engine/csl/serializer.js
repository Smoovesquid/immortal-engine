// Canonical Serializer for surfaces

function serializeSurface(surface) {
  return JSON.stringify(surface, Object.keys(surface).sort());
}

function deserializeSurface(serialized) {
  return JSON.parse(serialized);
}

export { serializeSurface, deserializeSurface };
