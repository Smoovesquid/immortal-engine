/**
 * Pass I2 — Stage 1: Structure extraction.
 *
 * Input:  raw prose text (string).
 * Output: structure manifest (JSON) — regions, factions, motifs, historical events.
 *
 * Uses the Anthropic Messages API directly (fetch-based). Throws on failure
 * because the importer is a build tool, not a runtime component.
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

const STRUCTURE_SCHEMA = `{
  "worldName": "string",
  "tone": ["string — e.g. 'grim', 'mythic', 'hopeful'"],
  "regions": [
    {
      "id": "string — kebab-case unique id",
      "name": "string — display name",
      "vibe": "string — one-sentence mood",
      "threatLevel": "number 1-5",
      "dominantFaction": "string — factionId or empty string",
      "adjacency": ["regionId"]
    }
  ],
  "factions": [
    {
      "id": "string — kebab-case unique id",
      "name": "string — display name",
      "goal": "string — one-sentence agenda",
      "personality": { "scarcity": "number 0-10", "curiosity": "number 0-10" }
    }
  ],
  "motifs": ["string — recurring images, symbols, or themes"],
  "historicalEvents": [
    {
      "id": "string — kebab-case unique id",
      "description": "string — one-sentence summary",
      "impact": "scar | thread | myth"
    }
  ]
}`;

const SYSTEM_PROMPT = `You are a world-building analyst. Extract the high-level structure of the world described in the user's prose. Identify regions, factions, cultures, major historical events, and motifs. Output ONLY valid JSON matching this schema — no markdown fences, no commentary:

${STRUCTURE_SCHEMA}

Rules:
- Every id must be unique and kebab-case.
- Regions must have at least one adjacency (except if there is only one region).
- Factions referenced by regions must appear in the factions array.
- If the prose doesn't mention factions, infer at least one from context.
- threatLevel is 1 (safe) to 5 (lethal).
- personality.scarcity and personality.curiosity are integers 0-10.
- impact must be exactly one of: scar, thread, myth.`;

/**
 * @param {string} prose — raw world-building text
 * @param {{ apiKey: string, model?: string, fetchImpl?: typeof fetch }} opts
 * @returns {Promise<object>} structure manifest
 */
export async function extractStructure(prose, { apiKey, model = DEFAULT_MODEL, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) throw new Error('Stage 1: apiKey is required');
  if (!prose || typeof prose !== 'string') throw new Error('Stage 1: prose must be a non-empty string');

  const res = await fetchImpl(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prose }]
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Stage 1: Anthropic API HTTP ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Stage 1: empty response from API');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Stage 1: failed to parse API response as JSON: ${e.message}`);
  }

  // Basic shape validation
  if (!parsed.worldName || typeof parsed.worldName !== 'string') {
    throw new Error('Stage 1: response missing worldName');
  }
  if (!Array.isArray(parsed.regions) || parsed.regions.length === 0) {
    throw new Error('Stage 1: response must contain at least one region');
  }
  if (!Array.isArray(parsed.factions) || parsed.factions.length === 0) {
    throw new Error('Stage 1: response must contain at least one faction');
  }

  return parsed;
}
