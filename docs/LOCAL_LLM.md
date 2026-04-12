# Local LLM — Architecture Spec

**Status:** Draft v1, 2026-04-12
**Depends on:** `server/llmProvider.js`, `engine/npc/`, `engine/rumor/`, `engine/llmPhysics.js`

---

## Purpose

Add a local LLM path (Ollama) alongside the existing Anthropic API to handle high-frequency, low-complexity AI tasks. The local model makes structured decisions; Claude writes prose. The deterministic engine remains the sole authority on physics, rolls, and state mutation.

**Why this matters:** NPCs currently behave via rule-based thresholds (trust ≥ 5 → share, trust < 5 → withhold). A local model adds personality-flavored decision-making without API cost or latency. The game also becomes playable offline with degraded but real AI support.

---

## The line

The engine has three AI layers. Each has a clear job and a clear boundary:

| Layer | Model | Decides | Never decides |
|---|---|---|---|
| **Deterministic engine** | None | Physics, rolls, state mutation, combat, spells, movement | — |
| **Local LLM (new)** | Ollama 7-8B | NPC behavior choices, rumor garbling, physics classification | State changes, roll outcomes, prose |
| **Cloud LLM** | Claude Sonnet | Narration prose, prose-to-world import, complex reasoning | State changes, roll outcomes, NPC decisions |

**Rule:** The local model never writes player-facing prose. It returns structured JSON that the engine acts on and that the cloud model narrates.

**Rule:** The local model never overrides physics. A charm spell's success/failure is resolved by `resolve.js` (d20 + mod vs DC). If the spell succeeds, the engine mutates NPC trust via `applyDeltas`. The local model sees the *result* (trust is now 7) and decides what the NPC does with that new trust level.

---

## Target hardware

**Minimum:** Apple Silicon Mac, 16GB unified memory (M1 Air).
**Recommended model:** Llama 3.1 8B (Q4_K_M quantization, ~4.5GB VRAM, ~25 tok/s on M1).
**Fallback model:** Phi-3 Mini 3.8B (Q4, ~2.5GB, ~40 tok/s) for constrained hardware.

---

## Provider architecture

```
server/llmProvider.js (existing — add local path)
  ├── anthropic    → Claude Sonnet    → narration, import, complex
  ├── openai       → victory gates    → existing polish/trace path
  └── local (NEW)  → Ollama           → NPC brain, rumor garble, physics detect
```

### Local provider contract

```js
// server/localLlmProvider.js (new)
export async function queryLocal({ prompt, schema, model, timeout }) {
  // → { ok: true, result: <parsed JSON matching schema> }
  // → { ok: false, reason: 'unavailable' | 'timeout' | 'parse_error' }
}
```

- `schema` is a JSON shape description. Ollama's `format: "json"` constrains output to valid JSON.
- `timeout` defaults to 3000ms. If the model is slow or absent, fail fast.
- Never throws. Returns `{ ok: false }` on any failure — matches the engine's silent-fallback contract.
- Model defaults to `llama3.1:8b` but is configurable via env var `LOCAL_LLM_MODEL`.

### Endpoint

Ollama runs on `http://localhost:11434` by default. Configurable via `LOCAL_LLM_ENDPOINT` env var. The provider pings the endpoint on startup and logs availability — does not block server boot.

---

## Consumer 1: NPC Brain

The primary consumer. Replaces rule-based NPC behavior with personality-aware structured decisions.

### Module

```
engine/npc/npcBrain.js (new)
  ├── buildNpcContext(npc, world, playerInput) → prompt context
  ├── queryBrain(context) → structured decision
  └── fallbackRules(context) → same shape, deterministic
```

### Prompt template

```
You are {npc.name}, a {npc.archetype} in {location.name}.
Personality: {npc.traits joined}.
Trust toward this person: {trust}/10.
Mood: {current mood}.

You know:
{for each fact/rumor the NPC carries, one line}

Relationships:
{for each relevant NPC relationship, one line}

The player says: "{playerInput}"

Reply as JSON:
{
  "share": [list of fact/rumor IDs to mention, or empty],
  "mood": "wary" | "warm" | "hostile" | "fearful" | "amused",
  "approach": "volunteer" | "wait_to_be_asked" | "deflect" | "lie",
  "why": "one sentence reasoning"
}
```

### Decision shape

```js
NpcDecision = {
  share: string[],           // IDs of facts/rumors to surface
  mood: string,              // one of the mood enum values
  approach: string,          // how the NPC delivers the info
  why: string                // reasoning (logged, not shown to player)
}
```

### Fallback

If the local model is unavailable or returns unparseable output, `fallbackRules` produces a decision using the existing trust-threshold logic:
- trust ≥ 7: share all non-personal facts, mood = warm
- trust 4-6: share one fact if asked directly, mood = wary
- trust ≤ 3: withhold, mood = wary or hostile
- personal facts: never share below trust 8

The fallback is deterministic (uses `rng.js` for any randomized selection). The game is fully playable without Ollama.

### Determinism and replay

NPC decisions are **canonized in Canon Log** on first evaluation:

```js
{ type: 'npcDecision', npcId, turn, decision: NpcDecision }
```

On replay, the engine reads the logged decision instead of querying the model. Same pattern as rumor minting. `worldHash` does NOT include NPC decisions (they're advisory/narration, not state-bearing). But Canon Log preserves them for replay fidelity.

---

## Consumer 2: Rumor Garbling

When a tier-0 truth needs to be rewritten at tier 2 or 3, the local model does the distortion:

```
Rewrite this fact at fidelity tier {tier}:
Original: "The Orc Queen's army crossed Blackridge Pass three days ago."
Tier 2 rules: correct framing, wrong details, garbled names.
Carrier personality: {carrier traits}.

Reply as JSON:
{ "body": "the garbled version" }
```

This is a constrained rewrite — short input, short output, well-defined transformation rules. Well within an 8B model's capability.

**Fallback:** template-based garbling using seed tags: `"They say there's something about {seed.primaryTag} over in {seed.direction}."` Already specced in `RUMOR_LAYER.md`.

---

## Consumer 3: Physics Detection

`engine/llmPhysics.js` already calls the cloud LLM for "can I climb this wall?" style queries. These are classification tasks — structured input, boolean/enum output. Route them to local when available:

```
The player wants to: "{action}"
Environment: {scene tags, terrain, weather}
Player stats: MIGHT {n}, AGILITY {n}
Equipment: {relevant gear}

Is this physically possible? Reply as JSON:
{ "possible": true|false, "difficulty": "trivial"|"easy"|"medium"|"hard"|"impossible", "stat": "MIGHT"|"AGILITY"|"WITS"|"GRIT"|"CHARM" }
```

**Fallback:** existing cloud LLM path (already implemented), then keyword heuristics if both fail.

---

## Setup experience

### Player installs Ollama (optional)

```bash
brew install ollama
ollama pull llama3.1:8b
# Done. Game detects it automatically.
```

### Game detects availability

On server boot, `localLlmProvider` pings `http://localhost:11434/api/tags`. If it responds and has a compatible model loaded:
- Log: `Local LLM available: llama3.1:8b (4.5GB)`
- Route NPC brain / rumor garble / physics to local.

If it doesn't respond:
- Log: `Local LLM not available — using rule-based fallback for NPC decisions`
- Game works identically to today. No error, no nag.

### UI indicator

A subtle indicator in the settings/debug panel: "🧠 Local AI: active" or "🧠 Local AI: offline". Not in the main game UI — players shouldn't care which model is making decisions.

---

## What this does NOT do

- **Replace the cloud LLM for narration.** Claude writes the prose. The local model doesn't write player-facing text.
- **Make the game dependent on Ollama.** Every consumer has a deterministic fallback. Ollama is an enhancement, not a requirement.
- **Compromise determinism.** LLM decisions are canonized in Canon Log on first evaluation. Replay reads the log, not the model.
- **Touch state directly.** The local model returns structured decisions. The engine acts on them through `applyDeltas`. The model never writes to world state.
- **Override physics or rolls.** The deterministic engine is the sole authority on "what happens." The local model only decides "how does this NPC feel about what happened."

---

## Worker-pass breakdown

### Pass O1 — Local LLM Provider
**Goal:** `server/localLlmProvider.js` with Ollama client, health check, timeout, fallback contract. Shared infrastructure for all consumers.

**Files:** `server/localLlmProvider.js` (new), `server/llmProvider.js` (extend routing).

**Tests:** provider returns `{ok: false}` when Ollama is not running; provider returns `{ok: true, result}` with a mock server; timeout fires correctly.

**Commit:** `feat(local-llm): pass O1 — Ollama provider with silent fallback`

### Pass O2 — NPC Brain
**Goal:** `engine/npc/npcBrain.js` with context builder, local model query, rule-based fallback, Canon Log integration.

**Depends on:** Pass O1 (provider), Pass R1 (rumor schema — NPC brain needs to know what rumors the NPC carries).

**Files:** `engine/npc/npcBrain.js` (new), `engine/npc/perspectiveFilter.js` (extend), `engine/npc/dialogue.js` (wire brain into dialogue flow), `engine/csl/canonLog.js` (new event type).

**Tests:** brain produces valid decision shape; fallback matches existing trust-threshold behavior; Canon Log roundtrip preserves decisions on replay.

**Commit:** `feat(npc): pass O2 — NPC brain with local LLM + rule-based fallback`

### Consumers R2 and physics — not new passes

Rumor garbling routes through the same provider in Pass R2. Physics detection reroutes in a follow-on — no new pass needed, just a wiring change in `engine/llmPhysics.js`.

---

## Test gates

- **O01 — provider fallback:** `queryLocal()` returns `{ok: false}` when endpoint is unreachable. No throw.
- **O02 — provider timeout:** query with 1ms timeout returns `{ok: false, reason: 'timeout'}`.
- **O03 — NPC decision shape:** brain returns valid `NpcDecision` for a fixture NPC + player input.
- **O04 — fallback matches rules:** when local model is unavailable, brain output matches the existing trust-threshold rules exactly.
- **O05 — Canon Log replay:** NPC decision is logged; on replay, the logged decision is returned without querying the model.
- **O06 — determinism:** same NPC state + same player input + Canon Log replay → same decision.

---

## Non-goals

- Fine-tuning a local model (use off-the-shelf).
- Supporting GPU inference servers (just Ollama for now).
- Local model for narration/prose (that's Claude's job).
- Mandatory dependency on Ollama (everything falls back gracefully).
- Model selection UI (env var is sufficient for the slice).
