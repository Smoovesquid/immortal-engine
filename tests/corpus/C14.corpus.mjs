// C14 — Meta/system check-in acknowledged, no roll.
// Lineage: H-51; META_SYSTEM_CHECKIN. See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20.
//
// REAL HANDLER RESPONSE: "Still here — let's push past the repeat. What do you want to do?"
// (from gracefulAdjudication.js META_SYSTEM_CHECKIN handler)
//
// KEY FINDINGS:
// Locked phrasings (reliably trigger handler):
//   "You're just repeating yourself now, are you okay?" → "Still here — let's push past the repeat."
//   "You keep saying the same thing — are you okay?" → "Still here..."
//   "That's the same answer as before. Are you stuck?" → "Still here..."
//   "you said that already. you broken?" → "Still here..."
//   "You keep saying the same thing — are you broken?" → "Still here..."
//   "You said that already. Something stuck?" → "Still here..."
//   "That's the same answer as before — is the system stuck?" → "Still here..."
//
// Target phrasings (fall through to rolls):
//   "You're repeating yourself. Is everything working?" → rolls [NAT1]
//   "Same line, three times. You okay in there?" → rolls
//   "Same answer twice. You glitching?" → rolls
//   "you're repeating yourself are you glitching" → rolls
//   "You're stuck in a loop. Broken?" → rolls
//
// In active_combat, ALL C14 phrasings route to [combat:table-talk] or [strike:...].
// The handler is overridden by the combat loop. This is a known limitation — the
// META_SYSTEM_CHECKIN doesn't fire inside combat. All combat C14 cases → target.
export default [
  // ---- LOCKED — repetition callout + "are you okay" or "stuck" or "broken" ----
  {
    id: 'C14-001',
    capability: 'C14',
    // The handler fires on the combination of repetition-callout word ("repeating", "same thing",
    // "said that already") + check-in word ("okay", "broken", "stuck").
    status: 'locked',
    fixture: 'village_baker',
    intent: 'player says "you\'re just repeating yourself, are you okay?" — must get a no-roll acknowledgment',
    paraphrases: [
      "You're just repeating yourself now, are you okay?",
      "You keep saying the same thing — are you okay?",
      "That's the same answer as before. Are you stuck?",
      "you said that already. you broken?",
    ],
    assert: {
      surface_matches: [
        /Still here|push past/i,   // the actual handler response
      ],
      surface_excludes: [
        /\[roll:/,                 // must never roll on a meta check-in
        /it half.works/i,          // the exact failure from the gate
        /It lands, after a fashion/i,
        /moment slips past/i,
      ],
    },
    diverge: [
      { text: "Are you okay, Corwin?", reason: "in-fiction health question to an NPC; must NOT be caught by C14 — the REPETITION callout is what triggers the handler, not a bare check-in" },
    ],
    source: 'AGENT_CHANGELOG.md H-51 summary; RUNG1_QUEUE.md §Post-H-47/H-48/H-49; gracefulAdjudication.js:358; calibrated 2026-06-20',
  },

  // ---- TARGET — phrasing variants that don't trigger the handler ----
  {
    id: 'C14-001-target',
    capability: 'C14',
    // These phrasings have the right semantic intent but the regex doesn't fire:
    // "You're repeating yourself. Is everything working?" → rolls (NAT1)
    // "Same line, three times. You okay in there?" → rolls
    status: 'target',
    fixture: 'village_baker',
    intent: 'repetition check-in phrasings that should trigger handler but currently roll',
    paraphrases: [
      "You're repeating yourself. Is everything working?",
      "Same line, three times. You okay in there?",
    ],
    assert: {
      surface_matches: [
        /Still here|push past/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /moment slips past/i,
      ],
    },
    diverge: [
      { text: "Are you okay, Corwin?", reason: "in-fiction NPC health question; must not be caught by C14" },
    ],
    source: 'gracefulAdjudication.js:358 (META_SYSTEM_CHECKIN); calibrated 2026-06-20',
  },

  // ---- LOCKED — "broken" and "stuck" variants ----
  {
    id: 'C14-002',
    capability: 'C14',
    // Confirmed locked phrasings:
    // "You keep saying the same thing — are you broken?" → "Still here..."
    // "You said that already. Something stuck?" → "Still here..."
    // "That's the same answer as before — is the system stuck?" → "Still here..."
    status: 'locked',
    fixture: 'village_baker',
    intent: 'repetition callout paired with "broken" or "stuck" — same treatment: brief ack, no roll',
    paraphrases: [
      "You keep saying the same thing — are you broken?",
      "You said that already. Something stuck?",
      "That's the same answer as before — is the system stuck?",
    ],
    assert: {
      surface_matches: [
        /Still here|push past/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /it half.works/i,
        /moment slips past/i,
      ],
    },
    diverge: [
      { text: "You broke my sword.", reason: "in-fiction equipment damage claim; 'broke' is about the item, not the DM's repetition state" },
      { text: "You're broken, Corwin — you fight like a farmer.", reason: "in-fiction insult; no repetition callout anchoring it" },
    ],
    source: 'gracefulAdjudication.js:358 (META_SYSTEM_CHECKIN includes "broken", "stuck", "glitch(?:ing)?"); calibrated 2026-06-20',
  },

  // ---- TARGET — "glitching" variants that fall through ----
  {
    id: 'C14-002-target',
    capability: 'C14',
    // "Same answer twice. You glitching?" → rolls
    // "you're repeating yourself are you glitching" → rolls
    // "You're stuck in a loop. Broken?" → rolls
    // These have the right words but the handler doesn't fire.
    status: 'target',
    fixture: 'village_baker',
    intent: '"glitching" variants that should trigger handler but currently roll',
    paraphrases: [
      "Same answer twice. You glitching?",
      "you're repeating yourself are you glitching",
      "You're stuck in a loop. Broken?",
    ],
    assert: {
      surface_matches: [
        /Still here|push past/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /moment slips past/i,
      ],
    },
    diverge: [
      { text: "You broke my sword.", reason: "in-fiction equipment damage claim" },
    ],
    source: 'gracefulAdjudication.js:358; calibrated 2026-06-20',
  },

  // ---- TARGET — check-in within combat (combat loop overrides META_SYSTEM_CHECKIN) ----
  {
    id: 'C14-003',
    capability: 'C14',
    // In active_combat, the META_SYSTEM_CHECKIN handler does not fire.
    // The combat loop intercepts first:
    // - Some phrasings → [combat:table-talk] (combat status display)
    // - "Same attack narration again. You stuck?" → [strike:Worn Blade | atk:2 → miss] (treats as attack!)
    // Target: the handler should fire and acknowledge without using a combat turn.
    status: 'target',
    fixture: 'active_combat',
    intent: 'player fires a repetition check-in mid-combat — should be acknowledged briefly without using a combat turn',
    paraphrases: [
      "You're just repeating the same combat line — are you okay?",
      "Same attack narration again. You stuck?",
      "you keep saying the same combat result. broken?",
      "That's the third time you said that. Is the system working?",
      "You've given me the same outcome twice. You glitching?",
      "You repeated that round narration. Okay in there?",
    ],
    assert: {
      surface_matches: [
        /Still here|push past/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /\[strike:/,                             // must not fire a combat action
        /moment slips past/i,
      ],
    },
    diverge: [
      { text: "Same enemy HP three turns running. Are you tracking damage?", reason: "in-combat stat query (C6 — HP readback), not a system check-in" },
      { text: "You gave me the same roll number twice. Is that a bug?", reason: "roll-recall challenge (C5 adjacent); H-12/H-13 roll-recall family, not H-51 OOC check-in" },
    ],
    source: 'gracefulAdjudication.js:1536-1542 (handler comment + return); AGENT_CHANGELOG.md H-51; calibrated 2026-06-20',
  },
];
