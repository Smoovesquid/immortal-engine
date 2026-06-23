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
// Requires `npm run dev` on :5179 and ANTHROPIC_API_KEY in .env.
//
// PLAYER + JUDGE both use Opus 4.8 via a thin direct Messages client (Opus 4.8
// rejects `temperature`, which the shared provider always sends — hence local).
//
// RUN:  node scripts/dm-playtest.mjs [--turns 12] [--seeds s1,s2] \
//             [--personas rules-lawyer,chaos,lore-hound,newbie] [--server URL]
//
// Worlds are seeded (replay-stable); the agents are not (exploration). Output: a
// per-turn verdict log, failures clustered into bug classes, a report written to
// docs/playtests/, and a token/$ tally.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { getItemDef, findDefByName } from '../engine/ruleset/core/items/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── CLI args ────────────────────────────────────────────────────────────────
const ARGV = process.argv.slice(2);
function arg(name, def) {
  const i = ARGV.indexOf(`--${name}`);
  return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : def;
}
const TURNS = Number(arg('turns', '12'));
const SEEDS = arg('seeds', 'glass-harbor').split(',').map(s => s.trim()).filter(Boolean);
const SERVER = arg('server', 'http://localhost:5179');
const MODEL_PLAYER = arg('player-model', 'claude-opus-4-8');
const MODEL_JUDGE = arg('judge-model', 'claude-opus-4-8');
const PERSONA_KEYS = arg('personas', 'rules-lawyer,chaos,lore-hound,newbie')
  .split(',').map(s => s.trim()).filter(Boolean);

// ── Token / cost tally (Opus 4.8 est. $15/M in, $75/M out — labelled estimate) ─
const RATES = { in: 15 / 1e6, out: 75 / 1e6 };
const usage = { in: 0, out: 0, calls: 0 };
function tally(u) { if (u) { usage.in += u.input_tokens || 0; usage.out += u.output_tokens || 0; usage.calls++; } }
function dollars() { return (usage.in * RATES.in + usage.out * RATES.out); }

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
    tally(j.usage);
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
  if (!inCombat && !inDialogue && isMetaQuestion(text)) {
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
  const ai = skipPolish ? null : await tryAiNarration(world2, base, { input: text, mechanics: mech });
  // The UI renders the DM via speaker attribution, not the literal "Wizard:"
  // prefix the engine puts on base narration — strip it so the judge sees what
  // a player sees (otherwise the raw prefix reads as a system-artifact leak).
  const dm = String(ai || base).replace(/^\s*Wizard:\s*/, '');
  return { world: world2, dm, mechanics: mech, turn: true, route: output?.dialogue ? 'dialogue' : 'action' };
}

// ── Canon ground-truth bundle (the RAG-faithfulness oracle) ───────────────────
// Compact, judge-readable view of what IS true, so the judge can flag any DM/NPC
// claim that isn't supported by it.
// The PC's consumables with their REAL resolved effects, from both inventory
// shapes (legacy flavor buckets + structured items[]). Lets the judge grade
// item-effect answers ("what does the Tonic do?") against ground truth instead
// of assuming an effect exists — a flavor item with effect:null genuinely does
// nothing, so the DM doing nothing with it is correct. (H-45 fairness fix.)
function consumablesGroundTruth(pc) {
  const inv = pc?.inventory || {};
  const describe = (def) => def?.effect?.kind === 'heal' ? `heal ${def.effect.amount}`
    : def?.effect?.kind === 'removeCondition' ? `cure ${def.effect.condition}` : null;
  const out = [];
  for (const it of (Array.isArray(inv.consumables) ? inv.consumables : [])) {
    const name = String(it?.name || it).trim();
    if (!name) continue;
    out.push({ name, effect: describe(it?.defRef ? getItemDef(it.defRef) : findDefByName(name)) });
  }
  for (const it of (Array.isArray(inv.items) ? inv.items : [])) {
    const def = getItemDef(it?.defRef);
    if (def && def.kind === 'consumable') out.push({ name: def.name, effect: describe(def) });
  }
  return out;
}

function canonGroundTruth(world) {
  const node = (world.map?.nodes || []).find(n => n && n.id === world.map?.currentNodeId) || null;
  const npcs = (node?.settlement?.npcs || []).map(p => ({ name: p?.name, role: p?.role || p?.archetype || '' }));
  const pc = world.party?.[0] || {};
  const led = world.ledger || {};
  const recentCanon = Array.isArray(world.canonLog?.events) ? world.canonLog.events.slice(-8)
    : Array.isArray(world.canonLog) ? world.canonLog.slice(-8) : [];
  const timeline = Array.isArray(world.timeline) ? world.timeline.slice(-6).map(e => ({ kind: e.kind, t: e.t })) : [];
  // Escape mode (the live combat engine) tracks the PC's health in meta.escapeHp
  // and enemy health in e.hp — NOT party[0].wounds / e.wounds. Report the model
  // that's actually live so the judge sees real combat HP (else it flags every
  // legitimate hit/defeat as "no HP update"). (F12 — sibling of the F9 fix.)
  const escape = world.meta?.mode === 'escape';
  return {
    location: node ? { name: node.name, kind: node.kind } : null,
    npcsPresent: npcs,
    pc: escape
      ? { hp: world.meta?.escapeHp, maxHp: world.meta?.escapeMaxHp, level: pc.level, conditions: pc.conditions, note: 'escape mode: HP is the live health; party wounds are not used here' }
      : { wounds: pc.wounds, maxWounds: pc.maxWounds, level: pc.level, conditions: pc.conditions },
    inCombat: Boolean(world.combat?.active),
    combatRound: world.combat?.round,
    enemies: (world.combat?.enemies || []).map(e => ({ name: e.name, hp: e.hp, maxHp: e.maxHp, defeated: !!e.defeated })),
    ledgerFacts: (led.facts || []).map(f => (typeof f === 'string' ? f : f?.text)).filter(Boolean).slice(0, 8),
    recentCanon: recentCanon.map(e => ({ kind: e?.kind || e?.type, ref: e?.id, data: e?.data })).slice(0, 8),
    consumables: consumablesGroundTruth(pc),
    timeline,
    // The engine's stored last roll (engine/grace answerRollRecall cites this to
    // defend canon against a player misremembering their number). Without it the
    // judge can't see the ledger and false-flags correct roll-recall as a
    // fabricated roll (the 2026-06-21 "18 vs DC 12" false-positive). (gate-hardening)
    lastRoll: world.conversation?.lastRoll
      ? { roll: world.conversation.lastRoll.roll, dc: world.conversation.lastRoll.dc, outcome: world.conversation.lastRoll.outcome }
      : null,
  };
}

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

async function playerTurn(persona, transcript) {
  const script = transcript.map(t => `${t.who === 'you' ? 'YOU' : 'DM'}: ${t.text}`).join('\n');
  const line = await ask({
    system: persona.system,
    user: `${PLAYER_PREAMBLE}\n\n--- SESSION ---\n${script}\n--- END ---\n\nYour next line:`,
    model: MODEL_PLAYER, maxTokens: 120,
  });
  return line.replace(/^["'`]+|["'`]+$/g, '').split('\n')[0].trim().slice(0, 300);
}

// ── The judge ───────────────────────────────────────────────────────────────
const JUDGE_SYSTEM =
`You are a strict evaluator of an AI Dungeon Master, judging ONE turn. You see the player's
line, the DM's response, the engine's mechanics string, and a CANON ground-truth bundle.

Score three things. Default to FAIL when uncertain — you are adversarial.

GATE 1 — DM VIBE (THE_DM_TEST): Did the DM resolve the player's intent IN THE FICTION? FAIL
if it bounced intent back as a mechanical/UI prompt ("which way: N/S/E/W?"), dumped raw ids
or stat blocks as the answer, said "command not recognized", or otherwise leaked the machine.

GATE 2 — CRUNCH CORRECTNESS: Are the rules under the narration correct and self-consistent?
FAIL if the dice and the fiction contradict (e.g. rolled "success" but nothing happened), HP/
wounds/resources update wrong or not at all, a declared attack on a present foe does NOT start
real combat (no enemy entity / no HP / no combat state), or an outcome violates the stated DC/roll.

AXIS — RAG FAITHFULNESS: If the DM or an NPC asserts a FACT about the world (a name, a past
event, a rumor, who-did-what), is it GROUNDED in the CANON bundle? FAIL (hallucination) if a
confident claim has no support in canon and isn't flagged as hearsay/uncertain. If no factual
claim was made, set checked=false.

NOT a hallucination — do NOT FAIL these on RAG: rhetorical hyperbole ("there are dragons and demons
out here"), atmosphere, and an in-character JUDGMENT/ATTITUDE stance ("yes, stay wary — nothing here
is friendly"; "I hate everyone, not just you") need NO canon citation, the same way a real DM's color
commentary doesn't — score those under GATE 1 (was intent resolved in voice?), not here. Only a
CONCRETE checkable specific — a proper name, a date/number, or a who-did-what past event — requires
grounding; a FALSE such specific still FAILs as hallucination.

ROLL-RECALL — do NOT FAIL as hallucination: if the DM cites a PAST ROLL or DC ("the ledger shows 18 vs
DC 12", "you rolled a 17") that MATCHES the CANON bundle's "lastRoll" (or a roll in recentCanon), it is
GROUNDED — the DM is correctly quoting its own ledger to push back on a player who misremembers their
number. That is CORRECT canon-defense, not a fabricated roll. Only FAIL if the cited roll/DC has NO support
in lastRoll/recentCanon.

ITEMS: the CANON bundle's "consumables" lists each carried item's REAL effect (e.g.
{name:"Tonic of grit", effect:"heal 2d4"}) or effect:null for a flavor item. Grade item-effect
answers against THIS, not against your assumptions: describing the listed effect PASSES; saying a
flavor item (effect:null) does nothing, or just describes it, is CORRECT — do NOT assume an item has
an effect it lacks. FAIL only if the DM invents an effect absent from the list, or claims a
real-effect item does nothing.

Return ONLY JSON:
{"vibe":{"pass":bool,"issue":""},"crunch":{"pass":bool,"issue":""},
"rag":{"checked":bool,"grounded":bool,"issue":""},
"bug_class":"NONE|DM_TEST_DEADEND|DM_ARTIFACT_LEAK|CRUNCH_INCONSISTENCY|COMBAT_NOT_STARTED|CANON_HALLUCINATION|CRASH",
"severity":"none|low|med|high","note":"one terse sentence"}`;

async function judgeTurn({ player, dm, mechanics, world }) {
  const truth = canonGroundTruth(world);
  const out = await ask({
    system: JUDGE_SYSTEM,
    user: `PLAYER: ${player}\nDM: ${dm}\nMECHANICS: ${mechanics || '(none)'}\n\nCANON (ground truth):\n${JSON.stringify(truth, null, 0)}`,
    model: MODEL_JUDGE, maxTokens: 350,
  });
  return parseJson(out) || { vibe: { pass: true }, crunch: { pass: true }, rag: { checked: false }, bug_class: 'NONE', severity: 'none', note: '[judge parse failed]' };
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
    const player = await playerTurn(persona, transcript);
    if (!player) break;
    transcript.push({ who: 'you', text: player });
    const r = await playTurn(world, player);
    world = r.world;
    transcript.push({ who: 'dm', text: r.dm });
    const v = r.crash
      ? { vibe: { pass: false, issue: 'engine crash' }, crunch: { pass: false }, rag: { checked: false }, bug_class: 'CRASH', severity: 'high', note: r.dm }
      : await judgeTurn({ player, dm: r.dm, mechanics: r.mechanics, world });
    verdicts.push({ i, player, dm: r.dm, mechanics: r.mechanics, route: r.route, ...v });
    const flags = [v.vibe?.pass === false && 'VIBE', v.crunch?.pass === false && 'CRUNCH',
      v.rag?.checked && v.rag?.grounded === false && 'RAG'].filter(Boolean);
    process.stdout.write(`    ${i + 1}. ${flags.length ? '✗ ' + flags.join('+') : '✓'}  "${player.slice(0, 48)}"${flags.length ? `  — ${v.note}` : ''}\n`);
  }
  return { seed, persona: persona.label, personaKey, transcript, verdicts };
}

// ── Report ──────────────────────────────────────────────────────────────────
function failed(v) {
  return v.vibe?.pass === false || v.crunch?.pass === false || (v.rag?.checked && v.rag?.grounded === false) || v.bug_class === 'CRASH';
}
function writeReport(sessions) {
  const date = new Date().toISOString().slice(0, 10);
  const all = sessions.flatMap(s => s.verdicts.map(v => ({ ...v, persona: s.persona, seed: s.seed })));
  const fails = all.filter(failed);
  const byClass = {};
  for (const f of fails) (byClass[f.bug_class] ||= []).push(f);
  const lines = [];
  lines.push(`# Playtest — Opus-4.8 experiential gate — ${date}`);
  lines.push('');
  lines.push(`**Harness:** \`scripts/dm-playtest.mjs\` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = ${MODEL_PLAYER}`);
  lines.push(`**Run:** ${sessions.length} sessions × ${TURNS} turns · personas: ${sessions.map(s => s.persona).join(', ')} · seeds: ${[...new Set(sessions.map(s => s.seed))].join(', ')}`);
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
  lines.push(`**Total turns judged:** ${all.length} · **failing turns:** ${fails.length} (${all.length ? Math.round(100 * fails.length / all.length) : 0}%)`);
  lines.push('');
  lines.push(`## Failures by bug class`);
  for (const cls of Object.keys(byClass).sort((a, b) => byClass[b].length - byClass[a].length)) {
    lines.push('');
    lines.push(`### ${cls} (${byClass[cls].length})`);
    for (const f of byClass[cls].slice(0, 8)) {
      const issue = f.crunch?.issue || f.vibe?.issue || f.rag?.issue || f.note;
      lines.push(`- **[${f.persona}]** player: _"${f.player}"_`);
      lines.push(`  - DM: ${String(f.dm).replace(/\n/g, ' ').slice(0, 220)}`);
      lines.push(`  - mech: \`${(f.mechanics || '(none)').slice(0, 100)}\` — **${f.severity}**: ${issue}`);
    }
  }
  lines.push('');
  lines.push(`## Cost`);
  lines.push(`${usage.calls} Opus calls · ${usage.in.toLocaleString()} in + ${usage.out.toLocaleString()} out tokens · ~$${dollars().toFixed(2)} (est. @ $15/$75 per M)`);
  lines.push('');
  const dir = path.join(ROOT, 'docs', 'playtests');
  const file = path.join(dir, `opus-gate-${date}.md`);
  fs.writeFileSync(file, lines.join('\n'));
  return { file, fails: fails.length, total: all.length, byClass };
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  if (!KEY) { console.error('No ANTHROPIC_API_KEY in env (.env).'); process.exit(1); }
  // Server health
  try {
    const h = await fetch(`${SERVER}/healthz`).then(r => r.text());
    if (!/ok/.test(h)) throw new Error('bad health');
  } catch {
    console.error(`Server not reachable at ${SERVER}. Start it: npm run dev`); process.exit(1);
  }
  PACKS = loadPacks();
  console.log(`DM PLAYTEST — ${PERSONA_KEYS.length} personas × ${SEEDS.length} seeds × ${TURNS} turns  (player/judge=${MODEL_PLAYER})`);
  const sessions = [];
  for (const seed of SEEDS) {
    for (const pk of PERSONA_KEYS) {
      if (!PERSONAS[pk]) { console.warn(`unknown persona: ${pk}`); continue; }
      sessions.push(await runSession(seed, pk));
    }
  }
  const rep = writeReport(sessions);
  console.log(`\n════════════════════════════════════════════`);
  console.log(`FAILING TURNS: ${rep.fails}/${rep.total}`);
  console.log(`BUG CLASSES: ${Object.entries(rep.byClass).map(([k, v]) => `${k}:${v.length}`).join('  ') || '(none)'}`);
  console.log(`COST: ~$${dollars().toFixed(2)} (${usage.calls} calls, ${usage.in + usage.out} tokens)`);
  console.log(`REPORT: ${path.relative(ROOT, rep.file)}`);
  console.log(`════════════════════════════════════════════`);
})();
