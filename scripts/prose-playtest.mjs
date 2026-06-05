// Prose-system deep playtest harness.
// Mirrors public/v1.js doSubmitMove() routing exactly:
//   bare cardinal -> local walk (UI-only; recorded, not engine-run)
//   meta-question -> handleMetaQuestion (no turn, no mutation)
//   otherwise     -> playerMove (engine prose + would-be AI augmentation)
// Feeds a large corpus of "things people say to a DM" and grades the prose.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

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
    // UI sends this to placeWalk (local avatar move). Not engine prose.
    return { route: 'cardinal', narration: '(local walk — UI only)', world };
  }
  if (!world.combat?.active && isMetaQuestion(t)) {
    const ans = handleMetaQuestion(t, world);
    if (ans) return { route: 'meta', narration: ans, world }; // no mutation, no turn
  }
  const { world: w2, output } = playerMove(world, packs, t);
  // Mirror v1.js: record the turn so recap meta-questions can recall it.
  if (w2.conversation && typeof w2.conversation === 'object') {
    w2.conversation.lastAction = t;
    w2.conversation.lastNarration = output?.narration ?? '';
    w2.conversation.lastOutcome = String(output?.mechanics ?? '');
  }
  return { route: 'action', narration: output?.narration ?? '', mechanics: output?.mechanics ?? '', world: w2 };
}

// Strip the UI speaker prefix before grammar checks.
function bare(s) { return String(s ?? '').replace(/^Wizard:\s*/, '').trim(); }

// ── Prose graders ───────────────────────────────────────────────────────────
function grade(input, res) {
  const issues = [];
  if (res.error) { issues.push(`CRASH: ${res.error.split('\n')[0]}`); return issues; }
  if (res.route !== 'action' && res.route !== 'meta') return issues;

  const n = bare(res.narration);
  if (!n) { issues.push('EMPTY prose'); return issues; }
  if (/^\.{1,3}$/.test(n)) issues.push('PLACEHOLDER "..."');
  // formatting / value leaks
  if (/\bundefined\b|\bnull\b|\bNaN\b|\[object Object\]/.test(n)) issues.push('RAW value leak');
  if (/\b1 others\b/.test(n)) issues.push('plural "1 others"');
  if (/\bthe the\b/i.test(n)) issues.push('"the the"');
  if (/\b(\w+) the \1\b/i.test(n)) issues.push('"X the X" doubling');
  if (/  +/.test(n)) issues.push('double space');
  if (/\s[,;]/.test(n)) issues.push('space before punctuation');
  // Valid endings include . ! ? " ) — combat lines end with "(You: 14 HP)".
  if (!/[.!?")]$/.test(n)) issues.push('no end punctuation');
  if (/^[a-z]/.test(n)) issues.push('lowercase start');
  // Repetitiveness / target-blindness flagged separately in analysis, not here.
  return issues;
}

// ── Corpora ─────────────────────────────────────────────────────────────────
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

// Manipulation verbs — both bare-imperative and first-person, present + absent
// objects. These previously fell through to the abstract composer floor.
const MANIPULATION = [
  'open the crate', 'open the table', 'close the door', 'shut the chest',
  'draw my sword', 'ready my weapon', 'sheathe my blade', 'I draw my sword',
  'sit down', 'stand up', 'kneel', 'rest', 'pray', 'I sit down',
  'eat', 'drink', 'light a torch', 'put on my cloak', 'drop my pack',
  'open the obsidian vault', 'draw my warhammer', 'close the chair',
  // these MUST still roll / not be swallowed:
  'force the door open', 'pick the lock', 'pry open the crate', 'climb the wall',
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

// ── Run ─────────────────────────────────────────────────────────────────────
const packs = loadPacks();
const allIssues = [];
const samples = [];
let total = 0, crashes = 0, issueCount = 0;

function feed(label, world, inputs, { mutate }) {
  let w = world;
  for (const input of inputs) {
    total++;
    let res;
    try {
      res = route(w, input, packs);
    } catch (e) {
      res = { route: 'action', narration: '', error: String(e?.stack || e?.message || e), world: w };
    }
    if (res.error) crashes++;
    if (mutate && res.world) w = res.world;
    const issues = grade(input, res);
    if (issues.length) {
      issueCount++;
      allIssues.push({ label, input, route: res.route, narration: res.narration, mechanics: res.mechanics, issues });
    }
    samples.push({ label, input, route: res.route, narration: res.narration });
  }
  return w;
}

// (A) Evolving session on one world per seed — simulates a real play session.
for (const seed of ['alpha', 'bravo', 'charlie']) {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: `c-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const { world } = beginAdventure(w0, packs);
  const session = [...META.slice(0, 6), ...ACTIONS.slice(0, 16), ...NATURAL.slice(0, 3), ...META.slice(0, 4)];
  feed(`session:${seed}`, world, session, { mutate: true });
}

// (B) Isolated edge cases against a fresh begun world (robustness).
{
  const w0 = newWorld({ seed: 'edge', fate: 0.5, campaignId: 'edge', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const { world } = beginAdventure(w0, packs);
  feed('isolated:meta', world, META, { mutate: false });
  feed('isolated:actions', world, ACTIONS, { mutate: false });
  feed('isolated:manipulation', world, MANIPULATION, { mutate: false });
  feed('isolated:natural', world, NATURAL, { mutate: false });
  feed('isolated:degenerate', world, DEGENERATE, { mutate: false });
  feed('isolated:weird', world, WEIRD, { mutate: false });
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log('\n══════════════════════ PROSE PLAYTEST REPORT ══════════════════════');
console.log(`Total inputs run : ${total}`);
console.log(`Crashes          : ${crashes}`);
console.log(`Inputs w/ issues : ${issueCount}`);

console.log('\n── ROUTING SAMPLE (first of each route) ──');
const seen = new Set();
for (const s of samples) {
  if (seen.has(s.route)) continue;
  seen.add(s.route);
  console.log(`[${s.route}] "${s.input}" -> ${s.narration?.slice(0, 160)}`);
}

if (allIssues.length) {
  console.log('\n── ISSUES ──');
  for (const it of allIssues) {
    console.log(`\n• [${it.label}] input: "${it.input}"  (route=${it.route})`);
    console.log(`  issues: ${it.issues.join('; ')}`);
    console.log(`  prose : ${String(it.narration).slice(0, 220)}`);
  }
}

// Dump a readable transcript of meta + a slice of actions for eyeballing prose quality.
console.log('\n── META PROSE (isolated) ──');
for (const s of samples.filter(s => s.label === 'isolated:meta')) {
  console.log(`Q: ${s.input}\nA: ${s.narration}\n`);
}
console.log('── SAMPLE ACTION PROSE (isolated, first 12) ──');
for (const s of samples.filter(s => s.label === 'isolated:actions').slice(0, 12)) {
  console.log(`> ${s.input}\n  ${s.narration}\n`);
}

console.log('── MANIPULATION PROSE (isolated) ──');
for (const s of samples.filter(s => s.label === 'isolated:manipulation')) {
  const mech = s.route === 'action' ? '' : ` [route=${s.route}]`;
  console.log(`> ${s.input}\n  ${s.narration}${mech}\n`);
}

console.log('\nDONE.');
process.exit(crashes > 0 ? 1 : 0);
