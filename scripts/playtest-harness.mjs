// ─────────────────────────────────────────────────────────────────────────────
// playtest-harness.mjs — the Human Playtest Harness, Phase 1 (the FINDER MVP).
//
// WHAT THIS IS: the first autonomous playtester. It boots the locked demo region
// (`tallow`), points a GOAL-DIRECTED player at the funnel beat ("leave the first
// building, reach the first NPC with a concern"), drives the REAL engine turn API
// (grace → playerMove), and runs a bank of DETERMINISTIC oracles every turn to
// surface LIVED / coherence bugs — the "I couldn't leave / the DM lied about where
// I am / I'm stuck" class a human hits. See docs/HUMAN_PLAYTEST_HARNESS.md (build),
// docs/HARNESS_USAGE_STRATEGY.md (aim), THE_TABLE_TEST.md (oracle spec).
//
// COST: the oracles are FREE (pure functions over committed state) — the whole
// design point. The ONLY API cost is the cheap goal-player choosing actions; a
// scripted/replay player costs nothing and is deterministic. Findings are
// LLM-OFF reproducible: every run saves its action log, and `--replay <file>`
// re-drives those exact actions on the same seed → the same findings, no LLM.
//
// FINDER, not fixer (Tim, 2026-06-24): it plays + detects + reports. It never edits
// engine code. Outputs are structured + seam-groupable so a later find→fix loop can
// feed on them — but that (Phase 3) is gated until the finder has earned trust.
//
// RUN:
//   node scripts/playtest-harness.mjs                       # tallow, LLM player (needs ANTHROPIC_API_KEY)
//   node scripts/playtest-harness.mjs --seeds tallow,foo    # several seeds
//   node scripts/playtest-harness.mjs --player scripted     # offline canned opener (no key, deterministic)
//   node scripts/playtest-harness.mjs --replay docs/playtests/harness/<file>.json   # LLM-off repro
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { DEMO_SEED } from '../engine/world/demoRegion.js';
import { getGoal } from '../engine/harness/goals.js';
import { runOracleBank, checkSoftLock, cleanNarration, SOFT_LOCK_WINDOW } from '../engine/harness/oracles.js';
import { judgeSession } from '../engine/harness/qualityJudge.js';
import { augmentNarration } from '../engine/llmAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// ── Packs (the live default the browser boots: fantasy + merged sub-regions) ──
export function loadPacks() {
  const packsDir = path.join(ROOT, 'packs');
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf-8')));
  const byId = {};
  for (const p of manifest.packs) {
    byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(ROOT, p.path), 'utf-8')));
  }
  return byId;
}

// Boot a session world exactly as public/v1.js does (escape mode = the live combat
// engine; fantasy primary). Seeded → replay-stable.
export function bootWorld(seed, packs) {
  return beginAdventure(
    newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
    packs,
  );
}

// ── The session loop (injectable player; NO network, NO file I/O — hermetic) ───
// `player(ctx)` -> next action string (or '' to stop). ctx = { world, goal,
// transcript, turn, stuck }. This is the heart of the harness; the CLI wraps it
// with an LLM player + reporting, the test wraps it with a scripted player.
// `narrate({world,output,action}) -> Promise<string>` (optional): in REAL-DM mode it
// returns the live LLM narration (augmentNarration) so the oracles + transcript see the
// prose a player actually reads, not the gen:s/m/f skeleton. `judge({system,user}) ->
// Promise<string>` (optional): the Tier-2 quality model. Both default OFF → the
// hermetic test path stays fully deterministic and free.
export async function runSession({ world, packs, goal, player, turns = 25, softLockWindow = SOFT_LOCK_WINDOW, openerNarration = '', narrate = null, judge = null }) {
  const transcript = [];
  if (openerNarration) transcript.push({ who: 'dm', text: cleanNarration(openerNarration) });

  const findings = [];
  const actionsLog = [];
  const progressHistory = []; // post-turn progressMetric, one entry per turn

  // Goals read committed state plus (optionally) the action history — a coverage
  // goal like probe-room needs to know what's been probed. Existing one-arg goals
  // ignore the 2nd arg, so this is backward-compatible.
  let bestProgress = goal.progressMetric(world, { actionsLog });
  let sinceImprovement = 0;
  let goalCompleted = goal.satisfied(world, { actionsLog });

  for (let turn = 1; turn <= turns && !goalCompleted; turn++) {
    const action = String(await player({ world, goal, transcript, turn, stuck: sinceImprovement >= softLockWindow }) || '').trim();
    if (!action) break;
    actionsLog.push(action);
    transcript.push({ who: 'you', text: action });

    // Gate 0 — meta-grace (only out of combat/dialogue, mirroring v1.js / dm-playtest).
    const inCombat = Boolean(world.combat?.active);
    const inDialogue = Boolean(world.scene?.dialogue?.npcId);
    let metaAnswer = null;
    if (!inCombat && !inDialogue && isMetaQuestion(action)) {
      try { metaAnswer = handleMetaQuestion(action, world); } catch { metaAnswer = null; }
    }

    if (metaAnswer) {
      // A meta-question takes no turn and changes no state — record it, count it as
      // no-progress (so endless meta-loops trip the soft-lock), run no state oracle.
      transcript.push({ who: 'dm', text: cleanNarration(metaAnswer), meta: true });
    } else {
      const before = world;
      let after, output;
      try {
        ({ world: after, output } = playerMove(before, packs, action));
      } catch (e) {
        findings.push({ oracleId: 'crash', severity: 'high', turn, action, claim: 'the player\'s action', expected: 'a turn that does not throw', committed: 'engine threw', note: `[ENGINE THREW] ${e?.message || e}` });
        break;
      }
      // Real-DM mode: swap the deterministic skeleton narration for the LIVE DM
      // (augmentNarration) so BOTH the oracles and the quality judge see the prose a
      // player actually reads. Falls back to base on any miss (Invariant 4).
      let narration = output?.narration;
      if (narrate) { try { const real = await narrate({ world: after, output, action }); if (real) narration = real; } catch { /* keep base */ } }
      const dmOutput = narrate ? { ...output, narration } : output;
      findings.push(...runOracleBank({ before, after, action, output: dmOutput, turn }));
      world = after;
      transcript.push({ who: 'dm', text: cleanNarration(narration), mech: output?.mechanics || '' });
      if (goal.satisfied(world, { actionsLog })) goalCompleted = true;
    }

    const prog = goal.progressMetric(world, { actionsLog });
    progressHistory.push(prog);
    if (prog > bestProgress) { bestProgress = prog; sinceImprovement = 0; }
    else sinceImprovement += 1;

    const sl = checkSoftLock(progressHistory, { window: softLockWindow, goal, turn });
    if (sl) findings.push({ ...sl, action });
  }

  // Tier-2 QUALITY judge — one cheap call over the REAL transcript (the open-ended
  // "is this a real DM?" half the deterministic oracles can't see). Findings are
  // tagged quality-* (discovery / human-triage, NEVER auto-fixed). Off by default.
  if (judge) findings.push(...await judgeSession({ transcript, callModel: judge }));

  return {
    goal: goal.id,
    goalDescription: goal.description,
    turns: actionsLog.length,
    goalCompleted,
    progressMax: bestProgress,
    findings,
    actionsLog,
    transcript,
  };
}

// A 3-turn slice of the transcript ending at a finding's turn — enough context to
// read the finding without the whole log.
function transcriptSlice(transcript, turn) {
  // transcript interleaves dm/you; map back to the player turn index loosely by
  // taking the tail. Cheap + good enough for a finding's "what led here".
  const youIdx = [];
  transcript.forEach((t, i) => { if (t.who === 'you') youIdx.push(i); });
  const anchor = youIdx[Math.min(turn, youIdx.length) - 1] ?? transcript.length - 1;
  return transcript.slice(Math.max(0, anchor - 3), anchor + 2)
    .map(t => `${t.who === 'you' ? 'YOU' : 'DM '}: ${String(t.text).replace(/\n/g, ' ').slice(0, 160)}`);
}

// ── A deterministic, no-key player: replays a fixed action list ───────────────
// The Phase-1 stand-in (NOT the Phase-2 legalActions goal-pursuer): used by the
// hermetic test, the `--player scripted` smoke mode, and `--replay`. Zero cost.
export function makeScriptedPlayer(actions) {
  let i = 0;
  const list = Array.isArray(actions) ? actions : [];
  return async () => (i < list.length ? list[i++] : '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Run-to-saturation ("boringly predictable") — Vol 9 §2-3 (capture–recapture /
// Chao1 + the discovery curve). "Boring" = explored-wide-and-found-nothing-new,
// NEVER player-repetition: each run is a fresh world played by a VARYING player, we
// track the curve of unique seamKeys, and stop when it flattens or Chao1 says ~0
// remain. This turns "how close to done" from eyeballing into a number with bars.
// The math + loop are PURE (an injected nextRun), so the stopping rule is unit-
// tested on a fake discovery stream with zero model calls.
// ─────────────────────────────────────────────────────────────────────────────

// A finding's seam identity = oracleId + the leading kebab slug of its note (the
// same grouping the fix loop uses). Kept local to avoid a cycle with the fixer
// script (which imports from here); the two definitions are intentionally aligned.
export function seamKeyOf(finding) {
  const m = String(finding?.note || '').trim().match(/^([a-z0-9]+(?:-[a-z0-9]+)*)/i);
  return `${finding?.oracleId || 'unknown'}::${m ? m[1] : 'unknown'}`;
}

// Chao1 lower-bound richness estimator + a log-normal 95% CI (Chao 1987). Input =
// incidence counts: for each distinct seam, in how many runs it appeared. f1 =
// seams seen in exactly one run, f2 = in exactly two. The bias-corrected form is
// used when f2 = 0 so the estimate stays finite. Report as "at least N remain".
export function chao1(incidenceCounts) {
  const counts = (Array.isArray(incidenceCounts) ? incidenceCounts : Object.values(incidenceCounts || {}))
    .map(Number).filter(c => c > 0);
  const sObs = counts.length;
  const f1 = counts.filter(c => c === 1).length;
  const f2 = counts.filter(c => c === 2).length;
  const extra = f2 > 0 ? (f1 * f1) / (2 * f2) : (f1 * (f1 - 1)) / 2;
  const estimate = sObs + extra;
  const remaining = Math.max(0, estimate - sObs);
  // Log-normal CI on the unseen count (Chao 1987 / Chao & Jost 2012).
  let ciLow = sObs, ciHigh = Math.ceil(estimate);
  if (remaining > 0) {
    const r = f2 > 0 ? f1 / f2 : 0;
    const variance = f2 > 0
      ? f2 * (0.25 * r ** 4 + r ** 3 + 0.5 * r ** 2)
      : (f1 * (f1 - 1)) / 2 + (f1 * (2 * f1 - 1) ** 2) / 4 - (f1 ** 4) / (4 * estimate);
    const safeVar = Math.max(variance, 1e-9);
    const K = Math.exp(1.96 * Math.sqrt(Math.log(1 + safeVar / (remaining * remaining))));
    ciLow = Math.round(sObs + remaining / K);
    ciHigh = Math.round(sObs + remaining * K);
  }
  return { sObs, f1, f2, estimate, remaining, ciLow, ciHigh };
}

// The saturation loop. `nextRun(i)` -> { seamKeys: string[], ... } | null (null =
// the stream is exhausted / over budget → stop). Stops when: the curve is flat
// (no new seam for `k` consecutive runs), OR Chao1 says nothing remains (every seam
// re-seen, f1 = 0), OR a hard cap trips (maxRuns / isOverBudget). Returns the curve,
// the unique-seam set, and the final Chao1 estimate.
export async function runToSaturation({ nextRun, k = 8, maxRuns = 200, isOverBudget = () => false, onRun = () => {} }) {
  const incidence = new Map(); // seamKey -> # runs it appeared in
  const curve = [];            // cumulative distinct seamKeys after each run
  let runsSinceNew = 0;
  let stopReason = null;
  let i = 0;
  for (; i < maxRuns; i++) {
    if (isOverBudget()) { stopReason = 'budget'; break; }
    const res = await nextRun(i);
    if (!res) { stopReason = 'stream-end'; break; }
    const before = incidence.size;
    for (const key of new Set(res.seamKeys || [])) incidence.set(key, (incidence.get(key) || 0) + 1);
    const totalDistinct = incidence.size;
    const newThisRun = totalDistinct - before;
    curve.push(totalDistinct);
    runsSinceNew = newThisRun > 0 ? 0 : runsSinceNew + 1;
    onRun({ run: i + 1, newThisRun, totalDistinct, seamKeys: [...new Set(res.seamKeys || [])] });
    // Flat curve — the primary "boring" signal (works even with zero findings).
    if (i + 1 >= k && runsSinceNew >= k) { stopReason = 'flat-curve'; break; }
    // Chao1 saturation — every discovered seam re-seen (no singletons) ⇒ remaining 0.
    const est = chao1([...incidence.values()]);
    if (i + 1 >= 3 && est.sObs > 0 && est.f1 === 0) { stopReason = 'chao1-saturated'; break; }
  }
  if (!stopReason) stopReason = 'max-runs';
  return {
    stopReason, runs: curve.length, uniqueSeams: incidence.size, curve,
    estimate: chao1([...incidence.values()]), counts: Object.fromEntries(incidence),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Everything below is CLI-only (arg parsing, the LLM player, reporting). It runs
// solely when this file is invoked directly, so importing it (the test) is inert.
// ─────────────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMain) {
  const ARGV = process.argv.slice(2);
  const arg = (name, def) => { const i = ARGV.indexOf(`--${name}`); return i >= 0 && ARGV[i + 1] && !ARGV[i + 1].startsWith('--') ? ARGV[i + 1] : def; };
  const has = (name) => ARGV.includes(`--${name}`);

  const KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
  const REPLAY = arg('replay', null);
  const JSON_OUT = arg('json', null); // machine-readable findings sink (the Phase-3 gate reads this)
  const TURNS = Number(arg('turns', '25'));
  const GOAL_ID = arg('goal', 'reach-first-concern');
  const PLAYER_MODEL = arg('player-model', 'claude-haiku-4-5-20251001'); // cheap by directive
  const REFLECT_AT = Number(arg('reflect', '15'));
  const SEEDS = arg('seeds', DEMO_SEED).split(',').map(s => s.trim()).filter(Boolean);
  const PLAYER_KIND = REPLAY ? 'replay' : arg('player', KEY ? 'llm' : 'scripted');
  const WRITE_REPORT = !has('no-report');
  // --real-dm: route each turn through the LIVE DM (augmentNarration) + run the Tier-2
  // quality judge. This is the only mode whose verdict is about the game a human plays;
  // without it the harness judges the deterministic skeleton (free, replayable, but the
  // DM's brain is off). DM model cheap+real; judge model stronger + DECOUPLED (Vol 14).
  const REAL_DM = has('real-dm');
  const DM_MODEL = arg('dm-model', 'claude-haiku-4-5-20251001');
  const JUDGE_MODEL = arg('judge-model', 'claude-sonnet-4-6');

  // ── Thin Anthropic client (forked from dm-playtest.mjs: no temperature on Opus,
  // patient retry on transient overload). Only used by the LLM player. ──────────
  const RETRYABLE = new Set([429, 500, 502, 503, 529]);
  const usage = { in: 0, out: 0, calls: 0 };
  async function ask({ system, user, model, maxTokens = 120 }) {
    const body = JSON.stringify({ model, max_tokens: maxTokens, ...(system ? { system } : {}), messages: [{ role: 'user', content: user }] });
    let lastErr = 'unknown';
    const MAX_RETRY = 8;
    for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
      if (attempt > 0) {
        const waitMs = Math.min(30000, 1000 * 2 ** (attempt - 1));
        process.stderr.write(`  [retry ${attempt}/${MAX_RETRY} — ${lastErr} — ${waitMs}ms]\n`);
        await new Promise(res => setTimeout(res, waitMs));
      }
      let r;
      try {
        r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
          body,
        });
      } catch (e) { lastErr = `network: ${e.message}`; continue; }
      const j = await r.json();
      if (j.error) { if (RETRYABLE.has(r.status)) { lastErr = `${r.status}: ${j.error.message}`; continue; } throw new Error(`${model} ${r.status}: ${j.error.message}`); }
      if (j.usage) { usage.in += j.usage.input_tokens || 0; usage.out += j.usage.output_tokens || 0; usage.calls++; }
      return (j.content || []).map(b => b.text || '').join('').trim();
    }
    throw new Error(`${model} failed after ${MAX_RETRY} retries — last: ${lastErr}`);
  }

  // ── The goal-directed LLM player (cheap model; reflect-when-stuck per TITAN) ──
  const PLAYER_SYSTEM = (goal) =>
    `You are a player in a text RPG run by an AI Dungeon Master. You talk like a normal person — ` +
    `natural first person, ONE concrete action or line per turn, no quotes, no meta, no stage directions.\n\n` +
    `YOUR GOAL: ${goal.description}\n\n` +
    `Pursue it directly. You can move ("I step outside", "I go to the square"), look ("I look around"), ` +
    `find people ("who is around?"), and talk to them ("I talk to the innkeeper"). Keep each turn to a ` +
    `single short line — what you would type.`;
  function llmPlayer(model) {
    return async ({ goal, transcript, stuck }) => {
      const script = transcript.map(t => `${t.who === 'you' ? 'YOU' : 'DM'}: ${t.text}`).join('\n');
      const reflect = stuck
        ? `\n\nYou have made NO progress for a while and you may be repeating yourself. STOP. Look back at ` +
          `what you have tried, and take a CLEARLY DIFFERENT action this turn to move toward the goal.`
        : '';
      const line = await ask({
        system: PLAYER_SYSTEM(goal),
        user: `--- SESSION SO FAR ---\n${script || '(the adventure is just beginning)'}\n--- END ---${reflect}\n\nYour next line:`,
        model, maxTokens: 80,
      });
      return line.replace(/^["'`]+|["'`]+$/g, '').split('\n')[0].trim().slice(0, 200);
    };
  }

  function pickPlayer(seed, goal) {
    if (PLAYER_KIND === 'replay') {
      const saved = JSON.parse(fs.readFileSync(path.resolve(REPLAY), 'utf-8'));
      const entry = Array.isArray(saved) ? saved.find(s => s.seed === seed) || saved[0] : saved;
      return makeScriptedPlayer(entry?.actions || []);
    }
    if (PLAYER_KIND === 'scripted') {
      // A minimal canned opener — proves the loop end-to-end with no key. (Names
      // are the tallow roster; on other seeds it simply explores + stalls.)
      return makeScriptedPlayer(['I get out of bed and step outside', 'I look around', 'who is around here?', 'I talk to the innkeeper']);
    }
    return llmPlayer(PLAYER_MODEL);
  }

  // ── Real-DM narration (the LIVE path: augmentNarration in-process) ────────────
  // OFF unless --real-dm + a key. Returns the validated LLM narration a player reads
  // (server-side RAG place-chunks aren't injected here, but the DM prose is faithful).
  const narrate = (REAL_DM && KEY)
    ? async ({ world, output, action }) => augmentNarration({
        world, baseNarration: output?.narration || '',
        outcome: { input: action, mechanics: output?.mechanics || '', narrationSource: output?.narrationSource },
        apiKey: KEY, enabled: true, model: DM_MODEL, fetchImpl: fetch,
      })
    : null;
  // ── The Tier-2 quality judge call (decoupled model; strict JSON; ~1 call/session) ──
  const judge = (REAL_DM && KEY)
    ? async ({ system, user }) => ask({ system, user, model: JUDGE_MODEL, maxTokens: 900 })
    : null;

  // ── Report ──────────────────────────────────────────────────────────────────
  function writeReport(runs) {
    const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const dir = path.join(ROOT, 'docs', 'playtests', 'harness');
    fs.mkdirSync(dir, { recursive: true });

    // Sidecar action logs → the LLM-off, one-command repro for every finding.
    const logFile = path.join(dir, `actions-${date}.json`);
    fs.writeFileSync(logFile, JSON.stringify(runs.map(r => ({ seed: r.seed, goal: r.goal, actions: r.actionsLog })), null, 2));
    const reproCmd = `node scripts/playtest-harness.mjs --replay ${path.relative(ROOT, logFile)} --seeds <seed>`;

    const allFindings = runs.flatMap(r => r.findings.map(f => ({ ...f, seed: r.seed })));
    const byOracle = {};
    for (const f of allFindings) (byOracle[f.oracleId] ||= []).push(f);

    const L = [];
    L.push(`# Playtest Harness — finder run — ${date}`);
    L.push('');
    L.push(`**Harness:** \`scripts/playtest-harness.mjs\` · oracle bank (state-desync · free-action · object-interaction · soft-lock) · player = ${PLAYER_KIND}${PLAYER_KIND === 'llm' ? ` (${PLAYER_MODEL})` : ''}`);
    L.push(`**DM under test:** ${REAL_DM ? `LIVE — \`augmentNarration\` (${DM_MODEL}) + Tier-2 quality judge (${JUDGE_MODEL})` : 'SKELETON — deterministic \`gen:s/m/f\` filler (NOT the real DM; consistency-only). Pass \`--real-dm\` to test the real game.'}`);
    L.push(`**Run:** ${runs.length} session(s) · goal: \`${GOAL_ID}\` · seeds: ${runs.map(r => r.seed).join(', ')} · ≤${TURNS} turns each`);
    L.push(`**Repro (LLM-off):** \`${reproCmd}\` — re-drives the saved actions on the seed; oracles add zero API cost.`);
    L.push('');
    L.push(`## Sessions`);
    L.push('');
    L.push(`| Seed | Turns | Goal reached | Progress (max) | Findings |`);
    L.push(`|---|---|---|---|---|`);
    for (const r of runs) L.push(`| ${r.seed} | ${r.turns} | ${r.goalCompleted ? '✅' : '❌'} | ${r.progressMax}/2 | ${r.findings.length} |`);
    L.push('');
    L.push(`**Total findings:** ${allFindings.length} across ${runs.length} session(s). Goal-completion: ${runs.filter(r => r.goalCompleted).length}/${runs.length}.`);
    L.push('');
    L.push(`## Findings by oracle`);
    for (const oid of Object.keys(byOracle).sort((a, b) => byOracle[b].length - byOracle[a].length)) {
      L.push('');
      L.push(`### ${oid} (${byOracle[oid].length})`);
      for (const f of byOracle[oid].slice(0, 10)) {
        const run = runs.find(r => r.seed === f.seed);
        L.push(`- **[${f.seed} · turn ${f.turn ?? '—'} · ${f.severity}]** ${f.note}`);
        if (f.action) L.push(`  - action: _"${String(f.action).slice(0, 80)}"_`);
        if (f.claim) L.push(`  - claim: ${f.claim}`);
        if (f.expected) L.push(`  - expected: ${f.expected} · committed: ${f.committed}`);
        if (run && f.turn) L.push(`  - context:\n${transcriptSlice(run.transcript, f.turn).map(s => `      ${s}`).join('\n')}`);
      }
    }
    if (!allFindings.length) { L.push(''); L.push(REAL_DM
      ? '_No findings — oracles + the quality judge saw no incoherence on these seeds (coverage-bounded clean)._'
      : '_No findings — but this judged the deterministic SKELETON (no `--real-dm`): only consistency was checked, not DM quality. NOT a playability verdict._'); }
    L.push('');
    if (PLAYER_KIND === 'llm' || REAL_DM) L.push(`## Cost\n${usage.calls} metered calls (player${REAL_DM ? ` + ${JUDGE_MODEL} judge` : ''}) · ${usage.in.toLocaleString()} in + ${usage.out.toLocaleString()} out tokens (deterministic oracles: $0).${REAL_DM ? ` DM narration (${DM_MODEL}, ~1 call/turn) is billed separately, not metered here.` : ''}`);

    const file = path.join(dir, `harness-${date}.md`);
    fs.writeFileSync(file, L.join('\n'));
    return { file, logFile, total: allFindings.length, byOracle };
  }

  (async () => {
    const packs = loadPacks();
    const goal = getGoal(GOAL_ID);

    // ── Run-to-saturation mode ("boringly predictable") ───────────────────────
    // Explore WIDE (a fresh world per run, varying player) until the discovery
    // curve of unique seamKeys flattens or Chao1 says ~0 remain. Reports the curve,
    // the estimate (+CI), the cost, and which cap stopped it. Needs the LLM player —
    // variation is the whole point; replay or a canned script can't saturate.
    if (has('until-boring')) {
      if (PLAYER_KIND !== 'llm') {
        console.error('--until-boring needs the LLM player (set ANTHROPIC_API_KEY). Variation is required — a replay/scripted run can never saturate.');
        process.exit(2);
      }
      const K = Number(arg('k', '8'));                 // flat-curve window
      const MAX_SEEDS = Number(arg('max-seeds', '60')); // hard cap on runs
      const BUDGET = Number(arg('budget', '2'));        // USD cap (cheap model)
      const RATES = { 'claude-haiku-4-5-20251001': { in: 1, out: 5 } }; // $/M tokens
      const rate = RATES[PLAYER_MODEL] || { in: 1, out: 5 };
      const costUSD = () => (usage.in * rate.in + usage.out * rate.out) / 1e6;
      // Fresh, distinct world per run: cycle the given seeds, then salt for width.
      const seedFor = (i) => (i < SEEDS.length ? SEEDS[i] : `${SEEDS[i % SEEDS.length]}-sat${Math.floor(i / SEEDS.length)}`);
      const satRuns = [];
      console.log(`SATURATION — goal "${goal.id}" · player=llm(${PLAYER_MODEL}) · k=${K} · cap ${MAX_SEEDS} runs / $${BUDGET} · ≤${TURNS} turns each`);
      const nextRun = async (i) => {
        if (costUSD() >= BUDGET) return null;
        const seed = seedFor(i);
        const begun = bootWorld(seed, packs);
        const r = await runSession({ world: begun.world, packs, goal, player: llmPlayer(PLAYER_MODEL), turns: TURNS, openerNarration: begun.output?.narration || begun.world.scene?.narration || '', narrate, judge });
        satRuns.push({ seed, ...r });
        return { seamKeys: r.findings.map(seamKeyOf), seed };
      };
      const sat = await runToSaturation({
        nextRun, k: K, maxRuns: MAX_SEEDS, isOverBudget: () => costUSD() >= BUDGET,
        onRun: ({ run, newThisRun, totalDistinct }) =>
          process.stdout.write(`  run ${String(run).padStart(2)} · ${satRuns[run - 1]?.findings.length ?? 0} finding(s) · +${newThisRun} new seam · ${totalDistinct} unique so far\n`),
      });
      const e = sat.estimate;
      console.log(`\n════════════════════════════════════════════`);
      console.log(`STOP: ${sat.stopReason} after ${sat.runs} run(s)`);
      console.log(`UNIQUE SEAMS: ${sat.uniqueSeams} · CHAO1 estimate: ${e.estimate.toFixed(1)} (≥${e.remaining.toFixed(1)} remain · 95% CI [${e.ciLow}, ${e.ciHigh}])`);
      console.log(`CURVE: ${sat.curve.join(' → ')}`);
      console.log(`COST: ${usage.calls} ${PLAYER_MODEL} calls · $${costUSD().toFixed(4)} (oracles: $0)`);
      console.log(`════════════════════════════════════════════`);
      if (WRITE_REPORT) {
        const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const dir = path.join(ROOT, 'docs', 'playtests', 'harness');
        fs.mkdirSync(dir, { recursive: true });
        const L = [];
        L.push(`# Playtest Harness — saturation run — ${date}`);
        L.push('');
        L.push(`**Mode:** \`--until-boring\` · goal \`${goal.id}\` · player = llm(${PLAYER_MODEL}) · k=${K} · cap ${MAX_SEEDS} runs / $${BUDGET}`);
        L.push(`**Stopped:** \`${sat.stopReason}\` after ${sat.runs} run(s).`);
        L.push('');
        L.push(`## Saturation`);
        L.push(`- **Unique seams found:** ${sat.uniqueSeams}`);
        L.push(`- **Chao1 estimate:** ${e.estimate.toFixed(1)} total — **at least ${e.remaining.toFixed(1)} remain** (95% CI [${e.ciLow}, ${e.ciHigh}]).`);
        L.push(`- **Discovery curve (cumulative unique):** ${sat.curve.join(' → ')}`);
        L.push(`- **Cost:** ${usage.calls} calls · $${costUSD().toFixed(4)} (deterministic oracles: $0).`);
        L.push('');
        L.push(`## Seams by incidence (runs seen / total runs)`);
        for (const [key, n] of Object.entries(sat.counts).sort((a, b) => b[1] - a[1])) L.push(`- \`${key}\` — ${n}/${sat.runs}`);
        if (!sat.uniqueSeams) L.push(REAL_DM
          ? '_No seams across the explored worlds with the REAL DM + quality judge active — a meaningful, coverage-bounded clean result._'
          : '_INCONCLUSIVE — 0 findings, but this run judged the DETERMINISTIC SKELETON (no `--real-dm`): the quality axis was never measured, and Chao1 over zero observations is vacuous. This is NOT a "clean" verdict. Re-run with `--real-dm`._');
        const file = path.join(dir, `saturation-${date}.md`);
        fs.writeFileSync(file, L.join('\n'));
        console.log(`REPORT: ${path.relative(ROOT, file)}`);
      }
      return;
    }

    console.log(`HARNESS — goal "${goal.id}" · ${SEEDS.length} seed(s) · player=${PLAYER_KIND}${PLAYER_KIND === 'llm' ? `(${PLAYER_MODEL})` : ''} · ≤${TURNS} turns`);
    const runs = [];
    for (const seed of SEEDS) {
      const begun = bootWorld(seed, packs);
      const player = pickPlayer(seed, goal);
      process.stdout.write(`\n  ▶ seed "${seed}" `);
      const r = await runSession({ world: begun.world, packs, goal, player, turns: TURNS, openerNarration: begun.output?.narration || begun.world.scene?.narration || '', narrate, judge });
      runs.push({ seed, ...r });
      process.stdout.write(`— ${r.goalCompleted ? 'GOAL ✅' : 'stuck/❌'} · ${r.turns} turns · ${r.findings.length} finding(s)\n`);
      for (const f of r.findings) process.stdout.write(`      • [${f.oracleId}/${f.severity}] t${f.turn ?? '—'}: ${f.note}\n`);
    }
    console.log(`\n════════════════════════════════════════════`);
    const totalFindings = runs.reduce((a, r) => a + r.findings.length, 0);
    console.log(`SESSIONS: ${runs.length} · GOAL REACHED: ${runs.filter(r => r.goalCompleted).length}/${runs.length} · FINDINGS: ${totalFindings}`);
    if (JSON_OUT) {
      // Structured, seam-groupable findings + the action log that reproduces them.
      // This is the contract the autonomous fix loop (scripts/auto-playtest.mjs) reads.
      const payload = runs.map(r => ({
        seed: r.seed, goal: r.goal, goalDescription: r.goalDescription,
        goalCompleted: r.goalCompleted, turns: r.turns, progressMax: r.progressMax,
        findings: r.findings, actionsLog: r.actionsLog,
      }));
      fs.writeFileSync(path.resolve(JSON_OUT), JSON.stringify(payload, null, 2));
      console.log(`JSON: ${path.relative(ROOT, path.resolve(JSON_OUT))}`);
    }
    if (WRITE_REPORT) {
      const rep = writeReport(runs);
      console.log(`REPORT: ${path.relative(ROOT, rep.file)}`);
      console.log(`ACTION LOG (repro): ${path.relative(ROOT, rep.logFile)}`);
    }
    console.log(`════════════════════════════════════════════`);
  })().catch(e => { console.error(e); process.exit(1); });
}
