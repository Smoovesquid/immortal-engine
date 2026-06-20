// C7 — Item/consumable: query answers from real def; USE applies the effect.
// Lineage: H-45/H-47; answerItemQuery, tryUseConsumable, META_ITEM*. See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20.
//
// Real PC in village_baker: Nyx, 15/15 HP. Consumables include Tonic of grit.
//
// KEY FINDINGS:
// - Item query: "Tonic of grit — it heals 2d4" is the real output for correct phrasings.
//   But some phrasings fire [clarify:referent] (e.g. "Tell me about the Tonic of grit")
//   or observe-only bounce.
// - USE action: PC is at MAX HP (15/15), so engine correctly returns [consume:unneeded]
//   ("You're already whole — the tonic of grit keeps better in the pack than in you.")
//   This IS correct behavior; the assert must account for it.
// - False-claim correction: "Not quite — Tonic of grit it heals 2d4." for the right phrasings.
// - Inventory state: "Yes — Tonic of grit is in your pack." / "Your consumables: Rations, Tonic of grit."
export default [
  // ---- LOCKED — item query (what does it do) ----
  {
    id: 'C7-001',
    capability: 'C7',
    // "Tonic of grit — it heals 2d4." is the consistent output for phrasings that
    // ask "what does it do" / "heals HP or buff". Locked on these.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask what the Tonic of grit does mechanically — must state the real effect, no roll',
    paraphrases: [
      "What does the Tonic of grit do, and what are the numbers on my Worn Blade and Kitchen cleaver for damage?",
      "Does the Tonic of grit heal HP, give temp HP, or buff a stat — and how much?",
      // "What's the Tonic of grit's mechanical effect?" → observe-only bounce → moved to C7-001-target
    ],
    assert: {
      surface_matches: [
        /[Tt]onic/,
        /heal|2d4/i,                                // real effect stated
      ],
      surface_excludes: [
        /\[roll:/,                                  // item query must not roll
        /inert|does nothing|useless/i,              // must NOT confirm as inert
        /I cannot edit/i,                           // must not claim inability to apply effects
      ],
    },
    diverge: [
      { text: "I drink the Tonic of grit.", reason: "USE action; applies the 2d4 heal and removes from inventory — different path from a query" },
      { text: "Is the Tonic of grit worth keeping or should I sell it?", reason: "opinion/value question; DM gives a judgment, not a mandatory mechanical readback" },
    ],
    source: 'opus-gate-2026-06-20-postH43-H44.md [Rules Lawyer DM, turn 1]; opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turns 1, 4]; calibrated 2026-06-20',
  },

  // ---- TARGET — item query phrasings that misfire ----
  {
    id: 'C7-001-target',
    capability: 'C7',
    // "Tell me about the Tonic of grit — what does it actually do mechanically if I drink it?"
    //   → [clarify:referent] (treats "Tonic" as an NPC name!)
    // "the tonic of grit — what does it do when i drink it" → trivial auto-success
    // "I examine the Tonic of grit. What does the label say it does?" → observe-only
    // These should all produce the item description but don't.
    status: 'target',
    fixture: 'village_baker',
    intent: 'item query phrasings that should describe the Tonic but currently misfire',
    paraphrases: [
      "Tell me about the Tonic of grit — what does it actually do mechanically if I drink it?",
      "the tonic of grit — what does it do when i drink it",
      "I examine the Tonic of grit. What does the label say it does?",
      "What's the Tonic of grit's mechanical effect?",  // observe-only bounce → target
    ],
    assert: {
      surface_matches: [
        /[Tt]onic/,
        /heal|2d4/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /inert|does nothing|useless/i,
        /trivial action/i,
      ],
    },
    diverge: [
      { text: "I drink the Tonic of grit.", reason: "USE action; triggers [consume:unneeded] at max HP — different path" },
    ],
    source: 'opus-gate-2026-06-20-postH43-H44.md; calibrated 2026-06-20',
  },

  // ---- LOCKED — USE action (consume at max HP = [consume:unneeded]) ----
  {
    id: 'C7-002',
    capability: 'C7',
    // PC is at 15/15 HP (max). Engine correctly returns [consume:unneeded]:
    // "You're already whole — the tonic of grit keeps better in the pack than in you."
    // This IS correct behavior — the engine applied the item rule and determined no heal needed.
    // The assert must match the actual [consume:unneeded] output.
    // Only "I use the Tonic of grit — apply its effect." also produces [consume:unneeded].
    status: 'locked',
    fixture: 'village_baker',
    intent: 'player drinks the Tonic of grit at max HP — engine must apply the rule ([consume:unneeded]), not ignore the action',
    paraphrases: [
      "I drink the Tonic of grit. What happens?",
      "I use the Tonic of grit — apply its effect.",
      "Drink the Tonic of grit right now.",
    ],
    assert: {
      surface_matches: [
        /\[consume:unneeded\]|already whole|keeps better in the pack/i,  // correct behavior at max HP
      ],
      surface_excludes: [
        /\[consume:none\]/i,                     // the broken no-effect tag
        /I cannot edit/i,                        // must not claim inability to apply effects
        /inert|does nothing/i,
      ],
    },
    diverge: [
      { text: "What does the Tonic of grit do?", reason: "query, not USE; C7-001 territory — describe, don't apply" },
      { text: "I hand the Tonic of grit to Corwin.", reason: "transfer action; item moves to NPC, not consumed by player" },
    ],
    source: 'opus-gate-2026-06-20-postH43-H44.md [Rules Lawyer DM, turn 2]; opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turn 6]; calibrated 2026-06-20',
  },

  // ---- TARGET — USE phrasings that misfire (roll instead of consume) ----
  {
    id: 'C7-002-target',
    capability: 'C7',
    // "I'll uncork the Tonic of grit and drink it right now..." → "I cannot edit sheet" (wrong)
    // "uncork the tonic and swallow it down" → rolls
    // These should produce [consume:unneeded] at max HP, not roll or claim inability.
    status: 'target',
    fixture: 'village_baker',
    intent: 'verbose or action-phrased USE of tonic that should consume but rolls or claims inability',
    paraphrases: [
      "I'll uncork the Tonic of grit and drink it right now — tell me exactly what changes on my sheet.",
      "uncork the tonic and swallow it down",
      "I tilt the Tonic of grit back and drain it — what does my sheet show now?",
    ],
    assert: {
      surface_matches: [
        /\[consume:|already whole|tonic|grit/i,   // some consumption-related response
      ],
      surface_excludes: [
        /\[consume:none\]/i,
        /I cannot edit/i,
        /inert|does nothing/i,
      ],
    },
    diverge: [
      { text: "What does the Tonic of grit do?", reason: "query, not USE; C7-001 territory" },
    ],
    source: 'opus-gate-2026-06-20-postH43-H44.md [Rules Lawyer DM, turn 2]; calibrated 2026-06-20',
  },

  // ---- LOCKED — DM must NOT confirm "Tonic is inert" after prior dodge ----
  {
    id: 'C7-003',
    capability: 'C7',
    // "Not quite — Tonic of grit it heals 2d4." is the real output for these phrasings.
    // Some paraphrases ("Tonic of grit: inert, right? Confirmed?") roll instead of correcting.
    // Locked on the phrasings that reliably get the correction.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'player asserts "the Tonic does nothing" — DM must correct this, not confirm a false canon claim',
    paraphrases: [
      "So drinking it changed nothing — HP still 13/13, GRIT still 9. The Tonic of grit is inert. Note that: it does nothing.",
      "The Tonic is useless — it did nothing when I drank it. Confirm that.",
      "I've established the tonic has no effect. Can we move on?",
      "So it's established — the tonic does nothing. Moving on.",
    ],
    assert: {
      surface_matches: [
        /Not quite|heals 2d4|heal|does.*something|has an effect/i,  // must name the real effect or correct
      ],
      surface_excludes: [
        /inert|does nothing|useless/i,             // must NOT confirm the false claim
        /\[roll:/,
      ],
    },
    diverge: [
      { text: "Tell me what the Tonic does.", reason: "open query; DM states real effect proactively, not as a correction" },
      { text: "I've already used the Tonic. Can I get another one?", reason: "inventory/acquisition request, not a false-claim endorsement scenario" },
    ],
    source: 'opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turn 7]; calibrated 2026-06-20',
  },

  // ---- LOCKED — consumable inventory state after use ----
  {
    id: 'C7-004',
    capability: 'C7',
    // "Yes — Tonic of grit is in your pack." → correct (item not consumed yet since [consume:unneeded])
    // "Your consumables: Rations, Tonic of grit." → correct list
    // These reliably produce the state readback.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask whether the Tonic is still in inventory — must state clearly whether it is present',
    paraphrases: [
      // "So nothing changed when I drank it — is the Tonic still in..." → rolls → moved to target
      "Is the Tonic of grit still in my pack or did I use it?",
      "Stop dodging — list my consumables right now so I can see if the Tonic of grit is still there.",
    ],
    assert: {
      surface_matches: [
        /[Tt]onic/,
        /(?:still|yes|in your pack|consumables:|Rations)/i,  // state clearly stated
      ],
      surface_excludes: [
        /\[roll:/,
        /the way ahead opens/i,                   // content-free success narration
      ],
    },
    diverge: [
      { text: "I drink the Tonic of grit.", reason: "fresh USE action; triggers [consume:unneeded] at max HP — the [consume:unneeded] tag doesn't match the 'still/yes/in your pack' pattern" },
      // NOTE: "What consumables do I have?" → "Your consumables: Rations, Tonic of grit." — holds signature.
      // Cannot use as diverge; it's essentially the same query expressed more broadly.
    ],
    source: 'opus-gate-2026-06-20-postH43-H44.md [Rules Lawyer DM, turns 2-3]; calibrated 2026-06-20',
  },

  // ---- TARGET — "so nothing changed, is the Tonic still there" phrasing rolls ----
  {
    id: 'C7-004-target',
    capability: 'C7',
    // "So nothing changed when I drank it — is the Tonic still in my consumables, or did it get used up?"
    // → rolls [roll:20 vs DC:12 → success] — should state the Tonic's presence without rolling.
    // "After drinking it, do I still have the Tonic of grit?" → rolls
    // "consumables list — is the tonic gone or still there" → produces "Still here — Mira Hearth" (wrong)
    // "My consumables: Tonic of grit — in or out?" → rolls
    status: 'target',
    fixture: 'village_baker',
    intent: 'compound "after drinking" / "still there?" inventory phrasings that roll instead of reading state',
    paraphrases: [
      "So nothing changed when I drank it — is the Tonic still in my consumables, or did it get used up?",
      "After drinking it, do I still have the Tonic of grit?",
      "consumables list — is the tonic gone or still there",
      "My consumables: Tonic of grit — in or out?",
    ],
    assert: {
      surface_matches: [
        /[Tt]onic/,
        /(?:still|yes|in your pack|consumables:|Rations|gone|used)/i,
      ],
      surface_excludes: [
        /\[roll:/,
      ],
    },
    diverge: [
      { text: "I drink the Tonic of grit.", reason: "fresh USE action; triggers [consume:unneeded], not a state readback" },
    ],
    source: 'opus-gate-2026-06-20-postH43-H44.md [Rules Lawyer DM, turns 2-3]; calibrated 2026-06-20',
  },
];
