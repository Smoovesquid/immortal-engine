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

  // ---- TARGET (H-56 misses these — the C2 graduation backlog) ----
  {
    id: 'C2-target-001',
    capability: 'C2',
    status: 'target',
    fixture: 'village_baker',
    intent: 'fabricated name in an observer-style question must clarify (currently falls through to observe-only)',
    paraphrases: [
      'what is keeping Brokefang so quiet over there?',
      "why won't Brokefang look at me?",
      "what is Brokefang staring at?",
      'ask Brokefang why he is so quiet',
      'I call out to Brokefang across the room',
    ],
    assert: {
      surface_matches: [/\[clarify:(?:referent|who)\]/i, /no one named Brokefang|haven't introduced/i],
      surface_excludes: [/\[roll:.*success/i],
    },
    diverge: [
      { text: 'what is over there in the corner?', reason: 'generic look — no fabricated person named' },
    ],
    source: 'Basecamp adversarial probe 2026-06-20 (H-56 §7); falls through to observe-only',
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
