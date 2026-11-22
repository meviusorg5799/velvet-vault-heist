// VELVET VAULT — tuning constants and shared geometry.
// One file, one job: every number the rest of the game agrees on lives here.
export const VIEW = { width: 1280, height: 720 };
export const HUD_HEIGHT = 64;
export const STEP = 1 / 60;
export const BEST_KEY = 'velvet-vault-best'; // localStorage key for the best getaway take

// The play floor: the room the thief crosses. The HUD sits above it.
export const FLOOR = { x: 0, y: HUD_HEIGHT, width: 1280, height: 720 - HUD_HEIGHT };

// Thief movement.
export const THIEF = {
  radius: 13,
  speed: 205, // px per second, walking
  sneakSpeed: 118, // holding Shift: slower, half as easy to spot
  grabRadius: 50, // close enough to lift a loot piece (loot sits on cases, out of arm's reach of the glass)
  catchRadius: 24, // a guard this close busts the thief
};

// Vision: how far and how wide a guard or a camera sees.
export const VISION = {
  guardRange: 235,
  guardHalfAngle: 0.62, // ~71 degrees of cone
  cameraRange: 285,
  cameraHalfAngle: 0.5,
  sneakFactor: 0.5, // sneaking halves the suspicion build-up
  smokeFactor: 0, // inside smoke nobody can see the thief at all
};

// Suspicion (0-100 per guard) and the alarm (0-100 for the wing).
export const ALARM = {
  // Suspicion gained per second while the thief is inside a cone, scaled by closeness.
  suspicionRate: 95,
  suspicionDecay: 34, // per second while unseen
  chaseAt: 62, // suspicion above this: the guard gives chase
  alarmRiseSeen: 26, // alarm per second while any guard is sure of the thief
  alarmRiseCamera: 34, // alarm per second while a camera holds the thief
  alarmDecayHidden: 9, // alarm per second while nobody sees the thief
  lockdownGrace: 3.0, // seconds at alarm 100 before the bust lands
  empCost: 8, // alarm added by an EMP pulse
};

// Tools. Counts refill at the start of every wing.
export const TOOLS = {
  smokePerWing: 3,
  empPerWing: 2,
  smokeSeconds: 5,
  empFreezeSeconds: 6,
  lockpickSeconds: 3,
};

// Loot values in dollars, for the getaway payout tally.
export const LOOT_VALUE = {
  painting: 2400,
  sculpture: 3800,
  gold: 5000,
  diamond: 12000,
};

export const GHOST_BONUS = 2000; // never let the alarm pass 50 in a wing
export const TIME_BONUS_PER_SECOND = 25; // under the par time, each spare second pays

// Palette: deep-navy gallery, velvet-red carpet, gold frames, marble.
export const COLORS = {
  floor: '#141c33',
  floorDark: '#101728',
  carpet: '#6e1423',
  carpetEdge: '#a31621',
  wall: '#2a3352',
  wallTop: '#3b466e',
  marble: '#c9c4b8',
  gold: '#d4a437',
  goldBright: '#f2c14e',
  lootGlow: '#ffd76a',
  guardCone: 'rgba(255, 214, 90, 0.30)',
  guardConeHot: 'rgba(255, 80, 60, 0.38)',
  cameraCone: 'rgba(120, 200, 255, 0.26)',
  smoke: 'rgba(200, 200, 210, 0.55)',
  thief: '#7b5cff',
  thiefCloak: '#2c2350',
  guard: '#3d4b63',
  guardTrim: '#e8b64c',
  hud: '#0b0f1e',
  hudText: '#e8e4d8',
  alarmLow: '#58c472',
  alarmMid: '#e8b64c',
  alarmHigh: '#e5484d',
  exit: '#58c472',
};

// Keyboard bindings.
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sneak: ['ShiftLeft', 'ShiftRight'],
  smoke: ['KeyQ'],
  emp: ['KeyE'],
  lockpick: ['KeyF'],
  confirm: ['Space', 'Enter'],
  pause: ['KeyP', 'Escape'],
  restart: ['KeyR'],
  mute: ['KeyM'],
};
