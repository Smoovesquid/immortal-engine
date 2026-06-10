// Shakedown round 3 — road encounters (pay/talk/slip/fight), interiors,
// and the named-travel journey system.
import { createCharacter5e } from '../../engine/chargen/srd/index.js';
import { newWorld, ensureWorld } from '../../engine/state.js';
import { beginAdventure, playerMove } from '../../engine/playloop.js';
import { assertWorldInvariants } from '../../engine/invariants.js';

const packsById = { fantasy: { id: 'fantasy' } };
const seed = process.argv[2] || 'road-1';
const choice = process.argv[3] || 'talk'; // what to do at a road encounter

const pc = createCharacter5e({ seed, speciesId: 'half-elf', classId: 'bard', abilityMethod: 'standard', classChoices: { skills: ['Persuasion', 'Deception', 'Performance'] } });
const w0 = newWorld({ seed, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
let { world: w } = beginAdventure(ensureWorld({ ...w0, party: [pc] }), packsById);
console.log(`=== ROAD SHAKEDOWN (${seed}, choice=${choice}) ===`);

const issues = [];
let turn = 0;
function go(text) {
  turn++;
  try {
    const r = playerMove(w, packsById, text);
    w = r.world;
    const mech = String(r.output?.mechanics || '');
    const narr = String(r.output?.narration || '').replace(/\s+/g, ' ');
    console.log(`T${turn} IN : ${text}`);
    console.log(`     [${mech.slice(0, 60)}] ${narr.slice(0, 150)}`);
    try { assertWorldInvariants(ensureWorld(w)); } catch (e) { issues.push(`INVARIANT after "${text}": ${e.message}`); }
    return { mech, narr };
  } catch (e) {
    issues.push(`CRASH on "${text}": ${e.message}`);
    console.log(`T${turn} IN : ${text}  !!CRASH!! ${e.message}`);
    return { mech: 'CRASH', narr: '' };
  }
}

// Interiors first: enter a building, move, exit.
go('go inside');
go('look around');
go('go north');
go('go outside');

// Named travel to known places until a road encounter pends (brigands appear
// on named journeys). Cycle through discovered nodes.
let encounters = 0;
for (let i = 0; i < 30 && encounters < 2; i++) {
  // find a discovered place that isn't here
  const m = w.map;
  const hereId = String(m?.currentNodeId || '');
  const known = (m?.nodes || []).filter(n => n && (m.discovered || []).includes(String(n.id)) && String(n.id) !== hereId);
  const target = known[i % Math.max(1, known.length)];
  if (!target) break;
  const r = go(`go to ${target.name}`);
  if (w.travel?.pending) {
    encounters++;
    console.log(`     >>> ROAD ENCOUNTER #${encounters} — responding "${choice}"`);
    const r2 = go(choice);
    if (w.combat?.active) {
      console.log('     >>> fight broke out — finishing it');
      for (let k = 0; k < 12 && w.combat?.active; k++) go(k === 0 ? 'how many of them are there?' : 'strike');
    }
  }
  if (w.combat?.active) {
    for (let k = 0; k < 12 && w.combat?.active; k++) go('strike');
  }
  if (w.ending?.locked) { console.log('=== ENDING LOCKED ==='); break; }
}

console.log('=== END ===');
console.log(`HP ${w.meta.escapeHp}/${w.meta.escapeMaxHp} | XP ${w.party[0].xp} | hours ${w.time?.hours} | pending ${Boolean(w.travel?.pending)}`);
console.log(issues.length ? 'ISSUES:\n - ' + issues.join('\n - ') : 'No crashes, no invariant violations.');
