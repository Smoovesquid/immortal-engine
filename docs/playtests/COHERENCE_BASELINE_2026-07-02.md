# Coherence baseline — 2026-07-02

**The first honest incoherence number.** `docs/playtests/COHERENCE_SEAMS_2026-07-02.md` documented six
cross-turn contradiction seams (C1–C6) found by hand-combing two full gate transcripts — the Opus
experiential gate scored those same runs **3/48** and **9/48**, because VIBE / CRUNCH / RAG-groundedness
never checks whether the world holds together turn to turn. This doc runs the new deterministic analyzer
(`scripts/coherence-audit.mjs`, seams C1–C5 — C6 is dialogue-voice, taste-critical, queued separately) over
both JSONLs and records what it finds. Pure text analysis: no LLM calls, no RNG, $0, fully reproducible —
`node scripts/coherence-audit.mjs docs/playtests/gate-runs/<file>.jsonl` reruns this exactly.

## The headline

| Run | Turns | **Judge fails (VIBE/CRUNCH/RAG, v1 leg)** | **Coherence breaks (this analyzer)** |
|---|---|---|---|
| `gate-2026-07-02T20-59-10-628Z-v1.jsonl` (regime v1) | 48 | **3** | **6** |
| `gate-2026-07-02T19-44-24-605Z-bridge.jsonl` (regime bridge) | 48 | **9** | **4** |
| **Total** | 96 | **12** | **10** |

The coherence analyzer is **not re-deriving the judge's own fails** — of the 10 total breaks found, **9 land
on turns the judge scored as passing** (1 overlaps a turn the judge also flagged, for an unrelated
VIBE/CRUNCH reason). This instrument adds a near-disjoint category of signal: the world can narrate a
grammatical, in-voice, mechanically-consistent turn that the judge waves through, while still contradicting
what turn N-3 established. That's exactly the gap the seam catalog named — "the judge passed almost all of
it" — now with turn citations instead of hand-combing.

**What this means for the Phase-0 exit bar (≤2 broken/48):** counting each *unique broken turn* once
(judge-fail OR coherence-break, de-duplicated where they overlap), the v1 gate's honest floor is
**3 + 6 − 1 = 8/48** broken turns, not 3. The bridge run's honest floor is **9 + 4 − 0 = 13/48** (zero
overlap between its judge fails and its coherence breaks — two fully disjoint failure categories). Both are
well past the ≤2/48 target — Phase 0 was not actually at its exit bar; the instrument that would have shown
that didn't exist until now.

## By seam, by run

| Seam | Detector | v1.jsonl | bridge.jsonl |
|---|---|---|---|
| C1 | NPC materialization | 2 | 2 |
| C2 | material flip | 1 | 0 |
| C3 | object relocation | 0 | 1 |
| C4 | location teleport | 2 | 1 |
| C5 | settlement scale contradiction | 1 | 0 |
| **Total** | | **6** | **4** |

Every citation below traces to a seam already named in `COHERENCE_SEAMS_2026-07-02.md` — this run confirms
the hand-audit was accurate and makes it repeatable.

## v1.jsonl — flagged contradictions (6)

### C1 — NPC materialization (2)
- **[chaos t10]** — "Elske Nightherd" speaks/acts with no prior introduction or presence in this session.
  _"Elske Nightherd shrugs. 'Can't say. No record I've ever seen.'"_ — the player's own line the turn before
  is `"Who's Elske Nightherd, and why is she suddenly standing in my burning cottage?"`; the seam catalog's
  chaos T9–10 citation.
- **[lore-hound t1]** — "Elske Nightherd" speaks/acts with no prior introduction; this is this persona's
  session-opening line — the transcript starts mid-conversation with an NPC already present, nothing
  establishes who's in the scene first. _"Elske Nightherd sighs. 'I told you — I don't know...'"_ Notably,
  this EXACT opening line repeats byte-for-byte in the bridge run's lore-hound session too (see below) — a
  systematic in-media-res opening, not a one-off.

### C2 — material flip (1)
- **[chaos t7]** — "wall" was "wooden" at t2, now "stone" at t7. _"stone wall"_ — the player asserts "wooden
  wall" at t2/t5 (their own callback belief), the DM's narration only ever confirms "stone wall" from t7
  onward and explicitly says "it was always stone" at that turn — the DM lampshades the contradiction rather
  than resolving it consistently either way.

### C4 — location teleport (2)
- **[chaos t9]** — "back room" appears with no travel mechanics that turn (mechanics tag: a roll, not a
  move). _"...the stone basin's rim here in the back room of the cottage..."_ The player's next line is
  literally `"When did I walk into a back room?"` — the clearest self-flagged instance in the corpus.
- **[newbie t2]** — "back room" appears in the chest-opening turn with no travel mechanics (container-open,
  not movement). Different session/seed-canon than chaos — here it's used consistently from the start, so
  not necessarily wrong within newbie's own session, but it's the same DM-narration pattern (a room
  qualifier introduced with zero navigational grounding).

### C5 — settlement scale contradiction (1)
- **[rules-lawyer t9]** — settlement was "a single building" at t3, now "multiple buildings" at t9.
  _"...you can usually find her somewhere among its handful of buildings..."_ The player calls this out
  directly one turn later ("Where exactly is Elske right now — you said a single building a moment ago, now
  a handful of buildings?"), and the DM (via the NPC) apologizes for the confusion rather than resolving it
  — the seam catalog's RL T3→T9 citation.

## bridge.jsonl — flagged contradictions (4)

### C1 — NPC materialization (2)
- **[lore-hound t1]** — same pattern as v1.jsonl above; the session-opening line is byte-identical:
  _"Elske Nightherd sighs. 'I told you — I don't know. Won't change by asking twice.'"_
- **[rules-lawyer t9]** — "Elske Nightherd" answers a question with no prior introduction in this session
  (turns 0–7 are entirely character-sheet/rules questions, no NPC ever named). _"Elske Nightherd shrugs.
  'Can't say. No record I've ever seen.'"_ The player's own line at t9: `"Who's Elske Nightherd, and where
  did she come from? I was alone cutting my palm..."` — the seam catalog's bridge RL T9–10 citation exactly.

### C3 — object relocation (1)
- **[chaos t11]** — "letter" was declared absent at t9 ("There is no letter here at Wayfarers' Outpost..."),
  reappears at t11 inside the chest ("...the chest's contents spill onto the floorboards — a single folded
  letter..."). The player kills the NPC and loots a letter from her coat at t6, the DM then denies any letter
  exists at t8/t9, and the SAME letter reappears from the chest at t10/t11 — the seam catalog's C3 citation
  (WB-Q5, node-global furniture).

### C4 — location teleport (1)
- **[newbie t2]** — "back room" appears with no travel mechanics that turn (container-open, not movement) —
  same pattern as v1.jsonl's newbie session.

## Detector method (full doc: `scripts/coherence-audit.mjs` header + inline comments)

Each detector is a small deterministic state tracker walking one persona's turns **in order**:

- **C1 materialization** — tracks which proper names have been validly *introduced* (arrival/presence
  phrasing) in this session; flags a name that *speaks or acts* (dialogue/action verbs) before any turn
  established their presence. A DM introducing a brand-new NPC in *answer* to "who is X?" is explicitly NOT
  flagged — that's normal DM behavior, not a bug.
- **C2 material flip** — tracks (surface noun → material word) pairs across both `player` and `dm` text (the
  player's stated beliefs are part of the fiction record the DM is answerable to); flags a later turn
  asserting a different material for the same noun.
- **C3 object relocation** — flags a tracked object (letter/chest/coins/key/ledger/journal) explicitly
  declared *absent* ("no letter here") followed by a later reappearance. Two different container mentions
  alone are NOT flagged — only a stated absence contradicted by a later presence, to keep this precise.
- **C4 location teleport** — flags a NEW room-qualifying phrase ("back room", "inner room", ...) with no
  travel/movement mechanics in that turn.
- **C5 scale contradiction** — flags a settlement described as a single building, then later as multiple
  buildings (or the reverse), tolerant of variable determiners ("a single building" / "its single building").

## Known false-positive / false-negative risks (read before trusting a future run blind)

**Precision was chosen over recall deliberately** (per the task spec) — this is a first cut, not a complete
oracle. During construction, two real false positives were found and fixed against this exact corpus (both
now covered by regression tests, U336):

- **Sentence-initial capitalized bigrams mis-read as names** — "At Wayfarers' Outpost..." was originally
  mis-parsed as a two-token person name ("At Wayfarers"). Fixed with a leading-stopword filter (prepositions/
  articles/discourse words can never be a real name's first token) — but a NEW capitalized bigram pattern
  this filter doesn't anticipate could still slip through on a different transcript. **Residual risk: some
  false positives from unusual capitalized phrase openings are still possible.**
- **Determiner-rigid phrase matching** — "its handful of buildings" was originally missed because the C5
  regex required a literal "a handful of buildings". Fixed by anchoring on the noun phrase, not a fixed
  article — but the same class of miss (an unanticipated phrasing of the same underlying claim) is possible
  for C1–C4 too, since all five detectors are regex/keyword-based, not semantic. **A material flip, object
  relocation, or teleport phrased in a way not in these word lists will be silently missed (false negative),
  not falsely flagged** — consistent with the precision-over-recall design goal, but worth knowing the floor
  numbers above are a LOWER BOUND on real incoherence, not a ceiling.
- **C1 only tracks two-token "Firstname Lastname" names** — a single-token NPC name (just "Elske", no
  surname) or a title-only referent ("the innkeeper", "the guard") would not be tracked by the current
  extractor. The corpus this baseline was built from happens to use two-token names throughout
  ("Elske Nightherd", "the Lingerer" is title-only and correctly never triggers since it never *speaks*
  with an action verb in either file) — a future corpus with single-token names would need the extractor
  widened.
- **C4's room-qualifier list is a fixed short phrase set** ("back room", "inner room", "another room", ...).
  A genuinely new but differently-worded room shift (e.g. "the cellar below" with no earlier cellar mention)
  would not be caught by this detector at all — that's a real coverage gap, not a tuning bug; C4 is scoped
  narrowly on purpose to avoid false-flagging every atmospheric room description as a teleport.
- **Static per-run analysis, not live** — this reads a finished JSONL after the fact; it cannot yet gate a
  run in progress or block a shipped regression the way `npm run check` does. That's out of scope for this
  packet (Phase 0 instrument only).

## Reproduce this

```
node scripts/coherence-audit.mjs docs/playtests/gate-runs/gate-2026-07-02T20-59-10-628Z-v1.jsonl
node scripts/coherence-audit.mjs docs/playtests/gate-runs/gate-2026-07-02T19-44-24-605Z-bridge.jsonl
```

Or opt in on a future gate run directly: `node scripts/dm-playtest.mjs --coherence ...` (additive flag,
default gate behavior unchanged — prints one extra `COHERENCE: N break(s)...` summary line after the run).

Tests: `tests/U336.coherenceDetectors.test.js` (detector unit tests, synthetic fixtures, both positive and
negative/false-positive-guard cases) · `tests/U337.coherenceBaselineRegression.test.js` (locks in the exact
counts on this page against the two real JSONLs — a silent detector regression fails this test) ·
`tests/U338.coherenceAuditCli.test.js` (CLI end-to-end + the `--coherence` flag is additive-only).
