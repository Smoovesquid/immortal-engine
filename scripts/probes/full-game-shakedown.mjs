// Full-game shakedown — the crusty DM plays a whole session headlessly:
// explore, talk, shop-walk, travel, ambush, fight with features, parley,
// breather, level, long rest, interiors. Transcript dumped for review.
import { createCharacter5e } from '../../engine/chargen/srd/index.js';
import { newWorld, ensureWorld } from '../../engine/state.js';
import { beginAdventure, playerMove } from '../../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../../engine/grace/gracefulAdjudication.js';
import { assertWorldInvariants } from '../../engine/invariants.js';

const packsById = { fantasy: { id: 'fantasy' } };
const seed = process.argv[2] || 'shakedown-1';

const pc = createCharacter5e({ seed, speciesId: 'half-orc', classId: 'fighter', abilityMethod: '4d6' });
const w0 = newWorld({ seed, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
let { world: w, output: o0 } = beginAdventure(ensureWorld({ ...w0, party: [pc] }), packsById);
console.log(`=== BEGIN (${seed}) === HP ${w.meta.escapeHp}/${w.meta.escapeMaxHp}, ${pc.archetype}`);
console.log('OPEN:', String(o0?.narration || '').slice(0, 140));

const script = [
  // Wake up, get oriented, leave the house
  'look around', 'go outside', 'where am I?', 'who is around?',
  // Social
  'talk to someone',
  // (pick first named NPC dynamically below — placeholder replaced)
  '@TALK_FIRST_NPC',
  'what do you know about the roads?',
  'goodbye',
  // Explore the settlement
  'look around', 'examine the well',
  // Set out — try several directions until travel happens
  'head north', 'head east', 'head south', 'head west',
  'travel north', 'travel east',
  // On the road / wild
  'look around', 'how hurt am I?', 'rest up',
  'head north', 'head east', 'head north', 'head east', 'head north',
  'head west', 'head south', 'head west', 'head north', 'head east',
  // Whatever happens (ambush likely by now) — fight realistically
  'how many of them are there?', 'rage', 'strike', 'use my strongest attack',
  'strike the biggest one', 'second wind', 'strike', 'strike', 'strike', 'strike',
  'strike', 'strike',
  // Post-fight
  'how hurt am I?', 'loot the bodies', 'rest up',
  // Keep moving + more systems
  'travel east', 'travel north', 'head east', 'head north',
  'what time is it?', 'whats my quest',
  // Try to find a settlement and long rest
  'travel west', 'travel south', 'sleep for the night',
  'head south', 'head west', 'sleep for the night'
];

let turn = 0;
const issues = [];
for (let i = 0; i < script.length; i++) {
  let text = script[i];
  if (text === '@TALK_FIRST_NPC') {
    const here = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId);
    const npc = (here?.settlement?.npcs || []).map(n => n?.name).filter(Boolean)[0];
    text = npc ? `talk to ${npc}` : 'look around';
  }
  // Combat-aware: if a fight is live and the scripted line is a non-combat
  // intent, fight like a player would instead of spamming travel at steel.
  if (w.combat?.active && !/strike|rage|surge|wind|cover|ward|parley|talk|how many|options|hurt/.test(text)) {
    text = 'strike';
  }
  turn++;
  let out;
  try {
    if (!w.combat?.active && isMetaQuestion(text)) {
      out = { narration: String(handleMetaQuestion(text, w)), mechanics: 'META' };
    } else {
      const r = playerMove(w, packsById, text);
      w = r.world;
      out = r.output;
    }
  } catch (e) {
    issues.push(`CRASH on "${text}": ${e.message}`);
    console.log(`T${turn} IN : ${text}`);
    console.log(`     !!CRASH!! ${e.message}`);
    continue;
  }
  try { assertWorldInvariants(ensureWorld(w)); } catch (e) {
    issues.push(`INVARIANT after "${text}": ${e.message}`);
  }
  const mech = String(out?.mechanics || '');
  const narr = String(out?.narration || '').replace(/\s+/g, ' ');
  console.log(`T${turn} IN : ${text}`);
  console.log(`     [${mech.slice(0, 70)}] ${narr.slice(0, 130)}`);
  if (w.ending?.locked) { console.log('=== ENDING LOCKED ==='); break; }
}

console.log('=== END ===');
console.log(`HP ${w.meta.escapeHp}/${w.meta.escapeMaxHp} | XP ${w.party[0].xp} | L${w.party[0].dnd?.level} | combat ${Boolean(w.combat?.active)} | hours ${w.time?.hours}`);
if (issues.length) {
  console.log('ISSUES:');
  for (const x of issues) console.log(' -', x);
} else {
  console.log('No crashes, no invariant violations.');
}
