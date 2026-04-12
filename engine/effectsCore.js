import { ensureWorld, ensureCombat, defaultCombat } from './state.js';
import { addFact, addThreat, addQuestion } from './ledger.js';
import { ensureEnv } from './env/envCore.js';
import { ensureInstrumentLayer } from './instrument.js';

// Data-driven delta executor. Pure and deterministic.
// Applies a list of ops to the world safely (clamps, initializes missing fields).

export function applyDeltas(world, deltas = []) {
  let w = ensureWorld(world);
  const ops = Array.isArray(deltas) ? deltas : [];

  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    const kind = String(op.op || '');

    if (kind === 'clock') {
      const key = String(op.key || '');
      const by = toInt(op.by ?? 0);
      if (!key || !Number.isFinite(by) || by === 0) continue;
      const cur = w.clocks?.[key] ?? 0;
      const next = clampInt(cur + by, 0, 12);
      w = { ...w, clocks: { ...w.clocks, [key]: next } };
      continue;
    }

    if (kind === 'resource') {
      const entityId = String(op.entityId || '');
      const key = String(op.key || '');
      const by = toInt(op.by ?? 0);
      if (!entityId || !key || !Number.isFinite(by) || by === 0) continue;
      w = mutateEntity(w, entityId, (e) => {
        const resources = (e.resources && typeof e.resources === 'object') ? e.resources : {};
        const cur = toInt(resources[key] ?? 0);
        const next = clampInt(cur + by, 0, 999);
        return { ...e, resources: { ...resources, [key]: next } };
      });
      continue;
    }

    if (kind === 'wound') {
      const entityId = String(op.entityId || '');
      const by = toInt(op.by ?? 0);
      if (!entityId || !Number.isFinite(by) || by === 0) continue;
      w = mutateEntity(w, entityId, (e) => {
        const cur = clampInt(e.wounds ?? 0, 0, 6);
        const next = clampInt(cur + by, 0, 6);
        return { ...e, wounds: next };
      });
      continue;
    }

    if (kind === 'stress') {
      const entityId = String(op.entityId || '');
      const by = toInt(op.by ?? 0);
      if (!entityId || !Number.isFinite(by) || by === 0) continue;
      w = mutateEntity(w, entityId, (e) => {
        const cur = clampInt(e.stress ?? 0, 0, 6);
        const next = clampInt(cur + by, 0, 6);
        return { ...e, stress: next };
      });
      continue;
    }

    if (kind === 'condition') {
      const entityId = String(op.entityId || '');
      const add = String(op.add || '').trim();
      if (!entityId || !add) continue;
      w = mutateEntity(w, entityId, (e) => {
        const conditions = Array.isArray(e.conditions) ? e.conditions : [];
        if (conditions.some(c => String(c?.name) === add)) return e;
        const cond = { name: add, until: op.until ?? null };
        return { ...e, conditions: [cond, ...conditions].slice(0, 12) };
      });
      continue;
    }

    if (kind === 'position') {
      const entityId = String(op.entityId || '');
      const set = op.set && typeof op.set === 'object' ? op.set : null;
      if (!entityId || !set) continue;
      w = mutateEntity(w, entityId, (e) => {
        const prev = (e.position && typeof e.position === 'object') ? e.position : {};
        const next = { ...prev, ...set };
        if (next.zone) next.zone = clampZone(next.zone);
        return { ...e, position: next };
      });
      continue;
    }

    if (kind === 'time') {
      const key = String(op.key || '');
      const by = toInt(op.by ?? 0);
      if (!key || !Number.isFinite(by) || by === 0) continue;
      const cur = w.time?.[key] ?? 0;
      const next = clampInt(cur + by, 0, 999999);
      w = { ...w, time: { ...(w.time || { turn: 0, scene: 0 }), [key]: next } };
      continue;
    }

    if (kind === 'env') {
      const key = String(op.key || '');
      const by = toInt(op.by ?? 0);
      if (!key || !Number.isFinite(by) || by === 0) continue;
      const env = ensureEnv(w.env);
      if (!(key in env)) continue;
      const next = { ...env, [key]: clampInt(env[key] + by, 0, 6) };
      w = { ...w, env: next };
      continue;
    }

    if (kind === 'advantage') {
      const actorId = String(op.actorId || '');
      const by = toInt(op.by ?? 0);
      if (!actorId || !Number.isFinite(by) || by === 0) continue;
      const prior = (w.meta.advantageTokens && typeof w.meta.advantageTokens === 'object') ? w.meta.advantageTokens : {};
      const cur = clampInt(prior[actorId] ?? 0, 0, 2);
      const next = clampInt(cur + by, 0, 2);
      w = { ...w, meta: { ...w.meta, advantageTokens: { ...prior, [actorId]: next } } };
      continue;
    }

    if (kind === 'npcTrustDelta') {
      // Update NPC trust level in settlement data; mark NPC as having met the player.
      const npcId = String(op.npcId || '');
      const by = toInt(op.by ?? 0);
      if (!npcId || !by) continue;
      w = mutateNpc(w, npcId, npc => {
        const cs = npc.conversationState ?? { metPlayer: false, topicsDiscussed: [], trustLevel: 5, lastInteraction: null };
        return { ...npc, conversationState: { ...cs, metPlayer: true, trustLevel: clampInt(cs.trustLevel + by, 0, 10), lastInteraction: w.time?.turn ?? 0 } };
      });
      continue;
    }

    if (kind === 'npcSecretRevealed') {
      // Mark a secret as revealed
      const npcId = String(op.npcId || '');
      const secretFactId = String(op.secretFactId || '');
      if (!npcId || !secretFactId) continue;
      w = mutateNpc(w, npcId, npc => {
        const revealed = Array.isArray(npc.revealedSecrets) ? [...npc.revealedSecrets] : [];
        if (!revealed.includes(secretFactId)) revealed.push(secretFactId);
        return { ...npc, revealedSecrets: revealed };
      });
      // Also add to ledger as a canonical fact
      w = addFact(w, `secret:${secretFactId} revealed by ${npcId}`, 'npc');
      continue;
    }

    if (kind === 'npcKnowledgeShared') {
      // Add player-shared knowledge to NPC + track topic in conversationState (cap 20, FIFO).
      const npcId = String(op.npcId || '');
      const fact = String(op.fact || '');
      if (!npcId || !fact) continue;
      w = mutateNpc(w, npcId, npc => {
        const kg = Array.isArray(npc.knowledgeGraph) ? [...npc.knowledgeGraph] : [];
        kg.push({ factId: `player_shared:${fact}`, source: 'player', confidence: 1.0, event: null });
        const cs = npc.conversationState ?? { metPlayer: false, topicsDiscussed: [], trustLevel: 5, lastInteraction: null };
        let topics = Array.isArray(cs.topicsDiscussed) ? [...cs.topicsDiscussed] : [];
        topics.push(fact);
        if (topics.length > 20) topics = topics.slice(topics.length - 20);
        return { ...npc, knowledgeGraph: kg, conversationState: { ...cs, metPlayer: true, topicsDiscussed: topics, lastInteraction: w.time?.turn ?? 0 } };
      });
      continue;
    }

    if (kind === 'rollRequest') {
      // Roll requests are informational — stored in timeline for the playloop to process
      const action = String(op.action || '');
      if (action) {
        const t = w.timeline.length;
        w = { ...w, timeline: [...w.timeline, { t, kind: 'rollRequest', data: { action, dcSuggestion: op.dcSuggestion, stat: op.stat } }] };
      }
      continue;
    }

    if (kind === 'threadRelief') {
      // Relief valve: reduce tension on the most tense open thread.
      const by = toInt(op.by ?? -1);
      if (!Number.isFinite(by) || by === 0) continue;
      const inst = ensureInstrumentLayer(w.instrument);
      const open = inst.threads
        .filter(t => t.status !== 'resolved' && t.tension > 0)
        .sort((a, b) => (b.tension - a.tension) || a.id.localeCompare(b.id));
      if (open.length) {
        const target = open[0];
        const threads = inst.threads.map(t => {
          if (t.id !== target.id) return t;
          const tension = clampInt(t.tension + by, 0, 5);
          const status = tension < 3 && t.status === 'escalating' ? 'open' : t.status;
          return { ...t, tension, status };
        });
        w = { ...w, instrument: { ...inst, threads } };
      }
      continue;
    }

    if (kind === 'ledger') {
      if (op.addFact) w = addFact(w, op.addFact, op.source || 'resolution');
      if (op.addThreat) w = addThreat(w, op.addThreat, op.level ?? 1);
      if (op.addQuestion) w = addQuestion(w, op.addQuestion);
      continue;
    }

    if (kind === 'combatState') {
      // Pass 5: sole mutation path for world.combat. Accepts a partial merge
      // (top-level fields + enemies replacement) plus per-enemy hp deltas and
      // defeated markers. Re-normalized via ensureCombat after merging.
      const cur = w.combat ? { ...w.combat, enemies: Array.isArray(w.combat.enemies) ? w.combat.enemies.map(e => ({ ...e })) : [] } : defaultCombat();
      let enemies = cur.enemies;

      const set = op.set && typeof op.set === 'object' ? op.set : null;
      if (set && Array.isArray(set.enemies)) {
        enemies = set.enemies.map(e => ({ ...e }));
      }

      // enemyHpDelta: array of { id, by }
      if (Array.isArray(op.enemyHpDelta)) {
        for (const eh of op.enemyHpDelta) {
          if (!eh || typeof eh !== 'object') continue;
          const id = String(eh.id ?? '');
          const by = toInt(eh.by ?? 0);
          if (!id || !by) continue;
          enemies = enemies.map(e => {
            if (String(e.id) !== id) return e;
            const maxHp = Number.isInteger(e.maxHp) ? e.maxHp : 1;
            const cur0 = Number.isInteger(e.hp) ? e.hp : maxHp;
            const next = clampInt(cur0 + by, 0, maxHp);
            return { ...e, hp: next, defeated: next === 0 ? true : Boolean(e.defeated) };
          });
        }
      }

      // enemyDefeated: array of enemy ids to flag defeated (and zero hp).
      if (Array.isArray(op.enemyDefeated)) {
        const ids = new Set(op.enemyDefeated.map(String));
        enemies = enemies.map(e => ids.has(String(e.id)) ? { ...e, hp: 0, defeated: true } : e);
      }

      const merged = {
        active: set && 'active' in set ? Boolean(set.active) : cur.active,
        round: set && 'round' in set ? toInt(set.round) : cur.round,
        turnIndex: set && 'turnIndex' in set ? toInt(set.turnIndex) : cur.turnIndex,
        beganAt: set && 'beganAt' in set ? toInt(set.beganAt) : cur.beganAt,
        reason: set && 'reason' in set ? String(set.reason ?? '') : cur.reason,
        playerGuard: set && 'playerGuard' in set ? Boolean(set.playerGuard) : cur.playerGuard,
        companionGuard: set && 'companionGuard' in set ? Boolean(set.companionGuard) : cur.companionGuard,
        enemies
      };

      w = { ...w, combat: ensureCombat(merged) };
      continue;
    }

    if (kind === 'timeline') {
      const text = String(op.add || '').trim();
      if (!text) continue;
      const t = w.timeline.length;
      const e = { t, kind: 'note', data: { text } };
      w = { ...w, timeline: [...w.timeline, e] };
      continue;
    }

    // ── Physics ops ────────────────────────────────────────────────────────
    // Produced by llmPhysics.evaluatePhysics() (LLM or offline fallback) when
    // the player interacts with furniture or items.

    if (kind === 'createItem') {
      const entityId = String(op.entityId || '');
      const bucket = String(op.bucket || 'junk');
      const item = op.item && typeof op.item === 'object' ? op.item : null;
      if (!entityId || !item || !item.name) continue;
      w = mutateEntity(w, entityId, (e) => {
        const inv = (e.inventory && typeof e.inventory === 'object') ? e.inventory : {};
        const arr = Array.isArray(inv[bucket]) ? [...inv[bucket]] : [];
        arr.push({
          name: String(item.name),
          tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 6) : [],
          weight: clampInt(item.weight ?? 1, 0, 5),
          noise: clampInt(item.noise ?? 0, 0, 5),
          light: clampInt(item.light ?? 0, 0, 5),
          bulk: clampInt(item.bulk ?? 1, 0, 5),
          notes: String(item.notes || '')
        });
        return { ...e, inventory: { ...inv, [bucket]: arr } };
      });
      continue;
    }

    if (kind === 'removeItem') {
      const entityId = String(op.entityId || '');
      const bucket = String(op.bucket || '');
      const itemName = String(op.itemName || '');
      if (!entityId || !bucket || !itemName) continue;
      w = mutateEntity(w, entityId, (e) => {
        const inv = (e.inventory && typeof e.inventory === 'object') ? e.inventory : {};
        const arr = Array.isArray(inv[bucket]) ? inv[bucket] : [];
        const idx = arr.findIndex(i => String(i?.name) === itemName);
        if (idx === -1) return e;
        const next = arr.slice();
        next.splice(idx, 1);
        return { ...e, inventory: { ...inv, [bucket]: next } };
      });
      continue;
    }

    if (kind === 'modifyFurniture') {
      const nodeId = String(op.nodeId || '');
      const furnitureId = toInt(op.furnitureId ?? -1);
      const changes = op.changes && typeof op.changes === 'object' ? op.changes : null;
      if (!nodeId || furnitureId < 0 || !changes) continue;
      w = mutateNode(w, nodeId, (node) => {
        const furniture = Array.isArray(node.furniture) ? [...node.furniture] : [];
        if (furnitureId >= furniture.length) return node;
        const cur = furniture[furnitureId] || {};
        const next = { ...cur };
        if (typeof changes.state === 'string') next.state = changes.state;
        if (Array.isArray(changes.parts)) next.parts = changes.parts.map(String);
        if (typeof changes.notes === 'string') next.notes = changes.notes;
        furniture[furnitureId] = next;
        return { ...node, furniture };
      });
      continue;
    }

    // ── Pass C1 — companions ───────────────────────────────────────────────
    // Recruit mints a party entity from a settlement NPC. Pure state mutation:
    // no randomness, no LLM. Source NPC is removed from the settlement so it
    // cannot be re-recruited or talked to again. Dismiss removes a companion
    // from the party without restoring them to a settlement.

    if (kind === 'recruitCompanion') {
      const sourceNpcId = String(op.sourceNpcId || '').trim();
      const nodeId = String(op.nodeId || w.map?.currentNodeId || '');
      if (!sourceNpcId || !nodeId) continue;

      const party = Array.isArray(w.party) ? w.party : [];
      if (party.length >= 3) continue;
      if (party.some(p => p?.companion?.sourceNpcId === sourceNpcId)) continue;

      const nodes = Array.isArray(w.map?.nodes) ? w.map.nodes : [];
      const nodeIdx = nodes.findIndex(n => n && n.id === nodeId);
      if (nodeIdx === -1) continue;
      const node = nodes[nodeIdx];
      const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
      const npcIdx = npcs.findIndex(n => n && String(n.id) === sourceNpcId);
      if (npcIdx === -1) continue;
      const sourceNpc = npcs[npcIdx];

      // Remove NPC from settlement.
      const nextNpcs = npcs.slice();
      nextNpcs.splice(npcIdx, 1);
      const nextNodes = nodes.slice();
      nextNodes[nodeIdx] = { ...node, settlement: { ...node.settlement, npcs: nextNpcs } };

      const player = party[0] || {};
      const playerPos = (player.position && typeof player.position === 'object') ? player.position : { zone: 'far' };
      const minted = mintCompanionFromNpc(sourceNpc, playerPos, w.time?.turn ?? 0);
      const nextParty = [...party, minted];

      w = { ...w, party: nextParty, map: { ...w.map, nodes: nextNodes } };
      continue;
    }

    if (kind === 'dismissCompanion') {
      const entityId = String(op.entityId || '').trim();
      if (!entityId) continue;
      const party = Array.isArray(w.party) ? w.party : [];
      const idx = party.findIndex(e => String(e?.id) === entityId);
      if (idx <= 0) continue; // not found, or trying to dismiss player
      if (!party[idx]?.companion) continue;
      const nextParty = party.slice();
      nextParty.splice(idx, 1);
      w = { ...w, party: nextParty };
      continue;
    }

    // ── Pass T2 — structured item ops for inventory.items[] ────────────────
    // These operate on the new object-array items schema from T1.
    // The legacy createItem/removeItem (string-based, bucket-oriented) above
    // remain for backward compat.

    if (kind === 'addItem') {
      const entityId = String(op.entityId || 'party');
      const item = op.item;
      if (!item || typeof item !== 'object') continue;
      const id = String(item.id ?? '').trim();
      const defRef = String(item.defRef ?? '').trim();
      if (!id || !defRef) continue;
      w = mutateEntity(w, entityId, (e) => {
        const inv = e.inventory || {};
        const items = Array.isArray(inv.items) ? [...inv.items] : [];
        if (items.some(it => it.id === id)) return e; // no dupes
        items.push({ id, defRef, equipped: item.equipped ?? null });
        return { ...e, inventory: { ...inv, items } };
      });
      continue;
    }

    if (kind === 'removeItemById') {
      const entityId = String(op.entityId || 'party');
      const itemId = String(op.itemId ?? '').trim();
      if (!itemId) continue;
      w = mutateEntity(w, entityId, (e) => {
        const inv = e.inventory || {};
        const items = Array.isArray(inv.items) ? [...inv.items] : [];
        return { ...e, inventory: { ...inv, items: items.filter(it => it.id !== itemId) } };
      });
      continue;
    }

    if (kind === 'equipItem') {
      const entityId = String(op.entityId || 'party');
      const itemId = String(op.itemId ?? '').trim();
      const slot = String(op.slot ?? '').trim();
      if (!itemId || !slot) continue;
      w = mutateEntity(w, entityId, (e) => {
        const inv = e.inventory || {};
        const items = Array.isArray(inv.items) ? [...inv.items] : [];
        const updated = items.map(it => {
          if (it.equipped === slot && it.id !== itemId) return { ...it, equipped: null };
          if (it.id === itemId) return { ...it, equipped: slot };
          return it;
        });
        return { ...e, inventory: { ...inv, items: updated } };
      });
      continue;
    }

    if (kind === 'unequipItem') {
      const entityId = String(op.entityId || 'party');
      const itemId = String(op.itemId ?? '').trim();
      if (!itemId) continue;
      w = mutateEntity(w, entityId, (e) => {
        const inv = e.inventory || {};
        const items = Array.isArray(inv.items) ? [...inv.items] : [];
        const updated = items.map(it => it.id === itemId ? { ...it, equipped: null } : it);
        return { ...e, inventory: { ...inv, items: updated } };
      });
      continue;
    }

    if (kind === 'removeFurniture') {
      const nodeId = String(op.nodeId || '');
      const furnitureId = toInt(op.furnitureId ?? -1);
      if (!nodeId || furnitureId < 0) continue;
      w = mutateNode(w, nodeId, (node) => {
        const furniture = Array.isArray(node.furniture) ? [...node.furniture] : [];
        if (furnitureId >= furniture.length) return node;
        furniture.splice(furnitureId, 1);
        return { ...node, furniture };
      });
      continue;
    }
  }

  return w;
}

function mutateNode(world, nodeId, fn) {
  const nodes = Array.isArray(world.map?.nodes) ? world.map.nodes : [];
  const idx = nodes.findIndex(n => n.id === nodeId);
  if (idx === -1) return world;
  const nextNodes = nodes.slice();
  nextNodes[idx] = fn(nextNodes[idx]);
  return { ...world, map: { ...world.map, nodes: nextNodes } };
}

function mutateNpc(world, npcId, fn) {
  const nodeId = String(world.map?.currentNodeId ?? '');
  const nodes = Array.isArray(world.map?.nodes) ? world.map.nodes : [];
  const nodeIdx = nodes.findIndex(n => n.id === nodeId);
  if (nodeIdx === -1) return world;
  const node = nodes[nodeIdx];
  if (!node.settlement?.npcs?.length) return world;

  const npcIdx = node.settlement.npcs.findIndex(n =>
    n.id === npcId || String(n.name).toLowerCase() === String(npcId).toLowerCase()
  );
  if (npcIdx === -1) return world;

  const nextNpcs = [...node.settlement.npcs];
  nextNpcs[npcIdx] = fn(nextNpcs[npcIdx]);
  const nextNodes = [...nodes];
  nextNodes[nodeIdx] = { ...node, settlement: { ...node.settlement, npcs: nextNpcs } };
  return { ...world, map: { ...world.map, nodes: nextNodes } };
}

function mutateEntity(world, entityId, fn) {
  const party = Array.isArray(world.party) ? world.party : [];
  const idx = party.findIndex(e => String(e?.id) === entityId);
  if (idx === -1) return world;
  const nextParty = party.slice();
  nextParty[idx] = fn(nextParty[idx]);
  return { ...world, party: nextParty };
}

function toInt(x) {
  const n = Math.trunc(Number(x));
  return Number.isFinite(n) ? n : 0;
}

function clampZone(z) {
  const s = String(z);
  return (s === 'far' || s === 'near' || s === 'engaged') ? s : 'near';
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

// Pass C1 — companion mint. Pure: deterministic stat synthesis from role,
// empty inventory, position copied from player, companion marker carrying
// provenance back to the source NPC. ensureWorld will re-normalize the
// shape and apply invariants on the next state read.
const COMPANION_ROLE_STAT_BUMP = {
  tavern_keeper: 'CHARM',
  innkeeper: 'CHARM',
  smith: 'MIGHT',
  priest: 'GRIT',
  merchant: 'CHARM',
  guard_captain: 'MIGHT',
  stable_hand: 'AGILITY',
  scholar: 'WITS',
  hedge_witch: 'WITS',
  artisan: 'AGILITY',
  elder: 'WITS',
  laborer: 'MIGHT',
  veteran: 'GRIT',
  trader: 'CHARM',
  healer: 'WITS',
  scavenger: 'AGILITY',
  mediator: 'CHARM',
  guard: 'MIGHT',
  representative: 'CHARM'
};

function mintCompanionFromNpc(npc, playerPosition, currentTurn) {
  const sourceId = String(npc?.id || '');
  const role = String(npc?.role || '');
  const trustRaw = Number(npc?.conversationState?.trustLevel ?? 5);
  const trustLevel = Number.isFinite(trustRaw)
    ? Math.max(0, Math.min(10, Math.trunc(trustRaw)))
    : 5;

  const stats = { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 };
  const bumpStat = COMPANION_ROLE_STAT_BUMP[role];
  if (bumpStat && stats[bumpStat] != null) {
    stats[bumpStat] = stats[bumpStat] + 2;
  }

  const position = playerPosition && typeof playerPosition === 'object'
    ? JSON.parse(JSON.stringify(playerPosition))
    : { zone: 'far' };

  return {
    id: `companion_${sourceId}`,
    name: String(npc?.name || sourceId || 'companion'),
    archetype: role || 'companion',
    vibe: 'companion',
    stress: 0,
    wounds: 0,
    stats,
    inventory: {
      weapons: [],
      armor: [],
      tools: [],
      clothes: [],
      spells: [],
      tech: [],
      oddities: [],
      consumables: [],
      junk: []
    },
    traits: {
      vibe: 'companion',
      fear: '',
      flaw: '',
      ideal: '',
      detail: '',
      keepsake: '',
      lineYouWontCross: '',
      rumor: ''
    },
    background: { name: role || '', tags: [], hook: '' },
    signature: { itemName: '', meaning: '' },
    position,
    companion: {
      sourceNpcId: sourceId,
      recruitedAtTurn: Math.max(0, Math.trunc(Number(currentTurn) || 0)),
      trustLevel,
      role
    }
  };
}
