import { rollOnTable } from './rngTables.js';

const DARK_FATE = [
  { name: 'Debt', text: 'You owe someone who never forgets.' },
  { name: 'Phobia', text: 'A small sound can ruin your hands.' },
  { name: 'Mark', text: 'A symbol follows you in reflections.' },
  { name: 'Contract', text: 'You signed something you couldn’t read.' },
  { name: 'Witness', text: 'Something saw you; it keeps checking.' },
  { name: 'Hunger', text: 'Not for food—for certainty.' },
  { name: 'Bad Luck', text: 'Coincidence has picked a side.' },
  { name: 'Stolen Name', text: 'Your name tastes wrong in your mouth.' },
  { name: 'Omen', text: 'Birds fall quiet when you arrive.' },
  { name: 'Echo', text: 'You hear your future mistakes in advance.' },
  { name: 'Rival', text: 'Someone benefits when you fail.' },
  { name: 'Unpaid Favor', text: 'A kindness is waiting to be collected.' },
  { name: 'Misplaced Mercy', text: 'You spared the wrong person.' },
  { name: 'Cold Spot', text: 'Rooms cool where you stand.' },
  { name: 'Bloodless Cut', text: 'You carry an injury that never bleeds.' },
  { name: 'False Friend', text: 'Help arrives with an agenda.' },
  { name: 'Rot', text: 'Good things spoil faster around you.' },
  { name: 'Radio Static', text: 'Devices hiss near your thoughts.' },
  { name: 'Bad Map', text: 'Paths change when you stop watching.' },
  { name: 'Last Wish', text: 'You promised something impossible.' }
];

export function rollDarkFate(rng) {
  return rollOnTable(DARK_FATE, rng) || DARK_FATE[0];
}
