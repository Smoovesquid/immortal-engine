import { ensureWorld } from './state.js';
import { makeRng, seedFromString } from './rng.js';
import { fateBand } from './rulesets.js';
import { consequenceWeight } from './instrument.js';
import { scoreInventorySignals } from './gear/gearProps.js';

// Universal resolution mechanic (v1).
// resolveMove(world, move) -> { world2, result }
// NOTE: world2 is returned unchanged; canon mutations are expressed as delta ops in result.deltas.

export function resolveMove(world, move) {
  const w = ensureWorld(world);
  const m = normalizeMove(move);

  const band = fateBand(w.meta.fate);
  const clocks = w.clocks;

  const actor = findActor(w, m.actorId);
  const gearSignals = scoreInventorySignals(actor);

  const dc = computeDC({ w, m, band, gearSignals });
  const seed = seedFromString(`${w.meta.seed}|resolve|${w.scene.promptSeed}|${w.timeline.length}|${m.actorId}|${m.intentText}|${m.approachTag}|${m.stakeTag}|${m.targetId||''}|${m.toolTag||''}`);
  const rng = makeRng(seed);

  let roll = rng.int(1, 20);

  // Stat modifier (genre-agnostic): map approach -> stat.
  const statKey = statForApproach(m.approachTag);
  const statVal = actor?.stats?.[statKey];
  const statBonus = statMod(statVal);
  roll = clampInt(roll + statBonus, 1, 30);

  // Advantage (0..2): global rule = +2 to roll, deterministic trigger.
  const advNow = clampInt((w.meta.advantageTokens?.[m.actorId] ?? 0), 0, 2);
  let usedAdvantage = false;
  if (advNow > 0) {
    // Spend if it turns a fail into mixed/success (or improves margin).
    const margin0 = roll - dc;
    if (margin0 < 0) {
      roll = clampInt(roll + 2, 1, 30);
      usedAdvantage = true;
    }
  }

  const margin = roll - dc;

  const outcome = classifyOutcome({ band, margin, rng });

  const { gains, costs, deltas } = buildDeltas({ w, m, band, outcome, margin, rng, usedAdvantage, gearSignals });

  const mechanicsLine = buildMechanicsLine({ roll, dc, outcome, m, margin, usedAdvantage, statKey, statBonus });

  const result = {
    outcome,
    roll,
    dc,
    margin,
    gains,
    costs,
    deltas,
    mechanicsLine
  };

  return { world2: w, result };
}

function statForApproach(approachTag) {
  const a = String(approachTag || '');
  if (a === 'force') return 'MIGHT';
  if (a === 'finesse') return 'AGILITY';
  if (a === 'endure') return 'GRIT';
  if (a === 'heart') return 'CHARM';
  return 'WITS';
}

function statMod(n) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return 0;
  return clampInt(Math.floor((x - 10) / 2), -4, 6);
}

function normalizeMove(move) {
  const x = move && typeof move === 'object' ? move : {};
  return {
    actorId: String(x.actorId ?? 'party'),
    intentText: String(x.intentText ?? '').trim(),
    approachTag: String(x.approachTag ?? 'focus'),
    risk: clamp01(x.risk ?? 0.5),
    stakeTag: String(x.stakeTag ?? 'time'),
    targetId: x.targetId ? String(x.targetId) : null,
    toolTag: x.toolTag ? String(x.toolTag) : null
  };
}

function computeDC({ w, m, band, gearSignals }) {
  // Base DC is subtly influenced by fate, clocks, and wounds/stress.
  const fate = clamp01(w.meta.fate);
  const clockPressure = w.clocks.pressure ?? 0;
  const dread = w.clocks.dread ?? 0;
  const revelation = w.clocks.revelation ?? 0;

  const base = 10 + Math.round(fate * 3); // 10..13
  const clockBump = Math.floor(clockPressure / 4) + Math.floor(dread / 5) + Math.floor(revelation / 6);

  // Dread increases effective risk slightly (gravity).
  const dreadRisk = clamp01(m.risk + (dread / 12) * 0.2);
  const riskBump = Math.round(dreadRisk * 3);

  // Wounds/stress thresholds add +DC deterministically.
  const actor = findActor(w, m.actorId);
  const wounds = clampInt(actor?.wounds ?? 0, 0, 6);
  const stress = clampInt(actor?.stress ?? 0, 0, 6);
  const woundBump = wounds >= 4 ? 2 : wounds >= 2 ? 1 : 0;
  const stressBump = stress >= 4 ? 2 : stress >= 2 ? 1 : 0;

  // Blood is a hair harsher.
  const bandBump = band === 'blood' ? 1 : 0;

  // Gear signals: small deterministic DC deltas (never dominant).
  // Philosophy: loud/bright/bulky kits make subtle approaches harder; heavy kits slightly help force.
  const gs = gearSignals && typeof gearSignals === 'object' ? gearSignals : { weight: 0, noise: 0, light: 0, bulk: 0 };
  const approach = String(m.approachTag || '');
  const stealthy = (approach === 'finesse' || approach === 'survival');

  const noiseBump = stealthy ? Math.floor(clampInt(gs.noise, 0, 999) / 8) : 0; // ~+1 per 8 noisy points
  const lightBump = stealthy ? Math.floor(clampInt(gs.light, 0, 999) / 10) : 0;
  const bulkBump = stealthy ? Math.floor(clampInt(gs.bulk, 0, 999) / 12) : Math.floor(clampInt(gs.bulk, 0, 999) / 18);
  const forceHelp = (approach === 'force') ? -Math.floor(clampInt(gs.weight, 0, 999) / 14) : 0;

  const gearBump = clampInt(noiseBump + lightBump + bulkBump + forceHelp, -1, 3);

  // Tactical zoom (optional): position matters more during confrontation scenes.
  const tacticalActive = Boolean(w.map?.tactical?.active);
  let tacticalBump = 0;
  if (tacticalActive) {
    const zone = String(actor?.position?.zone || 'far');
    if (approach === 'force' && zone === 'engaged') tacticalBump -= 1;
    if (approach === 'finesse' && zone === 'engaged') tacticalBump += 1;
    if (zone === 'far' && approach === 'force') tacticalBump += 1;
    tacticalBump = clampInt(tacticalBump, -1, 2);
  }

  return clampInt(base + clockBump + riskBump + bandBump + woundBump + stressBump + gearBump + tacticalBump, 6, 20);
}

function classifyOutcome({ band, margin, rng }) {
  // Guarantee mixed exists.
  // Success: margin >= 3
  // Mixed: margin in [-2..2]
  // Fail: margin <= -3
  // Blood shifts toward fail by narrowing mixed.
  if (band === 'blood') {
    if (margin >= 4) return 'success';
    if (margin >= -1) return 'mixed';
    return 'failure';
  }
  if (band === 'grim') {
    if (margin >= 3) return 'success';
    if (margin >= -2) return 'mixed';
    return 'failure';
  }
  // coop
  if (margin >= 2) return 'success';
  if (margin >= -3) return 'mixed';
  return 'failure';
}

function buildDeltas({ w, m, band, outcome, margin, rng, usedAdvantage, gearSignals }) {
  const gains = [];
  const costs = [];
  const deltas = [];

  // Time always advances by move type.
  const advanceKey = moveAdvances(m) === 'scene' ? 'scene' : 'turn';
  deltas.push({ op: 'time', key: advanceKey, by: 1 });

  // Spend advantage if used.
  if (usedAdvantage) {
    deltas.push({ op: 'advantage', actorId: m.actorId, by: -1 });
    costs.push({ kind: 'advantage', by: -1 });
  }

  // Always add a timeline note (canon change via delta).
  deltas.push({ op: 'timeline', add: `move:${m.approachTag}/${m.stakeTag} outcome:${outcome} margin:${margin} time+${advanceKey}` });

  // Stakes map to clocks.
  const stakeClock = stakeToClockKey(m.stakeTag);

  if (outcome === 'success') {
    gains.push({ kind: 'fact', text: 'advance' });
    deltas.push({ op: 'ledger', addFact: `you:advance (${m.approachTag})` });

    // Grant advantage token sometimes (cap handled by effects core).
    if (rng.nextFloat() < (band === 'cooperative' ? 0.55 : band === 'grim' ? 0.4 : 0.25)) {
      deltas.push({ op: 'advantage', actorId: m.actorId, by: +1 });
      gains.push({ kind: 'advantage', by: +1 });
    }

    // Position shift: on success, some approaches close distance.
    const posDelta = positionDeltaFor({ approach: m.approachTag, outcome });
    if (posDelta) deltas.push(posDelta);

    // Cooperative can relieve a bit of pressure.
    if (band === 'cooperative' && (w.clocks.pressure ?? 0) > 0 && rng.nextFloat() < 0.6) {
      deltas.push({ op: 'clock', key: 'pressure', by: -1 });
      costs.push({ kind: 'clock', key: 'pressure', by: -1, note: 'pressure eases' });
    }
  }

  if (outcome === 'mixed') {
    // Key feature: both gain + cost.
    gains.push({ kind: 'fact', text: 'progress, partial' });
    costs.push({ kind: 'clock', key: stakeClock, by: +1, note: 'a cost lands' });

    deltas.push({ op: 'ledger', addFact: `you:progress (mixed)` });

    // Time pressure: time stakes convert to extra time loss OR clock pressure.
    if (m.stakeTag === 'time') {
      deltas.push({ op: 'time', key: 'turn', by: 1 });
      costs.push({ kind: 'time', key: 'turn', by: +1 });
    } else {
      deltas.push({ op: 'clock', key: stakeClock, by: +1 });
    }

    // Mixed can grant advantage too, but less often.
    if (rng.nextFloat() < (band === 'cooperative' ? 0.35 : 0.2)) {
      deltas.push({ op: 'advantage', actorId: m.actorId, by: +1 });
      gains.push({ kind: 'advantage', by: +1 });
    }

    // Position shift: mixed can cost position (push back) for force/finesse.
    const posDelta = positionDeltaFor({ approach: m.approachTag, outcome });
    if (posDelta) deltas.push(posDelta);

    // Optional small threat in grim/blood.
    if (band !== 'cooperative' && rng.nextFloat() < 0.5) {
      deltas.push({ op: 'ledger', addThreat: `Complication: ${defaultCostText(w, band)}`, level: band === 'blood' ? 3 : 2 });
      costs.push({ kind: 'threat', note: 'complication' });
    }
  }

  if (outcome === 'failure') {
    const weight = consequenceWeight(w);
    const baseBump = band === 'blood' ? 3 : band === 'grim' ? 2 : 1;
    const bump = clampInt(Math.round(baseBump * weight), 1, 4);
    costs.push({ kind: 'clock', key: stakeClock, by: +bump, note: 'failure cost' });

    if (m.stakeTag === 'time') {
      deltas.push({ op: 'time', key: 'turn', by: bump });
      costs.push({ kind: 'time', key: 'turn', by: bump });
    } else {
      deltas.push({ op: 'clock', key: stakeClock, by: +bump });
    }

    const posDelta = positionDeltaFor({ approach: m.approachTag, outcome });
    if (posDelta) deltas.push(posDelta);

    const threatLevel = band === 'cooperative' ? 1 : band === 'grim' ? 2 : 3;
    deltas.push({ op: 'ledger', addThreat: `Cost: ${defaultCostText(w, band)}.`, level: threatLevel });
  }

  // Environmental residue: emit signals that worldTick will turn into escalation.
  const envOps = envDeltasForMove({ w, m, outcome, gearSignals });
  for (const op of envOps) deltas.push(op);

  // Scarcity: stake=resource depletes supplies.
  if (m.stakeTag === 'resource' && outcome !== 'success') {
    const key = pickResourceKey(w, m, rng);
    const by = outcome === 'mixed' ? -1 : (band === 'blood' ? -3 : band === 'grim' ? -2 : -1);
    deltas.push({ op: 'resource', entityId: m.actorId, key, by });
    costs.push({ kind: 'resource', entityId: m.actorId, key, by });
  }

  // Injury: Wounds (0..6) on harm stakes.
  if (m.stakeTag === 'harm' && outcome !== 'success') {
    const by = outcome === 'mixed' ? 1 : (band === 'blood' ? 2 : 1);
    deltas.push({ op: 'wound', entityId: m.actorId, by });
    costs.push({ kind: 'wound', entityId: m.actorId, by });
  }

  // Fear: Stress (0..6) on dread stakes OR when dread clock is high.
  if ((m.stakeTag === 'dread' || (w.clocks.dread ?? 0) >= 6) && outcome !== 'success') {
    const by = outcome === 'mixed' ? 1 : (band === 'blood' ? 2 : 1);
    deltas.push({ op: 'stress', entityId: m.actorId, by });
    costs.push({ kind: 'stress', entityId: m.actorId, by });
  }

  return { gains, costs, deltas };
}

function pickResourceKey(w, m, rng) {
  const packRes = Array.isArray(w.ruleset?.resources) ? w.ruleset.resources : null;
  const list = Array.isArray(w.pack?.resources) ? w.pack.resources : null;
  const fallback = ['Supply'];
  const pool = (list && list.length) ? list : (packRes && packRes.length ? packRes : fallback);
  // If toolTag is present, bias to it if it matches.
  if (m.toolTag) {
    const hit = pool.find(x => String(x).toLowerCase() === String(m.toolTag).toLowerCase());
    if (hit) return String(hit);
  }
  return String(rng.pick(pool) || pool[0] || 'Supply');
}

function summarizeDeltasForLine(m) {
  // Minimal hint only; full deltas are structured.
  if (m.stakeTag === 'resource') return 'supply';
  if (m.stakeTag === 'harm') return 'wounds';
  if (m.stakeTag === 'dread') return 'stress';
  return '';
}

function stakeToClockKey(stakeTag) {
  const s = String(stakeTag || '').toLowerCase();
  if (s === 'dread') return 'dread';
  if (s === 'exposure' || s === 'reputation' || s === 'resource') return 'pressure';
  if (s === 'time') return 'pressure';
  return 'pressure';
}

function defaultCostText(w, band) {
  // Prefer instrument cost.
  const inst = w.instrument || {};
  if (inst.cost) return inst.cost;
  return band === 'blood' ? 'blood, betrayal, irreversible loss' : band === 'grim' ? 'time, blood, trust' : 'time, fatigue, pride';
}

function buildMechanicsLine({ roll, dc, outcome, m, margin, usedAdvantage, statKey = '', statBonus = 0 }) {
  const deltaNote = summarizeDeltasForLine(m);
  const sb = statBonus ? (statBonus > 0 ? `+${statBonus}` : String(statBonus)) : '';
  const stat = statKey ? ` | stat:${statKey}${sb}` : '';
  return `[roll:${roll} vs DC:${dc} → ${outcome} | margin:${margin} | approach:${m.approachTag} | stake:${m.stakeTag} | risk:${m.risk.toFixed(2)}${stat}${usedAdvantage ? ' | adv:+2' : ''}${deltaNote ? ' | ' + deltaNote : ''}]`;
}

function moveAdvances(m) {
  const t = String(m.intentText || '').toLowerCase();
  // Travel / transition intents advance scene; otherwise turns.
  if (/\b(travel|leave|enter|head to|go to|move to|escape)\b/.test(t)) return 'scene';
  if (m.approachTag === 'survival' && m.stakeTag === 'time') return 'scene';
  return 'turn';
}

function envDeltasForMove({ w, m, outcome, gearSignals }) {
  const gs = gearSignals && typeof gearSignals === 'object' ? gearSignals : { weight: 0, noise: 0, light: 0, bulk: 0 };
  const a = String(m.approachTag || '');
  const stake = String(m.stakeTag || '');

  // Baseline residue by approach.
  // Keep tiny: most moves emit 0–2 total points.
  let noise = 0;
  let heat = 0;
  let scent = 0;
  let light = 0;

  if (a === 'force') { noise += 2; heat += 1; }
  if (a === 'finesse') { noise += 1; }
  if (a === 'survival') { scent += 1; }
  if (a === 'focus') { heat += 1; }
  if (a === 'heart') { noise += 0; scent += 0; }

  // Stakes bias.
  if (stake === 'time') noise += 1;
  if (stake === 'harm') heat += 1;
  if (stake === 'dread') scent += 1;

  // Gear contribution: bright or noisy kits bleed into env.
  if (gs.noise >= 6) noise += 1;
  if (gs.light >= 6) light += 1;

  // Outcome: fail is messier; success is cleaner.
  if (outcome === 'failure') { noise += 1; scent += 1; }
  if (outcome === 'success') { noise = Math.max(0, noise - 1); }

  const ops = [];
  if (noise) ops.push({ op: 'env', key: 'noise', by: clampInt(noise, -2, 3) });
  if (heat) ops.push({ op: 'env', key: 'heat', by: clampInt(heat, -2, 3) });
  if (scent) ops.push({ op: 'env', key: 'scent', by: clampInt(scent, -2, 3) });
  if (light) ops.push({ op: 'env', key: 'light', by: clampInt(light, -2, 3) });
  return ops;
}

function positionDeltaFor({ approach, outcome }) {
  const a = String(approach || '');
  const o = String(outcome || '');
  // Only meaningful for approaches that change distance.
  if (!['force', 'finesse', 'survival'].includes(a)) return null;

  const shift = (o === 'success') ? +1 : (o === 'mixed') ? 0 : -1;
  if (shift === 0) return null;

  return {
    op: 'position',
    entityId: 'party',
    set: { zone: shift > 0 ? 'near' : 'far' }
  };
}

function clamp01(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function findActor(w, actorId) {
  const party = Array.isArray(w.party) ? w.party : [];
  return party.find(e => String(e?.id) === String(actorId)) || null;
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
