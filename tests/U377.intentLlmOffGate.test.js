// U377 — INT-2 rollback gate: INTENT_LLM=off must skip the LLM-intent proposal
// path outright, with zero outbound provider calls, even when a key is present.
// (PACKETS.md INT-2 rollback: "INTENT_LLM=off env flag (the INT-1 shadow path
// remains)" — the dev .env key has a hard, non-reloading $20 budget, so this
// flag must actually prevent network attempts, not just silently no-op.)

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../server.js';
import { hashPassword, generateToken } from '../server/auth.js';
import { createUser } from '../server/userStore.js';
import { saveWorld } from '../server/worldStore.js';
import { newWorld } from '../engine/state.js';
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

describe('U377 — INTENT_LLM=off gate (server.js /api/move)', () => {
  let app, server, baseUrl, token;
  let realFetch, providerCallCount;

  before(async () => {
    cleanup();
    app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;

    const hashed = await hashPassword('testpass');
    createUser('intentgateuser', hashed);
    token = generateToken('intentgateuser');

    const packsById = loadTestPacks();
    const w0 = newWorld({ seed: 'intentgatetest', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
    const { world } = beginAdventure(w0, packsById);
    saveWorld('intentgateuser', 'testworld', world);

    // Spy on outbound provider calls only (Anthropic / local Ollama). Pass
    // everything else (including this test's own fetch to the local test
    // server) straight through to the real fetch.
    realFetch = globalThis.fetch;
    providerCallCount = 0;
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('api.anthropic.com') || u.includes(':11434')) {
        providerCallCount += 1;
        throw new Error('U377 spy: outbound provider call should not have happened');
      }
      return realFetch(url, opts);
    };
  });

  after(() => {
    globalThis.fetch = realFetch;
    if (server) server.close();
    cleanup();
  });

  it('a fake key + INTENT_LLM=off never attempts an outbound provider call, and the turn still resolves', async () => {
    const prevKey = process.env.ANTHROPIC_API_KEY;
    const prevFlag = process.env.INTENT_LLM;
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    process.env.INTENT_LLM = 'off';
    providerCallCount = 0;
    try {
      // A deliberately vague utterance — exactly the shape that would trip
      // the low-confidence threshold and normally invite an LLM proposal.
      const res = await fetch(`${baseUrl}/api/move`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ worldId: 'testworld', action: 'do the thing about it' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.ok);
      assert.ok(typeof data.output.narration === 'string');
      assert.equal(providerCallCount, 0);
    } finally {
      if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prevKey;
      if (prevFlag === undefined) delete process.env.INTENT_LLM; else process.env.INTENT_LLM = prevFlag;
    }
  });
});
