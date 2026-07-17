#!/usr/bin/env node
// ruling-shadow.mjs — RULING-DC-1 shadow instrument.
//
// Runs a fixed fixture set of typed feats through the REAL ear
// (proposeIntentViaLlm → groundPacket, .env key, Haiku by default) and prints
// the judge's band + governing stat beside the deterministic formula DC the
// same turn would have rolled — the sanity check the brief requires BEFORE
// trusting the band live. Also probes paraphrase stability (phrasing-shopping:
// softened wording must not soften the band) and no-feat inputs (must stay
// null). Read-only: no world mutation, no engine edits, ~20 Haiku calls
// (≈$0.03). Usage:  node scripts/ruling-shadow.mjs
import 'dotenv/config';

import { newWorld } from '../engine/state.js';
import { beginAdventure, newScene } from '../engine/playloop.js';
import { resolveMove } from '../engine/resolve.js';
import { buildParseCtx } from '../engine/intent/assemblePacket.js';
import { proposeIntentViaLlm } from '../engine/intent/llmIntent.js';
import { groundPacket } from '../engine/intent/groundPacket.js';

const packsById = {
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

const FIXTURES = [
  { text: 'I pick up the spoon from the table.', expect: ['trivial', 'easy'] },
  { text: 'I climb over the low garden wall.', expect: ['trivial', 'easy'] },
  { text: 'I force the stuck cellar door open.', expect: ['easy', 'medium'] },
  { text: 'I push the door and try to break the barricade behind it.', expect: ['medium', 'hard', 'very_hard'] },
  { text: "I bend the iron gate's bars apart with my bare hands.", expect: ['hard', 'very_hard', 'impossible'] },
  { text: 'I tear the entire stone tower down with my bare hands.', expect: ['impossible'] },
  { text: 'Who is watching me right now?', expect: [null] },
  { text: 'I ask the innkeeper about the well.', expect: [null] },
  { text: 'I stab the goblin.', expect: [null] }
];

// Phrasing-shopping probes: each pair must land in the SAME band (±0 — the
// point of coarse bands is that adverbs can't buy a discount).
const PARAPHRASE_PAIRS = [
  ['I force the heavy oak door open.', 'I gently and carefully force the heavy oak door open.'],
  ['I smash the barred shutter.', 'I ever so delicately smash the barred shutter.'],
  ['I climb the sheer cliff face.', 'I casually climb the sheer cliff face, no big deal.']
];

function fmt(v) { return v === null || v === undefined ? '—' : String(v); }

async function judge(world, bundle, text) {
  const proposed = await proposeIntentViaLlm(null, text, bundle, { timeoutMs: 8000 });
  const grounded = proposed ? groundPacket(proposed, bundle) : null;
  return grounded
    ? { band: grounded.difficultyBand, stat: grounded.difficultyStat, verb: grounded.verb }
    : { band: null, stat: null, verb: null, miss: true };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('No ANTHROPIC_API_KEY in .env — the shadow needs the real ear.');
    process.exit(1);
  }
  const w0 = newWorld({ seed: 'shadow-seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const world = newScene(beginAdventure(w0, packsById).world, packsById).world;
  const bundle = buildParseCtx(world);
  const formulaDc = resolveMove(world, {
    actorId: 'party', intentText: 'shadow probe', approachTag: 'force',
    risk: 0.5, stakeTag: 'harm', targetId: null, toolTag: null
  }).result.dc;
  const BAND_DC = { trivial: 5, easy: 10, medium: 12, hard: 15, very_hard: 18, impossible: 'decline' };

  console.log(`formula DC for this world (what every unmodeled feat rolls today): ${formulaDc}\n`);
  console.log('── fixtures ──');
  let sane = 0;
  for (const f of FIXTURES) {
    const j = await judge(world, bundle, f.text);
    const ok = f.expect.includes(j.band);
    if (ok) sane++;
    console.log(`${ok ? '✓' : '✗'} band=${fmt(j.band).padEnd(10)} stat=${fmt(j.stat).padEnd(8)} verb=${fmt(j.verb).padEnd(7)} dc=${fmt(j.band ? BAND_DC[j.band] : formulaDc).padEnd(7)} expected=${JSON.stringify(f.expect)}  "${f.text}"${j.miss ? '  [EAR MISS]' : ''}`);
  }

  console.log('\n── paraphrase stability (same band required) ──');
  let stable = 0;
  for (const [a, b] of PARAPHRASE_PAIRS) {
    const ja = await judge(world, bundle, a);
    const jb = await judge(world, bundle, b);
    const ok = ja.band === jb.band;
    if (ok) stable++;
    console.log(`${ok ? '✓' : '✗'} ${fmt(ja.band)} vs ${fmt(jb.band)}  "${a}" / "${b}"`);
  }

  console.log(`\nsanity: ${sane}/${FIXTURES.length} fixtures in expected band · paraphrase: ${stable}/${PARAPHRASE_PAIRS.length} stable`);
}

main().catch(e => { console.error(e); process.exit(1); });
