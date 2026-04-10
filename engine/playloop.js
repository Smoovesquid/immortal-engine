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
import { ensureMap, pickTravelDestination, moveToNode, neighbors } from './map/mapState.js';
import { conductorDecision, applyConductorDeltas } from './conductor.js';
import { worldTick } from './worldTick.js';
import { resolveMove } from './resolve.js';
import { applyDeltas } from './effectsCore.js';
import { introduceThread, resolveThread, ensureInstrumentLayer } from './instrument.js';
import { applyGeneratedStructuresForNode } from './structures/applyGeneratedStructuresForNode.js';
import { enterStructureInterior, exitStructureInterior, moveWithinInterior, getInteriorView, resolveStructureSelection } from './structures/interiors.js';
import { createCharacter } from './chargen/genesis.js';
import { decompressAndCanonizeSync } from './decompression/decompress.js';
import { discoverNode } from './map/mapState.js';
import { detectPhysicalInteraction, evaluatePhysicsSync } from './llmPhysics.js';
import { createGoal, checkGoals } from './goals/goalContract.js';

// Pure-ish play loop: world -> {world, output}

export function beginAdventure(world, packsById) {
  let w = ensureWorld(world);
  const primary = packsById[w.pack.primaryId];
  const mixer = w.pack.mixerId ? packsById[w.pack.mixerId] : null;
  const pack = mergePacks(primary, mixer);

  const seed = seedFromString(`${w.meta.seed}|begin|${pack.id}`);
  const rng = makeRng(seed);

  if (!Array.isArray(w.party) || w.party.length === 0) {
    const pc = createCharacter({
      seed: `${w.meta.seed}|begin|pc`,
      packId: String(w.pack?.primaryId || 'fantasy'),
      fate: Number(w.meta?.fate ?? 0.2)
    });
    w = { ...w, party: [pc] };
  }

  // Living Terrain Engine v1: generate map if missing.
  if (!w.map?.nodes?.length) {
    const packId = w.pack?.primaryId || 'fantasy';
    w = { ...w, map: generateInitialMap({ seed: w.meta.seed, packId, pack }) };
  }

  // Starting node must be a settlement (not random wilderness).
  let m = ensureMap(w.map);
  const settlements = m.nodes.filter(n => n.nodeType === 'settlement');
  if (settlements.length > 0 && (!m.currentNodeId || !settlements.some(n => n.id === m.currentNodeId))) {
    // Move starting position to a settlement
    const startNode = settlements[0];
    w = { ...w, map: { ...w.map, currentNodeId: startNode.id } };
    w = discoverNode(w, startNode.id);
    m = ensureMap(w.map);
  }

  const here = m.nodes.find(n => n.id === m.currentNodeId);

  // Run settlement decompression for the starting node (generates NPCs, history, buildings).
  if (here?.nodeType === 'settlement' && !here.settlement?.decompressed) {
    w = decompressAndCanonizeSync(w, here.id, pack);
    // Re-read after decompression
    m = ensureMap(w.map);
  }

  const location = here?.name || pickFrom(pack, 'locations', rng) || rng.pick(pack.starterLocations) || 'unknown place';
  const objective = pickFrom(pack, 'objectives', rng) || rng.pick(pack.starterObjectives) || 'survive the night';

  // Ensure instrument exists (deterministic).
  if (!w.instrument?.theme) {
    w = { ...w, instrument: generateInstrument(pack, w.meta.fate, rng) };
  }

  // Tactical zoom defaults off at start.
  w = { ...w, map: { ...(w.map || {}), tactical: { active: false, zoneLayout: null } }, scene: { location, objective, time: 'start', promptSeed: `${seed}` } };

  // Materialize deterministic structures for the starting node so exterior discovery is available immediately.
  if (w.map?.currentNodeId) {
    w = applyGeneratedStructuresForNode(w, w.map.currentNodeId);
  }

  // Canon facts for guard.
  w = addFact(w, `location:${location}`, 'scene');
  const objFact = `objective:${objective}`;
  if (!hasFact(w, objFact)) w = addFact(w, objFact, 'scene');
  w = addQuestion(w, `How will you approach: ${objective}?`);
  // U16: deterministic starter thread so worldTick/threadShift has a living thread to evolve.
  if (!Array.isArray(w.instrument?.threads) || w.instrument.threads.length === 0) {
    w = introduceThread(w, objective);
  }

  // Seed an initial goal so playerMove has something verifiable to track.
  if (Array.isArray(w.goals) && w.goals.length === 0) {
    w = seedInitialGoal(w, pack, objective);
  }

  // Build opening context with NPC presence
  const startingNode = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const settlementData = startingNode?.settlement;
  const npcNames = settlementData?.npcs?.map(n => n.name).filter(Boolean) ?? [];

  const refKind = sceneRefKind(w, 'opening');

  const outcome = {
    kind: 'begin',
    t: w.timeline.length,
    location,
    objective,
    fateBand: fateBand(w.meta.fate),
    refKind,
    npcsPresent: npcNames,
    settlementEconomy: settlementData?.economy ?? null
  };

  w = pushEvent(w, { kind: 'begin', data: { location, objective, pack: pack.id, refKind, npcsPresent: npcNames } });

  const composed = compose(w, '', outcome, { pack });
  w = applyComposerDelta(w, composed.ledgerDelta);
  return { world: w, output: { narration: composed.narrationLine, mechanics: composed.mechanicsLine } };

}

export function playerMove(world, packsById, text) {

  // Gate III.2: after ending is locked, play surfaces must not mutate state.
  if (Boolean(world?.ending?.locked)) {
    return {
      world,
      output: {
        narration: String(world?.ending?.epilogueLine || 'The end.'),
        mechanics: ''
      }
    };
  }
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

  const interiorAction = inferInteriorAction(text, w.scene?.interior);
  if (interiorAction.kind === 'enter') {
    const nodeId = String(w.map?.currentNodeId || '');
    const wPrepared = nodeId ? applyGeneratedStructuresForNode(w, nodeId) : w;
    const sel = resolveStructureSelection(wPrepared, interiorAction.structureRef);
    if (!sel.structure) {
      const msg = sel.reason === 'index-out-of-range'
        ? 'Wizard: No structure matches that selection here.'
        : 'Wizard: There are no structures to enter here.';
      return { world: w, output: { narration: msg, mechanics: '' } };
    }
    const w1 = enterStructureInterior(wPrepared, interiorAction.structureRef);
    if (w1 !== wPrepared) return { world: w1, output: { narration: 'Wizard: You enter the structure interior.', mechanics: '' } };
  }

  if (interiorAction.kind === 'exit') {
    const w1 = exitStructureInterior(w);
    if (w1 !== w) return { world: w1, output: { narration: 'Wizard: You step back outside.', mechanics: '' } };
  }

  if (interiorAction.kind === 'move') {
    const wantsRiskyMove = isRiskyOrObstructedMoveIntent(text);
    if (!wantsRiskyMove) {
      const targetRoomId = interiorAction.toRoomId || pickAdjacentInteriorByDirection(w, interiorAction.direction);
      const w1 = moveWithinInterior(w, targetRoomId);
      if (w1 !== w) {
        let w2 = pushEvent(w1, {
          kind: 'move',
          data: {
            mode: 'interior',
            fromRoomId: String(w.scene?.interior?.roomId || ''),
            toRoomId: String(w1.scene?.interior?.roomId || ''),
            withinSpeed: true,
            rolled: false
          }
        });
        w2 = worldTick(w2, `${w2.meta.seed}|tick|interior-move|turn${w2.time.turn}|tl${w2.timeline.length}`);
        return { world: w2, output: { narration: `Wizard: You move to ${w2.scene.interior.roomId}.`, mechanics: '' } };
      }
      return { world: w, output: { narration: 'Wizard: That way is blocked from here.', mechanics: '' } };
    }
    // Risky/obstructed/special movement falls through to normal resolution (roll-capable path).
  }

  // Surface-only exploration: list adjacent map nodes deterministically (no roll, no tick, no timeline).
  if (isExploreIntent(text)) {
    if (w.scene?.interior) {
      const view = getInteriorView(w);
      const exits = (view.exits || []).map(x => x.id);
      const exitsLineTxt = exits.length ? `Exits: ${exits.join(', ')}.` : 'Exits: none.';
      return { world: w, output: { narration: `Wizard: You scan the room. ${exitsLineTxt}`, mechanics: 'observe only — no roll, state unchanged' } };
    }

    const exits = exitsLine(w);
    const view = getInteriorView(w);
    const structures = Array.isArray(view?.structures) ? view.structures : [];
    const structuresLine = structures.length
      ? `Structures: ${structures.map(s => `${s.kind} #${s.index}`).join(', ')}.`
      : 'Structures: none.';
    const line = exits ? `Wizard: You take stock of your surroundings. ${exits} ${structuresLine}` : `Wizard: You take stock of your surroundings. ${structuresLine}`;
    return { world: w, output: { narration: line, mechanics: 'observe only — no roll, state unchanged' } };
  }

  // Feet-based local tactical movement within current node (no node travel).
  if (!w.scene?.interior) {
    const localFeet = parseLocalFeetMove(text);
    if (localFeet) {
      const party = Array.isArray(w.party) ? w.party : [];
      const p0 = party[0] || {};
      const pos0 = p0.position && typeof p0.position === 'object' ? p0.position : {};
      const beforeLocalFtX = Number(pos0.localFtX || 0);
      const beforeLocalFtY = Number(pos0.localFtY || 0);
      const afterLocalFtX = beforeLocalFtX + Number(localFeet.dxFt || 0);
      const afterLocalFtY = beforeLocalFtY + Number(localFeet.dyFt || 0);
      const nextParty = party.map((p, i) => i === 0 ? {
        ...p,
        position: {
          ...(p.position || {}),
          zone: 'near',
          localFtX: afterLocalFtX,
          localFtY: afterLocalFtY
        }
      } : p);
      let w1 = { ...w, party: nextParty };
      w1 = pushEvent(w1, {
        kind: 'move',
        data: {
          mode: 'local',
          type: 'local_move',
          dxFt: Number(localFeet.dxFt || 0),
          dyFt: Number(localFeet.dyFt || 0),
          before: { localFtX: beforeLocalFtX, localFtY: beforeLocalFtY },
          after: { localFtX: afterLocalFtX, localFtY: afterLocalFtY },
          withinSpeed: true,
          rolled: false
        }
      });
      return { world: w1, output: { narration: 'Wizard: You shift position locally.', mechanics: '' } };
    }
  }

  // Free movement (within speed): deterministic travel without a roll unless explicit obstacle/risk language is present.
  if (!w.scene?.interior && isFreeMovementIntent(text)) {
    const before = String(w.map?.currentNodeId || '');
    const nbs = neighbors(w.map, before);
    const t = String(text || '').toLowerCase();
    const dest = /\b(exit|leave)\b/.test(t) ? (nbs[0] || before) : pickTravelDestination(w, text);
    let w1 = moveToNode(w, dest);
    if (w1.map?.currentNodeId && w1.map.currentNodeId !== before) {
      w1 = applyGeneratedStructuresForNode(w1, w1.map.currentNodeId);
      // Decompress settlement on arrival (generates NPCs, history, buildings).
      const arrNode = w1.map?.nodes?.find(n => n && n.id === w1.map.currentNodeId) || null;
      if (arrNode?.nodeType === 'settlement' && !arrNode.settlement?.decompressed) {
        w1 = decompressAndCanonizeSync(w1, w1.map.currentNodeId, pack);
      }
      const here = w1.map?.nodes?.find(n => n && n.id === w1.map.currentNodeId) || null;
      const nextName = String(here?.name || '').trim();
      if (nextName) w1 = { ...w1, scene: { ...w1.scene, location: nextName } };
      w1 = setPrimaryPartyZone(w1, 'near');
      w1 = pushEvent(w1, { kind: 'travel', data: { from: before, to: String(w1.map.currentNodeId) } });
      w1 = maybeCheckGoals(w1);
      return { world: w1, output: { narration: nextName ? `Wizard: You travel to ${nextName}.` : 'Wizard: You move to the next position.', mechanics: '' } };
    }
    return { world: w, output: { narration: 'Wizard: You hold position.', mechanics: '' } };
  }

  const actorId = (w.party?.[0]?.id) ? String(w.party[0].id) : 'party';

  // NPC dialogue intercept: "talk to X" at a settlement updates NPC conversation state
  // instead of routing through generic dice resolution.
  const talkMatch = String(text || '').match(/\b(?:talk|speak|chat)\s+(?:to|with)\s+(.+)/i);
  if (talkMatch) {
    const npcName = talkMatch[1].trim();
    const curNode = w.map?.nodes?.find(n => n.id === w.map?.currentNodeId);
    const npcs = curNode?.settlement?.npcs || [];
    const targetNpc = npcs.find(n =>
      String(n.name).toLowerCase() === npcName.toLowerCase() ||
      String(n.name).toLowerCase().startsWith(npcName.toLowerCase())
    );
    if (targetNpc) {
      const npcId = targetNpc.id || targetNpc.name;
      const trust = targetNpc.conversationState?.trustLevel ?? 5;
      const honesty = targetNpc.personality?.honesty ?? 0.5;
      const trustBump = Math.max(honesty > 0.6 ? 1 : 0, 1);
      const deltas = [
        { op: 'npcTrustDelta', npcId, by: trustBump },
        { op: 'npcKnowledgeShared', npcId, fact: `player spoke at turn ${w.time?.turn ?? 0}` }
      ];
      w = applyDeltas(w, deltas);
      w = pushEvent(w, { kind: 'npcDialogue', data: { npcId, npcName: targetNpc.name, trust: trust + trustBump } });
      w = maybeCheckGoals(w);
      const role = targetNpc.role ? ` the ${targetNpc.role}` : '';
      const mood = honesty > 0.7 ? 'speaks openly' : honesty < 0.3 ? 'is guarded and evasive' : 'chooses words carefully';
      return { world: w, output: {
        narration: `Wizard: ${targetNpc.name}${role} ${mood}; ${trust >= 7 ? 'trust runs deep between you' : trust >= 4 ? 'a cautious exchange' : 'suspicion colors every word'}; what do you do?`,
        mechanics: `[dialogue:${targetNpc.name} | role:${targetNpc.role || 'unknown'} | trust:${trust}→${Math.min(trust + trustBump, 10)} | honesty:${honesty.toFixed(2)}]`
      }};
    }
  }

  // Physical interaction intercept: "examine the table", "break the chair",
  // "take the lantern". Three guards prevent hijacking generic combat moves
  // like "force the locked door":
  //   1. The player text must contain a physics verb (examine/break/take/etc.)
  //   2. Detection must match a furniture/item name (not just a notes substring)
  //   3. The offline fallback must produce real deltas (not a no-op)
  const PHYSICS_VERB_RE = /\b(examine|inspect|search|look at|check|rip|break|smash|tear|kick|punch|shatter|take|grab|pick up|steal)\b/i;
  if (PHYSICS_VERB_RE.test(String(text || ''))) {
    const detection = detectPhysicalInteraction(w, text);
    const nameMatch = (detection.matches || []).some(m => m.match === 'name' || m.match === 'part');
    if (detection.detected && nameMatch) {
      const physics = evaluatePhysicsSync(w, text);
      if (physics && physics.plausible) {
        w = applyDeltas(w, physics.deltas || []);
        // Emit a 'resolution' event (not a custom kind) so deterministic replay
        // — which only re-runs begin/scene/travel/resolution/blocked — re-executes
        // the same text and follows the same physics path on playback.
        w = pushEvent(w, {
          kind: 'resolution',
          data: {
            actorId,
            intent: String(text || ''),
            text: String(text || ''),
            roll: 0,
            dc: 0,
            outcome: 'physics',
            updateKind: 'physics',
            matches: detection.matches.map(m => ({ type: m.type, name: m.name })),
            deltaCount: (physics.deltas || []).length
          }
        });
        const matchSummary = detection.matches.map(m => m.name).filter(Boolean).slice(0, 2).join(', ');
        return {
          world: w,
          output: {
            narration: `Wizard: ${physics.description}`,
            mechanics: `[physics:${matchSummary || 'object'} | deltas:${(physics.deltas || []).length} | offline]`
          }
        };
      }
    }
  }

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

    // Keep scene surface in sync with map position so UI reflects travel immediately.
    if (w.map?.currentNodeId && w.map.currentNodeId !== before) {
      w = applyGeneratedStructuresForNode(w, w.map.currentNodeId);
      // Decompress settlement on arrival (generates NPCs, history, buildings).
      const arrNode = w.map?.nodes?.find(n => n && n.id === w.map.currentNodeId) || null;
      if (arrNode?.nodeType === 'settlement' && !arrNode.settlement?.decompressed) {
        w = decompressAndCanonizeSync(w, w.map.currentNodeId, pack);
      }
      const here = w.map?.nodes?.find(n => n && n.id === w.map.currentNodeId) || null;
      const nextName = String(here?.name || '').trim();
      if (nextName) {
        w = { ...w, scene: { ...w.scene, location: nextName } };
      }
      w = pushEvent(w, { kind: 'travel', data: { from: before || '', to: w.map.currentNodeId } });
    }
  }

  // Thread resolution: a successful roll during a confrontation beat resolves the
  // highest-tension open thread. This is the primary mechanism for thread closure.
  if (result.outcome === 'success') {
    const sceneTags = Array.isArray(w.scene?.tags) ? w.scene.tags : [];
    const isConfrontation = sceneTags.includes('confrontation') ||
      (w.instrument?.lastBeats?.[0] === 'confrontation');
    if (isConfrontation) {
      const inst = ensureInstrumentLayer(w.instrument);
      const hotThread = inst.threads
        .filter(t => t.status !== 'resolved' && t.tension >= 3)
        .sort((a, b) => b.tension - a.tension)[0];
      if (hotThread) {
        w = resolveThread(w, hotThread.id);
      }
    }
  }

  // Conductor integration: after resolution, propose deltas.
  const aiMode = w.meta.aiMode || 'off';
  if (aiMode !== 'off') {
    const rng2 = makeRng(seedFromString(`${w.meta.seed}|conductorRng|${w.scene.promptSeed}|${w.timeline.length}`));
    const proposal = conductorDecision(w, rng2);
    w = applyConductorDeltas(w, proposal, { mode: aiMode === 'advisory' ? 'advisory' : 'conductor' });
  }

  // Active-context passivity: advance micro pressure on repeated passive intent after non-success.
  w = applyMicroPressureIfNeeded(w, move, text);

  // Living world tick: every player action advances the world offscreen.
  w = worldTick(w, `${w.meta.seed}|tick|turn${w.time.turn}|tl${w.timeline.length}`);

  // Goal Contract: promote any active goal whose completion predicate is true.
  w = maybeCheckGoals(w);

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

  // Gate III.2: after ending is locked, play surfaces must not mutate state.
  if (Boolean(world?.ending?.locked)) {
    return {
      world,
      output: {
        narration: String(world?.ending?.epilogueLine || 'The end.'),
        mechanics: ''
      }
    };
  }
  let w = ensureWorld(world);
  const primary = packsById[w.pack.primaryId];
  const mixer = w.pack.mixerId ? packsById[w.pack.mixerId] : null;
  const pack = mergePacks(primary, mixer);

  const seed = seedFromString(`${w.meta.seed}|newScene|${w.timeline.length}|${w.scene.promptSeed}`);

  // Living Terrain Engine v1: advancing a scene moves to an adjacent node deterministically.
  if (w.map?.nodes?.length) {
    const dest = pickTravelDestination(w, '');
    w = moveToNode(w, dest);
    if (w.map?.currentNodeId) {
      w = applyGeneratedStructuresForNode(w, w.map.currentNodeId);
    }
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

  // Goal Contract: scene transitions can complete reach-goals (newScene moves nodes).
  w = maybeCheckGoals(w);

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

function applyMicroPressureIfNeeded(world, move, text) {
  const w = world || {};
  const m = move || {};
  const t = normalizeIntent(text);

  if (!isPassiveIntent(t)) return w;
  if (String(m.stakeTag || '') !== 'time') return w;
  if (!isActiveContext(w)) return w;

  const last = lastResolutionData(w);
  if (!last) return w;

  const lastIntent = normalizeIntent(last.intent || last.text || '');
  if (!lastIntent || lastIntent !== t) return w;

  if (String(last.outcome || '') === 'success') return w;

  return bumpMicroClock(w, 'pressure', 1, 12);
}

function bumpMicroClock(world, key, add, rolloverAt) {
  const w = world || {};
  const meta = w.meta || {};
  const micro = (meta.microClocks && typeof meta.microClocks === 'object') ? meta.microClocks : {};
  const cur = Number(micro[key] ?? 0);
  const next = cur + Number(add ?? 0);

  const roll = Math.max(1, Number(rolloverAt ?? 12));
  const macroAdd = Math.floor(next / roll);
  const microNext = next % roll;

  const clocks = w.clocks || {};
  const macroCur = Number(clocks[key] ?? 0);
  const macroNext = Math.min(12, macroCur + macroAdd);

  return {
    ...w,
    meta: { ...meta, microClocks: { ...micro, [key]: microNext } },
    clocks: { ...clocks, [key]: macroNext }
  };
}

function isActiveContext(world) {
  const w = world || {};
  const tags = Array.isArray(w?.scene?.tags) ? w.scene.tags : [];
  const tagHit = tags.some(x => String(x || '').toLowerCase() === 'confrontation');
  const clocks = w.clocks || {};
  const clockHit = (Number(clocks.pressure || 0) > 0) || (Number(clocks.dread || 0) > 0);
  const tacticalHit = Boolean(w?.map?.tactical?.active);
  return tagHit || clockHit || tacticalHit;
}

function lastResolutionData(world) {
  const tl = Array.isArray(world?.timeline) ? world.timeline : [];
  for (let i = tl.length - 1; i >= 0; i--) {
    const e = tl[i];
    if (e && e.kind === 'resolution') return e.data || null;
  }
  return null;
}

function normalizeIntent(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isPassiveIntent(t) {
  const s = String(t || '');
  return /\b(wait|do nothing|idle|linger|stall)\b/.test(s);
}

function moveAdvancesScene(text) {
  const t = String(text || "").toLowerCase();
  // Travel intents: named destinations OR directional/exit shorthand.
  // Shorthand destination resolution happens in pickTravelDestination().
  return /\b(travel|leave|exit|head to|go to|move to|escape|journey|walk to|go north|go south|go east|go west|north|south|east|west|n|s|e|w)\b/.test(t);
}

function isFreeMovementIntent(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return false;

  // Explicit tactical movement-within-speed (legacy phrasing).
  if (/\b(within speed|30\s*ft)\b/.test(t)) return true;

  // Broad free movement / travel phrasing (deterministic: destination is still resolved by adjacency rules).
  return /\b(travel|leave|exit|head\s+to|go\s+to|move\s+to|walk\s+to|walk|go\s+north|go\s+south|go\s+east|go\s+west|north|south|east|west|n|s|e|w)\b/.test(t);
}

function parseLocalFeetMove(text) {
  const t = String(text || '').toLowerCase().trim();

  // Explicit foot distance: "move 30ft north", "step 10ft e"
  const m = t.match(/\b(?:move|step|go)\s+(\d+)\s*ft\s+(north|south|east|west|n|s|e|w)\b/);
  if (m) {
    const ft = Math.max(0, Number(m[1] || 0));
    const d = normalizeDir(m[2]);
    if (d === 'north') return { dxFt: 0, dyFt: -ft };
    if (d === 'south') return { dxFt: 0, dyFt: ft };
    if (d === 'east')  return { dxFt: ft, dyFt: 0 };
    if (d === 'west')  return { dxFt: -ft, dyFt: 0 };
  }

  // Bare directionals ("go north", "north", "n") are handled by the travel-intent
  // system (isFreeMovementIntent / moveAdvancesScene) for inter-node movement.
  // Only match them as local feet moves when inside a structure interior.
  return null;
}

function setPrimaryPartyZone(world, zone) {
  const w = world || {};
  const party = Array.isArray(w.party) ? w.party : [];
  if (!party.length) return w;
  const z = String(zone || 'near');
  return {
    ...w,
    party: party.map((p, i) => i === 0 ? { ...p, position: { ...(p.position || {}), zone: z, localFtX: 0, localFtY: 0 } } : p)
  };
}

function inferInteriorAction(text, interior) {
  const t = String(text || '').toLowerCase().trim();
  const inside = Boolean(interior && typeof interior === 'object');
  if (!t) return { kind: 'none' };

  if (!inside) {
    if (t === 'enter') return { kind: 'enter', structureRef: '' };
    if (/\b(go inside|enter building|enter structure|go indoors)\b/.test(t)) return { kind: 'enter', structureRef: '' };

    const m = t.match(/^enter\s+(.+)$/i);
    if (m) {
      const ref = String(m[1] || '').trim();
      if (ref === 'building' || ref === 'structure') return { kind: 'enter', structureRef: '' };
      return { kind: 'enter', structureRef: ref };
    }
    return { kind: 'none' };
  }

  if (/\b(leave|exit|go outside|step outside)\b/.test(t)) return { kind: 'exit' };
  const moveFtDir = t.match(/\b(?:move|step|go)\s+\d+\s*ft\s+(north|south|east|west|n|s|e|w)\b/i);
  if (moveFtDir) return { kind: 'move', toRoomId: '', direction: normalizeDir(moveFtDir[1]) };

  const goDir = t.match(/^\s*(?:go\s+)?(north|south|east|west|n|s|e|w)\s*$/i);
  if (goDir) return { kind: 'move', toRoomId: '', direction: normalizeDir(goDir[1]) };

  const goMatch = t.match(/\bgo\s+([a-z0-9:_-]+)/i);
  if (goMatch) return { kind: 'move', toRoomId: String(goMatch[1] || ''), direction: '' };
  return { kind: 'none' };
}

function isExploreIntent(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return false;
  return /\b(look around|look about|survey|scan|search the area|where can i go|where do i go|options|exits|way out|how do i get out|get out of here|leave this place)\b/.test(t);
}

function normalizeDir(d) {
  const s = String(d || '').toLowerCase();
  if (s === 'n') return 'north';
  if (s === 'e') return 'east';
  if (s === 's') return 'south';
  if (s === 'w') return 'west';
  return s;
}

function pickAdjacentInteriorByDirection(world, direction) {
  const view = getInteriorView(world);
  const exits = Array.isArray(view?.exits) ? view.exits.map(x => String(x?.id || '')).filter(Boolean) : [];
  if (!exits.length) return '';

  const dir = normalizeDir(direction);
  const idx = dir === 'north' ? 0 : dir === 'east' ? 1 : dir === 'south' ? 2 : dir === 'west' ? 3 : 0;
  return exits[idx % exits.length] || exits[0];
}

function isRiskyOrObstructedMoveIntent(text) {
  const t = String(text || '').toLowerCase();
  return /\b(hazard|obstacle|obstruct|blocked|contested|jump|force\s+door|squeeze|stealth\s*sprint|under\s*fire|danger)\b/.test(t);
}

function exitsLine(world) {
  const w = world || {};
  const m = ensureMap(w.map);
  const here = String(m.currentNodeId || '');
  if (!here) return '';
  const nbs = neighbors(m, here);
  if (!Array.isArray(nbs) || nbs.length === 0) return '';
  const names = nbs
    .map(id => (m.nodes || []).find(n => n && n.id === id))
    .filter(Boolean)
    .map(n => String(n.name || '').trim())
    .filter(Boolean);
  const uniq = [];
  const seen = new Set();
  for (const nm of names) {
    const k = nm.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(nm);
    if (uniq.length >= 5) break;
  }
  if (!uniq.length) return '';
  return `Exits: ${uniq.join(', ')}.`;
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

// Seed a single deterministic starter goal. Resolves the
// __nearest_settlement__ sentinel against the current map. Falls back to a
// learn-objective goal if no other settlement is reachable.
function seedInitialGoal(world, pack, objective) {
  let w = world;
  const starters = Array.isArray(pack?.starterGoals) ? pack.starterGoals : null;

  if (starters && starters.length) {
    for (const spec of starters) {
      const resolved = resolveStarterGoalSpec(w, spec);
      if (!resolved) continue;
      const { world: w1, goal } = createGoal(w, resolved);
      if (!goal) continue;
      w = pushEvent(w1, { kind: 'goalCreated', data: { goalId: goal.id, kind: goal.kind, targetRef: goal.targetRef } });
      return w;
    }
  }

  // Fallback: try a reach-goal toward a non-current settlement, else learn objective.
  const otherSettlement = pickOtherSettlement(w);
  if (otherSettlement) {
    const { world: w1, goal } = createGoal(w, {
      kind: 'reach',
      targetRef: otherSettlement.id,
      label: `Travel to ${otherSettlement.name || otherSettlement.id}`
    });
    if (goal) {
      return pushEvent(w1, { kind: 'goalCreated', data: { goalId: goal.id, kind: goal.kind, targetRef: goal.targetRef } });
    }
  }

  const objText = String(objective || '').trim();
  if (objText) {
    const factText = `objective:${objText}`;
    const { world: w1, goal } = createGoal(w, {
      kind: 'learn',
      targetRef: factText,
      label: objText
    });
    if (goal) {
      return pushEvent(w1, { kind: 'goalCreated', data: { goalId: goal.id, kind: goal.kind, targetRef: goal.targetRef } });
    }
  }

  return w;
}

function resolveStarterGoalSpec(world, spec) {
  if (!spec || typeof spec !== 'object') return null;
  const kind = String(spec.kind || '').trim();
  const label = String(spec.label || '').trim();
  let targetRef = String(spec.targetRef || '').trim();
  if (!kind || !targetRef) return null;

  if (targetRef === '__nearest_settlement__') {
    const node = pickOtherSettlement(world);
    if (!node) return null;
    targetRef = node.id;
  }
  return { kind, targetRef, label };
}

function pickOtherSettlement(world) {
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  const here = String(world?.map?.currentNodeId || '');
  // Deterministic: filter by nodeType, exclude current, sort by id.
  const others = nodes
    .filter(n => n && n.nodeType === 'settlement' && n.id !== here)
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return others[0] || null;
}

function maybeCheckGoals(world) {
  const { world: next, completed } = checkGoals(world);
  if (!completed.length) return next;
  let w = next;
  for (const g of completed) {
    w = pushEvent(w, { kind: 'goalCompleted', data: { goalId: g.id, kind: g.kind, targetRef: g.targetRef } });
  }
  return w;
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
