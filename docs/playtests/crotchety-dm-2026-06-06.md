# Playtest — "Gus", the crotchety tech-skeptic DM — 2026-06-06

Surface: live v1.html (AI on) · Persona: a 30-year tabletop DM who doesn't trust "the
computer" to adjudicate like a human, and pushes it to prove him right · Governing:
THE_DM_TEST. Mandate: push everything built this session, take his input, repair what's
broken.

## What Gus threw at it (and what came back)

| # | Gus's probe | Result | Verdict |
| - | --- | --- | --- |
| 1 | "Where am I, and who are these people?" | "…neighbors worth knowing." (vague) | ⚠️ dodge |
| 1b | "Who exactly is standing here? Give me names." | "I'm Galen, and you'll find Miriel the elder and Dax the artisan… keep one eye out for Rattleclaw." | ✅ names when pushed |
| 2 | "I loom over Rattleclaw, crack my knuckles, and growl he'd best stay out of my way…" | Read as intimidation (no verb), targeted the wary NPC, he backs down | ✅ social works on raw language |
| 3 | "I tell Miriel a joke." (no joke told) | "…a polite smile… her eyes remain distant" — lands flat | ✅ joke-no-content penalty |
| 4 | "I press Galen about the missing courier. What does he know?" | "…the last soul to see this one was Rattleclaw, lurking near the edge three days running." | ✅ real plot, not a dodge |
| 5 | "I reach up, tear the sun from the sky, and swallow it whole." | Prose: sun stays put. **Mechanics: [roll:18 → success]** | ❌ **dice/fiction contradict** |
| 6 | "I flap my arms and fly." | [roll:7 → failure] + "gravity keeps your boots on the floor" | ✅ (consistent only because it rolled fail) |
| 7 | "I draw my blade and go for Rattleclaw." / "press the attack." | Narrates a brawl, even a NAT20 "wounds" — but no enemy/HP/combat state in the UI | ⚠️ natural-language attack doesn't start real combat |
| 8 | "yank the lid off the crate" → stomp outside → back inside → "still open, or did your gizmo forget?" | "the crate sits open…" — remembered across moves | ✅ permanence holds |

## The necessary repair (made + verified)
**#5 — clearly-impossible feats no longer get a d20.** Root cause: the engine rolled a
normal check for feats with no plausible success; on a high roll it reported mechanical
"success" while the (correct) AI narration said nothing happened — the dice and the
fiction openly contradicting, the exact thing a real DM never does.

Fix: `tryImpossibleFeat` (engine/playloop.js), gated before the resolution paths. Catches
cosmic / physically-impossible declarations (eat/pull the sun·moon·sky, become a god,
reverse time, fly by flapping, breathe fire) and resolves them deterministically as a
grounded NO-EFFECT — `[impossible — reality doesn't bend]`, no success/failure roll, no
RNG. Kept TIGHT (word-boundaried celestial nouns; sun/moon/sky only for the reach/pull
family) so ordinary actions don't trip it.

- Node: 6/6 impossible feats → no-effect, no contradictory roll; 9/9 ordinary actions
  ("eat the bread", "grab the star chart", "reach for the moonstone amulet", "cast fire
  bolt") route normally — zero false positives.
- **Live-verified (ss_38719jn2t):** "tear the sun from the sky and swallow it whole" →
  "…the sun burns on overhead exactly as it always has." No `[roll → success]` line.
- Tests: U105 (17). Suite 7220 green; prose gate PASS.

## Other Gus findings (logged, not fixed here)
- **#7 — natural-language attacks don't start real combat.** "go for Rattleclaw" / "draw
  my blade and go for him" narrate a fight (and roll generic MIGHT, even a NAT20) but
  combat never actually begins — no enemy entity, no HP, no `[combat:…]` turns. This is
  PRE-EXISTING (combat-begin needs explicit "attack/fight <name>" phrasing — Pass 5), not
  introduced this session, and is a larger piece (combat-intent routing + UI). Flagged as
  a spawn task.
- **#1 — meta vagueness.** "who are these people" got "neighbors worth knowing"; it named
  them only when pushed ("give me names"). The deterministic grace survey DOES name NPCs;
  the AI polish softened it into flavor. A `guard.js` "don't drop named facts" rule
  (Stage E) would close this. Minor; logged.

## Verdict: Gus grudgingly approves. The one genuine integrity break he found — the box
telling him he "succeeded" at eating the sun — is fixed and live-verified. Social on raw
language, plot-on-ask, and cross-move permanence all held up under a hostile veteran.
Combat-from-narrative-intent is the next real gap (logged).
