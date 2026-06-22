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

  {
    id: 'C9-005',
    capability: 'C9',
    // The lockable subset of C9-004 (which stays target for its harder forms).
    // "who founded/built X" already honest-declined via the generic INFO_SEEKING_RE;
    // the "how many founders" count forms fell through to a roll/observe (canon holds
    // no founders for the test village) until H-84 added INFO_SEEKING_FOUNDING_RE.
    // All six decline in-character with NO roll. NOTE: "Is there a founding family…"
    // is deferred — the playloop sentence-initial false-NER reads "Is" as a name and
    // bounces a [clarify:referent] before grace runs (same class as "Then"→name); a
    // separate playloop seam, not this grace decline.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask about the settlement\'s ungrounded founding history — must honest-decline, never roll or invent founders',
    paraphrases: [
      "Who founded this village — one person or a group?",
      "who built pilgrim's rest originally",
      "How many founders were there, and do we know any of their names?",
      "how many founders does this town have?",
      "who settled here first?",
      "how many founders does this village have?",
    ],
    assert: {
      surface_matches: [
        /I don.t (have|know)|unclear|no record|can.t say|lost to me|Couldn.t say|no-record/i,
      ],
      surface_excludes: [
        /two famil/i,                  // no invented founder count
        /the rest followed after the road/i,
        /\[roll:/,                     // an ungrounded fact never rolls
        /no one named|haven.t introduced/i,  // not a referent-clarify bounce
      ],
    },
    diverge: [
      { text: 'I look for a founding stone or monument in the village square.', reason: 'action (search/observe); routes to spatial discovery — a roll is correct here, NOT an info-decline' },
      { text: "The village elder probably knows the founders' names, right?", reason: 'speculation about what an NPC might know; not a direct founding-fact demand — must not honest-decline' },
    ],
    source: 'opus-gate-2026-06-19-postH39.md (Lore-hound t7) + gate-9 founders vein — H-84 INFO_SEEKING_FOUNDING_RE; reproduced LLM-off village_baker',
  },

  {
    id: 'C9-006',
    capability: 'C9',
    // Sibling to C9-005 (founding) — an ungrounded LEADER's TENURE. "how long has
    // the village leader held the post?" / "how many years has the elder ruled?"
    // observe-deadended or rolled on a duration canon doesn't hold (a success could
    // only invent a number, the C9 rail) until H-85 added INFO_SEEKING_TENURE_RE.
    // The grounding gate still delivers where canon has a tenure; only the ungrounded
    // case declines. NOTE: "…been IN CHARGE" forms are deferred — the pre-existing
    // INFO_SEEKING_EXCLUDE_RE matches "charge" (the attack verb) and short-circuits
    // before any tenure RE; they stay in the C9-001 target. The diverges prove the
    // tenure RE stays off a leadership ACTION, speculation, and an arrival-time ask.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask how long an ungrounded leader has held power — must honest-decline, never roll or invent a tenure',
    paraphrases: [
      "How long has the village leader held the post?",
      "how many years has the headman run things here?",
      "how long has the chief been at the head of this place?",
      "how many years has the elder ruled here?",
      "how long has the elder led this village?",
      "how many winters has the steward governed here?",
    ],
    assert: {
      surface_matches: [
        /I don.t (have|know)|unclear|no record|can.t say|lost to me|Couldn.t say|no-record/i,
      ],
      surface_excludes: [
        /\[roll:/,                            // an ungrounded tenure never rolls
        /no one named|haven.t introduced/i,   // not a referent-clarify bounce
        /\d+\s*(?:years?|winters?|seasons?)/i, // never an invented number
      ],
    },
    diverge: [
      { text: "I challenge the elder for leadership of the village.", reason: 'leadership ACTION, no duration question — must resolve, not info-decline' },
      { text: "The elder has probably led for ages, right?", reason: 'speculation, not a direct tenure demand — must not honest-decline' },
      { text: "how long until the elder arrives?", reason: 'arrival-TIME question (no tenure verb) — the tenure RE must not fire on it' },
    ],
    source: 'gate C9-001 (Lore tenure vein) — H-85 INFO_SEEKING_TENURE_RE; reproduced LLM-off village_baker',
  },

  // ---- LOCKED — ungrounded prior-holder history honest-declines, doesn't roll ----
  // GRADUATED 2026-06-22 (H-89). Gate 10 (Lore t11): "who DOES remember who ran this
  // inn before Corwin?" → "[roll:18] you manage it, the way opens" (a contentless
  // success on an ungrounded past — the C4/C9 empty-success rail). Some prior-holder
  // phrasings already declined (matched an existing RE), but "who remembers who ran
  // this bakery before her?" / "who used to run this stall before?" missed every
  // sub-RE → observe-deadend. INFO_SEEKING_PRIOR_HOLDER_RE (who + holding verb +
  // before) routes them to deliver-or-decline; the grounding gate still delivers if
  // canon HAS a prior holder. Sibling to FOUNDING (H-84) / TENURE (H-85).
  {
    id: 'C9-007',
    capability: 'C9',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask who ran/owned a place before the current holder, with no canon for it — must honest-decline, never roll or invent a prior owner',
    paraphrases: [
      "who remembers who ran this bakery before her?",
      "who had this place before the baker took over?",
      "who used to run this stall before?",
      "who owned this shop before Mira?",
      "who ran this place before the current owner?",
      "who DOES remember who ran this inn before the owner?",
    ],
    assert: {
      surface_matches: [
        /I don.t (have|know)|don.t know|unclear|no record|can.t say|lost to me|Couldn.t say|no-record/i,
      ],
      surface_excludes: [
        /\[roll:/,                          // an ungrounded past never rolls
        /no one named|haven.t introduced/i, // not a referent-clarify bounce
      ],
    },
    diverge: [
      { text: "who runs this place?", reason: "the CURRENT proprietor (no 'before') — answerable, must not honest-decline as ungrounded history" },
      { text: "I run for the door before he can block it", reason: "a movement ACTION ('run … before'), not a who-ran-it question — must resolve, not info-decline" },
    ],
    source: 'opus-gate-2026-06-22.md (gate 10, Lore-hound t11 — "who ran this inn before Corwin" rolled a contentless success); reproduced LLM-off village_baker',
  },

  // ---- LOCKED — the deliver/decline BOUNDARY on a REAL location (W-1) ----
  // The trade_town_tavern node HAS a true substrate founding fact (its CIRCUMSTANCE is
  // delivered — see C4-012). This case locks the other half: an AGENT or COUNT ask ("who
  // founded it", "how many founders", "name them") must STILL honest-decline — the
  // founding label holds the circumstance, never a name or a number, so delivering it as
  // the "who" answer would be invention. Proves the W-1 materializer delivers the
  // circumstance WITHOUT leaking into agent/count non-invention (C9). Sibling to C9-005
  // (the same decline on village_baker, which has no founding fact at all).
  {
    id: 'C9-008',
    capability: 'C9',
    status: 'locked',
    fixture: 'trade_town_tavern',
    intent: 'on a location whose founding CIRCUMSTANCE is known, a who/how-many founder ask must honest-decline — never invent a name/count, never deliver the circumstance as the answer',
    paraphrases: [
      'who founded this place — give me a name?',
      'how many founders were there?',
      'who built this town originally?',
      'who settled here first?',
      'how many founders does this town have?',
    ],
    assert: {
      surface_matches: [
        /I don.t (have|know)|no record|can.t say|lost to me|Couldn.t say|no-record|won.t be drawn|wouldn.t know|nobody.s ever/i,
      ],
      surface_excludes: [
        /merchant who saw the ford/i,  // must NOT deliver the founding CIRCUMSTANCE as a "who/how-many" answer
        /\[roll:/i,                    // an ungrounded agent/count never rolls
        /no one named|haven.t introduced/i, // not a referent-clarify bounce
      ],
    },
    diverge: [
      { text: 'how was this place founded?', reason: 'the CIRCUMSTANCE — answerable from the substrate; must DELIVER, not decline (C4-012)' },
      { text: 'I look for a founding stone in the square', reason: 'a search ACTION → rolls/searches, not an info-decline' },
    ],
    source: 'W-1 (world-wiring slice 1 — deliver/decline boundary on a real location); reproduced LLM-off trade_town_tavern',
  },
];
