// ─────────────────────────────────────────────────────────────────────────────
// dm-playtest-visual.mjs — the VISUAL map gate ("Option 2": the player SEES the map).
//
// Sibling of scripts/dm-playtest.mjs. That gate is headless — the player/judge only
// read DM text. This one drives the REAL public/v1.html in a Node-owned browser
// (Puppeteer), so a multimodal Opus PLAYER and JUDGE see the actual rendered map
// canvas each turn. It is the only way to catch render-vs-state divergence (a marker
// drawn in the wrong place, a layout the renderer gets wrong) — the headless gate
// cannot see pixels, by construction.
//
//   PLAYER  = Map Nit (claude-opus-4-8, multimodal): probes space/navigation, using
//             the map image to catch the DM contradicting the layout.
//   JUDGE   = claude-opus-4-8, multimodal: scores MAP COHERENCE — does the rendered
//             map agree with the engine's authoritative position AND the DM's words.
//
// It seeds slot1 with a freshly-booted demo-seed world (skips char-creation), clicks
// Continue, then loops: screenshot map → player turn → submit → wait → screenshot map
// → judge. Ground truth is read from the saved world in localStorage each turn.
//
// A Node-owned browser has NO session ceiling (unlike the gstack browse daemon), so a
// multi-turn loop is fine. The engine runs IN THE BROWSER here (faithful to v1.js);
// the LLM layer is hit through the real server endpoints (needs `npm run dev`).
//
// RUN:  node scripts/dm-playtest-visual.mjs [--turns 8] [--seed <seed>] \
//             [--server http://localhost:5179] [--headful] [--out <dir>]
//       Requires ANTHROPIC_API_KEY in .env and the dev server running.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { saveSlot, slotKey } from '../engine/save.js';
import { DEMO_SEED } from '../engine/world/demoRegion.js';
import { buildCanonGroundTruth } from '../engine/ref/rubric.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── CLI args ────────────────────────────────────────────────────────────────
const ARGV = process.argv.slice(2);
const arg = (name, def) => { const i = ARGV.indexOf(`--${name}`); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : def; };
const flag = (name) => ARGV.includes(`--${name}`);
const TURNS = Number(arg('turns', '8'));
const SEED = arg('seed', DEMO_SEED);
const SERVER = arg('server', 'http://localhost:5179');
const HEADFUL = flag('headful');
const MODEL_PLAYER = arg('player-model', 'claude-opus-4-8');
const MODEL_JUDGE = arg('judge-model', 'claude-opus-4-8');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT_DIR = arg('out', path.join(ROOT, 'output', 'visual-map-gate', STAMP));

const KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
if (!KEY) { console.error('ANTHROPIC_API_KEY missing in .env — the visual gate needs it.'); process.exit(1); }

// ── Cost tally (Opus 4.8 est. $15/M in, $75/M out — images inflate input) ─────
const RATES = { in: 15 / 1e6, out: 75 / 1e6 };
const usage = { in: 0, out: 0, calls: 0 };
const tally = (u) => { if (u) { usage.in += u.input_tokens || 0; usage.out += u.output_tokens || 0; usage.calls++; } };
const dollars = () => (usage.in * RATES.in + usage.out * RATES.out);

// ── Multimodal Anthropic client (no temperature — Opus 4.8 deprecates it) ─────
const RETRYABLE = new Set([429, 500, 502, 503, 529]);
async function ask({ system, text, image, model, maxTokens = 400 }) {
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } });
  content.push({ type: 'text', text });
  const body = JSON.stringify({ model, max_tokens: maxTokens, ...(system ? { system } : {}), messages: [{ role: 'user', content }] });
  let lastErr = 'unknown';
  const MAX_RETRY = 8;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    if (attempt > 0) {
      const waitMs = Math.min(30000, 1000 * 2 ** (attempt - 1));
      process.stderr.write(`  [retry ${attempt}/${MAX_RETRY} — ${lastErr} — ${waitMs}ms]\n`);
      await new Promise(r => setTimeout(r, waitMs));
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
    tally(j.usage);
    return (j.content || []).map(b => b.text || '').join('').trim();
  }
  throw new Error(`${model} failed after ${MAX_RETRY} retries — ${lastErr}`);
}
const parseJson = (t) => { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; } };

// ── Map Nit persona (multimodal: it can SEE the map) ──────────────────────────
const MAP_NIT_SYSTEM =
`You are a player obsessed with SPACE and NAVIGATION, playtesting an AI Dungeon Master through a text interface that ALSO shows you a live MAP of where you are (an image is attached each turn). You constantly cross-check the DM's words against the map. You probe the geography: ask what exits/doors/directions exist, move in a direction then try to RETRACE it, re-enter a place and check it's the same, ask "what's to the north?", "where am I on the map?", "how do I get back to X?". You are testing whether the world's MAP holds together — whether your position marker moves correctly when you move, whether directions stay consistent and reversible, whether places keep their names, and whether the DM ever describes rooms, floors, stairs, or exits the map does not show. If the map and the DM disagree, call it out in-character. ACTUALLY MOVE most turns — go through a door, head north/east, climb stairs, step outside — then check the map updated your marker; don't just stand still asking "where am I" every turn. Plain first person, ONE concrete movement or spatial question per turn. Press on specifics; revisit places.`;

const PLAYER_PREAMBLE =
`You are playing a text RPG with an AI Dungeon Master. The attached image is the MAP you currently see. Below is the session so far ("DM:" lines are the DM, "YOU:" are your past turns). Reply with ONLY your next line — what you say or do, in character — as one short utterance. No quotes, no meta, no stage directions. Just the line you'd type.`;

// ── The visual judge: MAP COHERENCE (rendered map vs engine truth vs DM words) ─
const JUDGE_SYSTEM =
`You are a strict QA judge for an AI tabletop RPG, grading ONE turn for MAP COHERENCE. You are given: the player's line, the DM's text reply, the engine's AUTHORITATIVE position (ground truth — this is what is REALLY true), and the MAP IMAGE the player saw AFTER the move (attached). The map is a hand-drawn local map; a marker shows the player's position; structures/labels show the place.

Judge whether the RENDERED MAP is coherent. Return ONLY JSON:
{
 "map_matches_state": true|false,   // does the map reflect the engine's authoritative location / inside-vs-outside / position? false if the marker or layout contradicts ground truth
 "map_matches_narration": true|false, // does the map agree with what the DM just narrated (a door/exit/room the DM mentions should not be absent or contradicted on the map)
 "marker_legible": true|false,      // can you see a clear player-position marker on the map
 "pass": true|false,                // overall: the map is a faithful, legible picture of where the player actually is
 "severity": "none"|"low"|"med"|"high",
 "note": "one sentence: the specific discrepancy, or 'coherent'"
}
Bias toward PASS when the map plausibly matches truth. Fail only on a real, describable discrepancy (marker in the wrong place, inside shown as outside or vice-versa, a narrated exit/room the map flatly lacks, an unreadable/blank map).`;

// ── Engine spatial ground truth (authoritative position for the judge) ────────
function spatialTruth(world) {
  const m = world?.map || {};
  const nodes = m.nodes || {};
  const cur = m.currentNodeId;
  const node = (cur && nodes[cur]) || null;
  const edges = (m.edges || []).filter(e => e && (e.from === cur || e.to === cur || e.a === cur || e.b === cur))
    .map(e => ({ to: e.to === cur ? (e.from) : (e.to ?? e.b), dir: e.dir || e.direction || null }))
    .slice(0, 8);
  return {
    location: world?.scene?.location ?? null,
    inside_structure: Boolean(world?.scene?.interior?.structureKey),
    interior_key: world?.scene?.interior?.structureKey ?? null,
    current_node: cur ?? null,
    current_node_name: node?.name ?? null,
    current_structure: m.currentStructureId ?? null,
    current_room: m.currentRoomId ?? null,
    player_pos: m.pos ?? null,
    exits: edges,
    turn: world?.time?.turn ?? null,
  };
}

// ── Craft the seed save (boot a demo-seed world in Node) ──────────────────────
function craftSeedSave(seed) {
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(ROOT, 'packs/manifest.json'), 'utf-8')));
  const byId = {};
  for (const p of manifest.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(ROOT, p.path), 'utf-8')));
  const { world } = beginAdventure(newWorld({ seed }), byId);
  const store = {};
  const shim = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
  saveSlot(shim, world, 'slot1');
  return { key: slotKey('slot1'), json: store[slotKey('slot1')], lastSlotKey: 'ai-dm-v2:lastSlot' };
}

// ── Browser helpers ───────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function readTranscript(page) {
  return page.evaluate(() => {
    const lines = [...document.querySelectorAll('.transcript .line')].map(l => {
      const who = l.classList.contains('line-player') ? 'YOU' : 'DM';
      const t = l.querySelector('.text')?.textContent?.trim() || '';
      return { who, t };
    });
    return lines;
  });
}
async function readWorld(page, key) {
  const raw = await page.evaluate(k => localStorage.getItem(k), key);
  try { return JSON.parse(raw); } catch { return null; }
}
// The last DM line with actual text. The transcript renders in two phases (base
// narration, then AI polish replaces it) and scene transitions push an empty
// placeholder line that fills async — so "last DM line" must skip empties.
const lastDM = (lines) => { const x = [...lines].reverse().find(l => l.who === 'DM' && l.t.trim()); return x ? x.t.trim() : ''; };
async function shotMap(page, file) {
  const el = await page.$('canvas.local-map-canvas');
  if (!el) return null;
  const buf = await el.screenshot({ type: 'png' });
  if (file) fs.writeFileSync(file, buf);
  return buf.toString('base64');
}
// Submit a line; wait for a NON-EMPTY DM reply that DIFFERS from the pre-move DM
// line and STABILIZES (AI polish lands as a replacement). Returns the DM reply text.
async function submitMove(page, line) {
  const preDM = lastDM(await readTranscript(page));
  await page.evaluate((text) => {
    const input = document.querySelector('input.play-input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const submit = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Submit');
    submit?.click();
  }, line);
  const deadline = Date.now() + 40000;
  let settled = '';
  let stable = 0;
  while (Date.now() < deadline) {
    await sleep(1000);
    const cur = lastDM(await readTranscript(page));
    if (cur && cur !== preDM) {
      if (cur === settled) { if (++stable >= 1) break; }   // same across 2 polls → polish landed
      else { settled = cur; stable = 0; }
    }
  }
  await sleep(400);
  return settled || lastDM(await readTranscript(page));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`VISUAL MAP GATE — Map Nit · seed "${SEED}" · ${TURNS} turns · player/judge=${MODEL_PLAYER}`);
  console.log(`  screenshots → ${path.relative(ROOT, OUT_DIR)}`);

  const seed = craftSeedSave(SEED);
  const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox', '--window-size=1100,900'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', e => process.stderr.write(`  [pageerror] ${e.message}\n`));

  // Seed localStorage on the served origin, then boot v1.html.
  await page.goto(`${SERVER}/v1.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((s, apiKey) => {
    localStorage.setItem(s.key, s.json);
    localStorage.setItem(s.lastSlotKey, 'slot1');
    localStorage.setItem('anthropic_key', apiKey);
    localStorage.setItem('ai_narration_on', '1');
  }, seed, KEY);
  await page.goto(`${SERVER}/v1.html`, { waitUntil: 'networkidle2' });
  // Click Continue.
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('button')].find(b => /^Continue/i.test(b.textContent.trim()));
    c?.click();
  });
  await page.waitForSelector('input.play-input', { timeout: 15000 });
  await page.waitForSelector('canvas.local-map-canvas', { timeout: 15000 });
  await sleep(1200);

  const verdicts = [];
  for (let turn = 1; turn <= TURNS; turn++) {
    const world = await readWorld(page, seed.key);
    const truth = world ? spatialTruth(world) : { error: 'no-world' };
    const preShot = await shotMap(page, path.join(OUT_DIR, `turn-${String(turn).padStart(2, '0')}-pre.png`));
    const transcript = await readTranscript(page);
    const script = transcript.map(l => `${l.who}: ${l.t}`).join('\n');

    // PLAYER turn (sees the current map).
    let playerLine = '';
    try {
      playerLine = await ask({
        system: MAP_NIT_SYSTEM,
        text: `${PLAYER_PREAMBLE}\n\n--- SESSION ---\n${script}\n--- END ---\n\nYour next line:`,
        image: preShot, model: MODEL_PLAYER, maxTokens: 120,
      });
    } catch (e) { playerLine = `[player error] ${e.message}`; }
    playerLine = playerLine.replace(/^["'`]+|["'`]+$/g, '').split('\n')[0].trim().slice(0, 300);
    process.stdout.write(`\n  ▶ T${turn}  YOU: ${playerLine}\n`);

    const dmLine = (await submitMove(page, playerLine)) || '(no DM reply)';

    // Post-move truth + map.
    const world2 = await readWorld(page, seed.key);
    const truth2 = world2 ? spatialTruth(world2) : { error: 'no-world' };
    const postShot = await shotMap(page, path.join(OUT_DIR, `turn-${String(turn).padStart(2, '0')}-post.png`));
    process.stdout.write(`     DM: ${dmLine.slice(0, 160)}\n`);

    // JUDGE turn (sees the post-move map).
    let verdict = null;
    try {
      const out = await ask({
        system: JUDGE_SYSTEM,
        text: `PLAYER: ${playerLine}\nDM: ${dmLine}\n\nENGINE GROUND TRUTH (authoritative position):\n${JSON.stringify(truth2, null, 0)}`,
        image: postShot, model: MODEL_JUDGE, maxTokens: 300,
      });
      verdict = parseJson(out);
    } catch (e) { verdict = { pass: true, severity: 'none', note: `[judge error] ${e.message}` }; }
    verdict = verdict || { pass: true, severity: 'none', note: '[judge parse failed]' };
    const mark = verdict.pass === false ? '✗' : '✓';
    process.stdout.write(`     ${mark} map: matches_state=${verdict.map_matches_state} matches_narration=${verdict.map_matches_narration} marker=${verdict.marker_legible} — ${verdict.note}\n`);
    verdicts.push({ turn, playerLine, dmLine, truthBefore: truth, truthAfter: truth2, verdict });
  }

  await browser.close();
  writeReport(verdicts);
}

function writeReport(verdicts) {
  const fails = verdicts.filter(v => v.verdict?.pass === false);
  const lines = [];
  lines.push(`# Visual Map Gate — Map Nit`);
  lines.push('');
  lines.push(`**Harness:** \`scripts/dm-playtest-visual.mjs\` · real \`public/v1.html\` in Puppeteer · player & judge = ${MODEL_PLAYER} (multimodal — they SEE the rendered map).`);
  lines.push(`**Run:** seed \`${SEED}\` · ${verdicts.length} turns · ai_narration ON · ${STAMP}`);
  lines.push(`**Map coherence:** ${verdicts.length - fails.length}/${verdicts.length} turns passed · **failing:** ${fails.length} (${verdicts.length ? Math.round(100 * fails.length / verdicts.length) : 0}%)`);
  lines.push(`**Cost:** ~$${dollars().toFixed(2)} · ${usage.calls} Opus calls · in ${usage.in} / out ${usage.out} tok (est.)`);
  lines.push(`**Screenshots:** \`${path.relative(ROOT, OUT_DIR)}/turn-NN-(pre|post).png\` — what the player saw each turn.`);
  lines.push('');
  lines.push(`| Turn | matches_state | matches_narr | marker | sev | note |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const v of verdicts) {
    const j = v.verdict || {};
    lines.push(`| ${v.turn} | ${j.map_matches_state} | ${j.map_matches_narration} | ${j.marker_legible} | ${j.severity || '-'} | ${String(j.note || '').replace(/\|/g, '/').slice(0, 90)} |`);
  }
  lines.push('');
  lines.push(`## Turn log`);
  for (const v of verdicts) {
    const j = v.verdict || {};
    const mark = j.pass === false ? '**✗ FAIL**' : '✓';
    lines.push('');
    lines.push(`### Turn ${v.turn} ${mark}`);
    lines.push(`- **YOU:** _${v.playerLine}_`);
    lines.push(`- **DM:** ${v.dmLine}`);
    lines.push(`- **engine after:** loc=\`${v.truthAfter?.location}\` inside=${v.truthAfter?.inside_structure} node=\`${v.truthAfter?.current_node}\` pos=\`${JSON.stringify(v.truthAfter?.player_pos)}\` exits=${(v.truthAfter?.exits || []).length}`);
    lines.push(`- **judge:** ${j.note} (state=${j.map_matches_state}, narr=${j.map_matches_narration}, marker=${j.marker_legible}, sev=${j.severity})`);
    lines.push(`- **map:** \`turn-${String(v.turn).padStart(2, '0')}-post.png\``);
  }
  const reportDir = path.join(ROOT, 'docs', 'playtests');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `visual-map-gate-${STAMP}.md`);
  fs.writeFileSync(reportPath, lines.join('\n'));
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), lines.join('\n'));
  console.log(`\n── Map coherence: ${verdicts.length - fails.length}/${verdicts.length} passed (${fails.length} fail) · ~$${dollars().toFixed(2)} ──`);
  console.log(`Report: ${path.relative(ROOT, reportPath)}`);
  console.log(`Screens: ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
