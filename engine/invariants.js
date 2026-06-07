import { WORLD_VERSION } from './state.js';
import { statMod, maxWounds } from './ruleset/core/stats.js';

const SPELL_SLOT_LEVELS = [1, 2, 3, 4, 5];
const CURRENCY_KEYS = ['copper', 'silver', 'gold', 'platinum'];

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
    if (!Number.isInteger(d.severity) || d.severity < 0 || d.severity > 100) {
      throw new Error(`Invariant: deeds[${i}].severity must be integer 0..100`);
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
