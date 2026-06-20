# Playtest — Opus-4.8 experiential gate — 2026-06-20

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 2 | 1 | 1 |
| Chaos-griefer | glass-harbor | 12 | 1 | 1 | 1 |
| Lore-hound | glass-harbor | 12 | 0 | 4 | 1 |
| Confused newbie | glass-harbor | 12 | 3 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 10 (21%)

## Failures by bug class

### DM_TEST_DEADEND (5)
- **[Rules Lawyer DM]** player: _"What are my hit points and what does my Worn Blade do for damage?"_
  - DM: the Worn Blade rolls 1d6 for damage.
  - mech: `(none)` — **med**: 1d6 for Worn Blade is plausible; HP not stated but not contradicted.
- **[Rules Lawyer DM]** player: _"And the Tonic of grit — what exactly does it do if I drink it?"_
  - DM: You do so without difficulty.
  - mech: `trivial action — no roll, auto-success` — **med**: Failed to convey the item's listed effect (heal 2d4); treated a question as a trivial drinking action.
- **[Confused newbie]** player: _"Hi there, I'm new here. What's behind me that you keep looking at?"_
  - DM: It comes off cleanly; the moment turns toward you.
  - mech: `[roll:20 vs DC:12 → success | margin:8 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll succeeded but no mechanical state needed changing; no contradiction.
- **[Confused newbie]** player: _"Okay I'm a little lost, can you just tell me what Corwin actually says back to me?"_
  - DM: You get something out of it, though not what you hoped.
  - mech: `[roll:11 vs DC:11 → mixed | margin:0 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Mixed result on margin 0 is consistent with a partial answer, though empty.
- **[Confused newbie]** player: _"That's still pretty confusing — does Corwin actually say any words to me?"_
  - DM: It comes off cleanly; the moment turns toward you.
  - mech: `[roll:16 vs DC:12 → success | margin:4 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll succeeded and narration is vaguely positive, no contradiction or resource error.

### CRUNCH_INCONSISTENCY (4)
- **[Chaos-griefer]** player: _"Wait — Corwin? I stabbed him in the throat ten minutes ago. How is he alive?"_
  - DM: Corwin Boneknit's patience thins. "Same answer. I don't have it."
  - mech: `[info-check → no-record | nothing grounded to deliver, no roll]` — **high**: Canon shows Corwin Boneknit hp:0, defeated:true — yet he is present and speaking with no explanation; the dead enemy is treated as alive.
- **[Lore-hound]** player: _"So you admit it — you said "and then he brought you here." Now who brought me, and when?"_
  - DM: In Pilgrim's Rest Village, Corwin Boneknit's jaw tightens at the slip, his eyes cutting sideways toward the door before he levels his gaze back at you and says, voice clipped and carefully even, "I misspoke — that's all 
  - mech: `[combat:table-talk]` — **med**: Canon shows active combat (inCombat:true, round 2, Corwin as enemy hp 8/8) but the turn plays as pure table-talk with no combat mechanics or acknowledgment of the ongoing fight.
- **[Lore-hound]** player: _"Corwin, Kael's the one who said it, not you — so why are *you* the one apologizing for the slip?"_
  - DM: In Pilgrim's Rest Village, Corwin Boneknit's jaw tightens at your question, a flicker of something unsteady crossing his face — not guilt exactly, but the particular discomfort of a man who has said more with his silence
  - mech: `[combat:table-talk]` — **med**: Canon shows inCombat:true round 2 with Corwin Boneknit as an active enemy (hp 8/8), but the turn plays as pure social table-talk with no combat acknowledgment or mechanics.
- **[Lore-hound]** player: _"Answer me plainly, Corwin — if Kael made the slip, what exactly are *you* covering for?"_
  - DM: In the tense hush of Pilgrim's Rest Village, Corwin Boneknit's jaw tightens, eyes darting once toward the door before snapping back to you — and the silence itself answers more than words would.
  - mech: `[combat:table-talk]` — **med**: Canon says inCombat:true round 2 with Corwin as an enemy entity (hp 8/8), but the turn plays as pure table-talk with no combat acknowledgment or mechanics; combat state ignored.

### CANON_HALLUCINATION (1)
- **[Lore-hound]** player: _"Wait, Kael — I said *your* name, not some secret. Why would saying "Kael" make Corwin bleed for it?"_
  - DM: Kael's weathered face tightens with something between grief and warning as he says, low and urgent across the room, "In Pilgrim's Rest Village, that name has weight because Corwin swore an oath on it — and you just remin
  - mech: `[combat:table-talk]` — **med**: Canon shows inCombat:true round 2 with Corwin as an active enemy (hp 8); DM treats scene as table-talk with no acknowledgment of ongoing combat state.

## Cost
96 Opus calls · 129,413 in + 9,168 out tokens · ~$2.63 (est. @ $15/$75 per M)
