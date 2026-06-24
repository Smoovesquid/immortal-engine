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
  { persona: 'blacksmith', text: 'Tall, muscly blacksmith, fond of whistling, looking for someone who knows how to party. Come by the forge after dark and bring your steel. I will show you how I harden it. No talkers; doers only.' },
  { persona: 'widow', text: 'Widow with a big appetite and a bigger cellar seeks a strong stomach and a quiet disposition for evenings in. I do the cooking, you do as you are told. Bring a knife if you have a good one; mine have gone dull from love.' },
  { persona: 'gentleman', text: 'Gentleman of leisure, generous to a fault, seeks an enterprising sort who is not squeamish and never asks twice. There is good coin in it, and a warm bed after if you want one. Ask for the grey coat in the back room.' },
  { persona: 'admirer', text: 'I would walk through fire for one look from the right sort. Bring me close to them and I will make it more than worth your while. I have been told I am very, very giving.' },
  { persona: 'twins', text: 'Twins, identical, inseparable, seek a third who can keep up and keep quiet. Must love the dark and not mind sharing. We finish what we start and we always clean our plates. Come hungry.' },
  { persona: 'recruiter', text: 'Seeking nerve and a steady hand for one night of work that might turn into something longer. I ask only that you never tell your mother. Roses on arrival. Ask at the inn for the one who tips too well.' },
  { persona: 'hermit', text: 'Quiet sort, keeps to the marsh road, would dearly love company that does not flinch and does not linger past morning. I will feed you well. You will not want for anything. You will not want, after.' },
  { persona: 'bridge', text: 'Strong back wanted, references not required, discretion mandatory. Meet me where the old bridge crosses, at midnight, alone. Wear something you do not mind ruining.' },
];

// How a player names each ad's advertiser when they answer it (NP-3).
const PERSONA_MATCH = {
  blacksmith: /\b(?:blacksmith|smith|forge)\b/i,
  widow: /\bwidow\b/i,
  gentleman: /\b(?:gentleman|grey[\s-]?coat)\b/i,
  admirer: /\b(?:admirer|walk through fire)\b/i,
  twins: /\btwins?\b/i,
  recruiter: /\b(?:recruiter|night of work|tips too well)\b/i,
  hermit: /\b(?:hermit|marsh)\b/i,
  bridge: /\b(?:bridge|midnight)\b/i,
};

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
    const tpl = KK_ADS[idx];
    ads.push({ text: tpl.text, persona: tpl.persona, place, _kind: kind, _target: target });
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

/**
 * playerReputation(world) → { clause } | null
 * The player's most notable recent deed, phrased as the recognition clause a stranger who
 * has read the Word would use ("the one who put Ashblade beyond mischief"). NP-2 wires this
 * into the live greeting, so a deed in one town precedes you to the next. §0-safe (a deed is
 * symptom/event-level; never the cosmology).
 */
export function playerReputation(world) {
  const tl = Array.isArray(world?.timeline) ? world.timeline : [];
  for (let i = tl.length - 1; i >= 0; i--) {
    const e = tl[i];
    if (!e) continue;
    if (e.kind === 'resolution' && e.data && e.data.targetDefeated) {
      const nm = npcNameById(world, e.data.targetDefeated) || 'a bad sort';
      return { clause: `the one who put ${nm} beyond mischief` };
    }
    if (e.kind === 'goalCompleted' && e.data && e.data.kind === 'defeat') {
      const nm = npcNameById(world, e.data.targetRef) || 'one who needed the putting-down';
      return { clause: `the one who dealt with ${nm}` };
    }
    if (e.kind === 'goalCompleted') {
      return { clause: 'the one who keeps their word' };
    }
  }
  return null;
}

// NP-4 — the player asks to read the paper. Triggers on the named object or its sections,
// not on bare "the word" (too ambiguous).
const READ_RE = /\b(?:newspaper|news-?sheet|broadsheet|gazette|the\s+lasting\s+word|kasual\s+korner|the\s+classifieds|personal\s+ads)\b/i;
export function isNewspaperRead(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (!READ_RE.test(t)) return false;
  // a verb of getting/reading, OR a "is there a…" presence ask
  return /\b(?:read|find|pick\s+up|buy|grab|look\s+(?:at|for|through)|any|is\s+there|get\s+(?:a|the)|where('?s| is))\b/i.test(t);
}

/**
 * renderNewspaperForRead(np) → string. The in-fiction read — a player turning the pages.
 * The hidden _kind / _target never appear; the Kasual Korner reads as plain lonely-hearts.
 */
export function renderNewspaperForRead(np) {
  if (!np) return '';
  const m = np.masthead;
  const L = [];
  L.push(`You turn up a copy of The Lasting Word — the broadsheet set and kept, they say, at the Warren. "${m.tagline}." ${m.dateline}, No. ${m.edition}.`);
  L.push('');
  L.push('FROM THE ROADS. ' + np.fromTheRoads.join(' '));
  L.push('');
  L.push('THE FORGOTTEN. ' + np.theForgotten.join(' '));
  L.push('');
  L.push('THE KASUAL KORNER, for company of the warmer sort:');
  for (const ad of np.kasualKorner) L.push('  · ' + ad.text);
  return L.join('\n');
}

// ── NP-3 — answer a Kasual Korner ad; the engine flips its hidden card ──────────────────

const KK_ANSWER_VERB = /\b(?:answer|respond(?:\s+to)?|reply(?:\s+to)?|follow\s+up(?:\s+on)?|take\s+up|go\s+(?:and\s+)?(?:meet|see)|look\s+into|pursue|chase\s+up|inquire)\b/i;
const KK_REF = /\b(?:ad|advert|advertisement|personal|classified|kasual\s+korner|notice|listing|offer|the\s+paper|broadsheet|lasting\s+word)\b/i;

export function isKasualKornerAnswer(text) {
  const t = String(text || '');
  if (!t.trim() || !KK_ANSWER_VERB.test(t)) return false;
  // Must reference an ad / the paper — disambiguates from a plain approach to a present NPC
  // ("go meet the smith" stays an approach; "answer the smith's ad" is the Korner).
  return KK_REF.test(t);
}

/**
 * findKasualKornerAd(world, text) → ad | null. Matches the advertiser persona named in the
 * text to one of the current paper's Kasual Korner ads (deterministic — same paper). null when
 * no persona is named (the caller asks which one).
 */
export function findKasualKornerAd(world, text, opts = {}) {
  const t = String(text || '');
  const np = generateNewspaper(world, { seed: opts.seed, kkCount: opts.kkCount ?? 8 });
  for (const ad of np.kasualKorner) {
    const re = PERSONA_MATCH[ad.persona];
    if (re && re.test(t)) return ad;
  }
  return null;
}

function cap(s) { const x = String(s || ''); return x.charAt(0).toUpperCase() + x.slice(1); }

/**
 * resolveKasualKornerEncounter(world, ad) → { narration, mechanics }. The reveal: you showed
 * up, and the ad's HIDDEN kind becomes real. contract/both name the target so the player can
 * take the job via the normal quest-birth ("I'll deal with <target>", D-B1). trap springs a
 * fight; tryst is a tasteful, faded scene. §0-safe; words only (no state mutation here).
 */
export function resolveKasualKornerEncounter(world, ad) {
  if (!ad) return null;
  const who = cap(ad.persona);
  const targetName = ad._target ? (npcNameById(world, ad._target) || 'someone you have met') : null;
  let narration, tag;
  switch (ad._kind) {
    case 'contract':
      narration = `You answer the ${ad.persona}'s notice expecting a warm welcome. ${who} pours you a drink, takes your measure, and slides a name across the table instead of a hand: ${targetName}. "Romance is for people with time," they say. "I have coin, and a problem with a name. End it quietly, and there is more where this purse came from." It was never a tryst. It is a contract, and the work is yours if you will have it.`;
      tag = `[korner:contract | target:${ad._target}]`;
      break;
    case 'both':
      narration = `${who} has a name for you — ${targetName}, and a heavy purse for a quiet end of them — and, it becomes plain over the second drink, an appetite besides. "Business first," they murmur, "or pleasure. I am not particular, and I do so hate to choose." Both are on the table. So, it seems, are you.`;
      tag = `[korner:both | target:${ad._target}]`;
      break;
    case 'trap':
      narration = `You answer the ${ad.persona}'s notice. The door settles shut behind you a touch too smoothly, and ${who}'s smile never troubles the eyes. "No one knows you came," they observe, pleasantly, and what they reach for is not the wine. It is a trap, and it has already sprung.`;
      tag = `[korner:trap]`;
      break;
    case 'tryst':
    default:
      narration = `You answer the ${ad.persona}'s notice, and ${who} meant every word of it. What follows is warm, and a little strange, and entirely between the two of you — the kind of evening that does not go in a column. You leave near dawn, fed, unaccountably calm, and one secret heavier.`;
      tag = `[korner:tryst]`;
      break;
  }
  return { narration: `Wizard: ${narration}`, mechanics: `${tag} | no roll` };
}
