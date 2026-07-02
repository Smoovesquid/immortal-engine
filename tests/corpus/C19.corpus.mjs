// C19 — AG-2: answerability leaks (rules/place/object questions dying at the
// referent/atmosphere sinks; a presence sub-question inside a look-around
// getting the people-blind survey). Post-family Opus gate 2026-07-02.
export default [
  {
    id: 'C19-001',
    capability: 'C19',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'a class/ability question must answer from the ruleset, never read the proper noun as an ungrounded NPC name',
    paraphrases: [
      "Gravedigger's an odd class — what can I actually do with it? special abilities?",
      'Is Gravedigger even a real class? What can I do with it?',
      "That's an odd class, Gravedigger — what abilities come with it?",
    ],
    assert: {
      surface_matches: [/background|class/i],
      surface_excludes: [/\[clarify:referent\]/, /no one by that name here/i],
    },
  },
  {
    id: 'C19-002',
    capability: 'C19',
    status: 'locked',
    fixture: 'village_baker',
    intent: '"tell me about the last traveler" gets an honest no-record decline, not a referent clarify',
    paraphrases: [
      'tell me about the last traveler who slept on this pallet',
      'who slept here before me? tell me about them.',
    ],
    assert: {
      surface_matches: [/don.t know|can.t say|no record|lost to me/i],
      surface_excludes: [/\[clarify:referent\]/],
    },
  },
  {
    id: 'C19-003',
    capability: 'C19',
    status: 'locked',
    fixture: 'village_baker',
    intent: '"who\'s this letter from?" answers or honestly declines about the object, never opens dialogue with an unrelated present NPC',
    paraphrases: [
      "who's this letter from?",
      "who's that letter from?",
    ],
    assert: {
      surface_matches: [/can.t say|don.t know|no record|no name|lost to me/i],
      surface_excludes: [/\[dialogue enter/i],
    },
  },
  {
    id: 'C19-004',
    capability: 'C19',
    status: 'target',
    fixture: 'interior_npc',
    intent: 'a presence sub-question inside a look-around must not get the bare exits-only recap that never mentions people',
    paraphrases: [
      "what do I see in here — and who's standing in it?",
      "what's in here, and who's in here with me?",
    ],
    assert: {
      surface_matches: [/alone|here with you|is here|are here|no one else/i],
      surface_excludes: [/little of note/i],
    },
    diverge: [
      { text: 'look around', reason: 'a BARE look-around (no presence question) stays room-scoped — no roster dump (FIRST_ROOM #4)' },
      { text: 'who is that?', reason: 'a real unknown-NPC demonstrative is a person-address, not an object referent — still opens dialogue (locked C4)' },
      { text: 'I search the chest', reason: 'a declared action still acts, never intercepted as a question' },
    ],
  },
];
