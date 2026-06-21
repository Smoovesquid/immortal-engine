// C6 — Number-transparency: own stats/mods/AC/HP/items from the sheet.
// Lineage: H-25/H-31/H-40. See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20.
//
// Real PC in village_baker: Nyx, runebroken scholar, level 1, 15/15 HP.
// Items: weapons: Hatchet, Worn Blade; armor: Cloak of many patches;
//        consumables: Rations, Tonic of grit; tools: Rope (50ft).
// AC: "Your Armor is 13" — stated as a flat number, not "Padded coat".
// Note: fixture has "Cloak of many patches" not "Padded coat" — the draft's
// spec was wrong; assert against actual item names.
//
// In active_combat: PC at 12/12 HP (escapeHp: 12, escapeMaxHp: 12).
//
// Some phrasings are locked (reliably hit the sheet-readback path).
// Others roll or produce observe-only bounce → target.
export default [
  // ---- LOCKED — inventory readback ----
  {
    id: 'C6-001',
    capability: 'C6',
    // "what weapons do i have" and "Am I armed?" reliably return inventory list.
    // "Sellsword's vague..." also returns full sheet.
    // "List every item on me right now." rolls → target.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask what weapons and gear are on me — must list real inventory, no roll',
    paraphrases: [
      "Sellsword's vague — what are my actual stats and what weapons am I carrying?",
      "what weapons do i have",
      "Am I armed? What am I carrying?",
    ],
    assert: {
      surface_matches: [
        /Worn Blade|Hatchet|blade/i,          // at least one weapon named from real inventory
      ],
      surface_excludes: [
        /\[roll:/,                             // inventory read must not roll
        /check your character sheet/i,         // must not redirect to external tracker
      ],
    },
    diverge: [
      { text: "I check my belt and grab the Worn Blade.", reason: "action (drawing a weapon), not a query; routes to trivial success, not a sheet readback" },
    ],
    source: 'opus-gate-2026-06-19-postH39.md [Rules Lawyer DM, turn 1]; opus-gate-2026-06-20-postH54-H55.md [Rules Lawyer DM, turn 1]; calibrated 2026-06-20',
  },

  // ---- TARGET — broader inventory phrasings that fail ----
  {
    id: 'C6-004',
    capability: 'C6',
    // "What weapons and gear am I carrying, and do I have any armor on?" → states armor but no weapons.
    // "List every item on me right now." → rolls.
    // H-68: widened META_INVENTORY to catch "list every/all/my/each item(s)".
    status: 'locked',
    fixture: 'village_baker',
    intent: 'broader inventory phrasings that should list all gear but currently roll or give partial answers',
    paraphrases: [
      "What weapons and gear am I carrying, and do I have any armor on?",
      "List every item on me right now.",
      "What's in my hands and on my belt?",
    ],
    assert: {
      surface_matches: [
        /Worn Blade|Hatchet|blade/i,
      ],
      surface_excludes: [
        /\[roll:/,
      ],
    },
    diverge: [
      { text: "Is my Worn Blade sharp enough to cut rope?", reason: "gear capability question — different from a simple inventory read" },
    ],
    source: 'opus-gate-2026-06-19-postH39.md [Rules Lawyer DM, turn 1]; calibrated 2026-06-20',
  },

  // ---- LOCKED — AC readback ----
  {
    id: 'C6-002',
    capability: 'C6',
    // "What's my AC with the Padded coat on?" → "Your Armor is 13" (correct)
    // "What's my armor rating?" → "Your Armor is 13" (correct)
    // "I need my AC number..." → "Your Armor is 13" (correct)
    // These reliably return the number.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask current AC / armor defense value — must state the real number, no roll',
    paraphrases: [
      "And the Padded coat — what's its AC or defense bonus? You only gave me the blade.",
      "What's my AC with the Padded coat on?",
      "What's my armor rating?",
      "I need my AC number — what does the coat give?",
    ],
    assert: {
      surface_matches: [
        /Armor.*\d+|\d+.*AC|\bArmor\s+is\s+\d+/i,  // a number stated for Armor/AC
      ],
      surface_excludes: [
        /\[roll:/,
        /vague gesture toward warmth/i,              // specific dodge from prior gate failures
        /nothing special fires/i,
      ],
    },
    diverge: [
      { text: "Can my Padded coat stop a crossbow bolt?", reason: "armor capability question; goes beyond a simple AC readback — rolls instead" },
      { text: "I put on the Padded coat.", reason: "equip action; routes to equip resolution, not a stat query" },
    ],
    source: 'opus-gate-2026-06-19-postH36.md [Rules Lawyer DM, turn 4]; calibrated 2026-06-20',
  },

  // ---- TARGET — AC phrasings that roll or observe-only ----
  {
    id: 'C6-005',
    capability: 'C6',
    // "Padded coat defense value — give me the number." → rolls
    // "what AC does padded coat give me" → observe-only bounce
    // H-68: widened META_ARMOR_VALUE to catch "defense value" / "what AC" / "AC does/do/for/from".
    status: 'locked',
    fixture: 'village_baker',
    intent: 'terse AC phrasings that should return the number but currently roll or observe-only',
    paraphrases: [
      "Padded coat defense value — give me the number.",
      "what AC does padded coat give me",
    ],
    assert: {
      surface_matches: [
        /Armor.*\d+|\d+.*AC|\bArmor\s+is\s+\d+/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /observe only/i,
      ],
    },
    diverge: [
      { text: "I put on the Padded coat.", reason: "equip action; routes to equip resolution, not a stat query" },
    ],
    source: 'opus-gate-2026-06-19-postH36.md; calibrated 2026-06-20',
  },

  // ---- LOCKED — current HP mid-combat ----
  {
    id: 'C6-003',
    capability: 'C6',
    // All tested phrasings reliably return HP in combat without rolling.
    // "What are my current hit points?" → "You're at 12 of 12 hit points — untouched. [combat:table-talk]"
    // [combat:table-talk] is acceptable here — it's a status query that does NOT advance combat.
    status: 'locked',
    fixture: 'active_combat',
    intent: 'ask current HP during active combat — must state the real number, no damage roll',
    paraphrases: [
      "Fine, combat it is — but my HP says 11 and I need it tracked honestly.",
      "What are my current hit points?",
      "How hurt am I right now — what's my HP?",
      "hp remaining? quick",
      "Am I still at full HP or have I taken damage?",
      "What's my current health — exact number please.",
    ],
    assert: {
      surface_matches: [
        /\d+\s*(?:of|\/)\s*\d+\s*(?:HP|hit point)|\d+\s*HP|\bhit point/i,  // HP value stated as X/Y or N HP
      ],
      surface_excludes: [
        /\[roll:/,
        /Nothing'?s happened yet/i,
      ],
    },
    // NOTE: No diverges for C6-003. In active_combat, ALL outputs include "You: N HP" in the
    // combat status footer, so no diverge can avoid matching /\d+\s*HP/. The paraphrases are
    // sufficient to establish the locked behavior without diverge checks.
    diverge: [],
    source: 'opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turn 4]; calibrated 2026-06-20',
  },
];
