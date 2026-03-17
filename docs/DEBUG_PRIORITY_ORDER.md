# DEBUG_PRIORITY_ORDER.md

## Debugging Priority Order (Dependency-Based)

### 1) Canonical State Correctness
Engine truth must be correct before anything else.
Examples:
- actor position not mutating
- world/state hash inconsistent
- state transition missing
- event/log commit mismatch

### 2) Movement and Action Resolution
Commands must produce correct canonical state.
Examples:
- move command reports success but position unchanged
- adjacency rule failure
- travel transition incorrect
- entering location does not update state

### 3) Spatial / World-Scale Translation
Coordinate systems must translate correctly between world, region, and local field.
Examples:
- 10,000-foot map scale incorrect
- world→local coordinate conversion wrong
- hex/grid scale mismatch

### 4) Scene / Position Coherence
Scene system must reflect the player’s canonical location.
Examples:
- player position changes but scene not updated
- wrong node/scene active
- location anchor stale

### 5) Projection / Render Layer
UI must correctly visualize engine state.
Examples:
- player marker not updating
- stale render
- wrong coordinate projection
- redraw timing errors

### 6) Persistence / Replay
Save, load, and replay must preserve canonical state.

### 7) AI/Text Description Alignment
Narrative output must reflect engine state.

### 8) Playability / Polish
Clarity, map readability, pacing, and UX improvements.

## Triage Rule
For every incident ask:

"If this layer is wrong, can higher layers still be trusted?"

If the answer is no, treat the issue as higher priority.

## Operational Rule
Never patch projection/render symptoms until canonical state, movement resolution, and spatial translation have been verified.
