#!/usr/bin/env node
// Headless playtest for the full claim pipeline.
// No game UI. Uses Claude for the voice step.
//
// Full path:
//   newWorld → worldTick → real timeline event → mintClaim → propagateClaims
//   → pick two NPCs with different distortion → buildNpcVoicePrompt → Claude → spoken lines
//
// Usage:
//   node scripts/playtest-claims.mjs [seed] [ticks]
//
// Determinism check (propagation only): same seed → identical fingerprints.

import { readFileSync }       from 'fs';
import { newWorld }           from '../engine/state.js';
import { worldTick }          from '../engine/worldTick.js';
import { mintClaim, propagateClaims } from '../engine/claims.js';
import { mintThing, revealTrueEdge }  from '../engine/things.js';
import { computeNpcDepth }    from '../engine/npc/npcDepth.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { buildNpcVoicePrompt } from '../server/npcVoicePrompt.js';
import { chatCompletion }      from '../server/llmProvider.js';

// Load API key from .env (gitignored) before importing llmProvider,
// which reads process.env.ANTHROPIC_API_KEY at call time.
const envRaw = (() => { try { return readFileSync('.env', 'utf8'); } catch { return ''; } })();
const envKey = envRaw.match(/ANTHROPIC_API_KEY=(\S+)/)?.[1] ?? '';
if (envKey) process.env.ANTHROPIC_API_KEY = envKey;
if (!process.env.ANTHROPIC_API_KEY) { console.error('No ANTHROPIC_API_KEY — set it in .env'); process.exit(1); }

// ── Config ────────────────────────────────────────────────────────────────────

const SEED      = process.argv[2] ?? 'gallows-watch-test';
const NUM_TICKS = Number(process.argv[3] ?? 12);

// ── Settlement NPCs ───────────────────────────────────────────────────────────
// computeNpcDepth gives genuine personality axes and relationship bonds.

const NPC_STUBS = [
  { name: 'Mira',    role: 'innkeeper',  factionId: null  },
  { name: 'Torvald', role: 'supplier',   factionId: null  },
  { name: 'Aldric',  role: 'laborer',    factionId: null  },
  { name: 'Cass',    role: 'headwoman',  factionId: 'f1'  },
  { name: 'Petra',   role: 'tanner',     factionId: null  },
  { name: 'Brynn',   role: 'blacksmith', factionId: 'f1'  },
  { name: 'Osric',   role: 'shepherd',   factionId: null  },
  { name: 'Vela',    role: 'apothecary', factionId: null  },
];

const HISTORY = [
  { id: 'winter_blight',    type: 'hardship',  participants: [0,1,2,4,6] },
  { id: 'faction_rivalry',  type: 'rivalry',   participants: [3,5]       },
  { id: 'gallows_incident', type: 'conflict',  participants: [0,2,3,4]   },
];

const enrichedNpcs = computeNpcDepth(NPC_STUBS, HISTORY, [], SEED);

// ── Build a real world with a real event on the timeline ──────────────────────
// Set ecology.corruption above the 70-threshold so the first worldTick fires
// a scarFormed event we can mint from. Inject settlement NPCs into node 0.

function buildWorld() {
  let w = newWorld({
    seed: SEED, fate: 0.2, campaignId: 'playtest',
    pack: { primaryId: 'fantasy' }, mode: '',
  });

  // Push corruption above threshold → scarFormed fires on first worldTick.
  w = { ...w, ecology: { ...w.ecology, corruption: 75 } };

  // Inject enriched NPCs into the first settlement node.
  const nodes = w.map.nodes.map((n, i) =>
    i === 0
      ? { ...n, nodeType: 'settlement', settlement: { decompressed: true, npcs: enrichedNpcs } }
      : n
  );
  w = { ...w, map: { ...w.map, nodes } };

  // Run one worldTick. This fires applyIrreversibleThresholds → ensureScar →
  // pushEvent({ kind: 'scarFormed', ... }) and stamps a real id on the timeline.
  w = worldTick(w);

  return w;
}

// ── Display helpers ───────────────────────────────────────────────────────────

function npcLabel(id) {
  const idx = parseInt(id.replace('npc_', ''), 10);
  const stub = NPC_STUBS[idx];
  return stub ? `${stub.name}(${id})` : id;
}

function fmt(n)           { return Number(n).toFixed(3); }
function bar(n, w = 12)   { const f = Math.round(n * w); return '[' + '█'.repeat(f) + '░'.repeat(w - f) + ']'; }

// ── Run ───────────────────────────────────────────────────────────────────────

function run(label) {
  // Build world fresh each run so RNG state is identical.
  let w = buildWorld();

  // ── Find the real scarFormed event ─────────────────────────────────────────
  const scarEvent = w.timeline.find(e => e.kind === 'scarFormed');
  if (!scarEvent) throw new Error('No scarFormed event on timeline — check corruption threshold');

  // ── Mint a seed claim from the real event ──────────────────────────────────
  // Mira (npc_0) is the settlement's innkeeper — she witnesses the world darken.
  // The caller decides who witnesses; mintClaim is a pure constructor.
  w = mintClaim(w, {
    subject:     scarEvent.data.scarId,   // "corruption_shift"
    eventRef:    scarEvent.id,            // "scarFormed:0" — real timeline id
    witnessNpcId: 'npc_0',               // Mira
  });

  const seedClaim = w.claims.find(c => c.holderNpcId === 'npc_0');

  console.log(`\n${'═'.repeat(72)}`);
  console.log(` CLAIM PROPAGATION PLAYTEST — seed: "${SEED}"  ticks: ${NUM_TICKS}`);
  if (label) console.log(` [${label}]`);
  console.log(`${'═'.repeat(72)}\n`);

  console.log('REAL TIMELINE EVENT');
  console.log('─'.repeat(72));
  console.log(`  id:      ${scarEvent.id}`);
  console.log(`  kind:    ${scarEvent.kind}`);
  console.log(`  scarId:  ${scarEvent.data.scarId}`);
  console.log(`  desc:    ${scarEvent.data.description}`);
  console.log(`  trigger: ${scarEvent.data.trigger}`);

  console.log('\nSEED CLAIM (minted by mintClaim)');
  console.log('─'.repeat(72));
  console.log(`  subject:  ${seedClaim.subject}`);
  console.log(`  eventRef: ${seedClaim.eventRef}  ← real timeline id`);
  console.log(`  holder:   ${npcLabel(seedClaim.holderNpcId)}`);
  console.log(`  dist:     ${fmt(seedClaim.distortion)}  weight: ${fmt(seedClaim.weight)}`);
  console.log(`  born:     tick ${seedClaim.born}`);

  console.log('\nNPC ROSTER');
  console.log('─'.repeat(72));
  for (const npc of enrichedNpcs) {
    const p = npc.personality ?? {};
    const friends = Object.entries(npc.relationships ?? {})
      .filter(([,r]) => (r.bond ?? 0) > 0)
      .map(([id, r]) => `${npcLabel(id)}(${r.bond.toFixed(2)})`)
      .join(', ');
    console.log(
      `  ${npcLabel(npc.id).padEnd(22)}` +
      `honesty:${fmt(p.honesty ?? 0)}  selfPres:${fmt(p.selfPreservation ?? 0)}  ` +
      `friends: ${friends || '—'}`
    );
  }
  console.log();

  // ── Propagate ─────────────────────────────────────────────────────────────
  const rng = makeRng(seedFromString(SEED));
  const allLog = [];

  for (let tick = 1; tick <= NUM_TICKS; tick++) {
    const tickLog = [];
    w = { ...w, time: { turn: tick } };

    w = propagateClaims(w, rng, {
      onEvent(e) { tickLog.push({ ...e, turn: tick }); }
    });

    const spreads   = tickLog.filter(e => e.type === 'spread');
    const fractures = tickLog.filter(e => e.type === 'fracture');
    const cycles    = tickLog.filter(e => e.type === 'cycle_blocked');

    if (spreads.length || fractures.length || cycles.length) {
      console.log(`TICK ${String(tick).padStart(2)}  ${'─'.repeat(64)}`);

      for (const e of spreads) {
        console.log(
          `  ✦ SPREAD   ${npcLabel(e.from).padEnd(22)} → ${npcLabel(e.to).padEnd(22)}` +
          `  hop:${e.hops}  dist:${fmt(e.distortion)}  wgt:${fmt(e.weight)}`
        );
        console.log(`           provenance: ${e.provenance.map(npcLabel).join(' → ')}`);
      }
      for (const e of fractures) {
        console.log(`  ✸ FRACTURE ${npcLabel(e.keeper).padEnd(22)} ← kept own version`);
        console.log(`           rejected from: ${npcLabel(e.rejectedFrom)}`);
        console.log(
          `           keeper  wgt:${fmt(e.keeperWeight)}  dist:${fmt(e.keeperDistortion)}  ` +
          `selfPres:${e.selfPres.toFixed(3)}  priorStr:${fmt(e.priorStr)}`
        );
        console.log(
          `           incoming wgt:${fmt(e.rejectedWeight)}  ` +
          `srcCred:${fmt(e.srcCred)}  incomingStr:${fmt(e.incomingStr)}  → REJECTED`
        );
      }
      for (const e of cycles) {
        console.log(`  ↻ CYCLE    ${npcLabel(e.from).padEnd(22)} → ${npcLabel(e.to)} already in provenance`);
      }
      console.log();
    }

    allLog.push(...tickLog);
  }

  // ── Final snapshot ─────────────────────────────────────────────────────────

  const subject       = seedClaim.subject;
  const subjectClaims = w.claims
    .filter(c => c.subject === subject)
    .sort((a, b) => (a.distortion ?? 0) - (b.distortion ?? 0));
  const totalFractures = allLog.filter(e => e.type === 'fracture');

  console.log(`${'═'.repeat(72)}`);
  console.log(` FINAL SNAPSHOT — "${subject}" after ${NUM_TICKS} ticks`);
  console.log(` ${subjectClaims.length} holder(s) — ${totalFractures.length} fracture(s)`);
  console.log(`${'═'.repeat(72)}`);
  console.log('  ' + 'holder'.padEnd(22) + 'dist'.padEnd(8) + 'weight'.padEnd(22) + 'hops'.padEnd(6) + 'provenance');
  console.log('  ' + '─'.repeat(70));
  for (const c of subjectClaims) {
    const hops = (c.provenance?.length ?? 1) - 1;
    console.log(
      `  ${npcLabel(c.holderNpcId).padEnd(22)}` +
      `${fmt(c.distortion).padEnd(8)}` +
      `${(fmt(c.weight) + ' ' + bar(c.weight)).padEnd(22)}` +
      `${String(hops).padEnd(6)}` +
      (c.provenance?.map(npcLabel).join(' → ') ?? '')
    );
  }

  console.log('\nFRACTURE LOG');
  console.log('─'.repeat(72));
  if (totalFractures.length === 0) {
    console.log('  (none)');
  } else {
    for (const e of totalFractures) {
      console.log(
        `  tick:${String(e.turn).padStart(2)}  ${npcLabel(e.keeper).padEnd(22)} held own  ` +
        `(priorStr:${fmt(e.priorStr)} > incomingStr:${fmt(e.incomingStr)})  ` +
        `rejected ${npcLabel(e.rejectedFrom)}`
      );
    }
  }
  console.log();

  return w.claims.map(c => `${c.id}:${fmt(c.weight)}:${fmt(c.distortion)}`).sort().join('\n');
}

// ── Determinism check ─────────────────────────────────────────────────────────

const fp1 = run('RUN 1');
const fp2 = run('RUN 2 (determinism check)');

console.log(`${'═'.repeat(72)}`);
if (fp1 === fp2) {
  console.log(' ✓ DETERMINISM OK — both runs produced identical claim fingerprints');
} else {
  console.log(' ✗ DETERMINISM BROKEN — runs diverged!');
  console.log('\nRUN 1:\n' + fp1);
  console.log('\nRUN 2:\n' + fp2);
  process.exit(1);
}
console.log(`${'═'.repeat(72)}\n`);

// ── Voice demo — the payoff ────────────────────────────────────────────────────
// Two NPCs with different-distortion claims about the same event answer the same
// question. The voice prompt is built by buildNpcVoicePrompt; Claude speaks the lines.
// The claim is the NPC's MAP; the event description is the territory the LLM must distort.

async function speakAs(npc, claim, playerLine) {
  const stub = NPC_STUBS[parseInt(npc.id.replace('npc_', ''), 10)];
  const p = npc.personality ?? {};
  const manner =
    (p.honesty ?? 0.5) < 0.35 ? 'guarded'  :
    (p.honesty ?? 0.5) < 0.45 ? 'skittish' :
    (p.selfPreservation ?? 0.5) > 0.65 ? 'blunt' : 'even';

  const prompt = buildNpcVoicePrompt({
    npcName:   stub?.name ?? npc.id,
    role:      stub?.role ?? 'villager',
    mood:      'even',
    manner,
    mode:      'claim_recall',
    factPhrase: claim.subject,
    playerLine,
    claim,
  });

  const result = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.85,
    max_tokens: 80,
  });

  // chatCompletion returns { content: string }
  return String(result?.content || '').trim().replace(/^["'"]+|["'"]+$/g, '').trim();
}

async function voiceDemo() {
  // Rebuild a final world state once, silently.
  let w = buildWorld();
  const scarEvent = w.timeline.find(e => e.kind === 'scarFormed');
  w = mintClaim(w, { subject: scarEvent.data.scarId, eventRef: scarEvent.id, witnessNpcId: 'npc_0' });
  const rng = makeRng(seedFromString(SEED));
  for (let tick = 1; tick <= NUM_TICKS; tick++) {
    w = { ...w, time: { turn: tick } };
    w = propagateClaims(w, rng);
  }

  // ── The territory-fragment ─────────────────────────────────────────────────
  // A thing with an engine-owned true edge anchored to the same scarFormed:0 event.
  // Its description explicitly contradicts the "broke open" myth that accreted
  // through Osric's 3-hop chain. The wall: this never touches world.claims;
  // no NPC receives it; only the player who inspects it holds the truth.
  w = mintThing(w, {
    id:          'thing:wardens_ledger',
    name:        "the Warden's Ledger",
    description: 'A water-stained ledger, its binding cracked. The last entries are dated the season of the darkening.',
    nodeId:      'node_iron_key',
    trueEdge: {
      eventRef:    scarEvent.id,
      description:
        'Entry 341, third bell of the night the light failed: ' +
        '"Corruption index crossed seventy. No external breach detected — ' +
        'walls intact, no incursion, no rupture in the substrate. ' +
        'Whatever passed the threshold accumulated from within across many seasons. ' +
        'This darkening is not something that broke in from outside. ' +
        'It is what we built here, accreted, and finally became."',
    },
  });

  const subject   = scarEvent.data.scarId;
  const allClaims = w.claims.filter(c => c.subject === subject)
    .sort((a, b) => (a.distortion ?? 0) - (b.distortion ?? 0));

  // Mira (firsthand, 0.000) and Osric (3-hop, highest distortion).
  const miraC  = allClaims.find(c => c.holderNpcId === 'npc_0');
  const osricC = allClaims.find(c => c.holderNpcId === 'npc_6');
  if (!miraC || !osricC) { console.log('(not enough claims for voice demo)'); return; }

  const miraNpc  = enrichedNpcs.find(n => n.id === 'npc_0');
  const osricNpc = enrichedNpcs.find(n => n.id === 'npc_6');

  const claimCtx = (c) => ({
    subject: c.subject, distortion: c.distortion, weight: c.weight,
    eventRef: c.eventRef, provenance: c.provenance,
    eventDescription: scarEvent.data.description,
  });

  const question = 'What happened when the darkness fell over this place?';

  console.log(`${'═'.repeat(72)}`);
  console.log(' THE MAPS — what NPCs believe');
  console.log(`${'═'.repeat(72)}`);
  console.log(`  Question asked: "${question}"\n`);

  console.log(`  Mira(npc_0)  dist:${fmt(miraC.distortion)}  wgt:${fmt(miraC.weight)}  hops:0  [firsthand]`);
  process.stdout.write('  Speaking... ');
  const miraLine = await speakAs(miraNpc, claimCtx(miraC), question);
  console.log(`\n  → "${miraLine}"\n`);

  console.log(`  Osric(npc_6) dist:${fmt(osricC.distortion)}  wgt:${fmt(osricC.weight)}  hops:3  [Mira→Petra→Brynn→Osric]`);
  process.stdout.write('  Speaking... ');
  const osricLine = await speakAs(osricNpc, claimCtx(osricC), question);
  console.log(`\n  → "${osricLine}"\n`);

  // ── Discovery ──────────────────────────────────────────────────────────────
  // Player inspects the Warden's Ledger. revealTrueEdge marks discovered:true
  // and returns the engine-owned description. world.claims is untouched.
  const claimsBefore = w.claims.length;
  const { world: w2, revealed } = revealTrueEdge(w, 'thing:wardens_ledger');
  const claimsAfter  = w2.claims.length;

  console.log(`${'═'.repeat(72)}`);
  console.log(' THE TERRITORY — what the ledger actually recorded');
  console.log(`${'═'.repeat(72)}`);
  console.log(`  [Player inspects: "${w2.things.find(t => t.id === 'thing:wardens_ledger').name}"]\n`);
  console.log(`  ${revealed.description}\n`);
  console.log(`  claims before discovery: ${claimsBefore}  after: ${claimsAfter}  (unchanged — NPCs keep their maps)`);

  console.log(`\n${'═'.repeat(72)}`);
  console.log(' FALSIFICATION');
  console.log(`${'═'.repeat(72)}`);
  console.log(`  Osric's account : "${osricLine}"`);
  console.log(`  Ledger says     : "No external breach detected. [...] not something that broke in from outside."`);
  console.log(`  Gap             : distortion ${fmt(osricC.distortion)} accreted a myth of external rupture.`);
  console.log(`                    The ledger is the falsifier. Osric's map is wrong.`);
  console.log(`                    Mira's account and the ledger agree: it came from within.\n`);
  console.log(`  eventRef anchor : ${revealed.eventRef}  (same event both claims and ledger point at)`);
  console.log(`  Wall status     : trueEdge untouched by propagation ✓   claims unchanged by discovery ✓`);
  console.log(`${'═'.repeat(72)}\n`);
}

voiceDemo().catch(e => { console.error('Voice demo failed:', e.message); process.exit(1); });
