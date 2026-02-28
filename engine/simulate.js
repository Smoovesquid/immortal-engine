import { ensureWorld } from './state.js';
import { makeRng, seedFromString } from './rng.js';
import { beginAdventure, newScene, playerMove } from './playloop.js';

const INTENTS = [
  'I search the area carefully.',
  'I move quietly toward the objective.',
  'I talk to whoever is watching.',
  'I take cover and observe.',
  'I improvise a distraction.',
  'I secure an exit route.',
  'I take the torch.',
  'I force the locked door.'
];

export function simulateTurns(world, packsById, nTurns = 10) {
  let w = ensureWorld(world);
  const seed = seedFromString(`${w.meta.seed}|sim|${nTurns}`);
  const rng = makeRng(seed);

  const before = snapshotCounts(w);

  // Ensure we have a scene.
  if (!w.scene?.location) {
    const begun = beginAdventure(w, packsById);
    w = begun.world;
  }

  // One initial scene advance for variety.
  const s = newScene(w, packsById);
  w = s.world;

  for (let i = 0; i < nTurns; i++) {
    if (w.ending?.locked) break;
    const intent = rng.pick(INTENTS) || INTENTS[0];
    const res = playerMove(w, packsById, intent);
    w = res.world;
  }

  const after = snapshotCounts(w);
  const report = {
    turnsRequested: nTurns,
    turnsCompleted: after.timeline - before.timeline,
    factsAdded: Math.max(0, after.facts - before.facts),
    threatsAdded: Math.max(0, after.threats - before.threats),
    questionsAdded: Math.max(0, after.questions - before.questions),
    endingTriggered: Boolean(w.ending?.triggered),
    endingType: w.ending?.type || '',
    finalClocks: { ...w.clocks }
  };

  return { world: w, report };
}

export function reportSummaryString(report) {
  const r = report;
  const c = r.finalClocks || {};
  return [
    `facts+${r.factsAdded}`,
    `threats+${r.threatsAdded}`,
    `questions+${r.questionsAdded}`,
    `ending:${r.endingTriggered ? (r.endingType || 'yes') : 'no'}`,
    `clocks:p${c.pressure}/d${c.dread}/r${c.revelation}`
  ].join(' | ');
}

function snapshotCounts(w) {
  return {
    facts: w.ledger?.facts?.length ?? 0,
    threats: w.ledger?.threats?.length ?? 0,
    questions: w.ledger?.questions?.length ?? 0,
    timeline: w.timeline?.length ?? 0
  };
}
