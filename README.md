# VELVET VAULT — The Midnight Gallery Heist

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/meviusorg5799/velvet-vault-heist/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/meviusorg5799/velvet-vault-heist/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A top-down stealth heist game for the [make.fun best-heist-game-20261122-0559 bounty](https://make.fun/bounty/best-heist-game-20261122-0559). One midnight art gallery, three wings — the Sculpture Court, the Portrait Hall, and The Vault — stands between the thief and the Midnight Star diamond. Eight guards patrol with raycast vision cones, four security cameras sweep the halls, and every step the thief takes in the open pushes the alarm toward a lockdown. Lift every treasure, mind the cones, pick the vault, and reach the getaway van for a clean payout.

## How to play

Open `game/index.html` in a desktop browser (or serve `game/` with any static server). No build step, no network requests.

- **WASD / arrow keys** — move. **Shift** — sneak (slower, half as easy to spot). **Click** — walk to a spot.
- **Q** — smoke pellet: a cloud no cone can see through (3 per wing).
- **E** — EMP pulse: freezes every camera for 6 seconds, at +8 alarm (2 per wing).
- **F (hold)** — pick the vault lock (3 seconds beside the vault door).
- Walk close to a painting, sculpture, gold bars or the diamond to lift it. Steal everything in a wing and the exit opens.
- **P / Esc** — pause. **M** — mute. **R** — run the gallery again after a bust or a getaway.

The alarm climbs while a guard is sure of the thief or a camera holds them, and falls while they stay hidden. At 100 the wing locks down: break line of sight before the short grace runs out, or it is a bust. Dark corners halve how fast guards spot the thief; vents cut through the long partition walls. The win screen tallies the getaway payout: loot lifted, a speed bonus against each wing's par time, and a ghost bonus for every wing finished with the alarm never past 50.

## Files

- `game/` — the playable game: `index.html` plus `src/` modules split by job (`world.js` the state and the alarm, `guards.js` patrols and suspicion, `cameras.js` sweeps, `loot.js` the treasure, `levels.js` the three wings, `render.js` all the drawing, `geometry.js` raycast sight, `audio.js` WebAudio blips, `input.js` keyboard and mouse, `shots.js` the screenshot scenes and the headless self-test).
- `screenshots/` — four real renders of the game's own code: the cover (wing 1 mid-heist), the Portrait Hall, the open Vault, and the getaway payout.
- `main.ts` — the hand-in program (Node 22, standard library only): copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

All art is drawn procedurally on canvas and all names are original; nothing is copied from a commercial game.
