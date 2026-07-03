// ─────────────────────────────────────────────────────────────────────────────
// coherence-audit.mjs — Phase 0 coherence analyzer over a gate JSONL.
//
// WHAT THIS IS: the Opus experiential gate (scripts/dm-playtest.mjs) scores every
// turn for VIBE / CRUNCH / RAG-groundedness, but nothing in that rubric checks
// whether the world it narrates holds together ACROSS turns. A run can score
// 3/48 while walls flip material, NPCs speak before they're ever introduced, the
// player teleports rooms, a looted letter reappears in a chest, and a settlement
// flip-flops between "one building" and "a handful of buildings" — because
// cross-turn consistency isn't in VIBE/CRUNCH/RAG. See
// docs/playtests/COHERENCE_SEAMS_2026-07-02.md (seams C1–C6, the detection spec
// this file implements) — that doc was built by hand-combing two full JSONLs;
// this makes that combing repeatable, free, and deterministic.
//
// PURE TEXT ANALYSIS. No LLM calls, no RNG, no engine import — reads a JSONL
// written by dm-playtest.mjs, walks each persona's turns IN ORDER, and flags
// contradictions with turn citations. Precision over recall by design (a false
// alarm that cries wolf is worse than a miss on a first cut) — see the per-check
// comments below for the guards that keep noise down.
//
// DETECTORS (one per seam):
//   C1 materialization — an NPC speaks/acts before any turn in this persona's
//                         session establishes their presence.
//   C2 material flip    — a named surface/object's material word changes turn to
//                         turn (e.g. "wall" wooden then stone).
//   C3 object relocation — a tracked object (letter, chest contents, ...) is
//                         placed in two different containers/states across turns.
//   C4 location teleport — a new room-qualifying phrase appears with no travel
//                         mechanics in that turn.
//   C5 scale contradiction — a settlement is "a single building" then "a
//                         handful/cluster of buildings" (or vice versa).
//
// RUN:  node scripts/coherence-audit.mjs <path-to.jsonl> [--out FILE.md]
//
// Also wired as an OPT-IN flag on the gate itself: `--coherence` on
// dm-playtest.mjs runs this over the JSONL it just wrote and prints a summary
// line — default gate behavior is unchanged (see the bottom of that file).
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── JSONL loading ──────────────────────────────────────────────────────────
// Accepts either a path or raw JSONL text (tests pass text directly to skip
// tempfiles). Returns { run, turns } — turns in file order (already chronological
// per persona; dm-playtest.mjs writes them that way).
export function parseJsonl(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let run = null;
  const turns = [];
  for (const line of lines) {
    let obj;
    try { obj = JSON.parse(line); } catch { continue; } // skip corrupt lines, don't crash the audit
    if (obj.type === 'run') run = obj;
    else if (obj.type === 'turn') turns.push(obj);
  }
  return { run, turns };
}

export function loadJsonlFile(file) {
  return parseJsonl(fs.readFileSync(file, 'utf-8'));
}

function bySession(turns) {
  // Group by persona (dm-playtest.mjs runs one session per persona per seed;
  // the seed is constant across a run today, but key on seed+persona to be safe
  // against future multi-seed runs landing in one file).
  const groups = new Map();
  for (const t of turns) {
    const key = `${t.seed || ''}::${t.persona || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  // Preserve first-seen order, and sort each session by turn index (i) — belt +
  // suspenders in case a future writer interleaves personas in one file.
  for (const arr of groups.values()) arr.sort((a, b) => (a.i ?? 0) - (b.i ?? 0));
  return groups;
}

// ── shared text helpers ────────────────────────────────────────────────────
function cite(flag) {
  return `[${flag.persona} t${(flag.turn ?? 0) + 1}]`; // 1-indexed to match the report convention (human turn number)
}
function snippet(s, n = 140) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
}

// ═════════════════════════════════════════════════════════════════════════════
// C1 — NPC materialization
//
// An NPC "materializes" when the DM narration has them speaking or physically
// present/acting BEFORE any earlier turn in the same session established their
// presence (arrival, introduction, being pointed to, or a "who is X" answer that
// names them as present here). We do NOT use canon.npcsPresent as ground truth
// for this — that field is the world's static roster (who EXISTS), not who has
// been shown to the player as present in THIS scene; using it would either miss
// every real materialization (everyone is always "in canon") or over-fire on
// every NPC name ever spoken. The player's own transcript is the only honest
// record of what they've actually seen.
//
// PRECISION GUARDS (why this doesn't cry wolf):
//  - Only fires on DIALOGUE/ACTION verbs tied to the name (says/shrugs/nods/
//    stands/answers/turns/etc.) — a bare mention ("who is Dalla?", "ask Elske")
//    does not count as materialization; introducing a new NPC in ANSWER to a
//    question is normal DM behavior, not a bug.
//  - The very first turn that names an NPC in a dialogue-verb frame seeds their
//    "introduced" turn — so only a *second, distinct* speaking NPC who was never
//    seeded gets flagged, and only once (first offense) to avoid turn-9-through-
//    forever repeat noise once a bug is already known.
//  - Common non-name capitalized words ("Elske" grammar aside) are filtered by a
//    stoplist of narration-artifact stand-ins seen in this corpus (C7 territory,
//    already caught by the engine itself — not this audit's job).
// ═════════════════════════════════════════════════════════════════════════════

const SPEECH_ACTION_VERBS = [
  'says', 'said', 'shrugs', 'shrugged', 'nods', 'nodded', 'answers', 'answered',
  'replies', 'replied', 'stands', 'turns', 'turned', 'sighs', 'sighed', 'smiles',
  'smiled', 'admits', 'admitted', 'offers', 'looks up', 'glances', 'steadies',
  'holds your gaze', 'crumples', 'twists', 'levels with you', 'works back',
  'shakes', 'frowns', 'laughs', 'scoffs', 'mutters', 'murmurs', 'gestures',
];
const SPEECH_ACTION_RE = new RegExp(
  `\\b(${SPEECH_ACTION_VERBS.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i',
);
// Presence-establishing frames: DM text that puts a name IN the scene without
// necessarily a speech verb (arrival, pointing-to, "X is here", stepping in).
const PRESENCE_RE = /\b(?:is (?:here|present|right here|standing|in the doorway)|steps? (?:in|inside|through)|arrives?|walks? (?:in|up|over)|enters?|stands? (?:at|near|in|by)|(?:right )?here at|you (?:find|see|spot))\b/i;

// Common capitalized function/discourse words that precede a real proper noun
// at a sentence or clause boundary ("At Wayfarers'", "The Lingerer", "That
// traveler") — a real person's FIRST name token is never one of these, so any
// bigram starting with one is a false "name", not a person.
const LEADING_STOPWORDS = new Set([
  'At', 'The', 'A', 'An', 'In', 'On', 'With', 'From', 'To', 'Of', 'And', 'But',
  'Or', 'Here', 'There', 'This', 'That', 'These', 'Those', 'Your', 'You',
  'Wait', 'Fine', 'Alright', 'Okay', 'Yes', 'No', 'Interesting',
]);

// Names worth tracking: capitalized multi-word proper names the DM itself uses
// as a referent. We derive the candidate set from the session's OWN text
// (first-cap bigrams) rather than a hardcoded roster, so this generalizes past
// the "Elske Nightherd" cast in the two seed transcripts.
function extractProperNames(text) {
  const names = new Set();
  const twoToken = text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
  for (const n of twoToken) {
    const [first] = n.split(' ');
    if (LEADING_STOPWORDS.has(first)) continue;
    names.add(n);
  }
  return names;
}

// Place-name stoplist — capitalized bigrams that ARE legitimate DM referents
// but name a location, not a person (so they never count as a "speaking NPC").
// Not this audit's bug to find (C7 territory, already engine-guarded) — excluded
// here so we never flag the DM's own place-name narration as materialization.
const NAME_STOPLIST = new Set([
  'Wayfarers Outpost', "Wayfarers' Outpost", 'Old Shrine', 'Sooted Bridge',
]);

export function detectMaterialization(sessionTurns) {
  const flags = [];
  const introducedAt = new Map(); // name -> first turn index it was validly established

  for (const t of sessionTurns) {
    const dm = t.dm || '';
    const names = extractProperNames(dm);
    for (const name of names) {
      if (NAME_STOPLIST.has(name)) continue;
      if (introducedAt.has(name)) continue; // already seeded — nothing to flag on repeat appearances

      // Does THIS turn establish presence (not just a bare mention)?
      const idx = dm.indexOf(name);
      const window = dm.slice(Math.max(0, idx - 20), idx + name.length + 60);
      const establishesPresence = PRESENCE_RE.test(window) || PRESENCE_RE.test(dm);
      const speaksOrActs = SPEECH_ACTION_RE.test(window);

      if (establishesPresence) {
        introducedAt.set(name, t.i);
        continue;
      }
      if (speaksOrActs) {
        // Speaking/acting with NO presence-establishing frame anywhere in this
        // turn AND no earlier turn ever mentioned this name at all = the name
        // appears from nowhere, already mid-scene.
        const everMentionedBefore = sessionTurns.some(p => (p.i ?? 0) < (t.i ?? 0) && (p.dm || '').includes(name));
        if (!everMentionedBefore) {
          flags.push({
            seam: 'C1', kind: 'npc_materialization', turn: t.i, persona: t.persona,
            detail: `"${name}" speaks/acts with no prior introduction or presence in this session`,
            evidence: snippet(dm),
          });
        }
        introducedAt.set(name, t.i); // seed regardless, so this doesn't repeat-fire every later turn
      }
    }
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// C2 — material flip
//
// Tracks (object noun -> material word) across BOTH dm and player text (the
// player's stated beliefs are part of the fiction record the DM is answerable
// to — a DM that lets "wooden wall" stand uncorrected and later insists "stone
// wall, it was always stone" IS a coherence break even though the DM's own
// lines never literally said "wooden"). Flags when a later turn asserts a
// DIFFERENT material for the same tracked noun than an earlier turn did.
//
// PRECISION GUARD: only a small, high-confidence material-word list (stone,
// wood/wooden, iron, brick, clay, timber, thatch) paired with a small surface-
// noun list (wall, floor, door, roof, ceiling, beam) — generic descriptors
// ("cold", "rough") are excluded because they're not contradictions, just
// texture. Only fires on the SAME noun (singular form) to avoid cross-object
// noise (a stone basin and a wooden door are not a contradiction).
// ═════════════════════════════════════════════════════════════════════════════

const MATERIALS = ['stone', 'wooden', 'wood', 'iron', 'brick', 'clay', 'timber', 'thatched', 'earthen'];
const SURFACES = ['wall', 'floor', 'door', 'roof', 'ceiling', 'beam'];
const MATERIAL_RE = new RegExp(`\\b(${MATERIALS.join('|')})\\s+(${SURFACES.join('|')})s?\\b`, 'gi');

function normMaterial(m) {
  const lower = m.toLowerCase();
  return lower === 'wood' ? 'wooden' : lower; // "wood wall" / "wooden wall" are the same claim
}

export function detectMaterialFlip(sessionTurns) {
  const flags = [];
  const firstSeen = new Map(); // noun -> { material, turn }

  for (const t of sessionTurns) {
    const text = `${t.player || ''} ${t.dm || ''}`;
    let m;
    MATERIAL_RE.lastIndex = 0;
    while ((m = MATERIAL_RE.exec(text))) {
      const material = normMaterial(m[1]);
      const noun = m[2].toLowerCase();
      const prev = firstSeen.get(noun);
      if (!prev) {
        firstSeen.set(noun, { material, turn: t.i, evidence: snippet(m[0]) });
      } else if (prev.material !== material) {
        flags.push({
          seam: 'C2', kind: 'material_flip', turn: t.i, persona: t.persona,
          detail: `"${noun}" was "${prev.material}" at t${(prev.turn ?? 0) + 1}, now "${material}" at t${(t.i ?? 0) + 1}`,
          evidence: snippet(m[0]),
        });
        firstSeen.set(noun, { material, turn: t.i, evidence: snippet(m[0]) }); // re-baseline so we don't re-flag every later mention of the NEW material against the OLD one repeatedly
      }
    }
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// C3 — object relocation
//
// Tracks a small set of session-notable trackable-object nouns (letter, chest,
// coin/coins, key). Flags when the DM's own narration asserts contradictory
// PRESENCE/ABSENCE or CONTAINER for the same object across turns — e.g. "no
// letter here" at turn N, then the letter is inside a chest at turn N+2.
//
// PRECISION GUARD: only fires on an explicit ABSENCE claim ("no <obj> here",
// "there is no <obj>") followed later by that same object's REAPPEARANCE (any
// later mention of the object as present/held/found). Two different container
// mentions alone are not flagged (a letter can legitimately move hand-to-pocket
// in ordinary play) — only a stated absence contradicted by a later presence is
// unambiguous enough to be a coherence bug on a first cut.
// ═════════════════════════════════════════════════════════════════════════════

const TRACKED_OBJECTS = ['letter', 'chest', 'coins', 'key', 'ledger', 'journal'];

export function detectObjectRelocation(sessionTurns) {
  const flags = [];
  for (const obj of TRACKED_OBJECTS) {
    const absenceRe = new RegExp(`\\bno ${obj}\\b|\\bthere(?:'s| is) no ${obj}\\b|\\bno ${obj} here\\b`, 'i');
    const presenceRe = new RegExp(`\\b${obj}\\b`, 'i');
    let absentAt = null;
    for (const t of sessionTurns) {
      const dm = t.dm || '';
      if (absenceRe.test(dm)) {
        absentAt = t.i;
        continue;
      }
      if (absentAt !== null && (t.i ?? 0) > absentAt && presenceRe.test(dm) && !absenceRe.test(dm)) {
        flags.push({
          seam: 'C3', kind: 'object_relocation', turn: t.i, persona: t.persona,
          detail: `"${obj}" was declared absent at t${absentAt + 1}, reappears at t${(t.i ?? 0) + 1}`,
          evidence: snippet(dm),
        });
        absentAt = null; // one citation per absence episode
      }
    }
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// C4 — location teleport
//
// A NEW room-qualifying phrase ("back room", "inner room", "another room",
// "second room", "next room", "different room") appears in the DM's narration
// with no travel/movement mechanics in that same turn and no earlier turn in
// this session establishing that qualifier. Once a qualifier has appeared, it's
// baselined (no repeat-fire on later turns that reuse the SAME phrase — that's
// consistent, not a teleport).
//
// PRECISION GUARD: gated on `route` — if the turn's route is a movement/travel
// route (dm-playtest.mjs tags routes; commonly 'action' covers everything, so we
// ALSO check the mechanics string for move/travel/interior-nav markers) the
// phrase is allowed through as a legitimate transition, not flagged.
// ═════════════════════════════════════════════════════════════════════════════

const ROOM_QUALIFIER_RE = /\b(back room|inner room|another room|different room|second room|next room|far room|other room)\b/i;
const MOVE_MECHANICS_RE = /\b(move|moved|travel|enter|entered|nav|walk(?:ed)? (?:to|into)|egress)\b/i;

export function detectLocationTeleport(sessionTurns) {
  const flags = [];
  let seenQualifier = null;
  for (const t of sessionTurns) {
    const dm = t.dm || '';
    const match = dm.match(ROOM_QUALIFIER_RE);
    if (!match) continue;
    const phrase = match[1].toLowerCase();
    if (seenQualifier === phrase) continue; // consistent reuse, not a teleport
    if (seenQualifier === null) {
      const mechanics = t.mechanics || '';
      const movedThisTurn = MOVE_MECHANICS_RE.test(mechanics) || MOVE_MECHANICS_RE.test(t.player || '');
      if (!movedThisTurn) {
        flags.push({
          seam: 'C4', kind: 'location_teleport', turn: t.i, persona: t.persona,
          detail: `"${phrase}" appears with no travel mechanics this turn (mechanics: ${snippet(mechanics, 60) || '(none)'})`,
          evidence: snippet(dm),
        });
      }
      seenQualifier = phrase;
    } else if (seenQualifier !== phrase) {
      flags.push({
        seam: 'C4', kind: 'location_teleport', turn: t.i, persona: t.persona,
        detail: `room qualifier changed from "${seenQualifier}" to "${phrase}" with no travel mechanics this turn`,
        evidence: snippet(dm),
      });
      seenQualifier = phrase;
    }
  }
  return flags;
}

// ═════════════════════════════════════════════════════════════════════════════
// C5 — settlement scale contradiction
//
// A settlement is described as a SINGLE building, then later as MULTIPLE
// buildings (or the reverse). High precision: two small phrase lists, flags
// only on an actual polarity switch within one session.
// ═════════════════════════════════════════════════════════════════════════════

// Determiner ("a", "its", "the", ...) is variable in the wild (t2's "its single
// building" vs t8's "its handful of buildings") — anchor on the noun phrase, not
// a fixed article, so both phrasings of the same underlying claim match.
const SCALE_SINGLE_RE = /\b(?:a |its |the |this |that )?single building\b|\bone building\b|\bthe only building\b/i;
const SCALE_MULTIPLE_RE = /\b(?:a |its |the |this |that )?(?:handful|cluster) of buildings\b|\bseveral buildings\b|\bmultiple buildings\b|\ba few buildings\b/i;

export function detectScaleContradiction(sessionTurns) {
  const flags = [];
  let polarity = null; // 'single' | 'multiple'
  let firstTurn = null;
  for (const t of sessionTurns) {
    const dm = t.dm || '';
    const single = SCALE_SINGLE_RE.test(dm);
    const multiple = SCALE_MULTIPLE_RE.test(dm);
    if (single && polarity === 'multiple') {
      flags.push({
        seam: 'C5', kind: 'scale_contradiction', turn: t.i, persona: t.persona,
        detail: `settlement was "multiple buildings" at t${(firstTurn ?? 0) + 1}, now "a single building" at t${(t.i ?? 0) + 1}`,
        evidence: snippet(dm),
      });
      polarity = 'single'; firstTurn = t.i;
    } else if (multiple && polarity === 'single') {
      flags.push({
        seam: 'C5', kind: 'scale_contradiction', turn: t.i, persona: t.persona,
        detail: `settlement was "a single building" at t${(firstTurn ?? 0) + 1}, now "multiple buildings" at t${(t.i ?? 0) + 1}`,
        evidence: snippet(dm),
      });
      polarity = 'multiple'; firstTurn = t.i;
    } else if (single && polarity === null) {
      polarity = 'single'; firstTurn = t.i;
    } else if (multiple && polarity === null) {
      polarity = 'multiple'; firstTurn = t.i;
    }
  }
  return flags;
}

// ── run all detectors over one JSONL's worth of turns ──────────────────────
const DETECTORS = [
  detectMaterialization, detectMaterialFlip, detectObjectRelocation,
  detectLocationTeleport, detectScaleContradiction,
];

export function analyzeCoherence({ run, turns }) {
  const sessions = bySession(turns);
  const flags = [];
  for (const sessionTurns of sessions.values()) {
    for (const detector of DETECTORS) flags.push(...detector(sessionTurns));
  }
  flags.sort((a, b) => (a.persona || '').localeCompare(b.persona || '') || (a.turn ?? 0) - (b.turn ?? 0));
  const bySeam = {};
  for (const f of flags) (bySeam[f.seam] ||= []).push(f);
  return {
    run, totalTurns: turns.length, sessionCount: sessions.size,
    flags, bySeam, count: flags.length,
  };
}

// ── report rendering ────────────────────────────────────────────────────────
const SEAM_LABELS = {
  C1: 'NPC materialization', C2: 'material flip', C3: 'object relocation',
  C4: 'location teleport', C5: 'settlement scale contradiction',
};

export function renderReport(result, { title } = {}) {
  const lines = [];
  const heading = title || (result.run ? `Coherence audit — ${result.run.runId}` : 'Coherence audit');
  lines.push(`# ${heading}`);
  lines.push('');
  if (result.run) {
    lines.push(`**Source run:** regime ${result.run.regime} · ${result.run.personas?.join(', ')} · seeds: ${result.run.seeds?.join(', ')} · engine v${result.run.engineVersion}`);
  }
  lines.push(`**Turns analyzed:** ${result.totalTurns} across ${result.sessionCount} session(s) · **coherence breaks found: ${result.count}**`);
  lines.push('');
  lines.push(`## By seam`);
  lines.push('');
  lines.push(`| Seam | Detector | Count |`);
  lines.push(`|---|---|---|`);
  for (const [seam, label] of Object.entries(SEAM_LABELS)) {
    lines.push(`| ${seam} | ${label} | ${(result.bySeam[seam] || []).length} |`);
  }
  lines.push('');
  if (result.count === 0) {
    lines.push(`No cross-turn contradictions detected by this analyzer's checks.`);
    lines.push('');
  } else {
    lines.push(`## Flagged contradictions`);
    for (const [seam, label] of Object.entries(SEAM_LABELS)) {
      const list = result.bySeam[seam] || [];
      if (!list.length) continue;
      lines.push('');
      lines.push(`### ${seam} — ${label} (${list.length})`);
      for (const f of list) {
        lines.push(`- ${cite(f)} — ${f.detail}`);
        lines.push(`  - _"${f.evidence}"_`);
      }
    }
    lines.push('');
  }
  lines.push(`**MACHINE:** coherence_breaks=${result.count} turns=${result.totalTurns} sessions=${result.sessionCount}`);
  lines.push('');
  return lines.join('\n');
}

// One-line machine-readable summary (for piping / --coherence flag on the gate).
export function summaryLine(result, label) {
  return `COHERENCE${label ? ` (${label})` : ''}: ${result.count} break(s) across ${result.totalTurns} turns, ${result.sessionCount} session(s) — by seam: ${Object.entries(SEAM_LABELS).map(([s]) => `${s}:${(result.bySeam[s] || []).length}`).join(' ')}`;
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
  const jsonlPath = argv.find(a => !a.startsWith('--'));
  const outIdx = argv.indexOf('--out');
  const outFile = outIdx >= 0 ? argv[outIdx + 1] : null;
  if (!jsonlPath) {
    console.error('usage: node scripts/coherence-audit.mjs <path-to.jsonl> [--out FILE.md]');
    process.exit(1);
  }
  const resolved = path.isAbsolute(jsonlPath) ? jsonlPath : path.join(process.cwd(), jsonlPath);
  if (!fs.existsSync(resolved)) {
    console.error(`file not found: ${resolved}`);
    process.exit(1);
  }
  const parsed = loadJsonlFile(resolved);
  const result = analyzeCoherence(parsed);
  const report = renderReport(result, { title: `Coherence audit — ${path.basename(resolved)}` });
  console.log(report);
  console.log(summaryLine(result));
  if (outFile) {
    const outPath = path.isAbsolute(outFile) ? outFile : path.join(process.cwd(), outFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, report);
    console.log(`\nWritten: ${path.relative(ROOT, outPath)}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
