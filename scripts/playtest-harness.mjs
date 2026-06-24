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
export async function runSession({ world, packs, goal, player, turns = 25, softLockWindow = SOFT_LOCK_WINDOW, openerNarration = '' }) {
  const transcript = [];
  if (openerNarration) transcript.push({ who: 'dm', text: cleanNarration(openerNarration) });

  const findings = [];
  const actionsLog = [];
  const progressHistory = []; // post-turn progressMetric, one entry per turn

  let bestProgress = goal.progressMetric(world);
  let sinceImprovement = 0;
  let goalCompleted = goal.satisfied(world);

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
      findings.push(...runOracleBank({ before, after, action, output, turn }));
      world = after;
      transcript.push({ who: 'dm', text: cleanNarration(output?.narration), mech: output?.mechanics || '' });
      if (goal.satisfied(world)) goalCompleted = true;
    }

    const prog = goal.progressMetric(world);
    progressHistory.push(prog);
    if (prog > bestProgress) { bestProgress = prog; sinceImprovement = 0; }
    else sinceImprovement += 1;

    const sl = checkSoftLock(progressHistory, { window: softLockWindow, goal, turn });
    if (sl) findings.push({ ...sl, action });
  }

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
    L.push(`**Harness:** \`scripts/playtest-harness.mjs\` · deterministic oracle bank (state-desync · free-action · soft-lock) · player = ${PLAYER_KIND}${PLAYER_KIND === 'llm' ? ` (${PLAYER_MODEL})` : ''}`);
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
    if (!allFindings.length) { L.push(''); L.push('_No findings — the oracle bank saw no incoherence on these seeds._'); }
    L.push('');
    if (PLAYER_KIND === 'llm') L.push(`## Cost\n${usage.calls} ${PLAYER_MODEL} calls · ${usage.in.toLocaleString()} in + ${usage.out.toLocaleString()} out tokens (oracles: $0 — deterministic).`);

    const file = path.join(dir, `harness-${date}.md`);
    fs.writeFileSync(file, L.join('\n'));
    return { file, logFile, total: allFindings.length, byOracle };
  }

  (async () => {
    const packs = loadPacks();
    const goal = getGoal(GOAL_ID);
    console.log(`HARNESS — goal "${goal.id}" · ${SEEDS.length} seed(s) · player=${PLAYER_KIND}${PLAYER_KIND === 'llm' ? `(${PLAYER_MODEL})` : ''} · ≤${TURNS} turns`);
    const runs = [];
    for (const seed of SEEDS) {
      const begun = bootWorld(seed, packs);
      const player = pickPlayer(seed, goal);
      process.stdout.write(`\n  ▶ seed "${seed}" `);
      const r = await runSession({ world: begun.world, packs, goal, player, turns: TURNS, openerNarration: begun.output?.narration || begun.world.scene?.narration || '' });
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
