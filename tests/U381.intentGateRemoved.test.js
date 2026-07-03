// U381 — INT-2R: the confidence gate is GONE. A sentence the deterministic
// parser reads CONFIDENTLY (no ambiguity, a real target, a recognized verb —
// "I attack the goblin" scores 0.8 via engine/intent/parseIntent.js, well
// above the old LOW_CONFIDENCE_THRESHOLD of 0.4) must STILL trigger a
// provider proposal request at server.js's /api/move seam. Pre-INT-2R this
// exact turn would have been skipped outright (isLowConfidencePacket(0.8) ===
// false) — the LLM never got asked. Proves the vetoed design is actually gone,
// not just documented as gone.
//
// Mirrors U377's HTTP-level bootstrap (real app, real auth, a real saved
// world) and its fetch-spy technique, but asserts the OPPOSITE outcome: a
// provider call DOES happen for a confident utterance.
//
// NOTE on isolation: unlike U377, this suite does NOT call createUser() —
// server/auth.js's requireAuth is stateless JWT verification (it never reads
// server/userStore.js's users.json), so generateToken(username) alone is
// sufficient for an authenticated request. Skipping createUser avoids
// contending on the shared data/users.json read-modify-write (no file lock —
// see server/userStore.js readUsers/writeUsers) that several OTHER suites
// (A01, A04, U377) already share; this suite also scopes its worldStore
// cleanup to its OWN username subdirectory rather than deleting the shared
// data/worlds directory wholesale.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../server.js';
import { generateToken } from '../server/auth.js';
import { saveWorld } from '../server/worldStore.js';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { _resetForTest as resetOllamaAvailability } from '../server/localLlmProvider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_USER = 'u381gateremoveduser';
const USER_WORLDS_DIR = path.join(__dirname, '..', 'data', 'worlds', TEST_USER);

function cleanup() {
  if (fs.existsSync(USER_WORLDS_DIR)) fs.rmSync(USER_WORLDS_DIR, { recursive: true, force: true });
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

describe('U381 — the confidence gate is gone (server.js /api/move)', () => {
  let app, server, baseUrl, token;
  let realFetch, providerCallCount;

  before(async () => {
    cleanup();
    resetOllamaAvailability();
    app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;

    // requireAuth only verifies the JWT signature/expiry — it never reads
    // userStore.js's users.json — so a token is sufficient with no
    // createUser() call (see the file-header note on shared-fixture isolation).
    token = generateToken(TEST_USER);

    const packsById = loadTestPacks();
    const w0 = newWorld({ seed: 'gateremovedtest', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
    const { world } = beginAdventure(w0, packsById);
    saveWorld(TEST_USER, 'testworld', world);

    // Spy on outbound provider calls, answering with a benign packet so the
    // turn completes normally either way. Everything else (including this
    // test's own fetch to the local test server) passes through untouched.
    realFetch = globalThis.fetch;
    providerCallCount = 0;
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes(':11434')) {
        providerCallCount += 1;
        return { ok: true, json: async () => ({ response: JSON.stringify({ verb: 'attack', target: null }) }) };
      }
      if (u.includes('api.anthropic.com')) {
        providerCallCount += 1;
        return { ok: true, json: async () => ({ content: [{ text: JSON.stringify({ verb: 'attack', target: null }) }] }) };
      }
      return realFetch(url, opts);
    };
  });

  after(() => {
    globalThis.fetch = realFetch;
    if (server) server.close();
    cleanup();
  });

  it('a HIGH-confidence utterance still triggers a provider proposal request (no confidence precondition)', async () => {
    const prevKey = process.env.ANTHROPIC_API_KEY;
    const prevFlag = process.env.INTENT_LLM;
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    delete process.env.INTENT_LLM; // default/auto — must NOT gate on confidence
    providerCallCount = 0;
    try {
      // "I search the room" — a clean, confidently-parsed verb with no
      // referent ambiguity at all (parseIntent scores this >=0.6, and the
      // old isLowConfidencePacket gate at threshold 0.4 would have skipped
      // the LLM entirely for this turn).
      const res = await fetch(`${baseUrl}/api/move`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ worldId: 'testworld', action: 'I search the room' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.ok);
      assert.ok(typeof data.output.narration === 'string');
      assert.ok(providerCallCount >= 1, 'a confidently-classified turn must still ask the LLM — the confidence precondition is gone');
    } finally {
      if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prevKey;
      if (prevFlag === undefined) delete process.env.INTENT_LLM; else process.env.INTENT_LLM = prevFlag;
    }
  });
});
