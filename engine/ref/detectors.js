// ─────────────────────────────────────────────────────────────────────────────
// engine/ref/detectors.js — deterministic content-shape ESCALATORS (Family B).
//
// THE REF's detector set has two families (docs/briefs/THE_REF_CONTRACT.md §4.1):
//   A. provenance — which engine branch produced the line (narrationSource.js,
//      derived from the mechanics tag; free and exact wherever it applies);
//   B. content shape — THIS module: the line itself carries a machine artifact.
//
// Family B exists for the turns provenance can't mark (meta answers with
// mechanics `(none)`, template glue bugs riding grounded paths). Tier-1
// (validateNarrationCandidate) REJECTS a bad polish and falls back to the base —
// which assumes the base is good; these artifacts usually arrive IN the base, so
// rejection is the wrong lever. Detectors therefore ESCALATE the turn to the
// Ref's judge (biased hard toward PASS) instead: a false fire costs one Haiku
// call, never a line.
//
// Design rules (the Road-A discipline, transplanted):
//   • conservative by construction — only signatures real DM prose never carries;
//   • pure + NEVER THROWS (a thrown detector would break the narration path);
//   • escalate-only — the verdict belongs to the judge; the words to the regen;
//   • never run on intentional epistemic dialogue modes (index.js enforces this:
//     detectors only see source === 'hard').
// ─────────────────────────────────────────────────────────────────────────────

// ── stat-block run ────────────────────────────────────────────────────────────
// The character sheet leaking into prose as `NAME dd (±d)` pairs — e.g.
// "MIGHT 6 (-2), AGILITY 6 (-2), WITS 6 (+0)" (P10-AG3 gate, Rules-Lawyer t1).
// One mention can be a legitimate rules answer; a RUN of ≥2 is a sheet dump.
const STAT_TOKEN_RE = /\b(?:MIGHT|AGILITY|WITS|NERVE|GRACE|FOCUS|FORCE|VIGOR|LUCK|GUILE)\s+\d{1,2}\s*\([+\-−]?\d+\)/gi;

// ── resolver grammar in prose ─────────────────────────────────────────────────
// Raw mechanics grammar that belongs on the bracket line, never in narration:
// roll grammar ("vs DC 13", "margin:-9", "→ success"), bank/gen keys, node ids,
// structure-schema tags, or a bracket-tag fragment. Each is unambiguous — no
// real sentence of DM prose contains them. (The crunch/mechanics LINE is the
// sanctioned channel for numbers; this guards the PROSE channel — HIDE-THE-MATH.)
const MECH_GRAMMAR_RES = [
  /\bvs\s+DC\s*:?\s*\d+/i,
  /\bmargin\s*:\s*[+\-−]?\d+/i,
  /(?:→|->)\s*(?:success|failure|mixed)\b/i,
  /\[(?:roll|strike|dialogue\s+ask|rest|read|info-check|egress|clarify|window)\b[:\s|\]]/i,
  /\bgen:[smf]\b/,
  /\bstgen:v\d+/i,
  /\bn\d+_\d{5,}\b/,
];

// ── repeated list item ────────────────────────────────────────────────────────
// A comma-list of ≥3 short items containing an exact duplicate — template glue,
// e.g. "You'll find well, workshop, well; folk worth knowing…" (postfamily gate,
// info-check no-record). Items are capped at 3 words so ordinary clauses joined
// by commas never register as "items"; deliberate anaphora is rare and merely
// escalates (the judge passes real prose).
function hasRepeatedListItem(text) {
  for (const sentence of String(text).split(/[.!?;]+/)) {
    if (!sentence.includes(',')) continue;
    const items = sentence.split(',').map(s =>
      s.trim().toLowerCase()
        .replace(/^(?:and|or)\s+/, '')
        .replace(/^(?:the|a|an)\s+/, '')
        .replace(/[^a-z' -]/g, '').trim()
    );
    if (items.length < 3) continue;
    const seen = new Set();
    // The FIRST segment usually carries the sentence lead-in ("You'll find well" —
    // the list item is its tail), so later items are also checked against item 0's
    // trailing words. Items themselves must be short (≤3 words) to count as list
    // members — clause-commas never register.
    const head = items[0] || '';
    for (let i = 1; i < items.length; i++) {
      const it = items[i];
      if (!it || it.length < 3 || it.split(/\s+/).length > 3) continue;
      if (seen.has(it)) return true;
      if (head === it || head.endsWith(' ' + it)) return true;
      seen.add(it);
    }
  }
  return false;
}

/**
 * detectNarrationArtifacts(candidate) -> { fired, failureClass, source }
 *
 * Pure, read-only, never throws. First hit wins. `source` is the telemetry/
 * escalation label handed to the judge call (same slot narrationSource fills on
 * soft turns); `failureClass` is the REF_FAILURE_CLASSES entry the shape maps to
 * (informational — the judge still decides the verdict).
 */
export function detectNarrationArtifacts(candidate) {
  try {
    const text = String(candidate ?? '');
    if (!text.trim()) return { fired: false, failureClass: 'NONE', source: null };

    const statHits = text.match(STAT_TOKEN_RE);
    if (statHits && statHits.length >= 2) {
      return { fired: true, failureClass: 'MACHINE_DUMP', source: 'detector:stat-block' };
    }
    for (const re of MECH_GRAMMAR_RES) {
      if (re.test(text)) {
        return { fired: true, failureClass: 'MACHINE_DUMP', source: 'detector:mech-grammar' };
      }
    }
    if (hasRepeatedListItem(text)) {
      return { fired: true, failureClass: 'MACHINE_DUMP', source: 'detector:list-glue' };
    }
    return { fired: false, failureClass: 'NONE', source: null };
  } catch {
    return { fired: false, failureClass: 'NONE', source: null }; // never throw, never block
  }
}

export const _internal = { STAT_TOKEN_RE, MECH_GRAMMAR_RES, hasRepeatedListItem };
