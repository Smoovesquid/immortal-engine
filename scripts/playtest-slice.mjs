#!/usr/bin/env node
// End-to-end slice walkthrough — "The First Aperture"
//
// Four beats, in order:
//   1. ARRIVE    — warm, devout, ordinary town. The plant is here.
//   2. VISION    — eat the pale root. Raw contact. [vision:raw] text renders
//                  verbatim; mechanics confirms the wall held.
//   3. HERETIC   — return to the Lingerer. She recognizes the mark.
//                  vision_recognition mode — no explanation, no decoding.
//   4. OBJECT    — examine the witness-object. The shard is now legible.
//                  [reveal:true-edge] text renders verbatim; one piece of
//                  town belief is quietly falsified.
//
// The heretic and the shard both point at FOUNDATION_EVENT_ID — the
// three-way convergence is mechanical, not just thematic.
//
// Usage: node scripts/playtest-slice.mjs

import { readFileSync } from 'fs';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove, FOUNDATION_EVENT_ID, VISION_TEXT } from '../engine/playloop.js';
import { mintThing } from '../engine/things.js';
import { mintClaim } from '../engine/claims.js';
import { buildNpcVoicePrompt } from '../server/npcVoicePrompt.js';
import { chatCompletion } from '../server/llmProvider.js';

const envRaw = (() => { try { return readFileSync('.env', 'utf8'); } catch { return ''; } })();
const envKey = envRaw.match(/ANTHROPIC_API_KEY=(\S+)/)?.[1] ?? '';
if (envKey) process.env.ANTHROPIC_API_KEY = envKey;
if (!process.env.ANTHROPIC_API_KEY) { console.error('No ANTHROPIC_API_KEY — set it in .env'); process.exit(1); }

// ── NPC voice call ────────────────────────────────────────────────────────────

async function speak(name, role, mode, claimCtx, playerLine) {
  const prompt = buildNpcVoicePrompt({
    npcName:    name,
    role,
    mood:       'even',
    manner:     'skittish',
    mode,
    factPhrase: claimCtx?.subject ?? '',
    playerLine,
    claim:      claimCtx,
  });
  const result = await chatCompletion({
    messages:    [{ role: 'user', content: prompt }],
    model:       'claude-haiku-4-5-20251001',
    temperature: 0.85,
    max_tokens:  80,
  });
  return String(result?.content || '').trim().replace(/^["'"]+|["'"]+$/g, '').trim();
}

// ── World setup ───────────────────────────────────────────────────────────────

const MINIMAL_PACK = {
  fantasy: {
    id: 'fantasy',
    toneWords:        { cooperative: ['still'], grim: ['heavy'], blood: ['forsaken'] },
    starterLocations: ['the first-settlement, a small devout town in the Hallowed Reaches'],
    starterObjectives: ['see where the road leads'],
    skills:           ['Wits'],
    locations:        ['the road'],
    objectives:       ['survive'],
    complications:    ['nothing is what it seems'],
    npcArchetypes:    ['wanderer who asks too many questions'],
    sensoryMotifs:    ['a sound like chewing, very far away, very slow'],
  }
};

const SHARD_TEXT =
  'It is not metal and not stone. It is a sphere of something held in the shape of a sphere by nothing you can see — dark and clear at once, like water that has decided to be still — and inside it a slow light moves of its own accord, gathering and dimming and crossing itself in ways that answer when you lean closer, as though it marks you, as though it has been waiting and is patient about it. It is warm. It is older than the chapter house that keeps it, older than the founding the Long Watch teaches. Nothing in the world is made this way; nothing in the world is alive this way. It was set down here, on purpose, in an age the town\'s own story says had no one in it — and it has been awake the whole time.';

function buildSliceWorld() {
  let w = beginAdventure(
    newWorld({ seed: 'slice-walkthrough', fate: 0.3, campaignId: 'slice',
      pack: { primaryId: 'fantasy', mixerId: null } }),
    MINIMAL_PACK
  ).world;

  const nodeId = w.map?.currentNodeId ?? w.map?.nodes?.[0]?.id ?? 'start';

  // Seed the foundation stub — shared anchor for heretic claim + witness-object.
  w = { ...w, timeline: [
    { id: FOUNDATION_EVENT_ID, kind: 'foundation', t: -1, data: { sealed: true } },
    ...w.timeline,
  ]};

  // The pale root — a vision-bearing thing at the current node.
  w = mintThing(w, {
    id:          'thing:pale_root',
    name:        'the pale root',
    description: 'A dried, bitter-smelling root sold by an herbalist at the edge of the settlement.',
    nodeId,
    vision:      true,
  });

  // The witness-object — true edge pointing at FOUNDATION_EVENT_ID.
  w = mintThing(w, {
    id:          'thing:iron_disc',
    name:        'the iron disc',
    description: 'A small iron disc, its face covered in fine scratched lettering.',
    nodeId,
    trueEdge: {
      eventRef:    FOUNDATION_EVENT_ID,
      description: SHARD_TEXT,
    },
  });

  // The Lingerer — heretic NPC. Her claim about the foundation event.
  // initialDistortion: 0.92 — near-floor weight after a few hops, reads as crank.
  w = mintClaim(w, {
    subject:           'the_shallow_past',
    eventRef:          FOUNDATION_EVENT_ID,
    witnessNpcId:      'npc_lingerer',
    initialDistortion: 0.92,
  });

  return { w, nodeId };
}

// ── Slice walkthrough ─────────────────────────────────────────────────────────

async function main() {
  const sep  = () => console.log(`${'═'.repeat(72)}`);
  const rule = () => console.log(`${'─'.repeat(72)}`);
  const { w: wInit, nodeId } = buildSliceWorld();

  sep();
  console.log(' THE FIRST APERTURE — slice walkthrough');
  sep();
  console.log(`  settlement node : ${nodeId}`);
  console.log(`  FOUNDATION_EVENT_ID : ${FOUNDATION_EVENT_ID}`);
  console.log(`  heretic claim distortion : ${wInit.claims[0]?.distortion?.toFixed(3)}`);
  console.log(`  world.things     : ${wInit.things.map(t => t.id).join(', ')}`);
  console.log();

  // ── BEAT 1: ARRIVE ───────────────────────────────────────────────────────────
  sep();
  console.log(' BEAT 1 — ARRIVE');
  console.log('  A warm, devout, ordinary town. The pale root is here.');
  console.log('  (This is camouflage — the town is noise, the plant is faint signal.)');
  rule();
  console.log(`  Vision mark before : ${JSON.stringify(wInit.party?.[0]?.marks ?? [])}`);
  console.log(`  Things at node     : ${wInit.things.filter(t => t.nodeId === nodeId).map(t => t.name).join(', ')}`);
  console.log(`  Heretic's claim    : subject="${wInit.claims[0]?.subject}" dist=${wInit.claims[0]?.distortion?.toFixed(3)} wgt=${wInit.claims[0]?.weight?.toFixed(3)}`);
  console.log();

  // ── BEAT 2: VISION ───────────────────────────────────────────────────────────
  sep();
  console.log(' BEAT 2 — VISION');
  console.log('  The player eats the pale root. Raw contact. Then silence.');
  rule();

  const res2 = playerMove(wInit, MINIMAL_PACK, 'eat the pale root');
  const w2   = res2.world;

  console.log(`  mechanics tag   : "${res2.output.mechanics}"`);
  console.log(`  wall status     : ${res2.output.mechanics === '[vision:raw]' ? '✓ [vision:raw] — augmentation bypassed' : '✗ WRONG TAG'}`);
  console.log(`  mark after      : ${JSON.stringify(w2.party?.[0]?.marks ?? [])}`);

  const vEvent = w2.timeline.find(e => e.kind === 'vision');
  const vData  = JSON.stringify(vEvent?.data ?? {});
  console.log(`  vision event    : ${vData}`);
  console.log(`  event has prose : ${vData.includes(VISION_TEXT) ? '✗ WALL BREACH' : '✓ none — pointer only'}`);
  console.log();
  console.log('  — The vision renders: —');
  console.log(`  "${res2.output.narration}"`);
  console.log();

  // ── BEAT 3: HERETIC ──────────────────────────────────────────────────────────
  sep();
  console.log(' BEAT 3 — HERETIC');
  console.log('  The Lingerer recognizes the mark. She says: you saw it too.');
  console.log('  She does not explain. She has opinions; she keeps them.');
  rule();

  const lingererClaim = w2.claims.find(c => c.holderNpcId === 'npc_lingerer');
  const claimCtx = {
    subject:          lingererClaim.subject,
    distortion:       lingererClaim.distortion,
    weight:           lingererClaim.weight,
    eventRef:         lingererClaim.eventRef,
    provenance:       lingererClaim.provenance,
    eventDescription: null, // foundation event data is sealed
  };

  const heretikQuestion = 'What do you mean when you say the past is shallow?';
  console.log(`  question: "${heretikQuestion}"`);
  console.log(`  mode     : vision_recognition (player carries vision:root)`);
  process.stdout.write('  Speaking... ');
  const heretikLine = await speak('the Lingerer', 'wanderer', 'vision_recognition', claimCtx, heretikQuestion);
  console.log(`\n  → "${heretikLine}"`);

  // Wall check — recognition must not cross into explanation.
  const forbidden = ['because', 'it means', 'what happened', 'machines', 'code',
    'shapes', 'cycle', 'reset', 'explain', 'I believe it', 'I think the'];
  const crossings = forbidden.filter(w => heretikLine.toLowerCase().includes(w));
  console.log(`  wall : ${crossings.length === 0 ? '✓ no forbidden words' : '✗ CROSSED — ' + crossings.join(', ')}`);
  console.log();

  // ── BEAT 4: OBJECT ───────────────────────────────────────────────────────────
  sep();
  console.log(' BEAT 4 — WITNESS-OBJECT');
  console.log('  The player examines the iron disc. The shard is now legible.');
  console.log('  One piece of town belief is quietly falsified.');
  rule();

  const res4 = playerMove(w2, MINIMAL_PACK, 'examine the iron disc');
  const w4   = res4.world;

  console.log(`  mechanics tag     : "${res4.output.mechanics}"`);
  console.log(`  wall status       : ${res4.output.mechanics === '[reveal:true-edge]' ? '✓ [reveal:true-edge] — augmentation bypassed' : '✗ WRONG TAG'}`);

  const discAfter = w4.things.find(t => t.id === 'thing:iron_disc');
  console.log(`  trueEdge.discovered : ${discAfter?.trueEdge?.discovered}`);
  console.log(`  claims unchanged    : ${w4.claims.length === w2.claims.length ? '✓' : '✗'} (${w2.claims.length} before, ${w4.claims.length} after)`);
  console.log();
  console.log('  — The shard renders: —');
  console.log(`  "${res4.output.narration}"`);
  console.log();

  // ── CONVERGENCE ──────────────────────────────────────────────────────────────
  sep();
  console.log(' CONVERGENCE — what the player now holds');
  sep();
  console.log(`  vision mark      : ${JSON.stringify(w4.party?.[0]?.marks ?? [])}`);
  console.log(`  heretic claim    : eventRef=${lingererClaim.eventRef}  dist=${lingererClaim.distortion.toFixed(3)}`);
  console.log(`  shard eventRef   : ${discAfter?.trueEdge?.eventRef}`);
  console.log(`  same anchor      : ${lingererClaim.eventRef === discAfter?.trueEdge?.eventRef ? '✓ both point at ' + FOUNDATION_EVENT_ID : '✗ MISMATCH'}`);
  console.log();
  console.log('  Three things in the player\'s possession, all anchored to the same event:');
  console.log('    (a) the vision — contact, no meaning');
  console.log('    (b) the heretic — recognition, no answers');
  console.log('    (c) the shard   — one tile of floor, falsifying one town belief');
  console.log();
  console.log('  NPCs keep their maps. The town never knows. The player does.');
  sep();
  console.log();
}

main().catch(e => { console.error(e); process.exit(1); });
