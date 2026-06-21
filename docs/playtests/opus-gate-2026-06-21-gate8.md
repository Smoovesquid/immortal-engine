# Playtest — Opus-4.8 experiential gate — 2026-06-21

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 1 | 0 | 0 |
| Chaos-griefer | glass-harbor | 12 | 0 | 0 | 0 |
| Lore-hound | glass-harbor | 12 | 2 | 0 | 0 |
| Confused newbie | glass-harbor | 12 | 1 | 0 | 2 |

**Total turns judged:** 48 · **failing turns:** 5 (10%)

## Failures by bug class

### DM_TEST_DEADEND (4)
- **[Rules Lawyer DM]** player: _"You're stalling, Corwin. What happened here last night that's got you so jumpy?"_
  - DM: Nothing's happened yet. What do you want to do?
  - mech: `(none)` — **med**: DM bounced player's intent back as a flat 'What do you want to do?' and contradicted the scene by saying nothing happened, refusing to engage Corwin in fiction
- **[Lore-hound]** player: _"The only building? A second ago this was a village with cook-smoke and friendly voices — now there's just one building? Which is it, Corwin?"_
  - DM: It falls short here in Pilgrim's Rest Village, and you're left where you started.
  - mech: `[roll:4 vs DC:12 → failure | margin:-8 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll 4 vs DC 12 is a failure, and the narration reflects falling short with no state change.
- **[Lore-hound]** player: _"A name, Corwin. You owe me a name — who was it that ceased to matter?"_
  - DM: It lands, after a fashion — partial, imperfect.
  - mech: `[roll:13 vs DC:12 → mixed | margin:1 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1 |` — **med**: Mixed outcome on 13 vs DC 12 margin 1 is consistent with a partial result.
- **[Confused newbie]** player: _"Okay, that Lingerer sounds way more interesting. Can I go talk to them?"_
  - DM: In Pilgrim's Rest Village, the Lingerer is somewhere out in the settlement beyond these walls, and while your curiosity pulls toward that restless wanderer, the way out from this room doesn't open in the direction you're
  - mech: `(none)` — **high**: Player asked to talk to the Lingerer, who is present; DM bounced intent back as a movement/UI block ('the way out doesn't open that direction') instead of resolving the conversation.

### CANON_HALLUCINATION (1)
- **[Confused newbie]** player: _"Corwin, you clearly know something. Can you just tell me what's going on here?"_
  - DM: Standing on the road through Pilgrim's Rest Village, Corwin Boneknit meets your steady gaze with a brief, readable tension behind his eyes before he exhales and says, "There was a falling-out, years back, between two fam
  - mech: `[roll:14 vs DC:12 → success | margin:2 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **low**: Specific claim of a years-back falling-out between two families shaping the village has no support in canon ledger/timeline.

## Cost
96 Opus calls · 143,613 in + 8,547 out tokens · ~$2.80 (est. @ $15/$75 per M)
