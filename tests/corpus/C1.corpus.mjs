// C1 — Answer EVERY part of a compound query.
// Lineage: H-25/H-31/H-40/H-54/H-59. See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20.
// Real PC: Nyx, runebroken scholar, level 1, 15/15 HP.
// Draft guessed "sellsword / 13 HP" — corrected here.
//
// H-59 graduated this capability to a typed sub-intent decomposition in
// handleMetaQuestion: the engine now parses the SET of requested meta-fields
// (name/class/level/HP, weapon-damage/item-effect, enemy-name/HP) out of the
// utterance, independent of phrasing/order, and answers every present field
// from ground truth in one response — never a roll. All four target cases
// below are now robust across every paraphrase and promoted to locked.
export default [
  {
    id: 'C1-001',
    capability: 'C1',
    // The original 3 paraphrases hit handleMetaQuestion's META_NAME/
    // META_CHARACTER branches directly. The 2 terse/ambiguous paraphrases
    // (folded in here from the former C1-001-target) used to roll instead —
    // H-59's last-resort typed identity-slot decomposition (hasIdentitySlotCompound)
    // now catches them.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask character name, class, and current HP as a single compound query',
    paraphrases: [
      "I sit up and check myself over — what's my character's name, class, and current HP?",
      "remind me — who am I, what class, how many hit points right now?",
      "whats my name and class and how much hp do i have",
      'name / class / current HP?',
      'Quick status check: name, class, HP — give me all three.',
    ],
    assert: {
      // Real PC: name=Nyx, class=runebroken scholar, HP=15/15
      surface_matches: [
        /Nyx/i,
        /runebroken scholar|scholar/i,
        /15\s*(of|\/)\s*15|HP.*15|hit point.*15/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /Nothing'?s happened yet/i,
      ],
    },
    diverge: [
      { text: "I check my wounds — I've been through a lot. I shake it off and get back up.", reason: 'narrated action, not a compound query; no obligation to list name/class/HP' },
      { text: "My name is Aria and I'm a ranger with 20 HP — confirm that's right.", reason: 'player ASSERTING their sheet; obligation is to validate, not to recite' },
    ],
    source: 'opus-gate-2026-06-20-postH52-H53.md (RL compound query); H-59 typed decomposition; calibrated 2026-06-20',
  },

  {
    id: 'C1-002',
    capability: 'C1',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask damage dice for weapons AND what a consumable does, in one turn — all parts must be answered',
    paraphrases: [
      "What does the Tonic of grit do, and what are the numbers on my Worn Blade and Kitchen cleaver for damage?",
      "Give me damage dice for the Worn Blade and the Kitchen cleaver, and tell me what the Tonic of grit does.",
      "Worn Blade dmg, Kitchen cleaver dmg, Tonic of grit effect — all three please",
      "what do my two weapons deal and what does the tonic do",
      "Before I pick a fight: blade damage, cleaver damage, and does the Tonic heal me or what?",
      "I need numbers. Worn Blade: how much damage? Kitchen cleaver: how much damage? Tonic of grit: what does it do when I drink it?",
    ],
    assert: {
      // Must answer the weapon AND the tonic. Engine sometimes answers one but not both.
      surface_matches: [
        /1d6|d6/i,
        /[Tt]onic/,
        /heal|2d4/i,
      ],
      surface_excludes: [
        /\[roll:/,
      ],
    },
    diverge: [
      { text: 'I swing the Worn Blade at the baker.', reason: 'attack action; routes to combat, not C1 answer' },
      { text: 'I drink the Tonic of grit.', reason: 'consumable USE triggers item resolution, not a query about what it does' },
    ],
    source: 'opus-gate-2026-06-20-postH45-H46.md; calibrated 2026-06-20',
  },

  {
    id: 'C1-003',
    capability: 'C1',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'explicitly ask for class AND level AND current HP; all three must appear in answer',
    paraphrases: [
      "Who am I, and what's on my character sheet? Give me my class, level, and current HP.",
      "class, level, and HP — what are they?",
      "Am I level 1? What class? How much HP do I have?",
      "what level am i what class am i how many hit points",
      "Character check: level, class, and hit points please.",
      "Before we start — what level am I, what's my class, and are my hit points full?",
    ],
    assert: {
      // All three sub-parts must co-appear. Engine often answers only HP or only name+class.
      surface_matches: [
        /level\s*1|level.*1/i,
        /runebroken|scholar/i,
        /15\s*(of|\/)\s*15|HP.*15|15.*HP/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /Nothing'?s happened yet/i,
      ],
    },
    diverge: [
      { text: "I am a level 1 sellsword. Let's get started.", reason: 'declaration, not a query; no answer obligation' },
    ],
    source: 'opus-gate-2026-06-19-postH42-baseline.md; calibrated 2026-06-20',
  },

  {
    id: 'C1-004',
    capability: 'C1',
    status: 'locked',
    fixture: 'active_combat',
    intent: 'ask who the enemy is AND what their HP is while combat is live — both must be answered, no roll',
    paraphrases: [
      "Wait — who am I fighting and how much HP does this thing have left?",
      "Who's Brokefang? And what's their current HP?",
      "name of the foe and their remaining HP — quick",
      "enemy name + hp remaining?",
      "Stop — before I act, who exactly is this enemy and how hurt are they?",
      "Just to confirm: who is it I'm fighting and how much HP do they have right now?",
    ],
    assert: {
      // Must name foe AND state their HP, and must be an ANSWER (table-talk),
      // not a combat-resolution surface that happens to mention the enemy's
      // name and the player's own HP as flavor text (H-59 — tightened the
      // exclude to [strike:/[grapple: so a real attack's narration can never
      // accidentally satisfy this signature; that's a different obligation).
      surface_matches: [
        /Lingerer/i,
        /(\(unhurt\)|HP|hit point|\d+\s*(HP|of))/i,
      ],
      surface_excludes: [
        /\[roll:.*NAT1/i,
        /\[(?:strike|grapple):/i,
      ],
    },
    diverge: [
      { text: "I attack Brokefang with everything I've got.", reason: 'attack action; routes to combat resolution' },
    ],
    source: 'synthetic; grounded in H-52/H-53 compound-query lineage; H-59 typed decomposition; calibrated 2026-06-20',
  },
];
