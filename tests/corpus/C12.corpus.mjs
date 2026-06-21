// C12 — Movement/travel intent resolves in fiction; no travel-gate bounce.
// Lineage: THE_DM_TEST residuals; playloop movement / inferInteriorAction.
// See docs/CAPABILITY_LEDGER.md.
//
// Graduated 2026-06-21 (H-62). All three cases locked 3L/0T.
//
// KEY FINDINGS (pre-graduation):
// - empty_room: Many travel phrasings produced "You know of no such place hereabouts" +
//   directional menu — incorrect. Fixed: removed "Where will you make for?" from the
//   no-such-place fallthrough (playloop.js line ~1421).
// - village_baker: "approach NPC" phrasings mostly produced [clarify:who] or spatial bounce.
//   Fixed: extended extractApproachRef to match "make my way … to <baker>"; added
//   extractFindPersonRef for "find the oldest person there"; moved talkRef extraction
//   BEFORE the isFreeMovementIntent gate so "head to X and find Y" routes to the NPC.
// - dialogue_active: Some phrasings got "That way is blocked from here" — fake spatial
//   gate. Fixed: same early-talkRef extraction causes movement-+find-person intents to
//   route to clarify/NPC before the travel gate fires.
//
// CRITICAL FIXTURE NOTE: "go north" / "where can I go" both return "That way is blocked
// from here" in empty_room — the diverge for C12-001 must NOT include these phrasings.
export default [
  // ---- LOCKED — travel to a named adjacent settlement ----
  {
    id: 'C12-001',
    capability: 'C12',
    // All paraphrases now produce engagement with the travel system:
    // "I head to Black Orchard" → "You know of no such place hereabouts. From here the
    // roads lead to Foxglove Hollow…" (no direction menu bounce)
    // "let's travel to the Old Shrine" → roll (WITS)
    // "I want to go to the neighboring settlement." → roll
    // "I set out toward Dry Creek." → roads narration
    // "head to the shrine down the road" → roads narration
    // "Let's go — I'm heading to the next town." → roll
    status: 'locked',
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
      { text: "Where can I go from here?", reason: "survey query, not a travel declaration; must list exits, not resolve a journey — gives 'That way is blocked' in empty_room (no exits from the room)" },
    ],
    source: 'stageC2-travel-2026-06-05.md [Skeptic]; opus-gate-2026-06-19-postH42-baseline.md [Lore-hound, turn 5]; calibrated + locked H-62 2026-06-21',
  },

  // ---- LOCKED — movement intent toward a present NPC ----
  {
    id: 'C12-002',
    capability: 'C12',
    // After H-62 engine changes, all 5 paraphrases route to Mira Hearth:
    // "I head to the village tavern and find the oldest person there." → NPC encounter
    //   (extractFindPersonRef + early talkRef gate; "You step out into the open air. You approach Mira Hearth...")
    // "I go over to Corwin and talk to him." → [clarify:who] + "Mira Hearth. Who do you mean?"
    // "I make my way across the room to where the baker is standing." → NPC encounter
    //   (extractApproachRef "make my way … to" extension)
    // "Head over to the trader — I want to speak with her." → [clarify:who] + "Mira Hearth"
    // "I approach Corwin directly." → [clarify:who] + "Mira Hearth is here"
    //
    // Diverge surface_matches use word-boundaries and "You approach" (not bare "approach")
    // to prevent false-positives against "across" (in scenic look-around) and
    // "approach:finesse" (in stealth roll mechanics).
    status: 'locked',
    fixture: 'village_baker',
    intent: '"I head to the tavern and find the oldest person" — must resolve the meeting, not bounce with a direction menu',
    paraphrases: [
      "I head to the village tavern and find the oldest person there.",
      "I go over to Corwin and talk to him.",
      "I make my way across the room to where the baker is standing.",
      "Head over to the trader — I want to speak with her.",
      "I approach Corwin directly.",
    ],
    assert: {
      surface_matches: [
        /Mira Hearth|You approach|\bwalk\b|\bcross\b|\breach\b|\barrive\b|\bfind\b|\bmeet\b|\bface\b|\bbaker\b|dialogue/i,
      ],
      surface_excludes: [
        /Where will you make for\?/i,
        /You know of no such place/i,            // must not deny the player's own location
      ],
    },
    diverge: [
      { text: "Where's the tavern?", reason: "location query (C4/C6 territory); asks for directions — produces scenic look-around, not an NPC encounter; 'across' in 'eyes move slow across the corner' must NOT match via \\bcross\\b" },
      { text: "I sneak up on Corwin without him noticing.", reason: "stealth approach; produces [roll: ... approach:finesse] — 'approach:finesse' in mechanics must NOT match via bare 'approach'" },
    ],
    source: 'opus-gate-2026-06-19-postH42-baseline.md [Lore-hound, turn 5]; stageC-movement-2026-06-05.md; locked H-62 2026-06-21',
  },

  // ---- LOCKED — movement blocked by fake travel-gate ----
  {
    id: 'C12-003',
    capability: 'C12',
    // In dialogue_active, all movement-toward-Brae intents either exit dialogue +
    // clarify (Brae ungrounded) or exit dialogue + re-enter with Mira Hearth.
    // "That way is blocked from here" must never appear for movement intent.
    //
    // "I approach the guard near the door." stays in dialogue (isDialogueBreakingIntent
    // returns false for bare "approach"); NPC deflects with "Couldn't say." — same
    // output as both range-question and shout diverges. Moved to diverge.
    //
    // surface_matches narrowed to patterns that ONLY appear in exit+clarify outputs,
    // not in the pure "NPC says Couldn't say" dialogue path that all three diverges share.
    status: 'locked',
    fixture: 'dialogue_active',
    intent: '"I want to talk to Brae about the bandit" — must not be blocked with a fake spatial gate',
    paraphrases: [
      "Okay, um, can I go talk to that guard, Brae, about the bandit?",
      "I make my way to where Brae is standing.",
      "I walk over to the guard.",
      "Can I go talk to Brae?",
      "I head toward Brae's post.",
    ],
    assert: {
      // Patterns that appear in the real outputs but NOT in the "Couldn't say" deflection:
      // "You step away" — exits dialogue before resolving
      // "You approach Mira" — re-enters NPC encounter after exit
      // "no one named" — clarify for unknown Brae
      // "clarify" — mechanics tag for clarify path
      // "introduced.*Brae" — specific referent clarify for Brae
      // "Can't say I know" — NPC direction-answer (for "make my way to where Brae is standing")
      surface_matches: [
        /You step away|You approach Mira|no one named|clarify|introduced.*Brae|Can't say I know/i,
      ],
      surface_excludes: [
        /That way is blocked from here/i,         // the exact fake spatial gate from the gate failure
        /blocked from here/i,
      ],
    },
    diverge: [
      { text: "Can Brae hear me from here?", reason: "range/perception question, not a movement intent; stays in dialogue — NPC gives 'Couldn't say' deflection, same as diverges 2-3" },
      { text: "I shout at Brae across the room.", reason: "ranged communication; movement not declared; stays in dialogue — NPC gives 'Couldn't say' deflection" },
      { text: "I approach the guard near the door.", reason: "in dialogue_active, bare 'approach' stays in dialogue (isDialogueBreakingIntent misses it); NPC gives 'Couldn't say' deflection — indistinguishable from diverges 1-2" },
    ],
    source: 'opus-gate-2026-06-20-postH54-H55.md [Confused newbie, turns 7-8]; stageC-movement-2026-06-05.md [findings]; locked H-62 2026-06-21',
  },

  // ---- LOCKED — "point me to <NPC>" is directions, not a blade-threat ----
  {
    id: 'C12-004',
    capability: 'C12',
    // Root cause: detectPhysicalAssault branch C ("a blade brought TO the body")
    // matched "point" as BOTH the weapon-noun ("point" in the blade-part list)
    // AND the bring-verb ("point" in press/hold/.../point/thrust list), so
    // "point me to Mira" + trailing "to Mira" satisfied all three legs and
    // mis-fired a real strike on the NPC. Fix: removed "point"/"edge" (blade
    // PARTS, not weapons) from the weapon-noun alternation — a genuine
    // blade-threat must still name a real weapon ("dagger", "sword", etc).
    // Post-fix outputs (village_baker, LLM off): all five paraphrases resolve
    // as an ordinary skill roll or scenic observe — never [strike:.
    status: 'locked',
    fixture: 'village_baker',
    intent: '"point me to <NPC>" is a directions/navigation request — must never be mis-detected as a blade brought to the body and start combat',
    paraphrases: [
      "Can you point me to Mira the baker?",
      "point me to Mira",
      "Can you point me to the baker?",
      "point me to the elder",
      "show me the way to Mira",
    ],
    assert: {
      surface_matches: [
        /roll|observe only|Wizard:/i,
      ],
      surface_excludes: [
        /\[strike:/i,
        /swing your worn blade/i,
        /\[combat/i,
      ],
    },
    diverge: [
      { text: "I point my sword at the baker.", reason: "a real weapon noun (sword) is named — genuine blade-threat, must still resolve as a strike" },
      { text: "I press my dagger to her throat.", reason: "a real weapon noun (dagger) is named — genuine blade-threat, must still resolve as a strike" },
    ],
    source: 'opus-gate-2026-06-21.md [Confused newbie, turn 5]; H-75',
  },
];
