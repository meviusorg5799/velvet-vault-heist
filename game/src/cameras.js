// Security cameras: bolted to the wall, sweeping their cone back and forth on a
// fixed rhythm. A camera that holds the thief raises the alarm fast; an EMP pulse
// freezes it for a few seconds, at a small alarm cost.
import { ALARM, VISION } from './config.js';
import { conePolygon, inSmoke, insideCone, lineOfSight } from './geometry.js';

/** A live camera from a wing layout entry. */
export function createCamera(def, index) {
  return {
    index,
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    period: def.period,
    phase: index * 1.3, // cameras sweep out of step with each other
    angle: def.baseAngle,
    frozen: 0, // seconds of EMP freeze left
    radius: 10,
  };
}

/** Advance one camera a step; returns whether it currently sees the thief. */
export function updateCamera(camera, dt, thief, world) {
  if (camera.frozen > 0) {
    camera.frozen -= dt;
    return false;
  }
  const t = world.time + camera.phase;
  const swing = Math.sin((2 * Math.PI * t) / camera.period);
  camera.angle = camera.baseAngle + swing * camera.sweep;
  const hidden = inSmoke(thief.x, thief.y, world.smokeClouds);
  if (hidden) return false;
  return (
    insideCone(thief.x, thief.y, camera.x, camera.y, camera.angle, VISION.cameraHalfAngle, VISION.cameraRange) &&
    lineOfSight(camera.x, camera.y, thief.x, thief.y, world.edges)
  );
}

/** The camera's current vision cone polygon, for the renderer. */
export function cameraConePolygon(camera, edges) {
  if (camera.frozen > 0) return null;
  return conePolygon(camera.x, camera.y, camera.angle, VISION.cameraHalfAngle, VISION.cameraRange, edges);
}

/** Freeze every camera for `seconds` (an EMP pulse). */
export function freezeCameras(cameras, seconds) {
  for (const camera of cameras) camera.frozen = seconds;
}
