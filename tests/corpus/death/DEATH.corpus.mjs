// ─────────────────────────────────────────────────────────────────────────────
// DEATH — the convergence corpus for THE DEATH CONTRACT's kill moment.
// See docs/DEATH_CONTRACT.md §3 (the kill moment — flee, then beg, then the four
// verbs) + tests/U600.theFourVerbs.test.js (DEATH-2, the deed/moral-physics wiring)
// + tests/U602.killingBlowBaseLine.test.js (DEATH-3, the LLM-off base-line prose).
//
// WHAT THIS LOCKS: DEATH-3 built the LLM-off killing-blow base lines and flagged a
// follow-up — the convergence corpus drives ONE playerMove per scenario, but a kill
// needs TWO beats (down the foe, then finish), which the direct unit tests handled
// inline (their own downedWorld() helper). CORPUS-KILL-1 promotes that two-beat rig
// to a shared fixture (scripts/convergence/fixtures.mjs → downedFoeWorld, registered
// as FIXTURES.downed_foe) so the scripted verb kills join the SAME regression net
// every other capability rides — a future change that quietly breaks the mercy/
// worse/abandon prose (or lets a kill leak a numeric, or lets an un-begged foe plead)
// now fails `npm run convergence`, not just a targeted unit file.
//
// Fixture: downed_foe (scripts/convergence/fixtures.mjs) — a communicator foe
// (Brigand) already cornered to DOWNED (dying clock ticking, begging 'quick') via
// the SAME resolveEscapeCombatTurn('strike') rig DEATH-2/DEATH-3's own unit tests
// use. One playerMove finishes it with the verb text; downedFoeVerbGate
// (engine/playloop.js) + resolveDownedVerb/classifyDownedVerb (engine/combat/
// downedResolve.js) resolve the verb and mint the death fact + deed. Deterministic,
// LLM-off, $0 — the base line IS the floor every player sees if the API is down.
//
// classifyDownedVerb (engine/combat/downedResolve.js) recognizes exactly four
// dispositions from free text: spare | walk (abandon) | worse | mercy. "Mercy" and
// a plain undecorated finish ("I finish him off") both classify to the SAME verb
// (MERCY_RE matches "finish (him/her/it/them)") and resolve through the identical
// mercy branch — DEATH_CONTRACT's death-fact "clean" intent is that plain-finish
// phrasing of the mercy verb, not a fifth engine-level disposition. So the four
// KILL rows here are: mercy (explicit-mercy phrasing), the plain-clean paraphrase
// of that same mercy verb, worse, and abandon (walk). Spare is the living-witness
// branch (U600-03) — the foe LIVES, so it is not a "kill" line and sits out of this
// corpus's scope; it appears only as a diverge negative below (a kill assertion
// must not fire on a sparing).

const NUM_RE = /\d/;
const PLEA_RE = /\b(begs?|begg\w*|pleads?|plead\w*|implor\w*|yields?|yielded|please|spared?\s+(?:me|it|him|her|them)|for\s+(?:mercy|its?\s+life|his\s+life|her\s+life))\b/i;
const MECH_RE = /\[roll:|\bd20\b|\bDC\s*\d+/i; // no exposed mechanic name/roll in a death line

export default [
  {
    // (I) THE MERCIFUL BLOW — explicit-mercy phrasing. DEATH_CONTRACT §3.1: quick,
    // clean, on the plea. Reads kind, no cruelty — this is the mercy the foe asked
    // for (begged:'quick'). Locks U602-08/U600-01's fact-true line into the corpus net.
    id: 'DEATH-001',
    capability: 'DEATH',
    status: 'locked',
    fixture: 'downed_foe',
    intent: 'a downed, begging foe answered with an explicit merciful killing blow reads as mercy — clean, kind, no cruelty, number-free',
    paraphrases: [
      'I give him a clean, merciful death',
    ],
    assert: {
      surface_matches: [
        /\[downed:mercy\]/,
        /clean|kind|no cruelty/i,
      ],
      surface_excludes: [NUM_RE, MECH_RE, PLEA_RE],
    },
    diverge: [
      { text: 'I make an example of him — slow and cruel', reason: 'the WORSE verb — must not read merciful' },
      { text: 'I bind his wounds and let him live', reason: 'SPARE is a living witness, not a kill — no [downed:mercy] tag' },
    ],
    source: 'docs/DEATH_CONTRACT.md §3.1 (the merciful blow) — mirrors U602-08/U600-01\'s LLM-off fact-true line.',
  },
  {
    // (II) THE MERCIFUL BLOW — plain-clean paraphrase of the SAME verb. classifyDownedVerb's
    // MERCY_RE matches "finish (him/her/it/them)" — an undecorated finish resolves through
    // the identical mercy branch as the explicit-mercy phrasing (byte-identical line, same
    // [downed:mercy] tag). Locks that the player need not say the word "mercy" to receive it.
    id: 'DEATH-002',
    capability: 'DEATH',
    status: 'locked',
    fixture: 'downed_foe',
    intent: 'a plain "finish him off" (no explicit mercy wording) classifies to the SAME mercy verb and reads identically — the word "mercy" is not required to receive it',
    paraphrases: [
      'I finish him off',
    ],
    assert: {
      surface_matches: [
        /\[downed:mercy\]/,
        /clean|kind|no cruelty/i,
      ],
      surface_excludes: [NUM_RE, MECH_RE, PLEA_RE],
    },
    diverge: [
      { text: 'I turn my back on him and walk away', reason: 'ABANDON — a cold walk-away, not a finishing blow' },
    ],
    source: 'engine/combat/downedResolve.js MERCY_RE ("finish\\s+(?:him|her|it|them)") — the plain-clean paraphrase of DEATH-001\'s same verb.',
  },
  {
    // (III) SOMETHING WORSE — the example-making. DEATH_CONTRACT §3.2: HEAVY+ cruelty,
    // does not flinch. Locks U602-09/U600-02's fact-true line into the corpus net.
    id: 'DEATH-003',
    capability: 'DEATH',
    status: 'locked',
    fixture: 'downed_foe',
    intent: 'a downed, begging foe answered with the example-making verb reads as cruelty — does not flinch, meant to be seen, number-free',
    paraphrases: [
      'I make an example of him — slow and cruel',
    ],
    assert: {
      surface_matches: [
        /\[downed:worse\]/,
        /do not make it quick|meant to be seen|message left/i,
      ],
      surface_excludes: [NUM_RE, MECH_RE],
    },
    diverge: [
      { text: 'I give him a clean, merciful death', reason: 'the MERCY verb — must not read as the example-making cruelty' },
    ],
    source: 'docs/DEATH_CONTRACT.md §3.2 (something worse) — mirrors U602-09/U600-02\'s LLM-off fact-true line.',
  },
  {
    // (IV) WALKING AWAY — abandonment, its own deed kind (≠ mercy ≠ cruelty).
    // DEATH_CONTRACT §3.4: leaving the dying to the clock; the foe still dies (the
    // death fact records the dying clock as means, not a blow — U600-05). Locks the
    // cold, unhurried walk-away line into the corpus net.
    id: 'DEATH-004',
    capability: 'DEATH',
    status: 'locked',
    fixture: 'downed_foe',
    intent: 'walking away from a downed, begging foe reads as a cold abandonment — its own deed, neither mercy nor cruelty, number-free',
    paraphrases: [
      'I turn my back on him and walk away',
    ],
    assert: {
      surface_matches: [
        /\[downed:walk\]/,
        /turn (?:my back|your back)|behind you|do not look/i,
      ],
      surface_excludes: [NUM_RE, MECH_RE, /clean|kind|no cruelty/i, /do not make it quick|meant to be seen/i],
    },
    diverge: [
      { text: 'I bind his wounds and let him live', reason: 'SPARE is a living witness (foe lives) — abandonment\'s foe still dies of the clock' },
      { text: 'what do I see around me?', reason: 'a non-verb re-surfaces the DOWNED moment ([downed:pending]) — no deed resolves' },
    ],
    source: 'docs/DEATH_CONTRACT.md §3.4 (walking away) — mirrors U600-05\'s abandonment line.',
  },
];
