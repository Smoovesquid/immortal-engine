# PW-5 AUDIT — NPC latent knowledge on the ask path (REPORT-ONLY)

*Worker: PW-5 audit lane · OPUS · report-only (the NPC-DEED-1 pattern). Mapped at HEAD `6c2980c1`
(v2-polish), which includes PW-3's landing (b118). Deliverable = this file only. No code.*

---

## Plain-English summary (for Tim — not a coder)

When you talk to a villager and ask about something they don't personally know, the game runs down a
checklist: *Do I have a fact about this in my head? Do I hold a rumor about it? Is it my own name, the
local news, directions, who's in charge, what this place is? Has a rumor about it drifted into town
that I can pass along?* If every one of those misses, the villager **shrugs you off** — "couldn't
say, ask someone older." That shrug is the dead-end this packet is about.

PW-3 (last week) already fixed one big slice of it: if a rumor has reached town on your topic, even a
villager who wasn't there will now **pass along the hearsay**, garbled to how worldly they are. That
was the rumor layer's first live trigger and it works.

What's **still** a dead-end after PW-3 is the narrower, more interesting case: things that are **true
in the world and a local would plausibly just know** — the founding story of a *neighboring* place,
a well-known regional landmark, the name of the big river, the county's reigning lord — but which
aren't written into *this specific villager's* head, aren't a rumor, and aren't one of the six
"place-fact" slots the engine already answers. Right now those all collapse to the same shrug, which
reads as the villager being weirdly ignorant of common knowledge.

The fix this packet specs: a small, **authored, seed-derived "common knowledge bank"** — a handful of
region-level facts (not secrets, not mysteries, not motives) that any local can draw on, checked as
one more branch *before* the shrug. Crucially, it must obey the house law that a good DM **withholds**
mystery and never invents: it may only hand over facts that are **already grounded in world canon**,
never fabricate a name or a date, and never touch the protected cosmology. It also must not duplicate
or re-implement the one place where the game reads "your reputation," and it must be **deterministic**
(same world + same ask → same answer, byte-for-byte) so replays and the desync oracle stay green.

The engine already has almost all the parts (`placeQuery`, `personQuery`, the claims channel, the
rumor pickup). PW-5 is a **small, bounded addition**, not a new subsystem — and this audit shows
exactly where it slots in and where the guardrails are.

---

## Q1 — What EXACTLY happens on askNpc's miss-path at HEAD, branch by branch

`askNpc` lives at **`engine/npc/dialogue.js:662`**. "Miss-path" = the player asks something and the
topic does **not** resolve to a fact in this NPC's `knowledgeGraph`. That gate is
**`dialogue.js:766`** — `if (!topic || !knownIds.has(topic))`. (`topic` comes from `extractTopic`,
`dialogue.js:1399`, which scores the ask against the NPC's own knowledge-graph fact-ids only. A miss
there is the entry to everything below.)

Inside that miss block, in strict order:

1. **Vision-recognition (heretic gate)** — `dialogue.js:771`.
   Fires iff `heldClaim && npc.heretic && playerCarriesMark(w, 'vision:root')`. `heldClaim` is
   computed at `dialogue.js:759` via `findClaimForText` (`dialogue.js:943`), which token-matches the
   ask against `world.claims` filtered to `holderNpcId === npc.id`. → `mode='vision_recognition'`.
   Narrow, mark-gated; not a dead-end and not our target.

2. **Claim recall** — `dialogue.js:775`.
   `else if (heldClaim && trust >= TRUST_REVEAL_PUBLIC)` (`TRUST_REVEAL_PUBLIC = 4`, `dialogue.js:20`).
   The NPC holds a belief (from `claims.js` social propagation) about the subject and trust is high
   enough. → `mode='claim_recall'`, `claimData = resolveClaimContext(...)` (`dialogue.js:971`). The
   two-variance wall: it surfaces the NPC's **distorted belief**, never engine truth. Not a dead-end.

3. **Common knowledge, else deflect** — `dialogue.js:781-786` (the `else` branch):
   ```
   const common = commonKnowledgeAnswer(w, npc, text);
   if (common) { mode = common.mode; commonBody = common.body; }
   else { mode = 'deflected'; }
   ```
   `commonKnowledgeAnswer` (`dialogue.js:224`) is a large ordered classifier — the real substance of
   the miss-path. It returns a `{mode, body}` or `null`. Its branches, in order:
   - **self** (`:234`) — "who are you / your trade" → `mode:'self'` (role line).
   - **origin/tenure** (`:247`, NBIO-1) — "were you born here / how long have you lived here" →
     `mode:'origin'` from `npc.originTick`.
   - **residence** (`:269`) — "do you live/work here" → `mode:'residence'`.
   - **news** (`:284`) — "any news / rumors / gossip" → surfaces the NPC's OWN carried rumors via
     `filterRumors` (`perspectiveFilter.js:257`); freshest wins; a quiet fallback line if none. →
     `mode:'news'`.
   - **directions** (`:318`) — "way to / where is / next town / **know about / tell me about** <place>"
     → resolves a named or nearest settlement node, gives a bearing + distance. → `mode:'directions'`.
     A "way to <unknown place>" yields an honest "can't say I know the place" (`:339`).
   - **services** (`:344`) — "what do you sell / buy / work / hiring" → shop list or a "bigger town"
     honest decline. → `mode:'services'`.
   - **leadership** (`:364`, ANS-2) — "who runs / represents this place" → self or names the settlement
     leader; **secret-control phrasings return `null`** (`:365`) so the caller declines (reveal-sink
     law). No leadership role at this node → returns `null` (`:389`).
   - **place-knowledge via resolver** (`:402`, W-6) — `classifyPlaceQuery` + `resolvePlaceFact`
     (`placeQuery.js:376`). Six grounded slots exist: **founding, events, history, concern,
     population, overview** (`placeQuery.js:351-356`). Renders the SAME fact the DM-narrator renders
     (one fact, two voices). Resolver `null` → falls through.
   - **person-identity via resolver** (`:418`, P-2) — `classifyPersonQuery` + `resolvePersonFact`
     (`personQuery.js:208`). Identity / location / tenure of a **present** non-hostile NPC only. →
     `mode:'identity'`. Non-present referent → `null` → falls through.
   - **place blurb catch-all** (`:438`) — "this place / this village / around here" (guarded by
     `NOT_PLACE_DESCRIPTION_RE`, `:437`, which excludes history/danger/control/counts) → a generic
     "This is <name>. Small, but it holds…" blurb. → `mode:'place'`.
   - **small talk** (`:453`) — courtesies → `mode:'smalltalk'`.
   - …and any remaining tail branches return **`null`**, which becomes **`mode='deflected'`** at
     `dialogue.js:785`.

4. After the mode is decided, the reducer runs **`surfaceRumorsForTopic`** (`dialogue.js:1304`,
   called at `:901`) and packs `rumorMintHint` into the outcome (`dialogue.js:925`). This is a **pure
   read** — it does NOT mint; it computes the hint. Two parts:
   - The NPC's OWN carried rumors matching the topic (`filterRumors` + `rumorMatchesTopic`) → returns
     `bodies[]` (volunteered). `rumorMatchesTopic` (`dialogue.js:1292`) matches **TAG segments only**,
     as whole content tokens — never body substrings, never interrogatives/stopwords (`TOPIC_NOISE`,
     `:1271`). This is why an accusation sharing stray words with a rumor body does NOT hijack it.
   - **PW-3 pick-up path** (`dialogue.js:1323-1357`): if the NPC carries nothing, find a **latent seed**
     — a rumor already in `world.rumors`, tag-matching the ask, that this NPC does **not** yet carry
     (`!rumorIds.has(r.id)`). Deterministic pick: lowest `tier` first, then `id` order. Packs a
     `mintHint` with the seed's `sourceSeedId`, `truthBody`, `tags`, `originHop`.

### Where PW-3 actually intercepts (the reducer side)

The interception is in **`engine/playloop.js`**, the dialogue-ask handler, **not** in `askNpc`:

- `askNpc` returns `asked.outcome` (with `mode` and `rumorMintHint`). — `playloop.js:1438`.
- **`tryPickUpRumor(w, asked.outcome)`** — `playloop.js:1444`, defined at **`playloop.js:5532`**.
  Its **hard gate**: `if (!outcome || outcome.mode !== 'deflected') return { world, pickup: null }`
  (**`playloop.js:5538`**). A pickup fires **ONLY on a bare `deflected`** — never overriding shared /
  lied / withheld / claim_recall / common-knowledge (U134-06: else "tell me about the well" would
  surface hearsay from the very NPC who knows firsthand). It then:
  - requires `hint.seed` and the NPC present at the node (Purity #8, `:5550`);
  - **budget**: `carrierRumorCountAtNode(...) >= RUMOR_MINTS_PER_SCENE` (`= 3`, `playloop.js:5494`) →
    silent decline, `budgetHit:true` (`:5554`);
  - mints a **deterministic** rumor id `rumor:${sourceSeedId}:${npcId}:${turn}` (`:5564`),
    idempotent on repeat asks same turn; tier floored at 1 (hearsay is never firsthand tier-0,
    `:5577`); body = `garbleRumor(truthBody, tier, traits)` with hearsay-prefix stripping (`:5587`);
  - commits via `applyDeltas(world, [{ op: 'mintRumor', rumor }])` (`:5606`) + a `resolution` replay
    marker (`:5609`).
- Back in the handler: **`askMode = rumorPickup ? 'rumor_pickup' : asked.outcome.mode`**
  (`playloop.js:1479`); narration = **`rumorPickupNarration`** (`playloop.js:5865`) when picked, else
  **`dialogueAskNarration`** (`playloop.js:5658`). The event mode is rewritten to `'rumor_pickup'`
  (`:1452`).

### What STILL dead-ends after PW-3 (the PW-5 target set)

A turn ends in the **bare-deflection sink** (`dialogueAskNarration` → the `deflected` voice pools at
**`playloop.js:5830-5855`** — "couldn't say… ask someone older") iff **ALL** of the following miss:

1. not in this NPC's `knowledgeGraph` (`extractTopic` miss), AND
2. no `heldClaim` (no propagated belief about the subject), AND
3. `commonKnowledgeAnswer` returns `null` — i.e. it is **not** self / origin / residence / news /
   directions-to-a-known-node / services / leadership / one of the six `placeQuery` slots (founding,
   events, history, concern, population, overview) / present-NPC identity / the generic place blurb /
   small talk, AND
4. **no latent rumor seed tag-matches** the ask in `world.rumors` (PW-3 finds nothing), OR the
   per-scene mint budget (3) is already spent (`budgetHit`).

The **residual class** — what a real local plausibly knows but the engine currently shrugs off — is
**grounded regional/common knowledge that is neither node-local place-fact, nor present-person
identity, nor a circulating rumor**. Concretely:
- the founding / history / notable events of a **neighboring** settlement (placeQuery resolves only
  the **current** node — see `placeQuery.js` `here = current node`; a "tell me about <other town>"
  gets routed to *directions* (a bearing) at `dialogue.js:318`, not its lore);
- **region-scale** landmarks / geography a local would know (the big river, the mountain pass, the
  county seat) that aren't nodes in the slice's roster;
- the **regional polity** — the reigning lord / county / faction-at-large — where it is **public**
  common knowledge (as opposed to secret allegiance, which is correctly deferred);
- well-known **historical** facts of the region below the §0 line (a famous battle, a past plague, the
  old road's name) not attached to any single node's timeline.

These are exactly the "a good DM would just answer this; a villager looking blank is wrong behavior"
cases (THE_TABLE_TEST). Everything **mysterious, secret, motive-bearing, or §0** must **stay**
deflected — that is the law working, not a bug (Q2).

---

## Q2 — Where the earned-knowledge law binds; what an NPC may answer WITHOUT the player earning it

Governing doc: **`docs/LAW_OF_EARNED_KNOWLEDGE.md`**. Six tiers (`:36-71`). The rule an NPC-scale bank
must obey: **deliver only from canon, never fabricate; honest-decline unknowns; never hand over
protected mystery / other minds / unobserved state / meta** even on a good roll or a direct ask.

**What an NPC may answer WITHOUT the player having "earned" it (no trust/roll/discovery gate)** — the
already-built "common knowledge AT this node" surface. The design principle is stated at
`dialogue.js:392-401`: Purity #8 puts the speaking NPC at the player's node, so **substrate clarity
(vivid) = common knowledge a co-located local plausibly holds**. Enforced points:

- **Common-knowledge branches, trust-free** (`commonKnowledgeAnswer`, `dialogue.js:224`): self,
  origin/tenure, residence, directions, services, leadership (public role only), the six `placeQuery`
  slots, present-NPC identity, place blurb, small talk, and news. None of these require trust ≥ N or a
  roll. **This is the precedent PW-5 extends**: local common knowledge is answerable *because it's
  vivid/public*, not because it was earned.
- **`placeQuery.js` slots** all resolve at `clarity:'vivid'` (founding/events/concern/population/
  overview — `placeQuery.js:68,105,189,231,284`) except `history` which is `'distant'`
  (`:342`). Vivid = surfaceable as common knowledge. The resolver returns **`null` when canon has
  no such fact** (`resolvePlaceFact`, `placeQuery.js:376`) → the caller declines. **Never invents.**
  This is the Tier-1 "deliver only from canon" enforcement point for places.
- **`personQuery.js`** binds Tier-1/Tier-4 for PEOPLE. It answers **name + role + presence + tenure
  of a PRESENT non-hostile NPC only** (`resolvePersonFact`, `personQuery.js:208`). It **explicitly
  defers** (returns `null`, never classifies) motive / secrets / thoughts / backstory / allegiance /
  faction / leadership-identity via **`PERSON_DEFER_RE`** (`personQuery.js:96`, applied at
  `classifyPersonQuery` `:169`). §0-safe by construction — header `personQuery.js:30-31`, and every
  render helper is "name + role only." A non-present referent returns `null` (`:228`). **This is
  Tier-4 "the narrator never reads a mind for free," enforced at the classify gate.**
- **The claims channel** (`engine/claims.js`) is the Tier-4 "comes from the source" path done right:
  a claim is **one NPC's belief**, body always null, distorted at speak-time — never promoted to
  engine fact without a non-LLM step (`claims.js:1-9`). Surfaced in dialogue only via `heldClaim`
  (`dialogue.js:759,775`) and gated by `trust >= TRUST_REVEAL_PUBLIC`. The two-variance wall
  (`dialogue.js:756-758`) surfaces the NPC's MAP, never the territory.
- **Secrets** (`dialogue.js:788-798`): a known-topic that is in `npc.secrets` needs
  `trust >= TRUST_REVEAL_SECRET` (`=7`, `:21`) to be shared; below that it's lied (if
  `honesty < HONESTY_LIAR = 0.3`) or withheld. This is **earned** knowledge in the strict sense.
- **Post-LLM validator backstop** (the narration side): `augmentNarration` /
  `validateNarrationCandidate` / `findInventedProperNoun` (U142) / `findInventedFactClaim` (U212), and
  the DM-prompt earned-knowledge clause pinned by **U223** (`tests/U223.earnedKnowledgeNoFabrication`).
  The NPC-voice prompt's `deflected` instruction (`server/npcVoicePrompt.js:18`) explicitly forbids
  invented numbers/counts/dates/names/history on a deflection. **Any NPC-bank body that reaches the
  LLM voice layer is still subject to these guards** — belt and suspenders.
- **The narrator (non-dialogue) path** binds via `isInfoSeekingText`
  (`grace/gracefulAdjudication.js`, imported `playloop.js:69`; used `:1328`, `:6415`, `:8414`, etc.) —
  declines ungrounded info demands **pre-roll** so a failed/absent-fact ask never fabricates.

**Net for PW-5:** the law permits a new NPC-answerable surface **iff** every fact in it is (a) already
grounded in world canon/seed-derived data, (b) below the §0 line (symptom/public/event-level, never
cosmology/motive/secret allegiance), and (c) resolved by a **pure resolver that returns `null` when
canon lacks the fact** — mirroring `placeQuery`/`personQuery`. Trust-free is fine (it's common
knowledge); a roll must never manufacture a fact that canon doesn't hold (Tier-1 rule, `:39`).

---

## Q3 — Where a seeded latent knowledge bank could collapse an answer honestly

**The container analogy (from the contract):** the pre-fix container was a dead-end where a latent
value should *collapse* on contact — reveal → read → acquire. The NPC-scale analog: the ask *is* the
contact; a grounded latent fact should **collapse into a spoken answer** instead of a shrug. The
"collapse" here is **read-only** (the fact already exists in seed-derived canon; speaking it doesn't
mint new world truth) — unlike PW-3, which mints a rumor record. That keeps PW-5's determinism story
trivial (see Q4).

**Where it slots in (the seam):** a new branch inside **`commonKnowledgeAnswer`
(`engine/npc/dialogue.js:224`)**, placed **after** the existing `placeQuery`/`personQuery`/leadership
branches (so node-local and present-person facts always win — one fact, two voices, no double source)
and **before** the generic place-blurb catch-all (`dialogue.js:438`) and the final `null`→`deflected`.
Because `commonKnowledgeAnswer` returning non-null yields a non-`deflected` mode, this branch
**naturally precedes the PW-3 pickup** (`tryPickUpRumor` only fires on `deflected`,
`playloop.js:5538`). Ordering law: **firsthand/grounded common knowledge beats hearsay** — a local who
*knows* the county seat states it; only if the bank *also* misses does the turn fall to PW-3's rumor
pickup, then to the shrug. This is the correct precedence and needs no change to `tryPickUpRumor`.

**The data source (honest, seed-derived, no fabrication):** a **pure deriver** — call it
`regionCommonKnowledge(world)` / a `commonKnowledgeQuery` resolver — that reads **existing grounded
canon** and returns typed facts or `null`. It must NOT introduce a second store of truth. Candidate
grounded sources already in the world (to be confirmed by the implementer's grep — see scope):
- **neighboring-node lore**: the SAME `placeQuery` resolvers, but run against a **named other node**
  the ask references (founding/events/history of "Aldermere" asked while in "Crowfoot Camp"). This is
  the biggest, cleanest win — the resolver logic already exists; only the *node selection* differs
  (today `commonKnowledgeAnswer` routes a named-place ask to *directions* at `dialogue.js:318`).
- **slice/region seed facts**: the region generator (`engine/world/sliceRegion.js`, seed
  `'aldermere'`) and any authored region-level constants — landmarks, the region's polity/name — if
  they exist as data. Where they DON'T exist, the resolver returns `null` and the turn deflects
  (honest decline; never invent to fill the gap — Tier-2, `LAW_OF_EARNED_KNOWLEDGE.md:43`).
- **public regional history** below §0: any world-level timeline/founding data not node-scoped.

**The reputation read-sink constraint — do NOT fork it.** The sole reputation read is
**`playerReputation(world)`** at **`engine/newspaper/lastingWord.js:187`** (reads `world.timeline`
for the most notable recent deed; wired into the live greeting via NP-2). PW-5 is about **world/region
knowledge the NPC holds**, NOT about the player's standing — so it should have **zero** interaction
with `playerReputation`. The constraint is a *guard against scope creep*: if any "does this NPC
recognize the player's deeds" idea surfaces mid-build, it must call `playerReputation` (the one sink),
never re-derive reputation from `world.timeline` inline. **PW-5's clean answer: don't touch the
reputation path at all.** (Falsifier F-REP below pins this.)

**Why this is honest under the law:**
- Tier-1: delivers only facts a resolver pulls from canon; resolver `null` → deflect. No fabrication.
- Tier-2: an ungrounded regional ask (a place/lord/event canon never authored) → `null` → the
  existing honest deflection. A roll cannot manufacture it.
- Tier-3 (§0): the bank is **whitelisted to public/event/geography facts**; it must never expose
  cosmology, the sealed secret, or anything §0-adjacent. Same discipline as `personQuery.js:30`.
- Tier-4: the bank answers **world facts, not other minds** — no motive, no secret allegiance
  (public polity name is fine; "who does the elder secretly serve" stays deferred by the same
  `PERSON_DEFER_RE`/`LEADERSHIP_SECRET_RE` guards already in place).
- Two voices, one fact: for neighboring-node lore it **reuses `resolvePlaceFact`**, so the NPC voice
  and the DM narrator render the identical canon — no third truth source.

---

## Q4 — The PW-5 packet spec (ready to dispatch verbatim)

> **PW-5 — NPC latent (region-common) knowledge on the ask path.** OPUS. Serial-ish: touches
> `engine/npc/dialogue.js` (a competence hot file — coordinate; do not run concurrently with another
> dialogue-lane packet). Report-then-code; **engine-brief ritual applies** (this edits `engine/**`).

### Objective
Close the residual dialogue dead-end identified in `docs/briefs/PW-5-audit.md` Q1: when a local is
asked about **grounded region-common knowledge** (a neighboring settlement's lore, a region landmark,
the public polity/history below §0) that isn't in their `knowledgeGraph`, isn't a claim, isn't a
current-node place-fact or present-person identity, and isn't a circulating rumor — they currently
shrug. Add a **pure, seed-derived common-knowledge resolver** as one branch in
`commonKnowledgeAnswer`, so a local answers what a local would plausibly know, **without violating
LAW_OF_EARNED_KNOWLEDGE and without minting any world state.**

### Scope — grep FIRST (mandatory, per the contract row)
Before writing, confirm the grounded sources that actually exist at HEAD:
1. `rg -n "sliceRegion|region\b" engine/world/sliceRegion.js` — enumerate region-level seed facts
   (polity name, landmarks, region name) that are DATA, not prose. If none exist as structured data,
   **the neighboring-node-lore path is the whole packet** and region-landmark facts are OUT (deferred
   to a future packet — do NOT author new lore constants in PW-5).
2. `rg -n "resolvePlaceFact|classifyPlaceQuery" engine/world/placeQuery.js` — confirm the resolver
   accepts an explicit target node (or add a thin, pure wrapper that runs the existing classifiers
   against a **named** node instead of `currentNodeId`). **No new fact types**; reuse founding/events/
   history/overview.
3. `rg -n "PERSON_DEFER_RE|LEADERSHIP_SECRET_RE|NOT_PLACE_DESCRIPTION_RE" engine/npc/dialogue.js
   engine/world/personQuery.js` — reuse these exclusion guards verbatim so secret/motive/§0 asks stay
   deferred.

### Files & seams
- **`engine/npc/dialogue.js`** — add ONE branch in `commonKnowledgeAnswer` (`:224`), positioned
  **after** the person-identity branch (`:426`) and **before** the place-blurb catch-all (`:438`).
  The branch:
  - detects a **named other place** in the ask (a node in `world.map.nodes` with `id !== here.id`, or
    a region landmark from step-1 data if present) via a `classify…` regex mirroring
    `PERSON_IDENTITY_QUERY_RE`/the directions matcher, EXCLUDING `PERSON_DEFER_RE` +
    `LEADERSHIP_SECRET_RE` + `NOT_PLACE_DESCRIPTION_RE` matches;
  - calls the new pure resolver (below), returns `{ mode:'common_lore', body }` on a hit, or `null`
    (→ existing deflection / PW-3 pickup).
- **New pure resolver** — either extend `engine/world/placeQuery.js` with an exported
  `resolvePlaceFactForNode(world, nodeId, query)` (preferred — keeps one source of place truth) OR a
  small new `engine/world/commonKnowledge.js` that composes `placeQuery` + region seed data. **Pure,
  render-free, `null` on no grounded fact** — the `placeQuery`/`personQuery` contract exactly.
- **`engine/npc/dialogue.js` render helper** — a `renderCommonLoreNpc(npc, fact)` mirroring
  `renderPlaceFactNpc`/`renderPersonIdentityNpc` (manner-styled, no invention). The body is CONTENT;
  the voice layer must not replace it (same rule as `commonBody`).
- **Outcome plumbing** — `'common_lore'` rides the existing `commonBody` channel out of `askNpc`
  (`dialogue.js:784`, `outcome.commonBody` at `:924`). Add `'common_lore'` to the narration mode
  switch in `dialogueAskNarration` (`playloop.js:5658`) so it renders `commonBody` like the other
  common modes (grep the switch for how `'self'`/`'place'`/`'directions'` are handled and mirror).
- **CLASSIC_MODES / memory** — decide whether `'common_lore'` mints an NPC memory. Recommend **NO**
  (it's a pleasantry-grade public fact, like `'directions'`, which is excluded) — so **do not** add
  it to `CLASSIC_MODES` (`dialogue.js:886`). Confirm the beat/mechanics line still renders.

### Invariants (must hold)
- **No new world state minted.** PW-5 is read-only: `commonKnowledgeAnswer` returns a body; **no
  `applyDeltas`, no rumor mint, no claim mint.** (Contrast PW-3.) This is the core simplicity.
- **`worldHash` unchanged by a common_lore answer.** Because nothing mutates, replay hash is
  trivially stable. Add an assertion in the determinism test (below).
- **One source of truth.** Neighboring-node lore MUST reuse `placeQuery` resolvers; do not copy fact
  logic. Region seed facts (if any) read the generator's data, not a hand-copied duplicate.
- **§0 / earned-knowledge law.** Whitelist to public/event/geography/history-below-§0. Every path that
  could reach motive/secret/allegiance/cosmology returns `null` (reuse the three exclusion REs). No
  fabrication: resolver `null` → deflect.
- **Precedence.** current-node place-fact and present-person identity still win over the bank; the
  bank wins over the shrug and over PW-3 pickup (automatic, since a hit ≠ `deflected`). Do NOT modify
  `tryPickUpRumor` (`playloop.js:5532`).
- **Reputation sink untouched.** No reference to `playerReputation` / `world.timeline`-as-reputation.

### Falsifiers (the packet is done when these all hold; make them tests)
- **F1 (the fix):** in the slice (seed `'aldermere'`), stand in one settlement, ask a local "tell me
  about `<neighboring settlement>`" → they answer that place's grounded founding/history (NOT a bare
  bearing, NOT a shrug). Live receipt in the report.
- **F2 (honest decline):** ask about a place/lord/event canon never authored → deflection, **no
  invented name/date** (assert against `findInventedProperNoun`/`findInventedFactClaim`).
- **F3 (§0 wall):** ask "who does `<leader>` really serve / what's the cult" → still deferred
  (deflection), the bank never classifies it.
- **F4 (precedence):** ask about the CURRENT node's founding → still answered by the existing
  `placeQuery` path (`mode:'place'`/founding), unchanged — the bank does not intercept node-local.
- **F5 (hearsay precedence):** an ask that both the bank AND a latent rumor seed could answer →
  the bank (firsthand common knowledge) wins; rumor pickup does not fire. (If no bank fact exists,
  PW-3 pickup still fires — assert both directions.)
- **F-DET (determinism):** same world + same ask → byte-identical answer; `worldHash` before == after
  a common_lore turn.
- **F-REP:** grep the diff — zero new references to `playerReputation` or reputation re-derivation.

### U-numbers needed
Highest existing test file at HEAD is **U610**; PACKETS has claimed up through **U617**. **PW-5 starts
at U618.** Suggested allocation (confirm free via `scripts/next-test-number.sh U 4`):
- **U618** — `U618.commonLoreNeighborNode` — F1 + F4 (neighboring-node lore answers; current-node
  path unchanged).
- **U619** — `U619.commonLoreHonestDecline` — F2 + F3 (ungrounded → decline, no invention; §0 wall).
- **U620** — `U620.commonLorePrecedence` — F5 (bank beats rumor pickup; pickup still fires on true
  miss) + the mode/beat plumbing.
- **U621** — `U621.commonLoreDeterminism` — F-DET (`worldHash` stable; pure/replayable). Fold F-REP
  as a grep-style assertion here or in U618.

### Determinism plan
Trivial by design: **PW-5 mutates nothing.** The resolver is pure (`world` in, `{mode,body}|null`
out), the classifier is regex, node selection is deterministic (roster order / id order for ties).
No `rng` call, no `applyDeltas`, no timeline event. `worldHash` is unaffected; U19/U21/U22/U27/U30
remain green untouched. U621 pins hash-equality across a common_lore turn as insurance. (If the
implementer finds they *must* record something for replay — they should not — that would be a scope
error; escalate before adding any mutation.)

### Out of scope (explicitly)
- **No new authored lore.** If region-level seed facts don't already exist as data (step-1 grep),
  region-landmark/polity answers are OUT — ship the neighboring-node-lore path alone and note the gap.
- **No rumor/claim minting**, no change to `tryPickUpRumor`, `claims.js`, or `surfaceRumorsForTopic`.
- **No reputation/recognition** ("NPC knows what you did") — that's the `playerReputation` sink's job;
  a separate packet if wanted.
- **No LLM authority.** The bank is deterministic canon; the LLM voice only *styles* the delivery and
  stays under the existing invention validators.
- **No WORLD_VERSION / schema bump** (nothing persisted changes).
- **No new NPC-motive / secret / allegiance surface** — those stay deferred (Tier-3/4).
- **PW-6 hygiene** (prototype disposal, RUMOR_LAYER.md:144) is its own packet — not here.

---

## Evidence index (file:line)

- `askNpc` + miss gate — `engine/npc/dialogue.js:662`, `:766`
- claim path — `dialogue.js:759` (`findClaimForText`), `:775`, `:943`, `:971`; `engine/claims.js` (whole)
- `commonKnowledgeAnswer` classifier — `dialogue.js:224`; place resolver branch `:402`; person branch `:418`; place-blurb catch-all `:438`; final `null`→deflect `:785`
- `placeQuery` slots — `engine/world/placeQuery.js:351-356`, resolver `:376`
- `personQuery` (Tier-1/4 for people, defer guard) — `engine/world/personQuery.js:96` (`PERSON_DEFER_RE`), `:163` (`classifyPersonQuery`), `:208` (`resolvePersonFact`), `:30-31` (§0 header)
- PW-3 hint (pure read) — `dialogue.js:1304` (`surfaceRumorsForTopic`), `:1292` (`rumorMatchesTopic`), `:1323-1357` (pick-up path)
- PW-3 mint (reducer) — `engine/playloop.js:1444` (call), `:5532` (`tryPickUpRumor`), `:5538` (deflected-only gate), `:5554` (budget=3), `:5564` (deterministic id), `:5606` (`mintRumor` delta)
- narration sinks — `playloop.js:5658` (`dialogueAskNarration`), `:5830-5855` (bare-deflection pools), `:5865` (`rumorPickupNarration`)
- law binding — `docs/LAW_OF_EARNED_KNOWLEDGE.md:36-71` (tiers), `:79-95` (engine audit table); validators U142/U212/U223; narrator net `isInfoSeekingText` (`playloop.js:1328` etc.); NPC-voice deflect prompt `server/npcVoicePrompt.js:18`
- reputation read-sink (do not fork) — `engine/newspaper/lastingWord.js:187` (`playerReputation`)
- contract rows — `docs/briefs/PROSE_TO_WORLD_CONTRACT.md:249` (PW-5), `:265` (order)
