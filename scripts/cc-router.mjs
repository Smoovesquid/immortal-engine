// Claude Code model-routing harness.
// Chooses which Claude model tier should handle a task, then runs it.

import { spawnSync } from 'node:child_process';

const MODEL_ALIASES = {
  scout:     process.env.CC_ROUTER_SCOUT_MODEL     || 'haiku',
  implement: process.env.CC_ROUTER_IMPLEMENT_MODEL || 'sonnet',
  audit:     process.env.CC_ROUTER_AUDIT_MODEL     || 'opus',
  lead:      process.env.CC_ROUTER_LEAD_MODEL      || 'claude-fable-5',
};

const MAX_TURNS = { scout: 2, implement: 6, audit: 8, lead: 12 };
const VALID_ROUTES = new Set(Object.keys(MODEL_ALIASES));

const SCOUT_KEYWORDS = [
  'summarize', 'extract', 'list', 'classify', 'first failing',
  'stack trace', ' log ', 'changed files', 'compress context',
];

const IMPLEMENT_KEYWORDS = [
  'implement', ' fix ', 'fix:', 'patch', 'write test', 'add test',
  'update', 'create component', 'small feature', 'minimal diff',
];

const AUDIT_KEYWORDS = [
  'audit', 'red team', 'root cause', 'invariant', 'determinism',
  'deterministic', 'replay', 'hidden coupling', 'architecture review',
  'failed twice', 'state mutation',
];

const LEAD_KEYWORDS = [
  'whole repo', 'full audit', 'system-wide', 'system wide',
  'multi-stage', 'multi stage', 'migration', 'project lead',
  'architecture overhaul', 'determinism drift', 'replay contract',
  'state/event model', 'state event model', 'plan the next packets',
];

export function inferRoute(task) {
  const t = ` ${task.toLowerCase()} `;

  if (LEAD_KEYWORDS.some(k => t.includes(k)))      return 'lead';
  if (AUDIT_KEYWORDS.some(k => t.includes(k)))     return 'audit';
  if (SCOUT_KEYWORDS.some(k => t.includes(k)))     return 'scout';
  if (IMPLEMENT_KEYWORDS.some(k => t.includes(k))) return 'implement';

  return 'implement';
}

// buildCommandPreview — shown in dry-run output; includes --output-format json
// for programmatic use. Live runs omit it so output streams as readable text.
export function buildCommandPreview(route, task) {
  return [
    'claude',
    '-p',
    '--model',           MODEL_ALIASES[route],
    '--permission-mode', 'auto',
    '--max-turns',       String(MAX_TURNS[route]),
    '--output-format',   'json',
    task,
  ];
}

function buildLiveArgs(route, task) {
  return [
    '-p',
    '--model',           MODEL_ALIASES[route],
    '--permission-mode', 'auto',
    '--max-turns',       String(MAX_TURNS[route]),
    task,
  ];
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { dryRun: false, route: null, task: null, help: false, errors: [] };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') { result.help = true; continue; }
    if (a === '--dry-run')            { result.dryRun = true; continue; }
    if (a === '--route') {
      const val = args[++i];
      if (!val) { result.errors.push('--route requires a value'); continue; }
      if (!VALID_ROUTES.has(val)) {
        result.errors.push(`Invalid route "${val}". Valid routes: ${[...VALID_ROUTES].join(', ')}`);
      } else {
        result.route = val;
      }
      continue;
    }
    if (!a.startsWith('--')) { result.task = a; continue; }
    result.errors.push(`Unknown flag: ${a}`);
  }

  return result;
}

const HELP = `
cc-router — route a task to the right Claude model tier

Usage:
  node scripts/cc-router.mjs "<task>"
  node scripts/cc-router.mjs --route <route> "<task>"
  node scripts/cc-router.mjs --dry-run "<task>"

Routes: scout | implement | audit | lead
Flags:  --dry-run  --route  --help

Route inference:
  scout     — summarize, extract, list, classify, log, stack trace …
  implement — implement, fix, patch, write test, update … (default)
  audit     — audit, root cause, invariant, determinism, replay …
  lead      — whole repo, full audit, multi-stage, migration …

Models (overridable via env vars):
  scout     → ${MODEL_ALIASES.scout}   (CC_ROUTER_SCOUT_MODEL)
  implement → ${MODEL_ALIASES.implement} (CC_ROUTER_IMPLEMENT_MODEL)
  audit     → ${MODEL_ALIASES.audit}   (CC_ROUTER_AUDIT_MODEL)
  lead      → ${MODEL_ALIASES.lead} (CC_ROUTER_LEAD_MODEL)
`.trim();

export async function main(argv) {
  const { dryRun, route: explicitRoute, task, help, errors } = parseArgs(argv);

  if (help) { console.log(HELP); process.exit(0); }

  if (errors.length) {
    for (const e of errors) console.error(`Error: ${e}`);
    process.exit(1);
  }

  if (!task) {
    console.error('Error: no task string provided.\n');
    console.log(HELP);
    process.exit(1);
  }

  const route = explicitRoute || inferRoute(task);
  const model = MODEL_ALIASES[route];
  const commandPreview = buildCommandPreview(route, task);

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, route, model, task, commandPreview }, null, 2));
    return;
  }

  // Live run — print a one-liner header then hand off to claude with pass-through I/O.
  console.error(`[cc-router] route=${route} model=${model} max-turns=${MAX_TURNS[route]}`);
  const result = spawnSync('claude', buildLiveArgs(route, task), { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

// Run when invoked directly
if (process.argv[1].endsWith('cc-router.mjs')) {
  main(process.argv);
}
