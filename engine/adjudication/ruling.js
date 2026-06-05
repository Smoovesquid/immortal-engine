// Ruling — proposal, validation, logging for adjudication engine
// Captures the decision so replay re-runs the ruling, not the AI

import { ensureWorld } from '../state.js';
import { applyDeltas } from '../effectsCore.js';
import { query } from '../objects/query.js';
import { outcomes } from '../objects/outcomes.js';
import { validateDeltas } from '../llmPhysics.js';
import { templates } from './templates.js';

// Proposal: what should happen?
export function proposeRuling(world, intent) {
  const w = ensureWorld(world);

  // Simple heuristic: map intent to approach
  const text = String(intent || '').toLowerCase();
  let approach = 'force';
  if (/finesse|lock|pick|delicate|careful/.test(text)) approach = 'finesse';
  if (/endure|resist|tough|survive/.test(text)) approach = 'endure';
  if (/convince|persuade|charm|talk|negotiate/.test(text)) approach = 'heart';
  if (/remember|sense|perceive|understand|study/.test(text)) approach = 'focus';

  // DC: base 10, modified by approach
  const dcBase = 10;
  const dcMods = { force: 0, finesse: 2, endure: -1, heart: 1, focus: 2 };
  const dcSuggestion = Math.max(5, Math.min(20, dcBase + (dcMods[approach] || 0)));

  return {
    plausible: true,
    approach,
    dcSuggestion,
    narrative: '' // filled in narration phase
  };
}

// Validation: is this ruling legal?
export function validateRuling(world, proposal, deltas = []) {
  const w = ensureWorld(world);

  // 1. Check proposal shape
  if (!proposal || typeof proposal !== 'object') {
    return { ok: false, reason: 'proposal-missing' };
  }

  if (typeof proposal.approach !== 'string') {
    return { ok: false, reason: 'approach-missing' };
  }

  if (typeof proposal.dcSuggestion !== 'number') {
    return { ok: false, reason: 'dc-missing' };
  }

  // 2. Validate deltas
  const validated = validateDeltas(deltas, w);
  if (!validated.ok) {
    return { ok: false, reason: `delta-invalid: ${validated.reason}` };
  }

  // 3. Check DC range
  if (proposal.dcSuggestion < 5 || proposal.dcSuggestion > 20) {
    return { ok: false, reason: 'dc-out-of-range' };
  }

  return { ok: true, deltas: validated.deltas };
}

// Logging: capture the ruling for replay
export function logRuling(world, ruling = {}) {
  const w = ensureWorld(world);
  const t = w.timeline.length;

  const entry = {
    t,
    kind: 'ruling',
    data: {
      action: String(ruling.action || 'unknown action'),
      approach: String(ruling.approach || 'force'),
      targetId: String(ruling.targetId || ''),
      dcSuggestion: Number(ruling.dcSuggestion ?? 10),
      roll: Number(ruling.roll ?? 0),
      modifier: Number(ruling.modifier ?? 0),
      outcome: String(ruling.outcome || 'mixed'), // success, mixed, failure
      deltas: Array.isArray(ruling.deltas) ? ruling.deltas : [],
      narrativeOverride: ruling.narrative || null
    }
  };

  return {
    ...w,
    timeline: [...w.timeline, entry]
  };
}

// Compute outcome from roll vs DC
export function computeOutcome(roll, modifier, dcSuggestion) {
  const total = (roll || 0) + (modifier || 0);
  if (total >= (dcSuggestion || 10)) return 'success';
  if (total >= (dcSuggestion || 10) - 5) return 'mixed';
  return 'failure';
}

// Execute a ruling: apply deltas + log it
export function applyRuling(world, ruling) {
  const w = ensureWorld(world);

  // Apply deltas first
  let w1 = applyDeltas(w, ruling.deltas || []);

  // Then log the ruling
  w1 = logRuling(w1, ruling);

  return w1;
}

export const ruling = {
  proposeRuling,
  validateRuling,
  logRuling,
  computeOutcome,
  applyRuling
};
