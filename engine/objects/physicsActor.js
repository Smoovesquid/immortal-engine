// OBJ-STRENGTH-1 — actor lookup for physical checks, kept SEPARATE from the
// party-only resolve.js findActor(). findPhysicsActor resolves a MIGHT+size for any
// actor that can move furniture: a party member, a combat enemy, or a hostile NPC
// standing at the current node.
//
// Size stays canonical at the content source (correction 1): it is never stored on
// the combat enemy. actorSize resolves it at READ time —
//   • party member  → member.dnd.species.size   (5e species size; default Medium)
//   • NPC / enemy    → record.bestiaryRef → getMonsterDef(ref).size  (default Medium)
// A spawned hostile carries bestiaryRef on its NPC record (encounterSpawn
// mintNpcFromDef); the stripped in-combat enemy record does not, so an enemy with
// neither a bestiaryRef nor a species defaults to Medium. Adding size or bestiaryRef
// to the enemy whitelist is deliberately NOT done here (no new persisted enemy
// state, no WORLD_VERSION bump).

import { getMonsterDef } from '../ruleset/core/bestiary/index.js';

const VALID_SIZES = new Set(['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']);

// Conservative defaults for an actor whose sheet is absent (e.g. a settlement NPC
// minted without stats): a middling human.
const DEFAULT_MIGHT = 10;
const DEFAULT_SIZE = 'Medium';

function currentNode(world) {
  const map = world && world.map ? world.map : {};
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  return nodes.find(n => n && n.id === map.currentNodeId) || null;
}

/**
 * findPhysicsActor(world, actorId) → { actor, kind, record }
 * kind ∈ 'party' | 'enemy' | 'npc' | 'unknown'. Lookup order is FIXED and the first
 * match wins (collision rule): party → combat enemies → present settlement NPCs.
 * An empty/'party' actorId resolves to the lead party member (party[0]). `record`
 * is the raw entry (used for bestiaryRef); `actor` is the same, for callers that
 * want stats. A miss returns kind 'unknown' with a null actor.
 */
export function findPhysicsActor(world, actorId) {
  const w = world && typeof world === 'object' ? world : {};
  const party = Array.isArray(w.party) ? w.party : [];
  const id = String(actorId ?? '').trim();

  if (!id || id === 'party') {
    const lead = party[0] || null;
    return { actor: lead, kind: lead ? 'party' : 'unknown', record: lead };
  }

  const inParty = party.find(e => String(e?.id) === id);
  if (inParty) return { actor: inParty, kind: 'party', record: inParty };

  const enemies = Array.isArray(w.combat?.enemies) ? w.combat.enemies : [];
  const asEnemy = enemies.find(e => String(e?.id) === id);
  if (asEnemy) return { actor: asEnemy, kind: 'enemy', record: asEnemy };

  const node = currentNode(w);
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  const asNpc = npcs.find(n => String(n?.id) === id);
  if (asNpc) return { actor: asNpc, kind: 'npc', record: asNpc };

  return { actor: null, kind: 'unknown', record: null };
}

/**
 * actorMight(actor) → number. Reads actor.stats.MIGHT; a sheet-less actor gets the
 * conservative default.
 */
export function actorMight(actor) {
  const m = Number(actor?.stats?.MIGHT);
  return Number.isFinite(m) ? m : DEFAULT_MIGHT;
}

/**
 * actorSize(world, actorId) → one of VALID_SIZES. Party → species size; NPC/enemy →
 * bestiaryRef → catalog size. No inference from names, tags, or prose. Default Medium.
 */
export function actorSize(world, actorId) {
  const { actor, kind } = findPhysicsActor(world, actorId);
  if (!actor) return DEFAULT_SIZE;

  if (kind === 'party') {
    const s = actor?.dnd?.species?.size;
    return VALID_SIZES.has(s) ? s : DEFAULT_SIZE;
  }

  const ref = actor?.bestiaryRef;
  if (ref) {
    const def = getMonsterDef(ref);
    if (def && VALID_SIZES.has(def.size)) return def.size;
  }
  return DEFAULT_SIZE;
}

/**
 * actorFacts(world, actorId) → { might, size } — the pair actorObjectCapacity needs.
 */
export function actorFacts(world, actorId) {
  const { actor } = findPhysicsActor(world, actorId);
  return { might: actorMight(actor), size: actorSize(world, actorId) };
}
