# Biblioteca — Demand-Pull Research Scan (the genie ritual)

A periodic check — run by dropping the prompt below into a **Basecamp** window — that asks whether the research
genie (a live-web research model, e.g. ChatGPT) should be pointed at anything NEW for the Biblioteca.

**The discipline it enforces:** the Biblioteca is a TOOL that serves the engine work, never a project in itself.
Research is **demand-pulled** — gathered when a real near-term need names a SOTA gap, *never stockpiled ahead*
(stockpiling = dead-weight volumes that never trigger + drift away from the actual build). So the default answer
is usually **"nothing right now,"** and that is the correct, healthy answer.

**The pipeline:** drop the prompt → Basecamp scans → either "none" OR a paste-ready genie brief → you paste the
brief to the genie → genie returns a model-facing addendum (real citations) → hand it back to Basecamp →
Basecamp value-filters, dedups, adds Immortal hooks, renumbers (next is Vol 15+), gists with echoes, commits.
That's exactly how Vols 11–14 came in.

---

## The form-prompt (drop into Basecamp)

~~~
Basecamp: run a DEMAND-PULL research scan for the genie.

Framing: the Biblioteca is a TOOL that serves the engine work, never a project in itself. The default answer to
this scan is usually "nothing right now" — and that is the correct, good answer. Do NOT manufacture research to
keep the genie busy; stockpiling ahead = dead-weight volumes + drift.

Steps:
1. Re-derive current + imminent work: read docs/CAPABILITY_LEDGER.md (graduated / next), tail
   docs/AGENT_CHANGELOG.md, check what's in flight. Name the next 3–5 concrete moves.
2. For each, apply THREE filters — a topic qualifies ONLY if ALL hold:
   (a) NAMED near-term need — a capability about to be scoped/built or a gate/process decision actually coming
       up (not hypothetical);
   (b) genuinely SOTA-DEPENDENT — current/post-training papers I can't reliably self-generate (NOT stable
       knowledge I already have, NOT something I'd be guessing citations for);
   (c) NOT already covered by an existing Biblioteca volume (check docs/biblioteca/README.md catalog + the
       MEMORY echoes).
3. Output:
   - If nothing qualifies (usual case): say so plainly — "shelf is stocked; no demand-pulled research need right
     now" — and name what we should be DOING instead (the next graduation/work).
   - If 1 (at most 2) genuinely qualifies: produce a precise, paste-ready genie brief — model-facing Biblioteca
     frontier-addendum format, real citations + links, per-finding "engine implication," scoped, with an
     explicit "skip X" to block generic hype. State which named need it serves and which existing volume it
     extends.
Never return more than 2 briefs. Reject anything that's stockpiling-ahead, self-generatable, or already shelved.
~~~

---

## Notes
- "None" is the expected default most of the time. Resist the urge to fill the genie's queue.
- The genie can hallucinate citations too — Basecamp sanity-checks links/venues before trusting a returned addendum.
- When integrating a returned addendum: renumber to the next free Vol, fix the internal title, add the Immortal
  hook + a MEMORY gist with echo triggers, and commit by explicit path (stack-check first).
