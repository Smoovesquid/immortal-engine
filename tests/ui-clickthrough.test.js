import test from 'node:test';
import assert from 'node:assert/strict';

import { createUiModel, safeTransition, clickNewAdventure, setFate, setPrimary, setMixer, rollPartyDeterministic, clickNext, uiView } from '../public/ui/model.js';

const packsManifest = {
  version: 1,
  packs: [
    { id: 'fantasy', name: 'Fantasy', path: '/packs/fantasy/pack.json' },
    { id: 'modern', name: 'Modern IRL', path: '/packs/modern/pack.json' }
  ]
};
const packsById = {
  fantasy: {
    id: 'fantasy',
    name: 'Fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    toneWords: { cooperative: ['bright'], grim: ['tense'], blood: ['hard'] },
    starterLocations: ['garage'],
    starterObjectives: ['get the evidence'],
    skills: ['Talk']
  }
};

test('smoke: Title → Onboarding → Play click-through works deterministically', () => {
  let s = createUiModel({ packsManifest, packsById, advanced: true });

  ({ state: s } = safeTransition(s, clickNewAdventure));
  ({ state: s } = safeTransition(s, (x) => setFate(x, 0.2)));
  ({ state: s } = safeTransition(s, (x) => setPrimary(x, 'fantasy')));
  ({ state: s } = safeTransition(s, (x) => setMixer(x, 'modern')));

  // step 1 -> 2 -> 3
  ({ state: s } = safeTransition(s, clickNext));
  ({ state: s } = safeTransition(s, clickNext));

  // roll party then step 3 -> 4
  ({ state: s } = safeTransition(s, rollPartyDeterministic));
  ({ state: s } = safeTransition(s, clickNext));

  // begin (step 4 -> play)
  ({ state: s } = safeTransition(s, clickNext));

  const v = uiView(s);
  assert.equal(v.screenName, 'play');
  assert.equal(v.partyCount >= 1 && v.partyCount <= 4, true);
  assert.match(String(v.debugSeed), /^v2-/);

  // Determinism: repeat flow yields same seed and same opening line.
  let s2 = createUiModel({ packsManifest, packsById, advanced: true });
  ({ state: s2 } = safeTransition(s2, clickNewAdventure));
  ({ state: s2 } = safeTransition(s2, (x) => setFate(x, 0.2)));
  ({ state: s2 } = safeTransition(s2, (x) => setPrimary(x, 'fantasy')));
  ({ state: s2 } = safeTransition(s2, (x) => setMixer(x, 'modern')));
  ({ state: s2 } = safeTransition(s2, clickNext));
  ({ state: s2 } = safeTransition(s2, clickNext));
  ({ state: s2 } = safeTransition(s2, rollPartyDeterministic));
  ({ state: s2 } = safeTransition(s2, clickNext));
  ({ state: s2 } = safeTransition(s2, clickNext));

  assert.equal(s.play.world.meta.seed, s2.play.world.meta.seed);
  assert.equal(s.play.lines[0].text, s2.play.lines[0].text);
});
