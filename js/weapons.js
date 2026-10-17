'use strict';
// Weapons, projectiles, explosions and inventory (isis_weapons.py)

const W_PLUTEZARP = 0, W_HR42 = 1, W_SOLARIZER = 2, W_PULSAR = 3, W_ZEFFER = 4, W_BLOWGUN = 5,
  W_HARPOON = 6, W_RAYGUN = 7, W_NEURAL = 8, W_EXPLODE = 9;

// Ammo -1 means the weapon hasn't been collected yet. The lists are module level in the
// original, so they are shared by everything that references them.
const WEAPON = [32, 16, 8, 4, 2, 1, 1, 1, 1].map((damage) => ({ ammo: -1, damage }));
const INVENTORY = [0, 1, 2, 3].map(() => ({ maxPower: 0, power: -1 }));
const iBattery = 0, iShield = 1, iIonScanner = 2, iUnknown = 3;

const PROJ_BLOWGUN = 0, PROJ_ZEFFER = 2, PROJ_PULSAR = 4, PROJ_SOLARIZER = 8, PROJ_HR42 = 11,
  PROJ_PLUTEZARP = 15, PROJ_HARPOON = 16, PROJ_RAYGUN = 17, PROJ_NEURAL = 18;
const XPLOD_ZEFFER = 0, XPLOD_PULSAR = 2, XPLOD_SOLARIZER = 8, XPLOD_HR42 = 13, XPLOD_PLUTEZARP = 20,
  XPLOD_RAYGUN = 28, XPLOD_NEURAL = 30, XPLOD_REDROBOT = 32;

const BLOWGUN_SPEED = 200, BLOWGUN_TIME = 0.5, BLOWGUN_GRAVITY = 450;
const ZEFFER_SPEED = 250, ZEFFER_AMP = 5, ZEFFER_PERIOD = 0.05, ZEFFER_YDEV = 40;
const PULSAR_SPEED = 250, SOLARIZER_SPEED = 150, HR42_SPEED = 150;
// Plutezarp: the beam runs out at PLUTE_SPEED until it hits a wall or an enemy (or the map edge), holds, then
// retracts into its far end, where it leaves residue that hurts Keen and enemies until it dissolves.
const PLUTE_RANGE = 4096, PLUTE_SPEED = 700, PLUTE_HOLD = 0.28, PLUTE_RETRACT = 0.35;
const GOO_LIFE = 8, GOO_FADE = 2.2, GOO_DAMAGE = 4, GOO_KEEN = 2, GOO_TICK = 0.5, GOO_MAX = 10, GOO_GRAVITY = 500;
const HARPOON_SPEED = 100, RAYGUN_SPEED = 200, NEURAL_SPEED = 200;

let srfcProjectiles, srfcExplosions, srfcExplosions2, srfcExplosionsIsonian;

Boot.push(() => {
  srfcProjectiles = splice(32, 32, 'projectiles.png', 1, 1);
  srfcExplosions = splice(32, 32, 'explosions.png', 1, 1);
  srfcExplosions2 = splice(54, 55, 'explosions2.png', 1, 1);
  srfcExplosionsIsonian = splice(12, 15, 'enemy_isonian-proj1_xplod.png', 1, 1);
});

function addParticles(group, n, x, y, colourFn) {
  for (let i = 0; i < n; i++) group.add(new Particle(x, y, pTYPE_OTHER, 0, colourFn()));
}

// Moving animated projectiles share the same pattern (straight up / down / sideways)
const PROJ_ANIM = {
  [W_PULSAR]: { speed: PULSAR_SPEED, base: PROJ_PULSAR, frames: 4, flipRight: true },
  [W_SOLARIZER]: { speed: SOLARIZER_SPEED, base: PROJ_SOLARIZER, frames: 3, flipRight: true },
  [W_HR42]: { speed: HR42_SPEED, base: PROJ_HR42, frames: 4, flipRight: false },
  [W_NEURAL]: { speed: NEURAL_SPEED, base: PROJ_NEURAL, frames: 4, noFlip: true },
};

class Shoot extends Sprite {
  constructor(keen, up, down) {
    super();
    this.x0 = this.x = keen.direction === -1 ? keen.x - 9 : keen.x + 24;
    this.y0 = this.y = keen.y + 11;
    this.id = keen.currentWeapon;
    this.power = keen.weapon[this.id].damage;
    this.direction = keen.direction;
    this.timer = 0;
    this.frame = 0;
    this.last_update = 0;
    this.up = up;
    this.down = down;
    keen.shootUp = up;
    keen.shootDown = down;
    const dir = this.direction;
    const aim = (vertical, side) => {
      if (this.up) { this.x += 16 * dir * -1; this.y -= vertical; }
      else if (this.down) { this.x += 16 * dir * -1; this.y += vertical; }
      else this.x += side * dir;
    };
    const P = srfcProjectiles;
    switch (this.id) {
      case W_BLOWGUN:
        this.image = dir === 1 ? P[PROJ_BLOWGUN] : flipH(P[PROJ_BLOWGUN]);
        break;
      case W_ZEFFER:
        aim(20, 10);
        this.x0 = this.x;
        this.y0 = this.y;
        this.image = P[PROJ_ZEFFER];
        this.delay = 1 / 8.0;
        this.offsetX = rand() * 100;
        this.offsetY = trunc(rand() * 2) === 1 ? rand() * ZEFFER_YDEV : 0;
        break;
      case W_PULSAR:
        aim(10, 5);
        this.image = dir === 1 ? flipH(P[PROJ_PULSAR]) : P[PROJ_PULSAR];
        this.delay = 1 / 8.0;
        break;
      case W_SOLARIZER:
        aim(20, 10);
        this.image = dir === 1 ? flipH(P[PROJ_SOLARIZER]) : P[PROJ_SOLARIZER];
        this.delay = 1 / 8.0;
        break;
      case W_HR42:
        aim(20, 12);
        this.image = dir === 1 ? P[PROJ_HR42] : flipH(P[PROJ_HR42]);
        this.delay = 1 / 8.0;
        break;
      case W_HARPOON:
        this.y += 10;
        this.x += 2 * dir;
        this.image = dir === 1 ? P[PROJ_HARPOON] : flipH(P[PROJ_HARPOON]);
        break;
      case W_RAYGUN:
        this.image = P[PROJ_RAYGUN];
        if (this.up || this.down) {
          aim(15, 0);
          this.image = rotate90(P[PROJ_RAYGUN], 90);
        } else {
          this.x += 8 * dir;
          this.y += 1;
        }
        break;
      case W_NEURAL:
        aim(10, 8);
        this.image = P[PROJ_NEURAL];
        this.delay = 1 / 8.0;
        break;
    }
    this.width = this.image.get_width();
    this.height = this.image.get_height();
  }

  update(t, level, enemies) {
    const P = srfcProjectiles;
    const dir = this.direction;
    this.timer += t;
    const anim = PROJ_ANIM[this.id];
    if (anim) {
      if (this.up) this.y -= t * anim.speed;
      else if (this.down) this.y += t * anim.speed;
      else this.x += t * anim.speed * dir;
      if (this.timer - this.last_update > this.delay) {
        this.last_update = this.timer;
        this.frame += 1;
        if (this.frame === anim.frames) this.frame = 0;
        const img = P[anim.base + this.frame];
        if (anim.noFlip) this.image = img;
        else this.image = (dir === 1) === anim.flipRight ? flipH(img) : img;
      }
    } else if (this.id === W_BLOWGUN) {
      this.x += dir * t * BLOWGUN_SPEED;
      if (this.timer >= BLOWGUN_TIME) {
        this.image = dir === 1 ? P[PROJ_BLOWGUN + 1] : flipH(P[PROJ_BLOWGUN + 1]);
        this.y += t * (this.timer - BLOWGUN_TIME) * BLOWGUN_GRAVITY;
      }
    } else if (this.id === W_ZEFFER) {
      const wave = (v) => ZEFFER_AMP * Math.sin(ZEFFER_PERIOD * v - ZEFFER_PERIOD * this.offsetX);
      if (this.up || this.down) {
        this.x = this.x0 + wave(this.y);
        this.x -= this.offsetY * this.timer;
        this.y += (this.up ? -1 : 1) * t * ZEFFER_SPEED;
      } else {
        this.y = this.y0 + wave(this.x);
        this.y -= this.offsetY * this.timer;
        this.x += t * ZEFFER_SPEED * dir;
      }
      if (this.timer - this.last_update > this.delay) {
        this.last_update = this.timer;
        this.frame += 1;
        if (this.frame === 2) this.frame = 0;
        this.image = P[PROJ_ZEFFER + this.frame];
      }
      level.sprite_Explosions.add(new Particle(this.x, this.y, pTYPE_ZEFFER, 0, [150, 0, 150]));
    } else if (this.id === W_HARPOON) {
      this.x += dir * t * HARPOON_SPEED;
    } else if (this.id === W_RAYGUN) {
      if (this.up) this.y -= t * RAYGUN_SPEED;
      else if (this.down) this.y += t * RAYGUN_SPEED;
      else this.x += t * RAYGUN_SPEED * dir;
    }

    // Hit the ground if the midpoint is on a solid INFO tile
    const testX = trunc((this.x + this.width / 2.0) / TILESIZE);
    const testY = trunc((this.y + this.height / 2.0) / TILESIZE);
    if (gfnSolid_Info(grid(level.INFO, testX, testY))) {
      playSound(SFX_W_HITWALL);
      const X = level.sprite_Explosions;
      if (this.id === W_BLOWGUN) {
        addParticles(X, 75, this.x + 16, this.y + 16, () => [50, 50, 50]);
      } else if (this.id === W_HARPOON) {
        addParticles(X, 75, this.x + 16, this.y + 16, () => [255, 255, 255]);
      } else if (this.id === W_SOLARIZER) {
        for (let i = 0; i < 100; i++) {
          const r1 = trunc(rand() * 50), r2 = trunc(rand() * 100);
          X.add(new Particle(this.x + 16, this.y + 16, pTYPE_OTHER, 0, [200 + r1, 150 + r2, 0]));
          X.add(new Explode(this.x, this.y, this.id, dir, this.up, this.down));
        }
      } else {
        X.add(new Explode(this.x, this.y, this.id, dir, this.up, this.down));
      }
      this.kill();
    }

    this.rect = new Rect(this.x - level.mapX + 4, this.y - level.mapY + 4, 24, 24);

    // Enemy hits (the projectile keeps checking even after being killed, as in the original)
    for (const enemy of spritecollide(this, enemies, collideRect)) {
      if (!collideMask(this, enemy)) continue;
      if (enemy.bullet || enemy.state === ENEMY_STATE_DIE) continue;
      const X = level.sprite_Explosions;
      if (this.id === W_BLOWGUN) {
        addParticles(X, 20, this.x + 16, this.y + 16, () => [50, 50, 50]);
      } else if (this.id === W_HARPOON) {
        addParticles(X, 20, this.x, this.y, () => [255, 255, 255]);
      } else if (this.id === W_PULSAR) {
        addParticles(X, 10, this.x, this.y, () => [200 + trunc(rand() * 40), 55 + trunc(rand() * 40), 200 + trunc(rand() * 40)]);
      } else {
        X.add(new Explode(this.x, this.y, this.id, dir, this.up, this.down));
      }

      damageEnemy(enemy, this.power, this.id, level);

      if (this.id === W_PULSAR) {
        if (!this.up && !this.down) this.x += enemy.width * dir;
        this.power = trunc(this.power / 2.0);
        if (this.power === 0) this.power = 1;
      } else {
        this.kill();
      }
    }

    if (this.x < 0 || this.x > level.width * TILESIZE || this.y < 0 || this.y > level.height * TILESIZE) this.kill();
  }
}

// Take hit points off an enemy and start its death when they run out
function damageEnemy(enemy, power, weaponId, level) {
  const X = level.sprite_Explosions;
  enemy.hitPoints -= power;

  // Dragonfly: falls below 50% health, slows down below 25%
  if (enemy.id === SPRITE_DRAGONFLY) {
    if (enemy.hitPoints <= 0.25 * enemy.maxHit) {
      enemy.FPS = 2 * enemy.FPS;
      enemy.speedRun = 0.25 * enemy.speedRun;
    } else if (enemy.hitPoints <= 0.5 * enemy.maxHit) {
      enemy.gravity = 100;
      enemy.moveAmountX = 0;
      enemy.walkFrame = 5;
      enemy.walkMax = 6;
      enemy.FPS = 1000 / 2.0;
      enemy.speedRun = 15;
      enemy.y += 15;
    }
  }

  if (enemy.id === SPRITE_RAT && enemy.hitPoints <= 0 && weaponId === W_SOLARIZER) {
    enemy.dieFrame = 14;
    enemy.dieMax = 19;
  }

  if (enemy.hitPoints > 0) return;
  enemy.moveAmountX = 0;
  enemy.moveAmountY = 0;
  enemy.state = ENEMY_STATE_DIE;
  if (gfn_IsEnemy(enemy.id)) level.stats_NumEnemies += 1;

  if (enemy.id === SPRITE_EVILKEEN) {
    enemy.vy = enemy.speedDieY;
    enemy.onGround = false;
  } else if (enemy.id === SPRITE_TRUCKGUY1 || enemy.id === SPRITE_TRUCKGUY2) {
    let randX = 0, randY = 0;
    for (let i = 0; i < 2; i++) {
      randX = enemy.x + rand() * enemy.width - srfcExplosions2[0].get_width() / 2.0;
      randY = enemy.y + rand() * enemy.height - srfcExplosions2[0].get_height() / 2.0;
      X.add(new Explode(randX, randY, W_EXPLODE, enemy.direction, 0, 0));
    }
    const rdir = trunc(pyround(rand())) === 0 ? -1 : 1;
    const walker = enemy.id === SPRITE_TRUCKGUY1 ? SPRITE_TRUCKGUY1_WALK : SPRITE_TRUCKGUY2_WALK;
    level.sprite_Enemies.add(new EnemyShooter(randX / TILESIZE, randY / TILESIZE - 2, walker, rdir));
  } else if (enemy.id === SPRITE_GARNAK) {
    enemy.x += 22 * enemy.direction * -1;
  } else if (enemy.id === SPRITE_BLUEMOUTH) {
    enemy.x += 15 * enemy.direction * -1;
  } else if (enemy.id === SPRITE_LEMMING || enemy.id === SPRITE_TRUCKGUY1_WALK ||
    enemy.id === SPRITE_TRUCKGUY2_WALK || enemy.id === SPRITE_RAT) {
    enemy.x += 11 * enemy.direction * -1;
  } else if (enemy.id === SPRITE_ROBOT_FLASHER) {
    for (let i = 0; i < 10; i++) {
      const rx = trunc(pyround(rand() * 48)), ry = trunc(pyround(rand() * 48));
      X.add(new Particle(enemy.x + rx, enemy.y + ry, enemy.id, 0, 0));
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Plutezarp beam and residue, drawn pixel by pixel in the colours of the beam in projectiles.png (frame 15)

const PLUTE_RGB = [[226, 76, 222], [85, 85, 255], [72, 72, 218]];
const [PLUTE_EDGE, PLUTE_BLUE, PLUTE_DARK] = PLUTE_RGB.map(rgb);
const PLUTE_ROWS = [PLUTE_EDGE, PLUTE_BLUE, PLUTE_DARK, PLUTE_BLUE, PLUTE_EDGE];   // rows -2..2 of the beam
// Nose of the growing beam, from the tip backwards: one column per entry, rows centred on the beam
const PLUTE_HEAD = [
  [PLUTE_EDGE, PLUTE_BLUE, PLUTE_EDGE],
  [PLUTE_EDGE, PLUTE_BLUE, PLUTE_BLUE, PLUTE_BLUE, PLUTE_EDGE],
  [PLUTE_EDGE, PLUTE_BLUE, PLUTE_BLUE, PLUTE_BLUE, PLUTE_BLUE, PLUTE_BLUE, PLUTE_EDGE],
  [PLUTE_EDGE, PLUTE_BLUE, PLUTE_BLUE, PLUTE_DARK, PLUTE_BLUE, PLUTE_BLUE, PLUTE_EDGE],
];

let slopeMasks = null;
function slopeMask(t) {
  if (!slopeMasks) {
    slopeMasks = new Map([
      [INFO_UP_RIGHT_45, MASK_UP_RIGHT_45], [INFO_UP_RIGHT_45w, MASK_UP_RIGHT_45],
      [INFO_DOWN_RIGHT_45, MASK_DOWN_RIGHT_45], [INFO_DOWN_RIGHT_45w, MASK_DOWN_RIGHT_45],
      [INFO_UP_RIGHT_30_1, MASK_UP_RIGHT_30_1], [INFO_UP_RIGHT_30_1w, MASK_UP_RIGHT_30_1],
      [INFO_UP_RIGHT_30_2, MASK_UP_RIGHT_30_2], [INFO_UP_RIGHT_30_2w, MASK_UP_RIGHT_30_2],
      [INFO_DOWN_RIGHT_30_1, MASK_DOWN_RIGHT_30_1], [INFO_DOWN_RIGHT_30_1w, MASK_DOWN_RIGHT_30_1],
      [INFO_DOWN_RIGHT_30_2, MASK_DOWN_RIGHT_30_2], [INFO_DOWN_RIGHT_30_2w, MASK_DOWN_RIGHT_30_2],
    ]);
  }
  const m = slopeMasks.get(t);
  return m === undefined ? null : maskOf(srfcMasks[m]);
}

function infoAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return INFO_SOLID;
  return level.INFO[tx][ty];
}

// Is world pixel (px, py) solid for something moving sideways in direction dir, or falling onto it (dir 0)?
function solidPixel(level, px, py, dir) {
  const tx = Math.floor(px / TILESIZE), ty = Math.floor(py / TILESIZE);
  const t = infoAt(level, tx, ty);
  if (dir > 0 ? gfnTile_SolidFromLeft(t) : dir < 0 ? gfnTile_SolidFromRight(t) : gfnTile_SolidFromTop(t)) return true;
  const m = slopeMask(t);
  return !!m && m.bits[(py - ty * TILESIZE) * TILESIZE + px - tx * TILESIZE] === 1;
}

// Block faces are drawn up to a tile outside their INFO solid (the left sliver on FG1, the right face on BG2), so in
// the tile in front of a wall the tile graphics count as wall too.
function wallPixel(level, px, py, dir) {
  if (solidPixel(level, px, py, dir)) return true;
  const tx = Math.floor(px / TILESIZE), ty = Math.floor(py / TILESIZE);
  const next = infoAt(level, tx + dir, ty);
  if (!(dir > 0 ? gfnTile_SolidFromLeft(next) : gfnTile_SolidFromRight(next))) return false;
  const i = (py - ty * TILESIZE) * TILESIZE + px - tx * TILESIZE;
  for (const layer of [level.BG2, level.FG1, level.FG2]) {
    const g = layer[tx][ty];
    if (g > 0 && g <= MAXTILES && !tileEmpty[g - 1] && maskOf(srfcTileSheet[g - 1]).bits[i]) return true;
  }
  return false;
}

const canBeHit = (e) => !e.bullet && e.state !== ENEMY_STATE_DIE && e.image;

// Nearest distance in [from, to) along a horizontal beam (5 rows centred on y) that touches an enemy's pixels
function beamHit(x0, y, dir, from, to, enemies, skip) {
  let best = null;
  for (const e of enemies) {
    if (!canBeHit(e) || skip.has(e)) continue;
    const ex = pyround(e.x), ey = pyround(e.y), m = e.mask || maskOf(e.image);
    const r0 = Math.max(y - 2, ey), r1 = Math.min(y + 2, ey + m.h - 1);
    if (r0 > r1) continue;
    let d0 = dir > 0 ? ex - x0 : x0 - (ex + m.w - 1), d1 = d0 + m.w - 1;
    d0 = Math.max(d0, from);
    d1 = Math.min(d1, to - 1, best ? best.d - 1 : Infinity);
    for (let d = d0; d <= d1 && !(best && best.e === e); d++) {
      const col = x0 + dir * d - ex;
      for (let r = r0; r <= r1; r++) {
        if (m.bits[(r - ey) * m.w + col]) { best = { e, d }; break; }
      }
    }
  }
  return best;
}

function addGoo(level, goo) {
  const all = level.sprite_Explosions.list.filter((s) => s instanceof PlutezarpGoo);
  if (all.length >= GOO_MAX) all[0].age = Math.max(all[0].age, all[0].life - GOO_FADE);
  level.sprite_Explosions.add(goo);
}

function clipPlay(ctx, level) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(level.playX, level.playY, level.playWidth, level.playHeight);
  ctx.clip();
}

class PlutezarpBeam extends Sprite {
  constructor(keen) {
    super();
    this.id = W_PLUTEZARP;
    this.power = keen.weapon[W_PLUTEZARP].damage;
    this.dir = keen.direction;
    keen.shootUp = keen.shootDown = false;
    // Muzzle of Keen's Plutezarp frames: standing (130 left / 131 right) or jumping (133 / 134)
    const air = keen.state === kFALLING, kx = pyround(keen.x), ky = pyround(keen.y);
    if (this.dir === 1) {
      this.x0 = kx + (air ? 46 : 42);
      this.y = ky + (air ? 26 : 27);
    } else {
      this.x0 = kx + (air ? -1 : 3);
      this.y = ky + (air ? 26 : 28);
    }
    this.len = 0;         // the beam covers distances [tail, len) from the muzzle
    this.tail = 0;
    this.phase = 0;       // 0 growing, 1 holding, 2 retracting
    this.timer = 0;
    this.endTime = 0;
    this.hit = new Set();
    this.level = null;
    this.how = null;      // 'wall' | 'enemy' | 'air' once the beam has stopped
    this.rect = new Rect(0, 0, 0, 0);
  }

  update(dt, level, enemies) {
    this.level = level;
    this.timer += dt;
    if (this.phase === 0) {
      const target = Math.min(PLUTE_RANGE, trunc(this.timer * PLUTE_SPEED));
      let wall = false;
      while (this.len < target) {
        if (wallPixel(level, this.x0 + this.dir * this.len, this.y, this.dir)) { wall = true; break; }
        this.len += 1;
      }
      const h = beamHit(this.x0, this.y, this.dir, 0, this.len, enemies, this.hit);
      if (h) {
        this.len = h.d;
        this.strike(h.e, level);
        this.finish(level, 'enemy', h.e);
      } else if (wall) {
        this.finish(level, 'wall');
      } else if (this.len >= PLUTE_RANGE) {
        this.finish(level, 'air');
      }
      return;
    }
    if (this.phase === 1) {
      // Anything stepping into the beam while it holds is hit too
      for (let h; (h = beamHit(this.x0, this.y, this.dir, 0, this.len, enemies, this.hit));) this.strike(h.e, level);
      if (this.timer - this.endTime >= PLUTE_HOLD) this.phase = 2;
      return;
    }
    this.tail += Math.max(1, this.len) / PLUTE_RETRACT * dt;
    if (this.tail >= this.len) this.kill();
  }

  strike(enemy, level) {
    this.hit.add(enemy);
    damageEnemy(enemy, this.power, this.id, level);
    const x = this.x0 + this.dir * this.len;
    addParticles(level.sprite_Explosions, 14, x, this.y, () => PLUTE_RGB[trunc(rand() * 2)]);
  }

  // The beam stops: it leaves a splat on a wall, or a glob of residue that falls from its tip
  finish(level, how, enemy) {
    this.phase = 1;
    this.endTime = this.timer;
    this.how = how;
    const x = this.x0 + this.dir * this.len;
    addParticles(level.sprite_Explosions, how === 'air' ? 8 : 18, x, this.y, () => PLUTE_RGB[trunc(rand() * 3)]);
    if (how === 'wall') {
      playSound(SFX_W_HITWALL);
      addGoo(level, new PlutezarpGoo(level, x, this.y, this.dir, true));
    } else {
      const back = how === 'enemy';
      const goo = new PlutezarpGoo(level, x - this.dir, this.y, this.dir, false, back ? -this.dir * 30 : this.dir * 70, back ? -70 : 0);
      if (enemy) goo.cool.set(enemy, GOO_TICK);
      addGoo(level, goo);
    }
  }

  draw(ctx) {
    const level = this.level;
    if (!level) return;
    const dir = this.dir, a = trunc(this.tail), b = this.len;
    if (b <= a) return;
    const ox = level.playX - level.mapX, sy = this.y + level.playY - level.mapY;
    const px = (d) => this.x0 + dir * d + ox;
    // Horizontal run of distances [d0, d1) on beam row r
    const run = (c, d0, d1, r) => {
      if (d1 <= d0) return;
      ctx.fillStyle = c;
      ctx.fillRect(dir > 0 ? px(d0) : px(d1 - 1), sy + r, d1 - d0, 1);
    };
    const dot = (c, d, r) => run(c, d, d + 1, r);
    clipPlay(ctx, level);

    const growing = this.phase === 0;
    const q = this.phase === 2 ? this.tail / Math.max(1, this.len) : 0;
    const half = q < 0.4 ? 2 : q < 0.75 ? 1 : 0;
    const bodyEnd = growing ? Math.max(a, b - PLUTE_HEAD.length) : b;
    for (let r = -half; r <= half; r++) {
      const c = half === 2 ? PLUTE_ROWS[r + 2] : half === 1 ? (r === 0 ? PLUTE_DARK : PLUTE_EDGE) : PLUTE_BLUE;
      run(c, a, bodyEnd, r);
    }
    // Dark pulses run along the centre towards the tip
    if (half >= 1) {
      const shift = trunc(this.timer * 480);
      for (let d = a; d < bodyEnd; d++) if ((((d - shift) % 10) + 10) % 10 < 4) dot(PLUTE_DARK, d, 0);
      if (half === 2) for (let d = a; d < bodyEnd; d++) if ((((d - shift) % 10) + 10) % 10 === 5) dot(PLUTE_DARK, d, 1);
    }
    // Sparks flickering along the edges
    for (let i = trunc((bodyEnd - a) / 24); i > 0; i--) {
      dot(PLUTE_EDGE, a + trunc(rand() * (bodyEnd - a)), (rand() < 0.5 ? -1 : 1) * (half + 1 + trunc(rand() * 2)));
    }
    if (growing) {
      PLUTE_HEAD.forEach((col, k) => {
        const d = b - 1 - k;
        if (d < a) return;
        const h = (col.length - 1) / 2;
        col.forEach((c, i) => dot(i === h && k < 3 && rand() < 0.5 ? PLUTE_DARK : c, d, i - h));
      });
    } else if (this.phase === 1) {
      PLUTE_HEAD[0].forEach((c, i) => dot(c, b, i - 1));
    } else {
      // Retracting tail gets the same tapered head, running backwards toward the tip
      PLUTE_HEAD.forEach((col, k) => {
        const d = a + k;
        if (d >= b) return;
        const h = (col.length - 1) / 2;
        col.forEach((c, i) => dot(c, d, i - h));
      });
    }
    // Muzzle flash while the beam is still attached; flecks left behind the retracting tail
    if (a === 0 && (this.phase === 0 || this.timer - this.endTime < 0.1) && trunc(this.timer * 40) % 2 === 0) {
      for (const r of [-4, -3, 3, 4]) dot(PLUTE_EDGE, Math.abs(r) - 3, r);
      dot(PLUTE_BLUE, 0, -3);
      dot(PLUTE_BLUE, 0, 3);
    }
    if (this.phase === 2) {
      for (let i = 0; i < 6; i++) dot(rand() < 0.5 ? PLUTE_EDGE : PLUTE_BLUE, a - 1 - trunc(rand() * 12), trunc(rand() * 7) - 3);
    }
    // Impact bloom at the tip for a moment after the beam stops
    if (this.phase === 1 && this.how !== 'air') {
      const bloom = 1 - Math.min(1, (this.timer - this.endTime) / 0.12);
      if (bloom > 0) {
        for (let i = 0; i < 10; i++) {
          const ang = rand() * Math.PI * 2, rad = rand() * (3 + bloom * 5);
          dot(rand() < 0.4 ? PLUTE_EDGE : PLUTE_BLUE, b + Math.round(Math.cos(ang) * rad * this.dir), Math.round(Math.sin(ang) * rad));
        }
      }
    }
    ctx.restore();
  }
}

// Deadly residue: a splat (with goo dripping down the wall) where the beam hits a wall, or a glob that falls from the
// beam's tip and spreads into a bubbling puddle where it lands. It hurts enemies touching it, then dissolves.
class PlutezarpGoo extends Sprite {
  constructor(level, x, y, dir, onWall, vx, vy) {
    super();
    this.level = level;
    this.dir = dir;
    this.age = 0;
    this.life = GOO_LIFE + rand() * 1.5;
    this.pixels = [];     // { x, y, c, die }
    this.drips = [];
    this.drops = [];
    this.bubbles = [];
    this.tops = [];       // puddle surface, where bubbles rise from
    this.bubbleTimer = 0.3;
    this.cool = new Map();
    this.glob = null;
    this.rect = new Rect(0, 0, 0, 0);
    if (onWall) this.splat(x, y);
    else this.glob = { x, y, vx, vy };
  }

  // Pixels vanish one by one, in random order, over the last GOO_FADE seconds
  fadeAt() { return this.life - GOO_FADE + rand() * GOO_FADE; }

  add(x, y, c, die) {
    if (solidPixel(this.level, x, y, 0) || solidPixel(this.level, x, y, this.dir)) return false;
    this.pixels.push({ x, y, c, die: die === undefined ? this.fadeAt() : die });
    return true;
  }

  // First wall pixel on row y, looking from a little in front of x
  surface(x, y) {
    const s = x - this.dir * 6;
    for (let k = 0; k <= 12; k++) if (wallPixel(this.level, s + this.dir * k, y, this.dir)) return s + this.dir * k;
    return null;
  }

  splat(ax, ay) {
    const dir = this.dir;
    const rv = 10 + trunc(rand() * 4), ru = 8 + rand() * 3;
    const rows = new Map();   // v -> [surface x, extent]
    for (let v = -rv; v <= rv; v++) {
      const sx = this.surface(ax, ay + v);
      const wobble = Math.sin(v * 1.4 + ax * 0.17) * 1.4 + rand() * 1.8 - 0.7;
      const e = Math.round(ru * Math.sqrt(Math.max(0, 1 - (v / (rv + 0.5)) ** 2)) + wobble);
      if (sx !== null && e >= 1) rows.set(v, [sx, e]);
    }
    // A second, lower lobe so the splat reads as a hanging blob, not a clean ellipse
    const lobe = 2 + trunc(rand() * 3);
    for (let v = 1; v <= lobe; v++) {
      const y = ay + rv - 1 + v;
      const sx = this.surface(ax, y);
      const e = Math.max(2, Math.round((ru * 0.55) * Math.sqrt(Math.max(0, 1 - (v / (lobe + 1)) ** 2)) + rand() * 1.2));
      if (sx !== null) rows.set(rv - 1 + v, [sx, e]);
    }
    const ext = (v) => (rows.has(v) ? rows.get(v)[1] : 0);
    for (const [v, [sx, e]] of rows) {
      for (let u = 1; u <= e; u++) {
        const rim = u === e || u > ext(v - 1) || u > ext(v + 1);
        this.add(sx - dir * u, ay + v, rim ? PLUTE_EDGE : v > 1 && u <= e - 2 ? PLUTE_DARK : PLUTE_BLUE);
      }
    }
    // Spatter thrown back off the wall
    for (let i = 5 + trunc(rand() * 5); i > 0; i--) {
      const u = trunc(ru) + 2 + trunc(rand() * 7), v = Math.round((rand() * 2 - 1) * (rv + 3));
      this.add(ax - dir * u, ay + v, rand() < 0.6 ? PLUTE_EDGE : PLUTE_BLUE, 0.4 + rand() * 1.6);
    }
    // Drips start under the lower half of the blob and run down the wall
    const used = new Set();
    for (let i = 3 + trunc(rand() * 3); i > 0; i--) {
      const lower = [...rows.keys()].filter((v) => v >= 0);
      if (!lower.length) break;
      const v = lower[trunc(rand() * lower.length)];
      const u = 1 + trunc(rand() * Math.max(1, ext(v) - 1));
      if (used.has(u)) continue;
      used.add(u);
      let vb = v;
      while (ext(vb + 1) >= u) vb++;
      this.drips.push({
        ax, u, y0: ay + vb + 1, xs: [], len: 0, max: 10 + trunc(rand() * 22), speed: 8 + rand() * 14,
        wide: rand() < 0.55, stopped: false, bulb: 0,
      });
    }
  }

  puddle(cx, fy) {
    const rx = 6 + trunc(rand() * 3);
    for (let dx = -rx; dx <= rx; dx++) {
      const x = cx + dx;
      let f = null;
      for (let y = fy - 3; y <= fy + 3 && f === null; y++) {
        if (solidPixel(this.level, x, y, 0) && !solidPixel(this.level, x, y - 1, 0)) f = y;
      }
      if (f === null) continue;
      const h = Math.max(1, Math.round(2.4 * Math.sqrt(1 - (dx / (rx + 0.5)) ** 2) + rand() * 0.8 - 0.3));
      for (let k = 1; k <= h; k++) {
        this.pixels.push({ x, y: f - k, c: k === h || Math.abs(dx) === rx ? PLUTE_EDGE : k === 1 ? PLUTE_DARK : PLUTE_BLUE, die: this.fadeAt() });
      }
      this.tops.push([x, f - h]);
    }
    addParticles(this.level.sprite_Explosions, 16, cx, fy - 2, () => PLUTE_RGB[trunc(rand() * 2)]);
  }

  updateGlob(dt) {
    const g = this.glob, L = this.level;
    g.vy += GOO_GRAVITY * dt;
    if (g.vx) {
      const s = g.vx > 0 ? 1 : -1, nx = g.x + g.vx * dt;
      if (wallPixel(L, Math.round(nx) + s * 2, Math.round(g.y), s)) g.vx = 0;
      else g.x = nx;
    }
    const x = Math.round(g.x);
    let y = g.y;
    const target = g.y + g.vy * dt;
    while (y < target) {
      const step = Math.min(1, target - y);
      if (solidPixel(L, x, Math.floor(y + step) + 2, 0)) {
        this.glob = null;
        this.puddle(x, Math.floor(y + step) + 2);
        return;
      }
      y += step;
    }
    g.y = target < g.y ? target : y;
    if (gfnTile_Water(infoAt(L, Math.floor(x / TILESIZE), Math.floor(g.y / TILESIZE))) || g.y > L.height * TILESIZE) {
      this.glob = null;
      this.life = this.age;
    }
  }

  updateDrips(dt) {
    const L = this.level, dir = this.dir, live = this.age < this.life - GOO_FADE;
    for (const d of this.drips) {
      if (!d.stopped && d.len < d.max) {
        d.len = Math.min(d.max, d.len + d.speed * dt);
        while (d.xs.length < Math.floor(d.len)) {
          const y = d.y0 + d.xs.length;
          const sx = this.surface(d.ax, y);
          let x = sx !== null ? sx - dir * d.u : d.xs.length ? d.xs[d.xs.length - 1] : d.ax - dir * d.u;
          if (wallPixel(L, x, y, dir)) x -= dir;
          if (solidPixel(L, x, y, 0) || wallPixel(L, x, y, dir)) {
            d.stopped = true;
            d.len = d.xs.length;
            break;
          }
          d.xs.push(x);
        }
      } else if (!d.stopped && d.xs.length && live) {
        // A drop gathers at the end, swells and falls
        d.bulb += dt;
        if (d.bulb > 0.9) {
          d.bulb = -0.6 - rand();
          this.drops.push({ x: d.xs[d.xs.length - 1], y: d.y0 + d.xs.length + 1, vy: 0 });
        }
      }
    }
    for (const p of this.drops.slice()) {
      p.vy += GOO_GRAVITY * dt;
      const target = p.y + p.vy * dt;
      for (; p.y < target; p.y += 1) {
        if (solidPixel(L, p.x, Math.floor(p.y) + 1, 0)) {
          const fy = Math.floor(p.y);
          this.add(p.x - 1, fy, PLUTE_EDGE, this.age + 1 + rand());
          this.add(p.x, fy, PLUTE_BLUE, this.age + 1.5 + rand());
          this.add(p.x + 1, fy, PLUTE_EDGE, this.age + 1 + rand());
          this.drops.splice(this.drops.indexOf(p), 1);
          break;
        }
      }
      if (p.y > L.height * TILESIZE) this.drops.splice(this.drops.indexOf(p), 1);
    }
  }

  updateBubbles(dt) {
    if (this.tops.length && this.age < this.life - GOO_FADE) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) {
        this.bubbleTimer = 0.25 + rand() * 0.7;
        const [x, y] = this.tops[trunc(rand() * this.tops.length)];
        this.bubbles.push({ x, y, t: 0, max: 0.3 + rand() * 0.4 });
      }
    }
    for (const b of this.bubbles) b.t += dt;
    this.bubbles = this.bubbles.filter((b) => b.t < b.max);
  }

  // Calls fn(x, y, colour) for every pixel currently showing
  each(fn) {
    const age = this.age, dir = this.dir;
    for (const p of this.pixels) if (age < p.die) fn(p.x, p.y, p.c);
    const fading = Math.max(0, (age - (this.life - GOO_FADE)) / GOO_FADE);
    const keep = (x, y) => fading === 0 || ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1 >= fading;
    for (const d of this.drips) {
      const n = d.xs.length;
      for (let i = 0; i < n; i++) {
        const x = d.xs[i], y = d.y0 + i;
        if (!keep(x, y)) continue;
        fn(x, y, i === n - 1 && !d.stopped ? PLUTE_DARK : PLUTE_BLUE);
        if (d.wide && i < n * 0.4) fn(x - dir, y, PLUTE_EDGE);
      }
      if (n && !d.stopped && d.len >= d.max && d.bulb > 0 && keep(d.xs[n - 1], d.y0 + n)) {
        fn(d.xs[n - 1], d.y0 + n, d.bulb > 0.45 ? PLUTE_DARK : PLUTE_EDGE);
        if (d.bulb > 0.45) fn(d.xs[n - 1], d.y0 + n + 1, PLUTE_EDGE);
      }
    }
    for (const p of this.drops) {
      fn(p.x, Math.floor(p.y), PLUTE_BLUE);
      if (p.vy > 80) fn(p.x, Math.floor(p.y) - 1, PLUTE_EDGE);
    }
    const g = this.glob;
    if (g) {
      const x = Math.round(g.x), y = Math.round(g.y);
      fn(x, y - 1, PLUTE_EDGE);
      fn(x - 1, y, PLUTE_EDGE); fn(x, y, PLUTE_BLUE); fn(x + 1, y, PLUTE_EDGE);
      fn(x - 1, y + 1, PLUTE_EDGE); fn(x, y + 1, PLUTE_DARK); fn(x + 1, y + 1, PLUTE_EDGE);
      if (g.vy > 120) fn(x, y - 2, PLUTE_BLUE);
      if (g.vy > 220) fn(x, y - 4, PLUTE_EDGE);
    }
  }

  overlapsMask(ox, oy, m, pts) {
    if (!m) return -1;
    for (let i = 0; i < pts.length; i += 2) {
      const mx = pts[i] - ox, my = pts[i + 1] - oy;
      if (mx >= 0 && my >= 0 && mx < m.w && my < m.h && m.bits[my * m.w + mx]) return i;
    }
    return -1;
  }

  hurtThings(keen, game) {
    const L = this.level, pts = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    this.each((x, y) => {
      pts.push(x, y);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    });
    if (!pts.length) return;
    for (const e of L.sprite_Enemies) {
      if (!canBeHit(e) || (this.cool.get(e) || 0) > this.age) continue;
      const ex = pyround(e.x), ey = pyround(e.y), m = e.mask || maskOf(e.image);
      if (ex > x1 || ey > y1 || ex + m.w <= x0 || ey + m.h <= y0) continue;
      const i = this.overlapsMask(ex, ey, m, pts);
      if (i < 0) continue;
      this.cool.set(e, this.age + GOO_TICK);
      damageEnemy(e, GOO_DAMAGE, W_PLUTEZARP, L);
      addParticles(L.sprite_Explosions, 6, pts[i], pts[i + 1], () => PLUTE_RGB[trunc(rand() * 2)]);
    }
    if (!keen || keen.powerUp === pwrGOD || keen.state === kDYING || keen.canHurt !== 0) return;
    const kx = pyround(keen.x), ky = pyround(keen.y);
    const km = keen.mask || (keen.image && maskOf(keen.image));
    if (!km || kx > x1 || ky > y1 || kx + km.w <= x0 || ky + km.h <= y0) return;
    const i = this.overlapsMask(kx, ky, km, pts);
    if (i < 0) return;
    keen.hurt(GOO_KEEN, game, L);
    addParticles(L.sprite_Explosions, 6, pts[i], pts[i + 1], () => PLUTE_RGB[trunc(rand() * 2)]);
  }

  update(t, dt, level, keen, game) {
    this.age += dt;
    if (this.glob) this.updateGlob(dt);
    this.updateDrips(dt);
    this.updateBubbles(dt);
    this.hurtThings(keen, game);
    if (this.age >= this.life && !this.glob && !this.drops.length) this.kill();
  }

  draw(ctx) {
    const L = this.level, ox = L.playX - L.mapX, oy = L.playY - L.mapY;
    clipPlay(ctx, L);
    this.each((x, y, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x + ox, y + oy, 1, 1);
    });
    ctx.fillStyle = PLUTE_EDGE;
    for (const b of this.bubbles) {
      const k = b.t / b.max;
      if (k < 0.75) ctx.fillRect(b.x + ox, b.y - 1 - trunc(k * 4) + oy, 1, 1);
      else {
        ctx.fillRect(b.x - 1 + ox, b.y - 4 + oy, 1, 1);
        ctx.fillRect(b.x + 1 + ox, b.y - 4 + oy, 1, 1);
      }
    }
    ctx.restore();
  }
}

class Explode extends Sprite {
  constructor(x, y, id, dir, up, down) {
    super();
    this.x = x;
    this.y = y;
    this.id = id;
    this.last_update = ticks();
    this.frame = 0;
    this.init_frame = 0;
    this.rect = new Rect(1, 1, 1, 1);
    this.direction = dir;
    this.up = up;
    this.down = down;
    this.x += 4 * dir * -1;
    switch (id) {
      case W_ZEFFER: this.init_frame = XPLOD_ZEFFER; this.max_frames = 1; this.fps = 4; break;
      case W_PULSAR:
        this.init_frame = XPLOD_PULSAR; this.max_frames = 5; this.fps = 10;
        if (up) this.y += 6;
        else if (down) this.y -= 6;
        break;
      case W_SOLARIZER: this.init_frame = XPLOD_SOLARIZER; this.max_frames = 4; this.fps = 10; break;
      case W_HR42: this.init_frame = XPLOD_HR42; this.max_frames = 6; this.fps = 8; break;
      case W_RAYGUN: this.init_frame = trunc(XPLOD_RAYGUN + pyround(rand())); this.max_frames = 0; this.fps = 1; break;
      case W_NEURAL: this.init_frame = XPLOD_NEURAL; this.max_frames = 1; this.fps = 4; break;
      case SPRITE_ROBOT_RED_BULLET:
        this.init_frame = XPLOD_REDROBOT; this.max_frames = 5; this.fps = 8;
        this.x += 5 * dir;
        this.y += 13;
        break;
    }
    this.image = srfcExplosions[this.init_frame];
    if (id === W_EXPLODE) {
      this.init_frame = trunc(pyround(rand())) * 5;
      this.max_frames = 4;
      this.fps = 10;
      this.image = srfcExplosions2[this.init_frame];
    } else if (isIsonianProj(id)) {
      this.init_frame = 0;
      this.max_frames = 4;
      this.fps = 8;
      this.image = srfcExplosionsIsonian[this.init_frame];
    }
    this.width = this.image.get_width();
    this.height = this.image.get_height();
  }

  update(t, dt, level, keen, game) {
    if (t - this.last_update > 1000.0 / this.fps) {
      if (this.frame < this.max_frames) {
        this.frame += 1;
        const sheet = isIsonianProj(this.id) ? srfcExplosionsIsonian : this.id < W_EXPLODE ? srfcExplosions : srfcExplosions2;
        const img = sheet[this.init_frame + this.frame];
        this.image = this.direction === -1 ? img : flipH(img);
      } else {
        this.kill();
      }
      this.last_update = t;
    }
    if (this.id === W_PULSAR) {
      if (this.up) this.image = rotate90(srfcExplosions[this.init_frame + this.frame], -90);
      else if (this.down) this.image = rotate90(srfcExplosions[this.init_frame + this.frame], 90);
    }
    if (this.id === W_SOLARIZER && collideMask(this, keen)) keen.hurt(10, game, level);
    this.rect = new Rect(pyround(this.x - level.mapX) + level.playX, pyround(this.y - level.mapY) + level.playY, this.width, this.height);
  }
}
