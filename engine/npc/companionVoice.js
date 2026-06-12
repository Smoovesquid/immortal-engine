/**
 * P-78 — Companions as people.
 *
 * companionPass(world, ctx) -> { world, line } — runs once per player turn
 * (hooked from playerMove's morality chokepoint) and gives companions three
 * human behaviors:
 *
 *   (a) interjections — at most ONE line per scene-shaped moment, fired by a
 *       deterministic trigger (victory, arrival, a dark turn) and toned by
 *       loyalty: the same event reads differently through a companion who
 *       loves you and one who is halfway out the door.
 *   (b) loyalty — the companion marker's trustLevel moves on WITNESSED deeds
 *       (companions travel with you; they see everything): cruelty/forbidden
 *       erode it, mercy/aid/atonement rebuild it.
 *   (c) the objection arc — a corruption-tier crossing or a heavy dark deed
 *       with a companion present triggers confrontation; the second,
 *       ultimatum; ignore that and they leave (dismissCompanion + timeline).
 *
 * Objection memory lives in the TIMELINE (companionObjection events), not in
 * new state shape — replays rebuild it, ensureWorld strips nothing.
 * Deterministic: seeded rng keyed off world seed + timeline length. Pure:
 * no Math.random; mutations via applyDeltas where an op exists.
 */

import { makeRng, seedFromString } from '../rng.js';
import { applyDeltas } from '../effectsCore.js';

// Loyalty movement per witnessed deed kind.
const DEED_TRUST = {
  cruelty: -2,
  forbidden: -1,
  mercy: 1,
  aid: 1,
  atonement: 2
};

// Trigger → tone-tiered one-liners. {name} fills with the companion's name.
const INTERJECTIONS = {
  victory: {
    warm: ['{name} lets out the breath they were holding. "Still alive. Both of us. I\'m counting that."'],
    neutral: ['{name} wipes their blade clean without a word, then nods at you once.'],
    cold: ['{name} surveys the bodies. "You\'re good at this part. I\'ve stopped deciding if that comforts me."']
  },
  arrival: {
    warm: ['{name} takes in the place beside you. "New ground. Lead on, then."'],
    neutral: ['{name} scans the road behind you out of habit before following you in.'],
    cold: ['{name} pauses at the edge of the place, like someone measuring the distance home.']
  },
  dark: {
    warm: ['{name} watches you a moment too long, then looks away.'],
    neutral: ['{name} says nothing. The silence does the talking.'],
    cold: ['{name} keeps half a step further from you than yesterday.']
  }
};

const OBJECTION_LINES = [
  // First: confrontation.
  '{name} steps in front of you, eyes hard. "Stop. Look at me. I didn\'t follow you for this. Whatever this is becoming — it ends, or you tell me now what I\'m walking beside."',
  // Second: ultimatum.
  '{name}\'s voice is quiet and final. "I warned you once. Once more — one more turn down this road — and you\'ll finish it without me. I mean it this time."',
  // Third: departure (spoken as they go).
  '{name} shoulders their pack without ceremony. "I told you twice. I\'m no one\'s witness for hire." They walk, and they do not look back.'
];

function companionsOf(world) {
  const party = Array.isArray(world?.party) ? world.party : [];
  return party
    .map((p, idx) => ({ p, idx }))
    .filter(({ p, idx }) => idx > 0 && p && p.companion);
}

function toneFor(trustLevel) {
  if (trustLevel >= 7) return 'warm';
  if (trustLevel >= 4) return 'neutral';
  return 'cold';
}

function fill(line, name) {
  return String(line).replace(/\{name\}/g, String(name || 'Your companion'));
}

function objectionCount(world, companionId) {
  return (Array.isArray(world?.timeline) ? world.timeline : [])
    .reduce((n, e) => n + (e?.kind === 'companionObjection' && String(e?.data?.companionId) === String(companionId) ? 1 : 0), 0);
}

function pushEvent(world, kind, data) {
  const tl = Array.isArray(world.timeline) ? world.timeline : [];
  return { ...world, timeline: [...tl, { t: tl.length, kind, data }] };
}

function setTrust(world, idx, trustLevel) {
  const party = world.party.slice();
  const member = party[idx];
  party[idx] = { ...member, companion: { ...member.companion, trustLevel: Math.max(0, Math.min(10, Math.trunc(trustLevel))) } };
  return { ...world, party };
}

/** New deeds recorded by this turn (prevWorld → world). */
function freshDeeds(world, prevWorld) {
  const now = Array.isArray(world?.deeds) ? world.deeds : [];
  const before = Array.isArray(prevWorld?.deeds) ? prevWorld.deeds.length : 0;
  return now.slice(before);
}

/** Mirrors the M4 thresholds (engine/magic/forbiddenGates.js). */
function tier(corruption) {
  const c = Number(corruption) || 0;
  return (c >= 60 ? 3 : c >= 40 ? 2 : c >= 20 ? 1 : 0);
}

/**
 * The per-turn companion pass. ctx:
 *   prevWorld     — world before this turn (deed/timeline baseline)
 *   oldCorruption / newCorruption — player corruption around the turn
 * Returns { world, line } — line is at most ONE voice line (the gravest
 * moment wins: departure > objection > interjection).
 */
export function companionPass(world, ctx = {}) {
  let w = world;
  const companions = companionsOf(w);
  if (!companions.length) return { world: w, line: null };

  const prev = ctx.prevWorld || w;
  const deeds = freshDeeds(w, prev);

  // (b) Loyalty: companions witness every party deed.
  for (const { idx } of companionsOf(w)) {
    let trust = Number(w.party[idx].companion.trustLevel ?? 5);
    let moved = false;
    for (const d of deeds) {
      const by = DEED_TRUST[d?.kind] ?? 0;
      if (!by) continue;
      trust += by;
      moved = true;
    }
    if (moved) w = setTrust(w, idx, trust);
  }

  // (c) The objection arc — fires on a corruption-tier crossing OR a heavy
  // dark deed (the coerced-labor build records cruelty at heavy severity).
  const crossedTier = tier(ctx.newCorruption) > tier(ctx.oldCorruption);
  const heavyDark = deeds.some(d => (d?.kind === 'cruelty' || d?.kind === 'forbidden') && Number(d?.severity ?? 0) >= 2);
  if (crossedTier || heavyDark) {
    // The most loyal companion objects first — they care the most.
    const objector = companionsOf(w)
      .slice()
      .sort((a, b) => Number(b.p.companion.trustLevel ?? 5) - Number(a.p.companion.trustLevel ?? 5))[0];
    if (objector) {
      const member = objector.p;
      const count = objectionCount(w, member.id);
      if (count >= 2) {
        // Ignored twice — they leave, and the timeline says so.
        const line = fill(OBJECTION_LINES[2], member.name);
        w = pushEvent(w, 'companionLeft', { companionId: String(member.id), name: String(member.name || ''), reason: 'objection-ignored' });
        w = applyDeltas(w, [{ op: 'dismissCompanion', entityId: String(member.id) }]);
        return { world: w, line };
      }
      const line = fill(OBJECTION_LINES[count], member.name);
      w = pushEvent(w, 'companionObjection', { companionId: String(member.id), name: String(member.name || ''), count: count + 1, trigger: crossedTier ? 'corruption-tier' : 'dark-deed' });
      return { world: w, line };
    }
  }

  // (a) Interjection — at most one, on a scene-shaped trigger this turn.
  const trigger = detectTrigger(w, prev, deeds);
  if (!trigger) return { world: w, line: null };

  const speaker = companionsOf(w)[0];
  const member = speaker.p;
  const rng = makeRng(seedFromString(`${w.meta?.seed || ''}|interject|${w.timeline?.length ?? 0}|${member.id}`));
  // Companions are people, not narration faucets: they speak when moved to.
  if (rng.nextFloat() >= 0.5) return { world: w, line: null };

  const tone = toneFor(Number(member.companion.trustLevel ?? 5));
  const pool = INTERJECTIONS[trigger][tone];
  const line = fill(pool[rng.int(0, pool.length - 1)], member.name);
  w = pushEvent(w, 'companionInterjection', { companionId: String(member.id), trigger });
  return { world: w, line };
}

/** Scene-shaped trigger detection from this turn's new timeline entries. */
function detectTrigger(world, prevWorld, deeds) {
  const tl = Array.isArray(world?.timeline) ? world.timeline : [];
  const before = Array.isArray(prevWorld?.timeline) ? prevWorld.timeline.length : 0;
  const fresh = tl.slice(before);
  if (fresh.some(e => e?.kind === 'combat-end' && String(e?.data?.reason || '').includes('victory'))) return 'victory';
  if (deeds.some(d => d?.kind === 'cruelty' || d?.kind === 'forbidden')) return 'dark';
  if (fresh.some(e => e?.kind === 'travel' || e?.kind === 'arrive')) return 'arrival';
  return null;
}
