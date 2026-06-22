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

// village_baker with a roll already on the ledger (conversation.lastRoll), so a
// single playerMove can exercise the roll-result-QUERY path ("what did I roll?").
// ensureWorld preserves a valid lastRoll object (state.js), so the preset survives.
// (gate-10 RL t11 — C5 roll-recall.)
export function priorRollWorld() {
  const w = villageBakerWorld();
  w.conversation = { ...(w.conversation || {}), lastRoll: { roll: 4, dc: 12, outcome: 'failure', turn: 1 } };
  return w;
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

// (H-81) Indoors WITH a present NPC at the node — the only combo that triggers the
// approach-a-present-NPC → "that way is blocked" interior-move bug. Mira is at the
// node (from villageBakerWorld); the player is in an interior of that node.
export function interiorNpcWorld() {
  const world = villageBakerWorld();
  return ensureWorld({
    ...world,
    scene: {
      ...(world.scene || {}),
      dialogue: null,
      interior: {
        id: 'h56_interior_npc',
        name: 'Bakehouse',
        kind: 'room',
        description: 'Inside a modest building at the village.'
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

// (H-92) village_baker plus a SECOND present NPC — the crowd the gate-11 practice-swing
// bug needed (with one NPC the turn went trivial; with a bystander present the trailing
// "hit it" minted that bystander as a foe). Locks C10-005.
export function crowdBakerWorld() {
  const w = villageBakerWorld();
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  node.settlement.npcs.push({
    id: 'npc_rep', name: 'Corwin Boneknit', role: 'representative',
    occupation: 'representative', descriptor: 'weathered representative',
    hostile: false, conversationState: { trustLevel: 5 }
  });
  return ensureWorld(w);
}

// (H-92) village_baker with the present NPC already defeated (persisted down state), so
// an alive/dead status query must answer "dead" from canon. Locks C4-011.
export function defeatedNpcWorld() {
  const w = villageBakerWorld();
  return ensureWorld({ ...w, meta: { ...(w.meta || {}), npcCombatHp: { npc_baker: { down: true, hp: 0 } } } });
}

export const FIXTURES = {
  village_baker: villageBakerWorld,
  prior_roll: priorRollWorld,
  empty_room: emptyRoomWorld,
  interior_npc: interiorNpcWorld,
  active_combat: activeCombatWorld,
  dialogue_active: dialogueActiveWorld,
  crowd_baker: crowdBakerWorld,
  defeated_npc: defeatedNpcWorld
};
