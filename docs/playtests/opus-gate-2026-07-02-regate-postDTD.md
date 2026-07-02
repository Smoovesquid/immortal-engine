# Playtest — Opus-4.8 experiential gate — 2026-07-02

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: tallow

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | tallow | 12 | 1 | 1 | 0 |
| Chaos-griefer | tallow | 12 | 0 | 1 | 0 |
| Lore-hound | tallow | 12 | 1 | 0 | 0 |
| Confused newbie | tallow | 12 | 2 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 5 (10%)

## Failures by bug class

### DM_TEST_DEADEND (3)
- **[Lore-hound]** player: _"You keep saying "isn't something you keep close" — but you called this place *familiar*. Were you born here or not, Elske?"_
  - DM: This is Wayfarers' Outpost. Small, but it holds. You'll find well, workshop, well; folk worth knowing: Dalla, Asha, the Lingerer. — given hedged, and not the whole of it.
  - mech: `[roll:1 vs DC:12 → failure | margin:-11 | approach:focus | stake:time | risk:0.47 | stat:WITS-2 | NA` — **med**: NAT1 failure on a WITS focus check aligns with Elske deflecting/hedging; no HP or combat state to update.
- **[Confused newbie]** player: _"Huh, who's it from? Is there a name at the bottom?"_
  - DM: At the Wayfarers' Outpost, Elske Nightherd glances up from where she stands near the stone basin, her expression politely expectant as she waits to understand who you mean.
  - mech: `[clarify:referent]` — **med**: Player asked to read a signature on a note; DM bounced intent back as a clarify:referent prompt instead of resolving in fiction.
- **[Confused newbie]** player: _"Who are you, though? Do you live here?"_
  - DM: Elske Nightherd stops and turns — eyes level, waiting.
  - mech: `[dialogue enter | Elske Nightherd]` — **med**: Player asked a direct question; DM only described Elske turning and waiting, never answering who she is or if she lives here — intent not resolved.

### DM_ARTIFACT_LEAK (1)
- **[Rules Lawyer DM]** player: _"I'm citing YOUR last two answers — you said 9, then 13, now 15. Three different totals for one roll. Pick one and read me the die result plus the modifier separately."_
  - DM: Modifier breakpoints: 3 → -4, 4–5 → -3, 6–7 → -2, 8–9 → -1, 10–11 → +0, 12–13 → +1, 14–15 → +2, 16–17 → +3, 18 → +4. Your measures: MIGHT 6 (-2), AGILITY 6 (-2), WITS 6 (-2), GRIT 8 (-1), CHARM 6 (-2).
  - mech: `(none)` — **med**: lastRoll is a clean {roll:15,dc:12,success}; DM never reconciles the '9/13/15' confusion nor states the die and modifier separately as asked, and buries the answer in a mechanics table.

### CRUNCH_INCONSISTENCY (1)
- **[Chaos-griefer]** player: _"I barrel through the doorway, knocking anything in my way flat, and sprint into the outpost."_
  - DM: The doorway at the front of the cottage opens onto the busy roads of Wayfarers' Outpost, but Elske holds the near wall with the high ground of the room's raised threshold, her weight braced to meet you, and the Lingerer 
  - mech: `[combat:table-talk]` — **med**: Player declared a barrel-through/sprint escape action during active combat (round 4); DM narrated positioning but resolved no roll/outcome despite lastRoll being a failure — the action was left unresolved as table-talk with no mechanical consequence.

## Cost
96 Opus calls · 142,033 in + 8,875 out tokens · ~$2.80 (est. @ $15/$75 per M)
