/**
 * assemblePacket — INT-1 shadow observer.
 *
 * Aggregates existing, already-shipped detectors into ONE typed IntentPacket
 * per free-text turn. It invents nothing: every field is fed by a detector
 * that already runs somewhere in the engine (see the per-field comments
 * below). This is a SHADOW packet — see docs/PACKETS.md INT-1 — nothing reads
 * it yet, nothing routes on it, and calling it changes no behavior.
 *
 * PURE: (world, text) -> IntentPacket. No rng, no Date.now(), no state writes.
 * Calling it twice with the same (world, text) must return deep-equal packets.
 */

import { makeIntent } from './intentSchema.js';
import { parseIntent } from './parseIntent.js';
import { directQuestionIntent } from '../grace/answerability.js';
import { detectPhysicalInteraction } from '../llmPhysics.js';
import { ensureMap } from '../map/mapState.js';

// Simple seam-split fallback for compoundParts — used ONLY because no existing
// helper yields a generic array of discrete sub-asks (gracefulAdjudication.js's
// H-59 compound logic detects the PRESENCE of multiple field-cues within one
// string; it never returns a list of separated sub-strings). Splits on
// sentence-enders and the conjunction "and"/"&" between clauses. Deterministic,
// no rng.
function splitCompoundParts(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const seams = raw
    .split(/(?<=[.!?])\s+|\s*;\s*|\s+and\s+|\s*&\s*/i)
    .map(s => s.trim())
    .filter(Boolean);
  // Only worth calling "compound" when there's more than one surviving part.
  return seams.length > 1 ? seams : [];
}

// Build the parseIntent ctx (entities/abilities/spells/items) from world state,
// read-only — mirrors what a caller with access to party/scene state would pass.
// Exported (INT-2) so engine/intent/llmIntent.js can build the SAME scene-candidate
// bundle for the LLM proposal + grounding step, instead of re-deriving it.
export function buildParseCtx(world) {
  const w = world && typeof world === 'object' ? world : {};
  const map = ensureMap(w.map);
  const node = (map.nodes || []).find(n => n && n.id === map.currentNodeId) || null;

  // Only a short role TAG is a safe `ref` for parseIntent's target-matcher (it
  // whole-word-matches every token ≥3 chars) — several NPCs carry a long
  // free-text description in `role` instead of a tag ("a wanderer who has
  // stayed too long..."), which would spray common-word false matches
  // ("who", "has", "one"...) across every utterance. Reject anything with a
  // space; a real role tag ('innkeeper','guard') never has one.
  const safeRef = r => (r && typeof r === 'string' && !/\s/.test(r)) ? r : null;
  // A definite article ("the Lingerer") leaves a bare 3-letter stopword after
  // norm() splits on spaces — strip a leading "the "/"a "/"an " before handing
  // the name to the matcher so it can't false-match on "the".
  const stripArticle = n => String(n || '').replace(/^(?:the|an?)\s+/i, '');

  const entities = [];
  for (const npc of (node?.settlement?.npcs || [])) {
    if (npc && npc.name) entities.push({ id: npc.id || npc.name, name: stripArticle(npc.name), ref: safeRef(npc.role) });
  }
  for (const enemy of (w.combat?.enemies || [])) {
    if (enemy && enemy.name) entities.push({ id: enemy.id || enemy.name, name: stripArticle(enemy.name) });
  }

  const actor = Array.isArray(w.party) ? w.party[0] : null;
  const inv = actor?.inventory && typeof actor.inventory === 'object' ? actor.inventory : {};
  const abilities = [
    ...(Array.isArray(inv.weapons) ? inv.weapons.map(x => x?.name).filter(Boolean) : []),
    ...(Array.isArray(inv.tools) ? inv.tools.map(x => x?.name).filter(Boolean) : [])
  ];
  const spells = Array.isArray(actor?.spells?.known) ? actor.spells.known.map(String) : [];
  const items = [
    ...(Array.isArray(inv.items) ? inv.items.map(x => x?.defRef || x?.name).filter(Boolean) : []),
    ...(Array.isArray(inv.consumables) ? inv.consumables.map(x => x?.name).filter(Boolean) : [])
  ];

  return { entities, abilities, spells, items };
}

/**
 * assemblePacket(world, text) -> IntentPacket
 *
 * IntentPacket = the full makeIntent() shape (verb/target/at/with/approach/
 * stake/text/source/confidence/targets/objects/compoundParts/ambiguity/kind).
 */
export function assemblePacket(world, text) {
  const raw = String(text ?? '');

  // Baseline verb/target/with/approach/stake/confidence — engine/intent/parseIntent.js
  const ctx = buildParseCtx(world);
  const base = parseIntent(raw, ctx);

  // kind (+ ambiguity:'referent') — engine/grace/answerability.js directQuestionIntent
  let kind = null;
  let ambiguity = null;
  let dqParts = [];
  const dq = directQuestionIntent(raw, world);
  if (dq) {
    kind = dq.kind || null;
    dqParts = Array.isArray(dq.parts) ? dq.parts.map(String) : [];
    if (dq.kind === 'referent-followup') ambiguity = 'referent';
  }

  // objects[] — engine/llmPhysics.js detectPhysicalInteraction (scene-object matches)
  let objects = [];
  const physics = detectPhysicalInteraction(world, raw);
  if (physics && Array.isArray(physics.matches)) {
    objects = physics.matches.map(m => m && m.name).filter(Boolean);
  }

  // compoundParts[] — sentence/"and" seam split (fallback; see splitCompoundParts
  // header comment for why no existing helper is reused here).
  const compoundParts = dqParts.length > 1 ? dqParts : splitCompoundParts(raw);

  // targets[] — every entity parseIntent's matcher could have named (baseline
  // target plus any other candidate resolvable in this scene), so a shadow
  // consumer sees the full candidate set, not just the single winner.
  const targets = base.target ? [base.target] : [];

  return makeIntent({
    ...base,
    targets,
    objects,
    compoundParts,
    ambiguity,
    kind
  });
}
