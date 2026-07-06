import { assertWorldInvariants } from './invariants.js';
import { ensureWorld } from './state.js';
import { ensureInstrumentLayer, reinforceMotif, tickThreads } from './instrument.js';
import { seedFromString, makeRng } from './rng.js';
import { fateBand } from './rulesets.js';
import { scoreInventorySignals } from './gear/gearProps.js';
import { scarifyNode, ensureMap } from './map/mapState.js';
import { propagateRumors } from './rumor/propagate.js';
import { propagateClaims } from './claims.js';
import { mintVillain, corruptionTier, VILLAIN_STAGE_COST, VILLAIN_GOAL_ACCEL } from './story/villain.js';
import { addThreat } from './ledger.js';
import { HUNT_HEAT, HEAT_DECAY_INTERVAL, HEAT_DECAY_PER_TICK, PACT_CORRUPTION, cassandraBandFloor } from './morality/escalation.js';
import { occupantsOfRoom, outdoorOccupants } from './structures/roomOccupancy.js';
import { selectCreatures, spawnEncounter } from './combat/encounterSpawn.js';
import { biomeForNode } from './world/biome.js';
import { darkGiftAtCorruption } from './magic/forbiddenGates.js';
import { applyDeltas } from './effectsCore.js';

// Living System Core — deterministic world evolution.

export function worldTick(world, seed = '') {
  let w = ensureWorld(world);
  const inst = ensureInstrumentLayer(w.instrument);

  const tickIndex = w.time?.turn ?? 0;
  const s = String(seed || `${w.meta.seed}|worldTick|${w.scene.promptSeed}|t${tickIndex}|tl${w.timeline.length}`);
  const rng = makeRng(seedFromString(s));

  const band = fateBand(w.meta.fate);
  const severity = band === 'blood' ? 1.35 : band === 'grim' ? 1.15 : 0.95;

  // 1) Advance faction agendas
  w = tickFactions(w, rng, severity);

  // 1.5) The Adversary (P-74b): mint lazily, advance the agenda, react to the
  // player. Pure arithmetic — no rng consumed, so existing streams are
  // untouched.
  w = tickVillain(w);

  // 2) Increase tension in active living threads; escalate/mutate deterministically.
  w = tickLivingThreads(w, rng, severity);

  // 2.5) Map-anchored faction/thread pressure (offscreen actions target places)
  w = tickMapPressure(w, rng, severity);

  // 3) Escalate unresolved threats (ledger.threats)
  w = tickThreats(w, severity);

  // 3.5) Gear signals feed ambient pressure/dread (noise/light as offscreen consequences)
  w = tickGearSignals(w, severity);

  // 3.75) Environmental residue accumulates & converts into escalation; then decays.
  w = tickEnv(w, severity);

  // 4) Age questions (decay/transform)
  w = tickQuestions(w, rng);

  // 5) Spread environmental drift
  w = tickEcology(w, severity);

  // 5) Accumulate scars (irreversible)
  w = applyIrreversibleThresholds(w);

  // 5.5) Gossip propagation: NPCs share player-knowledge to friends/family (one-hop per tick).
  w = tickGossip(w, rng);

  // 5.7) Age and propagate rumors
  w = tickRumors(w, rng);

  // 5.8) Propagate epistemic claims along the social graph (deterministic, zero LLM calls).
  // Epistemic variance lives here — claims drift and fracture; engine truth is never touched.
  w = propagateClaims(w, rng);

  // 5.82) NPC-DEED-1 (docs/MORAL_PHYSICS.md §7 Arc A) — the world grinds Carl. When the authored
  // evildoer is present (slice/demo seed), his supremacist project produces witnessed cruelty on a
  // seed-stable, escalating cadence: each firing records a deed ATTRIBUTED TO HIM (honest actorId,
  // effectsCore recordDeed), so his own heat climbs and the deed travels as THIRD-person reputation
  // (rumorsReaching → notorietyReachingAbout). The player, doing nothing, watches a vile man be
  // answered by a legible world. On any seed without Carl this is a pure no-op (no deed, no rng
  // drawn from the shared stream) → worldHash unchanged. Runs on its OWN seeded sub-stream.
  w = tickCarlDeeds(w, s);

  // 5.85) MP-5b (docs/MORAL_PHYSICS.md §5) — the Cassandra. Fires BEFORE the hunt (she is the
  // warning that heeding can still outrun, per the brief's pinned interpretation: "the T2→T3
  // BOUNDARY" means the approach band, landing before the hunt so cooling off can matter) and
  // BEFORE heat decays this tick (so the crossing is judged on the SAME heat value the deed
  // just produced, not an already-decayed one). Pure read of live heat + node occupancy; the
  // one RNG draw it can make (tie-break among equally-trusted present NPCs) runs on its own
  // sub-stream, so a run that never enters the band is byte-identical to before.
  w = tickCassandra(w);

  // 5.9) MP-3 (docs/MORAL_PHYSICS.md §4) — heat→hunt. The hunt fires (reads the heat the
  // player's deeds accrued), THEN heat decays with time/distance and re-arms once cooled.
  // Both are deterministic-by-seed; the hunt spawns through the existing organ on its OWN
  // sub-RNG so it never perturbs the shared tick stream (a no-deed run leaves heat at 0 → no
  // hunt, no decay effect → worldHash unchanged).
  w = tickHunt(w);
  w = tickHeatDecay(w);

  // 5.95) MP-4 (docs/MORAL_PHYSICS.md §4 T4) — corruption→pact. Once standing corruption
  // reaches PACT_CORRUPTION (the lowest darkGift threshold, read from forbiddenGates), the
  // world DELIVERS the dark gift unbidden through the existing forbiddenGates organ — the
  // player never asked; free power is the sign they are being claimed. Level-triggered with a
  // `pactT` latch (MP-3's huntedT precedent): fires once per crossing, re-arms only after
  // corruption falls back below. Pure arithmetic + a learnSpell delta — no RNG consumed, so a
  // sub-threshold run is byte-identical to before (worldHash unchanged).
  w = tickPact(w);

  // 6) Modify reputation + alignment state
  w = tickReputation(w, severity);

  // 7) Reinforce motifs over time
  w = tickMotifs(w, rng, severity);

  // 8) Apply fate weighting already expressed via severity.
  assertWorldInvariants(w);
  return w;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// NPC-DEED-1 — CARL'S MISDEED CADENCE  (docs/MORAL_PHYSICS.md §7 Arc A)
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// ▟▙  TIM OWNS THIS SCHEDULE — the constants below are the ONE place Carl's arc is tuned.  ▟▙
//
// Arc A's thesis: "over N deterministic world-ticks, [Carl's] deeds mint claims that propagate →
// the world reads a vile man and answers him," with the player only a witness. This function is the
// AUTHORED CONTENT that gives Arc A something to tick — Carl had no deed hook before this packet.
// Everything numeric here is a conservative starting default, seed-stable and retunable in one spot.
//
// The cadence: starting after a short grace period, Carl commits a witnessed cruelty every
// CARL_DEED_INTERVAL world-ticks. Early acts are MOD-severity; from the CARL_ESCALATE_AFTER-th act
// onward they are HEAVY (his project hardens). HEAVY is the threshold at which a deed both makes the
// world recoil (Tier-1) and travels as reputation (DEED_GOSSIP_MIN) — so the escalation is what
// eventually lights up the third-person read at neighbouring towns. Witnesses are the OTHER named
// people at Carl's node (never Carl himself); with witnesses present the deed is not "wild," so it
// travels. If Carl stands alone at his node, the act still records (his heat climbs) but mints no
// travelling claim — the honest wild asymmetry, unchanged.
//
// THE CLOCK is the world timeline length (it grows every world-tick; world.time.turn does NOT
// advance inside worldTick, so it can't be the clock). WHY THESE VALUES: K is chosen so the grind is
// VISIBLE inside a normal session's tick budget — a player poking around Aldermere for a few dozen
// ticks should see Carl's reputation curdle at the neighbours, not need a marathon. INTERVAL 6 +
// ESCALATE_AFTER 3 means his 3rd act (the first HEAVY, travelling one) lands after ~3 intervals of
// clock past the grace period, then a steady drumbeat follows; a handful of HEAVY witnessed acts is
// what MP-3's HUNT_HEAT (40) would need, so his heat visibly builds toward (but this packet does not
// itself fire) the hunt. Tim: raise INTERVAL to slow the grind, lower ESCALATE_AFTER to harden him
// sooner, bump SEVERITY_* to make each act weigh more. All seed-stable; no determinism cost to tune.
const CARL_ACTOR_ID = 'figure_carl';
const CARL_DEED_GRACE = 4;         // world-ticks before Carl's first act (a beat of calm first)
const CARL_DEED_INTERVAL = 6;      // one witnessed cruelty every K ticks after the grace period
const CARL_ESCALATE_AFTER = 3;     // act #3 onward is HEAVY (before that, MOD) — the project hardens
const CARL_SEVERITY_MOD = 12;      // === DEED_SEV.MOD (engine/morality/escalation.js): early acts
const CARL_SEVERITY_HEAVY = 20;    // === DEED_SEV.HEAVY: escalated acts (travel + recoil threshold)
const CARL_WITNESS_CAP = 8;        // mirror applyDeedCharges' witness slice
// Authored one-line summaries, cycled deterministically by act index — flavour for the garbled
// rumor body (never a number; the world hears WHAT he did, distorted by distance). Tim may reword.
const CARL_DEED_SUMMARIES = Object.freeze([
  'Carl drove a frightened neighbour from the square, screaming that the wingless are vermin',
  'Carl defaced a family shrine, daubing his avian-supremacy creed across the door',
  'Carl set upon a beggar with a cudgel for the crime of being earthbound',
  'Carl penned a starving man in a coop overnight to "teach him his place below the birds"',
  'Carl torched a neighbour\'s dovecote and made them watch, ranting of a purer flock'
]);

// Locate the node Carl currently stands at (he rides the slice/demo overlay; on any other seed he
// is absent and this returns null → the whole tick is a no-op). Pure read.
function findCarlNode(w) {
  const nodes = Array.isArray(w?.map?.nodes) ? w.map.nodes : [];
  for (const node of nodes) {
    const npcs = node?.settlement?.npcs;
    if (!Array.isArray(npcs)) continue;
    if (npcs.some(n => n && (String(n.id) === CARL_ACTOR_ID || n.authoredFigure === 'carl'))) return node;
  }
  return null;
}

// THE CLOCK. worldTick does NOT advance world.time.turn (that is a playloop/turn concern), but the
// timeline grows monotonically every tick — so the tick-count Carl's schedule reads is the
// timeline length. It does not increment by exactly 1 per tick, which is fine: the schedule is
// expressed as "how many acts SHOULD Carl have committed by clock C," and each tick fires at most
// one act to catch up. That makes the cadence self-correcting and INDEPENDENT of the per-tick step
// size — and needs NO new persistent field (deeds-so-far is read straight from world.deeds).
function carlClock(w) {
  return Array.isArray(w?.timeline) ? w.timeline.length : 0;
}

// How many misdeeds Carl is OWED by a given clock value. Zero during the grace period, then one
// more every CARL_DEED_INTERVAL ticks. Pure integer schedule.
function carlDeedsOwed(clock) {
  if (clock < CARL_DEED_GRACE) return 0;
  return Math.floor((clock - CARL_DEED_GRACE) / CARL_DEED_INTERVAL) + 1;
}

// tickCarlDeeds — fire at most one of Carl's scheduled misdeeds this tick, if the schedule has run
// ahead of what he has actually done. Deterministic: the schedule is a pure function of the monotone
// tick clock and the count of deeds already attributed to Carl (read from world.deeds); the deed is
// recorded through the SAME effectsCore.recordDeed chokepoint every other deed uses (honest actorId
// → his own heat climbs + a THIRD-person travelling claim). Own seeded sub-stream (used only to vary
// which summary line, so the shared world-tick RNG is never perturbed — a no-Carl world draws
// nothing and is byte-identical). Self-correcting + idempotent within a tick (fires one act, then
// the next tick re-checks).
function tickCarlDeeds(w, seedStr) {
  const node = findCarlNode(w);
  if (!node) return w; // Carl absent (any non-slice/demo seed) → pure no-op, no rng drawn.

  const clock = carlClock(w);
  const owed = carlDeedsOwed(clock);
  if (owed <= 0) return w; // still in the grace period.

  // How many has he already done? (Deeds attributed to Carl in the recency window.) The window is
  // capped at 64 deeds; Carl's cadence is slow enough that his own recent count is the schedule
  // anchor. If the schedule is satisfied, nothing is owed this tick.
  const done = (Array.isArray(w.deeds) ? w.deeds : [])
    .reduce((n, d) => n + (d && String(d.actorId) === CARL_ACTOR_ID ? 1 : 0), 0);
  if (done >= owed) return w;

  // This is act number `done + 1` (1-based) — the next one he owes. Drives escalation + summary.
  const actNo = done + 1;

  // Witnesses = the OTHER named people at Carl's node (exclude Carl himself). If he stands alone,
  // the act still records (heat) but is "wild" (no witnesses) → mints no travelling claim.
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  const witnesses = npcs
    .filter(n => n && String(n.id) !== CARL_ACTOR_ID && n.authoredFigure !== 'carl')
    .map(n => String(n.id))
    .filter(Boolean)
    .slice(0, CARL_WITNESS_CAP);

  const severity = actNo >= CARL_ESCALATE_AFTER ? CARL_SEVERITY_HEAVY : CARL_SEVERITY_MOD;

  // Own sub-stream — only picks the summary line, so it never touches the shared tick RNG.
  const cRng = makeRng(seedFromString(`${seedStr}|carl-deed|a${actNo}`));
  const summary = CARL_DEED_SUMMARIES[cRng.int(0, CARL_DEED_SUMMARIES.length - 1)];

  // Record through the one chokepoint. actorId = Carl (honest) → his morality-lite heat climbs and
  // the deed travels as a THIRD-person claim; the player is never the subject. `t` is the monotone
  // clock so the deed's stable id (deed:<node>:<kind>:<t>) is unique per act.
  return applyDeltas(w, [{
    op: 'recordDeed',
    deedKind: 'cruelty',
    severity,
    actorId: CARL_ACTOR_ID,
    nodeId: String(node.id || ''),
    witnesses,
    summary,
    t: clock
  }]);
}

// ── P-74b — the Adversary's reaction loop ───────────────────────────────────
// The villain works its agenda on a patient clock and REACTS: completed player
// goals feed the clock (you proved dangerous — it adapts), and crossing an M4
// corruption tier earns a recruitment overture (it would rather own you than
// fight you). Stage changes surface as county-visible symptoms: a rumor and a
// ledger threat, never the name (rumor-first; discovery is P-74c's business).
function tickVillain(w) {
  let next = mintVillain(w);
  const v = next.villain;
  if (!v || v.defeated) return next;

  const goalsDone = (next.timeline || []).reduce((n, e) => n + (e?.kind === 'goalCompleted' ? 1 : 0), 0);
  const newGoals = Math.max(0, goalsDone - (v.seen?.goals ?? 0));

  const corruption = Number(next.party?.[0]?.morality?.corruption ?? 0);
  const tier = corruptionTier(corruption);
  const seenTier = v.seen?.corruptionTier ?? 0;
  let overtureTier = v.seen?.overtureTier ?? 0;

  let stage = v.agenda.stage;
  let clock = v.agenda.clock + 1 + newGoals * VILLAIN_GOAL_ACCEL;
  const lastStage = v.agenda.stages.length - 1;

  // Reaction 1 — the player completes goals; the villain adapts and hurries.
  if (newGoals > 0) {
    next = pushEvent(next, { kind: 'villainAdapts', data: { goals: newGoals, stage } });
    next = pushTickLog(next, '[TICK] something out in the county adjusts its plans around you');
  }

  // Reaction 2 — corruption crosses an M4 tier; one overture per tier, ever.
  if (tier > seenTier && tier > overtureTier) {
    overtureTier = tier;
    const overture = 'someone has been watching what you are becoming — old coin and a patient offer wait for those willing to go further';
    next = appendVillainRumor(next, `rumor_villain_overture_t${tier}`, overture, ['villain', 'overture']);
    next = addThreat(next, overture, clampInt(1 + tier, 1, 5));
    next = pushEvent(next, { kind: 'villainOverture', data: { tier } });
    next = pushTickLog(next, '[TICK] an overture is being prepared for you');
  }

  // The agenda grinds forward; each stage lands as a symptom the county can feel.
  if (clock >= VILLAIN_STAGE_COST && stage < lastStage) {
    stage += 1;
    clock = 0;
    const sign = String(v.agenda.stages[stage]?.sign || '');
    if (sign) {
      next = appendVillainRumor(next, `rumor_villain_stage_${stage}`, sign, ['villain', 'stage']);
      next = addThreat(next, sign, clampInt(1 + stage, 1, 5));
    }
    next = pushEvent(next, { kind: 'villainStage', data: { stage, sign } });
    next = pushTickLog(next, "[TICK] the county's trouble deepens");
  } else if (clock > VILLAIN_STAGE_COST && stage >= lastStage) {
    clock = VILLAIN_STAGE_COST; // poised at the brink — the arc (P-74c) resolves it
  }

  const villain = {
    ...v,
    agenda: { ...v.agenda, stage, clock },
    seen: { goals: goalsDone, corruptionTier: Math.max(tier, seenTier), overtureTier }
  };
  return { ...next, villain };
}

// Villain rumors carry no carrier NPC (the county itself is muttering) and a
// deterministic id, so re-ticks never duplicate. Shape mirrors the mintRumor
// delta op; ensureRumors re-normalizes on the next ensureWorld pass.
function appendVillainRumor(w, id, body, tags) {
  const rumors = Array.isArray(w.rumors) ? w.rumors : [];
  if (rumors.some(r => r.id === id) || rumors.length >= 64) return w;
  const rumor = {
    id,
    sourceSeedId: id,
    carrierNpcId: '',
    hopCount: 1,
    tier: 1,
    age: 0,
    mintedAt: clampInt(w.timeline?.length ?? 0, 0, 999999),
    body: String(body),
    tags: Array.isArray(tags) ? tags : []
  };
  return { ...w, rumors: [...rumors, rumor] };
}

function tickFactions(w, rng, severity) {
  const factions = Array.isArray(w.factions) ? w.factions : [];
  if (!factions.length) return w;

  const next = factions.map(f => {
    const pressure = clampInt((f.pressure ?? 0) + Math.max(1, Math.round(1 * severity)), 0, 100);
    const hostility = clampInt((f.hostility ?? 0) + (w.ecology.corruption >= 70 ? 2 : 0) + (w.ecology.scarcity >= 75 ? 1 : 0), 0, 100);
    const move = pickFactionMove({ pressure, hostility, rng });
    return { ...f, pressure, hostility, lastMove: move };
  });

  // Offscreen action when hostility high.
  const hostile = next.filter(f => f.hostility >= 80);
  let w2 = { ...w, factions: next };
  if (hostile.length) {
    const f0 = hostile[0];
    w2 = pushTickLog(w2, `[TICK] faction ${f0.id} enters war posture (${f0.lastMove})`);
    // War posture raises pressure clock deterministically.
    w2 = { ...w2, clocks: { ...w2.clocks, pressure: clampInt(w2.clocks.pressure + 1, 0, 12) } };
  }
  return w2;
}

function tickLivingThreads(w, rng, severity) {
  const inst = ensureInstrumentLayer(w.instrument);
const threads = inst.threads;
  if (!threads.length) return w;

  const bump = Math.max(1, Math.round(1 * severity));
  const next = threads.map(t => {
    if (t.status === 'resolved') return t;
    const tension = clampInt((t.tension ?? 0) + bump, 0, 5);
    const age = clampInt((t.age ?? 0) + 1, 0, 999);

    // If unresolved for N ticks -> mutate objective deterministically.
    let objective = String(t.objective || '').trim();
    let trajectory = String(t.trajectory || 'static');
    if (age > 4 && (age % 3 === 0)) {
      trajectory = 'mutating';
      objective = mutateObjective(objective, rng);
    }

    return { ...t, tension, age, objective, trajectory };
  });

  // Recalculate inevitability from current thread tensions.
  const openThreads = next.filter(t => t.status !== 'resolved');
  const tensionSum = openThreads.reduce((s, t) => s + clampInt(t.tension, 0, 5), 0);
  const inevitability = clampInt(tensionSum, 0, 10);

  let w2 = { ...w, instrument: { ...inst, threads: next, inevitability } };

  // Escalate event when any thread crosses threshold.
  // Canonical threadShift surface: log a stable event when tension crosses the escalation threshold.
  const prevById = new Map((threads || []).map(t => [String(t.id), t]));
  const crossed = next
    .filter(t => t.status !== 'resolved')
    .map(t => {
      const prev = prevById.get(String(t.id)) || {};
      const from = Number(prev.tension ?? 0);
      const to = Number(t.tension ?? 0);
      return { t, from, to };
    })
    .filter(x => x.from < 4 && x.to >= 4)
    .sort((a, b) => (b.to - a.to) || String(a.t.id).localeCompare(String(b.t.id)));

  if (crossed.length) {
    const x = crossed[0];
    w2 = pushEvent(w2, { kind: 'threadShift', data: { threadId: String(x.t.id), from: x.from, to: x.to, reason: 'tensionThreshold' } });
  }

  const hot = next.filter(t => t.status !== 'resolved' && t.tension >= 4).sort((a, b) => (b.tension - a.tension) || a.id.localeCompare(b.id));
  if (hot.length) {
    const t0 = hot[0];
    w2 = pushTickLog(w2, `thread escalates: ${t0.label} (tension:${t0.tension}/6)`);
  }
  return w2;
}

function tickMapPressure(w, rng, severity) {
  const m = ensureMap(w.map);
  if (!m.nodes.length) return w;

  const factions = Array.isArray(w.factions) ? w.factions : [];
  if (!factions.length) return w;

  const hostile = factions.filter(f => (f.hostility ?? 0) >= 85).sort((a, b) => (b.hostility - a.hostility) || a.id.localeCompare(b.id));
  if (!hostile.length) return w;

  // Pick a target node deterministically, biased toward current node.
  const here = String(m.currentNodeId || m.nodes[0].id);
  const pool = [here, ...m.nodes.map(n => n.id)].filter(Boolean);
  const targetId = String(rng.pick(pool) || here);

  // Apply a place-scar that sceneDirector/composer can surface.
  const f0 = hostile[0];
  const scarId = `faction:${f0.id}:${f0.lastMove || 'pressure'}`;

  const w2 = scarifyNode(w, targetId, scarId);
  return pushTickLog(w2, `[TICK] offscreen action scars ${targetId} (${scarId})`);
}

function mutateObjective(obj, rng) {
  const o = String(obj || '').trim();
  const twists = [
    (x) => `Contain ${x}`,
    (x) => `Pay the price to ${x.toLowerCase()}`,
    (x) => `Expose who benefits from ${x.toLowerCase()}`,
    (x) => `Choose what to sacrifice to ${x.toLowerCase()}`
  ];
  const fn = rng.pick(twists) || twists[0];
  return fn(o || 'survive');
}

function tickThreats(w, severity) {
  const threats = Array.isArray(w.ledger?.threats) ? w.ledger.threats : [];
  if (!threats.length) return w;

  // Deterministic escalation: more threats => more pressure.
  const bump = clampInt(Math.round(threats.length * 0.25 * severity), 0, 3);
  if (bump <= 0) return w;

  const next = { ...w, clocks: { ...w.clocks, pressure: clampInt(w.clocks.pressure + bump, 0, 12) } };
  return pushTickLog(next, `[TICK] unresolved threats tighten (+${bump} pressure)`);
}

function tickGearSignals(w, severity) {
  const party = Array.isArray(w.party) ? w.party : [];
  if (!party.length) return w;

  let noise = 0;
  let light = 0;
  let weight = 0;
  let bulk = 0;

  for (const e of party) {
    const s = scoreInventorySignals(e);
    noise += s.noise;
    light += s.light;
    weight += s.weight;
    bulk += s.bulk;
  }

  // Thresholds tuned for small parties: 3–5 people should matter, but never dominate.
  // - noise: attracts attention => pressure up
  // - light: makes you visible; when dread is already high, light worsens paranoia => dread up
  const noiseThreshold = 12;
  const lightThreshold = 14;

  const noiseBump = noise >= noiseThreshold ? Math.max(1, Math.round(1 * severity)) : 0;
  const lightBump = (light >= lightThreshold && (w.clocks.dread ?? 0) >= 6) ? 1 : 0;

  // Carry weight/bulk into pressure slightly (fatigue/slow movement), but only at high loads.
  const load = weight + bulk;
  const loadBump = load >= 45 ? 1 : 0;

  const pBump = clampInt(noiseBump + loadBump, 0, 3);
  const dBump = clampInt(lightBump, 0, 2);

  if (!pBump && !dBump) return w;

  const next = {
    ...w,
    clocks: {
      ...w.clocks,
      pressure: clampInt(w.clocks.pressure + pBump, 0, 12),
      dread: clampInt(w.clocks.dread + dBump, 0, 12)
    }
  };

  return pushTickLog(next, `[TICK] gear signals echo (noise:${noise}, light:${light}${pBump ? ` → pressure+${pBump}` : ''}${dBump ? ` → dread+${dBump}` : ''})`);
}

function tickEnv(w, severity) {
  const env = w.env && typeof w.env === 'object' ? w.env : { noise: 0, heat: 0, scent: 0, light: 0 };
  const noise = clampInt(env.noise ?? 0, 0, 6);
  const heat = clampInt(env.heat ?? 0, 0, 6);
  const scent = clampInt(env.scent ?? 0, 0, 6);
  const light = clampInt(env.light ?? 0, 0, 6);

  let pBump = 0;
  let dBump = 0;

  // Convert residue into escalation.
  if (noise >= 4) pBump += Math.max(1, Math.round(1 * severity));
  if (heat >= 5) pBump += 1;
  if (scent >= 5) pBump += 1;

  // Low light + high dread = paranoia spiral.
  if (light <= 1 && (w.clocks.dread ?? 0) >= 6) dBump += 1;

  pBump = clampInt(pBump, 0, 3);
  dBump = clampInt(dBump, 0, 2);

  // Decay every tick (the world doesn't remember everything forever).
  // Slow decay (1 pt/tick) lets residue accumulate before decaying away.
  const decay = 1;
  const nextEnv = {
    noise: clampInt(noise - decay, 0, 6),
    heat: clampInt(heat - decay, 0, 6),
    scent: clampInt(scent - decay, 0, 6),
    light: clampInt(light - 1, 0, 6)
  };

  const changed = (nextEnv.noise !== noise) || (nextEnv.heat !== heat) || (nextEnv.scent !== scent) || (nextEnv.light !== light);
  const bumps = pBump || dBump;
  if (!changed && !bumps) return w;

  const next = {
    ...w,
    env: nextEnv,
    clocks: {
      ...w.clocks,
      pressure: clampInt((w.clocks.pressure ?? 0) + pBump, 0, 12),
      dread: clampInt((w.clocks.dread ?? 0) + dBump, 0, 12)
    }
  };

  const note = `[TICK] env consumes/decays (noise:${noise} heat:${heat} scent:${scent} light:${light}${pBump ? ` → pressure+${pBump}` : ''}${dBump ? ` → dread+${dBump}` : ''})`;
  return pushTickLog(next, note);
}

function tickQuestions(w, rng) {
  const questions = Array.isArray(w.ledger?.questions) ? w.ledger.questions : [];
  if (!questions.length) return w;

  // Age by transforming exactly one question occasionally.
  if (rng.nextFloat() >= 0.35) return w;

  const i = rng.int(0, questions.length - 1);
  const entry = questions[i];
  // Questions may be objects with a .text property or bare strings.
  const q = String(entry && typeof entry === 'object' ? (entry.text || '') : (entry || '')).trim();
  if (!q) return w;

  const transformed = q.endsWith('?') ? q.replace(/\?+$/, '?') : `${q}?`;
  const nextQs = questions.slice();
  // Preserve object structure if the entry was an object; update .text in place.
  nextQs[i] = entry && typeof entry === 'object' ? { ...entry, text: transformed } : transformed;
  const w2 = { ...w, ledger: { ...w.ledger, questions: nextQs } };
  return pushTickLog(w2, `[TICK] a question sharpens: "${truncate(transformed, 48)}"`);
}

function tickEcology(w, severity) {
  const inst = ensureInstrumentLayer(w.instrument);
  const e = w.ecology || { corruption: 0, instability: 0, scarcity: 0 };
  const open = inst.threads.filter(t => t.status !== 'resolved');
  const tensionSum = open.reduce((s, t) => s + (t.tension ?? 0), 0);

  const corruptionBump = Math.round((tensionSum > 0 ? 1 + tensionSum * 0.15 : 0) * severity);
  const scarcityBump = Math.round((w.clocks.pressure >= 8 ? 1 : 0) * severity);
  const instabilityBump = Math.round(((w.clocks.pressure >= 6 ? 1 : 0) + (w.clocks.dread >= 6 ? 1 : 0)) * severity);

  const next = {
    corruption: clampInt(e.corruption + corruptionBump, 0, 100),
    scarcity: clampInt(e.scarcity + scarcityBump, 0, 100),
    instability: clampInt(e.instability + instabilityBump, 0, 100)
  };

  let w2 = { ...w, ecology: next };
  if (corruptionBump + scarcityBump + instabilityBump > 0) {
    w2 = pushTickLog(w2, `[TICK] ecology drifts (corruption+${corruptionBump}, scarcity+${scarcityBump}, instability+${instabilityBump})`);
  }
  return w2;
}

function applyIrreversibleThresholds(w) {
  let w2 = w;

  if (w2.ecology.corruption > 70) {
    w2 = ensureScar(w2, 'corruption_shift', 'Corruption breached 70: the world permanently darkens.', 'corruption>70');
  }
  const maxHostility = (Array.isArray(w2.factions) ? w2.factions.reduce((m, f) => Math.max(m, f.hostility ?? 0), 0) : 0);
  if (maxHostility > 80) {
    w2 = ensureScar(w2, 'war_state', 'Hostility breached 80: factions enter open conflict.', 'hostility>80');
  }
  if (w2.ecology.scarcity > 75) {
    w2 = ensureScar(w2, 'famine_arc', 'Scarcity breached 75: famine arc unlocked.', 'scarcity>75');
  }

  // Per-node scars use lower thresholds — playtest expects to see the place
  // mark itself as ecology and clocks drift, not only at terminal thresholds.
  // Stamp the current node so the visited place reflects accumulated pressure.
  const here = String(w2.map?.currentNodeId ?? '');
  if (here) {
    if ((w2.clocks?.pressure ?? 0) >= 8) w2 = scarifyNode(w2, here, 'pressure_mark');
    if ((w2.clocks?.dread ?? 0) >= 8) w2 = scarifyNode(w2, here, 'dread_mark');
    if (w2.ecology.corruption >= 10) w2 = scarifyNode(w2, here, 'corruption_taint');
    if (w2.ecology.scarcity >= 15)  w2 = scarifyNode(w2, here, 'scarcity_strain');
    if (w2.ecology.instability >= 15) w2 = scarifyNode(w2, here, 'instability_fracture');
    if (maxHostility >= 40) w2 = scarifyNode(w2, here, 'hostility_mark');
  }

  return w2;
}

function tickReputation(w, severity) {
  const rep = w.reputation || { factions: {} };
  const factions = Array.isArray(w.factions) ? w.factions : [];
  if (!factions.length) return w;

  // Reputation decays slightly under harsh fate; stabilizes under cooperative.
  const drift = severity > 1.2 ? -1 : severity < 1.0 ? 0 : -0;
  if (!drift) return w;

  const next = { ...rep, factions: { ...(rep.factions || {}) } };
  for (const f of factions) {
    const cur = clampInt(next.factions[f.id] ?? 0, -100, 100);
    next.factions[f.id] = clampInt(cur + drift, -100, 100);
  }
  return { ...w, reputation: next };
}

// ── MP-5b — the Cassandra (docs/MORAL_PHYSICS.md §5) ─────────────────────────────────
// "A person who sees you clearly and says the hard thing once, plainly, and can be waved
// off." Pinned interpretation (docs/briefs/MP-5b-the-cassandra.md): "at the T2→T3
// boundary" means the APPROACH BAND, `[cassandraBandFloor(), HUNT_HEAT)` — the warning
// must land BEFORE the hunt, while heeding (cooling off, making amends, leaving) can
// still matter. She is a REAL present NPC, never a voice from nowhere: if nobody is at
// the player's node when heat enters the band, the beat HOLDS (armed, undelivered) until
// someone is. This is the one structural difference from MP-3's huntedT / MP-4's pactT
// (a single latch is enough for them — the hunt/gift never "wait for a witness"), so the
// Cassandra needs TWO fields on morality (engine/state.js's ensureMorality has the full
// reasoning): `cassandraArmed` (true while the warning is owed but unspoken) and
// `cassandraT` (the tick it was actually SPOKEN — 0 until delivered). Once set, cassandraT
// is a PERMANENT latch — exactly huntedT's own convention — it stays >0 across every later
// worldTick call (never re-fires) until heat cools back below the band FLOOR (not merely
// below HUNT_HEAT — staying in-band after being warned must not immediately re-arm a
// second warning); tickHeatDecay clears both fields together on that cooling, mirroring
// where huntedT re-arms.
//
// "FIRES ONCE" (this latch) is a different, STRONGER guarantee than "shows for one
// narrated turn" (a softer, best-effort cosmetic concern owned entirely by the surfacing
// layer): narratorContext.js's cassandraOmen (MP-5a's idiom) only PRINTS the line while
// this delivery is still the freshest thing the world-tick log recorded — see that
// function's comment for the exact freshness read. If that softer check ever shows the
// line for more than one literal render in some edge case, the beat has still only fired
// ONCE canonically (this latch is unaffected) — a narration nicety, not a physics bug.
//
// DETERMINISM: no RNG consumed unless there is a genuine tie among present NPCs at equal
// trust (a sub-stream seeded off node+roster, never the shared tick stream) — a run that
// never enters the band, or enters it with a single obvious present witness, draws
// nothing extra and stays byte-identical to before this packet.
// HIDE-THE-MATH: this function stores no NPC choice and produces no player-facing string
// (that is narratorContext.js's read-only surfacing, MP-5a's idiom) — it only decides
// WHEN the beat is owed and WHEN it was spoken, exactly as MP-3's tickHunt decides WHEN
// the hunt arrives without itself writing the encounter's prose.
function tickCassandra(w) {
  const player = Array.isArray(w.party) ? w.party[0] : null;
  const mo = (player && player.morality && typeof player.morality === 'object') ? player.morality : null;
  if (!mo) return w;

  const heat = Number(mo.heat ?? 0);
  const armed = Boolean(mo.cassandraArmed ?? false);
  const delivered = Number(mo.cassandraT ?? 0);
  const floor = cassandraBandFloor();

  // Below the band floor: nothing owed. (Re-arming when heat FALLS below the floor is
  // tickHeatDecay's job, mirroring where huntedT/pactT re-arm — this function only ARMS
  // and DELIVERS forward, it never itself clears a stale latch.)
  if (heat < floor) return w;

  // Already delivered for this crossing (cassandraT set) and heat hasn't cooled back
  // below the floor since (that would have cleared it in tickHeatDecay) → nothing to do.
  if (delivered > 0) return w;

  // Heat is in (or has blown through) the band and the beat hasn't been spoken yet.
  // Arm the latch (idempotent if already armed) and look for a present witness to speak it.
  const tick = w.time?.turn ?? 0;
  const witness = pickCassandraWitness(w);
  if (!witness) {
    // Nobody is here. HOLD — arm (if not already) and wait; no player-facing effect.
    if (armed) return w;
    return mutatePlayerMorality(w, (m) => ({ ...m, cassandraArmed: true }));
  }

  // A real present NPC speaks it. Deliver: stamp the tick (Math.max(1,…) so tick 0 still
  // marks "delivered", same convention as huntedT/pactT), clear the HOLD flag. No RNG
  // beyond pickCassandraWitness's own tie-break sub-stream; no player-facing string here —
  // narratorContext.js's cassandraOmen calls this SAME pickCassandraWitness(w) fresh, off
  // the SAME live occupancy read, while the freshness window holds (MP-5a's "derived, never
  // stored" discipline — see U579-03's precedent — extended: the NPC choice is re-derived,
  // not cached, so it can never drift from a stored-but-stale id).
  const w2 = mutatePlayerMorality(w, (m) => ({ ...m, cassandraArmed: false, cassandraT: Math.max(1, tick) }));
  return pushTickLog(w2, `[TICK] the Cassandra speaks (moral warning at ${w.map?.currentNodeId || 'here'})`);
}

// The "who is HERE right now" pool, duplicated from narratorContext.js's roomOccupantsHere
// rather than imported (the repo convention noted in escalation.js's own DEED_SEV comment:
// mirror a small value/branch across a layer boundary rather than reach across it — worldTick
// is the world-simulation layer, narratorContext is the narration layer, and this keeps the
// dependency direction narration→engine, never the reverse). Pure; never throws.
function cassandraOccupantsHere(w) {
  const interior = (w.scene?.interior && typeof w.scene.interior === 'object' && w.scene.interior) ? w.scene.interior : null;
  return interior
    ? occupantsOfRoom(w, String(interior.structureKey || ''), String(interior.roomId || ''))
    : outdoorOccupants(w);
}

// Deterministically choose the present NPC who speaks the Cassandra line. Prefers the
// highest conversationState.trustLevel (a witness-trusted voice reads truer than a
// stranger's), tie-broken by a seeded pick so the same standing always yields the same
// speaker. Returns the NPC object, or null if nobody is present. Exported so
// narratorContext.js can re-derive the SAME answer at render time from cassandraT's tick
// (never stored on state — the same "derived, not stored" discipline moralOmen uses).
export function pickCassandraWitness(w) {
  const present = cassandraOccupantsHere(w).filter(n => n && (n.id || n.name));
  if (!present.length) return null;
  if (present.length === 1) return present[0];

  let best = -Infinity;
  for (const n of present) {
    const t = Number(n?.conversationState?.trustLevel ?? 5);
    if (t > best) best = t;
  }
  const topTrust = present.filter(n => Number(n?.conversationState?.trustLevel ?? 5) === best);
  if (topTrust.length === 1) return topTrust[0];

  const nodeId = String(w.map?.currentNodeId || '');
  const wRng = makeRng(seedFromString(`${w.meta?.seed}|cassandra-witness|${nodeId}|${topTrust.map(n => String(n.id || n.name)).sort().join(',')}`));
  return topTrust[wRng.int(0, topTrust.length - 1)];
}

// ── MP-3 — the hunt (Tier 3 goes live). docs/MORAL_PHYSICS.md §4 T3 row ──────────────
// When the player's accumulated heat crosses HUNT_HEAT, the world stops waiting: the
// virtue-gods' avengers / crime pressure arrive through the EXISTING spawnEncounter organ
// (a ROUTER to a live organ, not new effect code). Fires ONCE per crossing — a `huntedT`
// latch on morality prevents re-spawning every tick while heat stays hot; the latch re-arms
// in tickHeatDecay once heat cools back below the threshold. Deterministic-by-seed: the
// encounter runs on its OWN sub-RNG (seeded by the tick clock + heat), so it NEVER draws from
// the shared tick stream — a run that never crosses the threshold is byte-identical to before.
// HIDE-THE-MATH: the player sees hunters at the node, never a heat number (invariant I).
function tickHunt(w) {
  const player = Array.isArray(w.party) ? w.party[0] : null;
  const mo = (player && player.morality && typeof player.morality === 'object') ? player.morality : null;
  if (!mo) return w;

  const heat = Number(mo.heat ?? 0);
  const hunted = Number(mo.huntedT ?? 0);
  // Below the threshold, or already dispatched and not yet re-armed (huntedT set) → no hunt.
  if (heat < HUNT_HEAT || hunted > 0) return w;

  const tick = w.time?.turn ?? 0;
  const node = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
  const biome = node ? biomeForNode(w.meta?.seed, node) : 'wilderness';
  // Seed unique to THIS crossing (tick + heat + timeline depth) — same seed ⇒ same hunters.
  const hRng = makeRng(seedFromString(`${w.meta?.seed}|moral-hunt|t${tick}|tl${w.timeline?.length ?? 0}|heat${Math.round(heat)}`));
  // Party of avengers; a second hunter joins once heat is well over the line (deeper guilt =
  // heavier answer). CR mild — this is a reckoning the player can face or flee, not an execution.
  const overBy = heat - HUNT_HEAT;
  const count = overBy >= HUNT_HEAT ? 3 : 2;
  const cr = 1 + (overBy >= HUNT_HEAT ? 1 : 0);
  const creatures = selectCreatures(cr, count, null, hRng, biome);
  if (!Array.isArray(creatures) || creatures.length === 0) {
    // No creature could be selected (degenerate world) — still latch so we don't spin.
    return mutatePlayerMorality(w, (m) => ({ ...m, huntedT: Math.max(1, tick) }));
  }

  // ambush:false — the hunters ARRIVE at the node (the player sees them and chooses to
  // engage), rather than a force-started combat cut mid-world-tick. This is the DM-authentic
  // "they show up looking for you," and it touches no combat state (spawnEncounter places
  // them as hostile NPCs at currentNodeId).
  let w2 = spawnEncounter(w, creatures, { ambush: false, reason: 'moral-hunt' }, hRng);
  // Latch: record the tick we dispatched (Math.max(1,…) so tick 0 still marks "hunted"),
  // so this fires once, not every tick.
  w2 = mutatePlayerMorality(w2, (m) => ({ ...m, huntedT: Math.max(1, tick) }));
  return pushTickLog(w2, `[TICK] the hunt arrives (moral reckoning at ${w.map?.currentNodeId || 'here'})`);
}

// Heat bleeds off with time/distance (§4), and the hunt re-arms once heat has cooled back
// below HUNT_HEAT. GENTLE + robust: a per-tick counter (heatCoolTicks) accrues one tick per
// world-tick, and every HEAT_DECAY_INTERVAL ticks it sheds HEAT_DECAY_PER_TICK heat and
// resets. This makes the rate independent of the world-tick's irregular timeline clock, and
// crucially survives a single player turn that advances many ticks at once (a multi-day build
// runs up to 30 downtime ticks — a per-tick bleed would launder a fresh atrocity to nothing).
// Deterministic: pure counter arithmetic, no RNG consumed.
function tickHeatDecay(w) {
  const player = Array.isArray(w.party) ? w.party[0] : null;
  const mo = (player && player.morality && typeof player.morality === 'object') ? player.morality : null;
  if (!mo) return w;

  const heat = Number(mo.heat ?? 0);
  const cool = Number(mo.heatCoolTicks ?? 0);
  const hunted = Number(mo.huntedT ?? 0);
  const cassandraArmed = Boolean(mo.cassandraArmed ?? false);
  const cassandraT = Number(mo.cassandraT ?? 0);

  let nextHeat = heat;
  let nextCool = cool;
  if (heat > 0) {
    nextCool = cool + 1;
    if (nextCool >= HEAT_DECAY_INTERVAL) {
      const steps = Math.floor(nextCool / HEAT_DECAY_INTERVAL);
      nextHeat = Math.max(0, heat - HEAT_DECAY_PER_TICK * steps);
      nextCool = nextCool % HEAT_DECAY_INTERVAL;
    }
  } else {
    nextCool = 0; // cold — nothing to count toward.
  }
  // Re-arm the hunt latch once heat has cooled back below the threshold (a reformed / fled
  // actor can be hunted AGAIN if they climb back over later).
  const nextHunted = nextHeat < HUNT_HEAT ? 0 : hunted;
  // MP-5b — re-arm the Cassandra ONLY once heat has cooled back below the approach band's
  // OWN floor (docs/MORAL_PHYSICS.md §5: "re-arms only after cooling below the band floor")
  // — a lower bar than HUNT_HEAT itself, deliberately: a player who was warned and then sat
  // in-band (neither cooling fully nor crossing into the hunt) must NOT get re-warned every
  // time heat merely dips and climbs again inside the same band. Both fields clear together.
  const floor = cassandraBandFloor();
  const belowFloor = nextHeat < floor;
  const nextCassandraArmed = belowFloor ? false : cassandraArmed;
  const nextCassandraT = belowFloor ? 0 : cassandraT;

  if (nextHeat === heat && nextCool === cool && nextHunted === hunted
      && nextCassandraArmed === cassandraArmed && nextCassandraT === cassandraT) return w;
  return mutatePlayerMorality(w, (m) => ({
    ...m,
    heat: nextHeat,
    heatCoolTicks: nextCool,
    huntedT: nextHunted,
    cassandraArmed: nextCassandraArmed,
    cassandraT: nextCassandraT
  }));
}

// ── MP-4 — the pact (Tier 4 goes live). docs/MORAL_PHYSICS.md §4 T4 row ───────────────
// When the player's standing corruption reaches PACT_CORRUPTION (the lowest darkGift
// threshold — read from forbiddenGates, NEVER forked), the world stops merely recoiling and
// CLAIMS the doer: the forbidden gift arrives UNBIDDEN through the EXISTING forbiddenGates
// organ (a ROUTER to live effect code — the same learnSpell grant the M4 dark-path already
// uses, not new effect content). The player never asked; free power is the loudest sign they
// are being claimed.
//
// WHY THE TICK, when playloop.js already grants on a crossing: the live playloop hook is
// EDGE-triggered on a single player turn's corruption delta (old→new inside playerMoveTraced).
// It cannot see a crossing that happens any OTHER way — corruption creeping over the line by
// slow accumulation across turns (no single turn's delta straddles it), or axis effects applied
// outside that top-level snapshot (cast-consequence, coerced builds, story arcs). This tick is
// the LEVEL-triggered safety net: it delivers whatever the doer is owed at their CURRENT
// corruption, so the claiming can never be silently missed. On the common case (the deed itself
// crosses the threshold), the playloop grants first and marks the spell known → this tick finds
// it already known and only latches, granting nothing twice.
//
// LATCH + RE-ARM: a `pactT` latch (MP-3's huntedT precedent) fires the gift ONCE per crossing
// and re-arms only after corruption falls back below the threshold — a repented actor who
// later relapses can be claimed again. DETERMINISTIC: pure arithmetic + a single learnSpell
// delta; NO rng consumed (unlike the hunt, the gift is fixed by the threshold, not drawn), so a
// sub-threshold run never touches any stream and is byte-identical to before.
// HIDE-THE-MATH: no player-facing string is produced here — the diegetic gift-arrival prose is
// MP-5's surfacing packet. The [TICK] log below is internal diagnostics (never shown), the same
// as MP-3's hunt log (invariant I).
function tickPact(w) {
  const player = Array.isArray(w.party) ? w.party[0] : null;
  const mo = (player && player.morality && typeof player.morality === 'object') ? player.morality : null;
  if (!mo) return w;

  const corruption = Number(mo.corruption ?? 0);
  const pacted = Number(mo.pactT ?? 0);
  const tick = w.time?.turn ?? 0;

  // Re-arm FIRST: if corruption has fallen back below the pact threshold, clear a spent latch
  // (a reformed actor who relapses can be claimed anew). Below threshold ⇒ never a gift.
  if (corruption < PACT_CORRUPTION) {
    if (pacted === 0) return w;
    return mutatePlayerMorality(w, (m) => ({ ...m, pactT: 0 }));
  }
  // At/over the threshold but already claimed this crossing (latch set) → nothing to do.
  if (pacted > 0) return w;

  // The world claims the doer. Read the gift the actor is owed at their current corruption from
  // the SAME table PACT_CORRUPTION derives from (never forked). A positive return means
  // corruption ≥ PACT_CORRUPTION by construction (PACT_CORRUPTION = the lowest threshold).
  const gift = darkGiftAtCorruption(corruption);
  if (!gift) {
    // Degenerate (no gift table entry qualifies) — still latch so we don't re-check every tick.
    return mutatePlayerMorality(w, (m) => ({ ...m, pactT: Math.max(1, tick) }));
  }

  const known = Array.isArray(player.spells?.known) ? player.spells.known : [];
  if (known.includes(gift.ref)) {
    // Already granted (typically by the live playloop edge-hook on the crossing turn) — latch
    // only, grant nothing twice. This is the common path when a deed itself crosses the line.
    return mutatePlayerMorality(w, (m) => ({ ...m, pactT: Math.max(1, tick) }));
  }

  // Deliver the gift through the sanctioned mutation path (learnSpell delta → applyDeltas), then
  // latch (Math.max(1,…) so tick 0 still marks "claimed"). No player-facing string (MP-5 surfaces).
  let w2 = applyDeltas(w, [{ op: 'learnSpell', spellRef: gift.ref }]);
  w2 = mutatePlayerMorality(w2, (m) => ({ ...m, pactT: Math.max(1, tick) }));
  return pushTickLog(w2, `[TICK] the gift arrives unbidden (the doer is claimed at ${w.map?.currentNodeId || 'here'})`);
}

// Small helper — apply fn to party[0].morality, functionally (mirrors mutateEntity in
// effectsCore but scoped to the player's morality, which is where heat/huntedT/pactT live).
function mutatePlayerMorality(w, fn) {
  const party = Array.isArray(w.party) ? w.party : [];
  if (party.length === 0) return w;
  const nextParty = party.slice();
  const e = nextParty[0] || {};
  const mo = (e.morality && typeof e.morality === 'object') ? e.morality : {};
  nextParty[0] = { ...e, morality: fn(mo) };
  return { ...w, party: nextParty };
}

function tickMotifs(w, rng, severity) {
  const inst = ensureInstrumentLayer(w.instrument);
  const active = Array.isArray(inst.motifsCore?.active) ? inst.motifsCore.active : [];
  if (!active.length) return w;

  // Reinforce one motif occasionally, more often in blood mode.
  const p = severity >= 1.3 ? 0.55 : severity >= 1.1 ? 0.4 : 0.25;
  if (rng.nextFloat() >= p) return w;

  const m = active[rng.int(0, active.length - 1)];
  const w2 = reinforceMotif(w, m, 1);
  return pushTickLog(w2, `[TICK] motif lingers: ${m}`);
}

function tickRumors(w, rng) {
  const rumors = Array.isArray(w.rumors) ? w.rumors : [];
  if (!rumors.length) return w;
  const canonLog = { events: [] };
  const result = propagateRumors(w, rng, canonLog);
  return result.world;
}

function tickGossip(w, rng) {
  // Gossip propagation: NPCs with honesty >= 0.6 who have met the player share
  // player-sourced knowledge to friends/family (bond > 0) in the same settlement.
  // One-hop per tick. Gossip items are tagged so they don't re-propagate endlessly.
  const nodes = Array.isArray(w.map?.nodes) ? w.map.nodes : [];
  let changed = false;
  const nextNodes = nodes.map(node => {
    if (!node.settlement?.decompressed || !Array.isArray(node.settlement?.npcs)) return node;
    const npcs = node.settlement.npcs;
    if (npcs.length < 2) return node;

    // Build per-NPC list of player-shared knowledge eligible for gossip.
    const gossipSources = [];
    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      const honesty = npc.personality?.honesty ?? 0;
      if (honesty < 0.6) continue;
      if (!npc.conversationState?.metPlayer) continue;
      const kg = Array.isArray(npc.knowledgeGraph) ? npc.knowledgeGraph : [];
      const playerFacts = kg.filter(f => f.source === 'player').map(f => f.factId);
      if (playerFacts.length) gossipSources.push({ idx: i, npc, facts: playerFacts });
    }
    if (!gossipSources.length) return node;

    // For each source, spread one fact to one friendly NPC.
    const nextNpcs = [...npcs];
    for (const src of gossipSources) {
      const rels = src.npc.relationships ?? {};
      const friends = Object.entries(rels)
        .filter(([, r]) => (r.bond ?? 0) > 0)
        .map(([targetId]) => targetId);
      if (!friends.length) continue;

      const targetId = rng.pick(friends);
      const targetIdx = nextNpcs.findIndex(n => (n.id || `npc_${npcs.indexOf(n)}`) === targetId);
      if (targetIdx === -1 || targetIdx === src.idx) continue;

      // Pick a random fact to share.
      const fact = rng.pick(src.facts);
      const target = nextNpcs[targetIdx];
      const received = Array.isArray(target.gossipReceived) ? [...target.gossipReceived] : [];
      if (received.some(g => g.fact === fact)) continue; // already knows

      received.push({ fact, from: src.npc.name || src.npc.id, tick: w.time?.turn ?? 0 });
      if (received.length > 10) received.splice(0, received.length - 10); // cap at 10
      nextNpcs[targetIdx] = { ...target, gossipReceived: received };
      changed = true;
    }

    if (nextNpcs === npcs) return node;
    return { ...node, settlement: { ...node.settlement, npcs: nextNpcs } };
  });

  if (!changed) return w;
  const w2 = { ...w, map: { ...w.map, nodes: nextNodes } };
  return pushTickLog(w2, '[TICK] gossip spreads among NPCs');
}

function pickFactionMove({ pressure, hostility, rng }) {
  if (hostility >= 80) return 'strike';
  if (pressure >= 70) return rng.pick(['seize', 'raid', 'blackmail']);
  if (pressure >= 40) return rng.pick(['recruit', 'scheme', 'negotiate']);
  return rng.pick(['observe', 'prepare', 'probe']);
}

function ensureScar(w, id, description, trigger = '') {
  const scars = Array.isArray(w.scars) ? w.scars : [];
  const sid = String(id || '').trim();
  if (!sid) return w;
  if (scars.some(s => s.id === sid)) return w;
  const desc = String(description || '');
  const scar = { id: sid, description: desc, permanent: true };
  let w2 = { ...w, scars: [...scars, scar] };
  // U17: Canonical scarFormed surface: stable event for replay/query/export durability.
  w2 = pushEvent(w2, { kind: 'scarFormed', data: { scarId: sid, description: desc, trigger: String(trigger || '') } });
  return pushTickLog(w2, `[TICK] scar formed: ${sid}`);
}
function pushTickLog(w, line) {
  const t = w.timeline.length;
  const e = { t, kind: 'worldTick', data: { text: String(line) } };
  return { ...w, timeline: [...w.timeline, e] };
}


function pushEvent(world, { kind, data }) {
  const t = world.timeline.length;
  const e = { id: `${kind}:${t}`, t, kind: String(kind), data: data ?? {} };
  return { ...world, timeline: [...world.timeline, e] };
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function truncate(s, n) {
  const x = String(s);
  return x.length <= n ? x : x.slice(0, n - 1) + '…';
}
