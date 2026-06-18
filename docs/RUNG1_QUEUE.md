# Rung 1 — Live Queue (Basecamp hand-off state)

**To resume as Basecamp, read this + `AGENT_PROTOCOL.md` + `AGENT_CHANGELOG.md`.**

## Mission
Rung 1 of the realization ladder — *"I can do anything here, and it fits the math."* The DM resolves
any plain-English intent in the fiction while the deterministic 5e-lite mechanics stay correct.
**Done-when bar:** zero HARD failures *from real engine/narration defects* across the multi-seed Opus
gate, Rules-Lawyer persona clean, only rare forgivable SOFT slips. HARD-count bounces run-to-run
(gate agents explore freely) — judge by **bug nature** (real-defect vs phrasing-tail), not one run's
number.

## Your role
Single **queue owner + Rung-1 arbiter** (Tim's mandate). Write paste-ready worker prompts, assign each
worker's model, sequence packets **one in flight at a time** (unless provably file-disjoint, protocol
§2), ingest results Tim pastes back, and declare Rung 1 done only at the bar above. Tim relays prompts
to workers and results back — he does **not** modify prompts, so each must be complete + paste-ready.
Handle doc/process micro-decisions yourself; surface only forks that need Tim's call.
- **Codex** = deep-engine worker backend (combat routing, dice/state mechanics).
- **Claude-Sonnet** = routing/grace worker (intent gates, meta/grace layer).
- **Your model:** start Sonnet (sequencing is mechanical); escalate to Opus only for the Road-A-vs-B
  judgment (not imminent).

## Repo state
Branch `v2-polish`. Confirm HEAD with `git log --oneline -5`; suite GREEN **7854/0** (`node --test`).
Known untracked file — **leave alone:** `docs/playtests/opus-gate-2026-06-17.md`.
Working data: `docs/playtests/opus-gate-2026-06-18-roadA-verdict.md` (23 HARD cataloged H-1..H-23).

## Done (18/23 HARD — combat cluster + object assault + routing/stat + roll-state)
Codex engine layer (`98b5059`..`056e249`): H-1 scene-object misroute, H-2 grapple state, H-3/4/5
natural-strike routing, H-6 neck-snap **classification only** (mechanic deferred by design).
Claude layer (`8c359ad`..`da615f3`): H-2/3/4/5/6 narration-inversion guard, H-20 shove-past, H-21
torch. Suite 7854/0.
Claude Sonnet worker (`dcbd79c`): H-7/H-8 object-mediated assault + phantom victory. Suite 7858/0.
Claude Sonnet worker (`b0d7105`): H-14/15/16 dead-end/UI-bleed; H-17/18 stat-synonym+HP. Suite 7884/0.
Claude Sonnet worker (`7c11f3e`, `37d1778`): H-19 check denial; H-12/13 roll contradiction. Suite 7909/0.

## In flight
*(none)*

## Next — Hard tail (Road-A arbiter verdict: CONTINUE)
All 5 remaining HARDs are real deterministic defects, not phrasing long-tail → Road B stays parked.

1. **Claude-Sonnet — H-22/23:** roll-to-fiction gap — DM has a successful info-roll but withholds the
   specific answer (name, detail) in favour of atmosphere. Narration contract: success → deliver the
   information. Related to the lastRoll infrastructure just built.
2. **Claude-Sonnet — H-9/10/11:** continuity-deflection + mixed-roll wrong narration type + RAG
   wrong-scene. H-11 (RAG) is the riskiest; assess layer before editing.

## Open strategic question (the arbiter call, gated on the hard tail)
**Road A** (deterministic patches) vs **Road B** (Tier-B LLM intent arbiter w/ Canon-Log caching for
determinism). **Verdict so far:** ~18/23 of the gate's HARD were *real deterministic* engine/narration
defects, NOT phrasing-slip → **Road B is PARKED.** Decide A-vs-B only on what survives the
deterministic remainder (the hard tail): mostly real defects → keep grinding Road A; mostly phrasing
long-tail → commit to Road B.

## Budget
~$15 of Tim's $20 API key spent. Reserve the last ~$4.80 for **ONE** final decisive gate when the
deterministic floor looks solid. Owner-initiated only (never a worker):
`node -r dotenv/config scripts/dm-playtest.mjs --personas rules-lawyer,chaos,lore-hound,newbie --seeds stonewatch-hollow,glass-harbor --turns 12`
Score every failing turn HARD vs SOFT; a graceful in-character decline of absurd input = PASS.

## Parked (home-base, NOT Rung 1)
IG-10 absurd-input decline gate; gratuitous-violence consequence ladder; surfacing packets P-82..P-88.
