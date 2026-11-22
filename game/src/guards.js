// Guards: patrol the gallery on fixed rounds, watch with raycast vision cones, grow
// suspicious when the thief crosses a cone, and give chase once they are sure.
// A guard never sees through a wall, a case or a smoke cloud.
import { ALARM, THIEF, VISION } from './config.js';
import { collideCircle, conePolygon, inShadow, inSmoke, insideCone, lineOfSight } from './geometry.js';

/** A live guard from a wing layout entry. */
export function createGuard(def, index) {
  return {
    name: def.name,
    index,
    x: def.x,
    y: def.y,
    angle: 0,
    speed: def.speed,
    waypoints: def.waypoints,
    waypointIndex: 1,
    wait: 0,
    suspicion: 0,
    state: 'patrol', // patrol | chase | search
    lastSeenX: def.x,
    lastSeenY: def.y,
    searchTime: 0,
    radius: 12,
    pauseSeed: index * 0.7,
  };
}

/** Move one guard a step; returns whether the guard currently sees the thief. */
export function updateGuard(guard, dt, thief, world) {
  const edges = world.edges;
  const hidden = inSmoke(thief.x, thief.y, world.smokeClouds);
  const shadowed = inShadow(thief.x, thief.y, world.wing.shadows);
  const seen =
    !hidden &&
    insideCone(thief.x, thief.y, guard.x, guard.y, guard.angle, VISION.guardHalfAngle, VISION.guardRange) &&
    lineOfSight(guard.x, guard.y, thief.x, thief.y, edges);

  // Suspicion builds fast up close, slower far away, slower still in shadow or while sneaking.
  if (seen) {
    const dist = Math.hypot(thief.x - guard.x, thief.y - guard.y);
    const closeness = 1.35 - (dist / VISION.guardRange) * 0.7;
    let rate = ALARM.suspicionRate * closeness;
    if (shadowed) rate *= 0.5;
    if (thief.sneaking) rate *= VISION.sneakFactor;
    guard.suspicion = Math.min(100, guard.suspicion + rate * dt);
    guard.lastSeenX = thief.x;
    guard.lastSeenY = thief.y;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - ALARM.suspicionDecay * dt);
  }

  if (guard.suspicion >= ALARM.chaseAt) guard.state = 'chase';
  else if (guard.state === 'chase' && guard.suspicion < 25) {
    guard.state = 'search';
    guard.searchTime = 2.5;
  }

  const chaseSpeed = guard.speed * 1.55;
  if (guard.state === 'chase') {
    moveToward(guard, guard.lastSeenX, guard.lastSeenY, chaseSpeed, dt, world.blockers);
    if (Math.hypot(thief.x - guard.x, thief.y - guard.y) < THIEF.catchRadius + guard.radius) {
      world.caughtBy = guard.name;
    }
  } else if (guard.state === 'search') {
    guard.searchTime -= dt;
    moveToward(guard, guard.lastSeenX, guard.lastSeenY, guard.speed * 0.8, dt, world.blockers);
    if (guard.searchTime <= 0) guard.state = 'patrol';
  } else {
    // Patrol: walk the waypoints, pausing a beat at each end to look around.
    if (guard.wait > 0) {
      guard.wait -= dt;
      guard.angle += Math.sin(world.time * 1.4 + guard.pauseSeed) * 0.9 * dt;
    } else {
      const [wx, wy] = guard.waypoints[guard.waypointIndex];
      const arrived = moveToward(guard, wx, wy, guard.speed, dt, world.blockers);
      if (arrived) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.wait = 1.1;
      }
    }
  }
  return seen;
}

/** Step toward (tx, ty) at `speed`, facing the way we move; true when arrived. */
function moveToward(guard, tx, ty, speed, dt, blockers) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  const [fx, fy] = collideCircle(nx, ny, guard.radius, blockers);
  guard.x = fx;
  guard.y = fy;
  const targetAngle = Math.atan2(dy, dx);
  let diff = targetAngle - guard.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  guard.angle += diff * Math.min(1, 10 * dt);
  return step >= dist - 0.01;
}

/** The guard's current vision cone polygon, for the renderer. */
export function guardConePolygon(guard, edges) {
  return conePolygon(guard.x, guard.y, guard.angle, VISION.guardHalfAngle, VISION.guardRange, edges);
}

/** How alarmed the guard looks: 0 calm, 1 certain. */
export function guardAlertness(guard) {
  return guard.suspicion / 100;
}
