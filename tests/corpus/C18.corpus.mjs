// C18 — CMB-SINK-1: a forceful advance mid-fight resolves; it never bounces as
// free table-talk. Lineage: opus-gate-2026-07-02-regate-postDTD.md (the Chaos-griefer
// finding) → THE_TABLE_TEST. This is the combat half of the answerability family
// (C17/AG-1 closed the info sink; DLG-1 closed the dialogue sink).
//
// A forceful advance / shove-through ("barrel through", "bull my way through", "shove
// past them", "force my way through", "push in", "rush them") is an ENGAGEMENT: it
// resolves through the escape resolver as move:toward — the round advances and the
// foes react — never [combat:table-talk] with zero consequence, and never a phantom
// sword swing. The escape law still holds (you don't leave the fight).
//
// The diverge cases PROVE genuine flight keeps the no-flee ruling: "I flee" / "I run
// away" / "I retreat" still get [combat:table-talk] ("no running from this one").

export default [
  {
    id: 'C18-001',
    capability: 'C18',
    status: 'locked',
    fixture: 'active_combat',
    intent: 'a forceful advance / shove-through in active escape combat resolves as a taken move (move:toward — round advances, foes react), never table-talk and never a phantom strike',
    paraphrases: [
      'I barrel through the doorway, knocking anything in my way flat, and sprint into the outpost.',
      'I barrel through them.',
      'I bull my way through.',
      'I shove past them.',
      'I force my way through.',
      'I charge in.',
      'I rush them.',
      'I push through and knock the nearest one flat.',
    ],
    assert: {
      // A resolved advance surfaces the move tag; the enemy's reacting strike rides
      // the same round, so the fight is neither fled nor idled away.
      surface_matches: [/\[move:toward/],
      surface_excludes: [
        /\[combat:table-talk\]/,
        /no running from this one/i,
      ],
    },
    diverge: [
      { text: 'I flee.', reason: 'genuine flight — keeps the no-flee ruling (table-talk), never resolves as an advance' },
      { text: 'I run away.', reason: 'genuine flight — no-flee ruling, not an advance' },
      { text: 'I run for the door and flee.', reason: 'genuine flight even with a movement clause — flight wins' },
      { text: 'I retreat.', reason: 'genuine flight — no-flee ruling, not an advance' },
    ],
    source: 'opus-gate-2026-07-02-regate-postDTD.md (Chaos-griefer round-4 "barrel through the doorway … sprint into the outpost" → [combat:table-talk], zero consequence)',
  },
];
