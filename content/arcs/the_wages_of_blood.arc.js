// The Wages of Blood — after McCarthy's scalp economy. A broker pays bounty
// on raider kills, proof by hair, and the receipts do not care whose hair.
// The player can trace the rumor and sit across from the man; the arc resolves
// in the meeting itself — what the county learns is that you heard the offer.
//
// The dark path is the OFFER, not a quest objective. Taking bounty work is the
// player's own choice afterward, judged by the deed/morality systems like any
// other violence. The arc never gamifies the killing — no kill counter, no
// reward chrome. If ignored, the economics resolve without you, worse.

export default {
  arc: 'the-wages-of-blood',
  version: 1,
  scale: 'village',

  cast: [
    {
      role: 'the-clerk',
      bind: {
        roles: ['laborer', 'artisan', 'innkeeper', 'trader', 'scholar', 'scavenger', 'veteran', 'healer'],
        personality: { honesty: '>0.45' }
      },
      knows: [
        {
          factId: 'blood_bounty_receipts',
          guard: 'public',
          body: 'I kept the bounty book for him one month and quit. Hair is hair, he told me. The receipts do not say whose. I have seen braids in that office no raider ever wore, and gray ones, and small ones. He paid the same for all.'
        }
      ]
    },
    {
      role: 'the-broker',
      bind: {
        roles: ['representative', 'trader', 'enforcer', 'guard', 'veteran', 'elder', 'mediator'],
        personality: { selfPreservation: '>0.4' }
      },
      knows: [
        {
          factId: 'bounty_terms_gold',
          guard: 'public',
          body: 'The terms are simple and he states them simply: a hundred in gold per proof, no questions kept nor answered. The war pays for itself, he says. It always has. He will shake your hand on it and his hand is dry and cool.'
        }
      ]
    }
  ],

  hooks: [
    {
      rumor: 'There is a man at {home} paying gold for the hair of dead raiders, proof on the table, no questions. They say {carrier} kept his book a while and will not say why they stopped.',
      carrier: 'the-clerk',
      tags: ['arc:the-wages-of-blood']
    }
  ],

  stages: [
    {
      id: 'hear-the-price',
      doneWhen: { learned: 'blood_bounty_receipts' },
      worldEffects: [],
      spawns: { nextStage: 'meet-the-broker' }
    },
    {
      id: 'meet-the-broker',
      doneWhen: { learned: 'bounty_terms_gold' },
      branches: {
        default: {
          deeds: [],
          worldEffects: [],
          rumorSeed: 'A stranger sat with the bounty man at {home} and heard the terms and walked out with empty hands. The bounty stands. The book stays open. Men the county has never seen are riding in to sign it.'
        }
      }
    }
  ],

  abandonment: {
    afterDays: 14,
    rumor: 'Riders brought hair in to {home} by the saddlebag and the bounty man paid full price by lamplight. Whatever it was the proof was proof of, it never grew on any raider. The villages south of here bar their doors by dusk now.',
    worldEffects: []
  }
};
