# Post-Lane Packets — the runway after W1 / W2

*Specced 2026-06-24 (Homebase). The buildable queue for after the two active lanes
("Light Up the World" W1 + "Make Every Turn Honest" W2) land. Two collision-safe top-level
lanes; the heavy one (Morality) has an internal parallel data strand. Source designs:
`docs/MORALITY_SYSTEM.md` (M0–M11, done-whens already written) + `docs/ONE_MAP.md` (map M1–M5).*

---

## TL;DR — the lane map

| Lane | Theme | Worker | Surface | Collision class |
|---|---|---|---|---|
| **D — The Dark Path** | Morality M4–M11 (the moral universe) | Codex | `engine/` hot files | **Serial** (successor to W2 on playloop) |
| **D-DATA** (inside D) | Pantheon roster / signs / rites / tables | Sonnet | one **new** data file | **Parallel** (new file — startable now) |
| **N — The Notebook** | UI redo + map beauty pass | Sonnet / design | `public/` only | **Parallel** (never touches `engine/`) |

**The concurrency headline:** *two of these can start right now, in parallel with W1/W2* —
**D-DATA** (pantheon authoring, a new file) and **all of Lane N** (`public/` only). Only the
**Dark Path mechanics spine (D-1…)** has to wait for W2 to clear the engine hot files, because
morality lives in the same `playloop.js` / `effectsCore.js` / `state.js` W2 owns.

---

## How this slots onto W1 / W2

- **Lane D is the successor to W2.** W2's last packet (W2·3) already builds the **M2 reputation
  piece** (deeds mint rumors that travel + towns withhold help). So after W2 lands, **Morality M2
  is essentially complete and Lane D opens at M4.** (If W2·3 didn't reach *faction-disposition-from-
  deeds*, fold that half-day into D-1.) Same Codex worker can roll straight from W2·3 into D-1.
- **Lane D inherits W1's rumor read-API and Homebase's narration seam.** M6 (heat) and M8 (signs)
  ride the same two seams W2·3 already negotiated — no new contract, just more consumers.
- **Lane N is collision-free with everything.** It's `public/` view code; it can run start-to-finish
  alongside W1, W2, and Lane D without ever touching a contended file.

---

## LANE D — The Dark Path (Morality M4 → M11)  ·  Codex, serial engine

> The moral universe from `docs/MORALITY_SYSTEM.md`: deeds make the seven-axis soul → the soul draws
> the gods → the gods speak in signs → the wise read them → rites choose a god on purpose → and above
> all of it, the one grace no god can grant: a friend. **The Camera Rule governs every packet** — the
> engine adjudicates any atrocity, never *serves* one; prose stays full-craft, the cost is the world.

**State is mostly already there.** M0 pre-provisioned `party[i].morality = {corruption, virtue,
locked, heat, patrons{}, lastDeedT, axes(7+7)}` + `world.deeds`. **No WORLD_VERSION bump for M4/M5/M6**
(they read existing fields). New fields appear only at M7 (patron standing detail) / M10 (rites) — those
**route to Homebase** for a single sequenced bump. Determinism is non-negotiable: deeds detected from the
fiction, LLM only narrates; `worldHash`/U21 stay green.

**Fence — Lane D OWNS:** `engine/playloop.js` (`tryDarkDeed`/`applyDeedCharges`), `engine/effectsCore.js`
(morality delta kinds), `engine/resolve.js` + `engine/spell/` + `engine/magic/` (capability gating),
`engine/worldTick.js` (heat/faction), `engine/csl/` deeds ledger, `engine/npc/` trust+memory hooks,
`engine/morality/*` (new modules), the morality threads in `composer.js`/`sceneDirector.js`.
**NEVER touches:** W1's files (`world/*Query.js`, `server/rag/*`, `claims.js`, `rumor/*` internals — it
*reads* the rumor API, doesn't edit it), and Homebase's (`state.js`/WORLD_VERSION, `llmAdapter`
buildSystemPrompt/validator, `narratorContext`). New state + narration go up as seam handoffs.

### D-DATA — author the pantheon (parallel, Sonnet, START NOW)
The "I draft, Tim cuts" job from MORALITY_SYSTEM.md §"next step". A **new data module**
(`engine/morality/pantheon.js`) + a grimoire draft: the **7 sin-gods, 7 virtue-gods, the Creator**
(world-native names per the bestiary instinct), **deed→axis mappings**, each god's **sign-vocabulary**,
**rite definitions** (sigils/vigils), and the **betrayal/whim tables**. Pure data, deterministic, no
logic. Collision-safe (a brand-new file) → can be authored in parallel with W1/W2 today. **Feeds D-4/5/7.**
**Done-when:** a reviewed data module Tim has trimmed; a U-test that the roster is well-formed (14 gods +
Creator, every axis covered, every sign maps to a god). *Long pole — start it first.*

### D-1 = M4 · Corruption → capability
Forbidden abilities/spells unlock and **scale with corruption** (gated in spell/resolve); light abilities
+ the help systems gate on **virtue + faction disposition**. The mechanical teeth of the asymmetry: dark =
power now, light = support that compounds. Reconcile with the existing ~140-spell list — **tag forbidden,
don't duplicate**. **Done-when:** the dark mage can do what the clean one cannot, and vice versa; tests +
determinism green.

### D-2 = M5 · Redemption + the final line
Atonement deeds recover disposition/trust **slowly**, scar remembered (NPCs/rumor outlive the deed); a
corruption cap **or** one unforgivable act sets `locked`, closing the light path **by your own hand**.
**Done-when:** an atonement arc measurably claws standing back; crossing the final line is real and
irreversible. (Depends on D-1's gating + M2's trust/disposition organs.)

### D-3 = M6 · Crime & detection ("you'd better be good at it")
`heat` accrues per atrocity (severity × witnesses × inverse-cleanliness via WITS/deception), **hidden**
(no meter), decays slowly with distance/time, and at thresholds the world investigates — questions,
evidence, agents pull the thread — **through the rumor + faction systems** (rides W1's read-API). **Done-
when:** a sloppy killer gets found out; a careful one buys time; no heat number ever shown.

### D-4 = M7 · Divine patrons + the gaze  *(needs D-DATA)*
The three tiers as data (from D-DATA). Your seven-axis soul draws the **gaze** of the gods you resemble —
**no sacrifice menus**. Light = **covenant** (reliable aid when desperate); evil = **appetite** (a
betrayal/whim table that curdles "help" into poison unless wholly committed); the transyuggothian gift is
the **high-variance seeded roll**. **Done-when:** a faithful light character is saved at the brink; a dark
dabbler is burned by a god he didn't fully serve. **Seam:** any new patron-standing field → Homebase bump.

### D-5 = M8 · Manifest karma — the sign layer  *(narration seam)*
Each god's **trademark signs bloom in the narration** when its gaze crosses a threshold (deterministic,
seeded — the engine picks the god, the AI only *renders* the sign). Everyone feels the effect; reading the
**meaning** gates on WITS/lore. Evil signs are true-but-**bait**; gifted power reads as an omen; signs
quiet toward the Creator. **This is the readout that replaces the meter — verify "no meter" still holds.**
**Done-when:** a dark character sees coins/crows/compelled strangers and a wise PC/NPC can name the god;
live screenshots. **Seam:** the sign→prose injection is a *context function* Lane D hands to Homebase to
render (the `describeInteriorLayout` pattern). Depends on D-4.

### D-6 = M9 · The human Cassandra
A wise NPC (witch/priest/augur/friend) who reads your soul and says the **hard truth, once, plainly** — and
can be waved off. The Creator's quiet register; heeding-vs-ignoring is the drama. Rides M2's NPC layer +
D-5's reading. **Done-when:** a falling player gets warned by a person and may ignore them; the two paths
diverge. Depends on D-5.

### D-7 = M10 · Dedication rites  *(needs D-DATA)*
Learned, gated rites that direct/intensify the gaze: **sigils** (dark shortcut; botched / half-committed →
ruin), **vigils** (light; costly; the vigil *works* — Quixote vindicated), and the **un-petitionable
Creator** (act with no lust of result; you cannot farm it). The commitment ladder (drift → dedicate → bind)
changes patron treachery. **Done-when:** a consecrated act counts more than an incidental one; a botched
dark rite backfires; a pure vigil is answered and a vain one is not. **Seam:** rite/dedication state →
Homebase bump. Depends on D-4.

### D-8 = M11 · The keystone — the friend
The companion system gets its moral spine: dark → **thralls** (bound, bought, betray the instant the math
turns); light → **friends** (choose you, come when called, **losable forever** — betrayal does not
respawn). Light compounds through relationship; a friend is the renewable Cassandra. **Done-when:** a light
player has a friend who returns in need and a dark player cannot keep one; losing a friend is permanent and
felt. (Depends on M2 + D-2.)

**Sequencing:** D-DATA (now) ∥ … then D-1 → D-2 → D-3 (the consequence floor) → D-4 → D-5 → D-6 → D-7 → D-8
(the divine/social layer). D-1…D-3 are independent of D-DATA; D-4 onward consume it. Each milestone is
independently playtested per PLAYTEST_PROTOCOL and checked against the Camera Rule.

---

## LANE N — The Notebook (UI redo + map beauty)  ·  Sonnet / design, parallel `public/`

> The visual layer neither engine lane touches. Mostly the **UI redo**; the map is already ~90% built
> (`ONE_MAP.md`: M1–M4 shipped, M5 first pass shipped), so its remainder is a **polish iteration**, not a
> build. Live surface today: `public/v1.js` (~2.9k lines), `public/styles.css`, `public/ui/*`,
> `public/panels/*`, `public/map/*`.

**Fence — Lane N OWNS:** `public/styles.css`, `public/ui/*`, `public/panels/*`, `public/map/*`, and the
**view layer of** `public/v1.js`. **NEVER touches** `engine/*` or `server/*` (it renders state; it never
changes adjudication). No WORLD_VERSION risk, revertable by file.

### NB-1 — UI redo → the notebook aesthetic  ⚠ reference blocker
Redo the vanilla v1 chrome/panels/typography to the **notebook aesthetic** (supersedes the dark-grimoire
`DESIGN.md`). **BLOCKER:** the locked reference card (`prototypes/character-card`) is now **empty** except
`.DS_Store` + `node_modules` — the source is gone. **Done-when (gate 0):** Tim re-supplies or points to the
locked reference. **Then:** apply it to the play screen, panels, chargen, and print views. **Done-when:**
the live v1 reads as the notebook reference on a screenshot diff; no engine calls changed; responsive +
dark-mode checked. *(Confirm scope with Tim — `project_ui_notebook_redo` flags a conflict with the older
DESIGN.md.)*

### NB-2 — Map M5 beauty iteration
The `ONE_MAP.md` M5 punch-list, already specced: **forest density, calligraphic label halos, parchment
grain, town glyphs, near-band ink consistency** — the continuously-zooming Lord-of-the-Rings map that
registers only what you've witnessed (the anti-Marauder's-Map). Owns `public/map/oneMap.js` +
`worldSpace.js`. **Done-when:** the five punch-list items land; live screenshots at world/region/settlement/
street bands; embedding stays pure+seeded (U135 green). Small, self-contained.

### NB-3 — Found maps (cartography as loot)  · FUTURE, cross-lane
A chart you acquire inks regions your boots never walked (and may be stale/wrong). **Not pure UI** — it
touches loot + discovery (`engine/`) and the map render (`public/`), so it's a **deferred cross-lane**
packet, not part of Lane N's parallel-safe run. Park until the moral/UI lanes clear.

---

## Seams Homebase owns (neither lane edits)

1. **WORLD_VERSION / `state.js`.** M4–M6 need **no bump** (M0 pre-provisioned the fields). M7 (patron
   standing) and M10 (rites/dedication) propose new fields → Homebase collects and sequences **one** bump
   (safe defaults in `ensureWorld`, invariants, hash projection, version-string test fixups).
2. **The narration layer** (`llmAdapter` buildSystemPrompt + validator, `narratorContext`). M8's sign
   layer and M9's Cassandra hand Homebase **pure context functions**; Homebase renders them into the
   prompt — taste-critical narration stays single-minded.
3. **The rumor read-API** (defined for W1·3 / W2·3): M6 (heat→investigation) is one more consumer. No new
   contract.

## Worker routing + concurrency

- **Codex** → Lane D mechanics spine (deep engine, determinism, hot files).
- **Sonnet** → D-DATA (pantheon authoring) **and** Lane N (UI/map view code) — both additive, both
  parallel-safe, **both startable today** alongside W1/W2.
- **Homebase** → the three seams above + the merge into `v2-polish`; sequences the lone WORLD_VERSION bump
  once M7/M10 field proposals are in; keeps the Camera-Rule check on every Dark Path milestone.

**Bottom line:** the only thing gated on W2 finishing is the Dark Path *mechanics*. The pantheon draft and
the entire Notebook track can begin immediately, so the post-lane runway is already two-thirds parallel.
