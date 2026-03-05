export function renderLocalMapProjection(opts) {
  const roads = [
    { x1: 100, y1: 100, x2: 400, y2: 120 },
    { x1: 250, y1: 50, x2: 260, y2: 350 }
  ];

  const buildings = [
    { x: 220, y: 140, w: 20, h: 20 },
    { x: 260, y: 150, w: 18, h: 18 },
    { x: 200, y: 170, w: 22, h: 22 }
  ];

  const terrain = [
    { x: 180, y: 200 },
    { x: 300, y: 210 },
    { x: 340, y: 190 }
  ];

  return { roads, buildings, terrain };
}
