// C8 — Narration ≤ mechanics: no hit/defeat the dice didn't produce.
// Lineage: H-26/H-28/H-43; llmAdapter validator R1-R3. See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20.
//
// KEY FINDINGS:
// - In active_combat, nearly all attack phrasings produce [strike:Worn Blade | atk:X vs AC:10 → miss]
//   with consistent narration. The attack IS resolved with real mechanics. This is correct C8 behavior.
// - The gate failure mode ([combat:table-talk] with narrated kills) is reliably excluded.
// - C8-001 paraphrase 2 verbatim "I attack Corwin with my worn blade. Roll it..." → [combat:table-talk]
//   (the RL modifier-table path). That specific phrasing is moved to target.
// - C8-002: The seeded engine always produces a miss (atk:2 vs AC:10). A miss still validates
//   that mechanics and narration agree — narration says "miss" and mechanics say "→ miss".
//   This is the correct assertion for C8-002.
// - C8-003: Miss narration correctly does NOT invent a counter-hit — verified locked.
export default [
  // ---- LOCKED — attack produces a real roll (not table-talk with narrated kill) ----
  {
    id: 'C8-001',
    capability: 'C8',
    // These phrasings reliably produce [strike:Worn Blade | atk:X vs AC:10 → miss].
    // The narration says "miss" and the mechanics say "→ miss" — agreement.
    // No [combat:table-talk] on these phrasings.
    status: 'locked',
    fixture: 'active_combat',
    intent: 'player attacks a live enemy — narration must not describe a kill that mechanics did not produce',
    paraphrases: [
      "Who's the Lingerer? I spin and bury my blade in Corwin's throat to finish him.",
      "I drive my blade into the enemy's side.",
      "Strike — worn blade, full force.",
      "I swing at the foe with everything I have.",
      "Attack — I bring the blade down on the enemy.",
    ],
    assert: {
      surface_matches: [
        /\[strike:[^\]]*→\s*(?:hit|miss)\]/i,   // attack resolved with a real outcome tag
      ],
      surface_excludes: [
        /\[combat:table.talk\]/i,                // table-talk tag must not appear on an attack
        /crumples.*final.*rattling|rattling exhale|irrevocably down/i,  // death-narration without roll
      ],
    },
    diverge: [
      // NOTE: In active_combat, nearly all actions trigger a combat round with enemy counter "misses".
      // Diverges must use actions that produce [combat:r2] without a [strike:] tag.
      { text: "I parley with the enemy.", reason: "parley attempt; produces [combat:r2] with 'does not bargain' — no [strike:] tag fires" },
      { text: "I take cover.", reason: "defensive action; produces [combat:r2] positioning — no [strike:] tag fires" },
    ],
    source: 'opus-gate-2026-06-20-postH45-H46.md [Chaos-griefer, turn 8]; opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turn 7]; calibrated 2026-06-20',
  },

  // ---- TARGET — the verbatim RL modifier-table phrasing routes to table-talk ----
  {
    id: 'C8-001-target',
    capability: 'C8',
    // Real output: "Modifier breakpoints: 9 → −1... [combat:table-talk]"
    // FIXED (H-72): attackResolutionIntent() now lets a declared attack carrying a
    // stats rider resolve to a real strike instead of the modifier table-talk.
    // (Engine fix landed in H-72; Basecamp promoted this case to locked on §7-verify.)
    status: 'locked',
    fixture: 'active_combat',
    intent: 'verbatim RL gate phrasing for attack — must produce a real roll, currently routes to modifier table-talk',
    paraphrases: [
      "I attack Corwin with my worn blade. Roll it — give me the d20, the modifier, the total, and his resulting HP.",
    ],
    assert: {
      surface_matches: [
        /\[strike:[^\]]*→\s*(?:hit|miss)\]/i,
      ],
      surface_excludes: [
        /\[combat:table.talk\]/i,
      ],
    },
    diverge: [
      { text: "I reach for my weapon.", reason: "drawing action, not an attack" },
    ],
    source: 'opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turn 7]; calibrated 2026-06-20',
  },

  // ---- LOCKED — narration and mechanics agree on outcome ----
  {
    id: 'C8-002',
    capability: 'C8',
    // All attack phrasings produce a real strike tag with a deterministic outcome (miss in this seed).
    // The assertion: mechanics must carry a [strike:...] tag, meaning a real roll happened.
    // Narration says "miss" and mechanics say "→ miss" — they agree. No invented kill.
    status: 'locked',
    fixture: 'active_combat',
    intent: 'attack must carry a real mechanics tag — narration must not diverge from the dice outcome',
    paraphrases: [
      "I swing hard at the enemy.",
      "Strike with the worn blade — full damage.",
      "I hit the enemy — tell me the damage dealt.",
      "I attack and connect. How much does it hurt them?",
      "Worn blade into the enemy's side — roll the damage.",
    ],
    assert: {
      surface_matches: [
        /\[strike:[^\]]*→\s*(?:hit|miss)\]/i,   // a real mechanics tag — roll actually happened
      ],
      surface_excludes: [
        /\[combat:table.talk\]/i,
      ],
    },
    diverge: [
      // NOTE: In active_combat nearly all actions trigger a combat round. Must use defensive/parley
      // actions that produce [combat:r2] without [strike:] tag.
      { text: "I ward.", reason: "defensive spell; produces [ward | AC:15 | combat:r2] — no [strike:] tag fires" },
      { text: "I take cover.", reason: "positioning action; produces [combat:r2] — no [strike:] tag" },
    ],
    source: 'opus-gate-2026-06-20-postH29-H30.md [Chaos-griefer]; opus-gate-2026-06-20-postH45-H46.md [Chaos-griefer, turns 7-8]; calibrated 2026-06-20',
  },

  // ---- LOCKED — miss narration must not show a counter-hit on the player ----
  {
    id: 'C8-003',
    capability: 'C8',
    // Real output for all miss phrasings:
    // "You swing your worn blade at the Lingerer and miss. (...) The Lingerer lunges and misses. (You: 12 HP) [strike:... → miss]"
    // The "Lingerer lunges and misses" is correct — the enemy also misses; no damage on player.
    // The gate failure mode was narrating "elbow cracking into jaw" with no enemy attack roll.
    // That does NOT appear in real output. Locked.
    status: 'locked',
    fixture: 'active_combat',
    intent: 'player attack rolls a miss — narration must not describe enemy dealing damage to player with no enemy roll',
    paraphrases: [
      "I lunge and smash my fist straight into Corwin's nose.",
      "I swing at the foe and miss — what happens?",
      "I throw the punch — it goes wide.",
      "I swing and it doesn't connect.",
    ],
    assert: {
      surface_matches: [
        /miss|wide|fails to connect|doesn.t land/i,    // miss acknowledged
      ],
      surface_excludes: [
        /elbow cracking.*jaw|counterstrik/i,            // invented counter-hit from gate failure
        /clips you.*\d+\s*damage|lands.*\d+\s*damage/i, // damage described without a roll
      ],
    },
    diverge: [
      // NOTE: Enemy counter "lunges and misses" fires on most combat actions, containing "miss".
      // Pure status queries (no combat round triggered) avoid the "misses" text entirely.
      // "I ward." → "lunges and misses" — contains "miss", would hold signature. Can't use.
      { text: "What's the enemy's HP?", reason: "status query; produces table-talk with HP info and no 'miss' narration — a different response type than a player attack exchange" },
    ],
    source: 'opus-gate-2026-06-19-postH35.md [Chaos-griefer, turn 4]; opus-gate-2026-06-19-postH39.md [Chaos-griefer, turn 2]; calibrated 2026-06-20',
  },
];
