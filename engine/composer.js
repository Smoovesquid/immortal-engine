import { makeRng, seedFromString } from './rng.js';
import { fateBand } from './rulesets.js';

export function computeWorldBias(world) {
  const w = world && typeof world === 'object' ? world : {};
  const scars = Array.isArray(w.scars) ? w.scars : [];
  const map = w.map && typeof w.map === 'object' ? w.map : null;
  const here = map?.nodes?.find?.(n => n.id === map.currentNodeId);
  const placeScars = Array.isArray(here?.scars) ? here.scars : [];

  const corruption = clampInt(w.ecology?.corruption ?? 0, 0, 100);
  const scarcity = clampInt(w.ecology?.scarcity ?? 0, 0, 100);
  const instability = clampInt(w.ecology?.instability ?? 0, 0, 100);
  const ecoSeverity = clampInt(Math.floor((corruption + scarcity + instability) / 90), 0, 3); // 0..3

  const factions = Array.isArray(w.factions) ? w.factions : [];
  const war = factions.some(f => (f.hostility ?? 0) >= 85) || scars.some(s => String(s?.id) === 'war_state');

  const scarWeight = clampInt(scars.length + placeScars.length, 0, 12);

  return { scarWeight, ecoSeverity, war };
}

// Deterministic Drama Composer (offline).
// Input: (world, playerText, resolution, context)
// resolution includes: kind, success/fail, roll, dc, updateKind, refKind, carry, etc.
// Output discipline:
// - EXACTLY one narration sentence.
// - EXACTLY one mechanics bracket line (string, may be empty inside brackets).
// It may return ledgerDelta for playloop to apply (e.g., motif memory updates).

export function compose(world, playerText, resolution, context = {}) {
  const w = world;
  const pack = context.pack || {};
  const band = fateBand(w.meta.fate);
  const turnIndex = Number.isFinite(resolution?.t) ? resolution.t : (w.timeline?.length ?? 0);

  const seed = seedFromString([
    w.meta.seed,
    w.scene.promptSeed,
    String(turnIndex),
    String(resolution?.kind ?? 'turn'),
    String(playerText ?? ''),
    String(resolution?.roll ?? ''),
    String(resolution?.updateKind ?? ''),
    String(w.scene.location ?? ''),
    String(w.scene.objective ?? '')
  ].join('|'));
  const rng = makeRng(seed);

  const clocks = w.clocks || { pressure: 0, dread: 0, revelation: 0 };
  const bias = computeWorldBias(w);
  const tone = pickTone(band, clocks, pack, rng, bias, { prev: w.scene?.lastToneWord || '' });

  const motifPick = pickMotifWithMemory(w, pack, rng, { prev: w.scene?.lastMotif || '' });
  const motifPhrase = mutateMotif(motifPick, rng);

  const clockShade = clockShadePhrase(clocks, rng, bias);
  const stakes = stakesPhrase(band, clocks, resolution, rng);

  const sceneThread = String(w.scene?.thread || '').trim();
  const threadClause = sceneThread ? `; thread: ${sceneThread}` : '';

  const loc = w.scene?.location || 'somewhere';
  const obj = w.scene?.objective || 'survive';

  const npcPhrase = buildNpcPhrase(w, rng);
  const stressPhrase = buildStressPhrase(w);
  const approachPhrase = buildApproachPhrase(resolution, rng);

  const narrationLine = ensureOneSentence(buildNarration({
    band,
    tone,
    motifPhrase,
    clockShade,
    stakes,
    loc,
    obj,
    playerText,
    resolution,
    threadClause,
    npcPhrase,
    stressPhrase,
    approachPhrase
  }));

  const mechanicsLine = bracketLine(buildMechanics({ band, resolution, clocks }));

  const ledgerDelta = {
    motifs: {
      addRecent: motifPick
    },
    sceneMemory: {
      lastMotif: motifPick,
      lastToneWord: tone
    }
  };

  return { narrationLine, mechanicsLine, ledgerDelta };
}

function pickTone(band, clocks, pack, rng, bias, { prev }) {
  const pool = tonePool(band, clocks, pack, bias);
  let t = rng.pick(pool) || pool[0] || 'steady';
  if (prev && t === prev && pool.length > 1) {
    const idx = pool.indexOf(t);
    t = pool[(idx + 1) % pool.length];
  }
  return t;
}

export function tonePool(band, clocks, pack, bias = null) {
  const base = band === 'cooperative'
    ? ['hopeful', 'bright', 'clean', 'inviting', 'open']
    : band === 'grim'
    ? ['tense', 'cold', 'careful', 'tight', 'uneasy']
    : ['pitiless', 'raw', 'brutal', 'black', 'merciless'];

  const extra = [];
  if ((clocks.pressure ?? 0) > 0) extra.push('pressing', 'short-breathed');
  if ((clocks.dread ?? 0) > 0) extra.push('watching', 'hollow');
  if ((clocks.revelation ?? 0) > 0) extra.push('unmasked', 'truth-stained');

  // Bite 6 — scar-weighted myth pressure (lexicon switches)
  const b = bias && typeof bias === 'object' ? bias : { scarWeight: 0, ecoSeverity: 0, war: false };
  if ((b.scarWeight ?? 0) >= 2) extra.push('scar-shadowed', 'stained');
  if ((b.scarWeight ?? 0) >= 5) extra.push('ashen', 'blighted');
  if ((b.ecoSeverity ?? 0) >= 1) extra.push('soured');
  if ((b.ecoSeverity ?? 0) >= 2) extra.push('withered');
  if (b.war) extra.push('martial', 'besieged');

  const packWords = pack?.toneWords?.[band];
  if (Array.isArray(packWords)) extra.push(...packWords.slice(0, 3));

  return dedupe([...base, ...extra]).filter(Boolean);
}

function pickMotifWithMemory(world, pack, rng, { prev }) {
  const pinned = world.meta?.motifs?.pinned || [];
  const recent = world.meta?.motifs?.recent || [];
  const packMotifs = Array.isArray(pack?.sensoryMotifs) ? pack.sensoryMotifs : [];

  // Prefer pinned, then recent, then pack.
  const pool = [
    ...pinned,
    ...recent,
    ...packMotifs
  ].map(String).map(s => s.trim()).filter(Boolean);

  const safe = pool.length ? dedupe(pool) : ['a low hum threads through the walls'];
  let m = rng.pick(safe) || safe[0];
  if (prev && m === prev && safe.length > 1) {
    const idx = safe.indexOf(m);
    m = safe[(idx + 1) % safe.length];
  }
  return m;
}

function mutateMotif(motif, rng) {
  const m = String(motif || '').trim();
  if (!m) return 'a low hum threads through the walls';
  const variants = [
    (x) => x,
    (x) => `the echo of ${x}`,
    (x) => `${x}, again`,
    (x) => `a trace of ${x}`
  ];
  const fn = variants[rng.int(0, variants.length - 1)] || variants[0];
  return fn(m);
}

function clockShadePhrase(clocks, rng, bias = null) {
  const p = clocks.pressure ?? 0;
  const d = clocks.dread ?? 0;
  const r = clocks.revelation ?? 0;
  const sum = p + d + r;
  const b = bias && typeof bias === 'object' ? bias : { scarWeight: 0, ecoSeverity: 0, war: false };
  if (sum <= 0 && (b.scarWeight ?? 0) <= 0 && (b.ecoSeverity ?? 0) <= 0 && !b.war) return '';

  const pool = sum <= 3
    ? ['the air tightens a notch', 'time feels slightly thinner']
    : sum <= 7
    ? ['shadows deepen at the edges', 'your breath sounds too loud']
    : sum <= 12
    ? ['the dark has weight and it leans in', 'every sound feels like evidence']
    : ['the world feels hostile and personal', 'something wants you to fail'];

  const scarPool = [];
  if ((b.scarWeight ?? 0) >= 2) scarPool.push('old scars itch in the stone', 'history feels present');
  if ((b.ecoSeverity ?? 0) >= 2) scarPool.push('the place feels thinned and wrong', 'the air tastes like ash');
  if (b.war) scarPool.push('distant conflict sets the rhythm', 'every silence feels like an ambush');

  const use = dedupe([...pool, ...scarPool]);
  return rng.pick(use) || use[0];
}

function stakesPhrase(band, clocks, resolution, rng) {
  const success = Boolean(resolution?.success);
  const update = String(resolution?.updateKind || '');

  if (success) {
    const pool = band === 'cooperative'
      ? ['an opening presents itself', 'the path looks kinder than expected']
      : band === 'grim'
      ? ['you gain ground, but it costs attention', 'progress comes with a trade-off']
      : ['you take ground and pay for it', 'victory comes sharp and expensive'];
    return rng.pick(pool) || pool[0];
  }

  const pressure = clocks.pressure ?? 0;
  const harsh = pressure >= 6 || (clocks.dread ?? 0) >= 4;

  const pool = band === 'cooperative'
    ? ['a manageable complication follows', 'you lose time, not hope']
    : band === 'grim'
    ? ['a hard consequence lands', 'the situation tightens']
    : harsh
    ? ['a severe consequence bites', 'you bleed leverage immediately']
    : ['consequence arrives', 'something breaks loose'];

  // Let update kind color phrasing deterministically.
  if (update === 'clock') return (band === 'cooperative') ? 'the clock ticks louder' : 'the clock ticks with teeth';
  if (update === 'threat') return (band === 'cooperative') ? 'a new risk steps in' : 'a threat sharpens';
  return rng.pick(pool) || pool[0];
}

function buildNarration({ band, tone, motifPhrase, clockShade, stakes, loc, obj, resolution, threadClause, npcPhrase, stressPhrase, approachPhrase }) {
  const kind = String(resolution?.kind || 'turn');
  const stressClause = stressPhrase ? `; ${stressPhrase}` : '';

  if (kind === 'blocked') {
    const reason = String(resolution?.reason || 'that conflicts with canon');
    return `Wizard: No—${reason}; stay in the ${loc} with ${tone} care as ${motifPhrase} returns${clockShade ? `, ${clockShade}` : ''}${stressClause}${threadClause}; objective remains: ${obj}; what do you do?`;
  }

  if (kind === 'scene' || kind === 'begin') {
    const carry = resolution?.carry?.text ? ` Carrying forward: ${String(resolution.carry.text)}.` : '';
    const omen = resolution?.omen ? ` Omen: ${String(resolution.omen)}.` : '';
    const price = resolution?.price ? ` Price: ${String(resolution.price)}.` : '';
    // Single sentence, so keep carry/omen/price as clauses.
    const clause = [carry.trim(), omen.trim(), price.trim()].filter(Boolean).join(' ');
    const npcClause = npcPhrase ? `; ${npcPhrase}` : '';
    return `Wizard: At the ${loc}, ${tone} and alert, you notice ${motifPhrase}${clockShade ? `; ${clockShade}` : ''}${npcClause}${stressClause}${threadClause}; ${clause ? clause + ' ' : ''}objective: ${obj}; what do you do?`;
  }

  // turn
  const success = Boolean(resolution?.success);
  const hit = success ? (band === 'cooperative' ? 'it lands clean' : band === 'grim' ? 'it works, narrowly' : 'it works, brutally')
    : (band === 'cooperative' ? 'it doesn’t land, but you learn' : band === 'grim' ? 'it fails and you pay' : 'it fails and the world collects');

  const approachClause = approachPhrase ? `, ${approachPhrase}` : '';

  return `Wizard: In the ${loc}, ${motifPhrase} threads through your move—${hit}${approachClause}; ${stakes}${clockShade ? `; ${clockShade}` : ''}${stressClause}${threadClause}; what do you do?`;
}

// Approach-keyed phrase banks. Each entry is a short, lowercase clause the
// composer drops into the turn narration. Kept offline and deterministic —
// picks come from the composer rng. Gated on a known approach key so older
// tests (and kind='begin'/'scene'/'blocked') pass through untouched.
const APPROACH_LEXICON = {
  force: {
    success: ['bone and leverage win the argument', 'the world yields with a crack', 'brute momentum carries you', 'iron first, question later'],
    mixed: ['you shove through and leave prints', 'the hinge groans but gives', 'momentum costs its tax'],
    failure: ['your shoulder finds a wall that doesn’t move', 'force bleeds out against stone', 'you overcommit and pay']
  },
  finesse: {
    success: ['a quiet hand, a quiet door', 'precision without witnesses', 'slipped in like breath'],
    mixed: ['careful, but not quite careful enough', 'the edge of a sound — no more', 'a hair out of line'],
    failure: ['the lockwork argues back', 'a feather’s-weight miss', 'the thread snaps clean']
  },
  endure: {
    success: ['teeth set, knees locked, you hold', 'you outlast the moment', 'nothing breaks that matters'],
    mixed: ['you take the hit and keep your feet', 'the line bends, does not snap', 'you eat it and walk on'],
    failure: ['endurance has a bottom, and you find it', 'the body runs out before the will', 'even granite splits eventually']
  },
  heart: {
    success: ['warmth finds a foothold', 'a look passes between you and something softens', 'plain words reach the listening part'],
    mixed: ['the connection flickers, half-made', 'a careful kindness, half-returned', 'the ice thins without breaking'],
    failure: ['the door closes behind the eyes', 'trust frays faster than you can speak', 'you reach, and nothing reaches back']
  },
  focus: {
    success: ['the pattern unknots in your head', 'clarity drops into place', 'you read the room and the room answers'],
    mixed: ['you see most of it, not all', 'the shape half-resolves', 'insight arrives late, but arrives'],
    failure: ['the pattern stays stubborn', 'you stare and the meaning slips', 'the picture refuses to come']
  }
};

function buildApproachPhrase(resolution, rng) {
  const approach = String(resolution?.approach || '');
  if (!APPROACH_LEXICON[approach]) return '';
  const outcome = String(resolution?.outcome || (resolution?.success ? 'success' : 'failure'));
  const bank = APPROACH_LEXICON[approach][outcome];
  if (!Array.isArray(bank) || !bank.length) return '';
  return String(rng.pick(bank) || bank[0]);
}

function buildNpcPhrase(world, rng) {
  const map = world?.map && typeof world.map === 'object' ? world.map : null;
  const here = map?.nodes?.find?.(n => n.id === map.currentNodeId);
  const npcs = Array.isArray(here?.settlement?.npcs) ? here.settlement.npcs : [];
  if (!npcs.length) return '';

  // Pick up to two named NPCs deterministically (RNG seeded from the same compose seed).
  const named = npcs
    .map(n => ({ name: String(n?.name || '').trim(), role: String(n?.role || '').trim() }))
    .filter(n => n.name);
  if (!named.length) return '';

  const i1 = rng.int(0, named.length - 1);
  const a = named[i1];
  if (named.length === 1) {
    return a.role
      ? `${a.name} the ${a.role} is nearby`
      : `${a.name} is nearby`;
  }
  let i2 = rng.int(0, named.length - 1);
  if (i2 === i1) i2 = (i1 + 1) % named.length;
  const b = named[i2];
  return `${a.name} and ${b.name} move within sight`;
}

function buildStressPhrase(world) {
  const player = Array.isArray(world?.party) ? world.party[0] : null;
  const stress = clampInt(player?.stress ?? 0, 0, 6);
  if (stress <= 0) return '';
  if (stress <= 1) return 'a thread of strain runs under your breath';
  if (stress <= 3) return 'strain coils tight in your shoulders';
  if (stress <= 5) return 'your nerves are loud and ragged';
  return 'you are stretched to the breaking point';
}

function buildMechanics({ resolution, clocks }) {
  const kind = String(resolution?.kind || 'turn');
  if (kind === 'begin' || kind === 'scene') {
    const tags = Array.isArray(resolution?.tags) ? resolution.tags.join(',') : '';
    const th = resolution?.thread ? String(resolution.thread) : '';
    return `scene:${String(resolution.location || '')} | objective:${String(resolution.objective || '')} | ref:${String(resolution.refKind || '')} | tags:${tags} | thread:${th}`.trim();
  }
  if (kind === 'blocked') {
    const alts = Array.isArray(resolution?.alternatives) ? resolution.alternatives : [];
    return alts.length ? `blocked: ${alts.join(' | ')}` : 'blocked';
  }
  // turn
  const roll = resolution?.roll ?? '';
  const dc = resolution?.dc ?? '';
  const ok = resolution?.success ? 'success' : 'failure';
  const upd = String(resolution?.updateKind || '');
  return `roll:${roll} vs DC:${dc} → ${ok} | update:${upd} | clocks:p${clocks.pressure}/d${clocks.dread}/r${clocks.revelation}`;
}

function bracketLine(inner) {
  const x = String(inner ?? '').replace(/[\n\r]+/g, ' ').trim();
  return `[${x}]`;
}

function ensureOneSentence(s) {
  const x = String(s ?? '').replace(/\s+/g, ' ').trim();
  // Keep first terminal punctuation; ensure ends with ?
  const m = x.match(/^(.+?[\?\.!])\s+(.*)$/);
  const first = m ? m[1] : x;
  // Prefer question mark ending for wizard prompt.
  if (!/[\?\.!]$/.test(first)) return first + '?';
  return first;
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function dedupe(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const s = String(x).trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}
