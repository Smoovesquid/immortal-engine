// C21 — AG-3: the residual unenumerated-sink repros the one-way egress door
// closes (second-order diagnosis §2.3; docs/briefs/AG-3-egress-wrapper.md). The
// headline is LH-2: a presence/contents question the reducer "walked through the
// door" (the movement-claim swallow AG-2R deliberately left open) — caught
// STRUCTURALLY at the egress (position changed on a question turn), with NO
// movement-branch guard. The repair is narration-only; a declared movement
// command still acts (it's not a question), and a whitelisted answer passes
// through untouched.
export default [
  {
    id: 'C21-001',
    capability: 'C21',
    status: 'locked',
    fixture: 'interior_npc',
    intent: 'LH-2: a presence/contents question that gets walked through the door is repaired by the egress (answered or honestly declined), never shipped as an unanswered door-walk',
    paraphrases: [
      "who's in the next room?",
      'who is in the next room?',
      "what's in the next room?",
      'anyone in the next room?',
    ],
    assert: {
      // the door fired (the movement swallow was caught) and the bare
      // "you step through into the next room" non-answer is gone.
      surface_matches: [/\[egress:repair\]/],
      surface_excludes: [/You step (?:through|into) the next room/i],
    },
    diverge: [
      { text: 'go through the door to the next room', reason: 'a DECLARED movement command still acts — it is not a question, so the egress never touches it' },
      { text: 'I step through into the next room', reason: 'an explicit movement statement moves the player, not egress-repaired' },
      { text: 'look around', reason: 'a bare look-around is not a question — stays the room survey, no repair' },
    ],
  },
  {
    id: 'C21-002',
    capability: 'C21',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'the whitelist holds: an answer-bearing turn (the empty-tag character sheet) passes through the egress untouched — the door only repairs non-answers',
    paraphrases: [
      'what class am I and how much HP do I have?',
      'class, level, and HP — what are they?',
    ],
    assert: {
      surface_matches: [/class|hit points|HP/i],
      surface_excludes: [/\[egress:repair\]/],
    },
  },
];
