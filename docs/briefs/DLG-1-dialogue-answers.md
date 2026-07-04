# DLG-1 — the dialogue voice answers or declines (AG-1's dialogue half)

**Model:** Claude Sonnet (dialogue lane). **Solo packet** (touches playloop + dialogue; NBIO-1/CMB-SINK-1 fan out
after). The playloop edit is one small reroute at a named branch — keep it minimal.

## Context
Completes the answerability family. AG-1 (landed, `e9a7826`) built `directQuestionIntent` and closed the
non-dialogue non-answer sinks. The **dialogue-enter sink** is what's left: on the 2026-07-02 re-gate,
"Who are you? Do you live here?" routed to `[dialogue enter | Elske]` and the NPC just **turned and waited** —
a direct question got no answer. Diagnosis: `docs/briefs/FAILURE_META_DIAGNOSIS.md` §4 (DLG-1).

**Tim's design call is made (2026-07-02):** the corpus deliberately locked `C16-001` as "identity question →
enter dialogue *silently*." That is the losing side of THE_DM_TEST, and Tim chose to **relock it: enter dialogue
AND the NPC's first line answers from the roster, or declines in the NPC's voice.** Implement that; do not
preserve the silent-enter behavior.

## Read first
- `engine/playloop.js:2161-2170` — the `isDirectAddressIntent` branch. Line 2170 is the exact bug:
  `narration: 'Wizard: ${daName} stops and turns — eyes level, waiting.'`, `mechanics: [dialogue enter | …]`.
  (The other dialogue-enter branch at ~:2079 is the explicit "talk to X" path — leave it.)
- `engine/npc/dialogue.js`: `beginDialogue` (:56, its outcome already carries `npcName`/`npcRole`/`trustLevel`),
  `askNpc` (:511, answers a question in the NPC's voice), `npcVoice` (:135).
- `engine/grace/answerability.js`: `directQuestionIntent` (AG-1, exported) — `kind:'npc-addressed'` is your signal
  that this address is a QUESTION needing an answer (vs a bare greeting).
- `engine/grace/gracefulAdjudication.js`: the `personQuery`/identity answer (name+role) — the deterministic fact
  source. Residence is derivable from the settlement roster (a present NPC lives in / works this settlement).
- `tests/corpus/C16.corpus.mjs` — `C16-001` (the case to relock; note its `source` warns that answering-on-entry
  once broke convergence 105→104 — so relock carefully and keep the rest of the corpus 100%).

## Fix shape (answer the FACT from canon; the existing voice layer phrases it)
At the `:2161` direct-address branch: when `directQuestionIntent(text, w)` is `kind:'npc-addressed'`, the first
line must **answer or decline**, not wait. Enter dialogue (as now) but replace the stock "turns and waits"
narration with the NPC's first line delivering the answer:
- **Identity** ("who are you?") → the NPC's real name + role (from `beginDialogue`'s outcome / `personQuery`
  identity). **Residence** ("do you live here?") → derived from the settlement roster (yes / role-based). Route
  the assembled FACT through the existing NPC-voice machinery (`askNpc` / `npcVoice`) so it's phrased in voice —
  do NOT invent identity content (Road A: the fact is from the roster; only the phrasing is voiced).
- **What the NPC would hide** → an in-voice decline ("That's my business, stranger"), never a silent wait.
- A **bare greeting** ("hi", "well met" — `directQuestionIntent` null) keeps the existing greeting response;
  only ADDRESSED QUESTIONS change.

## Relock C16-001 (the deliberate contract change)
Update `C16-001`: `intent` → "...enters dialogue AND the first line answers (name/role/residence) or declines in
voice — no roll, no room-observe, no silent enter-and-wait." `assert.surface_matches` → keep `/dialogue enter/i`
AND require the answer (the NPC's name/role appears in the first line); `assert.surface_excludes` → add the stock
`/stops and turns.*waiting/i` line. Keep the diverge cases ("who am I?" → character-sheet meta; "look around";
"I attack Mira"). Ensure the full corpus stays 100% (the 105→104 caution — greetings must still greet).

## Invariants — by reference (do not weaken)
THE_DM_TEST (this IS the DM-Test fix — resolve the intent). Road A / Biblioteca V11 — identity/role/residence come
from the roster, never LLM-invented (only phrasing is voiced; the P3 npc-voice leak guard still holds).
Determinism: `engine/rng.js` sole randomness; `worldHash` stable; U19/21/22/27/30 green. §0 never surfaced.
LLM never throws. **Over-match:** bare greetings still greet; "who am I?" stays character-sheet meta; "I attack
Mira" stays an action.

## Test plan
- **`tests/U313.*.test.js`** (pre-assigned): "Who are you?" / "Do you live here?" to a present NPC → the first
  line names the NPC + role (and residence), NOT the "stops and turns — waiting" stock line; a would-hide
  question declines in voice; a bare greeting still greets; the diverge cases hold.
- **`tests/corpus/C16.corpus.mjs`** — C16-001 relocked as above; whole corpus stays 100%.
- Optional live probe (LLM on, `.env`, CLI, budget-gated): Elske answers "who are you?" in the tallow cottage
  instead of turning and waiting.

## Done-when
`U313` green · C16-001 relocked + `npm run convergence` 100% locked · `node --test` fully green · determinism green ·
`npm run playtest:quick` 0 bugs. Bump the version (solo): `package.json` → **0.20.6**, `public/v1.js` →
**v0.20.6 / build 031 · 2026-07-02 · NPCs answer, not stall**.

## Commit protocol
Stage ONLY your files by explicit path (`playloop.js`, `engine/npc/dialogue.js`, `gracefulAdjudication.js` if
touched, `package.json`, `public/v1.js`, `tests/U313.*`, `tests/corpus/C16.corpus.mjs`) — untracked briefs/docs
are in the tree, so **never `git add -A`**. Commit locally (`feat(dialogue): DLG-1 — NPCs answer or decline on a
direct question, not enter-and-wait (relocks C16-001)`). **Report the commit hash; do NOT push** — Basecamp
verifies (incl. the C16-001 relock + over-match) and pushes.
