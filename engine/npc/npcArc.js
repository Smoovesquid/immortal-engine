/**
 * NPC arcs — turning denizens into people with stories.
 *
 * Every NPC has a WANT — usually a small, mundane one (a harvest that holds, a
 * quiet night, to be left in peace). That's the surface you read after a word or
 * two. A rare few also carry a DEEPER thread from the Discovery Layer — a bond, a
 * guarded lead, a trap, a squalid secret — revealed only through earned trust and
 * the right questions, with an unreliable tell for the perceptive. When the thread
 * is a bond and the trust is real, they may walk beside you.
 *
 * Sits on engine/discovery + the existing npc tech (conversationState/trust/topics).
 * PURE + DETERMINISTIC.
 */

import { discoveryFor, resolve as resolveDiscovery } from '../discovery/discovery.js';

const h32 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = (arr, k) => arr[h32(k) % arr.length];

const ROLE_WANTS = [
  [/guard|veteran|soldier|enforcer|watch|sentinel/, ['to serve out the watch and go home', 'a quiet posting for once', 'to forget a battle']],
  [/heal|medic|herb|apothec/, ['herbs the market never stocks', 'to save someone past saving', 'an apprentice worth the teaching']],
  [/farm|herd|shepherd/, ['a harvest that holds', 'rain in the right week', 'the children to stay on the land']],
  [/tavern|taproom|inn|keeper|barkeep|brewer/, ['a quiet night for once', 'to pay off the brewer', 'news from the road']],
  [/merchant|trader|represent|peddl/, ['a caravan that arrives whole', 'a debt repaid', 'a rival undone']],
  [/scaveng|thief|bandit|smuggl|cutpurse/, ['one score that sets them free', 'to not be caught', 'a way out of the trade']],
  [/prison|captive/, ['out', 'to clear their name', 'word sent to family']],
  [/mediat|elder|reeve/, ['peace to hold one more season', 'to not have to choose a side']],
  [/priest|cleric|monk|acolyte|faith/, ['a sign', 'to hold a wavering flock', 'penance for an old sin']],
  [/smith|mason|wright|crafts/, ['ore that does not crack', 'an apprentice', 'a commission worthy of the craft']]
];
const DEFAULT_WANTS = ['to get through the week', 'a little luck', 'to be left in peace', 'a fair price'];

const DEEPER = {
  bond: 'someone to trust again', lead: 'to keep a dangerous thing buried — or sell it dear',
  trap: 'to turn a stranger to their own ends', dud: 'to be rid of a private, pointless shame',
  rumor: 'to be believed, just once', flavor: null
};

export function npcWant(npc, seed = '') {
  const role = String(npc && npc.role || '').toLowerCase();
  const id = String(npc && npc.id || npc || '');
  let pool = DEFAULT_WANTS;
  for (const [re, p] of ROLE_WANTS) if (re.test(role)) { pool = p; break; }
  const surface = pick(pool, `${seed}|want|${id}`);
  const d = discoveryFor(id, seed);
  return { surface, deeper: d ? DEEPER[d.payoffClass] || null : null };
}

export function npcArc(npc, seed = '') {
  const id = String(npc && npc.id || npc || '');
  const discovery = discoveryFor(id, seed);
  return { id, discovery, want: npcWant(npc, seed), recruitable: !!discovery && discovery.payoffClass === 'bond' };
}

// resolveArc(npc, seed, { wits }) -> what the player currently knows of this person.
// Uses the NPC's own conversationState (trust/topics) as the depth signal.
export function resolveArc(npc, seed = '', opts = {}) {
  const cs = (npc && npc.conversationState) || {};
  const met = !!cs.metPlayer;
  const want = npcWant(npc, seed);
  const discovery = discoveryFor(String(npc && npc.id || npc || ''), seed);
  const base = { met, surfaceWant: met ? want.surface : null, status: 'none', deeperWant: null, beat: null, tell: null, recruitable: false, recruitOffer: false };
  if (!discovery) return base;

  const r = resolveDiscovery(discovery, { trust: Number(cs.trustLevel || 0), topics: cs.topicsDiscussed || [], facts: cs.facts || [] }, { wits: opts.wits ?? 10, seed });
  const recruitable = discovery.payoffClass === 'bond';
  if (r.status === 'revealed') return { ...base, status: 'revealed', deeperWant: want.deeper, beat: r.beat, reward: r.reward, payoffClass: discovery.payoffClass, recruitable, recruitOffer: recruitable };
  if (r.status === 'hinted') return { ...base, status: 'hinted', tell: r.tell, recruitable };
  return { ...base, status: 'hidden', recruitable };
}
