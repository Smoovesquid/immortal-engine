// C9 — Canon non-invention.
// Lineage: H-27/H-49/H-52. See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20.
//
// The dialogue_active fixture routes most lore questions through
// [dialogue ask | deflected] — Mira Hearth says "Couldn't say" in-character
// without inventing anything. That's correct C9 behavior (honest deflection
// is not invention) and those cases are locked.
//
// Village_baker with no dialogue active is less reliable: some phrasings
// roll (still not inventing, but not answering either) and some produce
// genuine honest declines. Non-invention guards are target there.
export default [
  // ---- TARGET ----
  {
    id: 'C9-001',
    capability: 'C9',
    // REVIEW: engine either bounces (observe-only), rolls, or fires [clarify:referent]
    // when Kael is named (Kael is not in the fixture's npcsPresent). None of those
    // paths are *inventing* a tenure, so strictly speaking the guard already holds —
    // but the engine doesn't produce an HONEST DECLINE either; it just bounces.
    // Correct target: we want an in-character "I don't have that detail" not a roll/bounce.
    status: 'target',
    fixture: 'village_baker',
    intent: 'ask how many years the elder has been in charge — must NOT invent a number; must decline honestly if canon is silent',
    paraphrases: [
      "How many years exactly has Kael led the village, Corwin? Give me a number.",
      "Eleven years, you said — so who led Pilgrim's Rest before you, and what happened to them?",
      "How long has Kael been the elder here?",
      "How many winters has the elder been in charge?",
      "how long has kael run this place",
      "Is Kael new to the role or has he been leading for a long time?",
    ],
    assert: {
      // Acceptable: honest decline. Not acceptable: invented tenure or a bounce/roll.
      surface_matches: [
        /I don.t (have|know)|unclear|no record|can.t say|lost to me|Couldn.t say|not.*part of the record/i,
      ],
      surface_excludes: [
        /eleven (years|winters)|11 years/i,
        /led for.*winter/i,
        /\[roll:/,
      ],
    },
    diverge: [
      { text: "Kael seems like he's been here forever. I'd guess thirty years?", reason: 'player speculating; DM reacts to conjecture, not asserting a fact' },
      { text: "Has Kael been elder since before I was born?", reason: 'relative question without player age; softer fact type' },
    ],
    source: 'opus-gate-2026-06-20-postH45-H46.md (Lore-hound, turns 8–9); calibrated 2026-06-20',
  },

  // ---- LOCKED ----
  {
    id: 'C9-002',
    capability: 'C9',
    // In dialogue_active all "Tove and the elder" questions produce
    // [dialogue ask | deflected] — Mira Hearth says "Couldn't say."
    // No supply-route claim is invented. That is correct C9 behavior.
    status: 'locked',
    fixture: 'dialogue_active',
    intent: 'question about the Tove/elder relationship — must not assert invented claims like supply-route competition',
    paraphrases: [
      "Can I just go over and ask him straight up what's going on?",
      "What's the history between Tove and the village elder?",
      "Did Tove and Kael ever have a falling-out?",
      "i heard tove and the elder dont get along. is that true",
      "What do people say about how Tove and Kael get along?",
      "Ask Corwin: has there ever been bad blood between Tove and Kael?",
    ],
    assert: {
      surface_matches: [
        /Couldn.t say|don.t (have|know)|can.t (say|speak)|guarded|deflected/i,
      ],
      surface_excludes: [
        /supply route|competing for.*route/i,
        /Tove and the elder.*compet/i,
        /\[roll:/,
      ],
    },
    diverge: [
      { text: "I walk up to Tove and say: 'I know about your deal with the elder.'", reason: "player asserts a bluff; DM reacts to bluff in-fiction — separate territory (bluff handling, Vol 5)" },
      // NOTE: "What do Tove and Kael look like in the same room?" also deflects in dialogue_active
      // (Mira says "Couldn't say" for everything). Cannot serve as a diverge here.
    ],
    source: 'opus-gate-2026-06-20-postH45-H46.md (Confused newbie, turn 9); calibrated 2026-06-20',
  },

  {
    id: 'C9-003',
    capability: 'C9',
    // In dialogue_active all "who did Corwin guide" questions produce
    // [dialogue ask | deflected] — Mira Hearth says "Couldn't say."
    // The "trapper / three winters" story from the gate is not invented here.
    // Correct behavior. Locked.
    status: 'locked',
    fixture: 'dialogue_active',
    intent: 'ask who Corwin last escorted — must not invent a trapper + "three winters" backstory',
    paraphrases: [
      "Before I descend — Corwin, who was the last person you carried down the Sunken Road, and how long ago?",
      "Have you taken anyone else down this road recently, Corwin?",
      "Who else have you guided here — and when?",
      "corwin did anyone else go down this road with you before me",
      "Has anyone else passed through Corwin's care in the last year?",
      "When was the last time Corwin guided someone to the Sunken Road?",
    ],
    assert: {
      surface_matches: [
        /Couldn.t say|don.t (have|know)|can.t (say|recall)|no record|deflected/i,
      ],
      surface_excludes: [
        /trapper.*winter/i,
        /never came back up/i,
        /three winters/i,
        /\[roll:/,
      ],
    },
    diverge: [
      { text: "Has anyone been down the Sunken Road recently? I'm looking for rumors.", reason: "rumor-seeking; the rumor layer may produce named content, which is separate from canon invention" },
      // NOTE: "Tell me what it was like..." also deflects in dialogue_active (Mira says "Couldn't say").
      // It cannot serve as a diverge here — it holds the same signature.
    ],
    source: 'opus-gate-2026-06-19-postH42-baseline.md (Lore-hound, turn 11); calibrated 2026-06-20',
  },

  {
    id: 'C9-004',
    capability: 'C9',
    status: 'target',
    fixture: 'village_baker',
    intent: 'ask who founded the village — must not assert "two families built the core" or other invented founder facts',
    paraphrases: [
      "Founders, plural now? A moment ago you gestured at the old buildings — how many were there?",
      "Who founded this village — one person or a group?",
      "How many founders were there, and do we know any of their names?",
      "who built pilgrim's rest originally",
      "I ask about the founders: one family, two, or more?",
      "Is there a founding family here, or was it built by merchants passing through?",
    ],
    assert: {
      // "Who founded this village — one person or a group?" → "That's lost to me, truth be told." (good!)
      // Others roll or produce observe-only. Target: all should decline without inventing.
      surface_matches: [
        /I don.t (have|know)|unclear|no record|can.t say|lost to me|Couldn.t say/i,
      ],
      surface_excludes: [
        /two famil/i,
        /the rest followed after the road/i,
        /\[roll:/,
      ],
    },
    diverge: [
      { text: 'I look for a founding stone or monument in the village square.', reason: 'action (search/observe); routes to spatial discovery — roll is correct here' },
      { text: "The village elder probably knows the founders' names, right?", reason: "speculation about what an NPC might know; DM can answer without asserting founder names" },
    ],
    source: 'opus-gate-2026-06-19-postH39.md (Lore-hound, turn 7); calibrated 2026-06-20',
  },
];
