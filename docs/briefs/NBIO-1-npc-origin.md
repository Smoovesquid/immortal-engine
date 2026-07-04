# NBIO-1 — an NPC answers "were you born here?" from its own tenure, not the place-blurb

**Model:** Claude Sonnet (dialogue/world lane).
**Solo on the dialogue/world files.** Runs in PARALLEL with CMB-SINK-1 (Codex), which is file-disjoint (combat
only). **Stay OFF** `engine/playloop.js` and `engine/escapeCombat.js` — those are CMB-SINK-1's. If your fix seems to
need `playloop.js`, STOP and flag it (the DLG-1 branch already routes through `commonKnowledgeAnswer` first, so
adding a mode there should require NO playloop edit).

## Context — the G4 leaf Fable flagged
Per `docs/briefs/FAILURE_META_DIAGNOSIS.md` §4 (NBIO-1): after AG-1/DLG-1, a **second-person self-tenure/origin**
question to a present NPC — "were you born here?", "have you been here long?", "did you grow up in this village?",
"are you a local?" — no longer *rolls* (AG-1 killed that) and no longer silently *waits* (DLG-1). But it currently
falls to an **honest decline or the wrong answer**: the convergence backlog (`REF-003`) shows "have you been here
long?" / "did you grow up in this village?" landing on the PLACE blurb — *"This is Pilgrim's Rest Test Village.
Small, but it holds."* — instead of the NPC's own tenure. That's a real answer the engine already HAS and isn't
delivering. NBIO-1 delivers it.

**Good news: the deterministic fact already exists.** `engine/world/personQuery.js` answers *third-person* tenure
("is Kael a founding resident?") from `npc.originTick` (`describeTenure`, `:191`: `originTick 0` = founding
generation / original settler; `> 0` = later arrival). NBIO-1 just extends that to the *second-person
self-addressed* form and routes it through the dialogue voice — inventing NO new fact (Road A / Biblioteca V11:
the fact is `originTick`; only phrasing is voiced).

## Read first
- `engine/world/personQuery.js`: `classifyTenureQuery` (:72, the third-person tenure patterns), `describeTenure`
  (:191, the `originTick`→prose answer), `personQuery` (:206, gates on `type === 'tenure'`). The `PERSON_DEFER_RE`
  (:96) includes `born`/`origin`/`grew up`/`how long` as *defer* words — the second-person self-tenure ask must
  fire a NARROW pattern BEFORE that defer guard (mirror how `classifyTenureQuery` already fires before the defer).
- `engine/npc/dialogue.js`: `commonKnowledgeAnswer` (:203) — DLG-1 added a `residence` mode here (present NPC
  lives/works here). Add an **`origin`/`tenure` mode the same way**: "were you born here / are you a local / how
  long have you been here" → the NPC's own `originTick`-derived line, in voice. Also add the mode to the
  `dialogueAskNarration` switch (`:4407` area — mirror the DLG-1 `residence` case) so `askNpc` handles it if called
  on a later turn.
- `tests/corpus/REF.corpus.mjs` — `REF-003` is the waiting discovery target (second-person "have you been here
  long?" / "did you grow up in this village?"). It becomes lockable once NBIO-1 answers it.

## Fix shape (deliver the tenure fact in voice; invent nothing)
1. **Classify second-person self-tenure** in `commonKnowledgeAnswer` (or a small helper it calls): "were you born
   here?", "are you from here / a local?", "did you grow up here?", "have you been here long?", "how long have you
   lived here?" → an `origin`/`tenure` answer sourced from the addressed NPC's `originTick`:
   - `originTick === 0` → "Born and raised here — one of the first families / been here since the founding."
   - `originTick > 0` → "No — I came later / I'm not a native, I settled here." (Keep it §0-safe and vague on the
     exact year unless the world models one; the `describeTenure` phrasing is your template.)
   Route through the NPC's voice layer (as DLG-1's residence mode does), so DLG-1's direct-address branch picks it
   up automatically on enter — **no playloop edit**.
2. **Over-match discipline.** Do NOT swallow: third-person tenure ("is Kael a founding resident?" stays on the
   existing `personQuery` path), place questions ("what is this village?" still → place-blurb), or generic "how
   long" that isn't self-addressed. Fire only on the SECOND-PERSON self-tenure/origin form.

## Invariants — by reference (do not weaken)
THE_DM_TEST (deliver the answer the engine has). Road A / Biblioteca V11 — the fact is `npc.originTick`, never
LLM-invented; only phrasing is voiced (the P3 npc-voice leak guard still holds). §0: tenure is settlement-history,
never cosmology — keep it symptom/faith/rumor-safe, never surface §0. Determinism: `engine/rng.js` sole randomness;
`worldHash` stable; U19/21/22/27/30 green. LLM never throws.

## Test plan
- **`tests/U315.npcOriginAnswer.test.js`** (pre-assigned, LLM-off): to a present NPC with `originTick === 0`, "were
  you born here?" → a first line naming their founding/native tenure (NOT the place-blurb, NOT a decline, NOT a
  roll); to an NPC with `originTick > 0`, the same question → a "came later / not a native" line. Diverge guards:
  "is Kael a founding resident?" still routes third-person via `personQuery`; "what is this village?" still →
  place-blurb; "who are you?" still → identity (DLG-1). Assert determinism.
- **`tests/corpus/REF.corpus.mjs`** — promote/lock `REF-003` (second-person tenure paraphrases now answered).
  Add a `C19.corpus.mjs` (pre-assigned) if a fuller paraphrase family helps. Keep the whole corpus 100%
  (`npm run convergence`) — mind the REF-003 target's current excluded phrasings.

## Done-when
`U315` green · `REF-003` locked + `npm run convergence` 100% · `node --test` fully green · determinism green ·
`npm run playtest:quick` 0 bugs. **Do NOT touch `package.json` or `public/v1.js`** — CMB-SINK-1 runs in parallel
and would collide on the version lines; Basecamp does ONE consolidated version bump when both lanes land.

## Commit protocol
Stage ONLY your files by explicit path (`engine/npc/dialogue.js`, `engine/world/personQuery.js`,
`tests/U315.*`, `tests/corpus/REF.corpus.mjs`, `tests/corpus/C19.*` if added) — untracked briefs/docs are in the
tree, so **never `git add -A`**. Commit locally (`feat(dialogue): NBIO-1 — NPCs answer "were you born here?" from
their own tenure`). **Report the commit hash; do NOT push** — Basecamp verifies (checks the over-match diverge
guards + REF-003 lock + determinism), does the consolidated version bump, and pushes.
