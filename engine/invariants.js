import { WORLD_VERSION } from './state.js';

export function assertWorldInvariants(world) {
  if (!world || typeof world !== 'object') {
    throw new Error('Invariant: world must be object');
  }

  if (world.meta?.version !== WORLD_VERSION) {
    throw new Error('Invariant: world version mismatch');
  }

  const clocks = world.clocks || {};
  for (const k of ['dread', 'pressure', 'revelation']) {
    const v = clocks[k];
    if (!Number.isInteger(v) || v < 0 || v > 12) {
      throw new Error(`Invariant: invalid clock ${k}`);
    }
  }
}
