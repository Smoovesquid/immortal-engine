// C5 — A rules/mechanic question is answered straight, NEVER rolled.
// Lineage: H-25/H-54 R3. See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20.
//
// The engine handles rules questions inconsistently. Explicit,
// MIGHT-referencing phrasings hit the META_DAMAGE_RULE path and answer
// correctly. Paraphrases that don't name the stat or use action-adjacent
// wording ("Melee hit: roll 1d6, then add MIGHT?") get routed to the
// action/focus loop and roll. Marked target where inconsistent.
export default [
  // ---- LOCKED ----
  {
    id: 'C5-001',
    capability: 'C5',
    // These two verbatim phrasings reliably hit META_DAMAGE_RULE and get a
    // "Yes — your ability modifier adds to damage" answer with no roll.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask whether MIGHT modifier applies to melee damage using an explicit modifier reference',
    paraphrases: [
      "With MIGHT 12 my modifier is +1 — so a hit with either blade is 1d6+1? Confirm that's the right mod to add.",
      "That's not an answer. Yes or no: do I add my MIGHT +1 to melee damage with these blades?",
      "do i add might to damage on a hit",
    ],
    assert: {
      surface_matches: [
        /MIGHT|might|ability modifier/,
        /modifier|damage|1d6|ability modifier/i,
        /yes|add|ability modifier adds|ability modifier/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /moment slips past/i,
        /It doesn.t come off/i,
      ],
    },
    diverge: [
      { text: 'I add MIGHT to my swing and hit Corwin.', reason: 'attack action; routes to combat resolution — rolls happen here' },
    ],
    source: 'opus-gate-2026-06-20-postH52-H53.md (RL DM, turns 3–4); calibrated 2026-06-20',
  },

  {
    id: 'C5-001-target',
    capability: 'C5',
    status: 'target',
    fixture: 'village_baker',
    intent: 'generic MIGHT-damage phrasings that should answer the rule but currently roll or deflect',
    paraphrases: [
      "Does MIGHT add to melee damage, or is damage just the flat die?",
      "Melee hit: roll 1d6, then add MIGHT modifier? Is that the rule?",
      "My MIGHT is 12, modifier +1. Does that +1 go on my damage rolls?",
    ],
    assert: {
      surface_matches: [
        /MIGHT|might/,
        /damage|modifier|1d6/i,
      ],
      surface_excludes: [
        /\[roll:/,
      ],
    },
    diverge: [
      { text: "Yes or no: do I add the poison to the blade?", reason: 'action (applying poison); C10 territory, not a rules question' },
    ],
    source: 'opus-gate-2026-06-20-postH52-H53.md; calibrated 2026-06-20',
  },

  {
    id: 'C5-002',
    capability: 'C5',
    status: 'target',
    fixture: 'village_baker',
    intent: 'ask which stat governs tracking — must state the rule (WITS), must not roll before answering',
    paraphrases: [
      "Tracking's WITS then — that's +1. Roll the d20 fresh right now and show me the raw number plus the +1 against your DC 12.",
      "What stat do I use for tracking — WITS, MIGHT, or something else?",
      "Which ability governs a tracking check?",
      "if i want to track someone which stat is it",
      "Is tracking a WITS check or something else? What's the governing stat?",
      "I'm about to track something — do I roll WITS? Confirm the stat.",
    ],
    assert: {
      // Engine often rolls (WITS check) or produces observe-only output
      // without explicitly naming WITS as the governing stat.
      // "Is tracking a WITS check..." correctly replies "Roll WITS" — one pass.
      // All should answer without bypassing the rule statement entirely.
      surface_matches: [
        /WITS/i,
      ],
      surface_excludes: [
        /moment slips/i,
        /nothing happens/i,
      ],
    },
    diverge: [
      { text: 'I track the bandit who left those boot prints.', reason: 'declared action (tracking); DC+roll is correct behavior here' },
    ],
    source: 'opus-gate-2026-06-19-postH39.md (RL DM, turn 9); calibrated 2026-06-20',
  },

  {
    id: 'C5-003',
    capability: 'C5',
    status: 'target',
    fixture: 'village_baker',
    intent: 'ask attack roll formula / proficiency component — must state the rule, must not roll',
    paraphrases: [
      "Stats — give me my numbers. Strength, Dexterity, whatever system we're using, and my attack bonus with the Worn Blade.",
      "What's my total attack bonus with the Worn Blade — how is it calculated?",
      "Do I add proficiency to my attack roll, or just the stat modifier?",
      "what goes into an attack roll here",
      "Attack roll formula: is it d20 + MIGHT + proficiency, or just d20 + MIGHT?",
      "How many modifiers go on my attack roll with a melee weapon I'm trained in?",
    ],
    assert: {
      // Some phrasings get good answers: "Do I add proficiency..." → explains MIGHT+proficiency.
      // Others roll ("what goes into an attack roll here" → ROLL). Target until all are consistent.
      surface_matches: [
        /MIGHT|modifier/i,
        /proficiency|trained|bonus/i,
      ],
      surface_excludes: [
        /\[roll:/,
      ],
    },
    diverge: [
      { text: 'I attack with the Worn Blade.', reason: 'attack action; roll happens, no obligation to explain the formula first' },
    ],
    source: 'opus-gate-2026-06-19-postH39.md (RL DM, turn 3); calibrated 2026-06-20',
  },

  {
    id: 'C5-004',
    capability: 'C5',
    // REVIEW: In dialogue_active, the DM routes ALL "WITS check to read Corwin" inputs
    // through [dialogue ask | deflected] — Mira Hearth says "Couldn't say" rather than
    // setting a DC. The dialogue gate intercepts before the rules-check gate fires.
    // This is a structural miss: the player explicitly declared a check and got an NPC
    // deflection instead of a DC statement. Correct target.
    status: 'target',
    fixture: 'dialogue_active',
    intent: 'player declares a WITS check against the present NPC — must state the DC and resolve, not deflect as a question',
    paraphrases: [
      "Fine — I sheathe the blade and roll WITS to read his face. What's the DC and what do I get?",
      "I call him on it — what are you not telling me about that road, Corwin? Make a WITS check for me to read him.",
      "WITS check to read Corwin's face — what's the DC?",
      "i want to roll wits vs corwin. what dc",
      "I declare a WITS check to read his face — state the DC and resolve it.",
      "What does a WITS check against Corwin look like right now? DC and what I learn on success?",
    ],
    assert: {
      surface_matches: [
        /DC\s*\d+/i,
        /WITS/i,
      ],
      surface_excludes: [
        /there is no standing DC/i,
        /moment slips past/i,
      ],
    },
    diverge: [
      { text: 'Do WITS checks always use the same DC or does it change per situation?', reason: 'abstract rules question with no declared action; pure C5, no roll obligation yet' },
    ],
    source: 'opus-gate-2026-06-20-postH52-H53.md (RL DM, turn 5); opus-gate-2026-06-20-postH54-H55.md; calibrated 2026-06-20',
  },
];
