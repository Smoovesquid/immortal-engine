// C13 — Absurd/out-of-bounds input declines in-character; genuine creativity resolves.
// Lineage: IG-10; tryRidiculous; ridiculous-sarcasm-2026-06-06.md. See docs/CAPABILITY_LEDGER.md.
//
// Calibrated against live engine output 2026-06-20. Widened 2026-06-21 (H-67).
//
// KEY FINDINGS:
// - Celestial-body absurdities: "I swallow the sun whole" → "Sure you do. And I'm the Queen of the
//   Faeries. The sun stays its comfortable distance off..." [the DM is unmoved — nice try]
//   Consistent for sun/sky/pull-sun variants. "I eat the moon" → different phrasing but same tag.
//   "I inhale the atmosphere." → now caught by the inhale/breathe-in + atmosphere/sky pattern.
// - Grandiose boasts: "Give me a thousand gold" → "Gold doesn't rain down..." [the DM is unmoved]
//   "I declare I now own all the gold in the world." → now caught by the declare/own/all-the-gold pattern.
// - Meta takeover: "I'm the DM now" → "That's adorable. I'll keep this chair..." [the DM is unmoved]
//   "I delete the world." → fires the rules-rewrite decline.
//   "I rewrite the rules to give myself max HP." → just reports current HP (doesn't decline explicitly).
//   "I take control of the narrative." / "I'm taking over as dungeon master." → now caught by the
//   taking-over-as-DM and take-control-of-the-narrative patterns.
// - Genuine creativity: "I jam my daggers into the wall as pitons and climb it." → rolls WITS (resolves!)
//   All creativity phrasings either roll or get trivial action. Correctly NOT declined.
export default [
  // ---- LOCKED — impossible feat (celestial body) ----
  {
    id: 'C13-001',
    capability: 'C13',
    // "I swallow the sun whole", "I eat the moon", "I swallow the sky", "I reach up and pull the sun"
    // → consistent [the DM is unmoved — nice try] with sarcastic in-character decline.
    // "I eat the entire sun whole — it fits in my mouth." → same.
    // "I inhale the atmosphere." → rolls (falls through to generic action). → excluded from locked.
    status: 'locked',
    fixture: 'village_baker',
    intent: '"I swallow the sun whole" — must get an in-character dry decline, no roll, no time cost',
    paraphrases: [
      "I swallow the sun whole",
      "I eat the moon.",
      "I swallow the sky.",
      "I reach up and pull the sun out of the sky.",
      "I eat the entire sun whole — it fits in my mouth.",
      "I inhale the atmosphere.",
    ],
    assert: {
      surface_matches: [
        /the DM is unmoved|Queen of the Faeries|sun stays its comfortable|arms stay your arms|comfortable distance|unmoved/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /Nothing'?s happened yet/i,
        /which do you want to/i,
      ],
    },
    diverge: [
      { text: "I grab a torch from the wall and throw it at the rooftop.", reason: "unusual but physically possible; must resolve as an action, not decline" },
      { text: "I take a deep breath to calm myself.", reason: "in-fiction calming action; must resolve normally, not be declined as absurd" },
    ],
    source: 'ridiculous-sarcasm-2026-06-06.md [Evidence section]; calibrated 2026-06-20',
  },

  // ---- LOCKED — grandiose impossible boast (demand cosmic items) ----
  {
    id: 'C13-002',
    capability: 'C13',
    // "Give me a thousand gold and a legendary sword" → "Gold doesn't rain down..."
    // "Give me unlimited gold right now." → "Infinite anything, summoned by saying so..."
    // "I want a sword of infinite power." → "A sword of infinite power. Of course. Check your belt..."
    // "I demand a legendary weapon appear in my hands." → "Gold doesn't rain down..."
    // "grant me infinite gold..." → "Infinite anything..."
    // "I declare I now own all the gold in the world." → ROLLS (falls through). → target below.
    status: 'locked',
    fixture: 'village_baker',
    intent: '"give me a thousand gold and a legendary sword" — must decline in-character, not grant',
    paraphrases: [
      "Give me a thousand gold and a legendary sword",
      "Give me unlimited gold right now.",
      "I want a sword of infinite power.",
      "I demand a legendary weapon appear in my hands.",
      "grant me infinite gold and the strongest blade in existence",
      "I declare I now own all the gold in the world.",
    ],
    assert: {
      surface_matches: [
        /the DM is unmoved|unmoved|doesn.t rain down|Infinite anything|world didn.t get the memo|plain gear|no more.*no less/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /gold.*added|sword.*granted|legendary.*appeared/i,  // must not grant the request
      ],
    },
    diverge: [
      { text: "I want to buy a legendary sword from the merchant.", reason: "purchase intent with an in-world agent — possible if a merchant exists; must NOT be caught as ridiculous" },
      { text: "I'm the strongest fighter in this village.", reason: "personal boast with local scope; not a cosmic-scope ridiculous claim" },
      { text: "I go searching for buried treasure in the village.", reason: "in-fiction search action; should resolve, not be declined as absurd" },
    ],
    source: 'ridiculous-sarcasm-2026-06-06.md [Evidence section, meta-give family]; calibrated 2026-06-20',
  },

  // ---- LOCKED — meta / fourth-wall takeover ----
  {
    id: 'C13-003',
    capability: 'C13',
    // "I'm the DM now" → "That's adorable. I'll keep this chair, thanks. You're still Nyx..."
    // "I delete the world." → "The rules are not yours to rewrite from that chair. Everything stands..."
    // "I win. The game is over." → "You don't win by announcing it..."
    // These three core meta-takeover phrasings are locked.
    // "I rewrite the rules to give myself max HP." → just reports current HP (partial)
    // "I take control of the narrative." / "I'm taking over as dungeon master." → roll → target below.
    status: 'locked',
    fixture: 'village_baker',
    intent: '"I\'m the DM now" — must get in-character pushback, not a roll or a grant',
    paraphrases: [
      "I'm the DM now",
      "I delete the world.",
      "I win. The game is over.",
      "I take control of the narrative.",
      "I'm taking over as dungeon master.",
    ],
    assert: {
      surface_matches: [
        /the DM is unmoved|unmoved|That.s adorable|I.ll keep this chair|rules are not yours|doesn.t work|announcing it|wholly indifferent/i,
      ],
      surface_excludes: [
        /\[roll:/,
        /max HP.*updated|rules.*changed|world.*deleted/i,
        /Nothing.s happened yet/i,
      ],
    },
    diverge: [
      { text: "I am a powerful mage.", reason: "in-fiction character assertion; must resolve normally" },
      { text: "I am the new sheriff of this village.", reason: "in-fiction claim/deception; routes to social/deceive resolution" },
    ],
    source: 'ridiculous-sarcasm-2026-06-06.md [Evidence section, meta-DM family]; calibrated 2026-06-20',
  },

  // ---- LOCKED — genuine creativity must still resolve (daggers-as-pitons) ----
  {
    id: 'C13-004',
    capability: 'C13',
    // "I jam my daggers into the wall as pitons and climb it." → [roll:13 vs DC:12 → mixed] (resolves!)
    // "I use my belt as a rope and swing across the gap." → [roll:15 vs DC:13 → success]
    // "I wedge my boots into the mortar cracks and climb bare-handed." → [roll:20 NAT20 → success]
    // "I pack mud around the wound to stop the bleeding." → [roll:19 → success]
    // "I fold my cloak into a crude glider and jump." → rolls (failure but resolves)
    // "I stuff the crack with my wool scarf to block the draft." → rolls
    // ALL of these correctly fire a roll/resolution path — NOT the ridiculous-decline path.
    status: 'locked',
    fixture: 'empty_room',
    intent: 'an unusual but physically possible action must resolve in the fiction, not get declined as absurd',
    paraphrases: [
      "I jam my daggers into the wall as pitons and climb it.",
      "I use my belt as a rope and swing across the gap.",
      "I wedge my boots into the mortar cracks and climb bare-handed.",
      "I fold my cloak into a crude glider and jump.",
      "I pack mud around the wound to stop the bleeding.",
      "I stuff the crack with my wool scarf to block the draft.",
    ],
    assert: {
      surface_matches: [
        /\[roll:|trivial action|DC\s*\d+/i,   // some form of action resolution
      ],
      surface_excludes: [
        /the DM is unmoved|Queen of the Faeries|comfortable distance|unmoved/i,  // must NOT fire ridiculous-decline
        /That.s adorable/i,
        /doesn.t work that way/i,
        /wishlist/i,
      ],
    },
    diverge: [
      // NOTE: "I eat the wall" → trivial auto-success (engine misidentifies as food action).
      // "I climb the wall" → resolves with a roll — ALSO holds the signature.
      // Must use truly absurd inputs that produce [the DM is unmoved] (no roll, no DC).
      { text: "I swallow the sun whole.", reason: "physically impossible celestial-body absurdity; produces in-character decline, not a resolution roll" },
      { text: "Give me a thousand gold.", reason: "grandiose impossible boast; produces in-character decline, not a resolution roll" },
    ],
    source: 'IG-10 (IDEA_GARDEN.md); ridiculous-sarcasm-2026-06-06.md [False-positive guards section]; calibrated 2026-06-20',
  },
];
