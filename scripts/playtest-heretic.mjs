#!/usr/bin/env node
// Headless playtest for the heretic thread.
//
// Shows the Lingerer (heretic: true) answering the same question two ways:
//   1. Unmarked player — mode: claim_recall at near-floor weight / max
//      distortion. She sounds like a dismissed crank.
//   2. Marked player   — mode: vision_recognition. She recognizes a
//      fellow witness. She says only: you saw it too.
//
// Neither response crosses into explanation. Confirm that in the output.
//
// Usage:  node scripts/playtest-heretic.mjs

import { readFileSync } from 'fs';
import { newWorld }     from '../engine/state.js';
import { beginAdventure, FOUNDATION_EVENT_ID } from '../engine/playloop.js';
import { mintClaim }    from '../engine/claims.js';
import { buildNpcVoicePrompt } from '../server/npcVoicePrompt.js';
import { chatCompletion }      from '../server/llmProvider.js';

const envRaw = (() => { try { return readFileSync('.env', 'utf8'); } catch { return ''; } })();
const envKey = envRaw.match(/ANTHROPIC_API_KEY=(\S+)/)?.[1] ?? '';
if (envKey) process.env.ANTHROPIC_API_KEY = envKey;
if (!process.env.ANTHROPIC_API_KEY) { console.error('No ANTHROPIC_API_KEY — set it in .env'); process.exit(1); }

// ── The Lingerer — the heretic NPC ────────────────────────────────────────────

const LINGERER = {
  id:      'npc_lingerer',
  name:    'the Lingerer',
  role:    'wanderer',
  heretic: true,        // the gate flag — enables vision_recognition mode
  personality: { honesty: 0.55, selfPreservation: 0.3 },
};

const MINIMAL_PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords:       { cooperative: ['still'], grim: ['heavy'], blood: ['forsaken'] },
    starterLocations: ['the road into town'],
    starterObjectives: ['see where the road leads'],
    skills:          ['Wits'],
    locations:       ['the road'],
    objectives:      ['survive'],
    complications:   ['nothing is what it seems'],
    npcArchetypes:   ['wanderer who asks too many questions'],
    sensoryMotifs:   ['a sound like chewing, very far away, very slow'],
  }
};

// ── World + claim setup ───────────────────────────────────────────────────────

function buildWorld({ marked } = {}) {
  let w = beginAdventure(
    newWorld({ seed: 'heretic-demo', fate: 0.3, campaignId: 'heretic-demo',
      pack: { primaryId: 'fantasy', mixerId: null } }),
    MINIMAL_PACKS
  ).world;

  // Seed the foundation stub event — the anchor both claim and trueEdge point at.
  w = { ...w, timeline: [
    { id: FOUNDATION_EVENT_ID, kind: 'foundation', t: -1, data: { sealed: true } },
    ...w.timeline,
  ]};

  // Mint the heretic's claim: max distortion, 1.0 initial weight (decays fast
  // via propagateClaims — after a few hops it's near-floor and mostly dead).
  // Subject deliberately vague-sounding ("the_shallow_past") — indistinguishable
  // from a crank obsession to any NPC who hears the garbled version.
  w = mintClaim(w, {
    subject:           'the_shallow_past',
    eventRef:          FOUNDATION_EVENT_ID,
    witnessNpcId:      LINGERER.id,
    initialDistortion: 0.92,
  });

  // Set vision mark if requested.
  if (marked) {
    const party = Array.isArray(w.party) ? [...w.party] : [];
    if (party[0]) party[0] = { ...party[0], marks: ['vision:root'] };
    w = { ...w, party };
  }

  return w;
}

// ── Mode resolution — mirrors askNpc's claim-channel logic ───────────────────
// We reproduce only the gate decision here (not the full dialogue loop)
// so the harness is self-contained and fast.

function resolveMode(w, npc) {
  const claim = (w.claims || []).find(c => c.holderNpcId === npc.id);
  if (!claim) return { mode: 'deflected', claim: null };

  const marks = Array.isArray(w.party?.[0]?.marks) ? w.party[0].marks : [];
  const marked = marks.includes('vision:root');

  if (npc.heretic && marked) return { mode: 'vision_recognition', claim };
  return { mode: 'claim_recall', claim };
}

// ── Voice call ────────────────────────────────────────────────────────────────

async function speakAs(npc, mode, claim, w, playerLine) {
  const eventRef = claim?.eventRef ?? null;
  const event    = eventRef ? (w.timeline ?? []).find(e => e.id === eventRef) : null;
  const claimCtx = claim ? {
    subject:          claim.subject,
    distortion:       claim.distortion ?? 0,
    weight:           claim.weight     ?? 1,
    eventRef,
    provenance:       claim.provenance ?? [],
    eventDescription: event?.data?.description ?? event?.data?.text ?? null,
  } : null;

  const prompt = buildNpcVoicePrompt({
    npcName:    npc.name,
    role:       npc.role,
    mood:       'even',
    manner:     'skittish',    // she's been laughed at for years
    mode,
    factPhrase: claim?.subject ?? '',
    playerLine,
    claim:      claimCtx,
  });

  const result = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.85,
    max_tokens: 80,
  });

  return String(result?.content || '').trim().replace(/^["'"]+|["'"]+$/g, '').trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const question = 'What do you mean when you say the past is shallow?';

  const wUnmarked = buildWorld({ marked: false });
  const wMarked   = buildWorld({ marked: true });

  const { mode: modeU, claim: claimU } = resolveMode(wUnmarked, LINGERER);
  const { mode: modeM, claim: claimM } = resolveMode(wMarked,   LINGERER);

  const heldClaim = wUnmarked.claims.find(c => c.holderNpcId === LINGERER.id);

  console.log(`${'═'.repeat(72)}`);
  console.log(' HERETIC THREAD DEMO — "the Lingerer"');
  console.log(`${'═'.repeat(72)}`);
  console.log(`  heretic: true   |   subject: ${heldClaim?.subject}`);
  console.log(`  eventRef: ${heldClaim?.eventRef}  (shared with witness-object)`);
  console.log(`  distortion: ${(heldClaim?.distortion ?? 0).toFixed(3)}   weight: ${(heldClaim?.weight ?? 0).toFixed(3)}`);
  console.log(`  question: "${question}"\n`);

  console.log(`${'─'.repeat(72)}`);
  console.log(` UNMARKED PLAYER — mode: ${modeU}`);
  console.log(`  (player has not taken the plant; she reads as a crank)`);
  process.stdout.write('  Speaking... ');
  const lineUnmarked = await speakAs(LINGERER, modeU, claimU, wUnmarked, question);
  console.log(`\n  → "${lineUnmarked}"\n`);

  console.log(`${'─'.repeat(72)}`);
  console.log(` MARKED PLAYER — mode: ${modeM}`);
  console.log(`  (player carries vision:root; she recognizes the fellow witness)`);
  process.stdout.write('  Speaking... ');
  const lineMarked = await speakAs(LINGERER, modeM, claimM, wMarked, question);
  console.log(`\n  → "${lineMarked}"\n`);

  console.log(`${'═'.repeat(72)}`);
  console.log(' WALL CHECK');
  console.log(`${'═'.repeat(72)}`);

  const forbidden = [
    'because', 'the reason', 'it means', 'what happened',
    'machines', 'code', 'shapes', 'cycle', 'reset', 'truth',
    'explain', 'the answer', 'I believe', 'I think it',
  ];

  let crossings = 0;
  for (const word of forbidden) {
    if (lineMarked.toLowerCase().includes(word)) {
      console.log(`  ✗ CROSSED — recognition response contains: "${word}"`);
      crossings++;
    }
  }
  if (crossings === 0) {
    console.log('  ✓ recognition response contains no explanation, decoding, or theory');
  }

  const claimsAfter = wMarked.claims.length;
  const claimsBefore = wUnmarked.claims.length;
  console.log(`  claims before/after mark: ${claimsBefore} / ${claimsAfter}  (unchanged — mark is player-side only)`);
  console.log(`  eventRef shared with U140 object: ${heldClaim?.eventRef === FOUNDATION_EVENT_ID ? '✓' : '✗'}`);
  console.log(`${'═'.repeat(72)}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
