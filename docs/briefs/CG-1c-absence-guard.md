# CG-1c — the presence comparator learns the difference between "X is here" and "X is elsewhere"

**Model:** Claude Sonnet (coherence lane — `engine/coherence/`, no hot files). **Your tests: U424–U425.**
**Parents:** CG-P1..CG-LIVE-1 (PACKETS §CG) · the 2026-07-04-2 gate's shadow data (PACKETS §GATE
2026-07-04-2, last bullet).

## The live false positive (this packet's reason, verbatim from the shadow log)

The shadow observer's ONLY fire in 36 live turns (fire rate 2.8%) was WRONG:

> [tallow::campaign t18] [FAIL] canon `roomOccupants` expected **[] (empty)**, narrated
> **"Elske Nightherd" speaks/acts in-room**
> _"No one answers — Elske Nightherd is elsewhere in Wayfarers' Outpost, and the bedchamber holds
> only the quiet creak of timber walls and the open chest sitting em…"_

The prose is a CORRECT ABSENCE statement — the CG-1b comparator counted the bare name-mention as
in-room speech/action. This guard is REQUIRED before CG-LIVE-2 may ever flip the observer from
logging to regenerating (a regenerator that "fixes" correct prose is the Ref-ghost class reborn).

## The fix

In `engine/coherence/checks.js`, the CG-1b presence comparator gains an absence/negation guard:
a name-mention does NOT count as in-room presence when the mentioning clause asserts absence,
distance, or negation — the classes to cover (derive the exact patterns from real prose, not
imagination): "X is elsewhere / not here / away / gone", "no one answers/is here — X …", "X is out
in/at <other place>", "you can see X through the window" (window line-of-sight = explicitly
out-of-room), "X has left / stepped out". Keep the guard CONSERVATIVE and clause-scoped: "Elske
snorts — the rumor that she is elsewhere amuses her" must still FIRE (she acted in-room). Same core
serves the retroactive checker and the live shadow observer (they already share `checks.js`).

## Precision proof (both directions — this is the whole point)

1. **The FP dies:** re-run the shadow review over `docs/playtests/coherence-shadow/2026-07-04.jsonl`
   → 0 pointers, `observer_ran=true`.
2. **No true positive is lost:** re-run the retroactive checker over the HISTORICAL baselines the CG
   arc graded (the CG-P2 baseline jsonls under `docs/playtests/gate-runs/` — the runs the packet rows
   name) → every previously-caught CG-1b catch still fires. If any drops, it's either a genuine FP of
   the same class (justify line-by-line in the report) or your guard is too greedy (fix it).

## Boundaries

`engine/coherence/checks.js` (+ its tests) only; the comparator stays pure/deterministic; no LLM, no
network; observer stays default-OFF and never alters narration (that contract is untouched). No hot
files. A renderer lane and an engine journey lane run in parallel — zero overlap with both.

## Tests (U424–U425)

- **U424:** the guard — a table of absence-phrasings (the classes above, incl. the live FP line
  verbatim) does NOT fire CG-1b against empty-room canon; in-room speech/action phrasings (incl. the
  tricky "rumor that she is elsewhere" case) DO fire.
- **U425:** shared-core — the live observer path and the CLI checker produce identical verdicts over
  the same record (byte-equal pointers) with the guard active.

## Done-when

Both re-runs prove the two directions; U424–U425 green; full suite green. One local commit (no push,
no version bump — engine/coherence is inert-by-default instrumentation).

## Rollback

Revert the commit (the FP returns; CG-LIVE-2 stays blocked).

## Report (plain English for Tim)

What was wrong (the referee's assistant flagged the DM for saying "Elske ISN'T here" — it saw her
name and assumed she was talking in the room), what changed (it now reads the sentence, not just the
name: saying someone is absent is the OPPOSITE of a violation), why it matters (this assistant is one
step from being allowed to auto-reject bad narration — it must never punish correct prose).
