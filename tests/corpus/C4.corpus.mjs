// C4 — Info-seeking delivers a grounded fact OR honestly declines.
// Lineage: H-22/H-23/H-29/H-31/H-39. See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20.
//
// C4-002 and the honest-decline case in C4-004 show correct behavior
// (NPC deflects in-character or says "I don't know" without inventing).
// C4-001 (founding question) and C4-003 (coin purse) are inconsistent
// across paraphrases — some bounce/roll, some answer. Marked target.
export default [
  // ---- TARGET ----
  {
    id: 'C4-001',
    capability: 'C4',
    status: 'target',
    fixture: 'village_baker',
    intent: 'ask who founded the village and when — must get a grounded fact or honest decline, not a bounce or roll',
    paraphrases: [
      "I head to the village tavern and find the oldest person there. Who founded Pilgrim's Rest, and when?",
      "Who founded this village? When was it built?",
      "what do people say about who started pilgrim's rest",
      "I ask around the market: who was here first? Who built this place?",
      "Corwin, who laid the first stone of this village and when?",
    ],
    assert: {
      // Must produce either a named fact OR an explicit honest decline.
      // Currently the engine bounces ("You know of no such place"), rolls, or
      // treats "Can" in "Can I find that out?" as an unknown NPC name.
      surface_matches: [
        /I don.t (have|know)|unclear|no record|can.t say|lost to me|nothing (in|from|on)|Couldn.t say/i,
      ],
      surface_excludes: [
        /You know of no such place/i,
        /Which way|where will you make for|Where do you go/i,
        /\[roll:/,
        /Nothing'?s happened yet/i,
      ],
    },
    diverge: [
      { text: 'I walk to the edge of town and look for old ruins.', reason: 'movement/exploration action; routes to spatial resolution' },
    ],
    source: 'opus-gate-2026-06-19-postH42-baseline.md (Lore-hound, turn 5); calibrated 2026-06-20',
  },

  // ---- LOCKED ----
  {
    id: 'C4-002',
    capability: 'C4',
    // In dialogue_active the engine consistently routes "who is Brokefang" questions
    // through [dialogue ask | deflected] — the NPC says "Couldn't say" in-character
    // without inventing a Brokefang. This is correct C4 behavior: honest decline.
    status: 'locked',
    fixture: 'dialogue_active',
    intent: 'ask who a named but ungrounded NPC (Brokefang) is — must get an honest decline or deflection, not an invented description or roll',
    paraphrases: [
      "Wait—Brokefang? Who's that? I just kicked a cart, not a person.",
      "Who is Brokefang? Are they canon?",
      "I didn't catch that — who exactly is Brokefang and why do they matter here?",
      "brokefang who? never heard of them",
      "Tell me who this Brokefang is before I decide whether to care.",
      "Okay, who's Brokefang — are they in the village or did you make them up?",
    ],
    assert: {
      // NPC deflects in-character: "Couldn't say." is the real output.
      surface_matches: [
        /Couldn.t say|don.t (have|know)|can.t (say|speak)/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /You do so without difficulty/i,
      ],
    },
    diverge: [
      { text: 'I go look for Brokefang.', reason: 'movement/search action; routes to spatial resolution' },
      // NOTE: "Brokefang! Take that!" also deflects in dialogue_active (Mira says "Couldn't say")
      // so it cannot serve as a diverge here — it holds the same signature.
    ],
    source: 'opus-gate-2026-06-20-postH52-H53.md (Chaos-griefer, turn 6); calibrated 2026-06-20',
  },

  {
    id: 'C4-003',
    capability: 'C4',
    status: 'target',
    fixture: 'village_baker',
    intent: 'ask for coin amount in the purse — must state the real amount or honestly decline, not bounce or roll',
    paraphrases: [
      "How much coin is in the purse, and where did this Brokefang come from?",
      "How much money is in this purse?",
      "I open the purse — what's inside? Any coin?",
      "count the coins in the purse for me",
      "Is there anything valuable in the coin purse or is it empty?",
      "What do I find if I look inside the purse?",
    ],
    assert: {
      // "How much coin..." and "How much money..." give "purse is empty — you're flat broke".
      // "I open the purse..." → trivial auto-success (no content stated).
      // "count the coins..." → rolls. "Is there anything..." → observe-only bounce.
      // Target: all paraphrases should produce a grounded content statement.
      surface_matches: [
        /coin|empty|gold|silver|copper|\d+\s*(coin|gp|sp|cp)|flat broke/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /observe only/i,
      ],
    },
    diverge: [
      { text: "I snatch the coin purse off the baker's belt.", reason: 'theft action; routes to action resolution with roll' },
      { text: 'Is this purse worth stealing?', reason: 'opinion/judgment question; vibe answer acceptable' },
    ],
    source: 'opus-gate-2026-06-20-postH52-H53.md (Chaos-griefer, turn 7); calibrated 2026-06-20',
  },

  {
    id: 'C4-004',
    capability: 'C4',
    status: 'target',
    fixture: 'village_baker',
    intent: 'ask a historical detail not in canon — must get an honest decline, not a roll or a bounce',
    paraphrases: [
      "What happened twelve years ago that made you settle here, Corwin?",
      "Who was the village baker before Mira — and what happened to them?",
      "corwin whyd you come to this village in the first place",
      "Was there anyone living here before the current villagers arrived?",
      "I ask around: has anyone been through here recently — like in the last week — that nobody talks about?",
    ],
    assert: {
      // "Who was the baker before Mira..." → "I don't know. Won't change by asking twice."
      // (real output from Mira Hearth in village_baker). Good decline!
      // But other paraphrases roll or produce nothing-happened bounce.
      // Target: all phrasings should produce an honest decline, not a roll.
      surface_matches: [
        /I don.t (have|know)|can.t (say|tell)|not sure|no record|lost to me|Couldn.t say/i,
      ],
      surface_excludes: [
        /Nothing'?s happened yet\. What do you want to do\?/i,
        /\[roll:/,
        /two famil/i,
        /trapper.*winter/i,
      ],
    },
    diverge: [
      { text: "Tell me everything about this village's history.", reason: 'open-ended lore dump; blend of known canon and texture is acceptable' },
      { text: 'I search the village for old records about who settled here.', reason: 'action (search); routes to spatial/action resolution, roll acceptable' },
    ],
    source: 'opus-gate-2026-06-19-postH31-H32.md; opus-gate-2026-06-19-postH42-baseline.md; calibrated 2026-06-20',
  },
];
