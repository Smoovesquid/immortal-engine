// Runtime Validator for Canonical Surface Layer

function validateSurface(surface) {
  // Perform validation against NodeSurfaceSpec
  if (typeof surface.id !== 'string' || typeof surface.type !== 'string') {
    throw new Error('Invalid surface: id and type must be strings.');
  }
  // Check tags
  if (!Array.isArray(surface.tags) || !surface.tags.every(tag => typeof tag === 'string')) {
    throw new Error('Invalid surface: tags must be an array of strings.');
  }
  return true;
}

export { validateSurface };
