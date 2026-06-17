// Bestiary catalog — TRIVIAL tier (CR ≤ ~0.25).
//
// Placeholder restored to repair a broken import: commit 7841269 (CM11 —
// encounter spawning) added `import { trivial } from './catalog/trivial.js'`
// in engine/combat/encounterSpawn.js, but this module was never committed,
// leaving the whole engine unimportable (and the test suite red). Exported as
// an empty array so encounterSpawn falls back to the named BESTIARY_CATALOG.
// Populate with tier-appropriate creature defs (see goblin.js for the shape).

export const trivial = [];
