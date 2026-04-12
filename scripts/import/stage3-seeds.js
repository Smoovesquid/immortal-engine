/**
 * Pass I2 — Stage 3: Latent seed generation.
 *
 * Input:  expanded entity set from Stage 2 + structure manifest from Stage 1.
 * Output: full latent seed catalog.
 *
 * Uses the Anthropic Messages API directly (fetch-based). Throws on failure.
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

const SEED_SCHEMA = `[
  {
    "id": "string — kebab-case unique id for this seed",
    "targetId": "string — the id of the place, NPC, or event this seed belongs to",
    "targetType": "place | npc | event",
    "publicTags": ["string — discoverable tags"],
    "privateTruth": "string — the hidden truth behind this entity",
    "garblingHints": {
      "nameVariants": ["string — alternate/corrupted names for rumor propagation"],
      "detailGarble": "string — how details might be distorted in rumors"
    },
    "toneWords": ["string — mood words for this seed"],
    "tier0Body": "string — the tier-0 rumor text (most garbled, first heard)"
  }
]`;

function buildSystemPrompt(structure) {
  return `You are a latent-seed generator for a tabletop RPG engine. For each place, NPC, and historical event, generate a latent seed — a structured content fragment used by the rumor propagation system. Output ONLY valid JSON matching this schema — no markdown fences, no commentary:

${SEED_SCHEMA}

World structure for reference:
${JSON.stringify(structure, null, 2)}

Rules:
- Generate exactly one seed per place, one per NPC, and one per historical event.
- Every seed id must be globally unique and kebab-case (use "seed-" prefix + targetId).
- targetId must exactly match an existing place id, NPC id, or event id.
- targetType must be exactly: place, npc, or event.
- publicTags: 2-4 discoverable tags per seed.
- privateTruth: one sentence revealing the hidden truth.
- garblingHints.nameVariants: 1-3 alternate/corrupted names.
- garblingHints.detailGarble: one sentence describing how details get distorted.
- toneWords: 2-3 mood words.
- tier0Body: one sentence — the most garbled version of this rumor (what players first hear).`;
}

/**
 * Collect all target IDs that need seeds from the expanded entities and structure.
 */
function collectTargets(entities, structure) {
  const targets = [];

  for (const region of entities) {
    for (const place of (region.places || [])) {
      targets.push({ id: place.id, type: 'place' });
    }
    for (const npc of (region.npcs || [])) {
      targets.push({ id: npc.id, type: 'npc' });
    }
  }

  for (const event of (structure.historicalEvents || [])) {
    targets.push({ id: event.id, type: 'event' });
  }

  return targets;
}

/**
 * @param {Array} entities — expanded entity set from Stage 2
 * @param {object} structure — structure manifest from Stage 1
 * @param {{ apiKey: string, model?: string, fetchImpl?: typeof fetch }} opts
 * @returns {Promise<Array>} seed catalog
 */
export async function generateSeeds(entities, structure, { apiKey, model = DEFAULT_MODEL, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) throw new Error('Stage 3: apiKey is required');
  if (!Array.isArray(entities)) {
    throw new Error('Stage 3: entities must be an array');
  }

  const targets = collectTargets(entities, structure);
  const sysPrompt = buildSystemPrompt(structure);

  // Build user message with the expanded entities
  const userContent = `Expanded entities:\n${JSON.stringify(entities, null, 2)}\n\nGenerate one latent seed for each of the ${targets.length} targets (${targets.map(t => t.id).join(', ')}).`;

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
      messages: [{ role: 'user', content: userContent }]
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Stage 3: Anthropic API HTTP ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Stage 3: empty response from API');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Stage 3: failed to parse API response as JSON: ${e.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Stage 3: response must be an array');
  }

  // Validate seed coverage — every target must have a seed
  const targetIds = new Set(targets.map(t => t.id));
  const seedTargetIds = new Set(parsed.map(s => s.targetId));
  for (const t of targets) {
    if (!seedTargetIds.has(t.id)) {
      throw new Error(`Stage 3: missing seed for ${t.type} "${t.id}"`);
    }
  }

  // Validate no dangling targetId refs
  for (const seed of parsed) {
    if (!targetIds.has(seed.targetId)) {
      throw new Error(`Stage 3: seed "${seed.id}" references unknown target "${seed.targetId}"`);
    }
  }

  return parsed;
}

export { collectTargets };
