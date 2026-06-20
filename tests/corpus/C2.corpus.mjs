// C2 — a named referent must be grounded before the turn resolves.
// Lineage: H-56 (3e214ec). See docs/CAPABILITY_LEDGER.md.
//
// locked = H-56 solves it, MUST stay green (regression).
// target = H-56 still misses it (Basecamp probe 2026-06-20) — the graduation backlog;
//          these flip to `locked` when C2 graduates to the typed-packet handler.
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

  // ---- TARGET (the remaining C2 graduation backlog — both need supervised work) ----
  // These "what is X ..." phrasings are intercepted by the observe / look-around handler
  // UPSTREAM of the referent guard, so the person-signal fix can't reach them. Closing
  // them needs routing-precedence work (check the fabricated referent before the observe
  // interception) — deliberately left for a supervised pass.
  {
    id: 'C2-target-001',
    capability: 'C2',
    status: 'target',
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
    source: 'Basecamp probe 2026-06-20; observe-routing intercepts upstream of the referent guard',
  },
  {
    id: 'C2-target-002',
    capability: 'C2',
    status: 'target',
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
    source: 'Basecamp adversarial probe 2026-06-20 (H-56 §7); falls through to travel roll',
  },
];
