# D-X1 — The bespoke-voice cost model (the paper that gates Phase C)

**Status:** analysis for Tim's decision. Written 2026-06-24 by Basecamp (overnight). **The decision is Tim's** — this
writes the numbers and frames the fork; it does not make the call. Nothing here was spent on a paid gate; the token
figures are estimates grounded in the real prompt shape (`server/npcVoicePrompt.js`) and the last gate's measured
per-call averages, with current published pricing.

---

## 0. The question (and the reframe that changes it)

DEMO_REGION §0 promises **~200 NPCs, every one corpus-voiced** (a real historical voice behind each, drawn from the
437 backstory files in `server/rag/corpus/`). The open decision (DEMO_BUILD_PLAN red-team #3): **all-bespoke** (every
NPC's lines run through an LLM voice call) vs **marquee-bespoke + template-rest** (the 5 figures + a handful of key
NPCs get LLM voice; everyone else uses the deterministic `voiceManner` templates that already exist in
`engine/npc/dialogue.js`).

**The reframe: "200 NPCs" is CONTENT scope, not runtime cost.** The 200 backstories already exist. A bespoke NPC costs
nothing until a player *talks to them*. So the real cost driver is **lines spoken per play-session**, not head-count.
That turns an intimidating "can we afford 200 live NPCs?" into a tractable "what's the per-line cost and the per-session
COGS, and is the quality worth it?"

**A pricing correction that de-risks the whole thing.** The repo's cost notes (CLAUDE.md gate note, the old playtest
reports) priced "Opus" at **$15 / $75** per M tokens. That is stale. Current published pricing:

| Model | Input $/M | Output $/M | Role in this engine |
|---|---|---|---|
| Claude Haiku 4.5 (`claude-haiku-4-5`) | **$1** | **$5** | **already the narration-polish model** (`engine/llmAdapter.js` `NARRATION_MODEL`, `max_tokens: 120`) |
| Claude Sonnet 4.6 (`claude-sonnet-4-6`) | $3 | $15 | the DM-adjudication path (`DEFAULT_MODEL`) |
| Claude Opus 4.8 (`claude-opus-4-8`) | $5 | $25 | the experiential gate's player+judge only |
| Claude Fable 5 (`claude-fable-5`) | $10 | $50 | (not used) |

So the engine's per-line voice would run on **Haiku 4.5 at $1/$5** — and prior COGS fears were sized against a number
**3–15× too high**. The last D-B4 gate (96 Opus calls, 140,195 in + 8,661 out) cost **~$0.92 at today's Opus price**,
not the "$2.75" the report logged.

---

## 1. Per-line cost (the unit)

A voice call (`buildNpcVoicePrompt`) is a small, fixed shape: persona + trust tier + role + mood + a **VOICE ARCHIVE**
of 2–4 backstory excerpts + a world-knowledge block + the player's line + a hard instruction to reply with **exactly one
line under 30 words, inventing no specifics**. Token estimate:

- **Input ≈ 1,200 tokens** (scaffolding ~400 + RAG archive ~600 + world/context ~200). Range 800–1,600 depending on how
  many archive chunks the NPC carries.
- **Output ≈ 40 tokens** (one line, ≤30 words).

**Per-line cost at each tier** (input×1,200, output×40):

| Model | Cost / line | With prompt caching¹ |
|---|---|---|
| **Haiku 4.5** | **$0.0014** (~0.14¢) | **~$0.0006** (~0.06¢) |
| Sonnet 4.6 | $0.0042 (~0.42¢) | ~$0.0019 |
| Opus 4.8 | $0.0070 (~0.70¢) | ~$0.0031 |

¹ Cache reads cost ~0.1× input. An NPC's archive + persona (~900 of the 1,200 input tokens) is **stable across that
NPC's conversation turns**, so turns 2+ within the 5-min cache window read it at 0.1×. Caching helps *within* one NPC
conversation, not across different NPCs (each has a different archive prefix). Worth wiring (`cache_control` on the
archive block) — it ~halves the per-line cost in real multi-turn dialogue.

---

## 2. Per-session COGS (the number that matters for selling)

A demo playthrough talks to maybe **2–3 NPCs per town × 8 towns × ~5–7 lines each ≈ ~150 voice lines** (plus exploration
narration, already on Haiku). So **all-bespoke** COGS per full play-session:

| Model (all-bespoke) | ~150 lines / session | With caching |
|---|---|---|
| **Haiku 4.5** | **~$0.21** | **~$0.09** |
| Sonnet 4.6 | ~$0.63 | ~$0.29 |
| Opus 4.8 | ~$1.05 | ~$0.47 |

**At Haiku, a fully-bespoke, every-NPC-alive playthrough costs ~9–21¢.** For a paid game (or even a generous free demo)
that COGS is a rounding error. This is the single most important finding: **at current cloud-Haiku pricing, all-bespoke
is already affordable without any local-GPU effort.**

---

## 3. The two forks, with numbers

### Fork A — all-bespoke vs marquee-bespoke + template-rest

The `voiceManner` deterministic templates already exist and cost **$0**. Marquee-bespoke (LLM-voice the ~5 figures +
~20 key NPCs, ~25% of lines; template the rest) would cut the ~150-line session to ~40 LLM lines:

| Approach | Haiku COGS / session | What the player feels |
|---|---|---|
| **All-bespoke** | ~$0.21 (~$0.09 cached) | every stranger is a distinct, corpus-grounded voice — **the moat** |
| Marquee-bespoke + template-rest | ~$0.06 (~$0.03 cached) | the 5 figures sing; random townsfolk fall back to banded templates (noticeably flatter) |

**The saving is ~$0.15/session.** At Haiku prices that does not buy back the cost of *losing the "every NPC is alive"
wow* — which is precisely the demo's differentiator. Marquee-bespoke is a **premature optimization at cloud-Haiku
prices**; keep it as a known, free fallback lever (already built) for a future free-to-play scale scenario, not as the
demo default.

### Fork B — cloud-per-line vs local 8B GPU

| Dimension | Cloud Haiku 4.5 | Local 8B (Llama-3.1-8B / Qwen2.5-7B class) |
|---|---|---|
| Per-line cost | ~0.14¢ (~0.06¢ cached) | **~0.008–0.015¢** (~10× cheaper *at high utilization*) |
| Fixed cost | $0 idle | a GPU bills 24/7 (~$0.40–0.75/hr rented 4090/A10) **whether or not anyone plays** |
| Throughput | API-elastic, no ceiling | GPU-bound (~1–3 lines/s/GPU with batching; you own the scaling) |
| Ops burden | none | hosting, autoscaling, monitoring, model updates, eval drift |
| **Quality / §0 risk** | **Haiku is strong** at nuanced, in-character, *no-hallucination* dialogue | an 8B is materially weaker — **more likely to invent specifics** (the prompt forbids names/numbers/dates — a weak model breaks this more often) and **more likely to leak §0** (the cosmology guard leans on the model honoring "say you don't know"). THE_REF catches some, not all. |

The local 8B only wins on **marginal per-line cost, and only at sustained high utilization** (a busy GPU). Below that, the
idle-GPU fixed cost makes it *more* expensive than cloud per-line. And it trades away the engine's two crown jewels —
**voice quality and §0-safety** — which are the whole reason the 437-backstory moat matters.

---

## 4. Recommendation (Tim decides; this is the lean)

**For the demo and early sales: all-bespoke on cloud Haiku 4.5, with `cache_control` on the voice-archive block.**

- It is already the narration model — zero new infra, one config path.
- ~9–21¢ per full playthrough is a non-issue at demo/early-sales scale; COGS does not gate the experience.
- It preserves the moat (every NPC a real voice) and the strongest §0-safety + lowest hallucination rate.
- It needs no GPU ops while you're still proving the game is worth selling.

**Defer the local-8B question until scale forces it.** Revisit only when daily sessions reach the thousands *and* cloud
per-line COGS becomes material — by which point there's revenue to fund the GPU, the ops, and a careful §0/quality eval
harness (which the convergence corpus + the Opus gate already prototype). Don't pre-optimize a COGS line that's currently
a rounding error at the cost of the moat.

**Keep marquee-bespoke as a documented free lever, not the default.** The template path exists; if a future free-tier
needs to shave COGS, flipping the long-tail NPCs to templates is a one-flag change — but it visibly costs the "alive"
feeling, so it's a scale decision, not a craft one.

### Two cheap wins worth doing regardless of the fork
1. **Wire prompt caching** on the voice archive (`cache_control: {type:'ephemeral'}`) — ~halves multi-turn dialogue COGS,
   free to add.
2. **Fix the stale model strings.** `server/llmProvider.js` still defaults to `claude-sonnet-4-20250514` (an old Sonnet-4
   snapshot); the narration path is on the dated `claude-haiku-4-5-20251001`. Consider standardizing on the current
   aliases (`claude-haiku-4-5`, `claude-sonnet-4-6`) so pricing/behavior track the latest. (Separate small packet — not
   part of this decision.)

---

## 5. The decision left for Tim

> **Decision #1 (gates Phase C population):** Confirm **all-bespoke on cloud Haiku 4.5** as the demo voice strategy
> (the lean above), OR choose **marquee-bespoke + template-rest** if you want the long-tail NPCs templated from the
> start, OR direct a **local-8B** investigation now if you're optimizing for a free-to-play scale economics from day one.
>
> The numbers say all-bespoke-on-Haiku is affordable (~$0.09–0.21/session) and protects the moat. The other two trade
> moat or add ops for savings that are immaterial at demo scale. **Your call.**
