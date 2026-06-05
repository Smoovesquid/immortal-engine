/**
 * Ecology events — turns population shifts into stories.
 *
 * Compare an ecosystem before and after a stretch of time and read the drama out
 * of the numbers: producers collapse into famine, a predator goes bold, a species
 * is wiped out, the land recovers, herbivores overrun a depleted range. These are
 * rumor-hook seeds — the living world generating its own quests.
 *
 * PURE + DETERMINISTIC.
 */

function byRole(state, role) { let s = 0; for (const r of Object.keys(state.pop)) if (state.roles[r] === role) s += state.pop[r]; return s; }

// ecologyEvents(before, after, { nameOf }) -> [{ type, biome, ref?, text }]
export function ecologyEvents(before, after, opts = {}) {
  const nameOf = opts.nameOf || (r => r);
  const biome = after.biome || 'wilds';
  const out = [];
  const cap = after.resource || 1000;

  const prodB = byRole(before, 'producer'), prodA = byRole(after, 'producer');
  if (prodB > 0 && prodA < prodB * 0.6 && prodA < cap * 0.35) out.push({ type: 'famine', biome, text: `Game thins and the green fails across the ${biome}; hunger spreads.` });
  if (prodB < cap * 0.3 && prodA > prodB * 1.5) out.push({ type: 'recovery', biome, text: `The ${biome} greens again — the herds return.` });

  for (const ref of Object.keys(after.pop)) {
    const role = after.roles[ref], a = after.pop[ref], b = before.pop[ref] || 0;
    if ((role === 'predator' || role === 'apex') && b > 4 && a > b * 1.6 && a > 18) out.push({ type: 'predator_boom', biome, ref, text: `${nameOf(ref)} grow bold in the ${biome} — travelers go missing.` });
    if (role === 'herbivore' && b > 8 && a > b * 1.8 && a > 100) out.push({ type: 'overrun', biome, ref, text: `${nameOf(ref)} overrun the ${biome}, stripping the land bare.` });
    if (b > 3 && a < 1) out.push({ type: 'extirpation', biome, ref, text: `The ${nameOf(ref)} have vanished from the ${biome}.` });
  }
  // de-dup by type+ref
  const seen = new Set(); return out.filter(e => { const k = e.type + '|' + (e.ref || ''); if (seen.has(k)) return false; seen.add(k); return true; });
}
