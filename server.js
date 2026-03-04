import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeOpenAiClient, hasOpenAiKey, handleAiRequest } from './server/ai.js';

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
