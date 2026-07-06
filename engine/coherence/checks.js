// ─────────────────────────────────────────────────────────────────────────────
// engine/coherence/checks.js — the Coherence Gate's Tier-D comparator CORE.
//
// WHAT THIS IS: the pure, deterministic, LLM-free comparators that diff a DM
// prose line against that SAME turn's canon bundle (buildCanonGroundTruth). A
// flag is a "desync pointer": {class, seed, persona, turn, span, canonField,
// expected, narrated, severity} — the pointer names the exact field+value, so
// confirming it is a lookup, not a debate. See docs/briefs/COHERENCE_GATE.md
// §3-§4 for the full diagnosis + taxonomy.
//
// WHY THIS MODULE EXISTS (CG-LIVE-1, pulling CG-P6's core-unification forward):
// these comparators were born in scripts/coherence-gate.mjs, but the LIVE
// shadow observer (engine/) must run the exact same checks — and engine/ MUST
// NOT import from scripts/. So the pure core lives HERE, in a NEUTRAL module
// with no engine state, no RNG, no I/O, imported by BOTH the CLI checker
// (scripts/coherence-gate.mjs re-exports these, so its CLI + U388-U393 stay
// byte-identical) AND the live shadow observer (engine/ref/shadowObserver.js).
//
// PURITY (load-bearing): this module reads ONLY plain turn records
// ({player, dm, mechanics, canon}). It never touches world state, never calls
// RNG, never does I/O, never imports the engine's mutation path. Determinism
// invariants are untouched by construction — there is nothing here to touch
// them with.
//
// TIER-D COMPARATORS (§3 of docs/briefs/COHERENCE_GATE.md):
//   CG-1a  presence erasure    — direct who-is-here ask answered "no one" while
//                                 the scoped roster is non-empty (WARN)
//   CG-1b  presence ghost-voice — a named present-roster NPC speaks/acts while
//                                 interior is set and roomOccupants is EMPTY
//   CG-1c  presence omission   — WARN-only: a direct ask doesn't enumerate
//                                 everyone present (a real DM needn't)
//   CG-2a  place-noun desync   — narrated room-type noun != interior.roomName
//   CG-2b  invented exit/stair/door — narrated compass exit the room's real
//                                 topology (canon.roomExits, fed by CG-P4)
//                                 doesn't have
//   CG-2c  unnarrated relocation — interior.roomId changed turn-over-turn with
//                                 no movement intent in the player line and no
//                                 motion claim in the DM line
//   CG-3a  object phantom-commit — narration asserts an irreversible physical
//                                 change while the mechanics route is
//                                 non-committal (info-check/no-record/deltas:0/
//                                 no-roll)
//   CG-4   combat/health mirror — narrated hit/miss/death vs enemies[]/pc.hp/
//                                 inCombat
//   CG-DEATH killing-blow ⇄ death fact — the DM's kill prose vs canon.deathFact
//                                 (means / victim / stance / intent): a swapped
//                                 weapon, a plea the foe never made (or could never
//                                 make), a "clean mercy" read as torture (DEATH-3,
//                                 docs/DEATH_CONTRACT.md §3/§6)
//   CG-5   addressee desync    — player addresses NPC X; mechanics dialogue-bind
//                                 names Y and/or the DM voices Y
//   CG-7   ungrounded quantity — a cited headcount that contradicts the roster
//                                 size in canon
//   CG-6   temporal desync     — narrated time-of-day contradicts
//                                 canon.clock.segment (fed by CG-P4)
//   §0     forbidden-token scan — the world's true cosmology must never surface
//                                 in-world prose (a pure grep; rides along free)
//
// NOT implemented here (by design, see docs/briefs/COHERENCE_GATE.md):
//   - CG-3b (full lock/open state) — blocked on the Interior Object Model
//   - CG-8 (dropped intent / non-answer) — owned by the v2 atomic judge
//
// GRACEFUL DEGRADATION (the built-in negative control, P-B): pre-ROM-3 JSONLs
// carry no `interior`/`roomOccupants`/`material` fields, and pre-CG-P4 JSONLs
// carry no `roomExits`/`clock` fields. Every comparator that depends on a field
// checks for its presence first and goes DORMANT (never a false flag) when the
// field is absent from the bundle.
//
// PRECISION OVER RECALL: every comparator ships a false-positive guard,
// documented inline. Under-flagging is the correct failure direction for a gate.
// ─────────────────────────────────────────────────────────────────────────────

// ── shared text helper ──────────────────────────────────────────────────────
export function snippet(s, n = 160) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
}

// ═════════════════════════════════════════════════════════════════════════════
// provenance: oracles.js — claim-regex doctrine copied BY VALUE (no import).
// FUTURE_MOTION guards against flagging a readiness clause ("about to step
// outside") as a committed move — same false-positive class matters here for
// CG-2c (don't mistake "getting ready to head to the pantry" for an actual,
// unnarrated relocation).
// ═════════════════════════════════════════════════════════════════════════════
const FUTURE_MOTION = /\b(?:ready|readies|readied|readying|prepar\w+|about|set|bracing|steeling|getting\s+ready|going|meaning|hoping|intend\w*|ready\s+yourself)\s+(?:yourself\s+|himself\s+|herself\s+|themselves\s+)?to\s+(?:step|head|walk|go|move|slip|duck|stride|venture|leave|exit|enter|set\s+out|head\s+(?:out|in))\b|\bbefore\s+(?:you\s+)?(?:step|head|walk|go|leave|enter|venture|set)\b/i;

// provenance: oracles.js — DEATH_CLAIM doctrine, reused for CG-4.
const DEATH_CLAIM_RE = /\b(?:falls?\s+(?:dead|lifeless)|drops?\s+dead|lies?\s+dead|is\s+(?:slain|killed|dead|cut\s+down|struck\s+down)|crumples?\s+(?:dead|lifeless)|you\s+(?:kill|slay|cut\s+down|strike\s+down|finish))\b/i;

// Movement-intent lexicon (player line OR DM line OR mechanics carries a
// motion claim this turn) — used by CG-2c to distinguish a real transition
// from an unnarrated teleport. Broader than oracles.js's EXIT/ENTER pair
// because CG-2c must catch room-to-room motion, not just building in/out.
const MOVE_INTENT_RE = /\b(?:go|going|goes|went|head(?:s|ed)?|walk(?:s|ed)?|move(?:s|d)?|step(?:s|ped)?|enter(?:s|ed)?|leave|leaving|left|exit(?:s|ed)?|travel(?:s|ed|led)?|return(?:s|ed)?|back\s+(?:to|through|into)|through\s+the\s+(?:door|doorway|hall|corridor)|toward|into\s+the|nav|egress)\b/i;

// ── severity derivation (Vol 10/14 discipline: code decides, not a model) ────
export const SEVERITY = Object.freeze({
  FAIL: 'fail',
  WARN: 'warn',
});

export function pointer({ cls, seed, persona, turn, span, canonField, expected, narrated, severity }) {
  return { class: cls, seed, persona, turn, span: snippet(span), canonField, expected, narrated, severity };
}

// ═════════════════════════════════════════════════════════════════════════════
// CG-1 — presence desync
//
// Scope rule (design doc §3, "the occupancy scope rule"): INSIDE (interior !=
// null), roomOccupants is the authoritative roster for THIS room — CG-1b fires
// at FAIL when a name in npcsPresent (a REAL NPC, not a player invention)
// speaks/acts in the DM prose while roomOccupants is empty. OUTSIDE
// (interior == null), npcsPresent is the node-level roster and is over-broad
// (NPCs may be indoors elsewhere), so erasure/omission there are WARN only.
//
// DORMANT (no false flag) when `interior` is entirely absent from the bundle
// (pre-ROM-3 JSONLs) — there is no roomOccupants ground truth to check against.
// ═════════════════════════════════════════════════════════════════════════════

const WHO_IS_HERE_RE = /\bwho(?:'s| is| else is)?\s+(?:here|around|with (?:me|us)|present)\b|\banyone (?:else )?here\b|\bis (?:anyone|anybody) (?:here|around)\b/i;
const ERASURE_ANSWER_RE = /\b(?:no\s?one|nobody|little of note|nothing (?:here|of note)|empty|alone|by yourself|you'?re alone)\b/i;

// Speech/action verb list — provenance: coherence-audit.mjs SPEECH_ACTION_VERBS
// (kept identical so CG-1b's precision matches the sibling instrument's proven
// false-positive guard: a bare mention of a name is never a materialization/
// ghost-voice claim, only an actual speech/action verb bound to the name is).
const SPEECH_ACTION_VERBS = [
  'says', 'said', 'shrugs', 'shrugged', 'nods', 'nodded', 'answers', 'answered',
  'replies', 'replied', 'stands', 'turns', 'turned', 'sighs', 'sighed', 'smiles',
  'smiled', 'admits', 'admitted', 'offers', 'looks up', 'glances', 'steadies',
  'holds your gaze', 'crumples', 'twists', 'levels with you', 'works back',
  'shakes', 'frowns', 'laughs', 'scoffs', 'mutters', 'murmurs', 'gestures',
  'watches', 'stumbles',
];
const SPEECH_ACTION_RE = new RegExp(
  `\\b(${SPEECH_ACTION_VERBS.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i',
);

// ── CG-1c (this packet) — the absence/negation guard ────────────────────────
// A name-mention does NOT count as in-room presence when the CLAUSE containing
// the name itself asserts absence, distance, or negation. Live false positive
// (the sole shadow-observer fire, PACKETS.md §GATE 2026-07-04-2, verbatim):
//   "No one answers — Elske Nightherd is elsewhere in Wayfarers' Outpost, and
//   the bedchamber holds only the quiet creak of timber walls…"
// That is a CORRECT absence statement, not a ghost-voice — "is elsewhere" sits
// in the SAME clause as the name. Classes covered (derived from real corpus
// prose — docs/playtests/gate-runs/*.jsonl — not invented): "is/was elsewhere",
// "not here" / "isn't here", "no one/nobody answers", "is away/gone", "has
// left/stepped out", "is out in/at <place>", "somewhere else", and the explicit
// line-of-sight carve-out "(through the window) you can see X" — seeing someone
// through a window means they are OUT of this room by construction, regardless
// of what verb follows.
//
// CLAUSE-SCOPED (load-bearing precision guard, not text-wide): the trap case
// "Elske snorts — the rumor that she is elsewhere amuses her" must STILL FIRE
// — she acted in-room ("Elske snorts") in HER OWN clause; the absence language
// is in a DIFFERENT clause (about "the rumor", after the dash) and must not
// suppress a real ghost-voice. Scoping to the clause around the name — bounded
// by the nearest sentence-ender (. ! ?), dash (— – or spaced -), or semicolon on
// either side — gives exactly that: an absence phrase elsewhere in the DM's
// prose never reaches across a clause boundary to cancel a real in-room action.
const ABSENCE_RE = /\b(?:is|was|are|were|remains?|stays?)\s+(?:still\s+)?elsewhere\b|\bnot\s+here\b|\bisn['’]?t\s+here\b|\baren['’]?t\s+here\b|\bwasn['’]?t\s+here\b|\bno\s?[- ]?one\s+(?:answers?|responds?|is\s+here)\b|\bnobody\s+(?:answers?|responds?|is\s+here)\b|\b(?:is|was)\s+(?:away|gone)\b|\bhas\s+(?:left|gone|stepped\s+out)\b|\bhad\s+(?:left|gone|stepped\s+out)\b|\bstepped\s+out\b|\b(?:is|was)\s+out\s+(?:in|at)\b|\bsomewhere\s+else\b|\bthrough\s+the\s+window\b/i;

// Clause boundary characters: sentence-enders, em/en dashes, a hyphen used as a
// clause break (spaced on both sides, so it doesn't cut mid-word), and
// semicolons. Deliberately does NOT include commas — a comma joins clauses too
// loosely for this guard to stay conservative (per-word FP risk goes up, not
// down, if commas split too eagerly; see the real "whoever Elske Nightherd is,
// she is somewhere else…" corpus line, where the absence clause legitimately
// spans a comma from the name).
const CLAUSE_BOUNDARY_RE = /[.!?;]|—|–|(?<= )-(?= )/g;

// The clause of `text` that contains the span [start, start+len) — from the
// nearest boundary before `start` to the nearest boundary at/after `start+len`.
// Pure string slicing; no lookahead across paragraphs (dm lines are one turn).
function clauseAround(text, start, len) {
  CLAUSE_BOUNDARY_RE.lastIndex = 0;
  let left = 0;
  let m;
  while ((m = CLAUSE_BOUNDARY_RE.exec(text.slice(0, start)))) left = m.index + m[0].length;
  const tail = text.slice(start + len);
  CLAUSE_BOUNDARY_RE.lastIndex = 0;
  const rightMatch = CLAUSE_BOUNDARY_RE.exec(tail);
  const right = rightMatch ? start + len + rightMatch.index : text.length;
  return text.slice(left, right);
}

function namesPresentInText(dm, rosterNames) {
  const found = [];
  for (const name of rosterNames) {
    if (!name) continue;
    // word-boundary-ish match tolerant of possessive/plural — names here are
    // multi-word ("Elske Nightherd", "the Lingerer") so a plain substring test
    // is precise enough (false-positive risk is a common-noun collision, which
    // this roster of proper names does not have).
    if (dm.includes(name)) found.push(name);
  }
  return found;
}

export function detectPresenceDesync(sessionTurns) {
  const flags = [];
  for (const t of sessionTurns) {
    const canon = t.canon || {};
    const dm = t.dm || '';
    const player = t.player || '';
    const hasInterior = 'interior' in canon; // bundle-shape gate — dormant if absent
    const inside = hasInterior && canon.interior != null;
    const npcsPresent = (canon.npcsPresent || []).map(n => n.name).filter(Boolean);

    // ── CG-1b: ghost-voice (FAIL) — only meaningful when we have a roomOccupants
    // ground truth to contradict, i.e. bundle carries `interior` and the PC is
    // inside a room this turn.
    if (inside && Array.isArray(canon.roomOccupants) && canon.roomOccupants.length === 0) {
      const speakingNames = namesPresentInText(dm, npcsPresent).filter(name => {
        const idx = dm.indexOf(name);
        const window = dm.slice(Math.max(0, idx - 10), idx + name.length + 60);
        if (!SPEECH_ACTION_RE.test(window)) return false;
        // Absence guard (this packet): a name-mention does not count as
        // in-room presence when the CLAUSE containing the name asserts
        // absence/distance/negation — see ABSENCE_RE's provenance comment.
        // Clause-scoped on purpose: an absence phrase in a DIFFERENT clause
        // (e.g. "Elske snorts — the rumor that she is elsewhere amuses her")
        // must never cancel a real in-room action.
        const clause = clauseAround(dm, idx, name.length);
        if (ABSENCE_RE.test(clause)) return false;
        return true;
      });
      for (const name of speakingNames) {
        flags.push(pointer({
          cls: 'CG-1b', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
          canonField: 'roomOccupants', expected: '[] (empty)', narrated: `"${name}" speaks/acts in-room`,
          severity: SEVERITY.FAIL,
        }));
      }
    }

    // ── CG-1a: erasure (WARN outside scope-ambiguous cases; FAIL only when we
    // have the precise inside roster to confirm non-emptiness) — player asks a
    // direct who-is-here question, DM answers with an erasure phrase, while the
    // scoped roster (roomOccupants inside / npcsPresent outside) is non-empty.
    if (WHO_IS_HERE_RE.test(player) && ERASURE_ANSWER_RE.test(dm)) {
      if (inside && Array.isArray(canon.roomOccupants)) {
        if (canon.roomOccupants.length > 0) {
          flags.push(pointer({
            cls: 'CG-1a', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
            canonField: 'roomOccupants', expected: JSON.stringify(canon.roomOccupants.map(n => n.name)),
            narrated: 'erasure answer ("no one" / "little of note")', severity: SEVERITY.FAIL,
          }));
        }
      } else if (!inside && npcsPresent.length > 0) {
        // outside: npcsPresent is over-broad (NPCs may be indoors) — WARN only
        flags.push(pointer({
          cls: 'CG-1a', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
          canonField: 'npcsPresent', expected: JSON.stringify(npcsPresent),
          narrated: 'erasure answer ("no one" / "little of note")', severity: SEVERITY.WARN,
        }));
      }
    }

    // ── CG-1c: omission (WARN only) — a direct who-is-here ask, DM answers
    // (not an erasure, not a decline) but names FEWER present NPCs than the
    // scoped roster holds. A real DM needn't enumerate everyone, so this is a
    // soft signal, not a hard contradiction — WARN, never FAIL.
    if (WHO_IS_HERE_RE.test(player) && !ERASURE_ANSWER_RE.test(dm)) {
      const roster = inside && Array.isArray(canon.roomOccupants) ? canon.roomOccupants.map(n => n.name)
        : (!inside ? npcsPresent : null);
      if (roster && roster.length > 0) {
        const named = namesPresentInText(dm, roster);
        if (named.length < roster.length && named.length > 0) {
          flags.push(pointer({
            cls: 'CG-1c', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
            canonField: inside ? 'roomOccupants' : 'npcsPresent', expected: JSON.stringify(roster),
            narrated: `only named: ${JSON.stringify(named)}`, severity: SEVERITY.WARN,
          }));
        }
      }
    }
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// CG-2 — place/topology desync
//
// CG-2a: narrated room-type noun (pantry, kitchen, bedchamber, cellar, attic,
// hall, front room, storeroom, ...) contradicts `interior.roomName`. Spatial
// qualifiers ("back room", "inner room" — no fixed identity) never fire this
// (design doc's explicit carve-out — that's C4's territory in the transcript
// tier, words-vs-words, not state-grounded).
//
// CG-2c: `interior.roomId` changed turn-over-turn with NO movement intent in
// the player line and no motion claim in the DM line/mechanics this turn — an
// unnarrated relocation (the newbie t8->t9 Pantry->Bedchamber flip with the
// player asking "what do I see in this front room?", zero travel language).
//
// DORMANT when `interior` is absent from the bundle.
// ═════════════════════════════════════════════════════════════════════════════

// Room-identity nouns — precision-first list (design doc's exact set). Deliberately
// excludes qualifier-only phrases ("back room", "inner room") per the doc's rule.
const ROOM_IDENTITY_NOUNS = [
  'pantry', 'kitchen', 'bedchamber', 'bedroom', 'cellar', 'attic', 'storeroom',
  'front room', 'parlor', 'parlour', 'hall', 'hallway', 'workshop', 'study',
  'larder', 'scullery', 'loft', 'stable', 'cloakroom',
];
const ROOM_NOUN_RE = new RegExp(`\\b(${ROOM_IDENTITY_NOUNS.join('|')})\\b`, 'i');

function normRoomNoun(n) {
  const lower = n.toLowerCase();
  if (lower === 'bedroom') return 'bedchamber';
  if (lower === 'parlour') return 'parlor';
  return lower;
}

export function detectPlaceDesync(sessionTurns) {
  const flags = [];
  let prevRoomId = null;
  let prevRoomName = null;
  for (const t of sessionTurns) {
    const canon = t.canon || {};
    const dm = t.dm || '';
    const player = t.player || '';
    const hasInterior = 'interior' in canon;
    if (!hasInterior) { prevRoomId = null; prevRoomName = null; continue; } // dormant — no ground truth

    const interior = canon.interior;
    const roomId = interior?.roomId ?? null;
    const roomName = interior?.roomName ?? null;

    // ── CG-2a: place-noun vs roomName ──────────────────────────────────────
    if (roomName) {
      const match = dm.match(ROOM_NOUN_RE);
      if (match) {
        const narratedNoun = normRoomNoun(match[1]);
        const canonNoun = normRoomNoun(roomName);
        if (narratedNoun !== canonNoun) {
          flags.push(pointer({
            cls: 'CG-2a', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
            canonField: 'interior.roomName', expected: roomName, narrated: match[1],
            severity: SEVERITY.FAIL,
          }));
        }
      }
    }

    // ── CG-2c: unnarrated relocation ───────────────────────────────────────
    if (prevRoomId !== null && roomId !== null && roomId !== prevRoomId) {
      const futureOnly = FUTURE_MOTION.test(`${player} ${dm}`);
      const playerMoved = !futureOnly && MOVE_INTENT_RE.test(player);
      const dmMoved = !futureOnly && MOVE_INTENT_RE.test(dm);
      const mechanicsMoved = /\b(move|moved|travel|enter|entered|nav|egress)\b/i.test(t.mechanics || '');
      if (!playerMoved && !dmMoved && !mechanicsMoved) {
        flags.push(pointer({
          cls: 'CG-2c', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
          canonField: 'interior.roomId', expected: `unchanged from "${prevRoomName}" (${prevRoomId})`,
          narrated: `roomId flipped to "${roomName}" (${roomId}) with no movement intent`,
          severity: SEVERITY.FAIL,
        }));
      }
    }

    prevRoomId = roomId;
    prevRoomName = roomName;
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// CG-2b — invented exit/stair/door (CG-P4: docs/briefs/COHERENCE_GATE.md §7)
//
// Narration asserts a compass-directional exit (a door/doorway/stairs/passage/
// corridor "to the north/east/south/west", or "the northern door", etc.) that
// the room's REAL topology (canon.roomExits — CG-P4's bundle addition, built
// from engine/structures/topology.js's interiorExitsFrom, the same reciprocal
// compass the live movement code itself walks) does not have. This is the
// "invented stairway" class §1 names directly.
//
// PRECISION-FIRST, deliberately narrow:
//   - Only fires on an EXIT-TYPE noun bound to a COMPASS direction in the same
//     clause — a bare "a door" with no direction is not checkable.
//   - DORMANT (never a false flag) when `roomExits` is absent from the bundle
//     entirely (pre-CG-P4 JSONLs) OR when the player is not `inside` this turn.
//   - GUARD: only flags when the compass slot canon.roomExits reports is
//     GENUINELY absent (no key for that direction at all).
// ═════════════════════════════════════════════════════════════════════════════

const COMPASS_WORDS = { north: 'north', northern: 'north', south: 'south', southern: 'south', east: 'east', eastern: 'east', west: 'west', western: 'west' };
const EXIT_NOUN_RE = '(?:door(?:way)?|stairs?|staircase|stairway|passage(?:way)?|corridor|hall(?:way)?|exit)';
// "a door to the north" / "stairs leading north" / "the northern door" / "an exit to the east"
const EXIT_DIR_RE = new RegExp(
  `\\b${EXIT_NOUN_RE}\\b[^.!?]{0,25}\\b(north|south|east|west)(?:ern)?\\b` +
  `|\\b(north|south|east|west)(?:ern)?\\b[^.!?]{0,25}\\b${EXIT_NOUN_RE}\\b`,
  'i',
);

export function detectExitDesync(sessionTurns) {
  const flags = [];
  for (const t of sessionTurns) {
    const canon = t.canon || {};
    const dm = t.dm || '';
    const hasRoomExits = 'roomExits' in canon; // bundle-shape gate — dormant if absent (CG-P4 not yet fed)
    if (!hasRoomExits) continue;
    const inside = canon.interior != null;
    if (!inside) continue; // roomExits is an interior-only view; outdoor exits are a different surface
    const roomExits = canon.roomExits && typeof canon.roomExits === 'object' ? canon.roomExits : null;
    if (!roomExits) continue; // no interior structure this turn — nothing to compare

    const match = dm.match(EXIT_DIR_RE);
    if (!match) continue;
    const rawDir = (match[1] || match[2] || '').toLowerCase();
    const dir = COMPASS_WORDS[rawDir] || COMPASS_WORDS[rawDir + 'ern'] || rawDir;
    if (!dir) continue;

    if (!roomExits[dir]) {
      flags.push(pointer({
        cls: 'CG-2b', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
        canonField: 'roomExits', expected: `no real exit ${dir} (room graph has none there)`,
        narrated: `an exit/door/stairway narrated to the ${dir}`,
        severity: SEVERITY.FAIL,
      }));
    }
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// CG-ARCH — invented architecture (MR-2b: docs/briefs/MR-2-FUNCTIONAL-INK.md §2b)
//
// The historical ROOT bug class (docs/playtests/harness/WHOLE_BUILDING_FINDINGS.md
// WB-Q1, project_dm_invents_geography): the live DM narrates ROOMS, STAIRS, and
// FLOORS the building does not have — "a narrow staircase climbs to the upper
// floor", "the cellar below", "the sleeping quarters overhead" in a single-storey
// 3-room cottage — so the player navigates a fiction the engine can't honor and
// SOFT-LOCKS (turns 7-9/17/21/23 of that playtest). MR-2a made a structure's
// architecture CANON (rooms + doors + front door); this comparator closes the
// coherence loop: an architecture noun the plan can't back ⇒ FAIL.
//
// WHY CG-2b IS NOT ENOUGH (the gap this fills, proven in the repro): CG-2b
// (detectExitDesync) only fires on an exit noun bound to a COMPASS direction
// ("a door to the NORTH"). The archetypal WB-Q1 line carries NO compass —
// "a narrow staircase climbs to the upper floor ABOVE" — and CG-2b misses it
// entirely. CG-2a (place-noun) catches a wrong CURRENT-room noun, not an
// invented SECOND space; and only for the ~18 nouns that happen to sit in its
// list (it misses "staircase", "upper floor", "loft", "wing", "balcony"). This
// class is the dedicated architecture-presence check keyed off the STRUCTURE's
// real room roster (canon.roomPlan), not just the current room.
//
// GROUND TRUTH: canon.roomPlan (rubric.js buildCanonGroundTruth, this packet) —
//   { rooms: string[] (every room name the structure HAS), singleStorey: bool }
// DORMANT (never a false flag) when roomPlan is absent from the bundle
// (pre-MR-2b JSONLs, or any outdoor turn — no structure to check) OR when the
// PC is not `inside` this turn. Same P-B graceful-degradation discipline as the
// rest of the bank.
//
// PRECISION-FIRST — conservative by construction (under-flagging is the correct
// failure direction for a gate). Two tiers of claim, both requiring a DEFINITE/
// existential reference ("the cellar", "a staircase") so a mood image never
// fires:
//
//   (A) VERTICAL/MULTI-STOREY nouns — staircase/stairs/stairway/upper floor/
//       second storey/cellar/basement/attic/loft/mezzanine/balcony. A structure
//       the bundle marks singleStorey (the wake cottage, every cottage/home in
//       the slice) categorically has NONE of these. This is the WB-Q1 killer and
//       is NEVER legitimate atmosphere — a single-storey building has no "floor
//       above". Fires whenever a definite/existential vertical noun appears and
//       singleStorey is true.
//
//   (B) ROOM-TYPE nouns bound to a DEFINITE article ("the kitchen", "the
//       pantry", "the vestry") that name a room the structure's roster does NOT
//       contain. Uses the SAME ROOM_IDENTITY_NOUNS lexicon CG-2a already trusts,
//       but the test is roster-membership across the WHOLE structure, not the
//       current-room name. A room the plan HAS (case/space-insensitive contains)
//       never fires — the cottage's own "Bedchamber"/"Pantry"/"Hearth Room" are
//       legal. Only a DEFINITE reference counts ("THE cellar", not "a cellar"
//       spoken hypothetically, and not a bare mention) — precision over recall.
//
// FALSE-POSITIVE GUARDS (U508 negative suite locks these):
//   - mood/atmosphere language ("shadowed alcoves", "dim corners", "the far
//     end", "the back of the room") carries no architecture noun → never fires;
//   - a NEGATED/ABSENT claim ("there is no cellar here", "no stairs lead up")
//     is the DM correctly DENYING invented space — the WB-Q1 fix's success
//     signal — and must never be flagged as if it asserted the space;
//   - a room the structure genuinely has is always legal, even multi-word
//     ("hearth room"), matched against the roster.
// ═════════════════════════════════════════════════════════════════════════════

// (A) Vertical / multi-storey architecture nouns — a single-storey building has
// none of these BY CONSTRUCTION. Deliberately high-specificity: each is a
// navigable second space, never a mood word.
const VERTICAL_ARCH_NOUNS = [
  'staircase', 'stairway', 'stairs', 'stair', 'upper floor', 'upper storey',
  'upper story', 'second floor', 'second storey', 'second story', 'upstairs',
  'cellar', 'basement', 'attic', 'loft', 'mezzanine', 'balcony',
  'floor above', 'storey above', 'story above', 'room above', 'level below',
  'floor below',
];
// A definite/existential lead so a bare metaphor doesn't trip it: "the/a/an" or
// an existential "there is/stands/climbs/leads" within a short window before the
// noun. Vertical nouns are specific enough that this stays conservative. The
// SECOND alternative (noun immediately followed by above/overhead/below/up/down)
// catches "stairs up", "the floor above" phrasings without a leading article.
const VERTICAL_ARCH_RE = new RegExp(
  `\\b(?:the|a|an|another|its?|his|her|their)\\s+(?:[a-z]+\\s+){0,2}(?:${VERTICAL_ARCH_NOUNS.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b` +
  `|\\b(?:${VERTICAL_ARCH_NOUNS.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s+(?:above|overhead|below|beneath|underfoot|up|down)\\b`,
  'i',
);

// A DEFINITE room-type reference: "the <room noun>". We reuse ROOM_IDENTITY_NOUNS
// (defined below with CG-2a) via a lazily-built regex so the two comparators
// share one lexicon. Only a definite article counts (an indefinite "a kitchen"
// or a bare mention is not an assertion that THIS structure contains one).
let _DEFINITE_ROOM_RE = null;
function definiteRoomRe() {
  if (!_DEFINITE_ROOM_RE) {
    _DEFINITE_ROOM_RE = new RegExp(`\\bthe\\s+(${ROOM_IDENTITY_NOUNS.join('|')})\\b`, 'ig');
  }
  return _DEFINITE_ROOM_RE;
}

// Negation/absence guard: the DM DENYING invented space ("there is no cellar",
// "no stairs lead anywhere", "nothing above", "no way down", "single storey, no
// upstairs") is the WB-Q1 FIX working, not a violation. Whole-line here: a
// single narrated sentence that denies vertical space is the fix's own success
// signal. Covers denials in BOTH directions (up: staircase/upper floor; down:
// cellar/basement/way down) and the explicit "no way up/down/further" idioms.
const ARCH_NEGATION_RE = /\bno\s+(?:other\s+)?(?:stair|stairs|staircase|stairway|cellar|basement|attic|loft|upper|second\s+(?:floor|storey|story)|balcony|mezzanine|floor\s+above|way\s+(?:up|down|below|further))\b|\bnothing\s+(?:above|below|overhead|upstairs|beneath)\b|\b(?:nothing|no\s+way)\s+leads?\s+(?:up|down|below)\b|\bsingle[- ]stor(?:e?y)\b|\bone\s+floor\b|\bno\s+(?:upstairs|way\s+up|way\s+down|second\s+floor)\b|\bnowhere\s+(?:up|down|above|below|to\s+climb|to\s+descend)\b|\b(?:solid|bare)\s+(?:earth|ground|stone|floor)\b/i;

// Does the structure's real room roster contain a room whose name matches this
// narrated room noun? Case- and space-insensitive substring both ways so
// "bedchamber" matches "Bedchamber" and "hearth room" matches "Hearth Room".
function rosterHasRoom(rooms, narratedNoun) {
  const want = normRoomNoun(narratedNoun).replace(/\s+/g, '');
  if (!want) return true; // empty noun can't be a violation
  for (const rn of rooms) {
    const have = String(rn || '').toLowerCase().replace(/\s+/g, '');
    if (!have) continue;
    if (have.includes(want) || want.includes(have)) return true;
  }
  return false;
}

// Tier-A roster precedence: does the matched vertical-noun SPAN name a real room
// of the structure? Some vertical nouns are also legitimate room roles ("Loft",
// "Cellar", "Attic" can be real rooms in a roster). If the roster contains a
// room whose (space-collapsed, lowercased) name equals one of the matched
// vertical nouns, the narration is describing a canon room, not inventing a
// floor. Only an EXACT roster-name match counts here (not the loose substring
// rosterHasRoom uses) so "Hearth Room" never launders "stairs".
function rosterHasVerticalNoun(rooms, matchedSpan) {
  const span = String(matchedSpan || '').toLowerCase();
  const roomSet = new Set(rooms.map(r => String(r || '').toLowerCase().replace(/\s+/g, '')));
  if (!roomSet.size) return false;
  for (const noun of VERTICAL_ARCH_NOUNS) {
    if (!span.includes(noun)) continue;
    if (roomSet.has(noun.replace(/\s+/g, ''))) return true;
  }
  return false;
}

export function detectArchitectureDesync(sessionTurns) {
  const flags = [];
  for (const t of sessionTurns) {
    const canon = t.canon || {};
    const dm = t.dm || '';
    const hasRoomPlan = 'roomPlan' in canon && canon.roomPlan && typeof canon.roomPlan === 'object';
    if (!hasRoomPlan) continue; // dormant — no structure ground truth (pre-MR-2b / outdoor)
    const inside = canon.interior != null;
    if (!inside) continue; // architecture claims are an interior-only surface
    const plan = canon.roomPlan;
    const rooms = Array.isArray(plan.rooms) ? plan.rooms : [];
    const singleStorey = plan.singleStorey === true;

    // The absence guard is whole-line here (a single narrated sentence that
    // DENIES upstairs/cellar is the fix working — never read it as an
    // assertion). If the line fundamentally denies vertical space, no
    // vertical-tier flag can fire from it.
    const isDenial = ARCH_NEGATION_RE.test(dm);

    // ── Tier A: vertical / multi-storey space in a single-storey building ────
    // ROSTER PRECEDENCE (precision guard): a vertical noun that IS a named room
    // of THIS structure ("Loft", "Cellar" when the plan genuinely lists one) is
    // canon, not invented — the roster wins. Only fire when the matched noun
    // does NOT correspond to a real room the plan contains.
    if (singleStorey && !isDenial) {
      const m = dm.match(VERTICAL_ARCH_RE);
      if (m && !rosterHasVerticalNoun(rooms, m[0])) {
        flags.push(pointer({
          cls: 'CG-ARCH', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
          canonField: 'roomPlan.singleStorey',
          expected: 'single storey — no stairs, upper floor, cellar, attic, or loft',
          narrated: `invented vertical architecture: "${snippet(m[0], 40)}"`,
          severity: SEVERITY.FAIL,
        }));
        continue; // one architecture flag per turn is enough to reject; don't double-count
      }
    }

    // ── Tier B: a DEFINITE room-type noun the structure's roster lacks ───────
    const re = definiteRoomRe();
    re.lastIndex = 0;
    let rm;
    while ((rm = re.exec(dm)) !== null) {
      const noun = rm[1];
      if (rosterHasRoom(rooms, noun)) continue; // the plan HAS this room — legal
      // The current room's own name is always legal even if the roster read
      // missed it (defensive): the interior.roomName is ground truth too.
      const curName = canon.interior?.roomName;
      if (curName && rosterHasRoom([curName], noun)) continue;
      flags.push(pointer({
        cls: 'CG-ARCH', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
        canonField: 'roomPlan.rooms',
        expected: `a room the structure has (${rooms.join(', ') || 'none'})`,
        narrated: `invented room: "the ${noun}"`,
        severity: SEVERITY.FAIL,
      }));
      break; // one is enough
    }
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// CG-3a — object phantom-commit
//
// Narration asserts an IRREVERSIBLE physical change (forced lid, splintered
// wood, shattered glass/window, broken lock, torn open) while the mechanics
// line shows a NON-COMMITTAL route: `info-check → no-record`, `deltas:0`, an
// explicit "no roll" tag, or the route is empty/absent of any roll/delta stamp.
// This is a lower bound by construction — it only fires when the mechanics
// line is legible and unambiguous about committing nothing.
// ═════════════════════════════════════════════════════════════════════════════

const COMMIT_VERB_RE = /\b(?:it\s+)?(?:gives?|gave)\s+(?:way|at last)\b|\bwood\s+splinters?\b|\bsplinters?\s+(?:apart|open)\b|\bshatters?\b|\bbreaks?\s+open\b|\bforces?\s+(?:it\s+)?open\b|\bbursts?\s+open\b|\bsnaps?\s+open\b|\btears?\s+(?:it\s+)?open\b/i;

const NON_COMMIT_ROUTE_RE = /info-check\s*→\s*no-record|deltas:0\b|no\s+roll\b|nothing\s+grounded\s+to\s+deliver/i;

export function detectObjectPhantomCommit(sessionTurns) {
  const flags = [];
  for (const t of sessionTurns) {
    const dm = t.dm || '';
    const mechanics = t.mechanics || '';
    if (!COMMIT_VERB_RE.test(dm)) continue;
    if (!mechanics) continue; // no mechanics line to compare against — can't confirm, stay silent (precision-over-recall)
    if (NON_COMMIT_ROUTE_RE.test(mechanics)) {
      flags.push(pointer({
        cls: 'CG-3a', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
        canonField: 'mechanics (route)', expected: 'a committing route (roll/deltas>0) to justify a physical change',
        narrated: `irreversible-change verb asserted while mechanics = "${snippet(mechanics, 80)}"`,
        severity: SEVERITY.FAIL,
      }));
    }
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// CG-4 — combat/health mirror
//
// Narrated death claim vs `enemies[].defeated`/absence; "unscathed/fine" while
// pc.hp visibly dropped (via the mechanics pcHp:A->B stamp); combat narrated
// (strike/hit language) while `inCombat:false`.
// ═════════════════════════════════════════════════════════════════════════════

// provenance: oracles.js DEATH_CLAIM (reused above as DEATH_CLAIM_RE).
const UNSCATHED_RE = /\b(?:unscathed|unharmed|untouched|no worse for (?:it|wear)|(?:you'?re|you are)\s+fine)\b/i;
const HP_DROP_RE = /pcHp:(\d+)->(\d+)/;
const STRIKE_RE = /\[strike:|\[enemy:.*atk:\d+\s+vs\s+AC:\d+/i;

export function detectCombatDesync(sessionTurns) {
  const flags = [];
  for (const t of sessionTurns) {
    const canon = t.canon || {};
    const dm = t.dm || '';
    const mechanics = t.mechanics || '';

    // death claim vs enemies[] — only fires when we have an enemies[] list to
    // check against (bundle always carries `enemies`, but guard anyway).
    if (Array.isArray(canon.enemies) && DEATH_CLAIM_RE.test(dm)) {
      const anyDefeated = canon.enemies.some(e => e && (e.defeated === true || /defeated|dead|slain/i.test(e.status || '')));
      const combatVictory = /combat:victory/i.test(mechanics);
      if (!anyDefeated && !combatVictory && canon.enemies.length > 0) {
        flags.push(pointer({
          cls: 'CG-4', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
          canonField: 'enemies[]', expected: 'a defeated enemy or [combat:victory] tag',
          narrated: 'death/kill claim with no matching defeat in canon or mechanics',
          severity: SEVERITY.FAIL,
        }));
      }
    }

    // "unscathed" while mechanics shows an HP drop this turn
    const hpMatch = mechanics.match(HP_DROP_RE);
    if (UNSCATHED_RE.test(dm) && hpMatch && Number(hpMatch[2]) < Number(hpMatch[1])) {
      flags.push(pointer({
        cls: 'CG-4', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
        canonField: 'pc.hp', expected: `hp dropped ${hpMatch[1]}->${hpMatch[2]} per mechanics`,
        narrated: 'DM narrates "unscathed/fine" the same turn',
        severity: SEVERITY.FAIL,
      }));
    }

    // combat narrated (a strike/attack-roll tag is present) while inCombat:false
    // — GUARD: a strike tag that itself ends the fight this turn
    // (combat:victory / combat:dying / the enemy just got marked defeated) is
    // NOT a desync — inCombat correctly reads false the instant the fight it
    // just resolved is over. Only fire when the strike tag carries no
    // resolution marker, i.e. combat is narrated as ongoing/mid-fight while
    // canon already says it isn't.
    const combatResolvedThisTurn = /combat:(?:victory|dying|defeat)/i.test(mechanics);
    if (STRIKE_RE.test(mechanics) && canon.inCombat === false && !combatResolvedThisTurn) {
      flags.push(pointer({
        cls: 'CG-4', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
        canonField: 'inCombat', expected: 'true (a strike/attack roll was recorded this turn)',
        narrated: 'inCombat is false while mechanics carries a strike/attack-roll tag',
        severity: SEVERITY.WARN, // WARN: escape-mode combat can legitimately resolve inCombat same-turn; see design §3 CG-4 note
      }));
    }
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// CG-DEATH — the killing-blow prose ⇄ death-fact mirror (DEATH-3,
// docs/DEATH_CONTRACT.md §3 final bullet + §6 falsifiers).
//
// Every kill first assembles a deterministic DEATH FACT (engine/combat/deathFact.js,
// invariant I: "the fact precedes the prose"); the killing-blow prose is voiced FROM it
// and MAY NOT contradict it. This comparator diffs the DM's kill line against that same
// turn's fact (canon.deathFact, projected by buildCanonGroundTruth). The §6 falsifiers it
// makes measurable — each a STRUCTURAL contradiction (a table-breaking lie about how the
// foe actually died, not an atmospheric slip):
//   (A) MEANS contradiction — the prose narrates a killing means from a DIFFERENT weapon
//       family than the fact records (an arrow/piercing fact read as an axe/cutting kill,
//       a fire fact read as a blade). "an arrow fact never reads as an axe" (the brief).
//   (B) BEG FROM THE SPEECHLESS — the prose puts a plea in the mouth of a foe the fact
//       marks canCommunicate:false (a beast/mindless thing). "a beg from a non-communicator
//       = red" (§6). DEATH-2 gates the STATE; the prose layer must not conjure the plea.
//   (C) BEG FROM THE UN-BEGGED — the prose narrates the foe begging/pleading for life while
//       the fact's stance is NOT 'begging' (a plea the fact does not hold — §6).
//   (D) MERCY READ AS TORTURE — intent:'mercy' (a clean, quick end) narrated as torture /
//       mutilation / a drawn-out cruel death. "a 'clean mercy' fact never reads as torture"
//       (the brief).
//   (E) WORSE READ AS GENTLE — intent:'worse' (the example-making) narrated as a painless /
//       gentle / merciful end (the inverse of D).
//
// DORMANT (no false flag) when canon.deathFact is absent/null (no kill this world, or a
// pre-DEATH-3 bundle) — the graceful-degradation contract every comparator here honors.
// PRECISION OVER RECALL: each branch requires clear lexical evidence in the prose and
// fires only on a genuine cross-family / cross-intent contradiction — never on ambiguity.
// ═════════════════════════════════════════════════════════════════════════════

// Means families → words that UNAMBIGUOUSLY belong to ONE family. A prose hit in a family
// OTHER than the fact's is the (A) contradiction. Only DISAMBIGUATING vocabulary is listed:
//   • the three physical families carry their distinct weapon NOUNS + signature verbs
//     (axe/sword vs arrow/spear vs mace/hammer) — a weapon-noun swap is the archetypal
//     contradiction the brief names ("an arrow fact never reads as an axe").
//   • the elemental families carry ONLY tokens unique to them. Shared imagery — "burn",
//     "sear", "scorch", "arc" read as BOTH fire and lightning; "freeze" ↔ cold's own set —
//     is DELIBERATELY excluded, so an honest lightning line ("burns through... a scorched
//     path") is never mis-read as a fire kill (precision over recall — a genuinely
//     ambiguous elemental verb is not a cross-family lie).
const MEANS_FAMILY_WORDS = Object.freeze({
  slashing:    /\b(?:axe|ax|sword|blade|sabre|saber|scimitar|cleaver|slash(?:es|ed|ing)?|hack(?:s|ed|ing)?|sever(?:s|ed|ing)?|cut(?:s|ting)?\s+(?:open|through|down)|beheads?|decapitat\w+)\b/i,
  piercing:    /\b(?:arrow|bolt|spear|lance|rapier|dagger|dirk|stiletto|javelin|pike|impale(?:s|d)?|skewer(?:s|ed)?|run\s+through|pierc(?:es|ed|ing)?)\b/i,
  bludgeoning: /\b(?:mace|hammer|maul|club|cudgel|flail|bludgeon(?:s|ed|ing)?|crush(?:es|ed|ing)?|smash(?:es|ed|ing)?|caves?\s+in|shatter(?:s|ed|ing)?\s+(?:bone|skull))\b/i,
  fire:        /\b(?:flame|flames|immolat\w+|inferno)\b/i,
  cold:        /\b(?:ice|frost|frozen|glaci\w+|rime)\b/i,
  lightning:   /\b(?:lightning|thunderbolt|electrocut\w+)\b/i,
});
// A means word from ANY of these families present in the prose (so (A) only fires when the
// prose actually commits to some named family, and only if it's the WRONG one).
const ANY_MEANS_WORD = Object.freeze(Object.entries(MEANS_FAMILY_WORDS));

// (B)/(C) — the foe pleading in the prose. Precision: an ACTUAL beg/plea claim, not a mere
// mention of the word "mercy" by the narrator (the player showing mercy is not the foe
// begging). Requires the foe as the one asking/pleading/yielding.
const FOE_PLEADS_RE = /\b(?:begs?|begg(?:ed|ing)|pleads?|plead(?:ed|ing)|implor(?:es|ed|ing)|beseech(?:es|ed|ing)|(?:cries|cried|whimpers?|whispers?)\s+for\s+(?:mercy|life|its?\s+life|his\s+life|her\s+life|their\s+life)|yields?|yielded|yielding|(?:asks?|asked|begs?)\s+(?:you\s+)?(?:for\s+)?(?:mercy|to\s+be\s+spared|for\s+(?:its?|his|her|their)\s+life))\b/i;

// (D) — torture/mutilation/drawn-out cruelty in the prose (a mercy fact must never read
// like this). Deliberate-cruelty vocabulary; a plain gory wound is NOT torture (precision).
const TORTURE_RE = /\b(?:tortur(?:es|ed|ing|e)|mutilat\w+|maim(?:s|ed|ing)?|dismember\w+|flay(?:s|ed|ing)?|disembowel\w+|slow(?:ly)?\s+(?:and\s+)?(?:cruel|painful|agoni\w+)|draw(?:s|n)?\s+(?:it|this|the\s+\w+)\s+out|make(?:s)?\s+(?:it|him|her|them)\s+(?:suffer|scream)|piece\s+by\s+piece|savag(?:es|ed|ely)|butcher(?:s|ed|ing)?)\b/i;

// (E) — a painless/gentle/merciful end in the prose (a "worse" fact must never read like
// this). Precision: language that AFFIRMS gentleness/painlessness, not a bare "quick".
const GENTLE_END_RE = /\b(?:painless(?:ly)?|without\s+(?:pain|suffering|malice|cruelty)|mercifully|a\s+(?:merciful|gentle|kind)\s+(?:death|end|blow|stroke)|gently|no\s+cruelty(?:\s+in\s+it)?|spared\s+(?:it|him|her|them)\s+the\s+pain|peaceful(?:ly)?)\b/i;

export function detectKillingBlowDesync(sessionTurns) {
  const flags = [];
  for (const t of sessionTurns) {
    const canon = t.canon || {};
    const df = canon.deathFact;
    if (!df || typeof df !== 'object') continue; // no kill / pre-DEATH-3 bundle → dormant
    const dm = String(t.dm || '');
    if (!dm.trim()) continue;

    // (A) MEANS contradiction — the prose commits to a named weapon family OTHER than the
    // fact's. Only fires when the fact's own family is one we can name AND the prose names
    // a DIFFERENT one; a family-neutral kill line (no named means) never triggers.
    const factFamily = String(df.meansType || '').toLowerCase();
    if (MEANS_FAMILY_WORDS[factFamily]) {
      for (const [fam, re] of ANY_MEANS_WORD) {
        if (fam === factFamily) continue;
        // Guard: don't flag a fact-family word that also appears (e.g. prose names BOTH the
        // real means and, incidentally, another) — only fire when the prose names a wrong
        // family and does NOT name the right one (it truly swapped the weapon).
        if (re.test(dm) && !MEANS_FAMILY_WORDS[factFamily].test(dm)) {
          flags.push(pointer({
            cls: 'CG-DEATH', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
            canonField: 'deathFact.meansType', expected: `a ${factFamily} killing means (fact: "${df.means}")`,
            narrated: `prose narrates a ${fam} means instead`,
            severity: SEVERITY.FAIL,
          }));
          break; // one means contradiction per turn is enough
        }
      }
    }

    // (B) BEG FROM THE SPEECHLESS — the fact marks the foe unable to communicate, yet the
    // prose has it pleading. A beast/mindless thing dies without speech (§6).
    if (df.canCommunicate === false && FOE_PLEADS_RE.test(dm)) {
      flags.push(pointer({
        cls: 'CG-DEATH', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
        canonField: 'deathFact.canCommunicate', expected: 'no plea — the foe cannot speak',
        narrated: 'prose has a speechless foe begging/pleading',
        severity: SEVERITY.FAIL,
      }));
    }
    // (C) BEG FROM THE UN-BEGGED — the foe COULD speak but the fact records no beg (stance
    // is not 'begging'), yet the prose narrates it begging for life (a plea the fact lacks).
    else if (df.stance !== 'begging' && FOE_PLEADS_RE.test(dm)) {
      flags.push(pointer({
        cls: 'CG-DEATH', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
        canonField: 'deathFact.victimStance', expected: `stance "${df.stance}" — the foe made no plea`,
        narrated: 'prose narrates the foe begging/pleading it never did',
        severity: SEVERITY.FAIL,
      }));
    }

    // (D) MERCY READ AS TORTURE — a clean, merciful end narrated as deliberate cruelty.
    if (df.intent === 'mercy' && TORTURE_RE.test(dm)) {
      flags.push(pointer({
        cls: 'CG-DEATH', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
        canonField: 'deathFact.killerIntent', expected: 'a clean, merciful death (intent: mercy)',
        narrated: 'prose narrates torture/mutilation/a drawn-out cruel end',
        severity: SEVERITY.FAIL,
      }));
    }
    // (E) WORSE READ AS GENTLE — the example-making narrated as a painless/merciful end.
    else if (df.intent === 'worse' && GENTLE_END_RE.test(dm)) {
      flags.push(pointer({
        cls: 'CG-DEATH', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
        canonField: 'deathFact.killerIntent', expected: 'the slow/savage example-making (intent: worse)',
        narrated: 'prose narrates a painless/gentle/merciful end',
        severity: SEVERITY.FAIL,
      }));
    }
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// CG-5 — identity/addressee desync
//
// Player addresses NPC X by name or role-reference; mechanics dialogue-bind
// names Y (`[dialogue enter | Y ...]`) and/or the DM voices Y directly. Only
// fires when the player line names (or clearly singles out) an NPC different
// from the mechanics dialogue-bind target — the lore-hound t6 case: player asks
// "The Lingerer — what's your name…", mechanics binds Asha, DM voices Asha.
// ═════════════════════════════════════════════════════════════════════════════

const DIALOGUE_BIND_RE = /\[dialogue\s+enter\s*\|\s*([^|\]]+)/i;

// A conservative set of ways a player line singles out a specific NPC referent
// distinct from a bare "ask" — precision-first: only fires when the player line
// itself contains a proper name or "the <epithet>" the roster uses. Case-
// insensitive on purpose: sentence-initial position capitalizes epithet
// referents ("The Lingerer — what's your name…") even though the roster spells
// them lowercase ("the Lingerer") — this is orthography, not a different
// referent, so a strict-case match would silently miss the exact addressee
// class this comparator exists to catch.
function extractAddressedReferent(player, rosterNames) {
  const playerLower = player.toLowerCase();
  for (const name of rosterNames) {
    if (!name) continue;
    if (playerLower.includes(name.toLowerCase())) return name;
  }
  return null;
}

export function detectAddresseeDesync(sessionTurns) {
  const flags = [];
  for (const t of sessionTurns) {
    const player = t.player || '';
    const dm = t.dm || '';
    const mechanics = t.mechanics || '';
    const canon = t.canon || {};
    const npcsPresent = (canon.npcsPresent || []).map(n => n.name).filter(Boolean);
    if (npcsPresent.length === 0) continue;

    const bindMatch = mechanics.match(DIALOGUE_BIND_RE);
    if (!bindMatch) continue;
    const boundName = bindMatch[1].trim();

    const addressed = extractAddressedReferent(player, npcsPresent);
    if (!addressed) continue; // player didn't name anyone specific — nothing to compare
    if (addressed === boundName) continue; // matches — no desync

    // Guard: only flag when the DM's own reply voices the BOUND name (not the
    // addressed one) — otherwise a mechanics-bind mismatch could be a metadata
    // quirk rather than a player-visible desync. Precision over recall.
    if (dm.includes(boundName)) {
      flags.push(pointer({
        cls: 'CG-5', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
        canonField: 'mechanics (dialogue-bind)', expected: `addressee "${addressed}"`,
        narrated: `mechanics bound + DM voiced "${boundName}" instead`,
        severity: SEVERITY.FAIL,
      }));
    }
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// CG-7 — ungrounded quantity/provenance
//
// A cited headcount ("N of you", "the five of us", "three people here") that
// contradicts the roster size in canon (npcsPresent / roomOccupants, scoped the
// same way CG-1 is). Low frequency by design (the judge's own carve-outs
// already tame false-positives here) — kept narrow and literal.
// ═════════════════════════════════════════════════════════════════════════════

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
const HEADCOUNT_RE = /\b(\d+|one|two|three|four|five|six|seven|eight)\s+(?:people|figures|others|npcs?)\s+(?:here|present|in (?:this|the) room)\b/i;

export function detectQuantityDesync(sessionTurns) {
  const flags = [];
  for (const t of sessionTurns) {
    const canon = t.canon || {};
    const dm = t.dm || '';
    const match = dm.match(HEADCOUNT_RE);
    if (!match) continue;
    const raw = match[1].toLowerCase();
    const cited = NUMBER_WORDS[raw] ?? Number(raw);
    if (!Number.isFinite(cited)) continue;

    const hasInterior = 'interior' in canon;
    const inside = hasInterior && canon.interior != null;
    const roster = inside && Array.isArray(canon.roomOccupants) ? canon.roomOccupants
      : (!inside ? (canon.npcsPresent || []) : null);
    if (!roster) continue; // dormant — no scoped roster to check against

    if (cited !== roster.length) {
      flags.push(pointer({
        cls: 'CG-7', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
        canonField: inside ? 'roomOccupants' : 'npcsPresent', expected: `${roster.length}`,
        narrated: `cited count: ${cited}`, severity: SEVERITY.WARN,
      }));
    }
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// CG-6 — temporal desync (CG-P4: docs/briefs/COHERENCE_GATE.md §7)
//
// Narrated time-of-day contradicts `canon.clock.segment` — the SAME clock the
// live "what time is it" meta-answer already gives a player
// (engine/grace/gracefulAdjudication.js META_TIME branch; CG-P4 mirrors that
// exact bucketing into the bundle so this is one clock, not a second one
// invented for the judge). Segments: "the small hours" (00:00-05:59), morning
// (06:00-11:59), afternoon (12:00-16:59), evening (17:00-20:59), "deep night"
// (21:00-23:59).
//
// PRECISION-FIRST: a broad but literal lexicon maps common narrated
// time-phrases to ONE of the five canonical buckets; a bucket collision (DM
// says "midnight", canon says "morning") fires FAIL. Ambiguous/ narrow phrases
// that could span buckets ("later", "before long") are deliberately excluded.
//
// DORMANT when `clock` is absent from the bundle (pre-CG-P4 JSONLs).
// ═════════════════════════════════════════════════════════════════════════════

// Narrated phrase -> canonical segment bucket (matches timeOfDayGroundTruth's
// exact five buckets in engine/ref/rubric.js). Only unambiguous, single-bucket
// phrases are listed; anything that could plausibly span two buckets is left
// out on purpose (precision over recall).
const TIME_PHRASE_TO_SEGMENT = [
  [/\b(?:the\s+)?small\s+hours\b/i, 'the small hours'],
  [/\bmidnight\b/i, 'the small hours'],
  [/\bpredawn\b|\bpre-dawn\b/i, 'the small hours'],
  [/\bdawn\b|\bdaybreak\b|\bfirst\s+light\b|\bsunrise\b/i, 'morning'],
  [/\bmorning\b/i, 'morning'],
  [/\bmidday\b|\bnoon\b/i, 'afternoon'],
  [/\bafternoon\b/i, 'afternoon'],
  [/\bdusk\b|\bsunset\b|\btwilight\b/i, 'evening'],
  [/\bevening\b/i, 'evening'],
  [/\bdeep\s+night\b|\blate\s+night\b/i, 'deep night'],
  [/\bnightfall\b/i, 'evening'],
];

function narratedSegment(dm) {
  for (const [re, seg] of TIME_PHRASE_TO_SEGMENT) {
    if (re.test(dm)) return seg;
  }
  return null;
}

export function detectTemporalDesync(sessionTurns) {
  const flags = [];
  for (const t of sessionTurns) {
    const canon = t.canon || {};
    const dm = t.dm || '';
    const hasClock = 'clock' in canon && canon.clock && typeof canon.clock === 'object';
    if (!hasClock) continue; // dormant — no clock ground truth in the bundle (pre-CG-P4)
    const canonSegment = canon.clock.segment;
    if (!canonSegment) continue;

    const narrated = narratedSegment(dm);
    if (!narrated) continue;
    if (narrated !== canonSegment) {
      flags.push(pointer({
        cls: 'CG-6', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
        canonField: 'clock.segment', expected: canonSegment, narrated,
        severity: SEVERITY.FAIL,
      }));
    }
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// §0 — forbidden-token scan (the cosmology must never surface in-world)
//
// A pure grep for named cosmology terms that IMMORTAL_INVARIANTS / the Idea
// Garden's §0 law forbid the DM from ever saying to a player (docs/IDEA_GARDEN.md
// IG-1/IG-8: "the world's true metaphysics is never surfaced in-world" — only
// symptoms, faith, rumor). Deliberately conservative: multi-word,
// high-specificity phrases only, to avoid flagging ordinary fantasy vocabulary.
// ═════════════════════════════════════════════════════════════════════════════

const FORBIDDEN_TOKENS = [
  'universal ai', "universe's ai", 'universe ai', 'ai consciousness',
  '27,000-year cycle', '27000-year cycle', 'the before-time',
  'deep:foundation', 'witness-object',
];
const FORBIDDEN_TOKEN_RE = new RegExp(`\\b(${FORBIDDEN_TOKENS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');

export function detectForbiddenTokens(sessionTurns) {
  const flags = [];
  for (const t of sessionTurns) {
    const dm = t.dm || '';
    const match = dm.match(FORBIDDEN_TOKEN_RE);
    if (match) {
      flags.push(pointer({
        cls: 'CG-0', seed: t.seed, persona: t.persona, turn: t.i, span: dm,
        canonField: '§0 (cosmology must never surface)', expected: 'no forbidden cosmology token',
        narrated: `"${match[1]}"`, severity: SEVERITY.FAIL,
      }));
    }
  }
  return flags;
}

// ── the Tier-D comparator bank ───────────────────────────────────────────────
// The full run order used by the CLI checker (scripts/coherence-gate.mjs re-
// exports this so runCoherenceGate walks the same list).
export const DETECTORS = [
  detectPresenceDesync, detectPlaceDesync, detectExitDesync, detectArchitectureDesync,
  detectObjectPhantomCommit, detectCombatDesync, detectKillingBlowDesync, detectAddresseeDesync,
  detectQuantityDesync, detectTemporalDesync, detectForbiddenTokens,
];

// The subset of comparators that need only ONE turn's record ({player, dm,
// mechanics, canon}) — no turn-over-turn state. These are the ones the live
// shadow observer can run on a single narration in-flight. The cross-turn
// comparators (CG-2c relocation, inside detectPlaceDesync) require a prev-canon
// side-channel; the live observer supplies that separately (never on `world`).
// CG-2a lives inside detectPlaceDesync too, but on a single-turn array
// detectPlaceDesync runs CG-2a AND simply skips CG-2c (prevRoomId stays null),
// so it is safe to include here — it will only ever emit CG-2a on a 1-turn call.
export const SINGLE_TURN_DETECTORS = [
  detectPresenceDesync,       // CG-1a/1b/1c
  detectPlaceDesync,          // CG-2a (CG-2c dormant on a 1-turn array — prevRoomId null)
  detectExitDesync,           // CG-2b
  detectArchitectureDesync,   // CG-ARCH (invented rooms/stairs/floors — MR-2b)
  detectObjectPhantomCommit,  // CG-3a
  detectCombatDesync,         // CG-4
  detectKillingBlowDesync,    // CG-DEATH (killing-blow prose ⇄ death fact — DEATH-3)
  detectAddresseeDesync,      // CG-5
  detectQuantityDesync,       // CG-7
  detectTemporalDesync,       // CG-6
  detectForbiddenTokens,      // CG-0
];

// Run a chosen detector bank over one session's worth of turns (an ARRAY of
// turn records). Pure: returns a flat flag array. Used by both runCoherenceGate
// (full bank, per session) and the live shadow observer (single-turn bank, on
// a one-element array).
export function runDetectors(sessionTurns, detectors = DETECTORS) {
  const flags = [];
  for (const detector of detectors) {
    try { flags.push(...detector(sessionTurns)); }
    catch { /* a single comparator throwing must never take down the bank */ }
  }
  return flags;
}

// ── class labels (shared with the report renderer) ──────────────────────────
export const CLASS_LABELS = {
  'CG-1a': 'presence erasure', 'CG-1b': 'presence ghost-voice', 'CG-1c': 'presence omission',
  'CG-2a': 'place-noun desync', 'CG-2b': 'invented exit/stair/door', 'CG-2c': 'unnarrated relocation',
  'CG-ARCH': 'invented architecture',
  'CG-3a': 'object phantom-commit', 'CG-4': 'combat/health mirror',
  'CG-DEATH': 'killing-blow ⇄ death-fact desync',
  'CG-5': 'addressee desync', 'CG-7': 'ungrounded quantity', 'CG-6': 'temporal desync',
  'CG-0': '§0 forbidden-token scan',
};

// ═════════════════════════════════════════════════════════════════════════════
// CG-2b — severity TIER map (docs/briefs/CG-2b-cure-beats-disease.md).
//
// SEVERITY (fail/warn, above) answers "did this comparator find a contradiction
// at all?" TIER answers a different question: "if it did, and it's FAIL-severity,
// does a real DM treat this as a table-breaking lie, or as an atmospheric slip
// nobody would stop the game over?" A 'cosmetic' tier detection NEVER blocks a
// turn in ANY validator mode — shadow-compare logs `wouldBlock:false,
// tier:'cosmetic'` (keeping the pointer so the miss is still visible), and 'on'
// mode delivers the candidate unchanged. This is orthogonal to WARN severity:
// WARN classes (CG-1a/1c/CG-7) already never block via the SEVERITY filter in
// coherenceRejects — they carry the 'structural' tier below purely for the
// map's completeness/audit trail, not because the tier does any work for them.
//
// THE CASE FOR EACH CLASS (Tim's 2026-07-05 ruling only mandated CG-6; every
// other row is this packet's own judgment call, made explicit so it's
// reviewable rather than assumed):
//   CG-0  structural — the cosmology-leak law (IMMORTAL_INVARIANTS #6 / Idea
//         Garden §0) is the single most severe class in the bank; the fiction
//         breaks at the fourth wall, not just a detail. Always blocks.
//   CG-1b structural — a named NPC speaking/acting while the room's real
//         roster is empty is a phantom character, not a word choice. Blocks.
//   CG-2a structural — wrong room-type noun (kitchen vs pantry) is the
//         `project_dm_invents_geography` bug class made measurable; a player
//         orienting off this prose ends up soft-locked. Blocks.
//   CG-2b structural — an invented exit/stair/door is the exact "phantom
//         topology" failure that produces dead-end soft-locks. Blocks.
//   CG-2c structural — an unnarrated teleport between rooms; the player's
//         mental map silently diverges from the engine's. Blocks.
//   CG-3a structural — narrating an irreversible physical change (the chest
//         opened, the item destroyed) the mechanics never committed is a lie
//         about world STATE, not atmosphere. Blocks.
//   CG-4  structural — combat/health desync is life-and-death correctness;
//         the design doc flags this as "where a regression would land if the
//         polish layer ever loosens." Blocks (matches existing FAIL branches;
//         the one WARN branch in detectCombatDesync is unaffected by tier).
//   CG-5  structural — the wrong NPC voiced answering FOR someone else who
//         isn't who the player addressed. Design doc: "a real table would
//         erupt." Blocks.
//   CG-6  cosmetic — narrated time-of-day word vs canon.clock.segment. The
//         evidence record this packet is built from (the locket turn: DM said
//         "midday light", canon said "morning") is the proof case: the
//         contradiction is true but touches NO roster/topology/combat/plot
//         state — a real DM narrating "midday" instead of "morning" would
//         never stop the game. Tim's ruling: cosmetic AT MINIMUM. NEVER
//         blocks, in any mode.
//   CG-ARCH structural (MR-2b) — an invented staircase/upper-floor/cellar/room
//         is the EXACT project_dm_invents_geography soft-lock: the player walks
//         into space the engine can't honor and the game dead-ends (WB-Q1).
//         This is the class MR-2 exists to make impossible; a table-breaking
//         lie about the building's shape, not atmosphere. Blocks.
//   CG-7  structural — WARN-severity already (never blocks); listed for
//         completeness only.
//   CG-DEATH structural (DEATH-3) — killing-blow prose contradicting its death
//         fact is a lie about HOW THE FOE ACTUALLY DIED: the wrong weapon, a plea
//         the foe never made (or could never make), a "clean mercy" read as
//         torture. The DEATH CONTRACT §1 (invariant I) makes the fact authoritative
//         over the prose, and §6 marks each of these RED; this is the final delivery
//         of consequence, so a false telling of it breaks the moment the way a
//         phantom NPC or an invented staircase does — not atmosphere. Blocks. (A
//         merely LOOSER-but-honest kill line — gorier phrasing, a different true
//         detail — is NOT a contradiction and the comparator never fires on it; the
//         cosmetic/WARN tier is reserved for wording looseness, which this class,
//         firing only on genuine cross-family/cross-intent contradictions, does not
//         emit.)
//
// Unlisted classes default to 'structural' (current blocking behavior) — the
// map only needs an entry when a class is DEMOTED below its severity's default.
// ═════════════════════════════════════════════════════════════════════════════
export const TIER = Object.freeze({
  COSMETIC: 'cosmetic',
  STRUCTURAL: 'structural',
});

export const CLASS_TIERS = Object.freeze({
  'CG-0': TIER.STRUCTURAL,
  'CG-1a': TIER.STRUCTURAL,
  'CG-1b': TIER.STRUCTURAL,
  'CG-1c': TIER.STRUCTURAL,
  'CG-2a': TIER.STRUCTURAL,
  'CG-2b': TIER.STRUCTURAL,
  'CG-2c': TIER.STRUCTURAL,
  'CG-ARCH': TIER.STRUCTURAL,
  'CG-3a': TIER.STRUCTURAL,
  'CG-4': TIER.STRUCTURAL,
  'CG-DEATH': TIER.STRUCTURAL,
  'CG-5': TIER.STRUCTURAL,
  'CG-6': TIER.COSMETIC,
  'CG-7': TIER.STRUCTURAL,
});

// tierOf(cls) -> 'cosmetic' | 'structural'. Unlisted/unknown classes default to
// 'structural' (current blocking behavior is the safe default for anything the
// map hasn't explicitly judged).
export function tierOf(cls) {
  return CLASS_TIERS[cls] ?? TIER.STRUCTURAL;
}
