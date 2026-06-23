// engine/newspaper/lastingWord.js
//
// "The Lasting Word" — the cannibal-published newspaper (IG-14). A PURE, deterministic,
// §0-safe SURFACE over world state. It renders three things from what the world already
// knows:
//   · From the Roads — your DEEDS become news (the reputation-travels surface; a stranger
//     greets you because they read about you).
//   · The Forgotten  — the §3 fade, recorded by the only faction that refuses to forget.
//   · The Kasual Korner — personal ads that are INDISTINGUISHABLE from coded contracts. The
//     kind (a tryst, a kill, a trap, or both) is HIDDEN engine metadata, never legible in
//     the words. You learn what an ad truly is only by acting on it and showing up.
//
// No rng, no mutation, no LLM: a hashed projection like engine/world/biome.js — so it never
// touches worldHash and replays identically. Garbling-on-distance (NP-4) and the live
// read/decode encounter (NP-3) ride on top later. §0: the cannibals are as blind to the
// cosmology as everyone; the paper trades only in the WHAT (deeds, deaths, the fading),
// never the why.

// Hidden ad kinds — engine-internal, NEVER rendered to the player.
export const AD_KINDS = ['tryst', 'contract', 'trap', 'both'];

// FNV-1a, like engine/world/biome.js — deterministic, no rng.
function h32(s) {
  let h = 2166136261 >>> 0;
  const t = String(s);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const pickIdx = (len, key) => (len ? h32(key) % len : 0);

// The Kasual Korner ad bank — charming, horny, weird PERSONALS. The craft (Tim, 2026-06-23):
// each reads as a genuine lonely-heart with NO murder tell, so a tryst and a contract are
// indistinguishable on the page. The cannibal undertone (appetite, plates, "you won't want
// after") is kink and food, never explicit. The advertiser invites; the target (if any) is
// hidden metadata, revealed only when you arrive. The hidden kind is assigned separately, so
// the SAME ad can be a hookup in one printing and a killing in another.
const KK_ADS = [
  'Tall, muscly blacksmith, fond of whistling, looking for someone who knows how to party. Come by the forge after dark and bring your steel. I will show you how I harden it. No talkers; doers only.',
  'Widow with a big appetite and a bigger cellar seeks a strong stomach and a quiet disposition for evenings in. I do the cooking, you do as you are told. Bring a knife if you have a good one; mine have gone dull from love.',
  'Gentleman of leisure, generous to a fault, seeks an enterprising sort who is not squeamish and never asks twice. There is good coin in it, and a warm bed after if you want one. Ask for the grey coat in the back room.',
  'I would walk through fire for one look from the right sort. Bring me close to them and I will make it more than worth your while. I have been told I am very, very giving.',
  'Twins, identical, inseparable, seek a third who can keep up and keep quiet. Must love the dark and not mind sharing. We finish what we start and we always clean our plates. Come hungry.',
  'Seeking nerve and a steady hand for one night of work that might turn into something longer. I ask only that you never tell your mother. Roses on arrival. Ask at the inn for the one who tips too well.',
  'Quiet sort, keeps to the marsh road, would dearly love company that does not flinch and does not linger past morning. I will feed you well. You will not want for anything. You will not want, after.',
  'Strong back wanted, references not required, discretion mandatory. Meet me where the old bridge crosses, at midnight, alone. Wear something you do not mind ruining.',
];

// The Forgotten — §3 atmosphere, §0-safe. Real faded NPCs wire in at NP-5 (the faction lane).
const FORGOTTEN_LINES = [
  'Old Merrow, ferryman, who in his last week could no longer name the river he had kept for forty years, and grew gentle about it.',
  'The widow Ash, whose own children mislaid her name by the second mourning, and were ashamed, and then forgot the shame.',
  'A child of the frontier, left unnamed here, for no one living recalls it; we keep the empty space regardless.',
  'The man who kept the east beacon, whose face the road has already begun to smooth away.',
];

function allNpcs(world) {
  const out = [];
  for (const n of (world?.map?.nodes || [])) for (const p of (n?.settlement?.npcs || [])) if (p) out.push(p);
  return out;
}
function npcNameById(world, ref) {
  const r = String(ref || '');
  for (const p of allNpcs(world)) if (String(p.id) === r) return p.name || null;
  return null;
}

function buildMasthead(world, seed) {
  return {
    title: 'The Lasting Word',
    tagline: 'Of the Warren — kept against forgetting',
    edition: 300 + (h32(`${seed}|edition`) % 90),
    dateline: `Year ${2040 + (h32(`${seed}|year`) % 6)} of the Long Forgetting`,
    turn: world?.time?.turn ?? (Array.isArray(world?.timeline) ? world.timeline.length : 0),
  };
}

// From the Roads — the reputation surface: the player's deeds, freshest first, become news.
function buildNews(world) {
  const tl = Array.isArray(world?.timeline) ? world.timeline : [];
  const items = [];
  for (let i = tl.length - 1; i >= 0 && items.length < 3; i--) {
    const e = tl[i];
    if (!e) continue;
    if (e.kind === 'resolution' && e.data && e.data.targetDefeated) {
      const nm = npcNameById(world, e.data.targetDefeated) || 'a troublesome sort';
      items.push(`A stranger has lately put ${nm} beyond further mischief, and the roads are the duller for it. We have made a note of them.`);
    } else if (e.kind === 'goalCompleted' && e.data && e.data.kind === 'defeat') {
      const nm = npcNameById(world, e.data.targetRef) || 'one who needed the putting-down';
      items.push(`Word reaches us that ${nm} troubles the valley no longer. The hand that did it asked after nothing for itself; we find that curious, and promising.`);
    } else if (e.kind === 'goalCompleted') {
      items.push('A promise made in one of the towns has lately been kept, which is rare enough that we print it. We are watching the one who keeps their word.');
    }
  }
  if (!items.length) items.push('The roads are quiet this turning, which is its own kind of news. Quiet does not last here. It never has.');
  return items;
}

function buildForgotten(world, seed) {
  const a = FORGOTTEN_LINES[pickIdx(FORGOTTEN_LINES.length, `${seed}|forgotten|0`)];
  let b = FORGOTTEN_LINES[pickIdx(FORGOTTEN_LINES.length, `${seed}|forgotten|1`)];
  if (b === a) b = FORGOTTEN_LINES[(FORGOTTEN_LINES.indexOf(a) + 1) % FORGOTTEN_LINES.length];
  return [a, b].filter(Boolean);
}

// The Kasual Korner — N personal ads, each with a HIDDEN kind (and, for a contract/both, a
// hidden target) the page never reveals. Deterministic: same (world, seed) → same column.
function buildKasualKorner(world, seed, count) {
  const nodeIds = (world?.map?.nodes || []).map(n => n && n.id).filter(Boolean);
  const sociable = allNpcs(world).filter(n => !n.hostile);
  const ads = [];
  const usedAd = new Set();
  for (let i = 0; i < count; i++) {
    let idx = pickIdx(KK_ADS.length, `${seed}|kk|ad|${i}`);
    let guard = 0;
    while (usedAd.has(idx) && guard++ < KK_ADS.length) idx = (idx + 1) % KK_ADS.length;
    usedAd.add(idx);
    const kind = AD_KINDS[pickIdx(AD_KINDS.length, `${seed}|kk|kind|${i}`)];
    const place = nodeIds.length ? nodeIds[pickIdx(nodeIds.length, `${seed}|kk|place|${i}`)] : null;
    const wantsTarget = (kind === 'contract' || kind === 'both');
    const target = (wantsTarget && sociable.length)
      ? String(sociable[pickIdx(sociable.length, `${seed}|kk|target|${i}`)].id)
      : null;
    // _kind / _target are HIDDEN — the resolver (NP-3) reads them; the player never sees them.
    ads.push({ text: KK_ADS[idx], place, _kind: kind, _target: target });
  }
  return ads;
}

/**
 * generateNewspaper(world, { seed?, kkCount? }) → { masthead, fromTheRoads, theForgotten, kasualKorner }
 * Pure + deterministic. The kasualKorner entries carry hidden `_kind` / `_target` metadata
 * that is NEVER rendered to the player (see renderNewspaperText).
 */
export function generateNewspaper(world, opts = {}) {
  const seed = String(opts.seed ?? world?.meta?.seed ?? 'word');
  return {
    masthead: buildMasthead(world, seed),
    fromTheRoads: buildNews(world),
    theForgotten: buildForgotten(world, seed),
    kasualKorner: buildKasualKorner(world, seed, Number.isFinite(opts.kkCount) ? opts.kkCount : 4),
  };
}

/**
 * renderNewspaperText(np) → string. A plain-text printing (what a crier reads, or a probe
 * shows). The hidden _kind / _target are NEVER printed — the page is indistinguishable, and
 * a player learns an ad's truth only by acting on it.
 */
export function renderNewspaperText(np) {
  if (!np) return '';
  const L = [];
  L.push(`================  THE LASTING WORD  ================`);
  L.push(`${np.masthead.tagline}`);
  L.push(`${np.masthead.dateline}  ·  No. ${np.masthead.edition}`);
  L.push('');
  L.push('---- From the Roads ----');
  for (const it of np.fromTheRoads) L.push(it);
  L.push('');
  L.push('---- The Forgotten ----');
  for (const it of np.theForgotten) L.push(it);
  L.push('');
  L.push('---- The Kasual Korner ----');
  for (const ad of np.kasualKorner) L.push('  · ' + ad.text);
  return L.join('\n');
}
