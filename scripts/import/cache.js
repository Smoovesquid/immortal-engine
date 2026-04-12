/**
 * Pass I2 — Hash-keyed cache for the prose importer pipeline.
 *
 * Cache files live under .pack-cache/{sha256}.json.
 * Key = SHA-256(prose + importerVersion + modelId).
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const CACHE_DIR = '.pack-cache';

export function cacheKey(prose, importerVersion, modelId) {
  return createHash('sha256')
    .update(prose)
    .update(importerVersion)
    .update(modelId)
    .digest('hex');
}

function cachePath(key, baseDir) {
  return join(baseDir, CACHE_DIR, `${key}.json`);
}

export async function readCache(key, { baseDir = process.cwd() } = {}) {
  try {
    const p = cachePath(key, baseDir);
    const raw = await readFile(p, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeCache(key, data, { baseDir = process.cwd() } = {}) {
  const p = cachePath(key, baseDir);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(data, null, 2), 'utf8');
}
