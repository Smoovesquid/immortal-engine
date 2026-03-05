import { hashString } from "../../utils/hash.js";

export function generateSettlementRoadGraph({ seed, nodeId }) {

  const baseSeed = hashString(`${seed}:${nodeId}:roads`);

  const primaryAngle = (baseSeed % 360) * (Math.PI / 180);

  const secondary1 = ((baseSeed >> 3) % 360) * (Math.PI / 180);
  const secondary2 = ((baseSeed >> 6) % 360) * (Math.PI / 180);

  const roads = [
    { type: "primary", angle: primaryAngle },
    { type: "secondary", angle: secondary1 },
    { type: "secondary", angle: secondary2 }
  ];

  return roads;
}
