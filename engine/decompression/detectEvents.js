// Event Detection — threshold rules against worldTick state deltas.
// No per-pack authoring. Events are detected, not authored.

export const EVENT_DETECTORS = [
  // Ecology events
  { id: 'blight',          test: (pre, post) => post.ecology.corruption >= 40 && pre.ecology.corruption < 40 },
  { id: 'famine',          test: (pre, post) => post.ecology.scarcity >= 50 && pre.ecology.scarcity < 50 },
  { id: 'unrest',          test: (pre, post) => post.ecology.instability >= 40 && pre.ecology.instability < 40 },

  // Faction events
  { id: 'faction_tension', test: (pre, post) => post.factions.some((f, i) => f.hostility >= 60 && (pre.factions[i]?.hostility ?? 0) < 60) },
  { id: 'faction_war',     test: (pre, post) => post.factions.some((f, i) => f.hostility >= 80 && (pre.factions[i]?.hostility ?? 0) < 80) },
  { id: 'faction_arrival', test: (pre, post) => post.factions.length > pre.factions.length },

  // Scar events (irreversible thresholds)
  { id: 'corruption_scar', test: (pre, post) => post.scars.includes('corruption_shift') && !pre.scars.includes('corruption_shift') },
  { id: 'war_scar',        test: (pre, post) => post.scars.includes('war_state') && !pre.scars.includes('war_state') },
  { id: 'famine_scar',     test: (pre, post) => post.scars.includes('famine_arc') && !pre.scars.includes('famine_arc') },

  // Recovery events (from perturbations)
  { id: 'peace_period',    test: (pre, post) => post.factions.some((f, i) => f.hostility < (pre.factions[i]?.hostility ?? 0) - 5) },
  { id: 'trade_boom',      test: (pre, post) => post.ecology.scarcity < pre.ecology.scarcity - 5 },
];

function snapshotState(w) {
  return {
    ecology: {
      corruption: w.ecology?.corruption ?? 0,
      scarcity: w.ecology?.scarcity ?? 0,
      instability: w.ecology?.instability ?? 0
    },
    factions: (w.factions || []).map(f => ({ id: f.id, hostility: f.hostility ?? 0, lastMove: f.lastMove || '' })),
    scars: (w.scars || []).map(s => (typeof s === 'string' ? s : s.id || ''))
  };
}

export function detectEvents(preTickWorld, postTickWorld, era) {
  const pre = snapshotState(preTickWorld);
  const post = snapshotState(postTickWorld);

  const events = [];
  for (const detector of EVENT_DETECTORS) {
    if (detector.test(pre, post)) {
      events.push({
        era,
        eventId: detector.id,
        worldState: post,
        detected: true
      });
    }
  }
  return events;
}
