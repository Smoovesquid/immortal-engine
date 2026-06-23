# Playtest — Opus-4.8 experiential gate — 2026-06-23

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 6 | 3 | 0 |
| Chaos-griefer | glass-harbor | 12 | 0 | 0 | 0 |
| Lore-hound | glass-harbor | 12 | 0 | 0 | 0 |
| Confused newbie | glass-harbor | 12 | 0 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 6 (13%)

## Failures by bug class

### DM_TEST_DEADEND (6)
- **[Rules Lawyer DM]** player: _"What's my weapon, and do I have any armor on? I want my AC too."_
  - DM: Your Armor is 11 — that's the number an attack has to beat to land on you.
  - mech: `(none)` — **low**: AC 11 stated; no canon weapon/armor data to contradict.
- **[Rules Lawyer DM]** player: _"You skipped my weapon. What am I carrying — what's my main weapon and what damage does it do?"_
  - DM: You go through your pack — Kitchen cleaver, Worn Blade, Padded coat, Lantern, Wool scarf, Key with no teeth, Empty vial labeled “CURE”, Tonic of grit, and Bandages.
  - mech: `(none)` — **med**: Player asked for main weapon and its damage; DM dumped the full inventory list and never answered which weapon is primary or its damage.
- **[Rules Lawyer DM]** player: _"What's my proficiency bonus, and is the Worn Blade a weapon I'm trained with? Give me the final to-hit number."_
  - DM: Inside this building in Pilgrim's Rest Village, the answer to your question lives outside the walls of what the world around you can tell you — your proficiency bonus, your weapon training, and your final to-hit number a
  - mech: `observe only — no roll, state unchanged` — **med**: At level 1 proficiency bonus is +2 and this is answerable; DM refused to provide computable mechanical info despite no obstacle to doing so.
- **[Rules Lawyer DM]** player: _"That's a dodge, not an answer. My character sheet isn't "outside the walls" — it's the most basic thing you owe me. Give me my proficiency bonus as a flat number."_
  - DM: Inside the building in Pilgrim's Rest Village, your thoughts scatter before they can settle — the number you're reaching for stays just out of grasp, like a word on the tip of your tongue that refuses to arrive.
  - mech: `[roll:5 vs DC:12 → failure | margin:-7 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll 5 vs DC 12 is a failure and the narration reflects failing to recall — consistent.
- **[Rules Lawyer DM]** player: _"That's a system failure, not a story beat — you gave me MIGHT +1 and a damage die without flinching. Proficiency bonus is the same kind of number. Pick one: +2."_
  - DM: Your weapons roll for damage as follows — the Kitchen cleaver rolls 1d6 and the Worn Blade rolls 1d6, plus your ability modifier on a hit.
  - mech: `(none)` — **med**: Player's point about proficiency bonus being a fixed +2 at level 1 is correct; DM ignored it and gave a non-responsive answer about damage dice without addressing the proficiency value.
- **[Rules Lawyer DM]** player: _"Hold on — a 22 to hit? Walk me through it: what number came up on the d20, plus what bonuses, to total 22?"_
  - DM: Mid-swing in the desperate close-quarters brawl that has already bloodied you inside Pilgrim's Rest Village, the chaos leaves no room to pause and count dice — the Lingerer presses forward, and Corwin Boneknit staggers b
  - mech: `[combat:table-talk]` — **med**: No 22 exists in canon; lastRoll is 3 vs DC 11 (failure). The DM neither confirms nor corrects the number, leaving mechanics opaque and inconsistent.

## Cost
96 Opus calls · 141,196 in + 8,711 out tokens · ~$2.77 (est. @ $15/$75 per M)
