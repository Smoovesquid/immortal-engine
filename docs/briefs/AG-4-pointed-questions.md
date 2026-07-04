# AG-4 — pointed questions answered in the fiction (kill the no-record dodge)

**Model:** Claude Sonnet (playloop info-seek seam — narration-routing shaped).
**Lane:** SERIAL (playloop is a competence hot file — no parallel sibling on it).
**Worktree step 0 (mandatory):** `git reset --hard origin/v2-polish` before reading anything — worker worktrees
branch from `main`, ~900 commits stale. Verify `git log --oneline -1` shows `baf1b51` or newer.
**Commit local to your branch; do NOT push.** Basecamp verifies and lands.

## Context — what's broken, in one breath

The 2026-07-04 Opus gate (v0.28.3, `docs/playtests/opus-gate-2026-07-04.md`) failed 9/48; the dominant cluster
is the engine voicing a **database miss through a person's mouth**. Tim's 2026-07-04 decision note (PACKETS,
Ref-pull section) names this exact work: *"the base DM's dead-ends — answer pointed questions in the fiction
without conjuring an absent speaker."* The dodge prose is NOT the LLM — it's the deterministic phrase bank in
`declineInfoSeek` (`engine/playloop.js:~7525–7545`). PACKETS row: `AG-4` (ACTIVE section). The Ref is OFF
(`REF_ENABLED=0` in `.env`) — you are fixing the BASE engine path, which fires regardless.

The four gate utterances that must stop dodging (seed `tallow`, Wayfarers' Outpost, NPC Elske Nightherd):

1. _"You just said you speak for the caravans — so which one do you speak for right now?"_
   → `[info-check → no-record]` → **"Elske Nightherd shrugs. 'Can't say. No record I've ever seen.'"**
   She's being asked about HERSELF. A person is not a filing cabinet.
2. _"If you don't know who runs it, how do you know its name is the Wayfarers' Outpost?"_
   → `[info-check → no-record]` → **"Elske Nightherd is done talking about it — the subject is closed."**
   A FIRST-TIME question drew the tier-2 stonewall (escalation counted her per-NPC, not per-topic).
3. _"I dip a finger in the water — cold or has it gone slimy from sitting?"_
   → `[info-check → no-record]` → **"Elske Nightherd shrugs. 'Can't say. No record I've ever seen.'"**
   A PHYSICAL SENSORY ACT got routed as an information request AND answered by an unrelated NPC's shrug.
   THE_DM_TEST verdict: narrate what the finger feels.
4. _"If you can't name a single caravan, why did you just claim to speak for them?"_
   → social roll → empty-room atmosphere dump, no NPC engagement (same self-question class as 1).

## Read first (targeted — playloop is ~7.4k lines, grep, never read whole)

- `engine/playloop.js:~7524` — `declineInfoSeek(world, text, npc)`: the escalating decline bank
  (`infoPressCount` → tier 0/1/2). The exact gate lines live here.
- `engine/playloop.js:~7546` — `infoExtractionOutcome(world, text, outcome)`: the deliver-or-decline path;
  `isInfoSeekingText`, `socialTarget`, `lookupGroundedFact` are its gates. Find where `infoPressCount` is
  WRITTEN (grep `infoPress`) and what state shape holds it.
- `engine/playloop.js:~7480` — the `[info-check → no-record | nothing grounded to deliver, no roll]`
  mechanics-line producer (which call sites can reach it).
- Precedents to mirror, not reinvent:
  - **Self-state answers:** NBIO-1 (`e1036ac`) — NPC answers "were you born here?" from its own tenure;
    DLG-1 (`3c8f418`) — direct address answers name/role from the roster. Grep `tenure`, `personQuery`.
  - **Definite grounded reads:** DS-1a (`b488820`) — sense over empty canon says "nothing there", never fog;
    `playloop.js:1683–1705` object-presence definite-negative.
  - **World-aware physical outcome:** `baf1b51` — `nonObjectSkillOutcome` search branch reads the ACTUAL room
    (names the real object or says "nothing's hidden here"). Your sensory read is its sibling.
- `docs/THE_DM_TEST.md` — the governing principle. Run it on every new line you write.

## Fix shape — three sub-fixes, one seam

### (a) Self-questions ground on the NPC herself
When the info-seek's subject is the ADDRESSED NPC (second-person markers aimed at her: "you/your" + role/claim/
name/tenure referents — "which one do YOU speak for", "why did YOU claim…", "how do YOU know…"), the grounding
lookup consults **her own modeled state first**: roster name/role, NBIO-1 tenure, faction if modeled. Deliver
what exists ("I speak for the outpost's board, such as it is — road-traffic when it comes").
When the SPECIFIC fact isn't modeled (which caravan by name): decline **in her voice, with an in-fiction
reason, owning the question** — refusal or honest self-limit, e.g. "None on the road this week — when one
rolls in, I'm its voice," or "That's my business, not yours." BANNED for self-questions: "no record",
"nobody's ever told me", any records/archive language. INVENT NOTHING (C9 rail): a refusal reason must commit
zero new canon facts (no new names, dates, events). Deterministic phrase bank + `pickVariant`, keyed distinctly
from the general bank.

### (b) Sensory probes never enter the info sink
A physical sensory probe of PRESENT matter — touch/dip/feel/taste/smell/press verbs aimed at an object that is
in the room's canon (the basin, the pallet, a wall) with a quality question attached ("cold or slimy?") — must
route to a **world-grounded sensory read**, not `isInfoSeekingText`/`declineInfoSeek`, and never a
`socialTarget` shrug. Answer from canon type + non-committal texture (stone basin, indoors, no fire in canon →
"stone-cold and clean; no film on it"). Deterministic, object-type-keyed variants; sensory COLOR is fine
(DMs describe texture), new canon FACTS are not. If the probed object is NOT in canon → the existing
definite-negative path ("no basin here — what's here is…", the 1683–1705 precedent) already owns it.

### (c) Decline escalation is per-topic, not per-NPC
`infoPressCount` currently escalates per-NPC, so three DIFFERENT questions hit tier-2 "the subject is closed."
Re-key escalation to (npc, topic-gist) so a fresh question always gets a fresh tier-0 engagement; only
repeat-pressing the SAME dead topic escalates (that part is correct table behavior — keep it).
⚠️ **Determinism trap:** if press counts persist in world state, re-keying changes state shape → replay
worldHash must stay equal (U19/21/22/27/30). Prefer keeping the existing container shape and deriving the
topic key inside it; if you must change shape, prove hash equality under replay and check ledger caps. If it
can't be done without a `WORLD_VERSION` bump — STOP and flag; do not bump.

## Guardrails

- **Reproduce LLM-off FIRST** (bug protocol): a small repro script (pattern: `scripts/_repro_*.mjs`) driving the
  four utterances against seed `tallow` world state; show the dodge pre-fix, the answer post-fix.
- **Corpus:** `npm run convergence` must exit 100%. If a locked row asserts the OLD dodge behavior, relock it
  deliberately (DLG-1/C16-001 precedent) and document each relock in your report. Add new locked rows for
  (a)/(b)/(c).
- **Forbidden:** `engine/npc/dialogue.js`, `engine/grace/` (if the fix seems to need them, STOP and flag —
  serial-lane boundary); `WORLD_VERSION`; `engine/rng.js`; any new randomness; `Math.random`.
- **Tests:** `node --test` full suite green; new unit tests for the three sub-fixes (allocate numbers with
  `scripts/next-test-number.sh U`); `npm run playtest:quick` clean.
- **Version:** patch bump `package.json` +1 from whatever it is when you land (it was 0.28.8 when this brief
  was written) **and** `public/v1.js` title + build line (+1 build counter, today's date, label
  `pointed questions answered`).
- **Docs:** append your dated section to `docs/AGENT_CHANGELOG.md`; update the AG-4 row in `docs/PACKETS.md`
  to ✅ with commit hash.

## Done-when

- The four quoted utterances produce in-fiction answers/refusals with the LLM OFF (repro script output in
  the report).
- No "no record"-class or "subject is closed" line on a self-question or a first-time topic; sensory probes
  of present matter get sensory answers; unrelated NPCs never voice object-probe results.
- `npm run check` green (suite + convergence + determinism); playtest:quick clean.
- One commit on your branch (not pushed), version bumped, changelog + PACKETS updated.

## Rollback

Revert the single commit.

## Report (plain English for Tim, ALWAYS)

End with: what was broken (NPCs shrugged "no record" at questions about themselves, your finger never got wet,
and three questions of any kind made an NPC stonewall everything), what changed, why it matters (the DM stops
breaking character — the gate's biggest failure cluster), jargon translated.
