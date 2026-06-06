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
## Investigation notes
## Built this pass
## Node checks
## Live (screenshots)
## Findings
## NOT verified / deferred
## Verdict: not yet
