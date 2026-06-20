// C12 — Movement/travel intent resolves in fiction; no travel-gate bounce.
// Lineage: THE_DM_TEST residuals; playloop movement / inferInteriorAction.
// See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20.
//
// KEY FINDINGS:
// - empty_room: Many travel phrasings produce "You know of no such place hereabouts" +
//   directional menu — incorrect. Some produce a roll (also incorrect for a named place).
//   A few phrasings DO route to the nodes properly ("I want to go to the neighboring settlement." → rolls
//   but at least engages the travel system, not a hard bounce).
// - village_baker: "approach NPC" phrasings mostly produce [clarify:who] or [clarify:referent]
//   (fabricated names) or spatial bounce. "I make my way across the room to where the baker is
//   standing." → rolls a WITS check. "I go over to Corwin and talk to him." → [clarify:who].
// - dialogue_active: Some phrasings get NPC asking "Can't say I know the place" (correct in-fiction
//   for an unknown place Brae), some get movement to a new dialogue entry, some redirect.
//
// CRITICAL FIXTURE NOTE: "go north" / "where can I go" both return "That way is blocked from here"
// in empty_room — the diverge for C12-001 must NOT include these phrasings.
export default [
  // ---- TARGET — travel to a named adjacent settlement ----
  {
    id: 'C12-001',
    capability: 'C12',
    // Real output: most phrasings produce "You know of no such place hereabouts. From here the roads
    // lead to Foxglove Hollow to the north and Sooted Bridge to the east. Where will you make for?"
    // That IS a directional menu bounce — the failure mode. Target until the engine resolves named travel.
    // Exception: "I want to go to the neighboring settlement." rolls a WITS check without bouncing.
    status: 'target',
    fixture: 'empty_room',
    intent: 'player says "I head to <named neighbor>" — must arrive or describe the journey, never bounce with a direction menu',
    paraphrases: [
      "I head to Black Orchard",
      "let's travel to the Old Shrine",
      "I want to go to the neighboring settlement.",
      "I set out toward Dry Creek.",
      "head to the shrine down the road",
      "Let's go — I'm heading to the next town.",
    ],
    assert: {
      // Either arrival narration, an in-fiction "no such place" from an NPC/world, OR engagement
      // with the travel system (roll) — as long as no direction menu bounced back.
      surface_matches: [
        /(?:road|journey|arrive|reach|sets? out|ahead|Foxglove|Sooted|Dry Creek|roll.*DC|travel)/i,
      ],
      surface_excludes: [
        /You know of no such place hereabouts.*Where will you make for/i,  // exact bounce pattern
        /Where will you make for\?/i,
      ],
    },
    diverge: [
      { text: "Where can I go from here?", reason: "survey query, not a travel declaration; must list exits, not resolve a journey — currently gives 'That way is blocked'" },
    ],
    source: 'stageC2-travel-2026-06-05.md [Skeptic]; opus-gate-2026-06-19-postH42-baseline.md [Lore-hound, turn 5]; calibrated 2026-06-20',
  },

  // ---- TARGET — movement intent toward a present NPC ----
  {
    id: 'C12-002',
    capability: 'C12',
    // Real output for "I go over to Corwin and talk to him." → [clarify:who] (no Corwin present)
    // "I walk up to Kael." → [clarify:referent] (Kael not in fixture)
    // "I make my way across the room to where the baker is standing." → rolls WITS
    // "Head over to the trader..." → [clarify:who]
    // "I approach Corwin directly." → [clarify:who]
    // Only paraphrases that name the real NPC (Mira Hearth) or role (baker) should resolve correctly.
    // "I head to the village tavern and find the oldest person there." → leaves scene (spatial bounce).
    // Target: all should resolve the social encounter, not bounce or clarify.
    status: 'target',
    fixture: 'village_baker',
    intent: '"I head to the tavern and find Kael" — must resolve the meeting, not bounce with a direction menu',
    paraphrases: [
      "I head to the village tavern and find the oldest person there.",
      "I go over to Corwin and talk to him.",
      "I make my way across the room to where the baker is standing.",
      "Head over to the trader — I want to speak with her.",
      "I approach Corwin directly.",
    ],
    assert: {
      // Must not be a hard direction-menu bounce or [clarify:who] for an approach.
      // An actual interaction outcome (NPC dialogue, roll, social) is required.
      surface_matches: [
        /Mira Hearth|approach|walk|cross|reach|arrive|find|meet|face|baker|dialogue/i,
      ],
      surface_excludes: [
        /Where will you make for\?/i,
        /You know of no such place/i,            // must not deny the player's own location
      ],
    },
    diverge: [
      { text: "Where's the tavern?", reason: "location query (C4/C6 territory); asks for directions, not movement" },
      { text: "I sneak up on Corwin without him noticing.", reason: "stealth approach; routes to a WITS/AGILITY check, not trivial movement" },
    ],
    source: 'opus-gate-2026-06-19-postH42-baseline.md [Lore-hound, turn 5]; stageC-movement-2026-06-05.md; calibrated 2026-06-20',
  },

  // ---- TARGET — movement blocked by fake travel-gate ----
  {
    id: 'C12-003',
    capability: 'C12',
    // "Okay, um, can I go talk to that guard, Brae, about the bandit?" (verbatim gate input) →
    //   "You step away from Mira Hearth. There's no one named Brae here — Mira Hearth is here."
    //   [clarify:who] — this is correct C2 behavior (Brae is ungrounded). NOT a fake spatial gate.
    // However: "I head toward Brae's post." → leaves scene + "You know of no such place"
    // "I make my way to where Brae is standing." → Mira Hearth answers directions [dialogue ask | directions]
    // "I walk over to the guard." → enters dialogue with Mira Hearth (closest matching NPC)
    // The actual H-56 failure ("That way is blocked from here") appears on "I head toward Brae's post."
    // Real behavior is mixed. Keep as target; assert excludes the fake gate blocker.
    // REVIEW: Some paraphrases (those naming "Brae") correctly fire C2 [clarify:referent].
    // C12-003 is about the *movement* aspect — spatial blocking is wrong, referent-clarify is C2.
    // The assert should not require C2-style clarify (that's a different capability).
    status: 'target',
    fixture: 'dialogue_active',
    intent: '"I want to talk to Brae about the bandit" — must not be blocked with a fake spatial gate',
    paraphrases: [
      "Okay, um, can I go talk to that guard, Brae, about the bandit?",
      "I make my way to where Brae is standing.",
      "I walk over to the guard.",
      "Can I go talk to Brae?",
      "I head toward Brae's post.",
      "I approach the guard near the door.",
    ],
    assert: {
      // Must not be a fake spatial block. Some resolution — even [clarify:referent] for Brae
      // or entering dialogue with the present NPC — is acceptable.
      surface_matches: [
        /Mira Hearth|Brae|guard|approach|dialogue|Couldn.t say|clarify|no one named/i,
      ],
      surface_excludes: [
        /That way is blocked from here/i,         // the exact fake spatial gate from the gate failure
        /blocked from here/i,
      ],
    },
    diverge: [
      { text: "Can Brae hear me from here?", reason: "range/perception question, not a movement intent" },
      { text: "I shout at Brae across the room.", reason: "ranged communication; movement not declared" },
    ],
    source: 'opus-gate-2026-06-20-postH54-H55.md [Confused newbie, turns 7-8]; stageC-movement-2026-06-05.md [findings]; calibrated 2026-06-20',
  },
];
