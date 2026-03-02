# ENGINE FREEZE CONTRACT v1.0

## Status
Engine substrate declared frozen for MVP track.

## Frozen Contracts

### 1. Canon Event Schema
- No new canonical event types without new Victory Gate.
- CanonLog remains authoritative.
- Event validation enforced via allowlist.

### 2. WorldHash Contract
- worldHash is a function of canonical surface only.
- Identical canonical surface => identical worldHash.
- No non-deterministic inputs permitted.

### 3. Save / Export Format
- exportWorld format version: 1
- Changes require version bump.
- Backward compatibility required.

### 4. Deterministic Replay
- Same seed + same transcript => identical canon + worldHash.
- Ending lock prevents post-ending mutation.
- Sequel derivation deterministic from chronicle.

### 5. Mutation Rules
- No hidden mutation.
- All state transitions must emit canonical events or explicit deltas.
- No direct in-place world mutation during simulation.

## Stop Condition
Any violation of above invalidates freeze and requires formal gate reset.
