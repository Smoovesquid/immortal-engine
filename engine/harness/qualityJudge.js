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
//   • PER-CRITERION CALLS — each criterion is judged in its OWN focused call over
//     the whole transcript, so the model never sees the other five criteria and
//     CANNOT couple them (one root flaw → all-six-fail). This is the real halo
//     guard: a single-call judge, even told to decouple, still over-fires ~30%
//     (FIRST_ROOM_FINDINGS #5). Cost is FIXED at one call per criterion per
//     session (document-level, like ConStory) — independent of turn count.
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
// Each is judged in ITS OWN call (see judgeSession) — the criteria never share a prompt.
//
// Each criterion carries a `pass` ANCHOR — the explicit bar for when the turn PASSES.
// This is load-bearing: an isolated single-criterion call, told only "judge concise,"
// will HUNT for a reason to fail and trip genuinely-fine lines. Measured on a frozen
// real transcript (a controlled A/B, same input through both judges, isolating the
// judge change from LLM-player non-determinism): a NAIVE per-criterion judge failed
// `concise` on one-sentence lines and INFLATED the count vs the old single call (16→20).
// Adding these pass-anchors flipped it to a ~30% DROP (17→11/12) with max single-turn
// co-fire 4→3 and zero turns failing ≥4 criteria — the real chest-failure signal intact.
// The pass-anchor pins each axis's bar so isolation removes the cross-criterion halo
// WITHOUT making each axis trigger-happy.
export const QUALITY_CRITERIA = Object.freeze([
  { id: 'resolved', label: 'resolves-the-intent',
    q: "Does the DM resolve/address what the player ACTUALLY tried, and leave a clear call to action — not dodge it with vague atmosphere? (Angry GM: a scene is a call to action. Improv: don't block the offer.)",
    pass: "PASSES if the line engages the player's actual attempt at all (even a terse outcome). FAIL only a genuine DODGE: a vague-atmosphere non-answer, a generic room-survey, or a non-sequitur that ignores what the player tried." },
  { id: 'agency', label: 'respects-agency',
    q: "Does the DM narrate only the WORLD and outcomes — NEVER the player character's choices, feelings, or undeclared actions? (The player decides what their character does; the DM never says 'you decide to…', 'you feel…', or moves them somewhere they didn't choose.)",
    pass: "PASSES by default — describing the world, what the player perceives, and outcomes of what they DID is all fine. FAIL only if the line dictates the character's CHOICE, EMOTION, or an action the player never declared ('you decide to…', 'you feel afraid', 'you walk off toward…')." },
  { id: 'nomachine', label: 'no-machine-voice',
    q: "Is the prose free of leaking mechanics — no stat numbers, struct/debug dumps ('State: intact. Parts: lid, hinge, lock'), population counts ('forty-four souls'), dice, or system-artifact phrasing? (PbtA: make your move but NEVER speak its name. Hide the math.)",
    pass: "PASSES by default — ordinary narration passes. FAIL only on a VISIBLE mechanic in the prose: a number/stat, dice/DC/roll, a struct or debug dump, a population count, or system-artifact phrasing. Evocative prose with no leaked machinery PASSES." },
  { id: 'concise', label: 'concise-no-filtering',
    q: "Is it snappy and direct — a few sentences, ≤~3 concrete details, NO purple/Tolkien prose, and NO 'filtering' distance ('you see that…', 'you notice…', 'you feel that…')? Give the perception straight. (Angry GM.)",
    pass: "PASSES by default — a short line (≤~4 sentences) that isn't purple ALWAYS passes; brevity is never a fault. FAIL ONLY genuinely bloated prose (long, ornate, Tolkien-ish) or explicit 'filtering' distance ('you see that…', 'you notice…'). A one- or two-sentence line essentially always PASSES." },
  { id: 'grounded', label: 'specific-and-grounded',
    q: "Is the detail concrete, sensory, and specific to THIS world and moment — not interchangeable filler that would fit any turn? (Sly Flourish: describe through the character's eyes.)",
    pass: "PASSES if it names anything concrete and specific to THIS scene (an object, a texture, a place). FAIL only TRULY interchangeable filler that would fit any turn ('the moment turns toward you', vague atmosphere with no specifics)." },
  { id: 'voice', label: 'natural-DM-voice',
    q: "Does it sound like a real human DM talking at the table — not a template, an AI artifact, or a system message? (Angry GM: speak normally.)",
    pass: "PASSES by default — any line that reads as natural narration a human DM could say passes, even if plain or terse. FAIL only an obvious TEMPLATE, AI-artifact, or system-message cadence (canned repetition, robotic phrasing, a stage-direction prompt like 'What do you do?' tacked on mechanically)." },
]);

// Per-criterion system prompt — focused on ONE criterion at a time. The model never
// sees the other five, so it cannot fail a turn on every criterion off one root flaw.
export function criterionSystem(criterion) {
  return (
    "You are auditing a text RPG's Dungeon Master, turn by turn, against ONE standard: " +
    "THE TABLE TEST — would this happen at a real D&D table? On THIS pass you judge a " +
    `SINGLE criterion and nothing else:\n\n  "${criterion.id}" — ${criterion.q}\n\n` +
    `BAR FOR THIS CRITERION: ${criterion.pass}\n\n` +
    "Ignore every OTHER quality dimension. A turn may resolve the action poorly yet still " +
    `pass THIS criterion, or read awkwardly yet still pass it — judge ONLY whether it meets ` +
    `the "${criterion.id}" bar above. DEFAULT TO PASS: only mark a turn failed when it CLEARLY ` +
    "trips the FAIL condition spelled out in the bar. Do not hunt for reasons to fail; a terse, " +
    "plain, but real DM line PASSES. When it is borderline, PASS it. Do NOT penalize a turn here " +
    "for a flaw that belongs to a different criterion. " +
    "Answer with STRICT JSON only — no preamble, no explanation, no reasoning."
  );
}

// Render the session as a compact numbered transcript the judge scores. Only the
// player action + the DM's REAL line per turn (meta/no-turn beats are skipped — they
// aren't DM adjudications). Returns [{ turn, action, dm }] so a verdict maps back.
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

// Build the focused, single-criterion prompt over the WHOLE transcript. Returns
// { system, user, turns } so a verdict can map back. One of these is sent per criterion.
export function buildCriterionPrompt(transcript, criterion) {
  const turns = transcriptForJudge(transcript);
  const body = turns.map(t =>
    `TURN ${t.turn}\n  PLAYER: ${t.action.replace(/\n/g, ' ').slice(0, 240)}\n  DM: ${t.dm.replace(/\n/g, ' ').slice(0, 400)}`,
  ).join('\n\n');
  const user =
    `Judge EVERY turn on this ONE criterion — CRITERION "${criterion.id}":\n  ${criterion.q}\n` +
    `  BAR: ${criterion.pass}\n\n` +
    `TRANSCRIPT (${turns.length} turn(s)):\n${body}\n\n` +
    `For each turn, "pass" = true if it MEETS this one criterion, false ONLY if it CLEARLY trips ` +
    `the FAIL condition in the BAR. Judge nothing but "${criterion.id}". Default to PASS; a terse-but-real DM line PASSES.\n` +
    `Return STRICT JSON, no other text:\n` +
    `{"turns":[{"turn":<int>,"pass":<bool>,"evidence":"<≤140-char quote of the DM line if it FAILED, else \\"\\">"}]}`;
  return { system: criterionSystem(criterion), user, turns };
}

// Tolerant JSON extraction — strips ```fences``` and grabs the first {...} block.
function extractJson(raw) {
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

// Map a single-criterion verdict back to findings — one per FAILED turn, tagged
// `quality-<label>` with severity 'quality' (a DISTINCT class: discovery only, never
// auto-fixed). `turns` is transcriptForJudge output, so evidence can fall back to the
// actual DM line and the player action is recoverable.
export function parseCriterionVerdict(raw, criterion, turns) {
  const byTurn = new Map((turns || []).map(t => [t.turn, t]));
  let parsed;
  try { parsed = extractJson(raw); }
  catch { return [{ oracleId: 'quality-judge-parse', severity: 'low', note: `quality-judge: could not parse "${criterion.id}" verdict JSON (treated as no finding)` }]; }
  const rows = Array.isArray(parsed?.turns) ? parsed.turns : [];
  const findings = [];
  for (const row of rows) {
    if (row?.pass === false) {
      const src = byTurn.get(row?.turn);
      findings.push({
        oracleId: `quality-${criterion.label}`,
        severity: 'quality',
        turn: row.turn,
        action: src?.action || '',
        claim: `DM turn failed the table-test criterion "${criterion.id}": ${criterion.q}`,
        committed: src ? `DM said: "${String(src.dm).slice(0, 160)}"` : '',
        evidence: String(row.evidence || src?.dm || '').slice(0, 160),
        note: `${criterion.label} — the DM turn would not pass at a real table (quality/discovery; human-triage, NOT auto-fixed)`,
      });
    }
  }
  return findings;
}

// The orchestrator: ONE focused call PER CRITERION over the whole session (6 calls/
// session, fixed regardless of turn count — document-level, like ConStory). Each call
// judges a single criterion in isolation, so one root flaw can no longer fail a turn on
// every criterion (the halo guard a single-call judge couldn't enforce). `callModel` is
// injected: ({system,user}) -> Promise<string>. Each call's error is contained (one
// low note; the other criteria still run). Signature is stable for playtest-harness.mjs.
export async function judgeSession({ transcript, callModel }) {
  const turns = transcriptForJudge(transcript);
  if (!turns.length || typeof callModel !== 'function') return [];
  const perCriterion = await Promise.all(QUALITY_CRITERIA.map(async (criterion) => {
    const { system, user } = buildCriterionPrompt(transcript, criterion);
    let raw;
    try { raw = await callModel({ system, user }); }
    catch (e) { return [{ oracleId: 'quality-judge-error', severity: 'low', note: `quality-judge call failed for "${criterion.id}": ${e?.message || e}` }]; }
    return parseCriterionVerdict(raw, criterion, turns);
  }));
  return perCriterion.flat();
}

// Quality findings are the DISCOVERY tier — this predicate is the guard the auto-fix
// loop (and any "auto-act" path) MUST consult: only deterministic findings are certain
// enough to gate a code change; quality findings are human-triage only.
export function isAutoFixable(finding) {
  return !String(finding?.oracleId || '').startsWith('quality-') && finding?.severity !== 'quality';
}
