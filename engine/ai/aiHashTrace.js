/**
 * AI hash trace — pure trace-record builder for drift attribution.
 *
 * Research basis: OpenAI Agents SDK tracing (packet §14) + Priority 1 "canon
 * firewall". The point is auditability: when the world hash moves, you can point
 * at the exact model call that moved it. This builds the record; sinks persist it
 * (server: NDJSON via server/aiTrace.js; browser: console). PURE, no I/O.
 *
 * buildAiHashTrace({ worldBefore, worldAfter, mode, model, accepted, reason, applied })
 *   -> { mode, model, pre_hash, post_hash, hash_changed, accepted, reason, applied }
 *
 * pre_hash/post_hash are null when the corresponding world isn't supplied (e.g. a
 * propose-only call that doesn't mutate). hash_changed is null unless both hashes
 * are known. A non-mutating call (narration) should show pre===post, hash_changed
 * false — an accepted call with hash_changed true that *shouldn't* mutate is the
 * exact drift signal this exists to surface.
 */

import { worldHash } from '../worldHash.js';

export function buildAiHashTrace({
  worldBefore = null,
  worldAfter = null,
  mode = '',
  model = '',
  accepted = null,
  reason = null,
  applied = []
} = {}) {
  const pre = worldBefore ? worldHash(worldBefore) : null;
  const post = worldAfter ? worldHash(worldAfter) : null;
  return {
    mode: String(mode || ''),
    model: String(model || ''),
    pre_hash: pre,
    post_hash: post,
    hash_changed: (pre != null && post != null) ? (pre !== post) : null,
    accepted: accepted == null ? null : Boolean(accepted),
    reason: reason == null ? null : String(reason),
    applied: Array.isArray(applied) ? applied.map(String) : []
  };
}
