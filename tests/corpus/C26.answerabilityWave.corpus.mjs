// C26 — ANS-2: the answerability wave (Opus gate 2026-07-04-3, four DEADEND-family
// turns). Questions resolve from what the world KNOWS: through a present leader,
// from the character sheet, from inventory canon; a delegated "talk to whoever's
// nearest" OPENS the conversation. Secret-control stays declined at the reveal
// sink (Biblioteca V12-13). Lineage: docs/PACKETS.md ANS-2, tests U460–U463.
//
// Fixture: outpost_representative (a settlement with a PUBLIC representative +
// innkeeper present, escape mode) — the corpus analogue of the tallow Wayfarers'-
// Outpost gate scenario. All rows are deterministic LLM-off → locked.
export default [
  // ---- C26-001 — LEADERSHIP delivers through the present role-holder (case 1) ----
  {
    id: 'C26-001',
    capability: 'C26',
    status: 'locked',
    fixture: 'outpost_representative',
    intent: 'who runs / leads / is in charge of this place — answer from canon (the present representative), never a "no record" stonewall',
    paraphrases: [
      'who runs this place?',
      'who is in charge here?',
      "who's the leader here?",
      'who runs this outpost?',
      'who represents this settlement?',
    ],
    assert: {
      surface_matches: [
        /representative/i,   // the public leadership role, surfaced from canon
      ],
      surface_excludes: [
        /no record|walls offer nothing|nothing to fill the gap/i, // never a stonewall
        /\[roll:/,                                                 // common knowledge, no roll
        /approach:force/i,                                         // "in charge" is not the attack verb
      ],
    },
    diverge: [
      { text: 'who secretly controls this place?', reason: 'SECRET-control is a DEFERRED slot (W-5) — declines at the reveal sink, never names the public role-holder as the hidden power' },
    ],
    source: 'opus-gate-2026-07-04-3.md (Lore-hound, "Who runs this outpost…" stonewalled); ANS-2 / U460',
  },

  // ---- C26-002 — a DELEGATED "talk to whoever's nearest" OPENS a dialogue (case 2) ----
  {
    id: 'C26-002',
    capability: 'C26',
    status: 'locked',
    fixture: 'outpost_representative',
    intent: 'delegated nearest-person talk — pick the most-salient present NPC and OPEN the conversation, never a [clarify:who] punt',
    paraphrases: [
      "Who's the nearest person — give me a name and let me talk to them.",
      'let me talk to the nearest person',
      'talk to whoever is closest',
      'talk to the closest person',
    ],
    assert: {
      surface_matches: [
        /you approach|step(?:s)? (?:into|toward)|eyes meet yours/i, // a dialogue-enter greeting
      ],
      surface_excludes: [
        /who do you want to talk to|\[clarify:who\]/i, // never a clarify punt
      ],
    },
    diverge: [
      { text: 'talk to someone', reason: 'a BARE vague talk with no delegation cue is genuinely ambiguous — still clarifies (U219/UX2)' },
    ],
    source: 'opus-gate-2026-07-04-3.md (Rules-Lawyer, nearest-person compound → clarify punt); ANS-2 / U461',
  },

  // ---- C26-003 — a CHARACTER-STATE ask answers from the sheet (case 3) ----
  {
    id: 'C26-003',
    capability: 'C26',
    status: 'locked',
    fixture: 'outpost_representative',
    intent: 'HP / gear / class ask — answer from the character sheet, even bundled with a look-around opener; never room décor only',
    paraphrases: [
      'what does my character sheet say for HP and class?',
      'I sit up and look around — what gear do I have, and my HP and class?',
      "what's my HP and what class am I?",
      'what gear do I have on me, and what does my sheet say for HP and class?',
    ],
    assert: {
      surface_matches: [
        /\bof\b.*hit points|hit points:|\d+\s*(?:of|\/)\s*\d+/i, // HP stated from canon
      ],
      surface_excludes: [
        /breakpoint/i,      // RL-1: confirm the shape, never recite the table
        /\[roll:/,          // a sheet read never rolls
      ],
    },
    diverge: [
      { text: 'I look around.', reason: 'a BARE look-around (no sheet field) surveys the room — the sheet fold must not over-trigger' },
    ],
    source: 'opus-gate-2026-07-04-3.md (Rules-Lawyer META-SHEET, answered with room décor only); ANS-2 / U462',
  },

  // ---- C26-004 — an OBJECT-STATE question answers from inventory canon (case 4) ----
  {
    id: 'C26-004',
    capability: 'C26',
    status: 'locked',
    fixture: 'outpost_representative',
    intent: 'where did my <object> go — answer from inventory canon (an invented item → honest correction), never a deflection to NPC presence',
    paraphrases: [
      'Wait, where did the letter go? I was just holding it.',
      "where's my letter?",
      'where did the letter go?',
      "where'd my letter get to?",
    ],
    assert: {
      surface_matches: [
        /not carrying any letter|no letter|nothing like that has been in your hands/i, // honest correction
      ],
      surface_excludes: [
        /haven't gone anywhere|if you want to speak/i, // never the NPC-presence deflection
        /\[roll:/,                                     // an object-state read never rolls
      ],
    },
    diverge: [
      { text: 'Wait, I pick up the worn blade.', reason: 'a leading interjection + a bare ACTION clause is not a question — it must ACT (take), not answer an object-state Q' },
    ],
    source: 'opus-gate-2026-07-04-3.md (Confused newbie, "where did the letter go?" deflected to NPC presence); ANS-2 / U463 / INT-4-HELD U459-05',
  },
];
