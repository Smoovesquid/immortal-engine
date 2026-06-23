# Playtest — Opus-4.8 experiential gate — 2026-06-23

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 1 | 0 | 0 |
| Chaos-griefer | glass-harbor | 12 | 1 | 1 | 0 |
| Lore-hound | glass-harbor | 12 | 1 | 0 | 1 |
| Confused newbie | glass-harbor | 12 | 0 | 0 | 1 |

**Total turns judged:** 48 · **failing turns:** 6 (13%)

## Failures by bug class

### DM_TEST_DEADEND (3)
- **[Rules Lawyer DM]** player: _"I leave Corwin and walk to the guard post to find that guard who was eyeing the edge of town."_
  - DM: You step away from Corwin Boneknit.
  - mech: `[dialogue exit | turns:5 | topics:1]` — **med**: DM only acknowledged leaving Corwin and did not resolve the player's intent to walk to the guard post and find the guard; the response is a truncated stub.
- **[Chaos-griefer]** player: _"I kick the door open and shout for everyone to clear the street."_
  - DM: Your improvised fixture crashes into Brokefang with a satisfying crack — the bandit staggers back against the wall inside this building in Pilgrim's Rest Village, half-bloodied but snarling as his retaliatory strike rake
  - mech: `[strike:Improvised Fixture | atk:14 vs AC:10 → hit | 5 dmg] [enemy:Brokefang | atk:14 vs AC:11 → hit` — **med**: HP 13->10 matches canon pc.hp:10, Brokefang at 5 hp after 5 dmg, combat active round 2 — mechanics consistent.
- **[Lore-hound]** player: _"Corwin, name me one other old family in Pilgrim's Rest — besides the Boneknits."_
  - DM: You manage it, and the way ahead opens a little.
  - mech: `[roll:18 vs DC:12 → success | margin:6 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1` — **med**: Player asked Corwin to name another old family; DM gave a generic non-answer that resolves nothing in fiction.

### CANON_HALLUCINATION (2)
- **[Lore-hound]** player: _"That's two grandmothers, Kael — you swore there were three. What did the third one quarrel over?"_
  - DM: Kael's brow furrows with the effort of an old mind pulling at old threads, and then his eyes clear as he speaks plainly: in Pilgrim's Rest Village, the third grandmother's quarrel was over the deed to the building — who 
  - mech: `[roll:15 vs DC:12 → success | margin:3 | approach:focus | stake:time | risk:0.49 | stat:WITS+1]` — **med**: The 'third grandmother's quarrel over the deed' is a specific past-event claim with no support in the canon bundle; recentCanon is empty and no such detail exists in ledger.
- **[Confused newbie]** player: _"Okay, um, maybe I should talk to one of the friendly people first. Who's the elder?"_
  - DM: Corwin Boneknit, a representative — one of the folk here, watching from nearby.
  - mech: `(none)` — **med**: DM named Corwin Boneknit (a representative) as the answer; the actual elder per canon is Kael.

### CRUNCH_INCONSISTENCY (1)
- **[Chaos-griefer]** player: _"I tackle the Lingerer into the nearest produce cart and start smashing his face into the planks."_
  - DM: The Lingerer has slipped your grasp and bolted through the building's doorway out into Pilgrim's Rest Village, leaving you standing over a scuffed floor with nothing but the echo of retreating footsteps and the faint, un
  - mech: `[combat:fled]` — **med**: lastRoll was a success (15 vs DC 12) yet the player's tackle/smash achieved nothing — the Lingerer (at 1 HP) simply fled, contradicting the successful roll.

## Cost
96 Opus calls · 140,673 in + 7,820 out tokens · ~$2.70 (est. @ $15/$75 per M)
