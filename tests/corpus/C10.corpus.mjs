// C10 — A declared attack on a present/role/named NPC routes to combat.
// Lineage: H-30/H-32/H-43/H-48/H-55; playloop attack gates, resolveEscapeCombatTurn.
// See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20.
//
// KEY FINDINGS:
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
    // "Blade out — I go for the baker's throat." → "That way is blocked from here." (fake spatial gate)
    // "Attack the nearest NPC with my worn blade." → [no-target]
    // "I draw my weapon and attack Corwin." → trivial draw action (no Corwin in fixture)
    // These should route to combat but don't.
    status: 'target',
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

  // ---- TARGET — "I go for the kill on Corwin" routes to table-talk (wrong name deflects) ----
  {
    id: 'C10-002-target',
    capability: 'C10',
    // "I go for the kill on Corwin" → [combat:table-talk] ("steel between you and the road")
    // The enemy is "Lingerer" not "Corwin" — name mismatch causes table-talk deflection.
    // Target: should resolve as an attack on the present enemy regardless of name.
    status: 'target',
    fixture: 'active_combat',
    intent: 'attack phrased with wrong enemy name — should still route to combat, not table-talk',
    paraphrases: [
      "I go for the kill on Corwin.",
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
    // "I grab the counter and flip it over onto her." → "You do so without difficulty. trivial action"
    // The engine treats the counter-flip as an environmental action, not a NPC attack.
    // Should route to combat as an improvised-weapon attack on the baker.
    status: 'target',
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
