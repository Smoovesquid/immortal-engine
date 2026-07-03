// Local LLM provider — Ollama client with silent fallback.
// Never throws. Returns { ok: false } on any failure.
// Used by NPC brain, rumor garble, physics detect — NOT a cloud replacement.

const DEFAULT_ENDPOINT = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.1:8b';
const DEFAULT_TIMEOUT = 3000;

let _available = null; // null = not checked, true/false after check

function getEndpoint() {
  return (process.env.LOCAL_LLM_ENDPOINT || '').trim() || DEFAULT_ENDPOINT;
}

function getModel() {
  return (process.env.LOCAL_LLM_MODEL || '').trim() || DEFAULT_MODEL;
}

function getContextWindow() {
  const envVal = (process.env.LOCAL_LLM_CONTEXT || '').trim();
  if (envVal) {
    const n = parseInt(envVal, 10);
    if (Number.isFinite(n) && n >= 512 && n <= 32768) return n;
  }
  return 4096;
}

// How long Ollama keeps the model resident after a call. Without this it unloads
// on the default idle timeout, so the next conversation cold-loads (10–30s) and
// blows the request timeout. '30m' keeps it warm across a play session.
function getKeepAlive() {
  return (process.env.LOCAL_LLM_KEEP_ALIVE || '').trim() || '30m';
}

export async function checkHealth(fetchImpl = globalThis.fetch) {
  try {
    const endpoint = getEndpoint();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetchImpl(`${endpoint}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      _available = false;
      return false;
    }
    const data = await res.json();
    const models = data?.models || [];
    _available = models.length > 0;
    if (_available) {
      const model = models[0];
      console.log(`Local LLM available: ${model.name} (${formatSize(model.size)})`);
    }
    return _available;
  } catch {
    _available = false;
    console.log('Local LLM not available \u2014 using rule-based fallback for NPC decisions');
    return false;
  }
}

export function isAvailable() {
  return _available === true;
}

export async function queryLocal({ prompt, schema, model, timeout, maxTokens, temperature, fetchImpl } = {}) {
  const resolvedModel = model || getModel();
  const resolvedTimeout = timeout ?? DEFAULT_TIMEOUT;
  const endpoint = getEndpoint();
  const resolvedFetch = fetchImpl || globalThis.fetch;

  // If we already know it's unavailable, short-circuit
  if (_available === false) {
    return { ok: false, reason: 'unavailable' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), resolvedTimeout);

  try {
    const schemaHint = schema ? `\nReply as JSON matching this schema: ${JSON.stringify(schema)}` : '';
    const fullPrompt = prompt + schemaHint;

    const res = await resolvedFetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: resolvedModel,
        prompt: fullPrompt,
        format: 'json',
        stream: false,
        keep_alive: getKeepAlive(),
        options: {
          num_ctx: getContextWindow(),
          // Cap the reply length when the caller knows the output is short (e.g. a
          // one-line NPC voice). Bounds the generation tail — the slow part — so a
          // warm call lands well under the timeout. Omitted → Ollama's default.
          ...(Number.isFinite(maxTokens) && maxTokens > 0 ? { num_predict: Math.trunc(maxTokens) } : {}),
          // INT-2R — a literal-translation task (intent parsing) wants greedy,
          // repeatable output, not creative sampling. Opt-in only: every other
          // caller (NPC brain/rumor garble/physics-detect) omits this and keeps
          // Ollama's own default temperature, unchanged.
          ...(Number.isFinite(temperature) ? { temperature } : {})
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      return { ok: false, reason: 'unavailable' };
    }

    const data = await res.json();
    const raw = data?.response || '';

    try {
      const parsed = JSON.parse(raw);
      return { ok: true, result: parsed };
    } catch {
      return { ok: false, reason: 'parse_error' };
    }
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'unavailable' };
  }
}

// Proactively load the model into memory (and pin it via keep_alive) so the first
// real conversation isn't a cold-load timeout. Fire-and-forget; never throws.
export async function warmModel(fetchImpl = globalThis.fetch) {
  try {
    const endpoint = getEndpoint();
    await fetchImpl(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: getModel(), prompt: 'ok', stream: false, keep_alive: getKeepAlive(), options: { num_predict: 1 } })
    });
    return true;
  } catch {
    return false;
  }
}

function formatSize(bytes) {
  if (!bytes) return '?';
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)}GB` : `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

// Allow tests to reset state
export function _resetForTest() {
  _available = null;
}
