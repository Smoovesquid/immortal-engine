/**
 * The Daemon — Knowledge and Conversation of the True Will.
 *
 * The one time the hidden Will ever surfaces. For almost the whole game your Will
 * works on you unseen (engine/magic/will.js). But a player who lives with enough
 * intensity AND finds the rare rite (a Discovery-Layer attainment) may finally
 * KNOW their Daemon — see their True Will named — after which aligned magic surges
 * and the misalignment penalties soften, because at last they know what they are.
 *
 * Rare by design. PURE + DETERMINISTIC.
 */

import { willProfile } from './will.js';
import { governorFor } from './cosmology.js';

const INTENSITY_GATE = 30; // a life lived hard enough to have a Will worth knowing

// daemonState(world, { riteAttained }) -> { attained, trueWill, governor, beat }
// riteAttained is a deep, rare Discovery-Layer flag (the player sought and found
// the path). Without it, even a strong Will stays unconscious.
export function daemonState(world, opts = {}) {
  const prof = willProfile(world || {});
  const riteAttained = !!opts.riteAttained;
  if (!riteAttained || !prof.dominant || prof.intensity < INTENSITY_GATE) {
    return { attained: false, trueWill: null, governor: null, beat: null, intensity: prof.intensity };
  }
  const g = governorFor(prof.dominant);
  return {
    attained: true,
    trueWill: prof.dominant,
    governor: g,
    beat: `You know your Daemon at last: you are ${g ? g.epithet : prof.dominant} made flesh — ${g ? g.mode : 'your own will'}. The working no longer fights you.`,
    intensity: prof.intensity
  };
}

// daemonCastBonus(daemon, school) -> a small success bonus once attained, only for
// the True Will's school (knowing yourself makes your own magic surer).
export function daemonCastBonus(daemon, school) {
  if (!daemon || !daemon.attained) return 0;
  return school === daemon.trueWill ? 0.12 : 0;
}
