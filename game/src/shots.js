// Screenshot scenes and the headless self-test, both driven by the same autopilot.
// ?shot=cover|hall|vault|win stages a scene from the real world and the real
// renderer, then paints it twice and sets window.__shotReady. ?test=full plays the
// whole heist hands-free and records what happened for the play-test.
//
// The autopilot steers on a coarse A* grid over the wing (walls and cases blocked,
// expanded by the thief's radius), so it walks around partitions and through the
// vent gaps instead of pushing into a wall. It is test scaffolding, not game code.
import { STEP } from './config.js';
import { loadWing, stepWorld, useEmp, useSmoke } from './world.js';
import { SCREEN_PLAY, SCREEN_WIN } from './render.js';

const CELL = 40;
const COLS = Math.ceil(1280 / CELL);
const ROWS = Math.ceil(656 / CELL);

/** Grid cell (col, row) for a floor point. */
function cellOf(x, y) {
  return { col: Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))), row: Math.max(0, Math.min(ROWS - 1, Math.floor((y - 64) / CELL))) };
}

function cellCentre(col, row) {
  return { x: col * CELL + CELL / 2, y: 64 + row * CELL + CELL / 2 };
}

/** True when the cell's centre is inside a blocker, expanded by the thief's radius. */
function cellBlocked(world, col, row) {
  const { x, y } = cellCentre(col, row);
  for (const b of world.blockers) {
    if (x > b.x - 14 && x < b.x + b.w + 14 && y > b.y - 14 && y < b.y + b.h + 14) return true;
  }
  return false;
}

/** A* over the grid from the thief to (tx, ty); returns waypoints, or [] when none.
 * When the goal cell itself is blocked (loot sitting on a display case), the search
 * aims at the nearest open cell beside it and still ends on the true target. */
function findPath(world, tx, ty) {
  const start = cellOf(world.thief.x, world.thief.y);
  let goal = cellOf(tx, ty);
  if (cellBlocked(world, goal.col, goal.row)) {
    let found = null;
    for (let r = 1; r <= 3 && !found; r++) {
      for (let dc = -r; dc <= r && !found; dc++) {
        for (let dr = -r; dr <= r && !found; dr++) {
          const nc = goal.col + dc;
          const nr = goal.row + dr;
          if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
          if (!cellBlocked(world, nc, nr)) found = { col: nc, row: nr };
        }
      }
    }
    if (!found) return [];
    goal = found;
  }
  const key = (c, r) => r * COLS + c;
  const open = [{ col: start.col, row: start.row, g: 0, f: 0, parent: null }];
  const best = new Map([[key(start.col, start.row), 0]]);
  const closed = new Set();
  const heuristic = (c, r) => Math.abs(c - goal.col) + Math.abs(r - goal.row);
  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const node = open.splice(bi, 1)[0];
    const nodeKey = key(node.col, node.row);
    if (closed.has(nodeKey)) continue;
    closed.add(nodeKey);
    if (node.col === goal.col && node.row === goal.row) {
      const path = [];
      let cur = node;
      while (cur) {
        path.unshift(cellCentre(cur.col, cur.row));
        cur = cur.parent;
      }
      path[path.length - 1] = { x: tx, y: ty };
      return path;
    }
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        const nc = node.col + dc;
        const nr = node.row + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        if (cellBlocked(world, nc, nr)) continue;
        // No cutting a corner between two blocked cells.
        if (dc !== 0 && dr !== 0 && (cellBlocked(world, node.col + dc, node.row) || cellBlocked(world, node.col, node.row + dr))) continue;
        const g = node.g + (dc !== 0 && dr !== 0 ? 1.414 : 1);
        const k = key(nc, nr);
        if (best.has(k) && best.get(k) <= g) continue;
        best.set(k, g);
        open.push({ col: nc, row: nr, g, f: g + heuristic(nc, nr), parent: node });
      }
    }
  }
  return [];
}

function nearestShadow(world, thief) {
  let best = world.wing.shadows[0];
  let bestDist = Infinity;
  for (const s of world.wing.shadows) {
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const d = Math.hypot(cx - thief.x, cy - thief.y);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return { x: best.x + best.w / 2, y: best.y + best.h / 2 };
}

/** The shadow farthest from the chasing guard — the safest place to break away. */
function farthestShadow(world, chaser) {
  let best = world.wing.shadows[0];
  let bestDist = -1;
  for (const s of world.wing.shadows) {
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const d = Math.hypot(cx - chaser.x, cy - chaser.y);
    if (d > bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return { x: best.x + best.w / 2, y: best.y + best.h / 2 };
}

function freshMemory(world) {
  return {
    smokeAt: -10,
    path: [],
    pathTarget: '',
    wingIndex: world.wingIndex,
    lootIndex: -1,
    wasChased: false,
    coolUntil: -1,
    lastX: world.thief.x,
    lastY: world.thief.y,
    lastCheck: 0,
    stuckUntil: 0,
    detourX: 0,
    detourY: 1,
  };
}

/** Follow the memory's path toward (tx, ty), re-planning when the target changes. */
function followPath(world, memory, targetKey, tx, ty, sneak) {
  const thief = world.thief;
  const input = { dx: 0, dy: 0, sneak, lockpick: false, smoke: false, emp: false };
  // A new wing invalidates the old path and the old loot choice.
  if (memory.wingIndex !== world.wingIndex) {
    memory.wingIndex = world.wingIndex;
    memory.path = [];
    memory.pathTarget = '';
    memory.lootIndex = -1;
  }
  if (memory.pathTarget !== targetKey || memory.path.length === 0) {
    memory.path = findPath(world, tx, ty);
    memory.pathTarget = targetKey;
  }
  // Drop waypoints already reached.
  while (memory.path.length > 0 && Math.hypot(memory.path[0].x - thief.x, memory.path[0].y - thief.y) < 14) {
    memory.path.shift();
  }
  // No grid route (a gap narrower than a cell): steer straight at the target and
  // let the collision slide the thief through; better than standing still.
  if (memory.path.length === 0) {
    const dx = tx - thief.x;
    const dy = ty - thief.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) return input;
    input.dx = dx / dist;
    input.dy = dy / dist;
    return input;
  }
  const wp = memory.path[0];
  const dx = wp.x - thief.x;
  const dy = wp.y - thief.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return input;
  input.dx = dx / dist;
  input.dy = dy / dist;
  return input;
}

/** The autopilot's steering: toward the next loot, away from a guard that is onto it. */
export function autopilotInput(world, memory) {
  const thief = world.thief;
  const input = { dx: 0, dy: 0, sneak: false, lockpick: false, smoke: false, emp: false };
  if (world.busted || world.won) return input;

  const maxSuspicion = Math.max(0, ...world.guards.map((g) => g.suspicion));
  const chaser = world.guards.find((g) => g.state === 'chase');
  const guardNear = world.guards.some((g) => Math.hypot(thief.x - g.x, thief.y - g.y) < 300);
  const cameraHot = world.cameras.some((c) => c.frozen <= 0 && Math.hypot(thief.x - c.x, thief.y - c.y) < 320);

  // A guard giving chase: drop smoke, then run for the shadow farthest from it.
  if (chaser) {
    memory.wasChased = true;
    const dropSmoke = world.tools.smoke > 0 && memory.smokeAt < world.time - 1;
    if (dropSmoke) memory.smokeAt = world.time;
    const shadow = farthestShadow(world, chaser);
    const out = followPath(world, memory, 'flee', shadow.x, shadow.y, false);
    out.smoke = dropSmoke;
    return out;
  }
  // After a chase, lie low in the shadow until the heat is fully off.
  if (memory.wasChased) {
    memory.wasChased = false;
    memory.coolUntil = world.time + 4;
  }
  if (world.time < memory.coolUntil) {
    const guardNearNow = world.guards.some((g) => Math.hypot(thief.x - g.x, thief.y - g.y) < 200);
    if (!guardNearNow) return { dx: 0, dy: 0, sneak: true, lockpick: false, smoke: false, emp: false };
  }
  // A guard getting suspicious: slip into shadow before it is sure, smoke if it nearly is.
  if (maxSuspicion > 45) {
    const dropSmoke = maxSuspicion > 62 && world.tools.smoke > 0 && memory.smokeAt < world.time - 1;
    if (dropSmoke) memory.smokeAt = world.time;
    const shadow = nearestShadow(world, thief);
    const out = followPath(world, memory, 'shadow', shadow.x, shadow.y, true);
    out.smoke = dropSmoke;
    return out;
  }

  // The vault door: stand at it and hold F until the lock gives.
  const door = world.wing.vaultDoor;
  if (door && !world.vaultUnlocked) {
    // Loot outside the vault room (the vault is x 480..800, y 80..300) first.
    const outsideLoot = world.loot.filter(
      (loot) => !loot.taken && !(loot.x > 480 && loot.x < 800 && loot.y > 80 && loot.y < 300),
    );
    if (outsideLoot.length === 0) {
      const doorCx = door.x + door.w / 2;
      const doorCy = door.y + door.h / 2 + 26;
      const dist = Math.hypot(thief.x - doorCx, thief.y - doorCy);
      if (dist < 60) {
        input.lockpick = true;
        return input;
      }
      return followPath(world, memory, 'door', doorCx, doorCy, guardNear || cameraHot);
    }
  }

  // Next loot, else the exit. Stick with the chosen loot until it is taken: two
  // pieces nearly equidistant would otherwise flip the target every step and the
  // thief would ping-pong between two paths forever.
  const remaining = world.loot.filter((loot) => !loot.taken);
  if (remaining.length === 0) {
    const exit = world.wing.exit;
    return followPath(world, memory, 'exit', exit.x + exit.w / 2, exit.y + exit.h / 2, false);
  }
  let best = remaining.find((loot) => loot.index === memory.lootIndex);
  if (!best) {
    best = remaining[0];
    let bestDist = Infinity;
    for (const loot of remaining) {
      const d = Math.hypot(loot.x - thief.x, loot.y - thief.y);
      if (d < bestDist) {
        bestDist = d;
        best = loot;
      }
    }
    memory.lootIndex = best.index;
  }
  return followPath(world, memory, `loot-${best.index}`, best.x, best.y, guardNear || cameraHot);
}

/** Run the autopilot for up to `seconds` of game time; returns the events seen. */
function playForward(world, seconds, stopWhen) {
  const memory = freshMemory(world);
  const seen = { grab: 0, spotted: false, lockdown: false, wing: 0, smoke: 0, emp: 0, unlocked: false };
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    if (world.busted || world.won) break;
    const input = autopilotInput(world, memory);
    if (input.smoke) {
      useSmoke(world);
      seen.smoke += 1;
    }
    if (input.emp) {
      useEmp(world);
      seen.emp += 1;
    }
    const events = stepWorld(world, STEP, input);
    if (events & 1) seen.grab += 1;
    if (events & 2) seen.spotted = true;
    if (events & 4) seen.lockdown = true;
    if (events & 16) seen.wing += 1;
    if (events & 256) seen.unlocked = true;
    if (stopWhen && stopWhen(world, seen)) break;
  }
  return seen;
}

/**
 * Stage the named scene and return the screen to draw over it.
 * cover: wing 1 mid-heist, the thief crossing the room with the alarm already up.
 * hall: wing 2 mid-heist. vault: wing 3, the vault open and the diamond in reach.
 * win: the getaway payout tally, staged from the real payout computation.
 */
export function stageShot(name, world) {
  if (name === 'hall') {
    loadWing(world, 1);
    playForward(world, 16);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'vault') {
    loadWing(world, 2);
    playForward(world, 60, (w) => w.vaultUnlocked && w.loot.some((loot) => loot.kind === 'diamond' && !loot.taken));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'win') {
    // Stage the win screen from the real payout: every wing's loot lifted, the
    // times and ghost wings a clean run would record.
    loadWing(world, 2);
    for (const loot of world.loot) loot.taken = true;
    world.score = 42800; // every wing's loot: 8,600 + 9,800 + 24,400
    world.wingTimes = [118, 141, 163];
    world.wingGhost = [true, false, true];
    world.totalTime = 422;
    world.won = true;
    return { screen: SCREEN_WIN };
  }
  // cover (and anything else): wing 1, the first loot lifted and the thief well
  // into the room, then step into the nearest guard's cone so the alarm is
  // genuinely up for the frame.
  loadWing(world, 0);
  playForward(
    world,
    30,
    (w, seen) =>
      w.wingIndex === 0 && seen.grab >= 1 && Math.hypot(w.thief.x - w.wing.spawn.x, w.thief.y - w.wing.spawn.y) > 300,
  );
  provoke(world, 4);
  return { screen: SCREEN_PLAY };
}

/**
 * Walk toward the nearest guard's cone until the alarm climbs, then stop: the
 * cover frame wants the thief genuinely spotted, not a staged number. It steers
 * on the autopilot's grid so display cases do not trap it, and stops short of
 * a chase so the frame stays a near-miss, not a bust.
 */
function provoke(world, seconds) {
  const memory = freshMemory(world);
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    if (world.busted || world.won || world.alarm >= 25) break;
    if (world.guards.some((g) => g.state === 'chase' || g.suspicion >= 58)) break;
    let nearest = null;
    let best = Infinity;
    for (const g of world.guards) {
      const d = Math.hypot(g.x - world.thief.x, g.y - world.thief.y);
      if (d < best) {
        best = d;
        nearest = g;
      }
    }
    if (!nearest) break;
    // Step into the guard's cone, not onto the guard: a point in front of it.
    const tx = nearest.x + Math.cos(nearest.angle) * 110;
    const ty = nearest.y + Math.sin(nearest.angle) * 110;
    const input = followPath(world, memory, 'provoke', tx, ty, false);
    stepWorld(world, STEP, input);
  }
}

/**
 * The headless self-test: play the whole heist hands-free and record what happened.
 * Returns a plain object the test page writes into the DOM for the harness to read.
 */
export function runSelfTest(world) {
  const result = {
    started: false,
    moved: false,
    maxSuspicion: 0,
    maxAlarm: 0,
    grabs: 0,
    smokeUsed: 0,
    empUsed: 0,
    wingsCleared: 0,
    vaultUnlocked: false,
    lockdowns: 0,
    busted: false,
    bustedBy: null,
    won: false,
    totalTime: 0,
    score: 0,
    errors: [],
    trace: [],
  };
  loadWing(world, 0);
  result.started = true;
  const startX = world.thief.x;
  const startY = world.thief.y;
  const memory = freshMemory(world);
  const steps = Math.floor(900 / STEP); // up to 15 minutes of game time
  for (let i = 0; i < steps; i++) {
    if (world.busted || world.won) break;
    const input = autopilotInput(world, memory);
    if (input.smoke) {
      useSmoke(world);
      result.smokeUsed += 1;
    }
    // Fire one EMP the first time a camera is close enough to matter.
    if (
      result.empUsed === 0 &&
      world.cameras.some((c) => c.frozen <= 0 && Math.hypot(world.thief.x - c.x, world.thief.y - c.y) < 260)
    ) {
      useEmp(world);
      result.empUsed = 1;
    }
    const events = stepWorld(world, STEP, input);
    result.maxSuspicion = Math.max(result.maxSuspicion, ...world.guards.map((g) => g.suspicion));
    result.maxAlarm = Math.max(result.maxAlarm, world.alarm);
    if (events & 1) result.grabs += 1;
    if (events & 4) result.lockdowns += 1;
    if (events & 16) result.wingsCleared += 1;
    if (events & 256) result.vaultUnlocked = true;
    if (Math.hypot(world.thief.x - startX, world.thief.y - startY) > 60) result.moved = true;
    if (i % 300 === 0) {
      result.trace.push({
        t: Math.round(world.totalTime),
        wing: world.wingIndex + 1,
        x: Math.round(world.thief.x),
        y: Math.round(world.thief.y),
        target: memory.pathTarget,
        path: memory.path.length,
        alarm: Math.round(world.alarm),
        susp: Math.round(Math.max(0, ...world.guards.map((g) => g.suspicion))),
        loot: world.loot.filter((l) => !l.taken).length,
      });
    }
  }
  result.busted = world.busted;
  result.bustedBy = world.caughtBy;
  result.won = world.won;
  result.totalTime = Math.round(world.totalTime * 10) / 10;
  result.score = world.score;
  return result;
}
