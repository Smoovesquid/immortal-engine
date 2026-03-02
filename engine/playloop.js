import { ensureWorld } from './state.js';
import { makeRng, seedFromString } from './rng.js';
import { addFact, addQuestion, addThreat } from './ledger.js';
import { hasFact } from './ledgerUtils.js';
import { fateBand } from './rulesets.js';
import { guardPlayerText } from './guard.js';
import { triggerEnding } from './ending.js';
import { compose } from './composer.js';
import { planNextScene } from './sceneDirector.js';
import { generateInitialMap } from './map/generateMap.js';
import { ensureMap, pickTravelDestination, moveToNode } from './map/mapState.js';
import { conductorDecision, applyConductorDeltas } from './conductor.js';
import { worldTick } from './worldTick.js';
import { resolveMove } from './resolve.js';
import { applyDeltas } from './effectsCore.js';
import { introduceThread } from './instrument.js';

// Pure-ish play loop: world -> {world, output}

export function beginAdventure(world, packsById) {
  let w = ensureWorld(world);
  const primary = packsById[w.pack.primaryId];
  const mixer = w.pack.mixerId ? packsById[w.pack.mixerId] : null;
  const pack = mergePacks(primary, mixer);

  const seed = seedFromString(`${w.meta.seed}|begin|${pack.id}`);
  const rng = makeRng(seed);

  // Living Terrain Engine v1: generate map if missing.
  if (!w.map?.nodes?.length) {
    const packId = w.pack?.primaryId || 'fantasy';
    w = { ...w, map: generateInitialMap({ seed: w.meta.seed, packId, pack }) };
  }

  const m = ensureMap(w.map);
  const here = m.nodes.find(n => n.id === m.currentNodeId);

  const location = here?.name || pickFrom(pack, 'locations', rng) || rng.pick(pack.starterLocations) || 'unknown place';
  const objective = pickFrom(pack, 'objectives', rng) || rng.pick(pack.starterObjectives) || 'survive the night';

  // Ensure instrument exists (deterministic).
  if (!w.instrument?.theme) {
    w = { ...w, instrument: generateInstrument(pack, w.meta.fate, rng) };
  }

  // Tactical zoom defaults off at start.
  w = { ...w, map: { ...(w.map || {}), tactical: { active: false, zoneLayout: null } }, scene: { location, objective, time: 'start', promptSeed: `${seed}` } };

  // Canon facts for guard.
  w = addFact(w, `location:${location}`, 'scene');
  const objFact = `objective:${objective}`;
  if (!hasFact(w, objFact)) w = addFact(w, objFact, 'scene');
  w = addQuestion(w, `How will you approach: ${objective}?`);
  // U16: deterministic starter thread so worldTick/threadShift has a living thread to evolve.
  if (!Array.isArray(w.instrument?.threads) || w.instrument.threads.length === 0) {
    w = introduceThread(w, objective);
  }


  const refKind = sceneRefKind(w, 'opening');

  const outcome = {
    kind: 'begin',
    t: w.timeline.length,
    location,
    objective,
    fateBand: fateBand(w.meta.fate),
    refKind
  };

  w = pushEvent(w, { kind: 'begin', data: { location, objective, pack: pack.id, refKind } });

  const composed = compose(w, '', outcome, { pack });
  w = applyComposerDelta(w, composed.ledgerDelta);
  return { world: w, output: { narration: composed.narrationLine, mechanics: composed.mechanicsLine } };

}

export function playerMove(world, packsById, text) {
  let w = ensureWorld(world);
  const primary = packsById[w.pack.primaryId];
  const mixer = w.pack.mixerId ? packsById[w.pack.mixerId] : null;
  const pack = mergePacks(primary, mixer);

  const guard = guardPlayerText(w, text);
  if (!guard.ok) {
    const outcome = {
      kind: 'blocked',
      t: w.timeline.length,
      input: text,
      reason: guard.reason,
      alternatives: guard.alternatives || []
    };
    w = pushEvent(w, { kind: 'blocked', data: { text } });
    const composed = compose(w, text, outcome, { pack });
    w = applyComposerDelta(w, composed.ledgerDelta);
    return { world: w, output: { narration: composed.narrationLine, mechanics: composed.mechanicsLine } };
  }

  const actorId = (w.party?.[0]?.id) ? String(w.party[0].id) : 'party';
  const move = inferMoveFromText(w, pack, actorId, text);

  const { world2, result } = resolveMove(w, move);
  // Apply deltas (canon mutation path).
  w = applyDeltas(world2, result.deltas);

  const resolution = {
    kind: 'turn',
    t: w.timeline.length,
    roll: result.roll,
    dc: result.dc,
    success: result.outcome === 'success',
    updateKind: inferUpdateKindFromDeltas(result.deltas),
    outcome: result.outcome
  };
  // Canonical resolution surface: persist a stable resolution event for replay/query/export durability.
  w = pushEvent(w, {
    kind: 'resolution',
    data: {
      actorId,
      intent: String(text || ''),
      text: String(text || ''),
      roll: result.roll,
      dc: result.dc,
      outcome: result.outcome,
      updateKind: inferUpdateKindFromDeltas(result.deltas)
    }
  });


  // Living Terrain Engine v1: travel intents advance map position deterministically.
  if (moveAdvancesScene(text)) {
    const dest = pickTravelDestination(w, text);
    const before = w.map?.currentNodeId;
    w = moveToNode(w, dest);
    if (w.map?.currentNodeId && w.map.currentNodeId !== before) {
      w = pushEvent(w, { kind: 'travel', data: { from: before || '', to: w.map.currentNodeId } });
    }
  }

  // Conductor integration: after resolution, propose deltas.
  const aiMode = w.meta.aiMode || 'off';
  if (aiMode !== 'off') {
    const rng2 = makeRng(seedFromString(`${w.meta.seed}|conductorRng|${w.scene.promptSeed}|${w.timeline.length}`));
    const proposal = conductorDecision(w, rng2);
    w = applyConductorDeltas(w, proposal, { mode: aiMode === 'advisory' ? 'advisory' : 'conductor' });
  }

  // Living world tick: every player action advances the world offscreen.
  w = worldTick(w, `${w.meta.seed}|tick|turn${w.time.turn}|tl${w.timeline.length}`);

  // Ending check (deterministic by state).
  const wasEndingTriggered = Boolean(w.ending?.triggered);
  w = triggerEnding(w);
  if (!wasEndingTriggered && Boolean(w.ending?.triggered)) {
    w = pushEvent(w, {
      kind: 'endingTriggered',
      data: {
        endingType: String(w.ending?.type || ''),
        epilogueLine: String(w.ending?.epilogueLine || '')
      }
    });
  }

  const composed = compose(w, text, resolution, { pack });
  w = applyComposerDelta(w, composed.ledgerDelta);

  // Strict output discipline: 1 narration line + 1 bracket line.
  return { world: w, output: { narration: composed.narrationLine, mechanics: result.mechanicsLine } };
}

export function newScene(world, packsById, { lastResolutionKind = 'turn' } = {}) {
  let w = ensureWorld(world);
  const primary = packsById[w.pack.primaryId];
  const mixer = w.pack.mixerId ? packsById[w.pack.mixerId] : null;
  const pack = mergePacks(primary, mixer);

  const seed = seedFromString(`${w.meta.seed}|newScene|${w.timeline.length}|${w.scene.promptSeed}`);

  // Living Terrain Engine v1: advancing a scene moves to an adjacent node deterministically.
  if (w.map?.nodes?.length) {
    const dest = pickTravelDestination(w, '');
    w = moveToNode(w, dest);
  }

  const plan = planNextScene(w, pack, { lastResolutionKind });

  // Update scene deterministically.
  const tactical = (String(plan.beatType || '') === 'confrontation')
    ? { active: true, zoneLayout: { lanes: ['left', 'center', 'right'], coverTags: ['cover', 'shadow'] } }
    : { active: false, zoneLayout: null };

  w = {
    ...w,
    map: { ...(w.map || {}), tactical },
    scene: {
      ...w.scene,
      location: plan.location,
      objective: plan.objective,
      time: 'later',
      promptSeed: String(seed),
      tags: plan.tags,
      thread: plan.thread
    },
    instrument: {
      ...w.instrument,
      lastBeats: [String(plan.beatType || ''), ...(w.instrument.lastBeats || [])].filter(Boolean).slice(0, 5),
      nextBeatOverride: ''
    }
  };

  w = addFact(w, `location:${plan.location}`, 'scene');
  const objFact = `objective:${plan.objective}`;
  if (!hasFact(w, objFact)) w = addFact(w, objFact, 'scene');

  // Carry-forward invariant: add at least one element (deduped).
  if (plan.carry?.kind === 'threat') {
    w = addThreat(w, plan.carry.text, 1);
  } else if (plan.carry?.kind === 'question') {
    w = addQuestion(w, plan.carry.text);
  }

  // Sometimes advance a clock to add stakes.
  if (plan.advanceClock) {
    const which = (seedFromString(`${w.meta.seed}|advClock|${w.timeline.length}`) % 3);
    const key = which === 0 ? 'pressure' : which === 1 ? 'dread' : 'revelation';
    w = { ...w, clocks: { ...w.clocks, [key]: Math.min(12, (w.clocks[key] ?? 0) + 1) } };
  }

  const refKind = sceneRefKind(w, 'scene');
  const outcome = {
    kind: 'scene',
    t: w.timeline.length,
    location: plan.location,
    objective: plan.objective,
    refKind,
    tags: plan.tags,
    thread: plan.thread,
    carry: plan.carry,
    omen: plan.omen,
    price: plan.price
  };

  w = pushEvent(w, { kind: 'scene', data: { location: plan.location, objective: plan.objective, refKind, tags: plan.tags, thread: plan.thread, carry: plan.carry } });
  const wasEndingTriggered = Boolean(w.ending?.triggered);
  w = triggerEnding(w);
  if (!wasEndingTriggered && Boolean(w.ending?.triggered)) {
    w = pushEvent(w, {
      kind: 'endingTriggered',
      data: {
        endingType: String(w.ending?.type || ''),
        epilogueLine: String(w.ending?.epilogueLine || '')
      }
    });
  }

  const composed = compose(w, '', outcome, { pack });
  w = applyComposerDelta(w, composed.ledgerDelta);
  return { world: w, output: { narration: composed.narrationLine, mechanics: composed.mechanicsLine } };
}

// (legacy DC/update logic removed; handled by engine/resolve.js + engine/effectsCore.js)

function moveAdvancesScene(text) {
  const t = String(text || '').toLowerCase();
  return /\b(travel|leave|enter|head to|go to|move to|escape|journey|walk to)\b/.test(t);
}

function inferredFactFromMove(text) {
  const t = String(text).trim();
  if (!t) return '';
  // Keep it conservative: only capture explicit "I take X" / "we take X".
  const m = t.match(/\b(i|we)\s+(take|grab|claim|secure|light|unlock)\s+([^\.!\?\n]+)/i);
  if (!m) return '';
  const obj = m[3].trim();
  if (!obj) return '';
  return `you:${m[2].toLowerCase()} ${obj}`;
}

function sceneRefKind(world, tag) {
  // Deterministic rotation across scene events.
  const base = seedFromString(`${world.meta.seed}|ref|${world.timeline.length}|${world.scene.promptSeed}|${tag}`);
  const k = base % 3;
  return k === 0 ? 'motif' : k === 1 ? 'omen' : 'promise';
}

function instrumentRef(instrument, kind) {
  const i = instrument || {};
  if (kind === 'motif') return i.motif ? `Motif: ${i.motif}.` : 'Motif: (silence).';
  if (kind === 'omen') return i.omen ? `${i.omen}` : 'An omen passes without words.';
  return i.promise ? `Promise: ${i.promise}.` : 'Promise: something will be demanded.';
}

function pickFrom(pack, key, rng) {
  const arr = pack?.[key];
  if (Array.isArray(arr) && arr.length) return rng.pick(arr);
  return '';
}

function pickIndexed(pack, key, stepIndex, rng) {
  const arr = pack?.[key];
  if (!Array.isArray(arr) || !arr.length) return '';
  // Deterministic by step index; rng for tie-breaker when step wraps.
  const idx = (Math.abs(stepIndex) % arr.length);
  return arr[idx] || rng.pick(arr);
}

function countScenes(world) {
  const tl = Array.isArray(world.timeline) ? world.timeline : [];
  // Count begin + scene events as scene index.
  return tl.reduce((n, e) => (e?.kind === 'begin' || e?.kind === 'scene') ? n + 1 : n, 0);
}

function applyComposerDelta(world, delta) {
  if (!delta || typeof delta !== 'object') return world;
  let w = world;

  // Update motif memory safely.
  if (delta.motifs?.addRecent) {
    const m = String(delta.motifs.addRecent).trim();
    if (m) {
      const prior = w.meta.motifs || { recent: [], pinned: [] };
      const nextRecent = [m, ...(prior.recent || [])].filter(Boolean);
      // dedupe
      const seen = new Set();
      const deduped = [];
      for (const x of nextRecent) {
        const s = String(x).trim();
        if (!s) continue;
        if (seen.has(s)) continue;
        seen.add(s);
        deduped.push(s);
        if (deduped.length >= 8) break;
      }
      w = { ...w, meta: { ...w.meta, motifs: { ...prior, recent: deduped } } };
    }
  }

  // Scene anti-repeat memory (allowed new fields)
  if (delta.sceneMemory) {
    const lastMotif = delta.sceneMemory.lastMotif ? String(delta.sceneMemory.lastMotif) : w.scene.lastMotif;
    const lastToneWord = delta.sceneMemory.lastToneWord ? String(delta.sceneMemory.lastToneWord) : w.scene.lastToneWord;
    w = { ...w, scene: { ...w.scene, lastMotif, lastToneWord } };
  }

  return w;
}

function generateInstrument(pack, fate, rng) {
  const band = fateBand(fate);
  const themes = [
    'curiosity vs survival',
    'trust vs fear',
    'power vs price',
    'mercy vs necessity'
  ];
  const motifs = [
    'dripping candle wax',
    'a door that won’t stay shut',
    'fresh footprints where none should be',
    'a thin, steady ringing'
  ];
  const taboos = band === 'cooperative'
    ? ['no cheap victories', 'no effortless rescues', 'no cruelty for sport']
    : band === 'grim'
    ? ['no easy rescues', 'no clean endings', 'no painless truths']
    : ['no easy rescues', 'no mercy without consequence', 'no innocence survives untouched'];
  const promises = band === 'cooperative'
    ? ['help will appear, but it must be earned', 'a secret will open a safer path', 'the dungeon will reward cleverness']
    : band === 'grim'
    ? ['a revelation will demand sacrifice', 'someone’s choice will close a door forever', 'the truth will complicate the objective']
    : ['a revelation will demand blood or betrayal', 'the payoff will cost something you love', 'victory will come with a scar'];
  const costs = band === 'cooperative'
    ? ['time, fatigue, pride', 'supplies, patience, noise', 'attention, doubt, strain']
    : band === 'grim'
    ? ['time, blood, trust', 'injury, exposure, debt', 'fear, pursuit, loss']
    : ['blood, betrayal, irreversible loss', 'bones, breath, and reputation', 'trust, safety, and someone’s name'];

  const theme = rng.pick(themes) || themes[0];
  const motif = rng.pick(motifs) || motifs[0];
  const taboo = rng.pick(taboos) || taboos[0];
  const promise = rng.pick(promises) || promises[0];
  const cost = rng.pick(costs) || costs[0];
  const omen = band === 'cooperative'
    ? `Omen: ${motif} catches the lanternlight.`
    : band === 'grim'
    ? `Omen: ${motif} marks the edge of your vision.`
    : `Omen: ${motif} looks like it was left for you.`;
  const question = `Will you accept ${promise}?`;

  return {
    theme,
    motif,
    taboo,
    promise,
    cost,
    omen,
    question
  };
}

function inferMoveFromText(world, pack, actorId, text) {
  const t = String(text || '').toLowerCase();
  const approachTag =
    /\b(force|bash|break|kick|pry|smash)\b/.test(t) ? 'force' :
    /\b(sneak|quiet|hide|slip|crawl|shadow)\b/.test(t) ? 'finesse' :
    /\b(aim|shoot|throw|strike|attack)\b/.test(t) ? 'focus' :
    /\b(talk|convince|lie|threaten|charm)\b/.test(t) ? 'charm' :
    /\b(listen|watch|study|search|inspect)\b/.test(t) ? 'insight' :
    /\b(hack|wire|code|scan|calibrate|repair)\b/.test(t) ? 'tech' :
    /\b(ritual|curse|spirit|ward|summon)\b/.test(t) ? 'occult' :
    /\b(track|forage|camp|survive)\b/.test(t) ? 'survival' :
    'focus';

  const stakeTag =
    /\b(attack|fight|kill|stab|shoot|harm)\b/.test(t) ? 'harm' :
    /\b(steal|take|loot|grab|spend|supplies)\b/.test(t) ? 'resource' :
    /\b(seen|noticed|alarm|expose|exposure)\b/.test(t) ? 'exposure' :
    /\b(reputation|trust|name)\b/.test(t) ? 'reputation' :
    /\b(dread|terror|fear)\b/.test(t) ? 'dread' :
    'time';

  // Deterministic risk: fate + clocks + approach/stakes (no randomness).
  const fate = clamp01(world.meta.fate);
  const c = world.clocks;
  const clockHeat = ((c.pressure + c.dread + c.revelation) / 36);
  const approachHeat = (approachTag === 'force' || approachTag === 'occult') ? 0.15 : 0.05;
  const stakeHeat = (stakeTag === 'harm') ? 0.2 : (stakeTag === 'dread' ? 0.15 : 0.1);
  const risk = clamp01(0.25 + (fate * 0.25) + (clockHeat * 0.35) + approachHeat + stakeHeat);

  return {
    actorId,
    intentText: String(text || '').trim(),
    approachTag,
    risk,
    stakeTag,
    targetId: null,
    toolTag: null
  };
}

function inferUpdateKindFromDeltas(deltas) {
  const ops = Array.isArray(deltas) ? deltas : [];
  for (const d of ops) {
    if (d?.op === 'clock') return 'clock';
    if (d?.op === 'ledger' && d.addThreat) return 'threat';
    if (d?.op === 'ledger' && d.addQuestion) return 'question';
    if (d?.op === 'ledger' && d.addFact) return 'fact';
  }
  return 'ledger';
}

function mergePacks(primary, mixer) {
  const p = primary || { id: 'unknown', starterLocations: [], starterObjectives: [], skills: [], toneWords: { cooperative: [], grim: [], blood: [] } };
  if (!mixer) return p;
  // Mixer lightly extends lists; primary remains id.
  return {
    ...p,
    starterLocations: uniq([...(p.starterLocations||[]), ...(mixer.starterLocations||[])]),
    starterObjectives: uniq([...(p.starterObjectives||[]), ...(mixer.starterObjectives||[])]),
    skills: uniq([...(p.skills||[]), ...(mixer.skills||[])])
  };
}

// (narration moved to engine/composer.js)

function pushEvent(world, { kind, data }) {
  const t = world.timeline.length;
  const e = { t, kind: String(kind), data: data ?? {} };
  return { ...world, timeline: [...world.timeline, e] };
}

function uniq(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const s = String(x);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function clamp01(v){
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
