// server/worldStore.js — JSON file-based world persistence
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORLDS_DIR = path.join(__dirname, '..', 'data', 'worlds');

// Only alphanumeric + hyphens — prevents path traversal
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function isSafeId(id) {
  return typeof id === 'string' && SAFE_ID_RE.test(id);
}

export { isSafeId };

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function userDir(userId) {
  if (!isSafeId(userId)) throw new Error('invalid_user_id');
  return path.join(WORLDS_DIR, userId);
}

function worldPath(userId, worldId) {
  if (!isSafeId(userId)) throw new Error('invalid_user_id');
  if (!isSafeId(worldId)) throw new Error('invalid_world_id');
  return path.join(WORLDS_DIR, userId, `${worldId}.json`);
}

export function saveWorld(userId, worldId, worldState) {
  const dir = userDir(userId);
  ensureDir(dir);
  const fp = worldPath(userId, worldId);
  fs.writeFileSync(fp, JSON.stringify(worldState), 'utf-8');
}

export function loadWorld(userId, worldId) {
  const fp = worldPath(userId, worldId);
  if (!fs.existsSync(fp)) return null;
  const raw = fs.readFileSync(fp, 'utf-8');
  return JSON.parse(raw);
}

export function listWorlds(userId) {
  const dir = userDir(userId);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const id = f.replace(/\.json$/, '');
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    return { id, updatedAt: stat.mtimeMs };
  });
}

export function deleteWorld(userId, worldId) {
  const fp = worldPath(userId, worldId);
  if (!fs.existsSync(fp)) return false;
  fs.unlinkSync(fp);
  return true;
}
