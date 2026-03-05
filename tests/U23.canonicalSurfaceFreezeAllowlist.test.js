import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld } from '../engine/state.js';
import { simulateTurns } from '../engine/simulate.js';
import { exportWorld, importWorld } from '../engine/save.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel'],
    locations: ['tower'],
    objectives: ['find the key'],
    complications: ['a clock starts'],
    npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust']
  }
};

// Canonical Surface Freeze (docs/VICTORY_GATE_v1.md)
const CANONICAL_TIMELINE_EVENT_KINDS = [
  'begin',
  'scene',
  'travel',
  'blocked',
  'resolution',
  'threadShift',
  'scarFormed',
  'endingTriggered',
  'interiorInspect'
];

// Non-canonical timeline logs are allowed to exist, but are NOT part of the canonical surface freeze.
const NON_CANONICAL_TIMELINE_EVENT_KINDS = [
  'note',
  'worldTick'
];

function uniqSorted(xs) {
  return Array.from(new Set(xs)).sort();
}

function isAllowedTimelineKind(k) {
  return CANONICAL_TIMELINE_EVENT_KINDS.includes(k) || NON_CANONICAL_TIMELINE_EVENT_KINDS.includes(k);
}

test('U23: Gate I Canonical Surface Freeze — emitted timeline kinds are within allowlist', () => {
  const TURNS = 80;

  const w0 = newWorld({
    seed: 'u23-seed-0',
    fate: 0.2,
    campaignId: 'u23',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const { world: simulated } = simulateTurns(w0, packsById, TURNS);

  const kindsA = (simulated.timeline || []).map(e => String(e?.kind || ''));
  const badA = uniqSorted(kindsA.filter(k => k && !isAllowedTimelineKind(k)));
  assert.deepEqual(badA, [], `Found disallowed timeline kinds in simulation: ${badA.join(', ')}`);

  const exported = exportWorld(simulated);
  const imported = importWorld(exported);

  const kindsB = (imported.timeline || []).map(e => String(e?.kind || ''));
  const badB = uniqSorted(kindsB.filter(k => k && !isAllowedTimelineKind(k)));
  assert.deepEqual(badB, [], `Found disallowed timeline kinds after import: ${badB.join(', ')}`);
});

test('U23: Gate I Canonical Surface Freeze — CanonLog allowed types remain CANON_CREATE (code-owned constant)', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const canonLogPath = path.resolve(__dirname, '../engine/csl/canonLog.js');

  const src = fs.readFileSync(canonLogPath, 'utf8');
  const m = src.match(/ALLOWED_CANON_EVENT_TYPES\s*=\s*\[([^\]]*)\]/m);
  assert.ok(m, 'Missing ALLOWED_CANON_EVENT_TYPES constant in engine/csl/canonLog.js');

  const inside = String(m[1] || '').replace(/\s+/g, '');
  assert.equal(inside, "'CANON_CREATE'", `Unexpected allowed CanonLog types: [${m[1]}]`);
});
