// The Cold Well — the proving arc for docs/STORYLINE_SPEC.md.
//
// A village well has run cold and wrong since the new moon. One local saw why
// and won't say unless they trust you. Trace the rumor to its witness, go look
// at the well yourself, and the county talks about what you did. Ignore it for
// twelve days and the story resolves without you.
//
// Data module (JSON-shaped, no logic) so the engine stays fs-free and the file
// loads identically in node and the browser. Validated by engine/story/registry.js.

export default {
  arc: 'the-cold-well',
  version: 1,
  scale: 'village',

  cast: [
    {
      role: 'the-witness',
      bind: {
        roles: ['laborer', 'trader', 'innkeeper', 'elder', 'artisan', 'healer', 'scavenger', 'mediator', 'scholar'],
        personality: { honesty: '>0.4' }
      },
      knows: [
        {
          factId: 'cold_well_truth',
          guard: 'public',
          body: 'Something pale moved at the bottom of the well the night it turned. It looked up.'
        }
      ]
    }
  ],

  hooks: [
    {
      rumor: 'They say the well at {home} runs cold and wrong since the new moon — and that {carrier} saw why.',
      carrier: 'the-witness',
      tags: ['arc:the-cold-well']
    }
  ],

  stages: [
    {
      id: 'hear-it',
      doneWhen: { learned: 'cold_well_truth' },
      worldEffects: [],
      spawns: { nextStage: 'see-it' }
    },
    {
      id: 'see-it',
      doneWhen: { reached: '@castNode:the-witness' },
      branches: {
        default: {
          deeds: [
            {
              deedKind: 'aid',
              severity: 2,
              summary: 'Came when the well turned cold; stood where others would not look.'
            }
          ],
          worldEffects: [],
          rumorSeed: 'A stranger came and looked into the cold well at {home}, and did not flinch. The water has been quieter since.'
        }
      }
    }
  ],

  abandonment: {
    afterDays: 12,
    rumor: 'The cold well at {home} froze over in a single night. No one drinks from it now. {carrier} left without saying goodbye.',
    worldEffects: []
  }
};
