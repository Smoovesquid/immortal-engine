import { ensureWorld } from '../state.js';
import { addFact, addThreat, addQuestion } from '../ledger.js';

// CONDUCT contract JSON:
// { narration: "ONE sentence", deltas: { addFact, addThreat, addQuestion, clock, forceNextBeat } }

export function parseConductJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return { ok: false, reason: 'empty' };
  let obj;
  try { obj = JSON.parse(raw); } catch { return { ok: false, reason: 'invalid_json' }; }
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'not_object' };
  if (typeof obj.narration !== 'string') return { ok: false, reason: 'missing_narration' };
  if (!obj.deltas || typeof obj.deltas !== 'object') return { ok: false, reason: 'missing_deltas' };
  return { ok: true, value: obj };
}

export function applyConductDeltas(world, conductObj) {
  let w = ensureWorld(world);
  const d = conductObj?.deltas || {};
  const applied = [];

  // Guardrails: no direct narration mutation; this function only mutates world state.
  if (typeof d.addFact === 'string' && d.addFact.trim()) {
    if (!looksUnsafeText(d.addFact)) {
      w = addFact(w, d.addFact.trim(), 'ai');
      applied.push(`addFact:${d.addFact.trim()}`);
    } else {
      applied.push('drop:addFact');
    }
  }
  if (typeof d.addThreat === 'string' && d.addThreat.trim()) {
    if (!looksUnsafeText(d.addThreat)) {
      w = addThreat(w, d.addThreat.trim(), 2);
      applied.push(`addThreat:${d.addThreat.trim()}`);
    } else {
      applied.push('drop:addThreat');
    }
  }
  if (typeof d.addQuestion === 'string' && d.addQuestion.trim()) {
    if (!looksUnsafeText(d.addQuestion)) {
      w = addQuestion(w, d.addQuestion.trim());
      applied.push(`addQuestion:${d.addQuestion.trim()}`);
    } else {
      applied.push('drop:addQuestion');
    }
  }

  if (d.clock && typeof d.clock === 'object') {
    const keys = ['dread', 'pressure', 'revelation'];
    let clocks = { ...w.clocks };
    let any = false;
    for (const k of keys) {
      const by = Number(d.clock[k] ?? 0);
      if (![-1, 0, 1].includes(by)) continue;
      clocks[k] = clampInt((clocks[k] ?? 0) + by, 0, 12);
      if (by) any = true;
    }
    if (any) {
      w = { ...w, clocks };
      applied.push('clock');
    }
  }

  if (d.forceNextBeat === true) {
    // Only set a hint; sceneDirector enforces constraints; playloop clears on scene advance.
    const i = w.instrument || {};
    w = { ...w, instrument: { ...i, nextBeatOverride: 'confrontation' } };
    applied.push('forceNextBeat');
  }

  if (applied.length) {
    const t = w.timeline.length;
    w = { ...w, timeline: [...w.timeline, { t, kind: 'ai', data: { text: `[AI] applied: ${applied.join(', ')}` } }] };
  }

  return w;
}

function looksUnsafeText(s) {
  const x = String(s || '').toLowerCase();
  if (x.includes('actually') || x.includes('turns out')) return true;
  if (x.includes('[') || x.includes(']')) return true;
  if (/\bnot\b/.test(x)) return true;
  return false;
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
