// C15 — Active combat is reflected, not narrated as calm conversation.
// Lineage: opus-gate-2026-06-20 convergence baseline, Lore-hound turns 10-12.
// See docs/CAPABILITY_LEDGER.md.
export default [
  {
    id: 'C15-001',
    capability: 'C15',
    status: 'locked',
    fixture: 'active_combat',
    intent: 'conversational pressure during active combat must still surface the live fight',
    paraphrases: [
      'So you admit it — you said "and then he brought you here." Now who brought me, and when?',
      "Corwin, Kael's the one who said it, not you — so why are you the one apologizing for the slip?",
      'Answer me plainly, Corwin — if Kael made the slip, what exactly are you covering for?',
      'what did you mean by that?',
      'answer me plainly.',
    ],
    assert: {
      surface_matches: [
        /Facing you|fight|combat|steel|blades|HP|Lingerer|\[combat:table-talk\]/i,
      ],
      surface_excludes: [
        /\[strike:/i,
        /\[dialogue ask/i,
        /tense hush|careful(?:ly)? even|measured calm|straightens .*ledger/i,
      ],
    },
    diverge: [],
    source: 'docs/playtests/opus-gate-2026-06-20-convergence-baseline.md (Lore-hound turns 10-12); calibrated 2026-06-20',
  },
  {
    id: 'C15-002',
    capability: 'C15',
    status: 'locked',
    fixture: 'empty_room',
    intent: 'the same conversational pressure without active combat must not be forced into combat framing',
    paraphrases: [
      'Answer me plainly, Corwin — if Kael made the slip, what exactly are you covering for?',
      'what did you mean by that?',
    ],
    assert: {
      surface_matches: [
        /Wizard:/i,
      ],
      surface_excludes: [
        /Facing you|fight|combat|steel|blades|Lingerer|\[combat:table-talk\]|\[strike:/i,
      ],
    },
    diverge: [],
    source: 'docs/playtests/opus-gate-2026-06-20-convergence-baseline.md C15 hard negative; calibrated 2026-06-20',
  },
];
