# Second-Order Diagnosis — why the answerability family did not collapse P5

**Author:** Fable 5 (per `docs/briefs/FABLE-second-order-diagnosis.md`), 2026-07-02.
**Evidence:** `docs/playtests/opus-gate-2026-07-02-postfamily.md` (primary), `docs/briefs/FAILURE_META_DIAGNOSIS.md`
(the first diagnosis, whose P5 this run falsified), the shipped AG-1 code (`engine/grace/answerability.js`,
`playloop.js:1652–1731 / :3001–3018 / :7040–7052`), the answer machinery (`answerOrDeclineQuestion`
`playloop.js:6912–6940`, `gracefulAdjudication.js` meta handlers :1767–1807), `public/v1.js:1582–1584`,
`docs/DND_XCOM.md` §THE LAW, and the AG-1/AG-2 briefs. No new paid runs.

**Judge-bias discipline (V14):** every mechanism claim below is grounded in the turn's deterministic `mech:` tag
plus a regex/source-line trace of the shipped code — I re-ran the classifier's regexes against each failing turn's
text by hand. Where the Opus judge's *class label* disagrees with the mech trace (one case, §1.4), the trace wins.

---

## 0. The headline

**P5 failed because its antecedent was never true: the thing that shipped as AG-1 is not the mechanism §4
specified.** The spec's one load-bearing property — *recall-biased* classification, enforced *at the sinks* — was
inverted in implementation: the classifier ships with precision-tuned exclusions that made **6 of the 9 itemized
failing turns structurally invisible to every AG-1 guard**, and the sink-side enforcement landed on ~2 of the
~6 sink paths. Where the mechanism actually ran as designed, it worked — this gate contains a clean natural
experiment proving it (§1.3). The remaining failures split into a mislabeled cluster that needs **no law change**
(§3 — the "crunch-transparency collision" dissolves under mech-trace), one genuine content gap (§4), and one new
defect shape the buckets missed (§5).

The deeper finding for Q2: **"postcondition at the sink" degraded into "detector at the entrance" because the
architecture has no sink** — it has ~dozens of scattered return sites, and a guard placed at any *upstream* position
is forced into precision-bias by its position, no matter what the design comment says (§2.2). The cure is a single
egress, where recall-bias is finally affordable (§2.3).

---

## 1. Why P5 missed (Q1)

### 1.1 The prediction scorecard — the instrument itself held

| Prediction (first diagnosis §3) | Outcome |
|---|---|
| P1 — shapes forecast: imperative info-demands reaching S1/S2, compound-drops | **Shapes confirmed** (death-sense cluster = (c); LH-2 = (b)); count branch n/a (structural change did ship) |
| P2 — ≥1 mech line shows a d20 rolled on a question | **✓** — RL-3 `[roll:12]`, RL-4 `[roll:17]` on pure retro-info demands |
| P3 — CANON_HALLUCINATION 0 on wired domains; no proper-noun fabrication | **✓** — the one "hallucination" is an *omission* (§1.4), zero invention. G2 stays dissolved |
| P4 — combat ≈0–1, table-talk swallow if any | **✓** — Chaos-griefer 12/12, zero swallows. G3 dissolved |
| P5 — AG-1 §4 ships → DEADEND ≤1/48 | **✗** — 9/48. But see §1.2: §4-as-specified did not ship |

Four of five held, and the one that failed is the only one whose **antecedent wasn't checkable**. P5 said "if AG-1
(§4) ships"; a packet *named* AG-1 shipped, passed its done-when, and diverged from §4 in the single dimension that
carried the prediction. Process lesson in §8.

### 1.2 What actually shipped — the wiring inventory

More shipped than the brief's "1 of 6 kinds" framing, which makes the failure pattern *more* diagnostic, not less:

- **Pre-roll rule (R3): SHIPPED and works** — `playloop.js:3010` suppresses the d20 for any non-null
  `directQuestionIntent`. Proof it fires: LH-3's mech is `[info-check → no-record … no roll]` on an npc-addressed
  question.
- **Gen-bank floor postcondition: SHIPPED** — `playloop.js:7047` reroutes to `answerOrDeclineQuestion`. But
  double-gated (§1.3, blocker B).
- **Explore-branch reroute: 1 of 6 kinds** (`referent-followup` only, `:1659`) — the brief's noted gap.
- **NOT guarded:** the `[clarify:referent]` emitters (`:1671` et al.), the movement/room-transition claim, and the
  delivery layer's fact-relevance (§5).
- **The classifier itself: precision-biased, contradicting its own header.** `answerability.js:8` declares
  "recall-biased by design"; lines 20–33 then install three exclusions — `ACTION_VERB_RE`, `ACTION_PERM_RE`
  (`can|could|should|…|do|did|does|would|will|must + I/we`), `SENSORY_SURVEY_RE` — that run *before* any kind is
  assigned. `ACTION_PERM_RE` cannot distinguish "**can I** climb it?" (feasibility — correctly excluded) from
  "what **can I** do with my class?" / "what **do I** detect?" / "what **did I** sense?" (info demands — wrongly
  excluded). Every first-person experiential question is invisible.

### 1.3 The turn-by-turn mechanism ledger

| Turn | mech tag | `directQuestionIntent` verdict (traced) | Which guard was live | Actual killer |
|---|---|---|---|---|
| RL-1 Gravedigger class | `[clarify:referent]` | **null** — `ACTION_PERM_RE` "can I" fires before the `rules` vocab check (which would match "class/abilities") | none could fire on null | classifier-blind **+** unguarded clarify emitter |
| RL-2 death-sense "what do I detect?" | `[roll:18 → success]` | **null** — "do I" | pre-roll moot (embedded declared action — rolling was arguably right); floor guard blind | classifier-blind + **contentless result-space** (§4) |
| RL-3 "what did I sense? …actual numbers" | `[roll:12 → mixed]` | **null** — "did I" | pre-roll blind → **S1: re-rolled a retro-info demand**; gen:m verbatim (`:7128`) | classifier-blind |
| RL-4 "how many … do I sense?" | `[roll:17 → success]` | **null** — "do I" | same; gen:s verbatim (`:7127`) | classifier-blind |
| RL-5 "give me the raw d20 + damage die" | `(none)` | **null** — "give me" ∉ `IMPERATIVE_INFO_RE`, no WH-opener, no trailing "?" | grace meta: the weapon-damage branch answered the *second* half, dropped the roll-report half | classifier-blind + **meta compound-drop** (§3.2) |
| LH-1 "tell me about the last traveler" | `[clarify:referent]` | **non-null, kind `place`** ("tell me" imperative) | explore-branch reroute covers only `referent-followup`; clarify emitter unguarded; would ALSO no-op at the floor (blocker B below) | unguarded sink + 1-of-6 wiring |
| LH-2 "aren't they? Who's in the next room?" | `(none)` | **non-null, kind `referent-followup`** ("they") | the guarded explore branch never ran — the **movement/room-transition handler claimed the turn upstream** and moved the player | unguarded upstream claimer |
| LH-3 "Elske, … what are you afraid I'll find?" | `[info-check → no-record]` | **non-null, `npc-addressed`, addressee Elske** | pre-roll fired correctly (no d20!); then delivery keyword-matched the *place-overview* and served it with the `:6936` hedge suffix verbatim | **wrong-fact delivery — typed intent computed, then discarded** (§5) |
| LH-4 "what do I see — and who's standing in it?" | `(none)` | **null by design** — `SENSORY_SURVEY_RE` hands sensory turns to the explore path | explore path renders a people-blind room survey; `PRESENCE_Q_RE` (`:6923`) exists but is unreachable behind the explore claim | designed handoff drops the compound's second half |

(The 10th failing turn — the Confused-newbie's single vibe fail — is not itemized in the gate report; the report
header also says DEADEND (9) over 8 bullets. Report hygiene only; flag to the harness lane, no diagnosis weight.)

**Two latent blockers this ledger exposes, beyond the exclusions:**
- **Blocker A — unguarded upstream claimers.** Routing precedence is accretion-order, not specificity-order: broad
  early claims (explore `:1652`, movement, referent-clarify) shadow precise late answerers (grace meta `~:2960`,
  the info floor `:6912`, `PRESENCE_Q_RE` `:6923`). RL-1's question is *exactly* DTD-A's `META_CAPABILITY` shape —
  the specialist that would have answered it lives downstream of the generalist that ate it.
- **Blocker B — the double-gate.** The reroute target re-derives question-ness with narrower detectors:
  `answerOrDeclineQuestion:6915` requires `isQuestionShaped` (WH-opener or trailing "?"), so LH-1's imperative
  "tell me about…" returns null even when rerouted; `:6931` re-applies the same `do/did I` exclusion
  (`ACTION_PERMISSION_Q_RE`) internally. The typed verdict is computed and then *re-litigated from raw text* at
  every layer — R2 (distributed detection) reproduced **inside** the fix for R2.

### 1.4 The verdict on Q1's three alternatives

**The cut was right; the implementation inverted its one load-bearing property; and one cluster was a
pre-existing separate-looking axis that dissolves on inspection (§3).** The gate itself proves the cut was right —
it ran a controlled experiment we didn't design:

| Packet | Mechanism class | Result this gate |
|---|---|---|
| CMB-SINK-1 | **changed the sink's default** (unrecognized combat action → improvised strike, never table-talk) | Chaos-griefer **12/12 clean** |
| DLG-1 | **changed the sink's default** (dialogue-enter now answers/declines on the first line) | zero enter-and-wait |
| NBIO-1 | **content substrate** (grounded facts where questions land) | zero born-here misses |
| AG-1-as-shipped | **entrance detector** (precision-biased classifier at upstream positions) | 9 leaks, 6 of them classifier-blind |

Every sink-default or substrate fix closed its family in one packet and *stayed* closed under a stochastic
adversarial player. The one entrance-style fix leaked — and leaked in exactly the way the first diagnosis predicted
entrance fixes leak. Nothing that was actually wired regressed: no `referent-followup` failures (the one wired
kind), no S4 bounce on the wired shapes, pre-roll suppressed the roll wherever the classifier fired. **Everything
guarded held; everything unguarded leaked.** The mechanism claim survives falsification of P5; the wiring did not.

**Honest variance note:** 5/48 → 10/48 is not a regression measurement. The Rules-Lawyer pushed a crunch-demand
line earlier runs didn't (4–5 of the 10), and the classic-DEADEND residue (4–5) is flat-to-down against the prior
run on a stochastic instrument. Composition, not count, is the signal — and the composition moved exactly off the
wired shapes onto the unwired ones. Also: the judge's CANON_HALLUCINATION label on LH-4 is technically wrong under
our taxonomy — nothing was invented; canon was *under-reported* (5 NPCs → "little of note"). G2 (fabrication)
remains dissolved; LH-4 is a G1 omission. P3 stands.

---

## 2. Q2 — is "postcondition at the sink" the right mechanism? (the mechanism ruling)

### 2.1 The sinks are an open set — enumerating them is the same losing game

The first diagnosis said "one postcondition at the **sinks**" — plural. That plural already conceded enumeration,
and this gate falsified the enumeration: it surfaced **two sink shapes not in the original six** (the
movement-claim swallow LH-2; wrong-fact delivery LH-3) plus one known-but-unlisted (people-blind room survey
LH-4's specific renderer). In an 8.6k-line reducer with early returns, *any* return site is a potential sink.
Guarding sinks one-by-one is the entrance treadmill with the polarity flipped — smaller set, same disease.

### 2.2 Why the implementation "degraded" — position forces the bias

The degradation from spec (recall-biased, at sinks) to shipped (precision-biased, at entrances) was not
carelessness; it was **forced by where the code runs**. A guard that executes *before* resolution is fail-closed:
a false positive hijacks a legitimate turn ("can I climb it?" suppressed from rolling = broken action). So every
upstream guard grows precision exclusions in self-defense — which is exactly the history: `isExploreIntent`'s
action-exclusion, H-39's verb-anchoring, and now AG-1's `ACTION_PERM_RE`/`SENSORY_SURVEY_RE`, installed in direct
contradiction of the header comment eight lines above them. The comment couldn't win; the position always wins.

A guard that executes *after* resolution, on a turn that already terminated in a known non-answer, is
**fail-open**: a false positive means "attempt a better answer; if the machinery returns null, keep the original
output." The cost of over-matching drops to ~zero *only* at that position. **Recall-bias is not a property you can
comment into a classifier; it is a property of where the check runs.** That is the structural answer to "is
postcondition-at-the-sink the right mechanism": yes in spirit, but the postcondition must live at the **one place
that is downstream of every sink** — the egress — not be hand-delivered to each sink.

### 2.3 The one-way door (AG-3, the design)

One wrapper around the reducer's return — every `(input, output)` pair passes through it once:

1. **Provenance, once.** Every return site tags its output (`via: 'placeQuery' | 'clarify' | 'gen-bank' |
   'survey' | 'meta' | …` — a field on the output object, or derived from existing mechanics tags where they
   already exist). This is the one-time enumeration — mechanical, greppable, testable — that replaces the forever
   enumeration. **Whitelist the answer-bearing provenances (a closed, curated, ~dozen-entry set); treat everything
   else, including missing tags, as suspect.** New code paths are then guarded *by default*: an untagged return on
   a question turn gets repaired, not shipped as a dead-end. Today a new path defaults to legal-sink; under the
   egress it defaults to must-prove-answerness. That inversion is what ends the treadmill.
2. **Detection, recall-biased, at last.** At the egress, "is this turn owed an answer?" can finally use the loose
   test the 06-19 verdict wanted: question-shaped OR imperative-info (including "give me"), with only *literal
   declared-action* exclusions. The strict exclusions stay where they're genuinely needed (§2.4).
3. **Typed dispatch, single source of truth.** The repair consumes the classifier's verdict — it does **not**
   re-derive from raw text (kills blocker B). `kind`-routed: presence→roster, sheet/ledger→the existing meta
   answers, place/object→placeQuery/grounded-lookup, npc-addressed→answer-in-voice or decline-in-voice,
   experiential-sense→canon-scan (§4), feasibility→the read (a feasibility answer *is* a read — "the wall's rough
   brick; climbable, with effort" — never the odds).
4. **The default flips.** Question turn + every dispatcher null → an honest voiced decline. **Never back to the
   sink.** This is the 06-19 verdict (ii), which has *still* never shipped: today `dqFloor`-null falls to the gen
   bank. The atmosphere bank remains for actions only.

Also kill the mirrors: `answerability.js:15` says `QUESTION_SHAPE` "mirrors isQuestionShaped … kept in sync by
design" — two copies already drifting is R2 inside the fix. One exported predicate, consumed everywhere.

### 2.4 What stays at the entrances

The egress does not replace everything. Two guards are *correctly* upstream and precision-tuned:
- **Pre-roll suppression** (`:3010`) — deciding "don't roll dice on this" must happen before dice; a false
  positive there breaks real actions, so its strictness is right. It stays classifier-keyed and conservative;
  the egress catches what it misses (a wrongly-rolled question still exits through the door and gets repaired
  post-roll — S1's *player-visible* harm was never the roll, it was the fog after it).
- **Dialogue/combat mode claims** — turns inside a mode route to that mode's resolver first; DLG-1 and CMB-SINK-1
  already fixed those sinks' defaults, and the gate proves they hold.

---

## 3. Q3 — the crunch-transparency ruling

### 3.1 The finding that reframes everything: the law never fired

The brief asks where hide-the-math ends and the duty-to-answer begins. The mech traces answer: **in all four
"crunch" turns, no code path ever consulted the law.** Better: the engine has *already* adjudicated this question,
years of packets ago, on the disclosure side —

- `gracefulAdjudication.js:1777` (`META_ROLL_QUERY`, H-12/13 lineage, gate-10 RL): *"The ledger shows 14 vs DC 12 —
  success. That's your last roll."* The DM **speaks raw numbers on demand**, by design, with a comment reading
  "must report the recorded roll, never re-roll or deny."
- `:1804` (`META_BARE_DC`): reports the last DC straight. `answerSkillModifier`, `META_WEAPON_DAMAGE`,
  `answerFullStats`: sheet numbers on demand.
- `public/v1.js:1583`: mechanics lines are hidden from the player **except `[roll:` lines** — the raw d20, DC, and
  outcome are *on the player's screen* for every rolled turn, in the live build Tim plays.

So "never the number" cannot mean secrecy — the number is displayed. Reading `DND_XCOM.md` §THE LAW closely, it
never claimed secrecy: it is a **register rule about volunteered tactical narration** ("−25% cover, 49% hit" → "the
cart gives you decent cover… call it even odds"), reconciling XCOM's no-hidden-info with fiction-first delivery.
Its domain is **predictive** numbers (odds, un-set DCs, enemy HP). None of this gate's demands were predictive.

### 3.2 Re-attributing the four turns

- **RL-5 ("give me the raw d20 + the damage die"):** a **compound-drop in the meta layer** — the weapon-damage
  branch answered the damage-die half and dropped the roll-report half; `META_ROLL_QUERY` (which answers exactly
  this, with numbers) never folded in. The compound-fold pattern exists for stats (`:1764`) but not for
  damage×roll. Routing bug. No policy content whatsoever.
- **RL-2/3/4 (death-sense "how many, which direction"):** these are not mechanics questions at all. "How many dead
  within range" is a **world-content quantity** — a fiction fact, like "five people stand in this room." A count
  of corpses is not arithmetic; the law does not and never did forbid it. These turns failed for routing
  (classifier-blind) and content (no result-space, §4) reasons. Calling them "crunch-transparency" concedes a
  collision that doesn't exist.

**So bucket 2 dissolves**: one meta compound-drop + three world-content turns. Answering the brief's question
directly: crunch-transparency is **a special case of G1** ("a mechanically-answerable question is a direct
question"), not a new axis — and the engine's own precedent already treats it as answerable.

### 3.3 The ruling — options and my pick (⚠ LAW-level: Tim's call, loudly flagged)

- **Option A — hard secrecy** (never voice numbers, reads only, even on demand): would require *ripping out*
  H-12/13, the DC reporter, the modifier answers, and v1's roll-line display — 20+ gates of shipped, tested,
  Tim-approved behavior. Internally incoherent (the screen shows what the voice refuses). **Reject.**
- **Option B — affirm the law, codify the tier rider** (my pick): no revision; add one paragraph to
  `DND_XCOM.md` §THE LAW naming the line the engine already walks:
  1. **Sheet** (your dice, modifiers, HP, abilities) — plain numbers on demand. *(Already shipped.)*
  2. **Resolved ledger** (your last roll, its DC, its outcome) — plain numbers on demand; the mech line already
     shows them. *(Already shipped; RL-5 is a routing gap, not a policy gap.)*
  3. **Predictive world numbers** (odds to hit, un-set DCs, enemy HP) — **the read, never the number.** *(The
     law's true domain — untouched, unweakened.)*
  4. **World-content quantities** (how many dead, how many exits, how many riders) — fiction facts from canon,
     always answerable, deterministically sourced (V11: the world supplies the count, never the LLM).
  At a real table this is exactly the norm: your sheet and your die are public to you; the DM's screen hides the
  monster's HP; and "how many goblins do I see?" gets a number because it's *fiction*, not math.
- **Option C — full XCOM transparency** (volunteer the odds): explicitly rejected 2026-06-28 in the adopt-tactical
  / reject-strategic lock. **Reject.**

Option B changes no behavior Tim has approved, requires no prompt or judge changes beyond what CT-1 fixes
(§7), and gives the gate judge a citable rubric line so future "crunch" fails can't be mis-bucketed.

---

## 4. Bucket 3 — contentless success (the ruling)

The brief asks: world-content gap rather than routing? **Both, in layers — and the cheap layer is general.**

- **4a — Rendering (code, general, cheap):** success on an information check with no matching canon currently
  renders the gen bank ("it goes your way"). But for **enumerable presence-domains, canon's absence is itself a
  fact**: the engine already answers "is there a mirror here?" with a definite *"No — no mirror here; what's here
  is…"* (`playloop.js:1683–1705`). The same rule generalizes: a *successful* death-sense over a world that has
  minted no dead things within range should say so — *"your sense sweeps the outpost and finds nothing dead within
  reach — a rare quiet."* A grounded **definite negative is an answer**; fog is not. Distinguish it from the
  epistemic gap ("who was the last traveler?" — canon never minted it → honest decline/hedge stays correct).
  Principle: **no check without a payload** — an info-check must resolve to a canon-scan whose result-space
  includes the definite negative, never to the atmosphere bank. This fixes *every* sense/info check, not just
  death-sense.
- **4b — Content (Tim's call, flagged):** 4a makes the Gravedigger's signature sense *honest but permanently
  empty* at Wayfarers' Outpost. If the class fantasy matters for the demo (the gate's own persona rolled it),
  the world needs a thin necro-substrate — graves, remains, recent deaths derivable from existing state (NBIO-1's
  substrate→resolver→both-voices pattern; deterministic counts, §0-safe: symptoms only, no cosmology). That is a
  **content-direction decision**, not a bug fix — parked as DS-1b pending Tim.

---

## 5. The fifth shape the buckets missed — wrong-fact delivery (LH-3)

LH-3 is the most instructive turn in the gate and fits none of Basecamp's three buckets. Everything upstream
worked: classifier → `npc-addressed`, addressee Elske; pre-roll → correctly no d20. Then delivery keyword-matched
"place" in the *preamble* of a motive question ("what are you afraid I'll find?") and served the **place-overview**
with the hedge suffix (`:6936` verbatim) — an answer-shaped non-answer, arguably worse than a decline because it
*simulates* resolution. Root: `answerOrDeclineQuestion(world, text, outcome)` takes no intent — the typed verdict
(kind, addressee, parts) is computed and then **discarded**, and grounding re-derives from raw text with no
relevance check. The fix is the egress's typed dispatch (§2.3.3): an `npc-addressed` motive/secret question routes
to the NPC's answer-or-decline **in voice** (motive isn't a fact slot yet → Elske's in-voice decline is the
DM-Test-passing terminal), never to a Wizard place-dump. Until the egress lands, thread `intent` through
`answerOrDeclineQuestion` as an optional parameter (AG-2R item 2, §7).

---

## 6. AG-2 verdict — right repros, falsified premise

AG-2's brief asserts the classifier is "already correct; you're widening its CONSUMERS." **The traces falsify
that, and as scoped AG-2 cannot pass its own U316:**

- **Repro 1 (Gravedigger):** `directQuestionIntent` returns **null** — `ACTION_PERM_RE` eats "what **can I**
  actually do" before the `rules` vocab check runs. Consulting the classifier ahead of `:1671` changes nothing
  when the classifier says null.
- **Repro 2 (last traveler):** the classifier says `place`, but the reroute target
  (`answerOrDeclineQuestion:6915`) re-derives with `isQuestionShaped`, which rejects the imperative form → returns
  null → the reroute silently no-ops back to the clarify. (Blocker B.)
- Repro "who's this letter from?" (carried from the AG-1-era run — note it is **not** among this gate's 10) and
  Part B (presence-in-explore) are fine as scoped.

**Reshape as AG-2R** (same lane, same bounded size, two added workstreams, one dropped assumption):
1. **Classifier bias fix:** check the WH-opener *before* the permission exclusion — `ACTION_PERM_RE` only nulls
   when the auxiliary *leads the clause* ("can I climb…?"), never when a WH-word governs it ("what can I do",
   "what did I sense", "how many do I see"). Add `give` to `IMPERATIVE_INFO_RE`. `SENSORY_SURVEY_RE` nulls only
   when the sensory phrase is the *whole* ask (a compound with a second question part stays classified). Add the
   exclusion-boundary unit corpus (§8) so the recall-bias is a test, not a comment.
2. **Thread the intent:** `answerOrDeclineQuestion(world, text, outcome, intent?)` — when `intent` is supplied,
   skip re-derivation (`isQuestionShaped` / `ACTION_PERMISSION_Q_RE`) and dispatch on `kind`; `npc-addressed`
   motive → in-voice decline (fixes LH-3's wrong-fact shape at the same time).
3. Then the consumer-widening + Part B exactly as scoped.
4. Out of AG-2R's reach (egress-class, don't chase per-site): the movement-claim swallow (LH-2). Note it as a
   known-open repro for AG-3 — do **not** add a movement-branch guard.

---

## 7. Ordered packets

| # | Packet | Scope (bounded) | Lane | Why this order |
|---|---|---|---|---|
| 1 | **AG-2R** (reshaped per §6) | classifier bias fix + intent threading + the scoped reroutes/Part B; U316 + C19 + the exclusion-boundary corpus | Sonnet (as scoped) | Closes buckets 1 + LH-3's shape; unblocks its own repros; every later packet consumes the fixed classifier |
| 2 | **CT-1** — meta compound fold | fold `META_ROLL_QUERY` into the weapon-damage/stat compound answers (pattern exists at `:1764`); ensure the roll-report path is reachable mid-/post-combat; **+ the DND_XCOM.md tier-rider paragraph once Tim rules on §3.3** | Sonnet (grace only) | Small, precedent-following; kills RL-5's whole class. LAW paragraph gated on Tim |
| 3 | **DS-1a** — definite-negative rendering | info-check success/mixed with empty canon in an enumerable presence-domain renders the grounded negative, never gen bank; extends the `:1683` object-presence precedent | Sonnet | General fix; makes death-sense honest immediately. DS-1b (necro-substrate content) parked for Tim |
| 4 | **AG-3** — the one-way door (§2.3) | provenance tags on return sites + the egress wrapper + typed dispatch + honest-decline default; the recall-biased egress detector; kill the QUESTION_SHAPE mirror | **Codex** (deep playloop surgery — worker-routing memory) | The structural close. After 1–3 so the dispatch targets it routes to are already correct; catches LH-2's class and every future unenumerated sink |
| — | REF-QC (words tail) | unchanged from first diagnosis | — | Still deferred until after the AG-3 gate — most residual "words" failures upstream of it are structural |

DLG-1 / NBIO-1 / CMB-SINK-1 need nothing: they held under adversarial pressure this gate.

---

## 8. Falsifiable predictions — antecedents as checklists this time

Process rule first (the P5 lesson): **a prediction's antecedent must be a checkable list, not a packet name.**
Each prediction below names the mechanism property that must be verified shipped (one `node --test` case each)
before the prediction binds. All consequents are mech-line/string checkable; no judge trust required.

- **P6 (AG-2R).** *Antecedent check:* the classifier returns non-null for all of: "what can I do with my class?",
  "what did I sense?", "how many … do I see?", "give me …" (the exclusion-boundary corpus green).
  *Prediction:* next gate has **zero** `[clarify:referent]` mechs on turns containing rules vocabulary
  (class/ability/spell/level), and zero hedge/clarify terminals on imperative-info ("tell/give me…") turns.
  Bucket-1 DEADEND ≤1/48, and LH-3's wrong-fact shape does not recur on npc-addressed turns.
- **P7 (CT-1).** *Antecedent:* U-test that a compound "roll + damage-die" demand answers both halves.
  *Prediction:* zero failing turns whose input demands sheet/ledger numbers; any "what did I roll"-family turn's
  output contains the stored `lastRoll` digits verbatim.
- **P8 (DS-1a).** *Antecedent:* U-test that an info-check success with empty presence-domain canon renders the
  definite negative. *Prediction:* **zero gen-bank template strings** ("goes your way" / "after a fashion" /
  "see it through") on any turn whose input is question-shaped or imperative-info, across all 48.
- **P9 (negative controls — the mechanism claim itself).** Combat stays closed (Chaos ≤1/12, no
  `[combat:table-talk]` on declared physical actions), dialogue stays closed (no enter-and-wait), NBIO stays
  closed (no born-here miss). If any of these reopen, §1.4's sink-default conclusion is wrong and I want to know.
- **P10 (AG-3 — P5 re-issued, properly bound).** *Antecedent checklist:* (i) egress wrapper live on the reducer's
  return; (ii) answer-provenance whitelist enforced with untagged-defaults-to-repair; (iii) question-turn +
  all-dispatchers-null → voiced decline (gen bank unreachable for question turns); (iv) exclusion-boundary corpus
  green. *Prediction:* **DM_TEST_DEADEND ≤1/48 across all personas**, and any residual DEADEND turn carries an
  answer-bearing provenance tag — i.e. the class has moved from structural to narration-quality, where THE_REF
  owns it.
- **P11 (control — if nothing ships).** DEADEND recurs at 4–10/48 with ≥2 first-person-experiential shapes
  ("what do I see/sense/know/carry/remember") — the classifier-blind signature — and ≥1 turn swallowed by a
  non-explore upstream claimer (movement/travel/take). Falsifiable both ways: if it does NOT recur without the
  fix, my mechanism story is wrong too.

---

## 9. Postscript — live confirmation from the AG-2 lane (mid-flight, uncommitted)

While this diagnosis was being written, the AG-2 worker was mid-flight in the same tree (uncommitted diff over
`answerability.js` / `playloop.js` / `gracefulAdjudication.js`; observed, not touched — this doc's traces all
describe HEAD, the code that ran the gate). Two of its in-progress changes independently confirm findings above:

1. **§6 blocker A, confirmed in the wild.** The worker's first act was *editing the classifier* — a narrow
   `class|background|archetype` carve-out hoisted above `ACTION_PERM_RE` — because the Gravedigger repro returned
   null exactly as traced in §1.3. Note the shape: a vocabulary exception, third generation of the enumeration
   disease (entrance allowlists → classifier exclusions → exclusion exceptions). It fixes the repro, not the
   family — "what did I sense?", "what do I detect?", "how many do I see?" remain invisible under it. AG-2R item 1
   (the ordering fix: a WH-governed clause beats the aux exclusion) is still needed.
2. **§2.2 position-forces-bias, confirmed empirically.** The worker's own comment at the explore-branch reroute
   records that widening the early reroute to the broad `place` kind **broke convergence (C9/C12)** — it swallowed
   grounded answers owned by later, more specific handlers ("where's the tavern?", "who runs this place?") — and
   was deliberately reverted to not-widened. That is the entrance treadmill demonstrating itself in a single diff:
   the broad kinds *cannot* be handled at an entrance without precision carve-outs, which is exactly why the
   catch-all belongs at the egress (§2.3), downstream of every specialist.

Also observed landing as scoped: the letter-from fix (direct-address over-match yields to an object
referent-followup) and Part B (`presence:true` + the `in it` widening). The pallet/imperative path was untouched
at the time of writing — blocker B (§6, the `isQuestionShaped` double-gate inside `answerOrDeclineQuestion`) is
still ahead of that lane.

---

## 10. One process lesson

The first diagnosis's only failed prediction failed at the **spec→implementation seam**, not at the analysis
layer: the load-bearing property (recall-bias) lived in a design comment and a brief, and nothing in the
done-when could detect its inversion. The durable fix is cheap and general: **when a packet's whole value hangs
on one mechanism property, the done-when must include a test of that property's boundary** (here: a must-classify
corpus over the exclusion edge — "what can I do" vs "can I climb"), not only end-to-end repros. End-to-end repros
verify the shapes you already saw; the boundary test verifies the *bias*, which is what generalizes. This is the
pass^k / property-test gap the SOTA review already flagged, showing up in the wild.
