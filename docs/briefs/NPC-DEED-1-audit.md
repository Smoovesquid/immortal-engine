# NPC-DEED-1 — audit (report-first, code deferred)

*Audited 2026-07-06 against `v2-polish` HEAD `bf6e8908`. Grep-verified; every claim cites
file:line. Packet: `docs/PACKETS.md` NPC-DEED-1. Governing docs: `docs/MORAL_PHYSICS.md` §7 Arc A
("the world grinds Carl"), `docs/REPUTATION_UNIFICATION.md` (the sink ruling).*

## Verdict up front

**NO — the existing substrate does NOT already carry NPC misdeeds into travelling reputation, and
the fix is NOT a one-call/few-line wiring through an existing organ.** The player-only assumption
is load-bearing in three separate places, not one convention that can be flipped at a single call
site. Per the packet's conditional-code clause, **this is audit-only — no code shipped.** The
smallest honest packet shape is spec'd below (§3), sized for a follow-on dispatch.

---

## 1. Does any existing substrate already carry NPC misdeeds into travelling reputation?

**No, on every substrate checked.**

**`mintClaim` / `propagateClaims` (`engine/claims.js`).** `mintClaim`'s `subject` field is a
free-text *event* key (e.g. `"gallows_watch_fall"`), not an actor identity — a claim is "what an
NPC believes happened," not "who did it." Grepping the whole engine for callers of `mintClaim`
turns up **exactly one call site in non-test code**, `engine/playloop.js:152`, a single scripted
mint for "the Lingerer's heretic claim" (unrelated to deeds). **`mintClaim` is never called from
the deed-recording path at all** — MP-1's "witness→rumor bridge" name suggests a general bridge,
but the actual landed mechanism (confirmed by reading `effectsCore.js`'s `recordDeed` handler,
`applyDeedCharges` in `playloop.js:8800`) writes straight to `world.deeds[]`, not through
`mintClaim`/`world.claims` at all. `world.claims` and the player-deed-reputation path are two
separate, still-unconverged systems (as `REPUTATION_UNIFICATION.md` §1 Layer 2 already documents:
"nearly dark," minted at one site, read at one site, neither of them deeds). So an NPC's misdeed
has no path into `claims` either, because *nothing's* misdeed goes through `claims` today except
one hand-authored lore claim.

**The rumor engine (`engine/rumor/rumorsReaching.js`).** This is the sole read-sink
(`REPUTATION_UNIFICATION.md` R2) and it is genuinely actor-agnostic **at the data level** — its
"player-deed rumors" block (lines 98–138) reads `deed.severity`, `deed.summary`, `deed.nodeId`,
`deed.t`, `deed.witnesses` from `world.deeds[]` and **never reads or filters on `deed.actorId`**.
Any deed entry clearing `DEED_GOSSIP_MIN` (20, `rumorsReaching.js:22`) becomes a synthesized rumor
regardless of whose id sits in the record. This is the one genuinely promising fact in the audit —
see §2.

But the *only consumer* of that rumor is `engine/npc/reputation.js`'s `notorietyReaching`, and its
own file header states the design intent explicitly: *"it surfaces **the player's own deeds**,
never cosmology"* (`reputation.js:11`). Its single consumer, `engine/npc/dialogue.js:468-480`,
renders the rumor as hard-coded second-person prose: *"I know **who you are**... word came ahead of
**you**"* / *"Oh — it's **you**. We heard."* This is grammatically baked to address whoever is
standing in front of the NPC as the culprit. Feeding an NPC-committed deed through this consumer
unchanged would have a townsperson accuse the *player* of Carl's crime — actively wrong, not a
graceful no-op.

**Faction disposition inputs (`deedFactionDeltas`, `engine/social/reactionTable.js:54-89`).** This
writes `factionRepDelta` ops into `world.reputation.factions[factionId]` — a **single flat scalar
per faction** (`ensureReputation`, `engine/state.js:1388-1396`; invariant at
`invariants.js:209-214`). There is no per-actor dimension in this store at all: it is architecturally
"how do factions see *the party*," not "how do factions see any given actor." There is no schema
slot to record "Aldermere's disposition toward Carl" distinct from "Aldermere's disposition toward
the player" — it would need a new keyspace, not a reused one.

**Carl's existing content (`engine/world/demoFigures.js:122-130`).** Carl is a hand-authored
`demoFigures` entry: `name`, `role`, `voiceCorpusId` (his manifesto RAG corpus), `personality`,
`nodeSelector`. That's it — no deed hook, no claim seed, no faction-disposition entry, nothing that
reads or writes reputation. **Nothing in the codebase grinds Carl today.** Arc A (§7) is vision, not
yet code.

## 2. If YES: the one-call wiring — n/a, but the near-miss is worth naming precisely

The honest nuance: `rumorsReaching`'s deed-read loop (Layer 5, the sink) is unfiltered on actor —
that half of the pipe would tolerate an NPC-sourced deed for free. The blocker is everything
*upstream* of the sink, in three separate places, none of which is a "flip one constant" fix:

1. **`recordDeed`'s escalation-ladder wiring is party-only by construction, not convention.**
   `effectsCore.js`'s `recordDeed` handler (`:212-262`) always resolves the acting entity via
   `resolvePlayerEntityId`/`findPlayerEntity` (`:1139-1152`), which search `world.party` and
   **fall back to `party[0]` (the player) when the id isn't found** — silent misattribution, not a
   no-op. `mutateEntity` (`:1154-1161`) does `party.findIndex(...)`; an NPC id simply isn't there.
2. **NPCs have no `morality` field at all.** `ensureMorality` is applied only inside the
   party-entity ensure path (`state.js:1029`); nothing calls it for `node.settlement.npcs` entries.
   `heatAccrual`/`escalationTier` (`engine/morality/escalation.js:108-233`) are themselves pure
   functions of `(deed, actor, ctx)` and don't care about entity *kind* — but there is no actor
   object to hand them for an NPC, because the schema never gave NPCs a `heat`/`corruption` home.
3. **`mutateNpc` (`effectsCore.js:1116-1132`) is scoped to the player's CURRENT node only** — it
   looks up `world.map.currentNodeId`, then that node's `settlement.npcs`. It structurally cannot
   reach an NPC standing at a different node — which is exactly Arc A's requirement ("**over N
   deterministic world-ticks**, [Carl's] deeds mint claims that propagate" — this has to accrue
   while the player is elsewhere, not only during a witnessed scene).

Grepping every `recordDeed` emitter confirms this is universal, not a one-off: all five call sites
(`playloop.js:6424`, `playloop.js:8815`, `castConsequence.js:159`, `castConsequence.js:179`,
`storyEngine.js:381-387`) either hard-code `actorId: 'party'` or omit it (same default). No test in
the U555–U585 range (the full MP-1..MP-5 suite) exercises a non-party actor. This is not "the
substrate almost does it" — the party-only assumption is load-bearing in the entity-mutation layer,
the schema, and the node-scoping, independently. **There is no genuine one-call wiring; the
conditional-code clause does not trigger.**

## 3. The smallest honest packet shape (spec, for a follow-on dispatch)

Additive-only; no `WORLD_VERSION` bump required (new optional fields default-safe under
`ensureWorld`/`ensureNpc`, same pattern as MP-2's `deed.tier`). Ranked by what Arc A's five
assertions (§7 a–e) actually need, cheapest first.

**a. Give NPCs a morality-lite field, node-agnostic.**
   `ensureNpc` (wherever NPCs are normalized — `decompression/decompress.js`,
   `combat/encounterSpawn.js`, `world/demoFigures.js`, `story/storyEngine.js` all currently stamp a
   bare NPC shape with no morality) gains a default `morality: { corruption: 0, heat: 0,
   lastDeedT: null }`, mirroring the party shape exactly so `escalationTier`/`heatAccrual` can be
   handed an NPC object without new branches in those pure functions. Additive; old saves default
   safely.

**b. A node-agnostic NPC mutator, parallel to `mutateEntity`, not a rewrite of `mutateNpc`.**
   `mutateNpc` must stay current-node-scoped (that's correct for its existing callers — trust
   deltas, secrets, knowledge — all scene-local reads). NPC-DEED-1 needs a *different* function:
   search `world.map.nodes[*].settlement.npcs` for the id (Carl's node, wherever the player is),
   splice the update there. This is a new helper in `effectsCore.js`, not a parallel *store* — it's
   a second entity-mutation path sitting beside `mutateEntity`/`mutateNpc`, same pattern as those
   two already coexisting. (REPUTATION_UNIFICATION forbids a parallel READ-sink, not a second
   internal mutator that still funnels into the one sink.)

**c. `recordDeed` accepts a real non-party `actorId` without silent fallback.**
   In `effectsCore.js`'s `recordDeed` handler, when `op.actorId` resolves to neither `'party'` nor a
   `world.party` member, look it up via the new NPC-anywhere mutator (b) instead of falling back to
   `party[0]`. Standing/heat snapshot (`moralityAtEntry`, currently party-only at batch entry,
   `:30-38`) needs an NPC branch alongside it so the same first-atrocity-can't-self-boost guard
   (MP-2's core invariant) holds for NPC actors too. `deed.actorId` already exists on the record
   (`:225`) and is already unvalidated by `invariants.js` (`:191-207` checks `kind`/`severity`/`tier`
   only) — so the record shape needs no schema change, only a real writer.

**d. An emitter for a witnessed NPC deed.** Two live call sites need this, per the packet's own
   framing: OCC-STORY-2's witnessed NPC burglary (wherever that resolves a burglar's action — likely
   a new branch near `applyDeedCharges`'s witness-detection, or a hook in the hostile-NPC-action
   resolution path) and a scripted Carl misdeed tick (an authored `recordDeed` call with
   `actorId: 'figure_carl'`, seeded on a schedule in `worldTick.js`, parallel to how `storyEngine.js`
   already scripts arc-resolution deeds). This is the one piece that's genuinely new content, not
   wiring — Arc A's "his deeds mint claims that propagate" needs *something* to author what Carl
   actually does, on what cadence, which is a design decision (how often, how witnessed, what
   severity) not an audit finding.

**e. `notorietyReaching`'s consumer needs a THIRD-person branch.** `dialogue.js:468-480`'s
   hard-coded second-person prose ("I know who *you* are") cannot be reused unchanged for
   reputation-about-someone-else. This needs either a parallel `notorietyReachingAbout(world,
   nodeId, subjectActorId)` read (mirroring §c's model, not forking the sink — same
   `rumorsReaching` call, just filtered post-read on `deedRef`'s embedded actor) plus new
   third-person prose lines ("Folk say Carl did..."), or — if MP-6's falsifier only needs *faction
   disposition* and *hunt-heat*, not a spoken NPC-gossip line — this piece can be **cut** and Arc A's
   surfacing satisfied by (c)+(d)+faction-delta alone. Recommend confirming against MP-6's exact
   assertions (below) before committing to build this piece; it's the most expensive item and may
   not be load-bearing for the falsifier.

**Invariants needed:** an `actorId` format check on `deeds[i]` (already-open field, add a
non-empty-string assertion); an NPC `morality.corruption`/`morality.heat` bounds check parallel to
the existing party one, scoped to whichever NPCs carry the field (optional, so absence is legal).

**U-numbers:** allocate via `scripts/next-test-number.sh U` at dispatch (next free is above U585 per
the range check I ran — confirm at dispatch time, a worker lane may have claimed higher numbers
since). Minimum coverage: an NPC deed reaches `rumorsReaching` at a neighbor node garbled by tier
(mirrors the packet's own suggested U590 shape); a determinism wall (byte-identical worldHash across
two replays with an NPC deed in the batch); a player-deed-behavior-unchanged regression (every
existing MP-1..MP-5 test stays green — NPC actor support must be strictly additive).

**`worldHash` impact:** additive field on NPC objects and on the deed record → shape change, so
`worldHash`/`.browser` need the new keys folded in (same treatment as MP-2's `deed.tier` addition,
which shipped with no `WORLD_VERSION` bump — this can follow the identical precedent).

**Can MP-6 (the Carl Witness Test) pass without this packet?** **No.** MP-6's five assertions
(`MORAL_PHYSICS.md` §7): (a) "the deed lands with the right witnesses" — needs (c)+(d); (b) "a claim
reaches node X by tick T" — needs (a)+(b)+(c) so Carl's deed can even enter `world.deeds` with heat
accrual attached to *him*, not the player; (c) "the stranger's opening disposition is lower than the
control run" — needs either the faction-delta path extended to accept an NPC-witnessed source (a
sub-item of (c)) or (e); (d) worldHash byte-identical — needs the shape additions in (a)+(c) to be
done cleanly; (e) "no numeric moral value ever appears in any player-facing string" — needs (e) if
a spoken line is added, otherwise trivially satisfied by construction if the arc stays silent
(faction/heat only, no dialogue). **Arc A cannot run at all today** — Carl has zero deed-recording
hook, so "over N world-ticks his deeds mint claims that propagate" has literally nothing to tick.
This packet (at minimum items a–d) is a genuine MP-6 prerequisite, matching the packet row's own
"LIKELY MP-6 PREREQUISITE" flag.

---

## Plain-English summary (for Tim)

**What was checked:** whether the game already has a way for something an NPC does — like Carl
being cruel to a villager while you're not even there — to become a rumor that follows Carl around
and turns the world against him, the same way it already works for things *you* do.

**What's actually true:** it doesn't, and the reason isn't a small oversight — it's baked into three
different places at once. Every "who did this?" record in the deed system defaults straight to "the
player," and NPCs don't even have the field that would track their own building reputation
(`morality.corruption`/`heat` in the code). One half of the pipe — the part that turns a recorded
deed into a rumor that reaches the next town — genuinely doesn't care who committed the deed. But
getting a deed *into* that pipe for an NPC, and having the world react to *that NPC* rather than
mistakenly blaming the player, needs real new plumbing in three spots plus some new authored content
(deciding how often and how visibly Carl actually does something bad).

**Why it matters:** the "Carl gets ground down by the world even though the player just watches"
test (MP-6) is the proof that the whole moral-physics system works — and it can't be built at all
right now, because Carl has no way to commit a deed the world can notice. This audit spells out
exactly what needs to be added (five pieces, roughly two of them cheap/mechanical and one of them a
genuine design decision about Carl's schedule of misdeeds) so the next worker can build it without
re-discovering any of this. No code was changed in this pass — this was a look-before-you-leap audit,
as the packet asked for, and the answer came back "leap needs a running start," so I stopped rather
than force a shortcut that would misattribute an NPC's crime to the player.
