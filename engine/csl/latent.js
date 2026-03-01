import crypto from 'node:crypto';

function hashInt(str) {
  const h = crypto.createHash('sha256').update(str).digest('hex');
  return parseInt(h.slice(0, 8), 16);
}

function projectLatentSurface(surface) {
  return {
    ...surface,
    canonical: false,
    sockets: [
      {
        id: surface.id + '-socket-0',
        kind: 'container',
        affordance: 'open',
        state: 'latent'
      }
    ]
  };
}

function canonizeSurface(latentSurface, { seed, actionKey }) {
  if (latentSurface.canonical) {
    return { surface: latentSurface, events: [] };
  }

  const eventId =
    latentSurface.id +
    ':canon:' +
    hashInt(seed + ':' + actionKey);

  const canonicalSurface = {
    ...latentSurface,
    canonical: true,
    sockets: latentSurface.sockets.map((s) => ({
      ...s,
      state: 'resolved'
    }))
  };

  return {
    surface: canonicalSurface,
    events: [
      {
        id: eventId,
        type: 'CANON_CREATE',
        targetId: latentSurface.id
      }
    ]
  };
}

export { projectLatentSurface, canonizeSurface };
