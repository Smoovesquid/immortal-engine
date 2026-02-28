import { ensureWorld } from './state.js';
import { addFact, addThreat, addQuestion } from './ledger.js';
import { ensureEnv } from './env/envCore.js';

// Data-driven delta executor. Pure and deterministic.
// Applies a list of ops to the world safely (clamps, initializes missing fields).

export function applyDeltas(world, deltas = []) {
  let w = ensureWorld(world);
  const ops = Array.isArray(deltas) ? deltas : [];

  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    const kind = String(op.op || '');

    if (kind === 'clock') {
      const key = String(op.key || '');
      const by = toInt(op.by ?? 0);
      if (!key || !Number.isFinite(by) || by === 0) continue;
      const cur = w.clocks?.[key] ?? 0;
      const next = clampInt(cur + by, 0, 12);
      w = { ...w, clocks: { ...w.clocks, [key]: next } };
      continue;
    }

    if (kind === 'resource') {
      const entityId = String(op.entityId || '');
      const key = String(op.key || '');
      const by = toInt(op.by ?? 0);
      if (!entityId || !key || !Number.isFinite(by) || by === 0) continue;
      w = mutateEntity(w, entityId, (e) => {
        const resources = (e.resources && typeof e.resources === 'object') ? e.resources : {};
        const cur = toInt(resources[key] ?? 0);
        const next = clampInt(cur + by, 0, 999);
        return { ...e, resources: { ...resources, [key]: next } };
      });
      continue;
    }

    if (kind === 'wound') {
      const entityId = String(op.entityId || '');
      const by = toInt(op.by ?? 0);
      if (!entityId || !Number.isFinite(by) || by === 0) continue;
      w = mutateEntity(w, entityId, (e) => {
        const cur = clampInt(e.wounds ?? 0, 0, 6);
        const next = clampInt(cur + by, 0, 6);
        return { ...e, wounds: next };
      });
      continue;
    }

    if (kind === 'stress') {
      const entityId = String(op.entityId || '');
      const by = toInt(op.by ?? 0);
      if (!entityId || !Number.isFinite(by) || by === 0) continue;
      w = mutateEntity(w, entityId, (e) => {
        const cur = clampInt(e.stress ?? 0, 0, 6);
        const next = clampInt(cur + by, 0, 6);
        return { ...e, stress: next };
      });
      continue;
    }

    if (kind === 'condition') {
      const entityId = String(op.entityId || '');
      const add = String(op.add || '').trim();
      if (!entityId || !add) continue;
      w = mutateEntity(w, entityId, (e) => {
        const conditions = Array.isArray(e.conditions) ? e.conditions : [];
        if (conditions.some(c => String(c?.name) === add)) return e;
        const cond = { name: add, until: op.until ?? null };
        return { ...e, conditions: [cond, ...conditions].slice(0, 12) };
      });
      continue;
    }

    if (kind === 'position') {
      const entityId = String(op.entityId || '');
      const set = op.set && typeof op.set === 'object' ? op.set : null;
      if (!entityId || !set) continue;
      w = mutateEntity(w, entityId, (e) => {
        const prev = (e.position && typeof e.position === 'object') ? e.position : {};
        const next = { ...prev, ...set };
        if (next.zone) next.zone = clampZone(next.zone);
        return { ...e, position: next };
      });
      continue;
    }

    if (kind === 'time') {
      const key = String(op.key || '');
      const by = toInt(op.by ?? 0);
      if (!key || !Number.isFinite(by) || by === 0) continue;
      const cur = w.time?.[key] ?? 0;
      const next = clampInt(cur + by, 0, 999999);
      w = { ...w, time: { ...(w.time || { turn: 0, scene: 0 }), [key]: next } };
      continue;
    }

    if (kind === 'env') {
      const key = String(op.key || '');
      const by = toInt(op.by ?? 0);
      if (!key || !Number.isFinite(by) || by === 0) continue;
      const env = ensureEnv(w.env);
      if (!(key in env)) continue;
      const next = { ...env, [key]: clampInt(env[key] + by, 0, 6) };
      w = { ...w, env: next };
      continue;
    }

    if (kind === 'advantage') {
      const actorId = String(op.actorId || '');
      const by = toInt(op.by ?? 0);
      if (!actorId || !Number.isFinite(by) || by === 0) continue;
      const prior = (w.meta.advantageTokens && typeof w.meta.advantageTokens === 'object') ? w.meta.advantageTokens : {};
      const cur = clampInt(prior[actorId] ?? 0, 0, 2);
      const next = clampInt(cur + by, 0, 2);
      w = { ...w, meta: { ...w.meta, advantageTokens: { ...prior, [actorId]: next } } };
      continue;
    }

    if (kind === 'ledger') {
      if (op.addFact) w = addFact(w, op.addFact, op.source || 'resolution');
      if (op.addThreat) w = addThreat(w, op.addThreat, op.level ?? 1);
      if (op.addQuestion) w = addQuestion(w, op.addQuestion);
      continue;
    }

    if (kind === 'timeline') {
      const text = String(op.add || '').trim();
      if (!text) continue;
      const t = w.timeline.length;
      const e = { t, kind: 'note', data: { text } };
      w = { ...w, timeline: [...w.timeline, e] };
      continue;
    }
  }

  return w;
}

function mutateEntity(world, entityId, fn) {
  const party = Array.isArray(world.party) ? world.party : [];
  const idx = party.findIndex(e => String(e?.id) === entityId);
  if (idx === -1) return world;
  const nextParty = party.slice();
  nextParty[idx] = fn(nextParty[idx]);
  return { ...world, party: nextParty };
}

function toInt(x) {
  const n = Math.trunc(Number(x));
  return Number.isFinite(n) ? n : 0;
}

function clampZone(z) {
  const s = String(z);
  return (s === 'far' || s === 'near' || s === 'engaged') ? s : 'near';
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
