#!/usr/bin/env node
// scripts/intent-eval.mjs — INT-2 translator benchmark.
//
// Scores each available backend (Anthropic fast tier, local Ollama if
// reachable, parser-only baseline) against the frozen corpus in
// tests/corpus/intentEvalCorpus.mjs. Metrics per backend:
//   - packet-match %   (verb correct + target/no-target expectation honored)
//   - invented-id count (>0 on ANY backend is a hard-fail headline — grounding
//     must catch these; this script also verifies grounding actually did)
//   - clarify rate      (how often the backend flagged ambiguity where expected)
//   - latency (ms, mean over scored rows)
//
// This DOES spend real Anthropic API budget when an .env key is present.
// Deliberately NOT part of `node --test` — run explicitly:
//   node scripts/intent-eval.mjs
//
// No retry loops on failure (per BUILD_BUDGET.md discipline) — a failed call
// scores as a miss for that row, not a re-attempt.

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasLlmKey } from '../server/llmProvider.js';
import { checkHealth as checkOllamaHealth, isAvailable as ollamaAvailable } from '../server/localLlmProvider.js';
import { proposeIntentViaLlm } from '../engine/intent/llmIntent.js';
import { groundPacket } from '../engine/intent/groundPacket.js';
import { parseIntent } from '../engine/intent/parseIntent.js';
import { CORPUS, BUNDLE } from '../tests/corpus/intentEvalCorpus.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function nameMatches(candidate, wantName) {
  if (!candidate) return false;
  return String(candidate).toLowerCase().includes(String(wantName).toLowerCase());
}

// Score one grounded/parsed packet against a corpus row's expectation.
function scoreRow(row, packet) {
  const exp = row.expect;
  const verbOk = packet && packet.verb === exp.verb;

  let targetOk = true;
  let inventedId = false;
  if (exp.targetName) {
    targetOk = nameMatches(packet?.target, exp.targetName) || (packet?.targets || []).some(t => nameMatches(t, exp.targetName)) || (packet?.objects || []).some(o => nameMatches(o, exp.targetName));
  } else if (exp.noTarget) {
    // A correct "noTarget" answer names nothing that ISN'T grounded — since we
    // score the GROUNDED packet, any target present here already survived
    // grounding, so it's real, not invented. We only flag invented ids when
    // the RAW (pre-grounding) proposal named something that grounding then
    // rejected — that's tracked separately in runBackend, not here.
    targetOk = true;
  }

  const clarifyOk = exp.wantsClarify ? Boolean(packet?.ambiguity || (packet?.confidence ?? 1) < 0.5) : true;

  const match = Boolean(verbOk && targetOk && clarifyOk);
  return { match, verbOk, targetOk, clarifyOk, inventedId };
}

async function runParserOnly() {
  const rows = [];
  for (const row of CORPUS) {
    const t0 = Date.now();
    const packet = parseIntent(row.text, BUNDLE);
    const latency = Date.now() - t0;
    const scored = scoreRow(row, packet);
    rows.push({ id: row.id, ...scored, latency, invented: 0 });
  }
  return rows;
}

async function runLlmBackend(label) {
  const rows = [];
  for (const row of CORPUS) {
    const t0 = Date.now();
    let proposed = null;
    try {
      proposed = await proposeIntentViaLlm(null, row.text, BUNDLE);
    } catch {
      proposed = null;
    }
    const latency = Date.now() - t0;

    if (!proposed) {
      rows.push({ id: row.id, match: false, verbOk: false, targetOk: false, clarifyOk: false, latency, invented: 0, miss: true });
      continue;
    }

    // Count invented ids BEFORE grounding drops them — this is the headline
    // metric: did the raw proposal name something that doesn't exist in the
    // scene? Grounding then hard-rejects it so it never reaches playerMove.
    const rawTarget = proposed.target ? String(proposed.target) : null;
    const entityNames = new Set(BUNDLE.entities.map(e => String(e.name || e.id).toLowerCase()));
    const objectNames = new Set([...BUNDLE.abilities, ...BUNDLE.spells, ...BUNDLE.items].map(x => String(x).toLowerCase()));
    let inventedCount = 0;
    if (rawTarget && !entityNames.has(rawTarget.toLowerCase())) inventedCount++;
    for (const t of (Array.isArray(proposed.targets) ? proposed.targets : [])) {
      if (t && !entityNames.has(String(t).toLowerCase())) inventedCount++;
    }
    for (const o of (Array.isArray(proposed.objects) ? proposed.objects : [])) {
      if (o && !objectNames.has(String(o).toLowerCase()) && !entityNames.has(String(o).toLowerCase())) inventedCount++;
    }

    const grounded = groundPacket(proposed, BUNDLE);
    const scored = grounded ? scoreRow(row, grounded) : { match: false, verbOk: false, targetOk: false, clarifyOk: false };
    rows.push({ id: row.id, ...scored, latency, invented: inventedCount, groundedSurvived: Boolean(grounded) });
  }
  return rows;
}

function summarize(label, rows) {
  const n = rows.length;
  const matches = rows.filter(r => r.match).length;
  const invented = rows.reduce((s, r) => s + (r.invented || 0), 0);
  const wantClarify = CORPUS.filter(r => r.expect.wantsClarify).map(r => r.id);
  const clarifyHits = rows.filter(r => wantClarify.includes(r.id) && r.clarifyOk).length;
  const avgLatency = n ? Math.round(rows.reduce((s, r) => s + (r.latency || 0), 0) / n) : 0;
  return {
    label,
    n,
    packetMatchPct: n ? Math.round((matches / n) * 1000) / 10 : 0,
    inventedIdCount: invented,
    clarifyPrecision: wantClarify.length ? Math.round((clarifyHits / wantClarify.length) * 1000) / 10 : null,
    clarifyRateOf: wantClarify.length,
    avgLatencyMs: avgLatency
  };
}

async function main() {
  const results = [];
  let requestCount = 0;

  // Backend 1 — parser-only baseline (no network, always runs).
  const parserRows = await runParserOnly();
  results.push(summarize('parser-only (parseIntent baseline)', parserRows));

  // Each backend pass below FORCES its provider explicitly via INTENT_LLM
  // (and its model via INTENT_LLM_MODEL), never relying on which key happens
  // to be present — the 07-03 lesson: an ambient default silently scores one
  // provider's answers under another's label. The corpus/scoring logic is
  // provider-agnostic.
  const prevIntentLlm = process.env.INTENT_LLM;
  const prevIntentModel = process.env.INTENT_LLM_MODEL;
  const restoreEnv = () => {
    if (prevIntentLlm === undefined) delete process.env.INTENT_LLM; else process.env.INTENT_LLM = prevIntentLlm;
    if (prevIntentModel === undefined) delete process.env.INTENT_LLM_MODEL; else process.env.INTENT_LLM_MODEL = prevIntentModel;
  };

  // Backends 2+3 — Anthropic ears candidates (only if a key is present).
  // Haiku is the live default (Tim's Haiku-primary ruling, 2026-07-03);
  // Sonnet runs as the quality-ceiling comparison.
  const anthropicPresent = hasLlmKey();
  if (anthropicPresent) {
    for (const model of ['claude-haiku-4-5', 'claude-sonnet-4-6']) {
      process.env.INTENT_LLM = 'anthropic';
      process.env.INTENT_LLM_MODEL = model;
      try {
        const rows = await runLlmBackend(model);
        requestCount += CORPUS.length; // one request per row (no retries)
        results.push(summarize(`Anthropic (${model})`, rows));
      } finally {
        restoreEnv();
      }
    }
  } else {
    results.push({ label: 'Anthropic', skipped: true, reason: 'no ANTHROPIC_API_KEY/OPENAI_API_KEY in env' });
  }

  // Backend 4 — local Ollama (only if reachable).
  await checkOllamaHealth();
  if (ollamaAvailable()) {
    process.env.INTENT_LLM = 'ollama';
    try {
      const ollamaRows = await runLlmBackend('ollama');
      results.push(summarize('Ollama (local)', ollamaRows));
    } finally {
      restoreEnv();
    }
  } else {
    results.push({ label: 'Ollama (local)', skipped: true, reason: 'no local Ollama server reachable at LOCAL_LLM_ENDPOINT' });
  }

  return { results, requestCount };
}

function estimateCost(requestCount) {
  // Rough estimate for a short JSON-only exchange (~250 input + ~100 output
  // tokens per call) against Claude Sonnet fast-tier pricing. This is a
  // budget sanity check, not an invoice.
  const approxInputTokens = requestCount * 250;
  const approxOutputTokens = requestCount * 100;
  const inputCostPerM = 3.0;   // $/1M input tokens, Sonnet-class
  const outputCostPerM = 15.0; // $/1M output tokens, Sonnet-class
  const dollars = (approxInputTokens / 1e6) * inputCostPerM + (approxOutputTokens / 1e6) * outputCostPerM;
  return Math.round(dollars * 10000) / 10000;
}

const { results, requestCount } = await main();

const scoredBackends = results.filter(r => !r.skipped);
const headlineInvented = scoredBackends.reduce((s, r) => s + (r.inventedIdCount || 0), 0);

const lines = [];
lines.push(`# INT-2 intent-translator benchmark — ${new Date().toISOString().slice(0, 10)}`);
lines.push('');
lines.push(`Corpus size: ${CORPUS.length} utterances (tests/corpus/intentEvalCorpus.mjs). Backends scored: ${scoredBackends.length}.`);
lines.push('');
lines.push(`## HEADLINE — invented-id count: ${headlineInvented} (${headlineInvented === 0 ? 'PASS' : 'HARD FAIL'})`);
lines.push('');
lines.push('An invented id is any target/object the LLM proposed that does not exist in the');
lines.push('scene candidate bundle. This benchmark counts them on the RAW proposal, before');
lines.push('grounding runs — grounding then hard-rejects every one, so 0 should ALSO reach');
lines.push('`playerMove` labeled `source:\'llm\'` regardless of this count. A non-zero count here');
lines.push('is a signal about the model\'s proposal quality, not a live safety gap (grounding');
lines.push('is the safety gate, and it is unconditionally applied).');
lines.push('');
lines.push('## Per-backend results');
lines.push('');
lines.push('| Backend | Scored | Packet-match % | Invented-ID count | Clarify precision | Avg latency (ms) |');
lines.push('|---|---|---|---|---|---|');
for (const r of results) {
  if (r.skipped) {
    lines.push(`| ${r.label} | SKIPPED | — | — | — | — (${r.reason}) |`);
  } else {
    lines.push(`| ${r.label} | ${r.n} | ${r.packetMatchPct}% | ${r.inventedIdCount} | ${r.clarifyPrecision === null ? 'n/a' : r.clarifyPrecision + '%'} | ${r.avgLatencyMs} |`);
  }
}
lines.push('');
lines.push(`## Budget spent this run`);
lines.push('');
lines.push(`Anthropic requests made: ${requestCount} (one per corpus row, no retries).`);
lines.push(`Rough cost estimate: $${estimateCost(requestCount)} (Sonnet-class per-token pricing, ~250 in / ~100 out tokens per call — a sanity check, not an invoice).`);
lines.push('');
lines.push('## Notes');
lines.push('');
lines.push('- Corpus seeded from real gate-history failing turns cited in docs/PACKETS.md INT-2');
lines.push('  and docs/briefs/INT-2-llm-translator-sonnet.md (referent ambiguity, compound asks,');
lines.push('  impossible actions, grounded/ungrounded targets).');
lines.push('- The parser-only baseline never calls a network — it is `engine/intent/parseIntent.js`');
lines.push('  run directly against the same bundle, for comparison.');
lines.push('- This script is NOT part of `node --test` by design (network calls do not belong in the');
lines.push('  fast loop) — run it explicitly: `node scripts/intent-eval.mjs`.');
lines.push('');

const report = lines.join('\n');
console.log(report);

const outDir = path.join(__dirname, '..', 'docs', 'playtests');
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath = path.join(outDir, `intent-eval-${stamp}.md`);
fs.writeFileSync(outPath, report, 'utf8');
console.log(`\nReport written to ${path.relative(path.join(__dirname, '..'), outPath)}`);
