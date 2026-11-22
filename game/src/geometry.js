// Geometry for sight and movement: segment/rectangle tests the guards, cameras and
// the thief all share. Walls and display cases block both sight and bodies.
export function rectEdges(rect) {
  const { x, y, w, h } = rect;
  return [
    [[x, y], [x + w, y]],
    [[x + w, y], [x + w, y + h]],
    [[x + w, y + h], [x, y + h]],
    [[x, y + h], [x, y]],
  ];
}

/** All edges of every blocker rect, flattened once per wing. */
export function blockerEdges(blockers) {
  const edges = [];
  for (const rect of blockers) edges.push(...rectEdges(rect));
  return edges;
}

/** Distance from (ox, oy) along direction (dx, dy) to the first edge hit, or Infinity. */
export function rayHit(ox, oy, dx, dy, edges, maxDistance) {
  let best = maxDistance;
  for (const [[ax, ay], [bx, by]] of edges) {
    const ex = bx - ax;
    const ey = by - ay;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-9) continue; // ray parallel to this edge
    const t = ((ax - ox) * ey - (ay - oy) * ex) / denom;
    const u = ((ax - ox) * dy - (ay - oy) * dx) / denom;
    if (t > 0 && u >= 0 && u <= 1 && t < best) best = t;
  }
  return best;
}

/**
 * The visible polygon of a vision cone: rays fanned across the cone, each cut short
 * by the first wall or case it meets. Returns the polygon points, origin first.
 */
export function conePolygon(ox, oy, angle, halfAngle, range, edges) {
  const points = [[ox, oy]];
  const rays = 26;
  for (let i = 0; i <= rays; i++) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const d = rayHit(ox, oy, dx, dy, edges, range);
    points.push([ox + dx * d, oy + dy * d]);
  }
  return points;
}

/** True when the segment (x1,y1)-(x2,y2) crosses no blocker edge. */
export function lineOfSight(x1, y1, x2, y2, edges) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return true;
  const hit = rayHit(x1, y1, dx / dist, dy / dist, edges, dist - 0.01);
  return hit >= dist - 0.01;
}

/** True when (px, py) lies inside the cone from (ox, oy) with the given angle and range. */
export function insideCone(px, py, ox, oy, angle, halfAngle, range) {
  const dx = px - ox;
  const dy = py - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 1e-6) return true;
  let diff = Math.atan2(dy, dx) - angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return Math.abs(diff) <= halfAngle;
}

/** Push a circle (x, y, radius) out of every blocker rect it overlaps; returns the fixed position. */
export function collideCircle(x, y, radius, blockers) {
  for (const rect of blockers) {
    const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * radius;
      y = cy + (dy / d) * radius;
    } else {
      // Centre inside the rect: push out along the smallest penetration.
      const left = x - rect.x;
      const right = rect.x + rect.w - x;
      const top = y - rect.y;
      const bottom = rect.y + rect.h - y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) x = rect.x - radius;
      else if (min === right) x = rect.x + rect.w + radius;
      else if (min === top) y = rect.y - radius;
      else y = rect.y + rect.h + radius;
    }
  }
  return [x, y];
}

/** True when (x, y) lies inside any shadow (dark corner) rect. */
export function inShadow(x, y, shadows) {
  for (const s of shadows) {
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
  }
  return false;
}

/** True when (x, y) lies inside any smoke cloud. */
export function inSmoke(x, y, clouds) {
  for (const c of clouds) {
    if (Math.hypot(x - c.x, y - c.y) <= c.radius) return true;
  }
  return false;
}
