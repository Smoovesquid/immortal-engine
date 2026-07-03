/**
 * N1 — Narrator Context Builder / DM Context Packet
 *
 * Assembles everything the AI narrator (DM) is allowed to know.
 * Canonical facts only — no invented detail.
 * Pure function: no world mutation, no API calls.
 *
 * Two modes:
 *   buildNarratorContext(world, outcome)  — original slim context for narration polish
 *   buildDMContext(world, outcome, pack)  — full DM briefing with NPCs, world pressure, player, rules
 */

import { ensureWorld } from '../state.js';
import { ensureInstrumentLayer } from '../instrument.js';
import { fateBand } from '../rulesets.js';
import { filterContext, applyMoodOverlay } from '../npc/perspectiveFilter.js';
import { isInfoSeekingText } from '../grace/gracefulAdjudication.js';
import { availableTopics as dialogueAvailableTopics } from '../npc/dialogue.js';
import { companionApproachForRole } from '../combat/companionTurn.js';
import { statMod, maxWounds } from '../ruleset/core/stats.js';
import { buildAsciiMap } from './asciiMap.js';
import { describeInteriorLayout } from '../structures/interiors.js';
import { getRoomState } from '../structures/roomState.js';
import { occupantsOfRoom, outdoorOccupants } from '../structures/roomOccupancy.js';

/**
 * buildNarratorContext(world, outcome) → NarratorContext (original slim context)
 */
// Set-piece beats (see llmAdapter.SETPIECE_BEATS) — kept inline to avoid a circular
// import (llmAdapter imports this module). The beat rides in on outcome.beat.
const SETPIECE_BEATS = new Set(['arrival', 'combat-start', 'death']);

export function buildNarratorContext(world, outcome = {}) {
  const w = ensureWorld(world);
  const scene = buildScene(w, outcome);

  const nodeId = String(w.map?.currentNodeId ?? '');
  const currentNode = (w.map?.nodes ?? []).find(n => n.id === nodeId) ?? null;
  const settlement = currentNode?.settlement ?? null;

  // ROM-2: who is actually HERE — inside, the occupancy-derived room the player
  // stands in; outdoors, who's out in the open. Never the full node roster
  // (ROOM_OCCUPANCY_MODEL §2 — the settlement's full cast is CONTINUITY memory,
  // never presence).
  const roomOccupants = roomOccupantsHere(w);
  const roomOccupantIds = new Set(roomOccupants.map(npc => String(npc?.id ?? npc?.name ?? '')));

  // Auto-select speaker from settlement NPCs — ROOM-SCOPED (never npcs[0], the
  // dark C1.5 bug: the auto-speaker used to default to the settlement's first
  // roster NPC even when nobody was assigned to the player's current room —
  // e.g. the tallow wake-room speaker picking Elske while she's elsewhere).
  let speaker = null;
  if (settlement?.npcs?.length) {
    const actionText = String(outcome?.input ?? outcome?.text ?? '').toLowerCase();
    // Pick NPC mentioned in action text (only if they're actually here), or
    // default to the first NPC really occupying this room/outdoor space.
    let picked = null;
    if (actionText) {
      picked = settlement.npcs.find(npc => {
        if (!roomOccupantIds.has(String(npc?.id ?? npc?.name ?? ''))) return false;
        const name = String(npc.name ?? npc.role ?? '').toLowerCase();
        return name && actionText.includes(name);
      });
    }
    picked = picked || roomOccupants[0] || null;
    if (picked) speaker = buildSpeakerContext(picked, picked.knowledgeGraph || []);
  }

  // If brain mood is available from the outcome, overlay it onto speaker emotional coloring
  const brainMood = outcome?.brainMood || outcome?.brainDecision?.mood || null;
  if (brainMood && speaker) {
    speaker = { ...speaker, emotionalColoring: applyMoodOverlay(speaker.emotionalColoring || [], brainMood) };
  }

  return {
    // Set-piece register signal: 'arrival' | 'combat-start' | 'death' | '' (default).
    beat: SETPIECE_BEATS.has(String(outcome?.beat || '')) ? String(outcome.beat) : '',
    placeName: scene.location.name,
    nodeType: scene.location.type,
    location: scene.location.name,
    objective: String(w.scene?.objective ?? ''),
    structuresHere: scene.structuresHere,
    interior: scene.interior,
    // The roads that lead onward from here (real adjacency) — so the DM can tell the
    // player where they can go and never narrate a waypoint as a dead end (journey fix).
    exits: scene.location.exits,
    tone: scene.tone,
    actionText: String(outcome?.input ?? outcome?.text ?? ''),
    mechanicsText: String(outcome?.mechanics ?? ''),
    // Roll band ('success' | 'mixed' | 'failure') so the narration validator can
    // reject polish that smooths a mixed outcome into a clean win (H-26d).
    rollOutcome: String(outcome?.outcome ?? ''),
    // Whether the player demanded a specific fact (name/date/owner/kin/etc.) so the
    // validator can enforce deliver-or-decline instead of bare atmosphere (H-29).
    infoSeeking: isInfoSeekingText(String(outcome?.input ?? outcome?.text ?? '')),
    fate: Number(w.meta?.fate ?? 0.5),
    settlement: settlement ? {
      // Earned knowledge for people: the prompt roster carries an NPC's NAME only if you're
      // home (you know your neighbors) or you've met them (metPlayer) — otherwise the DM gets
      // a role, not a name, so it can't narrate "Dalla" at a town you just walked into.
      // ROM-2: `elsewhere` marks anyone NOT in the room/outdoor-occupancy set (this stays
      // continuity memory, never presence — the prompt below reads it to say "— elsewhere").
      npcs: (settlement.npcs || []).map(n => {
        const known = (Boolean(w.meta?.homeNodeId) && String(w.meta.homeNodeId) === nodeId) || Boolean(n?.conversationState?.metPlayer);
        const base = known ? n : { ...n, name: '' };
        return { ...base, elsewhere: !roomOccupantIds.has(String(n?.id ?? n?.name ?? '')) };
      }),
      factions: settlement.factions || [],
      tensions: Array.isArray(settlement.tensions) ? settlement.tensions : [],
      economy: settlement.economy ?? null,
      population: settlement.population ?? null
    } : null,
    // ROM-2: the presence/material/position facts the live prompt now states as law
    // (ROOM_OCCUPANCY_MODEL §2 "the narration rule"). `roomOccupants` names are the
    // engine's own occupancy answer — never filtered by the earned-name rule above,
    // since presence itself (not a person's identity) is what the room states.
    roomOccupants,
    roomMaterial: scene.interior?.material ?? null,
    roomName: scene.interior?.room?.name ?? null,
    speaker,
    dialogueTurn: buildDialogueTurn(w, outcome),
    combat: buildNarratorCombatBlock(w, outcome)
  };
}

// ROM-2: the room-occupancy candidate pool for "who is HERE right now" —
// inside, occupantsOfRoom for the player's current structure/room; outdoors,
// outdoorOccupants. Shared by the auto-speaker and the returned ctx fields so
// both read the exact same answer. Pure; never throws on a malformed interior.
function roomOccupantsHere(w) {
  const interior = (w.scene?.interior && typeof w.scene.interior === 'object' && w.scene.interior) ? w.scene.interior : null;
  return interior
    ? occupantsOfRoom(w, String(interior.structureKey || ''), String(interior.roomId || ''))
    : outdoorOccupants(w);
}

/**
 * buildDMContext(world, outcome, pack) → DMContext
 *
 * Full DM briefing packet. Rebuilt every turn. Capped at ~6K tokens worth of data.
 *
 * @param {object} world    — canonical world state
 * @param {object} outcome  — result of the last engine action
 * @param {object} pack     — resolved pack data
 * @returns {DMContext}
 */
export function buildDMContext(world, outcome = {}, pack = {}) {
  const w = ensureWorld(world);

  const scene = buildScene(w, outcome);
  const npcsPresent = buildNPCsPresent(w);
  const worldPressure = buildWorldPressure(w);
  const player = buildPlayer(w);
  const rules = buildRules(w, pack);
  const worldWhisper = pickWorldWhisper(w);
  const goals = buildGoalsBlock(w);
  const home = buildHomeBlock(w);

  return {
    scene,
    asciiMap: buildAsciiMap(w),
    npcsPresent,
    worldPressure,
    player,
    rules,
    worldWhisper,
    goals,
    home,
    recentBeats: Array.isArray(w.recentBeats) ? w.recentBeats.slice() : [],
    combat: buildCombatBlock(w),
    companions: buildCompanionsBlock(w),
    dialogueTurn: buildDialogueTurn(w, outcome)
  };
}

// ── Home (Pass H) ─────────────────────────────────────────────────────────
// Projects meta.homeNodeId into the DM context so the narrator LLM can
// distinguish at-home from away scenes. Null when no home is set (pre-Pass-H
// saves or worlds without a settlement at begin).

function buildHomeBlock(w) {
  const homeNodeId = String(w?.meta?.homeNodeId || '');
  if (!homeNodeId) return null;
  const currentNodeId = String(w?.map?.currentNodeId || '');
  const nodes = Array.isArray(w?.map?.nodes) ? w.map.nodes : [];
  const home = nodes.find(n => String(n?.id) === homeNodeId) || null;
  return {
    nodeId: homeNodeId,
    name: String(home?.name || ''),
    isCurrent: currentNodeId === homeNodeId
  };
}

// ── Companions ────────────────────────────────────────────────────────────
// Pass C1: derived view of party[1..n] for the DM. Empty array when the
// player is solo so the system prompt can omit the block silently. The
// shape is intentionally minimal — name/role/trust/recruited turn — so
// the LLM can write companion-aware prose without leaking stat synthesis
// details.

function buildCompanionsBlock(w) {
  const party = Array.isArray(w?.party) ? w.party : [];
  const out = [];
  for (let i = 1; i < party.length; i++) {
    const p = party[i];
    if (!p?.companion) continue;
    out.push({
      name: String(p.name || ''),
      role: String(p.companion.role || p.archetype || ''),
      trustLevel: Number(p.companion.trustLevel ?? 5),
      recruitedAtTurn: Number(p.companion.recruitedAtTurn ?? 0)
    });
  }
  return out;
}

// ── Narrator Combat Block ─────────────────────────────────────────────────
// Slim combat snapshot for the narration-polish path (augmentNarration).
// Returns null when combat is inactive — the system prompt omits it silently.
// Also parses the last resolved beat from outcome.mechanics so the system
// prompt can instruct the model never to invert hit↔miss.

function buildNarratorCombatBlock(world, outcome) {
  const c = world?.combat;
  if (!c?.active) return null;
  const enemies = (Array.isArray(c.enemies) ? c.enemies : []).map(e => ({
    name: String(e?.name ?? ''),
    hp: Number(e?.hp ?? 0),
    maxHp: Number(e?.maxHp ?? 0),
    defeated: Boolean(e?.defeated),
    // DX-2a: per-enemy tactical position — STATE for the DM to narrate as
    // fiction (never recited; THE LAW lives in the prompt's TACTICAL READ rule).
    tactical: tacticalView(e?.tactical)
  }));
  const playerTactical = tacticalView(c.playerTactical);
  const mechanics = String(outcome?.mechanics ?? '');
  const hitMatch = /→\s*(hit|miss)/i.exec(mechanics);
  const dmgMatch = /(\d+)\s*dmg/i.exec(mechanics);
  // Victory and grapple outcomes carry no →hit/miss tag — detect them explicitly
  // so the narration validator can guard against inversion on these turns too.
  const isVictory = /\[combat:victory\]/i.test(mechanics);
  const isGrappleSuccess = !hitMatch && /\[grapple:(?:clinch|throw|choke)\b/i.test(mechanics);
  const isGrappleFail = !hitMatch && /\[grapple:(?:clinch-miss|fail)/i.test(mechanics);
  const lastBeat = hitMatch ? {
    result: hitMatch[1].toLowerCase(),
    damage: dmgMatch ? Number(dmgMatch[1]) : 0
  } : isVictory ? {
    result: 'victory',
    damage: 0
  } : isGrappleSuccess ? {
    result: 'grapple-success',
    damage: 0
  } : isGrappleFail ? {
    result: 'grapple-fail',
    damage: 0
  } : null;
  return {
    inCombat: true,
    round: Number(c.round ?? 0),
    enemies,
    playerTactical,
    pcHp: Number(world?.meta?.escapeHp ?? 0),
    pcMaxHp: Number(world?.meta?.escapeMaxHp ?? 0),
    lastBeat
  };
}

// DX-2a: a copied, plain tactical view for the DM context. Never mutated back
// into world state.
function tacticalView(t) {
  const src = t && typeof t === 'object' ? t : {};
  const cover = src.cover === 'half' || src.cover === 'full' ? src.cover : 'none';
  return { cover, flanked: Boolean(src.flanked), highGround: Boolean(src.highGround) };
}

// ── Combat ────────────────────────────────────────────────────────────────
// Pass B: derived view of world.combat for the DM. Returns null when combat
// is inactive so the system prompt can omit the block silently. Sliced/copied
// — callers must not mutate the returned arrays back into world state.

function buildCombatBlock(w) {
  const c = w?.combat;
  if (!c?.active) return null;
  const enemies = (Array.isArray(c.enemies) ? c.enemies : []).map(e => ({
    id: String(e?.id ?? ''),
    name: String(e?.name ?? ''),
    hp: Number(e?.hp ?? 0),
    maxHp: Number(e?.maxHp ?? 0),
    canParley: Boolean(e?.canParley),
    defeated: Boolean(e?.defeated)
  }));

  // Pass C2 — companions-in-combat view. Derived from party[1..n] so the
  // narrator can write companion-aware fight prose with wounds and
  // approach on hand. Only present when combat is active.
  const party = Array.isArray(w?.party) ? w.party : [];
  const companions = [];
  for (let i = 1; i < party.length; i++) {
    const p = party[i];
    if (!p?.companion) continue;
    const role = String(p.companion.role || p.archetype || '');
    companions.push({
      id: String(p.id || ''),
      name: String(p.name || ''),
      role,
      approach: companionApproachForRole(role),
      wounds: Number(p.wounds ?? 0),
      down: Number(p.wounds ?? 0) >= maxWounds(p.level ?? 1, statMod(p.stats?.GRIT ?? 10))
    });
  }

  return {
    round: Number(c.round ?? 0),
    playerGuard: Boolean(c.playerGuard),
    companionGuard: Boolean(c.companionGuard),
    enemies,
    companions
  };
}

// ── Dialogue Turn ─────────────────────────────────────────────────────────
// Derived view for LLM/DM prompts when scene.dialogue is active.
// sharedFacts are computed from the ledger (`npc:{id} shared:{factId}` markers).
// withheldFacts are computed from topicsOffered minus shared + current trust rules.

const DIALOGUE_TRUST_REVEAL_PUBLIC = 4;
const DIALOGUE_TRUST_REVEAL_SECRET = 7;

export function buildDialogueTurn(world, outcome) {
  const w = ensureWorld(world);
  const d = w.scene?.dialogue;
  if (!d) return null;

  const nodeId = String(w.map?.currentNodeId ?? '');
  const node = (w.map?.nodes || []).find(n => n.id === nodeId) || null;
  const npcs = node?.settlement?.npcs || [];
  const npc = npcs.find(n => String(n?.id) === String(d.npcId)) || null;
  if (!npc) return null;

  const trust = Number(npc.conversationState?.trustLevel ?? 5);
  const secrets = new Set(Array.isArray(npc.secrets) ? npc.secrets.map(String) : []);

  const sharedFacts = computeSharedFacts(w, String(d.npcId));
  const sharedSet = new Set(sharedFacts);

  const topicsOffered = Array.isArray(d.topicsOffered) ? d.topicsOffered.map(String) : [];
  const withheldFacts = [];
  for (const t of topicsOffered) {
    if (sharedSet.has(t)) continue;
    if (secrets.has(t)) {
      if (trust < DIALOGUE_TRUST_REVEAL_SECRET) withheldFacts.push(t);
    } else {
      if (trust < DIALOGUE_TRUST_REVEAL_PUBLIC) withheldFacts.push(t);
    }
  }

  // Brain mood from outcome (if available) takes priority over derived mood
  const brainMood = outcome?.brainMood || outcome?.brainDecision?.mood || null;

  return {
    npc: {
      name: String(npc.name || ''),
      role: String(npc.role || ''),
      mood: brainMood || dialogueMood(npc, trust),
      trustLevel: trust,
      personality: npc.personality || null,
      factionId: npc.factionId || null
    },
    sharedFacts,
    withheldFacts,
    lastMode: d.lastAnswer?.mode || null,
    lastFactId: d.lastAnswer?.factId || null,
    availableTopics: dialogueAvailableTopics(w)
  };
}

function computeSharedFacts(w, npcId) {
  const facts = Array.isArray(w.ledger?.facts) ? w.ledger.facts : [];
  const prefix = `npc:${npcId} shared:`;
  const out = [];
  for (const f of facts) {
    const t = String(f?.text || '');
    if (t.startsWith(prefix)) out.push(t.slice(prefix.length));
  }
  return out;
}

function dialogueMood(npc, trust) {
  const h = Number(npc?.personality?.honesty ?? 0.5);
  if (trust >= 7) return 'warm';
  if (h > 0.7) return 'open';
  if (h < 0.3) return 'guarded';
  if (trust <= 2) return 'wary';
  return 'measured';
}

// ── Goals ─────────────────────────────────────────────────────────────────

function buildGoalsBlock(w) {
  const all = Array.isArray(w.goals) ? w.goals : [];
  const active = all
    .filter(g => g.status === 'active')
    .slice(0, 3)
    .map(g => ({ kind: String(g.kind), label: String(g.label || ''), targetRef: String(g.targetRef) }));
  const completedThisSession = all.reduce((n, g) => n + (g.status === 'completed' ? 1 : 0), 0);
  return { active, completedThisSession };
}

// ── Scene ─────────────────────────────────────────────────────────────────

function buildScene(w, outcome) {
  const nodeId = String(w.map?.currentNodeId ?? '');
  const currentNode = (w.map?.nodes ?? []).find(n => n.id === nodeId) ?? null;
  const placeName = String(currentNode?.name ?? 'Unknown');
  const nodeType = String(currentNode?.nodeType ?? 'wilderness');

  const allStructures = Object.values(w.structures?.byId ?? {});
  const structuresHere = allStructures
    .filter(s => s?.nodeId === nodeId || s?.anchors?.nodeId === nodeId)
    .map((s, i) => ({ index: i + 1, kind: String(s.kind ?? 'structure') }));

  const interior = (w.scene?.interior && typeof w.scene.interior === 'object')
    // layout = the REAL room graph (count, single storey, doorways), so the DM prompt can
    // forbid invented stairs/floors/rooms (WB-Q1). objects = the room's real furnishings
    // (IOM-P2), so the DM stops inventing furniture the room doesn't have. room/material
    // (ROM-2) = the room's real name and the structure's canonical build material, so the
    // prompt can state WHERE the player stands and WHAT the walls are made of as law
    // instead of guessing. Ephemeral narration context, not state.
    ? (() => {
        const rs = getRoomState(w);
        return {
          structureKey: String(w.scene.interior.structureKey ?? ''),
          roomId: String(w.scene.interior.roomId ?? ''),
          layout: describeInteriorLayout(w),
          objects: rs.objects,
          room: rs.room,
          material: rs.material
        };
      })()
    : null;

  const toneWords = outcome?.pack?.toneWords ?? w._resolvedPack?.toneWords ?? null;
  const tone = deriveTone(toneWords, w.meta?.fate);

  // Exits from current node — the roads that lead onward. Map edges are keyed {a,b}
  // (NOT from/to): the old filter never matched, so `exits` was ALWAYS EMPTY and the DM
  // never knew where the roads led — a player arriving at a waypoint read it as a dead
  // end and got stuck (journey playtest soft-lock). Handle both schemas, defensively.
  const edges = Array.isArray(w.map?.edges) ? w.map.edges : [];
  const exits = edges
    .map(e => {
      const A = e.a ?? e.from, B = e.b ?? e.to;
      if (A === nodeId) return B;
      if (B === nodeId) return A;
      return null;
    })
    .filter(Boolean)
    .map(targetId => {
      const targetNode = (w.map?.nodes ?? []).find(n => n.id === targetId);
      return targetNode ? String(targetNode.name) : null;
    })
    .filter(Boolean);

  // Time of day from turn count (rough cycle)
  const turn = w.time?.turn ?? 0;
  const timeOfDay = ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'][turn % 6];

  // Settlement data
  const settlement = currentNode?.settlement ?? null;

  return {
    location: { name: placeName, type: nodeType, exits },
    interior,
    structuresHere,
    timeOfDay,
    activeThreat: pickActiveThreat(w),
    tone,
    settlementName: settlement?.decompressed ? placeName : null,
    settlementEconomy: settlement?.economy ?? null,
    settlementTensions: Array.isArray(settlement?.tensions) ? settlement.tensions.map(t => t.type) : []
  };
}

// ── NPCs Present ──────────────────────────────────────────────────────────

function buildNPCsPresent(w) {
  const nodeId = String(w.map?.currentNodeId ?? '');
  const currentNode = (w.map?.nodes ?? []).find(n => n.id === nodeId) ?? null;
  const settlement = currentNode?.settlement;
  if (!settlement?.npcs?.length) return [];

  const npcs = settlement.npcs;

  // IOM-P2: mark who is actually in the player's room, without filtering the roster —
  // downstream dialogue continuity reads the full list. Inside, "the room" is the
  // occupancy-derived room the player stands in; outdoors, it's who's out in the open.
  const interior = (w.scene?.interior && typeof w.scene.interior === 'object' && w.scene.interior) ? w.scene.interior : null;
  const roomOccupants = interior
    ? occupantsOfRoom(w, String(interior.structureKey || ''), String(interior.roomId || ''))
    : outdoorOccupants(w);
  const inRoomIds = new Set(roomOccupants.map(npc => String(npc?.id ?? npc?.name ?? '')));

  // First NPC gets full detail (~500 tokens), rest get summary (~200 each)
  return npcs.map((npc, i) => {
    const cs = npc.conversationState ?? {};
    const metPlayer = Boolean(cs.metPlayer);
    const topics = Array.isArray(cs.topicsDiscussed) ? cs.topicsDiscussed.slice(-5) : [];
    const gossipReceived = Array.isArray(npc.gossipReceived) ? npc.gossipReceived.slice(-3) : [];

    const base = {
      name: String(npc.name ?? `the ${npc.role}`),
      role: String(npc.role ?? 'townfolk'),
      inRoomWithPlayer: inRoomIds.has(String(npc?.id ?? npc?.name ?? '')),
      factionId: npc.factionId || null,
      personality: npc.personality ?? null,
      disposition: npc.disposition ?? null,
      conversationState: {
        metPlayer,
        trustLevel: Number(cs.trustLevel ?? 5),
        topicsDiscussed: topics,
        lastInteraction: cs.lastInteraction ?? null
      }
    };

    // Returning NPC: include conversation summary so DM has memory of prior interactions.
    if (metPlayer && topics.length > 0) {
      base.conversationSummary = `Has met the player. Discussed: ${topics.join(', ')}.`;
    }

    // Include gossip the NPC received from other NPCs.
    if (gossipReceived.length > 0) {
      base.gossipHeard = gossipReceived;
    }

    if (i === 0) {
      // Full detail for primary NPC
      return {
        ...base,
        publicKnowledge: summarizeKnowledge(npc.knowledgeGraph, false),
        secrets: summarizeSecrets(npc),
        archetypeDesc: String(npc.archetypeDesc ?? '')
      };
    }

    // Summary for other NPCs
    return base;
  });
}

function summarizeKnowledge(knowledgeGraph, secretsOnly = false) {
  if (!Array.isArray(knowledgeGraph)) return [];
  return knowledgeGraph
    .filter(f => secretsOnly ? f.source === 'secret' : f.source !== 'secret')
    .slice(0, 8)
    .map(f => f.factId);
}

function summarizeSecrets(npc) {
  if (!Array.isArray(npc.secrets)) return [];
  return npc.secrets.slice(0, 4).map(s => ({
    factId: String(s),
    revealCondition: 'trust >= 7 or persuasion check'
  }));
}

// ── World Pressure ────────────────────────────────────────────────────────

function buildWorldPressure(w) {
  const inst = ensureInstrumentLayer(w.instrument);
  const factions = Array.isArray(w.factions) ? w.factions : [];

  // Faction summary
  const factionSummary = factions.map(f => {
    const attitude = f.hostility >= 80 ? 'hostile' : f.hostility >= 40 ? 'wary' : 'neutral';
    return `${f.id}: ${attitude}, pressure ${f.pressure}`;
  }).join('; ') || 'no factions';

  // Ecology summary
  const eco = w.ecology ?? {};
  const ecoNotes = [];
  if (eco.corruption >= 40) ecoNotes.push(`corruption ${eco.corruption}`);
  if (eco.scarcity >= 40) ecoNotes.push(`scarcity ${eco.scarcity}`);
  if (eco.instability >= 40) ecoNotes.push(`instability ${eco.instability}`);
  const ecologySummary = ecoNotes.length ? ecoNotes.join(', ') : 'ecology stable';

  // Active scars
  const scars = Array.isArray(w.scars) ? w.scars.map(s => s.description).slice(0, 3) : [];

  // Active threads
  const threads = inst.threads
    .filter(t => t.status !== 'resolved')
    .map(t => ({ label: t.label, tension: t.tension, status: t.status }))
    .slice(0, 4);

  return { factionSummary, ecologySummary, activeScars: scars, activeThreads: threads };
}

// ── Player ────────────────────────────────────────────────────────────────

function buildPlayer(w) {
  const actor = Array.isArray(w.party) && w.party.length ? w.party[0] : {};
  const inv = actor.inventory ?? {};
  const weapons = Array.isArray(inv.weapons) ? inv.weapons.map(g => String(g?.name ?? g)).slice(0, 3) : [];
  const armor = Array.isArray(inv.armor) ? inv.armor.map(g => String(g?.name ?? g)).slice(0, 2) : [];

  return {
    name: String(actor.name ?? 'Adventurer'),
    stats: actor.stats ?? {},
    weapons,
    armor,
    wounds: Number(actor.wounds ?? 0),
    stress: Number(actor.stress ?? 0),
    reputation: w.reputation?.factions ?? {}
  };
}

// ── Rules ─────────────────────────────────────────────────────────────────

function buildRules(w, pack) {
  const packName = String(pack?.name ?? w.pack?.primaryId ?? 'fantasy');
  const toneWords = pack?.toneWords ?? {};
  const band = fateBand(w.meta?.fate);
  const setting = Array.isArray(toneWords[band]) ? toneWords[band].join(', ') : packName;

  return {
    setting,
    packId: String(w.pack?.primaryId ?? 'fantasy'),
    whatCannotExist: Array.isArray(pack?.constraints) ? pack.constraints : [],
    diceSystem: 'd20, DC set by engine, report result to engine'
  };
}

// ── World Whisper (one offscreen change for DM to mention) ───────────────

function pickWorldWhisper(w) {
  const timeline = Array.isArray(w.timeline) ? w.timeline : [];
  // Find the most recent worldTick event
  for (let i = timeline.length - 1; i >= Math.max(0, timeline.length - 5); i--) {
    const e = timeline[i];
    if (e?.kind === 'worldTick' && e?.data?.text) {
      return String(e.data.text);
    }
  }
  return null;
}

// ── Active Threat ─────────────────────────────────────────────────────────

function pickActiveThreat(w) {
  const threats = Array.isArray(w.ledger?.threats) ? w.ledger.threats : [];
  if (!threats.length) return null;
  // Most recent high-level threat
  const sorted = [...threats].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  const top = sorted[0];
  return typeof top === 'string' ? top : String(top?.text ?? top?.description ?? '');
}

// ── Speaker Context ──────────────────────────────────────────────────────────

/**
 * buildSpeakerContext(npc, facts) → SpeakerContext | null
 *
 * Builds a perspective-filtered speaker context for an NPC with depth.
 * Returns null for shallow NPCs (no personality).
 */
export function buildSpeakerContext(npc, facts) {
  if (!npc?.personality) return null;

  const allFacts = Array.isArray(facts) ? facts : [];
  const pr = npc.playerRelationship || { trust: 0.5, interactions: 0 };
  const { filteredFacts, emotionalColoring } = filterContext(npc, allFacts, pr);

  const omittedFacts = allFacts
    .filter(f => !filteredFacts.some(ff => ff.factId === f.factId))
    .map(f => f.factId || f.id || '');

  return {
    name: String(npc.name ?? npc.role ?? ''),
    role: String(npc.role ?? ''),
    personality: npc.personality,
    filteredFacts,
    omittedFacts,
    secrets: Array.isArray(npc.secrets) ? npc.secrets : [],
    emotionalColoring
  };
}

/**
 * Derive a single tone label from pack toneWords + fate.
 * Returns 'blood' | 'grim' | 'cooperative'
 */
function deriveTone(toneWords, fate) {
  const band = fateBand(Number(fate ?? 0.5));
  if (!toneWords || typeof toneWords !== 'object') return band;
  if (band === 'blood' && Array.isArray(toneWords.blood) && toneWords.blood.length) return 'blood';
  if (band === 'grim'  && Array.isArray(toneWords.grim)  && toneWords.grim.length)  return 'grim';
  return band;
}
