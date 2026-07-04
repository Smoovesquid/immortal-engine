// ─────────────────────────────────────────────────────────────────────────────
// coherence-gate.mjs — the Coherence Gate: Tier-D state-grounded checker (CLI).
//
// WHAT THIS IS: the Opus experiential gate (scripts/dm-playtest.mjs) scores every
// turn for VIBE / CRUNCH / RAG-groundedness. None of those axes ask "does the
// DM's prose contradict the world's OWN deterministic records?" — a DM line can
// name the wrong room, voice an NPC the engine says isn't there, answer as the
// wrong NPC, or narrate a physical commit the engine never made, and still pass
// all three axes. See docs/briefs/COHERENCE_GATE.md §1-§3 for the diagnosis.
//
// WHERE THE COMPARATORS LIVE NOW (CG-LIVE-1): the Tier-D comparators used to be
// defined inline in this file. They were extracted VERBATIM into the neutral,
// pure module `engine/coherence/checks.js` so the LIVE shadow observer (engine/)
// can run the exact same checks WITHOUT engine/ importing from scripts/. This
// file now RE-EXPORTS them (so U388-U393 keep importing them from here,
// byte-identical) and layers the CLI + report + honest-floor aggregation on top.
// The extraction is a pure refactor — no comparator logic changed. (This pulls
// CG-P6's "one shared comparator core" unification forward; noted against CG-P6.)
//
// PROVENANCE / reuse (do NOT re-derive without checking these first):
//   - JSONL loader + session-walk: copied verbatim in spirit from
//     scripts/coherence-audit.mjs (parseJsonl/loadJsonlFile/bySession) — same
//     shape, same CLI conventions, so the two tools compose easily.
//   - Claim-regex doctrine: now in engine/coherence/checks.js, each block still
//     marked with its oracles.js provenance. That module does NOT import
//     engine state/RNG — it stays pure and hermetic like this script.
//
// RUN:
//   node scripts/coherence-gate.mjs <path-to.jsonl...> [--out FILE.md]   (re-score)
//   node scripts/coherence-gate.mjs --shadow <shadow.jsonl...> [--out …]  (live shadow FP rate)
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── the pure Tier-D comparator core (extracted, CG-LIVE-1) ──────────────────
import {
  snippet, SEVERITY, pointer,
  detectPresenceDesync, detectPlaceDesync, detectExitDesync, detectObjectPhantomCommit,
  detectCombatDesync, detectAddresseeDesync, detectQuantityDesync,
  detectTemporalDesync, detectForbiddenTokens,
  DETECTORS, SINGLE_TURN_DETECTORS, runDetectors, CLASS_LABELS,
} from '../engine/coherence/checks.js';

// Re-export the comparator core so existing importers (U388-U393) that pull
// these from scripts/coherence-gate.mjs keep working byte-identically.
export {
  snippet, SEVERITY, pointer,
  detectPresenceDesync, detectPlaceDesync, detectExitDesync, detectObjectPhantomCommit,
  detectCombatDesync, detectAddresseeDesync, detectQuantityDesync,
  detectTemporalDesync, detectForbiddenTokens,
  DETECTORS, SINGLE_TURN_DETECTORS, runDetectors, CLASS_LABELS,
};

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

// ── report helper ────────────────────────────────────────────────────────────
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

// ── run all Tier-D comparators over one JSONL's worth of turns ─────────────
export function runCoherenceGate({ run, turns }) {
  const sessions = bySession(turns);
  const flags = [];
  for (const sessionTurns of sessions.values()) {
    flags.push(...runDetectors(sessionTurns, DETECTORS));
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

// ═════════════════════════════════════════════════════════════════════════════
// SHADOW REVIEW MODE (CG-LIVE-1): read the live shadow observer's jsonl log and
// print the live false-positive-candidate rate by class. The shadow log lines
// are ALREADY desync pointers (the observer wrote them via the same `pointer`
// shape), each wrapped with the turn's provenance:
//   { type:'shadow', ts, seed, persona, turn, input, pointers:[<pointer>...] }
// This mode just aggregates them into the same by-class report shape — so
// "on N live turns the shadow observer fired M times, by class" is one command.
// (Turns where the observer ran and found NOTHING are logged too, with an empty
// pointers[], so the denominator — live turns observed — is honest.)
// ═════════════════════════════════════════════════════════════════════════════
export function parseShadowJsonl(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const records = [];
  for (const line of lines) {
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj && obj.type === 'shadow') records.push(obj);
  }
  return records;
}

export function runShadowReview(records) {
  const flags = [];
  let firedTurns = 0;
  for (const r of records) {
    const pointers = Array.isArray(r.pointers) ? r.pointers : [];
    if (pointers.length) firedTurns++;
    for (const p of pointers) {
      flags.push({ ...p, seed: p.seed ?? r.seed, persona: p.persona ?? r.persona, turn: p.turn ?? r.turn });
    }
  }
  const byClass = {};
  for (const f of flags) (byClass[f.class] ||= []).push(f);
  return {
    totalTurns: records.length,  // every observed turn logs one record (fired or not)
    firedTurns,
    flags, byClass, count: flags.length,
  };
}

export function renderShadowReview(result, { title } = {}) {
  const lines = [];
  lines.push(`# ${title || 'Coherence Shadow — live false-positive-candidate rate'}`);
  lines.push('');
  // GUARD: zero observed turns is NOT a clean 0% false-positive rate — it means the
  // observer never ran (nothing to measure). The observer logs one record PER TURN
  // (fired or not), so an empty log = it early-returned every turn, almost always
  // because the server serving /api/narrate was not started with COHERENCE_SHADOW=1.
  // Report that loudly rather than a misleading "0/0 (0.0%)" that reads as a pass —
  // that exact misread once recorded a phantom "live shadow 0" and blocked CG-LIVE-2.
  if (result.totalTurns === 0) {
    lines.push(`> ⚠️ **NO SHADOW RECORDS — the observer did not run.** Zero turns were observed, so this is`);
    lines.push(`> **not** a 0% false-positive rate; there is nothing to measure. The likeliest cause is that the`);
    lines.push(`> server serving \`/api/narrate\` was not started with \`COHERENCE_SHADOW=1\` (the observer`);
    lines.push(`> early-returns and logs nothing when the flag is unset). Re-run the live turns with the flag set.`);
    lines.push('');
    lines.push(`**MACHINE:** shadow_pointers=0 shadow_fired_turns=0 shadow_turns=0 fire_rate_pct=n/a observer_ran=false`);
    lines.push('');
    return lines.join('\n');
  }
  const rate = (100 * result.firedTurns / result.totalTurns).toFixed(1);
  lines.push(`**Live turns observed:** ${result.totalTurns} · **turns that fired ≥1 pointer:** ${result.firedTurns} · **total pointers:** ${result.count}`);
  lines.push(`**Fire rate:** ${result.firedTurns}/${result.totalTurns} live turns (${rate}%) would have triggered a would-be regenerate.`);
  lines.push('');
  lines.push(`| Class | Detector | Count |`);
  lines.push(`|---|---|---|`);
  for (const [cls, label] of Object.entries(CLASS_LABELS)) {
    lines.push(`| ${cls} | ${label} | ${(result.byClass[cls] || []).length} |`);
  }
  lines.push('');
  if (result.count > 0) {
    lines.push(`## Would-be desync pointers (shadow — NOTHING was regenerated)`);
    for (const [cls, label] of Object.entries(CLASS_LABELS)) {
      const list = result.byClass[cls] || [];
      if (!list.length) continue;
      lines.push('');
      lines.push(`### ${cls} — ${label} (${list.length})`);
      for (const f of list) {
        lines.push(`- ${cite(f)} [${String(f.severity || '').toUpperCase()}] canon \`${f.canonField}\` expected **${f.expected}**, narrated **${f.narrated}**`);
        lines.push(`  - _"${f.span}"_`);
      }
    }
    lines.push('');
  }
  lines.push(`**MACHINE:** shadow_pointers=${result.count} shadow_fired_turns=${result.firedTurns} shadow_turns=${result.totalTurns} fire_rate_pct=${rate} observer_ran=true`);
  lines.push('');
  return lines.join('\n');
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
  const shadowMode = argv.includes('--shadow');
  const outIdx = argv.indexOf('--out');
  const outFile = outIdx >= 0 ? argv[outIdx + 1] : null;
  const outValueIdx = outIdx >= 0 ? outIdx + 1 : -1;
  const jsonlPaths = argv.filter((a, i) => !a.startsWith('--') && i !== outValueIdx);
  if (jsonlPaths.length === 0) {
    console.error('usage: node scripts/coherence-gate.mjs <path-to.jsonl...> [--out FILE.md]');
    console.error('       node scripts/coherence-gate.mjs --shadow <shadow.jsonl...> [--out FILE.md]');
    process.exit(1);
  }
  // --out with a single input: write exactly to that path (a report filename).
  // --out with multiple inputs: treat it as an output DIRECTORY, one report per
  // input basename (non-clobbering if a same-named report already exists there).
  const outResolved = outFile ? (path.isAbsolute(outFile) ? outFile : path.join(process.cwd(), outFile)) : null;
  const multiInput = jsonlPaths.length > 1;

  // --shadow: aggregate one or more shadow logs into a single FP-rate report.
  if (shadowMode) {
    const allRecords = [];
    let anyMissingS = false;
    for (const jsonlPath of jsonlPaths) {
      const resolved = path.isAbsolute(jsonlPath) ? jsonlPath : path.join(process.cwd(), jsonlPath);
      if (!fs.existsSync(resolved)) { console.error(`file not found: ${resolved}`); anyMissingS = true; continue; }
      allRecords.push(...parseShadowJsonl(fs.readFileSync(resolved, 'utf-8')));
    }
    const result = runShadowReview(allRecords);
    const report = renderShadowReview(result, { title: `Coherence Shadow — ${jsonlPaths.map(p => path.basename(p)).join(', ')}` });
    console.log(report);
    if (outResolved) {
      fs.mkdirSync(path.dirname(outResolved), { recursive: true });
      fs.writeFileSync(outResolved, report);
      console.log(`Written: ${path.relative(ROOT, outResolved)}`);
    }
    if (anyMissingS) process.exit(1);
    return;
  }

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
