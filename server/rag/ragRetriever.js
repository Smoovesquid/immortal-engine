// Per-NPC RAG retriever — server-side only, never exposed to client.
// Lazy-loads corpus JSON per figure; holds in process memory for the session.
// Scoring: keyword overlap + text token overlap, cosine-normalized by query length.
// No external deps.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(__dir, 'corpus');

// { figureId -> chunk[] } — populated on first retrieval per figure
const cache = new Map();

const STOP = new Set([
  'the','and','for','with','from','that','this','your','have','been','will',
  'they','them','their','what','when','where','were','then','than','some',
  'into','over','upon','more','such','also','even','only','very','just',
  'said','says','would','could','should','shall','there','here','which',
  'about','these','those','after','before','again','still','being','having'
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !STOP.has(t));
}

function loadCorpus(figureId) {
  if (cache.has(figureId)) return cache.get(figureId);
  try {
    const raw = readFileSync(join(CORPUS_DIR, `${figureId}.json`), 'utf8');
    const data = JSON.parse(raw);
    const chunks = Array.isArray(data.chunks) ? data.chunks : [];
    // Pre-index: build a Set of keywords per chunk for O(1) lookup
    const indexed = chunks.map(c => ({
      text: String(c.text || ''),
      source: String(c.source || ''),
      keySet: new Set((Array.isArray(c.keywords) ? c.keywords : []).map(k => String(k).toLowerCase()))
    }));
    // Carry the reconstructed flag through so callers can vary the prompt header
    indexed._reconstructed = Boolean(data.reconstructed);
    cache.set(figureId, indexed);
    return indexed;
  } catch {
    cache.set(figureId, []);
    return [];
  }
}

/**
 * retrieveChunks(figureId, query, topN = 4)
 * → { chunks: [{text, source}, ...], reconstructed: boolean }
 * chunks sorted by relevance; reconstructed=true means the corpus is invented/attributed
 */
export function retrieveChunks(figureId, query, topN = 4) {
  if (!figureId) return { chunks: [], reconstructed: false };
  const corpus = loadCorpus(String(figureId));
  const reconstructed = Boolean(corpus._reconstructed);
  if (!corpus.length) return { chunks: [], reconstructed };

  const qTokens = tokenize(query);
  if (!qTokens.length) {
    return { chunks: corpus.slice(0, topN).map(c => ({ text: c.text, source: c.source })), reconstructed };
  }

  const scored = corpus.map(chunk => {
    let score = 0;
    const chunkTokens = tokenize(chunk.text);
    const chunkTokenSet = new Set(chunkTokens);
    for (const tok of qTokens) {
      if (chunk.keySet.has(tok)) score += 1.0;
      else if (chunkTokenSet.has(tok)) score += 0.4;
    }
    return { score: score / qTokens.length, text: chunk.text, source: chunk.source };
  });

  const chunks = scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(c => ({ text: c.text, source: c.source }));

  return { chunks, reconstructed };
}
