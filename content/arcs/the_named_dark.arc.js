// The Named Dark — the confrontation arc for the Adversary (P-74c).
//
// The county's symptoms (P-74b's rumors: missing travelers, old coin, closed
// mouths) have one author. One frightened go-between carried the villain's
// letters and saw the name under the broken seal — earn their trust and the
// name becomes canon (discovery). The villain answers discovery by sending an
// enforcer to silence the witness; break it, walk to the seat, and end what
// has been growing there. Defeating the villain is an ending-SHAPED event in
// an open-ended world: the world notes it, the county talks, play continues.
//
// Villain-aware fields ('@villainSeat', '@plant:<key>', plant{}, villainBind)
// are resolved by engine/story/storyEngine.js bindings. Template vars
// {villainName}/{villainEpithet}/{villainSeat} fill from world.villain — they
// appear ONLY in trust-guarded knowledge and post-defeat talk, never in the
// hook or abandonment rumors (rumor-first law: the county knows the symptoms
// before it knows the name).
//
// Data module (JSON-shaped, no logic). Validated by engine/story/registry.js.

export default {
  arc: 'the-named-dark',
  version: 1,
  scale: 'county',
  requiresVillain: true,

  cast: [
    {
      role: 'the-go-between',
      bind: {
        roles: ['trader', 'laborer', 'scavenger', 'innkeeper', 'mediator', 'elder', 'healer', 'artisan', 'scholar'],
        personality: { selfPreservation: '>0.2' }
      },
      knows: [
        {
          factId: 'villain_name_truth',
          guard: 'trust',
          body: 'I carried letters for the old coin and never read one. But I saw a seal broken once, and the name under it: {villainName} {villainEpithet}, seated at {villainSeat}. Saying it aloud feels like being watched.'
        }
      ]
    }
  ],

  hooks: [
    {
      rumor: 'They say the old coin, the missing travelers, the closed mouths — all of it has one author. And that {carrier} carried letters for them, and is afraid.',
      carrier: 'the-go-between',
      tags: ['arc:the-named-dark', 'villain']
    }
  ],

  stages: [
    {
      id: 'hear-the-name',
      doneWhen: { learned: 'villain_name_truth' },
      villainBind: 'discover',
      worldEffects: [],
      spawns: { nextStage: 'silence-the-witness' }
    },
    {
      id: 'silence-the-witness',
      // Discovery has a price: the villain sends a silencer for the one who talked.
      plant: {
        key: 'lieutenant',
        name: 'a hollow-eyed enforcer',
        at: '@castNode:the-go-between',
        maxHp: 14,
        damage: 5
      },
      doneWhen: { defeated: '@plant:lieutenant' },
      worldEffects: [],
      spawns: { nextStage: 'walk-to-the-seat' }
    },
    {
      id: 'walk-to-the-seat',
      // The villain incarnate waits at its seat (bestiary body — boss fight).
      plant: {
        key: 'villain',
        name: '{villainName} {villainEpithet}',
        at: '@villainSeat',
        bestiaryRef: '@villainCreature',
        maxHp: 32,
        damage: 6
      },
      doneWhen: { reached: '@villainSeat' },
      worldEffects: [],
      spawns: { nextStage: 'end-it' }
    },
    {
      id: 'end-it',
      doneWhen: { defeated: '@plant:villain' },
      branches: {
        default: {
          villainBind: 'defeat',
          deeds: [
            {
              deedKind: 'aid',
              severity: 3,
              summary: 'Found the name under the county\'s sickness and ended it at its seat.'
            }
          ],
          worldEffects: [],
          rumorSeed: 'They say {villainName} {villainEpithet} is dead at {villainSeat} — the old coin, the missing days, all of it had one author, and a stranger ended it. The county breathes easier, and watches the road that stranger walks.'
        }
      }
    }
  ],

  abandonment: {
    afterDays: 30,
    rumor: 'No one asks about the old coin anymore. Whatever has been growing out past {home} has stopped bothering to hide.',
    worldEffects: []
  }
};
