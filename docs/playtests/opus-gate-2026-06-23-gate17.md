# Playtest — Opus-4.8 experiential gate — 2026-06-23

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 2 | 1 | 0 |
| Chaos-griefer | glass-harbor | 12 | 0 | 0 | 0 |
| Lore-hound | glass-harbor | 12 | 0 | 0 | 0 |
| Confused newbie | glass-harbor | 12 | 1 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 3 (6%)

## Failures by bug class

### DM_TEST_DEADEND (3)
- **[Rules Lawyer DM]** player: _"I sit up and look around the room — what do I have on me? Let me check my gear and any character sheet stats."_
  - DM: You're inside Pilgrim's Rest Village. You're not alone — Corwin Boneknit the representative, Tove the trader, Kael the elder, Brae Copperforge the guard, and 2 others are about, in and around the place. And someone else 
  - mech: `(none)` — **med**: Carried consumables (Tonic of grit, Bandages) and HP 13/13 exist in canon but none were surfaced despite a direct inventory/stat request.
- **[Rules Lawyer DM]** player: _"What's your name, and which old dispute are you digging into?"_
  - DM: Corwin Boneknit stops and turns — eyes level, waiting.
  - mech: `[dialogue enter | Corwin Boneknit]` — **med**: Player asked two direct questions (name and which dispute); DM only had the NPC turn and wait silently, resolving neither in fiction.
- **[Confused newbie]** player: _"Okay, forget them — I want to go talk to that stranger watching from the edges."_
  - DM: The path you'd need to reach the stranger lurking at the edges of Pilgrim's Rest Village is blocked from where you stand inside the building.
  - mech: `(none)` — **med**: DM blocks the player's intent with a logistics wall instead of resolving it in fiction; doesn't engage the stranger (the Lingerer) at all, just a dead-end 'path is blocked.'

## Cost
96 Opus calls · 142,922 in + 8,683 out tokens · ~$2.80 (est. @ $15/$75 per M)
