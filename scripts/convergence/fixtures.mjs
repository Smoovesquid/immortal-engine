import { newWorld, ensureWorld } from '../../engine/state.js';
import { beginAdventure } from '../../engine/playloop.js';
import { beginCombat, mintEnemyFromNpc } from '../../engine/combat/combatLifecycle.js';
import { applyDeltas } from '../../engine/effectsCore.js';
import { ensureNodeSubstrate } from '../../engine/substrate.js';

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

// (W-1) The first REAL location: a trade-town tavern node whose substrate node-events
// are SEEDED, so it holds a TRUE founding fact + a local-event the DM can deliver from
// (deliver-or-decline). This is what distinguishes a "real location" from village_baker
// (which has NO node-level substrate, so its founding questions correctly decline — the
// C9-005/006/007 lock). The trade-town facts are mundane (§5 #4 "trade town in denial")
// → §0 hidden-why safe by construction (substrate labels never allude to the cosmology).
export function tradeTownTavernWorld() {
  const base = baseWorld('w1-tallowcross');
  const node = {
    id: 'tt_tavern_node',
    name: 'Tallow Cross',
    nodeType: 'settlement',
    discovered: true,
    settlement: {
      decompressed: true,
      npcs: [{
        id: 'npc_keeper',
        name: 'Bram Cask',
        role: 'tavern-keeper',
        occupation: 'innkeeper',
        descriptor: 'shrewd tavern-keeper',
        hostile: false,
        conversationState: { trustLevel: 5 }
      }]
    }
  };
  let world = ensureWorld({
    ...base,
    map: { ...base.map, currentNodeId: node.id, nodes: [...(base.map?.nodes || []), node] },
    combat: { ...(base.combat || {}), active: false },
    scene: { ...(base.scene || {}), interior: null, dialogue: null }
  });
  world = ensureNodeSubstrate(world, node.id); // ← seed the TRUE facts that make it real
  return ensureWorld(world);
}

// (W-6) trade_town_tavern with dialogue ACTIVE and a SECOND sociable NPC, so the NPC-voice
// renderer can be exercised: founding/events deliver the resolver's grounded fact IN-CHARACTER,
// and population (which excludes the SPEAKING npc) still names a neighbor (Pell Riven) instead
// of Bram listing himself. Same seed/node/substrate as trade_town_tavern → the SAME founding
// and local-event labels (proves "one fact, two voices"). §0-safe by construction.
export function tradeTownTavernDialogueWorld() {
  const w = tradeTownTavernWorld();
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  node.settlement.npcs.push({
    id: 'npc_patron', name: 'Pell Riven', role: 'trader',
    occupation: 'trader', descriptor: 'road-worn trader',
    hostile: false, conversationState: { trustLevel: 5 }
  });
  return ensureWorld({
    ...w,
    scene: { ...(w.scene || {}), dialogue: { npcId: 'npc_keeper', turnsInDialogue: 1, topicsCount: 0 } }
  });
}

// (DS-1a) village_baker with party stress:1 — the composer's stress clause
// ("a thread of strain runs under your breath") is a DETERMINISTIC (non-rng)
// abstract-floor trigger (composer.js buildStressPhrase), so a death-sense
// success reliably reaches genericGroundedOutcome's DS-1a branch through the
// real playerMove path, not just direct unit calls. No dead NPC modeled here.
export function deathSenseEmptyWorld() {
  const w = villageBakerWorld();
  return { ...w, party: (w.party || []).map((p, i) => i === 0 ? { ...p, stress: 1 } : p) };
}

// (DS-1a) Same stress:1 rig as deathSenseEmptyWorld, but on defeated_npc — a
// corpse IS present, so the death-sense must find it (the grounded positive),
// never the false-negative.
export function deathSenseWithCorpseWorld() {
  const w = defeatedNpcWorld();
  return { ...w, party: (w.party || []).map((p, i) => i === 0 ? { ...p, stress: 1 } : p) };
}

// (AG-3b) A settlement (NPC present, exterior — interior cleared) whose node holds
// an OPEN coffer that has revealed a readable letter. Seed/node/name are chosen so
// the deterministic containerContents/containerItemText derive the marriage letter
// (LETTER_BODIES[7] — "They are married at last…", which names no one). This is the
// rig for the person-question-vs-read-tag mismatch: "the letter says someone got
// married — do you know who?" keys the read path (a THING-interaction) yet asks a
// PERSON → the egress must repair it to an honest decline, while a genuine read
// question ("what does the letter say?") still shows the letter. The booted interior
// is cleared on BOTH scene.interior AND party.position.interior (ensureWorld re-derives
// scene.interior from the position — state.js:132-137) so objectsHere returns the coffer.
export function revealedLetterWorld() {
  const seed = 'ag3b';
  const base = baseWorld(seed);
  const node = {
    id: `${seed}_settlement`,
    name: 'Pilgrim\'s Rest Test Village',
    nodeType: 'settlement',
    discovered: true,
    settlement: {
      decompressed: true,
      npcs: [{
        id: 'npc_baker', name: 'Mira Hearth', role: 'baker', occupation: 'baker',
        descriptor: 'flour-dusted baker', hostile: false, conversationState: { trustLevel: 5 }
      }]
    },
    furniture: [{
      name: 'coffer', parts: ['lid', 'body'], state: 'open', bulk: 2, weight: 8,
      tags: ['wood', 'container'], notes: 'lid thrown back', material: 'wood',
      category: 'container', hardness: 2
    }]
  };
  const party = (base.party || []).map((p, i) => i === 0
    ? { ...p, position: { ...(p.position || {}), interior: null } } : p);
  return ensureWorld({
    ...base,
    party,
    map: { ...base.map, currentNodeId: node.id, nodes: [...(base.map?.nodes || []), node] },
    combat: { ...(base.combat || {}), active: false },
    scene: { ...(base.scene || {}), interior: null, dialogue: null }
  });
}

export const FIXTURES = {
  village_baker: villageBakerWorld,
  revealed_letter: revealedLetterWorld,
  prior_roll: priorRollWorld,
  empty_room: emptyRoomWorld,
  interior_npc: interiorNpcWorld,
  active_combat: activeCombatWorld,
  dialogue_active: dialogueActiveWorld,
  crowd_baker: crowdBakerWorld,
  defeated_npc: defeatedNpcWorld,
  trade_town_tavern: tradeTownTavernWorld,
  trade_town_tavern_dialogue: tradeTownTavernDialogueWorld,
  death_sense_empty: deathSenseEmptyWorld,
  death_sense_with_corpse: deathSenseWithCorpseWorld
};
