/**
 * Discovery Layer — stories as easter eggs, distributed like real life.
 *
 * The anti-pattern this kills: the quest vending machine, where every villager
 * dispenses a lead and every lead pays out. Here, almost everyone is just a
 * person (narrative weight ~0). A rare few carry something — and what they carry
 * is HIDDEN until you spend interaction to find out, and it is not always worth
 * it: most of it is flavor, a friendship, a half-true rumor, a pointless dark
 * secret ("kill my husband, he snores"), or a trap. Real leads (a lair, a relic,
 * a forbidden spell) are rare, so they land.
 *
 * Earnable, unreliable TELLS: a perceptive character (high WITS) gets a faint
 * hint that something's there — sometimes a misread. Depth GATES (earned trust,
 * a topic pressed, a fact found) unlock the truth. Friendship is a first-class
 * terminal reward; leads can also pay out mechanically.
 *
 * DETERMINISTIC + PURE. No quest markers, no readout — the world never tells you
 * who matters; you find out by paying attention, or you walk past and go fight.
 */

const h32 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const h01 = s => h32(s) / 4294967296;

// Most people carry nothing. Only this top slice of the population has any thread.
const WEIGHT_THRESHOLD = 0.68;

// Of those who DO carry something, how it splits (sums to 1). Leads are rare on
// purpose; bonds (friendship) get a real slice; duds/traps keep the player wary.
const PAYOFF = [
  ['flavor', 0.30],   // a glimpse of a life, nothing to chase
  ['rumor', 0.25],    // a thing they heard — true, exaggerated, or wrong
  ['bond', 0.20],     // a person worth knowing; the reward is friendship
  ['dud', 0.10],      // a dark secret with no payoff
  ['trap', 0.07],     // pursuing it costs you
  ['lead', 0.08]      // rare: a real thread (lair / lore / relic / spell)
];

export function narrativeWeight(ownerId, seed = '') { return h01(`${seed}|nw|${ownerId}`); }

export function payoffClass(ownerId, seed = '') {
  if (narrativeWeight(ownerId, seed) < WEIGHT_THRESHOLD) return 'none';
  let t = h01(`${seed}|pc|${ownerId}`), acc = 0;
  for (const [cls, p] of PAYOFF) { acc += p; if (t <= acc) return cls; }
  return 'flavor';
}

const LEAD_KINDS = ['lair', 'lore', 'relic', 'spell'];
const HAZARDS = ['ambush', 'reprisal', 'curse', 'debt'];

function rewardFor(cls, ownerId, seed) {
  switch (cls) {
    case 'bond': return { narrative: 'a friendship, hard-won', companionEligible: true, mechanical: null };
    case 'lead': { const k = LEAD_KINDS[h32(`${seed}|lk|${ownerId}`) % LEAD_KINDS.length]; return { narrative: `a true lead — ${k}`, companionEligible: false, mechanical: { kind: k } }; }
    case 'trap': { const z = HAZARDS[h32(`${seed}|hz|${ownerId}`) % HAZARDS.length]; return { narrative: 'a costly mistake', hazard: z, mechanical: { penalty: true, hazard: z } }; }
    case 'dud': return { narrative: 'a squalid little secret worth nothing', mechanical: null };
    case 'rumor': return { narrative: 'something they heard', truth: h01(`${seed}|rt|${ownerId}`) > 0.45, mechanical: null };
    default: return { narrative: 'a glimpse of an ordinary life', mechanical: null };
  }
}

// trust required to open up, by class — friendship takes time; traps are easy to fall into.
const GATE_TRUST = { flavor: 1, rumor: 2, bond: 6, dud: 3, trap: 3, lead: 4 };

// discoveryFor(owner, seed) -> Discovery | null  (null is the common case).
export function discoveryFor(owner, seed = '') {
  const id = String(owner && (owner.id || owner.ref || owner) || '');
  const cls = payoffClass(id, seed);
  if (cls === 'none') return null;
  return {
    id: `disc:${id}`, owner: id, payoffClass: cls,
    weight: narrativeWeight(id, seed),
    gate: { trust: GATE_TRUST[cls] ?? 3, topic: cls === 'lead' ? 'secret' : null },
    reward: rewardFor(cls, id, seed)
  };
}

// tellFor(discovery, wits, seed) -> string | null
// Only a perceptive character (WITS) senses anything, and the read is unreliable:
// high WITS narrows the error, but a misread can point at the wrong nature.
export function tellFor(discovery, wits = 10, seed = '') {
  if (!discovery || wits < 12) return null;
  const reliability = Math.max(0, Math.min(1, (wits - 11) / 8));
  const accurate = h01(`${seed}|tell|${discovery.owner}`) < reliability;
  const real = discovery.payoffClass;
  const read = accurate ? real : ['flavor', 'rumor', 'bond', 'dud', 'trap', 'lead'][h32(`${seed}|misread|${discovery.owner}`) % 6];
  const HINTS = {
    flavor: 'something unspoken behind their eyes', rumor: 'they know more than they say',
    bond: 'a loneliness they are trying to hide', dud: 'a guilt that gnaws at them',
    trap: 'a danger they would draw you into', lead: 'they are sitting on something of worth'
  };
  return `You sense ${HINTS[read] || 'something'}.${accurate ? '' : ''}`;
}

// state: { trust, topics:[], facts:[] }
export function depthMet(discovery, state = {}) {
  if (!discovery) return false;
  const g = discovery.gate, trust = Number(state.trust || 0);
  if (trust < g.trust) return false;
  if (g.topic && !(Array.isArray(state.topics) && state.topics.includes(g.topic)) && !(Array.isArray(state.facts) && state.facts.includes(g.topic))) return false;
  return true;
}

// resolve(discovery, state, { wits, seed }) -> { status:'hidden'|'hinted'|'revealed', tell?, beat?, reward? }
export function resolve(discovery, state = {}, opts = {}) {
  if (!discovery) return { status: 'hidden' };
  if (depthMet(discovery, state)) return { status: 'revealed', beat: discovery.reward.narrative, reward: discovery.reward, payoffClass: discovery.payoffClass };
  const tell = tellFor(discovery, opts.wits ?? 10, opts.seed || '');
  return tell ? { status: 'hinted', tell } : { status: 'hidden' };
}
