// A tiny seeded random generator (mulberry32) so a ?seed=N run is reproducible:
// the same seed always deals the same patrol pauses and loot shimmer.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number in [min, max] from the seeded generator. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Pick one entry of `list` from the seeded generator. */
export function randomPick(random, list) {
  return list[Math.floor(random() * list.length)];
}
