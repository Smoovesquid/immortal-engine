import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeOpenAiClient, hasOpenAiKey, handleAiRequest } from './server/ai.js';
import { buildLocalProjection } from './engine/map/projection/localProjection.js';
import { augmentNarration } from './engine/llmAdapter.js';
import { hashPassword, verifyPassword, generateToken, requireAuth } from './server/auth.js';
import { createUser, findUser, userExists, validateUsername } from './server/userStore.js';
import { saveWorld, loadWorld, listWorlds, deleteWorld, isSafeId } from './server/worldStore.js';
import { ensureWorld } from './engine/state.js';
import { playerMove } from './engine/playloop.js';
import { adjudicateWithGrace } from './engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from './engine/rulesets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  let sessionOpenAiKey = null;
  let aiMode = "disabled";

  app.use(express.json({ limit: '256kb' }));

  // Static mounts
  app.use('/', express.static(path.join(__dirname, 'public')));
  app.use('/engine', express.static(path.join(__dirname, 'engine')));
  app.use('/packs', express.static(path.join(__dirname, 'packs')));

  app.get('/healthz', (_req, res) => res.type('text').send('ok'));

  app.get('/api/ai-status', (req, res) => {
  try {
    const envPresent = hasOpenAiKey();
    const sessionPresent = Boolean(sessionOpenAiKey && String(sessionOpenAiKey).trim());

    let online = false;
    let source = "none";

    if (aiMode === "disabled") {
      online = false;
      source = "disabled";
    } else if (aiMode === "session") {
      online = sessionPresent;
      source = "session";
    } else if (aiMode === "env") {
      online = envPresent;
      source = "env";
    }

    return res.json({ ok: true, online, envPresent, sessionPresent, source, mode: aiMode });
  } catch {
    return res.status(500).json({ ok: false });
  }
});

  app.post('/api/ai-key', (req, res) => {
  const apiKey = String(req?.body?.apiKey || "").trim();
  const envPresent = hasOpenAiKey();

  if (!apiKey) {
    sessionOpenAiKey = null;
    aiMode = "disabled";
    return res.json({ ok: true, online: false, envPresent, sessionPresent: false, source: "disabled", mode: aiMode });
  }

  sessionOpenAiKey = apiKey;
  aiMode = "session";
  return res.json({ ok: true, online: true, envPresent, sessionPresent: true, source: "session", mode: aiMode });
});

  app.post('/api/ai-test', async (_req, res) => {
    const client = makeOpenAiClient({ apiKey: sessionOpenAiKey, mode: aiMode });
    if (client == null) return res.json({ ok: false, reason: 'no_client' });
    try {
      const resp = await client.responses.create({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: 'Return exactly: OK'
      });
      const text = String(resp.output_text || '').trim();
      return res.json({ ok: true, response: text || '(empty)' });
    } catch (e) {
      const raw = String(e?.message || e);
const safe = raw.replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g,"sk-***");
return res.json({ ok:false, reason:safe });
    }
  });

  app.post('/api/ai', async (req, res) => {
    const client = makeOpenAiClient({ apiKey: sessionOpenAiKey, mode: aiMode });
    const out = await handleAiRequest({ client, body: req.body });
    res.json(out);
  });

  // Anthropic key test — returns ok:true only if the key actually works
  app.post('/api/anthropic-test', async (req, res) => {
    const key = String(req.body?.anthropicKey || '').trim();
    if (!key) return res.json({ ok: false, reason: 'no_key' });
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Say: OK' }]
        })
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.json({ ok: false, reason: err?.error?.message || `HTTP ${r.status}` });
      }
      return res.json({ ok: true });
    } catch (e) {
      return res.json({ ok: false, reason: String(e?.message || 'network_error') });
    }
  });

  // N6 — AI narration endpoint
  // POST { world, baseNarration, outcome } → { ok, narration }
  // Falls back to baseNarration silently if key absent or API fails.
  app.post('/api/narrate', async (req, res) => {
    try {
      const world        = req.body?.world        ?? null;
      const baseNarration = String(req.body?.baseNarration ?? '').trim();
      const outcome      = req.body?.outcome      ?? {};
      const anthropicKey = String(req.body?.anthropicKey || process.env.ANTHROPIC_API_KEY || '').trim();

      const narration = await augmentNarration({
        world,
        outcome,
        baseNarration,
        enabled: Boolean(anthropicKey),
        apiKey:  anthropicKey
      });

      return res.json({ ok: true, narration });
    } catch {
      return res.json({ ok: true, narration: String(req.body?.baseNarration ?? '') });
    }
  });

  // ── Auth routes ───────────────────────────────────────────────────────

  app.post('/api/auth/register', async (req, res) => {
    try {
      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');

      if (!validateUsername(username)) {
        return res.status(400).json({ ok: false, error: 'invalid_username' });
      }
      if (!password || password.length < 6 || password.length > 128) {
        return res.status(400).json({ ok: false, error: 'invalid_password' });
      }
      if (userExists(username)) {
        return res.status(409).json({ ok: false, error: 'user_exists' });
      }

      const hashed = await hashPassword(password);
      createUser(username, hashed);
      const token = generateToken(username);
      return res.json({ ok: true, token, username });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');

      const user = findUser(username);
      if (!user) {
        return res.status(401).json({ ok: false, error: 'invalid_credentials' });
      }

      const valid = await verifyPassword(password, user.hashedPassword);
      if (!valid) {
        return res.status(401).json({ ok: false, error: 'invalid_credentials' });
      }

      const token = generateToken(username);
      return res.json({ ok: true, token, username });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  // ── World routes (auth required) ─────────────────────────────────────

  app.get('/api/worlds', requireAuth, (req, res) => {
    try {
      const worlds = listWorlds(req.user.username);
      return res.json({ ok: true, worlds });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  app.get('/api/worlds/:id', requireAuth, (req, res) => {
    try {
      const worldId = String(req.params.id || '');
      if (!isSafeId(worldId)) {
        return res.status(400).json({ ok: false, error: 'invalid_world_id' });
      }
      const state = loadWorld(req.user.username, worldId);
      if (!state) {
        return res.status(404).json({ ok: false, error: 'not_found' });
      }
      return res.json({ ok: true, worldId, state });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  app.post('/api/worlds', requireAuth, (req, res) => {
    try {
      const worldId = String(req.body?.worldId || '').trim();
      const state = req.body?.state;
      if (!isSafeId(worldId)) {
        return res.status(400).json({ ok: false, error: 'invalid_world_id' });
      }
      if (!state || typeof state !== 'object') {
        return res.status(400).json({ ok: false, error: 'missing_state' });
      }
      saveWorld(req.user.username, worldId, state);
      return res.json({ ok: true, worldId });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  app.delete('/api/worlds/:id', requireAuth, (req, res) => {
    try {
      const worldId = String(req.params.id || '');
      if (!isSafeId(worldId)) {
        return res.status(400).json({ ok: false, error: 'invalid_world_id' });
      }
      const deleted = deleteWorld(req.user.username, worldId);
      if (!deleted) {
        return res.status(404).json({ ok: false, error: 'not_found' });
      }
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  // ── Server-authoritative move (auth required) ────────────────────────

  // Lazy-load packs once for server-side move execution
  let _serverPacks = null;
  function getServerPacks() {
    if (_serverPacks) return _serverPacks;
    const packsDir = path.join(__dirname, 'packs');
    const manRaw = JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf-8'));
    const manifest = normalizeManifest(manRaw);
    const byId = {};
    for (const p of manifest.packs) {
      const raw = JSON.parse(fs.readFileSync(path.join(__dirname, p.path), 'utf-8'));
      byId[p.id] = normalizePack(raw);
    }
    _serverPacks = byId;
    return byId;
  }

  app.post('/api/move', requireAuth, async (req, res) => {
    try {
      const worldId = String(req.body?.worldId || '').trim();
      const transcription = String(req.body?.action || '').trim();

      if (!isSafeId(worldId)) {
        return res.status(400).json({ ok: false, error: 'invalid_world_id' });
      }
      if (!transcription) {
        return res.status(400).json({ ok: false, error: 'missing_action' });
      }

      const currentState = loadWorld(req.user.username, worldId);
      if (!currentState) {
        return res.status(404).json({ ok: false, error: 'world_not_found' });
      }

      const safeWorld = ensureWorld(currentState);
      const packsById = getServerPacks();

      // Grace layer: process transcription with intent extraction, confidence checking, etc.
      const graceResult = await adjudicateWithGrace(safeWorld, transcription);

      // Handle different response types from grace layer
      if (graceResult.type === 'meta') {
        // Meta-question (status check, location query, etc.) — respond directly, no world mutation
        return res.json({
          ok: true,
          worldId,
          state: graceResult.world,
          output: {
            type: 'meta',
            narration: graceResult.message,
            mechanics: ''
          }
        });
      }

      if (graceResult.type === 'clarification') {
        // Low confidence — ask for clarification instead of guessing
        return res.json({
          ok: true,
          worldId,
          state: graceResult.world,
          output: {
            type: 'clarification',
            narration: graceResult.message,
            mechanics: '',
            suggesting: graceResult.suggesting,
            confidence: graceResult.confidence,
            allowRetry: graceResult.allowRetry
          }
        });
      }

      // Type === 'action' — adjudication already happened in grace layer, world is mutated
      if (graceResult.type === 'action') {
        const newState = graceResult.world;

        saveWorld(req.user.username, worldId, newState);
        return res.json({
          ok: true,
          worldId,
          state: newState,
          output: {
            narration: graceResult.narration,
            mechanics: graceResult.mechanics,
            type: 'action',
            pacingMs: graceResult.pacingMs,
            confidence: graceResult.confidence,
            tone: graceResult.tone
          }
        });
      }

      // Unexpected response type
      return res.status(500).json({ ok: false, error: 'unexpected_grace_response' });
    } catch (e) {
      console.error('Move endpoint error:', e);
      return res.status(500).json({ ok: false, error: 'server_error', details: String(e?.message || e) });
    }
  });

  app.get('/api/local-projection', (req, res) => {
    try {
      const seed = String(req?.query?.seed || "").trim();
      const nodeId = String(req?.query?.nodeId || "").trim();
      const nodeType = String(req?.query?.nodeType || "settlement").trim();
      if (!seed || !nodeId) return res.status(400).json({ ok: false, reason: "missing_seed_or_nodeId" });
      const projection = buildLocalProjection({ seed }, nodeId, nodeType);
      return res.json({ ok: true, projection });
    } catch (e) {
      return res.status(500).json({ ok: false, reason: String(e?.message || e) });
    }
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = Number(process.env.PORT || 5179);
  const HOST = process.env.HOST || '0.0.0.0';
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`ai-dm-v2 dev server: http://localhost:${PORT}`);
  });

  app.on('error', (e) => {
    if (String(e?.code) === 'EADDRINUSE') {
      console.error(`[server] Port ${PORT} already in use. Try: PORT=${PORT + 1} node server.js`);
    }
  });
}
