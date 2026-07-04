// C25 — INT-4-HELD: an action WITH a held/present object resolves as the ACTION;
// possession is a PRECONDITION, never the resolution.
//
// Live sightings (Opus gate 2026-07-04-2 / -3, seed 'tallow', escape wake-room):
//   • "I hurl the lantern against the wall" → "the lantern is already tucked in your
//     pack" (a possession dodge — the throw silently never happened). ROOT: the
//     forced-into-harm assault branch stamped a name-shaped OBJECT ("the lantern") as
//     a no-target person-assault.
//   • "I grab the lantern off the wall and set the straw pallet on fire." → mech
//     [take:already-held | no roll]; the arson never resolved. ROOT: the acquire-
//     idempotence sink fired for a compound whose real head intent was an ACTION, and
//     the natural split arson phrasing "set X on fire" missed the fire ruling.
//
// fixture: held_object_room — the player is at their boot node with the standard escape
// kit; the node holds a burnable straw pallet, a (name-shaped) oil lantern, and an iron-
// bound chest. Interior cleared so objectsHere returns the furniture — the exact trap.
//
// status: 'locked' — the routing is entirely at the deterministic LLM-off floor
// (detectPhysicalAssault's object guard + the take-then-action bail + the material-aware
// fire ruling in playloop.js/llmPhysics.js), so the action-vs-possession decision is
// judge-free and replay-stable. Verified deterministically ×2 (mech byte-stable) and
// mirrored by unit tests U458/U459.
export default [
  {
    id: 'C25-001',
    capability: 'C25',
    status: 'locked',
    fixture: 'held_object_room',
    intent: 'a throw/hurl of a PRESENT OBJECT resolves as a real ACTION — a d20 roll against a DC — never a no-target assault and never a possession dodge ("already in your pack")',
    paraphrases: [
      'I hurl the lantern against the wall',
      'I throw the lantern at the wall',
      'hurl the oil lantern against the wall',
      'I hurl the chest against the wall',
      'throw the iron-bound chest at the wall',
      'I fling the lantern against the wall',
    ],
    assert: {
      // a throw is a physical attempt that ROLLS — the real resolution shape.
      surface_matches: [/roll:\d+\s+vs\s+DC:\d+/i],
      // NEVER a possession dodge, a no-target assault, or a silent take/observe of the object.
      surface_excludes: [/already\s+(?:in your pack|tucked|held)|no one here to lay hands on|\[no-target\]|you take the\b/i],
    },
    diverge: [
      { text: 'I pick up the lantern', reason: 'a PURE acquisition (no action verb) routes to the take/acquire path (a no-roll physics take), NOT the throw roll — the object-action bail must not swallow a genuine take' },
      { text: 'I examine the chest', reason: 'a look/examine stays an observation (no roll) — the fix must not turn inspection into an action-resolution' },
    ],
  },
  {
    id: 'C25-002',
    capability: 'C25',
    status: 'locked',
    fixture: 'held_object_room',
    intent: 'a compound "grab the lantern ... and set the straw pallet on fire" RESOLVES the arson through the material-aware fire ruling — the take is an implicit precondition, not the resolution',
    paraphrases: [
      'I grab the lantern off the wall and set the straw pallet on fire.',
      'grab the lantern and set the straw pallet on fire',
      'I take the lantern and light the straw pallet on fire',
      'grab the oil lantern off the wall and set the pallet ablaze',
      'I set the straw pallet on fire',
      'light the straw pallet on fire',
    ],
    assert: {
      // the arson reaches the fire ruling and the flame takes to the pallet.
      surface_matches: [/physics:[^|]*pallet/i, /flame|fire|smoke|burn|catch|alight|ablaze/i],
      // NEVER the acquire-idempotence dodge, and never resolved as a TAKE of the pallet.
      surface_excludes: [/take:already-held|already in your pack|you take the straw pallet/i],
    },
    diverge: [
      { text: 'I grab the lantern off the wall', reason: 'a bare grab of the lantern (no action) stays a pure take/acquire — the take-then-action bail keys on a TRAILING action verb, which this lacks' },
      { text: 'I look at the straw pallet', reason: 'observing the pallet must not ignite it — a look is not an arson' },
    ],
  },
];
