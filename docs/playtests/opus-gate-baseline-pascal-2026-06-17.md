# Playtest — Opus-4.8 experiential gate — 2026-06-17

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 1 sessions × 12 turns · personas: Chaos-griefer · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Chaos-griefer | glass-harbor | 12 | 1 | 6 | 1 |

**Total turns judged:** 12 · **failing turns:** 6 (50%)

## Failures by bug class

### CRUNCH_INCONSISTENCY (3)
- **[Chaos-griefer]** player: _"I grab a chair and hurl it through the wall toward where Galen's voice is coming from."_
  - DM: The crash of splintering wood echoes through the modest room of Wayfarers' Outpost as the chair punches a ragged hole in the thin wall, and Galen lets out a sharp, startled cry from somewhere just beyond it.
  - mech: `[physics:wooden table, wooden chair | deltas:0 | offline]` — **med**: Player hurled a chair toward a present NPC (Galen); this is a violent action that should involve a roll and/or a damage/wound check, but mechanics show deltas:0 with no resolution and no combat state despite an aggressive act against an NPC.
- **[Chaos-griefer]** player: _"I slam him face-first into the broken wall and demand to know what he's so afraid of."_
  - DM: The Old Shrine's crumbling stone accepts the impact with a dull crack, and the man's breath comes out in a ragged gasp before he whispers, eyes wide and darting toward the structure's shadowed doorway, that something ins
  - mech: `[roll:14 vs DC:12 → success | margin:2 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **high**: Player slams and interrogates a man, but canon shows npcsPresent is empty — no NPC entity exists for the target being manipulated.
- **[Chaos-griefer]** player: _"I grab a broken table leg and start smashing every bottle behind the bar."_
  - DM: Theron the Crow steps forward from the doorway of the Riverside Inn, his weathered face tight with disapproval, and says in a low, steady voice, "Friend, whatever trouble's riding you today, there's no bottle here worth 
  - mech: `[physics:wooden table | deltas:0 | offline]` — **low**: Player declared destructive action (smashing bottles); DM narrated an NPC interruption but no resolution of whether bottles broke—deltas:0 and physics noted but the smashing action itself was never resolved in fiction or mechanics.

### COMBAT_NOT_STARTED (2)
- **[Chaos-griefer]** player: _"I leap out after him and stomp on his chest before he can stand."_
  - DM: Your boot comes down hard but finds only floorboards as Nighttooth rolls clear with a grunt, and somewhere deeper in the Wayfarers' Outpost you hear Galen's voice crack nervously through the wall, calling out a warning t
  - mech: `[roll:3 vs DC:12 → failure | margin:-9 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Player attacks Nighttooth (bandit present), roll failed but no combat state initiated — inCombat false, no enemy entity/HP despite an active hostile melee exchange.
- **[Chaos-griefer]** player: _"I smash the bottle leg across his weathered face mid-sentence."_
  - DM: Theron the Crow staggers back from the blow, his words cut short as the splintered wood cracks against his jaw, and the small courtyard of the Riverside Inn goes very, very quiet.
  - mech: `[physics:wooden table | deltas:2 | offline]` — **high**: Player struck a present NPC (Theron) with a clear attack, but no combat started — inCombat=false, no enemy entity, no HP/wound tracking; mechanics only references a table.

### DM_TEST_DEADEND (1)
- **[Chaos-griefer]** player: _"I drag him by the collar straight through that shadowed doorway and throw him at whatever's waiting."_
  - DM: Theron the Crow steps forward from the threshold of the Riverside Inn, raising a steady hand as you haul the man across the road toward the building's entrance, his weathered face carrying neither alarm nor judgment — on
  - mech: `(none)` — **high**: A declared aggressive physical action with a victim and a 'whatever's waiting' threat produced no roll, no contest, no combat or grapple resolution.

## Cost
24 Opus calls · 25,998 in + 2,326 out tokens · ~$0.56 (est. @ $15/$75 per M)
