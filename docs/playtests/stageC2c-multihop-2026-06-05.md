# Playtest — Stage C.2c: multi-hop named travel — 2026-06-05

Surface: live v1.html · Persona: The Skeptic · Governing: THE_DM_TEST
Fixes the slice-2b bug: survey advertised "to the south lies Trader's Camp (2)" but
"go to Trader's Camp" deflected (resolveNamedNeighbor was direct-neighbor-only).

Charter: naming a place you KNOW OF (a discovered node, even 2+ hops away) runs a
real multi-leg journey there — each leg crosses terrain (its own ambush/beat chance),
arrive-or-interrupted, time+distance accrue across all legs. Never "it's that way."

## Pre-registered attack list (committed BEFORE the build)
- [ ] `go to <a known place 2 hops away>` (the survey's "(N)" exits) actually arrives
- [ ] after arrival, `where am I?` shows that place (real multi-hop state change)
- [ ] a multi-hop trip costs MORE time/distance than a single hop
- [ ] an intermediate leg can be ambushed → you stop AT a real node (not the void),
      in combat; re-issuing travel resumes toward the destination
- [ ] direct-neighbor travel still works (no regression: U96)
- [ ] unknown/unreachable place → in-fiction clarification (no "which way?", no deflect)
- [ ] apostrophe place names match ("Trader's Camp")
- [ ] determinism: same seed + input → identical journey (one travel event, replay-safe)
- [ ] node sweep: multi-hop reaches target across many seeds; interrupts leave you at a node

## Grading
DM-test? · arrives at the named place? · time/distance scale with hops? · interrupt leaves you at a real node? · deterministic? · visible? · no regression to single-hop.

---
## Built this pass
- `bfsPath(map, from, to, cap)` (mapState) — deterministic shortest path over the node graph.
- `resolveNamedDestination` (playloop) — matches text against DISCOVERED nodes
  (apostrophe-normalized), so "Trader's Camp" resolves even when 2+ hops away.
- Multi-hop journey branch: BFS route → travel leg by leg (each leg = a real node
  hop with its own terrain ambush chance + contested surprise) → arrive OR interrupt
  AT A REAL NODE (resume by travelling again). Time + distance accrue across legs.
  One travel event per call (replay-safe). Direct neighbors still use the single-hop
  path (no regression).

## Node checks (sweeps)
- 40 seeds: **12 reached / 25 interrupted-at-a-node / 0 stranded (void)**. Deterministic.
- Example: "go to Roadside" (3 hops: Old Shrine → Hollow Chapel → Roadside) → ambushed
  at Old Shrine, stopped there in combat, +5h/+5lg. Resumable.
- Tests U99 (4): reach-or-interrupt-never-void, multi-hop costs distance, determinism,
  bfsPath basics. Full suite 7143/7143, U21 green, U96/97/98 green, harness 0/0.

## Live (v1.html, AI on)
- Named-travel flow + per-leg ambush + contested surprise all rendered live this run:
  e.g. "go to Old Shrine" → "...the Riverbone Dauber to lunge from concealment, catching
  you for 3 before you can raise your guard [ambush | surprise]". (Same UI flow the
  multi-hop branch uses.)
- HONEST GAP: I did NOT capture a live screenshot of a clean *multi-hop* (2+ leg)
  arrival at a far node. The live runs were repeatedly consumed by travel ambushes
  (the working danger system) and a character death at 1 HP. Multi-hop is verified at
  the node/test level and reached via the live-verified named-travel flow, but the
  specific clean far-arrival was not seen on screen this session.

## Findings
| case | result | verified |
| --- | --- | --- |
| go to known 2+ hop place | per-leg journey, reaches or interrupts | node sweep + U99 |
| interrupt mid-journey | stops at a REAL node (never void), resumable | node sweep (0 stranded) |
| time/distance scale w/ hops | + hours/leagues per leg | U99-B |
| determinism | identical outcome on replay | U99-C, U21 |
| named-travel + ambush + surprise | renders correctly | LIVE (this run) |
| clean multi-hop far-arrival | works at node level | NOT screenshotted live (RNG) |

## NOT verified / deferred
- Live screenshot of a clean multi-hop far-arrival (see honest gap above) — quick to
  nail with a sturdier character / by clearing the first ambush.
- Interactive beats (toll/parley you pay/talk/slip past); per-leg interrupt-and-resume
  is in, but a FULL pending-choice encounter is still slice 2d.
- Directional inter-node travel ("go south" leaving a settlement; v1.js placeWalk).

## Verdict: node/test GREEN + determinism; the survey-vs-reach bug is FIXED. Live: the
named-travel/ambush/surprise flow is verified; a clean multi-hop far-arrival is
node-proven but not screenshotted this session (honest gap).
