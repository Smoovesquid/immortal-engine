# Morning briefing — what landed overnight + the decisions waiting for you

*Written by Basecamp, overnight 2026-06-24. Plain English, no jargon-for-its-own-sake.*

---

## The one-paragraph status

**Phase A + B are complete and proven, and the build is green and pushed.** Overnight I cleared the whole
deterministic residual list from the D-B4 gate (the four "the DM said something a little off" bugs), wrote the
voice-cost paper you needed to unlock Phase C, and left you the decisions below. Nothing risky ran — no paid gate, no
Phase-C population built, determinism and §0 untouched. `npm run check` is green (convergence 109/109, 8,557 tests
passing, determinism intact) and everything is on `v2-polish` at origin.

**Go play the loop on seed `tallow`:** read *The Lasting Word*, hear a town's trouble and take a quest, do the deed,
then walk to the next town and hear a stranger greet you by name. Save, reload — it remembers. That's the make-or-break
loop, and it's live.

---

## What landed overnight (all green + pushed)

Six commits, each its own small fix with a locking test:

1. **The modifier chart is now complete and correct.** The Rules-Lawyer caught the DM printing a stat→modifier table
   that started at 9 and had no entry for his low scores (6 and 8) — it read self-contradictory. The chart is now
   *generated from the real math*, so it can never drift again. (`bf607ba`)
2. **"Roll the save and show me the dice" now actually rolls.** When a player demands a roll and to see the numbers,
   the DM rolls a real d20 + modifier + total and shows it, instead of reciting the table or saying "you tell me." The
   roll is deterministic (same situation → same roll) and doesn't touch canon. (`109130c`)
3. **"Is there a mirror here?" gets an honest answer.** It used to bounce a generic "ways lead off east and south."
   Now the DM answers from what's actually in the room — "no mirror here, but there's a washbasin" — and never invents
   an object that isn't there. (`252ae67`)
4. **The DM never denies someone who's standing right there.** A townsperson claimed she "couldn't place" Elske while
   Elske was in the same room. Now, asked where a present person is, the DM points them out. (`6336cc4`)
5. **A rammed door obeys the dice.** "I back up and ram the door" was being read as "I leave," then the AI narrated
   the door swinging open on a *failed* roll. Now it's resolved as the force-the-door action it is, and a failed ram
   holds fast while a success gives. (`8820d76`)
6. **The voice-cost paper** (`docs/VOICE_COST_MODEL.md`) — the numbers behind Decision #1 below. (`a5ee785`)

None of these touched the new Phase-B loop (the newspaper, quests, reputation, the save-moat) — they're all
pre-existing frontier polish. The loop itself is unchanged and proven.

---

## The decisions waiting for you

Six of them. #1 is the one that unblocks the next build phase; I wrote a whole paper for it and have a clear lean.
The rest are taste/scope calls only you can make — I've framed each with the trade-off and, where I have a view, a
recommendation. **None of these are urgent before you play** — play first, then decide.

### #1 — How bespoke should the ~200 NPC voices be? — ✅ **DECIDED 2026-06-24: all-bespoke, Opus 4.8 for EVERY NPC**
> **The call (Tim, 2026-06-24):** all-bespoke, and **Opus 4.8 voice for every NPC — common man and king alike**, not
> tiered. Reasoning: a live A/B on the real `buildNpcVoicePrompt` (Haiku vs Sonnet vs Opus, same corpus archive) showed
> the model gap is real on *wit/subtext* (Opus did the Socratic turn; Haiku even slipped a forbidden stage direction)
> and near-zero on *plain refusals*. Since you can't predict which throwaway villager line lands, all-Opus refuses the
> tiering bet so **no line is ever the flat one** — the "every NPC alive" moat, bought outright. Cost is the reason it's
> affordable: **~$0.70–1.05 per hour of talk-heavy play (~$0.40–0.50 cached); ~0.7¢/line; ~1.9s/reply.** A non-issue at
> demo/early-sales scale. (Local-8B and marquee-template remain documented free levers for a future free-to-play scale
> scenario — not the demo default.) See `docs/VOICE_COST_MODEL.md` §6 for the implementation notes that the Phase-C
> wiring inherits (Opus 4.8 rejects the `temperature` param; the voice path still needs wiring to a call site).

The fear was that giving every NPC a real, corpus-grounded voice would be too expensive. **The numbers say it isn't.**
A full playthrough where every NPC speaks in their own voice costs about **9–21¢** on Haiku 4.5 (the model the
narration already uses). The old cost notes were 3–15× too high (they priced "Opus" at $15/$75; it's $5/$25 now, and
voice runs on Haiku at $1/$5).
- **My lean:** go **all-bespoke on cloud Haiku**. It's already wired, it's cheap, and it protects the moat (every NPC a
  real voice). Skip the local-GPU idea until you're at thousands of players — it's ~10× cheaper per line only at high
  GPU utilization and trades away voice quality + §0 safety.
- **Your call:** confirm all-bespoke, or pick "marquee-bespoke + templated extras" if you'd rather template the
  long-tail townsfolk from the start (saves ~15¢/session but the random stranger feels flatter).

### #2 — The 5 historical figures' roster *(the before-time echoes)*
The leads are re-skins: a steward-king (Marcus Aurelius → *Theodore Augustus*), a Cassandra (Joan of Arc), a scholar,
a clown-leader (a Goldblum-flavored Socrates), and a cannibal-prophet. **Confirm or swap these five.** This is pure
taste — who do you want the player to feel echoes of? It only gates lighting up the figures (Phase C), not the loop.

### #3 — Is the orb climax the demo's ending, or the campaign hook?
"Wake the orb" can either be the **payoff of the demo** (player gets a real ending) or the **cliffhanger that sells the
campaign** (the demo stops just before it). Trade-off: a contained ending is more satisfying to a first-time player; a
hook leaves them wanting more but can feel like a tease. This shapes how Phase D (dungeons + climax) is built.

### #4 — Leave the locked "compound-meta-precedence" rule as-is, or re-open it?
A small, already-decided design split (how the DM handles a question that stacks two meta-asks at once, C16-001). It's
locked and working; re-opening it is optional polish. **Recommend: leave it** unless it bugs you in play.

### #5 — Who's the first audience? *(this sets every "wow" bar's height)*
The experiential gate has been hammered by a **Rules-Lawyer** persona — which is why all four overnight fixes were
crunch/rules-precision nits. If your first audience is RPG enthusiasts, that bar is right. If it's **normies**, the bar
moves to "is the story alive and is it easy to talk to the world," and the Rules-Lawyer nits matter far less. **This
changes what we polish next.** My read: the loop (talk → quest → deed → reputation → "it remembers") is a *normie* wow,
and it's already strong — so if you're aiming normie, we may be closer than the gate's score implies.

### #6 — How hard do you lean on "never forgets"?
The save-moat (play → save → reload → the world remembers your deeds, byte-for-byte) is genuinely rare and genuinely
proven (test `U250`). Is it **the** headline of the pitch, or one pillar among several (alongside "every NPC alive" and
"talk to the world, no menus")? This is a positioning call that shapes the demo's framing, not the code.

---

## What I deliberately did NOT do (left for you)
- **Phase C (populate the towns)** — gated by Decision #1 above.
- **Phase D (dungeons + the orb climax)** — gated by Decision #3.
- **Any paid gate** — saved for you; `npm run check` (free) was my verification all night.
- **One flagged cleanup:** the server still names two old model strings (`claude-sonnet-4-20250514`, dated Haiku). Worth
  standardizing on the current aliases someday — small, separate, not urgent. Noted in the cost paper §4.

Everything above is green and pushed. Have a good morning — go play `tallow`.
