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

import { ensureWorld, VICE_AXES } from '../state.js';
import { ensureInstrumentLayer } from '../instrument.js';
import { seedFromString, makeRng } from '../rng.js';
import { fateBand } from '../rulesets.js';
import { filterContext, applyMoodOverlay } from '../npc/perspectiveFilter.js';
import { isInfoSeekingText } from '../grace/gracefulAdjudication.js';
import { availableTopics as dialogueAvailableTopics } from '../npc/dialogue.js';
import { companionApproachForRole } from '../combat/companionTurn.js';
import { statMod, maxWounds } from '../ruleset/core/stats.js';
import { buildAsciiMap } from './asciiMap.js';
import { describeInteriorLayout } from '../structures/interiors.js';
import { escalationTier } from '../morality/escalation.js';
import { pickOmenPhrase } from '../morality/omenVocabulary.js';
import { getRoomState } from '../structures/roomState.js';
import { occupantsOfRoom, outdoorOccupants, visibleThroughWindows } from '../structures/roomOccupancy.js';
import { roomWindows, roomWindowFacings } from '../structures/roomWindows.js';
import { doorsOf } from '../structures/doors.js';
import { outdoorTerrainFacts } from '../world/wildFacts.js';

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
    // MR-3c: the outdoor wild read (features-by-direction + roads in sight), null
    // indoors or for a bare clearing — the DM prompt renders it as a hide-the-math
    // TERRAIN line so the narrated wild matches the map and the survey exactly.
    terrain: scene.terrain,
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
    combat: buildNarratorCombatBlock(w, outcome),
    // MP-5a (docs/MORAL_PHYSICS.md §5) — the tier→sign-vocabulary omen: null at Tier 0
    // ("unremarked means unremarked," no line at all) or { register, axis, phrase } at
    // Tier 1+. READ-ONLY re-derivation off live morality standing + the most recent deed;
    // never stored, never numeric (invariant I — llmAdapter.js renders only the phrase).
    moralOmen: moralOmen(w),
    // MP-5b (docs/MORAL_PHYSICS.md §5) — the Cassandra: null unless a real present NPC has
    // just delivered the one-time warning (see cassandraOmen's own comment for the exact
    // freshness + speaker-selection rules); { name, role } when she has just spoken —
    // llmAdapter.js renders this as ONE quiet, waveable line, never a mechanic name.
    cassandraOmen: cassandraOmen(w, roomOccupants)
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

// MP-5a — tier (0..4, the escalation ladder's rung, docs/MORAL_PHYSICS.md §4) → the
// omen vocabulary's loudness REGISTER (docs/MORAL_PHYSICS.md §5). T0 has no register at
// all (moralOmen returns null — "unremarked means unremarked", no line). T1 is a faint
// sign; T2 is the register a stranger might start to remark on ("reputation travels");
// T3 and T4 share the loudest register this slice has (the pact-gift's OWN beat — "the
// gift on the doorstep" — is MP-5b/the Cassandra, a later packet; MP-5a only needs to
// say the sign has sharpened to its loudest).
const TIER_REGISTER = ['', 'faint', 'rumor', 'hunted', 'hunted'];

// A deed KIND'S natural axis home — used ONLY as the dominant-axis fallback for the rare
// real deed (engine/magic/castConsequence.js's GM_TAG light-cruelty path) that records a
// deed without a paired axisDelta bump (every OTHER recordDeed call site — playloop.js's
// applyDeedCharges/the coerced-build marker, castConsequence's dedicated-kill branch —
// pairs recordDeed with axisDelta in the SAME batch, so this fallback rarely engages).
// Cruelty/forbidden reach for wrath (the deed-kind most directly wrath-flavored, and
// MORALITY_SYSTEM.md's own scripted Wrath-god vocabulary is the house's most-worked
// register); mercy/aid/atonement never reach Tier 1+ in the first place (the escalation
// ladder only climbs on cruelty/forbidden — see engine/morality/escalation.js), so those
// kinds never need a fallback here.
const DEED_KIND_AXIS_FALLBACK = 'wrath';

// MP-5a — moralOmen(world) → { register, axis, phrase } | null.
//
// READ-ONLY, derived, never stored (docs/MORAL_PHYSICS.md §5 + invariant I: no numeric
// moral value may reach a player-facing string). Recomputes the escalation tier from the
// player's CURRENT standing (corruption/heat live on morality — the same figures MP-3's
// hunt latch reads in worldTick.js) folded with the MOST RECENT deed's own severity/kind/
// witness-reach (the same inputs effectsCore.recordDeed already fed escalationTier at
// record-time — this is a read-only re-derivation, not a new rule). Returns null at Tier 0
// (no deed yet, or nothing has accumulated) — "unremarked means unremarked," no line at
// all, matching how the doors/terrain facts return '' when there's nothing to state.
//
// The dominant axis is the vice axis carrying the highest score (mirrors
// state.js `deriveCorruption` — "the dominant pole defines you," never a blended average).
// Tier > 0 is the SOLE gate for whether an omen fires (the escalation ladder's own
// contract already answers "has anything grave/accumulated happened" — a real deed that
// graded Tier 1+ must always speak, even on the rare path where its axisDelta bump hasn't
// landed yet, so a stale "no axis moved" check would wrongly silence a real omen).
// A phrase is sampled DETERMINISTICALLY from the dominant axis's register pool, seeded
// from STABLE world fields (world seed + actor id + axis + the deed-ledger length) — never
// Math.random, never the LLM's choice, and stable across re-renders of the same world
// state (only changes when the underlying moral state actually changes, which is what
// "derived, not stored" means for U579's save/load round-trip test). Never throws.
function moralOmen(w) {
  const actor = Array.isArray(w?.party) && w.party.length ? w.party[0] : null;
  if (!actor || !actor.morality || typeof actor.morality !== 'object') return null;

  const standing = { corruption: Number(actor.morality.corruption ?? 0), heat: Number(actor.morality.heat ?? 0) };
  const deeds = Array.isArray(w.deeds) ? w.deeds : [];
  const lastDeed = deeds.length ? deeds[deeds.length - 1] : null;
  // No deed at all yet → feed an empty deed (severity 0, no kind) so T1/T2 correctly stay
  // silent while T3/T4 can still fire purely from accumulated standing (escalationTier's
  // own contract — see engine/morality/escalation.js — evaluates T3/T4 off actor alone).
  const deed = lastDeed ? { severity: lastDeed.severity, kind: lastDeed.kind } : {};
  const wild = lastDeed ? (Array.isArray(lastDeed.witnesses) && lastDeed.witnesses.length === 0) : false;
  const witnessReach = lastDeed ? (Array.isArray(lastDeed.witnesses) ? lastDeed.witnesses.length : 0) : 0;

  const tier = escalationTier(deed, standing, { witnessReach, wild });
  if (tier <= 0) return null;

  const register = TIER_REGISTER[Math.min(tier, TIER_REGISTER.length - 1)];
  if (!register) return null;

  const axes = (actor.morality.axes && typeof actor.morality.axes === 'object') ? actor.morality.axes : {};
  let dominantAxis = '';
  let best = 0;
  for (const axis of VICE_AXES) {
    const v = Number(axes[axis] ?? 0);
    if (v > best) { best = v; dominantAxis = axis; }
  }
  // Every axis reads zero (the rare unpaired-recordDeed path) — fall back to the deed
  // kind's natural axis home rather than going silent on a real, tier-graded omen.
  if (!dominantAxis) dominantAxis = DEED_KIND_AXIS_FALLBACK;

  const seedKey = `${String(w.meta?.seed ?? '')}|${String(actor.id ?? 'party')}|${deeds.length}`;
  const phrase = pickOmenPhrase(dominantAxis, register, seedKey);
  if (!phrase) return null;

  return { register, axis: dominantAxis, phrase };
}

// MP-5b — THE CASSANDRA (docs/MORAL_PHYSICS.md §5, docs/briefs/MP-5b-the-cassandra.md).
// "A person who sees you clearly and says the hard thing once, plainly, and can be waved
// off." worldTick.js's tickCassandra owns the WHEN (a permanent latch, `party[0].morality.
// cassandraT > 0` once delivered — mirrors huntedT, never re-fires until heat cools below
// the approach band's own floor). This function owns the WHO and IS-IT-STILL-WORTH-SAYING:
//
//   (a) FRESHNESS — cassandraT is a PERMANENT latch (by design; see worldTick.js's own
//       comment on tickCassandra), so a bare `cassandraT > 0` check would keep narrating
//       the same line turn after turn while the player idles in the band. The line must
//       print for the delivering turn only. The freshest signal available without a
//       dedicated per-render counter (none exists that increments exactly once per player
//       action — time.turn and timeline.length both sometimes hold flat across a real
//       no-op turn, verified empirically) is the SAME idiom pickWorldWhisper already uses
//       below: scan world.timeline for the most recent `kind:'worldTick'` entry and check
//       whether it is the Cassandra's OWN delivery line (tickCassandra's pushTickLog text,
//       "[TICK] the Cassandra speaks..."). The instant ANY later tick activity logs
//       anything else, this stops matching and the line goes silent — while cassandraT
//       stays set underneath, correctly blocking a second delivery until real cooling.
//   (b) THE SPEAKER — re-derived FRESH from live occupancy (never cached/stored), mirroring
//       pickCassandraWitness in worldTick.js exactly (same trust-preferring, seed-tied-break
//       selection over the SAME roomOccupantsHere pool this file already computes) — while
//       the freshness window (a) holds, nothing else has moved the world, so this returns
//       the identical NPC who was actually present at delivery. An earned name (met/home,
//       the SAME rule settlement.npcs already applies above) is used if available; a
//       present-but-unmet stranger still speaks — presence, not acquaintance, is the gate.
//
// Returns null when there is nothing to say (not delivered, or delivered but stale) —
// "nothing owed" reads the same as MP-5a's omen: no line at all, matching moralOmen's own
// silence contract. Never throws.
function cassandraOmen(w, roomOccupants) {
  const actor = Array.isArray(w?.party) && w.party.length ? w.party[0] : null;
  const mo = actor?.morality;
  if (!mo || typeof mo !== 'object') return null;
  if (!(Number(mo.cassandraT ?? 0) > 0)) return null; // never delivered (or re-armed by cooling)

  // Freshness: the Cassandra's own tick-log line must be the MOST RECENT worldTick entry.
  const timeline = Array.isArray(w.timeline) ? w.timeline : [];
  let latestTickText = '';
  for (let i = timeline.length - 1; i >= 0; i--) {
    const e = timeline[i];
    if (e?.kind === 'worldTick' && e?.data?.text) { latestTickText = String(e.data.text); break; }
  }
  if (!latestTickText.startsWith('[TICK] the Cassandra speaks')) return null; // superseded — stale, stay silent

  const witness = pickCassandraSpeaker(w, roomOccupants);
  if (!witness) return null; // defensive — tickCassandra never delivers without a present witness

  const nodeId = String(w.map?.currentNodeId ?? '');
  const currentNode = (w.map?.nodes ?? []).find(n => n.id === nodeId) ?? null;
  const homeNodeId = String(w?.meta?.homeNodeId || '');
  const known = (Boolean(homeNodeId) && homeNodeId === nodeId) || Boolean(witness?.conversationState?.metPlayer);
  const name = known ? String(witness.name || '').trim() : '';
  const role = String(witness.role || '').trim();

  return { name, role };
}

// The trust-preferring, seed-tied-break present-NPC pick — duplicated from worldTick.js's
// pickCassandraWitness (the repo's own mirror-rather-than-reach-across convention,
// engine/morality/escalation.js's DEED_SEV comment) so this narration-layer file never
// imports the world-simulation layer. Operates over roomOccupants (the SAME occupancy pool
// buildNarratorContext already computed above), not a re-derivation, so it can never
// disagree with what "who is here" already answered for this exact render. Pure.
function pickCassandraSpeaker(w, roomOccupants) {
  const present = (Array.isArray(roomOccupants) ? roomOccupants : []).filter(n => n && (n.id || n.name));
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
  const rng = makeRng(seedFromString(`${w.meta?.seed}|cassandra-witness|${nodeId}|${topTrust.map(n => String(n.id || n.name)).sort().join(',')}`));
  return topTrust[rng.int(0, topTrust.length - 1)];
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

// ── Interior plan-facts (MR-2b) ────────────────────────────────────────────
// The DM prompt's ARCHITECTURE grounding block: the door canon (MR-2a) rendered
// as perceivable TEXTURE so the DM describes THE house — its real doors and
// their states — never A house it invents. This is the prompt-side twin of the
// CG-ARCH coherence check (engine/coherence/checks.js): the check catches an
// invented staircase after the fact; this feeds the DM the real front door +
// any SECURED interior door so it narrates them correctly in the first place.
//
// HIDE-THE-MATH (Vol 17): door state is rendered in fiction words ("stands
// barred", "is locked fast", "sits shut"), never the enum. OPEN doors are the
// unremarkable default and are omitted (a real DM doesn't announce every open
// doorway). CAPPED + STABLE-ORDERED (sorted by door id, ≤ DOOR_FACT_CAP
// mentions) so an identical turn produces an identical block — no token churn,
// no new randomness (pure f(world)). Returns null when not inside a structure.
const DOOR_FACT_CAP = 4;
// MR-2d: cap the through-window folk the plan-facts bundle carries (line of sight, not a
// roster dump) — stable-ordered by visibleThroughWindows so an identical turn is identical.
const WINDOW_FACT_CAP = 3;
const DOOR_STATE_TEXTURE = {
  barred: 'stands barred from the far side',
  locked: 'is locked fast',
  shut: 'sits shut',
  // open is the default — deliberately no texture line (omitted, not announced).
};

function interiorPlanFacts(w) {
  const interior = (w?.scene && typeof w.scene.interior === 'object' && w.scene.interior) ? w.scene.interior : null;
  if (!interior) return null;
  const structId = String(interior.structureKey ?? '');
  const st = w.structures?.byId?.[structId];
  if (!st) return null;
  const roomId = String(interior.roomId ?? '');

  const doors = doorsOf(st);
  // Stable order: the canonical door list is already sorted by id in
  // ensureStructures, but sort defensively so the block never churns.
  const ordered = [...doors].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // The FRONT door — always worth naming (it's how the player leaves). Its
  // direction is the doorstep direction the layout already computes; its state
  // is canon. Rendered even when open (the way out is load-bearing orientation).
  const ext = ordered.find(d => d && d.exterior) || null;
  let frontDoor = null;
  if (ext) {
    frontDoor = {
      state: String(ext.state || 'shut'),
      // Whether the CURRENT room is the one the front door fronts on (so the DM
      // knows the way out is from HERE vs. back toward the front).
      hereFronts: String(ext.a) === roomId,
    };
  }

  // SECURED interior doors touching THIS room (barred/locked/shut) — the ones a
  // player perceives and must act on. Open interior doors are omitted. Capped.
  const securedHere = [];
  for (const d of ordered) {
    if (!d || d.exterior) continue;
    const touchesHere = String(d.a) === roomId || String(d.b) === roomId;
    if (!touchesHere) continue;
    const texture = DOOR_STATE_TEXTURE[String(d.state)];
    if (!texture) continue; // open (or unknown) — nothing to announce
    securedHere.push({ state: String(d.state), texture });
    if (securedHere.length >= DOOR_FACT_CAP) break;
  }

  // MR-2d: this room's WINDOWS as canon apertures — count, compass facings, shuttered
  // state, and (when open) WHO the player can see out on the side the glass looks onto,
  // each with their OCC-STORY reason. So the DM narrates the real windows this room has
  // and the real folk visible through them, never invents a window or a face at it. Pure
  // f(world); the through-window folk are the same facing-aware set the look-around uses.
  const interiorRef = { structureKey: structId, roomId };
  const win = roomWindows(w, interiorRef);
  let windows = null;
  if (win.count > 0) {
    // Earned-name gate (same rule as the PEOPLE-HERE block above): the DM gets a name only
    // when the player is HOME (knows the neighbors) or has MET this NPC — otherwise a role,
    // so a stranger glimpsed through the glass at a new town isn't named for free.
    const nodeIdNow = String(w?.map?.currentNodeId ?? '');
    const atHome = Boolean(w?.meta?.homeNodeId) && String(w.meta.homeNodeId) === nodeIdNow;
    const displayName = (n) => {
      const known = atHome || Boolean(n?.conversationState?.metPlayer);
      return (known && n?.name) ? String(n.name) : String(n?.role || 'someone');
    };
    const through = visibleThroughWindows(w, structId, roomId)
      .slice(0, WINDOW_FACT_CAP)
      .map(n => ({ name: displayName(n), reason: String(n.reason || ''), side: String(n.side || '') }));
    windows = {
      count: win.count,
      shuttered: Boolean(win.shuttered),
      facings: roomWindowFacings(w, interiorRef),
      outlook: String(win.outlook || ''),
      // Only present + non-empty when the window is open AND someone's on the arc.
      through,
    };
  }

  return { frontDoor, securedDoors: securedHere, windows };
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
          material: rs.material,
          // MR-2b: the door canon rendered as perceivable texture (front door +
          // any SECURED interior door), so the DM describes THE house's real
          // doors and states — never invents them. Pure f(world); capped; stable.
          planFacts: interiorPlanFacts(w)
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

  // MR-3c: the outdoor wild read — the derived features in the player's bubble by
  // compass direction + the roads in sight, the SAME derivation the survey composes
  // and the map draws (engine/world/wildFacts.js over MR-3a). null indoors (the
  // interior seam owns that) or for a bare clearing. Threaded to the DM prompt as a
  // hide-the-math TERRAIN line (llmAdapter.outdoorTerrainFact), mirroring how the door/
  // window planFacts ride the interior into the prompt. Pure f(world), no stored state.
  const terrain = outdoorTerrainFacts(w);

  return {
    location: { name: placeName, type: nodeType, exits },
    interior,
    terrain,
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
