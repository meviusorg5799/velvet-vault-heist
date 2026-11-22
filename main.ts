// VELVET VAULT — the hand-in program (Node 22, standard library only).
//
// The game lives in this directory's game/ folder: plain static files that any
// desktop browser loads offline (game/index.html plus its ES modules, no library,
// no network request). This program hands the entry in: it copies game/ and
// screenshots/ from beside this file into the output directory and writes
// dossier.json there, the summary the judge reads, using the vendored make.fun
// library (vendor/makefun-game.ts, the kit's copy, unchanged).
//
// The grader runs it twice in a fresh container with a read-only repository and
// a writable /output; outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output, so a local check is:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, from the bounty's gate: only text_max_bytes shapes the
// bytes written; the rest refuse an entry the scorer would refuse anyway.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/**
 * Fail loudly, before any dossier is written, when the screenshots are not the
 * 3 or 4 renders the gate accepts. buildDossier would refuse them too, but a
 * plain message here says which file is at fault instead of a cap name.
 */
function checkScreenshots(dir) {
  if (!existsSync(dir)) throw new Error('screenshots/: no such directory — an entry hands in 3 or 4 renders of its game');
  const names = readdirSync(dir).filter((name) => !name.startsWith('.'));
  if (names.length < 3 || names.length > CAPS.screenshots.max) {
    throw new Error(`screenshots/: holds ${names.length} images, an entry hands in 3 or 4`);
  }
  for (const name of names) {
    const size = statSync(join(dir, name)).size;
    if (size > CAPS.screenshots.max_bytes) {
      throw new Error(`screenshots/${name}: ${size} bytes, over the ${CAPS.screenshots.max_bytes} allowed`);
    }
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
checkScreenshots(join(out, 'screenshots'));

writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));
