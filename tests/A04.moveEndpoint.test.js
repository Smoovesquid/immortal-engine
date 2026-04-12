// A04: Move Endpoint — server-authoritative move execution
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../server.js';
import { hashPassword, generateToken } from '../server/auth.js';
import { createUser } from '../server/userStore.js';
import { saveWorld } from '../server/worldStore.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const WORLDS_DIR = path.join(DATA_DIR, 'worlds');

function cleanup() {
  if (fs.existsSync(USERS_FILE)) fs.unlinkSync(USERS_FILE);
  if (fs.existsSync(WORLDS_DIR)) fs.rmSync(WORLDS_DIR, { recursive: true, force: true });
}

// Minimal pack for tests
function loadTestPacks() {
  const packsDir = path.join(__dirname, '..', 'packs');
  const manRaw = JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf-8'));
  const manifest = normalizeManifest(manRaw);
  const byId = {};
  for (const p of manifest.packs) {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf-8'));
    byId[p.id] = normalizePack(raw);
  }
  return byId;
}

describe('A04 — Move Endpoint', () => {
  let app, server, baseUrl, token;

  before(async () => {
    cleanup();
    app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;

    // Create a test user
    const hashed = await hashPassword('testpass');
    createUser('moveuser', hashed);
    token = generateToken('moveuser');

    // Create a world via beginAdventure and save it
    const packsById = loadTestPacks();
    const w0 = newWorld({ seed: 'movetest', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
    const { world } = beginAdventure(w0, packsById);
    saveWorld('moveuser', 'testworld', world);
  });

  after(() => {
    if (server) server.close();
    cleanup();
  });

  it('POST /api/move with valid world executes move and returns updated state', async () => {
    const res = await fetch(`${baseUrl}/api/move`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ worldId: 'testworld', action: 'look around' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.ok);
    assert.ok(data.state);
    assert.ok(data.output);
    assert.ok(typeof data.output.narration === 'string');
  });

  it('POST /api/move without auth returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/move`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ worldId: 'testworld', action: 'look around' })
    });
    assert.equal(res.status, 401);
  });
});
