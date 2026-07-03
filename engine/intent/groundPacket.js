/**
 * groundPacket — deterministic grounding for an LLM-proposed IntentPacket.
 *
 * INT-2. The LLM (engine/intent/llmIntent.js) may PROPOSE a packet, but it never
 * gets to assert a fact about the scene — every id it names in target/targets[]/
 * objects[] must resolve against the REAL candidate set built from world state
 * (the same bundle assemblePacket.js's buildParseCtx gathers). Anything that
 * doesn't resolve is a HARD REJECT of that field (not a warning, not a soft
 * flag) — this is the "invented-id" failure mode the INT-2 benchmark measures,
 * and it must be exactly 0 in play.
 *
 * PURE: (proposedPacket, bundle) -> IntentPacket | null. No rng, no network,
 * no state mutation, no dice. Never throws — a malformed proposal degrades to
 * "did not survive grounding" (caller falls back to the deterministic packet).
 */

import { makeIntent, VERBS } from './intentSchema.js';
import { VERB_SYNONYMS } from './parseIntent.js';

// Normalize a name/id/ref for loose matching — case/space-insensitive, matches
// how assemblePacket's own entity list is built (name-or-id, role-or-null).
function norm(s) {
  return String(s ?? '').trim().toLowerCase();
}

// Build the set of ids/names/refs a grounded target/object may legally claim to
// be, from the same bundle assemblePacket.buildParseCtx already assembles.
function candidateSet(bundle) {
  const entities = Array.isArray(bundle?.entities) ? bundle.entities : [];
  const abilities = Array.isArray(bundle?.abilities) ? bundle.abilities : [];
  const spells = Array.isArray(bundle?.spells) ? bundle.spells : [];
  const items = Array.isArray(bundle?.items) ? bundle.items : [];

  const entityKeys = new Set();
  for (const e of entities) {
    if (!e) continue;
    if (e.id) entityKeys.add(norm(e.id));
    if (e.name) entityKeys.add(norm(e.name));
    if (e.ref) entityKeys.add(norm(e.ref));
  }

  const objectKeys = new Set();
  for (const a of abilities) if (a) objectKeys.add(norm(a));
  for (const s of spells) if (s) objectKeys.add(norm(s));
  for (const it of items) if (it) objectKeys.add(norm(it));
  // Objects may also legitimately name an entity (e.g. "the goblin" as a
  // physical-interaction match) — entities are valid objects too.
  for (const k of entityKeys) objectKeys.add(k);

  return { entityKeys, objectKeys };
}

// A single candidate id/name/ref resolves iff it (loosely) matches something
// real in the bundle. Empty/blank never resolves (nothing to ground).
function resolves(value, keys) {
  const v = norm(value);
  if (!v) return false;
  return keys.has(v);
}

// INT-2R — normalize a proposed verb TOKEN ("stab") to the canonical schema
// verb ("attack") through parseIntent.js's OWN VERB_SYNONYMS table — the same
// vocabulary the deterministic parser already uses, never a second one
// (Purity Rule: no parallel contract enum). Runs BEFORE makeIntent, which
// would otherwise silently coerce any unrecognized verb to 'ask' — this is
// what turned a correct "attack" reading into a wrong "ask" for llama3.1:8b
// in the 2026-07-03 benchmark (0% packet-match despite valid JSON every time).
// Already-canonical verbs pass through unchanged (no double-normalization);
// an unmatched token falls through untouched so makeIntent's own 'ask'
// fallback still applies exactly as before.
function normalizeVerb(verb) {
  const v = String(verb || '').trim().toLowerCase();
  if (!v) return v;
  if (VERBS.includes(v)) return v;
  for (const [canonical, re] of VERB_SYNONYMS) {
    if (re.test(v)) return canonical;
  }
  return v;
}

/**
 * groundPacket(proposed, bundle) -> IntentPacket | null
 *
 * `proposed` is the raw LLM-proposed packet fields (see llmIntent.js). `bundle`
 * is the same { entities, abilities, spells, items } shape assemblePacket's
 * buildParseCtx returns. Returns a fully-formed, source:'llm' IntentPacket if
 * the proposal survives grounding with its verb intact, or `null` if it does
 * not survive (caller must fall back to the deterministic packet, untouched).
 */
export function groundPacket(proposed, bundle) {
  try {
    if (!proposed || typeof proposed !== 'object') return null;
    const rawVerb = String(proposed.verb || '').trim();
    if (!rawVerb) return null; // no verb survives -> nothing to ground
    // Normalize a non-canonical-but-recognizable verb token ("stab" -> "attack")
    // through the SAME vocabulary parseIntent.js already uses — see normalizeVerb.
    const verb = normalizeVerb(rawVerb);

    const { entityKeys, objectKeys } = candidateSet(bundle);

    // target — hard reject (drop to null) if it doesn't resolve.
    const target = resolves(proposed.target, entityKeys) ? String(proposed.target) : null;

    // targets[] — keep only entries that resolve; invented ids are dropped,
    // never materialized, never surfaced as a warning.
    const targetsIn = Array.isArray(proposed.targets) ? proposed.targets : [];
    const targets = targetsIn.filter(t => resolves(t, entityKeys)).map(String);

    // objects[] — same hard-reject rule against the object/ability/spell/item/entity set.
    const objectsIn = Array.isArray(proposed.objects) ? proposed.objects : [];
    const objects = objectsIn.filter(o => resolves(o, objectKeys)).map(String);

    // `with` (instrument tag) — grounded against abilities/spells/items/entities too;
    // an invented weapon/spell name is dropped just like an invented target.
    const withTool = resolves(proposed.with, objectKeys) ? String(proposed.with) : null;

    // The verb survived (we returned above if not) — mark source:'llm' only now,
    // after every referent field has been checked against reality.
    const grounded = makeIntent({
      verb,
      target,
      targets,
      objects,
      with: withTool,
      at: proposed.at,
      approach: proposed.approach,
      stake: proposed.stake,
      text: proposed.text,
      compoundParts: Array.isArray(proposed.compoundParts) ? proposed.compoundParts : [],
      ambiguity: proposed.ambiguity,
      kind: proposed.kind,
      confidence: proposed.confidence,
      source: 'llm'
    });

    return grounded;
  } catch {
    // Grounding must never throw into the turn — a malformed proposal simply
    // fails to survive; the caller falls back to the deterministic packet.
    return null;
  }
}
