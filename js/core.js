'use strict';
// Core runtime: Python/pygame compatible helpers, surfaces, masks, sprite groups, fonts.
// The game logic was ported from Python, so a few Python semantics are reproduced exactly
// (banker's rounding, floor modulo, negative list indices, int() truncation).

const DISPLAY_W = 320;
const DISPLAY_H = 200;
const TILESIZE = 16;

// Boot hooks: modules register initialisers that need decoded assets.
const Boot = [];

// ---------------------------------------------------------------------------------------------
// Python numeric semantics

const trunc = Math.trunc;

// Python 3 round(): half to even
function pyround(x) {
  if (Math.abs(x % 1) === 0.5) return 2 * Math.round(x / 2);
  return Math.round(x);
}

// Python float modulo (result takes the sign of the divisor)
function pmod(a, b) {
  return a - b * Math.floor(a / b);
}

// Python list indexing (negative indices wrap)
function at(arr, i) {
  return arr[i < 0 ? arr.length + i : i];
}

const rand = Math.random;

class PyIndexError extends Error {}

// Level layers are stored [x][y] like the Python code. Out of range lookups raise in Python;
// grid() mirrors that when strict, otherwise returns 0 so the browser never crashes.
function grid(layer, x, y, strict) {
  const W = layer.length;
  if (x < 0) x += W;
  const col = layer[x];
  if (col === undefined || x < 0) {
    if (strict) throw new PyIndexError();
    return 0;
  }
  const H = col.length;
  if (y < 0) y += H;
  const v = col[y];
  if (v === undefined || y < 0) {
    if (strict) throw new PyIndexError();
    return 0;
  }
  return v;
}

// ---------------------------------------------------------------------------------------------
// pygame.Rect (integer coordinates, float arguments truncated)

class Rect {
  constructor(x, y, w, h) {
    this.x = trunc(x);
    this.y = trunc(y);
    this.w = trunc(w);
    this.h = trunc(h);
  }
  get midbottomX() { return this.x + (this.w >> 1); }
  get bottom() { return this.y + this.h; }
  colliderect(o) {
    return this.w > 0 && this.h > 0 && o.w > 0 && o.h > 0 &&
      this.x < o.x + o.w && this.y < o.y + o.h && this.x + this.w > o.x && this.y + this.h > o.y;
  }
}

// ---------------------------------------------------------------------------------------------
// Surfaces
// A Surf is a view onto a canvas region plus its own surface alpha (pygame set_alpha).
// Pixel-derived data (mask, flipped/rotated/scaled copies) lives in a cache shared by
// every view of the same pixels.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

class Surf {
  constructor(canvas, sx, sy, w, h, cache) {
    this.canvas = canvas;
    this.sx = sx;
    this.sy = sy;
    this.w = w;
    this.h = h;
    this.alpha = null;
    this.cache = cache || {};
  }
  get_width() { return this.w; }
  get_height() { return this.h; }
  set_alpha(v) { this.alpha = v == null ? null : Math.max(0, Math.min(255, trunc(v))); }
  get_alpha() { return this.alpha; }
  copy() {
    const s = new Surf(this.canvas, this.sx, this.sy, this.w, this.h, this.cache);
    s.alpha = this.alpha;
    return s;
  }
  subsurface(x, y, w, h) {
    x = trunc(x); y = trunc(y); w = trunc(w); h = trunc(h);
    return new Surf(this.canvas, this.sx + x, this.sy + y, w, h, {});
  }
  ctx() { return this.canvas.getContext('2d'); }
}

function newSurface(w, h) {
  return new Surf(makeCanvas(w, h), 0, 0, w, h, {});
}

function rgb(c) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function fillSurf(surf, colour) {
  const g = surf.ctx();
  g.save();
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'copy';
  g.fillStyle = rgb(colour);
  g.fillRect(surf.sx, surf.sy, surf.w, surf.h);
  g.restore();
  surf.cache = {};
}

// Draw a surface onto a 2D context at integer (truncated) coordinates
function blit(ctx, surf, x, y) {
  if (!surf || surf.w <= 0 || surf.h <= 0) return;
  ctx.globalAlpha = surf.alpha == null ? 1 : surf.alpha / 255;
  ctx.drawImage(surf.canvas, surf.sx, surf.sy, surf.w, surf.h, trunc(x), trunc(y), surf.w, surf.h);
  ctx.globalAlpha = 1;
}

// Blit a sub-area of a surface (pygame blit with area / subsurface)
function blitArea(ctx, surf, x, y, ax, ay, aw, ah) {
  ax = trunc(ax); ay = trunc(ay); aw = trunc(aw); ah = trunc(ah);
  if (aw <= 0 || ah <= 0) return;
  ctx.globalAlpha = surf.alpha == null ? 1 : surf.alpha / 255;
  ctx.drawImage(surf.canvas, surf.sx + ax, surf.sy + ay, aw, ah, trunc(x), trunc(y), aw, ah);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------------------------
// Image loading (pygame.image.load + convert / convert_alpha / colorkey)

// Transparency colour: top-left pixel of icon.png. Surfaces in the original are converted
// to 16 bit before colour keying, so matching is done in RGB565 space.
const TRANSCOLOUR = [129, 255, 44];
const KEY565 = [TRANSCOLOUR[0] >> 3, TRANSCOLOUR[1] >> 2, TRANSCOLOUR[2] >> 3];

const Images = {};          // name -> HTMLImageElement (decoded at boot)
const masterCache = new Map();
const regionCaches = new Map();

// mode: 'opaque' (convert), 'key' (convert + colorkey), 'alpha' (convert_alpha)
function getMaster(name, mode) {
  const key = name + '|' + mode;
  let m = masterCache.get(key);
  if (m) return m;
  const img = Images[name];
  if (!img) throw new Error('Missing image: ' + name);
  const c = makeCanvas(img.width, img.height);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  if (mode !== 'alpha') {
    const d = g.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (mode === 'key' && (p[i] >> 3) === KEY565[0] && (p[i + 1] >> 2) === KEY565[1] && (p[i + 2] >> 3) === KEY565[2]) {
        p[i + 3] = 0;
      } else {
        p[i + 3] = 255;
      }
    }
    g.putImageData(d, 0, 0);
  }
  m = { canvas: c };
  masterCache.set(key, m);
  return m;
}

function loadImage(name, mode) {
  const m = getMaster(name, mode || 'opaque');
  const key = name + '|' + mode + '|full';
  let cache = regionCaches.get(key);
  if (!cache) regionCaches.set(key, cache = {});
  return new Surf(m.canvas, 0, 0, m.canvas.width, m.canvas.height, cache);
}

// gfnLoad_Splice: cut a sprite sheet into frames (border = 1px grid lines)
function splice(w, h, name, border, trans) {
  const mode = trans ? 'key' : 'opaque';
  const m = getMaster(name, mode);
  const W = m.canvas.width, H = m.canvas.height;
  const out = [];
  let idx = 0;
  const pushFrame = (sx, sy) => {
    const key = `${name}|${mode}|${w}x${h}|${border}|${idx++}`;
    let cache = regionCaches.get(key);
    if (!cache) regionCaches.set(key, cache = {});
    out.push(new Surf(m.canvas, sx, sy, w, h, cache));
  };
  if (border) {
    const rows = trunc((H - 1) / (h + 1)), cols = trunc((W - 1) / (w + 1));
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) pushFrame(1 + x * w + x, 1 + y * h + y);
  } else {
    const rows = trunc(H / h), cols = trunc(W / w);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) pushFrame(x * w, y * h);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Transforms (pygame.transform.flip / rotate / scale) - results are cached per source pixels

function derived(surf, key, build) {
  let d = surf.cache[key];
  if (!d) {
    const c = build();
    d = surf.cache[key] = { canvas: c, cache: {} };
  }
  const s = new Surf(d.canvas, 0, 0, d.canvas.width, d.canvas.height, d.cache);
  s.alpha = surf.alpha;
  return s;
}

function flipH(surf) {
  return derived(surf, 'flipH', () => {
    const c = makeCanvas(surf.w, surf.h);
    const g = c.getContext('2d');
    g.translate(surf.w, 0);
    g.scale(-1, 1);
    g.drawImage(surf.canvas, surf.sx, surf.sy, surf.w, surf.h, 0, 0, surf.w, surf.h);
    return c;
  });
}

// Counter-clockwise rotation in multiples of 90 degrees (pygame convention)
function rotate90(surf, angle) {
  return derived(surf, 'rot' + angle, () => {
    const quarter = (((angle / 90) % 4) + 4) % 4;
    const swap = quarter % 2 === 1;
    const c = makeCanvas(swap ? surf.h : surf.w, swap ? surf.w : surf.h);
    const g = c.getContext('2d');
    g.translate(c.width / 2, c.height / 2);
    g.rotate(-quarter * Math.PI / 2);
    g.drawImage(surf.canvas, surf.sx, surf.sy, surf.w, surf.h, -surf.w / 2, -surf.h / 2, surf.w, surf.h);
    return c;
  });
}

function scaleSurf(surf, w, h) {
  w = Math.max(0, trunc(w));
  h = Math.max(0, trunc(h));
  if (w === 0 || h === 0) {
    const s = new Surf(makeCanvas(1, 1), 0, 0, w, h, {});
    s.alpha = surf.alpha;
    return s;
  }
  return derived(surf, `scale${w}x${h}`, () => {
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(surf.canvas, surf.sx, surf.sy, surf.w, surf.h, 0, 0, w, h);
    return c;
  });
}

// ---------------------------------------------------------------------------------------------
// Masks (pygame.mask.from_surface / sprite.collide_mask)

function computeMask(surf) {
  const w = Math.max(0, surf.w), h = Math.max(0, surf.h);
  const bits = new Uint8Array(w * h);
  if (w > 0 && h > 0) {
    const g = surf.canvas.getContext('2d', { willReadFrequently: true });
    const p = g.getImageData(surf.sx, surf.sy, w, h).data;
    for (let i = 0, j = 3; i < bits.length; i++, j += 4) bits[i] = p[j] > 127 ? 1 : 0;
  }
  return { w, h, bits };
}

function maskOf(surf) {
  if (!surf) return { w: 0, h: 0, bits: new Uint8Array(0) };
  return surf.cache.mask || (surf.cache.mask = computeMask(surf));
}

function maskOverlap(a, b, dx, dy) {
  const x0 = Math.max(0, dx), y0 = Math.max(0, dy);
  const x1 = Math.min(a.w, dx + b.w), y1 = Math.min(a.h, dy + b.h);
  for (let y = y0; y < y1; y++) {
    const ra = y * a.w, rb = (y - dy) * b.w - dx;
    for (let x = x0; x < x1; x++) if (a.bits[ra + x] && b.bits[rb + x]) return true;
  }
  return false;
}

function collideMask(left, right) {
  const ma = left.mask || maskOf(left.image);
  const mb = right.mask || maskOf(right.image);
  return maskOverlap(ma, mb, right.rect.x - left.rect.x, right.rect.y - left.rect.y);
}

function collideRect(left, right) {
  return left.rect.colliderect(right.rect);
}

// ---------------------------------------------------------------------------------------------
// Sprites and groups (pygame.sprite)

class Sprite {
  constructor() { this._groups = null; }
  kill() {
    if (!this._groups) return;
    for (const g of this._groups) g._remove(this);
    this._groups.clear();
  }
  alive() { return !!(this._groups && this._groups.size); }
}

class Group {
  constructor() { this.list = []; }
  add(s) {
    if (!s._groups) s._groups = new Set();
    if (s._groups.has(this)) return;
    s._groups.add(this);
    this.list.push(s);
  }
  _remove(s) {
    const i = this.list.indexOf(s);
    if (i >= 0) this.list.splice(i, 1);
  }
  empty() {
    for (const s of this.list) s._groups.delete(this);
    this.list = [];
  }
  get length() { return this.list.length; }
  [Symbol.iterator]() { return this.list.slice()[Symbol.iterator](); }
  update(...args) {
    for (const s of this.list.slice()) s.update(...args);
  }
  draw(ctx) {
    for (const s of this.list) {
      if (s.draw) s.draw(ctx);
      else if (s.image && s.rect) blit(ctx, s.image, s.rect.x, s.rect.y);
    }
  }
}

function spritecollide(sprite, group, collided) {
  const out = [];
  for (const s of group.list) if (collided(sprite, s)) out.push(s);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Fonts: Windows .FON bitmap fonts (the original CK fonts) and TrueType via FontFace

function parseFon(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ne = dv.getUint32(0x3c, true);
  const rt = ne + dv.getUint16(ne + 0x24, true);
  const shift = dv.getUint16(rt, true);
  let p = rt + 2;
  for (;;) {
    const type = dv.getUint16(p, true);
    if (!type) break;
    const count = dv.getUint16(p + 2, true);
    p += 8;
    for (let i = 0; i < count; i++, p += 12) {
      if (type === 0x8008) return parseFnt(dv, dv.getUint16(p, true) << shift);
    }
  }
  throw new Error('No font resource found');
}

function parseFnt(dv, o) {
  const version = dv.getUint16(o, true);
  const height = dv.getUint16(o + 0x58, true);
  const first = dv.getUint8(o + 0x5f), last = dv.getUint8(o + 0x60);
  const defaultChar = dv.getUint8(o + 0x61) + first;
  const table = o + (version >= 0x300 ? 0x94 : 0x76);
  const entry = version >= 0x300 ? 6 : 4;
  const glyphs = {};
  for (let c = first; c <= last; c++) {
    const e = table + (c - first) * entry;
    const w = dv.getUint16(e, true);
    const off = o + (version >= 0x300 ? dv.getUint32(e + 2, true) : dv.getUint16(e + 2, true));
    const rows = [];
    for (let y = 0; y < height; y++) {
      const row = new Uint8Array(w);
      for (let x = 0; x < w; x++) {
        const byte = dv.getUint8(off + (x >> 3) * height + y);
        row[x] = (byte >> (7 - (x & 7))) & 1;
      }
      rows.push(row);
    }
    glyphs[c] = { w, rows };
  }
  return { height, first, last, defaultChar, glyphs };
}

class BitmapFont {
  constructor(bytes) { this.f = parseFon(bytes); }
  glyph(ch) {
    const c = ch.charCodeAt(0);
    return this.f.glyphs[c] || this.f.glyphs[this.f.defaultChar] || { w: 0, rows: [] };
  }
  size(text) {
    let w = 0;
    for (const ch of text) w += this.glyph(ch).w;
    return [w, this.f.height];
  }
  render(text, antialias, colour) {
    const [w, h] = this.size(text);
    const s = newSurface(w, h);
    const g = s.ctx();
    g.fillStyle = rgb(colour);
    let x = 0;
    for (const ch of text) {
      const gl = this.glyph(ch);
      for (let y = 0; y < gl.rows.length; y++) {
        const row = gl.rows[y];
        for (let i = 0; i < row.length; i++) if (row[i]) g.fillRect(x + i, y, 1, 1);
      }
      x += gl.w;
    }
    return s;
  }
}

class WebFont {
  constructor(family, px) {
    this.css = `${px}px "${family}"`;
    const g = makeCanvas(1, 1).getContext('2d');
    g.font = this.css;
    const m = g.measureText('Hg');
    this.ascent = Math.ceil(m.fontBoundingBoxAscent || px * 0.8);
    this.height = this.ascent + Math.ceil(m.fontBoundingBoxDescent || px * 0.25);
  }
  size(text) {
    const g = makeCanvas(1, 1).getContext('2d');
    g.font = this.css;
    return [Math.ceil(g.measureText(text).width), this.height];
  }
  render(text, antialias, colour) {
    const [w, h] = this.size(text);
    const s = newSurface(w, h);
    const g = s.ctx();
    g.font = this.css;
    g.textBaseline = 'alphabetic';
    g.fillStyle = rgb(colour);
    g.fillText(text, 0, this.ascent);
    return s;
  }
}

let fontCK_SMALL, fontCK_MEDIUM, fontCK_LARGE, fontGREMLINS, fontSGA, fontSGA_ROUND;

// ---------------------------------------------------------------------------------------------
// Drawing helpers

function drawRectOutline(ctx, colour, x, y, w, h) {
  ctx.fillStyle = rgb(colour);
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

// 1px wide circle outline (pygame.draw.circle with width 1)
function drawCircleOutline(ctx, colour, cx, cy, r) {
  ctx.fillStyle = rgb(colour);
  let x = r, y = 0, err = 1 - r;
  while (x >= y) {
    for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) {
      ctx.fillRect(cx + px, cy + py, 1, 1);
    }
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
