/**
 * The dresser — turns one authored plan into a populated, tiered instance.
 *
 * Given a plan and a tier, it places enemies (real bestiary creatures of that
 * tier — the lair's own creature first when known), scatters loot in the vault/
 * store rooms, seeds secrets (hidden caches, false walls, trapped chests), and
 * hands the renderer a per-instance seed so the same plan never dresses twice the
 * same. This is the multiplier: 45 plans × tiers × seeds = a populated world.
 *
 * PURE + DETERMINISTIC.
 */

import { makeRng, seedFromString } from '../rng.js';
import { trivial } from '../ruleset/core/bestiary/catalog/trivial.js';
import { minor } from '../ruleset/core/bestiary/catalog/minor.js';
import { standard } from '../ruleset/core/bestiary/catalog/standard.js';
import { elite } from '../ruleset/core/bestiary/catalog/elite.js';

const TIER_CATALOG = { 1: trivial, 2: minor, 3: standard, 4: elite };
const SPAWN_COUNT = { 1: 1, 2: 2, 3: 3, 4: 4 };
const LOOT_COUNT = { 1: 1, 2: 1, 3: 2, 4: 3 };
const SECRET_COUNT = { 1: 0, 2: 1, 3: 2, 4: 3 };
const SECRET_TYPES = ['hidden_cache', 'false_wall', 'trapped_chest'];
const LOOT_ROOM_ROLES = new Set(['vault', 'store', 'hoard', 'crypt']);

function roomXY(r) { return { x: r.cx, y: r.cy }; }

// dressStructure({ seed, plan, tier, ownerRef }) ->
//   { tier, spawns:[{ref,roomId,x,y}], loot:[{tier,roomId,x,y}], secrets:[{roomId,type}], furnitureSeed }
export function dressStructure({ seed = '', plan, tier = 1, ownerRef = null } = {}) {
  if (!plan || !Array.isArray(plan.rooms) || !plan.rooms.length) return { tier, spawns: [], loot: [], secrets: [], furnitureSeed: seed };
  const T = Math.max(1, Math.min(4, tier | 0));
  const rng = makeRng(seedFromString(`${seed}|dress|${plan.id}|${T}`));
  const rooms = plan.rooms;
  const nonEntry = rooms.filter(r => String(r.id) !== String(plan.entry));
  const pool = nonEntry.length ? nonEntry : rooms;
  const catalog = TIER_CATALOG[T] || trivial;

  // ── enemies ──
  const spawns = [];
  const want = SPAWN_COUNT[T];
  for (let i = 0; i < want; i++) {
    const ref = (i === 0 && ownerRef) ? ownerRef : String(rng.pick(catalog).ref);
    const r = pool[rng.int(0, pool.length - 1)];
    const c = roomXY(r);
    spawns.push({ ref, roomId: String(r.id), x: c.x + (rng.nextFloat() - 0.5), y: c.y + (rng.nextFloat() - 0.5) });
  }

  // ── loot ──
  const lootRooms = rooms.filter(r => LOOT_ROOM_ROLES.has(String(r.role || '')));
  const lootPool = lootRooms.length ? lootRooms : pool;
  const loot = [];
  for (let i = 0; i < LOOT_COUNT[T]; i++) { const r = lootPool[rng.int(0, lootPool.length - 1)]; const c = roomXY(r); loot.push({ tier: T, roomId: String(r.id), x: c.x, y: c.y }); }

  // ── secrets ──
  const secrets = [];
  for (let i = 0; i < SECRET_COUNT[T]; i++) { const r = pool[rng.int(0, pool.length - 1)]; secrets.push({ roomId: String(r.id), type: SECRET_TYPES[rng.int(0, SECRET_TYPES.length - 1)] }); }

  return { tier: T, spawns, loot, secrets, furnitureSeed: `${seed}|${plan.id}|${T}` };
}
