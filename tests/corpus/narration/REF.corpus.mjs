// ─────────────────────────────────────────────────────────────────────────────
// REF — the narration-track corpus (THE REF, Tier 2). See docs/THE_REF.md.
//
// WHAT THIS LOCKS: the DETERMINISTIC FLOOR the live Ref falls back to. The three
// gate failures THE REF targets (atmosphere-dodge, question-misroute, fabrication)
// are LLM-LAYER failures — they only manifest when the npc-voice / narrate polish
// embellishes the engine's decision. LLM-OFF (this runner), the engine's base
// resolution is already SOUND: a present NPC who does not know the answer honestly
// DEFLECTS ("Couldn't say. Try someone…") and never fabricates a count or a name.
//
// So these locked cases are the regression signal for the FALLBACK: if any future
// change made the deterministic deflection start rolling, fabricating a night-count,
// or inventing a sponsor, the Ref's safety net would be gone — and this corpus goes
// red. The live dodge/fabrication itself is measured by the paid gate (the discovery
// instrument), not here. (docs/THE_REF.md §"Measurement".)
//
// Real NPC in dialogue_active: Mira Hearth (baker), present, mid-dialogue. NBIO-1
// (2026-07-02) gave every present NPC a grounded self-tenure fact (originTick) that
// commonKnowledgeAnswer now delivers on the second-person self-tenure phrasings it
// classifies (REF-003) — those are no longer declines, they're answers, which is the
// correct DM-test outcome (a real answer beats an honest decline). REF-001/002 keep
// testing the FALLBACK floor for phrasings the deterministic classifier does NOT
// catch (guest-ledger records, unusual tenure phrasing) — those still correctly
// deflect rather than fabricate.
//
// Honest-decline marker (the deflection bank): "Couldn't say. / lost to me / try
// someone / couldn't tell you / ask someone older". Fabrication markers excluded:
// any night-count, the word "vouched", and "Corwin" (the gate-16 #5 invention).

const HONEST_DECLINE = /couldn'?t say|couldn'?t tell|lost to me|don'?t (?:know|recall)|can'?t say|try someone|ask someone|no record/i;
const NO_ROLL = /\[roll:/;                                   // a deflected ask must not roll dice
const NO_FABRICATED_TENURE = /\b\d+\s+(?:years?|winters?|nights?)\b|\b(?:one|two|three|four|five|six|seven)\s+(?:years?|winters?|nights?)\b/i;
const NO_FABRICATED_VOUCH = /\bvouched\b|\bcorwin\b/i;        // gate-16 #5: "three nights, Corwin vouched"

export default [
  {
    // Target #1 (gate-19, [dialogue ask | continuity]) — the FALLBACK floor.
    // The atmosphere-dodge ("the village keeps its own tally of years") is the
    // LLM polishing this deflection; the Ref's job is to catch that and revert to
    // THIS clean honest-decline. Lock that the floor stays a clean decline.
    id: 'REF-001',
    capability: 'REF',
    status: 'locked',
    fixture: 'dialogue_active',
    intent: 'a tenure/continuity ask phrased outside NBIO-1\'s classifier → honest decline, never a roll or a fabricated duration (the floor the Ref falls back to)',
    paraphrases: [
      // "how long have you been here?" moved to REF-003 territory (2026-07-02):
      // NBIO-1's origin/tenure mode now classifies and ANSWERS it from the NPC's
      // own originTick — a real answer, not a decline. The remaining paraphrases
      // here are phrasings the classifier does not catch, so they still fall
      // through to the honest-decline floor.
      'how many years have you lived in this place?',
      'how long has this been your home?',
      'you been around these parts a while?',
    ],
    assert: {
      surface_matches: [HONEST_DECLINE],
      surface_excludes: [NO_ROLL, NO_FABRICATED_TENURE],
    },
    diverge: [
      { text: 'I attack Mira', reason: 'a declared action, not a tenure question — must not honest-decline' },
      { text: 'who are you?', reason: 'identity/acquaintance → C16 dialogue self, not a deflected tenure ask' },
    ],
    source: 'opus-gate-2026-06-23-gate19.md (Lore "how long have you been here?" → atmosphere dodge) — THE_REF target #1',
  },
  {
    // Target #3 (gate-16 #5, CANON_HALLUCINATION) — the anti-fabrication floor.
    // Live, the npc-voice invented "three nights, Corwin vouched"; LLM-off the
    // engine deflects. Lock that the deterministic fallback NEVER emits a
    // night-count, the word "vouched", or the invented sponsor "Corwin".
    id: 'REF-002',
    capability: 'REF',
    status: 'locked',
    fixture: 'dialogue_active',
    intent: 'an ask for a non-existent record (nights stayed / who vouched) → honest decline, never a fabricated count or sponsor name',
    paraphrases: [
      'recite the ledger — how many nights have I stayed, and who vouched for me?',
      'read me the register: how many nights, and who vouched?',
      'what does the guest-book say about my stay and my sponsor?',
      'how many nights have I been here, and who signed for me?',
      'tell me the exact count of nights and the name who vouched.',
    ],
    assert: {
      surface_matches: [HONEST_DECLINE],
      surface_excludes: [NO_ROLL, NO_FABRICATED_TENURE, NO_FABRICATED_VOUCH],
    },
    diverge: [
      { text: 'I attack Mira', reason: 'a declared action, not a records question' },
    ],
    source: 'opus-gate-2026-06-23-gate16.md (Lore "recite the ledger" → fabricated "three nights / Corwin vouched") — THE_REF target #3',
  },
  {
    // Target #2 (gate-19, [dialogue ask | place]) — the question-misroute, captured
    // as a TARGET (known gap, reported, does NOT fail the build). LLM-OFF these
    // origin/tenure questions that happen to contain a place-word ("here", "this
    // village") used to misroute to the place-topic recitation ("This is ….
    // Small, but it holds.") instead of addressing age/origin. NBIO-1 closed this
    // deterministically: commonKnowledgeAnswer's new origin/tenure mode (fires
    // before the place-blurb catch-all) answers from the addressed NPC's own
    // originTick, so this is now regex-closed, not judge-closed.
    id: 'REF-003',
    capability: 'REF',
    status: 'locked',
    fixture: 'dialogue_active',
    intent: 'an origin/age question containing a place-word addresses origin/tenure (from the NPC\'s own originTick), NOT the generic settlement blurb',
    paraphrases: [
      'have you been here long?',
      'did you grow up in this village?',
    ],
    assert: {
      // Engages the origin/tenure question — speaks to born-here / years / settling.
      surface_matches: [/couldn'?t say|lost to me|don'?t (?:know|recall)|born|grew up|years?|winters?|came (?:here|from)|settled|local|outsider/i],
      // …and does NOT fall back to the generic place-recitation bank.
      surface_excludes: [/small, but it holds|not much to tell/i],
    },
    source: 'opus-gate-2026-06-23-gate19.md (Lore "born here or arrived?" → place recitation) — THE_REF target #2, closed by NBIO-1 (2026-07-02)',
  },
];
