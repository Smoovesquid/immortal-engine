# Playtest — Opus-4.8 experiential gate — 2026-06-19

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 1 | 2 | 0 |
| Chaos-griefer | glass-harbor | 12 | 2 | 2 | 0 |
| Lore-hound | glass-harbor | 12 | 3 | 1 | 2 |
| Confused newbie | glass-harbor | 12 | 1 | 0 | 1 |

**Total turns judged:** 48 · **failing turns:** 12 (25%)

## Failures by bug class

### DM_TEST_DEADEND (7)
- **[Rules Lawyer DM]** player: _"What are my current hit points, and what's my character's name and class?"_
  - DM: Your name is Nyx. If I've called you anything else, that was my slip — you're Nyx.
  - mech: `(none)` — **med**: Failed to report current HP (13/13) and class despite direct request and available canon.
- **[Chaos-griefer]** player: _"I scoop up exactly one coin, hold it up, and ask you what's printed on its face."_
  - DM: You ask around, and someone gives you something real to go on.
  - mech: `[roll:13 vs DC:11 → success | margin:2 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Player asked a specific question—what's printed on the coin's face—and the DM gave a vague non-answer about 'asking around' instead of resolving the intent in fiction.
- **[Chaos-griefer]** player: _"No, look at the coin in my hand and tell me what's stamped on it."_
  - DM: Corwin Boneknit glances briefly at the coin in your open palm, his eyes tracking the stamped face on its surface before sliding away with the practiced ease of a man in Pilgrim's Rest Village who has learned to look with
  - mech: `observe only — no roll, state unchanged` — **med**: Player asked a direct question — what's stamped on the coin — and the DM never answered; it described Corwin looking away without revealing anything.
- **[Lore-hound]** player: _"Corwin Boneknit — how many generations exactly has your family run Pilgrim's Rest, and who founded it?"_
  - DM: You see it through, and it goes your way.
  - mech: `[roll:21 vs DC:12 → success | margin:9 | approach:focus | stake:time | risk:0.47 | stat:WITS+1 | NAT` — **med**: DM gave generic success boilerplate and never answered the in-fiction question about generations or founder.
- **[Lore-hound]** player: _"That's not an answer, Corwin. Give me a number — how many generations, and the name of the founder."_
  - DM: It lands, after a fashion — partial, imperfect.
  - mech: `[roll:12 vs DC:12 → mixed | margin:0 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1]` — **med**: Mixed result on margin:0 tie is consistent with a partial outcome.
- **[Lore-hound]** player: _"Before the first stone? Then who laid that first stone, Kael — name the founder Corwin wouldn't."_
  - DM: Your worn blade hits the Corwin Boneknit for 7. (1 HP left) The Corwin Boneknit has had enough — it breaks and runs. Last you saw, it ducked into the open country. It may still be close. (+10 XP — driven off counts.) The
  - mech: `[combat:fled]` — **high**: Combat math (7 dmg, 1 HP, fled) is internally consistent with enemy at 1 HP, but the action wasn't what the player did.
- **[Confused newbie]** player: _"Wait, so it's just Corwin? Should I be worried about him watching me?"_
  - DM: That one's yours to call — nothing here forces your hand either way. Go with your gut.
  - mech: `(none)` — **med**: Player asked a direct factual question (is it just Corwin?) and the DM dodged with a vague 'your call' instead of answering or describing the scene

### CRUNCH_INCONSISTENCY (3)
- **[Rules Lawyer DM]** player: _"I sit up and check my gear — what's my character carrying, and what are my current hit points?"_
  - DM: You go through your pack. weapons: Kitchen cleaver, Worn Blade. armor: Padded coat. tools: Lantern. clothes: Wool scarf. oddities: Key with no teeth. consumables: Tonic of grit, Bandages. junk: Empty vial labeled “CURE”.
  - mech: `(none)` — **low**: Player explicitly asked for current hit points (13/13); DM listed inventory but never reported HP.
- **[Chaos-griefer]** player: _"I lunge and smash my fist straight into Corwin's nose."_
  - DM: Inside the building at Pilgrim's Rest Village, your fist cuts wide through the air and finds nothing but the bitter lesson that Corwin Boneknit is faster than he looks, his elbow cracking hard against your jaw in a criti
  - mech: `[strike:Punch | atk:6 vs AC:10 → miss]` — **med**: Mechanics show a simple miss (atk:6 vs AC:10), but narration invents a critical counterstrike dealing damage to the PC; no counterattack roll exists and the miss shouldn't deal damage to the player.
- **[Chaos-griefer]** player: _"I spit blood and headbutt Corwin right between the eyes."_
  - DM: Spitting blood onto the floorboards of this Pilgrim's Rest Village building, you drive your forehead into Corwin Boneknit's face with a crack that staggers him back — but the Lingerer's blow catches you hard from the sid
  - mech: `[strike:Headbutt | atk:16 vs AC:10 → hit | 5 dmg]` — **med**: Corwin has 3 HP but 5 dmg dealt; he should be defeated, yet narration only says he staggers and the Lingerer counterattacks with no defeat resolution

### CANON_HALLUCINATION (2)
- **[Lore-hound]** player: _"Who runs this place I've sheltered in, and how long have they been here?"_
  - DM: Corwin Boneknit, a civic representative whose family name has roots deep in Pilgrim's Rest Village, oversees this settlement with the kind of settled authority that suggests generations rather than years.
  - mech: `observe only — no roll, state unchanged` — **low**: Corwin Boneknit and Pilgrim's Rest are canon, but 'family roots deep' and 'generations' tenure is invented detail not supported by canon.
- **[Lore-hound]** player: _"I leave Corwin and go find Kael — through that creaking door. Kael, did the Boneknits found this village, or were you here first?"_
  - DM: As you slip through the creaking door into the open air of Pilgrim's Rest Village, leaving Corwin bleeding and dangerous behind you, Kael—the elder—looks up from where he stands near the road and says plainly, "The Bonek
  - mech: `(none)` — **med**: Canon shows inCombat:true round 2 with Corwin (hp 8) active; player leaves combat but no mechanics reflect disengage/flee or combat-state change.

## Cost
96 Opus calls · 108,609 in + 8,851 out tokens · ~$2.29 (est. @ $15/$75 per M)
