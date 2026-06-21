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
  // ---- LOCKED ----
  {
    id: 'C4-001',
    capability: 'C4',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask who founded the village and when — must get an honest decline (founding facts not in canon), never a bounce or roll',
    paraphrases: [
      "Who founded Pilgrim's Rest, and when?",
      "what do people say about who started pilgrim's rest",
      "Who built Pilgrim's Rest?",
      "When was Pilgrim's Rest established?",
      "Who were the first settlers of Pilgrim's Rest?",
    ],
    assert: {
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
    source: 'opus-gate-2026-06-19-postH42-baseline.md (Lore-hound, turn 5); calibrated 2026-06-20; graduated H-63',
  },

  // ---- TARGET (REVIEW) ----
  // Paraphrases blocked by dialogue.js "this village/place" false positive in
  // commonKnowledgeAnswer, or by playloop movement-compound routing.
  // Cannot fix in grace lane. Leave as target until dialogue.js or playloop is in scope.
  {
    id: 'C4-001b',
    capability: 'C4',
    status: 'target', // REVIEW: blocked outside grace lane
    fixture: 'village_baker',
    intent: 'founding question — phrasings that hit "this village/place" false positive or movement compound',
    paraphrases: [
      // REVIEW: movement compound — "I head to" fires travel gate before question reaches isUngroundedInfoCheck
      "I head to the village tavern and find the oldest person there. Who founded Pilgrim's Rest, and when?",
      // REVIEW: "this village" triggers commonKnowledgeAnswer → lookupGroundedFact returns place name → no decline
      "Who founded this village? When was it built?",
      // REVIEW: "this place" false positive in commonKnowledgeAnswer
      "I ask around the market: who was here first? Who built this place?",
      // REVIEW: "this village" false positive
      "Corwin, who laid the first stone of this village and when?",
    ],
    assert: {
      surface_matches: [
        /I don.t (have|know)|unclear|no record|can.t say|lost to me|nothing (in|from|on)|Couldn.t say/i,
      ],
      surface_excludes: [/\[roll:/, /Nothing'?s happened yet/i],
    },
    diverge: [],
    source: 'C4-001 original paraphrases, blocked by dialogue.js/playloop; parked H-63',
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
    status: 'locked',
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
      // All 6 now route through META_PURSE → answerPurse (H-63).
      // "open the purse" / "look inside" / "count the coins" / "anything in the coin purse"
      // are newly caught by widened META_PURSE; the first two already passed via existing patterns.
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
    source: 'opus-gate-2026-06-20-postH52-H53.md (Chaos-griefer, turn 7); calibrated 2026-06-20; graduated H-63',
  },

  {
    id: 'C4-004',
    capability: 'C4',
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask a historical detail not in canon — must get an honest decline, not a roll or a bounce',
    paraphrases: [
      // INFO_SEEKING_TOPIC_RE "what happened...ago" → isInfoSeekingText + npcAddressedRecap → decline
      // (avoids "Corwin" which is ungrounded in village_baker fixture — see C4-004b)
      "What happened here twelve years ago?",
      // Already passing: INFO_SEEKING_TOPIC_RE "what happened to"
      "Who was the village baker before Mira — and what happened to them?",
      // INFO_SEEKING_ORIGIN_RE "why did you come" → decline
      // (addresses Mira Hearth, the present NPC; no ungrounded NPC name)
      "Why did you come to Pilgrim's Rest in the first place?",
      // INFO_SEEKING_EXISTENTIAL_RE "has anyone been" → decline
      // "I ask around:" prefix keeps "has" lowercase mid-sentence — avoids C2 false-NER on
      // sentence-initial capital auxiliaries ("Was"/"Has" flagged as names if at start)
      "I ask around: has anyone been here before the current settlers?",
      // Already passing: INFO_SEEKING_EXISTENTIAL_RE "has anyone been"
      "I ask around: has anyone been through here recently — like in the last week — that nobody talks about?",
    ],
    assert: {
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
      { text: "Tell me everything about this village's history.", reason: 'open-ended lore dump via "tell me about" → "this village" triggers commonKnowledgeAnswer, delivers place fact, no decline' },
      // Changed from "I search the village for old records about who settled here" — that text contains
      // "who settled" which now matches INFO_SEEKING_RE (settl\w+) and would decline, not roll.
      { text: 'I search the village for old documents and ruins.', reason: 'action (search); no who/what+anchor-noun combination → isInfoSeekingText false → routes to action resolution, roll acceptable' },
    ],
    source: 'opus-gate-2026-06-19-postH31-H32.md; opus-gate-2026-06-19-postH42-baseline.md; calibrated 2026-06-20; graduated H-63',
  },

  // ---- TARGET (REVIEW) ----
  // Phrasings blocked outside the grace lane:
  // - "Corwin" is ungrounded in village_baker → C2 ungroundedNpcReferentForText fires first → [clarify:referent]
  // - "Was" at sentence-start triggers false NER in ungroundedNpcReferentForText (common-word denylist gap)
  // - "this village" triggers commonKnowledgeAnswer false positive → lookupGroundedFact non-null → no decline
  {
    id: 'C4-004b',
    capability: 'C4',
    status: 'target', // REVIEW: blocked by C2 handler or dialogue.js — cannot fix in grace lane
    fixture: 'village_baker',
    intent: 'historical/origin questions blocked by ungrounded-NPC-referent or false NER or dialogue.js',
    paraphrases: [
      // REVIEW: "Corwin" is ungrounded in village_baker → C2 clarify-referent fires before isUngroundedInfoCheck
      "What happened twelve years ago that made you settle here, Corwin?",
      // REVIEW: "Corwin" ungrounded
      "Corwin, why did you come to Pilgrim's Rest in the first place?",
      // REVIEW: sentence-initial "Was" triggers false NER in ungroundedNpcReferentForText (missing from common-word denylist)
      "Was there anyone living here before the current villagers arrived?",
      // REVIEW: "lived here" matches commonKnowledgeAnswer \bliv(?:e|ed) here\b → returns place name → no decline
      "I ask around: has anyone lived here before the current settlers?",
      // REVIEW: sentence-initial capital auxiliary "Has" triggers same false NER as "Was" (common-word denylist gap)
      "Has anyone been here before the current settlers arrived?",
      // REVIEW: "this village" → commonKnowledgeAnswer returns place name → lookupGroundedFact non-null → no decline
      "corwin whyd you come to this village in the first place",
    ],
    assert: {
      surface_matches: [
        /I don.t (have|know)|can.t (say|tell)|not sure|no record|lost to me|Couldn.t say/i,
      ],
      surface_excludes: [/\[roll:/],
    },
    diverge: [],
    source: 'C4-004 original paraphrases blocked by playloop/dialogue.js; parked H-63',
  },

  // ---- LOCKED ----
  {
    id: 'C4-005',
    capability: 'C4',
    status: 'locked',
    fixture: 'dialogue_active',
    intent: 'ask about events/danger/history using "this village/town" as a mere locative — must get an honest decline, not the place-description non-sequitur (H-74)',
    paraphrases: [
      "Mira, what's the worst trouble that's hit this village in your lifetime?",
      "what's the worst danger this town has faced?",
      "Has anything bad ever happened in this village?",
    ],
    assert: {
      surface_matches: [
        /Couldn.t say|don.t know|wouldn.t be the one|no news|can.t help you there/i,
      ],
      surface_excludes: [
        /\[dialogue ask \| place\]/i,
        /Small, but it holds/i,
      ],
    },
    diverge: [
      { text: 'Tell me about this village.', reason: 'genuine place-description ask; "this village" used as the actual subject, not a locative — still gets the place line' },
      { text: 'What is this place?', reason: 'genuine place-description ask — still gets the place line' },
    ],
    source: 'gate 2026-06-21 C4 empty-success regression (Brae roll:21 vacuous answer); reproduced LLM-off on dialogue_active; fixed H-74',
  },
];
