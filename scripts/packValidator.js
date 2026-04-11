#!/usr/bin/env node

/**
 * Pass I1 — Pack Validator.
 *
 * Validates that a pack directory under packs/<id>/ is internally coherent.
 * Pure function: same input, same result. Collects ALL errors (and warnings)
 * rather than throwing on the first one — the importer will eventually want
 * to surface every problem at once, not fail-fast.
 *
 * Two schemas are supported simultaneously:
 *
 *   1. The current hand-authored shape (packs/fantasy/pack.json and friends):
 *      id, name, toneWords {cooperative|grim|blood: string[]},
 *      starterLocations, starterObjectives, starterGoals?, skills,
 *      locations, objectives, complications, npcArchetypes, sensoryMotifs.
 *
 *   2. The aspirational prose-to-world shape that the importer will emit:
 *      regions[], factions[], npcs[], threads[], seeds[], toneVectors{}.
 *      Each of these is optional; when present, the validator cross-checks
 *      references (adjacency, faction, seed, nodeId) for dangling pointers.
 *
 * A pack that uses only the current shape (like packs/fantasy) must pass.
 *
 * Usage as a library:
 *   import { validatePack } from './packValidator.js';
 *   const result = validatePack('packs/fantasy');
 *   if (!result.ok) console.error(result.errors);
 *
 * Usage as a CLI:
 *   node scripts/packValidator.js packs/fantasy
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Error codes (contract) ─────────────────────────────────────────────

export const ERROR_CODES = Object.freeze({
  MANIFEST_MISSING:       'MANIFEST_MISSING',
  MANIFEST_PARSE_ERROR:   'MANIFEST_PARSE_ERROR',
  MANIFEST_INVALID:       'MANIFEST_INVALID',
  MISSING_FIELD:          'MISSING_FIELD',
  INVALID_FIELD_TYPE:     'INVALID_FIELD_TYPE',
  EMPTY_STRING:           'EMPTY_STRING',
  MOTIF_EMPTY:            'MOTIF_EMPTY',
  DUPLICATE_ID:           'DUPLICATE_ID',
  ADJACENCY_DANGLING:     'ADJACENCY_DANGLING',
  FACTION_REF_DANGLING:   'FACTION_REF_DANGLING',
  THREAD_NODEREF_DANGLING:'THREAD_NODEREF_DANGLING',
  SEED_ORPHAN:            'SEED_ORPHAN',
  SEED_REF_DANGLING:      'SEED_REF_DANGLING',
  TONE_OUT_OF_RANGE:      'TONE_OUT_OF_RANGE',
  TONE_INVALID_BUCKET:    'TONE_INVALID_BUCKET'
});

// Numeric tone vectors (when present) must lie in this range. The engine's
// fateBand mapping operates on [0,1] (see engine/rulesets.js#fateBand), so
// tone vector values are required to share that domain.
export const TONE_MIN = 0;
export const TONE_MAX = 1;

const TONE_BUCKETS = ['cooperative', 'grim', 'blood'];

const REQUIRED_STRING_FIELDS = ['id', 'name'];

const REQUIRED_STRING_ARRAY_FIELDS = [
  'starterLocations',
  'starterObjectives',
  'skills',
  'locations',
  'objectives',
  'complications',
  'npcArchetypes',
  'sensoryMotifs'
];

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Validate a pack directory.
 *
 * @param {string} packPath absolute or repo-relative path to a pack directory
 *                          (e.g. 'packs/fantasy')
 * @returns {{ok: boolean, errors: Array<{path:string, code:string, message:string}>, warnings: Array<{path:string, code:string, message:string}>}}
 */
export function validatePack(packPath) {
  const errors = [];
  const warnings = [];

  if (typeof packPath !== 'string' || !packPath) {
    errors.push(err('', ERROR_CODES.MANIFEST_MISSING, 'packPath must be a non-empty string'));
    return { ok: false, errors, warnings };
  }

  const absPath = resolve(packPath);

  // 1. Directory exists
  if (!existsSync(absPath) || !statSync(absPath).isDirectory()) {
    errors.push(err(absPath, ERROR_CODES.MANIFEST_MISSING, `pack directory does not exist: ${absPath}`));
    return { ok: false, errors, warnings };
  }

  // 2. pack.json exists
  const manifestPath = join(absPath, 'pack.json');
  if (!existsSync(manifestPath)) {
    errors.push(err(absPath, ERROR_CODES.MANIFEST_MISSING, `pack.json not found in ${absPath}`));
    return { ok: false, errors, warnings };
  }

  // 3. pack.json parses
  let raw;
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    errors.push(err('pack.json', ERROR_CODES.MANIFEST_PARSE_ERROR, `failed to parse pack.json: ${e.message}`));
    return { ok: false, errors, warnings };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push(err('pack.json', ERROR_CODES.MANIFEST_INVALID, 'pack.json must parse to a plain object'));
    return { ok: false, errors, warnings };
  }

  // 4. Required scalar fields
  for (const field of REQUIRED_STRING_FIELDS) {
    if (!(field in raw)) {
      errors.push(err(field, ERROR_CODES.MISSING_FIELD, `required field "${field}" is missing`));
      continue;
    }
    if (typeof raw[field] !== 'string') {
      errors.push(err(field, ERROR_CODES.INVALID_FIELD_TYPE, `"${field}" must be a string`));
      continue;
    }
    if (raw[field].trim() === '') {
      errors.push(err(field, ERROR_CODES.EMPTY_STRING, `"${field}" must be a non-empty trimmed string`));
    } else if (raw[field] !== raw[field].trim()) {
      warnings.push(err(field, ERROR_CODES.EMPTY_STRING, `"${field}" has untrimmed whitespace`));
    }
  }

  // 5. Required string-array fields
  for (const field of REQUIRED_STRING_ARRAY_FIELDS) {
    validateStringArray(raw, field, errors, warnings);
  }

  // 6. toneWords — required, structured bucket of string arrays
  validateToneWords(raw, errors, warnings);

  // 7. Optional: starterGoals
  if (raw.starterGoals !== undefined) {
    validateStarterGoals(raw.starterGoals, errors);
  }

  // 8. Sensory motifs — already string-array-validated above, but apply
  // the stricter motif rule: trimmed + non-empty (any failure reported
  // with MOTIF_EMPTY for precise diagnostics).
  if (Array.isArray(raw.sensoryMotifs)) {
    raw.sensoryMotifs.forEach((m, i) => {
      if (typeof m !== 'string' || m.trim() === '') {
        errors.push(err(`sensoryMotifs[${i}]`, ERROR_CODES.MOTIF_EMPTY, 'motif must be a non-empty string'));
      } else if (m !== m.trim()) {
        errors.push(err(`sensoryMotifs[${i}]`, ERROR_CODES.MOTIF_EMPTY, 'motif has untrimmed whitespace'));
      }
    });
  }

  // ── Aspirational / importer-emitted shape checks ─────────────────────
  // Each of these is only run when the field is present. A hand-authored
  // pack (like packs/fantasy) does not carry these and will skip them.

  const regionIds = collectIds(raw.regions, 'regions', errors);
  const factionIds = collectIds(raw.factions, 'factions', errors);
  const npcIds = collectIds(raw.npcs, 'npcs', errors);
  const seedIds = collectIds(raw.seeds, 'seeds', errors);

  // Collect all the nodeId anchors the pack defines. If regions are present
  // they supply node ids; otherwise we fall back to location strings.
  const nodeIds = new Set();
  if (Array.isArray(raw.regions)) {
    for (const r of raw.regions) {
      if (r && typeof r === 'object' && typeof r.id === 'string') nodeIds.add(r.id);
      if (r && Array.isArray(r.nodes)) {
        for (const n of r.nodes) {
          if (n && typeof n === 'object' && typeof n.id === 'string') nodeIds.add(n.id);
          else if (typeof n === 'string') nodeIds.add(n);
        }
      }
    }
  }

  // 9. Region adjacency checks
  if (Array.isArray(raw.regions)) {
    raw.regions.forEach((r, i) => {
      if (!r || typeof r !== 'object') return;
      if (Array.isArray(r.adjacency)) {
        r.adjacency.forEach((adjId, j) => {
          if (typeof adjId !== 'string') {
            errors.push(err(`regions[${i}].adjacency[${j}]`, ERROR_CODES.INVALID_FIELD_TYPE, 'adjacency entries must be strings'));
            return;
          }
          if (!regionIds.has(adjId)) {
            errors.push(err(`regions[${i}].adjacency[${j}]`, ERROR_CODES.ADJACENCY_DANGLING, `adjacency references unknown region "${adjId}"`));
          }
        });
      }
    });
  }

  // 10. NPC faction references
  if (Array.isArray(raw.npcs)) {
    raw.npcs.forEach((n, i) => {
      if (!n || typeof n !== 'object') return;
      const f = n.faction ?? n.factionId;
      if (f != null) {
        if (typeof f !== 'string') {
          errors.push(err(`npcs[${i}].faction`, ERROR_CODES.INVALID_FIELD_TYPE, 'faction must be a string'));
        } else if (!factionIds.has(f)) {
          errors.push(err(`npcs[${i}].faction`, ERROR_CODES.FACTION_REF_DANGLING, `NPC references unknown faction "${f}"`));
        }
      }
    });
  }

  // 11. Thread nodeId refs
  if (Array.isArray(raw.threads)) {
    raw.threads.forEach((t, i) => {
      if (!t || typeof t !== 'object') return;
      if (t.nodeId != null) {
        if (typeof t.nodeId !== 'string') {
          errors.push(err(`threads[${i}].nodeId`, ERROR_CODES.INVALID_FIELD_TYPE, 'thread nodeId must be a string'));
        } else if (nodeIds.size > 0 && !nodeIds.has(t.nodeId)) {
          errors.push(err(`threads[${i}].nodeId`, ERROR_CODES.THREAD_NODEREF_DANGLING, `thread references unknown nodeId "${t.nodeId}"`));
        }
      }
    });
  }

  // 12. Seed references: every seed referenced must exist; every seed
  // defined must be referenced by something in the pack.
  if (Array.isArray(raw.seeds)) {
    const referenced = collectSeedReferences(raw);
    // Dangling refs
    for (const ref of referenced.refs) {
      if (!seedIds.has(ref.id)) {
        errors.push(err(ref.path, ERROR_CODES.SEED_REF_DANGLING, `seed reference to unknown seed "${ref.id}"`));
      }
    }
    // Orphans
    const usedIds = new Set([...referenced.refs].map(r => r.id));
    raw.seeds.forEach((s, i) => {
      if (!s || typeof s !== 'object') return;
      const id = typeof s.id === 'string' ? s.id : null;
      if (id && !usedIds.has(id)) {
        errors.push(err(`seeds[${i}]`, ERROR_CODES.SEED_ORPHAN, `seed "${id}" is defined but never referenced`));
      }
    });
  }

  // 13. Numeric tone vectors (optional; the importer will emit these).
  if (raw.toneVectors !== undefined) {
    validateToneVectors(raw.toneVectors, errors);
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ── Helpers ────────────────────────────────────────────────────────────

function err(path, code, message) {
  return { path, code, message };
}

function validateStringArray(raw, field, errors, warnings) {
  if (!(field in raw)) {
    errors.push(err(field, ERROR_CODES.MISSING_FIELD, `required field "${field}" is missing`));
    return;
  }
  const v = raw[field];
  if (!Array.isArray(v)) {
    errors.push(err(field, ERROR_CODES.INVALID_FIELD_TYPE, `"${field}" must be an array`));
    return;
  }
  v.forEach((s, i) => {
    if (typeof s !== 'string') {
      errors.push(err(`${field}[${i}]`, ERROR_CODES.INVALID_FIELD_TYPE, `entry must be a string`));
    } else if (s.trim() === '') {
      errors.push(err(`${field}[${i}]`, ERROR_CODES.EMPTY_STRING, `entry must be a non-empty string`));
    }
  });
  // Catalog-level duplicate-id check for fields that behave like catalogs.
  // locations and objectives are the hand-authored pack's closest thing to
  // an id namespace, so we flag duplicates there.
  if (field === 'locations' || field === 'objectives') {
    const seen = new Set();
    v.forEach((s, i) => {
      if (typeof s !== 'string') return;
      if (seen.has(s)) {
        errors.push(err(`${field}[${i}]`, ERROR_CODES.DUPLICATE_ID, `duplicate entry "${s}"`));
      } else {
        seen.add(s);
      }
    });
  }
}

function validateToneWords(raw, errors, warnings) {
  if (!('toneWords' in raw)) {
    errors.push(err('toneWords', ERROR_CODES.MISSING_FIELD, 'required field "toneWords" is missing'));
    return;
  }
  const tw = raw.toneWords;
  if (!tw || typeof tw !== 'object' || Array.isArray(tw)) {
    errors.push(err('toneWords', ERROR_CODES.TONE_INVALID_BUCKET, 'toneWords must be a plain object'));
    return;
  }
  for (const bucket of TONE_BUCKETS) {
    if (!(bucket in tw)) {
      errors.push(err(`toneWords.${bucket}`, ERROR_CODES.MISSING_FIELD, `toneWords.${bucket} is required`));
      continue;
    }
    const arr = tw[bucket];
    if (!Array.isArray(arr)) {
      errors.push(err(`toneWords.${bucket}`, ERROR_CODES.TONE_INVALID_BUCKET, `toneWords.${bucket} must be an array of strings`));
      continue;
    }
    arr.forEach((w, i) => {
      if (typeof w !== 'string') {
        errors.push(err(`toneWords.${bucket}[${i}]`, ERROR_CODES.INVALID_FIELD_TYPE, 'tone word must be a string'));
      } else if (w.trim() === '') {
        errors.push(err(`toneWords.${bucket}[${i}]`, ERROR_CODES.EMPTY_STRING, 'tone word must be non-empty'));
      } else if (w !== w.trim()) {
        warnings.push(err(`toneWords.${bucket}[${i}]`, ERROR_CODES.EMPTY_STRING, 'tone word has untrimmed whitespace'));
      }
    });
  }
}

function validateToneVectors(tv, errors) {
  if (!tv || typeof tv !== 'object' || Array.isArray(tv)) {
    errors.push(err('toneVectors', ERROR_CODES.TONE_INVALID_BUCKET, 'toneVectors must be a plain object'));
    return;
  }
  for (const bucket of TONE_BUCKETS) {
    if (!(bucket in tv)) continue; // vectors are optional per-bucket
    const v = tv[bucket];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push(err(`toneVectors.${bucket}`, ERROR_CODES.INVALID_FIELD_TYPE, 'tone vector must be a finite number'));
      continue;
    }
    if (v < TONE_MIN || v > TONE_MAX) {
      errors.push(err(
        `toneVectors.${bucket}`,
        ERROR_CODES.TONE_OUT_OF_RANGE,
        `tone vector ${v} out of legal range [${TONE_MIN}, ${TONE_MAX}]`
      ));
    }
  }
}

function validateStarterGoals(goals, errors) {
  if (!Array.isArray(goals)) {
    errors.push(err('starterGoals', ERROR_CODES.INVALID_FIELD_TYPE, 'starterGoals must be an array'));
    return;
  }
  goals.forEach((g, i) => {
    if (!g || typeof g !== 'object' || Array.isArray(g)) {
      errors.push(err(`starterGoals[${i}]`, ERROR_CODES.INVALID_FIELD_TYPE, 'starter goal must be an object'));
      return;
    }
    if (typeof g.kind !== 'string' || g.kind.trim() === '') {
      errors.push(err(`starterGoals[${i}].kind`, ERROR_CODES.MISSING_FIELD, 'starter goal kind is required'));
    }
    if (typeof g.targetRef !== 'string' || g.targetRef.trim() === '') {
      errors.push(err(`starterGoals[${i}].targetRef`, ERROR_CODES.MISSING_FIELD, 'starter goal targetRef is required'));
    }
  });
}

/**
 * Collect ids from an optional catalog array, emitting DUPLICATE_ID errors.
 * Returns a Set of the ids present (unique only — duplicates still emit an
 * error but the first occurrence is kept in the set so downstream reference
 * checks don't cascade into FACTION_REF_DANGLING etc.)
 */
function collectIds(arr, fieldName, errors) {
  const set = new Set();
  if (!Array.isArray(arr)) return set;
  arr.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') return;
    const id = entry.id;
    if (typeof id !== 'string' || id.trim() === '') return;
    if (set.has(id)) {
      errors.push(err(`${fieldName}[${i}].id`, ERROR_CODES.DUPLICATE_ID, `duplicate id "${id}" in ${fieldName}`));
    } else {
      set.add(id);
    }
  });
  return set;
}

/**
 * Collect all seed references out of the pack. A seed ref is any value of
 * `seed`, `seedRef`, or `seedIds` found on regions, npcs, events, threads,
 * scars, or factions.
 */
function collectSeedReferences(raw) {
  const refs = [];
  const collect = (owner, ownerIdx, ownerName) => {
    if (!owner || typeof owner !== 'object') return;
    if (typeof owner.seed === 'string') {
      refs.push({ id: owner.seed, path: `${ownerName}[${ownerIdx}].seed` });
    }
    if (typeof owner.seedRef === 'string') {
      refs.push({ id: owner.seedRef, path: `${ownerName}[${ownerIdx}].seedRef` });
    }
    if (Array.isArray(owner.seedIds)) {
      owner.seedIds.forEach((id, k) => {
        if (typeof id === 'string') {
          refs.push({ id, path: `${ownerName}[${ownerIdx}].seedIds[${k}]` });
        }
      });
    }
  };
  for (const ownerName of ['regions', 'npcs', 'events', 'threads', 'scars', 'factions']) {
    const list = raw[ownerName];
    if (Array.isArray(list)) list.forEach((o, i) => collect(o, i, ownerName));
  }
  return { refs };
}

// ── CLI entry ──────────────────────────────────────────────────────────

const isMain = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}` ||
           fileURLToPath(import.meta.url) === resolve(process.argv[1] || '');
  } catch {
    return false;
  }
})();

if (isMain) {
  const arg = process.argv[2];
  if (!arg) {
    process.stderr.write('usage: node scripts/packValidator.js <packPath>\n');
    process.exit(2);
  }
  const result = validatePack(arg);
  const label = basename(resolve(arg));
  if (result.ok) {
    const w = result.warnings.length;
    process.stdout.write(`pack ${label}: OK${w ? ` (${w} warning${w === 1 ? '' : 's'})` : ''}\n`);
    for (const warn of result.warnings) {
      process.stdout.write(`  warn ${warn.code} at ${warn.path}: ${warn.message}\n`);
    }
    process.exit(0);
  } else {
    process.stdout.write(`pack ${label}: ${result.errors.length} error${result.errors.length === 1 ? '' : 's'}\n`);
    for (const e of result.errors) {
      process.stdout.write(`  ${e.code} at ${e.path}: ${e.message}\n`);
    }
    for (const warn of result.warnings) {
      process.stdout.write(`  warn ${warn.code} at ${warn.path}: ${warn.message}\n`);
    }
    process.exit(1);
  }
}
