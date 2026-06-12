import { ensureWorld, WORLD_VERSION } from './state.js';

const KEY_LAST = 'ai-dm-v2:lastSlot';

export function slotKey(slotId) {
  return `ai-dm-v2:slot:${String(slotId)}`;
}

export function hasSlot(storage, slotId = 'slot1') {
  try {
    return Boolean(storage.getItem(slotKey(slotId)));
  } catch {
    return false;
  }
}

export function loadSlot(storage, slotId = 'slot1') {
  const raw = storage.getItem(slotKey(slotId));
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  const savedVersion = parsed?.meta?.version;
  if (savedVersion != null && savedVersion !== WORLD_VERSION) {
    console.warn(`Loading save from v${savedVersion}, current version is v${WORLD_VERSION}`);
  }
  // Pass T1 (v15 → v16): old saves pre-date the crunch schema
  // (level/xp/foci/purse/inventory.items/spells). ensureWorld + ensureEntity
  // fill those fields with safe defaults (level 1, xp 0, empty foci/purse/
  // items, zero spell slots, null concentration) so v15 saves upgrade
  // silently to v16 without loss of existing data.
  //
  // Pass R1 (v16 → v17): adds world.rumors[], npc.rumorIds[],
  // npc.sophistication. ensureWorld fills rumors: []; NPCs without
  // rumorIds/sophistication get defaults via ensureWorld normalization.
  return ensureWorld(parsed);
}

export function saveSlot(storage, world, slotId = 'slot1') {
  const safe = ensureWorld(world);
  storage.setItem(slotKey(slotId), JSON.stringify(safe));
  storage.setItem(KEY_LAST, String(slotId));
  return safe;
}

export function loadLast(storage) {
  const slotId = storage.getItem(KEY_LAST) || 'slot1';
  const w = loadSlot(storage, slotId);
  return { slotId, world: w };
}

export function exportWorld(world) {
  const safe = ensureWorld(world);
  return JSON.stringify({ kind: 'ai-dm-v2-export', world: safe });
}

export function importWorld(text) {
  const parsed = JSON.parse(String(text));
  if (parsed?.kind !== 'ai-dm-v2-export') throw new Error('Not an ai-dm-v2 export.');
  return ensureWorld(parsed.world);
}

// P-79 — the resume hook: stamp a session boundary into the timeline so the
// recap knows where "last time" ended. Canon (a session really happened);
// replay ignores unknown kinds, same as craft/salvage events.
export function markResume(world) {
  const w = ensureWorld(world);
  const t = w.timeline.length;
  return { ...w, timeline: [...w.timeline, { t, kind: 'sessionResume', data: {} }] };
}
