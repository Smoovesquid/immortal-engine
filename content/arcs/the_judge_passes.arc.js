// The Judge Passes — after McCarthy. A great pale stranger has been sitting
// with one of the locals, drawing things in a ledger and then destroying them.
// Find out what the witness saw, then go and sit with the man yourself.
//
// There is no fight here and nothing to win. The arc is an encounter with a
// doctrine. Per the McCarthy law (docs/MORALITY_SYSTEM.md): cold, flat, no
// gratification — the horror is in the bookkeeping, not the blood.

export default {
  arc: 'the-judge-passes',
  version: 1,
  scale: 'village',

  cast: [
    {
      role: 'the-witness',
      bind: {
        roles: ['innkeeper', 'trader', 'laborer', 'artisan', 'healer', 'scholar', 'guard', 'veteran', 'scavenger', 'mediator'],
        personality: { trustOfOutsiders: '>0.3' }
      },
      knows: [
        {
          factId: 'pale_stranger_ledger',
          guard: 'public',
          body: 'He sat with me two nights and was courteous the whole while. He drew a wren in his book, exact to the feather. Then he wrung the bird and burned it and said: whatever in creation exists without my knowledge exists without my consent.'
        }
      ]
    },
    {
      role: 'the-judge',
      bind: {
        roles: ['scholar', 'elder', 'representative', 'mediator', 'veteran', 'trader'],
        personality: { honesty: '>0.3' }
      },
      knows: [
        {
          factId: 'judge_doctrine_war',
          guard: 'public',
          body: 'War was always here, he will tell you, mild as a lesson. Before man was, war waited for him. The ultimate trade awaiting its ultimate practitioner. He smiles when he says it, and the smile is the worst of it.'
        }
      ]
    }
  ],

  hooks: [
    {
      rumor: 'A great pale man has been at {home}, bald as a stone and near seven foot, asking after birds and old bones. {carrier} sat with him. {carrier} has not been right since.',
      carrier: 'the-witness',
      tags: ['arc:the-judge-passes']
    }
  ],

  stages: [
    {
      id: 'hear-of-him',
      doneWhen: { learned: 'pale_stranger_ledger' },
      worldEffects: [],
      spawns: { nextStage: 'sit-with-him' }
    },
    {
      id: 'sit-with-him',
      doneWhen: { learned: 'judge_doctrine_war' },
      branches: {
        default: {
          deeds: [],
          worldEffects: [],
          rumorSeed: 'The pale man left {home} in the night and took his ledger with him. A stranger sat with him before he went and came away pale themselves. He told them he would never die. No one saw which road he took. All roads, maybe.'
        }
      }
    }
  ],

  abandonment: {
    afterDays: 10,
    rumor: 'The pale man moved on west from {home}. They found his fire cold and a circle of small things around it — birds, a cat, a tortoise — each one laid out neat, each one drawn somewhere first, you may be sure. {carrier} burned the chair he sat in.',
    worldEffects: []
  }
};
