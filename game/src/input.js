// Input: keyboard (WASD/arrows, Shift to sneak, Q smoke, E EMP, F hold to pick)
// and mouse (click the floor to walk there, click a button to press it).
// One file, one job: it reads the hardware and hands the loop clean actions.
import { KEYS } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_SMOKE = 8;
export const ACTION_EMP = 16;
export const ACTION_MUTE = 32;

/** True when the event's code is one of the listed bindings. */
function isKey(code, bindings) {
  return bindings.includes(code);
}

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let click = null; // {x, y} in canvas pixels, consumed by the next step

  function keyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    if (isKey(event.code, KEYS.confirm)) actions |= ACTION_CONFIRM;
    if (isKey(event.code, KEYS.pause)) actions |= ACTION_PAUSE;
    if (isKey(event.code, KEYS.restart)) actions |= ACTION_RESTART;
    if (isKey(event.code, KEYS.smoke)) actions |= ACTION_SMOKE;
    if (isKey(event.code, KEYS.emp)) actions |= ACTION_EMP;
    if (isKey(event.code, KEYS.mute)) actions |= ACTION_MUTE;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function keyUp(event) {
    held.delete(event.code);
  }

  function pointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    click = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('pointerdown', pointerDown);

  /** The movement direction this frame, from the keys held down. */
  function direction() {
    let dx = 0;
    let dy = 0;
    if (held.has('KeyA') || held.has('ArrowLeft')) dx -= 1;
    if (held.has('KeyD') || held.has('ArrowRight')) dx += 1;
    if (held.has('KeyW') || held.has('ArrowUp')) dy -= 1;
    if (held.has('KeyS') || held.has('ArrowDown')) dy += 1;
    return { dx, dy, sneak: held.has('ShiftLeft') || held.has('ShiftRight'), lockpick: held.has('KeyF') };
  }

  /** One-shot actions pressed since the last call; clears them. */
  function takeActions() {
    const out = actions;
    actions = 0;
    return out;
  }

  /** The last click point, if any; clears it. */
  function takeClick() {
    const out = click;
    click = null;
    return out;
  }

  return { direction, takeActions, takeClick };
}
