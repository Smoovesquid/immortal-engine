// LLM Provider abstraction — supports Anthropic (Claude), OpenAI, and local (Ollama).
// Detects which API key is available and routes accordingly.
// All engine modules call chatCompletion() and don't care which provider is active.
// Local LLM is a separate channel (NPC brain, rumor garble, physics detect) — not a cloud replacement.

import { queryLocal, checkHealth, isAvailable } from './localLlmProvider.js';

const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';

export function detectProvider() {
  const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  // Anthropic takes priority if both are set
  if (anthropicKey) return 'anthropic';
  if (openaiKey) return 'openai';
  return null;
}

export function hasLlmKey() {
  return detectProvider() !== null;
}

export function getLlmApiKey() {
  const provider = detectProvider();
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY.trim();
  if (provider === 'openai') return process.env.OPENAI_API_KEY.trim();
  return '';
}

export function getDefaultModel() {
  const override = (process.env.LLM_MODEL || process.env.OPENAI_MODEL || '').trim();
  if (override) return override;
  const provider = detectProvider();
  if (provider === 'anthropic') return ANTHROPIC_DEFAULT_MODEL;
  return OPENAI_DEFAULT_MODEL;
}

/**
 * Unified chat completion. Accepts OpenAI-style messages and routes to the active provider.
 *
 * @param {Object} opts
 * @param {Array<{role: string, content: string}>} opts.messages - OpenAI-style messages array
 * @param {string} [opts.model] - Model override
 * @param {number} [opts.temperature=0.2] - Temperature
 * @param {number} [opts.max_tokens] - Max tokens (Anthropic requires this)
 * @param {Function} [opts.fetchImpl] - Custom fetch (for testing)
 * @returns {Promise<{content: string}>} - The assistant's response text
 */
export async function chatCompletion({
  messages,
  model,
  temperature = 0.2,
  max_tokens,
  fetchImpl = globalThis.fetch
} = {}) {
  const provider = detectProvider();
  const apiKey = getLlmApiKey();
  const resolvedModel = model || getDefaultModel();

  if (!provider || !apiKey) {
    throw new Error('No LLM API key configured');
  }

  if (provider === 'anthropic') {
    return callAnthropic({ messages, model: resolvedModel, temperature, max_tokens, apiKey, fetchImpl });
  }
  return callOpenAI({ messages, model: resolvedModel, temperature, max_tokens, apiKey, fetchImpl });
}

async function callAnthropic({ messages, model, temperature, max_tokens, apiKey, fetchImpl }) {
  // Extract system message from the messages array (Anthropic uses a separate system param)
  let systemText = '';
  const userMessages = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n\n' : '') + msg.content;
    } else {
      userMessages.push({ role: msg.role, content: msg.content });
    }
  }

  const body = {
    model,
    messages: userMessages,
    temperature,
    max_tokens: max_tokens || 1024
  };
  if (systemText) {
    body.system = [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }];
  }

  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta':    'prompt-caching-2024-07-31'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.content?.[0]?.text || '';
  return { content };
}

async function callOpenAI({ messages, model, temperature, max_tokens, apiKey, fetchImpl }) {
  const body = {
    model,
    messages,
    temperature
  };
  if (max_tokens) body.max_tokens = max_tokens;

  const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  return { content };
}

// --- Local LLM (Ollama) routing ---

export { checkHealth as checkLocalHealth };

export function hasLocalLlm() {
  return isAvailable();
}

export async function queryLocalLlm(opts) {
  return queryLocal(opts);
}
