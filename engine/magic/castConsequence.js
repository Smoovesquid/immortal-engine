// P-80 — The world testifies: consequence for gratuitous magic.
//
// Cantrips are at-will by design (correct 5e). But an offensive working aimed
// OUT OF COMBAT at the innocent or the living world is a deed, and the world
// recoils from it (docs/MORALITY_SYSTEM.md — "the world's recoil, the attention
// of chaotic gods"; karma as real physics). The ladder (default = a SIGN read by
// the wise; escalation = the gods intervene):
//
//   child            → the One God's ward. Absolute. The working will not come.
//   living-world     → the place scars; the land's corruption rises (an omen).
//   person-innocent  → witnesses recoil (trust crashes); REPEAT harm draws the
//                      good gods' avengers; a DEDICATED kill engages the chaos
//                      gods — a deal with the devil (corruption spikes, and the
//                      existing dark-gift path in playerMove grants the pact).
//
// Rendering law (McCarthy): the world recoils at full craft — never a mechanical
// readout, never a power-high. The gods are felt through implication, not staged.
//
// Pure-ish: every mutation goes through applyDeltas / the canonical scar helper;
// all randomness is seeded. The chaos pact itself is GRANTED by the existing
// darkGiftForThreshold hook in playerMove — this module only drives the axis that
// crosses the threshold, so there is one author of dark gifts, not two.

import { makeRng, seedFromString } from '../rng.js';
import { applyDeltas } from '../effectsCore.js';
import { scarifyNode } from '../map/mapState.js';
import { selectCreatures, spawnEncounter } from '../combat/encounterSpawn.js';
import { biomeForNode } from '../world/biome.js';

// Mirrors DEED_SEV in playloop.js. HEAVY=20 is the calibrated weight a helpless-
// kill already carries — exactly the corruption (max vice axis) that crosses the
// first dark-gift threshold (20). A dedicated innocent-kill earns the same.
const SEV = { LIGHT: 5, MOD: 12, HEAVY: 20 };
// Repeat innocent-harm offenses before the good gods send avengers.
const AVENGER_THRESHOLD = 3;
// Tags the light cruelty deed logged for a petty innocent-blast, so it can be
// counted as the avenger trigger without being confused for an ordinary deed.
const GM_TAG = 'GM-blast:';

// Offensive workings: a magical verb OR a known attack cantrip/element, in an
// aggressive frame. Strict — a self-buff ("cast mage armor"), a light, or a heal
// must NOT read as an assault.
const OFFENSIVE_RE = /\b(blast|incinerate|immolate|scorch|burn|char|smite|electrocute|fry|torch|nuke|obliterate|hurl\s+(?:flame|fire|lightning)|fire\s*bolt|sacred\s+flame|produce\s+flame|firebolt|flame|fireball|lightning|shock|frost\s*ray|ray\s+of\s+frost|eldritch\s+blast|magic\s+missile|chill\s+touch)\b/i;
// Unambiguous casting verbs only. "hurl"/"throw"/"loose"/"sling" used to be
// here too, but they're ordinary physical-delivery verbs ("a loose roof beam",
// "throw a rock") with no magical payload of their own — OFFENSIVE_RE already
// covers the magical case explicitly ("hurl flame/fire/lightning"). Keeping
// the bare verbs here mis-tagged a beam-swing as a spell cast (Opus gate
// 2026-06-16, Chaos-griefer: "grab a loose roof beam and swing it").
const HOSTILE_CAST_RE = /\b(cast|invoke|channel|conjure)\b/i;
const BENIGN_RE = /\b(mage\s+armor|shield|light|heal|cure|mend|guidance|bless|protection|ward|detect|prestidigitation|dancing\s+lights|warm|dry|clean)\b/i;
// "torch" in OFFENSIVE_RE catches the verb ("torch the barn"). Article/possessive
// forms ("a torch", "the torch", "my torch") are physical objects, not spells.
const TORCH_AS_NOUN_RE = /\b(?:a|an|the|my|your|his|her|its|their|our|this|that|one)\s+torch\b/i;

// Children: the hard absolute exclusion (MORALITY_SYSTEM §1). Checked FIRST.
const CHILD_RE = /\b(child|children|kid|kids|baby|babe|babies|infant|toddler|boy|girl|youngling|little\s+(?:one|girl|boy))\b/i;
const PERSON_RE = /\b(villager|villagers|man|woman|men|women|person|people|folk|peasant|farmer|smith|miller|baker|priest|elder|old\s+(?:man|woman)|girl|boy|crowd|townsfolk|innocent|bystander|stranger|merchant|guard|maid)\b/i;
const LIVING_WORLD_RE = /\b(tree|trees|forest|wood|woods|grove|copse|orchard|bush|hedge|flower|flowers|field|fields|crop|crops|grass|meadow|garden|animal|dog|cat|horse|sheep|goat|cow|chicken|bird|birds|deer|rabbit|squirrel|hut|huts|house|houses|cottage|cottages|barn|hovel|home|homes|village|hamlet|thatch|roof|door|fence|cart|well|shrine|stall)\b/i;
const VOID_RE = /\b(air|sky|ground|floor|ceiling|wall|walls|dark|darkness|nothing|void|distance|horizon)\b/i;
// A DEDICATED kill: lethal/finishing intent (vs. a mere blast that lands). This
// is what "dedicate the death of an innocent" means — engages the chaos gods.
const LETHAL_RE = /\b(kill|murder|slay|execute|incinerate|immolate|sacrifice|dedicate|offer\s+up|reduce\s+.*\bto\s+ash|burn\s+(?:.*\b)?(?:to\s+(?:death|ash|ashes)|alive)|char\s+.*\bto\s+death|finish\s+(?:him|her|them|it)|end\s+(?:his|her|their)\s+life|cook\s+(?:him|her|them))\b/i;

/**
 * classifyOffensiveCast(world, text) -> { offensive, target, targetName, reason }
 * target ∈ 'child'|'person-innocent'|'living-world'|'void'|null. Pure/deterministic.
 */
export function classifyOffensiveCast(world, text) {
  const t = String(text || '').toLowerCase();

  const looksOffensive = OFFENSIVE_RE.test(t) || HOSTILE_CAST_RE.test(t);
  if (!looksOffensive || (BENIGN_RE.test(t) && !OFFENSIVE_RE.test(t))) {
    return { offensive: false, target: null, targetName: '', reason: 'not-offensive' };
  }
  // Narrow torch-noun exclusion: if the only OFFENSIVE_RE hit is "torch" used as
  // a physical noun (preceded by article/possessive) and no casting verb is present,
  // this is not a spell — let it pass as non-offensive.
  if (!HOSTILE_CAST_RE.test(t) && TORCH_AS_NOUN_RE.test(t) &&
      !OFFENSIVE_RE.test(t.replace(/\btorch\b/gi, ''))) {
    return { offensive: false, target: null, targetName: '', reason: 'torch-noun' };
  }
  if (CHILD_RE.test(t)) {
    return { offensive: true, target: 'child', targetName: (t.match(CHILD_RE) || [''])[0], reason: 'child-ward' };
  }
  const npc = matchPresentInnocent(world, t);
  if (npc) {
    return { offensive: true, target: 'person-innocent', targetName: String(npc.name || 'someone'), reason: 'present-npc' };
  }
  if (PERSON_RE.test(t)) {
    return { offensive: true, target: 'person-innocent', targetName: (t.match(PERSON_RE) || [''])[0], reason: 'person-word' };
  }
  if (LIVING_WORLD_RE.test(t)) {
    return { offensive: true, target: 'living-world', targetName: (t.match(LIVING_WORLD_RE) || [''])[0], reason: 'living-world-word' };
  }
  if (VOID_RE.test(t)) {
    return { offensive: true, target: 'void', targetName: (t.match(VOID_RE) || [''])[0], reason: 'into-the-void' };
  }
  return { offensive: true, target: 'void', targetName: '', reason: 'no-target' };
}

/**
 * castConsequence(world, text, classification) -> { world, narration, mechanics } | null
 *
 * Applies the consequence for a classified offensive out-of-combat working and
 * returns the world's recoil. Returns null to fall through to existing flavor
 * (non-offensive, or venting at the void). The caller gates on !combat.active.
 */
export function castConsequence(world, text, classification) {
  const cls = classification || classifyOffensiveCast(world, text);
  if (!cls.offensive || !cls.target || cls.target === 'void') return null;

  const rng = makeRng(seedFromString(`${world?.meta?.seed || ''}|castrecoil|${cls.target}|${world?.time?.turn ?? 0}|${world?.timeline?.length ?? 0}`));
  // A present NPC is named bare ("Mae"); a generic noun gets a definite article
  // ("the villager", "the trees") so the prose reads at full craft.
  const who = targetPhrase(cls);

  // ── The child ward (absolute; never a delta) ─────────────────────────────
  if (cls.target === 'child') {
    return {
      world,
      narration: pick(rng, [
        `Wizard: You shape the working — and it will not come. Something stays your hand the way a parent stays a child's, gentle and immovable. Not here. Not this.`,
        `Wizard: The word dies in your mouth. There is a ward over the small and the helpless that you cannot reach past, and you feel it close like a held breath. Not this.`,
      ]),
      mechanics: '[cast-consequence: child-ward | absolute]',
    };
  }

  // ── Living world: the place scars; the land's corruption rises (an omen) ─
  if (cls.target === 'living-world') {
    let w = world;
    const node = currentNode(world);
    if (node) w = scarifyNode(w, node.id, 'magic_scorch');
    const e = w.ecology || { corruption: 0, instability: 0, scarcity: 0 };
    w = { ...w, ecology: { ...e, corruption: clampInt((e.corruption || 0) + 2, 0, 100) } };
    return {
      world: w,
      narration: pick(rng, [
        `Wizard: Your fire finds ${who}, and what was whole goes to black and char. The smell hangs in still air, and the small life around you falls quiet, as if the place is holding its breath.`,
        `Wizard: Flame answers, and fire takes ${who}. Ash drifts down. Nothing here needed burning, and the land seems to know it — a wrongness settles where the green was.`,
      ]),
      mechanics: `[cast-consequence: living-world | ${cls.targetName || 'it'} | scorch+scar]`,
    };
  }

  // ── Person (innocent) ────────────────────────────────────────────────────
  const wit = witnessIds(world);
  const nodeId = String(world?.map?.currentNodeId || '');

  // A DEDICATED kill engages the chaos gods: corruption spikes (wrath to the
  // helpless-kill weight), which crosses the dark-gift threshold — and the
  // existing darkGiftForThreshold hook in playerMove grants the pact. We do NOT
  // grant the gift here; one author of dark gifts.
  if (LETHAL_RE.test(String(text || '').toLowerCase())) {
    const deltas = [
      { op: 'axisDelta', axis: 'wrath', by: SEV.HEAVY },
      { op: 'axisDelta', axis: 'gluttony', by: SEV.MOD },
      { op: 'recordDeed', deedKind: 'cruelty', severity: SEV.HEAVY, summary: String(text || '').slice(0, 200), nodeId, witnesses: wit, t: Array.isArray(world?.timeline) ? world.timeline.length : 0 },
      ...wit.map(id => ({ op: 'npcTrustDelta', npcId: id, by: -3 })),
    ];
    const w = applyDeltas(world, deltas);
    return {
      world: w,
      narration: pick(rng, [
        `Wizard: The fire takes ${who}, and it is done. The air itself seems to lean toward you — not in horror, but in interest. Something old and hungry has felt this, and turned its face your way.`,
        `Wizard: ${capFirst(who)} falls, burning, and the world does not look away. A cold attention settles over you like a hand on the shoulder. You have been noticed by something that collects the like of you.`,
      ]),
      mechanics: `[cast-consequence: person-innocent | DEDICATED-KILL | chaos-attention]`,
    };
  }

  // A non-lethal blast at the innocent: witnesses recoil (trust crashes), and a
  // light cruelty deed is logged (TAGGED, so it is the good-gods counter — kept
  // out of the corruption/pact axis, which is the chaos gods' separate domain).
  // Every AVENGER_THRESHOLD-th such deed, the just gods send avengers. The deeds
  // log persists across turns and ensureWorld (a meta counter would not).
  let w = applyDeltas(world, [
    { op: 'recordDeed', deedKind: 'cruelty', severity: SEV.LIGHT, summary: `${GM_TAG} ${String(text || '').slice(0, 180)}`, nodeId, witnesses: wit, t: Array.isArray(world?.timeline) ? world.timeline.length : 0 },
    ...wit.map(id => ({ op: 'npcTrustDelta', npcId: id, by: -2 })),
  ]);
  const harmCount = (w.deeds || []).filter(d => d && d.kind === 'cruelty' && String(d.summary || '').startsWith(GM_TAG)).length;

  if (harmCount > 0 && harmCount % AVENGER_THRESHOLD === 0) {
    const node = currentNode(w);
    const biome = node ? biomeForNode(w.meta.seed, node) : 'wilderness';
    const sRng = makeRng(seedFromString(`${w.meta.seed}|avengers|${w.time?.turn ?? 0}|${w.timeline?.length ?? 0}`));
    const creatures = selectCreatures(2, 1 + (harmCount > AVENGER_THRESHOLD ? 1 : 0), null, sRng, biome);
    w = spawnEncounter(w, creatures, { ambush: true, reason: 'divine-retribution' }, sRng);
    return {
      world: w,
      narration: pick(sRng, [
        `Wizard: You strike ${who} again, and this time the answer comes. The light changes; the air hardens. Out of it steps what the just gods send to those who will not stop — and it has come for you.`,
        `Wizard: ${capFirst(who)} reels from the fire — and the reckoning arrives. The patient gods have watched you spend the innocent like coin, and they have sent the bill. To arms.`,
      ]),
      mechanics: `[cast-consequence: person-innocent | ${who} | divine-retribution]`,
    };
  }

  return {
    world: w,
    narration: pick(rng, [
      `Wizard: The fire leaps where you send it, and ${who} flinches back with a cry. The air goes wrong around you — somewhere a bird stops singing, and you feel, for a moment, watched.`,
      `Wizard: You loose the working at ${who}, who throws up an arm and stumbles. The street stills. Faces turn. The world has noted what you are, and it does not forget.`,
    ]),
    mechanics: `[cast-consequence: person-innocent | ${who} | recoil]`,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────

// A present NPC keeps its name ("Mae the Villager"); a generic matched noun gets
// a definite article ("the villager", "the trees") so no line reads "and villager
// flinches". Number-agnostic: callers avoid conjugating a verb off this phrase.
function targetPhrase(cls) {
  const name = String(cls?.targetName || '').trim();
  if (!name) return 'it';
  if (cls?.reason === 'present-npc') return name;
  return /^(the|a|an)\s/i.test(name) ? name : `the ${name}`;
}
function currentNode(world) {
  const map = world?.map;
  return (map?.nodes || []).find(n => n && n.id === map?.currentNodeId) || null;
}
function witnessIds(world) {
  const node = currentNode(world);
  return (node?.settlement?.npcs || []).filter(n => n && !n.hostile).map(n => String(n.id)).filter(Boolean).slice(0, 8);
}
function matchPresentInnocent(world, lowerText) {
  const node = currentNode(world);
  const npcs = (node?.settlement?.npcs || []).filter(n => n && !n.hostile);
  for (const n of npcs) {
    const nm = String(n.name || '').toLowerCase();
    if (!nm) continue;
    const first = nm.split(/\s+/)[0] || '';
    if (lowerText.includes(nm) || (first.length >= 3 && new RegExp(`\\b${escapeRe(first)}\\b`).test(lowerText))) return n;
  }
  return null;
}
function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function toInt(x) { const n = Math.trunc(Number(x)); return Number.isFinite(n) ? n : 0; }
function clampInt(n, lo, hi) { return Math.max(lo, Math.min(hi, Math.trunc(Number(n) || 0))); }
function capFirst(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
function pick(rng, arr) { return arr[Math.floor(rng.nextFloat() * arr.length)] || arr[0]; }
