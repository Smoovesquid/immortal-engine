/**
 * S1 — Node Type Classification
 *
 * Deterministically assigns a type to every map node.
 * Type is derived from name keywords first, seed hash as fallback.
 * Pure function — no world mutation, no runtime randomness.
 *
 * Types:
 *   settlement    — village, town, inn, camp: has roads + buildings
 *   wilderness    — ford, creek, wood, plains: terrain only, no buildings
 *   landmark      — tower, shrine, bridge, ruin: one significant structure
 *   dungeon_entrance — crypt, cave, passage, pit: leads to interior
 */

import { seedFromString } from '../rng.js';

const DUNGEON_KEYWORDS = [
  'crypt', 'cave', 'cavern', 'dungeon', 'passage', 'tunnel', 'pocket',
  'deep', 'sunken', 'descent', 'pit', 'vault', 'cellar', 'mine', 'shaft',
  'underpass', 'burrow', 'catacomb', 'tomb', 'warrens', 'den'
];

const LANDMARK_KEYWORDS = [
  'tower', 'shrine', 'chapel', 'bridge', 'stair', 'stairs', 'threshold',
  'ruin', 'ruins', 'ruined', 'monument', 'spire', 'gate', 'arch', 'well',
  'altar', 'obelisk', 'waystone', 'cairn', 'standing stone', 'watchtower',
  'lighthouse', 'beacon', 'temple', 'abbey', 'monastery', 'dead end',
  'sooted', 'hollow', 'old shrine', 'backway', 'ford'
];

const SETTLEMENT_KEYWORDS = [
  'village', 'town', 'hamlet', 'inn', 'tavern', 'hall', 'keep',
  'fort', 'fortress', 'garrison', 'camp', 'outpost', 'settlement',
  'market', 'crossroads', 'depot', 'station', 'lodge', 'post'
];

// Fallback distribution when no keywords match — weighted toward wilderness.
// wilderness: 50%, landmark: 25%, settlement: 15%, dungeon_entrance: 10%
const FALLBACK_THRESHOLDS = [
  { type: 'wilderness',        max: 50 },
  { type: 'landmark',          max: 75 },
  { type: 'settlement',        max: 90 },
  { type: 'dungeon_entrance',  max: 100 },
];

/**
 * classifyNodeType({ seed, nodeId, name }) → NodeType string
 *
 * @param {string} seed      — world seed
 * @param {string} nodeId    — node id
 * @param {string} name      — node display name
 * @returns {'settlement'|'wilderness'|'landmark'|'dungeon_entrance'}
 */
export function classifyNodeType({ seed, nodeId, name }) {
  const n = String(name || '').toLowerCase();

  if (DUNGEON_KEYWORDS.some(k => n.includes(k)))  return 'dungeon_entrance';
  if (SETTLEMENT_KEYWORDS.some(k => n.includes(k))) return 'settlement';
  if (LANDMARK_KEYWORDS.some(k => n.includes(k))) return 'landmark';

  // No keyword match — use seed hash for deterministic fallback.
  const h = Math.abs(seedFromString(`${seed}|nodetype|${nodeId}`)) % 100;
  for (const { type, max } of FALLBACK_THRESHOLDS) {
    if (h < max) return type;
  }
  return 'wilderness';
}
