/**
 * Pass I2 — Stage 2: Entity expansion.
 *
 * Input:  structure manifest from Stage 1 + original prose.
 * Output: expanded entity set per region — places, NPCs, threads.
 *
 * Uses the Anthropic Messages API directly (fetch-based). Throws on failure.
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

const EXPANSION_SCHEMA = `[
  {
    "regionId": "string — must match a region id from the structure",
    "places": [
      {
        "id": "string — kebab-case unique id",
        "name": "string — display name",
        "nodeType": "settlement | wilderness | landmark",
        "description": "string — one-sentence description",
        "factionPresence": "string — factionId or empty string"
      }
    ],
    "npcs": [
      {
        "id": "string — kebab-case unique id",
        "name": "string — character name",
        "role": "string — e.g. blacksmith, scout, elder",
        "archetype": "string — e.g. reluctant hero, trickster",
        "factionId": "string — factionId or empty string",
        "hook": "string — one-sentence story hook",
        "traits": { "key": "value pairs for personality" }
      }
    ],
    "threads": [
      {
        "id": "string — kebab-case unique id",
        "name": "string — display name",
        "description": "string — one-sentence description",
        "nodeId": "string — placeId where thread is anchored"
      }
    ]
  }
]`;

function buildSystemPrompt(structure) {
  return `You are a world-building expander. Given a world structure and the original prose, generate detailed entities for each region. Output ONLY valid JSON matching this schema — no markdown fences, no commentary:

${EXPANSION_SCHEMA}

World structure for reference:
${JSON.stringify(structure, null, 2)}

Rules:
- Generate one entry per region in the structure.
- Each region gets 2-4 places, 3-6 NPCs, and 1-2 threads.
- Every id must be globally unique and kebab-case.
- nodeType must be exactly: settlement, wilderness, or landmark.
- factionPresence and factionId must reference factions from the structure (or empty string).
- thread nodeId must reference a place id from the same region.
- Ground everything in the prose; do not invent contradictory material.
- NPC names should feel consistent with the world's tone.`;
}

/**
 * @param {object} structure — structure manifest from Stage 1
 * @param {string} prose — original raw prose text
 * @param {{ apiKey: string, model?: string, fetchImpl?: typeof fetch }} opts
 * @returns {Promise<Array>} expanded entities per region
 */
export async function expandEntities(structure, prose, { apiKey, model = DEFAULT_MODEL, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) throw new Error('Stage 2: apiKey is required');
  if (!structure || !Array.isArray(structure.regions)) {
    throw new Error('Stage 2: structure must contain regions array');
  }

  const sysPrompt = buildSystemPrompt(structure);

  const res = await fetchImpl(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: sysPrompt,
      messages: [{ role: 'user', content: prose }]
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Stage 2: Anthropic API HTTP ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Stage 2: empty response from API');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Stage 2: failed to parse API response as JSON: ${e.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Stage 2: response must be an array');
  }

  // Validate no orphan faction refs
  const factionIds = new Set((structure.factions || []).map(f => f.id));
  for (const region of parsed) {
    if (!region.regionId) throw new Error('Stage 2: region entry missing regionId');
    for (const npc of (region.npcs || [])) {
      if (npc.factionId && !factionIds.has(npc.factionId)) {
        throw new Error(`Stage 2: NPC "${npc.id}" references unknown faction "${npc.factionId}"`);
      }
    }
    for (const place of (region.places || [])) {
      if (place.factionPresence && !factionIds.has(place.factionPresence)) {
        throw new Error(`Stage 2: place "${place.id}" references unknown faction "${place.factionPresence}"`);
      }
    }
    // Validate thread nodeId refs
    const placeIds = new Set((region.places || []).map(p => p.id));
    for (const thread of (region.threads || [])) {
      if (thread.nodeId && !placeIds.has(thread.nodeId)) {
        throw new Error(`Stage 2: thread "${thread.id}" references unknown nodeId "${thread.nodeId}"`);
      }
    }
  }

  return parsed;
}
