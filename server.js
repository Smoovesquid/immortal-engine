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

  app.use(express.json({ limit: '256kb' }));

  // Static mounts
  app.use('/', express.static(path.join(__dirname, 'public')));
  app.use('/engine', express.static(path.join(__dirname, 'engine')));
  app.use('/packs', express.static(path.join(__dirname, 'packs')));

  app.get('/healthz', (_req, res) => res.type('text').send('ok'));

  app.get('/api/ai-status', (_req, res) => {
    const online = hasOpenAiKey() || Boolean(sessionOpenAiKey && String(sessionOpenAiKey).trim());
    res.json({ ok: true, online });
  });

  app.post('/api/ai-key', (req, res) => {
    const apiKey = String(req?.body?.apiKey || '').trim();
    if (!apiKey) {
      sessionOpenAiKey = null;
      return res.json({ ok: true, online: hasOpenAiKey() });
    }
    sessionOpenAiKey = apiKey;
    return res.json({ ok: true, online: true });
  });

  app.post('/api/ai', async (req, res) => {
    const client = makeOpenAiClient({ apiKey: sessionOpenAiKey });
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
