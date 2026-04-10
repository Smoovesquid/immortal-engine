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
