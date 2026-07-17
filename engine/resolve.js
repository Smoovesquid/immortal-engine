import { ensureWorld } from './state.js';
import { makeRng, seedFromString } from './rng.js';
import { fateBand } from './rulesets.js';
import { consequenceWeight } from './instrument.js';
import { scoreInventorySignals } from './gear/gearProps.js';
import { profBonusFor } from './ruleset/core/levelTable.js';
import { maxWounds } from './ruleset/core/stats.js';

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

  const rawDie = rng.int(1, 20);
  let roll = rawDie;

  // Stat modifier (genre-agnostic). DECL-STAT-1: an EXPLICITLY declared ability
  // ("I'll roll Strength", "using my WITS", "a Dexterity check") WINS over the
  // approach→stat inference. When the move carries a valid `statTag`, it is
  // authoritative for BOTH the d20 math and the mech-line label; absent a
  // declaration, `statForApproach(approach)` stands byte-identical (statTag is
  // undefined on every legacy caller). The declaration is detected in the
  // STRUCTURED intent upstream, never by a raw-text regex here — see
  // engine/intent/parseIntent.js declaredStat(). m.statTag is already
  // normalized to a valid engine stat (or null) by normalizeMove.
  // RULING-DC-1 widens the chain by one seat: declared > judge > approach.
  // The judge's difficultyStatTag is advisory — it never impersonates a
  // declaration and loses to one every time.
  const statKey = m.statTag || m.difficultyStatTag || statForApproach(m.approachTag);
  const statVal = actor?.stats?.[statKey];
  const statBonus = statMod(statVal);

  // Proficiency bonus: added when actor has a focus matching the approach.
  const proficient = hasProficiency(actor, m.approachTag);
  const profBonus = proficient ? profBonusFor(actor?.level ?? 1) : 0;
  roll = clampInt(roll + statBonus + profBonus, 1, 30);

  // DX-2a: tactical advantage (flanking the defender / attacking from high
  // ground). Positional — applied to THIS roll as a flat +2 (the engine's
  // advantage model), and it does NOT consume an advantage token.
  const tacticalAdvantage = Boolean(m.tacticalAdvantage);
  if (tacticalAdvantage) {
    roll = clampInt(roll + 2, 1, 30);
  }

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

  const outcome = classifyOutcome({ band, margin, rng, rawDie });

  const { gains, costs, deltas } = buildDeltas({ w, m, band, outcome, margin, rng, usedAdvantage, gearSignals });

  const mechanicsLine = buildMechanicsLine({ roll, dc, outcome, m, margin, usedAdvantage, statKey, statBonus, profBonus, rawDie });

  const result = {
    outcome,
    rawDie,
    roll,
    dc,
    margin,
    profBonus,
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

// The five engine stats the d20 can key off. A declared stat that isn't one of
// these (or is absent) yields null, so the caller falls back to the approach
// map — a malformed declaration never breaks the roll, it just doesn't win.
const ENGINE_STATS = new Set(['MIGHT', 'AGILITY', 'GRIT', 'CHARM', 'WITS']);
function normalizeStatTag(statTag) {
  if (statTag == null) return null;
  const s = String(statTag).trim().toUpperCase();
  return ENGINE_STATS.has(s) ? s : null;
}

// RULING-DC-1 — the improvised-ruling table: the judge names a coarse BAND
// (never a number — V11 law; a raw model number can never reach the dice) and
// this table is the ONLY place a band becomes a DC. The judged DC replaces the
// whole pressure formula for that feat — the ruling IS the difficulty, the way
// a DM's "that's really tough, 18 to make it" is the whole answer. 'impossible'
// is deliberately absent: it declines in fiction upstream (playloop's floor)
// before any move is built, so a forged 'impossible' tag on a move object
// normalizes to null and simply falls back to the formula.
const BAND_DC = { trivial: 5, easy: 10, medium: 12, hard: 15, very_hard: 18 };
function normalizeDifficultyBand(tag) {
  if (tag == null) return null;
  const s = String(tag).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(BAND_DC, s) ? s : null;
}

// Focus → approach mapping (from CRUNCH_V1.md).
// Each focus grants proficiency bonus when used with its matching approach.
const FOCUS_APPROACH = {
  athletics: 'force',
  stealth: 'finesse',
  arcana: 'focus',
  insight: 'heart',
  survival: 'endure',
  intimidation: 'force',
  acrobatics: 'finesse',
  investigation: 'focus',
  persuasion: 'heart',
  medicine: 'endure',
  perception: 'focus',
  deception: 'heart',
  nature: 'endure',
  history: 'focus',
  performance: 'heart',
  religion: 'focus',
  sleight_of_hand: 'finesse'
};

function hasProficiency(actor, approachTag) {
  const foci = Array.isArray(actor?.foci) ? actor.foci : [];
  const approach = String(approachTag || '');
  for (const f of foci) {
    if (FOCUS_APPROACH[f] === approach) return true;
  }
  return false;
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
    toolTag: x.toolTag ? String(x.toolTag) : null,
    // DECL-STAT-1: a player-DECLARED ability, validated to the engine's five
    // stats at this boundary (null when absent or malformed → the roll infers
    // from the approach exactly as before, so every legacy caller is untouched).
    statTag: normalizeStatTag(x.statTag),
    // RULING-DC-1: the judge's band + governing stat, validated at this
    // boundary exactly like statTag (null when absent/malformed → the formula
    // and approach-inference stand byte-identical for every legacy caller).
    difficultyBandTag: normalizeDifficultyBand(x.difficultyBandTag),
    difficultyStatTag: normalizeStatTag(x.difficultyStatTag),
    // DX-2a: tactical modifiers supplied by combatResolve. Defaults are no-ops,
    // so non-combat callers and old replays roll exactly as before.
    tacticalDefenseBonus: clampInt(x.tacticalDefenseBonus ?? 0, 0, 5),
    tacticalAdvantage: Boolean(x.tacticalAdvantage)
  };
}

function computeDC({ w, m, band, gearSignals }) {
  // RULING-DC-1: a judged band IS the DC — the improvised ruling replaces the
  // global pressure formula for this feat, exactly as a DM's spoken number
  // would. Already validated by normalizeMove; the table is fixed and the
  // model never sees or sets the integer.
  if (m.difficultyBandTag) return BAND_DC[m.difficultyBandTag];
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
  // Wound thresholds scale proportionally with maxWounds.
  const actor = findActor(w, m.actorId);
  const woundCap = maxWounds(actor?.level ?? 1, statMod(actor?.stats?.GRIT ?? 10));
  const wounds = clampInt(actor?.wounds ?? 0, 0, woundCap);
  const stress = clampInt(actor?.stress ?? 0, 0, 6);
  const woundBump = wounds >= Math.ceil(woundCap * 2 / 3) ? 2 : wounds >= Math.ceil(woundCap / 3) ? 1 : 0;
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

  // DX-2a: a defender behind cover is harder to hit — fold their cover bonus
  // (+2 half / +5 full, supplied by combatResolve) into the effective DC. The
  // ceiling is lifted to 25 so full cover can push past the normal cap of 20.
  const tacticalDefenseBonus = clampInt(m.tacticalDefenseBonus ?? 0, 0, 5);

  let dc = clampInt(base + clockBump + riskBump + bandBump + woundBump + stressBump + gearBump + tacticalBump, 6, 20);
  dc = clampInt(dc + tacticalDefenseBonus, 6, 25);

  // Focus learning-from-failure hook: if the newest ledger fact is the
  // "studied-the-miss" marker left by a prior focus failure, the next focus
  // attempt gets dc -= 1 (floor 8). Consumption is handled in buildDeltas.
  if (approach === 'focus') {
    const topFact = String(w.ledger?.facts?.[0]?.text || '');
    if (topFact === 'you:studied-the-miss') {
      dc = Math.max(8, dc - 1);
    }
  }

  return dc;
}

function classifyOutcome({ band, margin, rng, rawDie }) {
  // Natural 1: automatic failure regardless of modifiers.
  // Natural 20: automatic success regardless of modifiers.
  // Matches D&D 5e ability check / attack roll convention.
  if (rawDie === 1) return 'failure';
  if (rawDie === 20) return 'success';

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

    // Clock relief: success eases the highest active clock. Chance varies by band.
    const reliefChance = band === 'cooperative' ? 0.6 : band === 'grim' ? 0.3 : 0.15;
    if (rng.nextFloat() < reliefChance) {
      const clockKeys = ['pressure', 'dread', 'revelation'];
      const active = clockKeys.filter(k => (w.clocks[k] ?? 0) > 0).sort((a, b) => (w.clocks[b] ?? 0) - (w.clocks[a] ?? 0));
      if (active.length > 0) {
        deltas.push({ op: 'clock', key: active[0], by: -1 });
        gains.push({ kind: 'clock', key: active[0], by: -1, note: `${active[0]} eases` });
      }
    }

    // Relief valve: successful rolls reduce tension on the most tense open thread by 1.
    // This prevents the death spiral where threads auto-escalate with no brake.
    deltas.push({ op: 'threadRelief', by: -1 });
    gains.push({ kind: 'threadRelief', by: -1 });
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

    // Endure failure signature: swallows the threat, pays in stress instead.
    // The stress bump is added by addApproachSignature() below.
    if (m.approachTag !== 'endure') {
      const threatLevel = band === 'cooperative' ? 1 : band === 'grim' ? 2 : 3;
      deltas.push({ op: 'ledger', addThreat: `Cost: ${defaultCostText(w, band)}.`, level: threatLevel });
    }
  }

  // Approach signatures: each (approach, outcome) cell emits a mechanically
  // distinct delta so that narration and tests can observe which approach
  // was used. These augment the common path — they never replace core deltas.
  addApproachSignature({ w, m, outcome, band, deltas, gains, costs });

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

  // Fear: Stress (0..6) on dread stakes, harm stakes (combat trauma), OR when dread clock is high.
  if ((m.stakeTag === 'dread' || m.stakeTag === 'harm' || (w.clocks.dread ?? 0) >= 6) && outcome !== 'success') {
    const by = outcome === 'mixed' ? 1 : (band === 'blood' ? 2 : 1);
    deltas.push({ op: 'stress', entityId: m.actorId, by });
    costs.push({ kind: 'stress', entityId: m.actorId, by });
  }

  return { gains, costs, deltas };
}

function addApproachSignature({ w, m, outcome, band, deltas, gains, costs }) {
  const a = String(m.approachTag || '');
  const o = String(outcome || '');
  const actor = findActor(w, m.actorId);

  // ── FORCE ───────────────────────────────────────────────────────
  // Identity: visceral, loud, overcommitted. Body pays either way.
  if (a === 'force') {
    if (o === 'success') {
      deltas.push({ op: 'env', key: 'noise', by: +1 });
      if (m.stakeTag === 'harm') {
        deltas.push({ op: 'ledger', addFact: 'you:broke-through' });
      }
    } else if (o === 'mixed') {
      deltas.push({ op: 'env', key: 'heat', by: +1 });
    } else if (o === 'failure') {
      deltas.push({ op: 'ledger', addFact: 'you:overcommitted' });
    }
    return;
  }

  // ── FINESSE ─────────────────────────────────────────────────────
  // Identity: precise, quiet. Cleans up its own traces.
  if (a === 'finesse') {
    if (o === 'success') {
      deltas.push({ op: 'env', key: 'noise', by: -1 });
      deltas.push({ op: 'env', key: 'scent', by: -1 });
    } else if (o === 'mixed') {
      deltas.push({ op: 'env', key: 'noise', by: -1 });
    } else if (o === 'failure') {
      deltas.push({ op: 'ledger', addFact: 'you:clean-miss' });
    }
    return;
  }

  // ── ENDURE ──────────────────────────────────────────────────────
  // Identity: gritted teeth. Held ground costs less on mixed, heals on success.
  if (a === 'endure') {
    if (o === 'success') {
      const stressCur = clampInt(actor?.stress ?? 0, 0, 6);
      const endureWoundCap = maxWounds(actor?.level ?? 1, statMod(actor?.stats?.GRIT ?? 10));
      const woundCur = clampInt(actor?.wounds ?? 0, 0, endureWoundCap);
      if (stressCur > 0) {
        deltas.push({ op: 'stress', entityId: m.actorId, by: -1 });
        gains.push({ kind: 'stress', entityId: m.actorId, by: -1, note: 'held the line' });
      } else if (woundCur > 0) {
        deltas.push({ op: 'wound', entityId: m.actorId, by: -1 });
        gains.push({ kind: 'wound', entityId: m.actorId, by: -1, note: 'held the line' });
      }
      deltas.push({ op: 'ledger', addFact: 'you:held-the-line' });
    } else if (o === 'mixed') {
      // Endure eats mixed cheaply — a distinct ledger marker, no extra cost.
      deltas.push({ op: 'ledger', addFact: 'you:held-steady' });
    } else if (o === 'failure') {
      // Pays in stress rather than a new threat entry (the default threat
      // was suppressed upstream when approach === 'endure').
      deltas.push({ op: 'stress', entityId: m.actorId, by: +1 });
      costs.push({ kind: 'stress', entityId: m.actorId, by: +1, note: 'endurance breaks' });
    }
    return;
  }

  // ── HEART ───────────────────────────────────────────────────────
  // Identity: warmth, connection. Never disturbs the environment.
  if (a === 'heart') {
    if (o === 'success') {
      const npcId = findNpcHere(w);
      if (npcId) {
        deltas.push({ op: 'npcTrustDelta', npcId, by: +1 });
        gains.push({ kind: 'npcTrust', npcId, by: +1 });
      } else {
        deltas.push({ op: 'ledger', addFact: 'you:rapport' });
      }
    } else if (o === 'mixed') {
      deltas.push({ op: 'ledger', addFact: 'you:gentle-partial' });
    } else if (o === 'failure') {
      deltas.push({ op: 'ledger', addFact: 'you:trust-frays' });
    }
    return;
  }

  // ── FOCUS ───────────────────────────────────────────────────────
  // Identity: observation, insight. Learns from misses — and from the clock.
  if (a === 'focus') {
    // One-shot DC hook consumption: if the prior-newest fact was the
    // studied-the-miss marker, computeDC already applied the -1 discount
    // above; emit applied-the-lesson now so the hook is no longer the
    // active (top) fact once these deltas are applied.
    const topFactPre = String(w.ledger?.facts?.[0]?.text || '');
    const hookWasActive = (topFactPre === 'you:studied-the-miss');
    if (hookWasActive) {
      deltas.push({ op: 'ledger', addFact: 'you:applied-the-lesson' });
    }

    if (o === 'success') {
      deltas.push({ op: 'ledger', addFact: 'you:read-the-pattern' });
      if ((w.clocks?.revelation ?? 0) > 0) {
        deltas.push({ op: 'clock', key: 'revelation', by: -1 });
      }
    } else if (o === 'mixed') {
      // Focus burns the clock: on time-staked mixed, eat an extra turn
      // beyond the baseline mixed-cost.
      if (m.stakeTag === 'time') {
        deltas.push({ op: 'time', key: 'turn', by: +1 });
        costs.push({ kind: 'time', key: 'turn', by: +1, note: 'focus burns the clock' });
      }
      deltas.push({ op: 'ledger', addFact: 'you:saw-partially' });
    } else if (o === 'failure') {
      // Arm the DC hook for the next focus attempt.
      deltas.push({ op: 'ledger', addFact: 'you:studied-the-miss' });
    }
    return;
  }
}

function findNpcHere(w) {
  const nodeId = String(w?.map?.currentNodeId ?? '');
  const node = (w?.map?.nodes || []).find(n => n && n.id === nodeId) || null;
  const npcs = node?.settlement?.npcs || [];
  if (!Array.isArray(npcs) || !npcs.length) return null;
  // Deterministic: first NPC with an id (tie-break = insertion order).
  for (const npc of npcs) {
    if (npc?.id) return String(npc.id);
  }
  return null;
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

function buildMechanicsLine({ roll, dc, outcome, m, margin, usedAdvantage, statKey = '', statBonus = 0, profBonus = 0, rawDie = 0 }) {
  const deltaNote = summarizeDeltasForLine(m);
  const sb = statBonus ? (statBonus > 0 ? `+${statBonus}` : String(statBonus)) : '';
  const stat = statKey ? ` | stat:${statKey}${sb}` : '';
  const prof = profBonus ? ` | prof:+${profBonus}` : '';
  const nat = rawDie === 1 ? ' | NAT1' : rawDie === 20 ? ' | NAT20' : '';
  return `[roll:${roll} vs DC:${dc} → ${outcome} | margin:${margin} | approach:${m.approachTag} | stake:${m.stakeTag} | risk:${m.risk.toFixed(2)}${stat}${prof}${usedAdvantage ? ' | adv:+2' : ''}${nat}${deltaNote ? ' | ' + deltaNote : ''}]`;
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

/**
 * Thin physics check: d20 + MIGHT vs hardness-derived DC.
 * Returns roll data + a mechanicsLine in the same format as resolveMove,
 * so the front-end dice roller fires on physical interactions.
 * No narrative deltas — only the roll math.
 */
export function rollPhysicsCheck(world, { actorId = 'party', hardness = 2, intentText = '' } = {}) {
  const w = ensureWorld(world);
  const actor = findActor(w, actorId);

  // DC 8 (cloth/trivial) → DC 18 (stone/near-impossible)
  const dc = clampInt(8 + Math.round(clampInt(hardness, 0, 5) * 2), 6, 20);

  const seed = seedFromString(
    `${w.meta.seed}|physics|${w.scene?.promptSeed ?? 0}|${(w.timeline || []).length}|${actorId}|${intentText}`
  );
  const rng = makeRng(seed);
  const rawDie = rng.int(1, 20);

  const statBonus = statMod(actor?.stats?.MIGHT);
  const roll = clampInt(rawDie + statBonus, 1, 30);
  const margin = roll - dc;

  const outcome =
    rawDie === 1 ? 'failure' :
    rawDie === 20 ? 'success' :
    margin >= 2 ? 'success' :
    margin >= -2 ? 'mixed' :
    'failure';

  const sb = statBonus ? (statBonus > 0 ? `+${statBonus}` : String(statBonus)) : '';
  const nat = rawDie === 1 ? ' | NAT1' : rawDie === 20 ? ' | NAT20' : '';
  const risk = (hardness / 5).toFixed(2);
  const mechanicsLine = `[roll:${roll} vs DC:${dc} → ${outcome} | margin:${margin} | approach:force | stake:action | risk:${risk} | stat:MIGHT${sb}${nat}]`;

  return { roll, rawDie, dc, outcome, margin, mechanicsLine };
}
