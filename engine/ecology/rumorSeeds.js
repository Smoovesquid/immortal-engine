/**
 * Ecology -> rumor seeds. The living world generates its own talk.
 *
 * Every ecology event (a famine, a predator boom, a species wiped out) becomes a
 * TRUE rumor seed in the shape the rumor mint pipeline already consumes
 * ({ id, primaryName, truthBody, tags }). NPCs pick these up and garble them as
 * they spread — so "wolves grow bold on the north road" can reach you as fact,
 * exaggeration, or warning. This is the north-star rumor layer fed by simulation.
 *
 * PURE + DETERMINISTIC.
 */

const SHORT = {
  famine: b => `famine in the ${b}`,
  recovery: b => `the ${b} recovers`,
  predator_boom: (b, n) => `${n} bold in the ${b}`,
  overrun: (b, n) => `${n} overrun the ${b}`,
  extirpation: (b, n) => `${n} gone from the ${b}`
};

export function ecologyRumorSeeds(events, opts = {}) {
  const seed = String(opts.seed || 'eco');
  const nameOf = opts.nameOf || (r => r);
  const seen = new Set(), out = [];
  for (let i = 0; i < (events || []).length; i++) {
    const e = events[i];
    const id = `rumorseed:eco:${seed}:${e.type}:${e.ref || e.biome || i}`;
    if (seen.has(id)) continue; seen.add(id);
    const name = e.ref ? nameOf(e.ref) : '';
    const primaryName = (SHORT[e.type] ? SHORT[e.type](e.biome || 'wilds', name) : `${e.type} in the ${e.biome || 'wilds'}`);
    out.push({ id, primaryName, truthBody: e.text, tags: ['ecology', e.type, e.biome].filter(Boolean), source: 'ecology', ref: e.ref || null });
  }
  return out;
}
