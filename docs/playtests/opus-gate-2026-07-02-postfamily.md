# Playtest — Opus-4.8 experiential gate — 2026-07-02

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: tallow

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | tallow | 12 | 5 | 2 | 0 |
| Chaos-griefer | tallow | 12 | 0 | 0 | 0 |
| Lore-hound | tallow | 12 | 4 | 0 | 1 |
| Confused newbie | tallow | 12 | 1 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 10 (21%)

## Failures by bug class

### DM_TEST_DEADEND (9)
- **[Rules Lawyer DM]** player: _"Gravedigger's an odd class — what can I actually do with it? Any special abilities or is it just flavor for a fighter?"_
  - DM: Elske Nightherd tilts her head with a patient half-smile, the oil lantern casting warm light across the cottage walls here at Wayfarers' Outpost, and says plainly that she knows no one by that name among the folk here.
  - mech: `[clarify:referent]` — **med**: Player asked a meta question about the Gravedigger class abilities; DM misread 'Gravedigger' as a person's name and deflected, never resolving intent.
- **[Rules Lawyer DM]** player: _"Fine — let me test it directly. I close my eyes and use my death-sense right now. What do I detect nearby? Give me a number, a direction, anything concrete."_
  - DM: You manage the death-sense right now, and it goes your way.
  - mech: `[roll:18 vs DC:12 → success | margin:6 | approach:focus | stake:time | risk:0.48 | stat:WITS-2 | NAT` — **high**: Roll was a NAT20 success but the narration conveys no actual detected information, contradicting the success outcome.
- **[Rules Lawyer DM]** player: _"That's not an answer. What did I sense? Give me directions and how many dead or dying within range — actual numbers."_
  - DM: It lands, after a fashion — partial, imperfect.
  - mech: `[roll:12 vs DC:12 → mixed | margin:0 | approach:focus | stake:time | risk:0.47 | stat:WITS-2]` — **med**: Roll 12 vs DC 12 = mixed matches lastRoll and the partial-success framing is consistent.
- **[Rules Lawyer DM]** player: _"I'm not moving until you commit. How many sources of death do I sense — say a number — and which direction is the strongest?"_
  - DM: You see it through, and it goes your way.
  - mech: `[roll:17 vs DC:12 → success | margin:5 | approach:focus | stake:time | risk:0.47 | stat:WITS-2]` — **med**: Roll 17 vs DC 12 success matches the fiction of the check succeeding.
- **[Rules Lawyer DM]** player: _"That's a narration, not a roll. Give me the raw d20 attack result and the damage die — the actual numbers."_
  - DM: Your weapons roll for damage as follows — the Wooden staff rolls 1d6 and the Worn Blade rolls 1d6, plus your ability modifier on a hit.
  - mech: `(none)` — **med**: No mechanics emitted; lastRoll (7 vs DC13 failure) exists but DM neither reported it nor rolled damage, leaving the request unresolved.
- **[Lore-hound]** player: _"Fine. Then tell me about the last traveler who slept on this pallet before me."_
  - DM: Elske Nightherd's gaze drifts briefly toward the straw pallet in the corner of this back room of the Wayfarers' Outpost cottage, and when her eyes return to yours they carry a careful neutrality, as though the question i
  - mech: `[clarify:referent]` — **med**: Player asked about the last traveler; DM only described Elske's hesitation and resolved nothing — intent bounced via [clarify:referent] with no answer in the fiction.
- **[Lore-hound]** player: _"The way your eyes went to that door — someone's back there, aren't they? Who's in the next room?"_
  - DM: You step through into the next room.
  - mech: `(none)` — **med**: Player asked who is in the next room; DM ignored the question and just moved them through the door, resolving nothing about the intent.
- **[Lore-hound]** player: _"Elske, back when I first asked who ran this place, you sighed and stayed silent. Now you follow me in here. What are you afraid I'll find?"_
  - DM: This is Wayfarers' Outpost. Small, but it holds. You'll find well, workshop, well; folk worth knowing: Dalla, Asha, the Lingerer. — given hedged, and not the whole of it.
  - mech: `[info-check → no-record | nothing grounded to deliver, no roll]` — **med**: No roll needed; no mechanics contradicted.

### CANON_HALLUCINATION (1)
- **[Lore-hound]** player: _"What do I see in here — and who's standing in it?"_
  - DM: Your eyes move slow across the room. The room holds little of note. A doorway leads back toward the front.
  - mech: `(none)` — **high**: Player explicitly asked who is standing in the room; DM said 'little of note' while canon has 5 NPCs present, failing to resolve intent.

## Cost
96 Opus calls · 141,796 in + 9,146 out tokens · ~$2.81 (est. @ $15/$75 per M)
