// LLM Physics Module — physical interaction detection, LLM evaluation, validation, offline fallback.
// The engine owns state. The LLM owns common sense.
// Census-taker mode: flat, literal physics. No drama. No Chekhov's guns.

import { clampInt } from './util.js';
import { ensureWorld } from './state.js';
import { ensureMap } from './map/mapState.js';
import { objectsHere } from './structures/roomObjects.js';
import { resolveBreakRuling, resolveFireRuling, resolveCoverRuling } from './rulings/index.js';

// Banned words in LLM-generated notes (Heartbreak Principle: no dramatic editorializing).
const BANNED_WORDS = [
  'fortunately', 'luckily', 'unfortunately', 'miraculously',
  'but you notice', 'however you', 'turns out', 'actually',
  'suddenly', 'magically', 'mysteriously'
];

const BANNED_RE = new RegExp('\\b(' + BANNED_WORDS.join('|').replace(/\s+/g, '\\s+') + ')\\b', 'i');

// --- Detection ---

export function detectPhysicalInteraction(world, playerText) {
  const w = ensureWorld(world);
  const m = ensureMap(w.map);
  const here = m.nodes.find(n => n.id === m.currentNodeId);
  if (!here) return { detected: false, matches: [] };

  const text = String(playerText || '').toLowerCase();
  if (!text) return { detected: false, matches: [] };

  const matches = [];

  // Check furniture names, parts, and notes present here. Room-scoped when the
  // player stands in a multi-room interior (roomObjects, WB-Q5); `i` stays the
  // NODE index so the modify/removeFurniture ops keep their keys.
  for (const { piece: f, nodeIndex: i } of objectsHere(w)) {
    if (!f) continue;
    const name = String(f.name || '').toLowerCase();
    // Match the full name ("wooden table") OR the head noun ("table")
    // so natural phrases like "examine the table" hit "wooden table".
    const headNoun = (name.split(/\s+/).pop() || '').replace(/[^a-z0-9-]/g, '');
    const headHit = headNoun.length >= 3 && new RegExp(`\\b${headNoun}\\b`).test(text);
    if (name && (text.includes(name) || headHit)) {
      matches.push({ type: 'furniture', index: i, name: f.name, match: 'name' });
      continue;
    }
    // Check parts
    const parts = Array.isArray(f.parts) ? f.parts : [];
    for (const part of parts) {
      const p = String(part).toLowerCase();
      if (p && text.includes(p)) {
        matches.push({ type: 'furniture', index: i, name: f.name, match: 'part', part });
        break;
      }
    }
    // Check notes
    const notes = String(f.notes || '').toLowerCase();
    if (notes && notes.length > 2) {
      const noteWords = notes.split(/\s+/).filter(w => w.length > 3);
      for (const nw of noteWords) {
        if (text.includes(nw)) {
          matches.push({ type: 'furniture', index: i, name: f.name, match: 'notes' });
          break;
        }
      }
    }
  }

  // Check inventory items at current party member
  const party = Array.isArray(w.party) ? w.party : [];
  if (party.length > 0) {
    const actor = party[0];
    const inv = actor.inventory && typeof actor.inventory === 'object' ? actor.inventory : {};
    for (const bucket of Object.keys(inv)) {
      const items = Array.isArray(inv[bucket]) ? inv[bucket] : [];
      for (const item of items) {
        const itemName = String(item?.name || '').toLowerCase();
        if (itemName && text.includes(itemName)) {
          matches.push({ type: 'item', bucket, name: item.name, match: 'name' });
        }
      }
    }
  }

  return { detected: matches.length > 0, matches };
}

// --- LLM Call ---

const PHYSICS_SYSTEM_PROMPT = `You are a physics simulator for a tabletop dungeon crawler. Census-taker mode.
Rules:
- A wooden table is a wooden table. No dramatic language. No Chekhov's guns.
- Describe physical outcomes literally and flatly.
- Return STRICT JSON ONLY (no markdown, no commentary).
- Never use: fortunately, luckily, unfortunately, miraculously, suddenly, magically, mysteriously, "but you notice", "however you", "turns out", "actually".
- Never propose alternative outcomes the engine didn't generate.
- The world disappoints. That is what makes it real.

Return format:
{
  "plausible": true/false,
  "result": "flat physical description of what happens",
  "deltas": [
    { "op": "modifyFurniture", "nodeId": "...", "furnitureId": 0, "changes": { "state": "damaged", "parts": [...remaining], "notes": "..." } },
    { "op": "createItem", "entityId": "...", "bucket": "junk", "item": { "name": "...", "tags": [...], "weight": 1, "noise": 0, "light": 0, "bulk": 1, "notes": "..." } },
    { "op": "removeFurniture", "nodeId": "...", "furnitureId": 0 },
    { "op": "removeItem", "entityId": "...", "bucket": "...", "itemName": "..." }
  ]
}

Only include deltas for physical changes that logically follow from the action.
weight/noise/light/bulk must be integers 0-5.`;

// --- Local LLM Classification (Pass P1) ---

const VALID_DIFFICULTIES = new Set(['trivial', 'easy', 'medium', 'hard', 'impossible']);
const VALID_STATS = new Set(['MIGHT', 'AGILITY', 'WITS', 'GRIT', 'CHARM']);

/**
 * classifyPhysicsLocal({ world, playerText, detection, queryLocalFn }) → classification | null
 *
 * Asks the local model for a plausibility classification.
 * Returns { possible, difficulty, stat } or null on failure.
 * Never throws.
 */
async function classifyPhysicsLocal({ world, playerText, detection, queryLocalFn }) {
  if (typeof queryLocalFn !== 'function') return null;

  const party = Array.isArray(world.party) ? world.party : [];
  const player = party[0] || {};
  const stats = player.stats || {};
  const sceneTags = Array.isArray(world.scene?.tags) ? world.scene.tags.join(', ') : '';

  // Build relevant equipment context
  const inv = player.inventory || {};
  const equipped = Array.isArray(inv.items)
    ? inv.items.filter(i => i.equipped).map(i => i.defRef || i.id).join(', ')
    : '';

  const targetName = detection.matches[0]?.name || 'the environment';

  const prompt = `The player wants to: "${playerText}"
Target: ${targetName}
Environment: ${sceneTags || 'dungeon'}
Player stats: MIGHT ${stats.MIGHT ?? 10}, AGILITY ${stats.AGILITY ?? 10}, WITS ${stats.WITS ?? 10}, GRIT ${stats.GRIT ?? 10}, CHARM ${stats.CHARM ?? 10}
Equipment: ${equipped || 'basic gear'}

Is this physically possible? Reply as JSON:
{ "possible": true/false, "difficulty": "trivial"|"easy"|"medium"|"hard"|"impossible", "stat": "MIGHT"|"AGILITY"|"WITS"|"GRIT"|"CHARM" }`;

  try {
    const resp = await queryLocalFn({
      prompt,
      schema: { possible: 'boolean', difficulty: 'string', stat: 'string' },
      timeout: 2000
    });

    if (!resp || !resp.ok || !resp.result) return null;

    const r = resp.result;
    if (typeof r.possible !== 'boolean') return null;

    return {
      possible: r.possible,
      difficulty: VALID_DIFFICULTIES.has(r.difficulty) ? r.difficulty : 'medium',
      stat: VALID_STATS.has(r.stat) ? r.stat : 'MIGHT'
    };
  } catch {
    return null;
  }
}

export async function evaluatePhysics({
  world,
  playerText,
  pack,
  apiKey = '',
  endpoint = 'https://api.openai.com/v1/chat/completions',
  model = 'gpt-4o-mini',
  fetchImpl = globalThis.fetch,
  chatCompletionFn = null,
  queryLocalFn = null
} = {}) {
  const w = ensureWorld(world);
  const detection = detectPhysicalInteraction(w, playerText);

  if (!detection.detected) {
    return { plausible: false, deltas: [], description: '', fallbackUsed: false };
  }

  // Pass P1 — try local LLM classification first
  let localClass = null;
  if (queryLocalFn) {
    localClass = await classifyPhysicsLocal({ world: w, playerText, detection, queryLocalFn });
    if (localClass && (!localClass.possible || localClass.difficulty === 'impossible')) {
      return {
        plausible: false,
        deltas: [],
        description: '',
        fallbackUsed: false,
        classification: localClass
      };
    }
  }

  // Try LLM if available (provider-agnostic path or legacy OpenAI path)
  const hasLlm = chatCompletionFn || (apiKey && typeof fetchImpl === 'function');
  if (hasLlm) {
    try {
      const result = await callPhysicsLLM({ world: w, playerText, detection, apiKey, endpoint, model, fetchImpl, chatCompletionFn });
      if (result) {
        result.classification = localClass || null;
        return result;
      }
    } catch {
      // Fall through to offline fallback
    }
  }

  // Offline fallback: approach-based outcome with real deltas
  const fallbackResult = offlineFallback(w, playerText, detection);
  fallbackResult.classification = localClass || null;
  return fallbackResult;
}

async function callPhysicsLLM({ world, playerText, detection, apiKey, endpoint, model, fetchImpl, chatCompletionFn }) {
  const m = ensureMap(world.map);
  const here = m.nodes.find(n => n.id === m.currentNodeId);
  if (!here) return null;

  const scoped = objectsHere(world); // room-scoped; furnitureId stays the node index
  const party = Array.isArray(world.party) ? world.party : [];
  const actorId = party[0]?.id || 'party';
  const inventory = party[0]?.inventory || {};

  const userPayload = {
    nodeId: here.id,
    nodeName: here.name,
    furniture: scoped.map(({ piece, nodeIndex }) => ({ ...piece, furnitureId: nodeIndex })),
    actorId,
    inventory,
    playerText,
    matches: detection.matches
  };

  const messages = [
    { role: 'system', content: PHYSICS_SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(userPayload) }
  ];

  let text;
  if (chatCompletionFn) {
    // Provider-agnostic path (Anthropic or OpenAI via server provider)
    const result = await chatCompletionFn({ messages, model, temperature: 0.1 });
    text = String(result.content ?? '');
  } else {
    // Legacy direct-fetch path (OpenAI only)
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, temperature: 0.1 })
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = await res.json();
    text = String(data?.choices?.[0]?.message?.content ?? '');
  }

  const parsed = extractAndParseJson(text);
  if (!parsed) return null;

  const deltas = Array.isArray(parsed.deltas) ? parsed.deltas : [];
  const validated = validateDeltas(deltas, world);

  if (!validated.ok) {
    return null; // All-or-nothing: reject entire batch
  }

  return {
    plausible: Boolean(parsed.plausible),
    deltas: validated.deltas,
    description: String(parsed.result || '').trim(),
    fallbackUsed: false
  };
}

// Synchronous evaluator: skips the LLM and runs the offline fallback only.
// Used by the deterministic playloop where async physics would force the
// whole loop to become async.
export function evaluatePhysicsSync(world, playerText) {
  const w = ensureWorld(world);
  const detection = detectPhysicalInteraction(w, playerText);
  if (!detection.detected) {
    return { plausible: false, deltas: [], description: '', fallbackUsed: false };
  }
  return offlineFallback(w, playerText, detection);
}

// --- Validation ---

export function validateDeltas(deltas, world) {
  const ops = Array.isArray(deltas) ? deltas : [];
  if (!ops.length) return { ok: true, deltas: [] };

  const w = ensureWorld(world);
  const m = ensureMap(w.map);
  const validated = [];

  for (const op of ops) {
    if (!op || typeof op !== 'object') return { ok: false, reason: 'invalid op' };
    const kind = String(op.op || '');

    if (kind === 'createItem') {
      const item = op.item;
      if (!item || !item.name) return { ok: false, reason: 'createItem missing name' };
      if (typeof item.weight === 'number' && (item.weight < 0 || item.weight > 5)) return { ok: false, reason: 'weight out of range' };
      if (typeof item.noise === 'number' && (item.noise < 0 || item.noise > 5)) return { ok: false, reason: 'noise out of range' };
      if (typeof item.light === 'number' && (item.light < 0 || item.light > 5)) return { ok: false, reason: 'light out of range' };
      if (typeof item.bulk === 'number' && (item.bulk < 0 || item.bulk > 5)) return { ok: false, reason: 'bulk out of range' };
      const notes = String(item.notes || '');
      if (BANNED_RE.test(notes)) return { ok: false, reason: 'banned word in notes' };
      validated.push(op);
      continue;
    }

    if (kind === 'removeItem') {
      const entityId = String(op.entityId || '');
      const bucket = String(op.bucket || '');
      const itemName = String(op.itemName || '');
      if (!entityId || !bucket || !itemName) return { ok: false, reason: 'removeItem missing fields' };
      const party = Array.isArray(w.party) ? w.party : [];
      const entity = party.find(e => String(e?.id) === entityId);
      if (!entity) return { ok: false, reason: 'removeItem entity not found' };
      const inv = entity.inventory && typeof entity.inventory === 'object' ? entity.inventory : {};
      const arr = Array.isArray(inv[bucket]) ? inv[bucket] : [];
      if (!arr.some(i => String(i?.name) === itemName)) return { ok: false, reason: 'removeItem item not found' };
      validated.push(op);
      continue;
    }

    if (kind === 'modifyFurniture') {
      const nodeId = String(op.nodeId || '');
      const furnitureId = Number(op.furnitureId ?? -1);
      const changes = op.changes;
      if (!nodeId || furnitureId < 0 || !changes) return { ok: false, reason: 'modifyFurniture missing fields' };
      const node = m.nodes.find(n => n.id === nodeId);
      if (!node) return { ok: false, reason: 'modifyFurniture node not found' };
      const furniture = Array.isArray(node.furniture) ? node.furniture : [];
      if (furnitureId >= furniture.length) return { ok: false, reason: 'modifyFurniture furniture not found' };
      if (changes.notes && BANNED_RE.test(String(changes.notes))) return { ok: false, reason: 'banned word in notes' };
      validated.push(op);
      continue;
    }

    if (kind === 'removeFurniture') {
      const nodeId = String(op.nodeId || '');
      const furnitureId = Number(op.furnitureId ?? -1);
      if (!nodeId || furnitureId < 0) return { ok: false, reason: 'removeFurniture missing fields' };
      const node = m.nodes.find(n => n.id === nodeId);
      if (!node) return { ok: false, reason: 'removeFurniture node not found' };
      const furniture = Array.isArray(node.furniture) ? node.furniture : [];
      if (furnitureId >= furniture.length) return { ok: false, reason: 'removeFurniture furniture not found' };
      validated.push(op);
      continue;
    }

    // Unknown op type in physics batch — reject all
    return { ok: false, reason: `unknown op: ${kind}` };
  }

  return { ok: true, deltas: validated };
}

// --- Offline Fallback ---

const FORCE_RE  = /\b(rip|break|smash|tear|kick|punch|shatter)\b/;
const EXAMINE_RE = /\b(search|examine|inspect|look at|check)\b/;
const TAKE_RE   = /\b(take|grab|pick up|steal)\b/;
const FIRE_RE   = /\b(light|ignite|set fire|torch|kindle|burn)\b/i;
const COVER_RE  = /\b(hide\s+behind|duck\s+behind|crouch\s+behind|brace\s+against|shelter\s+behind|press\s+against|take\s+cover)\b/i;

function offlineFallback(world, playerText, detection) {
  const w = ensureWorld(world);
  const m = ensureMap(w.map);
  const here = m.nodes.find(n => n.id === m.currentNodeId);
  const text = String(playerText || '').toLowerCase();
  const party = Array.isArray(w.party) ? w.party : [];
  const actorId = party[0]?.id || 'party';
  const nodeId = m.currentNodeId;

  // Find the first furniture match
  const furnitureMatch = detection.matches.find(mt => mt.type === 'furniture');
  if (!furnitureMatch || !here) {
    const targetName = detection.matches[0]?.name || 'the object';
    return {
      plausible: true,
      deltas: [],
      description: `You interact with ${targetName}.`,
      fallbackUsed: true
    };
  }

  const furniture = Array.isArray(here.furniture) ? here.furniture : [];
  const fIdx = furnitureMatch.index;
  const f = furniture[fIdx];
  if (!f) {
    return { plausible: true, deltas: [], description: `You interact with ${furnitureMatch.name}.`, fallbackUsed: true };
  }

  const targetName = f.name || 'the object';
  const parts = Array.isArray(f.parts) ? f.parts : [];

  const fMaterial = String(f.material || 'wood');
  const fHardness = typeof f.hardness === 'number' ? f.hardness : 2;

  // Force words: delegate to material-aware break ruling
  if (FORCE_RE.test(text)) {
    let mentionedPart = null;
    for (const p of parts) {
      if (text.includes(String(p).toLowerCase())) { mentionedPart = p; break; }
    }
    const ruling = resolveBreakRuling(f, { actorId, nodeId, fIdx, mentionedPart });
    return {
      plausible: true,
      deltas: ruling.deltas,
      description: ruling.description,
      fallbackUsed: true,
      hardness: fHardness,
      material: fMaterial,
      noiseBy: ruling.noiseBy
    };
  }

  // Fire/ignite words: delegate to material-aware fire ruling (no d20, auto-resolves)
  if (FIRE_RE.test(text)) {
    const ruling = resolveFireRuling(f, { actorId, nodeId, fIdx });
    return {
      plausible: true,
      deltas: ruling.deltas,
      description: ruling.description,
      fallbackUsed: true,
      hardness: fHardness,
      material: fMaterial,
      noiseBy: ruling.noiseBy,
      verbClass: 'fire'
    };
  }

  // Cover/hide words: delegate to cover ruling (no d20, auto-resolves)
  if (COVER_RE.test(text)) {
    const ruling = resolveCoverRuling(f, { actorId });
    return {
      plausible: true,
      deltas: ruling.deltas,
      description: ruling.description,
      fallbackUsed: true,
      hardness: fHardness,
      material: fMaterial,
      noiseBy: ruling.noiseBy,
      verbClass: 'cover'
    };
  }

  // Examine/search words: describe parts and state, no deltas
  if (EXAMINE_RE.test(text)) {
    const partsDesc = parts.length ? `Parts: ${parts.join(', ')}.` : '';
    const stateDesc = f.state ? `State: ${f.state}.` : '';
    return {
      plausible: true,
      deltas: [],
      description: `You examine ${targetName} closely. ${stateDesc} ${partsDesc}`.trim(),
      fallbackUsed: true,
      hardness: fHardness,
      material: fMaterial
    };
  }

  // Take/grab words: only works on bulk <= 2
  if (TAKE_RE.test(text)) {
    const bulk = f.bulk ?? 3;
    if (bulk <= 2) {
      const deltas = [
        { op: 'removeFurniture', nodeId, furnitureId: fIdx },
        {
          op: 'createItem',
          entityId: actorId,
          bucket: 'tools',
          item: {
            name: targetName,
            tags: Array.isArray(f.tags) ? f.tags.slice(0, 3) : [],
            weight: clampInt(f.weight || 1, 0, 5),
            noise: 0,
            light: 0,
            bulk: clampInt(bulk, 0, 5),
            notes: f.notes || ''
          }
        }
      ];
      return {
        plausible: true,
        deltas,
        description: `You take the ${targetName}.`,
        fallbackUsed: true,
        hardness: fHardness,
        material: fMaterial
      };
    }
    return {
      plausible: true,
      deltas: [],
      description: `You try to take ${targetName}, but it's too heavy to carry.`,
      fallbackUsed: true,
      hardness: fHardness,
      material: fMaterial
    };
  }

  // Default: generic interaction
  return {
    plausible: true,
    deltas: [],
    description: `You interact with ${targetName}.`,
    fallbackUsed: true,
    hardness: fHardness,
    material: fMaterial
  };
}

// --- Helpers ---

function extractAndParseJson(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch {}
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}
