// The Debt That Walks — the companion side quest (P-78d).
//
// Whoever walks beside you has a past, and pasts collect interest. A
// debt-keeper in some settlement holds an old paper against "a traveler of
// your companion's description" — sold and resold until the original wrong is
// unrecognizable. Hear of it, find the keeper, and settle it: the deed is the
// player standing in their companion's history (the loyalty machinery makes
// the companion feel it — settling a debt is an `aid` deed witnessed by the
// very person it frees).
//
// Arc format per docs/STORYLINE_SPEC.md; validated by engine/story/registry.js.

export default {
  arc: 'the-debt-that-walks',
  version: 1,
  scale: 'village',
  requiresCompanion: true,

  cast: [
    {
      role: 'the-debt-keeper',
      bind: {
        roles: ['trader', 'innkeeper', 'mediator', 'elder', 'artisan', 'scholar', 'laborer', 'healer', 'scavenger'],
        personality: { honesty: '>0.3' }
      },
      knows: [
        {
          factId: 'old_debt_paper',
          guard: 'public',
          body: 'I hold paper on a traveler — bought third-hand, the original wrong long since worn off it. Someone of your company\'s description. Debts don\'t forget faces, even when faces forget debts.'
        }
      ]
    }
  ],

  hooks: [
    {
      rumor: 'They say {carrier} holds old paper against someone who travels — and has been describing your company to anyone who will listen.',
      carrier: 'the-debt-keeper',
      tags: ['arc:the-debt-that-walks', 'companion']
    }
  ],

  stages: [
    {
      id: 'hear-of-the-paper',
      doneWhen: { learned: 'old_debt_paper' },
      worldEffects: [],
      spawns: { nextStage: 'face-the-keeper' }
    },
    {
      id: 'face-the-keeper',
      doneWhen: { reached: '@castNode:the-debt-keeper' },
      branches: {
        default: {
          deeds: [
            {
              deedKind: 'aid',
              severity: 2,
              summary: 'Stood in a companion\'s old history and settled the debt that walked behind them.'
            }
          ],
          worldEffects: [],
          rumorSeed: 'They say the old paper {carrier} held got settled at last — paid in full by the company it followed. Some debts end better than they began.'
        }
      }
    }
  ],

  abandonment: {
    afterDays: 14,
    rumor: 'The paper {carrier} held got sold again — further away this time, and to worse hands. Debts that walk only walk faster.',
    worldEffects: []
  }
};
