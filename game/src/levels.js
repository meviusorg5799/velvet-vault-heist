// The three wings of the midnight gallery: Sculpture Court, Portrait Hall, The Vault.
// One file, one job: where every wall, case, guard, camera, loot piece and door stands.
// Coordinates are canvas pixels; the floor runs y = 64..720, x = 0..1280.
// A wall or case is a rectangle that blocks movement AND sight; a vent is a gap in a
// wall, drawn as a floor grate, that the thief slips through; a shadow is a dark corner
// where guards spot the thief half as fast. All names and art are original.

function outerWalls() {
  return [
    { x: 0, y: 64, w: 1280, h: 16 }, // top
    { x: 0, y: 64, w: 16, h: 656 }, // left
    { x: 1264, y: 64, w: 16, h: 656 }, // right
    { x: 0, y: 704, w: 1280, h: 16 }, // bottom
  ];
}

/** A wing object, with its blockers (walls + cases + columns) derived for the world. */
function makeWing(def) {
  const blockers = [...def.walls, ...def.cases, ...def.columns];
  return { ...def, blockers };
}

export const WINGS = [
  makeWing({
    name: 'Sculpture Court',
    parSeconds: 150,
    spawn: { x: 100, y: 655 },
    exit: { x: 1128, y: 82, w: 84, h: 46, label: 'EXIT' },
    walls: [
      ...outerWalls(),
      // A long partition with a vent gap in the middle: two routes around it.
      { x: 200, y: 300, w: 360, h: 16 },
      { x: 640, y: 300, w: 440, h: 16 },
      { x: 820, y: 380, w: 16, h: 180 },
    ],
    vents: [{ x: 560, y: 300, w: 80, h: 16 }],
    cases: [
      { x: 300, y: 150, w: 120, h: 60 },
      { x: 700, y: 150, w: 120, h: 60 },
      { x: 420, y: 480, w: 140, h: 70 },
      { x: 900, y: 480, w: 140, h: 70 },
    ],
    columns: [
      { x: 180, y: 420, w: 28, h: 28 },
      { x: 1150, y: 420, w: 28, h: 28 },
    ],
    shadows: [
      { x: 32, y: 96, w: 120, h: 120 },
      { x: 1120, y: 560, w: 120, h: 120 },
    ],
    carpet: { x: 540, y: 96, w: 200, h: 592 },
    guards: [
      { name: 'Marco', x: 300, y: 240, speed: 62, waypoints: [[300, 240], [920, 240]] },
      { name: 'Iris', x: 200, y: 600, speed: 58, waypoints: [[200, 600], [1020, 600]] },
      { name: 'Dario', x: 1100, y: 150, speed: 66, waypoints: [[1100, 150], [1100, 620]] },
    ],
    cameras: [{ x: 640, y: 88, baseAngle: Math.PI / 2, sweep: 0.65, period: 5.0 }],
    loot: [
      { kind: 'painting', x: 250, y: 108, name: 'The Velvet Lady' },
      { kind: 'sculpture', x: 360, y: 180, name: 'Marble Fox' },
      { kind: 'painting', x: 1010, y: 108, name: 'Midnight Canal' },
    ],
    vaultDoor: null,
  }),

  makeWing({
    name: 'Portrait Hall',
    parSeconds: 170,
    spawn: { x: 100, y: 655 },
    exit: { x: 1128, y: 620, w: 84, h: 46, label: 'EXIT' },
    walls: [
      ...outerWalls(),
      // The hall's long spine wall, split by a vent: sneak under it or walk around either end.
      { x: 16, y: 360, w: 464, h: 16 },
      { x: 580, y: 360, w: 684, h: 16 },
      { x: 640, y: 80, w: 16, h: 160 },
    ],
    vents: [{ x: 480, y: 360, w: 100, h: 16 }],
    cases: [
      { x: 200, y: 150, w: 140, h: 70 },
      { x: 900, y: 150, w: 140, h: 70 },
      { x: 200, y: 520, w: 140, h: 70 },
      { x: 900, y: 520, w: 140, h: 70 },
    ],
    columns: [
      { x: 180, y: 400, w: 28, h: 28 },
      { x: 1100, y: 400, w: 28, h: 28 },
    ],
    shadows: [
      { x: 32, y: 96, w: 120, h: 120 },
      { x: 32, y: 560, w: 140, h: 120 },
      { x: 1130, y: 96, w: 110, h: 110 },
    ],
    carpet: { x: 540, y: 96, w: 200, h: 592 },
    guards: [
      { name: 'Sofia', x: 250, y: 260, speed: 64, waypoints: [[250, 260], [1000, 260]] },
      { name: 'Ravi', x: 250, y: 630, speed: 60, waypoints: [[250, 630], [1000, 630]] },
      { name: 'Nadia', x: 1160, y: 150, speed: 68, waypoints: [[1160, 150], [1160, 620]] },
    ],
    cameras: [
      { x: 320, y: 88, baseAngle: Math.PI / 2, sweep: 0.7, period: 4.4 },
      { x: 960, y: 88, baseAngle: Math.PI / 2, sweep: 0.7, period: 5.2 },
    ],
    loot: [
      { kind: 'painting', x: 180, y: 108, name: 'The Duchess in Red' },
      { kind: 'painting', x: 1100, y: 108, name: 'The Silent Violinist' },
      { kind: 'gold', x: 640, y: 430, name: 'Gold Bars' },
    ],
    vaultDoor: null,
  }),

  makeWing({
    name: 'The Vault',
    parSeconds: 200,
    spawn: { x: 100, y: 655 },
    exit: { x: 1110, y: 620, w: 120, h: 60, label: 'GETAWAY VAN' },
    walls: [
      ...outerWalls(),
      // The vault room, top centre: solid except for its door at the bottom.
      { x: 480, y: 80, w: 16, h: 220 },
      { x: 784, y: 80, w: 16, h: 220 },
      { x: 480, y: 80, w: 320, h: 16 },
      { x: 496, y: 284, w: 94, h: 16 },
      { x: 690, y: 284, w: 94, h: 16 },
    ],
    vents: [],
    cases: [
      { x: 200, y: 150, w: 140, h: 70 },
      { x: 950, y: 150, w: 140, h: 70 },
      { x: 200, y: 520, w: 140, h: 70 },
      { x: 950, y: 520, w: 140, h: 70 },
    ],
    columns: [
      { x: 180, y: 400, w: 28, h: 28 },
      { x: 1100, y: 400, w: 28, h: 28 },
    ],
    shadows: [
      { x: 32, y: 96, w: 120, h: 120 },
      { x: 1130, y: 96, w: 110, h: 110 },
      { x: 32, y: 560, w: 140, h: 120 },
    ],
    carpet: { x: 540, y: 330, w: 200, h: 358 },
    guards: [
      { name: 'Viktor', x: 250, y: 420, speed: 66, waypoints: [[250, 420], [1010, 420]] },
      { name: 'Lena', x: 1160, y: 150, speed: 70, waypoints: [[1160, 150], [1160, 620]] },
    ],
    cameras: [{ x: 640, y: 322, baseAngle: Math.PI / 2, sweep: 0.8, period: 4.0 }],
    loot: [
      { kind: 'painting', x: 180, y: 108, name: 'The Gilded Hour' },
      { kind: 'diamond', x: 640, y: 160, name: 'The Midnight Star' },
      { kind: 'gold', x: 560, y: 220, name: 'Gold Bars' },
      { kind: 'gold', x: 720, y: 220, name: 'Gold Bars' },
    ],
    // The vault door: hold F beside it to pick the lock. The diamond and gold sit behind it.
    vaultDoor: { x: 590, y: 284, w: 100, h: 16 },
  }),
];
