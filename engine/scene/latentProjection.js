import { generateSurfaceCandidate } from '../csl/grammar.js';
import { projectLatentSurface } from '../csl/latent.js';

function generateLatentSurfacesForNode({ seed, domain, nodeId, count = 3 }) {
  const surfaces = [];

  for (let i = 0; i < count; i++) {
    const base = generateSurfaceCandidate({
      seed,
      domain,
      index: i
    });

    const latent = projectLatentSurface({
      ...base,
      id: nodeId + ':' + base.id
    });

    surfaces.push(latent);
  }

  return surfaces;
}

export { generateLatentSurfacesForNode };
