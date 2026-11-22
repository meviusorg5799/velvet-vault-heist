// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. Five screens: title, play,
// paused, busted and the getaway win screen.
//
// ?seed=N fixes the patrol pauses and loot shimmer. ?shot=cover|hall|vault|win
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. ?test=full plays the whole heist hands-free
// and writes the result into #test-result for the harness to read.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BUSTED,
  EVENT_GRAB,
  EVENT_LOCKDOWN,
  EVENT_SPOTTED,
  EVENT_UNLOCKED,
  EVENT_WING,
  EVENT_WIN,
  createWorld,
  loadWing,
  stepWorld,
  useEmp,
  useSmoke,
} from './world.js';
import { ACTION_CONFIRM, ACTION_EMP, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, ACTION_SMOKE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { runSelfTest, stageShot } from './shots.js';
import { createAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const test = params.get('test');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

// Every page error is collected here, so the headless play-test can report it.
window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message ?? event.error ?? 'unknown error'));
});
window.addEventListener('unhandledrejection', (event) => {
  window.__errors.push(`unhandled rejection: ${String(event.reason ?? 'unknown')}`);
});

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best take then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, readBest());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runTest() {
  const result = runSelfTest(world);
  result.errors = window.__errors;
  const node = document.getElementById('test-result');
  if (node) node.textContent = JSON.stringify(result);
  document.title = `TEST ${result.won ? 'WIN' : result.busted ? 'BUSTED' : 'TIMEOUT'} score=${result.score} grabs=${result.grabs} errors=${result.errors.length}`;
  window.__testResult = result;
  window.__testReady = true;
  // Paint the final state too, so a screenshot of the test page shows the ending.
  renderer.draw(world, world.won ? SCREEN_WIN : world.busted ? SCREEN_OVER : SCREEN_PLAY, readBest());
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  /** A fresh run from wing 1, score and clock reset. */
  function newRun() {
    world.score = 0;
    world.totalTime = 0;
    world.wingTimes = [];
    world.wingGhost = [];
    loadWing(world, 0);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. Wing 1, ${world.wing.name}. Steal everything, then reach the exit.`);
  }

  function endRun(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (won) {
      const total = world.score;
      if (total > best) {
        best = total;
        saveBest(best);
      }
      audio.win();
      announce(`Clean getaway. Total take $${total.toLocaleString('en-US')}.`);
    } else {
      audio.busted();
      announce('Busted. Press R to run the gallery again.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_WIN)) newRun();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) newRun();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) newRun();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_WIN) newRun();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (click && screen === SCREEN_TITLE) newRun();
    if (click && screen === SCREEN_PLAY && click.y > 64) world.clickTarget = click;
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_SMOKE && useSmoke(world)) audio.smoke();
      if (actions & ACTION_EMP && useEmp(world)) audio.emp();
    }
  }

  function step() {
    const dir = input.direction();
    const events = stepWorld(world, STEP, {
      dx: dir.dx,
      dy: dir.dy,
      sneak: dir.sneak,
      lockpick: dir.lockpick,
      click: null,
    });
    if (events & EVENT_GRAB) audio.grab();
    if (events & EVENT_SPOTTED) audio.spotted();
    if (events & EVENT_LOCKDOWN) audio.lockdown();
    if (events & EVENT_UNLOCKED) audio.unlock();
    if (events & EVENT_WING) audio.wing();
    if (events & EVENT_WIN) endRun(true);
    else if (events & EVENT_BUSTED) endRun(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Velvet Vault. Press Space or click to begin the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else if (test === 'full') runTest();
else runGame();
