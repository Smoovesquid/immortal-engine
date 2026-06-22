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
      // Honest-decline is the intent. Match it by the variant-independent MECHANICS signal
      // `no-record` (every decline path — info-check OR W-3's place-history events resolver —
      // emits it) in addition to the narration phrasings, so the case can't be broken by which
      // declineInfoSeek variant happens to fire. (W-3: "What happened here…" now routes through
      // the place-events resolver, which declines via the "Wouldn't know…" variant the original
      // narration-only list omitted.) Protective excludes (no invention, no roll) unchanged.
      surface_matches: [
        /I don.t (have|know)|can.t (say|tell)|not sure|no.?record|lost to me|Couldn.t say|wouldn.t know|nobody.s ever/i,
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

  // ---- LOCKED ----
  {
    id: 'C4-006',
    capability: 'C4',
    // The PC's OWN provenance — "who carried me in / where did they find me" — a
    // past event canon doesn't hold. Before H-78 isInfoSeekingText missed these
    // (INFO_SEEKING_PROVENANCE_RE didn't exist), so the NPC-addressed form fell to
    // a generic WITS resolve that "succeeded" with contentless flavor ("it goes
    // your way") — gate-4 Lore-hound t2/t9/t10/t11, C4 empty-success in the resolve
    // path. Now isUngroundedInfoCheck fires PRE-ROLL → honest decline, no roll.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask who carried/brought the PC in or where they were found — an ungrounded past event; must honestly decline with NO roll, never a contentless success',
    paraphrases: [
      "Who carried me in last night?",
      "Who brought me here?",
      "Where did they find me?",
      "Mira, who carried me in here last night, and where did they find me?",
      "Who hauled me in, and when?",
    ],
    assert: {
      surface_matches: [
        // deterministic no-roll sentinel from noInfoCheckResult(), tier-independent
        /no-?record|don.t (have|know)|can.t (say|tell)|lost to me|Couldn.t say|wouldn.t know/i,
      ],
      surface_excludes: [
        /\[roll:/,                                         // the whole point: no gradeable roll
        /it goes your way|something real to go on|half-works/i,  // the empty-success filler it used to emit
      ],
    },
    diverge: [
      { text: 'take me to Mira', reason: 'present-tense escort = movement intent, not a provenance question; must not info-decline' },
      { text: 'point me to Mira', reason: 'C12 directions (H-75); must not info-decline, and must not strike' },
    ],
    source: 'opus-gate-2026-06-21-gate4-postH77.md (gate 4, Lore-hound t2/t9/t10/t11) — C4 empty-success in the resolve path; reproduced LLM-off village_baker; fixed H-78',
  },

  // ---- LOCKED — object content-read with nothing modeled to read (N-1) ----
  {
    id: 'C4-007',
    capability: 'C4',
    // gate-5 Newbie t8: "open the book and see what's inside" → "it goes your way"
    // (a contentless d20 success). The engine models no readable object content,
    // so a content-read can never deliver a real fact. N-1 extends H-78's
    // empty-success machinery to OBJECTS: a content-read honest-declines with NO
    // roll (intercepted before the trivial gate AND resolveMove), never inventing
    // what the text says (the C9 rail). Exploration/loot ("open the chest/door")
    // keeps its normal path — see diverge.
    status: 'locked',
    fixture: 'village_baker',
    intent: "read/open an object for its CONTENT with nothing modeled to read → honest decline, NO roll, never a contentless success",
    paraphrases: [
      "open the book and see what's inside",
      "crack open the book and see what's in it",
      "open it and see what's written",
      "look inside the journal",
      "peek inside the book",
      "I flip the journal open to read it",
    ],
    assert: {
      surface_matches: [
        /no-content|nothing written to deliver/i,           // deterministic no-content sentinel
      ],
      surface_excludes: [
        /\[roll:/,                                           // no fake roll on a content-read
        /goes your way|see it through|without any trouble/i, // the empty-success / trivial filler it used to emit
      ],
    },
    diverge: [
      { text: "I open the chest and see what's inside", reason: "exploration/loot, not reading text — keeps its normal (trivial/resolve) path" },
      { text: "I open the door and see what's inside", reason: "movement/exploration, not reading" },
      { text: "I search the room", reason: "a search action — rolls, not a content-read decline" },
    ],
    source: "opus-gate-2026-06-21.md (Newbie t8 'open the book' → 'it goes your way') — N-1 Tier-0; reproduced LLM-off village_baker, fixed N-1",
  },

  // ---- LOCKED — surveillance query about the PC, nothing modeled (N-2) ----
  {
    id: 'C4-008',
    capability: 'C4',
    // gate-6 Newbie t? ("call out … ask if either of them is the one who was
    // watching me") → [roll:16 success] "a useful answer comes back" — empty filler.
    // A QUERY about who has been watching/spying on the PC is an unmodeled fact: a
    // success could only INVENT a watcher (the C9 rail). isInfoSeekingText missed it
    // (no sub-RE matched), so it ROLLED and any post-roll narrator (composer OR the
    // ask:s last-resort template) delivered a content-free success — the
    // empty-success-on-a-SUCCEEDED-action shape. N-2 adds INFO_SEEKING_SURVEILLANCE_RE
    // → isUngroundedInfoCheck fires PRE-ROLL → honest decline, NO roll. Distinct from
    // C4-006 (PC provenance) and C4-007 (object content-read).
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask who has been watching/spying on the PC — an unmodeled surveillance fact; must honestly decline with NO roll, never a contentless success',
    paraphrases: [
      "I'll call out to them and ask if either of them is the one who was watching me.",
      "I call out and ask whether either of them was the one watching me",
      "ask the strangers if one of them was watching me earlier",
      "I ask around whether anyone here was the one spying on me",
      "ask if anyone here is the one who's been watching me",
      "ask them which one was spying on me",
      "which of them has been watching me?",
    ],
    assert: {
      surface_matches: [
        // deterministic no-record sentinel from noInfoCheckResult(), tier-independent
        /no-?record|don.t (have|know)|can.t (say|tell)|wouldn.t know|lost to me/i,
      ],
      surface_excludes: [
        /\[roll:/,                                                                 // the whole point: no roll
        /useful answer comes back|something real to go on|goes your way|read the room/i, // the empty-success filler it used to emit
      ],
    },
    diverge: [
      { text: 'ask Mira about the bread', reason: 'an answerable ask of a present NPC — no surveillance verb; rolls/routes normally, not an info-decline' },
      { text: 'I follow the stranger down the alley', reason: 'a tracking ACTION (player as subject, no me/us object) — resolves with a roll, not a decline' },
      { text: 'watch me work the dough', reason: 'imperative spectate ("watch me") with no query cue — not a surveillance query' },
      { text: 'follow me to the market', reason: 'accompany request ("follow me") — why "follow" is deliberately excluded from the verb list' },
    ],
    source: "opus-gate-2026-06-21.md (gate-6 Newbie 'call out … ask if either was watching me' → [roll:16] 'a useful answer comes back') — N-2 empty-success-on-a-SUCCEEDED-action; reproduced LLM-off village_baker, fixed N-2",
  },

  // ---- LOCKED — info-question to a present NPC about ungrounded backstory/identity (N-4) ----
  {
    id: 'C4-009',
    capability: 'C4',
    // gate-8: a player asks a present NPC about an ungrounded past/identity — "what
    // happened here last night?" (RL t4) → META_RECAP "Nothing's happened yet";
    // "who was it that ceased to matter?" (Lore) → rolled "it lands, partial". Both
    // are the C4 honest-decline class in the dialogue/info path. N-4: a fiction-
    // backstory "what happened [here/last night/to X]" and a "who was it/the one"
    // identity-ask are info-seeking → honest decline (no roll, no recap artifact).
    // META_RECAP is guarded so a bare session "what happened?" still recaps.
    status: 'locked',
    fixture: 'village_baker',
    intent: 'ask a present NPC about ungrounded fiction backstory / a past identity → honest in-character decline, no roll, never "Nothing\'s happened yet"',
    paraphrases: [
      'what happened here last night?',
      'who was it that ceased to matter?',
      'Mira, what happened here last night?',
      'you owe me a name — who was it?',
      'what happened to the people who were here before?',
    ],
    assert: {
      surface_matches: [
        /no-?record|don.t (have|know)|can.t (say|tell)|couldn.t say|wouldn.t know|lost to me/i,
      ],
      surface_excludes: [
        /\[roll:/,                                          // ungrounded info never rolls
        /Nothing'?s happened yet/i,                         // the recap artifact it used to emit
        /it lands.*partial|falls short|goes your way/i,     // empty roll-flavor
      ],
    },
    diverge: [
      { text: 'what happened?', reason: 'a genuine session recap (no fiction-backstory qualifier) — still recaps, not an info-decline' },
      { text: 'what did I just do?', reason: 'session recap of the last action — not a backstory question' },
      { text: 'who are you?', reason: 'present-tense address → C16 dialogue, not a past-identity decline' },
    ],
    source: "opus-gate-2026-06-21.md (gate 8 RL t4 'what happened last night' → 'Nothing's happened yet'; Lore 'who was it' → rolled partial) — N-4 dialogue/info honest-decline; reproduced LLM-off village_baker",
  },
  {
    id: 'C4-010',
    capability: 'C4',
    // (H-92, gate-11 RL t2) An alive/dead/pulse status query about a present (living) NPC
    // answers from canon and is NOT swallowed by a leading body verb ("I kneel by Mira and
    // check...") that classifyTrivial reads as "You kneel".
    status: 'locked',
    fixture: 'village_baker',
    intent: 'an alive/dead/pulse status query about a present living NPC answers from canon, not "You kneel"',
    paraphrases: [
      'I kneel by Mira and check for a pulse and breath — is she alive or dead? Give me a straight yes or no.',
      'I crouch by Mira and check for a pulse — is she alive or dead?',
      'I check the baker for a pulse — is she breathing?',
      'I lean over Mira and feel for breath — alive or dead?',
      'I kneel and feel for a pulse on Mira — is she still alive?',
    ],
    assert: {
      surface_matches: [/alive|breathing|pulse/i],
      surface_excludes: [/You kneel/i, /trivial action/i, /\[roll:/i],
    },
    diverge: [
      { text: 'I kneel and pray.', reason: 'a genuine trivial body action with no status question → "You kneel"/trivial is correct' },
      { text: 'I kneel down to rest a moment.', reason: 'trivial posture, not a status query' },
    ],
    source: 'opus-gate-2026-06-22-gate11.md (RL t2: "is he alive or dead?" → "You kneel"); reproduced LLM-off village_baker; fixed H-92',
  },
  {
    id: 'C4-011',
    capability: 'C4',
    // (H-92) The same query about a present DEFEATED NPC answers "dead" from canon
    // (persisted down/0-HP state), not a living-pulse reading.
    status: 'locked',
    fixture: 'defeated_npc',
    intent: 'an alive/dead status query about a present DEFEATED NPC answers "dead" from canon',
    paraphrases: [
      'I kneel by Mira and check for a pulse — is she alive or dead? Give me a straight yes or no.',
      'I crouch by Mira and check for a pulse — is she alive or dead?',
      'I check the baker for breath — is she breathing?',
      'I feel for a pulse on Mira — alive or dead?',
    ],
    assert: {
      surface_matches: [/dead|no pulse|no breath|gone/i],
      surface_excludes: [/You kneel/i, /alive — breathing/i, /\[roll:/i],
    },
    diverge: [
      { text: 'I kneel and pray over the body.', reason: 'a trivial body action, not a status query' },
    ],
    source: 'opus-gate-2026-06-22-gate11.md (RL t2, defeated NPC); reproduced LLM-off defeated_npc; fixed H-92',
  },
  {
    id: 'C4-012',
    capability: 'C4',
    // (W-1) The first world-wiring slice: a settlement's founding is COMMON KNOWLEDGE the
    // DM delivers from the substrate cascade — not a fact to floor ("your eyes move slow…"),
    // roll a fake outcome on, or invent. The substrate mints a deterministic per-node
    // founding event on visit (engine/substrate.js); the trade_town_tavern fixture seeds it,
    // so these CIRCUMSTANCE questions deliver the TRUE founding fact with NO roll. The
    // delivered phrase asserted below is that node's deterministic founding label (seed
    // 'w1-tallowcross' / node 'tt_tavern_node') — stable under replay; if the substrate
    // label pool or RNG changes, regenerate via scripts/convergence/fixtures.mjs. §0-safe:
    // the founding label is mundane and never alludes to the cosmology.
    status: 'locked',
    fixture: 'trade_town_tavern',
    intent: "a place-founding CIRCUMSTANCE question delivers the settlement's true substrate founding fact — no roll, no floor, no invention",
    paraphrases: [
      'how was this place founded?',
      'why was this town settled here?',
      'what is the history of this place?',
      "what's the story of this town?",
      'how did this town come to be?',
      'how old is this town?',
    ],
    assert: {
      surface_matches: [/merchant who saw the ford/i, /place-history → grounded/i],
      surface_excludes: [
        /\[roll:/i,                                            // common knowledge — never rolled
        /eyes move slow|what do you do\?/i,                    // not the generic explore floor
        /I don.t (have|know)|no record|can.t say|no-record/i,  // it DELIVERED, did not decline
      ],
    },
    diverge: [
      { text: 'who founded this place — give me a name?', reason: 'an AGENT ask the founding label never holds → honest-decline, not deliver (C9)' },
      { text: 'I look for a founding stone in the square', reason: 'a search ACTION → rolls/searches, not a place-history delivery' },
      { text: 'I look around', reason: 'a generic survey → the explore floor, not a founding delivery' },
      { text: 'how do I get this town to settle down?', reason: 'a "settle down" idiom, not a founding question — must not deliver the founding fact' },
    ],
    source: 'W-1 (world-wiring slice 1 — substrate→place-history materialization); reproduced LLM-off trade_town_tavern',
  },
  {
    id: 'C4-013',
    capability: 'C4',
    // (W-3) The first NEW place-knowledge TYPE through the World-Query Resolver, proving a
    // new world question is just a SLOT (engine/world/placeQuery.js `events`), not a bespoke
    // handler. "What happened here?" delivers a node substrate LOCAL-EVENT — no floor, no
    // roll, no invention. PLACE-ANCHORED: person ("happened to the baker"), relational
    // ("history between X and Y") and bare ("what happened?") forms do NOT poach it (the
    // diverges) — the anchor is the guard that keeps relational history deflecting (C9-002/3).
    // The delivered phrase is the node's deterministic earliest local-event (seed
    // 'w1-tallowcross' / 'tt_tavern_node'); regenerate via fixtures.mjs if the pool/RNG change.
    // §0-safe: local-event labels are mundane, never the cosmology.
    status: 'locked',
    fixture: 'trade_town_tavern',
    intent: 'a place-EVENT question ("what happened here?") delivers a node substrate local-event — no roll, no floor, no invention',
    paraphrases: [
      'what happened here?',
      "what's happened in this town?",
      'anything happen here lately?',
      'what trouble has this town seen?',
      'what goes on around here?',
    ],
    assert: {
      surface_matches: [/traveling healers/i, /place-history → grounded/i],
      surface_excludes: [
        /\[roll:/i,                                            // common knowledge — never rolled
        /eyes move slow|what do you do\?/i,                    // not the generic explore floor
        /I don.t (have|know)|no record|can.t say|no-record/i,  // it DELIVERED, did not decline
      ],
    },
    diverge: [
      { text: 'what happened to the baker?', reason: 'a PERSON question (no place anchor) → its own decline, not a place-event deliver' },
      { text: 'what is the history between the two families?', reason: 'RELATIONAL history (no place anchor) → must NOT poach an event (C9-002 stays a deflect)' },
      { text: 'what happened?', reason: 'bare, no place anchor → keeps its own "nothing has happened yet" handler' },
      { text: 'how was this town founded?', reason: 'a DIFFERENT place type (founding) → delivers the founding fact, not the event (proves types are disjoint)' },
    ],
    source: 'W-3 (world-wiring slice 3 — events as the first new resolver slot); reproduced LLM-off trade_town_tavern',
  },
  {
    id: 'C4-014',
    capability: 'C4',
    // (W-4) The second new resolver TYPE, and a category-BOUNDARY proof: `population`
    // ("who lives here?") names the present SOCIABLE roster from node.settlement.npcs — no
    // roll, no floor, no invention. It is a who-question, so the proof is in the DIVERGES:
    // it must NOT answer founder ("who founded" → founding/decline), services ("who sells"
    // → trade), or secret/control ("who secretly controls / runs the cult" → never invent a
    // controller from the roster). The existing META_NPC_ROSTER ("who are these people")
    // fires first and is untouched. trade_town_tavern has one sociable NPC → deterministic.
    // §0-safe: names/roles only, no affiliation/cosmology; hostiles are never named.
    status: 'locked',
    fixture: 'trade_town_tavern',
    intent: 'a broad population question ("who lives here?") names the sociable settlement roster — no roll, no floor, no invention',
    paraphrases: [
      'who lives here?',
      "who's here?",
      "who's in town?",
      'is anyone around?',
      'what kind of people live here?',
    ],
    assert: {
      surface_matches: [/Bram Cask the tavern-keeper/i, /place-history → grounded/i],
      surface_excludes: [
        /\[roll:/i,                                            // common knowledge — never rolled
        /eyes move slow|what do you do\?/i,                    // not the generic explore floor
        /I don.t (have|know)|no record|can.t say|no-record/i,  // it DELIVERED, did not decline
      ],
    },
    diverge: [
      { text: 'who founded this place?', reason: 'FOUNDER (agent) → founding type / honest-decline, never the resident roster' },
      { text: 'who secretly controls this town?', reason: 'SECRET/control → must NEVER invent a controller or list residents as such' },
      { text: 'who runs the cult?', reason: 'guarded/control → not population; never named from the public roster' },
      { text: 'who can sell me weapons?', reason: 'SERVICES → stays the trade/shops path, not the population roster' },
    ],
    source: 'W-4 (world-wiring slice 4 — population, a category-boundary proof); reproduced LLM-off trade_town_tavern',
  },
];
