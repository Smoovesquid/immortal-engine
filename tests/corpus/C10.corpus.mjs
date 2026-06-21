// C10 — A declared attack on a present/role/named NPC routes to combat.
// Lineage: H-30/H-32/H-43/H-48/H-55/H-64; playloop attack gates, resolveEscapeCombatTurn.
// See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20.
//
// KEY FINDINGS (pre-H-64):
// In village_baker (NPC = Mira Hearth, baker):
// - Direct name/role attacks ("I stab the baker", "I attack the baker") → [strike:Worn Blade | atk:5 vs AC:10 → miss]
// - "blade out, go for throat" → "That way is blocked from here." (fake spatial gate)
// - "attack the nearest NPC" → [no-target] (NPC not recognized as combat target by generic phrasing)
// - "I take a swing at whoever's standing nearest" → [no-target]
// - Shoves: some route to strike, some to generic [roll:] (not combat), one to [social:intimidate]
// These failures are marked target.
//
// In active_combat (enemy = Lingerer):
// - Direct attacks reliably produce [strike:Worn Blade | atk:2 vs AC:10 → miss]
// - "I go for the kill on Corwin" → [combat:table-talk] (wrong target name deflects to table-talk)
//
// H-64: closed the "go for X" attack idiom (was eaten whole by the interior
// movement gate's "go <roomId>" capture before combat-begin ever ran — same
// root cause behind both the fake spatial-gate AND the active-combat
// table-talk deflection), added "npc"/"npcs" as a generic person referent so
// "attack the nearest NPC" resolves like "attack the nearest person", and
// added a flip/tip/topple/dump-onto pattern so an improvised-weapon attack
// where the prop (not the person) is the verb's direct object ("flip the
// counter onto her") is recognized as violence instead of a trivial
// environmental auto-success. C10-001-target and C10-004b promoted to
// locked. C10-002-target's first paraphrase ("I go for the kill on Corwin")
// now resolves to real combat; its second paraphrase is still blocked by an
// out-of-lane issue shared with C8 (a "give me the d20/modifier" rules-lawyer
// framing wins the meta-question gate ahead of the combat-attack gate) — left
// as target with a REVIEW note rather than touching the shared meta-question
// gate. C10-003-target (shove misroutes) was not named in H-64's scope and is
// untouched.
export default [
  // ---- LOCKED — lethal attack on named NPC/role (baker) starts combat ----
  {
    id: 'C10-001',
    capability: 'C10',
    // "I stab the baker" and "I attack the baker" produce [strike:Worn Blade | atk:5 vs AC:10 → miss].
    // "I let go of his collar and stomp on his skull..." → [strike:Stomp | atk:5 vs AC:10 → miss].
    // "A dream? Then I grab his cloth..." → [grapple:clinch-miss | ...] — grapple, not strike.
    //   Updated: assert matches both [strike:] and [grapple:] tags — both are real combat resolution.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'player declares a direct attack on the baker by role/name — combat must start with a real roll',
    paraphrases: [
      "I let go of his ankles, draw my dagger, and stab the baker in the gut.",
      "I stab the baker.",
      "I attack the baker.",
      "I let go of his collar and stomp on his skull while he's down.",
    ],
    assert: {
      surface_matches: [
        /\[(?:strike|grapple):[^\]]*→\s*(?:hit|miss|clinch-miss|clinch-hit)\]/i,   // real combat resolution
      ],
      surface_excludes: [
        /\[combat:table.talk\]/i,
        /without difficulty/i,                   // auto-success on a lethal attack
        /\[no-target\]/i,                        // NPC not found as target
      ],
    },
    diverge: [
      { text: "I threaten the baker.", reason: "threat, not a declared attack; routes to social/intimidation resolution" },
      { text: "I draw my blade.", reason: "equip action; not an attack declaration" },
    ],
    source: 'opus-gate-2026-06-20-postH52-H53.md [Chaos-griefer, turn 5]; opus-gate-2026-06-19-postH29-H30.md [Chaos-griefer]; calibrated 2026-06-20',
  },

  // ---- TARGET — grapple-phrased verbatim that produces [grapple:] not [strike:] ----
  {
    id: 'C10-001b',
    capability: 'C10',
    // "A dream? Then I grab his cloth, wring it out, and ram my dagger into his gut..." →
    //   [grapple:clinch-miss | 2+1 vs 12] — real combat resolution, but grapple not strike.
    // Keeping as locked (combat WAS initiated), with the broader combat-resolution assert.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'grab/grapple phrased attack on baker — combat resolution must occur (grapple or strike tag)',
    paraphrases: [
      "A dream? Then I grab his cloth, wring it out, and ram my dagger into his gut to see if this Corwin bleeds.",
    ],
    assert: {
      surface_matches: [
        /\[(?:strike|grapple):[^\]]*/i,          // any real combat tag (strike or grapple)
      ],
      surface_excludes: [
        /\[combat:table.talk\]/i,
        /\[no-target\]/i,
      ],
    },
    diverge: [
      { text: "I grab Corwin's arm to stop him from leaving.", reason: "restraining grab, not a lethal attack; may resolve as trivial or social" },
    ],
    source: 'opus-gate-2026-06-19-postH29-H30.md [Chaos-griefer]; calibrated 2026-06-20',
  },

  // ---- TARGET — attack phrasings that misroute in village_baker ----
  {
    id: 'C10-001-target',
    capability: 'C10',
    // H-64: "Blade out — I go for the baker's throat." used to hit "That way is
    // blocked from here." (the interior movement gate's "go <roomId>" capture
    // swallowed "go for" before combat-begin ever ran). "Attack the nearest NPC
    // with my worn blade." used to hit [no-target] (fuzzyMatchNpc didn't treat
    // the literal word "NPC" as a generic person referent). Both now resolve to
    // real combat. Promoted to locked.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'attack phrasings that should start combat but misroute to spatial gate or no-target',
    paraphrases: [
      "Blade out — I go for the baker's throat.",
      "Attack the nearest NPC with my worn blade.",
    ],
    assert: {
      surface_matches: [
        /\[strike:[^\]]*→\s*(?:hit|miss)\]/i,
      ],
      surface_excludes: [
        /That way is blocked/i,
        /\[no-target\]/i,
        /\[combat:table.talk\]/i,
      ],
    },
    diverge: [
      { text: "I threaten the baker.", reason: "threat/intimidate, not a weapon attack" },
    ],
    source: 'opus-gate-2026-06-20-postH52-H53.md; calibrated 2026-06-20',
  },

  // ---- LOCKED — attack on present enemy during ongoing combat ----
  {
    id: 'C10-002',
    capability: 'C10',
    // In active_combat, direct "strike" / "attack with worn blade" → [strike:Worn Blade | atk:2 vs AC:10 → miss]
    // These are consistently locked.
    status: 'locked',
    fixture: 'active_combat',
    intent: 'player declares a finishing attack in active combat — must produce a real roll, not table-talk',
    paraphrases: [
      "I swing my worn blade at Corwin to finish him. What's the roll?",
      "Attack Corwin — worn blade, now.",
      "My turn: I attack with the worn blade.",
    ],
    assert: {
      surface_matches: [
        /\[strike:[^\]]*→\s*(?:hit|miss)\]/i,
      ],
      surface_excludes: [
        /\[combat:table.talk\]/i,
        /barely upright.*arcs toward him to end/i,  // narrated kill without mechanics
      ],
    },
    diverge: [
      { text: "I try to talk him down.", reason: "social action in combat; may trigger parley, not a weapon attack" },
      { text: "Flee!", reason: "escape action; routes to flight/disengage, not attack resolution" },
    ],
    source: 'opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turns 4-5]; calibrated 2026-06-20',
  },

  // ---- LOCKED — "I go for the kill on Corwin" (wrong enemy name) resolves to combat ----
  {
    id: 'C10-002c',
    capability: 'C10',
    // H-64: "I go for the kill on Corwin" used to hit [combat:table-talk]
    // ("steel between you and the road") — the enemy is "Lingerer" not
    // "Corwin", but the real bug was the same "go for" idiom being swallowed
    // by the interior movement gate (kind:'move') before the in-combat
    // table-talk/strike branching ever ran, not the name mismatch itself:
    // once "go for" reaches the combat resolver, resolveEscapeCombatTurn
    // defaults unrecognized-target text to a weapon strike against the live
    // foe regardless of the name spoken. Promoted to locked.
    status: 'locked',
    fixture: 'active_combat',
    intent: 'attack phrased with wrong enemy name — should still route to combat, not table-talk',
    paraphrases: [
      "I go for the kill on Corwin.",
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
      { text: "I try to talk him down.", reason: "social action in combat; parley, not attack" },
    ],
    source: 'opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turn 5]; calibrated 2026-06-20',
  },

  // ---- LOCKED — declared firebolt in active combat resolves, not table-talk ----
  {
    id: 'C10-002d',
    capability: 'C10',
    // H-71: "I spit a firebolt right into the heart of it" bounced to
    // [combat:table-talk]. explicitAction's combat-verb alternation listed
    // "fireball"/"cast"/"hurl" but not "firebolt"/"fire bolt", and
    // isCombatSocialNonAction's strike-exclude had \bbolt\b which matches
    // two-word "fire bolt" but not the one-word "firebolt" — so a firebolt
    // phrased with a social-sounding verb ("spit") fell through to the
    // taunt/social-beat bounce before resolveEscapeCombatTurn ever ran.
    status: 'locked',
    fixture: 'active_combat',
    intent: 'a firebolt declared at the live foe is a combat action regardless of verb — must resolve, not bounce as a taunt',
    paraphrases: [
      "I spit a firebolt right into the heart of it.",
      "I spit a firebolt into its face.",
      "I hiss and loose a firebolt at the thing.",
    ],
    assert: {
      surface_matches: [
        /fire bolt|\[strike:/i,
      ],
      surface_excludes: [
        /\[combat:table.talk\]/i,
      ],
    },
    diverge: [
      { text: "I spit at the Lingerer and curse its name.", reason: "genuine taunt — no firebolt/strike verb — must stay table-talk" },
    ],
    source: 'H-71; calibrated 2026-06-21',
  },

  // ---- TARGET — rules-lawyer "give me the d20/modifier" framing of an attack
  // still loses to the meta-question gate, deflecting to table-talk ----
  {
    id: 'C10-002-target',
    capability: 'C10',
    // "You quoted me the modifier table but still didn't roll. d20 result for
    // my attack on Corwin — now." → answers the modifier-breakdown
    // meta-question instead of resolving the attack. REVIEW: root cause is
    // the shared out-of-combat-style meta-question gate (isMetaQuestion /
    // handleMetaQuestion) winning ahead of the combat-attack branch when a
    // turn both asks a rules question AND declares an attack in the same
    // breath — the identical shape blocks C8-001-target ("I attack Corwin
    // with my worn blade. Roll it — give me the d20...") outside H-64's
    // playloop.js/C10.corpus.mjs lane. Needs a dedicated packet to teach the
    // meta-question gate that an explicit attack verb in the same utterance
    // should resolve the attack (and fold the numbers into its narration)
    // rather than answer the question and stop the turn.
    // FIXED (H-72): attackResolutionIntent() in playloop now resolves a declared
    // attack carrying a stats rider over the meta-question gate.
    // (Engine fix landed in H-72; Basecamp promoted this case to locked on §7-verify.)
    status: 'locked',
    fixture: 'active_combat',
    intent: 'attack declared alongside a rules-lawyer request for the roll breakdown — should still resolve as combat, not a meta-answer',
    paraphrases: [
      "You quoted me the modifier table but still didn't roll. d20 result for my attack on Corwin — now.",
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
      { text: "I try to talk him down.", reason: "social action in combat; parley, not attack" },
    ],
    source: 'opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turn 5]; calibrated 2026-06-20',
  },

  // ---- LOCKED — attack declared on a role target (present NPC) ----
  {
    id: 'C10-003',
    capability: 'C10',
    // "I walk outside and shove the first villager I see into the mud." → [strike:Worn Blade | atk:5 vs AC:10 → miss]
    // "I grab a villager and slam them into the wall." → [strike:Improvised Room Hazard | atk:3 vs AC:10 → miss]
    // Physical violence on role target routes to real combat.
    // "I shove him again, harder..." → produces a MIGHT roll [roll:11 vs DC:13 → mixed] (not a strike tag) → moved to target.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'player declares a shove/attack on a present NPC by role — combat must start, not a freebie auto-resolve',
    paraphrases: [
      "I walk outside and shove the first villager I see into the mud.",
      "I grab a villager and slam them into the wall.",
    ],
    assert: {
      surface_matches: [
        /\[strike:[^\]]*→\s*(?:hit|miss)\]/i,
      ],
      surface_excludes: [
        /without difficulty/i,                   // freebie auto-success on violence
        /\[combat:table.talk\]/i,
        /buckles under your shoulder.*splinters/i, // door-substitution failure
      ],
    },
    diverge: [
      { text: "I push past the crowd to get to the door.", reason: "navigation action; the shove is incidental to movement, no target-NPC violence intended" },
      { text: "I put a hand on Corwin's shoulder to get his attention.", reason: "social touch, not a combat shove" },
    ],
    source: 'opus-gate-2026-06-19-postH31-H32.md [Chaos-griefer, turn 1]; opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turn 9]; calibrated 2026-06-20',
  },

  // ---- TARGET — role-target attacks that misroute ----
  {
    id: 'C10-003-target',
    capability: 'C10',
    // "I shove the nearest person." → generic [roll:] (not a strike tag, not combat)
    // "I push the trader out of my way with force." → [social:intimidate] (wrong resolution)
    // "I shoulder the guard aside — hard." → rolls a WITS focus check (not combat)
    // "I shove him again, harder..." → MIGHT roll [roll:11 vs DC:13 → mixed] (not a strike tag)
    // REVIEW: not one of H-64's 4 named misroutes (those were the spatial-gate,
    // no-target, wrong-name-deflect, and trivial-prop-flip shapes — all closed).
    // These shoves are a distinct gap: ambiguous-force phrasing with no
    // explicit attack verb, competing against the generic skill-roll and
    // social-intimidate resolvers. Left untouched, out of this packet's lane.
    status: 'target',
    fixture: 'village_baker',
    intent: 'role-target violence phrasings that should route to combat but misroute to generic roll or social',
    paraphrases: [
      "I shove the nearest person.",
      "I push the trader out of my way with force.",
      "I shoulder the guard aside — hard.",
      "I shove him again, harder. He warned me — let's see the consequence.",
    ],
    assert: {
      surface_matches: [
        /\[strike:[^\]]*→\s*(?:hit|miss)\]/i,
      ],
      surface_excludes: [
        /\[combat:table.talk\]/i,
        /without difficulty/i,
      ],
    },
    diverge: [
      { text: "I push past the crowd to get to the door.", reason: "navigation action; incidental shove on the way to a destination" },
    ],
    source: 'opus-gate-2026-06-19-postH31-H32.md; calibrated 2026-06-20',
  },

  // ---- LOCKED — role-target attack starts combat (H-55 core) ----
  {
    id: 'C10-004',
    capability: 'C10',
    // "I attack the baker." / "I slam the trader into the shelf." → real [strike:] tags
    // "I grab the counter and flip it over onto her." → trivial auto-success (bad) → moved to target.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'attack on a role target ("the baker") routes to combat, not narrated as trivial',
    paraphrases: [
      "I attack the baker.",
      "I slam the trader into the shelf.",
    ],
    assert: {
      surface_matches: [
        /\[strike:[^\]]*→\s*(?:hit|miss)\]/i,
      ],
      surface_excludes: [
        /\[combat:table.talk\]/i,
        /without difficulty/i,
        /\[no-target\]/i,
      ],
    },
    diverge: [
      { text: "I slam my fist on the counter to get attention.", reason: "attention-getting gesture, not a declared attack on a person" },
      { text: "I demand the trader hand over the goods.", reason: "intimidation/demand; social action, not a weapon strike" },
    ],
    source: 'opus-gate-2026-06-20-postH45-H46.md [Chaos-griefer, turns 4, 8]; opus-gate-2026-06-19-postH31-H32.md [Chaos-griefer, turn 10]; calibrated 2026-06-20',
  },

  // ---- TARGET — prop-flip phrasing routes to trivial auto-success (not combat) ----
  {
    id: 'C10-004b',
    capability: 'C10',
    // H-64: "I grab the counter and flip it over onto her." used to hit "You
    // do so without difficulty." (trivial auto-success) — detectPhysicalAssault
    // had no pattern for a thrown/flipped PROP whose person-target trails the
    // verb's direct object ("flip the counter onto her": the counter is the
    // verb's object, "her" only appears after the final preposition). Added a
    // flip/tip/topple/dump-onto branch that captures the trailing target.
    // Promoted to locked.
    status: 'locked',
    fixture: 'village_baker',
    intent: '"I grab the counter and flip it over onto her" — should start combat, not auto-succeed as trivial',
    paraphrases: [
      "I grab the counter and flip it over onto her.",
    ],
    assert: {
      surface_matches: [
        /\[(?:strike|grapple):[^\]]*/i,
      ],
      surface_excludes: [
        /without difficulty/i,
        /\[combat:table.talk\]/i,
      ],
    },
    diverge: [
      { text: "I flip the counter over.", reason: "environmental action with no declared target person; auto-succeed as trivial is correct here" },
    ],
    source: 'opus-gate-2026-06-19-postH31-H32.md [Chaos-griefer, turn 10]; calibrated 2026-06-20',
  },
];
