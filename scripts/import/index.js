#!/usr/bin/env node

/**
 * Pass I2 — Prose-to-world importer pipeline.
 *
 * Usage: node scripts/import/index.js <source.md> [--output <dir>]
 *
 * 3-stage LLM pipeline:
 *   Stage 1: Extract structure (regions, factions, motifs, events)
 *   Stage 2: Expand entities (places, NPCs, threads per region)
 *   Stage 3: Generate latent seeds (rumor fragments per entity)
 *
 * Results are cached by SHA-256(prose + importerVersion + modelId).
 * On cache hit, all LLM calls are skipped.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractStructure } from './stage1-structure.js';
import { expandEntities } from './stage2-expansion.js';
import { generateSeeds } from './stage3-seeds.js';
import { cacheKey, readCache, writeCache } from './cache.js';

export const IMPORTER_VERSION = '0.1.0';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * Run the full import pipeline.
 *
 * @param {string} prose — raw prose text
 * @param {{ apiKey: string, model?: string, outputDir?: string, baseDir?: string, fetchImpl?: typeof fetch }} opts
 * @returns {Promise<object>} the generated pack artifact
 */
export async function runPipeline(prose, {
  apiKey,
  model = DEFAULT_MODEL,
  outputDir,
  baseDir = process.cwd(),
  fetchImpl = globalThis.fetch
} = {}) {
  if (!apiKey) throw new Error('Importer: ANTHROPIC_API_KEY is required');
  if (!prose || typeof prose !== 'string') throw new Error('Importer: prose must be a non-empty string');

  // 1. Check cache
  const key = cacheKey(prose, IMPORTER_VERSION, model);
  const cached = await readCache(key, { baseDir });
  if (cached) {
    console.log(`Cache hit (${key.slice(0, 12)}...) — skipping LLM calls.`);
    return cached;
  }

  console.log('Cache miss — running 3-stage LLM pipeline...');

  // 2. Stage 1: Structure extraction
  console.log('  Stage 1: extracting structure...');
  const structure = await extractStructure(prose, { apiKey, model, fetchImpl });

  // 3. Stage 2: Entity expansion
  console.log('  Stage 2: expanding entities...');
  const entities = await expandEntities(structure, prose, { apiKey, model, fetchImpl });

  // 4. Stage 3: Seed generation
  console.log('  Stage 3: generating seeds...');
  const seeds = await generateSeeds(entities, structure, { apiKey, model, fetchImpl });

  // 5. Assemble pack artifact
  const artifact = assemblePack(structure, entities, seeds);

  // 6. Cache the result
  await writeCache(key, artifact, { baseDir });
  console.log(`  Cached as ${key.slice(0, 12)}...`);

  return artifact;
}

/**
 * Assemble the final pack.json shape from pipeline outputs.
 */
function assemblePack(structure, entities, seeds) {
  // Build tone words from structure tone array
  const toneWords = { cooperative: [], grim: [], blood: [] };
  for (const t of (structure.tone || [])) {
    // Distribute tone words across buckets based on feel
    toneWords.grim.push(t);
  }
  // Ensure each bucket has at least one entry
  if (toneWords.cooperative.length === 0) toneWords.cooperative.push('warm');
  if (toneWords.grim.length === 0) toneWords.grim.push('cold');
  if (toneWords.blood.length === 0) toneWords.blood.push('dark');

  // Flatten all places into locations, NPCs into archetypes
  const locations = [];
  const npcArchetypes = [];
  const allNpcs = [];
  const threads = [];
  const allPlaces = [];

  for (const region of entities) {
    for (const place of (region.places || [])) {
      locations.push(`${place.name} (${place.nodeType})`);
      allPlaces.push(place);
    }
    for (const npc of (region.npcs || [])) {
      npcArchetypes.push(`${npc.name} — ${npc.archetype}`);
      allNpcs.push(npc);
    }
    for (const thread of (region.threads || [])) {
      threads.push(thread);
    }
  }

  // Build objectives from threads
  const objectives = threads.map(t => t.description || t.name);
  // Ensure at least one objective
  if (objectives.length === 0) objectives.push('explore the world');

  // Build starter goals from first thread
  const starterGoals = [];
  if (allPlaces.length > 0) {
    starterGoals.push({
      kind: 'reach',
      targetRef: '__nearest_settlement__',
      label: 'Travel to the next settlement'
    });
  }

  // Sensory motifs from structure motifs
  const sensoryMotifs = (structure.motifs || []).length > 0
    ? structure.motifs
    : ['the air feels heavy'];

  // Complications from events
  const complications = (structure.historicalEvents || []).map(e => e.description);
  if (complications.length === 0) complications.push('an unexpected complication arises');

  // Skills — derive from factions
  const skills = ['Steel', 'Wits', 'Charm', 'Lore'];

  return {
    id: slugify(structure.worldName),
    name: structure.worldName,
    toneWords,
    starterLocations: locations.slice(0, 3),
    starterObjectives: objectives.slice(0, 3),
    starterGoals,
    skills,
    locations,
    objectives,
    complications,
    npcArchetypes,
    sensoryMotifs,
    // Aspirational shape fields
    regions: structure.regions,
    factions: structure.factions,
    npcs: allNpcs,
    threads,
    seeds,
    toneVectors: { cooperative: 0.5, grim: 0.5, blood: 0.5 }
  };
}

function slugify(str) {
  return String(str || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Write the pack artifact to a directory with metadata.
 */
async function writePack(artifact, outputDir, { prose, model }) {
  await mkdir(outputDir, { recursive: true });

  const packPath = resolve(outputDir, 'pack.json');
  await writeFile(packPath, JSON.stringify(artifact, null, 2), 'utf8');

  const meta = {
    importerVersion: IMPORTER_VERSION,
    inputHash: cacheKey(prose, IMPORTER_VERSION, model),
    generatedAt: new Date().toISOString(),
    modelId: model
  };
  const metaPath = resolve(outputDir, 'import.meta.json');
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  return { packPath, metaPath };
}

// ── CLI entry ────────────────────────────────────────────────────────────

const isMain = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}` ||
           fileURLToPath(import.meta.url) === resolve(process.argv[1] || '');
  } catch {
    return false;
  }
})();

if (isMain) {
  const args = process.argv.slice(2);
  const sourceArg = args.find(a => !a.startsWith('--'));
  const outputIdx = args.indexOf('--output');
  const outputArg = outputIdx >= 0 ? args[outputIdx + 1] : null;

  if (!sourceArg) {
    process.stderr.write('Usage: node scripts/import/index.js <source.md> [--output <dir>]\n');
    process.exit(2);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    process.stderr.write('Error: ANTHROPIC_API_KEY environment variable is required.\n');
    process.exit(1);
  }

  const sourcePath = resolve(sourceArg);
  const prose = await readFile(sourcePath, 'utf8');
  const model = process.env.IMPORT_MODEL || DEFAULT_MODEL;
  const outputDir = outputArg
    ? resolve(outputArg)
    : resolve(dirname(sourcePath));

  try {
    const artifact = await runPipeline(prose, { apiKey, model });

    // Validate through packValidator
    const { validatePack } = await import('../packValidator.js');
    // Write pack first so validator can read it
    const { packPath, metaPath } = await writePack(artifact, outputDir, { prose, model });
    console.log(`  Pack written to ${packPath}`);
    console.log(`  Meta written to ${metaPath}`);

    const result = validatePack(outputDir);
    if (!result.ok) {
      console.error(`Pack validation failed with ${result.errors.length} error(s):`);
      for (const e of result.errors) {
        console.error(`  ${e.code} at ${e.path}: ${e.message}`);
      }
      process.exit(1);
    }

    if (result.warnings.length > 0) {
      console.log(`  ${result.warnings.length} warning(s)`);
    }
    console.log('Done.');
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    process.exit(1);
  }
}
