// The Underworld — the dungeon data schema (docs/WORLD_AND_DUNGEONS.md Part B).
//
// This is the CONTRACT, built first: the generator is just one author of this
// data; a human hand-authoring the same shape (D5, the "canvas") is another.
// One system, every scale — a 1-room cellar shrine and an endless Moria are the
// SAME shape, parameterized by `scale`. If the schema can't express both, it's
// wrong.
//
//   Dungeon { id, seed, entranceNodeId, scale, theme, biome, levels:[Level] }
//   Level   { depth, entryRoomId, rooms:{roomId:Room}, downStairsRoomId, upStairsRoomId }
//   Room    { id, role, exits:[roomId], contents:[Content], dressing:[str], light }
//   Content { kind:'feature'|'encounter'|'treasure'|'trap'|'boss', ...payload }
//
// Rich Room data (contents/dressing/light) is NEVER persisted — it is re-derived
// deterministically from seed+id+depth on demand (engine/structures topology only
// keeps {id,tags}). So this object is a transient projection, regenerated identically
// every time; the only persisted runtime artifact is the navigable structure
// (see generate.dungeonLevelToStructure).

export const DUNGEON_SCALES = ['shrine', 'small', 'site', 'mega'];
export const DUNGEON_THEMES = ['mine', 'crypt', 'shrine', 'lair', 'sewer', 'hold', 'infernal'];
export const ROOM_ROLES = ['entry', 'chamber', 'corridor', 'vault', 'lair', 'shrine', 'crypt', 'prison', 'cache', 'puzzle'];
export const CONTENT_KINDS = ['feature', 'encounter', 'treasure', 'trap', 'boss'];
export const ROOM_LIGHT = ['dark', 'dim', 'lit'];

const isObj = (x) => x && typeof x === 'object';
const str = (x, d = '') => (x == null ? d : String(x));
const arrStr = (x) => (Array.isArray(x) ? x.map(String).filter(Boolean) : []);

function normalizeContent(c) {
  if (!isObj(c)) return null;
  const kind = CONTENT_KINDS.includes(c.kind) ? c.kind : 'feature';
  // payload is kind-specific and free-form; carry it through verbatim but keep
  // `kind` canonical. (D0 emits only 'feature'; later kinds slot in unchanged.)
  return { ...c, kind };
}

function normalizeRoom(r, id) {
  const rid = str(r?.id || id);
  if (!rid) return null;
  const role = ROOM_ROLES.includes(r?.role) ? r.role : 'chamber';
  const light = ROOM_LIGHT.includes(r?.light) ? r.light : 'dark';
  return {
    id: rid,
    role,
    exits: arrStr(r?.exits),
    contents: (Array.isArray(r?.contents) ? r.contents : []).map(normalizeContent).filter(Boolean),
    dressing: arrStr(r?.dressing),
    light
  };
}

function normalizeLevel(l, depth) {
  const roomsIn = isObj(l?.rooms) ? l.rooms : {};
  const rooms = {};
  for (const [k, v] of Object.entries(roomsIn)) {
    const room = normalizeRoom(v, k);
    if (room) rooms[room.id] = room;
  }
  const ids = Object.keys(rooms);
  const entryRoomId = (rooms[str(l?.entryRoomId)] ? str(l.entryRoomId) : ids[0]) || '';
  const downStairsRoomId = rooms[str(l?.downStairsRoomId)] ? str(l.downStairsRoomId) : null;
  const upStairsRoomId = rooms[str(l?.upStairsRoomId)] ? str(l.upStairsRoomId) : null;
  return { depth: Number.isFinite(+l?.depth) ? +l.depth : depth, entryRoomId, rooms, downStairsRoomId, upStairsRoomId };
}

/**
 * normalizeDungeon(d) — coerce arbitrary data (a generator's output OR a
 * hand-authored file) to the canonical shape with safe defaults. The canvas's
 * gate (D5) and the generator's self-check both run through here.
 */
export function normalizeDungeon(d) {
  const dd = isObj(d) ? d : {};
  const entranceNodeId = str(dd.entranceNodeId);
  const scale = DUNGEON_SCALES.includes(dd.scale) ? dd.scale : 'shrine';
  const theme = DUNGEON_THEMES.includes(dd.theme) ? dd.theme : 'shrine';
  const levelsIn = Array.isArray(dd.levels) ? dd.levels : [];
  const levels = levelsIn.map((l, i) => normalizeLevel(l, i));
  return {
    id: str(dd.id || (entranceNodeId ? `dungeon:${entranceNodeId}` : 'dungeon')),
    seed: str(dd.seed),
    entranceNodeId,
    scale,
    theme,
    biome: str(dd.biome || 'wilderness'),
    levels
  };
}

/**
 * validateDungeon(d) — structural check used by the canvas (D5) and tests.
 * Returns { ok, errors:[string] }. Verifies every level has its entry room,
 * every exit points at a real room in the same level, and stairs (when set)
 * name real rooms.
 */
export function validateDungeon(d) {
  const errors = [];
  const dd = isObj(d) ? d : {};
  if (!str(dd.entranceNodeId)) errors.push('missing entranceNodeId');
  if (!DUNGEON_SCALES.includes(dd.scale)) errors.push(`bad scale: ${dd.scale}`);
  if (!Array.isArray(dd.levels) || dd.levels.length === 0) errors.push('no levels');
  for (const [i, l] of (Array.isArray(dd.levels) ? dd.levels : []).entries()) {
    const rooms = isObj(l?.rooms) ? l.rooms : {};
    const ids = new Set(Object.keys(rooms));
    if (!ids.size) { errors.push(`level ${i}: no rooms`); continue; }
    if (!ids.has(str(l.entryRoomId))) errors.push(`level ${i}: entryRoomId "${l.entryRoomId}" not a room`);
    for (const rid of ids) {
      for (const ex of arrStr(rooms[rid]?.exits)) {
        if (!ids.has(ex)) errors.push(`level ${i} room ${rid}: exit "${ex}" not a room`);
      }
    }
    for (const k of ['downStairsRoomId', 'upStairsRoomId']) {
      const v = str(l?.[k]);
      if (v && !ids.has(v)) errors.push(`level ${i}: ${k} "${v}" not a room`);
    }
  }
  return { ok: errors.length === 0, errors };
}
