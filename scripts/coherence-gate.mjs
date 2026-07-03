// ─────────────────────────────────────────────────────────────────────────────
// coherence-gate.mjs — the Coherence Gate: Tier-D state-grounded checker.
//
// WHAT THIS IS: the Opus experiential gate (scripts/dm-playtest.mjs) scores every
// turn for VIBE / CRUNCH / RAG-groundedness. None of those axes ask "does the
// DM's prose contradict the world's OWN deterministic records?" — a DM line can
// name the wrong room, voice an NPC the engine says isn't there, answer as the
// wrong NPC, or narrate a physical commit the engine never made, and still pass
// all three axes (every proper name it used exists SOMEWHERE in canon; the axis
// that would have caught the specific contradiction was never on the sheet). See
// docs/briefs/COHERENCE_GATE.md §1-§3 for the full diagnosis and taxonomy.
//
// THIS SCRIPT implements §3's Tier-D comparators — deterministic, no LLM, no
// judge, no network. Each turn's DM prose is diffed against that SAME turn's
// canon bundle (the exact ground truth the Opus judge was holding when it
// scored the turn). A flag is a "desync pointer": {class, seed, persona, turn,
// span, canonField, expected, narrated, severity} — the pointer names the exact
// field+value, so confirming it is a lookup, not a debate (Road-A-safe: the LLM
// never had authority here to begin with — there IS no LLM in this tier).
//
// PROVENANCE / reuse (do NOT re-derive without checking these first):
//   - JSONL loader + session-walk: copied verbatim in spirit from
//     scripts/coherence-audit.mjs (parseJsonl/loadJsonlFile/bySession) — same
//     shape, same CLI conventions, so the two tools compose easily. That script
//     stays untouched; unification is a later packet (CG-P6).
//   - Claim-regex doctrine (FUTURE_MOTION guard style): copied BY VALUE from
//     engine/harness/oracles.js, each block marked `// provenance: oracles.js`.
//     This file does NOT import engine/ — it stays pure and hermetic.
//
// TIER-D COMPARATORS (§3 of docs/briefs/COHERENCE_GATE.md):
//   CG-1a  presence erasure    — direct who-is-here ask answered "no one" while
//                                 the scoped roster is non-empty (WARN)
//   CG-1b  presence ghost-voice — a named present-roster NPC speaks/acts while
//                                 interior is set and roomOccupants is EMPTY
//   CG-1c  presence omission   — WARN-only: a direct ask doesn't enumerate
//                                 everyone present (a real DM needn't)
//   CG-2a  place-noun desync   — narrated room-type noun != interior.roomName
//   CG-2b  invented exit/stair/door — narrated compass exit (door/stairs/
//                                 passage "to the north/east/south/west") the
//                                 room's real topology (canon.roomExits, fed by
//                                 CG-P4) doesn't have (docs/briefs/COHERENCE_GATE.md
//                                 §7 CG-P4)
//   CG-2c  unnarrated relocation — interior.roomId changed turn-over-turn with
//                                 no movement intent in the player line and no
//                                 motion claim in the DM line
//   CG-3a  object phantom-commit — narration asserts an irreversible physical
//                                 change while the mechanics route is
//                                 non-committal (info-check/no-record/deltas:0/
//                                 no-roll)
//   CG-4   combat/health mirror — narrated hit/miss/death vs enemies[]/pc.hp/
//                                 inCombat
//   CG-5   addressee desync    — player addresses NPC X; mechanics dialogue-bind
//                                 names Y and/or the DM voices Y
//   CG-7   ungrounded quantity — a cited headcount that contradicts the roster
//                                 size in canon
//   CG-6   temporal desync     — narrated time-of-day contradicts canon.clock.segment
//                                 (fed by CG-P4, the same clock the live "what
//                                 time is it" meta-answer already gives a player)
//   §0     forbidden-token scan — the world's true cosmology must never surface
//                                 in-world prose (a pure grep; rides along free)
//
// NOT implemented here (by design, see docs/briefs/COHERENCE_GATE.md):
//   - CG-3b (full lock/open state) — blocked on the Interior Object Model; do
//     NOT build a pseudo-object-model here to fake it early
//   - CG-8 (dropped intent / non-answer) — owned by the v2 atomic judge, not
//     rebuilt here
//
// GRACEFUL DEGRADATION (the built-in negative control, P-B): pre-ROM-3 JSONLs
// carry no `interior`/`roomOccupants`/`material` fields, and pre-CG-P4 JSONLs
// carry no `roomExits`/`clock` fields. Every comparator that depends on a field
// checks for its presence first and goes DORMANT (never a false flag) when the
// field is absent from the bundle. This is proven by test U389 (interior/
// roomOccupants/material) and U393 (roomExits/clock) against the real files.
//
// PRECISION OVER RECALL (the auditor's own caveat, carried over verbatim): every
// comparator below ships a false-positive guard, documented inline. Under-
// flagging is the correct failure direction for a gate — see §8 of the design
// doc ("it certifies coherent, not good"; "the rate it reports can only
// understate").
//
// RUN:  node scripts/coherence-gate.mjs <path-to.jsonl...> [--out FILE.md]
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── JSONL loading (same shape as coherence-audit.mjs, kept independent) ─────
export function parseJsonl(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let run = null;
  const turns = [];
  for (const line of lines) {
    let obj;
    try { obj = JSON.parse(line); } catch { continue; } // skip corrupt lines, don't crash the gate
    if (obj.type === 'run') run = obj;
    else if (obj.type === 'turn') turns.push(obj);
  }
  return { run, turns };
}

export function loadJsonlFile(file) {
  return parseJsonl(fs.readFileSync(file, 'utf-8'));
}

export function bySession(turns) {
  const groups = new Map();
  for (const t of turns) {
    const key = `${t.seed || ''}::${t.persona || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  for (const arr of groups.values()) arr.sort((a, b) => (a.i ?? 0) - (b.i ?? 0));
  return groups;
}

// ── shared text helpers ─────────────────────────────────────────────────────
function snippet(s, n = 160) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
}
function cite(f) {
  return `[${f.persona} t${(f.turn ?? 0) + 1}]`;
}

// judge-fail predicate — mirrors the v1/v2 shape actually present in the JSONL
// (v1: vibe/crunch/rag pass booleans + bug_class; v2: atoms → verdict, when
// present). A turn "failed the judge" if either regime says so. JUDGE_ERROR is
// NOT a fail — it means the judge call itself errored/failed to parse (a data-
// quality signal about the JUDGE, not a verdict on the DM's turn); counting it
// as a fail would silently inflate the honest floor on any run where a judge
// regime broke (the bridge JSONL has v2.bug_class:"JUDGE_ERROR" on every one of
// its 48 turns — a real per-run parse failure, not 48 genuine bug findings).
function judgeFailed(t) {
  const v1 = t.v1;
  if (v1 && v1.bug_class && v1.bug_class !== 'NONE') return true;
  const v2 = t.v2;
  if (v2 && v2.bug_class && v2.bug_class !== 'NONE' && v2.bug_class !== 'JUDGE_ERROR') return true;
  return false;
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
const SEVERITY = Object.freeze({
  FAIL: 'fail',
  WARN: 'warn',
});

function pointer({ cls, seed, persona, turn, span, canonField, expected, narrated, severity }) {
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
        return SPEECH_ACTION_RE.test(window);
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
// "invented stairway" class §1 names directly: a room graph has no exit in a
// direction, so a DM asserting a doorway/staircase there is narrating
// geography the engine cannot honor (the WB-Q1 soft-lock bug class, made
// measurable per turn instead of only reproducible by hand).
//
// PRECISION-FIRST, deliberately narrow:
//   - Only fires on an EXIT-TYPE noun (door/doorway/stairs/staircase/stairway/
//     passage/corridor/hallway/exit) bound to a COMPASS direction in the same
//     clause — a bare "a door" with no direction is not checkable (which slot
//     would it even claim?) and is correctly left alone.
//   - DORMANT (never a false flag) when `roomExits` is absent from the bundle
//     entirely (pre-CG-P4 JSONLs — no ground truth to compare against) OR when
//     the player is not `inside` this turn (roomExits is an interior-only view;
//     outdoor "exits" are the overland map, a different, already-covered
//     surface — see narratorContext.js's `location.exits`).
//   - GUARD: only flags when the compass slot canon.roomExits reports is
//     GENUINELY absent (no key for that direction at all) — a direction that
//     exists but leads somewhere the DM didn't name is not this class (that's
//     an omission, not an invention; precision over recall, same doctrine as
//     every sibling comparator here).
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
// that could span buckets ("later", "before long") are deliberately excluded —
// this is a lower bound by construction, same doctrine as every sibling here.
//
// DORMANT when `clock` is absent from the bundle (pre-CG-P4 JSONLs — no
// ground truth to compare against).
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
// symptoms, faith, rumor). This "rides along free" — it is not one of the §3
// state-grounded classes (no canon field backs it; it is a literal string scan)
// but the design doc calls it out as a zero-cost addition, so it ships here.
// Deliberately conservative: multi-word, high-specificity phrases only, to
// avoid flagging ordinary fantasy vocabulary ("cataclysm" alone is common
// adventure-fiction language; "the 27,000-year cycle" is not).
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

// ── run all Tier-D comparators over one JSONL's worth of turns ─────────────
const DETECTORS = [
  detectPresenceDesync, detectPlaceDesync, detectExitDesync, detectObjectPhantomCommit,
  detectCombatDesync, detectAddresseeDesync, detectQuantityDesync,
  detectTemporalDesync, detectForbiddenTokens,
];

export function runCoherenceGate({ run, turns }) {
  const sessions = bySession(turns);
  const flags = [];
  for (const sessionTurns of sessions.values()) {
    for (const detector of DETECTORS) flags.push(...detector(sessionTurns));
  }
  flags.sort((a, b) => (a.persona || '').localeCompare(b.persona || '') || (a.turn ?? 0) - (b.turn ?? 0));
  const byClass = {};
  for (const f of flags) (byClass[f.class] ||= []).push(f);

  // honest floor: |judge fails ∪ coherence flags|, de-duplicated per turn
  const judgeFailedKeys = new Set(
    turns.filter(judgeFailed).map(t => `${t.persona}::${t.i}`),
  );
  const flaggedKeys = new Set(flags.map(f => `${f.persona}::${f.turn}`));
  const unionKeys = new Set([...judgeFailedKeys, ...flaggedKeys]);
  const newFlagKeys = [...flaggedKeys].filter(k => !judgeFailedKeys.has(k));

  return {
    run, totalTurns: turns.length, sessionCount: sessions.size,
    flags, byClass, count: flags.length,
    judgeFailedCount: judgeFailedKeys.size,
    honestFloor: unionKeys.size,
    newSignalCount: newFlagKeys.length,
  };
}

// ── report rendering ────────────────────────────────────────────────────────
const CLASS_LABELS = {
  'CG-1a': 'presence erasure', 'CG-1b': 'presence ghost-voice', 'CG-1c': 'presence omission',
  'CG-2a': 'place-noun desync', 'CG-2b': 'invented exit/stair/door', 'CG-2c': 'unnarrated relocation',
  'CG-3a': 'object phantom-commit', 'CG-4': 'combat/health mirror',
  'CG-5': 'addressee desync', 'CG-7': 'ungrounded quantity', 'CG-6': 'temporal desync',
  'CG-0': '§0 forbidden-token scan',
};

export function renderReport(result, { title } = {}) {
  const lines = [];
  const heading = title || (result.run ? `Coherence Gate — ${result.run.runId}` : 'Coherence Gate');
  lines.push(`# ${heading}`);
  lines.push('');
  if (result.run) {
    lines.push(`**Source run:** regime ${result.run.regime} · ${result.run.personas?.join(', ')} · seeds: ${result.run.seeds?.join(', ')} · engine v${result.run.engineVersion}`);
  }
  lines.push(`**Turns analyzed:** ${result.totalTurns} across ${result.sessionCount} session(s)`);
  lines.push(`**State-grounded flags:** ${result.count} · **judge-failed turns:** ${result.judgeFailedCount} · **honest floor (union, de-duped): ${result.honestFloor}** · **new signal (flagged, judge-PASSED): ${result.newSignalCount}**`);
  lines.push('');
  lines.push(`## By class`);
  lines.push('');
  lines.push(`| Class | Detector | Count |`);
  lines.push(`|---|---|---|`);
  for (const [cls, label] of Object.entries(CLASS_LABELS)) {
    lines.push(`| ${cls} | ${label} | ${(result.byClass[cls] || []).length} |`);
  }
  lines.push('');
  if (result.count === 0) {
    lines.push(`No state-grounded desyncs detected by this checker.`);
    lines.push('');
  } else {
    lines.push(`## Desync pointers`);
    for (const [cls, label] of Object.entries(CLASS_LABELS)) {
      const list = result.byClass[cls] || [];
      if (!list.length) continue;
      lines.push('');
      lines.push(`### ${cls} — ${label} (${list.length})`);
      for (const f of list) {
        lines.push(`- ${cite(f)} [${f.severity.toUpperCase()}] canon \`${f.canonField}\` expected **${f.expected}**, narrated **${f.narrated}**`);
        lines.push(`  - _"${f.span}"_`);
      }
    }
    lines.push('');
  }
  lines.push(`**MACHINE:** coherence_flags=${result.count} judge_failed=${result.judgeFailedCount} honest_floor=${result.honestFloor} new_signal=${result.newSignalCount} turns=${result.totalTurns} sessions=${result.sessionCount}`);
  lines.push('');
  return lines.join('\n');
}

export function summaryLine(result, label) {
  return `COHERENCE-GATE${label ? ` (${label})` : ''}: ${result.count} flag(s) across ${result.totalTurns} turns — honest floor ${result.honestFloor}/${result.totalTurns} (judge ${result.judgeFailedCount} + new ${result.newSignalCount}) — by class: ${Object.keys(CLASS_LABELS).map(c => `${c}:${(result.byClass[c] || []).length}`).join(' ')}`;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
function nonClobberPath(dir, base, ext) {
  let p = path.join(dir, `${base}${ext}`);
  let n = 2;
  while (fs.existsSync(p)) { p = path.join(dir, `${base}-${n}${ext}`); n++; }
  return p;
}

async function main() {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf('--out');
  const outFile = outIdx >= 0 ? argv[outIdx + 1] : null;
  const outValueIdx = outIdx >= 0 ? outIdx + 1 : -1;
  const jsonlPaths = argv.filter((a, i) => !a.startsWith('--') && i !== outValueIdx);
  if (jsonlPaths.length === 0) {
    console.error('usage: node scripts/coherence-gate.mjs <path-to.jsonl...> [--out FILE.md]');
    process.exit(1);
  }
  // --out with a single input: write exactly to that path (a report filename).
  // --out with multiple inputs: treat it as an output DIRECTORY, one report per
  // input basename (non-clobbering if a same-named report already exists there).
  const outResolved = outFile ? (path.isAbsolute(outFile) ? outFile : path.join(process.cwd(), outFile)) : null;
  const multiInput = jsonlPaths.length > 1;

  let anyMissing = false;
  for (const jsonlPath of jsonlPaths) {
    const resolved = path.isAbsolute(jsonlPath) ? jsonlPath : path.join(process.cwd(), jsonlPath);
    if (!fs.existsSync(resolved)) {
      console.error(`file not found: ${resolved}`);
      anyMissing = true;
      continue;
    }
    const parsed = loadJsonlFile(resolved);
    const result = runCoherenceGate(parsed);
    const report = renderReport(result, { title: `Coherence Gate — ${path.basename(resolved)}` });
    console.log(report);
    console.log(summaryLine(result));
    console.log('');
    if (outResolved) {
      let outPath;
      if (multiInput) {
        fs.mkdirSync(outResolved, { recursive: true });
        outPath = nonClobberPath(outResolved, path.basename(resolved).replace(/\.jsonl$/, ''), '.md');
      } else {
        fs.mkdirSync(path.dirname(outResolved), { recursive: true });
        outPath = outResolved;
      }
      fs.writeFileSync(outPath, report);
      console.log(`Written: ${path.relative(ROOT, outPath)}`);
    }
  }
  if (anyMissing) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
