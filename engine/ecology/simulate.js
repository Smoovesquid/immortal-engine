/**
 * Population simulation — the ecology that's actually alive.
 *
 * A biome holds populations of species wired by a food web. Each tick: producers
 * regrow toward the land's carrying capacity, herbivores eat producers, predators
 * eat herbivores, apex eat predators — births from food, deaths from predation,
 * starvation, and crowding. Cull the wolves and the deer boom, then strip the
 * grass, then crash. Reintroduce and it recovers. Deterministic discrete
 * Lotka-Volterra with logistic damping (stable, replay-safe).
 *
 * PURE + DETERMINISTIC.
 */

import { buildFoodWeb } from './foodweb.js';

const DEFAULTS = {
  resource: 1000,   // producer carrying capacity (the land)
  rProd: 0.55,      // producer regrowth
  capture: 0.0016,  // predation interaction strength
  assim: 0.5,       // fraction of eaten biomass becoming predator births
  mort: 0.08,       // baseline consumer mortality
  starve: 0.35,     // extra mortality when underfed
  maint: 0.15,      // food per head needed to avoid starving
  crowd: 0.06,      // intraspecific competition among same-role consumers
  consumerCap: 600  // hard ceiling so nothing explodes
};

const INIT = { producer: 0.55, herbivore: 0.16, scavenger: 0.05, predator: 0.04, apex: 0.012 };

// makeEcosystem({ biome, refs, defByRef, params }) — derive web + seed populations.
export function makeEcosystem({ biome = 'forest', refs = [], defByRef = () => null, params = {} } = {}) {
  const web = buildFoodWeb(refs, defByRef);
  const p = { ...DEFAULTS, ...params };
  const pop = {};
  for (const ref of Object.keys(web.roles)) pop[ref] = Math.round((INIT[web.roles[ref]] ?? 0.05) * p.resource / Math.max(1, (web.byRole[web.roles[ref]] || []).length));
  return { biome, pop, roles: web.roles, edges: web.edges, byRole: web.byRole, resource: p.resource, params: p, tick: 0 };
}

// Build an explicit ecosystem (for controlled tests): roles + edges + pop given.
export function ecosystemFrom({ pop, roles, edges, resource = 1000, params = {} }) {
  return { biome: 'custom', pop: { ...pop }, roles: { ...roles }, edges: edges.slice(), resource, params: { ...DEFAULTS, ...params }, tick: 0 };
}

export function stepEcosystem(state) {
  const { pop, roles, edges, params: p } = state;
  const intake = {}, loss = {};
  for (const { pred, prey } of edges) {
    const np = pop[pred] || 0, ny = pop[prey] || 0;
    if (np <= 0 || ny <= 0) continue;
    const flow = Math.min(ny * 0.55, p.capture * np * ny); // can't strip more than half the prey at once
    intake[pred] = (intake[pred] || 0) + flow;
    loss[prey] = (loss[prey] || 0) + flow;
  }
  // same-role crowding totals
  const roleTotal = {};
  for (const r of Object.keys(pop)) roleTotal[roles[r]] = (roleTotal[roles[r]] || 0) + pop[r];

  const next = {};
  for (const ref of Object.keys(pop)) {
    const n = pop[ref], role = roles[ref];
    let nn = n;
    if (role === 'producer') {
      nn = n + p.rProd * n * (1 - n / state.resource) - (loss[ref] || 0);
    } else {
      const food = intake[ref] || 0;
      const births = p.assim * food;
      const starve = food < p.maint * n ? p.starve * (n - food / Math.max(p.maint, 1e-6)) : 0;
      const crowd = p.crowd * n * (roleTotal[role] || 0) / p.consumerCap;
      nn = n + births - (loss[ref] || 0) - p.mort * n - Math.max(0, starve) - crowd;
      if (nn > p.consumerCap) nn = p.consumerCap;
    }
    next[ref] = Math.max(0, Math.round(nn * 100) / 100);
  }
  return { ...state, pop: next, tick: state.tick + 1 };
}

export function runEcosystem(state, ticks) {
  let s = state; const history = [snapshot(s)];
  for (let i = 0; i < ticks; i++) { s = stepEcosystem(s); history.push(snapshot(s)); }
  return { state: s, history };
}

// applyRipple(state, { cull:{ref,frac}, introduce:{ref,amount} }) -> new state
export function applyRipple(state, ripple = {}) {
  const pop = { ...state.pop };
  if (ripple.cull) { const r = ripple.cull.ref; pop[r] = Math.max(0, (pop[r] || 0) * (1 - (ripple.cull.frac ?? 1)) - (ripple.cull.amount || 0)); }
  if (ripple.introduce) { const r = ripple.introduce.ref; pop[r] = (pop[r] || 0) + (ripple.introduce.amount || 0); }
  return { ...state, pop };
}

export function totalByRole(state) {
  const t = {}; for (const r of Object.keys(state.pop)) t[state.roles[r]] = (t[state.roles[r]] || 0) + state.pop[r];
  return t;
}
function snapshot(s) { return { tick: s.tick, byRole: totalByRole(s) }; }
