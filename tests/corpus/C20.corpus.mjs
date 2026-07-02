// C20 — DS-1a: a successful/mixed sense-for-the-dead check over empty canon
// states the definite negative ("nothing dead within reach"), never the
// gen-bank atmosphere filler. Locked via the real playerMove path (stress:1
// fixtures make the composer's abstract floor deterministic — see
// scripts/convergence/fixtures.mjs death_sense_empty/death_sense_with_corpse).
export default [
  {
    id: 'C20-001',
    capability: 'C20',
    status: 'locked',
    fixture: 'death_sense_empty',
    intent: 'a death-sense success over empty canon states the definite negative, never the gen bank',
    paraphrases: [
      'I use my death-sense to detect for the dead nearby',
      'I reach out with my death-sense',
      'I sense for anything dead within reach',
      'I try to detect the dead',
    ],
    assert: {
      surface_matches: [/nothing dead within reach|finds nothing dead|nothing within reach has died/i],
      surface_excludes: [/goes your way|after a fashion|see it through/i],
    },
    diverge: [
      { text: 'who was the last traveler who slept here?', reason: 'an epistemic-gap question (canon never minted it) still hedges/declines — not a presence-domain scan, DS-1a must not swallow it' },
    ],
  },
  {
    id: 'C20-002',
    capability: 'C20',
    status: 'locked',
    fixture: 'death_sense_with_corpse',
    intent: 'a death-sense success over a node that DOES hold a corpse finds it — never a false negative',
    paraphrases: [
      'I use my death-sense to detect for the dead nearby',
      'I reach out with my death-sense',
    ],
    assert: {
      surface_matches: [/Mira Hearth/],
      surface_excludes: [/nothing dead within reach/i, /goes your way|after a fashion|see it through/i],
    },
  },
];
