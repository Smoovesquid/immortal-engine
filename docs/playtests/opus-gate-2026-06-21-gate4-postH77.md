# Playtest — Opus-4.8 experiential gate — 2026-06-21

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 1 | 1 | 0 |
| Chaos-griefer | glass-harbor | 12 | 0 | 0 | 0 |
| Lore-hound | glass-harbor | 12 | 5 | 0 | 1 |
| Confused newbie | glass-harbor | 12 | 0 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 7 (15%)

## Failures by bug class

### DM_TEST_DEADEND (4)
- **[Lore-hound]** player: _"Elder Kael, who carried me in here last night, and where did they find me?"_
  - DM: You see it through, and it goes your way.
  - mech: `[roll:19 vs DC:12 → success | margin:7 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **high**: Player asked who carried them in and where they were found; DM gave a contentless 'it goes your way' and answered nothing in the fiction.
- **[Lore-hound]** player: _"Then I'll ask Brae Copperforge — who carried me in last night, guard?"_
  - DM: You ask around, and someone gives you something real to go on.
  - mech: `[roll:16 vs DC:12 → success | margin:4 | approach:focus | stake:time | risk:0.48 | stat:WITS+1]` — **med**: Roll 16 vs DC 12 success matches a positive outcome.
- **[Lore-hound]** player: _"Brae, give me the name — who carried me in, and what time was it?"_
  - DM: It's early — morning of your first day.
  - mech: `(none)` — **med**: Player asked two things—the name of who carried them in and the time. DM only gave a vague time and never answered the name question.
- **[Lore-hound]** player: _"Brae, the name — who carried me in, and what hour was it?"_
  - DM: It comes off cleanly; the moment turns toward you.
  - mech: `[roll:15 vs DC:12 → success | margin:3 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1` — **med**: Roll succeeded but the success yielded no actual information.

### DM_ARTIFACT_LEAK (2)
- **[Rules Lawyer DM]** player: _"Which ability modifier applies to a melee strike with the Worn Blade — MIGHT or AGILITY? And roll it now: give me the actual d6 result plus the mod."_
  - DM: Modifier breakpoints: 9 → −1, 10–11 → +0, 12–13 → +1, 14–15 → +2. Your measures: MIGHT 12 (+1), AGILITY 9 (-1), WITS 13 (+1), GRIT 9 (-1), CHARM 11 (+0).
  - mech: `(none)` — **med**: No roll was produced despite explicit request; intent unresolved mechanically.
- **[Lore-hound]** player: _"Kael, you're the elder of this village — how can you not know your own name?"_
  - DM: It half-works — you get part of what you were after, not all of it.
  - mech: `[roll:11 vs DC:11 → mixed | margin:0 | approach:focus | stake:reputation | risk:0.48 | stat:WITS+1]` — **med**: Roll 11 vs DC 11 = mixed is consistent; no resource/combat state needed.

### CANON_HALLUCINATION (1)
- **[Lore-hound]** player: _"Brae, you keep dodging — say the name out loud or admit you don't know."_
  - DM: In Pilgrim's Rest Village, Corwin Boneknit meets your demand with a steady, unmoved gaze — the name, if they know it, stays buried behind eyes that have weathered far sharper pressure than yours.
  - mech: `[social:intimidate|GRIT|roll:1 vs DC:10 → failure | argued+2]` — **med**: roll 1 vs DC10 failure, intimidate fails, consistent

## Cost
96 Opus calls · 143,604 in + 9,339 out tokens · ~$2.85 (est. @ $15/$75 per M)
