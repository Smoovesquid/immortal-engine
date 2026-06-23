# Playtest — Opus-4.8 experiential gate — 2026-06-23

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 5 | 2 | 0 |
| Chaos-griefer | glass-harbor | 12 | 0 | 2 | 0 |
| Lore-hound | glass-harbor | 12 | 1 | 0 | 1 |
| Confused newbie | glass-harbor | 12 | 1 | 0 | 1 |

**Total turns judged:** 48 · **failing turns:** 12 (25%)

## Failures by bug class

### DM_TEST_DEADEND (7)
- **[Rules Lawyer DM]** player: _"What's my class and what does the Tonic of grit actually do—any mechanical effect if I drink it?"_
  - DM: Tonic of grit — it heals 2d4.
  - mech: `(none)` — **low**: Player asked two things—class and tonic effect—DM only answered the tonic, ignoring the class question entirely.
- **[Rules Lawyer DM]** player: _"As a level 1 sellsword, what are my class features or abilities—do I have anything special in a fight, or am I just swinging the Worn Blade?"_
  - DM: Yes — Worn Blade is in your pack.
  - mech: `(none)` — **med**: Player asked about class features/abilities; DM gave a non-answer about the blade being in the pack, ignoring the actual question.
- **[Rules Lawyer DM]** player: _"You dodged the question. Do I have any class features or special combat abilities, yes or no? List them."_
  - DM: Inside the building at Pilgrim's Rest Village, Corwin Boneknit's expression stays carefully neutral, and no answer comes — just a slow shrug and the quiet creak of the floorboards beneath your feet.
  - mech: `[roll:3 vs DC:12 → failure | margin:-9 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Player asked an out-of-fiction sheet question (do I have class features?); DM dodged with NPC shrug and never resolved the intent.
- **[Rules Lawyer DM]** player: _"So with MIGHT +1, my Worn Blade attack is d20+1 to hit and 1d6+1 damage—is that right?"_
  - DM: It lands, after a fashion — partial, imperfect.
  - mech: `[roll:14 vs DC:13 → mixed | margin:1 | approach:force | stake:harm | risk:0.68 | stat:MIGHT+1 | woun` — **med**: No attack was declared, yet a mixed-success harm roll fired; the player's dice-math question went unanswered/unconfirmed.
- **[Rules Lawyer DM]** player: _"Then why are you here, Corwin? You didn't climb the stairs to discuss the weather—name the job or I'm going back to sleep."_
  - DM: You take a real bed and a real night. Sleep comes slow, then all at once. You wake whole — 13/13 HP.
  - mech: `[rest:long]` — **high**: Long rest restored HP to 13/13 consistent with maxHp; mechanics tag matches.
- **[Lore-hound]** player: _"So Kael — is that the same Kael who knew your father? Walk me to them now, Corwin."_
  - DM: Which way will you set off, The roads lead to The Sunken Road to the south and Dry Creek to the west.
  - mech: `(none)` — **high**: Player asked Corwin a direct question and to be walked to Kael; DM bounced with a mechanical direction prompt instead of resolving intent in fiction.
- **[Confused newbie]** player: _"Oh, can I go say hi to him?"_
  - DM: In Pilgrim's Rest Village, Corwin Boneknit offers you an apologetic smile and gestures toward a wall, confirming that the way through to the other side is blocked from where you stand.
  - mech: `(none)` — **med**: Player asked to greet someone; DM gave a confusing non-answer about a blocked wall instead of resolving the social intent in fiction.

### CRUNCH_INCONSISTENCY (3)
- **[Rules Lawyer DM]** player: _"That's not an answer to a yes/no question. Is my Worn Blade attack d20+1 to hit and 1d6+1 damage—yes or no?"_
  - DM: In Pilgrim's Rest Village, Corwin Boneknit meets your direct gaze and gives you a plain, firm nod — yes.
  - mech: `[roll:16 vs DC:13 → success | margin:3 | approach:force | stake:harm | risk:0.68 | stat:MIGHT+1 | wo` — **med**: Player asked a clear rules question about attack/damage dice; DM answered 'yes' via an NPC nod but never confirmed the actual d20+1 / 1d6+1 values, and the mechanics roll is irrelevant to a yes/no clarification—no combat or attack resolved.
- **[Chaos-griefer]** player: _"I climb out the window and hurl the burning stool through the bakery's front door."_
  - DM: Emerging back into the open air of Pilgrim's Rest Village, you fling the burning stool in a crackling arc through the nearest doorway of the building before you.
  - mech: `(none)` — **med**: lastRoll was 9 vs DC 13 = failure, yet the narration depicts the action succeeding cleanly with no consequence or mechanical reflection of the failure.
- **[Chaos-griefer]** player: _"Who the hell is the Lingerer — I spin and ram my elbow into its throat."_
  - DM: Your elbow connects hard with the Lingerer's throat in the middle of Pilgrim's Rest Village's dusty road, and the strange wanderer staggers, breaks, and bolts into the open country beyond the settlement's edge while Corw
  - mech: `[strike:Elbow | atk:19 vs AC:10 → hit | 6 dmg]` — **med**: Attack target was the Lingerer but the Lingerer is not an enemy entity with HP; combat enemy is Corwin Boneknit. The 6 dmg has no tracked target, and the Lingerer simply 'breaks and bolts' with no HP resolution.

### CANON_HALLUCINATION (2)
- **[Lore-hound]** player: _"Always? Then tell me the name of the representative when you were a boy here, Corwin."_
  - DM: Corwin Boneknit holds your gaze for a beat too long, then says that in Pilgrim's Rest Village the representative when he was a boy was his own father — and the warmth that crosses his face is real, though something behin
  - mech: `[roll:18 vs DC:12 → success | margin:6 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1` — **med**: DM asserts Corwin's father was the past representative; no canon support for this specific past-fact, and another Boneknit (Torva) exists but is a trader, not flagged
- **[Confused newbie]** player: _"Who's the stranger keeping to the edges?"_
  - DM: Corwin Boneknit, a representative — one of the folk here, watching from nearby.
  - mech: `(none)` — **med**: The 'stranger keeping to the edges' best matches the Lingerer (a wanderer asking unwelcome questions); naming Corwin the representative misattributes the edge-lurker.

## Cost
96 Opus calls · 139,266 in + 8,825 out tokens · ~$2.75 (est. @ $15/$75 per M)
(+ the Ref's Haiku judge / Sonnet regen on soft turns, and ~$0.10 for the direct
verification below — total ≈ $2.9, within the one-gate envelope Tim approved.)

---

## THE REF (Tier 2) — flag-ON analysis

**Run config:** `REF_ENABLED=1` on the dev server — the live Ref active on every
`/api/narrate` call. Judge = `claude-haiku-4-5` (atomic, no-CoT); regen =
`claude-sonnet-4-6` (the narrator's model), validated through the Tier-1 guard.
This is the FIRST flag-ON gate. Compare to the flag-OFF baseline series (gates
5–19: 12→7→6→4→5→3→6→5 — a bouncing ruler on an only-improving engine).

### Did the Ref regress anything? No.
The Ref touches WORDS only, and ONLY on soft `[dialogue ask | deflected/place/
shared/continuity]` turns. **Zero of the 12 failures carry a `[dialogue ask]`
mechanics tag** — every one is `(none)` (meta/compound), `[roll …]` (generic
resolve), `[rest:long]`, or `[strike …]` (combat). So the Ref touched **no failing
turn** — there are no Ref-caused failures. The gate also ran all 48 turns through
`/api/narrate` with the Ref live and **non-erroring** (no CRASH class); the
lore-hound's dialogue-ask turns passed. Wiring is live and safe.

### The 12 failures, classified against the Ref's scope:
| Class | Count | In Ref scope? | Disposition |
|---|---|---|---|
| Compound-meta / sheet-question precedence (RL t1/t2/t3-list/attack-math) | ~5 | No (meta path, not dialogue-ask) | DESIGN-LOCKED defer (gate-17/18) |
| Navigation / approach-NPC bounce (Lore t9, Newbie t3) | 2 | No (movement, not narration) | C12 — navigation/combat lane |
| Combat target/crunch (Chaos elbow→Lingerer; stool throw) | 2 | No (combat) | COMBAT LANE (gate-16#4 sibling) |
| Rest dropped the "name the job" intent (RL) | 1 | No (rest path) | navigation/intent lane |
| **Fabrication via a generic WITS roll** (Lore "representative…his father") | 1 | **No — but SHOULD be** | **NEW: extend soft-set to generic-resolve** |
| Mis-id via meta naming (Newbie "stranger"→Corwin) | 1 | No (meta/observe path) | RAG/identity (not dialogue-ask) |

### The 3 named targets — verified live, DIRECTLY (the reliable proof)
A stochastic gate may not re-elicit the exact gate-16/19 dodge turns, so the three
targets were verified directly against the live judge+regen (real Anthropic key,
canon = the dialogue fixture), with two CONTROLS to prove the judge does not
over-flag (guardrail 1). **Result: 5/5 as expected.**
- **T1 atmosphere-dodge** ("…keeps its own tally of years") → REGENERATE; regen →
  *"Couldn't rightly say — time has a way of slipping past me."* (honest decline).
- **T2 question-misroute** (origin Q answered with a place recitation) → REGENERATE
  → fell back to the honest base (regen rejected by the validator — safe).
- **T3 fabrication** ("Three nights, and Corwin vouched") → REGENERATE/FABRICATION
  (`grounded:false`) → honest base.
- **C1 honest-decline** ("Couldn't say… ask someone older") → **PASS** (not flagged).
- **C2 in-voice attitude** ("I keep to my ovens…") → **PASS** (not flagged).

The judge correctly flags all three failure shapes AND passes both good lines — the
mechanism works and is not trigger-happy.

### Findings → next
1. **The Ref's named job is done** — the dialogue dodge/misroute/fabrication shapes
   are caught (deliver / honest-decline / fallback), never shipped. Verified live.
2. **Extend the soft-set to the generic-resolve / WITS-roll path** (failure #11 +
   the RL t3 shrug): fabrications and dodges also arrive via `[roll …]`, not only
   `[dialogue ask]`. The `narrationSource='generic-resolve'` hook is already built;
   wire playloop's generic-resolve outcomes to set it. (Next packet — out of scope
   for the 3 named targets, which are all dialogue-ask.)
3. The dominant residual (compound-meta precedence, navigation/approach, combat
   target) is unchanged and out of the Ref's scope — those stay on their existing
   deferred lanes. The 12/48 is persona variance + those known classes, not a Ref
   effect (corpus 100% is the floor; the gate % is the noisy pointer).
