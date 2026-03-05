import { hashString } from '../../utils/hash.js';

/**
 * Gate S3: deterministic building plot generator from nodeSpatial + roadGraph.
 *
 * Inputs:
 * - seed: world seed (string)
 * - nodeId: node id (string)
 * - settlementType: hint (string)
 * - roads: [{ type, angle }]
 *
 * Output:
 * - buildings: [{ buildingId, roadType, roadIndex, offset01, size, kind }]
 *
 * Notes:
 * - Pure projection-only generator. No world mutation.
 * - Stable ordering.
 */
export function generateBuildingPlots({ seed, nodeId, settlementType = 'village', roads = [] }) {
  const base = `${String(seed)}|${String(nodeId)}|${String(settlementType)}`;
  const baseSeed = hashString(base);

  const roadList = Array.isArray(roads) ? roads.slice() : [];
  roadList.sort((a, b) => String(a?.type || '').localeCompare(String(b?.type || '')) || (Number(a?.angle || 0) - Number(b?.angle || 0)));

  const densityByType = {
    hamlet: 6,
    village: 10,
    town: 16,
    city: 24
  };
  const target = densityByType[String(settlementType)] ?? 10;

  const nRoads = Math.max(1, roadList.length);
  const perRoad = Math.max(2, Math.ceil(target / nRoads));

  const buildings = [];
  for (let r = 0; r < nRoads; r++) {
    const road = roadList[r] || { type: 'primary', angle: 0 };
    for (let i = 0; i < perRoad; i++) {
      const h = hashString(`${base}|r${r}|i${i}`);
      const offset01 = ((h >>> 0) % 1000) / 1000;
      const sizeRoll = (h >>> 10) & 0x3;
      const size = sizeRoll === 0 ? 'small' : sizeRoll === 1 ? 'medium' : sizeRoll === 2 ? 'large' : 'medium';
      const kindRoll = (h >>> 14) & 0x7;
      const kind = kindRoll <= 2 ? 'dwelling' : kindRoll <= 4 ? 'shop' : kindRoll === 5 ? 'hall' : 'shed';

      buildings.push({
        buildingId: `b-${(baseSeed >>> 0).toString(16)}-${r}-${i}`,
        roadType: String(road?.type || 'primary'),
        roadIndex: r,
        offset01,
        size,
        kind
      });
    }
  }

  buildings.sort((a, b) => (a.roadIndex - b.roadIndex) || (a.offset01 - b.offset01) || String(a.buildingId).localeCompare(String(b.buildingId)));

  return { buildingsCount: buildings.length, buildings };
}
