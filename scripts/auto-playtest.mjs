// ─────────────────────────────────────────────────────────────────────────────
// auto-playtest.mjs — the Human Playtest Harness, Phase 3 (the autonomous
// find → fix → verify → report loop).
//
// WHAT THIS IS: one command. Press go, walk away, come back to a BRANCH of
// verified fixes + a short needs-human list. It WRAPS the committed Phase-1 finder
// (scripts/playtest-harness.mjs) and adds the self-fix machinery the finder was
// deliberately built to feed: group findings into systemic seams, triage the
// auto-fixable from the design-judgment calls, fix each auto-fixable seam through a
// HARD deterministic gate, and re-run to confirm. See docs/HUMAN_PLAYTEST_HARNESS.md
// (Phase 3), docs/HARNESS_USAGE_STRATEGY.md (fix-by-seam), THE_TABLE_TEST.md.
//
// SAFETY RAILS (non-negotiable, all enforced below):
//   • Works ONLY on an isolated branch auto-fix/<ts>. NEVER touches v2-polish.
//   • NEVER pushes. NEVER merges. Tim reviews + lands.
//   • Every fix is gated by DETERMINISTIC verification — the seam's LLM-off replay
//     must flip FAIL→PASS, the full `node --test` suite must stay green (which
//     subsumes the determinism gates), and a regression test is committed with it.
//     A bad fix CANNOT survive: the gate fails → the attempt auto-reverts.
//   • Bounded: --max-attempts/seam, --max-seams, --time-budget.
//   • Full audit trail: docs/playtests/harness/autofix-<ts>.md; each fix atomic.
//   • The fixer MAY edit hot files (playloop.js) — that's the job — but only through
//     the gate.
//
// ARCHITECTURE: the control logic (group / triage / the fix loop) is PURE and
// dependency-injected — `runFixLoop({ seams, fixer, gate, vcs })` knows nothing
// about models, git, or the test runner. The CLI wires the REAL fixer (a coding
// model), gate (subprocess replay + `node --test`), and vcs (git). The hermetic
// test (scripts/auto-playtest.test.js) wires FAKES — proving a good patch lands and
// a bad one auto-reverts with no model calls and no repo mutation.
//
// RUN:
//   node scripts/auto-playtest.mjs --seeds tallow                 # llm-discover → fix → verify → report
//   node scripts/auto-playtest.mjs --seeds tallow \               # deterministic proof: replay a known
//     --find-player replay:docs/playtests/harness/actions-<ts>.json #   action log instead of llm-discovering
//   node scripts/auto-playtest.mjs --seeds tallow --fixer dry     # find + triage + report only, no fixes
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const SEVERITY_RANK = { low: 0, med: 1, high: 2 };

// ── The seam registry — the triage policy + the fix target ────────────────────
// Maps an oracleId to: is this class safe to AUTO-fix, where its code locus is (for
// the fixer's context), and the human-readable WHY. Precision over recall: only
// classes that are LOCALIZED and DETERMINISTICALLY repro-gated are auto-fixable.
// State-commit and navigation/design seams are returned UNTOUCHED for human review.
export const SEAM_REGISTRY = Object.freeze({
  'free-action': {
    autoFixable: true,
    locus: { file: 'engine/playloop.js', symbol: 'inferInteriorAction' },
    kind: 'intent-routing',
    why: 'a free action rolled the dice — a localized intent-routing miss, deterministically repro-gated. Safe to auto-fix.',
  },
  'state-desync': {
    autoFixable: false,
    locus: { file: 'engine/playloop.js', symbol: null },
    kind: 'state-commit (movement / combat-lethality)',
    why: 'a narration↔canon desync is a state-commit seam — the correct commit (which delta, where) is a design call. Returned for human review.',
  },
  'soft-lock': {
    autoFixable: false,
    locus: null,
    kind: 'navigation / design',
    why: 'dead-progress is a navigation/design judgment (is the goal reachable from here at all?), not a localized code bug. Returned for human review.',
  },
  'crash': {
    autoFixable: false,
    locus: null,
    kind: 'crash',
    why: 'the engine threw — must be root-caused before any patch. Returned for human review.',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PURE CONTROL LOGIC (exported, dependency-injected — the hermetic test's subject)
// ─────────────────────────────────────────────────────────────────────────────

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72);
}

// The systemic-seam identity inside a finding's note: the stable kebab slug that
// leads it ("rolled-a-free-action", "dead-progress", "said-outside-still-inside"),
// stripped of the turn-specific tail. This is what collapses ~20 findings into the
// ~3–5 seams a human would name (HARNESS_USAGE_STRATEGY §"fix by seam").
export function seamSignature(note) {
  const head = String(note || '').trim().split(/\s+|—/)[0];
  if (head && /[a-z]/i.test(head) && head.length <= 48) return head.toLowerCase();
  return slugify(String(note || '').slice(0, 48)) || 'unknown';
}

// GROUP — collapse a flat finding list (each tagged with its seed + reproducing
// action log) into seams keyed by (oracleId, signature).
export function groupFindings(findings) {
  const byKey = new Map();
  for (const f of findings || []) {
    const signature = seamSignature(f.note);
    const seamKey = `${f.oracleId}::${signature}`;
    let seam = byKey.get(seamKey);
    if (!seam) {
      seam = {
        seamKey, oracleId: f.oracleId, signature,
        note: f.note, severity: f.severity || 'low',
        count: 0, findings: [],
        seed: f.seed || '', actions: Array.isArray(f.actions) ? f.actions : [],
        goalId: f.goalId || 'reach-first-concern', turns: f.turns || 25,
      };
      byKey.set(seamKey, seam);
    }
    seam.count++;
    seam.findings.push(f);
    if ((SEVERITY_RANK[f.severity] ?? 0) > (SEVERITY_RANK[seam.severity] ?? 0)) seam.severity = f.severity;
    // Keep the first usable replay (any one reproducing seed+actions is enough to gate).
    if (!seam.actions.length && Array.isArray(f.actions) && f.actions.length) { seam.actions = f.actions; seam.seed = f.seed || seam.seed; }
  }
  return [...byKey.values()];
}

// TRIAGE — split seams into the auto-fixable (enter the fix loop) and the
// needs-human (reported untouched, diagnosed). Annotates each seam with its locus,
// kind, and a plain-English reason.
export function triageSeams(seams) {
  const autoFixable = [], needsHuman = [];
  for (const seam of seams || []) {
    const reg = SEAM_REGISTRY[seam.oracleId] || null;
    const hasRepro = Array.isArray(seam.actions) && seam.actions.length > 0 && Boolean(seam.seed);
    seam.locus = reg?.locus || null;
    seam.kind = reg?.kind || 'unclassified';
    const auto = Boolean(reg?.autoFixable) && hasRepro && Boolean(reg?.locus?.file);
    if (auto) {
      seam.reason = reg.why;
      autoFixable.push(seam);
    } else {
      seam.reason = !reg ? `no registry entry for oracle "${seam.oracleId}" — unclassified, left for a human.`
        : !reg.autoFixable ? reg.why
          : !hasRepro ? 'no deterministic replay was captured for this seam — cannot gate a fix.'
            : 'no code locus is mapped for this seam — cannot target a fix.';
      needsHuman.push(seam);
    }
  }
  return { autoFixable, needsHuman };
}

// The standing regression test the loop COMMITS with each fix: replays the exact
// action log that surfaced the seam and asserts the oracle no longer fires.
// Generic (works for any seam), deterministic, LLM-off, free.
export function makeRegressionTest(seam) {
  const file = path.join('engine', 'harness', `regr.${slugify(seam.seamKey)}.test.js`);
  const content = `// AUTO-GENERATED regression test — promoted by scripts/auto-playtest.mjs (Phase 3).
// Seam ${seam.seamKey} (oracle "${seam.oracleId}") — locked on seed "${seam.seed}".
// "${String(seam.note).replace(/\n/g, ' ')}"
// Replays the exact action log that surfaced the seam and asserts the oracle no
// longer fires. Deterministic, LLM-off, free — the standing guard for this fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSession, makeScriptedPlayer, bootWorld, loadPacks } from '../../scripts/playtest-harness.mjs';
import { getGoal } from './goals.js';

test('regression[${seam.seamKey}]: ${seam.signature} stays fixed on ${seam.seed}', async () => {
  const packs = loadPacks();
  const goal = getGoal(${JSON.stringify(seam.goalId)});
  const begun = bootWorld(${JSON.stringify(seam.seed)}, packs);
  const player = makeScriptedPlayer(${JSON.stringify(seam.actions)});
  const r = await runSession({
    world: begun.world, packs, goal, player, turns: ${Number(seam.turns) || 25},
    openerNarration: begun.output?.narration || '',
  });
  const hits = r.findings.filter(f => f.oracleId === ${JSON.stringify(seam.oracleId)});
  assert.equal(hits.length, 0, 'seam ${seam.seamKey} regressed: ' + JSON.stringify(hits, null, 2));
});
`;
  return { file, content };
}

export function commitMessage(seam, proposal) {
  const reg = SEAM_REGISTRY[seam.oracleId];
  const mod = (reg?.locus?.file || 'engine').split('/')[0];
  const subject = `fix(${mod}): ${seam.oracleId} — ${seam.signature} (auto-fix)`;
  const lines = [
    '',
    `Autonomous fix loop (scripts/auto-playtest.mjs) — seam ${seam.seamKey}.`,
    `Seed ${seam.seed}; ${seam.count} finding(s). ${String(seam.note).replace(/\n/g, ' ')}`,
  ];
  if (proposal?.rationale) lines.push('', `Fixer rationale: ${proposal.rationale}`);
  lines.push(
    '',
    "Gated: the seam's LLM-off replay flips FAIL→PASS, the full node --test suite",
    'stays green (subsuming the determinism gates), and a regression test pinning',
    'this seed is committed alongside.',
    '',
    'Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>',
  );
  return `${subject}\n${lines.join('\n')}`;
}

// THE FIX LOOP — pure orchestration over injected { fixer, gate, vcs }.
//   fixer.proposeFix({ seam, attempt, priorAttempts }) -> { edits[], rationale } | null
//   gate.reproduces(seam) -> bool         (the seam must currently FAIL, or a fix proves nothing)
//   gate.evaluate(seam)   -> { pass, reason, suite? }   (replay flip + full suite)
//   vcs.applyEdits(edits) -> { files[] }
//   vcs.writeFile(rel, content)
//   vcs.revert(modifiedFiles[], createdFiles[])
//   vcs.commit(message, files[]) -> { hash }
export async function runFixLoop({ seams, fixer, gate, vcs, maxAttempts = 3, log = () => {}, deadline = Infinity }) {
  const results = [];
  for (const seam of seams || []) {
    if (Date.now() > deadline) { results.push({ seam, status: 'deferred', reason: 'time budget exhausted', attempts: [] }); continue; }
    log(`\n── seam ${seam.seamKey}  (${seam.count} finding(s) · ${seam.severity} · ${seam.kind}) ──`);

    // Pre-flight: the seam MUST currently reproduce on its own replay, else "fixed"
    // would be vacuous (a no-op patch would "pass" a flip that was never failing).
    let reproduces;
    try { reproduces = await gate.reproduces(seam); }
    catch (e) { results.push({ seam, status: 'gate-error', error: String(e?.message || e), attempts: [] }); log(`   gate error on repro check: ${e?.message || e}`); continue; }
    if (!reproduces) { log('   skip — seam does not reproduce on its own replay (nothing to flip).'); results.push({ seam, status: 'no-repro', attempts: [] }); continue; }

    const attempts = [];
    let fixed = null;
    for (let attempt = 1; attempt <= maxAttempts && !fixed; attempt++) {
      log(`   attempt ${attempt}/${maxAttempts} — proposing fix…`);
      let proposal;
      try { proposal = await fixer.proposeFix({ seam, attempt, priorAttempts: attempts.slice() }); }
      catch (e) { attempts.push({ attempt, status: 'fixer-error', error: String(e?.message || e) }); log(`   fixer error: ${e?.message || e}`); continue; }
      if (!proposal || !Array.isArray(proposal.edits) || proposal.edits.length === 0) {
        attempts.push({ attempt, status: 'no-patch', rationale: proposal?.rationale || null });
        log('   fixer returned no patch — stopping this seam.');
        break;
      }

      // Candidate = the fix edits + a generated regression test, applied together so
      // the SAME gate run validates both.
      let applied;
      try { applied = await vcs.applyEdits(proposal.edits); }
      catch (e) { attempts.push({ attempt, status: 'apply-failed', error: String(e?.message || e), rationale: proposal.rationale }); log(`   patch did not apply: ${e?.message || e}`); continue; }
      const regression = makeRegressionTest(seam);
      try { await vcs.writeFile(regression.file, regression.content); }
      catch (e) { await vcs.revert(applied.files, []); attempts.push({ attempt, status: 'regression-write-failed', error: String(e?.message || e) }); continue; }

      log('   gating — replay flip + full node --test suite…');
      let verdict;
      try { verdict = await gate.evaluate(seam); }
      catch (e) { await vcs.revert(applied.files, [regression.file]); attempts.push({ attempt, status: 'gate-error', error: String(e?.message || e) }); log(`   gate error: ${e?.message || e}`); continue; }

      if (verdict.pass) {
        const commit = await vcs.commit(commitMessage(seam, proposal), [...applied.files, regression.file]);
        attempts.push({ attempt, status: 'fixed', rationale: proposal.rationale, edits: proposal.edits, verdict, commit, regressionFile: regression.file });
        fixed = { attempt, commit, verdict, edits: proposal.edits, regressionFile: regression.file, rationale: proposal.rationale, files: applied.files };
        log(`   ✅ gated green — committed ${commit?.hash || '(dry)'}`);
      } else {
        await vcs.revert(applied.files, [regression.file]);
        attempts.push({ attempt, status: 'gate-failed', verdict, rationale: proposal.rationale });
        log(`   ✗ gate failed (${verdict.reason}) — reverted.`);
      }
    }
    results.push({ seam, status: fixed ? 'fixed' : 'couldnt-fix', fixed, attempts });
  }
  return results;
}

// Read the source of a function (the fixer's code context). Brace-balanced extract
// from `function <symbol>` to its close (engine functions are balanced); capped.
export function extractContext(locus, rootDir = ROOT) {
  if (!locus?.file) return null;
  let src;
  try { src = fs.readFileSync(path.join(rootDir, locus.file), 'utf-8'); }
  catch (e) { return { file: locus.file, symbol: locus.symbol, source: `(could not read: ${e.message})`, startLine: 0 }; }
  const lines = src.split('\n');
  if (!locus.symbol) return { file: locus.file, symbol: null, source: '(no symbol anchor)', startLine: 0 };
  const startIdx = lines.findIndex(l => new RegExp(`function\\s+${locus.symbol}\\b`).test(l));
  if (startIdx < 0) return { file: locus.file, symbol: locus.symbol, source: '(symbol not found)', startLine: 0 };
  let depth = 0, seen = false, endIdx = startIdx;
  for (let i = startIdx; i < lines.length && i < startIdx + 400; i++) {
    for (const ch of lines[i]) { if (ch === '{') { depth++; seen = true; } else if (ch === '}') depth--; }
    endIdx = i;
    if (seen && depth <= 0) break;
  }
  return { file: locus.file, symbol: locus.symbol, source: lines.slice(startIdx, endIdx + 1).join('\n'), startLine: startIdx + 1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// REAL IMPLEMENTATIONS (CLI-only — wired in main(); the test never reaches these)
// ─────────────────────────────────────────────────────────────────────────────

// — The finder subprocess. ALL engine interaction is via a fresh `node` so the
// gate's edited playloop.js is what actually runs (no stale in-process module). —
function runFinder({ findArgs, workDir, tag }) {
  const out = path.join(os.tmpdir(), `autofix-find-${tag}.json`);
  const r = spawnSync('node', ['scripts/playtest-harness.mjs', ...findArgs, '--json', out, '--no-report'],
    { cwd: workDir, encoding: 'utf-8', env: process.env, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`finder exited ${r.status}: ${(r.stderr || r.stdout || '').slice(-400)}`);
  return JSON.parse(fs.readFileSync(out, 'utf-8'));
}

function runSuite(workDir) {
  const r = spawnSync('node', ['--test'], { cwd: workDir, encoding: 'utf-8', env: process.env, maxBuffer: 256 * 1024 * 1024 });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  const num = (re) => Number((out.match(re) || [])[1] || 0);
  return { pass: num(/^# pass (\d+)/m), fail: num(/^# fail (\d+)/m), tests: num(/^# tests (\d+)/m), status: r.status };
}

// The HARD gate. Replays the seam's exact actions in a fresh process (picks up the
// edited engine), then runs the full suite. Both must be clean to pass.
function makeGate({ workDir, baselinePass }) {
  function replayFindings(seam) {
    const replayFile = path.join(os.tmpdir(), `autofix-replay-${slugify(seam.seamKey)}.json`);
    fs.writeFileSync(replayFile, JSON.stringify([{ seed: seam.seed, goal: seam.goalId, actions: seam.actions }], null, 2));
    const jsonOut = path.join(os.tmpdir(), `autofix-gate-${slugify(seam.seamKey)}.json`);
    const r = spawnSync('node', ['scripts/playtest-harness.mjs', '--replay', replayFile, '--seeds', seam.seed,
      '--turns', String(seam.turns || 25), '--goal', seam.goalId, '--json', jsonOut, '--no-report'],
      { cwd: workDir, encoding: 'utf-8', env: process.env, maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`replay gate exited ${r.status}: ${(r.stderr || r.stdout || '').slice(-300)}`);
    return JSON.parse(fs.readFileSync(jsonOut, 'utf-8')).flatMap(rr => rr.findings || []);
  }
  return {
    async reproduces(seam) { return replayFindings(seam).some(f => f.oracleId === seam.oracleId); },
    async evaluate(seam) {
      if (replayFindings(seam).some(f => f.oracleId === seam.oracleId)) return { pass: false, reason: 'replay still fires the seam', stage: 'replay' };
      const suite = runSuite(workDir);
      if (!(suite.fail === 0 && suite.pass >= baselinePass)) return { pass: false, reason: `suite not green (pass ${suite.pass}/≥${baselinePass}, fail ${suite.fail})`, stage: 'suite', suite };
      return { pass: true, reason: `replay clean + suite green (${suite.pass}/${suite.fail})`, suite };
    },
  };
}

function makeVcs({ workDir, dryCommit }) {
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: workDir, encoding: 'utf-8', env: process.env });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout || '').trim()}`);
    return (r.stdout || '').trim();
  };
  return {
    git,
    async applyEdits(edits) {
      const files = [];
      for (const e of edits) {
        if (typeof e.file !== 'string' || typeof e.oldString !== 'string' || typeof e.newString !== 'string') throw new Error('malformed edit');
        const abs = path.join(workDir, e.file);
        const before = fs.readFileSync(abs, 'utf-8');
        if (!before.includes(e.oldString)) throw new Error(`oldString not found in ${e.file}`);
        const after = before.replace(e.oldString, e.newString);
        if (after === before) throw new Error(`edit was a no-op in ${e.file}`);
        fs.writeFileSync(abs, after);
        if (!files.includes(e.file)) files.push(e.file);
      }
      return { files };
    },
    async writeFile(rel, content) {
      const abs = path.join(workDir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    },
    async revert(modifiedFiles, createdFiles) {
      for (const f of modifiedFiles || []) { try { git(['checkout', '--', f]); } catch { /* best effort */ } }
      for (const f of createdFiles || []) { try { fs.rmSync(path.join(workDir, f), { force: true }); } catch { /* best effort */ } }
    },
    async commit(message, files) {
      if (dryCommit) return { hash: '(dry-run)', dry: true, files };
      git(['add', '--', ...files]);
      const msgFile = path.join(os.tmpdir(), `autofix-commit-${Date.now()}.txt`);
      fs.writeFileSync(msgFile, message);
      git(['commit', '-F', msgFile]);
      return { hash: git(['rev-parse', '--short', 'HEAD']), files };
    },
  };
}

// — The real fixer: a coding model proposes a minimal exact-string patch. Pluggable
// (Codex CLI for engine hot files per routing is a drop-in; API is the default). —
const RETRYABLE = new Set([429, 500, 502, 503, 529]);
async function callAnthropic({ key, model, system, user, maxTokens = 1400 }) {
  const body = JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] });
  let lastErr = 'unknown';
  for (let attempt = 0; attempt <= 6; attempt++) {
    if (attempt > 0) await new Promise(res => setTimeout(res, Math.min(20000, 1000 * 2 ** (attempt - 1))));
    let r;
    try { r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body }); }
    catch (e) { lastErr = `network: ${e.message}`; continue; }
    const j = await r.json();
    if (j.error) { if (RETRYABLE.has(r.status)) { lastErr = `${r.status}: ${j.error.message}`; continue; } throw new Error(`${model} ${r.status}: ${j.error.message}`); }
    return (j.content || []).map(b => b.text || '').join('').trim();
  }
  throw new Error(`${model} failed after retries — last: ${lastErr}`);
}

export function parsePatch(text) {
  let s = String(text || '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{'), end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let obj;
  try { obj = JSON.parse(s.slice(start, end + 1)); } catch { return null; }
  if (!obj || !Array.isArray(obj.edits)) return null;
  const edits = obj.edits.filter(e => e && typeof e.file === 'string' && typeof e.oldString === 'string' && typeof e.newString === 'string' && e.oldString.length > 0);
  if (!edits.length) return null;
  return { rationale: String(obj.rationale || '').slice(0, 300), edits };
}

export function makeApiFixer({ key, model, workDir }) {
  return {
    async proposeFix({ seam, attempt, priorAttempts }) {
      const ctx = extractContext(seam.locus, workDir);
      const ex = seam.findings[0] || {};
      const priors = (priorAttempts || []).filter(a => a.status === 'gate-failed' || a.status === 'apply-failed')
        .map(a => `  - attempt ${a.attempt}: ${a.status}${a.verdict?.reason ? ` (${a.verdict.reason})` : ''}`).join('\n');
      const system = `You are a precise software engineer fixing ONE localized bug in a DETERMINISTIC text-RPG engine.
Reply with ONLY a JSON object, no prose, no markdown fences:
{"rationale":"<=1 sentence","edits":[{"file":"<path>","oldString":"<exact verbatim substring of the file>","newString":"<replacement>"}]}
Hard rules:
- oldString MUST be an EXACT substring of the shown source (copy it verbatim, include enough lines to be unique).
- Make the SMALLEST change that fixes the bug. Do NOT reformat or touch unrelated code.
- The engine is deterministic: never add randomness, time, network, or file I/O.`;
      const user = `An automated playtester's deterministic oracle "${seam.oracleId}" flagged a LIVED bug:
${seam.note}

What happened:
- The player typed: "${ex.action || ''}"
- Oracle claim: ${ex.claim || seam.note}
- Expected: ${ex.expected || '(see note)'}
- Actually committed: ${ex.committed || '(see note)'}

This is an INTENT-ROUTING miss: the action should have been recognised and routed to the correct roll-free path, but it fell through to the generic die-roll resolver. Fix the routing so this input (and its close variants) is classified correctly.

Function \`${ctx?.symbol}\` in \`${ctx?.file}\` (from line ${ctx?.startLine}):
\`\`\`js
${ctx?.source}
\`\`\`
${priors ? `\nPrevious attempts FAILED the gate:\n${priors}\nTry a DIFFERENT minimal edit.\n` : ''}
Return the JSON patch now.`;
      const text = await callAnthropic({ key, model, system, user });
      return parsePatch(text);
    },
  };
}

// Canned fixers for offline smoke (no key): the known-good free-action patch, and a
// deliberately-broken one to watch the gate auto-revert. (The hermetic TEST uses its
// own in-memory fakes; these are for `--fixer fake-good|fake-bad` manual runs.)
function makeCannedFixer(kind) {
  const GOOD = {
    rationale: 'Strip trailing sentence punctuation before the $-anchored enter/exit match (mirrors classifyTrivial).',
    edits: [{
      file: 'engine/playloop.js',
      oldString: "function inferInteriorAction(text, interior) {\n  const t = String(text || '').toLowerCase().trim();\n  const inside = Boolean(interior && typeof interior === 'object');",
      newString: "function inferInteriorAction(text, interior) {\n  // Strip trailing sentence punctuation before matching: the enter/exit patterns\n  // below are `$`-anchored, so a natural \"I step inside the building.\" would miss\n  // the enter rule on the stray period and fall through to a die roll. Mirrors the\n  // same normalization classifyTrivial already does.\n  const t = String(text || '').toLowerCase().trim().replace(/[.!?]+$/, '');\n  const inside = Boolean(interior && typeof interior === 'object');",
    }],
  };
  const BAD = { rationale: 'Deliberately wrong (no-op-ish) patch to exercise the gate.', edits: [{ file: 'engine/playloop.js', oldString: "function inferInteriorAction(text, interior) {", newString: "function inferInteriorAction(text, interior) { /* auto-fix probe (no behaviour change) */" }] };
  return { async proposeFix() { return kind === 'fake-bad' ? BAD : GOOD; } };
}

// ── Report ────────────────────────────────────────────────────────────────────
function writeReport({ ts, branchName, baseBranch, seeds, findPlayer, results, needsHuman, before, after, workDir }) {
  const dir = path.join(workDir, 'docs', 'playtests', 'harness');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `autofix-${ts}.md`);
  const fixed = results.filter(r => r.status === 'fixed');
  const couldnt = results.filter(r => r.status === 'couldnt-fix');
  const other = results.filter(r => !['fixed', 'couldnt-fix'].includes(r.status));
  const L = [];
  L.push(`# Autonomous fix loop — ${ts}`);
  L.push('');
  L.push(`**Branch:** \`${branchName}\` (off \`${baseBranch}\`) — NOT pushed, NOT merged. Review: \`git log ${branchName}\`; merge when ready.`);
  L.push(`**Seeds:** ${seeds.join(', ')} · **finder:** ${findPlayer} · **gate:** per-seam LLM-off replay flip + full \`node --test\``);
  L.push(`**Seams found:** ${before.length} → fixed ${fixed.length}, couldn't-fix ${couldnt.length}, needs-human ${needsHuman.length}${other.length ? `, other ${other.length}` : ''}.`);
  L.push('');

  L.push('## ✅ Fixed (gated + committed on the branch)');
  if (!fixed.length) L.push('\n_None this run._');
  for (const r of fixed) {
    const f = r.fixed;
    L.push('');
    L.push(`### \`${r.seam.seamKey}\` — ${r.seam.kind}  ·  commit \`${f.commit?.hash}\``);
    L.push(`- **Bug:** ${String(r.seam.note).replace(/\n/g, ' ')} _(seed ${r.seam.seed}, ${r.seam.count} finding(s))_`);
    L.push(`- **Locus:** \`${r.seam.locus?.file}\`${r.seam.locus?.symbol ? ` → \`${r.seam.locus.symbol}\`` : ''}`);
    if (f.rationale) L.push(`- **Fix rationale:** ${f.rationale}`);
    L.push(`- **Proof (deterministic):** the seam's replay flipped FAIL→PASS; ${f.verdict?.reason || 'gate green'}.`);
    L.push(`- **Regression test:** \`${f.regressionFile}\` (replays the failing seed; fails if the seam returns).`);
    L.push(`- **Diff:** \`git show ${f.commit?.hash}\``);
    for (const e of f.edits || []) {
      L.push('  ```diff');
      for (const ln of String(e.oldString).split('\n')) L.push(`  - ${ln}`);
      for (const ln of String(e.newString).split('\n')) L.push(`  + ${ln}`);
      L.push('  ```');
    }
  }
  L.push('');

  L.push('## ⚠️ Couldn\'t fix (diagnosed, reverted, left clean)');
  if (!couldnt.length) L.push('\n_None._');
  for (const r of couldnt) {
    L.push('');
    L.push(`### \`${r.seam.seamKey}\` — ${r.seam.kind}`);
    L.push(`- **Bug:** ${String(r.seam.note).replace(/\n/g, ' ')} _(seed ${r.seam.seed})_`);
    L.push(`- **Attempts:** ${r.attempts.length} — all reverted by the gate. The deterministic verifier never let a bad patch survive.`);
    for (const a of r.attempts) L.push(`  - attempt ${a.attempt}: \`${a.status}\`${a.verdict?.reason ? ` — ${a.verdict.reason}` : ''}${a.error ? ` — ${a.error}` : ''}`);
  }
  L.push('');

  L.push('## 🧑‍⚖️ Needs human (design judgment — returned untouched)');
  if (!needsHuman.length) L.push('\n_None._');
  for (const seam of needsHuman) {
    L.push('');
    L.push(`### \`${seam.seamKey}\` — ${seam.kind}`);
    L.push(`- **Bug:** ${String(seam.note).replace(/\n/g, ' ')} _(seed ${seam.seed}, ${seam.count} finding(s))_`);
    L.push(`- **Why not auto-fixed:** ${seam.reason}`);
    if (seam.locus?.file) L.push(`- **Likely locus:** \`${seam.locus.file}\`${seam.locus.symbol ? ` → \`${seam.locus.symbol}\`` : ''}`);
  }
  if (other.length) {
    L.push('');
    L.push('## Other');
    for (const r of other) L.push(`- \`${r.seam.seamKey}\`: ${r.status}${r.reason ? ` — ${r.reason}` : ''}${r.error ? ` — ${r.error}` : ''}`);
  }
  L.push('');

  L.push('## Re-run confirmation (same seeds, LLM-off replay)');
  const beforeKeys = new Set(before.map(s => s.seamKey));
  const afterKeys = new Set(after.map(s => s.seamKey));
  const dropped = [...beforeKeys].filter(k => !afterKeys.has(k));
  const remaining = [...afterKeys];
  const novel = [...afterKeys].filter(k => !beforeKeys.has(k));
  L.push(`- **Before:** ${before.length} seam(s): ${[...beforeKeys].join(', ') || '—'}`);
  L.push(`- **After:** ${after.length} seam(s): ${remaining.join(', ') || '—'}`);
  L.push(`- **Dropped:** ${dropped.join(', ') || '—'}`);
  L.push(`- **New (regressions introduced):** ${novel.length ? '⚠️ ' + novel.join(', ') : 'none ✅'}`);
  L.push('');
  L.push('---');
  L.push('_Generated by `scripts/auto-playtest.mjs` — Phase 3. The branch is left for review; nothing was pushed or merged._');

  fs.writeFileSync(file, L.join('\n'));
  return { file, fixed: fixed.length, couldnt: couldnt.length, needsHuman: needsHuman.length, dropped, novel };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI-main — SETUP → FIND → GROUP → TRIAGE → FIX → RE-RUN → REPORT → STOP.
// Guarded by isMain, so importing this module (the test) runs none of it.
// ─────────────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMain) {
  const ARGV = process.argv.slice(2);
  const arg = (name, def) => { const i = ARGV.indexOf(`--${name}`); return i >= 0 && ARGV[i + 1] && !ARGV[i + 1].startsWith('--') ? ARGV[i + 1] : def; };
  const has = (name) => ARGV.includes(`--${name}`);

  const SEEDS = arg('seeds', 'tallow').split(',').map(s => s.trim()).filter(Boolean);
  const GOAL = arg('goal', 'reach-first-concern');
  const TURNS = Number(arg('turns', '25'));
  const FIND_PLAYER = arg('find-player', (process.env.ANTHROPIC_API_KEY || '').trim() ? 'llm' : 'scripted'); // llm | scripted | replay:<file>
  const MAX_ATTEMPTS = Number(arg('max-attempts', '3'));
  const MAX_SEAMS = Number(arg('max-seams', '5'));
  const TIME_BUDGET = Number(arg('time-budget', '1800')); // seconds
  const FIXER = arg('fixer', (process.env.ANTHROPIC_API_KEY || '').trim() ? 'api' : 'fake-good'); // api | fake-good | fake-bad | dry
  const FIXER_MODEL = arg('fixer-model', 'claude-sonnet-4-6');
  const BRANCH_PREFIX = arg('branch-prefix', 'auto-fix');
  const DRY_COMMIT = has('no-commit');
  const KEY = (process.env.ANTHROPIC_API_KEY || '').trim();

  const log = (...a) => console.log(...a);
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const deadline = Date.now() + TIME_BUDGET * 1000;

  function findArgsFor() {
    const base = ['--seeds', SEEDS.join(','), '--goal', GOAL, '--turns', String(TURNS)];
    if (FIND_PLAYER.startsWith('replay:')) return ['--replay', FIND_PLAYER.slice('replay:'.length), ...base];
    return ['--player', FIND_PLAYER, ...base];
  }

  function flatten(runs) {
    return runs.flatMap(r => (r.findings || []).map(f => ({ ...f, seed: r.seed, actions: r.actionsLog || [], goalId: r.goal || GOAL, turns: TURNS })));
  }

  function git(args, opts = {}) {
    const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf-8', env: process.env, ...opts });
    if (r.status !== 0 && !opts.allowFail) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout || '').trim()}`);
    return (r.stdout || '').trim();
  }

  (async () => {
    log(`\n════════ AUTONOMOUS FIX LOOP — ${ts} ════════`);
    log(`seeds=${SEEDS.join(',')} · finder=${FIND_PLAYER} · fixer=${FIXER}${FIXER === 'api' ? `(${FIXER_MODEL})` : ''} · max-attempts=${MAX_ATTEMPTS} · max-seams=${MAX_SEAMS} · budget=${TIME_BUDGET}s`);

    // ── SETUP — refuse a dirty tracked tree, then branch (isolation rail #1). ──
    const baseBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
    const dirty = git(['status', '--porcelain']).split('\n').filter(l => l && !l.startsWith('??'));
    if (dirty.length) { console.error(`REFUSING: working tree has uncommitted tracked changes:\n${dirty.join('\n')}\nCommit or stash them first (untracked files are fine).`); process.exit(2); }
    const branchName = `${BRANCH_PREFIX}/${ts}`;
    git(['switch', '-c', branchName]);
    log(`\n[SETUP] on isolated branch ${branchName} (off ${baseBranch}). v2-polish is untouched.`);

    let reportInfo = null;
    try {
      // ── FIND ──
      log(`\n[FIND] running the finder (${FIND_PLAYER})…`);
      const runs0 = runFinder({ findArgs: findArgsFor(), workDir: ROOT, tag: 'pre' });
      // Persist the captured action logs so RE-RUN + the gate are deterministic
      // even when the finder discovered via the (stochastic) llm player.
      const replayAll = path.join(os.tmpdir(), `autofix-rerun-${ts}.json`);
      fs.writeFileSync(replayAll, JSON.stringify(runs0.map(r => ({ seed: r.seed, goal: r.goal, actions: r.actionsLog })), null, 2));
      const before = groupFindings(flatten(runs0));
      log(`[FIND] ${runs0.reduce((a, r) => a + (r.findings || []).length, 0)} finding(s) → ${before.length} seam(s).`);

      // ── GROUP + TRIAGE ──
      const { autoFixable, needsHuman } = triageSeams(before);
      const targets = autoFixable.slice(0, MAX_SEAMS);
      log(`[TRIAGE] auto-fixable: ${autoFixable.map(s => s.seamKey).join(', ') || '—'}${autoFixable.length > targets.length ? ` (capped to ${MAX_SEAMS})` : ''}`);
      log(`[TRIAGE] needs-human: ${needsHuman.map(s => s.seamKey).join(', ') || '—'}`);

      // ── FIX ──
      let results = [];
      if (FIXER === 'dry') {
        log('\n[FIX] --fixer dry: skipping fixes (find + triage + report only).');
        results = targets.map(seam => ({ seam, status: 'deferred', reason: 'dry run (--fixer dry)', attempts: [] }));
      } else {
        const fixer = FIXER === 'api' ? makeApiFixer({ key: KEY, model: FIXER_MODEL, workDir: ROOT }) : makeCannedFixer(FIXER);
        const gate = makeGate({ workDir: ROOT, baselinePass: 8569 });
        const vcs = makeVcs({ workDir: ROOT, dryCommit: DRY_COMMIT });
        results = await runFixLoop({ seams: targets, fixer, gate, vcs, maxAttempts: MAX_ATTEMPTS, log, deadline });
      }

      // ── RE-RUN (deterministic: replay the captured action logs) ──
      log('\n[RE-RUN] replaying the captured action logs to confirm the drop + no new findings…');
      const runs1 = runFinder({ findArgs: ['--replay', replayAll, '--seeds', SEEDS.join(','), '--goal', GOAL, '--turns', String(TURNS)], workDir: ROOT, tag: 'post' });
      const after = groupFindings(flatten(runs1));

      // ── REPORT ──
      reportInfo = writeReport({ ts, branchName, baseBranch, seeds: SEEDS, findPlayer: FIND_PLAYER, results, needsHuman, before, after, workDir: ROOT });
      // Commit the report itself onto the branch (audit trail), unless dry.
      if (!DRY_COMMIT) {
        git(['add', '--', path.relative(ROOT, reportInfo.file)]);
        const msg = path.join(os.tmpdir(), `autofix-report-msg-${ts}.txt`);
        fs.writeFileSync(msg, `docs(harness): autofix run ${ts} report\n\nFixed ${reportInfo.fixed}, couldn't-fix ${reportInfo.couldnt}, needs-human ${reportInfo.needsHuman}.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`);
        git(['commit', '-F', msg]);
      }

      log(`\n════════ DONE ════════`);
      log(`Fixed: ${reportInfo.fixed} · Couldn't-fix: ${reportInfo.couldnt} · Needs-human: ${reportInfo.needsHuman}`);
      log(`Re-run dropped: ${reportInfo.dropped.join(', ') || '—'} · New regressions: ${reportInfo.novel.length ? '⚠️ ' + reportInfo.novel.join(', ') : 'none ✅'}`);
      log(`Report: ${path.relative(ROOT, reportInfo.file)}`);
      log(`Branch: ${branchName} — review with \`git log ${branchName}\`. NOT pushed, NOT merged.`);
    } finally {
      // Return Tim's checkout to where he left it (the fixes stay on the branch).
      // If something is uncommitted (e.g. --no-commit), keep him on the branch.
      const stillDirty = git(['status', '--porcelain'], { allowFail: true }).split('\n').filter(l => l && !l.startsWith('??')).length;
      if (!stillDirty) { git(['switch', baseBranch], { allowFail: true }); log(`\nReturned to ${baseBranch}. Fixes are on ${branchName}.`); }
      else { log(`\n(left on ${branchName} — uncommitted changes present; review before switching.)`); }
    }
  })().catch(e => { console.error('\nFATAL:', e?.stack || e); process.exit(1); });
}
