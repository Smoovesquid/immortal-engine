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
import { isMetaQuestion, handleMetaQuestion } from './engine/grace/gracefulAdjudication.js';
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
  // v25 — story arc data modules (imported by engine/story/registry.js)
  app.use('/content', express.static(path.join(__dirname, 'content')));

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

  // ── Conversational Tier B: the intent arbiter ─────────────────────────
  // POST { text, context } → { ok, steps: [string, ...] }
  // Splits ONE multi-action player input into 1-3 atomic commands the
  // deterministic engine can route ("I dive behind the bar and shoot the big
  // one" → ["take cover", "shoot the big one"]). Called rarely (the client
  // gates on a conjunction heuristic), answers from the env key only, and
  // NEVER throws to the caller — any failure returns ok:false and the client
  // falls back to submitting the original text untouched.
  app.post('/api/intent', async (req, res) => {
    try {
      const text = String(req.body?.text || '').trim().slice(0, 400);
      const ctx = req.body?.context || {};
      if (!text || !process.env.ANTHROPIC_API_KEY) return res.json({ ok: false, reason: 'unavailable' });

      const inCombat = Boolean(ctx.inCombat);
      const enemies = Array.isArray(ctx.enemies) ? ctx.enemies.map(String).slice(0, 6) : [];
      const verbs = Array.isArray(ctx.verbs) ? ctx.verbs.map(String).slice(0, 24) : [];
      const npcs = Array.isArray(ctx.npcs) ? ctx.npcs.map(String).slice(0, 6) : [];

      const system = [
        'You split a tabletop RPG player\'s typed input into sequential atomic commands for a deterministic game engine.',
        'Rules:',
        '- Return ONLY a JSON object: {"steps": ["...", "..."]}. 1 to 3 steps, each a short imperative in the player\'s own words where possible.',
        '- Preserve order. Do not invent actions the player did not state. Do not embellish.',
        '- If the input is a single action, return exactly one step (a light rewording toward a known verb is allowed).',
        '- Respect negation: an action the player refused must NOT appear as a step.',
        '- If the input is GENUINELY ambiguous (an unclear referent like "do the thing with the guy", or two readings with different consequences), do NOT guess: return {"clarify": "<one short pointed question, in a dry DM voice>"} instead of steps.',
        inCombat ? `- Combat is active. Known combat verbs: ${verbs.join(', ') || 'strike, ward, take cover, parley'}. Foes present: ${enemies.join(', ') || 'unknown'}.` : `- Out of combat. People present: ${npcs.join(', ') || 'none'}.`
      ].join('\n');

      const { chatCompletion } = await import('./server/llmProvider.js');
      const out = await chatCompletion({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text }
        ]
      });
      const raw = String(out?.content || '');
      const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      const parsed = JSON.parse(jsonText);
      // Tier C: a genuinely ambiguous input earns ONE pointed question
      // instead of a guess.
      const clarify = String(parsed?.clarify || '').trim().slice(0, 200);
      if (clarify) return res.json({ ok: true, clarify });
      const steps = Array.isArray(parsed?.steps)
        ? parsed.steps.map(s => String(s).trim()).filter(Boolean).slice(0, 3)
        : [];
      if (!steps.length) return res.json({ ok: false, reason: 'no_steps' });
      return res.json({ ok: true, steps });
    } catch (e) {
      return res.json({ ok: false, reason: String(e?.message || 'error').slice(0, 80) });
    }
  });

  // ── P6 — local NPC voice (Gemma/Ollama). The engine has already DECIDED
  // (share/deflect/lie); the local model only chooses the words in the NPC's
  // mouth. Free, local, silent fallback to the deterministic voice templates.
  // Swap models with LOCAL_LLM_MODEL=gemma3:12b (any Ollama tag).
  app.post('/api/npc-voice', async (req, res) => {
    try {
      const npcName = String(req.body?.npcName || '').slice(0, 60);
      const role = String(req.body?.role || '').slice(0, 40);
      const mood = String(req.body?.mood || '').slice(0, 30);
      const mode = String(req.body?.mode || '').slice(0, 20);
      const factPhrase = String(req.body?.factPhrase || '').slice(0, 120);
      const playerLine = String(req.body?.playerLine || '').slice(0, 200);
      if (!npcName || !mode) return res.json({ ok: false, reason: 'bad_request' });

      const DECISION = {
        shared: `You have decided to SHARE what you know about ${factPhrase || 'the topic'} — answer helpfully and concretely (invent small local color but no names of people or places).`,
        deflected: 'You have decided to DEFLECT — dodge the question without answering it, stay pleasant or gruff per your mood.',
        withheld: 'You have decided to WITHHOLD — refuse plainly; you know something but will not say. Do not reveal anything.',
        lied: 'You have decided to LIE — give a smooth false answer. Keep it vague; do not invent names.',
        recruited: 'You have decided to JOIN the player — accept and fall in.'
      }[mode];
      if (!DECISION) return res.json({ ok: false, reason: 'bad_mode' });

      const { queryLocal } = await import('./server/localLlmProvider.js');
      const prompt = [
        `You are ${npcName}, a ${role || 'villager'} in a low-fantasy village. Mood: ${mood || 'even'}.`,
        `The player said to you: "${playerLine}"`,
        DECISION,
        'Reply with EXACTLY ONE line of spoken dialogue (under 30 words), in plain speech, no stage directions, no names of specific people or places.'
      ].join('\n');
      const out = await queryLocal({ prompt, schema: { line: 'one spoken line' }, timeout: 9000 });
      if (!out?.ok) return res.json({ ok: false, reason: out?.reason || 'local_llm_unavailable' });

      // The fence: one line, bounded length, no narration leakage.
      let line = String(out.result?.line || '').split('\n')[0].trim()
        .replace(/^["'“]+|["'”]+$/g, '').trim();
      if (!line || line.length > 240) return res.json({ ok: false, reason: 'bad_line' });
      return res.json({ ok: true, line });
    } catch (e) {
      return res.json({ ok: false, reason: String(e?.message || 'error').slice(0, 60) });
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

  app.post('/api/move', requireAuth, (req, res) => {
    try {
      const worldId = String(req.body?.worldId || '').trim();
      const action = String(req.body?.action || '').trim();

      if (!isSafeId(worldId)) {
        return res.status(400).json({ ok: false, error: 'invalid_world_id' });
      }
      if (!action) {
        return res.status(400).json({ ok: false, error: 'missing_action' });
      }

      const currentState = loadWorld(req.user.username, worldId);
      if (!currentState) {
        return res.status(404).json({ ok: false, error: 'world_not_found' });
      }

      const packsById = getServerPacks();
      const safeWorld = ensureWorld(currentState);

      // Mirror the play UI (public/v1.js doSubmitMove): a meta-question
      // ("where am I?", "am I hurt?", "what happened?") is answered from world
      // state without consuming a turn or mutating anything. Everything else
      // resolves through playerMove (the full engine: combat, travel, dialogue).
      if (!safeWorld.combat?.active && isMetaQuestion(action)) {
        const answer = handleMetaQuestion(action, safeWorld);
        if (answer) {
          return res.json({ ok: true, worldId, state: safeWorld, output: { narration: answer, mechanics: '', type: 'meta' } });
        }
      }

      const { world: newState, output } = playerMove(safeWorld, packsById, action);
      saveWorld(req.user.username, worldId, newState);
      return res.json({ ok: true, worldId, state: newState, output });
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'server_error' });
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
