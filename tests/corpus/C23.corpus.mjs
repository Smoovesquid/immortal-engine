// C23 — PERC-1: a failed perception read renders uncertainty, never a confident,
// possibly-invented report. Opus gate 2026-07-04 (Chaos-griefer, CRUNCH_INCONSISTENCY):
// "Wait — is the ceiling still on fire or not? I stand in the middle of the room and
// look up." rolled a NATURAL 1 vs DC 13 (failure) yet the DM answered with a definitive,
// confident, ACCURATE all-clear ("plain wattle-and-daub… no trace of flame or scorch").
// The engine's room model carries no fire/hazard/structural-damage field at all, so that
// specific claim — true OR false — was invented outright by the narration layer. A real
// DM who fails a perception roll does not get to report back with total confidence
// (THE_DM_TEST). fixture: empty_room (a bare interior with no canon fire/hazard fact
// either way — any confident assertion about it, positive or negative, is an invention).
//
// status: 'target' — the deterministic floor (hedgedPerceptionRead,
// engine/grace/gracefulAdjudication.js) is implemented and unit-tested (U448/U449), but
// wiring it into playloop.js's `grounded` chain is a SIBLING LANE's file this session
// (engine/playloop.js hard-fenced). Promote to 'locked' once the patch block in this
// packet's report lands.
export default [
  {
    id: 'C23-001',
    capability: 'C23',
    status: 'target',
    fixture: 'empty_room',
    intent: 'a FAILED (non-crit) perception recheck of an untracked environmental/structural condition renders a hedged, incomplete read — never a confident, invented all-clear or hazard-confirmation',
    paraphrases: [
      'Wait — is the ceiling still on fire or not? I stand in the middle of the room and look up.',
      'I look up at the ceiling.',
      'Is the fire still burning up there? I check.',
      'I glance up to see if the roof is still smoldering.',
      'I peer up at the rafters to check if the flame is still there.',
    ],
    assert: {
      // hedges — doubt/incompleteness present, in some grounded form.
      surface_matches: [/can'?t\s+(?:tell|make\s+out|say)\b|murky|uncertain|haze|honestly/i],
      // never a confident, invented verdict in EITHER direction, and never the
      // literal invented gate phrasing.
      surface_excludes: [/no\s+trace\s+of|wattle-and-daub|dry\s+and\s+unburnt|definitely|clearly\s+(?:is|isn'?t|not)|confirmed|without\s+(?:a\s+)?doubt/i],
    },
    diverge: [
      { text: 'search the room', reason: 'a search action is owned by nonObjectSkillOutcome\'s honest-search grammar (baf1b51) — a different capability, not this hedge' },
      { text: 'is the door still locked?', reason: 'tracked mechanical state (lockState) — must stay grounded/confident, never hedged; this hedge is scoped to UNTRACKED environmental conditions only' },
      { text: 'look around', reason: 'a bare room survey is owned by isExploreIntent\'s free no-roll path — never reaches a roll, so never reaches this hedge' },
    ],
  },
  {
    id: 'C23-002',
    capability: 'C23',
    status: 'target',
    fixture: 'empty_room',
    intent: 'a CRIT-FAIL (natural 1) perception recheck renders MORE disorientation than an ordinary miss, but still asserts NO false canonical fact in either direction (no false all-clear, no false hazard-confirmation)',
    paraphrases: [
      'Wait — is the ceiling still on fire or not? I stand in the middle of the room and look up.',
    ],
    assert: {
      surface_matches: [/can'?t\s+make\s+out\s+anything\s+for\s+certain|could\s+be\s+nothing,\s+could\s+be\s+something/i],
      surface_excludes: [/no\s+trace\s+of|wattle-and-daub|unburnt|yes,?\s+it'?s\s+(?:still\s+)?(?:burning|on\s+fire)|still\s+ablaze|confirmed\s+burning/i],
    },
    diverge: [
      { text: 'I search the room carefully', reason: 'the honest-search SUCCESS branch (baf1b51) is a sibling capability and must render its own accurate, room-grounded read — never this hedge (see U449-04 regression guard for the deterministic seed proof)' },
    ],
  },
];
