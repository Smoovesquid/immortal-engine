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
    // H-61: folded the former C5-001-target paraphrases back in (mirrors
    // H-59's C1-001-target merge) — META_DAMAGE_RULE now catches both the
    // explicit "do I add" template and the "does <stat> add to damage" /
    // "add <stat> modifier? is that the rule" framings, so all six
    // paraphrases get the same "Yes — your ability modifier adds to damage"
    // answer with no roll.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask whether MIGHT modifier applies to melee damage, in any phrasing, and get the rule stated with no roll',
    paraphrases: [
      "With MIGHT 12 my modifier is +1 — so a hit with either blade is 1d6+1? Confirm that's the right mod to add.",
      "That's not an answer. Yes or no: do I add my MIGHT +1 to melee damage with these blades?",
      "do i add might to damage on a hit",
      "Does MIGHT add to melee damage, or is damage just the flat die?",
      "Melee hit: roll 1d6, then add MIGHT modifier? Is that the rule?",
      "My MIGHT is 12, modifier +1. Does that +1 go on my damage rolls?",
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
      { text: "Yes or no: do I add the poison to the blade?", reason: 'action (applying poison); C10 territory, not a rules question' },
    ],
    source: 'opus-gate-2026-06-20-postH52-H53.md (RL DM, turns 3–4); calibrated 2026-06-20; H-61 merge',
  },

  {
    id: 'C5-002',
    capability: 'C5',
    // H-61: typed governing-stat classifier (isGoverningStatQuestion in
    // gracefulAdjudication.js) — fires on the presence of a skill word
    // (tracking/track included) AND an independent "which stat governs
    // this" cue, regardless of order or template, and states the rule from
    // SKILL_STAT (the same map answerSkillModifier/resolve.js read) with no
    // roll.
    status: 'locked',
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
      surface_matches: [
        /WITS/i,
      ],
      surface_excludes: [
        /moment slips/i,
        /nothing happens/i,
        /\[roll:/,
      ],
    },
    diverge: [
      { text: 'I track the bandit who left those boot prints.', reason: 'declared action (tracking); DC+roll is correct behavior here' },
    ],
    source: 'opus-gate-2026-06-19-postH39.md (RL DM, turn 9); calibrated 2026-06-20; H-61 graduation',
  },

  {
    id: 'C5-003',
    capability: 'C5',
    // H-61: widened META_ATTACK_MOD beyond the strict "my attack <noun>"
    // possessive template ("what's my total attack bonus", "what goes into
    // an attack roll", "attack roll formula" all now gate), and the
    // named-weapon answer always names the components (ability modifier +
    // proficiency) so a "how is it calculated" ask gets the breakdown, not
    // just the final number.
    status: 'locked',
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
    source: 'opus-gate-2026-06-19-postH39.md (RL DM, turn 3); calibrated 2026-06-20; H-61 graduation',
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

  // ---- LOCKED ----
  {
    id: 'C5-005',
    capability: 'C5',
    // gate-4 RL t8: "which ability modifier applies to a melee strike — MIGHT or
    // AGILITY?" leaked the raw breakpoint table (a system artifact) instead of
    // answering the governing stat; sibling phrasings ("which stat to hit in
    // melee?") fell through to a generic WITS roll. H-80 added a governing-stat-
    // FOR-ATTACK answer (melee→MIGHT, ranged→AGILITY), checked before the
    // breakpoint last-resort and never rolled.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask which stat/modifier governs a MELEE attack — must answer MIGHT straight, never the breakpoint table or a roll',
    paraphrases: [
      "Which ability modifier applies to a melee strike — MIGHT or AGILITY?",
      "Which stat do I use to hit in melee?",
      "What modifier applies to a melee attack?",
      "Do I use MIGHT or AGILITY when I swing in melee?",
      "What's the ability modifier for a melee strike?",
    ],
    assert: {
      surface_matches: [
        /\bMIGHT\b/i,
        /melee/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /Modifier breakpoints/i,
        /Your measures/i,
      ],
    },
    diverge: [
      { text: 'which stat governs my armor class?', reason: 'defense/AC question — answered as AC (AGILITY-based), not the melee-attack MIGHT' },
      { text: 'I swing my blade at the fence post.', reason: 'attack declaration — resolves as an action/roll, not a rules answer' },
    ],
    source: 'opus-gate-2026-06-21-gate4-postH77.md (gate 4, Rules Lawyer t8: "which modifier for a melee strike" leaked the breakpoint table); reproduced LLM-off village_baker; fixed H-80',
  },

  // ---- LOCKED — roll-result QUERY reports the ledgered roll, never denies it ----
  // GRADUATED 2026-06-22 (H-87). Gate 10 (RL t11): "what did I roll … give me the
  // actual number on the die and the DC" → engine answered "no roll to report — you
  // simply looked around, no check required" while world.conversation.lastRoll held
  // 4 vs DC 12. The existing META_ROLL_RECALL only fires on a CITED number ("I
  // rolled a 4"); a QUESTION asking for the number missed isMetaQuestion entirely
  // and fell to observe-only, DENYING a recorded check. META_ROLL_QUERY now routes
  // the question to a straight report of lastRoll. Fixture `prior_roll` presets the
  // ledger so a single playerMove exercises the path.
  {
    id: 'C5-006',
    capability: 'C5',
    status: 'locked',
    fixture: 'prior_roll',
    intent: 'player ASKS what they last rolled (die number + DC), no number cited — must report the ledgered roll (4 vs DC 12), never deny it or re-roll',
    paraphrases: [
      "What did I roll to clear my head — give me the actual number on the die and the DC I was trying to beat.",
      "what did I roll?",
      "what was my last roll?",
      "give me the die number and the DC I beat",
      "what number came up on the die?",
      "remind me what I just rolled and the DC",
    ],
    assert: {
      surface_matches: [
        /4\s*vs\s*DC\s*12/i,   // the real ledgered roll is reported
      ],
      surface_excludes: [
        /no roll to report|no check required|observe only/i,  // must NOT deny the recorded roll
        /\[roll:/,                                             // must NOT re-roll
      ],
    },
    diverge: [
      { text: "roll WITS to read his face", reason: "declares a NEW check (META_EXPLICIT_CHECK_DECLARED → playloop), not a recall of the stored roll — must not echo 4 vs DC 12" },
      { text: "what's my current HP?", reason: "a different number-transparency query (HP) — reports HP, not the stored roll" },
    ],
    source: 'opus-gate-2026-06-22.md (gate 10, Rules Lawyer t11 CRUNCH — "no roll to report" denied lastRoll 4 vs DC 12); reproduced LLM-off prior_roll fixture',
  },
];
