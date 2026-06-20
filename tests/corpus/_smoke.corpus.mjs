export default [
  {
    id: 'C2-smoke-001',
    capability: 'C2',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'grounded role/name talk begins dialogue with the present baker',
    paraphrases: [
      'talk to the baker',
      'speak with the baker',
      'talk with the baker',
      'speak to the baker',
      'talk to Mira Hearth'
    ],
    assert: {
      surface_matches: [/Mira Hearth/i, /\[dialogue enter/i],
      surface_excludes: [/\[clarify:(?:referent|who)\]/i]
    },
    diverge: [
      { text: 'I search the room', reason: 'an action, not dialogue entry' }
    ],
    source: 'U219 grounded baker behavior, observed via deterministic village_baker fixture'
  },
  {
    id: 'C2-smoke-002',
    capability: 'C2',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'fabricated named NPC referent clarifies instead of rolling or inventing the NPC',
    paraphrases: [
      "Don't dodge me -- you mentioned Brae Copperforge just now. Where is this person standing?",
      "Don't dodge me — you mentioned Brae Copperforge just now. Where is this person standing?",
      'You mentioned Brae Copperforge. Take me to them.',
      'Can I go talk to that guard, Brae, about the bandit?',
      'Point out Brae Copperforge, the guard you just mentioned.'
    ],
    assert: {
      surface_matches: [/\[clarify:(?:referent|who)\]/i, /no one named Brae|haven't introduced/i],
      surface_excludes: [/\[roll:.*success/i]
    },
    diverge: [
      { text: 'where is the baker standing?', reason: 'grounded role question, not fabricated named referent' }
    ],
    source: 'U219 ungrounded Brae Copperforge behavior, observed via deterministic village_baker fixture'
  }
];
