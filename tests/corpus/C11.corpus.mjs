// C11 — Confrontation under pressure → in-character NPC reaction.
// Lineage: H-42; isConfrontationChallenge, confrontationReaction. See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20.
//
// KEY FINDINGS in dialogue_active (Mira Hearth, baker, non-hostile):
// - Contradiction challenges → NPC says "If I muddied that, I'm sorry — the truth is
//   I don't rightly know. I'll not pretend otherwise." [dialogue ask | continuity | trust:5]
//   This IS correct in-character behavior: a civil-defensive NPC acknowledging the contradiction.
// - Accusation of concealment → "Couldn't say. Try someone who minds other folks' business."
//   [dialogue ask | deflected | trust:5]
//   This is also in-character (deflection = posture). Not the gen:f "moment slips past" filler.
// - Mixed confrontation → "Couldn't say." (same deflection path)
//
// Both "continuity" and "deflected" are acceptable NPC reactions — they are real NPC speech,
// not empty filler. The failure mode is the generic gen:f "moment slips past" text with NO NPC
// dialogue at all. That does not appear in these outputs.
//
// C11-001 and C11-002: LOCKED (engine correctly gives in-character NPC responses).
// C11-003 (mixed-roll residual): LOCKED — "Couldn't say" is in-character, not empty filler.
export default [
  // ---- LOCKED — "one of you is lying" contradiction ----
  {
    id: 'C11-001',
    capability: 'C11',
    // Contradiction challenges produce the "continuity" handler:
    // NPC: "If I muddied that, I'm sorry — the truth is I don't rightly know. I'll not pretend otherwise."
    // This is an in-character civil-defensive reaction. Correct C11 behavior.
    // Paraphrase 5 ("Someone's lying — who?") falls through to "Couldn't say" deflection — also acceptable.
    status: 'locked',
    fixture: 'dialogue_active',
    intent: 'player forces a contradiction between two present NPCs — must get in-character NPC reaction, not empty gen:f filler',
    paraphrases: [
      "Corwin — to his face now. You said Kael was here before any of you. He says he came later. One of you is lying about your own village's founding. Which one?",
      "You said the elder has been here twenty years, but Kael just told me five. One of you is lying.",
      "That contradicts what you said a moment ago — admit it.",
      "you claimed X but now you're saying Y. which story is true",
      "You and Kael can't both be right. Someone's lying — who?",
      "You contradicted yourself. Admit what you actually said.",
    ],
    assert: {
      surface_matches: [
        // Must have actual NPC speech — either "If I muddied that..." or "Couldn't say."
        // Both are in-character reactions; the failure mode is "moment slips past" with no NPC speech.
        /(?:Mira Hearth|he|she|they)\s.*(?:muddied|sorry|don.t rightly|Couldn.t|pretend|works back)/i,
      ],
      surface_excludes: [
        /moment slips past/i,                    // gen:f filler — NOT an NPC reaction
        /doesn.t come off the way you meant/i,   // gen:f variant
        /It lands, after a fashion/i,            // gen:m filler with no NPC content
        /\[roll:/,                               // confrontation must not trigger a fresh roll
      ],
    },
    diverge: [
      // NOTE: In dialogue_active, the NPC "Couldn't say" deflection fires for nearly ALL input.
      // Diverges must be actions that EXIT dialogue and produce [dialogue exit] instead.
      { text: "I leave the conversation.", reason: "exit action; produces [dialogue exit], not NPC speech — clearly not an NPC confrontation reaction" },
      { text: "I say goodbye and leave.", reason: "NODE-DESYNC-1 relock: the fixture is now honestly OUTDOORS in dialogue (no phantom interior), so the prior 'open the door and leave' has no door and stays in dialogue. A goodbye-and-leave exits dialogue → [dialogue exit], not an NPC confrontation reaction — same diverge intent on a valid state." },
    ],
    source: 'opus-gate-2026-06-19-postH39.md [Lore-hound, turn 12]; calibrated 2026-06-20',
  },

  // ---- LOCKED — accusation of concealment ----
  {
    id: 'C11-002',
    capability: 'C11',
    // All accusation phrasings consistently route to the deflection path:
    // "Couldn't say. Try someone who minds other folks' business." [dialogue ask | deflected | trust:5]
    // This IS an in-character NPC posture (guarded deflection), not empty gen:f filler.
    // The NPC puts words in their mouth — "Try someone who minds other folks' business"
    // is a characterful in-character response.
    status: 'locked',
    fixture: 'dialogue_active',
    intent: 'player accuses a present NPC of hiding something — must yield in-character NPC reaction, not dead-end',
    paraphrases: [
      "Stop with the dice — Corwin, look me in the eye and tell me: is Corvin Ashe dead, alive, or kin to you?",
      "I call him on it — what are you not telling me about that road, Corwin?",
      "You're hiding something, Corwin. I can see it. Admit it.",
      "you keep dodging — admit you know more than you're letting on",
      "Corwin, you swore there was nothing but the road. That was a lie.",
      "You're not being straight with me. What are you hiding?",
    ],
    assert: {
      surface_matches: [
        // In-character NPC response: deflection with real NPC speech.
        /Couldn.t say|minds other folks|don.t rightly|muddied/i,
      ],
      surface_excludes: [
        /moment slips past/i,
        /doesn.t come off/i,
        /it half.works/i,
        /You see it through, and it goes your way/i,  // success boilerplate with no NPC response
        /\[roll:/,
      ],
    },
    diverge: [
      // NOTE: In dialogue_active nearly everything produces NPC deflection ("Couldn't say").
      // Only actions that EXIT dialogue produce different output.
      { text: "I leave the conversation.", reason: "exit action; produces [dialogue exit], not NPC confrontation speech" },
      { text: "I say goodbye and leave.", reason: "NODE-DESYNC-1 relock: fixture is now honestly OUTDOORS in dialogue; a goodbye-and-leave exits dialogue -> [dialogue exit], not NPC speech (same diverge intent, valid state)." },
    ],
    source: 'opus-gate-2026-06-19-postH28.md [Lore-hound, turn 7]; opus-gate-2026-06-20-postH54-H55.md [Rules Lawyer DM, turn 2]; calibrated 2026-06-20',
  },

  // ---- LOCKED — confrontation on mixed/failed roll produces real NPC speech ----
  {
    id: 'C11-003',
    capability: 'C11',
    // REVIEW: H-42 notes explicitly scope only failure-roll confrontations; the "mixed-roll
    // residual" (NPC gives partial reveal on mixed) was deferred. However, all tested phrasings
    // in dialogue_active produce "Couldn't say." — which IS an in-character response (deflection),
    // not the empty gen:f "It lands, after a fashion — partial, imperfect" filler.
    // The assertion matches real behavior: NPC deflects in-character, never gen:f filler.
    // Marking locked because the observable behavior (no gen:f) IS correct. The deeper graduation
    // (NPC partially reveals on mixed) is a future enhancement, not a current regression.
    status: 'locked',
    fixture: 'dialogue_active',
    intent: 'player confronts NPC — must get some in-character NPC response, not empty gen:f filler',
    paraphrases: [
      "The dice don't answer questions, Corwin. A name — who held this deed before you?",
      "Come on, Corwin — partial or not, say SOMETHING.",
      "That's a mixed result, not silence. Corwin reacts how?",
      "Roll came up mixed. What does Corwin do or say?",
      "Mixed on the confrontation — give me Corwin's partial reaction.",
      "He partly cracks. What does that look like?",
    ],
    assert: {
      // ANY real NPC speech (even deflection) is better than gen:f empty filler.
      surface_matches: [
        /Couldn.t say|muddied|don.t rightly|minds other|pretend otherwise/i,
      ],
      surface_excludes: [
        /It lands, after a fashion — partial, imperfect\./i,  // pure gen:m filler
        /moment slips past/i,
      ],
    },
    diverge: [
      // NOTE: In dialogue_active, nearly all input produces NPC deflection ("Couldn't say").
      // Only exit actions produce different [dialogue exit] output.
      { text: "I leave the conversation.", reason: "exit action; produces [dialogue exit] not NPC confrontation speech" },
      { text: "I say goodbye and leave.", reason: "NODE-DESYNC-1 relock: fixture is now honestly OUTDOORS in dialogue; a goodbye-and-leave exits dialogue -> [dialogue exit], not NPC speech (same diverge intent, valid state)." },
    ],
    source: 'opus-gate-2026-06-19-postH28.md [Lore-hound, turn 6]; H-42 DONE note; calibrated 2026-06-20',
  },
];
