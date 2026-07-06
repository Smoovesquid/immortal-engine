// ============================================================================
// ⚠️  DEAD PROTOTYPE — DO NOT BUILD ON THIS FILE.  (quarantined by PW-6, 2026-07-06)
// ----------------------------------------------------------------------------
// This is the abandoned CANON_CREATE proof-of-concept for the prose-to-world
// idea. It operates on the MINIMAL-WORLD prototype shape (`world.nodes[].surfaces`,
// see engine/world/minimalWorld.js) — NOT the live world, which keeps nodes at
// `world.map.nodes` and materializes content through the seams that actually
// shipped. `canonizeSurface` here emits a synthetic `CANON_CREATE` event and is
// wired only into `resolveSurfaceContact.js` + the minimalWorld sandbox + a few
// U8 / csl.latent tests. It is superseded by the LANDED prose-to-world arc:
//   PW-1 (v0.22.0)  materialize revealed container items (engine/playloop.js
//                   tryTakeRevealedContainerItem + effectsCore modifyFurniture)
//   PW-2 (v0.31.4)  honest floor for ungrounded takes
//   PW-3 (v0.31.5)  live rumor surfacing (engine/rumor/*)
//   PW-4 (v0.31.x)  derived room dressing (engine/structures/roomDressing.js)
//   PW-5 (v0.32.2)  region-common knowledge on the ask path
// The real materialization contract is docs/briefs/PROSE_TO_WORLD_CONTRACT.md
// (§1b explicitly names this file as the dark prototype). Kept only because the
// minimalWorld sandbox + its determinism tests still import it; if that sandbox
// is ever retired, delete this file with it. New work must NOT extend it.
// ============================================================================
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
