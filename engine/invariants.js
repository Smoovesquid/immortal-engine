import { WORLD_VERSION, VICE_AXES, VIRTUE_AXES } from './state.js';
import { statMod, maxWounds } from './ruleset/core/stats.js';
import { nearestNodeToRegionCell, roomOfStructCell } from './map/spatial/tacticalPos.js';
import { floorPlan } from './structures/floorPlan.js';
import { isDoorState } from './structures/doors.js';

const SPELL_SLOT_LEVELS = [1, 2, 3, 4, 5];
const CURRENCY_KEYS = ['copper', 'silver', 'gold', 'platinum'];
// Computed lazily (not at module top level) to avoid a circular-import TDZ with state.js.
const moralityAxisKeys = () => [...VICE_AXES, ...VIRTUE_AXES];

export function assertWorldInvariants(world) {
  if (!world || typeof world !== 'object') {
    throw new Error('Invariant: world must be object');
  }

  if (world.meta?.version !== WORLD_VERSION) {
    throw new Error('Invariant: world version mismatch');
  }

  // Pass H — homeNodeId, when non-empty, must reference an existing
  // settlement node. Empty string is the default for new worlds and the
  // graceful-degradation value for pre-Pass-H save loads (those worlds
  // simply have no home concept). The home must be a real place AND
  // must be a settlement specifically — home cannot be a wilderness tile.
  const homeNodeId = String(world.meta?.homeNodeId ?? '');
  if (homeNodeId) {
    const nodes = Array.isArray(world.map?.nodes) ? world.map.nodes : [];
    const home = nodes.find(n => n && String(n.id) === homeNodeId) || null;
    if (!home) {
      throw new Error(`Invariant: meta.homeNodeId ${homeNodeId} does not match any node`);
    }
    if (String(home.nodeType) !== 'settlement') {
      throw new Error(`Invariant: meta.homeNodeId ${homeNodeId} is not a settlement node (nodeType=${home.nodeType})`);
    }
  }

  // v20 — free-roam avatar position. The player always has an integer tile cell,
  // even when standing in open wilderness with no currentNodeId.
  const mapPos = world.map?.pos;
  if (mapPos != null) {
    if (typeof mapPos !== 'object' || !Number.isInteger(mapPos.x) || !Number.isInteger(mapPos.y)) {
      throw new Error('Invariant: map.pos must be an integer { x, y } cell');
    }
  }

  // Pass C1 — party + companion shape (cap 3, marker structure).
  const party = world.party;
  if (!Array.isArray(party)) {
    throw new Error('Invariant: party must be an array');
  }
  if (party.length > 3) {
    throw new Error(`Invariant: party.length ${party.length} exceeds cap 3`);
  }
  const seenCompanionSources = new Set();
  for (let i = 0; i < party.length; i++) {
    const member = party[i];
    if (!member || typeof member !== 'object') {
      throw new Error(`Invariant: party[${i}] must be object`);
    }

    // Pass T1 — crunch schema invariants.
    assertCrunchFields(member, i);

    // v22 — morality (the Dark Path). See docs/MORALITY_SYSTEM.md.
    const mo = member.morality;
    if (!mo || typeof mo !== 'object') {
      throw new Error(`Invariant: party[${i}].morality must be object`);
    }
    if (!Number.isInteger(mo.corruption) || mo.corruption < 0 || mo.corruption > 100) {
      throw new Error(`Invariant: party[${i}].morality.corruption must be integer 0..100`);
    }
    if (!Number.isInteger(mo.virtue) || mo.virtue < 0 || mo.virtue > 100) {
      throw new Error(`Invariant: party[${i}].morality.virtue must be integer 0..100`);
    }
    if (!Number.isInteger(mo.heat) || mo.heat < 0) {
      throw new Error(`Invariant: party[${i}].morality.heat must be non-negative integer`);
    }
    if (typeof mo.locked !== 'boolean') {
      throw new Error(`Invariant: party[${i}].morality.locked must be boolean`);
    }
    if (!mo.patrons || typeof mo.patrons !== 'object' || Array.isArray(mo.patrons)) {
      throw new Error(`Invariant: party[${i}].morality.patrons must be a plain object`);
    }
    if (!Number.isInteger(mo.lastDeedT) || mo.lastDeedT < 0) {
      throw new Error(`Invariant: party[${i}].morality.lastDeedT must be non-negative integer`);
    }
    // MP-3 — the hunt latch (docs/MORAL_PHYSICS.md §4): world-tick index of the last hunt,
    // 0 = never / re-armed. Non-negative integer, same shape as lastDeedT.
    if (!Number.isInteger(mo.huntedT) || mo.huntedT < 0) {
      throw new Error(`Invariant: party[${i}].morality.huntedT must be non-negative integer`);
    }
    // MP-3 — the decay counter: ticks toward the next heat-decay step. Non-negative integer.
    if (!Number.isInteger(mo.heatCoolTicks) || mo.heatCoolTicks < 0) {
      throw new Error(`Invariant: party[${i}].morality.heatCoolTicks must be non-negative integer`);
    }
    // MP-4 — the pact latch (docs/MORAL_PHYSICS.md §4 T4): world-tick index of the last
    // unbidden dark gift, 0 = never / re-armed. Non-negative integer, same shape as huntedT.
    if (!Number.isInteger(mo.pactT) || mo.pactT < 0) {
      throw new Error(`Invariant: party[${i}].morality.pactT must be non-negative integer`);
    }
    // MP-5b — the Cassandra (docs/MORAL_PHYSICS.md §5): cassandraArmed is true from the
    // moment heat enters the approach band until the beat is delivered (a HOLD state the
    // hunt/pact latches never needed — see engine/state.js's ensureMorality comment).
    if (typeof mo.cassandraArmed !== 'boolean') {
      throw new Error(`Invariant: party[${i}].morality.cassandraArmed must be boolean`);
    }
    // cassandraT — world-tick index the beat was actually SPOKEN, 0 = not yet delivered for
    // the current arming (or re-armed). Non-negative integer, same shape as huntedT/pactT.
    if (!Number.isInteger(mo.cassandraT) || mo.cassandraT < 0) {
      throw new Error(`Invariant: party[${i}].morality.cassandraT must be non-negative integer`);
    }
    // v23 — the seven sin + seven virtue accumulators, each 0..100.
    const axes = mo.axes;
    if (!axes || typeof axes !== 'object' || Array.isArray(axes)) {
      throw new Error(`Invariant: party[${i}].morality.axes must be a plain object`);
    }
    for (const k of moralityAxisKeys()) {
      const v = axes[k];
      if (!Number.isInteger(v) || v < 0 || v > 100) {
        throw new Error(`Invariant: party[${i}].morality.axes.${k} must be integer 0..100`);
      }
    }

    // v24 — SRD 5e sheet. null (legacy character) or a well-formed sheet:
    // six abilities 1..20, positive maxHP, plausible AC, level 1..20.
    const dnd = member.dnd;
    if (dnd != null) {
      if (typeof dnd !== 'object' || Array.isArray(dnd)) {
        throw new Error(`Invariant: party[${i}].dnd must be object or null`);
      }
      const ab = dnd.abilities;
      if (!ab || typeof ab !== 'object') {
        throw new Error(`Invariant: party[${i}].dnd.abilities must be object`);
      }
      for (const k of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
        if (!Number.isInteger(ab[k]) || ab[k] < 1 || ab[k] > 20) {
          throw new Error(`Invariant: party[${i}].dnd.abilities.${k} must be integer 1..20`);
        }
      }
      if (!Number.isInteger(dnd.maxHP) || dnd.maxHP < 1) {
        throw new Error(`Invariant: party[${i}].dnd.maxHP must be positive integer`);
      }
      if (!Number.isInteger(dnd.ac) || dnd.ac < 5 || dnd.ac > 30) {
        throw new Error(`Invariant: party[${i}].dnd.ac must be integer 5..30`);
      }
      if (!Number.isInteger(dnd.level) || dnd.level < 1 || dnd.level > 20) {
        throw new Error(`Invariant: party[${i}].dnd.level must be integer 1..20`);
      }
    }

    const c = member.companion;
    if (i === 0) {
      if (c != null) {
        throw new Error('Invariant: party[0].companion must be null (player is not a companion)');
      }
      continue;
    }
    if (c == null) continue;
    if (typeof c !== 'object') {
      throw new Error(`Invariant: party[${i}].companion must be object or null`);
    }
    if (typeof c.sourceNpcId !== 'string' || !c.sourceNpcId) {
      throw new Error(`Invariant: party[${i}].companion.sourceNpcId must be non-empty string`);
    }
    if (!Number.isInteger(c.recruitedAtTurn) || c.recruitedAtTurn < 0) {
      throw new Error(`Invariant: party[${i}].companion.recruitedAtTurn must be non-negative integer`);
    }
    if (!Number.isInteger(c.trustLevel) || c.trustLevel < 0 || c.trustLevel > 10) {
      throw new Error(`Invariant: party[${i}].companion.trustLevel must be integer 0..10`);
    }
    if (typeof c.role !== 'string') {
      throw new Error(`Invariant: party[${i}].companion.role must be string`);
    }
    if (seenCompanionSources.has(c.sourceNpcId)) {
      throw new Error(`Invariant: duplicate companion sourceNpcId ${c.sourceNpcId}`);
    }
    seenCompanionSources.add(c.sourceNpcId);
  }

  // v22 — deeds index. Lightweight, well-formed, bounded. (Authoritative history
  // is the canon log; this is the recency mirror the prose/rumor layers read.)
  const deeds = world.deeds;
  if (!Array.isArray(deeds)) {
    throw new Error('Invariant: world.deeds must be an array');
  }
  if (deeds.length > 64) {
    throw new Error(`Invariant: world.deeds.length ${deeds.length} exceeds cap 64`);
  }
  const VALID_DEED_KINDS = new Set(['cruelty', 'forbidden', 'mercy', 'aid', 'atonement']);
  for (let i = 0; i < deeds.length; i++) {
    const d = deeds[i];
    if (!d || typeof d !== 'object') {
      throw new Error(`Invariant: deeds[${i}] must be object`);
    }
    if (!VALID_DEED_KINDS.has(d.kind)) {
      throw new Error(`Invariant: deeds[${i}].kind ${d.kind} not a valid deed kind`);
    }
    // NPC-DEED-1 — WHO did it must be explicit and honest. ensureDeeds defaults a missing actorId
    // to 'party' (the player), so this is always a non-empty string; the assertion guards against a
    // future writer stamping an empty/blank actor (which would let a deed become un-attributable —
    // the exact silent-misattribution class this packet closes).
    if (typeof d.actorId !== 'string' || d.actorId.trim() === '') {
      throw new Error(`Invariant: deeds[${i}].actorId must be a non-empty string`);
    }
    if (!Number.isInteger(d.severity) || d.severity < 0 || d.severity > 100) {
      throw new Error(`Invariant: deeds[${i}].severity must be integer 0..100`);
    }
    // MP-2 — the escalation-ladder rung (docs/MORAL_PHYSICS.md §4). Additive; old
    // saves normalize to 0 in ensureDeeds. Must be an integer in the ladder's range.
    if (!Number.isInteger(d.tier) || d.tier < 0 || d.tier > 4) {
      throw new Error(`Invariant: deeds[${i}].tier must be integer 0..4`);
    }
  }

  // SP-1 — player↔faction reputation. Bounded standing keyed only by known factions
  // (ensureReputation rebuilds keys from world.factions; the factionRepDelta op
  // refuses unknown ids — a stray key here means a mutation bypassed both).
  const rep = world.reputation;
  if (!rep || typeof rep !== 'object' || !rep.factions || typeof rep.factions !== 'object') {
    throw new Error('Invariant: world.reputation.factions must be object');
  }
  const knownFactionIds = new Set((Array.isArray(world.factions) ? world.factions : []).map(f => String(f?.id)));
  for (const [fid, v] of Object.entries(rep.factions)) {
    if (!knownFactionIds.has(fid)) {
      throw new Error(`Invariant: reputation.factions key ${fid} is not a known faction`);
    }
    if (!Number.isInteger(v) || v < -100 || v > 100) {
      throw new Error(`Invariant: reputation.factions.${fid} must be integer -100..100`);
    }
  }

  // v21 — position persistence. Player (party[0]) position includes place
  // coordinates (nodeId, ux, uy) and optional interior state. Zone must be
  // one of the valid values; ux/uy must be finite numbers if present.
  const p0 = party[0];
  if (p0 && p0.position && typeof p0.position === 'object') {
    const pos = p0.position;
    const validZones = ['far', 'near', 'engaged'];
    if (!validZones.includes(String(pos.zone))) {
      throw new Error(`Invariant: party[0].position.zone must be one of [${validZones.join(', ')}]`);
    }
    if ('ux' in pos && !Number.isFinite(pos.ux)) {
      throw new Error('Invariant: party[0].position.ux must be finite number or absent');
    }
    if ('uy' in pos && !Number.isFinite(pos.uy)) {
      throw new Error('Invariant: party[0].position.uy must be finite number or absent');
    }
    if (pos.interior && typeof pos.interior === 'object') {
      const interior = pos.interior;
      if ('structureId' in interior && typeof interior.structureId !== 'string') {
        throw new Error('Invariant: party[0].position.interior.structureId must be string or absent');
      }
      if ('roomId' in interior && typeof interior.roomId !== 'string') {
        throw new Error('Invariant: party[0].position.interior.roomId must be string or absent');
      }
    }
  }

  // TAC-1 — canonical tactical position (docs/POSITION_AS_CANON.md §5). `pos` is
  // the finer 5-ft-cell truth that sits UNDER the node/interior location (which
  // stays authoritative in TAC-1). For every party member AND every present
  // settlement NPC, pos is null XOR a well-formed frame coordinate whose
  // PROJECTION agrees with the node/interior it must sit inside:
  //   • region frame → the cell's nearest node is map.currentNodeId;
  //   • struct:<id> frame → structure <id> is at the current node, the cell lands
  //     in a real room rect, and (for the player) that room + structure match
  //     scene.interior (composes with NODE-DESYNC-1's interior/node invariant).
  // This is the DISTINCT field from `position` above: pos is cells-in-canon (hashed);
  // position is pixels-in-renderer (ux/uy, stripped from the hash by MAP-OCC-2).
  {
    const curNodeId = String(world.map?.currentNodeId ?? '');
    const sceneInterior = world.scene?.interior && typeof world.scene.interior === 'object'
      ? world.scene.interior : null;
    // If scene.interior itself desyncs from the current node (a registered
    // structure at the WRONG node), that is the NODE-DESYNC-1 fault, reported by the
    // dedicated scene.interior invariant below — the root cause. The player's pos is
    // downstream of it, so skip the player's pos check in that case and let the
    // interior invariant speak (ensureWorld would repair the interior anyway; U406).
    const interiorDesynced = (() => {
      if (!sceneInterior || !sceneInterior.structureKey) return false;
      const st = world.structures?.byId?.[String(sceneInterior.structureKey)] || null;
      return !!(st && st.nodeId != null && String(st.nodeId) !== '' && String(st.nodeId) !== curNodeId);
    })();
    for (let i = 0; i < party.length; i++) {
      const m = party[i];
      if (i === 0 && interiorDesynced) continue; // defer to the scene.interior invariant
      // party[0] is the player: their frame is pinned to scene.interior (indoors →
      // that struct's room; outdoors → region). Other members validate frame-only.
      assertTacticalPos(m?.pos, `party[${i}]`, world, curNodeId, { isPlayer: i === 0, sceneInterior });
    }
    const node = (Array.isArray(world.map?.nodes) ? world.map.nodes : [])
      .find(n => n && String(n.id) === curNodeId) || null;
    const roster = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
    for (let i = 0; i < roster.length; i++) {
      const npc = roster[i];
      if (!npc || typeof npc !== 'object' || npc.pos == null) continue;
      const nid = String(npc.id || npc.name || `#${i}`);
      // NPCs carry no scene.interior of their own — validate frame + projection only.
      assertTacticalPos(npc.pos, `npc ${nid}`, world, curNodeId, { isPlayer: false });
    }
  }

  const clocks = world.clocks || {};
  for (const k of ['dread', 'pressure', 'revelation']) {
    const v = clocks[k];
    if (!Number.isInteger(v) || v < 0 || v > 12) {
      throw new Error(`Invariant: invalid clock ${k}`);
    }
  }

  // Goals
  const goals = world.goals;
  if (!Array.isArray(goals)) {
    throw new Error('Invariant: goals must be an array');
  }
  if (goals.length > 12) {
    throw new Error(`Invariant: goals.length ${goals.length} exceeds cap 12`);
  }
  const seenGoalIds = new Set();
  for (const g of goals) {
    if (!g || typeof g !== 'object') {
      throw new Error('Invariant: goal must be object');
    }
    if (!g.id || typeof g.id !== 'string') {
      throw new Error('Invariant: goal.id must be non-empty string');
    }
    if (seenGoalIds.has(g.id)) {
      throw new Error(`Invariant: duplicate goal id ${g.id}`);
    }
    seenGoalIds.add(g.id);
    if (!GOAL_KINDS.has(g.kind)) {
      throw new Error(`Invariant: invalid goal kind ${g.kind}`);
    }
    if (!GOAL_STATUSES.has(g.status)) {
      throw new Error(`Invariant: invalid goal status ${g.status}`);
    }
    if (typeof g.targetRef !== 'string' || !g.targetRef) {
      throw new Error(`Invariant: goal ${g.id} missing targetRef`);
    }
    if (!Number.isInteger(g.createdAt) || g.createdAt < 0) {
      throw new Error(`Invariant: goal ${g.id} invalid createdAt`);
    }
    if (g.completedAt != null && (!Number.isInteger(g.completedAt) || g.completedAt < 0)) {
      throw new Error(`Invariant: goal ${g.id} invalid completedAt`);
    }
    if (g.status === 'completed' && g.completedAt == null) {
      throw new Error(`Invariant: completed goal ${g.id} must have completedAt`);
    }
  }

  // Recent beats (narrative memory cache, FIFO cap 6)
  const beats = world.recentBeats;
  if (!Array.isArray(beats)) {
    throw new Error('Invariant: recentBeats must be an array');
  }
  if (beats.length > 6) {
    throw new Error(`Invariant: recentBeats.length ${beats.length} exceeds cap 6`);
  }
  for (const b of beats) {
    if (!b || typeof b !== 'object') {
      throw new Error('Invariant: beat must be object');
    }
    if (!Number.isInteger(b.t) || b.t < 0) {
      throw new Error('Invariant: beat.t must be non-negative integer');
    }
    if (typeof b.input !== 'string') {
      throw new Error('Invariant: beat.input must be string');
    }
    if (b.input.length > 140) {
      throw new Error(`Invariant: beat.input length ${b.input.length} exceeds cap 140`);
    }
    if (typeof b.approach !== 'string') {
      throw new Error('Invariant: beat.approach must be string');
    }
    if (typeof b.stake !== 'string') {
      throw new Error('Invariant: beat.stake must be string');
    }
    if (!BEAT_OUTCOMES.has(b.outcome)) {
      throw new Error(`Invariant: invalid beat outcome ${b.outcome}`);
    }
    if (typeof b.location !== 'string') {
      throw new Error('Invariant: beat.location must be string');
    }
    if (typeof b.mechanics !== 'string') {
      throw new Error('Invariant: beat.mechanics must be string');
    }
    if (b.mechanics.length > 200) {
      throw new Error(`Invariant: beat.mechanics length ${b.mechanics.length} exceeds cap 200`);
    }
  }

  // DX-2a: a tactical position block must be { cover: none|half|full,
  // flanked: bool, highGround: bool }. Validated WHEN PRESENT — like
  // companionGuard/initiativeOrder, presence isn't hard-required (every
  // production path backfills it via ensureCombat; worldHash runs through
  // ensureWorld), but a malformed block is caught.
  function assertTacticalBlock(t, label) {
    if (t === undefined) return;
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      throw new Error(`Invariant: ${label} must be object`);
    }
    if (t.cover !== 'none' && t.cover !== 'half' && t.cover !== 'full') {
      throw new Error(`Invariant: ${label}.cover must be none|half|full`);
    }
    if (typeof t.flanked !== 'boolean') {
      throw new Error(`Invariant: ${label}.flanked must be boolean`);
    }
    if (typeof t.highGround !== 'boolean') {
      throw new Error(`Invariant: ${label}.highGround must be boolean`);
    }
  }

  // Combat (Pass 5)
  const combat = world.combat;
  if (!combat || typeof combat !== 'object') {
    throw new Error('Invariant: combat must be object');
  }
  if (typeof combat.active !== 'boolean') {
    throw new Error('Invariant: combat.active must be boolean');
  }
  if (!Number.isInteger(combat.round) || combat.round < 0 || combat.round > 99) {
    throw new Error('Invariant: combat.round must be 0..99');
  }
  if (!Number.isInteger(combat.turnIndex) || combat.turnIndex < 0 || combat.turnIndex > 6) {
    throw new Error('Invariant: combat.turnIndex must be 0..6');
  }
  if (!Number.isInteger(combat.beganAt) || combat.beganAt < 0) {
    throw new Error('Invariant: combat.beganAt must be non-negative integer');
  }
  if (typeof combat.reason !== 'string') {
    throw new Error('Invariant: combat.reason must be string');
  }
  if (typeof combat.playerGuard !== 'boolean') {
    throw new Error('Invariant: combat.playerGuard must be boolean');
  }
  // DX-2a: tactical position blocks.
  assertTacticalBlock(combat.playerTactical, 'combat.playerTactical');
  if (!Array.isArray(combat.enemies)) {
    throw new Error('Invariant: combat.enemies must be array');
  }
  if (combat.enemies.length > 6) {
    throw new Error(`Invariant: combat.enemies.length ${combat.enemies.length} exceeds cap 6`);
  }
  if (combat.active && combat.enemies.length === 0) {
    throw new Error('Invariant: active combat must have at least one enemy');
  }
  const seenEnemyIds = new Set();
  for (const e of combat.enemies) {
    if (!e || typeof e !== 'object') {
      throw new Error('Invariant: combat enemy must be object');
    }
    if (!e.id || typeof e.id !== 'string') {
      throw new Error('Invariant: combat enemy.id must be non-empty string');
    }
    if (seenEnemyIds.has(e.id)) {
      throw new Error(`Invariant: duplicate combat enemy id ${e.id}`);
    }
    seenEnemyIds.add(e.id);
    if (typeof e.name !== 'string' || !e.name) {
      throw new Error(`Invariant: combat enemy ${e.id} missing name`);
    }
    if (!Number.isInteger(e.maxHp) || e.maxHp < 1 || e.maxHp > 9999) {
      throw new Error(`Invariant: combat enemy ${e.id} maxHp out of range 1..9999`);
    }
    if (!Number.isInteger(e.hp) || e.hp < 0 || e.hp > e.maxHp) {
      throw new Error(`Invariant: combat enemy ${e.id} hp out of range 0..maxHp`);
    }
    if (!Number.isInteger(e.damage) || e.damage < 1 || e.damage > 9999) {
      throw new Error(`Invariant: combat enemy ${e.id} damage out of range 1..9999`);
    }
    if (typeof e.canParley !== 'boolean') {
      throw new Error(`Invariant: combat enemy ${e.id} canParley must be boolean`);
    }
    if (typeof e.defeated !== 'boolean') {
      throw new Error(`Invariant: combat enemy ${e.id} defeated must be boolean`);
    }
    if (typeof e.sourceNpcId !== 'string') {
      throw new Error(`Invariant: combat enemy ${e.id} sourceNpcId must be string`);
    }
    // DX-2a: per-enemy tactical position.
    assertTacticalBlock(e.tactical, `combat enemy ${e.id} tactical`);
    // CM1: damage type, resistances, conditionImmunities
    if (typeof e.damageType !== 'string') {
      throw new Error(`Invariant: combat enemy ${e.id} damageType must be string`);
    }
    if (!e.resistances || typeof e.resistances !== 'object' || Array.isArray(e.resistances)) {
      throw new Error(`Invariant: combat enemy ${e.id} resistances must be object`);
    }
    if (!Array.isArray(e.conditionImmunities)) {
      throw new Error(`Invariant: combat enemy ${e.id} conditionImmunities must be array`);
    }
    // CM2: conditions array
    if (!Array.isArray(e.conditions)) {
      throw new Error(`Invariant: combat enemy ${e.id} conditions must be array`);
    }
    // CM3: actions, saveProficiencies must be arrays; multiattack null or array
    if (!Array.isArray(e.actions)) {
      throw new Error(`Invariant: combat enemy ${e.id} actions must be array`);
    }
    if (!Array.isArray(e.saveProficiencies)) {
      throw new Error(`Invariant: combat enemy ${e.id} saveProficiencies must be array`);
    }
    if (e.multiattack !== null && !Array.isArray(e.multiattack)) {
      throw new Error(`Invariant: combat enemy ${e.id} multiattack must be null or array`);
    }
    // CM5: lootTableRef must be null or string.
    if (e.lootTableRef !== null && typeof e.lootTableRef !== 'string') {
      throw new Error(`Invariant: combat enemy ${e.id} lootTableRef must be null or string`);
    }
    // CM6: initMod must be a number.
    if (typeof e.initMod !== 'number') {
      throw new Error(`Invariant: combat enemy ${e.id} initMod must be number`);
    }
    // CM7: legendaryActions must be null or object with perRound/remaining/options.
    if (e.legendaryActions !== null) {
      if (!e.legendaryActions || typeof e.legendaryActions !== 'object') {
        throw new Error(`Invariant: combat enemy ${e.id} legendaryActions must be null or object`);
      }
      if (!Array.isArray(e.legendaryActions.options)) {
        throw new Error(`Invariant: combat enemy ${e.id} legendaryActions.options must be array`);
      }
    }
    // CM7: reactions must be null or array.
    if (e.reactions !== null && !Array.isArray(e.reactions)) {
      throw new Error(`Invariant: combat enemy ${e.id} reactions must be null or array`);
    }
    // CM9: lairActions must be null or array.
    if (e.lairActions !== null && e.lairActions !== undefined && !Array.isArray(e.lairActions)) {
      throw new Error(`Invariant: combat enemy ${e.id} lairActions must be null or array`);
    }
    // CM9: senses must be an object.
    if (e.senses && typeof e.senses !== 'object') {
      throw new Error(`Invariant: combat enemy ${e.id} senses must be object`);
    }
  }
  // CM6: initiativeOrder must be an array.
  if (!Array.isArray(combat.initiativeOrder)) {
    throw new Error('Invariant: combat.initiativeOrder must be array');
  }
  if (combat.active && world.scene?.dialogue) {
    throw new Error('Invariant: combat.active and scene.dialogue are mutually exclusive');
  }
  if (combat.active) {
    assertCombatGrid(combat);
  }

  // ── v26 — party condition invariants ──────────────────────────────────────
  for (const member of (Array.isArray(world.party) ? world.party : [])) {
    if (!member || member.conditions == null) continue;
    if (!Array.isArray(member.conditions)) {
      throw new Error(`Invariant: party member ${member.id} conditions must be an array`);
    }
    if (member.conditions.length > 8) {
      throw new Error(`Invariant: party member ${member.id} has ${member.conditions.length} conditions (cap 8)`);
    }
    for (const c of member.conditions) {
      if (!c || typeof c !== 'object' || !c.name) {
        throw new Error(`Invariant: party member ${member.id} has a malformed condition`);
      }
    }
  }

  // ── v25 — story arc invariants (docs/STORYLINE_SPEC.md) ───────────────────
  const story = world.story;
  if (!story || typeof story !== 'object' || !story.arcs || typeof story.arcs !== 'object') {
    throw new Error('Invariant: story.arcs must be an object');
  }
  const STORY_STATUSES = new Set(['dormant', 'cast', 'active', 'resolved', 'abandoned']);
  const arcEntries = Object.entries(story.arcs);
  if (arcEntries.length > 8) {
    throw new Error(`Invariant: story.arcs count ${arcEntries.length} exceeds cap 8`);
  }
  let activeArcs = 0;
  for (const [arcId, a] of arcEntries) {
    if (!a || typeof a !== 'object') throw new Error(`Invariant: story.arcs[${arcId}] must be object`);
    if (!STORY_STATUSES.has(a.status)) throw new Error(`Invariant: story arc ${arcId} bad status ${a.status}`);
    if (typeof a.stage !== 'string') throw new Error(`Invariant: story arc ${arcId} stage must be string`);
    if (a.status === 'cast' || a.status === 'active') activeArcs++;
    for (const [role, ref] of Object.entries(a.castIds && typeof a.castIds === 'object' ? a.castIds : {})) {
      if (!/^.+@.+$/.test(String(ref))) {
        throw new Error(`Invariant: story arc ${arcId} castIds[${role}] must be npcId@nodeId (got ${ref})`);
      }
    }
  }
  if (activeArcs > 4) {
    throw new Error(`Invariant: ${activeArcs} simultaneously cast/active story arcs exceeds cap 4`);
  }

  // ── v27 — the Adversary (P-74a) ────────────────────────────────────────────
  // world.villain is null (not yet minted) or one well-formed villain: a real
  // identity, a staged agenda with the stage cursor in bounds, a seat that
  // exists on the map. Flags are booleans — `discovered` gates the narrator
  // ever naming them (rumor-first law).
  const villain = world.villain;
  if (villain !== null && villain !== undefined) {
    if (typeof villain !== 'object') throw new Error('Invariant: villain must be null or object');
    if (typeof villain.ref !== 'string' || !villain.ref) throw new Error('Invariant: villain.ref must be non-empty string');
    if (typeof villain.name !== 'string' || !villain.name) throw new Error('Invariant: villain.name must be non-empty string');
    if (typeof villain.discovered !== 'boolean') throw new Error('Invariant: villain.discovered must be boolean');
    if (typeof villain.defeated !== 'boolean') throw new Error('Invariant: villain.defeated must be boolean');
    const agenda = villain.agenda;
    if (!agenda || typeof agenda !== 'object' || !Array.isArray(agenda.stages)) {
      throw new Error('Invariant: villain.agenda.stages must be an array');
    }
    if (agenda.stages.length < 3 || agenda.stages.length > 6) {
      throw new Error(`Invariant: villain agenda has ${agenda.stages.length} stages (want 3..6)`);
    }
    if (!Number.isInteger(agenda.stage) || agenda.stage < 0 || agenda.stage >= agenda.stages.length) {
      throw new Error(`Invariant: villain agenda.stage ${agenda.stage} out of bounds 0..${agenda.stages.length - 1}`);
    }
    if (!Number.isInteger(agenda.clock) || agenda.clock < 0) {
      throw new Error(`Invariant: villain agenda.clock must be a non-negative integer (got ${agenda.clock})`);
    }
    for (const s of agenda.stages) {
      if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !s.id) {
        throw new Error('Invariant: villain agenda stage must have a non-empty id');
      }
    }
    if (typeof villain.seatNodeId !== 'string' || !villain.seatNodeId) {
      throw new Error('Invariant: villain.seatNodeId must be non-empty string');
    }
    const seatExists = (Array.isArray(world.map?.nodes) ? world.map.nodes : []).some(n => n && String(n.id) === villain.seatNodeId);
    if (!seatExists) {
      throw new Error(`Invariant: villain.seatNodeId ${villain.seatNodeId} not on the map`);
    }
  }

  // ── Pass R1 — rumor layer invariants ──────────────────────────────────────
  const rumors = world.rumors;
  if (!Array.isArray(rumors)) {
    throw new Error('Invariant: rumors must be an array');
  }
  if (rumors.length > 64) {
    throw new Error(`Invariant: rumors.length ${rumors.length} exceeds cap 64`);
  }
  const seenRumorIds = new Set();
  for (const r of rumors) {
    if (!r || typeof r !== 'object') {
      throw new Error('Invariant: rumor must be object');
    }
    if (typeof r.id !== 'string' || !r.id) {
      throw new Error('Invariant: rumor.id must be non-empty string');
    }
    if (seenRumorIds.has(r.id)) {
      throw new Error(`Invariant: duplicate rumor id ${r.id}`);
    }
    seenRumorIds.add(r.id);
    if (typeof r.sourceSeedId !== 'string' || !r.sourceSeedId) {
      throw new Error(`Invariant: rumor ${r.id} missing sourceSeedId`);
    }
    if (typeof r.body !== 'string' || !r.body) {
      throw new Error(`Invariant: rumor ${r.id} has empty body`);
    }
    if (!Number.isInteger(r.tier) || r.tier < 0 || r.tier > 4) {
      throw new Error(`Invariant: rumor ${r.id} tier must be integer 0..4 (got ${r.tier})`);
    }
  }

  // NPC rumor references: every npc.rumorIds[x] must reference a real rumor.
  // Also validate npc.sophistication when present.
  const allNodes = Array.isArray(world.map?.nodes) ? world.map.nodes : [];
  for (const node of allNodes) {
    const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
    for (const npc of npcs) {
      if (!npc || typeof npc !== 'object') continue;
      if (Array.isArray(npc.rumorIds)) {
        for (const rid of npc.rumorIds) {
          if (!seenRumorIds.has(rid)) {
            throw new Error(`Invariant: npc ${npc.id} rumorIds references non-existent rumor ${rid}`);
          }
        }
      }
      if (npc.sophistication != null) {
        if (!Number.isInteger(npc.sophistication) || npc.sophistication < 0 || npc.sophistication > 4) {
          throw new Error(`Invariant: npc ${npc.id} sophistication must be integer 0..4 (got ${npc.sophistication})`);
        }
      }
      // NPC-DEED-1 (docs/MORAL_PHYSICS.md §7 Arc A) — an NPC evildoer's morality-lite accumulator
      // (state.ensureNpcMorality: { corruption, heat, lastDeedT }). OPTIONAL by design — it is
      // stamped lazily, only once a deed touches the NPC, so ABSENCE is legal (a clean NPC has no
      // morality key). When PRESENT it must be well-formed, mirroring the party bounds. This never
      // fires for a world with no NPC evildoer.
      if (npc.morality != null) {
        const mo = npc.morality;
        if (typeof mo !== 'object' || Array.isArray(mo)) {
          throw new Error(`Invariant: npc ${npc.id} morality must be a plain object when present`);
        }
        if (!Number.isInteger(mo.corruption) || mo.corruption < 0 || mo.corruption > 100) {
          throw new Error(`Invariant: npc ${npc.id} morality.corruption must be integer 0..100`);
        }
        if (!Number.isInteger(mo.heat) || mo.heat < 0) {
          throw new Error(`Invariant: npc ${npc.id} morality.heat must be non-negative integer`);
        }
        if (!Number.isInteger(mo.lastDeedT) || mo.lastDeedT < 0) {
          throw new Error(`Invariant: npc ${npc.id} morality.lastDeedT must be non-negative integer`);
        }
      }
    }
  }

  // Dialogue mode (optional)
  const dialogue = world.scene?.dialogue;
  if (dialogue != null) {
    if (typeof dialogue !== 'object') {
      throw new Error('Invariant: scene.dialogue must be object or null');
    }
    if (!dialogue.npcId || typeof dialogue.npcId !== 'string') {
      throw new Error('Invariant: scene.dialogue.npcId must be non-empty string');
    }
    if (!Number.isInteger(dialogue.turnsInDialogue) || dialogue.turnsInDialogue < 0) {
      throw new Error('Invariant: scene.dialogue.turnsInDialogue must be non-negative integer');
    }
    if (!Array.isArray(dialogue.topicsOffered)) {
      throw new Error('Invariant: scene.dialogue.topicsOffered must be array');
    }
    if (dialogue.topicsOffered.length > 20) {
      throw new Error(`Invariant: scene.dialogue.topicsOffered length ${dialogue.topicsOffered.length} exceeds cap 20`);
    }
    const seenTopics = new Set();
    for (const t of dialogue.topicsOffered) {
      if (seenTopics.has(t)) {
        throw new Error(`Invariant: scene.dialogue.topicsOffered has duplicate ${t}`);
      }
      seenTopics.add(t);
    }
    const nodeId = String(world.map?.currentNodeId ?? '');
    const node = (world.map?.nodes || []).find(n => n && n.id === nodeId) || null;
    const npcs = node?.settlement?.npcs || [];
    const foundNpc = npcs.some(n => String(n?.id) === dialogue.npcId);
    if (!foundNpc) {
      throw new Error(`Invariant: scene.dialogue.npcId ${dialogue.npcId} not at current node`);
    }
  }

  // NODE-DESYNC-1 — position-truth consistency. If scene.interior names a REGISTERED
  // structure (one in structures.byId with a nodeId), that structure MUST sit at the
  // current node. The live bug had "go to the hearth room" flip currentNodeId a region
  // over while scene.interior stayed the cottage you were in — after which every
  // presence read (nodeRoster/occupantsOfRoom) came back empty (the ghost-town
  // signature). THE MOVEMENT LAW makes that structurally impossible going forward; this
  // invariant is the tripwire so the class can never sleep. Synthetic test interiors
  // (no structureKey, or a structure not registered here) are intentionally tolerated —
  // this fires only on a real interior pointing at the wrong node.
  const interior = world.scene?.interior;
  if (interior && typeof interior === 'object') {
    const structureKey = String(interior.structureKey || '');
    const st = structureKey ? world.structures?.byId?.[structureKey] : null;
    if (st && st.nodeId != null && String(st.nodeId) !== '') {
      const curNode = String(world.map?.currentNodeId ?? '');
      if (String(st.nodeId) !== curNode) {
        throw new Error(`Invariant: scene.interior structure ${structureKey} is at node ${st.nodeId} but map.currentNodeId is ${curNode || '(none)'} (position desync — THE MOVEMENT LAW)`);
      }
    }
  }

  // MR-2a (v31) — canon door records (docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2a).
  // For every registered structure that carries a doors[]: each door's state is in
  // the enum, each door's rooms EXIST in the structure's plan (an interior door
  // needs both a+b to be real rooms — "door cells exist in the plan"; the exterior
  // door needs its `a` entry room), and there is EXACTLY ONE exterior door per v1
  // structure (a structure with a groundable plan). The door LIST is authored by
  // ensureWorld's tail (backfillDoors) so a validly-ensured world always satisfies
  // this; it is the tripwire against a hand-built/malformed doors[] slipping in.
  const structuresById = world.structures?.byId;
  if (structuresById && typeof structuresById === 'object') {
    for (const st of Object.values(structuresById)) {
      const doors = Array.isArray(st?.doors) ? st.doors : null;
      if (!doors) continue; // a structure may carry no doors[] (no groundable plan / pre-author)
      const plan = floorPlan(st);
      const roomIds = new Set((Array.isArray(plan?.rooms) ? plan.rooms : []).map(r => String(r.id)));
      let exteriorCount = 0;
      for (const d of doors) {
        if (!d || typeof d !== 'object') {
          throw new Error(`Invariant: structure ${st.id} has a malformed door (not an object)`);
        }
        if (!isDoorState(d.state)) {
          throw new Error(`Invariant: structure ${st.id} door ${d.id} has invalid state '${d.state}' (must be one of open|shut|barred|locked)`);
        }
        if (d.exterior) {
          exteriorCount++;
          // The exterior door fronts a real entry room; its far side is 'outside' (b === '').
          if (!roomIds.has(String(d.a))) {
            throw new Error(`Invariant: structure ${st.id} exterior door ${d.id} fronts room ${d.a} which is not in the plan`);
          }
        } else {
          // An interior door's cells exist in the plan iff both rooms it joins do.
          if (!roomIds.has(String(d.a)) || !roomIds.has(String(d.b))) {
            throw new Error(`Invariant: structure ${st.id} interior door ${d.id} joins rooms ${d.a},${d.b} not both in the plan (door cells must exist in the plan)`);
          }
        }
      }
      // Exactly one exterior door for any structure that has rooms (a groundable
      // plan). A roomless/ungroundable structure authors no doors and is skipped
      // above (doors === null), so this only asserts on real, doored structures.
      if (roomIds.size > 0 && exteriorCount !== 1) {
        throw new Error(`Invariant: structure ${st.id} must have exactly one exterior door, has ${exteriorCount}`);
      }
    }
  }
}

// TAC-1 — assert one entity's canonical tactical `pos` (docs/POSITION_AS_CANON.md
// §5). null is always legal (absent from the tactical layer). A non-null pos must
// be a well-formed frame coordinate whose projection agrees with the current node/
// interior. opts.isPlayer pins the frame to opts.sceneInterior (the player is in
// struct frame iff scene.interior names an at-node structure — that struct's room;
// else region). NPCs (isPlayer falsy) validate frame + projection only. The detailed
// throws mirror isTacticalPosConsistent (the shared oracle) so state and invariants
// never disagree on what "valid" means.
function assertTacticalPos(pos, label, world, curNodeId, opts = {}) {
  if (pos == null) return; // absent — legal
  if (typeof pos !== 'object' || Array.isArray(pos)) {
    throw new Error(`Invariant: ${label}.pos must be null or a { frame, gx, gy } object`);
  }
  const frame = String(pos.frame ?? '');
  if (!Number.isInteger(pos.gx) || !Number.isInteger(pos.gy)) {
    throw new Error(`Invariant: ${label}.pos.gx/gy must be integers (got ${pos.gx},${pos.gy})`);
  }
  const isPlayer = !!opts.isPlayer;
  const atNode = isPlayer ? playerInteriorAtNode(world, curNodeId, opts.sceneInterior) : null;
  if (frame === 'region') {
    // The player is only outdoors (region) when they have no at-node interior.
    if (isPlayer && atNode) {
      throw new Error(`Invariant: ${label}.pos is region but the player is inside ${atNode.structId}/${atNode.roomId} (scene.interior) — must be a struct pos`);
    }
    // The region sheet is one continuous grid; a present entity's cell must sit in
    // the current node's area — the nearest node to the cell IS the current node.
    // (Only enforced when the map has positioned nodes and a current node; bare/
    // synthetic fixtures with neither are tolerated.)
    const nodes = Array.isArray(world.map?.nodes) ? world.map.nodes : [];
    const anyPositioned = nodes.some(n => n && Number.isInteger(n.x) && Number.isInteger(n.y));
    if (curNodeId && anyPositioned) {
      const nearest = nearestNodeToRegionCell(world.map, pos.gx, pos.gy);
      if (nearest !== curNodeId) {
        throw new Error(`Invariant: ${label}.pos is region ${pos.gx},${pos.gy} whose nearest node is ${nearest || '(none)'} but map.currentNodeId is ${curNodeId} (region pos must project to the current node)`);
      }
    }
    return;
  }
  const m = /^struct:(.+)$/.exec(frame);
  if (!m) {
    throw new Error(`Invariant: ${label}.pos.frame must be 'region' or 'struct:<structId>' (got '${frame}')`);
  }
  const structId = m[1];
  const st = world.structures?.byId?.[structId] || null;
  // A struct pos names a REGISTERED structure that must sit at the current node
  // (composes with NODE-DESYNC-1). Synthetic states pointing at an unknown
  // structure are a hard error here — a real struct pos is only ever minted for a
  // registered structure at the current node.
  if (!st) {
    throw new Error(`Invariant: ${label}.pos frame names structure ${structId} which is not registered`);
  }
  if (curNodeId && st.nodeId != null && String(st.nodeId) !== '' && String(st.nodeId) !== curNodeId) {
    throw new Error(`Invariant: ${label}.pos is in structure ${structId} at node ${st.nodeId} but map.currentNodeId is ${curNodeId} (struct pos must be at the current node)`);
  }
  const room = roomOfStructCell(floorPlan(st), pos.gx, pos.gy);
  if (!room) {
    throw new Error(`Invariant: ${label}.pos cell ${pos.gx},${pos.gy} lands in no room of structure ${structId}`);
  }
  // For the player, the struct + room the cell lands in must be exactly what
  // scene.interior names — pos is the finer detail of that same truth. A player
  // with no at-node interior must not be in a struct frame at all.
  if (isPlayer) {
    if (!atNode) {
      throw new Error(`Invariant: ${label}.pos is a struct pos but the player has no at-node interior (scene.interior) — must be region`);
    }
    if (atNode.structId !== structId) {
      throw new Error(`Invariant: ${label}.pos is in structure ${structId} but scene.interior is ${atNode.structId}`);
    }
    if (atNode.roomId !== room) {
      throw new Error(`Invariant: ${label}.pos cell lands in room ${room} but scene.interior.roomId is ${atNode.roomId}`);
    }
  }
}

// The registered at-node structure the player's frame is pinned to (mirrors
// tacticalPos.playerAtNodeInterior — kept local to avoid widening that module's
// export surface). Returns { structId, roomId } or null (outdoors / stale interior).
function playerInteriorAtNode(world, curNodeId, sceneInterior) {
  if (!sceneInterior || !sceneInterior.structureKey || !sceneInterior.roomId) return null;
  const structId = String(sceneInterior.structureKey);
  const st = world?.structures?.byId?.[structId] || null;
  if (!st) return null;
  if (curNodeId && st.nodeId != null && String(st.nodeId) !== '' && String(st.nodeId) !== curNodeId) {
    return null;
  }
  return { structId, roomId: String(sceneInterior.roomId) };
}

function assertCombatGrid(combat) {
  const grid = combat.grid;
  if (!grid || typeof grid !== 'object' || Array.isArray(grid)) {
    throw new Error('Invariant: combat.grid must be object');
  }
  if (!Number.isInteger(grid.w) || grid.w < 1 || grid.w > 64) {
    throw new Error('Invariant: combat.grid.w must be integer 1..64');
  }
  if (!Number.isInteger(grid.h) || grid.h < 1 || grid.h > 64) {
    throw new Error('Invariant: combat.grid.h must be integer 1..64');
  }
  const occupied = new Set();
  assertCombatCell(combat.playerCell, 'combat.playerCell', grid);
  occupied.add(`${combat.playerCell.cx},${combat.playerCell.cy}`);
  for (const e of combat.enemies) {
    assertCombatCell(e, `combat enemy ${e.id} cell`, grid);
    const key = `${e.cx},${e.cy}`;
    if (occupied.has(key)) {
      throw new Error(`Invariant: combat cell ${key} occupied by multiple combatants`);
    }
    occupied.add(key);
  }
}

function assertCombatCell(cell, label, grid) {
  if (!cell || typeof cell !== 'object' || Array.isArray(cell)) {
    throw new Error(`Invariant: ${label} must be object`);
  }
  if (!Number.isInteger(cell.cx) || !Number.isInteger(cell.cy)) {
    throw new Error(`Invariant: ${label} must have integer cx,cy`);
  }
  if (cell.cx < 0 || cell.cx >= grid.w || cell.cy < 0 || cell.cy >= grid.h) {
    throw new Error(`Invariant: ${label} must be in combat.grid bounds`);
  }
}

const GOAL_KINDS = new Set(['reach', 'obtain', 'talkTo', 'learn', 'defeat']);
const GOAL_STATUSES = new Set(['active', 'completed', 'failed']);
const BEAT_OUTCOMES = new Set(['success', 'mixed', 'failure']);

// ── Pass T1 crunch invariants ────────────────────────────────────────────
function assertCrunchFields(member, i) {
  // level ∈ [1, 20]
  if (!Number.isInteger(member.level) || member.level < 1 || member.level > 20) {
    throw new Error(`Invariant: party[${i}].level must be integer 1..20 (got ${member.level})`);
  }
  // xp ≥ 0
  if (!Number.isInteger(member.xp) || member.xp < 0) {
    throw new Error(`Invariant: party[${i}].xp must be non-negative integer (got ${member.xp})`);
  }

  // wounds ≤ maxWounds(level, gritMod)
  const grit = member.stats?.GRIT;
  const gritMod = statMod(grit);
  const cap = maxWounds(member.level, gritMod);
  if (!Number.isInteger(member.wounds) || member.wounds < 0 || member.wounds > cap) {
    throw new Error(
      `Invariant: party[${i}].wounds must be integer 0..${cap} for level ${member.level}/GRIT ${grit} (got ${member.wounds})`
    );
  }

  // foci array, length ≤ 6, all strings
  if (!Array.isArray(member.foci)) {
    throw new Error(`Invariant: party[${i}].foci must be array`);
  }
  if (member.foci.length > 6) {
    throw new Error(`Invariant: party[${i}].foci length ${member.foci.length} exceeds cap 6`);
  }
  for (const f of member.foci) {
    if (typeof f !== 'string' || !f) {
      throw new Error(`Invariant: party[${i}].foci entries must be non-empty strings`);
    }
  }

  // purse: four currency integers ≥ 0
  const purse = member.purse;
  if (!purse || typeof purse !== 'object') {
    throw new Error(`Invariant: party[${i}].purse must be object`);
  }
  for (const k of CURRENCY_KEYS) {
    const v = purse[k];
    if (!Number.isInteger(v) || v < 0) {
      throw new Error(`Invariant: party[${i}].purse.${k} must be non-negative integer (got ${v})`);
    }
  }

  // inventory.items: array of {id, defRef, equipped: string|null}
  const items = member.inventory?.items;
  if (!Array.isArray(items)) {
    throw new Error(`Invariant: party[${i}].inventory.items must be array`);
  }
  for (let j = 0; j < items.length; j++) {
    const it = items[j];
    if (!it || typeof it !== 'object') {
      throw new Error(`Invariant: party[${i}].inventory.items[${j}] must be object`);
    }
    if (typeof it.id !== 'string' || !it.id) {
      throw new Error(`Invariant: party[${i}].inventory.items[${j}].id must be non-empty string`);
    }
    if (typeof it.defRef !== 'string' || !it.defRef) {
      throw new Error(`Invariant: party[${i}].inventory.items[${j}].defRef must be non-empty string`);
    }
    if (it.equipped !== null && (typeof it.equipped !== 'string' || !it.equipped)) {
      throw new Error(`Invariant: party[${i}].inventory.items[${j}].equipped must be non-empty string or null`);
    }
    // P-77 — identity fields are only-when-set: sealedRef a non-empty string,
    // attuned strictly true. (Absent on old saves; never null/false/empty.)
    if ('sealedRef' in it && (typeof it.sealedRef !== 'string' || !it.sealedRef)) {
      throw new Error(`Invariant: party[${i}].inventory.items[${j}].sealedRef must be non-empty string when present`);
    }
    if ('attuned' in it && it.attuned !== true) {
      throw new Error(`Invariant: party[${i}].inventory.items[${j}].attuned must be true when present`);
    }
  }
  // P-77 — three bonds to a soul (RAW attunement cap).
  if (items.filter(it => it && it.attuned === true).length > 3) {
    throw new Error(`Invariant: party[${i}] holds more than 3 attuned items`);
  }

  // spells block
  const spells = member.spells;
  if (!spells || typeof spells !== 'object') {
    throw new Error(`Invariant: party[${i}].spells must be object`);
  }
  if (!Array.isArray(spells.known)) {
    throw new Error(`Invariant: party[${i}].spells.known must be array`);
  }
  if (spells.known.length > 20) {
    throw new Error(`Invariant: party[${i}].spells.known length ${spells.known.length} exceeds cap 20`);
  }
  for (const s of spells.known) {
    if (typeof s !== 'string' || !s) {
      throw new Error(`Invariant: party[${i}].spells.known entries must be non-empty strings`);
    }
  }
  if (!spells.slots || typeof spells.slots !== 'object') {
    throw new Error(`Invariant: party[${i}].spells.slots must be object`);
  }
  if (!spells.maxSlots || typeof spells.maxSlots !== 'object') {
    throw new Error(`Invariant: party[${i}].spells.maxSlots must be object`);
  }
  for (const lvl of SPELL_SLOT_LEVELS) {
    const cur = spells.slots[lvl];
    const max = spells.maxSlots[lvl];
    if (!Number.isInteger(cur) || cur < 0) {
      throw new Error(`Invariant: party[${i}].spells.slots[${lvl}] must be non-negative integer (got ${cur})`);
    }
    if (!Number.isInteger(max) || max < 0) {
      throw new Error(`Invariant: party[${i}].spells.maxSlots[${lvl}] must be non-negative integer (got ${max})`);
    }
    if (cur > max) {
      throw new Error(`Invariant: party[${i}].spells.slots[${lvl}] ${cur} exceeds maxSlots[${lvl}] ${max}`);
    }
  }
  const conc = spells.concentration;
  if (conc !== null) {
    if (!conc || typeof conc !== 'object') {
      throw new Error(`Invariant: party[${i}].spells.concentration must be object or null`);
    }
    if (typeof conc.spellRef !== 'string' || !conc.spellRef) {
      throw new Error(`Invariant: party[${i}].spells.concentration.spellRef must be non-empty string`);
    }
    if (typeof conc.startedAt !== 'number' || !Number.isFinite(conc.startedAt)) {
      throw new Error(`Invariant: party[${i}].spells.concentration.startedAt must be finite number`);
    }
  }
}
