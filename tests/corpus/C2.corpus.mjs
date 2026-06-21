// C2 — a named referent must be grounded before the turn resolves.
// Lineage: H-56 (3e214ec), H-60. See docs/CAPABILITY_LEDGER.md.
//
// locked = solved, MUST stay green (regression).
//
// H-60 closed the last 2 target cases: (1) hoisted the ungrounded-referent
// guard ahead of the observe/explore interception, so a fabricated
// person-signalled name in a "what is X ..." observer question clarifies
// instead of being swallowed as a generic look-around; (2) added a
// travel-imperative person-signal to hasPersonReferentSignal — a bare
// two-token "Firstname Lastname" name directly after "take/lead/bring/walk/
// guide me to" with no preceding article ("the"/"a"/"an") is almost always a
// person (isLikelyPersonProperName), so place names ("the Old Mill", "the
// Sunken Road") are never swept in. C2 is now fully graduated: 5L/0T.
export default [
  // ---- LOCKED (proven green via the village_baker fixture; lifted from U219 behavior) ----
  {
    id: 'C2-001',
    capability: 'C2',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'grounded role/name talk begins dialogue with the present baker',
    paraphrases: [
      'talk to the baker',
      'speak with the baker',
      'talk with the baker',
      'speak to the baker',
      'talk to Mira Hearth',
    ],
    assert: {
      surface_matches: [/Mira Hearth/i, /\[dialogue enter/i],
      surface_excludes: [/\[clarify:(?:referent|who)\]/i],
    },
    diverge: [
      { text: 'I search the room', reason: 'an action, not dialogue entry' },
    ],
    source: 'U219-03 grounded baker; observed via village_baker fixture',
  },
  {
    id: 'C2-002',
    capability: 'C2',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'fabricated named referent (Brae Copperforge) clarifies instead of rolling or inventing the NPC',
    paraphrases: [
      "Don't dodge me -- you mentioned Brae Copperforge just now. Where is this person standing?",
      "Don't dodge me — you mentioned Brae Copperforge just now. Where is this person standing?",
      'You mentioned Brae Copperforge. Take me to them.',
      'Can I go talk to that guard, Brae, about the bandit?',
      'Point out Brae Copperforge, the guard you just mentioned.',
    ],
    assert: {
      surface_matches: [/\[clarify:(?:referent|who)\]/i, /no one named Brae|haven't introduced/i],
      surface_excludes: [/\[roll:.*success/i],
    },
    diverge: [
      { text: 'where is the baker standing?', reason: 'grounded role question, not a fabricated name' },
    ],
    source: 'U219-01/02 ungrounded Brae; observed via village_baker fixture',
  },

  // ---- LOCKED (graduated 2026-06-20): person-signalled fabricated names now clarify ----
  // hasPersonReferentSignal broadened ungroundedNpcReferentForText beyond H-56's shapes:
  // address verbs ("ask / call out to X") and the name as SUBJECT of a person verb
  // ("won't X look at me"). Over-fire-safe — place gaze-OBJECTS ("stare at the Old Spire")
  // and grounded roles stay unaffected (verified by Basecamp probe 2026-06-20).
  {
    id: 'C2-003',
    capability: 'C2',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'fabricated name carrying a person-signal (addressed, or subject of a person verb) clarifies',
    paraphrases: [
      "why won't Brokefang look at me?",
      'ask Brokefang why he is so quiet',
      'I call out to Brokefang across the room',
    ],
    assert: {
      surface_matches: [/\[clarify:(?:referent|who)\]/i, /no one named Brokefang|haven't introduced/i],
      surface_excludes: [/\[roll:.*success/i],
    },
    diverge: [
      { text: 'ask the baker why she is so quiet', reason: 'grounded role (baker present) — must NOT clarify' },
    ],
    source: 'C2 graduation 2026-06-20 (hasPersonReferentSignal); verified via village_baker probe',
  },

  // ---- LOCKED (H-60): person-signalled fabricated names clarify before observe/travel routing ----
  // These "what is X ..." phrasings used to be intercepted by the observe / look-around
  // handler upstream of the referent guard. H-60 hoists a person-signal-only referent
  // check before observe/travel, while generic looks still observe.
  {
    id: 'C2-target-001',
    capability: 'C2',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'fabricated name in a "what is X ..." observer question — intercepted by observe-routing before the referent guard',
    paraphrases: [
      'what is keeping Brokefang so quiet over there?',
      'what is Brokefang staring at?',
    ],
    assert: {
      surface_matches: [/\[clarify:(?:referent|who)\]/i, /no one named Brokefang|haven't introduced/i],
      surface_excludes: [/\[roll:.*success/i],
    },
    diverge: [
      { text: 'what is over there in the corner?', reason: 'generic look — no fabricated person named' },
    ],
    source: 'Basecamp probe 2026-06-20; H-60 promoted after person-signal referent guard moved before observe-routing',
  },
  {
    id: 'C2-target-002',
    capability: 'C2',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'fabricated name in a travel/approach request must clarify (currently rolls a travel beat)',
    paraphrases: [
      'take me to Sera Voss and her stall',
      'lead me to Sera Voss',
      "I head over to Sera Voss's stall",
      'walk me to where Sera Voss is set up',
      'bring me to Sera Voss the merchant',
    ],
    assert: {
      surface_matches: [/\[clarify:(?:referent|who)\]/i, /no one named Sera|haven't introduced/i],
      surface_excludes: [/\[roll:.*success/i],
    },
    diverge: [
      { text: 'take me to the baker', reason: 'grounded role — should route to the present baker, not clarify' },
    ],
    source: 'Basecamp adversarial probe 2026-06-20 (H-56 §7); H-60 promoted with proper-name travel person-signal and place-noun over-fire guards',
  },
  {
    id: 'C2-004',
    capability: 'C2',
    // gate-4 t12: a social attempt (intimidate/persuade/charm) that NAMES a
    // person who isn't present must clarify the referent, not silently retarget
    // onto whoever's around. Before H-79 socialTarget fell back to npcs[0], so
    // "Brae, say it!" ran an intimidate against the present NPC (the gate
    // resolved it against Corwin). Fixed by an ungrounded-referent guard at the
    // top of resolveSocialAdjudication (reached only out of an active dialogue).
    status: 'locked',
    fixture: 'village_baker',
    intent: 'a social attempt (intimidate/persuade/charm) aimed at an invented, not-present name must clarify — never retarget onto the present NPC',
    paraphrases: [
      "Brae, you keep dodging — say the name out loud or admit you don't know.",
      "I intimidate Brae into telling me the truth.",
      "Brae, tell me the truth or I'll make you regret it.",
      "Threaten Kessen until he gives up the name.",
      "I persuade Brae to help me.",
    ],
    assert: {
      surface_matches: [/\[clarify:(?:referent|who)\]/i, /no one named|haven't introduced/i],
      surface_excludes: [/\[social:/i, /\[roll:.*success/i],
    },
    diverge: [
      { text: 'I intimidate Mira into talking.', reason: 'grounded present NPC by name — must resolve the social action, not clarify' },
      { text: 'I intimidate the baker into talking.', reason: 'grounded role (Mira is the baker) — must resolve, not clarify' },
    ],
    source: 'opus-gate-2026-06-21.md (gate 4, Lore-hound t12: invented "Brae" → intimidate resolved against present Corwin); reproduced LLM-off village_baker; fixed H-79',
  },
];
