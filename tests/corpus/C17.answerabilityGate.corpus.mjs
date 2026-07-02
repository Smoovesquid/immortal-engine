// C17 — Answerability gate: a direct question can never terminate as a non-answer.
// Lineage: FAILURE_META_DIAGNOSIS.md (Fable 2026-07-02) G1 root → AG-1 structural fix.
//
// AG-1 installs:
//   (1) a direct-question classifier (engine/grace/answerability.js)
//   (2) "huh" stopword (prevents false extraction of discourse fillers as NPC names)
//   (3) a pre-roll rule: directQuestionIntent bypasses resolveMove (no d20 on a question)
//   (4) a gen-bank floor guard in genericGroundedOutcome
//
// Diverge cases PROVE the classifier does not swallow declared actions or exploration.

export default [
  // ── C17-001: NPC personal-history question ─────────────────────────────────
  {
    id: 'C17-001',
    capability: 'C17',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'personal-history question to a present NPC resolves to a decline, never a d20 roll or gen:s/m/f atmosphere',
    paraphrases: [
      'were you born here?',
      'were you born here, Mira?',
      'do you come from around here?',
      'have you always lived here?',
      'have you always been in this village?',
    ],
    assert: {
      surface_matches: [/no-record|wouldn'?t know|can'?t say|that'?s lost|can'?t rightly say|there'?s no record/i],
      surface_excludes: [
        /\[roll:/,
        /you see it through|it comes off cleanly|you manage it|it goes your way|it half-works/i,
        /\[clarify:referent\]/,
      ],
    },
    diverge: [
      { text: 'I search the room', reason: 'declared action — must still route to action/explore resolver' },
      { text: 'look around', reason: 'bare exploration — never intercepted as a question' },
      { text: 'I attack the guard', reason: 'declared combat action — has action verb, must not be classified' },
    ],
    source: 'opus-gate-2026-07-02-regate-postDTD.md (Lore-hound "were you born here" → roll:1 → hedge)',
  },

  // ── C17-002: referent-followup question ────────────────────────────────────
  {
    id: 'C17-002',
    capability: 'C17',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'referent-followup question ("who\'s it from?") does not emit [clarify:referent] — routes to answerOrDeclineQuestion',
    paraphrases: [
      "who's it from?",
      'who sent this?',
      'is there a name on it?',
      'who wrote this?',
      "Huh, who's it from? Is there a name at the bottom?",
    ],
    assert: {
      surface_matches: [/no-record|wouldn'?t know|can'?t say|that'?s lost|can'?t rightly say|there'?s no record/i],
      surface_excludes: [
        /\[clarify:referent\]/,
        /\[roll:/,
        /you see it through|it comes off cleanly|you manage it|it goes your way|it half-works/i,
      ],
    },
    diverge: [
      { text: 'talk to the baker', reason: 'dialogue-enter action — no question, not a direct question' },
      { text: 'I examine the note', reason: 'exploration with action verb examine — not a direct question' },
    ],
    source: 'opus-gate-2026-07-02-regate-postDTD.md (Confused-newbie "who\'s it from?" → [clarify:referent])',
  },

  // ── C17-003: second-person question to NPC ─────────────────────────────────
  {
    id: 'C17-003',
    capability: 'C17',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'second-person question ("do you live here?", "are you from here?") does not roll a d20',
    paraphrases: [
      'do you live here?',
      'are you from around here?',
      'did you grow up in this village?',
      'have you lived here long?',
      'were you raised here?',
    ],
    assert: {
      surface_matches: [/no-record|wouldn'?t know|can'?t say|that'?s lost|can'?t rightly say|there'?s no record/i],
      surface_excludes: [
        /\[roll:/,
        /you see it through|it comes off cleanly|you manage it|it goes your way|it half-works/i,
        /\[clarify:referent\]/,
      ],
    },
    diverge: [
      { text: 'can I climb the wall?', reason: 'first-person permission question — still an action-attempt, must still roll' },
      { text: 'should I try to persuade her?', reason: 'first-person feasibility — action question, not intercepted' },
    ],
    source: 'opus-gate-2026-07-02-regate-postDTD.md (Confused-newbie "Who are you, though? Do you live here?" → dialogue-enter / mech:deadend)',
  },
];
