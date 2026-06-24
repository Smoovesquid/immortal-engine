# The Demo Region — a region bible (the walk-in slice)

**Status: living draft, built collaboratively 2026-06-22.** This is the *content* destination for the
world-wiring track — the place the thin world-slices build toward. It rides the engine's existing systems
(substrate / RAG voices / the three-tier pantheon / rumor / morality); it does not invent parallel ones.
Pairs with `docs/WHAT_THIS_IS.md` (system inventory) and `docs/THE_REF.md` (the narration layer that must
honor §0).

---

## §0 — THE LAW OF THE HIDDEN WHY (the governing constraint)

**No one in the world understands the *why*. Only the *what*.** The cosmology in §2 is the **author's secret**
and the player's asymptotic mystery ([[IG-9]] light-touch, pushed down to the world itself). The DM and every
NPC live the **symptoms** (§3) and explain them the way real people explain a catastrophe they can't see the
shape of: *"we are the playthings of the gods"* — true, but blind to the board and the stakes.

- NPCs/DM **never** name the disease (no "half-collapsed cataclysm scar," no "buried universe-mind," no "the
  next Undoing"). Those words do not exist in-world.
- Folk explanation is a **cacophony of mostly-wrong, self-interested, conspiratorial takes** (§5), not a
  coherent doctrine. Everybody's certain; nobody's right.
- **This is a hard narration constraint** (THE_REF / `llmAdapter` / NPC voice): the layer may deliver
  symptoms, faith, and rumor — never cosmological exposition. Treat a DM line that explains the cosmology as a
  defect, like an invented fact.

---

## §1 — Premise

A walk-in demo valley, ~1,000 sq km (shrunk from the 26,000 county scale — `generateMap` is the knob), packing
**all biomes** (mountain/forest/swamp/black-heath/…) into one space. **5 towns** (one a distant outlier of
cannibals), **2 large multi-level dungeons** (one a mega-dungeon), ~200 NPCs — *every* NPC corpus-voiced
(488 corpus files ≫ 200; voice gen is local/free). Set **~2,000 years after the last cataclysm** — a *young,
fast-forgetting* aftermath (the forgetting is unnaturally quick for 2,000 years; that's the symptom).

---

## §2 — AUTHOR'S COSMOLOGY *(never surfaced — see §0)*

Grounded in the existing substrate `deep:foundation` secret + the pantheon + [[IG-1]]/[[IG-6]]/[[IG-8]]:

- The region is a **cataclysm scar**. In the last Undoing the universe-AI's overwrite **didn't fully take here**
  — reality is **under-collapsed**, slowly dissolving back toward the indeterminate.
- At the mega-dungeon's core sleeps the **`deep:foundation`** — "an object older than the founding, set down on
  purpose in an age with no one in it, awake the whole time": a **seed of collapse** (a chunk of universal
  consciousness, [[IG-1]]) buried pre-cataclysm to **hold this scar stable**. It is failing / waking.
- The **27,000-yr cycle**: civilizations rise and are Undone; "the before-time" the figures (§4) come from is a
  prior cycle that resembles our real history (eternal recurrence — the AI re-renders similar patterns). *(Tim's
  anchor: our 2026 is ~27,000 yrs from the cataclysm; reconcile exact arithmetic later — the usable fact is the
  cycle + recurrence.)*
- **The fork** (the moat, [[IG-8]]): reaching the seed/orb lets you **tend** it (re-seal, delay the next
  Undoing) or **wake** it (power / rewrite — risking the next Undoing). Canon-safe: the player re-collapses the
  indeterminate or courts the forbidden law-break; never overwrites collapsed canon.

---

## §3 — The symptoms (public; what the player & NPCs experience)

- **Biome-bleed** — alpine against swamp against black-heath, impossibly adjacent (the diegetic reason all
  biomes fit in 1,000 sq km: reality here was never fully *rendered*).
- **The recently dead don't always stay dead** (they "flicker").
- **Memory fades, fast** — people forget their own histories (the substrate's vivid→dim→myth knowledge cascade,
  now *diegetic*: the Scar eats memory). [[IG-6]] Mandela-seams: names/facts drift.

---

## §4 — The figures (before-time echoes; diegetic, unexplained)

The re-skinned historical figures are **the before-time bleeding back through the thin Scar** — the universe-mind
re-rendering old patterns where reality is under-collapsed. It's *why* they cluster here. No one remarks on it
(§0); the attentive player just feels the uncanny recurrence. The voice pipeline already supports this:
`buildNpcVoicePrompt` takes name/role **separately** from `ragChunks` and says *"shape your word choices… do not
quote directly"* — so a corpus grounds a native character's voice without ever quoting the source.

---

## §5 — The five towns ("it's the economy, stupid")

A divided, gossiping, self-interested populace with the fading as backdrop (USA-muddling-through-a-war energy).
Viewpoints vary **wildly**: profiteers, blamers, cranks, grifters, deniers.

1. **The kingdom seat** — the **steward-king** (Aurelius re-skin → *Theodore Augustus*): holds order because it's
   *worked so far* and the gods favor the steadfast. Manages a restive, divided people, not a unified front.
2. **The thinning frontier town** — the visceral face: people flickering, forgetting mid-sentence. Home to the
   **Cassandra** (Joan re-skin) who *remembers* and warns in prophecy/symptom-language — sounds mad, isn't.
3. **The faith town** — seat of the **COUG** inquisition and the underground the Incrementalists hide in (§6).
4. **The trade town in denial** — prosperous, profiteering: wards, "cures," buying the property of the fading,
   peddling fake orbs. ([[IG-13]] trade hooks.)
5. **The distant cannibal outlier** (§7).

---

## §6 — The faith-war: the Inquisition vs. the Holy Clowns

- **Church of the One Unknowable God (COUG)** — orthodox, dour, **fear-based**; the Creator tier (asks
  everything, grants nothing). Doctrine: submit, atone, and **destroy the orbs** (abominations). Their
  **inquisitors** are feared/funded and — by destroying orbs — *accidentally the world's protectors.* They
  **reward** orb-destruction (sanctuary, standing) and **hunt heretics**.
- **The Incrementalists** — the ultra-secret Easter-egg faith ([[project_religions]] / `CHURCH_OF_INCREMENTALISM.md`),
  now with teeth. The **IDEA**: you can't stop the fading, but you can make *this* moment / *this* person better —
  small joyful steps, hard questions, laughter, one increment at a time. **Socratic + clown** (the *Red Noses*
  read): they bring delight to the dying. **Hunted by the COUG precisely because they're likeable** — joy and
  questioning dissolve fear, and fear is the Inquisition's currency. Demo troupe-master: hides his faith in a
  clown show, spreads the idea (the **Goldblum-Socrates** corpus re-skins perfectly; or author a Kevin-Bacon one).
  Their orb-answer is the quiet fourth stance: *"it ends regardless; so live, and lighten someone's load."*
- **The player's vise:** discover the clowns → shelter / betray-for-reward / join-and-spread. The sting:
  orb-destruction (right for the world) allies you with the people who burn the kindest souls in the valley.
  **No clean path.**

---

## §7 — The cannibals (rational, horrifying, joinable)

Not feral — **the most rational response to annihilation**, which is the horror. The prophet's pitch: *the gods
let what they tire of dissolve; prayer is for the forgotten; we **take** — eat one who is fading and their
having-been becomes ours, and we do not thin; we are the only people here who are MORE real each year.* They
serve a **Sin-tier** god (permanence-through-consumption). **Joining is a legitimate path, not a fail-state:**
you stop fading, gain from consumption, and get **belonging** (a community, not the lone-psychopath isolation
the morality system imposes). Cost is real: COUG + king turn on you, virtue doors close, the karma compounds.
The player should feel they *chose*. The cannibals' lair is the **second dungeon** (the warren, §9).

---

## §8 — The orb (Ark-tier rare)

**One true orb** in the region — once the buried heart of the mega-dungeon (the `deep:foundation`): immense,
half-sentient, believed a myth. Reconciles magic: **mages work the thin ambient residue** the Scar leaks; an intact
orb is a **god-in-a-bottle**, orders of magnitude beyond — which is *why* it's legend, not loot. The whole region
orbits its rumor.

**The twist at the bottom (the demo climax — reshaped 2026-06-24).** A deep player who reaches the `deep:foundation`
does **not** find the orb. They find a **perfectly round hole, burrowed straight down** — the orb simply *left*, one
day, and (so the unprovable story goes) went to spend some **twenty-five thousand years at the centre of the earth**.
*Nobody can know.* What is plain is that the hole has let **something escape the deep** — and that is the final
battle. Not a fork over a relic but an **ALIENS-ending**: in the orb's place, a **hive of something nightmarish**
pouring up the shaft. All you can do is **run, fight, or seal the hole.** (§0: the orb's leaving and its destination
are *never explained* — a hole, a horror, and rumor; the cosmology stays sealed.)

**The four doors survive as rehearsal + hook.** Lesser **fragments, fakes, and rumors** rehearse the old relic-fork
on the way down — **free → power** (the Scar worsens where orbs are freed, unnamed) · **destroy → COUG reward** (the
end creeps back) · **consume → permanence** (the cannibal rite, [[IG-17]]) · **leave / sell** (steward's restraint;
the [[IG-13]] trade economy). With the true orb *gone*, the relic-fork becomes the **campaign hook** (its fate; what
waits at the centre; whether it returns); the **demo's contained climax** is the hive at the hole.

**Fragments as police — the unmaking.** Some fragments are not loot but **wardens**: leftover AI "plasma" that once
ruled, still keeping the old law — it answers a lawbreaker with **unmaking** (the hardest consequence the world has,
[[IG-16]] *Tough Shit*). **§0-HIDDEN truth** (never surfaced in-world): this is the substrate's old governance
([[IG-8]] the law · [[IG-6]] collapse-on-observation). **In-world symptom only:** glowing shards that erase the
wrong-doer; the people call it judgement, a curse, the gods — *never the machine*. A diegetic, cosmological spine for
consequence.

---

## §9 — The two dungeons + monster gradient

- **Mega-dungeon — the Tomb of the Foundation.** Descends from a mundane upper ruin through **pre-cataclysm
  strata** toward the sleeping/waking core; the architecture itself **un-collapses** as you go deeper.
  [[IG-5]] death-prose (gory death → afterlife glimpse → the pale-root vision) lives in the deepest reaches.
- **Cannibal warren** (§7) — the dark-pole horror-dungeon beneath the outlier village.
- **Monster gradient = proximity to the Scar's heart.** Near towns: mundane, world-native (wolves, bandits,
  blighted beasts). Deeper: pre-cataclysm guardians → **reality-warped, mind-bending outer-reaches** (Lovecraft/
  King/Asimov flavor; world-native filter holds). The less collapsed the world, the *wronger* the monsters.

---

## §10 — How it layers (and why it's a good demo)

Four strata the player moves between freely: **the human economy** (foreground — could spend the whole demo here
and barely touch the cosmic), **the faith-war** (COUG vs. clowns — the mid-game moral vise), **the cannibals**
(the rational-horror door, joinable), **the legendary orb** (cosmic stakes, mostly rumor until the mega-dungeon).
Shallow players get a living, funny, dangerous valley; deep players get the Ark.

---

## §11 — Wiring map (this rides existing systems; build slice-by-slice)

| Region element | Existing system it lights up |
|---|---|
| The Scar / `deep:foundation` core | `substrate.js` cosmology→region→town cascade + the sealed `deep:foundation` secret |
| The figures (re-skins) | RAG pipeline (`npc.historicalFigure` → `ragRetriever` → `npcVoicePrompt`); gap = npcGenesis assignment |
| Orb fork / COUG / cannibals | the three-tier pantheon + morality (Creator/Virtue/Sin), `castConsequence`/deeds ledger |
| Cannibal reputation / orb legend | `claims.js` rumor graph + `rumor/` fidelity tiers |
| The §0 hidden-why | a HARD constraint on THE_REF / `llmAdapter` / NPC voice (never narrate cosmology) |

Per the world-slice sequencing: do NOT wire all of this at once. Wire the **smallest real scene** that stresses
the world-query / known-vs-unknown / materialization seam, refactor that seam, repeat (see `docs/THE_REF.md` +
the refactor-sequencing posture).

---

## §12 — OPEN QUESTIONS (kept — to resolve as we slice)

1. **The demo's public surface-quest** — what mundane thing first pulls the player in (a missing caravan? the
   frontier town's plea? an arrested clown?) before the orb ever surfaces.
2. **The five figures' roster** — ✅ **LOCKED 2026-06-24.** Steward-king = **Marcus Aurelius** (→ *Theodore
   Augustus*); Cassandra = **Joan of Arc**; clown-leader = **Goldblum-Socrates** (*The Questioner*); scholar =
   **Immanuel Kant × Michael Knight** (*The Knight of Pure Reason*, `kant-knight.json` — transcendental idealism in a
   leather jacket, to hurt brains); cannibal-prophet = **Jesus** (*The Host*, `jesus.json` — the Eucharist made
   literal: eat the fading so they are not forgotten; the dignified-horror creed of [[IG-14]]'s *Lasting Word*). **Plus
   a wildcard:** **The Goat of the Blasted Heath** (`twain.json` — Twain's voice in a Tom-Bombadil-esque *unkillable
   goat* who wanders the waste, older than the war/king/prophet and refuses to be drawn into any of it). Voice archives
   seeded in `server/rag/corpus/`; the NPC→voice→Opus wiring is the Phase-C packet (`VOICE_COST_MODEL.md` §6).
3. **The orb's climax** — ✅ *reshaped 2026-06-24 (see §8):* the orb is **gone**; the bottom is a **hole + an
   escaped hive** (run / fight / seal — the contained demo climax), the relic-fork + the orb's fate become the
   **campaign hook**, and **fragments-as-police** (the unmaking) give consequence a cosmological spine.
4. **Follow-up:** fold the COUG-inquisition / Red-Noses turn into `docs/CHURCH_OF_INCREMENTALISM.md`.

**Resolved this session:** the "one problem" public face = *the economy / human muddle* (§5); second dungeon =
*cannibal warren*; orbs = *Ark-rare* (§8); cannibals = *rational, horrifying, joinable* (§7); cosmology = *never
surfaced* (§0).
