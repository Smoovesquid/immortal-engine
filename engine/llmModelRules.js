// Central source of truth for per-model Anthropic API quirks.
// All four Anthropic call sites (callLLM, callNpcVoice, callDM in llmAdapter.js;
// callAnthropic in server/llmProvider.js) consult these predicates so the rules
// live in one place instead of scattered comments or silent omissions.

// The Opus 4.x family rejects the `temperature` sampling parameter (HTTP 400
// "temperature is deprecated for this model"). Match by prefix so future
// Opus-4 variants are covered automatically without a list update.
const REJECTS_TEMPERATURE_PREFIX = 'claude-opus-4';

export function modelRejectsTemperature(model) {
  return String(model || '').startsWith(REJECTS_TEMPERATURE_PREFIX);
}

// Returns the sampling fields to spread into an Anthropic request body.
// Omits `temperature` entirely for models that reject it; includes it for all others.
// Usage: JSON.stringify({ model, max_tokens, ...anthropicSamplingFields(model, temp), ... })
export function anthropicSamplingFields(model, temperature) {
  return modelRejectsTemperature(model) ? {} : { temperature };
}
