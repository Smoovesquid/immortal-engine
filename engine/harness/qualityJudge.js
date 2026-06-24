// ─────────────────────────────────────────────────────────────────────────────
// engine/harness/qualityJudge.js — the Tier-2 QUALITY judge (the open-ended half).
//
// WHY THIS EXISTS: the deterministic oracles certify CONSISTENCY (does the prose
// contradict committed state) — free, exact, but blind by construction to the
// open-ended "this is just nonsense / not a real DM" space. And until now the
// harness judged the DETERMINISTIC SKELETON (gen:s/m/f filler), not the real DM.
// This judge closes both gaps: it reads the REAL DM narration and asks, against
// THE_TABLE_TEST, "would a real D&D table produce this?" — catching the filler,
// the debug-dumps, and the non-resolutions no hand-written rule predicts.
//
// SOTA-grounded (biblioteca Vol 16 + the 2026 LLM-judge research, due-diligenced
// 2026-06-24):
//   • RUBRIC-ATOMIC — separate binary criteria, never one vague "is this good?"
//     score (Autorubric 2603.00077, RULERS 2601.08654). Halo-effect guard.
//   • EVIDENCE-ANCHORED — every finding quotes the offending turn + line.
//   • DIRECT VERDICTS, no chain-of-thought (Vol 14: CoT can *harm* judging); low temp.
//   • DECOUPLED + CHEAP — a different/cheaper model than the player; never self-judges.
//   • DISCOVERY POINTER, never authority — it PROPOSES findings; canon is untouched;
//     its findings route to HUMAN TRIAGE, NEVER to the auto-fix loop (it is noisier
//     than the deterministic oracles, which are the only auto-fixable signal).
//
// HARD INVARIANT: READ-ONLY. No world mutation, no RNG. Pure prompt-build + parse;
// the single side effect (the model call) is an INJECTED `callModel` so the whole
// thing is hermetically testable with a fake — zero API cost in tests.
// ─────────────────────────────────────────────────────────────────────────────

// The rubric: six atomic, binary criteria — each a NAMED principle of real DM
// narration craft (researched 2026-06-24: Angry GM, PbtA MC moves/principles, Keith
// Johnstone improv, Sly Flourish), each mapped to a failure mode we've actually seen.
// Filtered through the engine's invariants (narration ≠ canon; hide the math; §0).
// See docs/biblioteca/vol-17-dm-narration-craft.md for the craft→criterion mapping.
export const QUALITY_CRITERIA = Object.freeze([
  { id: 'resolved', label: 'resolves-the-intent',
    q: "Does the DM resolve/address what the player ACTUALLY tried, and leave a clear call to action — not dodge it with vague atmosphere? (Angry GM: a scene is a call to action. Improv: don't block the offer.)" },
  { id: 'agency', label: 'respects-agency',
    q: "Does the DM narrate only the WORLD and outcomes — NEVER the player character's choices, feelings, or undeclared actions? (The player decides what their character does; the DM never says 'you decide to…', 'you feel…', or moves them somewhere they didn't choose.)" },
  { id: 'nomachine', label: 'no-machine-voice',
    q: "Is the prose free of leaking mechanics — no stat numbers, struct/debug dumps ('State: intact. Parts: lid, hinge, lock'), population counts ('forty-four souls'), dice, or system-artifact phrasing? (PbtA: make your move but NEVER speak its name. Hide the math.)" },
  { id: 'concise', label: 'concise-no-filtering',
    q: "Is it snappy and direct — a few sentences, ≤~3 concrete details, NO purple/Tolkien prose, and NO 'filtering' distance ('you see that…', 'you notice…', 'you feel that…')? Give the perception straight. (Angry GM.)" },
  { id: 'grounded', label: 'specific-and-grounded',
    q: "Is the detail concrete, sensory, and specific to THIS world and moment — not interchangeable filler that would fit any turn? (Sly Flourish: describe through the character's eyes.)" },
  { id: 'voice', label: 'natural-DM-voice',
    q: "Does it sound like a real human DM talking at the table — not a template, an AI artifact, or a system message? (Angry GM: speak normally.)" },
]);

const CRITERIA_BY_ID = Object.fromEntries(QUALITY_CRITERIA.map(c => [c.id, c]));

export const QUALITY_JUDGE_SYSTEM =
  "You are auditing a text RPG's Dungeon Master, turn by turn, against ONE standard: " +
  "THE TABLE TEST — would this happen at a real D&D table? You are not grading creativity " +
  "or fun; you are flagging turns where the DM fails a concrete, binary quality bar. " +
  "Be strict but fair: a terse-but-real DM line PASSES; only flag genuine failures " +
  "(vague non-answers, interchangeable filler, debug/struct-dump text, system-artifact voice). " +
  "Judge each criterion INDEPENDENTLY — do NOT let one flaw fail a turn on every criterion. " +
  "A turn can resolve the action poorly yet still read in a natural voice, or be a touch wordy yet " +
  "specific and grounded; mark only the criterion that actually fails. When a criterion is borderline, " +
  "PASS it. A decent, specific, in-voice line should pass most or all criteria. " +
  "WORKED EXAMPLE — for 'I open the chest' the DM replies 'You stand still and read this " +
  "corner of the outpost. Ways lead off east and south.': fail ONLY resolved (it ignored the " +
  "chest) and grounded (generic survey); PASS agency, nomachine, concise, and voice — do NOT " +
  "fail those just because resolved failed. One root flaw should fail one or two criteria, not all. " +
  "Answer with STRICT JSON only — no preamble, no explanation, no reasoning.";

// Render the session as a compact numbered transcript the judge scores. Only the
// player action + the DM's REAL line per turn (meta/no-turn beats are skipped — they
// aren't DM adjudications). Returns { lines, indexByTurn } so a verdict maps back.
export function transcriptForJudge(transcript) {
  const turns = [];
  let pendingAction = null;
  for (const t of transcript || []) {
    if (t.who === 'you') pendingAction = String(t.text || '');
    else if (t.who === 'dm' && !t.meta && pendingAction != null) {
      turns.push({ turn: turns.length + 1, action: pendingAction, dm: String(t.text || '') });
      pendingAction = null;
    }
  }
  return turns;
}

export function buildJudgePrompt(transcript) {
  const turns = transcriptForJudge(transcript);
  const rubric = QUALITY_CRITERIA.map(c => `- "${c.id}": ${c.q}`).join('\n');
  const body = turns.map(t =>
    `TURN ${t.turn}\n  PLAYER: ${t.action.replace(/\n/g, ' ').slice(0, 240)}\n  DM: ${t.dm.replace(/\n/g, ' ').slice(0, 400)}`,
  ).join('\n\n');
  const user =
    `Score each turn on these binary criteria (true = passes, false = fails):\n${rubric}\n\n` +
    `TRANSCRIPT (${turns.length} turn(s)):\n${body}\n\n` +
    `true = PASSES the criterion, false = FAILS it. A terse-but-real DM line PASSES.\n` +
    `Return STRICT JSON, no other text:\n` +
    `{"turns":[{"turn":<int>,"resolved":<bool>,"agency":<bool>,"nomachine":<bool>,"concise":<bool>,"grounded":<bool>,"voice":<bool>,"evidence":"<≤140-char quote of the DM line if ANY criterion failed, else \\"\\">"}]}`;
  return { system: QUALITY_JUDGE_SYSTEM, user, turns };
}

// Tolerant JSON extraction — strips ```fences``` and grabs the first {...} block.
function extractJson(raw) {
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

// Map a judge verdict back to findings — one per FAILED criterion per turn, tagged
// `quality-<label>` with severity 'quality' (a DISTINCT class: discovery only, never
// auto-fixed). `turns` is the buildJudgePrompt output, so evidence can fall back to
// the actual DM line and the player action is recoverable.
export function parseJudgeVerdict(raw, turns) {
  const byTurn = new Map((turns || []).map(t => [t.turn, t]));
  let parsed;
  try { parsed = extractJson(raw); }
  catch { return [{ oracleId: 'quality-judge-parse', severity: 'low', note: 'quality-judge: could not parse verdict JSON (treated as no finding)' }]; }
  const rows = Array.isArray(parsed?.turns) ? parsed.turns : [];
  const findings = [];
  for (const row of rows) {
    const src = byTurn.get(row?.turn);
    for (const c of QUALITY_CRITERIA) {
      if (row?.[c.id] === false) {
        findings.push({
          oracleId: `quality-${c.label}`,
          severity: 'quality',
          turn: row.turn,
          action: src?.action || '',
          claim: `DM turn failed the table-test criterion "${c.id}": ${c.q}`,
          committed: src ? `DM said: "${String(src.dm).slice(0, 160)}"` : '',
          evidence: String(row.evidence || src?.dm || '').slice(0, 160),
          note: `${c.label} — the DM turn would not pass at a real table (quality/discovery; human-triage, NOT auto-fixed)`,
        });
      }
    }
  }
  return findings;
}

// The orchestrator: one cheap call per SESSION (document-level, like ConStory) — far
// cheaper than per-turn and still localizes (each finding cites its turn). `callModel`
// is injected: ({system,user}) -> Promise<string>. Errors are contained (never throws).
export async function judgeSession({ transcript, callModel }) {
  const { system, user, turns } = buildJudgePrompt(transcript);
  if (!turns.length || typeof callModel !== 'function') return [];
  let raw;
  try { raw = await callModel({ system, user }); }
  catch (e) { return [{ oracleId: 'quality-judge-error', severity: 'low', note: `quality-judge call failed: ${e?.message || e}` }]; }
  return parseJudgeVerdict(raw, turns);
}

// Quality findings are the DISCOVERY tier — this predicate is the guard the auto-fix
// loop (and any "auto-act" path) MUST consult: only deterministic findings are certain
// enough to gate a code change; quality findings are human-triage only.
export function isAutoFixable(finding) {
  return !String(finding?.oracleId || '').startsWith('quality-') && finding?.severity !== 'quality';
}
