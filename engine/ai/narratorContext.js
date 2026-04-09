/**
 * N1 — Narrator Context Builder
 *
 * Assembles everything the AI narrator is allowed to know.
 * Canonical facts only — no invented detail.
 * Pure function: no world mutation, no API calls.
 */

import { ensureWorld } from '../state.js';

/**
 * buildNarratorContext(world, outcome) → NarratorContext
 *
 * @param {object} world   — canonical world state
 * @param {object} outcome — result of the last engine action (from playloop)
 * @returns {NarratorContext}
 */
export function buildNarratorContext(world, outcome = {}) {
  const w = ensureWorld(world);

  // ── Place ─────────────────────────────────────────────────────────────
  const nodeId      = String(w.map?.currentNodeId ?? '');
  const currentNode = (w.map?.nodes ?? []).find(n => n.id === nodeId) ?? null;
  const placeName   = String(currentNode?.name ?? 'Unknown');
  const nodeType    = String(currentNode?.nodeType ?? 'wilderness');

  // ── Structures at this node ───────────────────────────────────────────
  const allStructures = Object.values(w.structures?.byId ?? {});
  const structuresHere = allStructures
    .filter(s => s?.nodeId === nodeId || s?.anchors?.nodeId === nodeId)
    .map((s, i) => ({ index: i + 1, kind: String(s.kind ?? 'structure') }));

  // ── Interior state ────────────────────────────────────────────────────
  const interior = (w.scene?.interior && typeof w.scene.interior === 'object')
    ? { structureKey: String(w.scene.interior.structureKey ?? ''), roomId: String(w.scene.interior.roomId ?? '') }
    : null;

  // ── Pack tone ─────────────────────────────────────────────────────────
  // toneWords live on the resolved pack, passed separately via outcome or world
  const toneWords = outcome?.pack?.toneWords ?? w._resolvedPack?.toneWords ?? null;
  const tone = deriveTone(toneWords, w.meta?.fate);

  // ── Scene context ─────────────────────────────────────────────────────
  const location  = String(w.scene?.location  ?? placeName);
  const objective = String(w.scene?.objective ?? '');

  // ── Last action ───────────────────────────────────────────────────────
  const actionText    = String(outcome?.input  ?? outcome?.text ?? '');
  const mechanicsText = String(outcome?.mechanics ?? '');

  return {
    placeName,
    nodeType,
    location,
    objective,
    structuresHere,
    interior,
    tone,
    actionText,
    mechanicsText,
    fate: Number(w.meta?.fate ?? 0.5)
  };
}

/**
 * Derive a single tone label from pack toneWords + fate.
 * Returns 'blood' | 'grim' | 'cooperative'
 */
function deriveTone(toneWords, fate) {
  const f = Number(fate ?? 0.5);
  if (!toneWords || typeof toneWords !== 'object') {
    return f >= 0.7 ? 'blood' : f >= 0.4 ? 'grim' : 'cooperative';
  }
  if (f >= 0.7 && Array.isArray(toneWords.blood)  && toneWords.blood.length)  return 'blood';
  if (f >= 0.4 && Array.isArray(toneWords.grim)   && toneWords.grim.length)   return 'grim';
  return 'cooperative';
}
