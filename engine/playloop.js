import { ensureWorld, appendRecentBeat } from './state.js';
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
import { beginDialogue, askNpc, endDialogue, resolveNpcAtCurrentNode, isRecruitIntent } from './npc/dialogue.js';
import { resolveCombatTurn } from './combat/combatResolve.js';
import { beginCombat, endCombat, mintEnemyFromNpc } from './combat/combatLifecycle.js';
import { resolveCompanionTurn } from './combat/companionTurn.js';
import { castSpell } from './spell/castSpell.js';
import { evaluateEncounter, selectCreatures, spawnEncounter } from './combat/encounterSpawn.js';

// Pure-ish play loop: world -> {world, output}

export function beginAdventure(world, packsById) {
  let w = ensureWorld(world);
  const primary = packsById[w.pack.primaryId];
  const mixer = w.pack.mixerId ? packsById[w.pack.mixerId] : null;
  let pack = mergePacks(primary, mixer);

  // Pass I3 — Westmarch slice default: enrich fantasy pack with westmarch sub-region.
  if (pack.id === 'fantasy' && packsById.westmarch) {
    pack = mergeSubRegion(pack, packsById.westmarch);
  }
  // Pass D1 — Ashenmoor sub-region.
  if (pack.id === 'fantasy' && packsById.ashenmoor) {
    pack = mergeSubRegion(pack, packsById.ashenmoor);
  }

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
  // Pass H — scene.time = 'waking' is the signal the composer reads to pick the
  // bedroom-opening line bank instead of the legacy quest-opening bank.
  w = { ...w, map: { ...(w.map || {}), tactical: { active: false, zoneLayout: null } }, scene: { location, objective, time: 'waking', promptSeed: `${seed}` } };

  // Materialize deterministic structures for the starting node so exterior discovery is available immediately.
  if (w.map?.currentNodeId) {
    w = applyGeneratedStructuresForNode(w, w.map.currentNodeId);
  }

  // Pass H — mark the starting settlement as home if not already set. Save/resume
  // semantics: don't overwrite a pre-existing homeNodeId (the saved game already
  // knows where home is).
  if (!w.meta?.homeNodeId && w.map?.currentNodeId) {
    w = { ...w, meta: { ...w.meta, homeNodeId: String(w.map.currentNodeId) } };
  }

  // Pass H — place the player inside the first structure at home, in the first
  // non-entry room (room 2 by stub topology — the "bedroom"). The generated
  // topology guarantees room 2 is adjacent to room 1 (the entry). Graceful
  // degradation: if there are no structures or the structure has only the entry
  // room, stay outside and narrate as exterior.
  {
    const structuresHere = Object.values(w.structures?.byId || {}).filter(
      s => String(s?.nodeId || '') === String(w.map?.currentNodeId || '')
    );
    if (structuresHere.length > 0) {
      const w1 = enterStructureInterior(w, '#1');
      const interior = w1.scene?.interior || null;
      if (interior) {
        const st = w1.structures?.byId?.[interior.structureKey];
        const rooms = Array.isArray(st?.topology?.rooms) ? st.topology.rooms : [];
        // Find the first non-entry room (room index 1 in the stub).
        const nonEntry = rooms.find(r => !((Array.isArray(r?.tags) ? r.tags : []).includes('entry')));
        const bedroomId = nonEntry ? String(nonEntry.id) : '';
        if (bedroomId && bedroomId !== interior.roomId) {
          w = moveWithinInterior(w1, bedroomId);
        } else {
          w = w1;
        }
      }
    }
  }

  // Canon facts for guard.
  w = addFact(w, `location:${location}`, 'scene');
  // Pass H — drop the objective: fact and "How will you approach" question.
  // The player wakes with no quest; finding one happens by venturing out.
  // U16: deterministic starter thread so worldTick/threadShift has a living thread
  // to evolve. Use a neutral 'morning light' seed instead of the (now unused)
  // objective string.
  if (!Array.isArray(w.instrument?.threads) || w.instrument.threads.length === 0) {
    w = introduceThread(w, 'morning light');
  }

  // Pass H — beginAdventure no longer seeds an initial goal. The player wakes
  // up with nothing to do; quests are discovered by leaving home and venturing
  // out. seedInitialGoal is still defined for save-resume semantics elsewhere.

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

  // ── Pass C1 — dismiss verb ───────────────────────────────────────────────
  // "dismiss <name>" removes a companion from the party. Resolved before the
  // dialogue intercept and the physics/combat branches so the verb is always
  // available; case-insensitive name match against party[1..n]. No-op when
  // no companion matches the name (the player still gets a clear message
  // and the call short-circuits).
  {
    const dismissMatch = String(text || '').match(/^\s*dismiss\s+(.+?)\s*$/i);
    if (dismissMatch) {
      const name = dismissMatch[1].trim();
      const companions = (Array.isArray(w.party) ? w.party : []).slice(1);
      const target = companions.find(e => String(e?.name || '').toLowerCase() === name.toLowerCase());
      if (!target) {
        return {
          world: w,
          output: {
            narration: `Wizard: No companion named "${name}" travels with you.`,
            mechanics: '[dismiss | no-such-companion]'
          }
        };
      }
      let wd = applyDeltas(w, [{ op: 'dismissCompanion', entityId: String(target.id) }]);
      const here = (wd.map?.nodes || []).find(n => n && n.id === wd.map?.currentNodeId) || null;
      const locationName = String(here?.name || wd.scene?.location || '');
      wd = appendRecentBeat(wd, {
        t: Number(wd.time?.turn ?? 0),
        input: `dismiss ${name}`,
        approach: 'heart',
        stake: 'parting',
        outcome: 'mixed',
        location: locationName,
        mechanics: `dismiss:${target.id}`
      });
      wd = pushEvent(wd, {
        kind: 'companionDismissed',
        data: { entityId: String(target.id), name: String(target.name || '') }
      });
      return {
        world: wd,
        output: {
          narration: `Wizard: ${target.name} parts ways with you.`,
          mechanics: `[dismiss | ${target.name}]`
        }
      };
    }
  }

  // ── Dialogue mode intercept ───────────────────────────────────────────────
  // If an NPC dialogue is active, route input: explicit exit, auto-exit on
  // movement/physics/scene intents, else treat as an ask.
  if (w.scene?.dialogue) {
    const explicitExit = isDialogueExitIntent(text);
    // Recruit intent ("invite to travel") must beat the breaking-intent guard —
    // its literal phrase contains "travel" which would otherwise route through
    // moveAdvancesScene and exit dialogue. Inside an active dialogue the player's
    // intent is to recruit, not to walk away.
    const recruitIntent = isRecruitIntent(text);
    const breakingIntent = !recruitIntent && isDialogueBreakingIntent(text, w);

    if (explicitExit) {
      const ended = endDialogue(w);
      w = ended.world;
      w = pushEvent(w, {
        kind: 'dialogueExit',
        data: {
          npcId: ended.outcome.npcId || '',
          turnsInDialogue: ended.outcome.turnsInDialogue || 0,
          topicsCount: ended.outcome.topicsCount || 0
        }
      });
      w = maybeCheckGoals(w);
      const name = ended.outcome.npcName || 'them';
      return {
        world: w,
        output: {
          narration: `Wizard: You step away from ${name}.`,
          mechanics: `[dialogue exit | turns:${ended.outcome.turnsInDialogue} | topics:${ended.outcome.topicsCount}]`
        }
      };
    }

    if (breakingIntent) {
      const ended = endDialogue(w);
      w = ended.world;
      w = pushEvent(w, {
        kind: 'dialogueExit',
        data: {
          npcId: ended.outcome.npcId || '',
          turnsInDialogue: ended.outcome.turnsInDialogue || 0,
          topicsCount: ended.outcome.topicsCount || 0
        }
      });
      // Fall through — continue processing the rest of playerMove with dialogue cleared.
    } else {
      // Treat input as an ask inside the current dialogue.
      const asked = askNpc(w, text);
      w = asked.world;
      w = pushEvent(w, {
        kind: 'dialogueAsk',
        data: {
          npcId: asked.outcome.npcId || '',
          topic: asked.outcome.topic || '',
          mode: asked.outcome.mode || '',
          factId: asked.outcome.factId || ''
        }
      });
      // Pass C1.1 — dialogue ask produces a beat so the Recent Beats panel
      // fills during conversation. Outcome maps shared→success, recruited→
      // success, lied/withheld/refused-*→mixed, deflected→failure.
      const askOutcome = askBeatOutcome(asked.outcome.mode);
      const askHereNode = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
      const askBeat = {
        t: Number(w.time?.turn ?? 0),
        input: String(text || ''),
        approach: asked.outcome.brainDecision?.approach || 'heart',
        stake: 'rapport',
        outcome: askOutcome,
        location: String(askHereNode?.name || w.scene?.location || ''),
        mechanics: `dialogue:${asked.outcome.mode}${asked.outcome.factId ? `:${asked.outcome.factId}` : ''}`
      };
      // Pass W1 — flow brainMood into beat for narration layer
      if (asked.outcome.brainMood) {
        askBeat.brainMood = asked.outcome.brainMood;
      }
      w = appendRecentBeat(w, askBeat);
      w = maybeCheckGoals(w);
      return {
        world: w,
        output: {
          narration: dialogueAskNarration(asked.outcome),
          mechanics: `[dialogue ask | ${asked.outcome.mode}${asked.outcome.factId ? ` | ${asked.outcome.factId}` : ''} | trust:${asked.outcome.trustLevel}]`
        }
      };
    }
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
      // Pass C1 — companions follow the player through local feet moves.
      const nextParty = party.map(p => ({
        ...p,
        position: {
          ...(p.position || {}),
          zone: 'near',
          localFtX: afterLocalFtX,
          localFtY: afterLocalFtY
        }
      }));
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
      w1 = pushEvent(w1, { kind: 'travel', data: { from: before, to: String(w1.map.currentNodeId), intent: String(text || '') } });
      // Pass C2 — free-movement travel writes a beat so Recent Beats reflects
      // the travel turn. Uses the same buildBeatFromTurn/appendRecentBeat seam
      // as the combat branch. Approach/stake tags mirror the flee-beat idiom.
      const travelMove = { actorId: 'party', intentText: String(text || ''), approachTag: 'survival', stakeTag: 'time' };
      const travelResult = { outcome: 'success', mechanicsLine: '[travel | free-movement]' };
      w1 = appendRecentBeat(w1, buildBeatFromTurn(w1, text, travelMove, travelResult));
      w1 = maybeCheckGoals(w1);
      return { world: w1, output: { narration: nextName ? `Wizard: You travel to ${nextName}.` : 'Wizard: You move to the next position.', mechanics: '' } };
    }
    return { world: w, output: { narration: 'Wizard: You hold position.', mechanics: '' } };
  }

  const actorId = (w.party?.[0]?.id) ? String(w.party[0].id) : 'party';

  // NPC dialogue entry: "talk to X" / "speak to X" / "approach X" begins a
  // canonical dialogue mode with an NPC at the current settlement. If no NPC
  // resolves, fall through to generic resolution (preserves legacy behavior
  // for intents like "I talk to whoever is watching").
  const talkRef = extractDialogueRef(text);
  if (talkRef) {
    const resolved = resolveNpcAtCurrentNode(w, talkRef);
    if (resolved) {
      const begun = beginDialogue(w, talkRef);
      if (begun.outcome.ok) {
        w = begun.world;
        w = pushEvent(w, {
          kind: 'dialogueEnter',
          data: {
            npcId: begun.outcome.npcId,
            npcName: begun.outcome.npcName
          }
        });
        // Pass C1.1 — dialogue enter writes a beat so the Recent Beats panel
        // records the social turn.
        const enterHere = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
        w = appendRecentBeat(w, {
          t: Number(w.time?.turn ?? 0),
          input: String(text || ''),
          approach: 'heart',
          stake: 'rapport',
          outcome: 'success',
          location: String(enterHere?.name || w.scene?.location || ''),
          mechanics: `dialogue:enter:${begun.outcome.npcId}`
        });
        w = maybeCheckGoals(w);
        const role = begun.outcome.npcRole ? ` the ${begun.outcome.npcRole}` : '';
        return {
          world: w,
          output: {
            narration: `Wizard: You approach ${begun.outcome.npcName}${role}; ${begun.outcome.mood} eyes meet yours.`,
            mechanics: `[dialogue enter | ${begun.outcome.npcName} | role:${begun.outcome.npcRole || 'unknown'} | trust:${begun.outcome.trustLevel}/10 | mood:${begun.outcome.mood}]`
          }
        };
      }
    }
  }

  // ── Pass T3: Spell casting branch ─────────────────────────────────────────
  // "cast <spell>" routes through the spell casting system. In combat, the
  // cast produces damage/effects and then falls through to the normal combat
  // turn flow. Outside combat, it resolves immediately.
  {
    const castMatch = String(text || '').match(/^cast\s+(.+?)(?:\s+(?:at|on|toward)\s+(.+))?$/i);
    if (castMatch) {
      const rawSpellName = castMatch[1].trim();
      const rawTarget = (castMatch[2] || '').trim();
      const spellRef = rawSpellName.toLowerCase().replace(/\s+/g, '_');

      // Resolve target: in combat, target the first living enemy by default.
      let targetId = null;
      if (w.combat?.active) {
        const enemies = Array.isArray(w.combat.enemies) ? w.combat.enemies : [];
        if (rawTarget) {
          const tLower = rawTarget.toLowerCase();
          const found = enemies.find(e => e.hp > 0 && (
            String(e.name || '').toLowerCase() === tLower ||
            String(e.name || '').toLowerCase().includes(tLower)
          ));
          targetId = found ? found.id : (enemies.find(e => e.hp > 0)?.id || null);
        } else {
          targetId = (enemies.find(e => e.hp > 0)?.id) || null;
        }
      }

      const { world: wCast, result: castResult } = castSpell(w, {
        spellRef,
        targetId,
        slotLevel: null
      });

      if (!castResult.ok) {
        return {
          world: wCast,
          output: {
            narration: `Wizard: ${castResult.reason === 'no-slots' ? 'You have no spell slots remaining at that level.' : castResult.reason === 'not-known' ? 'You do not know that spell.' : 'The spell fizzles — something is wrong.'}`,
            mechanics: `[cast:${spellRef} | ${castResult.reason}]`
          }
        };
      }

      // Build mechanics line from effects.
      const effectParts = castResult.effects.map(e => {
        if (e.kind === 'damage') return `${e.totalDamage} ${e.damageType}${e.saved ? ' (saved)' : ''}`;
        if (e.kind === 'acBoost') return `ac+${e.value}`;
        if (e.kind === 'teleport') return `teleport ${e.distance}ft`;
        if (e.kind === 'counter') return 'counter';
        return e.kind;
      });
      const mechanicsLine = `[cast:${castResult.spellName} | ${effectParts.join(', ')}${castResult.slotConsumed ? ` | slot:${castResult.slotLevel}` : ' | cantrip'}]`;

      // Record beat and resolution event.
      let wOut = appendRecentBeat(wCast, buildBeatFromTurn(wCast, text, {
        actorId,
        intentText: String(text || ''),
        approachTag: 'occult',
        stakeTag: 'harm',
        targetId
      }, { outcome: 'success', mechanicsLine }));
      wOut = pushEvent(wOut, {
        kind: 'resolution',
        data: {
          actorId,
          intent: String(text || ''),
          text: String(text || ''),
          roll: 0,
          dc: 0,
          outcome: 'success',
          updateKind: 'spell',
          spellRef: castResult.spellRef,
          effects: castResult.effects.length
        }
      });

      const dmgEffect = castResult.effects.find(e => e.kind === 'damage');
      const narration = dmgEffect
        ? `Wizard: You cast ${castResult.spellName}${targetId ? '' : ''}, dealing ${dmgEffect.totalDamage} ${dmgEffect.damageType} damage${dmgEffect.saved ? ' (the target partially resists)' : ''}.`
        : `Wizard: You cast ${castResult.spellName}. The spell takes effect.`;

      return { world: wOut, output: { narration, mechanics: mechanicsLine } };
    }
  }

  // ── Pass 5: Combat branch ─────────────────────────────────────────────────
  // Combat sits BEFORE the physics intercept. When combat is active, physical
  // verbs (kick/punch/grab) flow into the combat resolver instead of physics —
  // this is the R13 closure: combat turns produce beats, physics turns do not,
  // so routing via combat means combat verbs gain narrative memory.
  //
  // When combat is NOT active, an explicit "attack <hostile NPC>" intent
  // begins combat and resolves the player's first turn in the same call.
  if (w.combat?.active) {
    // Flee / retreat: deterministic exit, costs 1 stress and 1 pressure clock.
    if (isFleeIntent(text)) {
      let wf = endCombat(w, { reason: 'player-flee' });
      wf = applyDeltas(wf, [
        { op: 'stress', entityId: actorId, by: 1 },
        { op: 'clock', key: 'pressure', by: 1 }
      ]);
      // Beat: flee is a player turn — record an outcome=mixed beat.
      const fleeMove = { actorId, intentText: String(text || ''), approachTag: 'survival', stakeTag: 'time' };
      const fleeResult = { outcome: 'mixed', mechanicsLine: '[combat:flee | stress+1 | pressure+1]' };
      wf = appendRecentBeat(wf, buildBeatFromTurn(wf, text, fleeMove, fleeResult));
      return { world: wf, output: { narration: 'Wizard: You break off and retreat from the fight.', mechanics: fleeResult.mechanicsLine } };
    }

    const move = inferCombatMoveFromText(w, pack, actorId, text);
    // Pass C2 — companion turns interleave between player effects and the
    // counter phase. The hook collects beat specs for each companion turn;
    // we append them after the resolver returns so beats land in the
    // player → companion(s) order.
    const companionBeats = [];
    const { world: wAfter, result } = resolveCombatTurn(w, move, {
      afterPlayerTurn: (wMid) => runCompanionTurns(wMid, companionBeats)
    });
    w = wAfter;

    // R13 closure: combat turns produce beats via the same seam as mainline.
    w = appendRecentBeat(w, buildBeatFromTurn(w, text, move, result));
    for (const spec of companionBeats) {
      w = appendRecentBeat(w, buildBeatFromTurn(w, spec.text, spec.move, spec.result));
    }

    // Stable resolution event so replay re-enters the same path.
    w = pushEvent(w, {
      kind: 'resolution',
      data: {
        actorId,
        intent: String(text || ''),
        text: String(text || ''),
        roll: result.roll,
        dc: result.dc,
        outcome: result.outcome,
        updateKind: 'combat',
        combatSummary: String(result.combatSummary || '')
      }
    });

    const composed = compose(w, text, {
      kind: 'turn',
      t: w.timeline.length,
      roll: result.roll,
      dc: result.dc,
      success: result.outcome === 'success',
      updateKind: 'combat',
      outcome: result.outcome,
      approach: move.approachTag,
      enemyName: String(result.targetEnemyName || ''),
      enemyId: String(result.targetEnemyId || ''),
      parleyed: typeof result.mechanicsLine === 'string' && result.mechanicsLine.includes('combat:parley')
    }, { pack });
    w = applyComposerDelta(w, composed.ledgerDelta);

    return { world: w, output: { narration: composed.narrationLine, mechanics: result.mechanicsLine, combatSummary: String(result.combatSummary || '') } };
  }

  // Combat-begin trigger (explicit intent only): "attack/fight <hostile NPC name>"
  // at the current node. No event-driven ambushes — Pass 5 scope is explicit.
  {
    const begin = detectAttackBeginIntent(w, text);
    if (begin) {
      let w1 = beginCombat(w, { enemies: [mintEnemyFromNpc(begin.npc)], reason: 'player-attack' });
      if (w1.combat?.active) {
        w = w1;
        const move = inferCombatMoveFromText(w, pack, actorId, text);
        const companionBeats = [];
        const { world: wAfter, result } = resolveCombatTurn(w, move, {
          afterPlayerTurn: (wMid) => runCompanionTurns(wMid, companionBeats)
        });
        w = wAfter;
        w = appendRecentBeat(w, buildBeatFromTurn(w, text, move, result));
        for (const spec of companionBeats) {
          w = appendRecentBeat(w, buildBeatFromTurn(w, spec.text, spec.move, spec.result));
        }
        w = pushEvent(w, {
          kind: 'resolution',
          data: {
            actorId,
            intent: String(text || ''),
            text: String(text || ''),
            roll: result.roll,
            dc: result.dc,
            outcome: result.outcome,
            updateKind: 'combat',
            combatSummary: String(result.combatSummary || '')
          }
        });
        const composed = compose(w, text, {
          kind: 'turn',
          t: w.timeline.length,
          roll: result.roll,
          dc: result.dc,
          success: result.outcome === 'success',
          updateKind: 'combat',
          outcome: result.outcome,
          approach: move.approachTag,
          enemyName: String(result.targetEnemyName || ''),
          enemyId: String(result.targetEnemyId || ''),
          parleyed: typeof result.mechanicsLine === 'string' && result.mechanicsLine.includes('combat:parley')
        }, { pack });
        w = applyComposerDelta(w, composed.ledgerDelta);
        return { world: w, output: { narration: composed.narrationLine, mechanics: result.mechanicsLine, combatSummary: String(result.combatSummary || '') } };
      }
    }
  }

  // --- CM11: Attack any NPC (makes them hostile, then starts combat) ---
  if (!w.combat?.active && !w.ending?.locked) {
    const anyIntent = detectAttackAnyIntent(w, text);
    if (anyIntent) {
      // Mark NPC hostile before minting enemy
      anyIntent.npc.hostile = true;
      let w1 = beginCombat(w, { enemies: [mintEnemyFromNpc(anyIntent.npc)], reason: 'player-attack' });
      if (w1.combat?.active) {
        w = w1;
        const move = inferCombatMoveFromText(w, pack, actorId, text);
        const companionBeats = [];
        const { world: wAfter, result } = resolveCombatTurn(w, move, {
          afterPlayerTurn: (wMid) => runCompanionTurns(wMid, companionBeats)
        });
        w = wAfter;
        w = appendRecentBeat(w, buildBeatFromTurn(w, text, move, result));
        for (const spec of companionBeats) {
          w = appendRecentBeat(w, buildBeatFromTurn(w, spec.text, spec.move, spec.result));
        }
        w = pushEvent(w, {
          kind: 'resolution',
          data: {
            actorId,
            intent: String(text || ''),
            text: String(text || ''),
            roll: result.roll,
            dc: result.dc,
            outcome: result.outcome,
            updateKind: 'combat',
            combatSummary: String(result.combatSummary || '')
          }
        });
        const composed = compose(w, text, {
          kind: 'turn',
          t: w.timeline.length,
          roll: result.roll,
          dc: result.dc,
          success: result.outcome === 'success',
          updateKind: 'combat',
          outcome: result.outcome,
          approach: move.approachTag,
          enemyName: String(result.targetEnemyName || ''),
          enemyId: String(result.targetEnemyId || ''),
          parleyed: typeof result.mechanicsLine === 'string' && result.mechanicsLine.includes('combat:parley')
        }, { pack });
        w = applyComposerDelta(w, composed.ledgerDelta);
        return { world: w, output: { narration: composed.narrationLine, mechanics: result.mechanicsLine, combatSummary: String(result.combatSummary || '') } };
      }
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

  // Trivial-intent gate: everyday physical actions auto-succeed without a roll.
  // Placed after all specific gates (dialogue, interior, explore, movement, spells,
  // combat, physics) but before the general resolveMove() fallthrough.
  if (isTrivialIntent(text)) {
    w = pushEvent(w, {
      kind: 'resolution',
      data: {
        actorId,
        intent: String(text || ''),
        text: String(text || ''),
        roll: 0,
        dc: 0,
        outcome: 'success',
        updateKind: 'trivial'
      }
    });
    return { world: w, output: { narration: `Wizard: You do so without difficulty.`, mechanics: 'trivial action — no roll, auto-success' } };
  }

  const move = inferMoveFromText(w, pack, actorId, text);

  const { world2, result } = resolveMove(w, move);
  // Apply deltas (canon mutation path).
  w = applyDeltas(world2, result.deltas);

  // Pass 4 — narrative memory: append a beat for this mainline resolution turn.
  // Beats are a derived narrator-continuity cache (cap 6, FIFO). They are NOT
  // canon log events, NOT delta-routed, and NOT emitted from dialogue, pure
  // exploration, structure transitions, or any branch that short-circuits
  // before resolveMove.
  w = appendRecentBeat(w, buildBeatFromTurn(w, text, move, result));

  const resolution = {
    kind: 'turn',
    t: w.timeline.length,
    roll: result.roll,
    dc: result.dc,
    success: result.outcome === 'success',
    updateKind: inferUpdateKindFromDeltas(result.deltas),
    outcome: result.outcome,
    approach: move.approachTag
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
      w = pushEvent(w, { kind: 'travel', data: { from: before || '', to: w.map.currentNodeId, intent: String(text || '') } });
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

  // --- Encounter spawning (CM11) ---
  const encounterRng = makeRng(seedFromString(`${w.meta.seed}|encounter|${w.timeline.length}`));
  const encounterEval = evaluateEncounter(w, plan, encounterRng);
  if (encounterEval.spawn) {
    const nodeId = String(w.map?.currentNodeId ?? '');
    const node = (w.map?.nodes || []).find(n => n && n.id === nodeId) || null;
    const region = node?.settlement?.region || null;
    const creatures = selectCreatures(encounterEval.cr, encounterEval.count, region, encounterRng);
    w = spawnEncounter(w, creatures, {
      ambush: encounterEval.ambush,
      reason: encounterEval.ambush ? 'ambush' : 'encounter'
    }, encounterRng);
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
  // Pass C1 — companions follow the player on zone updates after travel.
  return {
    ...w,
    party: party.map(p => ({ ...p, position: { ...(p.position || {}), zone: z, localFtX: 0, localFtY: 0 } }))
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

// ── Dialogue intent helpers ────────────────────────────────────────────────

const DIALOGUE_PHYSICS_VERB_RE = /\b(examine|inspect|search|look at|check|rip|break|smash|tear|kick|punch|shatter|take|grab|pick up|steal)\b/i;

function isDialogueExitIntent(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return false;
  return /\b(leave|walk away|step away|end conversation|end conversation\.|stop talking|goodbye|good\s?bye|farewell|done talking)\b/.test(t);
}

function isDialogueBreakingIntent(text, world) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (isExploreIntent(t)) return true;
  if (moveAdvancesScene(t)) return true;
  if (isFreeMovementIntent(t)) return true;
  // Interior transitions
  const ia = inferInteriorAction(t, world?.scene?.interior);
  if (ia && ia.kind && ia.kind !== 'none') return true;
  // Local feet moves
  if (parseLocalFeetMove(t)) return true;
  // Physics interactions
  if (DIALOGUE_PHYSICS_VERB_RE.test(t)) return true;
  return false;
}

// Pass 4 — narrative memory: derive a beat from the just-resolved turn.
// The world passed in must already reflect post-applyDeltas state so that
// timeline.length corresponds to the committed turn index. Pure function;
// caller (playerMove) routes the result through appendRecentBeat which
// applies the normalizer and FIFO trim.
function buildBeatFromTurn(world, text, move, result) {
  const nodeId = String(world?.map?.currentNodeId ?? '');
  const node = (world?.map?.nodes ?? []).find(n => n && n.id === nodeId) || null;
  const interior = world?.scene?.interior;
  let location = '';
  if (interior && typeof interior === 'object' && interior.structureKey && interior.roomId) {
    location = `interior:${String(interior.structureKey)}:${String(interior.roomId)}`;
  } else if (node?.name) {
    location = String(node.name);
  } else if (nodeId) {
    location = nodeId;
  }
  return {
    t: Array.isArray(world?.timeline) ? world.timeline.length : 0,
    input: String(text ?? ''),
    approach: String(move?.approachTag ?? ''),
    stake: String(move?.stakeTag ?? ''),
    outcome: String(result?.outcome ?? ''),
    location,
    mechanics: String(result?.mechanicsLine ?? '')
  };
}

// Pass C1.1 — map dialogue ask modes to beat outcomes. Shared/recruited
// count as social success. Lies/withholdings/soft refusals are mixed.
// Hard refusals and blank deflections are failures.
function askBeatOutcome(mode) {
  const m = String(mode || '');
  if (m === 'shared' || m === 'recruited') return 'success';
  if (m === 'refused-hard') return 'failure';
  if (m === 'deflected') return 'mixed';
  return 'mixed';
}

function dialogueAskNarration(outcome) {
  const name = outcome?.npcName || 'They';
  switch (outcome?.mode) {
    case 'shared':
      return `Wizard: ${name} answers plainly, offering what they know.`;
    case 'recruited':
      return `Wizard: ${name} nods slowly and falls into step beside you.`;
    case 'withheld':
      return `Wizard: ${name} deflects, keeping the truth close.`;
    case 'lied':
      return `Wizard: ${name} offers a smooth explanation that doesn't quite match what you feel.`;
    case 'deflected':
    default:
      return `Wizard: ${name} changes the subject.`;
  }
}

function extractDialogueRef(text) {
  const t = String(text || '');
  // "talk to X" / "speak to X" / "speak with X" / "chat with X"
  const m1 = t.match(/\b(?:talk|speak|chat)\s+(?:to|with)\s+(.+)/i);
  if (m1 && m1[1]) return cleanDialogueRef(m1[1]);
  // "approach X" (conservative — resolved NPC must exist or caller falls through)
  const m2 = t.match(/\bapproach\s+(.+)/i);
  if (m2 && m2[1]) return cleanDialogueRef(m2[1]);
  return '';
}

function cleanDialogueRef(raw) {
  return String(raw || '')
    .trim()
    .replace(/[.!?,;:]+$/, '')
    .trim();
}

function isExploreIntent(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return false;
  // Broad observation/perception: anything that is purely sensory or informational
  // and requires no skill check. Covers "look around", "what do I see", "describe",
  // "listen", "smell", inventory/status checks, reading signs, etc.
  if (/\b(look around|look about|survey|scan|search the area|where can i go|where do i go|options|exits|way out|how do i get out|get out of here|leave this place)\b/.test(t)) return true;
  // "What do I see / what's here / what is in this room / how big / what does X look like"
  if (/^(what|how|where|who|describe)\b/.test(t) && !/\b(pick|climb|force|break|fight|attack|try|attempt|sneak|steal|persuade|deceive|track|forage|decipher|calm|leap|jump)\b/.test(t)) return true;
  // "I look at X" / "I read X" / "I listen" / "I smell" / "I check my inventory"
  if (/\bi\s+(look\s+at|read|listen|smell|check\s+(my\s+)?inventory|check\s+my|observe)\b/.test(t)) return true;
  return false;
}

function isTrivialIntent(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return false;
  // Trivial physical actions that auto-succeed: no risk, no uncertain outcome.
  // These are everyday actions any able-bodied person can do without a check.
  return /\bi\s+(sit\s+down|stand\s+up|draw\s+(my\s+)?sword|draw\s+(my\s+)?weapon|put\s+away|sheathe|open\s+the\s+door|walk\s+to|eat|drink|light\s+a\s+torch|light\s+my|take\s+off|put\s+on|drop\s+(my\s+)?pack|drop\s+my|wave|kneel|rest|pray|bow|nod|stretch|yawn|close\s+the\s+door|pick\s+up\s+(the\s+)?rock|pick\s+up\s+(the\s+)?stone)\b/.test(t);
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

// ── Pass 5: combat helpers ────────────────────────────────────────────────

// Pass C2 — companion turn interleave. Invoked as the afterPlayerTurn hook
// on resolveCombatTurn: after the player's combat effects have landed but
// before the post-player victory check and the enemy counter phase, every
// living companion takes a deterministic turn. Each companion that actually
// acts contributes a beat spec into `beats` so the playloop caller can
// append a RecentBeats entry per companion in player → companion(s) order.
// Returns the mutated world plus summary parts for the combatSummary line.
function runCompanionTurns(world, beats) {
  let w = world;
  const summaryParts = [];
  const party = Array.isArray(w?.party) ? w.party : [];
  for (let i = 1; i < party.length; i++) {
    if (!w.combat?.active) break;
    const companion = w.party?.[i];
    if (!companion || (companion.wounds ?? 0) >= 6) continue;
    const ct = resolveCompanionTurn(w, companion);
    w = ct.world;
    if (ct.result.skipped) continue;
    summaryParts.push(String(ct.result.mechanicsLine || ''));

    // Companion beat shape mirrors the mainline/combat seam so buildBeatFromTurn
    // normalizes it identically. approachTag is the companion's resolved
    // approach; stakeTag is 'harm' (the companion is acting in a combat round).
    // outcome is 'success' on parley, else 'mixed' — companions don't roll so
    // we don't claim success on straight damage.
    const companionMove = {
      actorId: String(companion.id),
      intentText: '',
      approachTag: String(ct.result.approach || 'force'),
      stakeTag: 'harm'
    };
    const companionResult = {
      outcome: ct.result.parleyed ? 'success' : 'mixed',
      mechanicsLine: String(ct.result.mechanicsLine || '')
    };
    beats.push({ text: ct.result.mechanicsLine || '', move: companionMove, result: companionResult });

    // If the companion ended combat (parley), stop — resolveCombatTurn's
    // own short-circuit will skip the counter phase and return.
    if (!w.combat?.active) break;
  }
  return { world: w, summaryParts };
}

function isFleeIntent(text) {
  const t = String(text || '').toLowerCase();
  return /\b(flee|retreat|disengage|run\s+away|run\s+for\s+it|break\s+off)\b/.test(t);
}

// Detects "attack <name>" / "fight <name>" / "kill <name>" / "strike <name>"
// against a hostile NPC at the current node. Returns { npc } or null.
// Conservative: only matches when the player text starts with an attack verb
// AND the named target maps to an NPC at the current node with hostile===true.
function detectAttackBeginIntent(world, text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const m = t.match(/\b(attack|fight|kill|strike|assault)\s+(.+)/i);
  if (!m) return null;
  const ref = String(m[2] || '').trim().replace(/[.!?,;:]+$/, '').trim();
  if (!ref) return null;

  const nodeId = String(world?.map?.currentNodeId ?? '');
  const node = (world?.map?.nodes || []).find(n => n && n.id === nodeId) || null;
  const npcs = node?.settlement?.npcs || [];
  if (!Array.isArray(npcs) || !npcs.length) return null;

  const norm = (s) => String(s || '').toLowerCase().trim();
  const refLower = norm(ref);
  const npc = npcs.find(n => n && n.hostile === true && (
    norm(n.id) === refLower ||
    norm(n.name) === refLower ||
    norm(n.name).includes(refLower) ||
    refLower.includes(norm(n.name))
  ));
  if (!npc) return null;
  return { npc };
}

// CM11: Like detectAttackBeginIntent but matches ANY NPC at the current node
// (not just hostile ones). Only called after the hostile-only check returned null,
// so hostile NPCs still take the fast path.
function detectAttackAnyIntent(world, text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const m = t.match(/\b(attack|fight|kill|strike|assault)\s+(.+)/i);
  if (!m) return null;
  const ref = String(m[2] || '').trim().replace(/[.!?,;:]+$/, '').trim();
  if (!ref) return null;

  const nodeId = String(world?.map?.currentNodeId ?? '');
  const node = (world?.map?.nodes || []).find(n => n && n.id === nodeId) || null;
  const npcs = node?.settlement?.npcs || [];
  if (!Array.isArray(npcs) || !npcs.length) return null;

  const norm = (s) => String(s || '').toLowerCase().trim();
  const refLower = norm(ref);
  const npc = npcs.find(n => n && (
    norm(n.id) === refLower ||
    norm(n.name) === refLower ||
    norm(n.name).includes(refLower) ||
    refLower.includes(norm(n.name))
  ));
  if (!npc) return null;
  return { npc };
}

// Translates free text into a combat-shaped move. Reuses the mainline
// inferMoveFromText for stake/risk computation, then biases the approach
// based on combat-meaningful verbs. Always sets stakeTag='harm' and points
// at the first living enemy when no explicit target is parsed.
function inferCombatMoveFromText(world, pack, actorId, text) {
  const base = inferMoveFromText(world, pack, actorId, text);
  const t = String(text || '').toLowerCase();
  let approachTag = base.approachTag;
  if (/\b(attack|strike|hit|punch|fight|kill|swing|slash|stab|charge)\b/.test(t)) approachTag = 'force';
  else if (/\b(parley|talk\s+down|soothe|calm|appeal|plead)\b/.test(t)) approachTag = 'heart';
  else if (/\b(defend|guard|brace|block|hold\s+the\s+line|shield)\b/.test(t)) approachTag = 'endure';
  else if (/\b(study|aim|read|observe|size\s+up|focus)\b/.test(t)) approachTag = 'focus';
  else if (/\b(sneak|slip|feint|dodge|weave|finesse)\b/.test(t)) approachTag = 'finesse';

  const enemies = Array.isArray(world?.combat?.enemies) ? world.combat.enemies : [];
  const firstAlive = enemies.find(e => e && e.hp > 0);
  return {
    ...base,
    approachTag,
    stakeTag: 'harm',
    targetId: firstAlive ? firstAlive.id : null
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

// Pass I3 — merge a sub-region pack into a base pack by appending catalog arrays.
export function mergeSubRegion(basePack, regionPack) {
  const append = (field) => [
    ...(basePack[field] || []),
    ...(regionPack[field] || [])
  ];
  return {
    ...basePack,
    locations: append('locations'),
    npcArchetypes: append('npcArchetypes'),
    objectives: append('objectives'),
    complications: append('complications'),
    sensoryMotifs: append('sensoryMotifs')
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
