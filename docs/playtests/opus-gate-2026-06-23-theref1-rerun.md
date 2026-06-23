# Playtest — Opus-4.8 experiential gate — 2026-06-23

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 1 sessions × 12 turns · personas: Lore-hound · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Lore-hound | glass-harbor | 12 | 4 | 0 | 0 |

**Total turns judged:** 12 · **failing turns:** 4 (33%)

## Failures by bug class

### DM_TEST_DEADEND (4)
- **[Lore-hound]** player: _"Kael who? No surname for Kael, but Brae gets a Copperforge — why's that?"_
  - DM: You manage it, and the way ahead opens a little.
  - mech: `[roll:20 vs DC:12 → success | margin:8 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Player asked a direct question about names/surnames; DM gave a generic 'you manage it, way opens' non-answer that resolves nothing in fiction.
- **[Lore-hound]** player: _"That's no answer, Corwin. Why does Kael have no surname when Brae gets Copperforge?"_
  - DM: I haven't introduced anyone named That, and there's no one by that name here. Corwin Boneknit, Tove, Kael, Brae Copperforge are here — who do you actually mean?
  - mech: `[clarify:referent]` — **med**: DM deliberately parsed 'That's no answer' as a missing referent and bounced a clarify prompt instead of answering the real question about why Kael has no surname.
- **[Lore-hound]** player: _"Brae Copperforge — you've sat this council with both of them. Did Tove arrive on a road, or was she born here? One of them's wrong."_
  - DM: You manage it, and the way ahead opens a little.
  - mech: `[roll:17 vs DC:11 → success | margin:6 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Player asked Brae a specific question about Tove's origin; DM gave a generic 'you manage it, the way opens' with zero answer to the intent.
- **[Lore-hound]** player: _"That's a dice roll, not Brae's voice. I asked Brae a question — what does Brae Copperforge actually say?"_
  - DM: I haven't introduced anyone named That, and there's no one by that name here. Corwin Boneknit, Tove, Kael, Brae Copperforge are here — who do you actually mean?
  - mech: `[clarify:referent]` — **high**: Player explicitly named Brae Copperforge; DM feigned confusion over 'That' and bounced back a clarify prompt instead of voicing Brae.

## Cost
24 Opus calls · 35,095 in + 2,525 out tokens · ~$0.72 (est. @ $15/$75 per M)
