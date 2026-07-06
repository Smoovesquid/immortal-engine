# PW-2 — the honest floor for ungrounded takes: decline what canon doesn't hold

**Spec (read FIRST, it is the law):** `docs/briefs/PROSE_TO_WORLD_CONTRACT.md` — §1e (the live gap,
file:line evidence) + the PW-2 row + the contract's invariants. PW-1 is LANDED law since v0.22.0
(`4b8c8747` — taking a REVEALED container item commits canon: real `createItem`, real inventory).
PW-2 is its pair: **mint what canon holds; decline what it doesn't.** THE DM TEST governs the
decline's voice — an in-fiction line, never a mechanical bounce.

**Step 0 (mandatory).** Worktree branches from `main`, ~900 commits stale: `git fetch origin &&
git reset --hard origin/v2-polish`; confirm HEAD ≥ v0.31.2 b115. Do NOT work in the main checkout.
Then `docs/WORKER_BRIEF.md`.

## The bug (twice-confirmed by the harness: WB-Q4 / T-Q2, phantom acquisition, HIGH)

"I pocket the letter" when no such letter exists in canon: the trivial free-action classifier
passes it (`playloop.js:7651-7652`) and the outcome bank narrates "You pocket the ${what} and move
on." (`playloop.js:7246-7257`) — **no `addItem`, nothing persisted**. The player later "shows the
letter" to an NPC and the engine holds no record. Narration≠canon — the exact invariant the
contract exists to close.

## Deliverable

A take/pocket naming a noun that is NOT (a revealed remaining container item | a present furniture
piece | an inventory item | a combat-loot target) STOPS narrating acquisition:
- **The honest line, in voice:** "nothing like that here to take" — in-fiction, DM-Test-clean
  (never "invalid target"), OR
- **The pivot:** where the intent reads as searching ("I grab a letter from the desk" with an
  unsearched desk present), route to the EXISTING search path instead of declining — a real DM
  reads the intent richly and commits narrowly (V7).
- Grounded takes (all four legitimate sources above) stay byte-identical — PW-1's mint path and
  today's furniture/loot behavior untouched.

## Constraints

- The serial playloop slot is yours: `engine/playloop.js` (the classifier :7651 + the take bank
  :7246-7257 + whatever the pivot needs) + corpus additions + your tests. Stay OFF
  `engine/llmAdapter.js`/`narratorContext.js`/`composer.js`/`coherence/**` (DEATH-3's LIVE lane),
  `engine/combat/**`, `state.js`, `worldTick.js`, `public/**`, `scripts/**`, version files,
  `server.js` (PW-3's lane, queued next).
- **Corpus discipline (the contract's own warning):** behavior-corpus sensitive — run
  `npm run convergence` per change; corpus rows re-blessed ONLY where they were phantom
  (document each re-blessing individually: the row, why it was phantom, the new honest line).
  Touch ONLY take-path corpus rows — DEATH-3 is adding kill-line rows in parallel; do not brush
  its files beyond appends.
- Determinism ×2; zero numerics; boot anchor untouched; screen goldens locked. The intent
  translator stays LLM-primary (INT law) — the grounding check is ENGINE-side at commit time,
  never a regex pre-filter on raw text.

## Tests — U605–U607 (yours alone; ignore the allocator)

- **U605** (failing-first, the harness's own repro): "I pocket the letter" with no letter in canon
  → no item minted, the honest in-voice line (or the search pivot where present); the later "show
  the letter" finds nothing to show — narration and canon agree.
- **U606** the four grounded sources stay green: revealed container item (PW-1's mint), present
  furniture, inventory item, combat loot — each takes byte-identically to today.
- **U607** the wall: replay determinism ×2 both branches; DM-Test voice check (no mechanical
  bounce language in the decline); corpus re-blessings enumerated and green.

## Done-when

Full `node --test` green · `npm run check` GREEN · `npm run playtest:quick` clean · live playtest
(`PORT=5200 npm run dev`): type the phantom take, read the honest line; type a real take, watch it
mint — screenshot both · commit in YOUR WORKTREE ONLY (no push, no main checkout, no version
files) · plain-English report: the phantom you closed, the line the DM now says, every corpus
re-blessing (Tim is not a coder).

## Standing conduct

All judgment calls yours; never wait on Tim; reversible option + flag when unsure.
