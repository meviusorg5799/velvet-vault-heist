// The world: one wing at a time, the thief, the alarm, the tools and the score.
// One file, one job: it owns the state and advances it a fixed step at a time;
// guards.js, cameras.js and loot.js own their own pieces of it.
import { ALARM, FLOOR, GHOST_BONUS, STEP, THIEF, TIME_BONUS_PER_SECOND, TOOLS } from './config.js';
import { WINGS } from './levels.js';
import { createGuard, updateGuard } from './guards.js';
import { createCamera, freezeCameras, updateCamera } from './cameras.js';
import { allLootTaken, createLoot, grabLoot, lootValueTaken } from './loot.js';
import { blockerEdges, collideCircle } from './geometry.js';

export const EVENT_GRAB = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_LOCKDOWN = 4;
export const EVENT_BUSTED = 8;
export const EVENT_WING = 16;
export const EVENT_WIN = 32;
export const EVENT_SMOKE = 64;
export const EVENT_EMP = 128;
export const EVENT_UNLOCKED = 256;

/** A fresh world: wing 1 loaded, the thief at the door, the alarm at zero. */
export function createWorld(random) {
  const world = {
    random,
    wingIndex: 0,
    wing: null,
    blockers: [],
    edges: [],
    thief: { x: 0, y: 0, sneaking: false, moving: false, faceAngle: -Math.PI / 2 },
    guards: [],
    cameras: [],
    loot: [],
    smokeClouds: [],
    alarm: 0,
    maxAlarm: 0,
    lockdown: 0, // seconds of grace left at alarm 100; 0 when not locked down
    time: 0, // seconds in this wing
    totalTime: 0,
    score: 0, // dollars of loot lifted
    wingTimes: [],
    wingGhost: [],
    tools: { smoke: TOOLS.smokePerWing, emp: TOOLS.empPerWing },
    vaultUnlocked: false,
    lockpickProgress: 0,
    caughtBy: null,
    busted: false,
    won: false,
    toast: '',
    toastTime: 0,
    clickTarget: null,
  };
  loadWing(world, 0);
  return world;
}

/** Load wing `index`: fresh guards, cameras, loot, tools and alarm. */
export function loadWing(world, index) {
  const wing = WINGS[index];
  world.wingIndex = index;
  world.wing = wing;
  world.blockers = [...wing.blockers];
  if (wing.vaultDoor) world.blockers.push(wing.vaultDoor);
  world.edges = blockerEdges(world.blockers);
  world.thief.x = wing.spawn.x;
  world.thief.y = wing.spawn.y;
  world.thief.faceAngle = -Math.PI / 2;
  world.thief.sneaking = false;
  world.guards = wing.guards.map((def, i) => createGuard(def, i));
  world.cameras = wing.cameras.map((def, i) => createCamera(def, i));
  world.loot = wing.loot.map((def, i) => createLoot(def, i));
  world.smokeClouds = [];
  world.alarm = 0;
  world.maxAlarm = 0;
  world.lockdown = 0;
  world.time = 0;
  world.tools = { smoke: TOOLS.smokePerWing, emp: TOOLS.empPerWing };
  world.vaultUnlocked = false;
  world.lockpickProgress = 0;
  world.caughtBy = null;
  world.clickTarget = null;
}

/** The door the vault loot hides behind: a blocker until the lockpick opens it. */
function vaultDoorBlocker(world) {
  const door = world.wing.vaultDoor;
  return door && !world.vaultUnlocked ? door : null;
}

/** Advance the world one fixed step. `input` is {dx, dy, sneak, lockpick, click}. */
export function stepWorld(world, dt, input) {
  if (world.busted || world.won) return 0;
  let events = 0;
  world.time += dt;
  world.totalTime += dt;
  if (world.toastTime > 0) world.toastTime -= dt;

  // --- the thief ------------------------------------------------------------
  const thief = world.thief;
  thief.sneaking = input.sneak;
  let mx = input.dx;
  let my = input.dy;
  if ((mx === 0 && my === 0) && world.clickTarget) {
    const dx = world.clickTarget.x - thief.x;
    const dy = world.clickTarget.y - thief.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) world.clickTarget = null;
    else {
      mx = dx / dist;
      my = dy / dist;
    }
  }
  if (input.click) world.clickTarget = input.click;
  const speed = thief.sneaking ? THIEF.sneakSpeed : THIEF.speed;
  const len = Math.hypot(mx, my);
  thief.moving = len > 0;
  if (len > 0) {
    const nx = thief.x + (mx / len) * speed * dt;
    const ny = thief.y + (my / len) * speed * dt;
    const [fx, fy] = collideCircle(nx, ny, THIEF.radius, world.blockers);
    thief.x = Math.max(FLOOR.x + THIEF.radius, Math.min(FLOOR.x + FLOOR.width - THIEF.radius, fx));
    thief.y = Math.max(FLOOR.y + THIEF.radius, Math.min(FLOOR.y + FLOOR.height - THIEF.radius, fy));
    thief.faceAngle = Math.atan2(my, mx);
  }

  // --- smoke clouds ---------------------------------------------------------
  for (let i = world.smokeClouds.length - 1; i >= 0; i--) {
    world.smokeClouds[i].timeLeft -= dt;
    if (world.smokeClouds[i].timeLeft <= 0) world.smokeClouds.splice(i, 1);
  }

  // --- guards and cameras ---------------------------------------------------
  let guardSure = false;
  let cameraSees = false;
  for (const guard of world.guards) {
    const seen = updateGuard(guard, dt, thief, world);
    if (seen && guard.suspicion >= 50) guardSure = true;
    if (guard.suspicion >= 85) events |= EVENT_SPOTTED;
  }
  for (const camera of world.cameras) {
    if (updateCamera(camera, dt, thief, world)) cameraSees = true;
  }

  // --- the alarm ------------------------------------------------------------
  if (guardSure || cameraSees) {
    world.alarm += (guardSure ? ALARM.alarmRiseSeen : 0) * dt;
    if (cameraSees) world.alarm += ALARM.alarmRiseCamera * dt;
  } else {
    world.alarm -= ALARM.alarmDecayHidden * dt;
  }
  world.alarm = Math.max(0, Math.min(100, world.alarm));
  world.maxAlarm = Math.max(world.maxAlarm, world.alarm);

  if (world.alarm >= 100 && world.lockdown <= 0) {
    world.lockdown = ALARM.lockdownGrace;
    events |= EVENT_LOCKDOWN;
    setToast(world, 'LOCKDOWN! Break line of sight — NOW!');
  }
  if (world.lockdown > 0) {
    world.lockdown -= dt;
    if (world.alarm < 100) {
      world.lockdown = 0;
      setToast(world, 'Lockdown averted — stay out of the cones.');
    } else if (world.lockdown <= 0) {
      world.busted = true;
      world.caughtBy = 'the lockdown';
      return events | EVENT_BUSTED;
    }
  }

  // Caught by a guard's hands.
  if (world.caughtBy) {
    world.busted = true;
    return events | EVENT_BUSTED;
  }

  // --- loot -----------------------------------------------------------------
  const taken = grabLoot(world.loot, thief);
  if (taken.length > 0) {
    events |= EVENT_GRAB;
    world.score += taken.reduce((sum, loot) => sum + loot.value, 0);
    setToast(world, `Lifted ${taken.map((loot) => loot.name).join(', ')} — $${taken.reduce((s, l) => s + l.value, 0).toLocaleString('en-US')}`);
  }

  // --- the vault lockpick ---------------------------------------------------
  const door = vaultDoorBlocker(world);
  if (door && input.lockpick) {
    const doorCx = door.x + door.w / 2;
    const doorCy = door.y + door.h / 2;
    if (Math.hypot(thief.x - doorCx, thief.y - doorCy) < 80) {
      world.lockpickProgress += dt;
      if (world.lockpickProgress >= TOOLS.lockpickSeconds) {
        world.vaultUnlocked = true;
        world.blockers = world.blockers.filter((b) => b !== door);
        world.edges = blockerEdges(world.blockers);
        events |= EVENT_UNLOCKED;
        setToast(world, 'Vault open — the Midnight Star is yours to take.');
      }
    } else {
      world.lockpickProgress = Math.max(0, world.lockpickProgress - dt * 2);
    }
  } else {
    world.lockpickProgress = Math.max(0, world.lockpickProgress - dt * 2);
  }

  // --- the exit -------------------------------------------------------------
  const exit = world.wing.exit;
  if (
    allLootTaken(world.loot) &&
    thief.x >= exit.x && thief.x <= exit.x + exit.w &&
    thief.y >= exit.y && thief.y <= exit.y + exit.h
  ) {
    world.wingTimes.push(world.time);
    world.wingGhost.push(world.maxAlarm <= 50);
    if (world.wingIndex + 1 < WINGS.length) {
      loadWing(world, world.wingIndex + 1);
      setToast(world, `Wing clear — now the ${WINGS[world.wingIndex].name}.`);
      return events | EVENT_WING;
    }
    world.won = true;
    return events | EVENT_WIN;
  }
  return events;
}

/** Throw a smoke pellet at the thief's feet: cones cannot see through it. */
export function useSmoke(world) {
  if (world.busted || world.won) return 0;
  if (world.tools.smoke <= 0) {
    setToast(world, 'No smoke pellets left in this wing.');
    return 0;
  }
  world.tools.smoke -= 1;
  world.smokeClouds.push({ x: world.thief.x, y: world.thief.y, radius: 78, timeLeft: TOOLS.smokeSeconds });
  setToast(world, `Smoke out — ${world.tools.smoke} pellet${world.tools.smoke === 1 ? '' : 's'} left.`);
  return EVENT_SMOKE;
}

/** Fire an EMP pulse: every camera freezes, and the alarm jumps a little. */
export function useEmp(world) {
  if (world.busted || world.won) return 0;
  if (world.tools.emp <= 0) {
    setToast(world, 'No EMP charges left in this wing.');
    return 0;
  }
  world.tools.emp -= 1;
  freezeCameras(world.cameras, TOOLS.empFreezeSeconds);
  world.alarm = Math.min(100, world.alarm + ALARM.empCost);
  setToast(world, `EMP pulse — cameras dark for ${TOOLS.empFreezeSeconds}s. Alarm +${ALARM.empCost}.`);
  return EVENT_EMP;
}

/** The getaway payout: loot, spare-time bonus per wing, ghost bonus per quiet wing. */
export function payout(world) {
  let timeBonus = 0;
  for (let i = 0; i < world.wingTimes.length; i++) {
    timeBonus += Math.max(0, Math.floor(WINGS[i].parSeconds - world.wingTimes[i])) * TIME_BONUS_PER_SECOND;
  }
  const ghostBonus = world.wingGhost.filter(Boolean).length * GHOST_BONUS;
  return {
    loot: world.score,
    timeBonus,
    ghostBonus,
    total: world.score + timeBonus + ghostBonus,
    ghostWings: world.wingGhost.filter(Boolean).length,
  };
}

/** Loot still on the walls in this wing, and its value. */
export function lootRemaining(world) {
  return world.loot.filter((loot) => !loot.taken);
}

export function lootValueRemaining(world) {
  return lootRemaining(world).reduce((sum, loot) => sum + loot.value, 0);
}

function setToast(world, text) {
  world.toast = text;
  world.toastTime = 3.2;
}

export { STEP };
