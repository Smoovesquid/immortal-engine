// LLM Texture Pass — optional, online-only.
// Census-taker mode: LLM reports what exists, doesn't editorialize.
// Partial acceptance: keep valid textures, template-fill the rest.

const BANNED_WORDS = /\b(mysterious|ancient|legendary|prophesied|chosen|destined|enigmatic|ethereal|arcane|eldritch|ominous|foreboding)\b/i;
const MAX_NAME_LENGTH = 30;

function buildPrompt(settlement, history, pack) {
  const packName = pack?.name || 'unknown';
  const historyDesc = history
    .slice(0, 10)
    .map(h => `Era ${h.era}: ${h.eventId}`)
    .join('\n');

  return {
    system: `You are a census taker surveying a settlement in a ${packName} setting. You have been given the settlement's history and current state. Your job is to fill in names, physical descriptions, and one factual detail per entity. You are recording what EXISTS, not what MATTERS.

Rules:
- Plain names. "Marta" not "Marta the Wise." "Oak Street Smithy" not "The Forge of Echoes."
- Physical descriptions only. What you can see, hear, smell. No inner thoughts, no motivations, no foreshadowing.
- One factual detail per NPC that connects to their origin event. If they descend from the town founder, note that. If they survived the plague, note the scars. Do not invent connections that aren't in the history.
- Secrets are things you WOULDN'T know from looking. Don't hint at them in descriptions.
- No dramatic language. No "ancient" unless it's literally old. No "mysterious" ever.
- Respond with JSON only. No markdown, no explanation.`,
    user: `Settlement history:
${historyDesc}

Current NPCs (need names + descriptions):
${JSON.stringify(settlement.npcs.map((n, i) => ({ index: i, role: n.role, factionId: n.factionId, disposition: n.disposition })))}

Current buildings (need names + descriptions):
${JSON.stringify(settlement.buildings.map((b, i) => ({ index: i, type: b.name, state: b.state })))}

Respond with JSON matching this schema:
{
  "npcs": [{ "index": number, "name": string, "description": string, "factualDetail": string, "groundedIn": number|null }],
  "buildings": [{ "index": number, "name": string, "description": string }],
  "sensory": string
}`
  };
}

function validateNpcTexture(tex, history) {
  if (!tex || typeof tex !== 'object') return false;
  if (typeof tex.name !== 'string' || tex.name.length > MAX_NAME_LENGTH || tex.name.length === 0) return false;
  if (BANNED_WORDS.test(tex.name) || BANNED_WORDS.test(tex.description || '')) return false;
  // Grounding validation: if groundedIn points to a non-existent tick, reject
  if (tex.groundedIn != null) {
    const maxEra = history.length ? Math.max(...history.map(h => h.era)) : -1;
    if (typeof tex.groundedIn !== 'number' || tex.groundedIn < 0 || tex.groundedIn > maxEra) return false;
  }
  return true;
}

function validateBuildingTexture(tex) {
  if (!tex || typeof tex !== 'object') return false;
  if (typeof tex.name !== 'string' || tex.name.length > MAX_NAME_LENGTH || tex.name.length === 0) return false;
  if (BANNED_WORDS.test(tex.name) || BANNED_WORDS.test(tex.description || '')) return false;
  return true;
}

function templateFillNpc(npc) {
  return { name: `the ${npc.role}`, description: '', factualDetail: '' };
}

function templateFillBuilding(building) {
  return { name: building.name, description: '' };
}

export async function texturize(settlement, history, pack, {
  enabled = false,
  apiKey = '',
  endpoint = 'https://api.openai.com/v1/chat/completions',
  model = 'gpt-4o-mini',
  fetchImpl = globalThis.fetch,
  chatCompletionFn = null
} = {}) {
  // Offline fallback: return skeleton with placeholder names
  const hasLlm = chatCompletionFn || (apiKey && typeof fetchImpl === 'function');
  if (!enabled || !hasLlm) {
    return {
      ...settlement,
      npcs: settlement.npcs.map(n => ({ ...n, ...templateFillNpc(n) })),
      buildings: settlement.buildings.map(b => ({ ...b, ...templateFillBuilding(b) })),
      sensory: '',
      textured: false
    };
  }

  const prompt = buildPrompt(settlement, history, pack);

  let parsed;
  try {
    const messages = [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ];

    let content;
    if (chatCompletionFn) {
      const result = await chatCompletionFn({ messages, model, temperature: 0.7, max_tokens: 1500 });
      content = result.content || '';
    } else {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1500 })
      });
      const json = await res.json();
      content = json?.choices?.[0]?.message?.content || '';
    }
    parsed = JSON.parse(content);
  } catch {
    // LLM failed, use template fallback
    return {
      ...settlement,
      npcs: settlement.npcs.map(n => ({ ...n, ...templateFillNpc(n) })),
      buildings: settlement.buildings.map(b => ({ ...b, ...templateFillBuilding(b) })),
      sensory: '',
      textured: false
    };
  }

  // Partial acceptance: validate each texture individually
  const texturedNpcs = settlement.npcs.map((npc, i) => {
    const tex = Array.isArray(parsed.npcs) ? parsed.npcs.find(t => t.index === i) : null;
    if (tex && validateNpcTexture(tex, history)) {
      return { ...npc, name: tex.name, description: tex.description || '', factualDetail: tex.factualDetail || '' };
    }
    return { ...npc, ...templateFillNpc(npc) };
  });

  const texturedBuildings = settlement.buildings.map((building, i) => {
    const tex = Array.isArray(parsed.buildings) ? parsed.buildings.find(t => t.index === i) : null;
    if (tex && validateBuildingTexture(tex)) {
      return { ...building, name: tex.name, description: tex.description || '' };
    }
    return { ...building, ...templateFillBuilding(building) };
  });

  return {
    ...settlement,
    npcs: texturedNpcs,
    buildings: texturedBuildings,
    sensory: typeof parsed.sensory === 'string' ? parsed.sensory.slice(0, 200) : '',
    textured: true
  };
}
