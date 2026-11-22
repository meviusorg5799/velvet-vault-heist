// Loot: the paintings, sculpture, gold bars and diamond the thief came for.
// Each piece glows so it reads at a glance; walking close enough lifts it.
import { LOOT_VALUE, THIEF } from './config.js';

/** A live loot piece from a wing layout entry. */
export function createLoot(def, index) {
  return {
    index,
    kind: def.kind,
    name: def.name,
    x: def.x,
    y: def.y,
    value: LOOT_VALUE[def.kind] ?? 1000,
    taken: false,
    glowPhase: index * 1.7,
  };
}

/**
 * Lift every loot piece the thief stands close enough to; returns the pieces taken
 * this step, so the world can score them and play the grab sound.
 */
export function grabLoot(lootList, thief) {
  const taken = [];
  for (const loot of lootList) {
    if (loot.taken) continue;
    if (Math.hypot(loot.x - thief.x, loot.y - thief.y) <= THIEF.grabRadius) {
      loot.taken = true;
      taken.push(loot);
    }
  }
  return taken;
}

/** True when every loot piece in the wing is taken. */
export function allLootTaken(lootList) {
  return lootList.every((loot) => loot.taken);
}

/** The value of the loot taken so far in this wing. */
export function lootValueTaken(lootList) {
  return lootList.filter((loot) => loot.taken).reduce((sum, loot) => sum + loot.value, 0);
}
