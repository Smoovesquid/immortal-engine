# Playtest — Opus-4.8 experiential gate — 2026-06-23

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 2 | 0 | 0 |
| Chaos-griefer | glass-harbor | 12 | 1 | 0 | 0 |
| Lore-hound | glass-harbor | 12 | 1 | 0 | 0 |
| Confused newbie | glass-harbor | 12 | 0 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 4 (8%)

## Failures by bug class

### DM_TEST_DEADEND (4)
- **[Rules Lawyer DM]** player: _"Broke and amnesiac — great start. I head outside to find whoever's baking that bread; who do I see?"_
  - DM: It falls short here in Pilgrim's Rest Village, and you're left where you started.
  - mech: `[roll:7 vs DC:11 → failure | margin:-4 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll failed (7 vs 11), so finding the baker fails — fiction consistent with mechanics.
- **[Rules Lawyer DM]** player: _"I keep the blade up and my eyes on the Lingerer. Corwin, I didn't ask you. Lingerer — last chance to talk before I make you."_
  - DM: "I can tell you about the smiths' technique with quenching and tempering if that'd help, but I'm more worried about your... position." Corwin Boneknit says, wary.
  - mech: `[dialogue ask | shared | role_smith_trade_talk | trust:7]` — **med**: Player issued an ultimatum to the Lingerer, but the DM responded with Corwin talking about smithing quenching/tempering — completely ignoring the player's directed intent toward the Lingerer and surfacing an off-topic role-talk script.
- **[Chaos-griefer]** player: _"So the body, the blood, the dead man I just stabbed — all gone too? Where's Corwin?"_
  - DM: It half-works — you get part of what you were after, not all of it.
  - mech: `[roll:9 vs DC:12 → mixed | margin:-3 | approach:focus | stake:time | risk:0.48 | stat:WITS+1]` — **med**: DM gave a content-free 'it half-works' hedge and never answered any of the player's three concrete questions (body, blood, Corwin's location) — no fiction resolved.
- **[Lore-hound]** player: _"Kael, Boneknit is a bonesetter's name — a healer. Is there a healer in this village, and is that what Corwin did here?"_
  - DM: You see it through, and it goes your way.
  - mech: `[roll:21 vs DC:12 → success | margin:9 | approach:focus | stake:reputation | risk:0.48 | stat:WITS+1` — **high**: Player asked a concrete question about a healer/Corwin; DM gave empty filler ('You see it through, and it goes your way') that resolves nothing in fiction.

## Cost
96 Opus calls · 142,530 in + 8,518 out tokens · ~$2.78 (est. @ $15/$75 per M)
