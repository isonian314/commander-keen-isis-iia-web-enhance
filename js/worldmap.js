'use strict';
// World map shown before each level: the camera zooms from an overview of the Isonian compound down to
// Keen, who walks (swims, or falls) along his route to the next level, then the level name is shown.

const WORLDMAP_W = 640, WORLDMAP_H = 360;
const WORLDMAP_VIEW_W = DISPLAY_W, WORLDMAP_VIEW_H = 180;
const WORLDMAP_ZOOM_OVERVIEW = WORLDMAP_VIEW_W / WORLDMAP_W, WORLDMAP_ZOOM_CLOSE = 1;

// Location of each level on the map in worldmap pixels; index 0 is where the Bean-with-Bacon landed
const WORLDMAP_SITES = [
  [84, 60],
  [100, 130], [60, 170], [232, 40], [176, 90], [210, 156], [320, 140], [281, 97], [363, 76],
  [355, 108], [476, 113], [415, 97], [463, 246], [383, 265], [490, 292], [510, 270], [527, 205],
];
// Extra points on the way to a level; the optional third value is how Keen gets there (default walk)
const WORLDMAP_VIA = { 12: [[438, 196], [446, 236, 'fall']] };
// How Keen reaches a level: the dungeon is a trapdoor, the islands are swum to
const WORLDMAP_TRAVEL = { 9: 'fall', 12: 'swim', 13: 'swim', 14: 'swim' };
const WORLDMAP_SMOKE = { all: [[383, 256]], aftermath: [[400, 162], [428, 152], [416, 112]] };
const WORLDMAP_FIREFLIES = [[40, 60], [70, 95], [130, 150], [30, 140], [150, 70], [95, 190], [190, 120], [20, 30]];

const WM_OVERVIEW = 0.9, WM_ZOOM = 1.0, WM_ARRIVE = 1.6, WM_FADE = 0.3, WM_SPEED = 60, WM_SKIP_GRACE = 0.4;
const KEEN_MAP_SCALE = 0.75;
const SPR_RUN_LEFT = 0, SPR_RUN_RIGHT = 13, SPR_JUMP_LEFT = 5, SPR_JUMP_RIGHT = 18, SPR_FRONT = 52;
const SPR_SWIM_LEFT = 117, SPR_SWIM_RIGHT = 119;

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const lerp = (a, b, u) => a + (b - a) * u;

// Which level a level is normally reached from (the secret island is an optional detour)
function worldMapPrevLevel(id, saved) {
  if (id === 14) return saved[12] && saved[12].ranking > 0 ? 13 : 12;
  return id - 1;
}

function worldMapVariant(id) {
  if (id === 2) return 'night';
  return id >= 12 ? 'aftermath' : 'day';
}

class Polyline {
  constructor(points) {
    this.points = points;
    this.cum = [0];
    for (let i = 1; i < points.length; i++) {
      this.cum.push(this.cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    }
    this.length = this.cum[this.cum.length - 1];
  }
  // Position, segment index and direction at distance d along the line
  at(d) {
    d = Math.max(0, Math.min(this.length, d));
    let i = 1;
    while (i < this.points.length - 1 && this.cum[i] < d) i++;
    const a = this.points[i - 1], b = this.points[i] || a;
    const seg = this.cum[i] - this.cum[i - 1];
    const u = seg > 0 ? (d - this.cum[i - 1]) / seg : 1;
    return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), seg: i - 1, dx: b[0] - a[0] };
  }
}

class WorldMap {
  constructor() {
    this.keenFrames = splice(48, 48, 'keen_sprites0-normal.png', 1, 1);
    this.done = false;
  }

  start(game) {
    const id = game.level_ID;
    const saved = game.SAVED_DATA;
    const from = game.mapRoute && game.mapRoute.to === id ? game.mapRoute.from : worldMapPrevLevel(id, saved);
    this.levelId = id;
    this.map = loadImage(`worldmap-${worldMapVariant(id)}.png`, 'opaque');
    this.variant = worldMapVariant(id);

    // Levels already visited on the way here, oldest first
    this.visited = [];
    for (let l = from; l > 0; l = worldMapPrevLevel(l, saved)) this.visited.unshift(l);
    this.trail = [];
    let prev = 0;
    for (const l of this.visited) {
      this.trail.push(new Polyline([WORLDMAP_SITES[prev], ...(WORLDMAP_VIA[l] || []), WORLDMAP_SITES[l]]));
      prev = l;
    }
    this.leg = new Polyline([WORLDMAP_SITES[from], ...(WORLDMAP_VIA[id] || []), WORLDMAP_SITES[id]]);
    this.legLastSeg = this.leg.points.length - 2;
    this.travel = WORLDMAP_TRAVEL[id] || 'walk';

    this.tTravel = WM_OVERVIEW + WM_ZOOM;
    this.travelTime = Math.max(0.8, Math.min(2.4, this.leg.length / WM_SPEED));
    this.tArrive = this.tTravel + this.travelTime;
    this.tEnd = this.tArrive + WM_ARRIVE;
    this.t = 0;
    this.done = false;

    const name = game.level_names[id - 1];
    this.title = fontCK_MEDIUM.render(`Level ${id}: ${name}`, 1, [255, 255, 255]);
    this.titleShadow = fontCK_MEDIUM.render(`Level ${id}: ${name}`, 1, [0, 0, 0]);
  }

  // Keen standing at the current level with a caption in the banner (shown while a level reloads)
  drawStill(ctx, game, caption) {
    this.start(game);
    this.t = this.tEnd - WM_FADE;
    this.done = true;
    this.title = caption;
    this.titleShadow = null;
    this.draw(ctx);
  }

  // Any key: jump straight to the level (after a short grace so the key that ended the cut-scene doesn't)
  skip() {
    if (this.t >= WM_SKIP_GRACE) this.done = true;
  }

  update(dt) {
    this.t += dt;
    if (this.t >= this.tEnd) this.done = true;
    return this.done;
  }

  keenState() {
    const t = this.t;
    const u = this.travel === 'walk' ? (t - this.tTravel) / this.travelTime : ease((t - this.tTravel) / this.travelTime);
    const p = this.leg.at(this.leg.length * Math.max(0, Math.min(1, u)));
    const moving = t >= this.tTravel && t < this.tArrive;
    const mode = this.leg.points[p.seg + 1][2] || (p.seg === this.legLastSeg ? this.travel : 'walk');
    const left = p.dx < 0;
    const step = Math.floor(t * 10);
    let frame = SPR_FRONT, bob = 0;
    const ashore = t >= this.tArrive && this.levelId !== 12;
    if (mode === 'swim' && !ashore) {
      frame = (left ? SPR_SWIM_LEFT : SPR_SWIM_RIGHT) + (Math.floor(t * 4) % 2);
      bob = Math.round(Math.sin(t * 5));
    } else if (moving && mode === 'fall') {
      frame = left ? SPR_JUMP_LEFT : SPR_JUMP_RIGHT;
    } else if (moving) {
      frame = (left ? SPR_RUN_LEFT : SPR_RUN_RIGHT) + (step % 4);
    }
    return { x: p.x, y: p.y + bob, frame, progress: Math.max(0, Math.min(1, u)) };
  }

  camera(keenPos) {
    const t = this.t;
    let z, cx, cy;
    if (t < WM_OVERVIEW) {
      z = WORLDMAP_ZOOM_OVERVIEW; cx = WORLDMAP_W / 2; cy = WORLDMAP_H / 2;
    } else {
      const u = ease((t - WM_OVERVIEW) / WM_ZOOM);
      z = lerp(WORLDMAP_ZOOM_OVERVIEW, WORLDMAP_ZOOM_CLOSE, u);
      cx = lerp(WORLDMAP_W / 2, keenPos.x, u);
      cy = lerp(WORLDMAP_H / 2, keenPos.y, u);
    }
    const vw = WORLDMAP_VIEW_W / z, vh = WORLDMAP_VIEW_H / z;
    let sx = Math.max(0, Math.min(WORLDMAP_W - vw, cx - vw / 2));
    let sy = Math.max(0, Math.min(WORLDMAP_H - vh, cy - vh / 2));
    if (z === WORLDMAP_ZOOM_CLOSE) { sx = Math.round(sx); sy = Math.round(sy); }
    return { z, sx, sy, vw, vh };
  }

  draw(ctx) {
    const t = this.t;
    const keen = this.keenState();
    const cam = this.camera(keen);
    const S = (p) => [(p[0] - cam.sx) * cam.z, (p[1] - cam.sy) * cam.z];

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
    ctx.imageSmoothingEnabled = cam.z !== WORLDMAP_ZOOM_CLOSE;
    ctx.imageSmoothingQuality = 'high';
    const m = this.map;
    ctx.drawImage(m.canvas, m.sx + cam.sx, m.sy + cam.sy, cam.vw, cam.vh, 0, 0, WORLDMAP_VIEW_W, WORLDMAP_VIEW_H);
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WORLDMAP_VIEW_W, WORLDMAP_VIEW_H);
    ctx.clip();
    this.drawAmbience(ctx, S, cam.z);
    for (const line of this.trail) this.drawTrail(ctx, S, cam.z, line, line.length, '#ffe25a');
    this.drawTrail(ctx, S, cam.z, this.leg, this.leg.length * keen.progress, this.travel === 'fall' ? '#ff6a4a' : '#ffffff');
    for (const l of this.visited) this.drawFlag(ctx, S(WORLDMAP_SITES[l]), t, l);
    this.drawTarget(ctx, S(WORLDMAP_SITES[this.levelId]), t);
    const underground = this.travel === 'fall' && t >= this.tArrive;
    if (!underground) this.drawKeen(ctx, S([keen.x, keen.y]), cam.z, keen.frame);
    ctx.restore();

    this.drawBanner(ctx, t);

    const fade = Math.max(1 - t / WM_FADE, this.done ? 0 : 1 - (this.tEnd - t) / WM_FADE, 0);
    if (fade > 0) {
      ctx.globalAlpha = Math.min(1, fade);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
      ctx.globalAlpha = 1;
    }
  }

  drawAmbience(ctx, S, z) {
    const t = this.t;
    const vents = WORLDMAP_SMOKE.all.concat(this.variant === 'aftermath' ? WORLDMAP_SMOKE.aftermath : []);
    vents.forEach((v, n) => {
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.3 + i / 5 + n * 0.37) % 1;
        const [x, y] = S([v[0] + Math.sin(ph * 5 + i + n) * 3 + ph * 6, v[1] - ph * 26]);
        ctx.globalAlpha = 0.5 * (1 - ph);
        ctx.fillStyle = n === 0 && ph < 0.15 ? '#ff9a3a' : '#9a9a9a';
        ctx.beginPath();
        ctx.arc(x, y, (2 + ph * 5) * z, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    if (this.variant === 'night') {
      WORLDMAP_FIREFLIES.forEach(([fx, fy], i) => {
        const glow = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
        const [x, y] = S([fx + Math.sin(t + i) * 4, fy + Math.cos(t * 0.8 + i) * 3]);
        ctx.globalAlpha = glow;
        ctx.fillStyle = '#d8ff6a';
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      });
    }
    ctx.globalAlpha = 1;
  }

  // Keen 4 style dotted route: dark-outlined dots every few map pixels
  drawTrail(ctx, S, z, line, upTo, colour) {
    const step = 7;
    const size = z >= 0.9 ? 2 : 1;
    for (let d = step / 2; d < upTo; d += step) {
      const p = line.at(d);
      const [x, y] = S([p.x, p.y]);
      const rx = Math.round(x) - (size >> 1), ry = Math.round(y) - (size >> 1);
      ctx.fillStyle = '#1a1020';
      ctx.fillRect(rx - 1, ry - 1, size + 2, size + 2);
      ctx.fillStyle = colour;
      ctx.fillRect(rx, ry, size, size);
    }
  }

  // Completed level: a little waving flag
  drawFlag(ctx, [x, y], t, l) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = '#1a1020';
    ctx.fillRect(x - 1, y - 11, 3, 12);
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(x, y - 10, 1, 11);
    const wave = Math.floor(t * 6 + l) % 2;
    ctx.fillStyle = '#1a1020';
    ctx.fillRect(x + 1, y - 11, 7, 6);
    ctx.fillStyle = '#3cdc3c';
    ctx.fillRect(x + 1, y - 10, 6, 4);
    ctx.fillStyle = '#ffe25a';
    ctx.fillRect(x + 3 + wave, y - 9, 2, 2);
  }

  // Destination: the pulsing red target rings of the original map
  drawTarget(ctx, [x, y], t) {
    const pulse = (t * 1.5) % 1;
    ctx.lineWidth = 1;
    for (const [r, a] of [[3, 1], [6, 1], [6 + pulse * 8, 1 - pulse]]) {
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#1a1020';
      ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, r + 1, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ff2a2a';
      ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawKeen(ctx, [x, y], z, frame) {
    const f = this.keenFrames[frame];
    const s = KEEN_MAP_SCALE * Math.max(z, 0.75);
    const w = f.w * s, h = f.h * s;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(f.canvas, f.sx, f.sy, f.w, f.h, Math.round(x - w / 2), Math.round(y - h * 0.97), Math.round(w), Math.round(h));
    ctx.imageSmoothingEnabled = false;
  }

  drawBanner(ctx, t) {
    const y0 = WORLDMAP_VIEW_H;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, y0, DISPLAY_W, DISPLAY_H - y0);
    ctx.fillStyle = '#ffe25a';
    ctx.fillRect(0, y0, DISPLAY_W, 1);
    const slide = ease((t - this.tTravel + 0.4) / 0.5);
    const x = Math.round((DISPLAY_W - this.title.w) / 2 + (1 - slide) * DISPLAY_W);
    const y = y0 + Math.round((DISPLAY_H - y0 - this.title.h) / 2) + 1;
    if (this.titleShadow) blit(ctx, this.titleShadow, x + 1, y + 1);
    blit(ctx, this.title, x, y);
  }
}
