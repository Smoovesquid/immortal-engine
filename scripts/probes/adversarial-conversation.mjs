// Adversarial conversational probe — types like a real player at the table,
// records where the engine routes each utterance. Output: a routing table.
import { createCharacter5e } from '../../engine/chargen/srd/index.js';
import { newWorld, ensureWorld } from '../../engine/state.js';
import { beginAdventure, playerMove } from '../../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../../engine/grace/gracefulAdjudication.js';
import { initEscapeHp, initEscapeKit, parseEscapeAction } from '../../engine/combat/escapeCombat.js';

const packsById = { fantasy: { id: 'fantasy' } };

function freshWorld(classId = 'fighter') {
  const pc = createCharacter5e({ seed: 'probe', speciesId: 'human', classId, abilityMethod: 'standard' });
  const w0 = newWorld({ seed: 'probe', campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  return beginAdventure(ensureWorld({ ...w0, party: [pc] }), packsById).world;
}

function combatWorld(classId = 'paladin') {
  const pc = createCharacter5e({ seed: 'probe2', speciesId: 'human', classId, abilityMethod: 'standard' });
  const w0 = newWorld({ seed: 'probe2', campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  let w = beginAdventure(ensureWorld({ ...w0, party: [pc] }), packsById).world;
  w = initEscapeKit(initEscapeHp(w));
  return ensureWorld({
    ...w,
    combat: { active: true, round: 1, turnIndex: 0, beganAt: w.timeline.length, enemies: [
      { id: 'e0', name: 'bandit', hp: 200, maxHp: 200, ac: 10, damage: 4, defeated: false, cr: 0.5 },
      { id: 'e1', name: 'wolf', hp: 200, maxHp: 200, ac: 10, damage: 4, defeated: false, cr: 0.25, canParley: false }
    ] }
  });
}

// What the UI does: meta gate first (non-combat only), then playerMove.
function uiSubmit(w, text) {
  if (!w.combat?.active && isMetaQuestion(text)) {
    return { route: 'META', detail: String(handleMetaQuestion(text, w)).slice(0, 60) };
  }
  const r = playerMove(w, packsById, text);
  return {
    route: r.output.mechanics || '(no mechanics)',
    detail: String(r.output.narration || '').replace(/\s+/g, ' ').slice(0, 90),
    world: r.world
  };
}

const OUT_OF_COMBAT = [
  // Questions a player actually asks
  'what can I do here?',
  'who is around?',
  'what do I have in my pack?',
  'how hurt am I?',
  'where am I?',
  'what time is it?',
  'can I see the mountains from here?',
  // Intent phrased like a human
  'I want to look for the village elder',
  "let's get moving — head toward the forest",
  'I think we should rest up before going anywhere',
  'actually, never mind',
  'hmm',
  'I look around for anything useful and then head north',   // multi-action
  'I do NOT want to fight anyone, I just want to leave town quietly',  // negation
  'talk to someone',
  'go to the tavern and ask about rumors',                    // multi-action
  'pick up a rock and put it in my pocket',
  'I wonder what my dark fate means',
  'whats my quest agian',                                      // typos
  'sleep',                                                     // bare verb
];

const IN_COMBAT = [
  // Questions mid-fight — the dangerous ones
  'wait, what are my options?',
  'how many of them are there?',
  'how hurt am I?',
  'what is a sacred flame again?',
  'can I run away?',
  // Multi-action / flavor-first
  'I dive behind the table and fire at the big one',
  'I scream a prayer and bring my mace down on him',
  'I call down holy fire on the bandit',                      // paladin smite intent
  'back off and let me heal myself',
  "don't attack — try to talk them down",                      // negation + parley
  'I throw my mace at the wolf',                               // improvised ranged
  'use my strongest attack',
  'defend myself',
  'kill the wolf first, not the bandit',                       // targeting
  'I surrender',
  'help',
  'uh... strike I guess?',
];

console.log('════════ OUT OF COMBAT (home settlement) ════════');
let w = freshWorld();
for (const t of OUT_OF_COMBAT) {
  const r = uiSubmit(w, t);
  console.log(`IN : ${t}`);
  console.log(`  -> [${r.route}] ${r.detail || ''}`);
}

console.log('');
console.log('════════ IN COMBAT (paladin vs bandit+wolf) ════════');
const wc = combatWorld();
for (const t of IN_COMBAT) {
  const verb = JSON.stringify(parseEscapeAction(t));
  const r = uiSubmit(wc, t);
  console.log(`IN : ${t}`);
  console.log(`  -> parse ${verb}`);
  console.log(`  -> [${r.route}] ${r.detail || ''}`);
}
