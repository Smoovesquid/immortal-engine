import { newWorld, ensureWorld } from '../../engine/state.js';
import { beginAdventure } from '../../engine/playloop.js';
import { beginCombat, mintEnemyFromNpc } from '../../engine/combat/combatLifecycle.js';
import { applyDeltas } from '../../engine/effectsCore.js';

export const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['village'],
    starterObjectives: ['survive'],
    skills: ['force'],
    locations: ['village'],
    objectives: ['survive'],
    complications: ['danger'],
    npcArchetypes: ['baker'],
    sensoryMotifs: ['flour']
  }
};

function baseWorld(seed = 'h57') {
  return beginAdventure(newWorld({
    seed,
    fate: 0.3,
    campaignId: seed,
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
}

function worldWith(npcs = [], seed = 'h57') {
  const base = baseWorld(seed);
  const node = {
    id: `${seed}_settlement`,
    name: 'Pilgrim\'s Rest Test Village',
    nodeType: 'settlement',
    discovered: true,
    settlement: {
      decompressed: true,
      npcs: npcs.map(n => ({
        conversationState: { trustLevel: 5 },
        ...n
      }))
    }
  };
  return ensureWorld({
    ...base,
    map: {
      ...base.map,
      currentNodeId: node.id,
      nodes: [...(base.map?.nodes || []), node]
    },
    combat: { ...(base.combat || {}), active: false },
    scene: { ...(base.scene || {}), interior: null, dialogue: null }
  });
}

export function villageBakerWorld() {
  return worldWith([
    {
      id: 'npc_baker',
      name: 'Mira Hearth',
      role: 'baker',
      occupation: 'baker',
      descriptor: 'flour-dusted baker',
      hostile: false
    }
  ], 'h56');
}

export function emptyRoomWorld() {
  const base = baseWorld('h57-empty-room');
  return ensureWorld({
    ...base,
    combat: { ...(base.combat || {}), active: false },
    scene: {
      ...(base.scene || {}),
      dialogue: null,
      interior: {
        id: 'h57_empty_room',
        name: 'Bare Test Room',
        kind: 'room',
        description: 'A bare stone room with no one else inside.'
      }
    }
  });
}

export function activeCombatWorld() {
  const npc = {
    id: 'npc_lingerer',
    name: 'Lingerer',
    hostile: true,
    combatProfile: {
      maxHp: 6,
      hp: 6,
      ac: 10,
      damage: 1,
      canParley: false
    },
    personality: {},
    conversationState: { metPlayer: false, trustLevel: 0, topicsDiscussed: [] },
    knowledgeGraph: [],
    secrets: []
  };
  let world = worldWith([npc], 'h57-active-combat');
  world = beginCombat(world, { enemies: [mintEnemyFromNpc(npc)], reason: 'test' });
  world = applyDeltas(world, [{
    op: 'combatState',
    set: {
      active: true,
      round: 1,
      enemies: [{
        ...world.combat.enemies[0],
        name: npc.name,
        hp: 6,
        maxHp: 6,
        ac: 10,
        damage: 1,
        defeated: false
      }]
    }
  }]);
  return ensureWorld({
    ...world,
    meta: {
      ...world.meta,
      escapeHp: 12,
      escapeMaxHp: 12
    }
  });
}

export function dialogueActiveWorld() {
  const world = villageBakerWorld();
  return ensureWorld({
    ...world,
    scene: {
      ...(world.scene || {}),
      dialogue: {
        npcId: 'npc_baker',
        turnsInDialogue: 1,
        topicsCount: 0
      }
    }
  });
}

export const FIXTURES = {
  village_baker: villageBakerWorld,
  empty_room: emptyRoomWorld,
  active_combat: activeCombatWorld,
  dialogue_active: dialogueActiveWorld
};
