// The standing prose gate (Stage F) — breadth tier of PLAYTEST_PROTOCOL.
//
// Mirrors public/v1.js doSubmitMove() routing exactly:
//   bare cardinal -> local walk (UI-only; recorded, not engine-run)
//   meta-question -> handleMetaQuestion (no turn, no mutation)
//   otherwise     -> playerMove (engine prose + would-be AI augmentation)
// Feeds a large corpus of "things people say to a DM" through the REAL routing and
// grades the prose with scripts/lib/proseGraders.mjs (the same graders tests/F1 checks).
//
// ENFORCED: exits NONZERO on ANY issue (crash, invisible output, value leak, abstract-
// floor leak on a resolved action, a DM-TEST dead-end, or a formatting glitch) — not
// just on crashes. Green means green. The live browser Skeptic session is the separate
// depth tier (PLAYTEST_PROTOCOL); this gate is fast breadth + regression protection.
//
// Self-test: `PROSE_GATE_SELFTEST=<class[,class...]>` (or `--selftest=<...>`) injects
// deliberately-broken synthetic responses so tests/F1 can prove the gate catches each
// regression class. `all` injects one of every class.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { gradeAll } from './lib/proseGraders.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadPacks() {
  const packsDir = path.join(ROOT, 'packs');
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf-8')));
  const byId = {};
  for (const p of manifest.packs) {
    byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(ROOT, p.path), 'utf-8')));
  }
  return byId;
}

const CARDINAL = /^(?:go|walk|move|head|step)?\s*(north|south|east|west|n|e|s|w)\.?$/i;

// Faithful mirror of doSubmitMove routing.
function route(world, text, packs) {
  const t = String(text || '').trim();
  if (!t) return { route: 'empty', narration: '(no input)', world };

  if (!world.combat?.active && CARDINAL.test(t)) {
    return { route: 'cardinal', narration: '(local walk — UI only)', world };
  }
  if (!world.combat?.active && isMetaQuestion(t)) {
    const ans = handleMetaQuestion(t, world);
    if (ans) return { route: 'meta', narration: ans, world }; // no mutation, no turn
  }
  const { world: w2, output } = playerMove(world, packs, t);
  if (w2.conversation && typeof w2.conversation === 'object') {
    w2.conversation.lastAction = t;
    w2.conversation.lastNarration = output?.narration ?? '';
    w2.conversation.lastOutcome = String(output?.mechanics ?? '');
  }
  return { route: 'action', narration: output?.narration ?? '', mechanics: output?.mechanics ?? '', world: w2 };
}

// ── Corpora ───────────────────────────────────────────────────────────────────
const META = [
  'where am I?', 'what do I see?', 'look around', 'survey the area',
  'am I hurt?', 'how am I doing?', "what's my health?", 'how much HP do I have?',
  'what happened?', 'what did I just do?', 'did I succeed?', 'where am I',
];

const ACTIONS = [
  'examine the door', 'look at the barrel', 'search the room', 'inspect the floor',
  'open the chest', 'take the torch', 'pick up the key', 'grab the lantern',
  'draw my sword', 'ready my weapon', 'attack the nearest enemy', 'strike',
  'talk to the innkeeper', 'ask the elder about the smoke', 'greet everyone', 'say hello',
  'sit down and rest', 'listen carefully', 'smell the air', 'wait',
  'head to the well', 'travel to the old tower', 'go into the forest', 'enter the tavern',
  'climb the wall', 'hide in the shadows', 'sneak past the guard',
  'cast fire bolt', 'cast ward', 'light a fire', 'pray',
];

const NATURAL = [
  'I want to carefully examine the old wooden door',
  'can I look around the room?',
  'let me talk to whoever is here',
  "I'll head outside to see what's happening",
  'I try to open the chest quietly',
  'I would like to rest for a while',
];

const SOCIAL = [
  'intimidate the elder', 'I threaten the guard, or else', 'charm the trader',
  'Hey there, you look lovely today — let me through?', 'I tell him I am the new sheriff',
  'persuade the merchant to lower the price', 'please let me pass, hear me out',
  'I use my superior strength to intimidate the bandit', 'flatter the innkeeper',
];

const MANIPULATION = [
  'open the crate', 'open the table', 'close the door', 'shut the chest',
  'draw my sword', 'ready my weapon', 'sheathe my blade', 'I draw my sword',
  'sit down', 'stand up', 'kneel', 'rest', 'pray', 'I sit down',
  'eat', 'drink', 'light a torch', 'put on my cloak', 'drop my pack',
  'open the obsidian vault', 'draw my warhammer', 'close the chair',
  'force the door open', 'pick the lock', 'pry open the crate', 'climb the wall',
];

const TRAVEL = [
  'go to the Old Shrine', 'head south', 'travel to Trader\'s Camp', 'go west',
  'I make my way to the ruined tower', 'journey to the distant keep',
];

const DEGENERATE = [
  'the thing', 'do it', 'hmm', 'uh', 'yes', 'no', 'ok', 'go',
  'asdfghjkl', 'qwerty', '...', '!!!', '12345', 'a',
  '', '   ',
];

const WEIRD = [
  'I fly to the moon', 'kill everyone', "what's the meaning of life?",
  'I cast wish and become a god', 'eat the sun', 'I am the DM now',
  'delete the world', 'I summon a dragon and ride it to victory',
];

// ── Self-test injection ─────────────────────────────────────────────────────
// Deliberately-broken synthetic responses, one per regression class, so the gate's
// fail-loud behavior is itself testable. Returns [{label, input, res}].
const SELFTEST_CASES = {
  crash: { input: '[selftest] thrown handler', res: { route: 'action', narration: '', error: 'Error: synthetic handler crash' } },
  invisible: { input: '[selftest] empty output', res: { route: 'action', narration: 'Wizard:   ' } },
  value_leak: { input: '[selftest] value leak', res: { route: 'action', narration: 'Wizard: You enter n3_2068938136 and see [object Object].' } },
  floor: { input: '[selftest] floor leak', res: { route: 'action', narration: 'Wizard: A low hum threads through the walls as the meaning slips.' } },
  dead_end: { input: '[selftest] dead end', res: { route: 'action', narration: 'Wizard: Which way do you want to go? You can only travel one tile at a time.' } },
  formatting: { input: '[selftest] formatting', res: { route: 'action', narration: 'Wizard: you stare at the the door' } },
};
function selftestInjections(spec) {
  if (!spec) return [];
  const want = spec.toLowerCase() === 'all' ? Object.keys(SELFTEST_CASES) : spec.toLowerCase().split(',').map(s => s.trim());
  return want.filter(k => SELFTEST_CASES[k]).map(k => ({ label: `selftest:${k}`, input: SELFTEST_CASES[k].input, res: SELFTEST_CASES[k].res }));
}

// ── Run ─────────────────────────────────────────────────────────────────────
const argSelftest = (process.argv.find(a => a.startsWith('--selftest')) || '').split('=')[1];
const SELFTEST = process.env.PROSE_GATE_SELFTEST || argSelftest || '';

const packs = loadPacks();
const allIssues = [];
const samples = [];
let total = 0, crashes = 0, issueCount = 0;

function record(label, input, res) {
  total++;
  if (res.error) crashes++;
  const issues = gradeAll(input, res);
  if (issues.length) {
    issueCount++;
    allIssues.push({ label, input, route: res.route, narration: res.narration, mechanics: res.mechanics, issues });
  }
  samples.push({ label, input, route: res.route, narration: res.narration });
}

function feed(label, world, inputs, { mutate }) {
  let w = world;
  for (const input of inputs) {
    let res;
    try {
      res = route(w, input, packs);
    } catch (e) {
      res = { route: 'action', narration: '', error: String(e?.stack || e?.message || e), world: w };
    }
    if (mutate && res.world) w = res.world;
    record(label, input, res);
  }
  return w;
}

// (A) Evolving sessions on one world per seed — simulates real play.
for (const seed of ['alpha', 'bravo', 'charlie']) {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: `c-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const { world } = beginAdventure(w0, packs);
  const session = [...META.slice(0, 6), ...ACTIONS.slice(0, 16), ...SOCIAL.slice(0, 5), ...NATURAL.slice(0, 3), ...META.slice(0, 4)];
  feed(`session:${seed}`, world, session, { mutate: true });
}

// (B) Isolated edge cases against a fresh begun world (robustness).
{
  const w0 = newWorld({ seed: 'edge', fate: 0.5, campaignId: 'edge', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const { world } = beginAdventure(w0, packs);
  feed('isolated:meta', world, META, { mutate: false });
  feed('isolated:actions', world, ACTIONS, { mutate: false });
  feed('isolated:social', world, SOCIAL, { mutate: false });
  feed('isolated:manipulation', world, MANIPULATION, { mutate: false });
  feed('isolated:travel', world, TRAVEL, { mutate: false });
  feed('isolated:natural', world, NATURAL, { mutate: false });
  feed('isolated:degenerate', world, DEGENERATE, { mutate: false });
  feed('isolated:weird', world, WEIRD, { mutate: false });
}

// (C) Self-test injections (proves the gate fails loudly on each regression class).
for (const inj of selftestInjections(SELFTEST)) record(inj.label, inj.input, inj.res);

// ── Report ──────────────────────────────────────────────────────────────────
console.log('\n══════════════════════ PROSE GATE ══════════════════════');
console.log(`Total inputs run : ${total}`);
console.log(`Crashes          : ${crashes}`);
console.log(`Inputs w/ issues : ${issueCount}`);
if (SELFTEST) console.log(`Self-test mode   : ${SELFTEST}`);

console.log('\n── ROUTING SAMPLE (first of each route) ──');
const seen = new Set();
for (const s of samples) {
  if (seen.has(s.route)) continue;
  seen.add(s.route);
  console.log(`[${s.route}] "${s.input}" -> ${String(s.narration).slice(0, 160)}`);
}

if (allIssues.length) {
  console.log('\n── ISSUES (gate FAILS) ──');
  for (const it of allIssues) {
    console.log(`\n• [${it.label}] input: "${it.input}"  (route=${it.route})`);
    console.log(`  issues: ${it.issues.join('; ')}`);
    console.log(`  prose : ${String(it.narration).slice(0, 220)}`);
  }
}

// FAIL LOUDLY: nonzero exit on ANY issue, not just crashes. Green means green.
const failed = issueCount > 0;
console.log(`\n${failed ? '❌ PROSE GATE: FAIL' : '✅ PROSE GATE: PASS'} (${issueCount} issue${issueCount === 1 ? '' : 's'} across ${total} inputs)\n`);
process.exit(failed ? 1 : 0);
