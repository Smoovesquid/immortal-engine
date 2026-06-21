// C16 — In-character address to a present NPC routes to dialogue.
// Lineage: gate 6/7 (Confused-newbie "hi, who are you?") → N-3. See docs/CAPABILITY_LEDGER.md.
//
// A player greeting a present figure or asking who they are is DIALOGUE — the NPC
// answers in voice — never a d20 roll or a room-observe. Routed via the existing
// isDirectAddressIntent → direct-address guard (playloop), widened in N-3 (identity/
// acquaintance questions) + the observe gate now yields direct-address through to it.
//
// Real NPC in village_baker: Mira Hearth (baker), present, no active dialogue.
export default [
  {
    id: 'C16-001',
    capability: 'C16',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'greeting / identity / acquaintance question to a present NPC enters dialogue — no roll, no room-observe',
    paraphrases: [
      'who are you?',
      'do I know you?',
      'have we met?',
      "Sorry, I didn't catch that — who are you, and how do I know you?",
      "Um, hi — sorry, do I know you?",
    ],
    assert: {
      surface_matches: [ /dialogue enter/i ],   // routed into conversation with the present NPC
      surface_excludes: [ /\[roll:/, /observe only/i ],
    },
    diverge: [
      { text: 'who am I?', reason: 'self-identity question → character-sheet meta, not dialogue with an NPC' },
      { text: 'look around', reason: 'exploration/observe, not an address' },
      { text: 'I attack Mira', reason: 'a declared action, not conversational address' },
    ],
    source: 'opus-gate-2026-06-21.md (gate 6 + gate 7 Newbie t6/t7) — conversational address fell to roll/observe; fixed N-3 (isDirectAddressIntent widened + observe-gate yields direct-address)',
  },
];
