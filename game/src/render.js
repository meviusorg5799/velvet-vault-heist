// The renderer: every pixel of the gallery — navy floor, velvet carpet, gold frames,
// marble columns, raycast vision cones, the thief, the HUD and the screens.
// One file, one job: it paints a world state and never changes it.
import { COLORS, FLOOR, THIEF, VIEW } from './config.js';
import { cameraConePolygon } from './cameras.js';
import { guardConePolygon } from './guards.js';
import { payout as computePayout } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PAINTING_COLORS = [
  ['#7b2d5e', '#e8b64c', '#2d5e7b'],
  ['#1d4e5e', '#d4a437', '#6e1423'],
  ['#3d2d5e', '#58c472', '#e8b64c'],
];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;

  function draw(world, screen, best) {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    drawGallery(world);
    if (screen === SCREEN_TITLE) drawTitle(world, best);
    else if (screen === SCREEN_PAUSED) drawPaused(world);
    else if (screen === SCREEN_OVER) drawBusted(world);
    else if (screen === SCREEN_WIN) drawWin(world);
    else drawHud(world);
    if (screen === SCREEN_PLAY && world.toastTime > 0) drawToast(world);
  }

  // --- the room --------------------------------------------------------------
  function drawGallery(world) {
    const wing = world.wing;
    // Floor: deep-navy marble tiles.
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = COLORS.floorDark;
    const tile = 80;
    for (let y = FLOOR.y; y < FLOOR.y + FLOOR.height; y += tile) {
      for (let x = 0; x < FLOOR.width; x += tile) {
        if (((x / tile) + (y / tile)) % 2 === 0) ctx.fillRect(x, y, tile, tile);
      }
    }
    // Velvet carpet runner with a gold border.
    const c = wing.carpet;
    ctx.fillStyle = COLORS.carpet;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = COLORS.carpetEdge;
    ctx.lineWidth = 4;
    ctx.strokeRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
    ctx.fillStyle = COLORS.gold;
    for (let y = c.y + 30; y < c.y + c.h - 20; y += 56) {
      ctx.save();
      ctx.translate(c.x + c.w / 2, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
    }
    // Dark corners where the thief is hard to spot.
    for (const s of wing.shadows) {
      ctx.fillStyle = 'rgba(4, 6, 16, 0.55)';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = 'rgba(180, 190, 220, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = 'rgba(200, 205, 230, 0.6)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DARK CORNER', s.x + s.w / 2, s.y + s.h - 8);
    }
    // Vents: grates in the wall gaps, a second route through.
    for (const v of wing.vents) {
      ctx.fillStyle = '#232a42';
      ctx.fillRect(v.x, v.y - 2, v.w, v.h + 4);
      ctx.strokeStyle = '#8a93ad';
      ctx.lineWidth = 2;
      for (let x = v.x + 8; x < v.x + v.w - 4; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, v.y - 1);
        ctx.lineTo(x, v.y + v.h + 1);
        ctx.stroke();
      }
      ctx.fillStyle = '#8a93ad';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VENT', v.x + v.w / 2, v.y + v.h + 14);
    }
    // Exit / getaway van.
    drawExit(world);
    // Loot, glowing so it reads at a glance.
    for (const loot of world.loot) drawLoot(loot, world.time);
    // Display cases: glass boxes on marble plinths.
    for (const box of wing.cases) {
      ctx.fillStyle = COLORS.marble;
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = 'rgba(160, 200, 230, 0.35)';
      ctx.fillRect(box.x + 4, box.y + 4, box.w - 8, box.h - 8);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.w, box.h);
    }
    // Marble columns.
    for (const col of wing.columns) {
      ctx.fillStyle = COLORS.marble;
      ctx.fillRect(col.x, col.y, col.w, col.h);
      ctx.fillStyle = '#8f887a';
      ctx.fillRect(col.x + 5, col.y, 3, col.h);
      ctx.fillRect(col.x + col.w - 8, col.y, 3, col.h);
    }
    // Walls: slate with a gold picture rail.
    for (const wall of wing.walls) {
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = COLORS.wallTop;
      ctx.fillRect(wall.x, wall.y, wall.w, 3);
    }
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 100);
    ctx.lineTo(1264, 100);
    ctx.stroke();
    // The vault door, when there is one.
    if (wing.vaultDoor) drawVaultDoor(world);
    // Vision cones: guards warm, cameras cool.
    for (const camera of world.cameras) {
      const poly = cameraConePolygon(camera, world.edges);
      if (poly) fillPolygon(poly, COLORS.cameraCone);
    }
    for (const guard of world.guards) {
      const poly = guardConePolygon(guard, world.edges);
      fillPolygon(poly, guard.suspicion > 50 ? COLORS.guardConeHot : COLORS.guardCone);
    }
    // Smoke clouds hide the thief from every cone.
    for (const cloud of world.smokeClouds) {
      const alpha = Math.min(1, cloud.timeLeft);
      ctx.fillStyle = `rgba(200, 200, 210, ${0.55 * alpha})`;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(220, 220, 230, ${0.4 * alpha})`;
      ctx.beginPath();
      ctx.arc(cloud.x - 22, cloud.y + 10, cloud.radius * 0.55, 0, Math.PI * 2);
      ctx.arc(cloud.x + 24, cloud.y - 12, cloud.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cameras and guards stand above their cones; the thief above all.
    for (const camera of world.cameras) drawCamera(camera);
    for (const guard of world.guards) drawGuard(guard, world.time);
    drawThief(world);
    // Lockpick progress ring around the thief.
    if (world.lockpickProgress > 0 && !world.vaultUnlocked) {
      const p = world.lockpickProgress / 3;
      ctx.strokeStyle = COLORS.goldBright;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(world.thief.x, world.thief.y, 24, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = COLORS.goldBright;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PICKING LOCK…', world.thief.x, world.thief.y - 32);
    }
  }

  function fillPolygon(points, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawExit(world) {
    const exit = world.wing.exit;
    const open = world.loot.every((loot) => loot.taken);
    ctx.fillStyle = open ? COLORS.exit : '#3a4a3f';
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 3;
    ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);
    ctx.fillStyle = open ? '#0b0f1e' : '#c9c4b8';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(exit.label, exit.x + exit.w / 2, exit.y + exit.h / 2 - 2);
    ctx.font = '10px sans-serif';
    ctx.fillText(open ? 'ALL LOOT — GO!' : 'NEEDS ALL LOOT', exit.x + exit.w / 2, exit.y + exit.h / 2 + 13);
    if (world.wingIndex === 2 && open) {
      // The getaway van: a dark van silhouette parked at the door.
      ctx.fillStyle = '#1c2438';
      ctx.fillRect(exit.x - 8, exit.y - 26, exit.w + 16, 26);
      ctx.fillStyle = '#8a93ad';
      ctx.fillRect(exit.x + 8, exit.y - 20, 26, 14);
      ctx.fillRect(exit.x + exit.w - 34, exit.y - 20, 26, 14);
    }
  }

  function drawVaultDoor(world) {
    const door = world.wing.vaultDoor;
    if (world.vaultUnlocked) {
      ctx.fillStyle = '#0a0e1c';
      ctx.fillRect(door.x, door.y - 2, door.w, door.h + 4);
      ctx.fillStyle = COLORS.exit;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OPEN', door.x + door.w / 2, door.y - 10);
      return;
    }
    ctx.fillStyle = '#4a4f5e';
    ctx.fillRect(door.x, door.y - 2, door.w, door.h + 4);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(door.x, door.y - 2, door.w, door.h + 4);
    ctx.fillStyle = COLORS.goldBright;
    ctx.beginPath();
    ctx.arc(door.x + door.w / 2, door.y + door.h / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.goldBright;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VAULT — HOLD F TO PICK', door.x + door.w / 2, door.y + door.h + 16);
  }

  function drawLoot(loot, time) {
    if (loot.taken) return;
    const pulse = 0.55 + 0.35 * Math.sin(time * 3 + loot.glowPhase);
    const glow = ctx.createRadialGradient(loot.x, loot.y, 4, loot.x, loot.y, 62);
    glow.addColorStop(0, `rgba(255, 215, 106, ${0.5 * pulse})`);
    glow.addColorStop(1, 'rgba(255, 215, 106, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(loot.x, loot.y, 62, 0, Math.PI * 2);
    ctx.fill();
    if (loot.kind === 'painting') {
      const palette = PAINTING_COLORS[loot.index % PAINTING_COLORS.length];
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(loot.x - 34, loot.y - 24, 68, 48);
      ctx.fillStyle = palette[0];
      ctx.fillRect(loot.x - 29, loot.y - 19, 58, 38);
      ctx.fillStyle = palette[1];
      ctx.beginPath();
      ctx.arc(loot.x - 8, loot.y - 2, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette[2];
      ctx.fillRect(loot.x + 6, loot.y + 4, 18, 10);
    } else if (loot.kind === 'sculpture') {
      ctx.fillStyle = COLORS.marble;
      ctx.fillRect(loot.x - 16, loot.y + 8, 32, 10);
      ctx.beginPath();
      ctx.arc(loot.x, loot.y - 2, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(loot.x - 12, loot.y - 8);
      ctx.lineTo(loot.x - 16, loot.y - 22);
      ctx.lineTo(loot.x - 4, loot.y - 12);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(loot.x + 12, loot.y - 8);
      ctx.lineTo(loot.x + 16, loot.y - 22);
      ctx.lineTo(loot.x + 4, loot.y - 12);
      ctx.closePath();
      ctx.fill();
    } else if (loot.kind === 'gold') {
      ctx.fillStyle = COLORS.gold;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(loot.x - 20 + i * 6, loot.y + 8 - i * 8, 26, 9);
      }
      ctx.fillStyle = COLORS.goldBright;
      ctx.fillRect(loot.x - 20, loot.y, 26, 3);
    } else {
      // The Midnight Star diamond: a faceted stone that throws light.
      ctx.save();
      ctx.translate(loot.x, loot.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#bfe8ff';
      ctx.fillRect(-16, -16, 32, 32);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-16, -16, 32, 32);
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(16, 0);
      ctx.moveTo(0, -16);
      ctx.lineTo(0, 16);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(loot.x - 6, loot.y - 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.goldBright;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    const label = `${loot.name.toUpperCase()} — $${loot.value.toLocaleString('en-US')}`;
    const labelWidth = ctx.measureText(label).width;
    const labelX = Math.max(labelWidth / 2 + 8, Math.min(VIEW.width - labelWidth / 2 - 8, loot.x));
    ctx.fillStyle = 'rgba(11, 15, 30, 0.82)';
    ctx.fillRect(labelX - labelWidth / 2 - 6, loot.y + 32, labelWidth + 12, 18);
    ctx.fillStyle = COLORS.goldBright;
    ctx.fillText(label, labelX, loot.y + 44);
  }

  function drawCamera(camera) {
    ctx.fillStyle = camera.frozen > 0 ? '#5a6478' : '#2a3352';
    ctx.fillRect(camera.x - 10, camera.y - 8, 20, 16);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(camera.x - 10, camera.y - 8, 20, 16);
    const lx = camera.x + Math.cos(camera.angle) * 14;
    const ly = camera.y + Math.sin(camera.angle) * 14;
    ctx.fillStyle = camera.frozen > 0 ? '#8a93ad' : '#ff5a4d';
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fill();
    if (camera.frozen > 0) {
      ctx.fillStyle = '#bcd6ff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EMP', camera.x, camera.y - 14);
    } else {
      ctx.fillStyle = '#9fb6e8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CAMERA', camera.x, camera.y - 14);
    }
  }

  function drawGuard(guard, time) {
    // Body: a dark uniform with a gold trim, facing the patrol direction.
    ctx.fillStyle = COLORS.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.guardTrim;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#1c2438';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 6, 0, Math.PI * 2);
    ctx.fill();
    const fx = guard.x + Math.cos(guard.angle) * (guard.radius + 4);
    const fy = guard.y + Math.sin(guard.angle) * (guard.radius + 4);
    ctx.strokeStyle = '#e8e4d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    // Suspicion arc above the head, and a mark when the guard is onto the thief.
    if (guard.suspicion > 2) {
      ctx.strokeStyle = guard.suspicion > 50 ? '#ff5a4d' : COLORS.goldBright;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, guard.radius + 8, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    if (guard.state === 'chase') {
      ctx.fillStyle = '#ff5a4d';
      ctx.fillText('!', guard.x, guard.y - guard.radius - 12);
    } else if (guard.suspicion > 30) {
      ctx.fillStyle = COLORS.goldBright;
      ctx.fillText('?', guard.x, guard.y - guard.radius - 12);
    }
    ctx.fillStyle = '#c9c4b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(guard.name.toUpperCase(), guard.x, guard.y + guard.radius + 13);
  }

  function drawThief(world) {
    const thief = world.thief;
    // A hooded figure in a violet cloak, gold mask glinting.
    ctx.fillStyle = COLORS.thiefCloak;
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, THIEF.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.thief;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = COLORS.thief;
    ctx.beginPath();
    ctx.moveTo(thief.x, thief.y - THIEF.radius - 4);
    ctx.lineTo(thief.x - 8, thief.y - 2);
    ctx.lineTo(thief.x + 8, thief.y - 2);
    ctx.closePath();
    ctx.fill();
    const fx = thief.x + Math.cos(thief.faceAngle) * (THIEF.radius + 3);
    const fy = thief.y + Math.sin(thief.faceAngle) * (THIEF.radius + 3);
    ctx.fillStyle = COLORS.goldBright;
    ctx.beginPath();
    ctx.arc(fx, fy, 3, 0, Math.PI * 2);
    ctx.fill();
    if (thief.sneaking) {
      ctx.strokeStyle = 'rgba(180, 190, 220, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(thief.x, thief.y, THIEF.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', thief.x, thief.y + THIEF.radius + 13);
  }

  // --- the HUD -----------------------------------------------------------------
  function drawHud(world) {
    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(0, 0, VIEW.width, 64);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(0, 62, VIEW.width, 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`VELVET VAULT`, 16, 26);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#9fb6e8';
    ctx.fillText(`Wing ${world.wingIndex + 1}/3 — ${world.wing.name}`, 16, 46);
    // The alarm meter, centre stage.
    const ax = 400;
    const ay = 16;
    const aw = 340;
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALARM', ax, ay + 12);
    ctx.fillStyle = '#232a42';
    ctx.fillRect(ax + 62, ay, aw - 62, 18);
    const alarmColor = world.alarm < 35 ? COLORS.alarmLow : world.alarm < 70 ? COLORS.alarmMid : COLORS.alarmHigh;
    ctx.fillStyle = alarmColor;
    ctx.fillRect(ax + 62, ay, (aw - 62) * (world.alarm / 100), 18);
    ctx.strokeStyle = '#e8e4d8';
    ctx.lineWidth = 1;
    ctx.strokeRect(ax + 62, ay, aw - 62, 18);
    ctx.strokeStyle = '#0b0f1e';
    ctx.lineWidth = 3;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    const alarmText = `${Math.round(world.alarm)}`;
    if (world.alarm > 8) {
      ctx.strokeText(alarmText, ax + 62 + (aw - 62) / 2, ay + 13);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(alarmText, ax + 62 + (aw - 62) / 2, ay + 13);
    }
    ctx.fillStyle = world.alarm >= 100 ? COLORS.alarmHigh : '#9fb6e8';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(world.lockdown > 0 ? `LOCKDOWN ${world.lockdown.toFixed(1)}s — HIDE!` : world.alarm >= 70 ? 'THEY ARE ONTO YOU' : 'UNSEEN', ax, ay + 36);
    // Loot, tools and the clock on the right.
    const taken = world.loot.filter((loot) => loot.taken).length;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.goldBright;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`LOOT $${world.score.toLocaleString('en-US')}  ${taken}/${world.loot.length}`, 1264, 26);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '13px sans-serif';
    ctx.fillText(`Q smoke ×${world.tools.smoke}   E EMP ×${world.tools.emp}   ${formatTime(world.totalTime)}`, 1264, 46);
    // Hint line under the bar.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7c86a3';
    ctx.font = '11px sans-serif';
    const remaining = world.loot.filter((loot) => !loot.taken);
    const hint = remaining.length > 0
      ? `Steal: ${remaining.map((loot) => loot.name).join(' · ')} — WASD move · Shift sneak · Q smoke · E EMP · F pick the vault · click to walk`
      : 'All loot taken — reach the green exit!';
    ctx.fillText(hint, VIEW.width / 2, VIEW.height - 10);
  }

  function drawToast(world) {
    ctx.font = 'bold 16px sans-serif';
    const w = ctx.measureText(world.toast).width + 28;
    ctx.fillStyle = 'rgba(11, 15, 30, 0.88)';
    ctx.fillRect(VIEW.width / 2 - w / 2, 76, w, 34);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(VIEW.width / 2 - w / 2, 76, w, 34);
    ctx.fillStyle = COLORS.goldBright;
    ctx.textAlign = 'center';
    ctx.fillText(world.toast, VIEW.width / 2, 98);
  }

  // --- the screens ---------------------------------------------------------------
  function overlay(alpha) {
    ctx.fillStyle = `rgba(6, 9, 20, ${alpha})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawTitle(world, best) {
    overlay(0.72);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.goldBright;
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText('VELVET VAULT', VIEW.width / 2, 210);
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'italic 26px Georgia, serif';
    ctx.fillText('— The Midnight Gallery Heist —', VIEW.width / 2, 252);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#c9c4b8';
    ctx.fillText('Three wings. Eight guards. Four cameras. One diamond.', VIEW.width / 2, 300);
    ctx.fillText('Lift every treasure, mind the vision cones, and reach the getaway van.', VIEW.width / 2, 326);
    ctx.fillStyle = COLORS.goldBright;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press SPACE or click to begin', VIEW.width / 2, 392);
    ctx.fillStyle = '#9fb6e8';
    ctx.font = '14px sans-serif';
    ctx.fillText('WASD / arrows — move      Shift — sneak      Q — smoke pellet      E — EMP pulse', VIEW.width / 2, 440);
    ctx.fillText('F (hold) — pick the vault lock      P — pause      M — mute      Click — walk to a spot', VIEW.width / 2, 464);
    ctx.fillStyle = '#7c86a3';
    ctx.font = '13px sans-serif';
    ctx.fillText('Smoke hides you. EMP freezes the cameras. The alarm climbs when you are seen —', VIEW.width / 2, 510);
    ctx.fillText('at 100 the wing locks down. Break line of sight before the grace runs out.', VIEW.width / 2, 530);
    if (best > 0) {
      ctx.fillStyle = COLORS.goldBright;
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`Best getaway so far: $${best.toLocaleString('en-US')}`, VIEW.width / 2, 580);
    }
    drawHud(world);
  }

  function drawPaused(world) {
    overlay(0.6);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.fillText('PAUSED', VIEW.width / 2, 330);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#9fb6e8';
    ctx.fillText('Press P or SPACE to keep sneaking', VIEW.width / 2, 372);
    drawHud(world);
  }

  function drawBusted(world) {
    overlay(0.72);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.alarmHigh;
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText('BUSTED!', VIEW.width / 2, 280);
    ctx.fillStyle = '#e8e4d8';
    ctx.font = '20px sans-serif';
    const reason = world.caughtBy === 'the lockdown'
      ? 'The lockdown caught you in the open.'
      : `Guard ${world.caughtBy} caught you red-handed.`;
    ctx.fillText(reason, VIEW.width / 2, 326);
    ctx.fillStyle = '#c9c4b8';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Loot lifted this wing: $${world.score.toLocaleString('en-US')} — the gallery keeps the rest.`, VIEW.width / 2, 360);
    ctx.fillStyle = COLORS.goldBright;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press R to try the wing again', VIEW.width / 2, 420);
    drawHud(world);
  }

  function drawWin(world) {
    const pay = computePayout(world);
    overlay(0.78);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.goldBright;
    ctx.font = 'bold 56px Georgia, serif';
    ctx.fillText('CLEAN GETAWAY!', VIEW.width / 2, 190);
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillText('The Midnight Star is yours. The van is already moving.', VIEW.width / 2, 232);
    const rows = [
      ['Loot lifted', `$${pay.loot.toLocaleString('en-US')}`],
      ['Speed bonus', `$${pay.timeBonus.toLocaleString('en-US')}`],
      [`Ghost bonus — ${pay.ghostWings} quiet wing${pay.ghostWings === 1 ? '' : 's'}`, `$${pay.ghostBonus.toLocaleString('en-US')}`],
      ['TOTAL TAKE', `$${pay.total.toLocaleString('en-US')}`],
    ];
    ctx.font = '20px sans-serif';
    let y = 300;
    for (const [label, value] of rows) {
      const total = label === 'TOTAL TAKE';
      ctx.fillStyle = total ? COLORS.goldBright : '#e8e4d8';
      ctx.font = total ? 'bold 26px sans-serif' : '20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, VIEW.width / 2 - 220, y);
      ctx.textAlign = 'right';
      ctx.fillText(value, VIEW.width / 2 + 220, y);
      y += total ? 52 : 40;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9fb6e8';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Finished in ${formatTime(world.totalTime)} across three wings.`, VIEW.width / 2, y + 8);
    ctx.fillStyle = COLORS.goldBright;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press R to run the gallery again', VIEW.width / 2, y + 52);
    drawHud(world);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return { draw };
}

