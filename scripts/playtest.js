#!/usr/bin/env node

/**
 * Autonomous Playtesting Protocol for Immortal Engine
 *
 * Runs headless simulations across multiple seeds, fate bands, and turn counts.
 * Checks every known invariant, detects drift patterns, and reports bugs
 * in a structured format that Claude Code can act on.
 *
 * Usage:
 *   node scripts/playtest.js                    # default: 50 seeds × 100 turns
 *   node scripts/playtest.js --seeds 200        # more seeds
 *   node scripts/playtest.js --turns 1000       # longer runs
 *   node scripts/playtest.js --fate 0.9         # specific fate band only
 *   node scripts/playtest.js --verbose          # print per-seed details
 *   node scripts/playtest.js --json             # output as JSON (for piping)
 */

import { newWorld, ensureWorld, WORLD_VERSION } from '../engine/state.js';
import { simulateTurns, reportSummaryString } from '../engine/simulate.js';
import { worldTick } from '../engine/worldTick.js';
import { resolveMove } from '../engine/resolve.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { worldHash } from '../engine/worldHash.js';
import { ensureInstrumentLayer, introduceThread, escalateThread } from '../engine/instrument.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';

// ── Config ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function flag(name) { return args.includes(`--${name}`); }
function param(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const NUM_SEEDS   = Number(param('seeds', 50));
const NUM_TURNS   = Number(param('turns', 100));
const FATE_ONLY   = param('fate', null);
const VERBOSE     = flag('verbose');
const JSON_OUTPUT = flag('json');

const FATES = FATE_ONLY ? [Number(FATE_ONLY)] : [0.0, 0.2, 0.5, 0.8, 1.0];

const PACKS_BY_ID = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel'],
    locations: ['tower'],
    objectives: ['find the key'],
    complications: ['a clock starts'],
    npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust']
  }
};

// ── Bug Classes ──────────────────────────────────────────────────────────

const BUG_CLASSES = {
  INVARIANT_VIOLATION:  'A clamped value escaped its bounds',
  DETERMINISM_BREAK:    'Same seed produced different results on replay',
  DEATH_SPIRAL:         'Unrecoverable escalation with no player agency',
  SAVE_CORRUPTION:      'Export/import cycle changed world hash',
  TIMELINE_RUNAWAY:     'Timeline grew faster than O(turns)',
  CRASH:                'Uncaught exception during simulation',
  ENDING_LEAK:          'State mutated after ending.locked',
  NPC_OVERFLOW:         'NPC data exceeded caps (topics, gossip, etc.)',
  THREAD_STARVATION:    'No active threads exist and none were introduced',
  CLOCK_MONOTONIC:      'Clock only increases — no relief mechanism fired',
};

// ── Invariant Checks ─────────────────────────────────────────────────────

function checkInvariants(w, context) {
  const bugs = [];
  const ctx = String(context);

  // Version
  if (w.meta?.version !== WORLD_VERSION) {
    bugs.push({ class: 'INVARIANT_VIOLATION', detail: `version ${w.meta?.version} != ${WORLD_VERSION}`, context: ctx });
  }

  // Clocks
  for (const k of ['dread', 'pressure', 'revelation']) {
    const v = w.clocks?.[k];
    if (!Number.isInteger(v) || v < 0 || v > 12) {
      bugs.push({ class: 'INVARIANT_VIOLATION', detail: `clocks.${k} = ${v}`, context: ctx });
    }
  }

  // Env
  const env = w.env || {};
  for (const k of ['noise', 'heat', 'scent', 'light']) {
    const v = env[k];
    if (v !== undefined && (!Number.isInteger(v) || v < 0 || v > 6)) {
      bugs.push({ class: 'INVARIANT_VIOLATION', detail: `env.${k} = ${v}`, context: ctx });
    }
  }

  // Ecology
  const eco = w.ecology || {};
  for (const k of ['corruption', 'scarcity', 'instability']) {
    const v = eco[k];
    if (v !== undefined && (!Number.isInteger(v) || v < 0 || v > 100)) {
      bugs.push({ class: 'INVARIANT_VIOLATION', detail: `ecology.${k} = ${v}`, context: ctx });
    }
  }

  // Party
  for (const e of (Array.isArray(w.party) ? w.party : [])) {
    if (e.wounds !== undefined && (!Number.isInteger(e.wounds) || e.wounds < 0 || e.wounds > 6)) {
      bugs.push({ class: 'INVARIANT_VIOLATION', detail: `entity ${e.id} wounds = ${e.wounds}`, context: ctx });
    }
    if (e.stress !== undefined && (!Number.isInteger(e.stress) || e.stress < 0 || e.stress > 6)) {
      bugs.push({ class: 'INVARIANT_VIOLATION', detail: `entity ${e.id} stress = ${e.stress}`, context: ctx });
    }
    if (Array.isArray(e.conditions) && e.conditions.length > 12) {
      bugs.push({ class: 'INVARIANT_VIOLATION', detail: `entity ${e.id} conditions.length = ${e.conditions.length}`, context: ctx });
    }
  }

  // Advantage tokens
  const adv = w.meta?.advantageTokens || {};
  for (const [k, v] of Object.entries(adv)) {
    if (!Number.isInteger(v) || v < 0 || v > 2) {
      bugs.push({ class: 'INVARIANT_VIOLATION', detail: `advantageTokens[${k}] = ${v}`, context: ctx });
    }
  }

  // Instrument
  const inst = w.instrument || {};
  if (inst.inevitability !== undefined) {
    const v = inst.inevitability;
    if (!Number.isInteger(v) || v < 0 || v > 12) {
      bugs.push({ class: 'INVARIANT_VIOLATION', detail: `inevitability = ${v}`, context: ctx });
    }
    if (v > 10) {
      bugs.push({ class: 'DEATH_SPIRAL', detail: `inevitability ${v} > 10 (death spiral cap breached)`, context: ctx });
    }
  }
  if (Array.isArray(inst.threads)) {
    if (inst.threads.length > 12) {
      bugs.push({ class: 'INVARIANT_VIOLATION', detail: `threads.length = ${inst.threads.length}`, context: ctx });
    }
    for (const t of inst.threads) {
      if (t.tension !== undefined && (!Number.isInteger(t.tension) || t.tension < 0 || t.tension > 5)) {
        bugs.push({ class: 'INVARIANT_VIOLATION', detail: `thread ${t.id} tension = ${t.tension}`, context: ctx });
      }
    }
  }

  // Ledger caps
  const ledger = w.ledger || {};
  if (Array.isArray(ledger.facts) && ledger.facts.length > 8) {
    bugs.push({ class: 'INVARIANT_VIOLATION', detail: `ledger.facts.length = ${ledger.facts.length}`, context: ctx });
  }
  if (Array.isArray(ledger.threats) && ledger.threats.length > 8) {
    bugs.push({ class: 'INVARIANT_VIOLATION', detail: `ledger.threats.length = ${ledger.threats.length}`, context: ctx });
  }
  if (Array.isArray(ledger.questions) && ledger.questions.length > 8) {
    bugs.push({ class: 'INVARIANT_VIOLATION', detail: `ledger.questions.length = ${ledger.questions.length}`, context: ctx });
  }

  // Meta.fate
  if (w.meta?.fate !== undefined) {
    const f = w.meta.fate;
    if (typeof f !== 'number' || !Number.isFinite(f) || f < 0 || f > 1) {
      bugs.push({ class: 'INVARIANT_VIOLATION', detail: `meta.fate = ${f}`, context: ctx });
    }
  }

  // Timeline runaway
  const turns = w.time?.turn ?? 0;
  if (Array.isArray(w.timeline) && w.timeline.length > (turns * 10 + 100)) {
    bugs.push({ class: 'TIMELINE_RUNAWAY', detail: `timeline ${w.timeline.length} > ${turns * 10 + 100}`, context: ctx });
  }

  // NPC caps
  const nodes = Array.isArray(w.map?.nodes) ? w.map.nodes : [];
  for (const node of nodes) {
    if (!Array.isArray(node.settlement?.npcs)) continue;
    for (const npc of node.settlement.npcs) {
      const topics = npc.conversationState?.topicsDiscussed;
      if (Array.isArray(topics) && topics.length > 20) {
        bugs.push({ class: 'NPC_OVERFLOW', detail: `NPC ${npc.name || npc.id} topicsDiscussed.length = ${topics.length}`, context: ctx });
      }
      const gossip = npc.gossipReceived;
      if (Array.isArray(gossip) && gossip.length > 10) {
        bugs.push({ class: 'NPC_OVERFLOW', detail: `NPC ${npc.name || npc.id} gossipReceived.length = ${gossip.length}`, context: ctx });
      }
    }
  }

  return bugs;
}

// ── Probe: Death Spiral Detection ────────────────────────────────────────

function probeDeathSpiral(w, context) {
  const bugs = [];
  const inst = ensureInstrumentLayer(w.instrument);
  const openThreads = inst.threads.filter(t => t.status !== 'resolved');

  // All threads at max tension with no relief in sight
  if (openThreads.length >= 3 && openThreads.every(t => t.tension >= 4)) {
    const clocks = w.clocks || {};
    if (clocks.pressure >= 10 && clocks.dread >= 8) {
      bugs.push({
        class: 'DEATH_SPIRAL',
        detail: `${openThreads.length} threads at tension ≥4, pressure=${clocks.pressure}, dread=${clocks.dread}`,
        context
      });
    }
  }

  // Thread starvation: no threads at all after turn 5
  if ((w.time?.turn ?? 0) > 5 && openThreads.length === 0 && inst.threads.length === 0) {
    bugs.push({ class: 'THREAD_STARVATION', detail: 'No threads exist after turn 5', context });
  }

  return bugs;
}

// ── Probe: Clock Monotonicity ────────────────────────────────────────────

function probeClockMonotonicity(clockHistory) {
  const bugs = [];
  for (const key of ['pressure', 'dread', 'revelation']) {
    const vals = clockHistory.map(h => h[key]);
    if (vals.length < 10) continue;
    // Check last 20 turns: if clock only went up or stayed same, relief isn't working
    const tail = vals.slice(-20);
    let onlyUp = true;
    for (let i = 1; i < tail.length; i++) {
      if (tail[i] < tail[i - 1]) { onlyUp = false; break; }
    }
    if (onlyUp && tail[0] < tail[tail.length - 1] && tail[tail.length - 1] >= 8) {
      bugs.push({
        class: 'CLOCK_MONOTONIC',
        detail: `${key} only increased over last 20 turns: ${tail[0]} → ${tail[tail.length - 1]}`,
        context: 'clock history tail'
      });
    }
  }
  return bugs;
}

// ── Probe: Ending Lock ───────────────────────────────────────────────────

function probeEndingLock(w) {
  const bugs = [];
  if (!w.ending?.locked) return bugs;

  // After ending is locked, playerMove must be frozen
  const hashBefore = worldHash(w);
  const result = playerMove(w, PACKS_BY_ID, 'I attack the sky');
  const hashAfter = worldHash(result.world);

  if (hashBefore !== hashAfter) {
    bugs.push({
      class: 'ENDING_LEAK',
      detail: `worldHash changed after playerMove on locked ending: ${hashBefore} → ${hashAfter}`,
      context: 'ending lock probe'
    });
  }
  return bugs;
}

// ── Probe: Save Roundtrip ────────────────────────────────────────────────

function probeSaveRoundtrip(w, context) {
  const bugs = [];
  try {
    const h0 = worldHash(w);
    const exported = exportWorld(w);
    const imported = importWorld(exported);
    const h1 = worldHash(imported);
    if (h0 !== h1) {
      bugs.push({ class: 'SAVE_CORRUPTION', detail: `hash ${h0} → ${h1}`, context });
    }
  } catch (e) {
    bugs.push({ class: 'SAVE_CORRUPTION', detail: `save roundtrip threw: ${e.message}`, context });
  }
  return bugs;
}

// ── Probe: Determinism ───────────────────────────────────────────────────

function probeDeterminism(seed, fate, turns) {
  const bugs = [];
  const w0 = newWorld({ seed, fate, campaignId: 'playtest', pack: { primaryId: 'fantasy', mixerId: null } });
  const a = simulateTurns(w0, PACKS_BY_ID, turns);
  const b = simulateTurns(w0, PACKS_BY_ID, turns);
  const ha = worldHash(a.world);
  const hb = worldHash(b.world);
  if (ha !== hb) {
    bugs.push({ class: 'DETERMINISM_BREAK', detail: `seed=${seed} fate=${fate} turns=${turns}: hash ${ha} vs ${hb}`, context: 'determinism probe' });
  }
  return bugs;
}

// ── Main Simulation Loop ─────────────────────────────────────────────────

function runPlaytest() {
  const allBugs = [];
  let totalRuns = 0;
  let crashes = 0;
  const startMs = Date.now();

  for (const fate of FATES) {
    for (let i = 0; i < NUM_SEEDS; i++) {
      const seed = `playtest-${fate}-${i}`;
      totalRuns++;

      try {
        // 1. Simulate
        const w0 = newWorld({ seed, fate, campaignId: 'playtest', pack: { primaryId: 'fantasy', mixerId: null } });
        const { world: w1 } = simulateTurns(w0, PACKS_BY_ID, NUM_TURNS);

        // 2. Invariant check
        allBugs.push(...checkInvariants(w1, `seed=${seed} fate=${fate} turns=${NUM_TURNS}`));

        // 3. Death spiral probe
        allBugs.push(...probeDeathSpiral(w1, `seed=${seed} fate=${fate}`));

        // 4. Ending lock probe
        allBugs.push(...probeEndingLock(w1));

        // 5. Save roundtrip (every 10th seed to save time)
        if (i % 10 === 0) {
          allBugs.push(...probeSaveRoundtrip(w1, `seed=${seed} fate=${fate}`));
        }

        // 6. Determinism check (every 20th seed)
        if (i % 20 === 0) {
          allBugs.push(...probeDeterminism(seed, fate, Math.min(NUM_TURNS, 50)));
        }

        if (VERBOSE) {
          const summary = reportSummaryString(simulateTurns(w0, PACKS_BY_ID, NUM_TURNS).report);
          process.stderr.write(`  [${seed}] ${summary}\n`);
        }

      } catch (e) {
        crashes++;
        allBugs.push({ class: 'CRASH', detail: `${e.message}\n${e.stack?.split('\n').slice(0, 3).join('\n')}`, context: `seed=${seed} fate=${fate}` });
      }
    }
  }

  const elapsedMs = Date.now() - startMs;

  // Deduplicate by class + detail
  const seen = new Set();
  const unique = [];
  for (const b of allBugs) {
    const key = `${b.class}|${b.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(b);
  }

  return { bugs: unique, totalRuns, crashes, elapsedMs, config: { seeds: NUM_SEEDS, turns: NUM_TURNS, fates: FATES } };
}

// ── Output ───────────────────────────────────────────────────────────────

const result = runPlaytest();

if (JSON_OUTPUT) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`PLAYTEST REPORT`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`Seeds: ${result.config.seeds} × Fates: [${result.config.fates.join(', ')}] × Turns: ${result.config.turns}`);
  console.log(`Total runs: ${result.totalRuns} | Crashes: ${result.crashes} | Time: ${(result.elapsedMs / 1000).toFixed(1)}s`);
  console.log(`${'─'.repeat(60)}`);

  if (result.bugs.length === 0) {
    console.log(`\n  ✓ No bugs found.\n`);
  } else {
    console.log(`\n  ${result.bugs.length} unique bug(s) found:\n`);

    // Group by class
    const byClass = {};
    for (const b of result.bugs) {
      (byClass[b.class] = byClass[b.class] || []).push(b);
    }

    for (const [cls, bugs] of Object.entries(byClass)) {
      console.log(`  [${cls}] — ${BUG_CLASSES[cls] || 'Unknown'}`);
      for (const b of bugs.slice(0, 5)) {
        console.log(`    • ${b.detail}`);
        console.log(`      context: ${b.context}`);
      }
      if (bugs.length > 5) {
        console.log(`    ... and ${bugs.length - 5} more`);
      }
      console.log('');
    }
  }

  console.log(`${'═'.repeat(60)}\n`);

  // Exit code: 0 if clean, 1 if bugs found
  process.exit(result.bugs.length > 0 ? 1 : 0);
}
