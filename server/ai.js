import OpenAI from 'openai';
import crypto from 'node:crypto';
import { validatePolish } from '../engine/ai/polishValidation.js';
import { parseConductJson } from '../engine/ai/conductContract.js';
import { appendAiTrace } from './aiTrace.js';

export function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY && String(process.env.OPENAI_API_KEY).trim());
}

export function makeOpenAiClient(opts = {}) {
  const runtimeKey = String(opts?.apiKey || "").trim();
  const envKey = String(process.env.OPENAI_API_KEY || "").trim();
  const key = envKey || runtimeKey;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export async function handleAiRequest({ client, body }) {
  const mode = String(body?.mode || '').toUpperCase();
  const seed = Number(body?.seed ?? 0);
  const composerLine = String(body?.composerLine || '').trim();
  const snapshot = body?.worldSnapshot && typeof body.worldSnapshot === 'object' ? body.worldSnapshot : null;
  const styleProfile = body?.styleProfile && typeof body.styleProfile === 'object' ? body.styleProfile : {};

  if (!client) return devFail('no_client');
  if (!composerLine && mode === 'POLISH') return devFail('missing_composerLine');

  const nouns = Array.isArray(snapshot?.nouns) ? snapshot.nouns.slice(0, 20) : [];
  const tags = Array.isArray(snapshot?.tags) ? snapshot.tags.slice(0, 20) : [];
  const motifs = Array.isArray(snapshot?.motifs) ? snapshot.motifs.slice(0, 20) : [];

  const voice = String(styleProfile.voice || 'plain');
  const verbosity = Number(styleProfile.verbosity ?? 0);
  const fate = Number(styleProfile.fate ?? 0.2);

  const sysCommon = `You are the AI Conductor for an offline-first deterministic dungeon master.\n- Do NOT add brackets.\n- Do NOT use \"actually\" or \"turns out\".\n- Never contradict canon facts.\n- Never introduce a new location.\n- Output must follow the mode contract strictly.`;

  let prompt = '';
  if (mode === 'POLISH') {
    prompt = `${sysCommon}\n\nMODE: POLISH\nReturn EXACTLY ONE sentence. No lists. No extra punctuation.\nVOICE:${voice}. VERBOSITY:${verbosity}. FATE:${fate}.\n\nCANON TOKENS (nouns/tags/motifs):\n- nouns: ${nouns.join(', ')}\n- tags: ${tags.join(', ')}\n- motifs: ${motifs.join(', ')}\n\nBASE LINE:\n${composerLine}`;
  } else if (mode === 'ADVISE') {
    prompt = `${sysCommon}\n\nMODE: ADVISE\nReturn STRICT JSON ONLY (no markdown): { \"suggestedIntent\": string, \"askForRoll\": {\"skill\": string, \"dc\": number, \"stakes\": string} | null }\n\nCONTEXT TOKENS:\n- nouns: ${nouns.join(', ')}\n- tags: ${tags.join(', ')}\n- motifs: ${motifs.join(', ')}\n\nBASE LINE:\n${composerLine}`;
  } else if (mode === 'CONDUCT') {
    prompt = `${sysCommon}\n\nMODE: CONDUCT\nReturn STRICT JSON ONLY (no markdown):\n{\n  \"narration\": \"ONE sentence\",\n  \"deltas\": {\n    \"addFact\": string|null,\n    \"addThreat\": string|null,\n    \"addQuestion\": string|null,\n    \"clock\": {\"dread\": -1|0|1, \"pressure\": -1|0|1, \"revelation\": -1|0|1}|null,\n    \"forceNextBeat\": boolean|null\n  }\n}\n\nCONTEXT TOKENS:\n- nouns: ${nouns.join(', ')}\n- tags: ${tags.join(', ')}\n- motifs: ${motifs.join(', ')}\n\nBASE LINE:\n${composerLine}`;
  } else {
    return devFail('unknown_mode');
  }

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const requestPayload = {
      model,
      input: prompt,
      metadata: { seed: String(seed), mode }
    };
    const requestHash = crypto.createHash('sha256').update(JSON.stringify(requestPayload)).digest('hex');

    const resp = await client.responses.create({
      model,
      input: prompt,
      metadata: { seed: String(seed), mode }
    });

    const text = String(resp.output_text || '').trim();

    const system_fingerprint = resp?.system_fingerprint ? String(resp.system_fingerprint) : null;
    if (mode === 'POLISH') {
      // server-side validation uses the provided snapshot as world proxy when possible
      const worldProxy = { ledger: { facts: [] }, scene: { location: '' }, meta: { seed: 'seed', fate } };
      const v = validatePolish({ world: worldProxy, composerLine, candidateText: text });
      if (!v.ok) {
        appendAiTrace({ requestHash, model, seed, mode, system_fingerprint, responseText: text, parsedProposal: null, validationResult: 'rejected', rejectionReason: `polish_validation:${v.reason || 'invalid'}` });
        return devFail(`polish_validation:${v.reason || 'invalid'}`);
      }
      appendAiTrace({ requestHash, model, seed, mode, system_fingerprint, responseText: text, parsedProposal: null, validationResult: 'accepted', rejectionReason: null });
      return { ok: true, text: v.text };
    }

    if (mode === 'ADVISE') {
      const obj = parseJsonLenient(text);
      if (!obj || typeof obj !== 'object') {
        appendAiTrace({ requestHash, model, seed, mode, system_fingerprint, responseText: text, parsedProposal: null, validationResult: 'rejected', rejectionReason: 'advise_parse_failed' });
        return { ok: false };
      }
      appendAiTrace({ requestHash, model, seed, mode, system_fingerprint, responseText: text, parsedProposal: obj, validationResult: 'accepted', rejectionReason: null });
      return { ok: true, text: JSON.stringify(obj), json: obj };
    }

    if (mode === 'CONDUCT') {
      // Model sometimes wraps JSON; be lenient in extraction, strict in contract.
      const extracted = extractJsonObject(text);
      const parsed = parseConductJson(extracted || text);
      if (!parsed.ok) {
        appendAiTrace({ requestHash, model, seed, mode, system_fingerprint, responseText: text, parsedProposal: null, validationResult: 'rejected', rejectionReason: `conduct_contract:${parsed.reason || 'invalid'}` });
        return devFail(`conduct_contract:${parsed.reason || 'invalid'}`);
      }
      appendAiTrace({ requestHash, model, seed, mode, system_fingerprint, responseText: text, parsedProposal: parsed.value, validationResult: 'accepted', rejectionReason: null });
      return { ok: true, text: JSON.stringify(parsed.value), json: parsed.value };
    }

    return { ok: false };
  } catch (e) {
    // Dev-only visibility. Never include key.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ai] request failed', String(e?.message || e));
    }
    return devFail(`request_failed:${String(e?.message || e)}`);
  }
}

function devFail(reason) {
  const r = String(reason || 'fail');
  if (process.env.NODE_ENV === 'production') return { ok: false };
  return { ok: false, reason: r };
}

function parseJsonLenient(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {}
  const extracted = extractJsonObject(raw);
  if (!extracted) return null;
  try { return JSON.parse(extracted); } catch { return null; }
}

function extractJsonObject(text) {
  const s = String(text || '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1 || b <= a) return '';
  const chunk = s.slice(a, b + 1).trim();
  // quick sanity: must start/end with braces.
  if (!chunk.startsWith('{') || !chunk.endsWith('}')) return '';
  return chunk;
}
