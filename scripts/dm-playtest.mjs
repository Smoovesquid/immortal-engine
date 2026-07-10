// ─────────────────────────────────────────────────────────────────────────────
// dm-playtest.mjs — the experiential gate (Layer 2 of the playtest plan).
//
// WHAT THIS IS: an Opus-4.8 playtester harness. It drives the REAL live DM path
// (the same routing public/v1.js doSubmitMove uses: meta-grace → playerMove →
// /api/npc-voice → /api/narrate) with a fleet of in-character PLAYER agents, and
// scores every turn with a SEPARATE JUDGE agent against the two-gate MVP rubric:
//
//   GATE 1 — DM vibe : intent resolved in the fiction; no system artifact leaks
//                      (THE_DM_TEST). A charming DM that bounces intent fails.
//   GATE 2 — crunch  : the rules underneath are correct & consistent. A charming
//                      DM that fudges the math fails (the skeptical-DM bar).
//   AXIS  — RAG truth: NPC/rumor claims are GROUNDED in canon (Canon Log), not
//                      confident-but-invented. Hallucinated canon is a failure.
//
// WHY HTTP: the engine runs in-process here (faithful to v1.js, which runs it
// client-side), but the LLM layer is hit through the REAL server endpoints so the
// RAG retrieval + provider wiring is exercised exactly as in the browser.
// Requires `npm run dev` on :5179 and ANTHROPIC_API_KEY in .env (unless --dry-run).
//
// JUDGE REGIMES (docs/briefs/EVAL_REGIME_CONTRACT.md — the debiasing contract):
//   --judge-regime v1      (default) the historical instrument: Opus 4.8 judges
//                          holistically via the shared JUDGE_SYSTEM. Verdict path
//                          byte-identical to gates 1–P10 for series continuity.
//   --judge-regime v2      the debiased instrument: a CROSS-FAMILY judge (default
//                          claude-fable-5 — the player stays Opus) answers EIGHT
//                          ATOMIC booleans with NO elicited reasoning; bug_class +
//                          severity are DERIVED deterministically in code
//                          (deriveVerdictFromAtoms). Vol 10/14: atomic binary +
//                          no judge CoT + cross-family cuts self-preference,
//                          halo, and label noise. NOT comparable with the v1
//                          fail-count series — reports carry a REGIME marker.
//   --judge-regime bridge  BOTH judges on every turn: v1 stays the headline (the
//                          series' last point), v2 is recorded alongside, and the
//                          report prints per-turn agreement. Run ONCE to bridge
//                          the series before switching the default to v2.
//
// AUDIT TRAIL: every run also writes docs/playtests/gate-runs/*.jsonl — one line
// per judged turn INCLUDING passes and the exact canon bundle the judge saw — so
// any verdict can be re-judged offline (cross-family or human) without a replay,
// and false NEGATIVES are measurable at last. Failure MODES accumulate in
// docs/playtests/gate-modes.json; the report's Coverage section runs Chao1 over
// cross-run incidence (scripts/playtest-harness.mjs) to estimate how many modes
// remain undiscovered (Vol 9: capture–recapture; count modes, not turns).
//
// RUN:  node scripts/dm-playtest.mjs [--turns 12] [--seeds s1,s2] \
//             [--personas rules-lawyer,chaos,lore-hound,newbie] [--server URL] \
//             [--judge-regime v1|v2|bridge] [--judge-model M] [--player-model M] \
//             [--out-dir DIR] [--dry-run]
//
// --dry-run: NO LLM calls, NO server, NO key — real deterministic engine turns
// with a scripted player and a deterministic mock judge. Exercises the whole
// report/JSONL/coverage pipeline for $0 (used by tests/U330.gateRegime.test.js).
//
// Worlds are seeded (replay-stable); the agents are not (exploration). Output: a
// per-turn verdict log, failures clustered into bug classes, a report + JSONL
// written to docs/playtests/, and a per-model token/$ tally.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove, carriesInteriorMovementIntent, detectObjectAttackIntent, detectWindowActionIntent } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { DEMO_SEED } from '../engine/world/demoRegion.js';
// THE REF — the gate and the live Ref share ONE rubric (canon oracle + judge
// prompt + bug taxonomy). See engine/ref/rubric.js + docs/THE_REF.md §"Discovery".
// The v1 regime imports JUDGE_SYSTEM verbatim; the v2 atomic prompt lives HERE
// (harness-level) so this lane never edits the shared rubric file.
import { buildCanonGroundTruth, JUDGE_SYSTEM } from '../engine/ref/rubric.js';
// Chao1 (Chao 1987, heterogeneity-robust richness lower bound) — already built +
// hermetically tested for the Human Playtest Harness. Assemble, don't invent.
import { chao1 } from './playtest-harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── CLI args ────────────────────────────────────────────────────────────────
const ARGV = process.argv.slice(2);
function arg(name, def) {
  const i = ARGV.indexOf(`--${name}`);
  return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : def;
}
const TURNS = Number(arg('turns', '12'));
const SEEDS = arg('seeds', DEMO_SEED).split(',').map(s => s.trim()).filter(Boolean);  // D-A3: the gate measures the locked demo region
const SERVER = arg('server', 'http://localhost:5179');
const REGIME = arg('judge-regime', 'v1');            // v1 | v2 | bridge
const DRY_RUN = ARGV.includes('--dry-run');
const OUT_DIR = arg('out-dir', path.join(ROOT, 'docs', 'playtests'));
// Opt-in only — default gate behavior (report/JSONL/coverage) is unchanged when
// this flag is absent. Runs the pure-text coherence analyzer (no LLM, no cost)
// over the JSONL this run just wrote and prints one summary line at the end.
const COHERENCE = ARGV.includes('--coherence');
const MODEL_PLAYER = arg('player-model', 'claude-opus-4-8');
// v1 keeps the historical Opus judge; v2/bridge default the ATOMIC judge to a
// CROSS-FAMILY model (Fable 5) — the Vol-14 §3.3/§6.3 mitigation. Overridable.
const MODEL_JUDGE = arg('judge-model', REGIME === 'v1' ? 'claude-opus-4-8' : 'claude-fable-5');
const MODEL_JUDGE_V1 = 'claude-opus-4-8'; // the bridge's legacy leg is pinned — it IS the series
const PERSONA_KEYS = arg('personas', 'rules-lawyer,chaos,lore-hound,newbie')
  .split(',').map(s => s.trim()).filter(Boolean);

// ── Token / cost tally — PER MODEL, at current list prices (labelled estimate).
// (The old flat $15/$75 was ~3× today's Opus price and overstated every report's
// cost — EVAL_REGIME_CONTRACT §1.1 W7. Prices cached 2026-07-02.)
const RATES = {
  'claude-opus-4-8': { in: 5 / 1e6, out: 25 / 1e6 },
  'claude-fable-5': { in: 10 / 1e6, out: 50 / 1e6 },
  'claude-sonnet-4-6': { in: 3 / 1e6, out: 15 / 1e6 },
  'claude-haiku-4-5': { in: 1 / 1e6, out: 5 / 1e6 },
};
const FALLBACK_RATE = { in: 10 / 1e6, out: 50 / 1e6 }; // unknown model → assume top-tier, never under-report
const usage = {}; // model -> { in, out, calls }
function tally(u, model) {
  if (!u) return;
  const m = (usage[model] ||= { in: 0, out: 0, calls: 0 });
  m.in += u.input_tokens || 0; m.out += u.output_tokens || 0; m.calls++;
}
function dollars() {
  let d = 0;
  for (const [model, m] of Object.entries(usage)) {
    const r = RATES[model] || FALLBACK_RATE;
    d += m.in * r.in + m.out * r.out;
  }
  return d;
}
function usageTotals() {
  return Object.values(usage).reduce((a, m) => ({ in: a.in + m.in, out: a.out + m.out, calls: a.calls + m.calls }), { in: 0, out: 0, calls: 0 });
}

// ── Thin Anthropic client (no temperature — Opus 4.8 deprecates it) ───────────
const KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
// A transient API error (overload/rate-limit/5xx) must NOT kill a whole gate run
// mid-flight and waste the spend already made. Retry on those with exponential
// backoff; fail fast on non-retryable errors (400/401/etc). Deterministic backoff
// (no Math.random — this is a script, but keep it grep-clean per the purity rules).
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529]);
async function ask({ system, user, model, maxTokens = 400 }) {
  const body = JSON.stringify({
    model, max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: user }],
  });
  let lastErr = 'unknown';
  const MAX_RETRY = 10; // patient enough to ride through transient 529-Overloaded dips during API recovery
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    if (attempt > 0) {
      const waitMs = Math.min(30000, 1000 * 2 ** (attempt - 1)); // 1,2,4,8,16,30,30,30,30,30 ≈ 180s total
      process.stderr.write(`  [retry ${attempt}/${MAX_RETRY} — ${lastErr} — waiting ${waitMs}ms]\n`);
      await new Promise(res => setTimeout(res, waitMs));
    }
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
        body,
      });
    } catch (e) {
      lastErr = `network: ${e.message}`;        // transient network blip — retry
      continue;
    }
    const j = await r.json();
    if (j.error) {
      if (RETRYABLE_STATUS.has(r.status)) { lastErr = `${r.status}: ${j.error.message}`; continue; }
      throw new Error(`${model} ${r.status}: ${j.error.message}`); // non-retryable
    }
    tally(j.usage, model);
    return (j.content || []).map(b => b.text || '').join('').trim();
  }
  throw new Error(`${model} failed after ${MAX_RETRY} retries — last: ${lastErr}`);
}
function parseJson(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return null; }
}

// ── Packs (live default: fantasy + merged sub-regions) ────────────────────────
function loadPacks() {
  const packsDir = path.join(ROOT, 'packs');
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf-8')));
  const byId = {};
  for (const p of manifest.packs) {
    byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(ROOT, p.path), 'utf-8')));
  }
  return byId;
}

// ── Server LLM endpoints (faithful mirror of v1.js helpers) ───────────────────
async function postJson(route, body) {
  const r = await fetch(`${SERVER}${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return r.json();
}
let voiceDown = false;
async function tryLocalNpcVoice(d) {
  if (DRY_RUN) return null; // LLM-off: deterministic base narration only
  if (voiceDown || !d || !d.npcName) return null;
  try {
    const data = await postJson('/api/npc-voice', {
      npcName: d.npcName, role: d.npcRole || '', mood: d.mood || '', manner: d.manner || '',
      trust: d.trustLevel ?? d.trust ?? null, mode: d.mode, factPhrase: d.factPhrase || '',
      playerLine: d.playerLine || '', historicalFigureId: d.historicalFigureId || '',
      claim: d.claim || null, substrateContext: d.substrateContext || [],
    });
    if (data.ok && data.line) {
      const mood = d.mood ? `, ${d.mood}` : '';
      return `Wizard: "${data.line}" ${d.npcName} says${mood}.`;
    }
    if (data.reason === 'local_llm_unavailable' || data.reason === 'unavailable') voiceDown = true;
  } catch { /* fall back to base */ }
  return null;
}
async function tryAiNarration(world, baseNarration, outcome) {
  if (DRY_RUN) return null; // LLM-off
  try {
    const data = await postJson('/api/narrate', { world, baseNarration, outcome, anthropicKey: KEY });
    if (data.ok && data.narration && data.narration !== baseNarration) return data.narration;
  } catch { /* fall back to base */ }
  return null;
}

// ── The game driver: one turn of the LIVE DM path ─────────────────────────────
// Mirrors doSubmitMove for the cases an automated player exercises: meta-grace
// (no turn), then playerMove, then NPC voice, then Sonnet polish. (Multi-action
// intent-split via /api/intent is intentionally out of scope for v1 — flagged.)
async function playTurn(world, text) {
  const inCombat = Boolean(world.combat?.active);
  const inDialogue = Boolean(world.scene?.dialogue?.npcId);
  // WIN-LOOK-1 — a declared window action (open/close/look/break/exit) beats the meta
  // gate, mirroring the object-attack guard above.
  if (!inCombat && !inDialogue && isMetaQuestion(text) && !carriesInteriorMovementIntent(world, text) && !detectObjectAttackIntent(world, text) && !detectWindowActionIntent(world, text)) {
    const answer = handleMetaQuestion(text, world);
    if (answer) return { world, dm: answer, mechanics: '', turn: false, route: 'meta' };
  }
  let world2, output;
  try {
    ({ world: world2, output } = playerMove(world, PACKS, text));
  } catch (e) {
    return { world, dm: `[ENGINE THREW] ${e?.message || e}`, mechanics: '', turn: true, route: 'crash', crash: true };
  }
  let base = output?.narration || '...';
  if (output?.dialogue && !output.dialogue.factBody && !output.dialogue.commonBody) {
    const spoken = await tryLocalNpcVoice(output.dialogue);
    if (spoken) base = spoken;
  }
  const mech = output?.mechanics || '';
  const skipPolish = /the DM is unmoved|nice try/i.test(mech) || /\[dialogue exit/.test(mech);
  const ai = skipPolish ? null : await tryAiNarration(world2, base, { input: text, mechanics: mech, narrationSource: output?.narrationSource });
  // The UI renders the DM via speaker attribution, not the literal "Wizard:"
  // prefix the engine puts on base narration — strip it so the judge sees what
  // a player sees (otherwise the raw prefix reads as a system-artifact leak).
  const dm = String(ai || base).replace(/^\s*Wizard:\s*/, '');
  return { world: world2, dm, mechanics: mech, turn: true, route: output?.dialogue ? 'dialogue' : 'action' };
}

// ── Canon ground-truth bundle (the RAG-faithfulness oracle) ───────────────────
// canonGroundTruth + consumablesGroundTruth live in engine/ref/rubric.js
// (exported as buildCanonGroundTruth) so the live Ref scores against the SAME
// oracle. The gate calls buildCanonGroundTruth(world) once per turn; the SAME
// bundle goes to the judge(s) AND into the JSONL audit line, so any verdict can
// be re-checked offline against exactly what the judge saw.

// ── Personas ──────────────────────────────────────────────────────────────────
const PERSONAS = {
  'rules-lawyer': {
    label: 'Rules Lawyer DM',
    system: `You are a 30-year tabletop veteran DM playtesting an AI Dungeon Master through a text interface. You play in good faith but you AUDIT every adjudication. You probe the CRUNCH: start fights, attack named foes, check your HP/wounds, cast spells, check resources, take damage, test whether consequences follow from the dice. You want to catch the DM fudging math, contradicting its own dice, or narrating an outcome the rules don't support. Speak/act in plain first person, ONE concrete action or question per turn. Be specific and use proper nouns the DM has given you. Vary your probes.`,
  },
  'chaos': {
    label: 'Chaos-griefer',
    system: `You are a chaos-player playtesting an AI Dungeon Master through a text interface. You do antisocial and gratuitous things: blast NPCs with spells, smash property, attack innocents, declare impossible feats. You are testing whether the world PUSHES BACK with consequence (social, environmental, divine) or just lets you do anything. Plain first person, ONE concrete action per turn. Escalate.`,
  },
  'lore-hound': {
    label: 'Lore-hound',
    system: `You are a lore-obsessed player playtesting an AI Dungeon Master through a text interface. You interrogate NPCs about history, rumors, who-knows-what, past events, and the world's deep lore. You revisit topics and try to make the world CONTRADICT ITSELF — catch an NPC "remembering" something that never happened. Plain first person, ONE pointed question or action per turn. Name names; press on specifics.`,
  },
  'newbie': {
    label: 'Confused newbie',
    system: `You are someone who has never played a tabletop RPG, playtesting an AI Dungeon Master through a text interface. You don't know any commands or verbs. You type the way a normal person talks — vague, polite, sometimes off-topic ("um, what is this?", "can I look around?", "who are you?"). You are testing whether the DM meets you in the fiction without ever making you learn mechanics. Plain first person, ONE natural line per turn.`,
  },
};

const PLAYER_PREAMBLE =
  `You are playing a text RPG with an AI Dungeon Master. Below is the session so far ` +
  `("DM:" lines are the DM, "YOU:" lines are your past turns). Reply with ONLY your next ` +
  `line — what you say or do, in character — as one short utterance. No quotes, no meta, ` +
  `no stage directions about being a tester. Just the line you'd type.`;

// Dry-run player: a fixed probe script (deterministic; cycles). Exercises meta,
// dialogue, action, and combat routes without any model.
const DRY_RUN_SCRIPT = [
  'can I look around?',
  'who is here with me?',
  'what am I carrying?',
  'I walk to the doorway and look through it.',
  'I attack the nearest person here.',
  'what do I know about this place?',
];

async function playerTurn(persona, transcript, turnIndex) {
  if (DRY_RUN) return DRY_RUN_SCRIPT[turnIndex % DRY_RUN_SCRIPT.length];
  const script = transcript.map(t => `${t.who === 'you' ? 'YOU' : 'DM'}: ${t.text}`).join('\n');
  const line = await ask({
    system: persona.system,
    user: `${PLAYER_PREAMBLE}\n\n--- SESSION ---\n${script}\n--- END ---\n\nYour next line:`,
    model: MODEL_PLAYER, maxTokens: 120,
  });
  return line.replace(/^["'`]+|["'`]+$/g, '').split('\n')[0].trim().slice(0, 300);
}

// ── The judges ────────────────────────────────────────────────────────────────
// v1 (holistic, series-continuity): JUDGE_SYSTEM imported from engine/ref/rubric.js
// — byte-identical to the historical prompt, scored by the historical model.
//
// v2 (atomic, debiased): the prompt below. EIGHT booleans, NO elicited reasoning,
// verdict-only output; bug_class/severity are computed by deriveVerdictFromAtoms.
// Same user content as v1 (player/DM/mech/canon) so bridge runs A/B the judging
// protocol in isolation. The v1 carve-outs (hyperbole/attitude, roll-recall,
// items, nearby places) are inherited verbatim — they are scar tissue from four
// production false-positive families (EVAL_REGIME_CONTRACT §1.2) and must not be
// re-learned the hard way.
export const GATE_JUDGE_SYSTEM_V2 =
`You are a strict evaluator of an AI Dungeon Master, judging ONE turn. You see the player's
line, the DM's response, the engine's mechanics string, and a CANON ground-truth bundle.

Answer EIGHT yes/no checks. Output ONLY the JSON object of eight booleans — no prose, no
explanations, nothing before or after the JSON.

- intent_addressed: the DM's reply engages what the player actually said or asked — not a
  different question, not pure scenery, not an unrequested action substituted for the ask.
- resolved_in_fiction: the turn DELIVERS in the fiction — something happened, an answer or an
  honest in-voice decline was given. false if intent was bounced back as a mechanical/UI prompt
  ("which way: N/S/E/W?", "What do you do?" as the whole answer) or left hanging unresolved.
- no_machine_leak: no raw ids, no stat-block/table dump as the answer, no "command not
  recognized", no bare navigation menu. In-voice prose = true.
- dice_fiction_match: IF the mechanics show a roll/outcome, the narration's CONTENT matches it —
  a success delivers substance (an empty "it goes your way" after a demand for specifics is
  false), a failure is not narrated as success, a mixed result reads as partial. true if no roll.
- state_change_reflected: IF mechanics show damage/HP/resource/state change, the narration
  reflects it; and IF the player's action plainly demands mechanical resolution (self-harm,
  hazard, forcing a barrier), something resolved it (roll, applied effect, or an in-voice
  refusal). true when nothing needed resolving.
- attack_declared_unresolved: true ONLY when the player declared violence against a present
  being AND no real combat resolution followed (no combat state, no enemy entity/HP, no roll,
  no in-voice refusal) — the declared-attack-fizzles case. Otherwise false.
- factual_claim_made: the DM or an NPC asserted a CONCRETE checkable specific — a proper name,
  a count/date/number, a who-did-what past event. Rhetorical hyperbole, atmosphere, and
  in-character attitude/judgment are NOT factual claims. false if none asserted.
- claims_grounded: every such specific is supported by the CANON bundle. true if none asserted.
  NOT ungrounded: places listed in nearbyPlaces; a cited past roll/DC matching lastRoll or
  recentCanon (correct canon-defense); item effects matching the consumables list (effect:null
  items genuinely do nothing — do not assume an effect the list lacks).

Return ONLY JSON:
{"intent_addressed":bool,"resolved_in_fiction":bool,"no_machine_leak":bool,
"dice_fiction_match":bool,"state_change_reflected":bool,"attack_declared_unresolved":bool,
"factual_claim_made":bool,"claims_grounded":bool}`;

export const ATOM_NAMES = Object.freeze([
  'intent_addressed', 'resolved_in_fiction', 'no_machine_leak',
  'dice_fiction_match', 'state_change_reflected', 'attack_declared_unresolved',
  'factual_claim_made', 'claims_grounded',
]);

// The deterministic core of regime v2: atoms in → verdict out. The judge model
// has NO say in bug_class or severity — label variance can only enter through
// atom flips (which atomic binary checks minimize), never through narration.
// Priority: CANON_HALLUCINATION > COMBAT_NOT_STARTED > CRUNCH_INCONSISTENCY >
// DM_ARTIFACT_LEAK > DM_TEST_DEADEND > NONE. (CRASH is harness-set, never judged.)
export function deriveVerdictFromAtoms(atoms) {
  const a = {};
  for (const k of ATOM_NAMES) a[k] = Boolean(atoms?.[k]);
  const vibePass = a.intent_addressed && a.resolved_in_fiction && a.no_machine_leak;
  const crunchPass = a.dice_fiction_match && a.state_change_reflected && !a.attack_declared_unresolved;
  const ragChecked = a.factual_claim_made;
  const ragGrounded = a.claims_grounded;
  let bug_class = 'NONE';
  if (ragChecked && !ragGrounded) bug_class = 'CANON_HALLUCINATION';
  else if (a.attack_declared_unresolved) bug_class = 'COMBAT_NOT_STARTED';
  else if (!a.dice_fiction_match || !a.state_change_reflected) bug_class = 'CRUNCH_INCONSISTENCY';
  else if (!a.no_machine_leak) bug_class = 'DM_ARTIFACT_LEAK';
  else if (!a.intent_addressed || !a.resolved_in_fiction) bug_class = 'DM_TEST_DEADEND';
  const axesFailed = [!vibePass, !crunchPass, ragChecked && !ragGrounded].filter(Boolean).length;
  const severity = axesFailed >= 2 ? 'high' : axesFailed === 1 ? 'med' : 'none';
  return {
    vibe: { pass: vibePass, issue: '' },
    crunch: { pass: crunchPass, issue: '' },
    rag: { checked: ragChecked, grounded: ragGrounded, issue: '' },
    bug_class, severity, note: '', _atoms: a,
  };
}

// The report must print the FAILING axis's issue — the old first-non-empty pick
// (crunch||vibe||rag) routinely printed a PASSING axis's explanation under a
// failure heading (EVAL_REGIME_CONTRACT §1.1 W4).
export function pickIssue(v) {
  if (v.crunch?.pass === false && v.crunch?.issue) return v.crunch.issue;
  if (v.vibe?.pass === false && v.vibe?.issue) return v.vibe.issue;
  if (v.rag?.checked && v.rag?.grounded === false && v.rag?.issue) return v.rag.issue;
  return v.note || v.crunch?.issue || v.vibe?.issue || v.rag?.issue || '';
}

// The atoms that actually FAILED, normalized. Two atoms are membership-flavored,
// not pass-flavored: attack_declared_unresolved fails when TRUE, and
// factual_claim_made only gates whether claims_grounded is meaningful.
export function failedAtoms(a) {
  const failed = [];
  for (const k of ['intent_addressed', 'resolved_in_fiction', 'no_machine_leak', 'dice_fiction_match', 'state_change_reflected']) {
    if (a?.[k] === false) failed.push(k);
  }
  if (a?.attack_declared_unresolved) failed.push('attack_declared_unresolved');
  if (a?.factual_claim_made && !a?.claims_grounded) failed.push('claims_grounded');
  return failed.sort();
}

// Mode signature — the unit of coverage counting (Vol 14 §5.4: track MODES, not
// counts; Vol 9 §2: tagging consistency is the capture-recapture prerequisite).
// v2 verdicts carry atoms → class + failed-atom set; v1 falls back to class only.
export function modeSignature(v) {
  if (!v || v.bug_class === 'NONE' || v.bug_class === 'JUDGE_ERROR') return null;
  if (v._atoms) return `${v.bug_class}:${failedAtoms(v._atoms).join('+') || 'unspecified'}`;
  return String(v.bug_class);
}

function judgeUser({ player, dm, mechanics, truth }) {
  return `PLAYER: ${player}\nDM: ${dm}\nMECHANICS: ${mechanics || '(none)'}\n\nCANON (ground truth):\n${JSON.stringify(truth, null, 0)}`;
}

// Deterministic mock judge for --dry-run (structural testing only; no semantics).
// Hash of the player line selects a verdict shape so pass AND fail paths of the
// report/JSONL/coverage pipeline are exercised. No Math.random (purity rule 1).
export function mockAtoms(player) {
  const h = [...String(player)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const a = Object.fromEntries(ATOM_NAMES.map(k => [k, true]));
  a.attack_declared_unresolved = false; a.factual_claim_made = false;
  if (h % 3 === 0) { a.resolved_in_fiction = false; }             // a deadend
  if (h % 5 === 0) { a.factual_claim_made = true; a.claims_grounded = false; } // a hallucination
  return a;
}

async function judgeTurnV1({ player, dm, mechanics, truth }) {
  if (DRY_RUN) {
    const v = deriveVerdictFromAtoms(mockAtoms(player));
    delete v._atoms; // v1 verdicts have no atoms
    return { verdict: { ...v, note: '[dry-run mock judge]' }, judgeError: false };
  }
  const out = await ask({
    system: JUDGE_SYSTEM,
    user: judgeUser({ player, dm, mechanics, truth }),
    model: MODEL_JUDGE_V1, maxTokens: 350,
  });
  const parsed = parseJson(out);
  if (parsed) return { verdict: parsed, judgeError: false };
  // Legacy shape preserved for series continuity (a parse-fail never counted as a
  // failing turn in v1) — but now it is COUNTED and visible, never silent (W3).
  return {
    verdict: { vibe: { pass: true }, crunch: { pass: true }, rag: { checked: false }, bug_class: 'NONE', severity: 'none', note: '[judge parse failed]' },
    judgeError: true,
  };
}

async function judgeTurnV2({ player, dm, mechanics, truth }) {
  if (DRY_RUN) return { verdict: { ...deriveVerdictFromAtoms(mockAtoms(player)), note: '[dry-run mock judge]' }, judgeError: false };
  const out = await ask({
    system: GATE_JUDGE_SYSTEM_V2,
    user: judgeUser({ player, dm, mechanics, truth }),
    model: MODEL_JUDGE, maxTokens: 160,
  });
  const atoms = parseJson(out);
  if (!atoms) {
    // v2 never silently passes: a broken judge is an unjudged turn, excluded from
    // the fail-rate denominator and listed in the report.
    return { verdict: { vibe: { pass: true }, crunch: { pass: true }, rag: { checked: false }, bug_class: 'JUDGE_ERROR', severity: 'none', note: '[judge parse failed]' }, judgeError: true };
  }
  const verdict = deriveVerdictFromAtoms(atoms);
  if (verdict.bug_class !== 'NONE') {
    // Evidence call — fires ONLY on derived failures (~cost-neutral), and its text
    // can never change the verdict. One terse sentence for the human report.
    try {
      const note = await ask({
        system: 'In ONE terse sentence, state the concrete evidence for the failing check(s) named. No verdict, no hedging, just the evidence.',
        user: `${judgeUser({ player, dm, mechanics, truth })}\n\nFAILING CHECKS: ${failedAtoms(verdict._atoms).join(', ')}`,
        model: MODEL_JUDGE, maxTokens: 80,
      });
      verdict.note = note.slice(0, 300);
    } catch { verdict.note = '[evidence call failed]'; }
  }
  return { verdict, judgeError: false };
}

async function judgeTurn(turn) {
  const out = {};
  if (REGIME === 'v1' || REGIME === 'bridge') {
    const { verdict, judgeError } = await judgeTurnV1(turn);
    out.v1 = verdict; out.v1JudgeError = judgeError;
  }
  if (REGIME === 'v2' || REGIME === 'bridge') {
    const { verdict, judgeError } = await judgeTurnV2(turn);
    out.v2 = verdict; out.v2JudgeError = judgeError;
  }
  // The HEADLINE verdict: v1 in v1/bridge (series continuity — the bridge run is
  // the v1 series' last point), v2 in v2.
  out.headline = REGIME === 'v2' ? out.v2 : out.v1;
  out.judgeError = REGIME === 'v2' ? out.v2JudgeError : out.v1JudgeError;
  return out;
}

// ── Session runner ────────────────────────────────────────────────────────────
let PACKS;
async function runSession(seed, personaKey) {
  const persona = PERSONAS[personaKey];
  // Match the LIVE game: public/v1.js boots new games with mode:'escape', which
  // selects the escapeCombat engine (meta.escapeHp + a real loss-ending on
  // defeat). Booting without it tested the NON-escape resolver — a different
  // engine than players actually hit. (Found 2026-06-15 while tackling combat #1.)
  let world = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  // Opening beat: the engine's start narration, polished, as the DM's first line.
  const opener = await tryAiNarration(world, world.scene?.narration || 'You wake. What do you do?', { input: '(begin)' })
    || world.scene?.narration || 'You wake. What do you do?';
  const transcript = [{ who: 'dm', text: opener }];
  const verdicts = [];
  process.stdout.write(`\n  ▶ ${persona.label} @ seed "${seed}"\n`);
  for (let i = 0; i < TURNS; i++) {
    const player = await playerTurn(persona, transcript, i);
    if (!player) break;
    transcript.push({ who: 'you', text: player });
    const r = await playTurn(world, player);
    world = r.world;
    transcript.push({ who: 'dm', text: r.dm });
    // ONE canon bundle per turn: the judges score against it AND it is persisted,
    // so every verdict is re-checkable offline against what the judge saw.
    const truth = buildCanonGroundTruth(world);
    let j;
    if (r.crash) {
      const crashV = { vibe: { pass: false, issue: 'engine crash' }, crunch: { pass: false }, rag: { checked: false }, bug_class: 'CRASH', severity: 'high', note: r.dm };
      j = { headline: crashV, judgeError: false, ...(REGIME !== 'v2' ? { v1: crashV } : {}), ...(REGIME !== 'v1' ? { v2: crashV } : {}) };
    } else {
      j = await judgeTurn({ player, dm: r.dm, mechanics: r.mechanics, truth });
    }
    const v = j.headline;
    verdicts.push({
      i, player, dm: r.dm, mechanics: r.mechanics, route: r.route, canon: truth,
      judgeError: Boolean(j.judgeError), v1: j.v1 || null, v2: j.v2 || null, ...v,
    });
    const flags = [v.vibe?.pass === false && 'VIBE', v.crunch?.pass === false && 'CRUNCH',
      v.rag?.checked && v.rag?.grounded === false && 'RAG'].filter(Boolean);
    process.stdout.write(`    ${i + 1}. ${flags.length ? '✗ ' + flags.join('+') : '✓'}  "${player.slice(0, 48)}"${flags.length ? `  — ${pickIssue(v)}` : ''}${j.judgeError ? '  [JUDGE ERROR]' : ''}\n`);
  }
  return { seed, persona: persona.label, personaKey, transcript, verdicts };
}

// ── Report + audit trail ──────────────────────────────────────────────────────
function failed(v) {
  return v.vibe?.pass === false || v.crunch?.pass === false || (v.rag?.checked && v.rag?.grounded === false) || v.bug_class === 'CRASH';
}
function nonClobberPath(dir, base, ext) {
  let p = path.join(dir, `${base}${ext}`);
  for (let n = 2; fs.existsSync(p); n++) p = path.join(dir, `${base}-${n}${ext}`);
  return p;
}
function judgeDescription() {
  if (REGIME === 'v1') return `${MODEL_JUDGE_V1} (v1 holistic)`;
  if (REGIME === 'v2') return `${MODEL_JUDGE} (v2 atomic, cross-family)`;
  return `${MODEL_JUDGE_V1} (v1 holistic, headline) + ${MODEL_JUDGE} (v2 atomic)`;
}
function engineVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')).version || '?'; }
  catch { return '?'; }
}

// Persist the per-turn audit trail (INCLUDING passes + the canon bundle) — the
// prerequisite for offline re-judging, false-negative measurement, and every
// later regime packet. One JSONL per run under gate-runs/.
function writeRunJsonl(sessions, runId) {
  const dir = path.join(OUT_DIR, 'gate-runs');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${runId}.jsonl`);
  const lines = [JSON.stringify({
    type: 'run', runId, date: new Date().toISOString(), regime: REGIME, dryRun: DRY_RUN,
    playerModel: MODEL_PLAYER, judgeModel: REGIME === 'v1' ? MODEL_JUDGE_V1 : MODEL_JUDGE,
    judge: judgeDescription(), seeds: SEEDS, personas: PERSONA_KEYS, turns: TURNS,
    engineVersion: engineVersion(),
  })];
  for (const s of sessions) {
    for (const v of s.verdicts) {
      lines.push(JSON.stringify({
        type: 'turn', seed: s.seed, persona: s.personaKey, i: v.i,
        player: v.player, dm: v.dm, mechanics: v.mechanics, route: v.route,
        canon: v.canon, judgeError: v.judgeError, v1: v.v1, v2: v.v2,
      }));
    }
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

// Accumulate failure MODES across runs → Chao1 saturation estimate. Incidence =
// the number of RUNS in which a mode has been observed (capture–recapture across
// runs; Vol 9 §2). Lower bound: report "at least N remain", never "exactly N".
function updateModesLedger(sessions, runId) {
  const file = path.join(OUT_DIR, 'gate-modes.json');
  let ledger = { runs: [] };
  try { ledger = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { /* first run */ }
  if (!Array.isArray(ledger.runs)) ledger.runs = [];
  const verdictFor = (v) => (REGIME === 'v1' ? v.v1 || v : REGIME === 'v2' ? v.v2 || v : v.v2 || v.v1 || v);
  const modes = [...new Set(sessions.flatMap(s => s.verdicts.map(x => modeSignature(verdictFor(x)))).filter(Boolean))].sort();
  const knownBefore = new Set(ledger.runs.flatMap(r => r.modes || []));
  const newModes = modes.filter(m => !knownBefore.has(m));
  ledger.runs.push({ runId, date: new Date().toISOString().slice(0, 10), regime: REGIME, dryRun: DRY_RUN || undefined, modes });
  // Chao1 needs consistent tagging granularity (Vol 9 §8): v1 signatures are
  // class-only, v2/bridge are class+atoms. Estimate over same-granularity runs.
  const sameGranularity = ledger.runs.filter(r => (r.regime === 'v1') === (REGIME === 'v1'));
  const incidence = {};
  for (const r of sameGranularity) for (const m of r.modes || []) incidence[m] = (incidence[m] || 0) + 1;
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n');
  return { modes, newModes, incidence, totalRuns: sameGranularity.length, est: chao1(incidence) };
}

// CG-P3 — namespaced ledger for the Coherence Gate's CG-* classes, kept
// SEPARATE from gate-modes.json (see docs/briefs/COHERENCE_GATE.md §5: Chao1
// requires consistent tagging granularity per capture universe, and the
// Coherence Gate is a distinct instrument — state-grounded/deterministic/$0 —
// from the judged gate). CG-P2 seeded this file retroactively from the
// existing gate JSONLs; this function appends the STANDING run alongside it
// via the exact same shape (`runs[]` + `classCounts` + `note`), so a later
// reader (or Chao1 pass) sees one continuous series regardless of which mode
// (retroactive CLI vs standing --coherence) produced each entry.
function updateCoherenceModesLedger(coherenceResult, runId) {
  const file = path.join(OUT_DIR, 'coherence-modes.json');
  let ledger = { runs: [], classCounts: {}, note: '' };
  try { ledger = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { /* first run */ }
  if (!Array.isArray(ledger.runs)) ledger.runs = [];
  if (!ledger.classCounts || typeof ledger.classCounts !== 'object') ledger.classCounts = {};
  const modes = Object.keys(coherenceResult.byClass || {}).filter(c => (coherenceResult.byClass[c] || []).length > 0).sort();
  ledger.runs.push({ runId, date: new Date().toISOString().slice(0, 10), regime: REGIME, dryRun: DRY_RUN || undefined, modes });
  for (const [cls, flags] of Object.entries(coherenceResult.byClass || {})) {
    ledger.classCounts[cls] = (ledger.classCounts[cls] || 0) + flags.length;
  }
  ledger.note = ledger.note || 'Namespaced ledger for the Coherence Gate\'s CG-* failure classes (docs/briefs/COHERENCE_GATE.md §3), separate from gate-modes.json (the Opus experiential-gate ledger). Do NOT merge the two — Chao1 saturation tracking requires consistent tagging granularity per capture universe (Vol 9 §8). Seeded 2026-07-03 by CG-P2 from the hand-verified baseline docs/playtests/COHERENCE_GATE_BASELINE_2026-07-03.md; CG-P3 appends standing-gate runs (--coherence) alongside the retroactive ones.';
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n');
  return { modes };
}

function writeReport(sessions, runId) {
  const date = new Date().toISOString().slice(0, 10);
  const all = sessions.flatMap(s => s.verdicts.map(v => ({ ...v, persona: s.persona, seed: s.seed })));
  const judgeErrors = all.filter(v => v.judgeError);
  const judged = all.filter(v => !(v.judgeError && REGIME === 'v2')); // v2: unjudged turns leave the denominator
  const fails = judged.filter(failed);
  const byClass = {};
  for (const f of fails) (byClass[f.bug_class] ||= []).push(f);
  const jsonlFile = writeRunJsonl(sessions, runId);
  const coverage = updateModesLedger(sessions, runId);
  const lines = [];
  lines.push(`# Playtest — Opus-4.8 experiential gate — ${date}`);
  lines.push('');
  lines.push(`**Harness:** \`scripts/dm-playtest.mjs\` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player = ${MODEL_PLAYER} · judge = ${judgeDescription()} · regime = ${REGIME}${DRY_RUN ? ' · **DRY-RUN (mock judge, LLM-off — structural output only)**' : ''}`);
  if (REGIME !== 'v1') {
    lines.push('');
    lines.push(`> **REGIME ${REGIME.toUpperCase()}** — atomic no-CoT cross-family judging (docs/briefs/EVAL_REGIME_CONTRACT.md). ${REGIME === 'v2' ? 'Fail counts are NOT comparable with the v1 historical series.' : 'Headline counts are the v1 series; the v2 series is recorded alongside in the JSONL.'}`);
  }
  lines.push(`**Run:** ${sessions.length} sessions × ${TURNS} turns · personas: ${sessions.map(s => s.persona).join(', ')} · seeds: ${[...new Set(sessions.map(s => s.seed))].join(', ')} · engine v${engineVersion()}`);
  lines.push(`**Audit trail:** \`${path.relative(ROOT, jsonlFile)}\` (every turn incl. passes + the canon bundle the judge saw)`);
  lines.push('');
  lines.push(`## Score`);
  lines.push('');
  lines.push(`| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const s of sessions) {
    const v = s.verdicts;
    lines.push(`| ${s.persona} | ${s.seed} | ${v.length} | ${v.filter(x => x.vibe?.pass === false).length} | ${v.filter(x => x.crunch?.pass === false).length} | ${v.filter(x => x.rag?.checked && x.rag?.grounded === false).length} |`);
  }
  lines.push('');
  lines.push(`**Total turns judged:** ${judged.length} · **failing turns:** ${fails.length} (${judged.length ? Math.round(100 * fails.length / judged.length) : 0}%)${judgeErrors.length ? ` · **judge errors:** ${judgeErrors.length} (marked, ${REGIME === 'v2' ? 'excluded from the denominator' : 'scored as legacy pass for series continuity'})` : ''}`);
  if (REGIME === 'bridge') {
    const both = all.filter(v => v.v1 && v.v2);
    const agree = both.filter(v => failed(v.v1) === failed(v.v2));
    const dis = both.filter(v => failed(v.v1) !== failed(v.v2));
    lines.push('');
    lines.push(`## Judge agreement (v1 holistic-Opus vs v2 atomic-${MODEL_JUDGE})`);
    lines.push('');
    lines.push(`Pass/fail agreement: **${both.length ? Math.round(100 * agree.length / both.length) : 0}%** (${agree.length}/${both.length}). Disagreements: ${dis.length}.`);
    for (const d of dis.slice(0, 12)) {
      lines.push(`- **[${d.persona}]** t${d.i + 1} _"${String(d.player).slice(0, 60)}"_ — v1 ${failed(d.v1) ? `FAIL (${d.v1.bug_class})` : 'pass'} vs v2 ${failed(d.v2) ? `FAIL (${d.v2.bug_class})` : 'pass'}`);
    }
  }
  lines.push('');
  lines.push(`## Failures by bug class`);
  for (const cls of Object.keys(byClass).sort((a, b) => byClass[b].length - byClass[a].length)) {
    lines.push('');
    lines.push(`### ${cls} (${byClass[cls].length})`);
    for (const f of byClass[cls].slice(0, 8)) {
      lines.push(`- **[${f.persona}]** player: _"${f.player}"_`);
      lines.push(`  - DM: ${String(f.dm).replace(/\n/g, ' ').slice(0, 220)}`);
      lines.push(`  - mech: \`${(f.mechanics || '(none)').slice(0, 100)}\` — **${f.severity}**: ${pickIssue(f)}`);
    }
  }
  lines.push('');
  lines.push(`## Coverage (modes, not turns — Vol 9/14)`);
  lines.push('');
  lines.push(`Failure modes this run: **${coverage.modes.length}**${coverage.modes.length ? ` (${coverage.modes.join(' · ')})` : ''} · new vs ledger: **${coverage.newModes.length}**${coverage.newModes.length ? ` (${coverage.newModes.join(' · ')})` : ''}`);
  lines.push(`Cumulative distinct modes across ${coverage.totalRuns} logged run(s): **${coverage.est.sObs}** · Chao1 ≥ **${coverage.est.estimate.toFixed(1)}** → **at least ~${coverage.est.remaining.toFixed(1)} modes likely remain** (CI [${coverage.est.ciLow}, ${coverage.est.ciHigh}]). Lower bound — heterogeneity-robust, not a completion promise. Ledger: \`${path.relative(ROOT, path.join(OUT_DIR, 'gate-modes.json'))}\``);
  lines.push('');
  lines.push(`## Cost`);
  const t = usageTotals();
  const perModel = Object.entries(usage).map(([m, u]) => `${m}: ${u.calls} calls · ${u.in.toLocaleString()} in + ${u.out.toLocaleString()} out`).join(' · ') || '(no LLM calls — dry run)';
  lines.push(`${t.calls} calls · ${t.in.toLocaleString()} in + ${t.out.toLocaleString()} out tokens · ~$${dollars().toFixed(2)} (est., per-model current list prices)`);
  lines.push(`Per model: ${perModel}`);
  lines.push('');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = nonClobberPath(OUT_DIR, `opus-gate-${date}${DRY_RUN ? '-dryrun' : ''}`, '.md');
  fs.writeFileSync(file, lines.join('\n'));
  return { file, jsonlFile, fails: fails.length, total: judged.length, byClass, coverage };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!['v1', 'v2', 'bridge'].includes(REGIME)) { console.error(`unknown --judge-regime: ${REGIME} (v1|v2|bridge)`); process.exit(1); }
  if (!DRY_RUN) {
    if (!KEY) { console.error('No ANTHROPIC_API_KEY in env (.env).'); process.exit(1); }
    // Server health
    try {
      const h = await fetch(`${SERVER}/healthz`).then(r => r.text());
      if (!/ok/.test(h)) throw new Error('bad health');
    } catch {
      console.error(`Server not reachable at ${SERVER}. Start it: npm run dev`); process.exit(1);
    }
  }
  PACKS = loadPacks();
  const runId = `gate-${new Date().toISOString().replace(/[:.]/g, '-')}-${REGIME}${DRY_RUN ? '-dryrun' : ''}`;
  console.log(`DM PLAYTEST — ${PERSONA_KEYS.length} personas × ${SEEDS.length} seeds × ${TURNS} turns  (player=${MODEL_PLAYER} · judge=${judgeDescription()}${DRY_RUN ? ' · DRY-RUN' : ''})`);
  const sessions = [];
  for (const seed of SEEDS) {
    for (const pk of PERSONA_KEYS) {
      if (!PERSONAS[pk]) { console.warn(`unknown persona: ${pk}`); continue; }
      sessions.push(await runSession(seed, pk));
    }
  }
  const rep = writeReport(sessions, runId);
  console.log(`\n════════════════════════════════════════════`);
  console.log(`FAILING TURNS: ${rep.fails}/${rep.total}`);
  console.log(`BUG CLASSES: ${Object.entries(rep.byClass).map(([k, v]) => `${k}:${v.length}`).join('  ') || '(none)'}`);
  console.log(`MODES: ${rep.coverage.modes.length} this run · ${rep.coverage.newModes.length} new · Chao1 ≥ ${rep.coverage.est.estimate.toFixed(1)} (S_obs ${rep.coverage.est.sObs})`);
  console.log(`COST: ~$${dollars().toFixed(2)} (${usageTotals().calls} calls, ${usageTotals().in + usageTotals().out} tokens)`);
  console.log(`REPORT: ${path.relative(ROOT, rep.file)}`);
  console.log(`AUDIT:  ${path.relative(ROOT, rep.jsonlFile)}`);
  if (COHERENCE) {
    // Opt-in, additive: BOTH coherence tiers run over the JSONL this run just
    // wrote. Pure text/state analysis — no LLM call, no cost, no effect on
    // rep/exit behavior (the flag INFORMS; it never changes the exit code).
    //   Tier 1 — the transcript auditor (docs/playtests/COHERENCE_SEAMS_2026-07-02.md).
    //   Tier 2 — CG-P1's state-grounded checker (docs/briefs/COHERENCE_GATE.md),
    //            diffing DM prose against the SAME canon bundle the judge held.
    const { loadJsonlFile: loadTranscript, analyzeCoherence, summaryLine: transcriptSummaryLine } = await import('./coherence-audit.mjs');
    const transcriptResult = analyzeCoherence(loadTranscript(rep.jsonlFile));
    console.log(transcriptSummaryLine(transcriptResult));

    const { loadJsonlFile: loadStateGrounded, runCoherenceGate, summaryLine: coherenceSummaryLine } = await import('./coherence-gate.mjs');
    const stateGroundedParsed = loadStateGrounded(rep.jsonlFile);
    const coherenceResult = runCoherenceGate(stateGroundedParsed);
    console.log('');
    console.log(`## Coherence (state-grounded)`);
    console.log(coherenceSummaryLine(coherenceResult));
    // Honest floor across BOTH tiers: |judge fails ∪ transcript flags ∪ state-grounded flags|,
    // de-duplicated per turn. runCoherenceGate() already unions judge-fails with its
    // OWN flags (coherenceResult.honestFloor); fold the transcript tier's flagged
    // turns in too, so the printed floor is the true honest floor of everything this
    // run measured, not just the state-grounded tier's contribution.
    const stateFlaggedKeys = new Set(coherenceResult.flags.map(f => `${f.persona}::${f.turn}`));
    const judgeFailedKeys = new Set(
      stateGroundedParsed.turns
        .filter(t => (t.v1?.bug_class && t.v1.bug_class !== 'NONE') || (t.v2?.bug_class && t.v2.bug_class !== 'NONE' && t.v2.bug_class !== 'JUDGE_ERROR'))
        .map(t => `${t.persona}::${t.i}`),
    );
    const transcriptFlaggedKeys = new Set((transcriptResult.flags || []).map(f => `${f.persona}::${f.turn}`));
    const unionFloor = new Set([...judgeFailedKeys, ...stateFlaggedKeys, ...transcriptFlaggedKeys]).size;
    console.log(`HONEST FLOOR (judge ∪ transcript ∪ state-grounded, de-duped): ${unionFloor}/${coherenceResult.totalTurns}`);

    const coherenceLedger = updateCoherenceModesLedger(coherenceResult, runId);
    console.log(`CG MODES: ${coherenceLedger.modes.length} this run${coherenceLedger.modes.length ? ` (${coherenceLedger.modes.join(' · ')})` : ''} · ledger: ${path.relative(ROOT, path.join(OUT_DIR, 'coherence-modes.json'))}`);
  }
  console.log(`════════════════════════════════════════════`);
}

// Import-safe: tests import the pure pieces (deriveVerdictFromAtoms, modeSignature,
// pickIssue, mockAtoms, GATE_JUDGE_SYSTEM_V2) without triggering a run.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
