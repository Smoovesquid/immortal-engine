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
import { biomeForNode, biomeFlavor } from './world/biome.js';
import { ecologyTravelLine } from './ecology/snapshot.js';
import { ensureMap, pickTravelDestination, moveToNode, neighbors, bfsPath, cleanPlaceName, exitsFrom, directionFromText, stepCell, nodeAtCell, nodesWithinSight, cardinalToCell, seeNode, visitNode, SIGHT_RADIUS } from './map/mapState.js';
import { conductorDecision, applyConductorDeltas } from './conductor.js';
import { worldTick } from './worldTick.js';
import { resolveMove } from './resolve.js';
import { applyDeltas } from './effectsCore.js';
import { introduceThread, resolveThread, ensureInstrumentLayer } from './instrument.js';
import { applyGeneratedStructuresForNode } from './structures/applyGeneratedStructuresForNode.js';
import { enterStructureInterior, exitStructureInterior, moveWithinInterior, getInteriorView, interiorDirectionalExits, resolveStructureSelection } from './structures/interiors.js';
import { createCharacter } from './chargen/genesis.js';
import { decompressAndCanonizeSync } from './decompression/decompress.js';
import { discoverNode } from './map/mapState.js';
import { detectPhysicalInteraction, evaluatePhysicsSync } from './llmPhysics.js';
import { rollPhysicsCheck } from './resolve.js';
import { appendCanonEvent } from './csl/canonLog.js';
import { createGoal, checkGoals } from './goals/goalContract.js';
import { castArcs, tickArcs } from './story/storyEngine.js';
import { beginDialogue, askNpc, endDialogue, resolveNpcAtCurrentNode, isRecruitIntent, npcVoice, voiceManner } from './npc/dialogue.js';
import { resolveArc } from './npc/npcArc.js';
import { companionPass } from './npc/companionVoice.js';
import { checkMilestone, buildLevelUpLine } from './advancement/milestones.js';
import { darkGiftForThreshold } from './magic/forbiddenGates.js';
import { resolveCombatTurn } from './combat/combatResolve.js';
import { beginCombat, endCombat, mintEnemyFromNpc } from './combat/combatLifecycle.js';
import { resolveCompanionTurn } from './combat/companionTurn.js';
import { castSpell } from './spell/castSpell.js';
import { evaluateEncounter, selectCreatures, spawnEncounter } from './combat/encounterSpawn.js';
import { isMetaQuestion, handleMetaQuestion, isNullAction, isQuestionShaped } from './grace/gracefulAdjudication.js';
import { resolveEscapeCombatTurn, initEscapeHp, initEscapeKit, shortRest, longRest, applySurpriseRound, parseEscapeAction, combatStatusAnswer, meleeProfile, playerAc } from './combat/escapeCombat.js';
import { statMod, maxWounds } from './ruleset/core/stats.js';
import { shopsHere, stockFor, settlementStock, economyAt, priceToSell, shopBuys, restockEpoch, purseTotalCopper, pursePay, purseReceive, formatPrice, matchByName } from './economy/shop.js';
import { getItemDef } from './ruleset/core/items/index.js';
import { identifyDc, sageFeeCopper, pickNamedReward } from './ruleset/core/items/magic.js';
import { salvageYield } from './ruleset/core/items/materials.js';
import { matchRecipe, missingInputs, resolveCraft } from './craft/craft.js';
import { matchBuildPlan, missingBuildInputs, resolveBuild, makePlayerStructure, laborPlan, shelterAt } from './structures/playerBuilt.js';

// Pure-ish play loop: world -> {world, output}

// v1 Escape: per-travel chance of a creature ambush. Tuned so the journey has
// real risk without becoming a death-spiral — most hops are clear, some bite.
const ESCAPE_ENCOUNTER_CHANCE = 0.3;
// Per-LEG chance during a multi-hop journey. Much lower than a single arrival so a
// long trip doesn't compound to near-certain combat: e.g. a 3-leg journey is then
// ~39% to be ambushed once (1-0.85^3), not ~78%. Longer trips stay modestly riskier.
const MULTIHOP_LEG_CHANCE = 0.15;
// Wandering off-road into open country is riskier per step than reaching a refuge,
// but lower than an arrival roll so the wild isn't a meat grinder — most tiles are
// quiet, the empty stretches are where something occasionally finds you.
const WILD_ENCOUNTER_CHANCE = 0.22;
// Tamed foe HP for escape ambushes. Low enough that a gearless level-1 player
// can usually drop it in a few swings before wounds pile up.
const ESCAPE_ENEMY_HP = 5;

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
  // Crownlands sub-region — Shakespeare-flavored political threads.
  if (pack.id === 'fantasy' && packsById.crownlands) {
    pack = mergeSubRegion(pack, packsById.crownlands);
  }
  // Hallowed Reaches sub-region — divine gaze, morality system threads.
  if (pack.id === 'fantasy' && packsById.hallowed_reaches) {
    pack = mergeSubRegion(pack, packsById.hallowed_reaches);
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

  // You begin standing on your start node — mark it visited so it always reads
  // bright on the overworld (vs the dim icons of places merely sighted later).
  if (w.map?.currentNodeId) {
    w = visitNode(w, w.map.currentNodeId);
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

  // Seed pack threads into the instrument (crownlands + ashenmoor long-arc threads).
  if (Array.isArray(pack.threads) && pack.threads.length) {
    const existingLabels = new Set((w.instrument?.threads || []).map(t => t.label));
    const threadRng = makeRng(seedFromString(`${w.meta.seed}|pack-threads`));
    const fate = Number(w.meta?.fate ?? 0.2);
    const count = fate >= 0.7 ? 3 : fate >= 0.4 ? 2 : 1;
    const shuffled = [...pack.threads].sort(() => threadRng.float() - 0.5);
    for (const pt of shuffled.slice(0, count)) {
      if (!existingLabels.has(pt.name)) {
        w = introduceThread(w, pt.name);
      }
    }
  }

  // Seed pack factions into world state (safe — does not overwrite existing factions).
  if (Array.isArray(pack.factions) && pack.factions.length && !Array.isArray(w.factions)) {
    w = { ...w, factions: pack.factions };
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
  // v21 — Also set player position (nodeId + interior state). Place coordinates
  // (ux, uy) are client-side and will be initialized on first render.
  {
    const structuresHere = Object.values(w.structures?.byId || {}).filter(
      s => String(s?.nodeId || '') === String(w.map?.currentNodeId || '')
    );
    if (structuresHere.length > 0) {
      let w1 = enterStructureInterior(w, '#1');
      const interior = w1.scene?.interior || null;
      if (interior) {
        // Home is a cottage: it renders as a timber house and its first non-entry
        // room is a bedchamber — so you wake in your own bed, not a cave.
        const key = String(interior.structureKey);
        const homeSt = w1.structures?.byId?.[key];
        if (homeSt && homeSt.buildingType !== 'cottage') {
          w1 = { ...w1, structures: { ...w1.structures, byId: { ...w1.structures.byId, [key]: { ...homeSt, buildingType: 'cottage' } } } };
        }
        const st = w1.structures?.byId?.[key];
        const rooms = Array.isArray(st?.topology?.rooms) ? st.topology.rooms : [];
        // Find the first non-entry room (the bedchamber in a cottage plan).
        const nonEntry = rooms.find(r => !((Array.isArray(r?.tags) ? r.tags : []).includes('entry')));
        const bedroomId = nonEntry ? String(nonEntry.id) : '';
        if (bedroomId && bedroomId !== interior.roomId) {
          w = moveWithinInterior(w1, bedroomId);
        } else {
          w = w1;
        }
        // v21 — Persist player location: set position with nodeId and interior state.
        const finalInterior = w.scene?.interior || null;
        if (finalInterior) {
          w = applyDeltas(w, [{
            op: 'position',
            entityId: 'party',
            set: {
              zone: 'near',
              nodeId: String(w.map?.currentNodeId || ''),
              interior: { structureId: String(finalInterior.structureKey), roomId: String(finalInterior.roomId) }
            }
          }]);
        }
      }
    }
  }

  // v21 — If player position is not yet set (no structures, etc.), set a default
  // position at the starting node.
  if (w.party && w.party[0] && (!w.party[0].position?.nodeId)) {
    w = applyDeltas(w, [{
      op: 'position',
      entityId: 'party',
      set: {
        zone: 'far',
        nodeId: String(w.map?.currentNodeId || '')
      }
    }]);
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

  // v1 game mode: open-ended. You wake into your ordinary life with no single
  // destination and no win-on-arrival — the journey itself is the game, and the
  // world (biomes, ecology, people, the road's dangers) is yours to wander. We
  // keep the classic-D&D HP + hedge-caster kit so the road still has teeth.
  // Opt-in via meta.mode === 'escape'; the pure-engine tests (mode '') keep the
  // goalless waking opening unchanged.
  if (w.meta?.mode === 'escape') {
    w = { ...w, scene: { ...w.scene, objective: 'Your life is your own. See where the road leads.' } };
    w = initEscapeHp(w);
    w = initEscapeKit(w);
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

  // v25 — cast story arcs onto the freshly decompressed home settlement so the
  // first tavern rumor is already in the air when the adventure opens.
  w = castArcs(w);

  const composed = compose(w, '', outcome, { pack });
  w = applyComposerDelta(w, composed.ledgerDelta);
  return { world: w, output: { narration: composed.narrationLine, mechanics: composed.mechanicsLine } };

}

// Morality M1: single-chokepoint wrapper. Runs the real turn, then silently lets the act
// form the soul (the seven-axis deed detector). No output change — M1 is invisible. Never
// throws to the turn (silent-fallback discipline, like the LLM layer).
export function playerMove(world, packsById, text) {
  const res = playerMoveCore(world, packsById, text);
  try {
    const oldCorruption = Number(world?.party?.[0]?.morality?.corruption ?? 0);
    const w2 = applyDeedCharges(res.world, text, res.output);
    const newCorruption = Number(w2?.party?.[0]?.morality?.corruption ?? 0);

    // M4: dark gift on threshold crossing
    let w3 = w2;
    let darkGiftText = null;
    const gift = darkGiftForThreshold(oldCorruption, newCorruption);
    if (gift) {
      const known = w3.party?.[0]?.spells?.known;
      if (Array.isArray(known) && !known.includes(gift.ref)) {
        w3 = applyDeltas(w3, [{ op: 'learnSpell', spellRef: gift.ref }]);
        darkGiftText = gift.text;
      }
    }

    // Milestone level-up check
    const milestone = checkMilestone(w3);
    let w4 = milestone.world;

    // P-77 — the bigger milestones pay in story, not gold: a named unique
    // with its history, seed-deterministic, never a duplicate.
    let rewardText = null;
    if (milestone.leveled && (milestone.newLevel === 3 || milestone.newLevel === 5)) {
      const namedDef = pickNamedReward(w4, `L${milestone.newLevel}`, seedFromString);
      if (namedDef) {
        w4 = applyDeltas(w4, [{ op: 'addItem', entityId: w4.party?.[0]?.id || 'party', item: { id: `named_${milestone.newLevel}`, defRef: namedDef.defRef, equipped: null } }]);
        w4 = { ...w4, timeline: [...w4.timeline, { t: w4.timeline.length, kind: 'namedReward', data: { defRef: namedDef.defRef, level: milestone.newLevel } }] };
        rewardText = `The road pays its debts: ${namedDef.name} comes to your hand. ${namedDef.history}`;
      }
    }

    // P-78 — companions are people: they witness deeds (loyalty), they speak
    // at scene-shaped moments (one line, deterministic), and they object to
    // the dark path — twice ignored, they leave.
    const comp = companionPass(w4, { prevWorld: world, oldCorruption, newCorruption });
    const w5 = comp.world;

    // Append dark gift / level-up / companion narration if anything fired
    if (!darkGiftText && !milestone.leveled && !comp.line) {
      return w5 === res.world ? res : { ...res, world: w5 };
    }

    let narration = res.output?.narration ?? '';
    if (darkGiftText) narration = narration + '\n\n' + darkGiftText;
    if (milestone.leveled) narration = narration + '\n\n' + buildLevelUpLine(milestone.newLevel, milestone.gainedFeatures);
    if (rewardText) narration = narration + '\n' + rewardText;
    if (comp.line) narration = narration + '\n\n' + comp.line;

    return { ...res, world: w5, output: { ...res.output, narration } };
  } catch {
    return res;
  }
}

function playerMoveCore(world, packsById, text) {

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

  // ── C.2d: a pending interactive road encounter (brigands/toll) intercepts the
  // next input as the player's choice — before any other gate. ──
  if (w.travel?.pending && !w.combat?.active) {
    const pend = w.travel.pending;
    const choice = parseEncounterChoice(text);
    // No clear choice, or "pay" with no coin → re-prompt; no state change, no event.
    if (!choice) {
      return { world: w, output: { narration: `Wizard: ${pend.foeName} still block the way, waiting. Pay, talk your way past, slip by, or fight?`, mechanics: '[encounter:pending]' } };
    }
    if (choice === 'pay' && !payToll(w).paid) {
      return { world: w, output: { narration: `Wizard: You turn out empty pockets — not a coin to your name, and ${pend.foeName} aren't amused. Talk your way past, slip by, or fight?`, mechanics: '[encounter:pending]' } };
    }
    // Commit: clear pending and record one replayable resolution event.
    let w1 = pushEvent({ ...w, travel: { pending: null } }, { kind: 'resolution', data: { actorId: 'party', text: String(text || ''), intent: String(text || ''), roll: 0, dc: 0, outcome: 'success', updateKind: `encounter:${choice}` } });
    const dest = pend.destName || 'the road ahead';
    const erng = makeRng(seedFromString(`${w1.meta.seed}|roadEncounter|${w1.timeline.length}|${choice}`));
    const startFight = () => {
      const brig = { name: String(pend.foeName).replace(/^A\s+/i, '').replace(/s$/, ''), ref: 'brigand', cr: 0.125, maxHp: ESCAPE_ENEMY_HP, ac: 12, damage: 4, canParley: false };
      return spawnEncounter(w1, [brig], { ambush: true, reason: 'brigand-fight' }, erng);
    };
    // Overcoming an encounter earns its XP however it's overcome — coin,
    // tongue, or shadow. (The fight path earns through combat victory.)
    const ROAD_XP = 25; // one brigand band, CR 1/8
    const awardRoadXp = (ww) => applyDeltas(ww, [{ op: 'gainXp', amount: ROAD_XP }]);
    // Skill checks read the 5e sheet when present (a bard's Persuasion, a
    // rogue's Stealth), legacy stats otherwise.
    const sheet = w1.party?.[0]?.dnd;
    const talkBonus = sheet ? (Number(sheet.skills?.Persuasion) || 0) : statMod(Number(w1.party?.[0]?.stats?.CHARM ?? 10));
    const slipBonus = sheet ? (Number(sheet.skills?.Stealth) || 0) : statMod(Number(w1.party?.[0]?.stats?.AGILITY ?? 10));
    if (choice === 'pay') {
      const { world: wp, coin } = payToll(w1);
      return { world: awardRoadXp(wp), output: { narration: `Wizard: You hand over a ${coin} coin. ${pend.foeName} stand aside and wave you on; the way to ${dest} is clear. (+${ROAD_XP} XP)`, mechanics: '[encounter:paid]' } };
    }
    if (choice === 'talk') {
      const total = erng.int(1, 20) + talkBonus;
      if (total >= 12) return { world: awardRoadXp(w1), output: { narration: `Wizard: You talk fast and easy, and ${pend.foeName} decide you're more trouble than a coin's worth. They wave you through; the way to ${dest} is clear. (+${ROAD_XP} XP)`, mechanics: '[encounter:talked]' } };
      return { world: startFight(), output: { narration: `Wizard: Your words fall flat — ${pend.foeName} draw steel and come at you.`, mechanics: '[encounter:talk-failed]' } };
    }
    if (choice === 'slip') {
      const total = erng.int(1, 20) + slipBonus;
      if (total >= 12) return { world: awardRoadXp(w1), output: { narration: `Wizard: You bide your moment and slip past unseen; behind you, ${pend.foeName} still eye the empty road. The way to ${dest} is clear. (+${ROAD_XP} XP)`, mechanics: '[encounter:slipped]' } };
      return { world: startFight(), output: { narration: `Wizard: A loose stone turns underfoot — ${pend.foeName} spot you and attack.`, mechanics: '[encounter:slip-failed]' } };
    }
    return { world: startFight(), output: { narration: `Wizard: You set yourself and meet ${pend.foeName} head-on.`, mechanics: '[encounter:fight]' } };
  }

  // ── Long rest: a real night's sleep, settlements only ─────────────────────
  // Full HP, all spell slots, every class reserve. The DM answer to "I sleep":
  // in town you get a bed; in the wild the night is not your friend.
  if (!w.combat?.active && w.meta?.mode === 'escape' && isLongRestIntent(text)) {
    const hereId = w.map?.currentNodeId;
    const here = (w.map?.nodes || []).find(n => n && n.id === hereId) || null;
    if (here?.nodeType === 'settlement') {
      // The night passes: the clock rolls forward to the next first-light
      // (hours are counted from dawn of day one, so the next multiple of 24
      // is the next morning).
      const slept = longRest(w);
      const curHours = Number(slept.time?.hours) || 0;
      const nextMorning = (Math.floor(curHours / 24) + 1) * 24;
      const w1 = pushEvent({
        ...slept,
        time: { ...(slept.time || {}), hours: nextMorning }
      }, {
        kind: 'resolution',
        data: { actorId: 'party', text: String(text || ''), intent: String(text || ''), roll: 0, dc: 0, outcome: 'success', updateKind: 'long-rest' }
      });
      const pcRest = w1.party?.[0];
      const slotsLine = pcRest?.dnd?.spellcasting ? ' Your magic settles back into reach.' : '';
      return {
        world: w1,
        output: {
          narration: `Wizard: You take a real bed and a real night. Sleep comes slow, then all at once. You wake whole — ${w1.meta.escapeHp}/${w1.meta.escapeMaxHp} HP.${slotsLine}`,
          mechanics: '[rest:long]'
        }
      };
    }
    // P-72 — a shelter you raised here upgrades the wild night. A sound roof
    // (lean-to, sound/fine) gives a true long rest, like a settlement bed; a
    // rough one (poor) beats bare ground but isn't a real night's sleep.
    const shelter = shelterAt(w, hereId);
    const band = shelter?.build?.restBand;
    if (band === 'long') {
      const slept = longRest(w);
      const curHours = Number(slept.time?.hours) || 0;
      const nextMorning = (Math.floor(curHours / 24) + 1) * 24;
      const w1 = pushEvent({
        ...slept,
        time: { ...(slept.time || {}), hours: nextMorning }
      }, {
        kind: 'resolution',
        data: { actorId: 'party', text: String(text || ''), intent: String(text || ''), roll: 0, dc: 0, outcome: 'success', updateKind: 'long-rest' }
      });
      const bt = shelter.buildingType || 'shelter';
      const slotsLine = w1.party?.[0]?.dnd?.spellcasting ? ' Your magic settles back into reach.' : '';
      return {
        world: w1,
        output: {
          narration: `Wizard: The ${bt} you raised keeps the weather and the dark at bay. Sleep comes, and you wake whole — ${w1.meta.escapeHp}/${w1.meta.escapeMaxHp} HP.${slotsLine}`,
          mechanics: '[rest:long]'
        }
      };
    }
    if (band === 'good') {
      const sRng = makeRng(seedFromString(`${w.meta.seed}|shelterRest|${w.timeline.length}`));
      const before = Number(w.meta.escapeHp) || 0;
      let rested = shortRest(w, sRng);
      rested = shortRest(rested, sRng); // a second wind, under your own roof
      const gained = (Number(rested.meta.escapeHp) || 0) - before;
      const bt = shelter.buildingType || 'shelter';
      return {
        world: rested,
        output: {
          narration: gained > 0
            ? `Wizard: Your ${bt} is a rough thing, but it keeps the worst off — you rest better than open ground allows. (+${gained} HP. A sounder shelter would buy a full night.)`
            : `Wizard: You hole up in your ${bt} a while. Rough as it is, it beats the open — but you're already as rested as it can give.`,
          mechanics: '[rest:breather]'
        }
      };
    }
    // No bed in the wild — but a breather is a breather. Short rest instead
    // of a flat refusal: a real DM gives you SOMETHING for stopping.
    const breatherRng = makeRng(seedFromString(`${w.meta.seed}|breather|${w.timeline.length}`));
    const before = Number(w.meta.escapeHp) || 0;
    const rested = shortRest(w, breatherRng);
    const gained = (Number(rested.meta.escapeHp) || 0) - before;
    return {
      world: rested,
      output: {
        narration: gained > 0
          ? `Wizard: No bed out here — every sound in the open country has teeth. You take what rest you can with your back to something solid. (+${gained} HP. For real sleep, find a settlement.)`
          : 'Wizard: The open country is no bed. You rest your legs a while, but real sleep needs walls — find a settlement.',
        mechanics: '[rest:breather]'
      }
    };
  }

  // ── Null actions: filler, acknowledgments, aborts. A real DM lets the
  // moment breathe — no roll, no time cost, no consequence. Skipped in
  // dialogue (a bare "yes" there is an answer, not filler).
  if (!w.scene?.dialogue && isNullAction(text)) {
    return {
      world: w,
      output: { narration: 'Wizard: Take your time. The world holds.', mechanics: '[table-talk]' }
    };
  }

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
      let wEnded = ended.world;
      wEnded = pushEvent(wEnded, {
        kind: 'dialogueExit',
        data: {
          npcId: ended.outcome.npcId || '',
          turnsInDialogue: ended.outcome.turnsInDialogue || 0,
          topicsCount: ended.outcome.topicsCount || 0
        }
      });
      // The conversation closes OUT LOUD, then the action resolves — a real DM
      // says you've stepped away before narrating the walk. (The old silent
      // fall-through resolved the action with no acknowledgment; the player
      // experienced the game forgetting they were mid-conversation.) Dialogue
      // is null on wEnded, so the recursive resolve cannot re-enter here.
      const name = ended.outcome.npcName || 'them';
      const after = playerMoveCore(wEnded, packsById, text);
      const rest = String(after.output?.narration || '').replace(/^Wizard:\s*/, '');
      return {
        world: after.world,
        output: {
          ...after.output,
          narration: `Wizard: You step away from ${name}. ${rest}`
        }
      };
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
          narration: dialogueAskNarration(asked.outcome, w),
          mechanics: `[dialogue ask | ${asked.outcome.mode}${asked.outcome.factId ? ` | ${asked.outcome.factId}` : ''} | trust:${asked.outcome.trustLevel}]`,
          // P6 — structured handle for the local voice layer (presentation
          // only; the decision above is already canon). `manner` styles the
          // LLM delivery; `commonBody` carries data-true answers (names,
          // bearings) the voice layer must NOT replace with invention.
          dialogue: {
            npcName: String(asked.outcome.npcName || ''),
            npcRole: String(asked.outcome.npcRole || ''),
            mode: String(asked.outcome.mode || ''),
            mood: String(asked.outcome.brainMood || ''),
            manner: String(asked.outcome.manner || 'even'),
            factPhrase: asked.outcome.factId ? factPhrase(asked.outcome.factId) : '',
            factBody: String(asked.outcome.factBody || ''),
            commonBody: String(asked.outcome.commonBody || ''),
            trustLevel: Number(asked.outcome.trustLevel) || 0,
            playerLine: String(text || '')
          }
        }
      };
    }
  }

  const interiorAction = inferInteriorAction(text, w.scene?.interior);
  if (interiorAction.kind === 'enter') {
    // "Go inside" when already indoors gets the obvious answer, not the
    // blocked-wall message.
    if (w.scene?.interior) {
      return { world: w, output: { narration: 'Wizard: You\'re already indoors. "Go outside" first if you\'re after a different roof.', mechanics: '' } };
    }
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
    if (w1 !== wPrepared) {
      // Record the transition so it replays from the timeline. Without an event,
      // replay never re-enters and diverges from the live simulation (U21).
      const w2 = pushEvent(w1, { kind: 'resolution', data: { actorId: 'party', text: String(text || ''), intent: String(text || ''), roll: 0, dc: 0, outcome: 'success', updateKind: 'interior-enter' } });
      return { world: w2, output: { narration: 'Wizard: You enter the structure interior.', mechanics: '' } };
    }
  }

  if (interiorAction.kind === 'exit') {
    const w1 = exitStructureInterior(w);
    if (w1 !== w) {
      const w2 = pushEvent(w1, { kind: 'resolution', data: { actorId: 'party', text: String(text || ''), intent: String(text || ''), roll: 0, dc: 0, outcome: 'success', updateKind: 'interior-exit' } });
      return { world: w2, output: { narration: 'Wizard: You step back outside.', mechanics: '' } };
    }
  }

  if (interiorAction.kind === 'move') {
    const wantsRiskyMove = isRiskyOrObstructedMoveIntent(text);
    if (!wantsRiskyMove) {
      const targetRoomId = interiorAction.toRoomId || pickAdjacentInteriorByDirection(w, interiorAction.direction);
      const fromRoomId = String(w.scene?.interior?.roomId || '');
      const w1 = targetRoomId ? moveWithinInterior(w, targetRoomId) : w;
      // Success is a real room change, not just a new object identity. moveWithinInterior
      // calls ensureWorld() internally, so its no-op return is a fresh object that would
      // fool a `w1 !== w` check into narrating a move that never happened.
      if (targetRoomId && String(w1.scene?.interior?.roomId || '') !== fromRoomId) {
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
        const movedDir = normalizeDir(interiorAction.direction);
        const moveMsg = movedDir ? `Wizard: You move ${movedDir} into the next chamber.` : 'Wizard: You move into the next chamber.';
        return { world: w2, output: { narration: moveMsg, mechanics: '' } };
      }
      const blockedDir = normalizeDir(interiorAction.direction);
      // "Go inside" while already indoors gets the obvious answer.
      const blockedMsg = (!blockedDir && /\b(inside|indoors|enter)\b/i.test(String(text || '')) && w.scene?.interior)
        ? 'Wizard: You\'re already indoors. "Go outside" first if you\'re after a different roof.'
        : blockedDir
          ? `Wizard: There is no way ${blockedDir} from here. The wall holds.`
          : 'Wizard: That way is blocked from here.';
      return { world: w, output: { narration: blockedMsg, mechanics: '' } };
    }
    // Risky/obstructed/special movement falls through to normal resolution (roll-capable path).
  }

  // Travel intent voiced while indoors ("head toward the forest" from inside
  // the inn): a real DM bridges it — you're inside; the road starts at the
  // door. Clarify rather than rolling dice at the idea of leaving.
  if (w.scene?.interior && !w.combat?.active && isFreeMovementIntent(text) && /\b(toward|towards|make for|get moving|set (?:out|off)|head)\b/i.test(String(text || ''))) {
    return {
      world: w,
      output: {
        narration: 'Wizard: You\'re indoors — the road starts at the door. Say "go outside" and then name your heading.',
        mechanics: '[clarify:indoors]'
      }
    };
  }

  // Target-aware examination: "examine the table" / "look at the crate" / "inspect
  // my blade". Observe-only (no roll, no state change). Describes the actual object
  // named — real furniture (name/state/notes/parts) or an inventory item — and on
  // a miss pivots to what IS present. Falls through to the room-overview explore
  // branch below when no specific target is named ("examine" / "look around").
  // P-67 — trade: "I buy a healing potion" / "sell the shortsword" / "what's
  // for sale?" resolve in prose at a settlement with shops. No menus; the DM
  // counts coins. Skipped in combat (nobody trades mid-fight) and dialogue
  // (everything typed there is said to the NPC).
  if (!w.combat?.active && !w.scene?.dialogue) {
    const traded = tryTrade(w, text);
    if (traded) return traded;
  }

  // P-68 — "I drink the healing potion" out of combat: consume the item,
  // apply its effect. In combat the escape resolver owns the bottle (it
  // costs the action there, RAW).
  if (!w.combat?.active && !w.scene?.dialogue) {
    const drank = tryUseConsumable(w, text);
    if (drank) return drank;
  }

  // P-69 — "I equip the sword of morning" / "wear the chain mail" / "put on
  // the ring": gear you carry becomes gear you use, and the DM tells you what
  // changed (attack line, AC).
  if (!w.combat?.active && !w.scene?.dialogue) {
    const geared = tryEquipItem(w, text);
    if (geared) return geared;
  }

  // P-77 — "I identify the humming blade" / "pay the sage to name it" /
  // "I attune to Greyfang": mysteries open for an hour or a fee; the old and
  // the named bond at the cost of an hour, three bonds to a soul.
  if (!w.combat?.active && !w.scene?.dialogue) {
    const known = tryIdentify(w, text);
    if (known) return known;
    const bonded = tryAttune(w, text);
    if (bonded) return bonded;
  }

  if (!w.combat?.active && !w.scene?.dialogue) {
    const examined = tryExamineTarget(w, text);
    if (examined) {
      return { world: w, output: { narration: `Wizard: ${examined}`, mechanics: 'observe only — no roll, state unchanged' } };
    }
  }

  // Surface-only exploration: list adjacent map nodes deterministically (no roll, no tick, no timeline).
  // Skipped when combat is active — during a fight, everything routes through the combat resolver.
  if (!w.combat?.active && isExploreIntent(text)) {
    if (w.scene?.interior) {
      const view = getInteriorView(w);
      const labels = exitDirectionLabels(view);
      const where = w.scene?.location ? `this corner of ${w.scene.location}` : 'the room';
      const exitsTxt = labels.length
        ? (labels.length === 1 ? `The only way on lies ${labels[0]}.` : `Ways lead off ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}.`)
        : `No way out shows itself — not yet.`;
      const lookRng = makeRng(seedFromString(`${w.meta.seed}|look|${w.timeline.length}|${where}`));
      const lead = lookRng.pick([
        `You take the measure of ${where}.`,
        `Your eyes move slow across ${where}.`,
        `You stand still and read ${where}.`
      ]);
      return { world: w, output: { narration: `Wizard: ${lead} ${exitsTxt} What do you do?`, mechanics: 'observe only — no roll, state unchanged' } };
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
  // Never while a fight is live — a bare direction mid-combat must not walk the
  // player out of the encounter (escape combat has no flee by design; the input
  // falls through to the combat branch instead).
  if (!w.scene?.interior && !w.combat?.active && isFreeMovementIntent(text)) {
    // v20 free-roam: the overworld is walked one tile at a time. A bare cardinal
    // ("north", "go west", or a compass button) steps the avatar a single cell.
    // There is no teleport-to-named-place out here — the journey IS the gameplay,
    // so non-cardinal travel phrasing just asks which way to set off.
    const dir = directionFromText(String(text || '').toLowerCase());
    if (!dir) {
      // ── Stage C.2: DM-resolved named travel. "I head to the Old Shrine" runs
      // a journey to that place — never bounced back as "which way?". ──
      const destId = resolveNamedNeighbor(w, text);
      if (destId) {
        const m0 = ensureMap(w.map);
        const before = String(m0.currentNodeId || '');
        const fromNode = (w.map?.nodes || []).find(n => n && String(n.id) === before) || null;
        let w1 = moveToNode(w, destId);
        if (String(ensureMap(w1.map).currentNodeId || '') === destId && destId !== before) {
          const destNode0 = (w1.map?.nodes || []).find(n => n && String(n.id) === destId) || null;
          // Distance + time elapsed by the journey (tracked in world.time).
          const leagues = legLeagues(fromNode, destNode0);
          const hours = leagues; // ~1 league/hour on foot
          w1 = { ...w1, time: { ...(w1.time || {}), turn: (w1.time?.turn ?? 0) + 1, hours: (w1.time?.hours ?? 0) + hours, leagues: (w1.time?.leagues ?? 0) + leagues } };
          // Arrival pipeline (mirror of the directional-arrival branch).
          w1 = applyGeneratedStructuresForNode(w1, destId);
          const arrN = w1.map?.nodes?.find(n => n && n.id === destId) || null;
          if (arrN?.nodeType === 'settlement' && !arrN.settlement?.decompressed) {
            w1 = decompressAndCanonizeSync(w1, destId, pack);
          }
          const here = w1.map?.nodes?.find(n => n && n.id === destId) || null;
          const nextName = cleanPlaceName(here?.name);
          if (nextName) w1 = { ...w1, scene: { ...w1.scene, location: nextName } };
          w1 = setPrimaryPartyZone(w1, 'near');
          w1 = pushEvent(w1, { kind: 'travel', data: { from: before, to: destId, intent: String(text || '') } });
          const travelMove = { actorId: 'party', intentText: String(text || ''), approachTag: 'survival', stakeTag: 'time' };
          w1 = appendRecentBeat(w1, buildBeatFromTurn(w1, text, travelMove, { outcome: 'success', mechanicsLine: '[travel | journey-arrive]' }));
          w1 = maybeCheckGoals(w1);
          // The journey may be set upon. Road-ish country → brigands/a toll (an
          // interactive encounter: pay/talk/slip/fight). Wild country → a beast ambush.
          const enc = maybeTravelEncounter(w1, before, ESCAPE_ENCOUNTER_CHANCE, nextName);
          w1 = enc.world;
          if (enc.kind === 'pending') {
            return { world: w1, output: { narration: brigandSceneLine(w1.travel.pending.foeName, nextName), mechanics: '[encounter:pending]' } };
          }
          const ambushed = Boolean(w1.combat?.active);
          const timeWord = travelTimeWord(hours);
          const flavor = here ? biomeFlavor(w1.meta.seed, here) : '';
          const arrivalLine = `Wizard: You set out, and after ${timeWord} you reach ${nextName || 'the place ahead'}${flavor ? `, ${flavor}` : ''}.`;
          if (ambushed) {
            // Surprise is contested: a wary/perceptive party catches the movement
            // in time; a distracted one is caught flat-footed and eats a free strike.
            const srng = makeRng(seedFromString(`${w1.meta.seed}|surprise|${destId}|${w1.timeline.length}`));
            const surprised = isSurprisedByAmbush(w1, srng);
            let lead, mech;
            if (surprised) {
              const sr = applySurpriseRound(w1, srng);
              w1 = sr.world;
              const blow = sr.beats.length ? ` ${sr.beats.join(' ')}` : '';
              lead = `${arrivalLine} You never saw them — something native to this country was lying in wait.${blow}`;
              mech = '[ambush | surprise]';
            } else {
              lead = `${arrivalLine} But you catch the movement at the edge of sight in time: something native to this country meant to take you unawares, and now you meet it ready.`;
              mech = '[ambush | spotted]';
            }
            return { world: w1, output: { narration: lead, mechanics: mech } };
          }
          // A clear journey may still have something on the road — a terrain-typed,
          // non-combat beat (observational; doesn't presume the player's choices).
          const beat = travelBeat(w1.meta.seed, here, w1.timeline.length);
          const ecoLine = here ? ecologyTravelLine(w1.meta.seed, biomeForNode(w1.meta.seed, here), w1.time?.turn ?? 0, destId) : '';
          const extra = beat || ecoLine; // prefer the journey beat when one fires
          const narration = extra ? `${arrivalLine} ${extra}` : arrivalLine;
          return { world: w1, output: { narration, mechanics: beat ? '[travel | journey-arrive | beat]' : '[travel | journey-arrive]' } };
        }
      }

      // ── Multi-hop: a KNOWN place a few hops away. Run the journey leg by leg —
      // each leg crosses terrain (its own ambush chance), and an interrupt leaves
      // you at a real node (never the void), so you can resume by travelling again. ──
      const farId = resolveNamedDestination(w, text);
      if (farId) {
        const originId = String(ensureMap(w.map).currentNodeId || '');
        const path = bfsPath(w.map, originId, farId, 8);
        if (path && path.length) {
          let w1 = w;
          let prevNode = (w.map?.nodes || []).find(n => n && String(n.id) === originId) || null;
          const farName = cleanPlaceName((w.map?.nodes || []).find(n => n && String(n.id) === farId)?.name) || 'your destination';
          let leagues = 0, stoppedAt = null, ambushed = false, pendingEnc = false;
          for (const legId of path) {
            const legNode = (w1.map?.nodes || []).find(n => n && String(n.id) === legId) || null;
            leagues += legLeagues(prevNode, legNode);
            const beforeLeg = prevNode ? String(prevNode.id) : originId;
            w1 = moveToNode(w1, legId);
            if (String(ensureMap(w1.map).currentNodeId || '') !== legId) break; // safety
            stoppedAt = legId;
            const enc = maybeTravelEncounter(w1, beforeLeg, MULTIHOP_LEG_CHANCE, farName); // road→brigands, wild→beast
            w1 = enc.world;
            if (enc.kind === 'pending') { pendingEnc = true; break; }
            if (w1.combat?.active) { ambushed = true; break; }
            prevNode = legNode;
          }
          const hours = leagues;
          w1 = { ...w1, time: { ...(w1.time || {}), turn: (w1.time?.turn ?? 0) + 1, hours: (w1.time?.hours ?? 0) + hours, leagues: (w1.time?.leagues ?? 0) + leagues } };
          const stopId = stoppedAt || originId;
          // Decompress + name wherever the journey actually stopped (arrival OR interrupt).
          w1 = applyGeneratedStructuresForNode(w1, stopId);
          const stopNode0 = (w1.map?.nodes || []).find(n => n && String(n.id) === stopId) || null;
          if (stopNode0?.nodeType === 'settlement' && !stopNode0.settlement?.decompressed) w1 = decompressAndCanonizeSync(w1, stopId, pack);
          const here2 = (w1.map?.nodes || []).find(n => n && String(n.id) === stopId) || null;
          const stopName = cleanPlaceName(here2?.name);
          if (stopName) w1 = { ...w1, scene: { ...w1.scene, location: stopName } };
          w1 = setPrimaryPartyZone(w1, 'near');
          w1 = pushEvent(w1, { kind: 'travel', data: { from: originId, to: stopId, intent: String(text || '') } });
          w1 = appendRecentBeat(w1, buildBeatFromTurn(w1, text, { actorId: 'party', intentText: String(text || ''), approachTag: 'survival', stakeTag: 'time' }, { outcome: 'success', mechanicsLine: '[travel | journey-arrive]' }));
          w1 = maybeCheckGoals(w1);
          const destNode = (w1.map?.nodes || []).find(n => n && String(n.id) === farId) || null;
          const destName = cleanPlaceName(destNode?.name) || 'your destination';
          if (pendingEnc && w1.travel?.pending) {
            return { world: w1, output: { narration: brigandSceneLine(w1.travel.pending.foeName, destName), mechanics: '[encounter:pending]' } };
          }
          const timeWord = travelTimeWord(hours);
          const afterWord = timeWord === 'a short way' ? 'A short way on' : `After ${timeWord} on the road`;
          const flavor = here2 ? biomeFlavor(w1.meta.seed, here2) : '';
          if (ambushed) {
            const srng = makeRng(seedFromString(`${w1.meta.seed}|surprise|${stopId}|${w1.timeline.length}`));
            const surprised = isSurprisedByAmbush(w1, srng);
            const where = (stopId === farId) ? `just short of ${destName}` : `near ${stopName}, still short of ${destName}`;
            if (surprised) {
              const sr = applySurpriseRound(w1, srng); w1 = sr.world;
              const blow = sr.beats.length ? ` ${sr.beats.join(' ')}` : '';
              return { world: w1, output: { narration: `Wizard: You set out for ${destName}. ${afterWord}, ${where}, you never see them — something native to this country was lying in wait.${blow}`, mechanics: '[ambush | surprise]' } };
            }
            return { world: w1, output: { narration: `Wizard: You set out for ${destName}. ${afterWord}, ${where}, you catch the movement in time and meet it ready: something native to this country meant to take you unawares.`, mechanics: '[ambush | spotted]' } };
          }
          const arrivalLine = `Wizard: You set out for ${destName}, and ${afterWord.toLowerCase()} you reach it${flavor ? `, ${flavor}` : ''}.`;
          const beat = travelBeat(w1.meta.seed, here2, w1.timeline.length);
          const ecoLine = here2 ? ecologyTravelLine(w1.meta.seed, biomeForNode(w1.meta.seed, here2), w1.time?.turn ?? 0, stopId) : '';
          const extra = beat || ecoLine;
          return { world: w1, output: { narration: extra ? `${arrivalLine} ${extra}` : arrivalLine, mechanics: beat ? '[travel | journey-arrive | beat]' : '[travel | journey-arrive]' } };
        }
      }

      // No reachable place by that name. A DM clarifies in fiction and names the
      // real roads — it does not bounce the player back to a bare compass prompt.
      const mE = ensureMap(w.map);
      const ex = exitsFrom(mE, String(mE.currentNodeId || ''));
      const exitNames = ['north', 'east', 'south', 'west'].map(d => {
        const id = ex?.[d]; if (!id) return null;
        const n = (w.map?.nodes || []).find(x => x && String(x.id) === String(id)) || null;
        const nm = cleanPlaceName(n?.name);
        return nm ? `${nm} to the ${d}` : null;
      }).filter(Boolean);
      if (looksLikeNamedDestination(text)) {
        const roads = exitNames.length
          ? `From here the roads lead to ${joinNames(exitNames)}.`
          : `No roads lead anywhere you'd know from here.`;
        return { world: w, output: { narration: `Wizard: You know of no such place hereabouts. ${roads} Where will you make for?`, mechanics: '' } };
      }
      const roads = exitNames.length ? ` The roads lead to ${joinNames(exitNames)}.` : '';
      return { world: w, output: { narration: `Wizard: Which way will you set off${roads ? ',' : ''}${roads}`, mechanics: '' } };
    }

    const m0 = ensureMap(w.map);
    const fromPos = { x: m0.pos.x, y: m0.pos.y };
    const beforeNodeId = String(m0.currentNodeId || '');
    const toPos = stepCell(fromPos, dir);

    // Take the step: the avatar now stands on toPos. Whether that's a named
    // place or open country is decided next. A hop across open country costs
    // an hour and a league — the clock moves when you do (named journeys
    // already account their own hours; this covers free-roam steps).
    let w1 = {
      ...w,
      map: { ...m0, pos: toPos },
      time: { ...(w.time || {}), hours: (w.time?.hours ?? 0) + 1, leagues: (w.time?.leagues ?? 0) + 1 }
    };

    // Anything newly within sight is revealed (icons pop onto the map as you roam).
    const landed = nodeAtCell(w1.map, toPos.x, toPos.y);
    const newlySighted = [];
    for (const n of nodesWithinSight(w1.map, toPos, SIGHT_RADIUS)) {
      if (landed && String(n.id) === String(landed.id)) continue;
      if (ensureMap(w1.map).discovered.includes(String(n.id))) continue;
      newlySighted.push(n);
      w1 = seeNode(w1, n.id);
    }

    if (landed) {
      // ── Arrival at a named node — run the existing node-entry pipeline. ──
      const nodeId = String(landed.id);
      w1 = visitNode({ ...w1, map: { ...ensureMap(w1.map), currentNodeId: nodeId } }, nodeId);
      w1 = applyGeneratedStructuresForNode(w1, nodeId);
      // Decompress settlement on arrival (generates NPCs, history, buildings).
      const arrNode = w1.map?.nodes?.find(n => n && n.id === nodeId) || null;
      if (arrNode?.nodeType === 'settlement' && !arrNode.settlement?.decompressed) {
        w1 = decompressAndCanonizeSync(w1, nodeId, pack);
      }
      const here = w1.map?.nodes?.find(n => n && n.id === nodeId) || null;
      const nextName = String(here?.name || '').trim();
      if (nextName) w1 = { ...w1, scene: { ...w1.scene, location: nextName } };
      w1 = setPrimaryPartyZone(w1, 'near');
      w1 = pushEvent(w1, { kind: 'travel', data: { from: beforeNodeId, to: nodeId, intent: String(text || '') } });
      const travelMove = { actorId: 'party', intentText: String(text || ''), approachTag: 'survival', stakeTag: 'time' };
      const travelResult = { outcome: 'success', mechanicsLine: '[travel | overworld-arrive]' };
      w1 = appendRecentBeat(w1, buildBeatFromTurn(w1, text, travelMove, travelResult));
      w1 = maybeCheckGoals(w1);
      // Arriving may trigger an ambush — but never on the winning tile
      // (maybeCheckGoals would have locked the escape ending above).
      w1 = maybeSpawnEscapeEncounter(w1, beforeNodeId);
      const ambushed = Boolean(w1.combat?.active);
      // Reaching a refuge in escape mode: catch your breath, recover some HP.
      if (!ambushed && w1.meta?.mode === 'escape') {
        const restRng = makeRng(seedFromString(`${w1.meta.seed}|shortRest|${nodeId}|${w1.timeline.length}`));
        w1 = shortRest(w1, restRng);
      }
      // Living-World P1: arrival reflects the land's biome, so the world reads as
      // varied country rather than interchangeable nodes.
      const arrivedNode = (w1.map?.nodes || []).find(n => n && n.id === nodeId) || null;
      const flavor = arrivedNode ? biomeFlavor(w1.meta.seed, arrivedNode) : '';
      const arrivalLine = nextName
        ? `Wizard: You reach ${nextName}${flavor ? `, ${flavor}` : ''}.`
        : `Wizard: You reach the place ahead${flavor ? `, ${flavor}` : ''}.`;
      // Living-World P3: a quiet arrival may note the land's living state (sparse
      // by design). Never on an ambush — danger shouldn't be buried under flavor.
      const ecoLine = (!ambushed && arrivedNode)
        ? ecologyTravelLine(w1.meta.seed, biomeForNode(w1.meta.seed, arrivedNode), w1.time?.turn ?? 0, nodeId)
        : '';
      const narration = ambushed
        ? `${arrivalLine} Something is already here, and it means you harm.`
        : (ecoLine ? `${arrivalLine} ${ecoLine}` : arrivalLine);
      return { world: w1, output: { narration, mechanics: ambushed ? '[ambush]' : '' } };
    }

    // ── Open country between named places — no currentNodeId out here. ──
    w1 = { ...w1, map: { ...ensureMap(w1.map), currentNodeId: '' } };
    const locWord = wildernessWord(w1.meta?.seed, toPos);
    w1 = { ...w1, scene: { ...w1.scene, location: locWord } };
    w1 = setPrimaryPartyZone(w1, 'near');
    w1 = pushEvent(w1, { kind: 'travel', data: { from: beforeNodeId, to: '', intent: String(text || '') } });
    const wildMove = { actorId: 'party', intentText: String(text || ''), approachTag: 'survival', stakeTag: 'time' };
    const wildResult = { outcome: 'success', mechanicsLine: '[travel | overworld-step]' };
    w1 = appendRecentBeat(w1, buildBeatFromTurn(w1, text, wildMove, wildResult));

    // Wandering the open country carries a per-tile risk of being set upon.
    w1 = maybeSpawnWildEncounter(w1, toPos);
    const ambushed = Boolean(w1.combat?.active);

    let narration = `Wizard: You press ${dir} into ${locWord}.`;
    if (ambushed) {
      // Under attack — the sighting aside would only muddy the moment.
      narration += ' The ground gives no warning before something is upon you.';
      return { world: w1, output: { narration, mechanics: '[ambush]' } };
    }
    if (newlySighted.length) {
      // Spotting a new place is the headline of the step — an evocative pull
      // toward the dim dot that just appeared on the map.
      const line = sightingLine(w1.meta?.seed, toPos, newlySighted[0]);
      if (line) narration += ` ${line}`;
    } else {
      // Quiet tile: maybe a little weather/atmosphere so empty country breathes.
      const mood = wildAtmosphere(w1.meta?.seed, toPos);
      if (mood) narration += ` ${mood}`;
    }
    return { world: w1, output: { narration, mechanics: '' } };
  }

  const actorId = (w.party?.[0]?.id) ? String(w.party[0].id) : 'party';

  // NPC dialogue entry: "talk to X" / "speak to X" / "approach X" begins a
  // canonical dialogue mode with an NPC at the current settlement. If no NPC
  // resolves, fall through to generic resolution (preserves legacy behavior
  // for intents like "I talk to whoever is watching").
  // Dialogue cannot begin mid-combat (the world invariant forbids combat.active
  // and scene.dialogue coexisting). When fighting, a "talk to X" intent falls
  // through to the combat turn rather than crashing. See prose-playtest finding.
  const talkRef = !w.combat?.active ? extractDialogueRef(text) : null;
  if (talkRef) {
    // "Talk to someone" with no name: a real DM doesn't roll dice at a vague
    // intention — they name who's actually here and ask who you mean.
    if (/^(?:someone|anyone|somebody|anybody|people|folk|locals?|a local|villagers?|them|him|her)$/i.test(talkRef.trim())) {
      const hereNode = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
      // Hostiles don't make the social roster — you greet neighbors, not
      // the bandit casing the well.
      const npcsHere = (hereNode?.settlement?.npcs || []).filter(n => n && !n.hostile).map(n => String(n?.name || '').trim()).filter(Boolean);
      if (npcsHere.length) {
        const names = npcsHere.slice(0, 4).join(', ');
        return {
          world: w,
          output: { narration: `Wizard: A few folk are about — ${names}. Who do you want to talk to?`, mechanics: '[clarify:who]' }
        };
      }
      return {
        world: w,
        output: { narration: 'Wizard: There\'s no one within earshot here. The road might fix that.', mechanics: '[clarify:who]' }
      };
    }
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
        // Skip the role suffix when the name already carries an epithet ("Dax the
        // Wary") OR is itself a bare title ("the scholar"), so we never read
        // "Dax the Wary the elder" or "the scholar the scholar".
        const role = (begun.outcome.npcRole && !/\bthe\b/i.test(String(begun.outcome.npcName || '')))
          ? ` the ${begun.outcome.npcRole}` : '';
        // Living-World P4: surface the person's WANT on meeting (most are small and
        // mundane), and — for the perceptive (WITS) — an unreliable tell when they
        // carry a deeper thread from the Discovery Layer. Realistic distribution:
        // most lead nowhere; a rare few hint at more.
        const npcNow = resolveNpcAtCurrentNode(w, talkRef);
        const wits = Number(w.party?.[0]?.stats?.WITS ?? 10);
        const arc = npcNow ? resolveArc(npcNow, w.meta.seed, { wits }) : null;
        const wantClause = arc?.surfaceWant ? ` There's a want in them, plain enough: ${arc.surfaceWant}.` : '';
        const tellClause = (arc?.status === 'hinted' && arc.tell) ? ` ${arc.tell}` : '';
        // Voice: the first impression carries the personality — how they
        // RECEIVE you is who they are (manner derives from npc personality).
        const atHome = Boolean(w.meta?.homeNodeId) && w.meta.homeNodeId === w.map?.currentNodeId;
        const alignId = String(w.party?.[0]?.sheet?.alignment?.id || '');
        const corruption = Number(w.meta?.soul?.corruption ?? 0);
        const isEvil = ['le', 'ne', 'ce'].includes(alignId) || corruption >= 2;
        const openerByManner = {
          guarded: " They don't step closer, and they don't ask your name.",
          skittish: ' They startle slightly before settling, hands finding one another.',
          blunt: " They size you up in one pass and don't pretend otherwise.",
          open: ' "Well now," they say, already half-smiling.',
          even: ''
        };
        const homeEvilOpener = ' A beat of silence. Then a small, weary exhale.';
        const manner = npcNow ? voiceManner(npcVoice(npcNow)) : 'even';
        let opener;
        if (atHome && isEvil) {
          opener = homeEvilOpener;
        } else {
          opener = npcNow ? (openerByManner[manner] || '') : '';
        }
        const eyeDesc = atHome && isEvil ? 'flat' : begun.outcome.mood;
        return {
          world: w,
          output: {
            narration: `Wizard: You approach ${begun.outcome.npcName}${role}; ${eyeDesc} eyes meet yours.${opener}${wantClause}${tellClause}`,
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
  // In escape mode the deep spell system is parked: cantrips are resolved by the
  // escape combat resolver (which parses "fire bolt" / "cast fire bolt" itself),
  // so skip this branch entirely and let the input fall through to combat.
  if (w.meta?.mode !== 'escape') {
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

      // Living-World P5: the hidden Will bends casting. Deeds shape which schools
      // answer the caster — surfaced only as feel, never a readout. (Opt-in flag
      // already built into castSpell; this turns it on for the live game.)
      const { world: wCast, result: castResult } = castSpell(w, {
        spellRef,
        targetId,
        slotLevel: null,
        will: true
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
    // v1 Escape: classic-D&D combat. Any combat input resolves one round via
    // the simple HP resolver; the deep wound/stress engine is bypassed. No
    // flee — the journey's stakes are the point.
    if (w.meta?.mode === 'escape') {
      // ── The table-talk gate (DM TEST). A question, a pause, or a "wait" is
      // NOT an attack — answer it for free; the round holds. Without this,
      // the resolver's strike-default makes "what are my options?" swing a
      // sword.
      if (isNullAction(text)) {
        return {
          world: w,
          output: { narration: 'Wizard: The moment hangs — blades up, breath held. Take your time.', mechanics: '[combat:table-talk]' }
        };
      }
      // A question gets answered — unless it's a parley phrased as a question
      // ("can we talk about this?" is said TO the foes, not to the DM).
      const escVerb = parseEscapeAction(text).verb;
      const explicitAction = /\b(strike|attack|swing|stab|shoot|slash|smite|fireball|blast|cast|rage|surge|guard|ward|cover)\b/i.test(String(text || ''));
      if (isMetaQuestion(text) || (isQuestionShaped(text) && escVerb !== 'parley' && !explicitAction)) {
        const metaAnswer = isMetaQuestion(text) ? handleMetaQuestion(text, w) : null;
        let answer = metaAnswer || combatStatusAnswer(w);
        // "Look around" mid-fight: the steel comes first, the scenery second.
        if (metaAnswer && /\b(where am i|look|around|see)\b/i.test(String(text || ''))) {
          answer = `${combatStatusAnswer(w)} Beyond the fight: ${metaAnswer}`;
        }
        return {
          world: w,
          output: { narration: `Wizard: ${answer}`, mechanics: '[combat:table-talk]' }
        };
      }
      // Movement or flight mid-fight is not a strike. Escape-mode fights
      // can't be fled (the journey's stakes are the point) — the DM says so
      // in voice instead of letting the resolver swing your sword for you.
      if (!explicitAction && (isFleeIntent(text) || isFreeMovementIntent(text))) {
        return {
          world: w,
          output: { narration: 'Wizard: There\'s steel between you and the road — no running from this one. Strike, guard, cast, or talk.', mechanics: '[combat:table-talk]' }
        };
      }
      // Resting mid-fight gets the obvious ruling, not a sword swing.
      if (!explicitAction && isLongRestIntent(text)) {
        return {
          world: w,
          output: { narration: 'Wizard: Not while something is trying to kill you. Finish this first.', mechanics: '[combat:table-talk]' }
        };
      }
      const { world: wAfter, result } = resolveEscapeCombatTurn(w, String(text || ''));
      w = wAfter;
      const escMove = { actorId, intentText: String(text || ''), approachTag: 'force', stakeTag: 'survival' };
      const escResult = { outcome: result.outcome, mechanicsLine: result.mechanicsLine };
      w = appendRecentBeat(w, buildBeatFromTurn(w, text, escMove, escResult));
      w = pushEvent(w, {
        kind: 'resolution',
        data: { actorId, intent: String(text || ''), text: String(text || ''), roll: 0, dc: 0, outcome: result.outcome, updateKind: 'combat', combatSummary: String(result.combatSummary || '') }
      });
      const narr = result.combatSummary ? `Wizard: ${result.combatSummary}` : 'Wizard: You trade blows.';
      return { world: w, output: { narration: narr, mechanics: result.mechanicsLine, combatSummary: String(result.combatSummary || ''), beats: Array.isArray(result.beats) ? result.beats : [] } };
    }

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

    return { world: w, output: { narration: ABSTRACT_FLOOR_RE.test(composed.narrationLine) ? combatGroundedOutcome(w, result.targetEnemyName, result.outcome) : composed.narrationLine, mechanics: result.mechanicsLine, combatSummary: String(result.combatSummary || '') } };
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
        return { world: w, output: { narration: ABSTRACT_FLOOR_RE.test(composed.narrationLine) ? combatGroundedOutcome(w, result.targetEnemyName, result.outcome) : composed.narrationLine, mechanics: result.mechanicsLine, combatSummary: String(result.combatSummary || '') } };
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
        return { world: w, output: { narration: ABSTRACT_FLOOR_RE.test(composed.narrationLine) ? combatGroundedOutcome(w, result.targetEnemyName, result.outcome) : composed.narrationLine, mechanics: result.mechanicsLine, combatSummary: String(result.combatSummary || '') } };
      }
    }
  }

  // "No one to fight": an attack aimed at a person/creature when none is here.
  // Reached only after the attack-NPC branches above failed to start a fight, so
  // if there were someone to fight, combat would already be live. Scoped to
  // person/creature references (or a bare attack verb) so object attacks like
  // "break the door" still fall through to the physical-interaction handler below.
  if (!w.combat?.active && !w.ending?.locked) {
    const tt = String(text || '').trim();
    const ATTACK_V = '(attack|fight|kill|strike|assault|punch|stab|hit|slash|swing(?:\\s+at)?|shoot|kick|tackle|charge)';
    const targeted = tt.match(new RegExp(`\\b${ATTACK_V}\\s+(.+)`, 'i'));
    const bareAttack = new RegExp(`^${ATTACK_V}\\s*[.!]?$`, 'i').test(tt);
    const personRef = targeted && /\b(figure|figures|enemy|enemies|foe|foes|man|woman|men|women|person|people|stranger|strangers|guard|guards|soldier|soldiers|them|him|her|someone|anyone|everyone|nobody|creature|creatures|beast|beasts|monster|monsters|attacker|assailant|thing|shape|shadow|biggest|big one|nearest)\b/i.test(targeted[2]);
    // Combat-feature verbs and "strongest attack" out of combat are the same
    // case: there's no fight to spend them on. A real DM says so — no d20 at
    // an empty road. (In combat these route to the resolver and FIRE.)
    const featureOutOfCombat = /^\s*(?:i\s+)?(?:rage|enrage|go\s+berserk|action\s+surge|surge|second\s+wind|rally|smite|reckless(?:\s+attack)?|breathe?\s*(?:fire|frost|acid|lightning|poison)?|lay\s+on\s+hands)\s*[.!]?\s*$/i.test(tt)
      || /\b(strongest|hardest|best)\s+(attack|hit|blow)|with everything\b/i.test(tt);
    if (bareAttack || personRef || featureOutOfCombat) {
      const nodeNow = (w.map?.nodes || []).find(n => n && n.id === String(w.map?.currentNodeId ?? '')) || null;
      const npcsHere = nodeNow?.settlement?.npcs;
      if (featureOutOfCombat || !Array.isArray(npcsHere) || !npcsHere.length) {
        const line = featureOutOfCombat
          ? 'Wizard: Save it — there\'s no fight here to spend that on. It\'ll be ready when one finds you.'
          : 'Wizard: No one to fight. What do you do?';
        return { world: w, output: { narration: line, mechanics: '[no-target]' } };
      }
    }
    // Looting the dead: victory loot is distributed when the fight ends, so
    // "loot the bodies" afterward must not roll dice and claim you "stow the
    // bodies". The fallen were picked clean at the moment of victory.
    if (/\b(loot|search|strip|check|rifle)\b.*\b(bod(?:y|ies)|corpses?|the dead|the fallen|remains)\b/i.test(tt)) {
      return {
        world: w,
        output: { narration: 'Wizard: You already went through them when the dust settled — anything worth taking is in your pack.', mechanics: 'observe only — no roll, state unchanged' }
      };
    }
  }

  // Crotchety-DM repair: a ridiculous statement (eat the sun, "my sword of infinite
  // power", "I'm the DM now", "give me 1000 gold") gets a dry, sarcastic DM comeback —
  // not a d20. A real DM clocks the absurdity and resolves it in the fiction as a
  // no-effect, instead of the dice reporting "success" while the narration (rightly)
  // says nothing happened. Placed before physics/trivial/social so a boasted "sword of
  // infinite power" gets the quip rather than a quiet "you draw the Worn Blade".
  if (!w.combat?.active) {
    const ridiculous = tryRidiculous(w, text);
    if (ridiculous) return ridiculous;
  }

  // P-72 — building: "I spend two days raising a lean-to". Stockpile + days +
  // labor → a persistent shelter that improves rest. One check gates QUALITY;
  // the world ticks while you work; an honest answer when the pile's short.
  // Placed before salvage/craft so a known build noun is claimed first.
  if (!w.combat?.active && !w.scene?.dialogue) {
    const built = tryBuild(w, text);
    if (built) return built;
  }

  // P-79 — downtime: "I spend a week training / researching / carousing".
  // After tryBuild so "spend a week raising a palisade" stays construction.
  if (!w.combat?.active && !w.scene?.dialogue) {
    const passed = tryDowntime(w, text);
    if (passed) return passed;
  }

  // P-70 — salvage: a destructive intent aimed at a whole object breaks it
  // down for MATERIALS (typed, stackable). "Rip the leg off the table" still
  // goes to the physics part-extraction below; "smash the crate" comes here.
  if (!w.combat?.active && !w.scene?.dialogue) {
    const salvaged = trySalvage(w, text);
    if (salvaged) return salvaged;
  }

  // P-71 — field crafting: "I make a torch from a board and a strip of cloth".
  // One check gates QUALITY, never possibility; time always passes; the DM
  // says what was made and how well.
  if (!w.combat?.active && !w.scene?.dialogue) {
    const crafted = tryCraft(w, text);
    if (crafted) return crafted;
  }

  // Physical interaction intercept: "examine the table", "break the chair",
  // "take the lantern". Three guards prevent hijacking generic combat moves
  // like "force the locked door":
  //   1. The player text must contain a physics verb (examine/break/take/etc.)
  //   2. Detection must match a furniture/item name (not just a notes substring)
  //   3. The offline fallback must produce real deltas (not a no-op)
  //
  // Force verbs (rip/break/smash/etc.) additionally roll d20 vs hardness-derived
  // DC so the dice roller fires. Outcome gates the delta application:
  //   success → full damage (all deltas)
  //   mixed   → state change only (no item extraction)
  //   failure → no furniture change, but still loud
  const PHYSICS_VERB_RE = /\b(examine|inspect|search|look at|check|rip|break|smash|tear|kick|punch|shatter|take|grab|pick up|steal|light|ignite|set fire|torch|kindle|burn|hide\s+behind|duck\s+behind|crouch\s+behind|brace\s+against|shelter\s+behind|press\s+against|take\s+cover)\b/i;
  const FORCE_VERB_RE   = /\b(rip|break|smash|tear|kick|punch|shatter)\b/i;
  if (PHYSICS_VERB_RE.test(String(text || ''))) {
    const detection = detectPhysicalInteraction(w, text);
    const nameMatch = (detection.matches || []).some(m => m.match === 'name' || m.match === 'part');
    if (detection.detected && nameMatch) {
      const physics = evaluatePhysicsSync(w, text);
      if (physics && physics.plausible) {
        const isForce = FORCE_VERB_RE.test(String(text || ''));
        let appliedDeltas = physics.deltas ? [...physics.deltas] : [];
        let mechStr;
        let physicsDesc = physics.description;

        if (isForce) {
          const check = rollPhysicsCheck(w, {
            actorId,
            hardness: physics.hardness ?? 2,
            intentText: String(text || '')
          });

          if (check.outcome === 'mixed') {
            // Partial: state change recorded, no item drops
            appliedDeltas = appliedDeltas.filter(d => d.op !== 'createItem');
            const MIXED_SUFFIX = {
              glass: 'The scatter goes wider than you meant.',
              iron:  'You strained for it — the iron bent but wouldn\'t fully give.',
              cloth: 'Not as clean as you wanted.',
              wood:  'You had to really work it.',
              stone: 'Your strike glances, barely answering.'
            };
            const mixedSuffix = MIXED_SUFFIX[physics.material] || 'Not a clean hit, but it lands.';
            physicsDesc = physicsDesc.replace(/[.\s]+$/, '') + '. ' + mixedSuffix;
          } else if (check.outcome === 'failure') {
            // Fumble: object holds, just noise
            appliedDeltas = [];
            const targetName = (detection.matches[0]?.name || 'object').toLowerCase();
            const FAILURE_LINES = [
              `Your blow glances off. The ${targetName} doesn't budge.`,
              `Not enough — the ${targetName} takes it and holds.`,
              `You swing hard. The ${targetName} shudders but doesn't give.`
            ];
            physicsDesc = FAILURE_LINES[check.rawDie % FAILURE_LINES.length];
          }

          // Noise: rulings library already computed noiseBy for this material;
          // failure is messier (clumsy swing still makes sound)
          const noiseBase = typeof physics.noiseBy === 'number' ? physics.noiseBy : 2;
          const noiseBy = check.outcome === 'failure' ? noiseBase + 1 : noiseBase;
          if (noiseBy > 0) {
            appliedDeltas.push({ op: 'env', key: 'noise', by: Math.min(3, noiseBy) });
          }

          mechStr = check.mechanicsLine;
        } else {
          // Non-force physics (examine, take) — no roll
          const matchSummary = detection.matches.map(m => m.name).filter(Boolean).slice(0, 2).join(', ');
          mechStr = `[physics:${matchSummary || 'object'} | deltas:${appliedDeltas.length} | offline]`;
        }

        w = applyDeltas(w, appliedDeltas);

        // Canon log: record ruling for force actions that mutated the world,
        // and for cover actions (position change is a canonical ruling)
        const isCover = String(physics.verbClass || '') === 'cover';
        if ((isForce && appliedDeltas.some(d => d.op === 'modifyFurniture' || d.op === 'removeFurniture'))
          || (isCover && appliedDeltas.some(d => d.op === 'position'))) {
          const fMatch = detection.matches.find(m => m.type === 'furniture');
          const targetId = `${(w.map && w.map.currentNodeId) || 'node'}:furniture:${fMatch?.index ?? 0}`;
          const rulingId = `dm.ruling:${w.meta?.seed || ''}:${(w.timeline || []).length}`;
          const cl = w.canonLog && typeof w.canonLog === 'object' ? w.canonLog : { events: [] };
          w = { ...w, canonLog: appendCanonEvent(cl, { id: rulingId, type: 'dm.ruling', targetId }) };
        }

        // Emit a 'resolution' event so deterministic replay re-executes this physics path.
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
            deltaCount: appliedDeltas.length
          }
        });

        return {
          world: w,
          output: {
            narration: physicsDesc,
            mechanics: mechStr
          }
        };
      }
    }
  }

  // Trivial-intent gate: everyday physical actions auto-succeed without a roll.
  // Placed after all specific gates (dialogue, interior, explore, movement, spells,
  // combat, physics) but before the general resolveMove() fallthrough.
  // isTrivialIntent keeps the original "I …" boolean contract; classifyTrivial
  // additionally recognizes bare imperatives ("open the crate", "draw my sword")
  // and yields grounded, object-aware prose instead of "You do so without
  // difficulty." Skill verbs (lock/force/pry/climb…) are deliberately excluded
  // so they still roll — see UX2 roll-classification.
  // Stage D: open/close a real furniture piece here mutates + persists its state
  // (an opened crate stays open). Falls through to the trivial gate for non-furniture
  // targets ("open the door" when no such piece is present).
  {
    const fsc = tryFurnitureStateChange(w, text);
    if (fsc) return fsc;
  }

  if (isTrivialIntent(text) || classifyTrivial(text)) {
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
    return { world: w, output: { narration: `Wizard: ${trivialNarration(w, text)}`, mechanics: 'trivial action — no roll, auto-success' } };
  }

  // ── Stage B: argued social adjudication. An influence attempt at an NPC
  // (intimidate/charm/deceive/persuade — by verb or by what you say) is resolved
  // against that NPC's personality, before falling to the generic resolver. Plain
  // "talk to X" already opened dialogue above; this is for trying to SWAY someone. ──
  if (!w.combat?.active && !w.scene?.dialogue) {
    const social = resolveSocialAdjudication(w, text);
    if (social) return social;
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
  // (In escape mode this also locks the victory ending — see maybeCheckGoals.)
  w = maybeCheckGoals(w);

  // Open sandbox: emergent ending check (deterministic by state). Escape mode
  // benches emergent endings — its only outcomes are escape-win (maybeCheckGoals)
  // and combat-defeat (combatResolve).
  if (w.meta?.mode !== 'escape') {
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
  }

  const composed = compose(w, text, resolution, { pack });

  w = applyComposerDelta(w, composed.ledgerDelta);

  // Stage B: ground the floor. For a resolved PHYSICAL action against an object,
  // override the composer's abstract narration with outcome-aware prose that names
  // the thing and says what happened (success/mixed/failure). Everything else keeps
  // the composer line. (Keeps composed.ledgerDelta either way.)
  const grounded = physicalObjectOutcome(w, text, result.outcome) || nonObjectSkillOutcome(text, result.outcome);
  // Stage F: if the composer would fall to the abstract literary floor, replace it with
  // grounded, outcome-aware prose (a DM never says "a low hum threads through the walls"
  // for a resolved action). Specific handlers still win; good composer lines pass through.
  const base = composed.narrationLine;
  const narration = grounded || (ABSTRACT_FLOOR_RE.test(base) ? genericGroundedOutcome(w, text, result.outcome) : base);

  // Strict output discipline: 1 narration line + 1 bracket line.
  return { world: w, output: { narration, mechanics: result.mechanicsLine } };
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
    const biome = node ? biomeForNode(w.meta.seed, node) : null;
    const creatures = selectCreatures(encounterEval.cr, encounterEval.count, region, encounterRng, biome);
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
  // Single-letter compass tokens must not match after an apostrophe — an
  // apostrophe is a word boundary, so "what's"/"it's"/"let's" used to read
  // as the compass "s" and misroute conversation into travel.
  return /\b(travel|leave|exit|head to|go to|move to|escape|journey|walk to|go north|go south|go east|go west|north|south|east|west)\b/.test(t)
    || /(?<!['’])\b(n|s|e|w)\b/.test(t);
}

// Deterministic flavor for a wilderness cell (no named node here). Seeded by
// world seed + cell, so it's stable under replay and identical browser/server.
function wildernessWord(seed, pos) {
  const x = Number.isInteger(pos?.x) ? pos.x : 0;
  const y = Number.isInteger(pos?.y) ? pos.y : 0;
  const rng = makeRng(seedFromString(`${String(seed || 'seed')}|wild|${x}|${y}`));
  const words = [
    'open country',
    'windswept flats',
    'a lonely stretch of road',
    'wild grassland',
    'the empty wilds',
    'a quiet hollow'
  ];
  return rng.pick(words) || 'open country';
}

// Evocative one-liner for a place spotted from afar. Turns a dim dot on the map
// into a pull — a reason to set off toward it. Deterministic from seed + node so
// the same ridge always reveals the same silhouette under replay. We only know
// the node's name and kind out here (it isn't decompressed until you arrive), so
// the line hints at presence and bearing, never invents facts about the place.
function sightingLine(seed, fromPos, node) {
  const name = String(node?.name || '').trim();
  const bearing = cardinalToCell(fromPos, { x: node.x, y: node.y });
  if (!name || !bearing) return '';
  const rng = makeRng(seedFromString(`${String(seed || 'seed')}|sight|${String(node.id)}`));
  const isTown = String(node?.nodeType) === 'settlement';
  const townBank = [
    `To the ${bearing}, smoke threads up from ${name}.`,
    `${cap(bearing)}ward, the rooftops of ${name} catch the light.`,
    `Far to the ${bearing} you make out the walls of ${name}.`,
    `A scatter of lamplight to the ${bearing} — that would be ${name}.`
  ];
  const landmarkBank = [
    `To the ${bearing}, a shape breaks the skyline: ${name}.`,
    `${cap(bearing)}ward, ${name} hunches against the land.`,
    `Something stands out to the ${bearing} — ${name}, if the maps are right.`,
    `Far off to the ${bearing}, ${name} draws the eye.`
  ];
  return rng.pick(isTown ? townBank : landmarkBank) || `To the ${bearing} you make out ${name}.`;
}

// Occasional atmosphere for an otherwise-empty wild step — keeps the open road
// from reading the same sentence every tile. Pure narration, deterministic by
// cell, ~1 step in 3. Returns '' most of the time.
function wildAtmosphere(seed, pos) {
  const x = Number.isInteger(pos?.x) ? pos.x : 0;
  const y = Number.isInteger(pos?.y) ? pos.y : 0;
  const rng = makeRng(seedFromString(`${String(seed || 'seed')}|wildmood|${x}|${y}`));
  if (rng.nextFloat() >= 0.34) return '';
  const bank = [
    'A cold wind worries at your cloak.',
    'Somewhere ahead, crows lift and wheel.',
    'The grass hisses, bending all one way.',
    'Your boots find an old rut worn by other feet.',
    'The light is going; shadows lean long.',
    'Nothing moves but the weather.',
    'A bird you cannot name calls once, then stops.',
    'The quiet out here has a weight to it.'
  ];
  return rng.pick(bank) || '';
}

function cap(s) {
  const str = String(s || '');
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}

// Stage C.2 — DM-resolved named travel helpers.
// Did the player name a reachable place (a neighbor by name), as opposed to a
// bare direction? Returns the neighbor nodeId or null. No random fallback: a
// non-match means "you know of no such place", which the DM clarifies in fiction.
// Normalize apostrophe variants so "Trader's Camp" matches regardless of curly/straight.
function normName(s) { return String(s || '').toLowerCase().replace(/[‘’ʼ]/g, "'"); }

function resolveNamedNeighbor(world, text) {
  const w = world;
  const m = ensureMap(w.map);
  const here = String(m.currentNodeId || '');
  if (!here) return null;
  const t = normName(text);
  const nbs = neighbors(m, here);
  let best = null, bestLen = 0;
  for (const id of nbs) {
    const node = (m.nodes || []).find(n => n && String(n.id) === String(id)) || null;
    const name = normName(cleanPlaceName(node?.name)).trim();
    if (name && name.length > bestLen && t.includes(name)) { best = String(id); bestLen = name.length; }
  }
  return best;
}

// Resolve a named destination among places the player KNOWS (discovered nodes),
// not just direct neighbors — so "go to Trader's Camp" works even when it's a few
// hops away. Returns the nodeId or null. (Direct neighbors are handled separately.)
function resolveNamedDestination(world, text) {
  const w = world;
  const m = ensureMap(w.map);
  const here = String(m.currentNodeId || '');
  const t = normName(text);
  const known = new Set([...(Array.isArray(m.discovered) ? m.discovered.map(String) : [])]);
  let best = null, bestLen = 0;
  for (const node of (m.nodes || [])) {
    const id = String(node?.id || '');
    if (!id || id === here) continue;
    if (!known.has(id)) continue; // only places the player has seen/heard of
    const name = normName(cleanPlaceName(node?.name)).trim();
    if (name && name.length > bestLen && t.includes(name)) { best = id; bestLen = name.length; }
  }
  return best;
}

// Did the input look like an attempt to travel to a NAMED place (vs a bare
// direction or vague "go")? Used to choose an in-fiction clarification over the
// generic "which way?" prompt.
function looksLikeNamedDestination(text) {
  const t = String(text || '').toLowerCase().trim();
  return /\b(?:go|head|travel|journey|make|set\s+out|set\s+off)\s+(?:to|for|toward|towards|over\s+to)\b/.test(t)
    || /\b(?:to|toward|towards)\s+the\b/.test(t);
}

// Manhattan grid distance → leagues (min 1). The overworld grid is the unit; a
// hop is "a few leagues". Falls back to a sensible default when coords are absent.
function legLeagues(fromNode, toNode) {
  const ax = Number(fromNode?.x), ay = Number(fromNode?.y);
  const bx = Number(toNode?.x), by = Number(toNode?.y);
  if ([ax, ay, bx, by].every(Number.isFinite)) {
    return Math.max(1, Math.abs(ax - bx) + Math.abs(ay - by));
  }
  return 3;
}

// Stage C.2 slice 2 — surprise is CONTESTED. A perceptive/wary character is hard
// to surprise. Vigilance = WITS modifier + a bonus if the build reads as watchful
// (a scout/ranger/perception focus, a wary vibe, etc.). DC is the ambush's stealth.
const SURPRISE_DC = 8;
const VIGILANCE_RE = /\b(perceiv|percept|scout|surviv|alert|watch|wary|vigil|ranger|tracker|hunter|outrider|sentinel|guide|keen|sharp.?eyed|lookout|warden)\b/i;
function hasVigilanceSkill(pc) {
  if (!pc || typeof pc !== 'object') return false;
  const bag = [];
  if (Array.isArray(pc.foci)) bag.push(...pc.foci.map(String));
  bag.push(String(pc.archetype || ''), String(pc.vibe || ''));
  const tr = pc.traits || {};
  bag.push(String(tr.vibe || ''), String(tr.ideal || ''), String(tr.detail || ''));
  return VIGILANCE_RE.test(bag.join(' '));
}
// Returns true if the party is caught off guard by an ambush (failed the contest).
function isSurprisedByAmbush(world, rng) {
  const pc = world.party?.[0] || {};
  const witsMod = statMod(Number(pc.stats?.WITS ?? 10));
  const skillBonus = hasVigilanceSkill(pc) ? 3 : 0;
  const vigilance = rng.int(1, 20) + witsMod + skillBonus;
  return vigilance < SURPRISE_DC;
}

// Stage C.2 — non-combat travel beats. On a CLEAR journey (no ambush) the road
// sometimes has something on it: terrain-typed, observational color that doesn't
// presume the player's choices (interactive toll/parley beats are a later slice).
// Deterministic via a seeded pick; narration-only (no state change).
const TRAVEL_BEATS = {
  forest: [
    'Partway through, you cross fresh tracks pressed deep in the mud — something large passed not long ago, and you never see it.',
    'A figure watches from the treeline, still as the trunks, and is gone when you look twice.',
    'Old bones turn slowly on a low branch, strung up as a warning by someone who came before.'
  ],
  plains: [
    "A trader's cart rattles past the other way; the driver gives you a wary nod and rolls on without a word.",
    'You share the road a while with a lone traveler, who trades a scrap of news before parting at a fork.',
    'Wagon ruts and bootprints crowd the track here — others came this way recently, and in numbers.'
  ],
  marsh: [
    'Something slips beneath the black water as you pass, and the reeds go still.',
    'A will-o-glow drifts at the edge of the path; you keep your eyes on solid ground and let it be.'
  ],
  mountains: [
    'Wind funnels through the rocks like a voice — once you could swear it shaped your name.',
    'A cairn marks the way, one stone added by every traveler who made it this far. You add yours.'
  ],
  coastal: [
    'Gulls wheel and scream over something dead on the tideline; you give it a wide berth.',
    'A fisherman mending nets on the strand lifts a hand, then goes back to his knots.'
  ],
  desert: [
    'Heat-shimmer paints water that isn’t there across the horizon, always the same distance off.',
    'Bleached bones and a half-buried wheel mark where someone else’s luck ran dry.'
  ],
  arctic: [
    'Your breath cracks to frost on the air; the only tracks in the snow are old, and not quite human.',
    'The cold has a silence to it that makes you keep glancing back the way you came.'
  ],
  wilderness: [
    'The country here is trackless and watchful; twice you stop, sure you are followed, and find nothing.',
    'A ring of cold ash and gnawed bones marks someone else’s camp, long abandoned.'
  ]
};
const TRAVEL_BEAT_CHANCE = 0.4; // of clear (no-ambush) journeys

function travelBeat(seed, destNode, timeline) {
  const biome = destNode ? biomeForNode(seed, destNode) : 'wilderness';
  const pool = TRAVEL_BEATS[biome] || TRAVEL_BEATS.wilderness;
  const rng = makeRng(seedFromString(`${seed}|travelBeat|${String(destNode?.id || '')}|${timeline}`));
  if (rng.nextFloat() >= TRAVEL_BEAT_CHANCE) return '';
  return rng.pick(pool) || '';
}

// DM-natural phrasing for a travel duration (~1 league/hour on foot).
function travelTimeWord(hours) {
  const h = Math.max(1, Math.round(Number(hours) || 1));
  if (h <= 1) return 'a short way';
  if (h <= 3) return 'a few hours';
  if (h <= 6) return 'most of the morning';
  if (h <= 10) return 'the better part of a day';
  return 'more than a day';
}

function joinNames(items) {
  const a = items.filter(Boolean);
  if (a.length === 0) return '';
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(', ')}, and ${a[a.length - 1]}`;
}

// ── C.2d: interactive road encounters ──────────────────────────────────────
// On a journey leg, a road-ish stretch (plains/coastal/settlement) can be held by
// brigands/a toll — an encounter the player CHOOSES how to handle (pay/talk/slip/
// fight). Wild terrain keeps the beast ambush. Same seed/gate as the beast spawner
// so the danger RATE is unchanged; only the KIND differs by terrain. Returns
// { world, kind: 'pending' | 'combat' | 'none' }.
function maybeTravelEncounter(world, before, chance, destName) {
  const w = world;
  if (w.meta?.mode !== 'escape') return { world: w, kind: 'none' };
  if (w.combat?.active || w.ending?.locked || w.travel?.pending) return { world: w, kind: 'none' };
  const after = String(w.map?.currentNodeId || '');
  if (!after || after === String(before || '')) return { world: w, kind: 'none' };
  const rng = makeRng(seedFromString(`${w.meta.seed}|escapeEncounter|${after}|${w.timeline.length}`));
  if (rng.nextFloat() >= chance) return { world: w, kind: 'none' };
  const node = (w.map?.nodes || []).find(n => n && n.id === after) || null;
  const biome = node ? biomeForNode(w.meta.seed, node) : 'wilderness';
  // "The road has brigands, the wood has beasts": arriving at a town, or crossing
  // open plains/coast, is road country → brigands/toll. Arriving at a wild place is
  // beast country → ambush. A natural ~half-and-half mix.
  const roadish = node?.nodeType === 'settlement' || biome === 'plains' || biome === 'coastal';
  if (roadish) {
    const foe = rng.pick(['Brigands', 'Robbers', 'Highwaymen', 'A toll-gang']) || 'Brigands';
    return { world: { ...w, travel: { pending: { kind: 'brigands', foeName: foe, destName: String(destName || '') } } }, kind: 'pending' };
  }
  const region = node?.settlement?.region || null;
  return { world: spawnTamedAmbush(w, region, rng, 'journey-ambush'), kind: 'combat' };
}

function brigandSceneLine(foeName, destName) {
  const tail = destName ? ` ${destName} lies just beyond them.` : '';
  return `Wizard: ${foeName} step into the road ahead, hands on their hilts. "Toll's a coin to pass — or we take it the hard way."${tail} You can pay, talk your way past, slip by, or fight.`;
}

function parseEncounterChoice(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(pay|coin|toll|bribe|hand it over|give them)\b/.test(t)) return 'pay';
  if (/\b(talk|persuade|negotiate|parley|reason|convince|bargain|barter|charm|sweet.?talk)\b/.test(t)) return 'talk';
  if (/\b(slip|sneak|evade|avoid|skirt|creep|go around|steal past|past them)\b/.test(t)) return 'slip';
  if (/\b(fight|attack|draw|strike|kill|charge|swing|cut them down|refuse)\b/.test(t)) return 'fight';
  return null;
}

// Spend the smallest available coin. Returns { world, paid, coin }.
function payToll(world) {
  const w = world;
  const purse = w.party?.[0]?.purse || {};
  const order = ['copper', 'silver', 'gold', 'platinum'];
  const coin = order.find(c => (Number(purse[c]) || 0) > 0);
  if (!coin) return { world: w, paid: false };
  const nextParty = (w.party || []).map((m, i) => i === 0
    ? { ...m, purse: { ...purse, [coin]: (Number(purse[coin]) || 0) - 1 } }
    : m);
  return { world: { ...w, party: nextParty }, paid: true, coin };
}

function isFreeMovementIntent(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return false;

  // Explicit tactical movement-within-speed (legacy phrasing).
  if (/\b(within speed|30\s*ft)\b/.test(t)) return true;

  // Broad free movement / travel phrasing (deterministic: destination is still resolved by adjacency rules).
  // Single-letter compass guarded against apostrophe contractions ("what's" ≠ south).
  return /\b(travel|leave|exit|head\s+(?:to|toward|towards|for)|go\s+(?:to|toward|towards)|move\s+to|walk\s+(?:to|toward|towards)|walk|make\s+for|set\s+(?:out|off)|get\s+moving|go\s+north|go\s+south|go\s+east|go\s+west|north|south|east|west)\b/.test(t)
    || /(?<!['’])\b(n|s|e|w)\b/.test(t);
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

    // "go back inside", "step back inside", "head inside", "I go back inside the inn" etc.
    const backIn = t.match(/\b(?:go|step|head)\s+(?:back\s+)?(?:inside|in(?:doors)?)\b(?:\s+(?:the\s+)?(\w[\w\s]*))?$/i);
    if (backIn) {
      const raw = String(backIn[1] || '').trim();
      const ref = (raw === 'building' || raw === 'structure') ? '' : raw;
      return { kind: 'enter', structureRef: ref };
    }

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
  // "leave" exits only as a COMMAND ("leave", "I leave") — "when does the
  // caravan leave?" is a question for the NPC, not a goodbye.
  if (/^(?:i\s+)?leave\b/.test(t)) return true;
  return /\b(walk away|step away|end conversation|end conversation\.|stop talking|goodbye|good\s?bye|farewell|done talking)\b/.test(t);
}

function isDialogueBreakingIntent(text, world) {
  const t = String(text || '');
  if (!t.trim()) return false;
  // NOTE: exploration/questions ("what's here", "the way out", "look around") do
  // NOT break dialogue — while talking, those are questions put to the NPC and
  // route to askNpc. Only actual movement/physics below ends the conversation.
  // (A player asking "how do I get out?" should be answered, not ejected.)
  //
  // The bar in here is COMMANDED intent, not mentioned words. The old token
  // tests ejected the player for saying "what's your name?" (apostrophe makes
  // the "s" read as a compass), "is the road north safe?" (direction as a
  // noun), and "take care of yourself" ("take" as a physics verb). A real DM
  // doesn't hang up the conversation because you used a word.
  const tl = t.toLowerCase().trim();

  // Movement: a bare compass command, or a movement VERB aimed somewhere.
  const bareCompass = /^(?:go\s+|head\s+|walk\s+)?(?:north|south|east|west|n|s|e|w)[.!]?$/.test(tl);
  const commandedMove =
    /\b(?:go|head|walk|run|ride|travel|journey|move|escape|set\s+(?:out|off)|make\s+for|press\s+on|take\s+me)\b[^.!?]*\b(?:to|toward|towards|for|into|north|south|east|west)\b/i.test(t)
    || /^(?:i\s+)?(?:leave|exit|go|head\s+out|set\s+out)\b/.test(tl);
  if (bareCompass || commandedMove) return true;

  // Interior transitions (already command-shaped: "enter the mill", "go outside")
  const ia = inferInteriorAction(t, world?.scene?.interior);
  if (ia && ia.kind && ia.kind !== 'none') return true;
  // Local feet moves ("move 30ft north")
  if (parseLocalFeetMove(t)) return true;
  // Physics interactions break only when they NAME something real — the same
  // contract as the main physics gate. "take care of yourself" names nothing
  // and stays a conversation; "smash the table" with a table present breaks.
  if (DIALOGUE_PHYSICS_VERB_RE.test(t)) {
    const detection = detectPhysicalInteraction(world, t);
    if (detection.detected && (detection.matches || []).some(m => m.match === 'name' || m.match === 'part')) return true;
  }
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
  // Common knowledge answered plainly is a successful exchange.
  if (['smalltalk', 'self', 'place', 'directions', 'services', 'news'].includes(m)) return 'success';
  if (m === 'refused-hard') return 'failure';
  if (m === 'deflected') return 'mixed';
  return 'mixed';
}

// Turn a knowledge-graph factId into something a person would SAY.
// 'local_well_gossip' → 'the talk around the well'. Falls back to a plain
// humanization so no fact is ever unspeakable.
function factPhrase(factId) {
  const id = String(factId || '');
  let m = id.match(/^local_(\w+)_gossip$/);
  if (m) return `the talk around the ${m[1].replace(/_/g, ' ')}`;
  m = id.match(/^faction_(\w+)_standing$/);
  if (m) return `where the ${m[1].replace(/_/g, ' ')} folk stand these days`;
  m = id.match(/^neighbor_\d+_presence$/);
  if (m) return 'who keeps house nearby';
  m = id.match(/^role_(\w+)_trade_talk$/);
  if (m) return `the ${m[1].replace(/_/g, ' ')}'s trade`;
  return id.replace(/_/g, ' ').trim() || 'that';
}

function capFirst(s) {
  const str = String(s || '');
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// P5 — NPCs SPEAK. Direct speech with deterministic variation (pickVariant);
// the brain's decision is unchanged underneath: the engine decides share/
// deflect/lie, this layer only decides the words in their mouth.
function dialogueAskNarration(outcome, world) {
  const name = outcome?.npcName || 'They';
  const mood = String(outcome?.brainMood || '').trim();
  const says = mood ? `${name} says, ${mood}` : `${name} says`;
  const phrase = factPhrase(outcome?.factId);
  const V = (key, variants) => `Wizard: ${pickVariant(variants, world, `say:${key}`)}`;
  switch (outcome?.mode) {
    case 'shared': {
      // Authored testimony (story arcs): the words are the content. Speak them
      // verbatim — the MANNER flavors only how they hand it over.
      const body = String(outcome?.factBody || '').trim();
      const manner = outcome?.manner || 'even';
      if (body) {
        const frames = {
          guarded: [
            `${name} weighs you a long moment. Then, quietly: "${body}"`,
            `${name} checks who's in earshot first. "${body}"`
          ],
          skittish: [
            `${name} leans close, voice dropped to almost nothing. "${body}"`,
            `${name} tells it in a rush, like a thing held too long. "${body}"`
          ],
          blunt: [
            `"${body}" ${name} says it like weather — take it or don't.`,
            `${name} doesn't dress it up. "${body}"`
          ],
          open: [
            `${name} brightens — a question they LIKE. "${body}"`,
            `${name} pulls you half a step closer, glad of the telling. "${body}"`
          ],
          even: [
            `${name} is quiet a moment. Then they tell it, plainly: "${body}"`,
            `${name} looks at you a while before answering. "${body}"`,
            `${says}: "${body}"`
          ]
        };
        return V(`sharedBody:${manner}`, frames[manner] || frames.even);
      }
      const pools = {
        guarded: [
          `${name} considers the cost of it, then talks — ${phrase}, in fewer words than it deserves, every one of them true.`,
          `"${capFirst(phrase)}." ${says}. "You'll hear it once." And you do.`
        ],
        skittish: [
          `${name} talks fast and low — ${phrase}, all of it, like saying it slower would hurt.`,
          `"You didn't get this from me." Then it comes, hurried but whole: ${phrase}.`
        ],
        blunt: [
          `"${capFirst(phrase)}? Fine." ${name} lays it out flat, no varnish, all of it.`,
          `${name} gives it to you straight — ${phrase} — and watches it land.`
        ],
        open: [
          `${name} warms to it like a told-twice story. "${capFirst(phrase)}? Sit a moment, then." And they give you the whole of it.`,
          `"Ha — now THAT I can help with." ${name} talks ${phrase} with both hands, holding nothing back.`
        ],
        even: [
          `${name} leans in. "${capFirst(phrase)}? Aye, I'll tell you what I know." And they do — plainly, holding nothing back.`,
          `"You're asking about ${phrase}." ${says}. "Fair enough. Listen." What follows has the ring of truth.`,
          `${name} glances round, then talks — ${phrase}, laid out straight.`
        ]
      };
      return V(`shared:${manner}`, pools[manner] || pools.even);
    }
    case 'recruited':
      return V('recruited', [
        `"Alright." ${name} rolls their shoulders. "I'm with you. Lead on." They fall into step beside you.`,
        `${name} looks you over once more, then nods. "You'll do. Let's walk."`
      ]);
    // Common knowledge — name, village, roads, news. The body IS the answer
    // (composed deterministically from world data); speak it in their voice.
    case 'smalltalk':
    case 'self':
    case 'place':
    case 'directions':
    case 'services':
    case 'news': {
      const body = String(outcome?.commonBody || '').trim();
      if (body) {
        return V(`common:${outcome.mode}`, [
          `${says}: "${body}"`,
          `${name} considers you a moment. "${body}"`,
          `"${body}" ${name} watches to see what you make of that.`
        ]);
      }
      // No body composed — deflect honestly rather than return nothing.
      return V('deflected', [
        `${name} waves it off. "You'd be asking the wrong one. I keep to my own affairs."`,
        `"Hm." ${name} finds something to do with their hands. "Couldn't say."`
      ]);
    }
    case 'withheld': {
      // The refusal in THEIR manner — a guarded clerk and a blunt farmhand
      // keep secrets differently (manner derives from npc personality).
      const pools = {
        guarded: [
          `${name}'s face closes like a shutter. "No."`,
          `"You'd do well not to ask that here," ${says}, very quietly.`
        ],
        skittish: [
          `${name} glances at the door before answering. "I — no. Don't ask me that. Please."`,
          `${name} laughs, too quickly. "Who told you to ask ME that?"`
        ],
        blunt: [
          `"Not yours to know," ${says}, and that is plainly the end of it.`,
          `${name} folds their arms. "Ask something else or ask someone else."`
        ],
        open: [
          `${name}'s easy manner falters, just for a beat. "Ah. That one I sit on, friend. Even for you."`,
          `"Anything but that," ${says}, with a smile that doesn't quite hold.`
        ],
        even: [
          `"That I keep to myself," ${says}, eyes flat.`,
          `${name} goes still. "Some things aren't for trading. Not yet."`,
          `"Ask me about the weather," ${says}. "That one's free."`
        ]
      };
      return V(`withheld:${outcome?.manner || 'even'}`, pools[outcome?.manner] || pools.even);
    }
    case 'lied': {
      const pools = {
        guarded: [
          `"No," ${name} says — just that, and a beat too fast. A door closes somewhere behind the word.`,
          `${name} gives you four flat words that answer nothing. The eyes are doing different arithmetic.`
        ],
        skittish: [
          `${name} answers in a tumble — too many details, none that matter, and a laugh in the wrong place.`,
          `"Why would I know that? I don't. Who said I did?" ${name} smooths their sleeve twice.`
        ],
        blunt: [
          `"Nothing to it," ${name} says, square as a brick. Almost convincing — almost.`,
          `${name} states it like a fact you'd be a fool to question. Something underneath says question it.`
        ],
        open: [
          `${name} laughs it off, easy and warm, and pours you a story smooth as cream. It goes down too easily.`,
          `The friendliest answer you've gotten all day — and the only one that doesn't quite meet your eye.`
        ],
        even: [
          `"Nothing to it," ${says} — a touch too smoothly. Something in it doesn't sit right.`,
          `${name} answers without blinking: a clean, easy story. Too clean, maybe.`
        ]
      };
      return V(`lied:${outcome?.manner || 'even'}`, pools[outcome?.manner] || pools.even);
    }
    case 'deflected':
    default: {
      const pools = {
        guarded: [
          `${name} looks you over before deciding you're worth four words. "Couldn't say. Good day."`,
          `"That's not a thing I talk about with strangers," ${says}, and turns half away.`
        ],
        skittish: [
          `${name} drops their voice. "Couldn't say. And if anyone asks — you didn't ask, and I didn't say."`,
          `${name} busies their hands with nothing. "Don't know. Honest. Why — what have you heard?"`
        ],
        blunt: [
          `"No idea," ${name} says, flat as a board. "Next question."`,
          `${name} shrugs. "Wrong person. I dig, I eat, I sleep. Ask me about those."`
        ],
        open: [
          `${name} spreads their hands, cheerful and useless. "Couldn't tell you! But stay a while — somebody around here will know."`,
          `"Ha — you've got the wrong gossip, friend," ${says}. "Now if you'd asked me about the WEATHER…"`
        ],
        even: [
          `${name} waves it off. "You'd be asking the wrong one. I keep to my own affairs."`,
          `"Hm." ${name} finds something to do with their hands. "Couldn't say. Try someone who minds other folks' business."`,
          `${name} sidesteps it without breaking stride. "Weather's turning, though, isn't it."`
        ]
      };
      return V(`deflected:${outcome?.manner || 'even'}`, pools[outcome?.manner] || pools.even);
    }
  }
}

function extractDialogueRef(text) {
  const t = String(text || '');
  // 'talk to X' / 'speak to X' / 'speak with X' / 'chat with X'
  const m1 = t.match(/\b(?:talk|speak|chat)\s+(?:to|with)\s+(.+)/i);
  if (m1 && m1[1]) return cleanDialogueRef(m1[1]);
  // 'approach X' (conservative — resolved NPC must exist or caller falls through)
  const m2 = t.match(/\bapproach\s+(.+)/i);
  if (m2 && m2[1]) return cleanDialogueRef(m2[1]);
  // Greetings ARE dialogue. 'Hello X' / 'hi X' / 'good morning X' / 'greet X'
  // enters conversation with X — a greeting must NEVER be a d20 roll.
  const m3 = t.match(/^\s*(?:hello|hi|hey|greetings|good\s+(?:morning|day|evening)|well met|greet)[,!.]?\s+(.+)/i);
  if (m3 && m3[1]) return cleanDialogueRef(m3[1]);
  // 'X, hello' / 'X, good morning'
  const m4 = t.match(/^\s*([a-z][a-z' -]+?),\s*(?:hello|hi|hey|greetings|good\s+(?:morning|day|evening)|well met)\b/i);
  if (m4 && m4[1]) return cleanDialogueRef(m4[1]);
  // A bare greeting with no name: route to the who-do-you-mean clarify.
  if (/^\s*(?:hello|hi|hey|greetings|good\s+(?:morning|day|evening)|well met)\s*(?:there|everyone|all|folks|friends)?\s*[!.?]*\s*$/i.test(t)) return 'someone';
  return '';
}

function cleanDialogueRef(raw) {
  return String(raw || '')
    .trim()
    .replace(/[.!?,;:]+$/, '')
    .trim();
}

// Inspection verbs that ask to look closely AT a specific thing (as opposed to
// the broad "look around" handled by isExploreIntent). Both bare-imperative
// ("examine the table") and first-person ("I examine the table") forms.
// NOTE: deliberately excludes "search" and "check" — those are skill checks
// ("search for traps", "check for danger") that must roll, not passive looks.
const INSPECT_VERB = /\b(?:examine|inspect|study|scrutinize|appraise|look\s+(?:at|over|inside|in|into)|peer\s+at|read)\b/i;
// Generic "targets" that really mean the whole space — defer to room overview.
const GENERIC_LOOK_TARGET = new Set([
  'room', 'area', 'around', 'surroundings', 'place', 'here', 'everything',
  'inventory', 'pack', 'bag', 'belongings', 'self', 'myself', 'me'
]);

function extractInspectTarget(text) {
  const t = String(text || '').toLowerCase().trim();
  const m = t.match(INSPECT_VERB);
  if (!m) return '';
  // Everything after the matched verb is the candidate target phrase.
  let rest = t.slice((m.index ?? 0) + m[0].length).trim();
  rest = rest.replace(/^(?:at|over|inside|in|into|the|a|an|my|this|that|these|those|some|your|for)\s+/i, '');
  rest = rest.replace(/^(?:the|a|an|my|this|that|these|those|some|your)\s+/i, '');
  rest = rest.replace(/[.?!,;:]+$/g, '').trim();
  return rest;
}

function allInventoryItems(w) {
  const inv = w.party?.[0]?.inventory || {};
  return [].concat(
    inv.weapons || [], inv.armor || [], inv.tools || [], inv.clothes || [],
    inv.oddities || [], inv.consumables || [], inv.tech || [], inv.junk || [], inv.items || []
  ).filter(Boolean);
}

function nameMatches(name, target, tail) {
  const n = String(name || '').toLowerCase();
  if (!n) return false;
  return n === target || n.includes(target) || target.includes(n) || n.split(/\s+/).includes(tail);
}

// Returns a grounded examination line, or null to defer to the room-overview
// explore branch (when there is no specific, resolvable target).
// ── P-67 — the spend loop ────────────────────────────────────────────────────
// Buy/sell/browse at settlement shops, resolved in prose. Stock and prices come
// from engine/economy/shop.js (deterministic, economy-modulated). Trades are
// canon: a 'trade' timeline event both records the deal and depletes shelves.

const TRADE_BUY_RE = /\b(?:buy|purchase)\b\s+(.+)/i;
const TRADE_SELL_RE = /\b(?:sell)\b\s+(.+)/i;
const TRADE_BROWSE_RE = /\b(?:what(?:'s| is| do you have| have they got)?\s+(?:for sale|in stock|to sell|do .* sell)|browse\b|see (?:the |your )?wares|look at (?:the |your )?wares|any(?:thing)? for sale|visit the (?:shop|store|market)|check (?:the )?(?:shop|store|market))/i;
const TRADE_HAGGLE_RE = /\b(?:haggle|barter|talk\s+(?:\w+\s+)?down|discount|better price|best price|knock\s+\w+\s+off|drive a bargain)\b/i;

// ── P-68 — usable consumables ────────────────────────────────────────────────

// ── P-70 — salvage (docs/SALVAGE_AND_BUILD.md, rung one) ─────────────────────

// ── P-71 — field crafting ────────────────────────────────────────────────────

const CRAFT_RE = /\b(?:make|craft|fashion|whittle|carve|assemble|put\s+together|lash\s+(?:up|together)|fletch|rig\s+up)\b/i;

function tryCraft(w, text) {
  const t = String(text || '');
  if (!CRAFT_RE.test(t)) return null;
  const recipe = matchRecipe(t);
  if (!recipe) return null; // not something we know how to make — physics' problem
  const pc = w.party?.[0];

  const missing = missingInputs(pc, recipe);
  if (missing.length) {
    const needTxt = missing.map(m => `${m.need > 1 ? m.need + ' ' : 'a '}${m.name.toLowerCase()}${m.need > 1 ? 's' : ''}${m.have ? ` (you have ${m.have})` : ''}`).join(' and ');
    return {
      world: w,
      output: {
        narration: `Wizard: You lay out what you have, and it isn't enough — a ${recipe.name.toLowerCase()} wants ${needTxt}.`,
        mechanics: `[craft:missing | ${recipe.id} | ${missing.map(m => `${m.defRef} ${m.have}/${m.need}`).join(' ')}]`
      }
    };
  }

  const rng = makeRng(seedFromString(`${w.meta.seed}|craft|${recipe.id}|${w.timeline.length}`));
  const roll = rng.int(1, 20);
  const { quality, qty, total, dc, toolUsed } = resolveCraft(pc, recipe, roll);

  const deltas = recipe.inputs.map(inp => ({ op: 'consumeItems', entityId: pc.id, defRef: inp.defRef, qty: inp.qty }));
  for (let i = 0; i < qty; i++) {
    deltas.push({ op: 'addItem', entityId: pc.id, merge: true, item: { id: `cr_${recipe.id}_${w.timeline.length}_${i}`, defRef: recipe.output.defRef, qty: 1, equipped: null } });
  }
  if (recipe.hours > 0) deltas.push({ op: 'time', key: 'hours', by: recipe.hours });
  let w1 = applyDeltas(w, deltas);
  w1 = pushEvent(w1, { kind: 'craft', data: { recipe: recipe.id, qty, quality, roll: total, dc } });

  const outName = String(recipe.name).toLowerCase();
  const plural = /(?:ch|sh|s|x|z)$/.test(outName) ? `${outName}es` : `${outName}s`;
  const made = qty > 1 ? `${qty} ${plural}` : `a ${outName}`;
  const qLine = quality === 'fine'
    ? `The work comes out better than it has any right to${toolUsed ? ' — the right tools tell' : ''}: ${made}, tight and true.`
    : quality === 'sound'
      ? `Steady hands, fair work: ${made}, fit for use.`
      : `It fights you the whole way, but you end up with ${made}. It'll serve. Barely.`;
  return {
    world: w1,
    output: {
      narration: `Wizard: ${qLine} (${recipe.check.skill} ${total} vs DC ${dc}${toolUsed ? ', tools +2' : ''}; ${recipe.hours} hour${recipe.hours === 1 ? '' : 's'} gone.)`,
      mechanics: `[craft | ${recipe.name} ×${qty} | ${quality} | ${recipe.check.skill} ${total} vs DC ${dc}]`
    }
  };
}

const BUILD_RE = /\b(?:build|building|raise|raising|put\s+up|throw\s+up|construct|constructing|erect)\b/i;

function tryBuild(w, text) {
  const t = String(text || '');
  if (!BUILD_RE.test(t)) return null;
  const plan = matchBuildPlan(t);
  if (!plan) return null; // not something we know how to build — let it fall through
  const pc = w.party?.[0];

  // Missing materials: an honest, itemized answer — no roll, no days lost.
  const missing = missingBuildInputs(pc, plan);
  if (missing.length) {
    const needTxt = missing.map(m => `${m.need > 1 ? m.need + ' ' : 'a '}${m.name.toLowerCase()}${m.need > 1 ? 's' : ''}${m.have ? ` (you have ${m.have})` : ''}`).join(' and ');
    return {
      world: w,
      output: {
        narration: `Wizard: You pace out where the ${plan.name.toLowerCase()} would stand, but the stockpile's short — it wants ${needTxt} before a post goes in.`,
        mechanics: `[build:missing | ${plan.id} | ${missing.map(m => `${m.defRef} ${m.have}/${m.need}`).join(' ')}]`
      }
    };
  }

  // Labor fork (the moral instrument, docs/SALVAGE_AND_BUILD.md): enough time
  // (solo), enough gold (hired), or enough slaves (coerced). Solo is the default.
  // Coerced is a third of the days and free — and an atrocity: the soul pays,
  // the witnesses remember, and the county treats you differently after.
  const here = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
  const atSettlement = here?.nodeType === 'settlement';
  const wantsCoerced = /\b(?:force|forc(?:e|ing)|enslave|enslav\w*|conscript|press[-\s]?gang|impress|compel|coerce|drive|whip)\b[^.]{0,40}\b(?:villagers?|locals?|peasants?|townsfolk|townspeople|prisoners?|captives?|slaves?|people|men|folk|them)\b|\b(?:slave|forced|unfree)\s+labou?r\b/i.test(t);
  const wantsHired = /\b(hir(?:e|ing)|crew|laborers?|labourers?|sawyer|workmen|pay\s+(?:for\s+)?(?:help|labou?r|men|hands)|with\s+help)\b/i.test(t);
  let labor = laborPlan(plan, 'solo');
  let laborNote = '';
  let coercedDeltas = [];
  if (wantsCoerced) {
    if (!atSettlement) {
      laborNote = ' (No one to press into labor out here — you raise it with your own hands.)';
    } else {
      labor = laborPlan(plan, 'coerced');
      const witnesses = Array.isArray(here?.settlement?.npcs) ? here.settlement.npcs.map(n => String(n.id)).filter(Boolean).slice(0, 8) : [];
      // Forcing people is cruelty: the seven-axis soul pays (wrath/pride/greed),
      // the deed goes on the ledger, the witnesses' trust craters, and the act
      // draws investigation pressure. Recorded HERE — applyDeedCharges skips its
      // tryDarkDeed pass on the coerced marker so the deed is the construction
      // itself and is never double-counted.
      coercedDeltas = [
        { op: 'axisDelta', axis: 'wrath', by: DEED_SEV.MOD },
        { op: 'axisDelta', axis: 'pride', by: DEED_SEV.MOD },
        { op: 'axisDelta', axis: 'greed', by: DEED_SEV.LIGHT },
        { op: 'recordDeed', deedKind: 'cruelty', severity: DEED_SEV.HEAVY, summary: t.slice(0, 200), nodeId: here.id, witnesses, t: w.timeline.length },
        ...witnesses.map(npcId => ({ op: 'npcTrustDelta', npcId, by: -3 })),
        { op: 'adjustHeat', by: 8 }
      ];
    }
  } else if (wantsHired) {
    if (!atSettlement) {
      laborNote = ' (No crew to hire out here — you raise it with your own hands.)';
    } else {
      const hired = laborPlan(plan, 'hired');
      if (purseTotalCopper(pc?.purse) < hired.costCopper) {
        laborNote = ` (You can't cover a crew's wages — ${formatPrice(hired.costCopper)} — so you see to it yourself.)`;
      } else {
        labor = hired;
      }
    }
  }

  const rng = makeRng(seedFromString(`${w.meta.seed}|build|${plan.id}|${w.timeline.length}`));
  const roll = rng.int(1, 20);
  const { quality, restBand, total, dc, toolUsed } = resolveBuild(pc, plan, roll, labor);

  const hours = labor.days * 24;
  const builtDay = Math.floor(((Number(w.time?.hours) || 0) + hours) / 24);
  const materials = {};
  for (const inp of plan.inputs) materials[inp.defRef] = (materials[inp.defRef] || 0) + inp.qty;
  const nodeId = here?.id || w.map?.currentNodeId;
  const structure = makePlayerStructure({ plan, quality, restBand, labor: labor.mode, builtDay, materials, nodeId });

  const deltas = plan.inputs.map(inp => ({ op: 'consumeItems', entityId: pc.id, defRef: inp.defRef, qty: inp.qty }));
  if (labor.mode === 'hired' && labor.costCopper > 0) {
    deltas.push({ op: 'setPurse', entityId: pc.id, purse: pursePay(pc.purse, labor.costCopper) });
  }
  deltas.push({ op: 'time', key: 'hours', by: hours });
  deltas.push({ op: 'buildStructure', structure });
  if (coercedDeltas.length) deltas.push(...coercedDeltas);
  let w1 = applyDeltas(w, deltas);

  // Downtime: the world moves while you work — one tick per day of labor (the
  // long-rest precedent jumps the clock; building also lets factions/threads/
  // rumors breathe). Bounded so an outsized project can't run away.
  for (let d = 0; d < Math.min(labor.days, 30); d++) {
    w1 = worldTick(w1, `${w1.meta.seed}|build-downtime|${plan.id}|${w.timeline.length}|${d}`);
  }
  w1 = pushEvent(w1, { kind: 'build', data: { plan: plan.id, quality, labor: labor.mode, days: labor.days, nodeId, roll: total, dc } });

  // Prose — quality is provenance; the rest payoff is stated plainly.
  const name = plan.name.toLowerCase();
  const qLine = quality === 'fine'
    ? `It comes together square and snug${toolUsed ? ', the tools earning their weight' : ''} — a ${name} you'd not be ashamed of.`
    : quality === 'sound'
      ? `Post by post it goes up, sound and serviceable — a fair ${name}.`
      : `It leans more than you'd like and the wind finds the gaps, but it stands — a rough ${name}.`;
  const restLine = plan.shelter
    ? (restBand === 'long'
        ? ` Under this roof you could sleep a real night.`
        : ` It'll break the weather — better rest than bare ground, if not a true bed.`)
    : ` It won't shelter you, but it'll slow whatever comes at this place.`;
  const laborLine = labor.mode === 'coerced'
    ? ` It goes up fast — ${labor.days} day${labor.days === 1 ? '' : 's'} — raised on the labor of people who were never asked. No coin changes hands. Some of them will remember your face, and so will the county.`
    : labor.mode === 'hired'
      ? ` A hired crew makes short work of it — ${labor.days} day${labor.days === 1 ? '' : 's'}, and ${formatPrice(labor.costCopper)} lighter.`
      : ` ${labor.days} day${labor.days === 1 ? '' : 's'} of your own sweat.`;
  return {
    world: w1,
    output: {
      narration: `Wizard: ${qLine}${restLine}${laborLine}${laborNote} (${plan.check.skill} ${total} vs DC ${dc}${toolUsed ? ', tools +2' : ''}${labor.mode === 'hired' ? ', crew +2' : ''}.)`,
      mechanics: `[build | ${plan.name} | ${quality} | ${labor.mode} ${labor.days}d | ${plan.check.skill} ${total} vs DC ${dc}]`
    }
  };
}

// ── P-79: downtime — a week given to training, research, or the tavern ───────
// "I spend a week researching the tower": days pass with the world ticking,
// and each verb pays ONE concrete outcome — training steadies the next
// contested moment, research yields a fact in the ledger, carousing buys a
// contact and a question worth asking. Never a menu; honest refusals.

const DOWNTIME_SPAN_RE = /\b(?:spend|pass|take|give)\b[^.!?]*?\b(a\s+week|the\s+week|a\s+month|a\s+few\s+days|(\d+)\s+days?)\b/i;
const DOWNTIME_VERBS = [
  { verb: 'training', re: /\btrain(?:ing)?\b|\bdrill(?:ing)?\b|\bpractic(?:e|ing)\b|\bspar(?:ring)?\b/i },
  { verb: 'research', re: /\bresearch(?:ing)?\b|\bstud(?:y|ying)\b|\bpor(?:e|ing)\s+over\b|\bdig(?:ging)?\s+into\b|\bin\s+the\s+archives\b/i },
  { verb: 'carousing', re: /\bcarous(?:e|ing)\b|\brevel(?:ing|ling)?\b|\bdrink(?:ing)?\s+(?:with|at|in)\b|\bmake\s+merry\b|\btavern\s+crawl\b/i }
];

function tryDowntime(w, text) {
  const t = String(text || '');
  const span = t.match(DOWNTIME_SPAN_RE);
  if (!span) return null;
  const mode = DOWNTIME_VERBS.find(v => v.re.test(t));
  if (!mode) return null;

  const spanTxt = span[1].toLowerCase();
  const days = span[2] ? Math.max(1, Math.min(30, parseInt(span[2], 10)))
    : /month/.test(spanTxt) ? 30
    : /few/.test(spanTxt) ? 3
    : 7;
  const pc = w.party?.[0];
  const here = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
  const rng = makeRng(seedFromString(`${w.meta.seed}|downtime|${mode.verb}|${w.timeline.length}`));
  const spanWord = days === 7 ? 'A week' : days === 30 ? 'A month' : `${days} days`;

  // Carousing needs people; the wild has none to buy a round for.
  if (mode.verb === 'carousing' && !here?.settlement) {
    return { world: w, output: { narration: `Wizard: Out here there is no one to drink with but the wind, and it never buys a round. Find a settlement.`, mechanics: '[downtime:no-tavern]' } };
  }

  const deltas = [{ op: 'time', key: 'hours', by: days * 24 }];
  let outcomeLine = '';
  let outcomeTag = '';

  if (mode.verb === 'training') {
    deltas.push({ op: 'advantage', actorId: pc.id, by: 1 });
    deltas.push({ op: 'ledger', addFact: `trained hard for ${days} days — the work is in the hands now`, source: 'downtime' });
    outcomeLine = `The drills wear grooves into you until the moves live below thought. The next time it matters, you'll be the steadier one. (Advantage banked.)`;
    outcomeTag = 'advantage+1';
  } else if (mode.verb === 'research') {
    // Name the subject from the player's own words; tie it to a real nearby
    // place when one matches, so the fact has an address.
    const subjM = t.match(/\b(?:research(?:ing)?|stud(?:y|ying)|dig(?:ging)?\s+into|por(?:e|ing)\s+over)\s+(?:the\s+)?([a-z' -]{3,40}?)(?:\s+(?:for|until|over|while)\b|[.?!,]|$)/i);
    const subject = (subjM ? subjM[1] : 'the matter').trim();
    const known = (w.map?.nodes || []).filter(n => n?.name && t.toLowerCase().includes(String(n.name).toLowerCase()));
    const anchor = known[0] || null;
    const findings = [
      `the oldest accounts disagree about ${subject} — and the disagreement itself is the clue`,
      `${subject} appears in the records twice under two different names`,
      `whoever wrote the surviving page about ${subject} stopped mid-sentence`,
      `the county once paid good coin to keep ${subject} quiet`
    ];
    const finding = findings[rng.int(0, findings.length - 1)];
    deltas.push({ op: 'ledger', addFact: `research: ${finding}${anchor ? ` (see ${anchor.name})` : ''}`, source: 'downtime' });
    outcomeLine = `By the end your eyes ache and your notes contradict each other — except on one point, which holds: ${finding}.`;
    outcomeTag = 'fact';
  } else {
    const npcs = (here.settlement.npcs || []).filter(n => n && n.name && !n.hostile);
    const contact = npcs.length ? npcs[rng.int(0, npcs.length - 1)] : null;
    if (contact) deltas.push({ op: 'npcTrustDelta', npcId: contact.id, by: 2 });
    const heard = [
      'someone has been paying for silence on the edge of the county',
      'a road that used to be safe is not anymore, and nobody will say which',
      'something was sold in the night market that should have stayed buried'
    ];
    const q = `tavern talk: ${heard[rng.int(0, heard.length - 1)]}?`;
    deltas.push({ op: 'ledger', addQuestion: q });
    outcomeLine = contact
      ? `${spanWord} of bought rounds and listened stories. ${contact.name} warms to you — a friend worth having — and one thread of talk refuses to lie flat: ${q.replace(/^tavern talk: /, '')}`
      : `${spanWord} of bought rounds. The talk runs shallow, but one thread refuses to lie flat: ${q.replace(/^tavern talk: /, '')}`;
    outcomeTag = contact ? `contact:${contact.name}` : 'question';
  }

  let w1 = applyDeltas(w, deltas);
  // The world does not wait while you work — one tick per day, bounded.
  for (let d = 0; d < Math.min(days, 30); d++) {
    w1 = worldTick(w1, `${w1.meta.seed}|downtime|${mode.verb}|${w.timeline.length}|${d}`);
  }
  w1 = pushEvent(w1, { kind: 'downtime', data: { verb: mode.verb, days, outcome: outcomeTag } });

  return {
    world: w1,
    output: {
      narration: `Wizard: ${mode.verb === 'training' ? `${spanWord} of drill, sweat, and repetition. ` : ''}${outcomeLine} (${spanWord} passes; the world did not wait.)`,
      mechanics: `[downtime | ${mode.verb} | ${days}d | ${outcomeTag}]`
    }
  };
}

const SALVAGE_RE = /\b(?:smash|demolish|destroy|wreck|dismantle|salvage|bust(?:\s+up)?|break(?:\s+(?:up|down|apart))|tear\s+(?:apart|down)|rip\s+apart|reduce .* to)\b/i;

function trySalvage(w, text) {
  const t = String(text || '');
  if (!SALVAGE_RE.test(t)) return null;
  const detection = detectPhysicalInteraction(w, t);
  const hit = (detection.matches || []).find(m => m.type === 'furniture' && (m.match === 'name' || m.match === 'part'));
  if (!detection.detected || !hit) return null;

  const node = (w.map?.nodes || []).find(n => n.id === w.map?.currentNodeId);
  const furniture = Array.isArray(node?.furniture) ? node.furniture : [];
  const f = furniture[hit.index];
  if (!f) return null;

  // Naming a specific PART ("tear the leg off…") is extraction, not salvage —
  // the physics path below owns that.
  const tl = t.toLowerCase();
  if ((f.parts || []).some(p => tl.includes(String(p).toLowerCase())) && !/\b(whole|entire|all of)\b/i.test(t)) return null;

  const pc = w.party?.[0];
  const rng = makeRng(seedFromString(`${w.meta.seed}|salvage|${node.id}|${w.timeline.length}`));
  const yields = salvageYield(f, rng);
  const name = String(f.name || 'the thing');

  const deltas = [{ op: 'removeFurniture', nodeId: node.id, furnitureId: hit.index }];
  yields.forEach((y, i) => {
    deltas.push({
      op: 'addItem', entityId: pc.id, merge: true,
      item: { id: `sv_${node.id}_${w.timeline.length}_${i}`, defRef: y.defRef, qty: y.qty, equipped: null }
    });
  });
  let w1 = applyDeltas(w, deltas);
  w1 = pushEvent(w1, { kind: 'salvage', data: { nodeId: node.id, target: name, yields } });

  const haul = yields.map(y => {
    const def = getItemDef(y.defRef);
    return `${y.qty > 1 ? y.qty + ' ' : ''}${(def?.name || y.defRef).toLowerCase()}${y.qty > 1 ? 's' : ''}`;
  });
  const haulTxt = haul.length === 1 ? haul[0] : haul.slice(0, -1).join(', ') + ' and ' + haul[haul.length - 1];
  const heavy = (Number(f.bulk) || 2) >= 4;
  return {
    world: w1,
    output: {
      narration: `Wizard: ${heavy ? `It takes real work, but the ${name.replace(/^the /, '')} comes apart` : `The ${name.replace(/^the /, '')} comes apart under your hands`} — you're left with ${haulTxt}, and the floor is left with the rest.`,
      mechanics: `[salvage | ${name} | ${yields.map(y => `${y.defRef}×${y.qty}`).join(' ')}]`
    }
  };
}

const EQUIP_RE = /\b(?:equip|wield|don|wear|strap\s+on|put\s+on|ready|draw|brandish|slip\s+on)\b\s+(.+)/i;

function tryEquipItem(w, text) {
  const m = String(text || '').match(EQUIP_RE);
  if (!m) return null;
  const pc = w.party?.[0];
  const carried = (pc?.inventory?.items || [])
    .map(it => ({ it, def: getItemDef(it.defRef) }))
    .filter(x => x.def && x.def.slot);
  if (!carried.length) return null; // nothing equippable typed — let physics have it
  const hit = matchByName(m[1], carried, (x) => x.def.name);
  if (!hit) return null; // not something we know — fall through to adjudication

  const slot = String(hit.def.slot);
  if (hit.it.equipped === slot) {
    return { world: w, output: { narration: `Wizard: The ${hit.def.name.toLowerCase()} is already in use.`, mechanics: '[equip:already]' } };
  }
  const w1 = applyDeltas(w, [{ op: 'equipItem', entityId: pc.id, itemId: hit.it.id, slot }]);
  const pc1 = w1.party[0];
  let line;
  if (hit.def.kind === 'weapon' || (hit.def.kind === 'material' && hit.def.improvised)) {
    const prof = meleeProfile(pc1);
    line = `You take up the ${hit.def.name.toLowerCase()}. It sits right in the hand — d${prof.die}${prof.dmgMod >= 0 ? '+' + prof.dmgMod : prof.dmgMod} when it lands, ${prof.atkBonus >= 0 ? '+' + prof.atkBonus : prof.atkBonus} to strike.`;
  } else {
    const ac = playerAc(pc1);
    line = `You ${slot === 'armor' ? 'buckle into' : 'put on'} the ${hit.def.name.toLowerCase()}. AC ${ac}.`;
  }
  return {
    world: pushEvent(w1, { kind: 'equip', data: { defRef: hit.def.defRef, slot } }),
    output: { narration: `Wizard: ${line}`, mechanics: `[equip | ${hit.def.name} | ${slot}]` }
  };
}

// ── P-77: item identity — identify the humming thing, attune to the named ────

const IDENTIFY_RE = /\bidentify\b|\b(?:decipher|study|divine|work\s+out|figure\s+out)\b.*\b(?:humming|unmarked|strange|sealed|unidentified)\b/i;

function tryIdentify(w, text) {
  const t = String(text || '');
  if (!IDENTIFY_RE.test(t)) return null;
  const pc = w.party?.[0];
  const sealed = (pc?.inventory?.items || []).filter(it => it.sealedRef);
  if (!sealed.length) {
    if (!/\bidentify\b/i.test(t)) return null; // vague study of nothing — not ours
    return { world: w, output: { narration: `Wizard: You turn out the pack — nothing in it keeps secrets from you. What you carry, you know.`, mechanics: '[identify:none]' } };
  }
  // Pick the named mystery, else the first one humming.
  const tl = t.toLowerCase();
  const target = sealed.find(it => {
    const myst = getItemDef(it.defRef);
    return myst && myst.name.toLowerCase().split(/\s+/).some(wd => wd.length > 3 && tl.includes(wd));
  }) || sealed[0];
  const realDef = getItemDef(target.sealedRef);
  if (!realDef) return null;
  const mystName = (getItemDef(target.defRef)?.name || 'humming thing').toLowerCase();

  // Revealing the true item can complete an obtain-goal ("recover the blade")
  // the moment you learn you hold it — so the goal check rides the reveal.
  const reveal = (base) => maybeCheckGoals(applyDeltas(base, [
    { op: 'removeItemById', entityId: pc.id, itemId: target.id },
    { op: 'addItem', entityId: pc.id, item: { id: target.id, defRef: target.sealedRef, equipped: target.equipped ?? null } },
    { op: 'time', key: 'hours', by: 1 }
  ]));
  const historyLine = realDef.history ? ` ${realDef.history}` : '';

  // The sage path: coin buys certainty at any settlement counter.
  const wantsSage = /\b(?:pay|hire|sage|scholar|priest|wise\s+woman|apothecary)\b/i.test(t);
  if (wantsSage) {
    const { shops } = shopsHere(w);
    if (!shops.length) {
      return { world: w, output: { narration: `Wizard: No learned counter out here to take your coin — identify it yourself, or carry it to a settlement.`, mechanics: '[identify:no-sage]' } };
    }
    const fee = sageFeeCopper(realDef);
    const paid = pursePay(pc.purse, fee);
    if (!paid) {
      return { world: w, output: { narration: `Wizard: The scholar names the price without looking up: ${formatPrice(fee)}. Your purse says no.`, mechanics: '[identify:cant-pay]' } };
    }
    let w1 = applyDeltas(w, [{ op: 'setPurse', entityId: pc.id, purse: paid }]);
    w1 = reveal(w1);
    w1 = pushEvent(w1, { kind: 'identify', data: { defRef: target.sealedRef, via: 'sage', fee } });
    return {
      world: w1,
      output: {
        narration: `Wizard: The scholar turns the ${mystName} over twice, hums once, and names it: ${realDef.name}.${historyLine} (${formatPrice(fee)} lighter.)`,
        mechanics: `[identify | ${realDef.name} | sage ${formatPrice(fee)}]`
      }
    };
  }

  // Your own hour with the thing: Arcana gates the knowing, not the trying.
  const dc = identifyDc(realDef);
  const rng = makeRng(seedFromString(`${w.meta.seed}|identify|${target.id}|${w.timeline.length}`));
  const roll = rng.int(1, 20);
  const bonus = pc?.dnd ? (Number(pc.dnd.skills?.Arcana) || 0) : Math.floor(((pc?.stats?.WITS ?? 10) - 10) / 2);
  const total = roll + bonus;
  if (total >= dc) {
    let w1 = reveal(w);
    w1 = pushEvent(w1, { kind: 'identify', data: { defRef: target.sealedRef, via: 'check', roll: total, dc } });
    return {
      world: w1,
      output: {
        narration: `Wizard: An hour with the ${mystName} — turning it to the light, listening to the hum — and the knowing arrives all at once: ${realDef.name}.${historyLine} (Arcana ${total} vs DC ${dc}.)`,
        mechanics: `[identify | ${realDef.name} | Arcana ${total} vs DC ${dc}]`
      }
    };
  }
  let w1 = applyDeltas(w, [{ op: 'time', key: 'hours', by: 1 }]);
  w1 = pushEvent(w1, { kind: 'identify', data: { defRef: null, via: 'check', roll: total, dc } });
  return {
    world: w1,
    output: {
      narration: `Wizard: An hour gone and the ${mystName} keeps its secret — the hum neither rises nor falls. (Arcana ${total} vs DC ${dc}. A scholar in town would know it for a fee.)`,
      mechanics: `[identify:fail | Arcana ${total} vs DC ${dc}]`
    }
  };
}

const ATTUNE_RE = /\battune\b|\bbond\b\s+(?:with|to)\b/i;

function tryAttune(w, text) {
  const t = String(text || '');
  if (!ATTUNE_RE.test(t)) return null;
  const pc = w.party?.[0];
  const items = pc?.inventory?.items || [];
  const candidates = items
    .map(it => ({ it, def: getItemDef(it.defRef) }))
    .filter(x => x.def && x.def.attunement && !x.it.sealedRef);
  if (!candidates.length) {
    return { world: w, output: { narration: `Wizard: Nothing you carry asks for that kind of bond — attunement is for the old and the named, and your pack holds neither.`, mechanics: '[attune:none]' } };
  }
  const hit = matchByName(t, candidates, (x) => x.def.name) || (candidates.length === 1 ? candidates[0] : null);
  if (!hit) {
    const names = candidates.map(c => c.def.name).join(', ');
    return { world: w, output: { narration: `Wizard: More than one thing in your pack would take the bond — which? (${names}.)`, mechanics: '[attune:which]' } };
  }
  if (hit.it.attuned) {
    return { world: w, output: { narration: `Wizard: The ${hit.def.name} is already yours in the way that matters — the bond holds.`, mechanics: '[attune:already]' } };
  }
  const attunedNow = items.filter(it => it.attuned);
  if (attunedNow.length >= 3) {
    const held = attunedNow.map(it => getItemDef(it.defRef)?.name || it.defRef).join(', ');
    return { world: w, output: { narration: `Wizard: Three bonds is all one soul can hold — ${held} already have their hooks in you. Let one go first.`, mechanics: '[attune:cap]' } };
  }
  let w1 = applyDeltas(w, [
    { op: 'removeItemById', entityId: pc.id, itemId: hit.it.id },
    { op: 'addItem', entityId: pc.id, item: { id: hit.it.id, defRef: hit.it.defRef, equipped: hit.it.equipped ?? null, attuned: true } },
    { op: 'time', key: 'hours', by: 1 }
  ]);
  w1 = pushEvent(w1, { kind: 'attune', data: { defRef: hit.it.defRef } });
  const pc1 = w1.party[0];
  let payoff = '';
  if (hit.def.kind === 'weapon' && hit.it.equipped === 'main_hand') {
    const prof = meleeProfile(pc1);
    payoff = ` In your grip it wakes: d${prof.die}${prof.dmgMod >= 0 ? '+' + prof.dmgMod : prof.dmgMod}, ${prof.atkBonus >= 0 ? '+' + prof.atkBonus : prof.atkBonus} to strike.`;
  } else if (hit.it.equipped) {
    payoff = ` Worn, it wakes: AC ${playerAc(pc1)}.`;
  } else {
    payoff = ' It will wake the moment you take it up.';
  }
  return {
    world: w1,
    output: {
      narration: `Wizard: You give the ${hit.def.name} an hour of your undivided self, and something in it turns toward you like a face.${payoff}`,
      mechanics: `[attune | ${hit.def.name}]`
    }
  };
}

const CONSUME_RE = /\b(?:drink|quaff|swig|down|use|take|swallow|apply|bind|wrap)\b.*\b(?:potion|draught|elixir|antidote|tonic|remedy|splint|dressing|bandage)s?\b|\bdrink\b.*\bhealing\b/i;

function tryUseConsumable(w, text) {
  const t = String(text || '');
  if (!CONSUME_RE.test(t)) return null;
  const pc = w.party?.[0];
  const carried = (pc?.inventory?.items || [])
    .map(it => ({ it, def: getItemDef(it.defRef) }))
    .filter(x => x.def && x.def.kind === 'consumable' && x.def.effect);
  if (!carried.length) {
    return { world: w, output: { narration: `Wizard: You turn out your pack — no potion, no draught, nothing to drink but water and resolve.`, mechanics: '[consume:none]' } };
  }
  const tl = t.toLowerCase();
  const found = carried.find(x => x.def.name.toLowerCase().split(/\s+/).some(wd => wd.length > 3 && tl.includes(wd))) || carried[0];

  if (found.def.effect.kind === 'heal') {
    const maxHp = Number(w.meta?.escapeMaxHp) || 0;
    const before = Number(w.meta?.escapeHp) || 0;
    if (maxHp > 0 && before >= maxHp) {
      return { world: w, output: { narration: `Wizard: You're already whole — the ${found.def.name.toLowerCase()} keeps better in the pack than in you.`, mechanics: '[consume:unneeded]' } };
    }
    const rng = makeRng(seedFromString(`${w.meta.seed}|consume|${w.timeline.length}`));
    const m = String(found.def.effect.amount || '1d4').match(/^(\d+)d(\d+)([+-]\d+)?$/);
    let heal = m ? parseInt(m[3] || '0', 10) : Math.max(1, Number(found.def.effect.amount) || 1);
    if (m) for (let i = 0; i < parseInt(m[1], 10); i++) heal += rng.int(1, parseInt(m[2], 10));
    heal = Math.max(1, heal);
    let w1 = applyDeltas(w, [{ op: 'removeItemById', entityId: pc.id, itemId: found.it.id }]);
    let line;
    const applied = Boolean(found.def.effect.applied);
    const took = applied ? `You bind the ${found.def.name.toLowerCase()} on tight` : `You drink the ${found.def.name.toLowerCase()} down`;
    if (maxHp > 0) {
      const after = Math.min(maxHp, before + heal);
      w1 = { ...w1, meta: { ...w1.meta, escapeHp: after } };
      line = `${took}. ${applied ? 'The ache settles to something you can walk on' : 'Warmth spreads from the chest out'} — ${after - before} HP back. (${after}/${maxHp}.)`;
    } else if ((pc.wounds || 0) > 0) {
      w1 = applyDeltas(w1, [{ op: 'wound', entityId: pc.id, amount: -1 }]);
      line = `${took}, and one of your wounds closes to a pale seam.`;
    } else {
      line = `${took}. ${applied ? 'Better safe than sorry' : 'Warmth, and the day looks slightly more survivable'}.`;
    }
    w1 = pushEvent(w1, { kind: 'consume', data: { defRef: found.def.defRef, effect: 'heal', amount: heal } });
    return { world: w1, output: { narration: `Wizard: ${line}`, mechanics: `[consume | ${found.def.name} | heal ${heal}]` } };
  }

  if (found.def.effect.kind === 'removeCondition') {
    const cond = String(found.def.effect.condition || '');
    const had = (pc.conditions || []).some(c => String(c?.name || c) === cond);
    let w1 = applyDeltas(w, [{ op: 'removeItemById', entityId: pc.id, itemId: found.it.id }]);
    if (had) {
      const conditions = (pc.conditions || []).filter(c => String(c?.name || c) !== cond);
      w1 = { ...w1, party: [{ ...w1.party[0], conditions }, ...w1.party.slice(1)] };
      w1 = pushEvent(w1, { kind: 'consume', data: { defRef: found.def.defRef, effect: 'removeCondition', condition: cond } });
      return { world: w1, output: { narration: `Wizard: The ${found.def.name.toLowerCase()} is bitter as bad news, but the ${cond} lifts like fog off a field.`, mechanics: `[consume | ${found.def.name} | cured ${cond}]` } };
    }
    return { world: w, output: { narration: `Wizard: Nothing ails you that a ${found.def.name.toLowerCase()} would fix — it keeps better corked.`, mechanics: '[consume:unneeded]' } };
  }

  return { world: w, output: { narration: `Wizard: The ${found.def.name.toLowerCase()} isn't something you can just drink to advantage right now.`, mechanics: '[consume:no-effect]' } };
}

function tryTrade(w, text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const buyM = t.match(TRADE_BUY_RE);
  const sellM = t.match(TRADE_SELL_RE);
  const browse = TRADE_BROWSE_RE.test(t);
  if (!buyM && !sellM && !browse) return null;
  // "buy you a drink" is charm, not commerce — leave it to the social layer.
  if (/\bbuy\s+(?:you|him|her|them|us)\b/i.test(t)) return null;

  const { node, shops } = shopsHere(w);
  if (!shops.length) {
    const where = node?.settlement ? 'No shop keeps a counter here' : 'There is no market out here';
    return { world: w, output: { narration: `Wizard: ${where} — coin is just weight until you reach a settlement with a shopfront.`, mechanics: '[trade:no-shop]' } };
  }
  const economy = economyAt(node);
  const pc = w.party?.[0];

  // ── browse ──
  if (browse && !buyM && !sellM) {
    const stock = settlementStock(w);
    if (!stock.length) {
      return { world: w, output: { narration: `Wizard: Shelves stand near bare — ${economy === 'desperate' ? 'this place is down to what it cannot spare' : 'nothing worth your coin today'}. Trade turns with the week.`, mechanics: '[trade:browse|empty]' } };
    }
    const byShop = {};
    for (const line of stock) (byShop[line.shopType] = byShop[line.shopType] || []).push(line);
    const parts = Object.entries(byShop).map(([type, lines]) =>
      `the ${type} has ${lines.map(l => `${l.name}${l.qty > 1 ? ` (×${l.qty})` : ''} at ${formatPrice(l.priceCopper)}`).join(', ')}`);
    return { world: w, output: { narration: `Wizard: ${capFirst(parts.join('; and '))}.`, mechanics: '[trade:browse]' } };
  }

  // ── sell ──
  if (sellM) {
    const items = pc?.inventory?.items || [];
    const owned = items.map(it => ({ ...it, def: getItemDef(it.defRef) })).filter(it => it.def);
    const hit = matchByName(sellM[1], owned, (it) => it.def.name);
    if (!hit) {
      return { world: w, output: { narration: `Wizard: You turn out your pack — nothing by that name you could put on a counter.`, mechanics: '[trade:sell|not-owned]' } };
    }
    const buyerIdx = shops.findIndex(sh => shopBuys(sh.type, hit.def));
    if (buyerIdx === -1) {
      const why = hit.def.kind === 'quest' ? 'turns it over once and slides it back — some things have no price here' : `has no use for a ${hit.def.name.toLowerCase()}`;
      return { world: w, output: { narration: `Wizard: The ${shops[0].type} keeper ${why}. No sale.`, mechanics: '[trade:sell|refused]' } };
    }
    const price = priceToSell(hit.def, economy);
    let w1 = applyDeltas(w, [
      { op: 'removeItemById', entityId: pc.id, itemId: hit.id },
      { op: 'setPurse', entityId: pc.id, purse: purseReceive(pc.purse, price) }
    ]);
    w1 = pushEvent(w1, { kind: 'trade', data: { action: 'sell', nodeId: node.id, shopIdx: buyerIdx, epoch: restockEpoch(w), defRef: hit.defRef, qty: 1, priceCopper: price } });
    return {
      world: w1,
      output: {
        narration: `Wizard: The ${shops[buyerIdx].type} keeper looks the ${hit.def.name.toLowerCase()} over${economy === 'desperate' ? ', sighs at the times,' : ''} and counts out ${formatPrice(price)}. It's theirs now.`,
        mechanics: `[trade:sell | ${hit.def.name} | +${formatPrice(price)}]`
      }
    };
  }

  // ── buy ──
  const stock = settlementStock(w);
  if (!stock.length) {
    return { world: w, output: { narration: `Wizard: The shelves are bare this week — nothing here to buy until stock turns.`, mechanics: '[trade:buy|empty]' } };
  }
  const want = matchByName(buyM[1], stock, (l) => l.name);
  if (!want) {
    const have = stock.slice(0, 4).map(l => l.name).join(', ');
    return { world: w, output: { narration: `Wizard: Nobody here sells that. What's on offer: ${have}.`, mechanics: '[trade:buy|not-stocked]' } };
  }
  const qtyM = buyM[1].match(/\b(\d+)\b/);
  const qty = Math.max(1, Math.min(want.qty, qtyM ? parseInt(qtyM[1], 10) : 1));

  // Haggle: one Persuasion check, priced by how badly the place needs coin.
  let unitPrice = want.priceCopper;
  let haggleNote = '';
  if (TRADE_HAGGLE_RE.test(t)) {
    const dc = economy === 'thriving' ? 12 : economy === 'stable' ? 13 : 15;
    const bonus = pc?.dnd ? (Number(pc.dnd.skills?.Persuasion) || 0) : statMod(pc?.stats?.CHARM ?? 10);
    const rng = makeRng(seedFromString(`${w.meta.seed}|haggle|${node.id}|${w.timeline.length}`));
    const roll = rng.int(1, 20);
    if (roll !== 1 && roll + bonus >= dc) {
      unitPrice = Math.max(1, Math.round(unitPrice * 0.85));
      haggleNote = ` You talk them down (Persuasion ${roll + bonus} vs DC ${dc}).`;
    } else {
      haggleNote = ` The keeper won't budge on the price (Persuasion ${roll + bonus} vs DC ${dc}).`;
    }
  }

  const cost = unitPrice * qty;
  const purseAfter = pursePay(pc?.purse, cost);
  if (!purseAfter) {
    const holding = purseTotalCopper(pc?.purse);
    return {
      world: w,
      output: {
        narration: `Wizard: The ${want.name.toLowerCase()} runs ${formatPrice(cost)}${qty > 1 ? ' for the lot' : ''} — and you're holding ${holding ? formatPrice(holding) : 'an empty purse'}. The keeper is sympathetic, not charitable.`,
        mechanics: `[trade:buy | ${want.name} ×${qty} | short ${formatPrice(cost - holding)}]`
      }
    };
  }

  const deltas = [{ op: 'setPurse', entityId: pc.id, purse: purseAfter }];
  for (let i = 0; i < qty; i++) {
    deltas.push({ op: 'addItem', entityId: pc.id, item: { id: `buy_${node.id}_${w.timeline.length}_${i}`, defRef: want.defRef, equipped: null } });
  }
  let w1 = applyDeltas(w, deltas);
  w1 = pushEvent(w1, { kind: 'trade', data: { action: 'buy', nodeId: node.id, shopIdx: want.shopIdx, epoch: restockEpoch(w), defRef: want.defRef, qty, priceCopper: cost } });
  return {
    world: w1,
    output: {
      narration: `Wizard: You count out ${formatPrice(cost)} onto the ${want.shopType} counter.${haggleNote} ${qty > 1 ? `${qty} of them, wrapped and handed over` : `The ${want.name.toLowerCase()} is yours`}.`,
      mechanics: `[trade:buy | ${want.name} ×${qty} | -${formatPrice(cost)}]`
    }
  };
}

function tryExamineTarget(w, text) {
  if (!INSPECT_VERB.test(String(text || ''))) return null;
  const target = extractInspectTarget(text);
  if (!target || GENERIC_LOOK_TARGET.has(target)) return null; // bare look → overview
  const tWords = target.split(/\s+/).filter(Boolean);
  const tail = tWords[tWords.length - 1];

  const node = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
  const furniture = Array.isArray(node?.furniture) ? node.furniture : [];

  // 1) Furniture present at the location.
  const f = furniture.find(x => nameMatches(x?.name, target, tail));
  if (f) {
    const notes = String(f.notes || '').trim().replace(/[.?!]+$/, '');
    const state = String(f.state || 'intact');
    const stateClause = state === 'open' || state === 'ajar' ? ` It stands open.`
      : state === 'closed' ? ''
      : state && state !== 'intact' ? ` It looks ${state}.` : '';
    const parts = Array.isArray(f.parts) ? f.parts.filter(Boolean).slice(0, 3) : [];
    const partsClause = parts.length ? ` You make out its ${parts.join(', ')}.` : '';
    return `You look the ${f.name} over${notes ? `: ${notes}.` : '.'}${stateClause}${partsClause}`;
  }

  // 2) Something the player is carrying.
  const item = allInventoryItems(w).find(it => nameMatches(it?.name, target, tail));
  if (item) {
    const note = String(item.note || '').replace(/\s*Type\s+"[^"]*"\.?\s*$/i, '').trim().replace(/[.?!]+$/, '');
    return `You turn the ${item.name} over in your hands${note ? `: ${note}.` : '.'}`;
  }

  // 3) Named but not here — pivot to what actually is, so the answer stays grounded.
  if (furniture.length) {
    const names = furniture.slice(0, 3).map(x => String(x.name)).filter(Boolean);
    const list = names.length === 1 ? names[0]
      : names.length === 2 ? `${names[0]} and ${names[1]}`
      : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
    return `You look for ${target.match(/^[aeiou]/) ? 'an' : 'a'} ${target}, but what's here is ${list}.`;
  }

  // Nothing to anchor to — let the room-overview explore branch answer.
  return null;
}

function isExploreIntent(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return false;
  // Broad observation/perception: anything that is purely sensory or informational
  // and requires no skill check. Covers "look around", "what do I see", "describe",
  // "listen", "smell", inventory/status checks, reading signs, etc.
  // Searching for HIDDEN things is a skill check, not a free survey — the
  // fiction resists (the tracks don't want to be found).
  if (/\b(hidden|tracks?|trail|clues?|secret|conceal)\w*/.test(t)) return false;
  if (/\b(look around|look about|survey|scan|search the area|where can i go|where do i go|options|exits|way out|how do i get out|get out of here|leave this place)\b/.test(t)) return true;
  // "What do I see / what's here / what is in this room / how big / what does X look like"
  if (/^(what|how|where|who|describe)\b/.test(t) && !/\b(pick|climb|force|break|fight|attack|try|attempt|sneak|steal|persuade|deceive|track|forage|decipher|calm|leap|jump)\b/.test(t)) return true;
  // Yes/no DM questions: "Is there a window?", "Are there any people?", "Is the door open?"
  if (/^(is\s+(there|the|it|this|that)|are\s+(there|they|the|these|those|any))\b/.test(t) && !/\b(try|attempt|pick|climb|force|break|fight|attack|sneak|steal|persuade|deceive)\b/.test(t)) return true;
  // "I look at X" / "I read X" / "I listen" / "I smell" / "I check my inventory"
  // "I examine X" / "I watch X" / "I peer" / "I inspect" / "I study" (passive)
  if (/\bi\s+(look\s+at|read|listen|smell|check\s+(my\s+)?inventory|check\s+my|observe|examine|watch|peer|inspect|study|gaze|glance|scan|survey)\b/.test(t)) return true;
  return false;
}

// classifyTrivial — recognizes everyday auto-success actions in BOTH first-person
// ("I open the crate") and bare-imperative ("open the crate") forms, returning
// { cat, verb, object? } or null. Skill/risky verbs (lock, force, pry, break,
// climb, pick the lock, …) are excluded so they continue to roll.
function classifyTrivial(text) {
  const t = String(text || '').toLowerCase().trim().replace(/[.!?]+$/, '');
  if (!t) return null;
  const L = '(?:i\\s+|i\'?d\\s+like\\s+to\\s+|let\\s+me\\s+)?'; // optional first-person lead

  let m;
  // Body / posture (no object)
  m = t.match(new RegExp(`^${L}(sit\\s+down|sit|stand\\s+up|stand|kneel|bow|nod|wave|stretch|yawn|rest|pray|dismount|whistle|hum)\\b`));
  if (m) return { cat: 'body', verb: m[1].replace(/\s+/g, ' ') };

  // Draw / ready a weapon. WEAPON_NOUN covers the common armory so "draw my
  // warhammer" works; restricted to a known list so "draw water"/"draw a map"
  // don't get mistaken for equipping.
  const WEAPON_NOUN = '(?:sword|weapon|blade|axe|dagger|mace|spear|knife|warhammer|hammer|flail|staff|wand|rapier|scimitar|sabre|saber|cutlass|club|glaive|halberd|bow|crossbow|sling|whip|longsword|shortsword|greatsword|rod|baton|pike|lance)';
  m = t.match(new RegExp(`^${L}(draw|ready|unsheathe|raise)\\s+(?:my\\s+|the\\s+)?${WEAPON_NOUN}\\b`));
  if (m) return { cat: 'draw', verb: m[1] };
  // Sheathe / put away a weapon
  m = t.match(new RegExp(`^${L}(sheathe|sheath|put\\s+away|lower)\\s+(?:my\\s+|the\\s+)?${WEAPON_NOUN}\\b`));
  if (m) return { cat: 'sheathe', verb: m[1] };

  // Open / close / shut an object — but never the risky variants (pick/force/pry).
  m = t.match(new RegExp(`^${L}(open|close|shut)\\s+(?:the\\s+|a\\s+|an\\s+|my\\s+)?(.+)$`));
  if (m && !/\b(lock|locked|force|pry|prise|break|bash|smash|jimmy)\b/.test(t)) {
    return { cat: m[1] === 'open' ? 'open' : 'close', verb: m[1], object: m[2].replace(/[.!?,]+$/, '').trim() };
  }

  // Consume / light
  m = t.match(new RegExp(`^${L}(eat|drink|light)\\b`));
  if (m) return { cat: 'consume', verb: m[1] };

  // Wear / remove / drop gear
  m = t.match(new RegExp(`^${L}(put\\s+on|take\\s+off|drop)\\s+(?:my\\s+|the\\s+)?(.+)$`));
  if (m) return { cat: 'gear', verb: m[1].replace(/\s+/g, ' '), object: m[2].replace(/[.!?,]+$/, '').trim() };

  // Social pleasantries
  m = t.match(new RegExp(`^${L}(say\\s+hello|greet|introduce\\s+myself|thank|nod\\s+in|sing)\\b`));
  if (m) return { cat: 'social', verb: m[1].replace(/\s+/g, ' ') };

  return null;
}

function playerWeaponName(w) {
  const wpns = w?.party?.[0]?.inventory?.weapons;
  return Array.isArray(wpns) && wpns[0]?.name ? String(wpns[0].name) : null;
}

function furnitureNameAt(w, target) {
  if (!target) return null;
  const tail = String(target).split(/\s+/).filter(Boolean).pop();
  const node = (w?.map?.nodes || []).find(n => n && n.id === w?.map?.currentNodeId) || null;
  const furn = Array.isArray(node?.furniture) ? node.furniture : [];
  const f = furn.find(x => nameMatches(x?.name, target, tail));
  return f ? String(f.name) : null;
}

// ── Stage D: consequence & permanence — open/close persists ──────────────────
// "open the crate" doesn't just narrate; it mutates the furniture's state to `open`
// (close → `closed`) via a modifyFurniture delta, so a later examine, the room
// overview, and a return visit all remember it. Re-doing it acknowledges the prior
// state instead of repeating. Destructive verbs (break/smash/take) already persist
// via the physics branch; force/pry persistence is a later slice. Determinism-safe:
// replay re-runs the text → the same deterministic mutation; furniture isn't hashed.
// Returns { world, output } when it handles a real furniture piece, else null (so the
// trivial gate still handles "open the door" when no such piece is here).
const OPENED_STATES = new Set(['open', 'ajar']);
const DAMAGED_STATES = new Set(['broken', 'damaged', 'shattered', 'smashed']);

function tryFurnitureStateChange(w, text) {
  const c = classifyTrivial(text);
  if (!c || (c.cat !== 'open' && c.cat !== 'close')) return null;
  const target = String(c.object || '').trim();
  if (!target) return null;
  const node = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
  const furniture = Array.isArray(node?.furniture) ? node.furniture : [];
  if (!furniture.length) return null;
  const tail = target.split(/\s+/).filter(Boolean).pop();
  const idx = furniture.findIndex(x => nameMatches(x?.name, target, tail));
  if (idx < 0) return null; // not a real piece here → let the trivial gate answer
  const f = furniture[idx];
  const name = String(f.name);
  const cur = String(f.state || 'intact');
  const wantOpen = c.cat === 'open';
  const TRIVIAL_MECH = 'trivial action — no roll, auto-success';
  const isOpen = OPENED_STATES.has(cur);

  // Already in the requested state → acknowledge, don't re-mutate.
  if (wantOpen && isOpen) {
    return { world: w, output: { narration: `Wizard: The ${name} already stands open.`, mechanics: TRIVIAL_MECH } };
  }
  if (!wantOpen && !isOpen) {
    const why = DAMAGED_STATES.has(cur) ? `The ${name} is too far gone to close.` : `The ${name} is already shut.`;
    return { world: w, output: { narration: `Wizard: ${why}`, mechanics: TRIVIAL_MECH } };
  }

  const newState = wantOpen ? 'open' : 'closed';
  let w1 = applyDeltas(w, [{ op: 'modifyFurniture', nodeId: String(node.id), furnitureId: idx, changes: { state: newState } }]);
  w1 = pushEvent(w1, {
    kind: 'resolution',
    data: { actorId: 'party', intent: String(text || ''), text: String(text || ''), roll: 0, dc: 0, outcome: 'success', updateKind: `furniture:${newState}` }
  });
  const damaged = DAMAGED_STATES.has(cur);
  const line = wantOpen
    ? (damaged ? `You haul the ${name} open; battered as it is, it stays open now.` : `You open the ${name}; it stands open now.`)
    : `You swing the ${name} shut.`;
  return { world: w1, output: { narration: `Wizard: ${line}`, mechanics: TRIVIAL_MECH } };
}

// ── Stage B: ground the floor for resolved PHYSICAL actions ─────────────────
// "force the door", "break the crate", "climb the wall", "pick the lock" — a real
// DM names the thing and says what happened. Returns outcome-aware prose (or null
// to let the composer handle it — social/stealth/abstract intents). `outcome` is
// 'success' | 'mixed' | 'failure' from resolveMove.
const PHYS_FORCE = /\b(force|break|smash|bash|kick|shove|wrench|pry|prise|prize|budge|heave|topple|tip|knock|pull|lift|move|drag|haul|push|tear|rip|snap)\b/i;
const PHYS_CLIMB = /\b(climb|scale|clamber|scramble up|scramble over)\b/i;
const PHYS_PICK = /\bpick(?:ing)?\b/i;

function physObjTarget(text) {
  const t = String(text || '').toLowerCase();
  const m = t.match(/(?:force|break|smash|bash|kick|shove|wrench|pry|prise|prize|budge|heave|topple|tip|knock|pull|lift|move|drag|haul|push|tear|rip|snap|climb|scale|clamber|pick|open|over|up|down|through|into|across)\s+(?:open\s+)?(?:the|a|an|that|this|my|some)?\s*([a-z][a-z' -]*?)(?:\s+(?:open|down|up|shut|apart|aside|over|loose|free))?\s*$/i);
  if (!m) return '';
  return m[1].replace(/\b(open|down|up|shut|apart|aside|over|loose|free|the|a|an)\b/gi, '').trim();
}

function physicalObjectOutcome(world, text, outcome) {
  const t = String(text || '');
  // "pick" only counts when it's a lock-type target (not "pick up" — that's a take).
  const isPick = PHYS_PICK.test(t) && !/\bpick\s+up\b/i.test(t) && /\block|chest|door|gate|safe|strongbox|cabinet|drawer\b/i.test(t);
  const isClimb = PHYS_CLIMB.test(t);
  const isForce = PHYS_FORCE.test(t) && !/\bpick\s+up\b/i.test(t);
  if (!isPick && !isClimb && !isForce) return null;

  let target = physObjTarget(t);
  if (!target || GENERIC_LOOK_TARGET.has(target)) target = '';
  const named = (target && furnitureNameAt(world, target)) || target;
  const o = outcome === 'success' ? 's' : outcome === 'failure' ? 'f' : 'm';

  if (isClimb) {
    const what = named || 'it';
    return o === 's' ? `Wizard: You find your holds and haul yourself up the ${what} and over the top.`
      : o === 'm' ? `Wizard: You make it up the ${what}, but it costs you — knuckles raw, breath ragged at the top.`
      : `Wizard: You get a body-length up the ${what} before a hold crumbles and you slide back down.`;
  }
  if (isPick) {
    const what = named || 'lock';
    return o === 's' ? `Wizard: You feel the ${what} out pin by pin; the last one drops and it springs open.`
      : o === 'm' ? `Wizard: The ${what} gives — but your pick bends in the doing and won't serve a second time.`
      : `Wizard: The ${what} resists every twist and probe; it holds.`;
  }
  // force / move an object
  const what = named || target || 'it';
  return o === 's' ? `Wizard: You set yourself and force the ${what}; it gives with a splintering crack and yields.`
    : o === 'm' ? `Wizard: The ${what} gives at last — but the wood splinters and the noise carries further than you'd like.`
    : `Wizard: You throw your weight against ${/^(it|that|this|them)$/i.test(what) ? what : `the ${what}`}, again and again, but it holds fast.`;
}

// ── Stage B: argued SOCIAL adjudication ─────────────────────────────────────
// The player speaks/argues at an NPC in their own words. We read the approach and
// the lever they claim, judge plausibility + argument quality, and roll the fitting
// stat against the NPC's PERSONALITY. Different people fold to different pressures.
const SOCIAL_DEFAULT_STAT = { intimidate: 'GRIT', charm: 'CHARM', deceive: 'WITS', persuade: 'CHARM' };
const SOCIAL_PLAUSIBLE = {
  intimidate: new Set(['GRIT', 'MIGHT', 'CHARM', 'WITS']),
  charm: new Set(['CHARM', 'WITS', 'AGILITY']),
  deceive: new Set(['WITS', 'CHARM']),
  persuade: new Set(['CHARM', 'WITS', 'GRIT'])
};
const LEVER_WORDS = {
  MIGHT: /\b(strength|muscle|muscles|brawn|might|power|powerful|strong|raw force|sheer force|brute)\b/i,
  AGILITY: /\b(agility|speed|quickness|nimbleness|grace|graceful|reflexes|deft|deftness|footwork|nimble)\b/i,
  WITS: /\b(wit|wits|cleverness|clever|intellect|intelligence|mind|smarts|cunning|sharp tongue|quick tongue|brains|guile)\b/i,
  GRIT: /\b(grit|will|willpower|resolve|nerve|nerves|toughness|steel|presence|force of will|steely|cold stare|hard eyes)\b/i,
  CHARM: /\b(charm|charisma|looks|beauty|beautiful|handsome|good looks|smile|allure|magnetism|silver tongue|winning way)\b/i
};

function detectApproach(t) {
  if (/\b(intimidate|threaten|menace|scare|frighten|cow|or i'?ll|or else|back off|out of my way|flay|kill you|hurt you|break you|gut you|make you regret|do as i say|or you'?ll regret)\b/i.test(t)) return 'intimidate';
  if (/\b(deceive|\blie\b|bluff|trick|fool|mislead|pretend|claim\b|make .* believe|convince .* that i|(?:i'?m|i am) the (?:new|royal|king|lord|captain|sheriff|the|a)|tell (?:him|her|them|the \w+) (?:i'?m|i am|that))\b/i.test(t)) return 'deceive';
  if (/\b(charm|flatter|flirt|seduce|sweet.?talk|compliment|woo|win .* over|befriend|make .* laugh|tell .* (a )?joke|hey (sexy|gorgeous|beautiful|handsome|cutie)|you look (great|lovely|beautiful|amazing|good)|buy you a|take you (out|to dinner)|dinner later)\b/i.test(t)) return 'charm';
  if (/\b(persuade|convince|reason with|bargain|negotiate|appeal to|talk .* into|plead|beg|ask .* to let|let me (in|pass|through|by)|please let|hear me out)\b/i.test(t)) return 'persuade';
  return null;
}

function detectLever(t) {
  // A lever only counts when the player is clearly invoking an attribute.
  if (!/\b(use|using|with|by|my|superior|awesome|sheer|raw|great|formidable|considerable)\b/i.test(t)) return null;
  for (const [stat, re] of Object.entries(LEVER_WORDS)) { if (re.test(t)) return stat; }
  return null;
}

function socialQuality(t) {
  const claimsPerformance = /\b(joke|song|poem|story|riddle|speech|tale|ballad|verse)\b/i.test(t);
  const hasContent = /["“'][^"”']{4,}["”']|:\s*\S+|—\s*["“']?\S/.test(t); // a quoted line or spoken content
  const words = String(t).split(/\s+/).filter(Boolean).length;
  if (claimsPerformance && !hasContent && words < 14) return -2; // "I tell a joke" with no joke
  if (hasContent) return 2;        // they actually said it
  if (words >= 14) return 2;       // a vivid, specific argument
  if (words >= 9) return 1;
  return 0;
}

function socialDC(approach, npc, morality) {
  const P = npc?.personality || { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 };
  const trust = Number(npc?.conversationState?.trustLevel ?? 5); // 0-10
  let dc = 12;
  if (approach === 'intimidate') dc -= (P.selfPreservation - 0.5) * 12;            // fearful → easier; brave → harder
  else if (approach === 'charm') dc -= (P.trustOfOutsiders - 0.5) * 8 + (trust - 5) * 0.6;
  else if (approach === 'persuade') dc -= (P.trustOfOutsiders - 0.5) * 6 + (trust - 5) * 0.8;
  else if (approach === 'deceive') dc -= (P.trustOfOutsiders - 0.5) * 8 - (0.5 - P.honesty) * 6; // trusting easier; street-smart harder
  if (npc?.hostile) dc += 3;
  // M2 — your soul precedes your words. A corrupt reputation makes the world warier
  // (charm/persuade/deceive harder) and more cowed (intimidate easier); virtue is trusted.
  const corr = Number(morality?.corruption ?? 0) / 100; // 0..1
  const virt = Number(morality?.virtue ?? 0) / 100;     // 0..1
  if (approach === 'intimidate') dc -= corr * 6;                  // the feared cow easily
  else if (approach === 'deceive') dc += corr * 5;                // the known-corrupt are distrusted
  else { dc += corr * 6; dc -= virt * 4; }                        // charm/persuade: corruption repels, virtue draws
  return Math.max(5, Math.round(dc));
}

// Resolve who the player is addressing: the active dialogue NPC, an NPC named/role
// in the text, or the first person at the node. Null if no one is here.
function socialTarget(world, text) {
  const nodeId = String(world?.map?.currentNodeId || '');
  const node = (world?.map?.nodes || []).find(n => n && n.id === nodeId) || null;
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  if (!npcs.length) return null;
  const dlgId = world?.scene?.dialogue?.npcId;
  if (dlgId) { const a = npcs.find(n => String(n.id) === String(dlgId)); if (a) return a; }
  const t = String(text || '').toLowerCase();
  const byName = npcs.find(n => { const nm = normName(n?.name).trim(); return nm && t.includes(nm); });
  if (byName) return byName;
  const byRole = npcs.find(n => { const r = String(n?.role || '').toLowerCase(); return r && t.includes(r); });
  if (byRole) return byRole;
  return npcs[0];
}

function setNpcTrust(world, npcId, delta) {
  const nodeId = String(world?.map?.currentNodeId || '');
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  const ni = nodes.findIndex(n => n && n.id === nodeId);
  if (ni < 0) return world;
  const node = nodes[ni];
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  const pi = npcs.findIndex(n => String(n?.id) === String(npcId));
  if (pi < 0) return world;
  const npc = npcs[pi];
  const cs = npc.conversationState || {};
  const next = Math.max(0, Math.min(10, Number(cs.trustLevel ?? 5) + delta));
  const newNpc = { ...npc, conversationState: { ...cs, trustLevel: next, metPlayer: true } };
  const newNpcs = [...npcs]; newNpcs[pi] = newNpc;
  const newNodes = [...nodes]; newNodes[ni] = { ...node, settlement: { ...node.settlement, npcs: newNpcs } };
  return { ...world, map: { ...world.map, nodes: newNodes } };
}

function socialLeverClause(stat) {
  return ({ MIGHT: ' with a display of raw strength', AGILITY: ' with effortless grace', WITS: ' with a sharp, clever turn', GRIT: ' on sheer force of presence', CHARM: ' on a silver tongue' })[stat] || '';
}

function socialNarration(approach, outcome, name, lever) {
  const o = outcome;
  if (approach === 'intimidate') {
    return o === 'success' ? `${name} weighs you${lever}, and whatever they see is enough — the defiance drains out of them and they give way.`
      : o === 'mixed' ? `${name} doesn't fold, but doesn't push back either — a wary stand-off, their eyes on your hands.`
      : `${name} doesn't so much as blink. "Bigger than you have tried," and they mean it.`;
  }
  if (approach === 'charm') {
    return o === 'success' ? `${name} warms despite themselves${lever}, a smile breaking through.`
      : o === 'mixed' ? `${name} allows a thin smile but keeps their guard up — flattered, not won.`
      : `${name} is unmoved; your charm slides off them like rain off slate.`;
  }
  if (approach === 'deceive') {
    return o === 'success' ? `${name} buys it${lever}, nodding along to a story that isn't true.`
      : o === 'mixed' ? `${name} half-believes you, but a flicker of doubt lingers.`
      : `${name} sees right through it. "Try that on someone greener."`;
  }
  // persuade
  return o === 'success' ? `${name} hears you out${lever} and comes around to your way of thinking.`
    : o === 'mixed' ? `${name} won't commit, but you've planted a seed — they'll think on it.`
    : `${name} shakes their head; your reasons don't land.`;
}

// Resolve a social influence attempt (intimidate/charm/deceive/persuade) against an
// NPC, weighted by the NPC's personality and your argument. Returns {world,output}
// or null (not a social attempt → let the normal resolver handle it).
function resolveSocialAdjudication(world, text) {
  const approach = detectApproach(text);
  if (!approach) return null;
  const npc = socialTarget(world, text);
  if (!npc) {
    return { world, output: { narration: `Wizard: There's no one here to sway.`, mechanics: '[social:no-target]' } };
  }
  const claimedLever = detectLever(text);
  const plausible = Boolean(claimedLever && SOCIAL_PLAUSIBLE[approach].has(claimedLever));
  const stat = plausible ? claimedLever : SOCIAL_DEFAULT_STAT[approach];
  const quality = socialQuality(text);
  const dc = socialDC(approach, npc, world?.party?.[0]?.morality);
  const rng = makeRng(seedFromString(`${world.meta.seed}|social|${npc.id}|${approach}|${world.timeline.length}`));
  const roll = rng.int(1, 20);
  const total = roll + statMod(Number(world.party?.[0]?.stats?.[stat] ?? 10)) + quality;
  const margin = total - dc;
  const outcome = margin >= 2 ? 'success' : margin >= -3 ? 'mixed' : 'failure';
  const trustDelta = {
    intimidate: { success: -1, mixed: 0, failure: -2 },
    charm: { success: 1, mixed: 0, failure: -1 },
    persuade: { success: 1, mixed: 0, failure: -1 },
    deceive: { success: 1, mixed: 0, failure: -2 }
  }[approach][outcome];
  let w1 = setNpcTrust(world, npc.id, trustDelta);
  w1 = pushEvent(w1, { kind: 'resolution', data: { actorId: 'party', text: String(text || ''), intent: String(text || ''), roll, dc, outcome, updateKind: `social:${approach}` } });
  const name = String(npc.name || `the ${npc.role || 'stranger'}`);
  const lever = plausible ? socialLeverClause(stat) : '';
  let line = socialNarration(approach, outcome, name, lever);
  // A DM's sentence starts with a capital, even when the NPC's "name" is an article
  // ("the trader warms…" → "The trader warms…").
  line = line.charAt(0).toUpperCase() + line.slice(1);
  const q = quality ? ` | argued${quality > 0 ? '+' : ''}${quality}` : '';
  return { world: w1, output: { narration: `Wizard: ${line}`, mechanics: `[social:${approach}|${stat}|roll:${roll} vs DC:${dc} → ${outcome}${q}]` } };
}

// Non-object MECHANICAL skills (search/sneak/hide/track/forage) — ground their
// resolved outcome too, so they don't fall to the abstract floor. SOCIAL verbs
// (persuade/intimidate/lie/calm) are intentionally NOT here: they want an NPC and
// belong to a dialogue-integrated pass. Returns prose or null.
function nonObjectSkillOutcome(text, outcome) {
  const t = String(text || '').toLowerCase();
  const o = outcome === 'success' ? 's' : outcome === 'failure' ? 'f' : 'm';
  if (/\b(search|investigate|comb|scour|rummage|ransack|look for|hunt for|dig through|sift)\b/.test(t)) {
    return o === 's' ? `Wizard: You search methodically, and your patience pays off — something turns up.`
      : o === 'm' ? `Wizard: You find a little for your trouble, but the searching costs time you may not have.`
      : `Wizard: You search high and low and turn up nothing worth the effort.`;
  }
  if (/\b(sneak|hide|creep|slink|skulk|stalk|steal past|stay hidden|keep to the shadows)\b/.test(t)) {
    return o === 's' ? `Wizard: You move soft and low, keeping to cover — and pass unseen.`
      : o === 'm' ? `Wizard: You make it, but a scuff of sound at the wrong moment nearly gives you away.`
      : `Wizard: You misjudge a shadow and break cover at the worst moment.`;
  }
  if (/\b(track|trail|follow the|pick up the trail)\b/.test(t)) {
    return o === 's' ? `Wizard: You read the ground — bent grass, a print in the mud — and pick up the trail.`
      : o === 'm' ? `Wizard: You follow the trail a while before it grows faint and hard to hold.`
      : `Wizard: The trail breaks up on hard ground and goes cold.`;
  }
  if (/\b(forage|scavenge|gather|hunt|fish)\b/.test(t)) {
    return o === 's' ? `Wizard: You work the land patiently and come away with enough to get by.`
      : o === 'm' ? `Wizard: You scrape together a little, though it costs you the better part of an hour.`
      : `Wizard: The land offers nothing you can use.`;
  }
  return null;
}

// ── Stage F: general grounded fallback (kill the abstract floor everywhere) ──
// The composer's deterministic narration, AI-off, falls to an abstract literary floor
// ("a low hum threads through the walls … what do you do?") for any action without a
// specific handler. THE_DM_TEST forbids that: a DM names the action and says what
// happened. When the composed line IS that floor, we replace it with grounded,
// outcome-aware prose. Narration only (no state, no RNG) → determinism-safe.
const ABSTRACT_FLOOR_RE = /low hum threads|meaning slips|picture refuses|force bleeds out against stone|a thread of strain runs/i;

function placeNameOf(world) {
  const node = ((world?.map?.nodes) || []).find(n => n && n.id === world?.map?.currentNodeId) || null;
  return cleanPlaceName(node?.name) || 'here';
}

function takeTargetOf(text) {
  const m = String(text || '').toLowerCase().match(/\b(?:take|grab|pick up|snatch|seize|collect|loot|pocket|claim|lift)\s+(?:the|a|an|that|this|my|some)?\s*([a-z][a-z' -]*?)\s*$/i);
  return m ? m[1].replace(/\b(up|the|a|an)\b/gi, '').trim() : '';
}

// ── Stage E: deterministic variation (a DM never repeats verbatim) ───────────
// Pick one of several grounded variants by deterministic ROTATION: a per-(seed,node,key)
// base offset plus the timeline length. Same world-state + key → same pick (replay/
// determinism preserved); each new turn advances the timeline → the next variant, so
// consecutive repeats of the same action never echo verbatim. Every variant must be
// equally grounded and outcome-correct.
function pickVariant(variants, world, key) {
  if (!Array.isArray(variants) || variants.length === 0) return '';
  if (variants.length === 1) return variants[0];
  const base = seedFromString(`${world?.meta?.seed || ''}|var|${world?.map?.currentNodeId || ''}|${key}`);
  // Count resolved actions (one `resolution` event per resolved turn) for a reliable
  // +1-per-action ordinal — timeline.length itself jumps by varying amounts per turn,
  // which can land on the same index twice in a row. This guarantees consecutive
  // repeats of the same action rotate to the next variant. Deterministic on replay.
  const t = (Array.isArray(world?.timeline) ? world.timeline : []).reduce((n, e) => n + (e && e.kind === 'resolution' ? 1 : 0), 0);
  const idx = (((base + t) % variants.length) + variants.length) % variants.length;
  return variants[idx];
}

// Grounded prose for any resolved non-combat action that would otherwise floor.
function genericGroundedOutcome(world, text, outcome) {
  const t = String(text || '').toLowerCase().trim();
  const o = outcome === 'success' ? 's' : outcome === 'failure' ? 'f' : 'm';
  const place = placeNameOf(world);
  const V = (key, variants) => `Wizard: ${pickVariant(variants, world, key)}`;

  if (/\b(take|grab|pick up|snatch|seize|collect|loot|pocket|claim)\b/.test(t)) {
    const what = takeTargetOf(t) || 'it';
    return o === 's' ? V(`take:s:${what}`, [`You take the ${what} and stow it.`, `You pocket the ${what} and move on.`, `The ${what} is yours now, tucked away.`])
      : o === 'm' ? V(`take:m:${what}`, [`You get a hand on the ${what}, though carrying it off is more awkward than you'd hoped.`, `You take the ${what}, but it's bulkier than it looked.`])
      : V(`take:f:${what}`, [`You reach for the ${what}, but it doesn't come away so easily — it stays put.`, `The ${what} won't budge for you; you leave it where it is.`]);
  }
  if (/\b(ask|inquire|enquire|question|query)\b/.test(t)) {
    return o === 's' ? V('ask:s', [`You put the question to those nearby, and a useful answer comes back.`, `You ask around, and someone gives you something real to go on.`])
      : o === 'm' ? V('ask:m', [`You ask around; what you get is partial, hedged, and slow in coming.`, `You get half an answer, wrapped in caution.`])
      : V('ask:f', [`You ask, but no one here will give you a straight answer.`, `Your question lands on closed faces and shrugs.`]);
  }
  if (/\b(listen|hear|eavesdrop)\b/.test(t)) {
    return o === 's' ? V('listen:s', [`You go still and listen; ${place} gives up its small sounds, and one of them matters.`, `You hold your breath and listen — beneath the noise of ${place}, something tells.`])
      : o === 'm' ? V('listen:m', [`You listen hard, but the sounds of ${place} blur together.`, `You catch a thread of sound, then lose it in the din of ${place}.`])
      : V('listen:f', [`You listen, and hear nothing that helps.`, `Whatever you strain for, ${place} keeps it from you.`]);
  }
  if (/\b(smell|sniff|scent)\b/.test(t)) {
    return o === 's' ? V('smell:s', [`You draw a slow breath; the air of ${place} carries something worth noting.`, `You scent the air — under ${place}'s usual reek, one note stands out.`])
      : o === 'm' ? V('smell:m', [`You catch a tangle of smells, nothing you can place.`, `The air gives you a muddle of scents and no clear read.`])
      : V('smell:f', [`The air tells you nothing new.`, `You breathe deep and learn nothing.`]);
  }
  if (/\b(wait|linger|pause|bide|stay put|do nothing)\b/.test(t) || /\bhold (?:still|on)\b/.test(t)) {
    return o === 'f' ? V('wait:f', [`You wait, and the time you spend earns you nothing.`, `You hold still, and the wait costs you more than it gives.`])
      : V('wait:s', [`You wait, watchful, and let the moment in ${place} run on.`, `You bide your time, eyes moving over ${place}.`, `You hold where you are, patient, taking ${place} in.`]);
  }
  if (/\b(read|peruse)\b/.test(t) || /\bstudy the (?:sign|note|book|scroll|inscription|writing)\b/.test(t)) {
    return o === 's' ? V('read:s', [`You read it through, and the meaning comes clear.`, `The words give up their sense as you read.`])
      : o === 'm' ? V('read:m', [`You make out most of it, though some of it stays murky.`, `You get the gist, but parts of it slip past you.`])
      : V('read:f', [`The writing won't resolve into sense.`, `The marks stay stubborn; you can't make them out.`]);
  }
  if (/\b(cast|invoke|channel|conjure|summon|chant|incant)\b/.test(t)) {
    return o === 's' ? V('cast:s', [`You shape the working, and it answers — power moving the way you intend.`, `The working takes cleanly; the power bends to your will.`])
      : o === 'm' ? V('cast:m', [`The working takes, but rough; it costs more than it should and frays at the edges.`, `You force the working through — it holds, barely, and leaves you wrung out.`])
      : V('cast:f', [`You reach for the working and it slips your grasp — nothing answers.`, `The working guts out in your hands; nothing comes.`]);
  }
  // Generic last resort: grounded, in-fiction, no abstract filler, no mechanical prompt.
  return o === 's' ? V('gen:s', [`You see it through, and it goes your way.`, `It comes off cleanly; the moment turns toward you.`, `You manage it, and the way ahead opens a little.`])
    : o === 'm' ? V('gen:m', [`It half-works — you get part of what you were after, not all of it.`, `You get something out of it, though not what you hoped.`, `It lands, after a fashion — partial, imperfect.`])
    : V('gen:f', [`It doesn't come off the way you meant; the moment slips past you in ${place}.`, `It falls short here in ${place}, and you're left where you started.`, `Whatever you meant to do, ${place} doesn't give it to you.`]);
}

// Grounded combat beat for when the composer floors during a combat turn.
function combatGroundedOutcome(world, enemyName, outcome) {
  const foe = String(enemyName || '').trim() || 'your foe';
  const o = outcome === 'success' ? 's' : outcome === 'failure' ? 'f' : 'm';
  const V = (key, variants) => `Wizard: ${pickVariant(variants, world, key)}`;
  return o === 's' ? V(`cb:s:${foe}`, [`Your strike lands true against ${foe}; they reel from the blow.`, `You catch ${foe} clean — they stagger back, hurting.`, `Your blow gets through ${foe}'s guard and tells.`])
    : o === 'm' ? V(`cb:m:${foe}`, [`You trade blows with ${foe} — your hit glances, theirs nearly answers.`, `You and ${foe} clash; neither of you gives ground cleanly.`])
    : V(`cb:f:${foe}`, [`${foe} turns your attack aside, and the opening costs you.`, `${foe} reads the strike and slips it; you pay for the miss.`]);
}

// ── Crotchety-DM repair: clearly-impossible feats don't get a d20 ────────────
// A real DM doesn't roll to eat the sun or fly by flapping — he says it doesn't work,
// in the fiction. Without this, an absurd feat rolls a normal check and can report
// mechanical "success" while the (correct) narration says nothing happened — dice and
// fiction contradicting. Catch cosmic / physically-impossible declarations and resolve
// them deterministically as a grounded no-effect (no success tag, no RNG). Kept TIGHT
// to avoid false positives (word-boundaried celestial nouns; sun/moon/sky only for the
// reach/pull family so "star chart"/"moonstone" don't trip it).
const RIDICULOUS = [
  // impossible feats
  { re: /\b(eat|swallow|devour|drink|bite|chew|gulp)\b.{0,20}\b(?:the\s+)?(?:sun|moon|stars?|sky|ocean|sea|world)\b/i, sub: 'reach' },
  { re: /\b(tear|pull|rip|yank|grab|pluck|take|drag|haul|snatch)\b.{0,20}\b(?:the\s+)?(?:sun|moon|sky)\b/i, sub: 'reach' },
  { re: /\b(touch|reach for|hold|catch|seize|grasp)\b.{0,20}\b(?:the\s+)?(?:sun|moon|sky)\b/i, sub: 'reach' },
  { re: /\b(become|make myself|turn into|transform into|ascend to)\b.{0,24}\b(?:a\s+)?(?:god|goddess|deity|immortal|all-?powerful|omnipotent|divine being)\b/i, sub: 'godhood' },
  { re: /\b(stop|reverse|rewind|turn back|freeze|halt)\b.{0,12}\btime\b/i, sub: 'time' },
  { re: /\bflap\b.{0,20}\bfly\b|\bfly\b.{0,20}\bflap/i, sub: 'fly' },
  { re: /\b(breathe|breath of|spew|belch)\b.{0,8}\bfire\b/i, sub: 'fire' },
  // grandiose boasts
  { re: /\b(?:sword|blade|axe|staff|wand|hammer|spear|bow|dagger|mace|weapon|shield|armou?r)\s+of\s+(?:infinite|unlimited|ultimate|legendary|godlike|limitless|pure|absolute|boundless|cosmic)\b/i, sub: 'boast-item' },
  { re: /\b(?:infinite|unlimited|ultimate|limitless|godlike|boundless|absolute)\s+(?:power|might|strength|gold|wealth|riches|health|hp|mana|magic|stats?)\b/i, sub: 'boast-infinite' },
  { re: /\bi(?:'?m| am)\b.{0,24}\b(?:strongest|greatest|mightiest|most powerful|best|smartest|fastest|deadliest)\b.{0,24}\b(?:in\s+(?:all\s+)?(?:the\s+)?(?:world|land|realm|realms|universe|existence|history|cosmos)|alive|who ever lived|of all time|that ever lived)\b/i, sub: 'boast-super' },
  { re: /\bi(?:'?m| am)\b.{0,16}\b(?:king|emperor|queen|god|lord|master|ruler|overlord)\b.{0,12}\bof\s+(?:everything|the world|all|all things|the universe|reality|creation)\b/i, sub: 'boast-king' },
  // meta / 4th-wall
  { re: /\bi(?:'?m| am)\b.{0,10}\b(?:the\s+)?(?:dm|gm|dungeon ?master|game ?master|narrator|author)\b/i, sub: 'meta-dm' },
  { re: /\b(?:give me|grant me|gimme|hand me|i demand|i want|add)\b.{0,40}\b(?:\d{2,}|hundred|thousand|million|legendary|epic|godly|magical?|infinite|unlimited|max(?:imum)?|all the)\b.{0,16}\b(?:gold|coins?|gp|money|xp|levels?|stats?|hp|health|mana|sword|weapon|armou?r|gear|items?|loot|blade|axe)\b/i, sub: 'meta-give' },
  { re: /\b(?:i win|i'?ve won|i just won|end the game|skip to the end|beat the game|win the game|game over|i beat the game)\b/i, sub: 'meta-win' },
  { re: /\b(?:delete|destroy|erase|unmake|nuke)\b.{0,8}\bthe (?:world|game|universe)\b|\b(?:rewrite|change|break|ignore)\b.{0,8}\bthe rules\b/i, sub: 'meta-delete' },
];
function ridiculousCelestialNoun(text) {
  const m = String(text).match(/\b(sun|moon|stars?|sky|ocean|sea|world)\b/i);
  return m ? m[1].toLowerCase() : 'it';
}
function ridiculousItemNoun(text) {
  const m = String(text).match(/\b(sword|blade|axe|staff|wand|hammer|spear|bow|dagger|mace|weapon|shield|armou?r)\b/i);
  return m ? m[1].toLowerCase() : 'trinket';
}
function tryRidiculous(world, text) {
  const t = String(text || '');
  const hit = RIDICULOUS.find(r => r.re.test(t));
  if (!hit) return null;
  // A legit shopping intent ("I want to buy a legendary sword from the merchant") is not
  // a 4th-wall demand — let it route to normal play.
  if (hit.sub === 'meta-give' && /\b(buy|purchase|trade|barter|sell|pay for|haggle)\b/i.test(t)) return null;
  const name = String(world?.party?.[0]?.name || 'you');
  const place = placeNameOf(world);
  const V = (key, variants) => `Wizard: ${pickVariant(variants, world, key)}`;
  let line;
  switch (hit.sub) {
    case 'reach': {
      const noun = ridiculousCelestialNoun(t);
      line = V(`rid:reach:${noun}`, [
        `Sure you do. And I'm the Queen of the Faeries. The ${noun} stays its comfortable distance off, your arms stay your arms, and the day goes on without you.`,
        `The ${noun}, is it. It has hung exactly where it is since long before you drew breath, and it remains supremely uninterested in your ambitions.`,
      ]);
      break;
    }
    case 'godhood':
      line = V('rid:god', [`Godhood, just like that. The heavens decline to clear a throne for you; you remain stubbornly, unremarkably mortal.`, `Ah, divinity by declaration. Bold strategy. It doesn't take; you're as mortal as the dirt under your boots.`]);
      break;
    case 'time':
      line = V('rid:time', [`Reverse time. Naturally. The clock keeps its own counsel, and the moment stands precisely where you left it.`, `Time is not yours to command, and it ignores the request entirely. On we go.`]);
      break;
    case 'fly':
      line = V('rid:fly', [`You flap like a startled hen. Gravity, deeply unimpressed, keeps your boots flat on the floor.`, `Arms are not wings, friend. You windmill for a moment and stay exactly as grounded as you began.`]);
      break;
    case 'fire':
      line = V('rid:fire', [`You're no dragon, whatever you've told yourself. Nothing leaves you but a forceful, faintly embarrassing exhale.`, `A gout of dragonfire? From you? You manage hot breath and little else.`]);
      break;
    case 'boast-item': {
      const item = ridiculousItemNoun(t);
      line = V(`rid:item:${item}`, [
        `A ${item} of infinite power. Of course. Check your belt — it's the same plain gear you walked in with, no more, no less.`,
        `Marvelous ${item} you've described. Sadly it exists only in the telling; your actual kit hasn't changed a whit.`,
      ]);
      break;
    }
    case 'boast-infinite':
      line = V('rid:inf', [`Infinite anything, summoned by saying so. The world didn't get the memo, and nothing about you has changed.`, `Limitless power on request. Charming. You're precisely as ordinary as you were a breath ago.`]);
      break;
    case 'boast-super':
      line = V('rid:super', [`Strongest in all the world. Sure. The world hasn't noticed, and neither has anyone within earshot.`, `Greatest who ever lived, is it? Bold claim from someone standing in ${place} with a worn blade.`]);
      break;
    case 'boast-king':
      line = V('rid:king', [`King of everything. Naturally. Reality declines to bow; you're exactly as in charge as you were a moment ago, which is to say not at all.`, `Ruler of all creation, by your own decree. Creation respectfully disagrees and carries on without you.`]);
      break;
    case 'meta-dm':
      line = V('rid:dm', [`That's adorable. I'll keep this chair, thanks. You're still ${name}, still standing in ${place}, still waiting on your next move.`, `Nice try. There's exactly one DM here, and it isn't ${name}. What do you actually do?`]);
      break;
    case 'meta-give':
      line = V('rid:give', [`Gold doesn't rain down because you asked nicely, and I don't hand out legends on request. You've got exactly what you had.`, `Ah, the wishlist approach. It doesn't work that way; your purse and your pack are precisely as you left them.`]);
      break;
    case 'meta-win':
      line = V('rid:win', [`You don't win by announcing it, that's not how any of this works. The world carries on, wholly indifferent to your shortcut.`, `Declaring victory is not the same as earning it. Nothing ends; ${place} is still very much around you.`]);
      break;
    default: // meta-delete
      line = V('rid:del', [`The world declines to be deleted on your say-so. It is, frustratingly for you, still entirely here.`, `The rules are not yours to rewrite from that chair. Everything stands exactly as it did.`]);
      break;
  }
  const w1 = pushEvent(world, { kind: 'resolution', data: { actorId: 'party', intent: t, text: t, roll: 0, dc: 0, outcome: 'failure', updateKind: 'ridiculous' } });
  return { world: w1, output: { narration: line, mechanics: `[the DM is unmoved — nice try]` } };
}

// ── Morality M1: the multi-charge deed detector (the seven-axis soul) ────────
// Reads the act the player DECLARES (THE_DM_TEST: judge the fiction) and returns a SET of
// charges — one act can reach several gods at once (the soldier's bargain). Curated and
// TIGHT, like tryRidiculous: the default is "ordinary play, no deed." Context (helpless /
// surrendered / to-save, read from the player's own words) modulates SEVERITY, not category.
// M1 is INVISIBLE — these charges silently tune morality.axes + record a deed; no NPC,
// faction, rumor, prose, or sign consequence (that is M2+). See docs/MORALITY_GRIMOIRE.md.
const DEED_SEV = { LIGHT: 5, MOD: 12, HEAVY: 20 };

function tryDarkDeed(world, text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return [];
  const charges = [];
  const push = (axis, sev, kind) => charges.push({ axis, sev, kind });
  const { LIGHT, MOD, HEAVY } = DEED_SEV;

  const kill = /\b(kill|slay|murder|behead|execute|stab|strangle|drown|slit|smother|cut(?: him| her| them)? down|cut .*throat|put .* to the sword)\b/i.test(t);
  const torture = /\b(torture|torment|flay|maim|break (?:his|her|their) fingers|put .* to the question)\b/i.test(t);
  const helpless = /\b(bound|tied up|helpless|defenseless|unarmed|sleeping|kneeling|begging|begs? for mercy|surrender(?:ed|ing)?|prisoner|captive|the wounded|dying|infant|baby|elder|old man|old woman|civilian)\b/i.test(t);
  const save = /\b(to save|to protect|to defend|to spare the|save the|protect the|defend the|rescue|to shield|shield the)\b/i.test(t);

  // KILL — save-context first (the bargain), else helpless (cruelty), else untagged.
  if (kill) {
    if (save) { push('wrath', LIGHT, 'cruelty'); push('charity', MOD, 'aid'); push('kindness', LIGHT, 'aid'); }
    else if (helpless) { push('wrath', HEAVY, 'cruelty'); }
    // bare/fair kill: untagged in M1 (routine combat-blood accrual is a later refinement)
  }
  if (torture) { push('wrath', HEAVY, 'cruelty'); if (/\b(obey|grovel|kneel|submit|worship)\b/i.test(t)) push('pride', LIGHT, 'cruelty'); }
  if (/\b(sacrifice|offer up|give .* to the (?:dark|god|demon))\b/i.test(t) && /\b(innocent|child|children|captive|maiden|villager|prisoner|virgin)\b/i.test(t)) {
    push('wrath', HEAVY, 'cruelty'); push('gluttony', MOD, 'forbidden');
  }

  // Treachery
  if ((/\b(betray|backstab|turn on|sell out)\b/i.test(t) && /\b(friend|companion|ally|comrade|brother|sister|partner)\b/i.test(t)) || /\b(break my (?:oath|word|vow)|abandon my (?:friend|companion|ally|comrade))\b/i.test(t)) {
    push('pride', MOD, 'cruelty');
    if (/\b(gold|coin|silver|payment|reward|money)\b/i.test(t)) push('greed', MOD, 'cruelty');
  }
  if (/\b(betray|cheat on|abandon)\b.{0,16}\b(lover|wife|husband|beloved|spouse)\b/i.test(t)) push('lust', MOD, 'cruelty');

  // Forbidden sources
  if (/\b(raise|reanimate|animate|summon)\b.{0,20}\b(dead|corpse|corpses|fallen|bodies|skeletons?|zombies?)\b|\bnecromanc/i.test(t)) push('gluttony', MOD, 'forbidden');
  if (/\b(devour|consume|drink|drain|steal)\b.{0,20}\b(soul|souls|years|life ?force|vitality|youth)\b/i.test(t)) push('gluttony', HEAVY, 'forbidden');
  if (/\bblood (?:magic|sacrifice|rite|ritual)\b|\bspill .* blood (?:to|for) (?:the|power|him)\b/i.test(t)) push('wrath', MOD, 'forbidden');
  if (/\b(pact|bargain|deal|covenant)\b.{0,12}\bwith (?:a |the )?(?:demon|devil|dark one|fiend)\b|\bsell my soul\b/i.test(t)) push('pride', MOD, 'forbidden');

  // Other vices
  if (/\b(rob|extort|plunder|steal from)\b.{0,16}\b(poor|beggar|starving|widow|orphan|weak|needy)\b|\brob the poor\b/i.test(t)) push('greed', MOD, 'cruelty');
  if (/\b(make (?:them|him|her|you) (?:grovel|kneel|worship|bow)|demand .* worship|humiliate (?:the|him|her|them))\b/i.test(t)) push('pride', MOD, 'cruelty');

  // Bright — the mirror
  if (/\b(give|share|offer|hand)\b.{0,30}\b(starving|beggar|poor|hungry|orphan|needy|destitute)\b/i.test(t) || /\bgive (?:him|her|them) my last\b/i.test(t)) push('charity', MOD, 'aid');
  if (/\b(spare|let (?:him|her|them) live|show mercy|stay my (?:hand|blade)|lower my (?:sword|blade|weapon)|let (?:him|her|them) go)\b/i.test(t)) { push('patience', MOD, 'mercy'); push('kindness', LIGHT, 'mercy'); }
  if (/\b(tend|aid|help|heal|bind (?:his|her|their|the) wounds|carry)\b.{0,25}\b(fallen|wounded|the enemy|my enemy|the foe|defeated)\b/i.test(t)) { push('kindness', MOD, 'aid'); push('charity', LIGHT, 'aid'); }
  if (/\b(hold|keep|stand)\b.{0,12}\bvigil\b|\bvigil before\b/i.test(t)) {
    if (/\b(to win|for glory|to become|so that|to gain)\b/i.test(t)) push('pride', MOD, 'cruelty');
    else { push('patience', MOD, 'aid'); push('humility', LIGHT, 'aid'); }
  }
  if (/\b(keep|honor|stand by) my (?:oath|word|vow|promise)\b/i.test(t)) { push('diligence', MOD, 'aid'); push('chastity', LIGHT, 'aid'); }
  if (save && !kill) { push('kindness', MOD, 'aid'); push('charity', LIGHT, 'aid'); }

  return charges.slice(0, 5);
}

// Apply detected deed charges to the world: tune the axes (axisDelta) and record one deed
// in the canon-log mirror. INVISIBLE — never touches the output. Wrapped around playerMove
// so it catches every action type at a single chokepoint. Determinism-safe (pure detection
// + deterministic deltas; replay re-runs the same text). Never throws to the turn.
function applyDeedCharges(world, text, output) {
  const t = String(text || '').trim();
  if (!t) return world;
  const mech = String(output?.mechanics || '');
  if (/observe only|no roll, state unchanged/i.test(mech)) return world; // meta no-op
  // A coerced build (P-73) already records its own cruelty deed (the construction
  // IS the atrocity); skip the text pass so it's never counted twice.
  if (/\bcoerced\b/.test(mech)) return world;
  const charges = tryDarkDeed(world, t);
  if (!charges.length) return world;
  const node = (world?.map?.nodes || []).find(n => n && n.id === world?.map?.currentNodeId) || null;
  const witnesses = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs.map(n => String(n.id)).filter(Boolean).slice(0, 8) : [];
  const nodeId = String(world?.map?.currentNodeId || '');
  const deltas = charges.map(c => ({ op: 'axisDelta', axis: c.axis, by: c.sev }));
  const dominant = charges.reduce((a, b) => (b.sev > a.sev ? b : a), charges[0]);
  deltas.push({ op: 'recordDeed', deedKind: dominant.kind, severity: dominant.sev, summary: t.slice(0, 200), nodeId, witnesses, t: Array.isArray(world?.timeline) ? world.timeline.length : 0 });
  // M2 — witnesses remember. A cruelty/forbidden deed seen by NPCs crashes their trust;
  // an aid/mercy/atonement deed seen raises it. Scaled by severity, bounded. The local
  // "a psychopath is never trusted for long" loop. (No witnesses → no shift.)
  const dark = dominant.kind === 'cruelty' || dominant.kind === 'forbidden';
  const bright = dominant.kind === 'aid' || dominant.kind === 'mercy' || dominant.kind === 'atonement';
  if (dark || bright) {
    const mag = Math.max(1, Math.min(3, Math.round(dominant.sev / (dark ? 10 : 12))));
    const by = dark ? -mag : mag;
    for (const npcId of witnesses) deltas.push({ op: 'npcTrustDelta', npcId, by });
  }
  return applyDeltas(world, deltas);
}

// trivialNarration — grounded prose for a trivial action. Falls back to the
// classic line when the action can't be parsed (covers legacy isTrivialIntent
// cases like "I pick up the rock").
function trivialNarration(w, text) {
  const c = classifyTrivial(text);
  if (!c) return 'You do so without difficulty.';
  switch (c.cat) {
    case 'body': {
      const map = {
        'sit down': 'You sit down.', 'sit': 'You sit down.',
        'stand up': 'You rise to your feet.', 'stand': 'You stand.',
        'kneel': 'You kneel.', 'bow': 'You bow.', 'nod': 'You nod.',
        'wave': 'You raise a hand in a wave.', 'stretch': 'You stretch the stiffness from your limbs.',
        'yawn': 'You stifle a yawn.', 'rest': 'You take a moment to catch your breath.',
        'pray': 'You bow your head in a brief, private prayer.',
        'dismount': 'You swing down from the saddle.',
        'whistle': 'You whistle a few idle notes.', 'hum': 'You hum under your breath.'
      };
      return map[c.verb] || 'You do so without difficulty.';
    }
    case 'draw': {
      const wn = playerWeaponName(w);
      return wn ? `You draw the ${wn}, settling it ready in your grip.` : 'You draw your weapon, ready in your grip.';
    }
    case 'sheathe': {
      const wn = playerWeaponName(w);
      return wn ? `You sheathe the ${wn}.` : 'You put your weapon away.';
    }
    case 'open': {
      const fn = furnitureNameAt(w, c.object) || c.object;
      return `You open the ${fn}.`;
    }
    case 'close': {
      const fn = furnitureNameAt(w, c.object) || c.object;
      return `You ${c.verb === 'shut' ? 'shut' : 'close'} the ${fn}.`;
    }
    case 'consume':
      return c.verb === 'eat' ? 'You eat a little of what you carry.'
        : c.verb === 'drink' ? 'You take a drink.'
        : 'You strike a light.';
    case 'gear': {
      const obj = c.object || 'it';
      if (/put\s+on/.test(c.verb)) return `You put on the ${obj}.`;
      if (/take\s+off/.test(c.verb)) return `You take off the ${obj}.`;
      return `You set down the ${obj}.`;
    }
    case 'social': {
      const map = {
        'say hello': 'You offer a friendly hello.', 'greet': 'You offer a greeting.',
        'introduce myself': 'You introduce yourself.', 'thank': 'You offer your thanks.',
        'nod in': 'You nod in agreement.', 'sing': 'You sing a few bars.'
      };
      return map[c.verb] || 'You do so without difficulty.';
    }
    default:
      return 'You do so without difficulty.';
  }
}

function isTrivialIntent(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return false;
  // Trivial physical actions that auto-succeed: no risk, no uncertain outcome.
  // These are everyday actions any able-bodied person can do without a check.
  // 1. Basic body actions: sit, stand, kneel, bow, nod, wave, rest, stretch, yawn, pray, dismount
  if (/\bi\s+(sit\s+down|stand\s+up|wave|kneel|rest|pray|bow|nod|stretch|yawn|dismount)\b/.test(t)) return true;
  // 1b. Introspection and musing — thinking is never a d20 roll.
  if (/\bi\s+(think|wonder|ponder|consider|reflect|muse|remember|recall)\b/.test(t)) return true;
  // 1c. Social pleasantries and self-maintenance: smiles, nods at folk, gear-fussing, counting coin.
  if (/\bi\s+(smile|wink|laugh|chuckle|shrug|sigh|hum|tighten|adjust|straighten|brush\s+off|dust\s+off|count\s+(my\s+)?coins?)\b/.test(t)) return true;
  // 2. Equipment: draw/sheathe weapon, put on/take off gear, drop pack, open/close door
  if (/\bi\s+(draw\s+(my\s+)?sword|draw\s+(my\s+)?weapon|put\s+away|sheathe|open\s+the\s+door|close\s+the\s+door|take\s+off|put\s+on|drop\s+(my\s+)?pack|drop\s+my)\b/.test(t)) return true;
  // 3. Consume: eat, drink, light torch
  if (/\bi\s+(eat|drink|light\s+a\s+torch|light\s+my)\b/.test(t)) return true;
  // 4. Pick up / take / grab / pocket uncontested items (no skill verb like "steal" or "pickpocket")
  if (/\bi\s+(take|pick\s+up|grab|pocket)\s+(the|a|my|some)\b/.test(t) && !/\b(steal|pickpocket|snatch|swipe|pilfer)\b/.test(t)) return true;
  // 5. Walk to (local, not travel)
  if (/\bi\s+walk\s+to\b/.test(t)) return true;
  // 6. Social pleasantries: say hello, greet, introduce, thank, nod in agreement, whistle
  if (/\bi\s+(say\s+hello|greet|introduce\s+myself|thank\s+them|thank\s+him|thank\s+her|whistle|hum|sing\s+a\s+tune|nod\s+in)\b/.test(t)) return true;
  // 7. Legacy specific patterns
  if (/\bi\s+(pick\s+up\s+(the\s+)?rock|pick\s+up\s+(the\s+)?stone)\b/.test(t)) return true;
  return false;
}

function normalizeDir(d) {
  const s = String(d || '').toLowerCase();
  if (s === 'n') return 'north';
  if (s === 'e') return 'east';
  if (s === 's') return 'south';
  if (s === 'w') return 'west';
  return s;
}

// Resolve a typed cardinal direction to the room it leads to inside an interior,
// using the reciprocal interior compass. Returns '' when there is genuinely no
// doorway that way — the caller reports a wall instead of folding the direction
// onto some other door (the old `idx % exits.length` infinite-walk bug).
function pickAdjacentInteriorByDirection(world, direction) {
  const dir = normalizeDir(direction);
  if (!dir) return '';
  const exits = interiorDirectionalExits(world);
  return String(exits[dir] || '');
}

// Player-facing exit labels. Each exit now carries the compass direction it
// leaves by (see getInteriorView), so the listed direction is the one that
// actually moves you there.
function exitDirectionLabels(view) {
  const exits = Array.isArray(view?.exits) ? view.exits : [];
  return exits.map((x, i) => String(x?.dir || `passage ${i + 1}`));
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
    ? ['help will appear, but it must be earned', 'a secret will open a safer path', 'the world will reward cleverness']
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
    if (!companion || (companion.wounds ?? 0) >= maxWounds(companion.level ?? 1, statMod(companion.stats?.GRIT ?? 10))) continue;
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

// A LONG rest is deliberate language — 'sleep', 'make camp', 'turn in'.
// A bare 'rest' stays a body action (sitting on a bench is not eight hours).
function isLongRestIntent(text) {
  const t = String(text || '').toLowerCase();
  return /\b(sleep|long\s+rest|make\s+camp|camp\s+for\s+the\s+night|rest\s+for\s+the\s+night|bed\s+down|turn\s+in|get\s+some\s+sleep|spend\s+the\s+night|rest\s+up|take\s+a\s+(rest|breather|nap)|catch\s+(my|our)\s+breath|recuperate)\b/.test(t);
}

// Detects "attack <name>" / "fight <name>" / "kill <name>" / "strike <name>"
// against a hostile NPC at the current node. Returns { npc } or null.
// Conservative: only matches when the player text starts with an attack verb
// AND the named target maps to an NPC at the current node with hostile===true.
function detectAttackBeginIntent(world, text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const m = t.match(/\b(attack|fight|kill|strike|assault|punch|stab|hit|slash|swing\s+at|shoot|kick|tackle|charge)\s+(.+)/i);
  if (!m) return null;
  const ref = String(m[2] || '').trim().replace(/[.!?,;:]+$/, '').trim();
  if (!ref) return null;

  const nodeId = String(world?.map?.currentNodeId ?? '');
  const node = (world?.map?.nodes || []).find(n => n && n.id === nodeId) || null;
  const npcs = node?.settlement?.npcs || [];
  if (!Array.isArray(npcs) || !npcs.length) return null;

  // Only consider hostile NPCs for the fast-path
  const hostileNpcs = npcs.filter(n => n && n.hostile === true);
  if (!hostileNpcs.length) return null;

  const npc = fuzzyMatchNpc(hostileNpcs, ref);
  if (!npc) return null;
  return { npc };
}

// CM11: Like detectAttackBeginIntent but matches ANY NPC at the current node
// (not just hostile ones). Only called after the hostile-only check returned null,
// so hostile NPCs still take the fast path.
//
// Fuzzy matching: tries name/id first, then role, then generic descriptors
// ("woman", "man", "person", "stranger", "guard", etc.). If violence is
// clearly intended and NPCs exist but no specific match, picks the first NPC.
function detectAttackAnyIntent(world, text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const m = t.match(/\b(attack|fight|kill|strike|assault|punch|stab|hit|slash|swing\s+at|shoot|kick|tackle|charge)\s+(.+)/i);
  if (!m) return null;
  const ref = String(m[2] || '').trim().replace(/[.!?,;:]+$/, '').trim();
  if (!ref) return null;

  const nodeId = String(world?.map?.currentNodeId ?? '');
  const node = (world?.map?.nodes || []).find(n => n && n.id === nodeId) || null;
  const npcs = node?.settlement?.npcs || [];
  if (!Array.isArray(npcs) || !npcs.length) return null;

  const npc = fuzzyMatchNpc(npcs, ref);
  if (!npc) return null;
  return { npc };
}

// Shared fuzzy NPC resolution. Tries exact name, then role, then generic
// descriptors, then first-NPC fallback for clearly generic refs.
function fuzzyMatchNpc(npcs, ref) {
  if (!Array.isArray(npcs) || !npcs.length || !ref) return null;
  const norm = (s) => String(s || '').toLowerCase().trim();
  const refLower = norm(ref);

  // 1. Exact or substring match on name/id (existing behavior)
  const byName = npcs.find(n => n && (
    norm(n.id) === refLower ||
    norm(n.name) === refLower ||
    norm(n.name).includes(refLower) ||
    refLower.includes(norm(n.name))
  ));
  if (byName) return byName;

  // 2. Role match: "guard" → role=guard, "merchant" → role=merchant, etc.
  const byRole = npcs.find(n => n && (
    norm(n.role) === refLower ||
    norm(n.role).includes(refLower) ||
    refLower.includes(norm(n.role)) ||
    norm(n.role).replace(/_/g, ' ') === refLower
  ));
  if (byRole) return byRole;

  // 3. Generic human descriptors → first available NPC
  const GENERIC_REFS = new Set([
    'woman', 'man', 'person', 'stranger', 'someone', 'them',
    'her', 'him', 'lady', 'guy', 'fellow', 'figure',
    'villager', 'townsperson', 'townsfolk', 'civilian', 'bystander',
    'the woman', 'the man', 'the stranger', 'the person', 'the figure',
    'the guard', 'the merchant', 'the innkeeper', 'the smith',
    'the elder', 'the healer', 'the priest', 'the trader',
  ]);
  if (GENERIC_REFS.has(refLower)) return npcs[0];

  // 4. "the <role>" pattern: "the guard captain" → guard_captain
  const theMatch = refLower.match(/^the\s+(.+)/);
  if (theMatch) {
    const roleRef = theMatch[1].replace(/\s+/g, '_');
    const byTheRole = npcs.find(n => n && (
      norm(n.role) === roleRef ||
      norm(n.role).includes(theMatch[1]) ||
      theMatch[1].includes(norm(n.role).replace(/_/g, ' '))
    ));
    if (byTheRole) return byTheRole;
  }

  // 4b. Any generic person/enemy descriptor word ANYWHERE in the ref → first NPC.
  //     Catches adjective-qualified refs ("the nearest figure", "the lone man")
  //     and combat words ("the enemy", "the foe", "the attacker") that the exact
  //     descriptor set in step 3 misses. Role-specific refs already resolved above.
  const GENERIC_WORD = /\b(woman|man|men|women|person|people|stranger|someone|anyone|everyone|them|her|him|lady|guy|fellow|figure|figures|villager|townsperson|townsfolk|civilian|bystander|enemy|enemies|foe|foes|attacker|assailant|creature|beast|monster|thing|shape|shadow)\b/;
  if (GENERIC_WORD.test(refLower)) return npcs[0];

  // 5. Last resort: if ref is a single common word that could describe
  //    any person, pick first NPC. This catches "stab everyone" etc.
  const ALWAYS_RESOLVE = /^(everyone|everybody|anyone|all|anything|everything)$/;
  if (ALWAYS_RESOLVE.test(refLower)) return npcs[0];

  return null;
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
    /\b(force|bash|break|kick|pry|smash|punch|stab|hit|slash|swing|tackle|charge|shove|grapple|wrestle)\b/.test(t) ? 'force' :
    /\b(sneak|quiet|hide|slip|crawl|shadow)\b/.test(t) ? 'finesse' :
    /\b(aim|shoot|throw)\b/.test(t) ? 'focus' :
    /\b(talk|convince|lie|threaten|charm)\b/.test(t) ? 'charm' :
    /\b(listen|watch|study|search|inspect)\b/.test(t) ? 'insight' :
    /\b(strike|attack)\b/.test(t) ? 'force' :
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
    sensoryMotifs: append('sensoryMotifs'),
    threads: append('threads'),
    seeds: append('seeds'),
    factions: append('factions'),
    npcs: append('npcs')
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
  let w = next;
  for (const g of completed) {
    w = pushEvent(w, { kind: 'goalCompleted', data: { goalId: g.id, kind: g.kind, targetRef: g.targetRef } });
  }
  // v25 — story arcs ride the same tick: cast dormant arcs onto whatever NPCs
  // have materialized, then advance any stage whose done-when now holds.
  // (docs/STORYLINE_SPEC.md — surfaces only diegetically, via rumors/NPCs.)
  w = castArcs(w);
  const arcTick = tickArcs(w);
  w = arcTick.world;
  for (const ev of arcTick.events) {
    w = pushEvent(w, ev);
  }
  // Open-ended: arriving anywhere is just arrival — no win-on-reach, no terminal
  // lock. The world stays open and play continues. (Combat-defeat is still a real
  // fail state; the road has teeth, it just has no finish line.)
  return w;
}

// v1 Escape: the journey needs stakes. The base encounter system keys off
// dread, which escape mode never raises — so without this, travel is risk-free.
// On each inter-node move (not the winning arrival), roll a deterministic chance
// of a creature ambush scaled to player level. Losing the fight locks the loss
// ending (combatResolve); winning lets the player press on. No-op outside escape
// mode, so engine tests (mode '') are untouched.
function maybeSpawnEscapeEncounter(world, before, chance = ESCAPE_ENCOUNTER_CHANCE) {
  const w = world;
  if (w.meta?.mode !== 'escape') return w;
  if (w.combat?.active || w.ending?.locked) return w;
  const after = String(w.map?.currentNodeId || '');
  if (!after || after === String(before || '')) return w;

  const rng = makeRng(seedFromString(`${w.meta.seed}|escapeEncounter|${after}|${w.timeline.length}`));
  if (rng.nextFloat() >= chance) return w;

  const node = (w.map?.nodes || []).find(n => n && n.id === after) || null;
  const region = node?.settlement?.region || null;
  return spawnTamedAmbush(w, region, rng, 'escape-ambush');
}

// v20 free-roam: stepping into open country (no node underfoot) carries its own,
// lower per-tile ambush chance. Keyed on the cell + timeline so the encounter is
// a pure function of where and when you stepped — replay-stable. Escape mode only
// for now (the live v1 loop); the open sandbox is left quiet.
function maybeSpawnWildEncounter(world, pos) {
  const w = world;
  if (w.meta?.mode !== 'escape') return w;
  if (w.combat?.active || w.ending?.locked) return w;
  if (String(w.map?.currentNodeId || '')) return w; // only out in the wild
  const x = Number(pos?.x), y = Number(pos?.y);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return w;

  const rng = makeRng(seedFromString(`${w.meta.seed}|wildEncounter|${x}|${y}|${w.timeline.length}`));
  if (rng.nextFloat() >= WILD_ENCOUNTER_CHANCE) return w;

  // No node region out here — let selectCreatures fall back to the general pool.
  return spawnTamedAmbush(w, null, rng, 'wild-ambush');
}

// Shared ambush spawner. Borrow a bestiary creature for its name/flavor only,
// then fight it with a tamed classic-D&D profile resolved by escapeCombat.js. We
// deliberately do NOT use the creature's real stats/actions — escape combat is
// plain HP, a fixed enemy to-hit, and `damage` as the damage-die max. These are
// the only fields that survive ensureCombat's enemy whitelist.
function spawnTamedAmbush(w, region, rng, reason) {
  // Living-World P2: the ambusher is native to the land you're crossing.
  const ambNode = (w.map?.nodes || []).find(n => n && n.id === String(w.map?.currentNodeId || '')) || null;
  const ambBiome = ambNode ? biomeForNode(w.meta.seed, ambNode) : null;
  const flavor = selectCreatures(0.25, 1, region, rng, ambBiome)[0] || { name: 'Lurker' };
  const tamed = {
    name: String(flavor.name || 'Lurker'),
    ref: String(flavor.ref || 'lurker'),
    cr: 0.125,
    maxHp: ESCAPE_ENEMY_HP,
    ac: 12,
    damage: 4,        // damage-die max (d4) for escapeCombat
    canParley: false
  };
  return spawnEncounter(w, [tamed], { ambush: true, reason }, rng);
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
