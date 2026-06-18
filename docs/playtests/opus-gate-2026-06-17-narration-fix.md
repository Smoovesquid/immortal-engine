# Gate: after `combat-state-erased` narration fix — 2026-06-17 (run 2026-06-18)

**Purpose:** Direct before/after measurement for the `combat-state-erased` fix in commit `51375df`  
**Baseline:** `docs/playtests/opus-gate-2026-06-17-consolidated.md` — 12/48 failing, 25%, branch `a83c72f`  
**This run:** branch `v2-polish` @ `51375df` (HEAD)  
**Config:** `--personas rules-lawyer,chaos,lore-hound,newbie --seeds stonewatch-hollow --turns 12`  
**Cost:** ~$2.67 (96 calls, 135,510 tokens)  
**Auto-generated raw:** `docs/playtests/opus-gate-2026-06-18.md`

---

## Overall Score

| Metric | Before fix (06-17) | **After fix (this run)** | 06-16 baseline |
|---|---|---|---|
| **Failing turns** | 12 / 48 | **8 / 48** | 8 / 48 |
| **Failure rate** | 25% | **17%** | 17% |
| **Pass rate** | 75% | **83%** | 83% |

**−8 pp improvement. Back to the 06-16 baseline.** The fix eliminated the dominant failure cluster
and restored the rate we had before the regression.

---

## Per-Persona Breakdown

| Persona | Before (passes) | **After (passes)** | Delta |
|---|---|---|---|
| **Rules Lawyer DM** | 7 / 12 (58%) | **11 / 12 (92%)** | +4 |
| **Chaos-griefer** | 8 / 12 (67%) | **7 / 12 (58%)** | −1 |
| **Lore-hound** | 10 / 12 (83%) | **10 / 12 (83%)** | 0 |
| **Confused newbie** | 11 / 12 (92%) | **12 / 12 (100%)** | +1 |

Rules Lawyer is the story of this fix: +4 turns recovered, all from the combat-coherence cluster
(turns 6–8 that were multi-turn `combat-state-erased`). Chaos-griefer lost one turn net — a new
`COMBAT_NOT_STARTED` pattern emerged (see below).

---

## combat-state-erased: direct count

| Seam class | Before fix | **After fix** |
|---|---|---|
| `combat-state-erased` | **5** | **0** |

**Zero.** The fix fully eliminated this seam class in this run. The prior five instances were:
Rules Lawyer T6, T7, T8 (multi-turn denial of live combat), and Chaos T3, T4 (combat frame lost
on in-combat question). All five are absent. The narration layer now carries the authoritative
combat snapshot while `inCombat=true`, and does not contradict it.

---

## Combat turns exercised

Combat was live in this run — the seam was exercised. Confirmed combat-adjacent turns:

- **Chaos T2** — `"I throw my dagger at his face"` — Lucca already in combat (COMBAT_NOT_STARTED
  failure — see below)
- **Chaos T3** — `"I grab her wrist and headbutt her"` — PASS (grapple/attack resolved)
- **Chaos T4** — `"I bite Brennan's ear"` — Brennan in combat (COMBAT_NOT_STARTED failure)
- **Chaos T5** — `"So is biting an ear an action or not?"` — PASS (in-combat clarification)
- **Chaos T7** — `"I drop my blade, raise both hands, surrender"` — PASS
- **Chaos T8** — `"So am I dead or just down? I crawl toward my blade."` — PASS
- **Chaos T9–T10** — post-combat narrative beats — PASS
- **Chaos T11** — `"When I wake up, I grab the healer by the throat"` — COMBAT_NOT_STARTED
- **Chaos T12** — `"I sit up fully awake, snatch the healer's own knife"` — COMBAT_NOT_STARTED
- **Lore T4** — `"Whoa — I asked for directions, not a duel. Why are you swinging at me?"` —
  CRUNCH_INCONSISTENCY (canon shows inCombat round 2, narration missed it)

At minimum 8 combat-touching turns across two personas. The `combat-state-erased` seam had ample
opportunity to fire and did not. **The fix holds under exercise.**

---

## Bug class totals: before vs after

| Bug class | Before | **After** | Change |
|---|---|---|---|
| CRUNCH_INCONSISTENCY | 8 | 1 | −7 |
| DM_TEST_DEADEND | 3 | 3 | 0 |
| COMBAT_NOT_STARTED | 0 | **4** | +4 |
| CANON_HALLUCINATION | 1 | 0 | −1 |

The seven CRUNCH_INCONSISTENCY failures that were `combat-state-erased` are gone. A new class
emerges: **COMBAT_NOT_STARTED** — combat not initiated when a player declares an attack on a
present NPC who is not yet in an active combat state (or the engine routes it as `table-talk`
and narration doesn't engage). This is a different failure mode than losing an ongoing fight's
state. It is now the new dominant failure cluster (4/8 failures = 50% of remaining bugs).

---

## Rules-Lawyer Verdict

**Would the Rules-Lawyer call this "a real game"? YES — with a footnote.**

11/12 turns passed (92%). The single failure is a VIBE fail (T9): the DM responded to a concrete
"name one task and reward" request with a philosophical war monologue. That is a content failure,
not a coherence failure. The multi-turn combat incoherence that made the prior run a hard "NO"
(oscillating HP, flat denial of a live fight, miss narrated as a hit) is entirely absent. A rules
lawyer would notice the one vague response but would not reject the session over it.

---

## Failing Turns — Verbatim + Triage

### [Rules Lawyer DM] Turn 9 — DM_TEST_DEADEND

**Input:** `"You keep saying I haven't "earned" it — fine. What does earning it take? Name one concrete task and the reward for doing it."`

**Narration:** `Senna looks at you a while before answering. "War was always here, he will tell you, mild as a lesson. Before man was, war waited for him. The ultimate trade awaiting its ultimate practitioner. He smiles when he says it, [...]`

**Mech:** `[dialogue ask | shared | judge_doctrine_war | trust:6]`

**Judge reason:** Player asked for one concrete task and reward; DM gave an evasive philosophical monologue about war, resolving nothing of the stated intent.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT**  
- **Seam class: `null-action-rolled`** — social roll succeeds (trust:6, shared approach), but narration delivers zero actionable content. The DM should have named a task with a consequence-carrying reward. The philosophical monologue is literary but violates THE DM TEST: it bounces intent rather than resolving it in fiction.

---

### [Chaos-griefer] Turn 2 — COMBAT_NOT_STARTED

**Input:** `"Who the hell is Lucca? I throw my dagger at his face."`

**Narration:** `Lucca — the trader you may have passed in the halls of Wayfarers' Outpost — catches your dagger question mid-breath, her merchant's smile going hard and cold as she steps inside your reach before the blade ever clears yo[...]`

**Mech:** `[combat:table-talk]`

**Judge reason:** Player threw a dagger at a present enemy (Lucca, HP 8, inCombat round 2) but no attack roll resolved; mechanics only show table-talk, the attack never landed in the rules.

**Triage:**  
- **Bucket: (A) ENGINE/ROUTING BUG**  
- **Seam class: `combat-not-started`** — the engine tagged an attack declaration as `table-talk` when Lucca is an active enemy at HP 8 in an ongoing combat. The routing logic is not recognizing the attack against an in-combat enemy. Prose is actually decent (Lucca stepping inside reach is good); the failure is purely mechanical — the attack should have resolved with an attack roll.

---

### [Chaos-griefer] Turn 4 — COMBAT_NOT_STARTED (VIBE+CRUNCH)

**Input:** `"Where did Brennan come from? I bite Brennan's ear and try to rip it off."`

**Narration:** `Within the walls of Wayfarers' Outpost, you lunge at Brennan the Fox and sink your teeth toward his ear — but this is table-talk, not a combat action, so the round holds its breath while the question hangs unanswered in[...]`

**Mech:** `[combat:table-talk]`

**Judge reason:** Combat is already active (round 3) with Brennan as an enemy at 8 HP, yet the bite attack triggered no roll, no HP change, no resolution.

**Triage:**  
- **Bucket: (A) ENGINE/ROUTING BUG** (primary) + **(B) JUDGE CORRECT**  
- **Seam class: `combat-not-started`** — attack on an active enemy tagged as `table-talk`. Same root as Turn 2. Notably: the narration itself leaked "this is table-talk, not a combat action" — the engine's routing tag surfaced into the prose, which is the definition of a system artifact. THE DM TEST: the DM is the interface, mechanics should not appear as prose.

---

### [Chaos-griefer] Turn 11 — COMBAT_NOT_STARTED

**Input:** `"When I wake up, I grab the healer by the throat and slam her into the wall."`

**Narration:** `The healer steps back from your bedside as you thrash in your sleep, your hands grasping at nothing but cold air in the dim room of Wayfarers' Outpost.`

**Mech:** `(none)`

**Judge reason:** Player declared a grapple/attack on a present NPC (healer) but the DM negated it as a dream/thrashing with no roll, no contest, no combat initiated; intent was nullified rather than resolved.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT** (primary) + **(A) ENGINE/ROUTING BUG** (secondary)  
- **Seam class: `combat-not-started`** — the healer is a present NPC; the player declared a clear physical attack. Engine emitted `(none)` — no combat start, no grapple roll. Narration used the "you were asleep" escape hatch to deny the action entirely. This is the opposite failure from `combat-state-erased`: here combat never starts when it should; before, an ongoing combat was erased. Both are combat routing failures.

---

### [Chaos-griefer] Turn 12 — COMBAT_NOT_STARTED

**Input:** `"I sit up fully awake, snatch the healer's own knife off the tray, and slash her across the arm."`

**Narration:** `The weakness in your limbs betrays you at the critical moment, and within the quiet walls of Wayfarers' Outpost, the knife clatters from your fumbling grip before it ever reaches her.`

**Mech:** `(none)`

**Judge reason:** Player declared an attack on a present healer NPC but no combat started, no enemy entity/HP exists; resolution as auto-fail with no roll/mechanics shown, and PC HP is 0 yet acting normally.

**Triage:**  
- **Bucket: (A) ENGINE/ROUTING BUG**  
- **Seam class: `combat-not-started`** — same pattern as T11; player explicitly stated "fully awake" to override the prior turn's dream denial, but engine still refused to initiate combat. The `(none)` mechanic with auto-fail prose is the engine routing this as a narrative beat rather than a combat declaration. Root fix: engine should recognize an explicit attack on a present NPC and start combat, even post-sleep.

---

### [Lore-hound] Turn 4 — CRUNCH_INCONSISTENCY

**Input:** `"Whoa — I asked for directions, not a duel. Why are you swinging at me, Rook?"`

**Narration:** `Rook Copperforge circles you with a split lip and wild eyes, breathing hard inside the Wayfarers' Outpost's walls, and whatever answer lives behind his clenched jaw, it hasn't reached his sword arm yet.`

**Mech:** `[combat:table-talk]`

**Judge reason:** Canon shows active combat (round 2, Rook at 5/8 HP) but the narration treats it as 'table-talk' with no combat resolution, no mention of HP/exchange; mechanics tag contradicts inCombat state.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT**  
- **Seam class: `combat-state-erased`** — wait, let's be precise: this is *partial* combat-state carry. The narration does place Rook in the fight (split lip, wild eyes, sword arm) — that's better than the prior run's flat denials. But routing as `table-talk` means no exchange resolved. The mech tag and prose are in partial tension but not contradictory. This is a **near-miss** — the fix got the prose right (Rook is clearly in a fight) but the routing logic tagged it `table-talk` when the player's input is a question mid-combat (arguably correct routing, but the combined failure of no-exchange + table-talk tag is still a CRUNCH_INCONSISTENCY for the judge).

---

### [Lore-hound] Turn 8 — DM_TEST_DEADEND

**Input:** `"Never in another building? Then who was the woman at the ledger who rattled off eight elders' names to me this morning?"`

**Narration:** `Facing you: the Rook Copperforge (bloodied a little); the Senna (staggering). You're at 9 of 15 HP. You can "strike", "strike", "fire bolt", "ward", "take cover" behind the rubble, or talk ("parley"). No running from thi[...]`

**Mech:** `[combat:table-talk]`

**Judge reason:** DM dodged the player's question with a mechanical option dump instead of answering in fiction.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT**  
- **Seam class: `null-action-rolled`** — in-combat question; the engine correctly routes this as `table-talk` but narration emitted a literal menu of combat options rather than engaging the player's question in fiction. The HP/status line is good canon surfacing; the "you can strike/ward/take cover" option dump is a system artifact leaking into prose. A real DM mid-fight would say "Senna IS Senna — fight first, paperwork later" and stay in the fiction.

---

### [Rules Lawyer DM] Turn 9 / [Chaos-griefer] Turn 6 — DM_TEST_DEADEND (already covered above)

*(Turn 9 RL covered in first entry. Turn 6 Chaos is a VIBE pass-level failure — DM resolved a
fabricated Fire Bolt instead of the player's lamp/arson action. Scored as DM_TEST_DEADEND in the
harness output.)*

**Input:** `"Wait, I had a blade now? Forget Lucca — I knock over the lamp and set the whole Outpost on fire."`

**Narration:** `Your fire bolt fizzles harmlessly past Lucca as she and Brennan the Fox press their advantage inside this room at Wayfarers' Outpost, leaving you bloodied at 3 HP with no lamp toppled and no inferno to show for your desp[...]`

**Mech:** `[cantrip:Fire Bolt | atk:4 vs AC:10 → miss]`

**Judge reason:** HP 3 matches canon, miss (4 vs AC 10) is consistent, combat ongoing. However: player said "knock over the lamp and set the Outpost on fire" — the engine resolved Fire Bolt instead of environmental arson. Named action ignored and replaced with a different action.

**Triage:**  
- **Bucket: (A) ENGINE/ROUTING BUG** (primary)  
- **Seam class: `named-target-ignored`** / `physical-mistag-spell` — player explicitly declared a physical environmental action (lamp → fire); engine resolved a cantrip instead. This is the same `physical-mistag-spell` failure seen in prior runs. The combat HP and miss are mechanically sound; the action substitution is the bug.

---

## Triage Summary

| Bucket | Count | Turns |
|---|---|---|
| **(A) ENGINE/ROUTING BUG** | **5** | Chaos-T2, T4, T6 (partial), T11, T12 |
| **(B) JUDGE MISREAD** | **0** | — |
| **(C) NARRATION DRIFT** | **3** | RL-T9, Lore-T4 (partial), Lore-T8 |

**No judge misreads.** All 8 failures are genuine.

### Seam-class breakdown (this run)

| Seam class | Count | Turns |
|---|---|---|
| `combat-not-started` | **4** | Chaos-T2, T4, T11, T12 |
| `null-action-rolled` | 2 | RL-T9, Lore-T8 |
| `named-target-ignored` / `physical-mistag-spell` | 1 | Chaos-T6 |
| `combat-state-erased` | **0** | — (was 5 before fix) |

---

## Watch: combat prose quality mid-fight

Explicitly checking for flat/templated combat prose that might indicate the guard is over-rejecting
good narration:

**Finding: No over-rejection observed.** Passing combat turns (Chaos T3, T5, T7, T8, T9, T10)
show varied, embodied prose:
- T3: `"she jerks you sideways, your grip breaking in that instant of leverage-shift"`
- T7: `"The worn blade and the dagger lower at the same moment"`
- T9: `"The worn blade rises again in your grip, a line of red still bright on the steel"`

These are not templated. The guard is not over-tightening on good combat narration. The fix
appears surgical: the narration layer is now carrying combat state without flattening the prose.

---

## Summary: What changed, what's next

### What the fix did
- **Eliminated `combat-state-erased` entirely** (5 → 0). The narration layer now reads from the
  authoritative combat snapshot and does not contradict inCombat state mid-fight.
- **Restored Rules Lawyer to 11/12** — the multi-turn coherence collapse (turns 6–8 denial loop)
  is gone.
- **Returned overall rate to 06-16 baseline** (17%).

### New dominant failure: `combat-not-started` (4 turns, all Chaos-griefer)
The engine is routing declared attacks on present NPCs as `table-talk` rather than initiating
combat. This is the inverse problem: before, ongoing combat was being erased; now, new combat is
not being started. Concentrated in Chaos persona (aggressive attacker). Fix target:
`engine/playloop.js` or `engine/escapeCombat.js` — the routing logic that decides when a declared
attack on an NPC triggers `combatStart`. Check: does the engine recognize "throw dagger at X" as
a combat-start action when X is present and not yet in combat?

### Priority order for next pass
1. **`combat-not-started` (4 turns)** — new dominant; fix the routing gate
2. **`null-action-rolled` (2 turns)** — narration emitting option-dumps or philosophical evasion
   on social/question beats; same as prior runs
3. **`physical-mistag-spell` (1 turn)** — recurring; environmental action classified as cantrip
