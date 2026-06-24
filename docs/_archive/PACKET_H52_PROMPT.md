# H-52 packet — Lore-hound elder-identity/tenure-invention cluster

Paste everything below this line to the Codex worker.

---

## Context

Opus experiential gate `docs/playtests/opus-gate-2026-06-20.md` (post-H-50/H-51 run, committed
at `974dee0`) surfaced two new CANON_HALLUCINATION failures from the Lore-hound persona, both at the
same node (glass-harbor settlement) in the same session:

1. Player: *"Who runs this place, and how long have they been here?"*
   DM: "...an elder who has guided the settlement for **well over two decades**..." — no canon support
   for that tenure figure, and the elder is left unnamed when canon has a name on record.
2. Player: *"Who's the elder, and what's their name?"*
   DM: "**Corwin Boneknit**, a representative..." — wrong NPC. Corwin is real (a grounded
   representative-role NPC) but the actual canon elder is a different NPC (Kael in this seed). The DM
   attached the "elder" role to the wrong already-grounded name.

These are two distinct but related defects in `engine/llmAdapter.js`'s narration-validation guard
chain (`validateNarrationCandidate` / `findInventedFactClaim`), same family as H-49 (lineage/tenure +
relationship-claim guards) but two new trigger shapes: (a) a tenure claim using **decades** as the
unit (current guard only catches years/winters/seasons), and (b) a **role-misattribution** claim —
correctly-grounded name, wrong role pinned to it.

## Read first

- `engine/llmAdapter.js` lines 234-287 (`collectGroundedNouns` / `findInventedProperNoun` — confirms
  `ctx.settlement.npcs` is already passed through with `{name, role}` pairs; this is your data source
  for fix (b), no new plumbing needed).
- `engine/llmAdapter.js` lines 700-810ish (`findInventedFactClaim`, `LINEAGE_PHRASE_RE`,
  `NEGATION_HYPOTHETICAL_RE`, the H-49 relationship-claim regex) — this is the function you're
  extending for fix (a), and the pattern to follow for fix (b)'s new helper.
- `engine/llmAdapter.js` line ~355 (`if (findInventedProperNoun(cand, grounded)) return false;`) —
  this is where guard calls are wired into `validateNarrationCandidate`; your new role-misattribution
  guard call goes near here, same style.
- `engine/ai/narratorContext.js` lines 404-414 — confirms `npc.role` values are lowercase strings like
  `'elder'` (matches `engine/npc/npcGenesis.js` line 33's role list).
- `tests/U213.purseClaimGuard.test.js` and the H-49 test file (find via `git log --grep H-49 --
  tests/`) — both are good structural templates for a new guard test file (mock `world`/`ctx`/`candidate`/
  `baseNarration`, assert `validateNarrationCandidate` returns false on the bad case and true on
  unrelated/benign narration).

## Two fixes, one packet

### Fix (a) — decades as a tenure unit

In `findInventedFactClaim`, the `durRe` regex (~line 758) currently matches
`\b(?:one|two|...|twelve|\d{1,3})\s+(?:years?|winters?|seasons?)\b`. Add `decades?` to the unit
alternation. Verify it still respects the existing `NEGATION_HYPOTHETICAL_RE` exemption (a denial like
"no record spanning decades" must still pass) and the existing "present in base narration" exemption
(if the grounded base narration legitimately states a decades figure, don't reject it).

Add a test case: a candidate asserting "...has guided the settlement for well over two decades..." with
a `baseNarration` that contains no decades figure → rejected. A candidate where the base narration
*does* state "two decades" → not rejected (passes through unchanged).

### Fix (b) — role-misattribution guard (new)

New helper, e.g. `findMisattributedRoleClaim(candidate, ctx)`, called from `validateNarrationCandidate`
near the existing `findInventedProperNoun` call (~line 355), guarded the same way (`ctx?.settlement?.npcs`
must be a non-empty array or skip — never throws, mirrors the `try { } catch { return null; }` shape
used by every other guard in this file).

Logic: for each distinct `role` value present in `ctx.settlement.npcs` (e.g. `'elder'`), check whether
the candidate text asserts a *specific named NPC* holds that role, using a name/role co-occurrence
pattern (e.g. `<Name>... (?:is|as) (?:the|an?) elder` / `the elder,? <Name>` / `<Name>,? a representative`
— look at the two failing examples above for the actual phrasing shapes; keep the regex conservative,
matching the H-49 relationship-claim guard's restraint — only reject a *confident, explicit* role
assertion, never a vague or hedged one). If the asserted name does not case-insensitively match the
*actual* NPC in `ctx.settlement.npcs` holding that role, reject (return the offending substring/claim,
same return contract as the other `find*` helpers — `null` means "no violation found").

Important nuance from the failing example: the DM correctly used a grounded name (Corwin) but pinned
the wrong role to it. `findInventedProperNoun` won't catch this — Corwen is grounded. This needs the
new role-aware check specifically.

Add test cases covering:
- The exact bug: candidate names the wrong NPC as the elder when `ctx.settlement.npcs` has a different
  NPC with `role: 'elder'` → rejected.
- Candidate correctly names the actual elder → not rejected.
- Candidate makes no role-identity claim at all (generic flavor text) → not rejected (don't over-fire).
- Candidate references a role with no NPC of that role present in `ctx.settlement.npcs` → not rejected
  by this guard (out of scope — that's `findInventedProperNoun`'s territory or just ungrounded flavor).

## Done-when

1. New failing test(s) added first (extend `tests/U21x.*` numbering — check the highest existing `U2##`
   test file under `tests/` and increment), reproducing both bugs against `findInventedFactClaim` /
   the new guard directly (unit-level, not full playtest).
2. Both fixes implemented.
3. New tests pass.
4. Full suite green (`node --test`).
5. Determinism gates green (U19/21/22/27/30).
6. `git diff --stat` shows only `engine/llmAdapter.js` + the new/extended test file touched — no
   incidental edits elsewhere.
7. Claim in `docs/AGENT_CHANGELOG.md` as `[CLAIMED] H-52` before starting, replace with a `DONE` entry
   (root cause, fix summary, test/suite counts) when finished, per `docs/AGENT_PROTOCOL.md`.
8. Codex workers: commit locally, do NOT push — queue owner verifies and pushes per protocol §7.

## Out of scope

- Do not touch the Rules-Lawyer roll-reporting cluster (separate, smaller, not part of this packet).
- Do not add a general "always state the elder's name" behavior — only fix the two false-claim shapes
  above. If canon genuinely has no elder fact for a given settlement, an honest hedge/decline is
  correct and must not be penalized.
- Do not bump `WORLD_VERSION` — this is narration-validation only, no state-shape change.
