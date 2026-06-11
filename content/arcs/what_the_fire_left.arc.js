// What the Fire Left — after McCarthy. A hamlet burned before the game began
// and one survivor carries the accounting of it. The arc asks nothing of the
// player but witness: hear it, then go stand where it happened. The deed the
// world records is that someone came to hear, and remembered.
//
// The cruelty is offstage and past tense — weight and consequence, never
// spectacle. The captain is not a boss to kill; he is a fact in the world,
// like weather that happened to someone.

export default {
  arc: 'what-the-fire-left',
  version: 1,
  scale: 'village',

  cast: [
    {
      role: 'the-survivor',
      bind: {
        roles: ['laborer', 'healer', 'elder', 'artisan', 'scavenger', 'innkeeper', 'trader', 'veteran', 'guard'],
        personality: { selfPreservation: '>0.2' }
      },
      knows: [
        {
          factId: 'fire_dawn_count',
          guard: 'public',
          body: 'They came at first light wearing coats off of dead men and the captain sat his horse while it burned and counted us out loud where we stood in the road. Like a man counting coin. He thanked us. I have tried to forget that he thanked us.'
        }
      ]
    }
  ],

  hooks: [
    {
      rumor: 'They say {carrier} at {home} walked out of a burned hamlet in the south with nothing, and that when asked about it {carrier} only says: he counted us. Nobody asks twice.',
      carrier: 'the-survivor',
      tags: ['arc:what-the-fire-left']
    }
  ],

  stages: [
    {
      id: 'hear-the-count',
      doneWhen: { learned: 'fire_dawn_count' },
      worldEffects: [],
      spawns: { nextStage: 'stand-in-the-ashes' }
    },
    {
      id: 'stand-in-the-ashes',
      doneWhen: { reached: '@castNode:the-survivor' },
      branches: {
        default: {
          deeds: [
            {
              deedKind: 'aid',
              severity: 1,
              summary: 'Came to hear what the fire left. Wrote nothing down. Remembered it anyway.'
            }
          ],
          worldEffects: [],
          rumorSeed: 'A stranger came to {home} and heard the whole count from {carrier}, beginning to end, and did not look away. {carrier} slept that night. First time, they say, in a long while.'
        }
      }
    }
  ],

  abandonment: {
    afterDays: 12,
    rumor: 'No one at {home} speaks of the fire anymore. {carrier} has stopped telling it. The captain’s company was seen riding south through the passes, heavier by some wagons, and the talk moved on to the weather.',
    worldEffects: []
  }
};
