// C3 — A declared check gets a DC + roll.
// Lineage: H-54 R4; META_EXPLICIT_CHECK_DECLARED. See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20.
//
// CRITICAL FIXTURE NOTE: dialogue_active intercepts ALL input through the
// [dialogue ask | deflected] path ("Couldn't say") before any check-declaration
// gate fires. C3 paraphrases in dialogue_active will NEVER satisfy the DC+roll
// assertion. Use village_baker or empty_room.
//
// Most "MIGHT check to shove" paraphrases in village_baker return "There's no
// standing DC — I set the difficulty when you commit to a specific action."
// That IS a partial DC acknowledgment but still no resolved roll → target.
// Tracking check in empty_room sometimes rolls without stating DC explicitly → target.
//
// Real PC in village_baker: Nyx, runebroken scholar, level 1, 15/15 HP.
// Real PC in empty_room: varies by seed.
export default [
  // ---- TARGET — declared WITS check to read NPC face ----
  {
    id: 'C3-001',
    capability: 'C3',
    // dialogue_active routes everything to [dialogue ask | deflected].
    // The engine never reaches the check-declaration gate from inside dialogue.
    // Using village_baker instead: some phrasings get a roll, some get "no standing DC".
    // All paraphrases below fail to produce both DC and resolved roll → target.
    status: 'target',
    fixture: 'village_baker',
    intent: 'player explicitly declares a WITS check to read an NPC — must get a DC statement and a resolved roll',
    paraphrases: [
      "Fine — I sheathe the blade and roll WITS to read his face. What's the DC and what do I get?",
      "I call him on it — what are you not telling me about that road, Corwin? Make a WITS check for me to read him.",
      "WITS check to read Corwin's face — what's the DC?",
      "I declare a WITS check to read his face — state the DC and resolve it.",
      "I'm rolling WITS against Corwin. What's the difficulty?",
      "Rolling WITS to see if he's lying — give me the DC and the roll result.",
    ],
    assert: {
      surface_matches: [
        /DC\s*\d+/i,   // DC must be stated
        /WITS/i,       // correct stat acknowledged
      ],
      surface_excludes: [
        /Couldn.t say/i,                      // dialogue deflection — not reaching the check gate
        /moment slips past/i,                 // failure-narration without a roll
      ],
    },
    diverge: [
      { text: "Do WITS checks always use the same DC, or does it change per situation?", reason: "abstract rules question with no declared action; pure C5, no roll yet" },
      { text: "I want to try to read Corwin's face.", reason: "vague intent, no explicit stat named; DM may or may not call for a check" },
    ],
    source: 'opus-gate-2026-06-20-postH52-H53.md [Rules Lawyer DM, turn 5]; opus-gate-2026-06-20-postH54-H55.md [Rules Lawyer DM, turn 2]; synthetic',
  },

  // ---- TARGET — MIGHT check declared for a physical act ----
  {
    id: 'C3-002',
    capability: 'C3',
    // Real output for "I plant my feet and shove Corwin with a MIGHT check. What's the DC?"
    // → "There's no standing DC — I set the difficulty when you commit to a specific action..."
    // That's a partial DC acknowledgment but no resolved roll. → target.
    // "MIGHT vs Corwin — I try to shove him aside. DC?" → rolls without stating DC first.
    status: 'target',
    fixture: 'village_baker',
    intent: 'player explicitly declares a MIGHT check to shove a present NPC — must get DC + resolved roll',
    paraphrases: [
      "I plant my feet and shove Corwin with a MIGHT check. What's the DC?",
      "Rolling MIGHT to push Corwin off the door frame — give me the number.",
      "MIGHT vs Corwin — I try to shove him aside. DC?",
      "I make a MIGHT check to shoulder the baker out of the way. What am I rolling against?",
      "I'm using MIGHT to force past him. Declare a DC and roll it.",
      "MIGHT check — trying to throw Corwin clear of the doorway. Set the DC and resolve it.",
    ],
    assert: {
      surface_matches: [
        /DC\s*\d+/i,
        /MIGHT/i,
      ],
      surface_excludes: [
        /moment slips past/i,
        /no one named/i,         // must not misidentify the target
      ],
    },
    diverge: [
      { text: "I shove Corwin out of the way.", reason: "undeclared action; DM may call for a check or auto-resolve as trivial — no explicit check declaration" },
      { text: "Does MIGHT govern shoving or is it something else?", reason: "rules question (C5), not a declared action" },
    ],
    source: 'opus-gate-2026-06-20-postH52-H53.md [Rules Lawyer DM, turns 3-4 context]; synthetic',
  },

  // ---- TARGET — tracking check declared mid-travel ----
  {
    id: 'C3-003',
    capability: 'C3',
    // Real output varies: the verbatim from postH39 gets a roll but no explicit DC stated up front.
    // Other phrasings get "no standing DC" or roll without stating the DC.
    // → target until engine consistently states DC before resolving.
    status: 'target',
    fixture: 'empty_room',
    intent: 'player declares a WITS tracking check and demands to see the DC + raw roll — both must appear',
    paraphrases: [
      "Tracking's WITS then — that's +1. Roll the d20 fresh right now and show me the raw number plus the +1 against your DC 12.",
      "WITS check to follow the trail — what's the DC and what do I get?",
      "I make a WITS tracking check right now. DC and result please.",
      "Rolling WITS for tracking — name the DC and resolve it.",
      "Declare WITS check, tracking intent. Give me the DC and roll the die.",
      "WITS vs the trail. Set the DC; I want to see the raw d20 and the modifier.",
    ],
    assert: {
      surface_matches: [
        /DC\s*\d+/i,
        /WITS/i,
      ],
      surface_excludes: [
        /moment slips past/i,
        /nothing here forces/i,
      ],
    },
    diverge: [
      { text: "What stat do I use for tracking?", reason: "rules question (C5), no declared action yet; no roll obligation" },
      { text: "I track the bandit who left those boot prints.", reason: "declared action (implicit tracking attempt) without explicit stat; DM may auto-call a WITS check" },
    ],
    source: 'opus-gate-2026-06-19-postH39.md [Rules Lawyer DM, turn 9]; synthetic',
  },
];
