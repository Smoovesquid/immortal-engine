# Deterministic Debug Operating Protocol

## 1. Purpose
Standardize debugging in Immortal Engine using deterministic, minimal-diff cycles with proof after every change.

## 2. Repo-Specific Framing
- This repo is a deterministic engine with a UI/projection layer.
- Surface symptoms must not be assumed to originate in the surface layer.
- Debug truth order: canonical-state truth first, projection truth second, visual symptom third.
- For map/gameplay incidents, explicitly separate engine mutation bugs from projection/render bugs.

## 3. Core Rules
- One failing signal per cycle.
- One probe **OR** one patch per cycle.
- Verification reruns after a patch do not count as a second probe.
- Every incident must declare a primary truth artifact before patching.
- No edits before reproducing the failing signal or verifying the missing artifact.
- No broad refactors during debugging.
- Never treat UI movement symptoms as proof of engine failure without checking canonical position/state.
- Never treat engine mutation as fixed until the original playtest symptom is rerun.

## 4. Bug-Layer Classification
Classify each incident into one primary layer before patching:
- Canonical state mutation
- Move/action resolution
- Spatial/world scale translation
- Scene/position coherence
- Projection/render only
- Persistence/save-load
- AI/text description mismatch
- Test harness gap

## 5. Per-Cycle Procedure
1. Record incident input (preserve exact user symptom wording).
2. Convert symptom into a single reproducible failing signal.
3. Classify likely bug layer.
4. Run one deterministic probe **or** apply one smallest patch.
5. Re-run original failing command or exact manual repro flow.
6. Run nearest targeted test(s).
7. Report compact proof and next smallest action.

### Playtest Incident Capture
Playtest bugs must always preserve the action sequence so the failing signal can be reproduced deterministically.
- exact player action sequence
- engine state markers before action
- engine state markers after action
- observed user-visible symptom
- expected behavior if known

## 6. Snapshot Requirements
Before any patch, record:
- failing command/test **or** exact manual repro steps
- observed failure
- touched subsystem
- likely bug layer
- primary truth artifact used to judge reality for this incident
- available deterministic state markers relevant to the bug

Preferred deterministic markers (as available):
- world/state hash
- actor position
- current scene/node
- map coordinates
- event/log deltas tied to incident
- when visual symptom and canonical state disagree, canonical state wins unless incident is explicitly classified as projection/render only

## 7. Patch Rules
- Apply the smallest patch that changes the failing signal.
- Keep edits local to the diagnosed layer.
- If required file/API/behavior is unverified, stop and request the smallest missing artifact.

## 8. Verification Standard
After each patch:
1. Re-run the original failing command or exact repro flow.
2. Re-run nearest targeted tests.
3. Confirm whether the original user-visible symptom changed, not only internal state.
4. For map bugs, explicitly verify whether error is:
   - state wrong
   - projection wrong
   - scale translation wrong
   - stale render/update timing
5. For gameplay bugs, explicitly verify whether error is:
   - action resolution wrong
   - state transition missing
   - text/description drift from state
   - persistence/reload mismatch

## 9. Stop Conditions
- If failing signal is unchanged after two patch cycles: stop and report likely wrong-layer diagnosis.
- If no deterministic truth artifact can be identified: stop and request the smallest artifact needed to establish one.
- If required artifact is missing/unverified: stop and request smallest missing artifact.

## 10. Completion Report Format
Use compact output with:
- issue (include exact user symptom wording)
- bug layer
- repro command/steps
- files changed
- proof (repro rerun + targeted test output)
- result (fixed / not fixed / blocked)
