// CG-ARCH corpus — MR-2b: LOCKS the wake cottage's REAL architecture against the
// invented-geometry detector (engine/coherence/checks.js detectArchitectureDesync).
//
// The wake cottage (seed `tallow`, the game's default cold-open) is a SINGLE-STOREY
// 3-room cottage — verified live 2026-07-05:
//     Hearth Room (entry)  ·  Bedchamber (where you wake)  ·  Pantry
//     front door: canon, opens outward from the Hearth Room
//     interior doors: canon; default open (you don't bar your own home)
// It has NO cellar, NO attic, NO loft, NO staircase, NO upper floor. This corpus
// pins that ground truth line-by-line so a future change to room naming, the
// roomPlan bundle, or the detector can't silently start (a) flagging the cottage's
// OWN rooms/doors as invented, or (b) letting an invented staircase through.
//
// status: 'locked' — CG-ARCH is a pure, deterministic, LLM-free comparator over the
// roomPlan ground truth (rubric.js buildCanonGroundTruth), so every row is replay-
// stable and judge-free. Consumed by tests/U509 (which boots the real cottage and
// asserts roomPlan matches this roster).
//
// FILENAME NOTE: this is a COHERENCE-detector corpus (DM lines judged against the
// roomPlan ground truth), NOT an intent-eval corpus. It deliberately uses the
// `.fixture.mjs` suffix, NOT `.corpus.mjs`, so the intent-convergence runner
// (scripts/convergence/runCorpus.mjs, which recurses tests/corpus/**/*.corpus.mjs
// and validates the intent-eval schema — capability/paraphrases/assert) does not
// load it under the wrong schema. Its only consumer is the coherence test above.
//
// Shape: each row is { id, kind: 'legal' | 'invented', dm, why }. `legal` lines MUST
// NOT flag CG-ARCH against the cottage's real roomPlan; `invented` lines MUST flag.
// The canon fixture every row is judged against:
export const WAKE_COTTAGE_PLAN = Object.freeze({
  rooms: ['Hearth Room', 'Bedchamber', 'Pantry'],
  singleStorey: true,
});
export const WAKE_COTTAGE_INTERIOR = Object.freeze({ roomId: 'r2', roomName: 'Bedchamber' });

export default [
  // ── LEGAL — the cottage's REAL rooms (must never flag) ─────────────────────
  { id: 'CGARCH-L01', kind: 'legal',
    dm: 'The hearth room opens ahead, warm with the last of the banked coals.',
    why: 'Hearth Room is the cottage entry — a real room of the roster.' },
  { id: 'CGARCH-L02', kind: 'legal',
    dm: 'Back in the bedchamber, the straw pallet still holds the shape of you.',
    why: 'Bedchamber is where the player woke — the current room.' },
  { id: 'CGARCH-L03', kind: 'legal',
    dm: 'You step into the pantry, shelves crowding close with crocks and sacks.',
    why: 'Pantry is the third real room of the cottage.' },

  // ── LEGAL — the FRONT DOOR, canon and perceivable (must never flag) ────────
  { id: 'CGARCH-L04', kind: 'legal',
    dm: 'The front door stands open to the lane, grey daylight spilling across the boards.',
    why: 'The front door is canon (MR-2a) — naming it and its state is grounded, not invented.' },

  // ── LEGAL — a LOCKED/BARRED door in TEXTURE words (must never flag) ─────────
  // The one locked-door line the brief asks the corpus to lock: a secured door is
  // real play, not invented architecture. The texture ("stands barred", "is locked
  // fast") is what interiorPlanFacts feeds the DM prompt; naming it is grounded.
  { id: 'CGARCH-L05', kind: 'legal',
    dm: 'The pantry door stands barred from the far side; the bar will not lift from here.',
    why: 'A barred canon door is a real obstacle, not invented space — it names a door of the plan.' },

  // ── LEGAL — the DM DENYING invented space (the WB-Q1 fix working) ───────────
  { id: 'CGARCH-L06', kind: 'legal',
    dm: 'There is no staircase here — this is a single-storey cottage, and no way leads up.',
    why: 'Denying invented vertical space is the WB-Q1 fix, never a violation.' },
  { id: 'CGARCH-L07', kind: 'legal',
    dm: 'You look for a cellar, but the floor is packed earth; there is no way down.',
    why: 'Denying a cellar is correct DM behaviour for a cottage that has none.' },

  // ── LEGAL — pure mood/atmosphere (no architecture noun) ────────────────────
  { id: 'CGARCH-L08', kind: 'legal',
    dm: 'Shadowed alcoves and dim corners swallow the lantern light at the far end of the room.',
    why: 'Mood language with no architecture noun — must stay legal (precision).' },

  // ── INVENTED — the WB-Q1 root class (must flag CG-ARCH) ────────────────────
  { id: 'CGARCH-I01', kind: 'invented',
    dm: 'A narrow staircase climbs to the upper floor above, where sleeping quarters wait.',
    why: 'THE archetypal WB-Q1 soft-lock: a staircase + upper floor a single-storey cottage cannot have.' },
  { id: 'CGARCH-I02', kind: 'invented',
    dm: 'The cellar lies down a short flight of steps beyond this room, barrels breathing cold.',
    why: 'An invented cellar below a cottage with no basement.' },
  { id: 'CGARCH-I03', kind: 'invented',
    dm: 'You cross into the kitchen, where a great range roars and pots hang from iron hooks.',
    why: 'The cottage has a Hearth Room, not a "kitchen" room — an invented named room.' },
  { id: 'CGARCH-I04', kind: 'invented',
    dm: 'A ladder leads up to the loft where the family sleeps under the thatch.',
    why: 'An invented loft — vertical space the single-storey plan lacks.' },
];
