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

  // ---- LOCKED (H-65) — item query phrasings that used to misfire ----
  {
    id: 'C7-001-target',
    capability: 'C7',
    // GRADUATED H-65 (target → locked): META_ITEM_QUERY now routes these in the
    // meta path, PREEMPTING the referent guard that used to capture "Tonic" as a
    // fabricated NPC. All four now answer "Tonic of grit — it heals 2d4."
    // Before H-65:
    // "Tell me about the Tonic of grit — what does it actually do mechanically if I drink it?"
    //   → [clarify:referent] (treated "Tonic" as an NPC name)
    // "the tonic of grit — what does it do when i drink it" → trivial auto-success
    // "I examine the Tonic of grit. What does the label say it does?" → observe-only
    // "What's the Tonic of grit's mechanical effect?" → observe-only
    status: 'locked',
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

  // ---- LOCKED (H-69) — action-phrased USE, noun-before-verb order ----
  // CONSUME_RE widened (H-69) to also match noun-before-verb order plus
  // "uncork", so this reaches tryUseConsumable and correctly resolves
  // [consume:unneeded] at max HP instead of falling through to a roll.
  {
    id: 'C7-002a',
    capability: 'C7',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'action-phrased USE of tonic (noun-before-verb order) must consume, not roll',
    paraphrases: [
      "uncork the tonic and swallow it down",
    ],
    assert: {
      surface_matches: [
        /\[consume:|already whole/i,   // consume-specific signature only — no bare /tonic|grit/
      ],
      surface_excludes: [
        /\[consume:none\]/i,
        /I cannot edit/i,
        /inert|does nothing/i,
      ],
    },
    diverge: [
      { text: "What does the Tonic of grit do?", reason: "query, not USE; C7-001 territory — describe, don't apply" },
    ],
    source: 'opus-gate-2026-06-20-postH43-H44.md [Rules Lawyer DM, turn 2]; calibrated 2026-06-20; widened H-69',
  },

  // ---- TARGET — USE phrasings that trip the stat-sheet meta gate first ----
  // DEFERRED to the meta-gate-precedence packet (shared root cause: C8-001,
  // C10-002) — the "...what changes on my sheet" rider trips the grace
  // stat-sheet meta intercept ("I cannot edit them") BEFORE tryUseConsumable
  // ever runs. Out of scope for H-69 (playloop CONSUME_RE lane only).
  {
    id: 'C7-002b',
    capability: 'C7',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'verbose USE of tonic with a "what changes on my sheet" rider — should consume, not claim inability',
    paraphrases: [
      "I'll uncork the Tonic of grit and drink it right now — tell me exactly what changes on my sheet.",
      "I tilt the Tonic of grit back and drain it — what does my sheet show now?",
    ],
    assert: {
      surface_matches: [
        /\[consume:|already whole/i,
      ],
      surface_excludes: [
        /\[consume:none\]/i,
        /I cannot edit/i,
        /inert|does nothing/i,
      ],
    },
    diverge: [
      { text: "What does the Tonic of grit do?", reason: "query, not USE; C7-001 territory — describe, don't apply" },
      { text: "What's on my sheet?", reason: "bare sheet query, no consume cue — must stay the stat-block readout, not [consume:]" },
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

  // ---- LOCKED (H-65) — "so nothing changed, is the Tonic still there" phrasings ----
  {
    id: 'C7-004-target',
    capability: 'C7',
    // GRADUATED H-65 (target → locked): META_ITEM_PRESENCE + a widened
    // META_CONSUMABLES_LIST now read inventory state for these. The
    // "is the tonic gone or still there" phrasing additionally gets a guard on
    // the NPC-presence branch so it no longer answers "Still here — Mira Hearth"
    // (the item-presence query preempts the NPC-presence path when it names a
    // real carried item). Before H-65:
    // "So nothing changed when I drank it — is the Tonic still in my consumables, or did it get used up?"
    //   → rolls [roll:20 vs DC:12 → success]
    // "After drinking it, do I still have the Tonic of grit?" → rolls
    // "consumables list — is the tonic gone or still there" → "Still here — Mira Hearth" (wrong)
    // "My consumables: Tonic of grit — in or out?" → rolls
    status: 'locked',
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

  // ---- LOCKED (H-70) — dose/quantity count query ----
  {
    id: 'C7-005',
    capability: 'C7',
    // Gate finding 2026-06-21: "how many doses do I have" was swallowed by the
    // presence branch's own "do i have" alternative ("Yes — ... is in your
    // pack."), with no number stated. Root cause: no count branch existed.
    // Fixed (H-70): a dedicated count branch, checked before presence,
    // reports the real entry count off the pack ("You have one Tonic of
    // grit." — the data carries no per-item dose field, so a single-entry
    // consumable is honestly "one", never an invented dose number).
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask how many of a named consumable are carried — must state the real count, not just presence',
    paraphrases: [
      "how many doses of Tonic of grit do I have?",
      "How many doses of the Tonic of grit am I carrying?",
      "How many Tonics of grit do I have in my pack?",
    ],
    assert: {
      surface_matches: [
        /[Tt]onic/,
        /\bone\b/i,                                  // real count (single carried entry)
      ],
      surface_excludes: [
        /\[roll:/,
        /^Yes — Tonic of grit is in your pack\.?$/i,  // bare presence non-answer — count must be stated
        /Cloak/i,                                     // must not false-match "Cloak of many patches" via "many"
      ],
    },
    diverge: [
      { text: "Do I still have the Tonic of grit?", reason: "presence query (no 'how many') — the existing 'in your pack' answer is correct and must NOT become a count" },
    ],
    source: 'opus-gate-2026-06-21.md; H-70',
  },

  // ---- LOCKED (H-70) — compound effect + dose-count query ----
  {
    id: 'C7-006',
    capability: 'C7',
    // Gate finding 2026-06-21: "What does the Tonic of grit do, and how many
    // doses do I have?" answered only "Yes — Cloak of many patches and Tonic
    // of grit are in your pack." — no effect, no count, and a false Cloak
    // match via the query word "many" overlapping its name. Fixed (H-70):
    // the count branch detects the compound "what does ... do" cue and folds
    // the real effect line in with the real count, for the Tonic only.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'compound ask — what the Tonic does AND how many doses — must answer both, for the right item only',
    paraphrases: [
      "What does the Tonic of grit do, and how many doses do I have?",
    ],
    assert: {
      surface_matches: [
        /heals?\s*2d4|heal/i,                         // real effect stated
        /\bone\b/i,                                   // real count
      ],
      surface_excludes: [
        /\[roll:/,
        /Cloak/i,                                      // must not false-match via "many"
      ],
    },
    diverge: [
      { text: "What does the Tonic of grit do?", reason: "effect-only query, no 'how many' — C7-001 territory, no count line expected" },
    ],
    source: 'opus-gate-2026-06-21.md; H-70',
  },

  // ---- LOCKED (H-73) — bare consumable-count query, no item named ----
  {
    id: 'C7-007',
    capability: 'C7',
    // Gate finding 2026-06-21: "how many doses do I have" names no specific
    // item, so H-70's per-item fold in answerItemQuery finds nothing and
    // returns null — the message fell through every branch to observe-only
    // ("Your eyes move slow across this corner..."). Fixed (H-73): when the
    // count cue fires with a generic consumable word (doses/consumables/
    // potions/etc.) but no carried item matched, list the real per-item
    // counts off the pack instead of falling through.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'bare "how many doses/consumables" with no item named — must list real per-item counts, not fall through to observe',
    paraphrases: [
      "how many doses do I have",
      "How many doses do I have on me right now?",
      "how many consumables am I carrying?",
    ],
    assert: {
      surface_matches: [
        /Tonic/i,
        /Rations/i,
        /×\d|\b1\b|\bone\b/i,                          // a count token, not just names
      ],
      surface_excludes: [
        /\[roll:/,
        /observe only/i,
      ],
    },
    diverge: [
      { text: "how many doses of Tonic of grit do I have?", reason: "NAMED item count (H-70) — must answer for the Tonic only, not become the full list" },
    ],
    source: 'opus-gate-2026-06-21.md; H-73',
  },

  // ---- LOCKED (H-77) — cross-item compound: effect + count, different items ----
  {
    id: 'C7-008',
    capability: 'C7',
    // Gate finding: "What's the Tonic of grit do — and how many bandages do I
    // have?" lost the Tonic's effect, answering counts only. Root cause:
    // answerItemQuery's count branch (ITEM_COUNT_RE) already appends an
    // effect line when wantsEffect is true, but the old ITEM_EFFECT_CUE_RE
    // (/\bwhat\s+(?:does|do|is|are)\b/) doesn't match the "what's X do"
    // contraction — "what's" has no space before the verb. Widened to add a
    // second alternative for the contraction. (H-77)
    status: 'locked',
    fixture: 'village_baker',
    intent: 'compound ask — Tonic effect AND Rations count, two different items — both must be answered',
    paraphrases: [
      "What's the Tonic of grit do — and how many rations do I have?",
      "What's the Tonic of grit do exactly, and how many rations am I carrying?",
      "What does the Tonic of grit do, and how many rations do I have?",
      "Quick — what's the Tonic of grit do, and how many rations do I have on me?",
      "Remind me — what's the Tonic of grit do, plus how many rations do I have?",
    ],
    assert: {
      surface_matches: [
        /heal|2d4/i,                                 // Tonic's real effect, not dropped
        /Rations/i,
        /\bone\b|\b1\b/i,                            // a real count, not just the name
      ],
      surface_excludes: [
        /\[roll:/,
      ],
    },
    diverge: [
      { text: "how many rations do I have?", reason: "pure count, no effect cue — count only, no effect line" },
      { text: "What does the Tonic of grit do?", reason: "pure effect ask, no count cue — effect only, no count line" },
    ],
    source: 'H-77 dispatch; calibrated 2026-06-21',
  },

  // ---- LOCKED (H-77) — effect-demand phrasing tail ("give/tell me ... or flag undefined") ----
  {
    id: 'C7-009',
    capability: 'C7',
    // Gate finding: "give me the Tonic's mechanical effect or flag it as
    // undefined" fell to a generic roll — none of META_ITEM / _CAPABILITY /
    // _QUERY match a message that opens "give me..." instead of "what...".
    // New ITEM_EFFECT_DEMAND_RE catches the "give/tell me ... effect" and
    // "tell me ... what X does" demand shapes; answerItemQuery's existing
    // effect branch does the rest. (H-77)
    status: 'locked',
    fixture: 'village_baker',
    intent: 'demand-phrased effect ask ("give/tell me the effect or flag it undefined") — must answer the real effect, never roll',
    paraphrases: [
      "give me the Tonic's mechanical effect or flag it as undefined",
      "tell me exactly what the Tonic does or say it's undefined",
      "give me the Tonic of grit's effect, or flag it as undefined if there isn't one",
      "tell me the Tonic's mechanical effect — or flag it as undefined",
      "give me the Tonic of grit's real effect or say it's undefined",
    ],
    assert: {
      surface_matches: [
        /heal|2d4/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /undefined/i,                                // a real def exists — must never claim it's undefined
      ],
    },
    diverge: [
      { text: "I roll WITS to read him — what's the DC?", reason: "declared check; must route to the check, not the item-effect demand path" },
    ],
    source: 'H-77 dispatch; calibrated 2026-06-21',
  },

  // ---- LOCKED — item-effect wins when the question also names a stat (N-3) ----
  {
    id: 'C7-010',
    capability: 'C7',
    // gate-7 RL t2/t5: "what's the Tonic do — does it boost my GRIT?" matched
    // META_STAT ("my GRIT") and answered the bare stat readout ("Your GRIT is 12")
    // before the item-effect branch. N-3: when a REAL carried item is named, the
    // item-effect answer wins over the stat readout. Standalone stat queries (and
    // "what does my GRIT do?", no real item) keep the stat — see diverge.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'an item-effect question that also names a stat states the item effect, not the bare stat/HP readout',
    paraphrases: [
      "What's the Tonic of grit do, mechanically — does it boost my GRIT, and for how long?",
      'Does the Tonic restore HP, give a GRIT bonus, or temporary hit points?',
      'mechanically, what does the Tonic of grit do for my HP?',
      'what does the Tonic of grit do to my stats?',
      'What does the Tonic of grit do — does it raise my GRIT?',
    ],
    assert: {
      surface_matches: [ /2d4|heals/i ],
      surface_excludes: [ /\[roll:/, /GRIT is \d|WITS is \d|a [+-]?\d+ modifier/i ],
    },
    diverge: [
      { text: "what's my GRIT?", reason: 'standalone stat query → the stat readout, not an item effect' },
      { text: 'what does my GRIT do?', reason: 'stat phrased with "do", no real item named → stat readout' },
    ],
    source: 'opus-gate-2026-06-21.md (gate 7 RL t2/t5) — stat name inside an item-effect question hijacked the stat readout; fixed N-3',
  },
];
