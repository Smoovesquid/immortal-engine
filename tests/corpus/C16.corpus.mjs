// C16 — In-character address to a present NPC enters dialogue AND the NPC answers.
// Lineage: gate 6/7 (Confused-newbie "hi, who are you?") → N-3 → DLG-1 (2026-07-02).
//
// A player greeting a present figure or asking who they are is DIALOGUE — the NPC
// answers in voice — never a d20 roll or a room-observe. Routed via the existing
// isDirectAddressIntent → direct-address guard (playloop), widened in N-3 (identity/
// acquaintance questions) + the observe gate now yields direct-address through to it.
//
// DLG-1 (2026-07-02): the direct-address guard now answers the question on enter
// instead of entering dialogue silently ("stops and turns — waiting"). C16-001
// relocked to require the NPC's name/role in the first line.
//
// Real NPC in village_baker: Mira Hearth (baker), present, no active dialogue.
export default [
  {
    id: 'C16-001',
    capability: 'C16',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'identity/acquaintance question to a present NPC enters dialogue AND the first line answers (name/role/residence) or declines in voice — no roll, no room-observe, no silent enter-and-wait',
    paraphrases: [
      'who are you?',
      'do I know you?',
      'have we met?',
      "Sorry, I didn't catch that — who are you, and how do I know you?",
      "Um, hi — sorry, do I know you?",
    ],
    assert: {
      surface_matches: [ /dialogue enter/i, /Mira(?:\s+Hearth)?|baker/i ],  // enters dialogue AND NPC's name/role appears in first line
      surface_excludes: [ /\[roll:/, /observe only/i, /stops and turns.*waiting/i ],
    },
    diverge: [
      { text: 'who am I?', reason: 'self-identity question → character-sheet meta, not dialogue with an NPC' },
      { text: 'look around', reason: 'exploration/observe, not an address' },
      { text: 'I attack Mira', reason: 'a declared action, not conversational address' },
    ],
    source: 'opus-gate-2026-06-21.md (gate 6 + gate 7 Newbie t6/t7) — conversational address fell to roll/observe; fixed N-3 (isDirectAddressIntent widened + observe-gate yields direct-address). DLG-1 (2026-07-02): silent enter relocked to answer-on-enter.',
  },
];
