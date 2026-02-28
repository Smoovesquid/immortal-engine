import { ensureWorld } from './state.js';
import { seedFromString, makeRng } from './rng.js';
import { fateBand } from './rulesets.js';
import { ensureInstrumentLayer, introduceThread, escalateThread, resolveThread, reinforceMotif } from './instrument.js';

// AI Conductor Mode — Delta Orchestration Layer (V2)
// This does NOT generate narration.
// This does NOT mutate world directly (except via applyConductorDeltas).

export function conductorDecision(world, rng = null) {
  const w = ensureWorld(world);
  const inst = ensureInstrumentLayer(w.instrument);
  const band = fateBand(w.meta.fate);

  const r = rng || makeRng(seedFromString(`${w.meta.seed}|conductor|${w.scene.promptSeed}|${w.timeline.length}|${inst.inevitability}`));

  const openThreads = inst.threads
    .filter(t => t.status !== 'resolved')
    .slice()
    .sort((a, b) => (b.tension - a.tension) || a.label.localeCompare(b.label));

  const reinforced = inst.motifsCore?.reinforced || {};
  const activeMotifs = inst.motifsCore?.active || [];
  const heavyMotif = activeMotifs.find(m => (reinforced[m] ?? 0) >= 3) || '';

  const last3 = (inst.lastBeats || []).slice(0, 3);
  const clocks = w.clocks;

  const inevitabilityPressure = clamp01((inst.inevitability ?? 0) / 12);
  const fateBias = clamp01(w.meta.fate);
  const threadTensionBias = clamp01(openThreads.length ? (openThreads[0].tension / 5) : 0);

  const proposal = { deltas: [], rationale: '', weightProfile: { inevitabilityPressure, fateBias, threadTensionBias } };

  // If threads stagnating: escalate highest tension thread.
  if (openThreads.length) {
    const t0 = openThreads[0];
    const stagnating = t0.tension <= 2 && inevitabilityPressure >= 0.4;
    const shouldEscalate = (t0.tension >= 3) || stagnating || (r.nextFloat() < (0.25 + inevitabilityPressure * 0.4));
    if (shouldEscalate) {
      proposal.deltas.push({ type: 'escalateThread', id: t0.id });
      proposal.rationale = `Escalate: ${t0.label}`;
    }

    // If tension is high, force confrontation beat.
    if (t0.tension >= 4 || inevitabilityPressure >= 0.75) {
      proposal.deltas.push({ type: 'forceBeat', beatType: 'confrontation' });
    }
  } else {
    // No threads: introduce one deterministically.
    const label = band === 'blood'
      ? 'the world wants a price'
      : band === 'grim'
      ? 'progress invites pursuit'
      : 'help appears with strings';
    proposal.deltas.push({ type: 'introduceThread', label });
    proposal.rationale = 'Introduce a new thread to avoid drift.';
  }

  // If motif reinforced >=3: propose callback.
  if (heavyMotif) {
    proposal.deltas.push({ type: 'reinforceMotif', motif: heavyMotif });
  }

  // If inevitability high: weight escalation + confrontation beats.
  if (inevitabilityPressure >= 0.67) {
    proposal.deltas.push({ type: 'increaseClock', clock: pickClockByPressure(clocks, r) });
  }

  // Fate > 0.7: increase consequence severity weighting (implemented as clock pressure bump).
  if (fateBias > 0.7 && r.nextFloat() < 0.4) {
    proposal.deltas.push({ type: 'spawnConsequence', severity: band === 'blood' ? 3 : 2 });
  }

  // Beat memory: avoid 3x in a row.
  if (last3.length >= 2 && last3[0] === last3[1]) {
    proposal.deltas.push({ type: 'forceBeat', beatType: nextBeat(last3[0]) });
  }

  if (!proposal.rationale) proposal.rationale = 'Apply gentle pressure toward coherence.';
  return proposal;
}

export function applyConductorDeltas(world, proposal, { mode = 'conductor' } = {}) {
  let w = ensureWorld(world);
  const inst = ensureInstrumentLayer(w.instrument);
  const p = proposal && typeof proposal === 'object' ? proposal : { deltas: [] };
  const deltas = Array.isArray(p.deltas) ? p.deltas : [];

  const applied = [];
  let nextInst = inst;

  for (const d of deltas) {
    if (!d || typeof d !== 'object') continue;
    const type = String(d.type || '');

    if (type === 'introduceThread') {
      if (mode === 'conductor') {
        w = introduceThread(w, d.label);
        nextInst = ensureInstrumentLayer(w.instrument);
      }
      applied.push(`[CONDUCTOR] introduce thread: ${String(d.label)}`);
      continue;
    }

    if (type === 'escalateThread') {
      const id = String(d.id || '');
      if (mode === 'conductor') {
        w = escalateThread(w, id);
        nextInst = ensureInstrumentLayer(w.instrument);
      }
      applied.push(`[CONDUCTOR] escalated thread ${id}`);
      continue;
    }

    if (type === 'resolveThread') {
      const id = String(d.id || '');
      if (mode === 'conductor') {
        w = resolveThread(w, id);
        nextInst = ensureInstrumentLayer(w.instrument);
      }
      applied.push(`[CONDUCTOR] resolved thread ${id}`);
      continue;
    }

    if (type === 'reinforceMotif') {
      const motif = String(d.motif || '').trim();
      if (motif && mode === 'conductor') {
        w = reinforceMotif(w, motif, 1);
        nextInst = ensureInstrumentLayer(w.instrument);
      }
      applied.push(`[CONDUCTOR] reinforce motif: ${motif}`);
      continue;
    }

    if (type === 'increaseClock') {
      const clock = String(d.clock || 'pressure');
      if (mode === 'conductor') {
        const cur = w.clocks?.[clock] ?? 0;
        const next = Math.min(12, Math.max(0, cur + 1));
        w = { ...w, clocks: { ...w.clocks, [clock]: next } };
      }
      applied.push(`[CONDUCTOR] increased clock: ${clock}`);
      continue;
    }

    if (type === 'forceBeat') {
      const beatType = String(d.beatType || '').trim();
      if (beatType && mode === 'conductor') {
        // Store override in instrument (safe field).
        const i2 = ensureInstrumentLayer(w.instrument);
        w = { ...w, instrument: { ...i2, nextBeatOverride: beatType } };
      }
      applied.push(`[CONDUCTOR] force beat: ${beatType}`);
      continue;
    }

    if (type === 'spawnConsequence') {
      const sev = clampInt(d.severity ?? 1, 1, 3);
      if (mode === 'conductor') {
        const cur = w.clocks.pressure ?? 0;
        w = { ...w, clocks: { ...w.clocks, pressure: Math.min(12, cur + sev) } };
      }
      applied.push(`[CONDUCTOR] spawn consequence severity:${sev}`);
      continue;
    }
  }

  // Advisory mode: log only, no state change.
  const w2 = (mode === 'conductor') ? w : ensureWorld(world);

  // Log timeline entry.
  if (applied.length) {
    const t = w2.timeline.length;
    const e = { t, kind: 'conductor', data: { lines: applied, rationale: String(p.rationale || '') } };
    return { ...w2, timeline: [...w2.timeline, e] };
  }

  return w2;
}

function pickClockByPressure(clocks, rng) {
  const p = clocks.pressure ?? 0;
  const d = clocks.dread ?? 0;
  const r = clocks.revelation ?? 0;
  // Prefer the largest.
  if (d >= p && d >= r) return 'dread';
  if (p >= d && p >= r) return 'pressure';
  return 'revelation';
}

function nextBeat(beat) {
  const rhythm = ['quiet', 'escalation', 'reveal', 'confrontation'];
  const i = rhythm.indexOf(String(beat));
  return rhythm[(i + 1 + rhythm.length) % rhythm.length];
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function clamp01(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
