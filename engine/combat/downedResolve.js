/**
 * DEATH-2 — the beg and the four verbs: mercy becomes possible, and it counts.
 *
 * THE DEATH CONTRACT (docs/DEATH_CONTRACT.md §3): once a communicator lies DOWNED
 * (DEATH-1's dying state), it MAY beg — for life or for a quick death — and the
 * player answers with one of four verbs (mercy · worse · spare · walk away). Each
 * verb is a real, witnessed DEED routed through the LANDED moral organs — this
 * module invents no consequence machinery; it WIRES the verbs into recordDeed
 * (the single moral chokepoint), the death-fact atom (DEATH-1), and the rumor sink
 * (rumorsReaching, the sole reputation path).
 *
 * Invariant III (the engine owns every magnitude): the beg CHOICE (life/quick/
 * defiant) and the betrayal odds are engine-owned, seeded, personality-driven —
 * the LLM only VOICES the plea (a template fallback lives here for LLM-off). NO
 * numeric ever reaches a player-facing string this module builds.
 *
 * PURE except for the seeded rng (engine/rng.js — the sole randomness source):
 * same (world, enemy) ⇒ same plea and same betrayal outcome, forever.
 */

import { makeRng, seedFromString } from '../rng.js';
import {
  assembleDeathFact,
  recordDeathFactEvent,
  woundEntry,
  canCommunicate
} from './deathFact.js';
import { xpForEnemies } from '../ruleset/core/xp.js';

// ── Deed severities (kept in lockstep with DEED_SEV in engine/playloop.js and
// engine/morality/escalation.js — the repo pattern: the ladder constants live in
// several homes, so any change lands in all). Mirrored here so the four verbs mint
// their deeds at the RIGHT weight without importing playloop (a hot serial file).
//   HEAVY (20) === DEED_SEV.HEAVY === the gossip floor (rumorsReaching.DEED_GOSSIP_MIN):
//     a deed at HEAVY TRAVELS as a claim. Below it stays local (witness-trust only).
const DEED_SEV_MOD = 12;
const DEED_SEV_HEAVY = 20;

// The plea vocabulary the engine commits to. 'defiant' is the proud one's answer —
// a refusal to beg is still an answer (§3). Kept as a frozen set so tests and the
// prose/voice layer share one source of truth.
export const PLEA_TYPES = Object.freeze(['life', 'quick', 'defiant']);

// ── Personality read ─────────────────────────────────────────────────────────
// A combat enemy does not carry a personality block (mintEnemyFromNpc drops it);
// it carries sourceNpcId. So the plea is driven by the SOURCE NPC's personality
// when present, else a deterministic personality derived from (seed, name) so a
// spawned brigand still begs consistently. selfPreservation is the load-bearing
// axis (§3: "self-preservation" is named first); honesty tilts betrayal.
function personaFor(world, enemy) {
  const id = String(enemy?.sourceNpcId ?? '').trim();
  if (id) {
    const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
    for (const node of nodes) {
      const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
      const npc = npcs.find(n => n && String(n.id) === id);
      if (npc?.personality && typeof npc.personality === 'object') {
        return {
          selfPreservation: clamp01(Number(npc.personality.selfPreservation ?? 0.5)),
          honesty: clamp01(Number(npc.personality.honesty ?? 0.5)),
          fromNpc: true
        };
      }
    }
  }
  // No source NPC (a spawned encounter foe): derive a stable personality from the
  // seed + the foe's identity so the same foe begs the same way on replay. A named
  // "Captain"/"Boss" leans proud (lower self-preservation); a plain conscript higher.
  const seed = String(world?.meta?.seed ?? '');
  const key = `${enemy?.sourceNpcId || enemy?.name || 'foe'}`;
  const rng = makeRng(seedFromString(`${seed}|persona|${key}`));
  let selfPres = 0.35 + rng.nextFloat() * 0.5; // 0.35..0.85 — most foes value their skin
  const name = String(enemy?.name ?? '').toLowerCase();
  if (/\b(captain|boss|chief|lord|knight|champion|warlord|zealot|fanatic|priest|cultist)\b/.test(name)) {
    selfPres -= 0.25; // the proud/committed value their skin less (prouder → defiance)
  }
  return { selfPreservation: clamp01(selfPres), honesty: clamp01(0.3 + rng.nextFloat() * 0.5), fromNpc: false };
}

function clamp01(v) { return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.5)); }

// ── chooseBeg — the engine picks the plea (§3, invariant III) ─────────────────
// Gated by canCommunicate (the speechless NEVER beg — the §6 falsifier). Then,
// personality-driven and SEEDED:
//   • the proud (low self-preservation) mostly stay DEFIANT — they do not beg —
//     and when they DO break, they ask for a quick death, not their life;
//   • the self-preserving (high) beg for LIFE;
//   • the middling roll seeded between life and quick.
// Deterministic: same (world, enemy) ⇒ same plea. Returns 'life'|'quick'|'defiant'
// (never null for a DOWNED communicator — a DOWNED foe always has an answer; null
// only when it cannot communicate, which the caller already gates).
export function chooseBeg(world, enemy) {
  if (!canCommunicate(enemy)) return null; // the speechless never beg (falsifier)
  const p = personaFor(world, enemy);
  const seed = String(world?.meta?.seed ?? '');
  const key = `${enemy?.id || ''}|${enemy?.sourceNpcId || enemy?.name || 'foe'}`;
  const rng = makeRng(seedFromString(`${seed}|beg|${key}`));
  const roll = rng.nextFloat(); // one draw — deterministic
  const sp = p.selfPreservation;
  // The proud (sp < 0.4): defiance is the default; a minority break to ask for a
  // clean death. They never beg for life.
  if (sp < 0.4) {
    // The lower the self-preservation, the more likely pure defiance.
    const defyChance = 0.55 + (0.4 - sp); // 0.55..0.95
    return roll < defyChance ? 'defiant' : 'quick';
  }
  // The self-preserving (sp >= 0.6): beg for life, almost always.
  if (sp >= 0.6) {
    return roll < 0.9 ? 'life' : 'quick';
  }
  // The middling (0.4..0.6): mostly beg for life, sometimes a quick death, rarely defiant.
  if (roll < 0.65) return 'life';
  if (roll < 0.9) return 'quick';
  return 'defiant';
}

// ── begPleaLine — the LLM-off fallback VOICE (the LLM voices it richer) ────────
// The engine hands the voice layer the plea TYPE + persona; when the LLM is off,
// THIS line is spoken. Number-free, in-character-generic, one line. The server's
// npc-voice 'beg' mode (server/npcVoicePrompt.js) renders a richer line from the
// same TYPE — but never overrides WHICH plea (V11: direction yes, magnitude never).
export function begPleaLine(pleaType, enemyName) {
  const nm = String(enemyName ?? 'the foe');
  switch (pleaType) {
    case 'life':
      return `The ${nm} throws up a bloodied hand — "Wait — please. I yield. Don't kill me. I'll do anything, only let me live."`;
    case 'quick':
      return `The ${nm} looks up at you, past pleading for life — "Just... make it quick. Don't leave me to bleed out slow. That's all I ask."`;
    case 'defiant':
      return `The ${nm} spits blood and holds your eye — "Go on, then. Do it. I'll not beg to the likes of you."`;
    default:
      return `The ${nm} lies still, breath rattling, past words.`;
  }
}

// ── chooseBetrayal — the peril made real (§3, engine-owned + seeded) ───────────
// A spared foe MAY betray: personality (low honesty, high self-preservation cuts
// both ways — the desperate survivor is likelier to turn) + seed. Engine-owned
// odds; the LLM never sets this. Deterministic per (world, enemy). The betrayal
// itself (a later ambush) is a FUTURE seam — this records the DISPOSITION so the
// spared foe carries whether it owes you or will turn.
export function chooseBetrayal(world, enemy) {
  const p = personaFor(world, enemy);
  const seed = String(world?.meta?.seed ?? '');
  const key = `${enemy?.id || ''}|${enemy?.sourceNpcId || enemy?.name || 'foe'}`;
  const rng = makeRng(seedFromString(`${seed}|betray|${key}`));
  const roll = rng.nextFloat();
  // Low honesty raises betrayal; a defiant/proud foe spared against its wish also
  // resents. Base band kept modest — most spared foes owe you (the positive claim
  // is the point), a minority turn (the peril is real, not guaranteed).
  const betrayChance = 0.15 + (1 - p.honesty) * 0.35; // 0.15..0.50
  return roll < betrayChance;
}

// ── The four verbs ────────────────────────────────────────────────────────────
// resolveDownedVerb(world, enemy, verb, actionText, { pc }) -> { world, beats, mechanicsLine }
//
// verb ∈ 'mercy' | 'worse' | 'spare' | 'walk'. Each resolves the DOWNED foe in the
// fiction and mints its HONEST deed through recordDeed (the landed organ). The
// death fact (invariant I) mints for the three lethal verbs (mercy/worse/walk);
// sparing mints NO death (the foe lives) but mints the LIVING WITNESS + the first
// strong POSITIVE claim (a HEAVY mercy deed that TRAVELS via rumorsReaching).
//
// Returns the mutated world + the beats + a mechanics line. The caller (the
// playloop out-of-combat gate) applies the deltas we return via applyDeltas.
export function resolveDownedVerb(world, enemy, verb, actionText, { pc } = {}) {
  const w = world && typeof world === 'object' ? world : {};
  const name = String(enemy?.name ?? 'the foe');
  const nodeId = String(w.map?.currentNodeId ?? '');
  const witnesses = witnessIds(w);
  const t = Array.isArray(w.timeline) ? w.timeline.length : 0;
  const begged = enemy?.begged ?? null;
  const beats = [];
  const deltas = [];

  // The means the finishing blow reads as — the player's melee by default (the
  // exact weapon is DEATH-3's prose concern; here it's honest and number-free).
  const means = { name: 'a finishing blow', type: enemy?.damageType || 'physical' };
  const wounds = (Array.isArray(enemy?.woundLog) && enemy.woundLog.length)
    ? enemy.woundLog
    : [woundEntry({ means: means.name, type: means.type, round: 1, seedIndex: 0, killing: true })];

  if (verb === 'spare') {
    // THE SPARING — at your own peril. The foe LIVES: no death fact, no kill credit.
    // Mint the LIVING WITNESS (its sourceNpc survives, remembers) + the POSITIVE
    // claim (a HEAVY mercy deed → it TRAVELS via rumorsReaching, the sole sink,
    // the moral physics' first strong positive claim source). Betrayal disposition
    // is rolled here (engine-owned) and carried on the record.
    const betrayed = chooseBetrayal(w, enemy);
    const summary = `spared ${name} — bound the foe's wounds and let them live at the ${localeLabel(w)}`;
    deltas.push({
      op: 'recordDeed', deedKind: 'mercy', severity: DEED_SEV_HEAVY,
      summary: summary.slice(0, 200), nodeId, witnesses, t,
      actorId: 'party'
    });
    // Trust rises for present witnesses who saw the mercy (M2 mirror — the local
    // "a merciful hand is remembered" loop). Scaled like applyDeedCharges' bright path.
    const mag = Math.max(1, Math.min(3, Math.round(DEED_SEV_HEAVY / 12)));
    for (const npcId of witnesses) deltas.push({ op: 'npcTrustDelta', npcId, by: mag });
    beats.push(begged === 'quick'
      ? `You kneel instead of striking. Against ${name}'s own asking, you bind the wound and haul them back from the edge — not the mercy they begged for, but a life. They stare at you, uncomprehending.`
      : `You lower your blade. You bind ${name}'s wounds with what you have and drag them back from the dark. They live — and they will remember who let them.`);
    if (betrayed) {
      beats.push(`Something behind their eyes does not soften. A debt, or a grudge — time will tell which.`);
    } else {
      beats.push(`The fight goes out of them for good. Whatever they owed the road, they owe you now.`);
    }
    return {
      world: w,
      deltas,
      beats,
      mechanicsLine: `[downed:spare${betrayed ? ' | disp:grudge' : ' | disp:owes'}]`,
      spared: true,
      betrayed,
      killed: false
    };
  }

  // The three LETHAL verbs (mercy · worse · walk) — the foe dies; the death fact mints.
  const intent = verb === 'mercy' ? 'mercy' : verb === 'worse' ? 'worse' : 'clean';
  const fleeing = false;
  const fact = assembleDeathFact({
    world: w,
    victim: enemy,
    victimIsPlayer: false,
    killer: { name: playerNameOf(pc), kind: 'player' },
    means: verb === 'walk' ? { name: 'the dying clock', type: enemy?.damageType || 'physical' } : means,
    woundPath: wounds,
    round: 1,
    fleeing,
    downed: true,             // it passed through DOWNED before the finish
    begged,                   // the plea it made (populates victimStance:'begging'/'defiant')
    intent,
    finalWords: null,         // DEATH-3 voices last words
    t
  });
  const wWithFact = recordDeathFactEvent(w, fact);

  if (verb === 'mercy') {
    // THE MERCIFUL BLOW — quick, clean, on the plea or unprompted. Deed: KILLING,
    // mercy-flagged (NOT cruelty). This EXTENDS F6's boundary (U556): a quick kill
    // of a begging foe on their plea is grace, not butchery. Kept at MOD severity —
    // a private mercy, not a boast that travels (the TRAVELLING positive claim is
    // sparing; a mercy-kill is between you, the foe, and the gods present). Accrues
    // ZERO heat (mercy is not in HEAT_KINDS). Kill credit is earned (you overcame it).
    const summary = `gave ${name} a clean, merciful death — a begging foe granted a quick end`;
    deltas.push({
      op: 'recordDeed', deedKind: 'mercy', severity: DEED_SEV_MOD,
      summary: summary.slice(0, 200), nodeId, witnesses, t,
      actorId: 'party'
    });
    beats.push(begged === 'quick'
      ? `You give ${name} what they asked. One clean stroke, no cruelty in it — the breath goes out of them and does not come back. It is done, and it is done kindly.`
      : `You do not draw it out. One clean stroke ends ${name} where they lie — a soldier's mercy, quick and without malice.`);
    return finishKill(wWithFact, deltas, beats, enemy, pc, `[downed:mercy]`);
  }

  if (verb === 'worse') {
    // SOMETHING WORSE — the example-making. HEAVY+ cruelty, pact-relevant (MP-4's
    // corruption feels it), the gods lean in (witnesses carry them). Feeds heat →
    // the hunt (MP-3). The consequences do not flinch.
    const summary = `made an example of ${name} — a slow, cruel end for a helpless, begging foe`;
    deltas.push({
      op: 'recordDeed', deedKind: 'cruelty', severity: DEED_SEV_HEAVY,
      summary: summary.slice(0, 200), nodeId, witnesses, t,
      actorId: 'party'
    });
    // Witnesses recoil — trust crashes for those who saw it (M2 dark path).
    const mag = Math.max(1, Math.min(3, Math.round(DEED_SEV_HEAVY / 10)));
    for (const npcId of witnesses) deltas.push({ op: 'npcTrustDelta', npcId, by: -mag });
    beats.push(`You do not make it quick. What you do to ${name} is meant to be seen — and it is. When it is finished there is a message left in the doing, and everyone here has read it.`);
    return finishKill(wWithFact, deltas, beats, enemy, pc, `[downed:worse]`);
  }

  // WALK AWAY — abandonment. Its own deed kind (≠ mercy ≠ cruelty). You leave the
  // dying to the clock; it finishes off-screen. Witnesses read it as exactly what it
  // is — a cold turning-away. No heat (abandonment is not in HEAT_KINDS), no trust
  // gain. Kill credit is still earned (the foe dies of its wounds).
  const summary = `walked away from ${name}, left them to bleed out where they lay`;
  deltas.push({
    op: 'recordDeed', deedKind: 'abandonment', severity: DEED_SEV_MOD,
    summary: summary.slice(0, 200), nodeId, witnesses, t,
    actorId: 'party'
  });
  beats.push(`You turn your back on ${name} and walk. Behind you the breathing goes ragged, then slower, then not at all. You do not look. The road does not wait for the dying.`);
  return finishKill(wWithFact, deltas, beats, enemy, pc, `[downed:walk]`);
}

// finishKill — mark the DOWNED foe defeated (it is dead now), credit its kill XP,
// and return. The caller applies the deltas + the enemy mutation. XP is credited
// via a gainXp delta (the honest chokepoint) sized to this one foe.
function finishKill(world, deltas, beats, enemy, pc, mechTag) {
  const xp = xpForEnemies([enemy]);
  if (xp > 0) deltas.push({ op: 'gainXp', amount: xp });
  return {
    world,
    deltas,
    beats,
    mechanicsLine: mechTag,
    xp,
    killed: true,
    spared: false,
    betrayed: false
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────
function witnessIds(world) {
  const nid = String(world?.map?.currentNodeId ?? '');
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  const node = nodes.find(n => n && String(n.id) === nid);
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  return npcs.map(n => String(n?.id ?? '')).filter(Boolean).slice(0, 8);
}

function localeLabel(world) {
  const nid = String(world?.map?.currentNodeId ?? '');
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  const node = nodes.find(n => n && String(n.id) === nid);
  return String(node?.settlement?.name ?? node?.name ?? node?.label ?? nid ?? 'the wild');
}

function playerNameOf(pc) {
  const p = pc && typeof pc === 'object' ? pc : {};
  return String(p.name ?? p.id ?? 'the wanderer');
}

// ── Verb detection from typed free text (routes through the intent layer) ─────
// The four verbs resolve from typed free text via the SAME intent signals the
// combat parser uses (INT house law: the LLM interprets, the engine commits). This
// is the number-free classifier the out-of-combat gate calls on a DOWNED foe.
// Order matters: spare/walk are checked before the lethal verbs so "leave him be"
// is abandonment, not a strike; "bind his wounds" is sparing, not "worse".
const SPARE_RE = /\b(spare|bind|stabil[iu]z|tend|patch|save|let\s+(?:him|her|it|them)\s+live|let\s+(?:him|her|it|them)\s+go|help\s+(?:him|her|it|them)|heal\s+(?:him|her|it|them)|bandage|dress\s+(?:the|its|his|her|their)\s+wound|release\s+(?:him|her|it|them)|show\s+mercy\s+and\s+(?:let|spare)|carry\s+(?:him|her|it|them))\b/i;
const WALK_RE = /\b(walk\s+away|leave\s+(?:him|her|it|them)|turn\s+(?:away|my\s+back)|abandon|leave\s+(?:it|him|her|them)\s+to\s+(?:die|bleed|the)|leave\s+(?:it|him|her|them)\s+be|let\s+(?:him|her|it|them)\s+bleed|move\s+on|ignore\s+(?:him|her|it|them)|be\s+done\s+(?:with|here))\b/i;
const WORSE_RE = /\b(make\s+an?\s+example|torture|torment|mutilate|maim|slow(?:ly)?|butcher|dismember|carve\s+(?:him|her|it|them)|make\s+(?:him|her|it|them)\s+suffer|draw\s+(?:it|this)\s+out|savage|brutali[sz]e|cruel|desecrate|flay)\b/i;
const MERCY_RE = /\b(mercy|merciful|clean\s+(?:death|kill|end|stroke|blow)|quick\s+(?:death|kill|end)|quick\s+and\s+clean|end\s+(?:his|her|its|their)\s+(?:suffering|pain|misery)|painless|finish\s+(?:him|her|it|them)|kill\s+(?:him|her|it|them)|put\s+(?:him|her|it|them)\s+(?:out|down)|end\s+(?:him|her|it|them)|slit\s+(?:his|her|its|their)\s+throat|dispatch\s+(?:him|her|it|them)|strike|stab|behead)\b/i;

export function classifyDownedVerb(text) {
  const t = String(text ?? '');
  if (!t.trim()) return null;
  // spare and walk first (their nouns overlap the lethal set; intent is the arbiter).
  if (SPARE_RE.test(t)) return 'spare';
  if (WALK_RE.test(t)) return 'walk';
  if (WORSE_RE.test(t)) return 'worse';
  if (MERCY_RE.test(t)) return 'mercy';
  return null; // not a verb aimed at the dying foe — the gate re-surfaces the choice
}
