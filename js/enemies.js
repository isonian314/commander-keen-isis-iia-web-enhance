'use strict';
// Enemies & enemy projectiles (isis_enemies.py)

const ENEMY_STATE_WALK = 0, ENEMY_STATE_JUMP = 1, ENEMY_STATE_IDLE = 2, ENEMY_STATE_ATTACK = 3,
  ENEMY_STATE_DIE = 4, ENEMY_STATE_WAKEUP = 5;

const SPRITE_RAT_BULLET = 1, SPRITE_SPIDER_PROJ = 2, SPRITE_DEMON_FIREBALL = 3, SPRITE_ROBOT_GREY_BULLET = 4,
  SPRITE_ROBOT_RED_BULLET = 5, SPRITE_HOVER_BULLET = 6, SPRITE_SLUG_PROJ = 7, SPRITE_SHAPESHIFTER_PROJ = 8,
  SPRITE_TELETURRET_PROJ = 9, SPRITE_EVILKEEN_PROJ = 10, SPRITE_ISONIAN_PROJ1g = 11, SPRITE_ISONIAN_PROJ1r = 12,
  SPRITE_ISONIAN_PROJ1w = 13;

const isIsonianProj = (id) => id === SPRITE_ISONIAN_PROJ1g || id === SPRITE_ISONIAN_PROJ1r || id === SPRITE_ISONIAN_PROJ1w;

// Enemy health bar shown while the Ion Scanner is active
function ionScan(ctx, e) {
  const w = 20, h = 4;
  const x = trunc(e.rect.x + (e.width - w) / 2.0), y = trunc(e.rect.y - h);
  const energy = Math.max(0, Math.min(w, trunc((e.hitPoints / e.maxHit) * w)));
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgb(255,0,0)';
  ctx.fillRect(x, y, energy, h);
}

// ---------------------------------------------------------------------------------------------
// Enemy terrain movement (gfn_PushEnemy). Lookups outside the level abort the push, as the
// original caught IndexError.

function pushEnemy(e, level, ax, ay) {
  const g = (x, y) => grid(level.INFO, x, y, true);
  try {
    if (ax !== 0) {
      const right = ax > 0;
      if (right ? e.x + e.width < level.width * TILESIZE - 1 : e.x > 1) {
        e.x += ax;
        e.updateSubRect();
      }
      const sr = e.subRect;
      const tx = trunc(sr.midbottomX / TILESIZE), ty = trunc(sr.bottom / TILESIZE);
      const climb45 = right ? gfnTile_UpRight45 : gfnTile_DownRight45;
      const climb30 = right ? upRight30 : downRight30;
      const desc45 = right ? gfnTile_DownRight45 : gfnTile_UpRight45;
      const desc30 = right ? downRight30 : upRight30;
      const mag = Math.abs(ax);
      if (climb45(g(tx, ty)) || climb45(g(tx, ty - 1))) {
        e.y -= 3 * mag / 4.0;
        e.x -= ax / 4.0;
      } else if (climb30(g(tx, ty)) || climb30(g(tx, ty - 1))) {
        e.y -= mag / 2.0;
      } else if (desc45(g(tx, ty)) || desc45(g(tx, ty + 1))) {
        e.y += mag;
      } else if (desc30(g(tx, ty)) || desc30(g(tx, ty + 1))) {
        e.y += mag / 2.0;
      } else {
        let TileYpix = sr.y - pmod(sr.y, TILESIZE) + 1;
        const TestEndY = sr.y + sr.h - 1;
        let xChange = false;
        const TileX = right ? trunc((sr.x + sr.w) / TILESIZE) : trunc(sr.x / TILESIZE);
        for (let TileY = trunc(TileYpix / TILESIZE); TileYpix <= TestEndY; TileY++, TileYpix += TILESIZE) {
          if (right) {
            const behind = g(TileX - 1, TileY);
            if (gfnTile_SolidEnemy(g(TileX, TileY)) && !gfnTile_UpRight45(behind) && !upRight30(behind)) xChange = true;
          } else if (gfnTile_SolidEnemy(g(TileX, TileY)) && !gfnTile_DownRight45(g(TileX + 1, TileY)) &&
            !gfnTile_UpRight45(g(TileX + 1, TileY - 1)) && !downRight30(g(TileX + 1, TileY - 1))) {
            xChange = true;
          }
        }
        if (xChange && !e.bullet) {
          e.x = right ? TileX * TILESIZE - sr.w - e.rectOffsetX - 2 : (TileX + 1) * TILESIZE - e.rectOffsetX + 2;
          e.direction *= -1;
        }
        // Walked off a ledge?
        let fall = true;
        let TileXpix = sr.x - pmod(sr.x, TILESIZE) + (right ? 4 : 0);
        const TestEndX = sr.x + sr.w - (right ? 2 : 0);
        const TileY = trunc((sr.y + sr.h + 2) / TILESIZE);
        for (let x = trunc(TileXpix / TILESIZE); TileXpix <= TestEndX; x++, TileXpix += TILESIZE) {
          if (gfnTile_SolidEnemy(g(x, TileY))) fall = false;
        }
        if (fall && e.onGround) {
          e.vy = 0;
          e.onGround = false;
        }
        const floorY = TileY * TILESIZE - sr.h - e.rectOffsetY - 1;
        if (e.onGround && e.y > floorY) e.y = floorY;
      }
    } else if (ay > 0) {
      if (e.y < level.height * TILESIZE - e.height - TILESIZE) {
        e.y += ay;
        e.updateSubRect();
      }
      if (!e.bullet) {
        const sr = e.subRect;
        const TileX = trunc(sr.midbottomX / TILESIZE), TileY = trunc(sr.bottom / TILESIZE);
        const bm = pmod(sr.bottom, TILESIZE), mx = pmod(sr.midbottomX, TILESIZE);
        const t = g(TileX, TileY);
        const land = (surface) => {
          if (bm > surface) {
            e.y -= bm - surface;
            e.vy = 0;
            e.onGround = true;
          }
        };
        if (gfnTile_UpRight45(t)) land(TILESIZE - mx);
        else if (gfnTile_UpRight30_1(t)) land(TILESIZE - mx * 0.5);
        else if (gfnTile_UpRight30_2(t)) land(TILESIZE - (mx + TILESIZE) * 0.5);
        else if (gfnTile_DownRight45(t)) land(mx);
        else if (gfnTile_DownRight30_1(t)) land(mx * 0.5);
        else if (gfnTile_DownRight30_2(t)) land((mx + TILESIZE) * 0.5);
        else {
          let TileXpix = sr.x - pmod(sr.x, TILESIZE);
          const TestEnd = sr.x + sr.w;
          for (let x = trunc(TileXpix / TILESIZE); TileXpix <= TestEnd; x++, TileXpix += TILESIZE) {
            if (gfnTile_SolidEnemy(g(x, TileY))) {
              e.y = TileY * TILESIZE - sr.h - e.rectOffsetY - 1;
              e.onGround = true;
              e.vy = 0;
            }
          }
        }
      }
    } else if (ay < 0) {
      if (e.y > TILESIZE) {
        e.y += ay;
        e.updateSubRect();
      }
      const sr = e.subRect;
      let TileXpix = sr.x - pmod(sr.x, TILESIZE);
      const TestEnd = sr.x + sr.w;
      const TileY = trunc(sr.y / TILESIZE);
      for (let x = trunc(TileXpix / TILESIZE); TileXpix <= TestEnd; x++, TileXpix += TILESIZE) {
        if (gfnTile_SolidFromBottom(g(x, TileY))) {
          e.vy = 0;
          e.y -= ay;
        }
      }
    }
    e.updateSubRect();
  } catch (err) {
    if (!(err instanceof PyIndexError)) throw err;
  }
}

// ---------------------------------------------------------------------------------------------
// Shared enemy base

class EnemyBase extends Sprite {
  constructor(x, y, id, dir) {
    super();
    this.x = x * TILESIZE;
    this.y = y * TILESIZE;
    this.id = id;
    this.vx = 1;
    this.vy = 0;
    this.moveAmountX = 0;
    this.moveAmountY = 0;
    this.onGround = false;
    this.last_update = ticks();
    this.frame = 0;
    this.dirChange = 0;
    this.direction = dir;
    this.state = ENEMY_STATE_WALK;
    this.bullet = false;
    this.fadeTime = 0;
    this.fadeMax = 1.5;
    this.rectOffsetX = 0;
    this.rectOffsetY = 0;
  }

  // Sizes come from the first frame; rect = [offsetX, offsetY, extra width, extra height]
  setImages(images, rect, rectAbs) {
    this.images = images;
    this.image = images[this.frame];
    this.width = this.image.get_width();
    this.height = this.image.get_height();
    if (rectAbs) {
      [this.rectOffsetX, this.rectOffsetY, this.rectW, this.rectH] = rectAbs;
    } else {
      const r = rect || [0, 0, 0, 0];
      this.rectOffsetX = r[0];
      this.rectOffsetY = r[1];
      this.rectW = this.width + r[2];
      this.rectH = this.height + r[3];
    }
    this.initRects();
  }

  initRects() {
    this.updateSubRect();
    this.rect = this.subRect;
  }

  updateSubRect() {
    this.subRect = new Rect(pyround(this.x) + this.rectOffsetX, pyround(this.y) + this.rectOffsetY, this.rectW, this.rectH);
  }

  setDisplayRect(level) {
    this.rect = new Rect(pyround(this.x - level.mapX) + level.playX, pyround(this.y - level.mapY) + level.playY, this.width, this.height);
  }

  // Image for the current frame, mirrored when facing right
  faceImage() {
    const img = this.images[this.frame];
    if (!img) return;
    if (this.direction === -1) this.image = img;
    else if (this.direction === 1) this.image = flipH(img);
  }

  fadeDeath() {
    const a = 255 - (this.fadeTime / this.fadeMax) * 255;
    this.image.set_alpha(a);
    if (a <= 0) this.kill();
  }

  // Horizontal then vertical movement in 1px steps
  move(level) {
    if (this.direction !== 0) {
      for (let i = 0; i < trunc(Math.abs(this.moveAmountX)); i++) pushEnemy(this, level, this.direction, 0);
      pushEnemy(this, level, pmod(this.moveAmountX, 1) * this.direction, 0);
    }
    if (this.moveAmountY < 0) {
      for (let i = 0; i < trunc(Math.abs(this.moveAmountY)); i++) pushEnemy(this, level, 0, -1);
      pushEnemy(this, level, 0, pmod(this.moveAmountY, -1));
    } else if (this.moveAmountY > 0) {
      for (let i = 0; i < trunc(Math.abs(this.moveAmountY)); i++) if (!this.onGround) pushEnemy(this, level, 0, 1);
      if (!this.onGround) pushEnemy(this, level, 0, pmod(this.moveAmountY, 1));
    }
  }

  applyGravity(dt) {
    if (!this.onGround) {
      this.vy += dt * this.gravity;
      this.moveAmountY = dt * this.vy;
    }
  }

  inView(level) {
    return this.x > level.mapX && this.x < level.mapX + level.playWidth &&
      this.y > level.mapY && this.y < level.mapY + level.playHeight;
  }

  // Keen is in range and the enemy faces him (precision shooters)
  canSee(keen) {
    const ex = this.x + this.rectOffsetX + this.rectW / 2.0, ey = this.y + this.height;
    const kx = keen.x + keen.width / 2.0, ky = keen.y + keen.height;
    const facing = (this.direction === -1 && this.x > keen.x) || (this.direction === 1 && this.x < keen.x);
    return facing && Math.abs(ex - kx) < this.shootProximityX && Math.abs(ey - ky) < this.shootProximityY;
  }

  pushKeen(keen, level, amount) {
    keen.moveAmountX = amount;
    for (let i = 0; i < trunc(Math.abs(amount)); i++) keen.keenPush(level, keen.direction, 0);
    keen.keenPush(level, pmod(amount, 1) * keen.direction, 0);
    keen.rect = new Rect(keen.x - level.mapX + level.playX, keen.y - level.mapY + level.playY, 48, 48);
    keen.updateSubRect();
    level.updateCamera(keen);
    keen.idleTimer = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Walker: walking enemy with optional idle, jump, proximity ("close") and attack animations

const WALKER_DEFAULTS = {
  hp: 2, damage: 1, hasIdle: false, canJump: false, willFloat: false, canAttack: false, hasClose: false,
  dieLag: 1, dieFrame: 0, dieMax: 0, fadeMax: 1.5, idleFreq: 0, idleLag: 1, idleFrame: 0, idleMax: 0,
  jumpFreq: 0, jumpAmount: 0, jumpFrame: 0, prox: [0, 0], attackFrame: 0, attackMax: 0, attackLag: 0,
  closeFrame: 0, closeMax: 0, floatSpeed: 0, fps: 4, walk: [0, 0], speed: 35, gravity: 450,
};

const FOOG = { hasIdle: true, idleFreq: 5, idleLag: 3, dieLag: 3, sheet: [32, 32, 'enemy_foog.png'], fps: 6,
  walk: [0, 3], jumpFrame: 4, idleFrame: 6, idleMax: 8, dieFrame: 9, dieMax: 10 };
const FROG = { dieLag: 0.75, fps: 6, walk: [0, 5], dieFrame: 6, dieMax: 11 };
const TRUCK = { dieLag: 1, fps: 6, walk: [0, 3], fadeMax: 0.1, speed: 50 };
const UNFINISHED = { gravity: 0 };

const WALKERS = {
  [SPRITE_FOOG]: FOOG,
  [SPRITE_FOOGJUMP]: { ...FOOG, canJump: true, jumpAmount: -250, jumpFreq: 3 },
  [SPRITE_FOOG_WARRIOR]: { ...FOOG, hp: 500, damage: 2, sheet: [32, 32, 'enemy_foog_warrior.png'] },
  [SPRITE_FROG_WALK]: { ...FROG, sheet: [25, 23, 'enemy_frog_walk.png'] },
  [SPRITE_FROG_SWIM]: { ...FROG, sheet: [25, 23, 'enemy_frog_swim.png'], gravity: 0 },
  [SPRITE_PLANTGUY]: { dieLag: 0.75, sheet: [32, 32, 'enemy_plantguy.png'], fps: 6, walk: [0, 5] },
  [SPRITE_REDFISH]: { willFloat: true, dieLag: 0.75, sheet: [32, 32, 'enemy_redfish.png'], walk: [0, 1],
    dieFrame: 2, dieMax: 8, gravity: 0, floatSpeed: 40 },
  [SPRITE_CHOMPERFISH]: { damage: 3, hasIdle: true, willFloat: true, canAttack: true, hasClose: true, dieLag: 0.75,
    idleFreq: 5, idleLag: 0.5, idleFrame: 14, idleMax: 18, prox: [32, 32], attackFrame: 19, attackMax: 20,
    attackLag: 0.5, closeFrame: 7, closeMax: 13, sheet: [32, 32, 'enemy_chomperfish.png'], walk: [0, 6],
    dieFrame: 21, dieMax: 24, speed: 55, gravity: 0, floatSpeed: 40 },
  [SPRITE_MINE]: { hp: 9999999, maxHit: 9999999, damage: 0, hasClose: true, prox: [6, 8], closeFrame: 1, closeMax: 4,
    sheet: [18, 14, 'enemy_mine.png'], fps: 12, walk: [0, 0], speed: 0 },
  [SPRITE_YELLOW]: { hp: 8, damage: 4, canAttack: true, prox: [128.0, 64], attackFrame: 5, attackMax: 9, attackLag: 1,
    yellowPull: 200, sheet: [32, 64, 'enemy_yellow.png'], walk: [0, 4], dieFrame: 10, dieMax: 16, dieLag: 0.5, speed: 20 },
  [SPRITE_FLOPPY]: { sheet: [96, 32, 'enemy_floppy.png'], walk: [0, 3], rect: [0, 7, 0, 0] },
  [SPRITE_HOLEMONSTER]: { hp: 4, damage: 2, hasIdle: true, canAttack: true, hasClose: true, idleFreq: 3, idleLag: 3,
    idleFrame: 2, idleMax: 2, prox: [32, 32], attackFrame: 3, attackMax: 11, attackLag: 0.5, closeFrame: 1, closeMax: 1,
    sheet: [38, 21, 'enemy_holemonster.png'], walk: [0, 0], dieFrame: 12, dieMax: 12, speed: 0, gravity: 0, offset: [-2, 10] },
  [SPRITE_URCHIN]: { hp: 999999, canAttack: true, prox: [50, 50], attackFrame: 8, attackMax: 11, attackLag: 1,
    sheet: [16, 16, 'enemy_urchin.png'], walk: [0, 7], speed: 0 },
  [SPRITE_BLUEMOUTH]: { hp: 8, damage: 3, canAttack: true, prox: [16, 48], attackFrame: 6, attackMax: 16, attackLag: 0.5,
    sheet: [64, 64, 'enemy_bluemouth.png'], fps: 8, walk: [0, 5], dieFrame: 17, dieMax: 29, dieLag: 0.8, speed: 50,
    rect: [0, 32, 0, -32] },
  [SPRITE_CATERPILLAR]: { hp: 999999, maxHit: 2.0, damage: 0, hasClose: true, prox: [50, 20], attackFrame: 19,
    attackMax: 20, attackLag: 0.5, closeFrame: 1, closeMax: 5, sheet: [75, 38, 'enemy_caterpillar.png'], fps: 8,
    walk: [0, 0], speed: 0 },
  [SPRITE_SNAIL]: { sheet: [64, 32, 'enemy_snail.png'], walk: [0, 1], speed: 10 },
  [SPRITE_GARNAK]: { hp: 10, damage: 5, sheet: [96, 64, 'enemy_garnak.png'], fps: 8, walk: [0, 10], dieFrame: 12,
    dieMax: 19, speed: 40, rect: [24, 0, -48, 0] },
  [SPRITE_TRUCKGUY1]: { ...TRUCK, sheet: [72, 64, 'enemy_truckguy2.png'] },
  [SPRITE_TRUCKGUY2]: { ...TRUCK, sheet: [72, 64, 'enemy_truckguy1.png'] },
  [SPRITE_YORPY]: { hp: 1, damage: 0, hasIdle: true, idleFreq: 5, sheet: [16, 24, 'enemy_yorp.png'], walk: [0, 1],
    idleFrame: 2, idleMax: 5, idleLag: 1.5, dieFrame: 6, dieMax: 7, speed: 40 },
  [SPRITE_GARG]: { hp: 1, damage: 1, hasIdle: true, idleFreq: 5, sheet: [24, 32, 'enemy_garg.png'], walk: [0, 1],
    idleFrame: 2, idleMax: 5, dieFrame: 6, dieMax: 7, speed: 40 },
  [SPRITE_YELLOWFISH]: { ...UNFINISHED, sheet: [32, 64, 'enemy_yellowfish.png'] },
  [SPRITE_GREENFISH]: { ...UNFINISHED, sheet: [64, 32, 'enemy_greenfish.png'] },
  [SPRITE_BLUEFISH]: { ...UNFINISHED, sheet: [128, 64, 'enemy_bluefish.png'] },
  [SPRITE_BIGFROG]: { ...UNFINISHED, sheet: [46, 46, 'enemy_bigfrog.png'] },
  [SPRITE_ISONIAN_FLY]: { ...UNFINISHED, sheet: [112, 38, 'enemy_isonian-fly.png'], speed: 70, hp: 10, damage: 5 },
  [SPRITE_BIRD]: { sheet: [64, 72, 'enemy_bird.png'] },
  [SPRITE_ISONIAN_GIANT1]: { sheet: [64, 96, 'enemy_isonian_giant1.png'] },
  [SPRITE_ISONIAN_GIANT2]: { sheet: [64, 96, 'enemy_isonian_giant2.png'] },
  [SPRITE_DRAGONFLY]: { ...UNFINISHED, sheet: [62, 62, 'enemy_dragonflyg.png'], hp: 4, damage: 0, walk: [0, 3], fps: 8,
    dieFrame: 7, dieMax: 7, dieLag: 0.5, jumpFrame: 3, rectAbs: [12, 24, 42, 19] },
};

class EnemyWalker extends EnemyBase {
  constructor(x, y, id, dir) {
    super(x, y, id, dir);
    const d = { ...WALKER_DEFAULTS, ...WALKERS[id] };
    this.hitPoints = d.hp;
    this.maxHit = d.maxHit !== undefined ? d.maxHit : d.hp;
    this.damage = d.damage;
    this.hasIdle = d.hasIdle;
    this.canJump = d.canJump;
    this.willFloat = d.willFloat;
    this.canAttack = d.canAttack;
    this.hasClose = d.hasClose;
    this.dieLag = d.dieLag;
    this.dieFrame = d.dieFrame;
    this.dieMax = d.dieMax;
    this.fadeMax = d.fadeMax;
    this.idleFreq = d.idleFreq;
    this.idleLag = d.idleLag;
    this.idleFrame = d.idleFrame;
    this.idleMax = d.idleMax;
    this.jumpFreq = d.jumpFreq;
    this.jumpAmount = d.jumpAmount;
    this.jumpFrame = d.jumpFrame;
    [this.attackProximityX, this.attackProximityY] = d.prox;
    this.attackFrame = d.attackFrame;
    this.attackMax = d.attackMax;
    this.attackLag = d.attackLag;
    this.closeFrame = d.closeFrame;
    this.closeMax = d.closeMax;
    this.isClose = false;
    this.floatSpeed = d.floatSpeed;
    this.yellowPull = d.yellowPull || 0;
    this.FPS = 1000.0 / d.fps;
    [this.walkFrame, this.walkMax] = d.walk;
    this.speedRun = d.speed;
    this.gravity = d.gravity;
    this.setImages(splice(d.sheet[0], d.sheet[1], d.sheet[2], 1, 1), d.rect, d.rectAbs);
    if (d.offset) {
      this.x += d.offset[0];
      this.y += d.offset[1];
    }
  }

  update(t, dt, level, keen) {
    this.dirChange = Math.max(0, this.dirChange - dt);
    const keenCX = keen.x + keen.width / 2.0, keenCY = keen.y + keen.height / 2.0;

    if (this.state === ENEMY_STATE_WALK) {
      this.moveAmountX = dt * this.speedRun;

      // Yorps and the dragonfly push Keen
      if (gfn_IsPushEnemy(this.id) && collideMask(this, keen)) {
        let cx = this.x + this.width / 2.0;
        if (this.id === SPRITE_DRAGONFLY) {
          if (this.direction === -1) cx = this.x + 43;
          else if (this.direction === 1) cx = this.x + 19;
        }
        if ((this.direction === -1 && cx > keenCX) || (this.direction === 1 && cx < keenCX)) {
          keen.vx = this.direction;
          keen.direction = this.direction;
          this.pushKeen(keen, level, this.moveAmountX);
        }
      }

      // Swap to the "close" animation when Keen is near
      if (this.hasClose && !this.isClose) {
        const tx = this.x + this.width / 2.0 - keenCX, ty = this.y + this.height / 2.0 - keenCY;
        if (Math.abs(tx) < 2 * this.attackProximityX && Math.abs(ty) < 2 * this.attackProximityY) {
          this.isClose = true;
          this.swapClose();
          if (this.id === SPRITE_CATERPILLAR || this.id === SPRITE_MINE) this.hasClose = false;
        }
      } else if (this.hasClose && this.isClose) {
        if (!(Math.abs(this.x - keen.x) < 2 * this.attackProximityX) || !(Math.abs(this.y - keen.y) < 2 * this.attackProximityY)) {
          this.isClose = false;
          this.swapClose();
        }
      }

      if (this.onGround || this.gravity === 0) {
        if (t - this.last_update > this.FPS) {
          this.frame += 1;
          if (this.id === SPRITE_MINE && this.frame === this.walkMax) this.damage = 10;
          if (this.frame > this.walkMax) {
            this.frame = this.walkFrame;
            if (this.id === SPRITE_CATERPILLAR && this.walkMax !== 0) {
              this.walkFrame = 6;
              this.walkMax = 9;
              this.speedRun = 8;
              this.hitPoints = 2;
              this.maxHit = 2.0;
              this.damage = 1;
              this.FPS = 1000.0 / 2;
              this.frame = this.walkFrame;
            } else if (this.id === SPRITE_MINE && this.isClose) {
              for (let i = 0; i < 50; i++) {
                level.sprite_Explosions.add(new Particle(this.x + rand() * this.width, this.y + rand() * this.height, pTYPE_OTHER, 0, [255, 0, 255]));
              }
              this.kill();
              playSound(SFX_ENEMY_MINE);
            }
          }
          this.last_update = t;
        }
      } else if (this.vy < 0) {
        this.frame = this.jumpFrame;
      } else if (this.jumpFrame !== 0) {
        this.frame = this.jumpFrame + 1;
      }

      if (this.hasIdle && trunc(rand() * (1 / dt) * this.idleFreq) === 1 && this.onGround) {
        this.state = ENEMY_STATE_IDLE;
        this.moveAmountX = 0;
      }

      if (this.canJump && this.onGround && trunc(rand() * (1 / dt) * this.jumpFreq) === 1) {
        this.vy = this.jumpAmount;
        this.moveAmountY = dt * this.vy;
        this.onGround = false;
        if (this.inView(level)) playSound(SFX_ENEMY_FOOG_JUMP);
      }

      const closeX = Math.abs(this.x + this.width / 2.0 - keenCX), closeY = Math.abs(this.y + this.height / 2.0 - keenCY);
      if (this.canAttack && closeX < this.attackProximityX && closeY < this.attackProximityY) {
        this.state = ENEMY_STATE_ATTACK;
        this.moveAmountX = 0;
        if (this.id === SPRITE_YELLOW) this.direction = this.x < keen.x ? 1 : -1;
        else if (this.id === SPRITE_BLUEMOUTH) this.x -= 15 * this.direction;
        this.frame = this.attackFrame;
      }
    } else if (this.state === ENEMY_STATE_IDLE) {
      if (this.frame < this.idleFrame) {
        this.frame = this.idleFrame;
        this.last_update = t;
      }
      if (t - this.last_update > this.FPS * this.idleLag) {
        this.frame += 1;
        this.last_update = t;
        if (this.frame > this.idleMax) {
          this.frame = this.walkFrame;
          this.state = ENEMY_STATE_WALK;
          if (trunc(pyround(rand() * 3)) === 0) this.direction *= -1;
        }
      }
    } else if (this.state === ENEMY_STATE_ATTACK) {
      if (this.frame < this.attackFrame) {
        this.frame = this.attackFrame;
        this.last_update = t;
      }
      if (this.id === SPRITE_YELLOW && this.frame === this.attackMax) {
        // The yellow guy sucks Keen towards him
        if (this.dirChange === 0) {
          this.direction = this.x < keen.x ? 1 : -1;
          this.dirChange = 2;
        }
        const closeX = Math.abs(this.x + this.width / 2.0 - keenCX), closeY = Math.abs(this.y + this.height / 2.0 - keenCY);
        if (closeX < this.attackProximityX && closeY < this.attackProximityY) {
          const amount = dt * this.yellowPull * ((this.attackProximityX - closeX) ** 2 / this.attackProximityX ** 2);
          if (keen.state === kON_GROUND || keen.state === kFALLING) {
            const d = this.x > keen.x ? 1 : -1;
            keen.vx = d;
            keen.direction = d;
            this.pushKeen(keen, level, amount);
          } else if (keen.state === kON_POLE || keen.state === kON_LEDGE) {
            keen.state = kFALLING;
          }
        } else {
          this.frame = this.walkFrame;
          this.state = ENEMY_STATE_WALK;
        }
      } else if (t - this.last_update > this.FPS * this.attackLag) {
        this.frame += 1;
        this.last_update = t;
        if (this.frame > this.attackMax) {
          if (this.id !== SPRITE_YELLOW) {
            this.frame = this.walkFrame;
            this.state = ENEMY_STATE_WALK;
          }
          if (this.id === SPRITE_BLUEMOUTH) this.x += 15 * this.direction;
        }
      }
    } else if (this.state === ENEMY_STATE_DIE) {
      if (this.dieFrame !== 0) {
        if (this.frame < this.dieFrame) {
          this.frame = this.dieFrame;
          this.last_update = t;
        } else if (t - this.last_update > this.FPS * this.dieLag) {
          this.frame += 1;
          this.last_update = t;
          if (this.frame > this.dieMax) this.frame = this.dieMax;
        }
      } else {
        this.fadeTime += dt;
      }
      // Dead fish float to the surface
      if (this.frame === this.dieMax && this.willFloat) {
        const tx = trunc(pyround((this.x + this.width / 2.0) / TILESIZE)), ty = trunc(pyround(this.y / TILESIZE));
        if (grid(level.INFO, tx, ty) === INFO_WATER) this.y -= dt * this.floatSpeed;
      }
    }

    this.faceImage();
    if (this.state === ENEMY_STATE_DIE && this.dieFrame === 0) this.fadeDeath();
    this.move(level);
    this.applyGravity(dt);
    this.updateSubRect();
    this.setDisplayRect(level);
  }

  swapClose() {
    [this.walkFrame, this.walkMax, this.closeFrame, this.closeMax] = [this.closeFrame, this.closeMax, this.walkFrame, this.walkMax];
  }
}

// ---------------------------------------------------------------------------------------------
// Shooter: walks and fires a projectile when Keen is in range (or at random)

const SOLDIER = { fps: 6, walk: [0, 6], shoot: [7, 8, 9], die: [10, 13], rect: [16, 0, -32, 0], bullet: SPRITE_RAT_BULLET };

const SHOOTERS = {
  [SPRITE_RAT]: { ...SOLDIER, hp: 20, damage: 5, sheet: [64, 48, 'enemy_rat.png'], fps: 8, speed: 65, prox: [50, 10], delay: 3 },
  [SPRITE_LEMMING]: { ...SOLDIER, hp: 4, damage: 2, sheet: [64, 48, 'enemy_lemming.png'], speed: 40, prox: [100, 16], delay: 3 },
  [SPRITE_SPIDER]: { hp: 2, damage: 2, sheet: [32, 32, 'enemy_spider.png'], fps: 6, walk: [0, 7], shoot: [8, 9, 10],
    die: [11, 13], speed: 50, bullet: SPRITE_SPIDER_PROJ, random: 3, delay: 3, rect: [0, -5, 0, 0] },
  [SPRITE_TRUCKGUY1_WALK]: { ...SOLDIER, hp: 4, damage: 2, sheet: [64, 48, 'enemy_truckguy2_walk.png'], vy: -100,
    speed: 40, prox: [100, 20], delay: 0.2 },
  [SPRITE_TRUCKGUY2_WALK]: { ...SOLDIER, hp: 6, damage: 2, sheet: [64, 48, 'enemy_truckguy1_walk.png'], vy: -100,
    speed: 40, prox: [100, 20], delay: 1 },
  [SPRITE_ROBOT_GREY]: { hp: 8, damage: 3, idle: [3, 1, 4, 5], sheet: [32, 48, 'enemy_robot_grey.png'], fps: 6,
    walk: [0, 3], shoot: [6, 7, 8], die: [9, 11], speed: 40, bullet: SPRITE_ROBOT_GREY_BULLET, prox: [100, 10], delay: 3 },
  [SPRITE_ROBOT_RED]: { hp: 8, damage: 3, sheet: [48, 48, 'enemy_robot_red.png'], fps: 8, walk: [0, 7],
    shoot: [8, 13, 19], die: [20, 26], speed: 40, bullet: SPRITE_ROBOT_RED_BULLET, prox: [50, 10], delay: 5 },
  [SPRITE_ROBOT_FLASHER]: { hp: 8, damage: 3, idle: [2, 1, 4, 7], sheet: [78, 46, 'enemy_flasher.png'], fps: 8,
    walk: [0, 3], shoot: [8, 11, 13], die: [14, 19], delay: 3, speed: 75, bullet: SPRITE_ROBOT_RED_BULLET, prox: [100, 10] },
  [SPRITE_ROBOT_HOVER]: { hp: 8, damage: 3, sheet: [47, 40, 'enemy_hover.png'], fps: 6, walk: [0, 3], shoot: [4, 5, 6],
    die: [0, 0], speed: 75, gravity: 0, bullet: SPRITE_HOVER_BULLET, prox: [50, 200], delay: 0.5 },
  [SPRITE_DEMON]: { hp: 6, damage: 3, idle: [3, 1, 4, 13], sheet: [48, 48, 'enemy_demon.png'], fps: 8, walk: [0, 3],
    shoot: [14, 15, 16], die: [17, 19], dieLag: 2, speed: 100, bullet: SPRITE_DEMON_FIREBALL, prox: [50, 10], delay: 3 },
  [SPRITE_SLUG]: { hp: 2, damage: 1, sheet: [32, 32, 'enemy_slug.png'], fps: 4, walk: [0, 1], shoot: [2, 3, 3],
    die: [4, 7], speed: 30, bullet: SPRITE_SLUG_PROJ, random: 2, delay: 3 },
};

class EnemyShooter extends EnemyBase {
  constructor(x, y, id, dir) {
    super(x, y, id, dir);
    const d = SHOOTERS[id];
    this.hitPoints = this.maxHit = d.hp;
    this.damage = d.damage;
    this.canJump = false;
    this.jumpFreq = 0;
    this.jumpAmount = 0;
    this.jumpFrame = 0;
    this.hasIdle = !!d.idle;
    [this.idleFreq, this.idleLag, this.idleFrame, this.idleMax] = d.idle || [0, 0, 0, 0];
    this.dieLag = d.dieLag || 1;
    this.shotRandom = !!d.random;
    this.shotRandomFreq = d.random || 0;
    [this.shootProximityX, this.shootProximityY] = d.prox || [0, 0];
    this.FPS = 1000.0 / d.fps;
    [this.walkFrame, this.walkMax] = d.walk;
    [this.shootFrame, this.shootRelease, this.shootMax] = d.shoot;
    [this.dieFrame, this.dieMax] = d.die;
    if (d.vy) this.vy = d.vy;
    this.speedRun = d.speed;
    this.gravity = d.gravity !== undefined ? d.gravity : 450;
    this.bulletSprite = d.bullet;
    this.shotDelay = d.delay;
    this.shotTimer = 0;
    this.setImages(splice(d.sheet[0], d.sheet[1], d.sheet[2], 1, 1), d.rect);
  }

  startShot() {
    this.moveAmountX = 0;
    this.frame = this.shootFrame;
    if (this.shotTimer === 0) {
      this.state = ENEMY_STATE_ATTACK;
      this.shotTimer = this.shotDelay;
    }
  }

  update(t, dt, level, keen) {
    this.dirChange = Math.max(0, this.dirChange - dt);
    if (this.shotTimer > 0) this.shotTimer -= dt;
    if (this.shotTimer <= 0) this.shotTimer = 0;

    if (this.state === ENEMY_STATE_WALK) {
      this.moveAmountX = dt * this.speedRun;
      if (this.onGround || this.gravity === 0) {
        if (t - this.last_update > this.FPS) {
          this.frame += 1;
          if (this.frame > this.walkMax) this.frame = this.walkFrame;
          this.last_update = t;
        }
      } else {
        this.frame = this.vy < 0 ? this.jumpFrame : this.jumpFrame + 1;
      }

      if (this.canJump && this.onGround && trunc(rand() * (1 / dt) * this.jumpFreq) === 1) {
        this.vy = this.jumpAmount;
        this.moveAmountY = dt * this.vy;
        this.onGround = false;
      }

      if (this.hasIdle && trunc(rand() * (1 / dt) * this.idleFreq) === 1) {
        this.state = ENEMY_STATE_IDLE;
        // The grey robot charges during its "idle" phase
        if (this.id === SPRITE_ROBOT_GREY) this.moveAmountX *= 2.5;
        else this.moveAmountX = 0;
      }

      if (!this.shotRandom) {
        if (this.id !== SPRITE_ROBOT_HOVER) {
          if (this.canSee(keen)) this.startShot();
        } else if (this.y < keen.y) {
          // The hover robot shoots diagonally downwards
          const facing = (this.direction === -1 && this.x > keen.x) || (this.direction === 1 && this.x < keen.x);
          const gradient = Math.abs((this.y - keen.y - keen.height) / (this.x - keen.x));
          if (gradient > 0.8 && gradient < 1.2 && facing) this.startShot();
        }
      } else if (trunc(pyround(rand() * (1 / dt) * this.shotRandomFreq)) === 0) {
        this.startShot();
      }
    } else if (this.state === ENEMY_STATE_IDLE) {
      if (this.frame < this.idleFrame) {
        this.frame = this.idleFrame;
        this.last_update = t;
      }
      if (t - this.last_update > this.FPS * this.idleLag) {
        this.frame += 1;
        this.last_update = t;
        if (this.frame > this.idleMax) {
          if (this.id === SPRITE_ROBOT_GREY) {
            this.frame = this.idleFrame;
            if (trunc(pyround(rand() * 2)) === 0) this.state = ENEMY_STATE_WALK;
          } else {
            this.frame = this.walkFrame;
            this.state = ENEMY_STATE_WALK;
          }
        }
      }
    } else if (this.state === ENEMY_STATE_ATTACK) {
      if (this.frame < this.shootFrame) {
        this.frame = this.shootFrame;
        this.last_update = t;
      } else if (t - this.last_update > this.FPS) {
        this.frame += 1;
        if (this.frame === this.shootRelease) {
          if (this.id !== SPRITE_SLUG) {
            level.sprite_Enemies.add(new EnemyBullet(this.x / TILESIZE, this.y / TILESIZE, this.bulletSprite, this.direction));
          } else {
            level.sprite_Enemies.add(new EnemyPoison(this.x, this.y, this.bulletSprite, this.direction));
            if (this.inView(level)) playSound(SFX_ENEMY_SLUG);
          }
        }
        if (this.frame === this.shootMax) {
          this.frame = 0;
          this.state = ENEMY_STATE_WALK;
        }
        this.last_update = t;
      }
    } else if (this.state === ENEMY_STATE_DIE) {
      if (this.dieFrame !== 0) {
        if (this.frame < this.dieFrame) {
          this.frame = this.dieFrame;
          this.last_update = t;
        } else if (t - this.last_update > this.FPS * this.dieLag) {
          this.frame += 1;
          this.last_update = t;
          // The slug's head keeps spinning
          if (this.frame > this.dieMax) this.frame = this.id !== SPRITE_SLUG ? this.dieMax : this.dieFrame + 1;
        }
      } else {
        this.fadeTime += dt;
      }
    }

    this.faceImage();
    if (this.state === ENEMY_STATE_DIE && this.dieFrame === 0) this.fadeDeath();
    this.move(level);
    this.applyGravity(dt);
    this.updateSubRect();
    this.setDisplayRect(level);
  }
}

// ---------------------------------------------------------------------------------------------
// Isonian: shoots, and teleports away to recharge when weak

const ISONIANS = {
  [SPRITE_ISONIAN_GREEN]: { damage: 2, sheet: 'enemy_isonian-green.png', speed: 40, fps: 8, bullet: SPRITE_ISONIAN_PROJ1g },
  [SPRITE_ISONIAN_RED]: { damage: 5, sheet: 'enemy_isonian-red.png', speed: 30, fps: 6, dieLag: 0.675, idleLag: 0.375, bullet: SPRITE_ISONIAN_PROJ1r },
  [SPRITE_ISONIAN_WHITE]: { damage: 1, sheet: 'enemy_isonian-white.png', speed: 50, fps: 10, dieLag: 1.125, idleLag: 0.625, bullet: SPRITE_ISONIAN_PROJ1w },
};

class EnemyIsonian extends EnemyBase {
  constructor(x, y, id, dir) {
    super(x, y, id, dir);
    const d = ISONIANS[id];
    this.hitPoints = this.maxHit = 10;
    this.damage = d.damage;
    this.dieLag = d.dieLag || 0.9;
    this.idleLag = d.idleLag || 0.5;
    this.idleFrame = 16;
    this.idleMax = 20;
    this.shotRandom = false;
    this.speedRun = d.speed;
    this.FPS = 1000.0 / d.fps;
    this.bulletSprite = d.bullet;
    this.shootProximityX = 96;
    this.shootProximityY = 16;
    this.walkFrame = 0;
    this.walkMax = 7;
    this.shootFrame = 11;
    this.shootRelease = 13;
    this.shootMax = 15;
    this.dieFrame = 24;
    this.dieMax = 31;
    this.gravity = 450;
    this.shotDelay = 1;
    this.shotTimer = 0;
    this.setImages(splice(30, 40, d.sheet, 1, 1));
    this.oldX = this.x;
    this.oldY = this.y;
    // Teleport sub-state: 0 normal, 1 leaving, 2 arriving at safe spot, 3 safe, 4 leaving safe spot, 5 returning
    this.safe = 0;
  }

  update(t, dt, level, keen) {
    this.dirChange = Math.max(0, this.dirChange - dt);
    if (this.shotTimer > 0) this.shotTimer -= dt;
    if (this.shotTimer <= 0) this.shotTimer = 0;

    if (this.state === ENEMY_STATE_WALK) {
      this.moveAmountX = dt * this.speedRun;
      if ((this.onGround || this.gravity === 0) && t - this.last_update > this.FPS) {
        this.frame += 1;
        if (this.frame > this.walkMax) this.frame = this.walkFrame;
        this.last_update = t;
      }

      if (this.safe === 0 && this.hitPoints < this.maxHit / 2.0) {
        this.moveAmountX = 0;
        this.state = ENEMY_STATE_IDLE;
        this.bullet = true;
        this.safe = 1;
      } else if (this.safe === 3 && this.hitPoints < this.maxHit) {
        this.hitPoints += dt / 3.0;
        if (this.hitPoints >= this.maxHit) {
          this.hitPoints = this.maxHit;
          this.moveAmountX = 0;
          this.state = ENEMY_STATE_IDLE;
          this.bullet = true;
          this.safe = 4;
        }
      }

      if (this.canSee(keen)) {
        // The white (scientist) Isonian only fights back once hurt
        if (this.id !== SPRITE_ISONIAN_WHITE || this.hitPoints < this.maxHit) {
          if (this.shotTimer === 0) {
            this.moveAmountX = 0;
            this.frame = this.shootFrame;
            this.state = ENEMY_STATE_ATTACK;
            this.shotTimer = this.shotDelay;
          }
        } else if (this.id === SPRITE_ISONIAN_WHITE && this.dirChange === 0) {
          this.direction *= -1;
          this.dirChange = 2;
        }
      }
    } else if (this.state === ENEMY_STATE_IDLE) {
      const leaving = this.safe === 1 || this.safe === 4;
      if (leaving && this.frame < this.idleFrame) {
        this.frame = this.idleFrame;
        this.last_update = t;
      }
      if (t - this.last_update > this.FPS * this.idleLag) {
        if (leaving) this.frame += 1;
        else if (this.safe === 2 || this.safe === 5) this.frame -= 1;
        this.last_update = t;
        if (this.safe === 1 && this.frame > this.idleMax) {
          this.safe = 2;
          this.frame = this.idleMax;
          this.oldX = this.x;
          this.oldY = this.y;
          if (level.EnemyTeleList.length > 0) {
            let best = null, bestD = 0;
            for (const tile of level.EnemyTeleList) {
              const dist = Math.sqrt((this.x - tile.x) ** 2 + (this.y - tile.y) ** 2);
              if (best === null || dist < bestD) {
                best = tile;
                bestD = dist;
              }
            }
            this.x = best.x;
            this.y = best.y + 8;
          }
        } else if (this.safe === 4 && this.frame > this.idleMax) {
          this.safe = 5;
          this.frame = this.idleMax;
          this.x = this.oldX;
          this.y = this.oldY;
        } else if ((this.safe === 2 || this.safe === 5) && this.frame < this.idleFrame) {
          this.safe = this.safe === 2 ? 3 : 0;
          this.frame = this.walkFrame;
          this.state = ENEMY_STATE_WALK;
          this.bullet = false;
        }
      }
    } else if (this.state === ENEMY_STATE_ATTACK) {
      if (this.frame < this.shootFrame) {
        this.frame = this.shootFrame;
        this.last_update = t;
      } else if (t - this.last_update > this.FPS) {
        this.frame += 1;
        if (this.frame === this.shootRelease) {
          level.sprite_Enemies.add(new EnemyBullet(this.x / TILESIZE, this.y / TILESIZE, this.bulletSprite, this.direction));
        }
        if (this.frame === this.shootMax) {
          this.frame = 0;
          this.state = ENEMY_STATE_WALK;
        }
        this.last_update = t;
      }
    } else if (this.state === ENEMY_STATE_DIE) {
      if (this.frame < this.dieFrame) {
        this.frame = this.dieFrame;
        this.last_update = t;
      } else if (t - this.last_update > this.FPS * this.dieLag) {
        this.frame += 1;
        this.last_update = t;
        if (this.frame > this.dieMax) this.frame = this.dieMax;
      }
    }

    this.faceImage();
    this.move(level);
    this.applyGravity(dt);
    this.updateSubRect();
    this.setDisplayRect(level);
  }
}

// ---------------------------------------------------------------------------------------------
// Projectiles fired by enemies

const BULLETS = {
  [SPRITE_SPIDER_PROJ]: { damage: 5, sheet: [16, 16, 'enemy_spider-proj.png'], fps: 10, speed: 65, gravity: 200 },
  [SPRITE_RAT_BULLET]: { damage: 1, sheet: [64, 48, 'enemy_rat-proj.png'], fps: 8, speed: 200 },
  [SPRITE_DEMON_FIREBALL]: { damage: 1, sheet: [48, 48, 'enemy_demon-proj.png'], fps: 8, speed: 100 },
  [SPRITE_ROBOT_GREY_BULLET]: { damage: 1, sheet: [32, 48, 'enemy_robot_grey-proj.png'], fps: 8, speed: 200 },
  [SPRITE_ROBOT_RED_BULLET]: { damage: 8, sheet: [48, 48, 'enemy_robot_red-proj.png'], fps: 8, speed: 150 },
  [SPRITE_HOVER_BULLET]: { damage: 2, sheet: [47, 40, 'enemy_hover-proj.png'], fps: 8, speed: 300, gravity: 500 },
  [SPRITE_SHAPESHIFTER_PROJ]: { damage: 1, sheet: [32, 32, 'enemy_shapeshifter-proj.png'], fps: 8, speed: 200 },
  [SPRITE_TELETURRET_PROJ]: { damage: 1, sheet: [33, 25, 'enemy_teleturret-proj.png'], fps: 6, speed: 200 },
  [SPRITE_EVILKEEN_PROJ]: { damage: 1, sheet: [32, 32, 'enemy_evilkeen-proj.png'], fps: 8, speed: 200 },
  [SPRITE_ISONIAN_PROJ1g]: { damage: 2, sheet: [12, 15, 'enemy_isonian-proj1.png'], fps: 8, speed: 200 },
  [SPRITE_ISONIAN_PROJ1r]: { damage: 5, sheet: [12, 15, 'enemy_isonian-proj1.png'], fps: 8, speed: 200 },
  [SPRITE_ISONIAN_PROJ1w]: { damage: 9, sheet: [12, 15, 'enemy_isonian-proj1.png'], fps: 8, speed: 200 },
};

class EnemyBullet extends EnemyBase {
  constructor(x, y, id, dir) {
    super(x, y, id, dir);
    const d = BULLETS[id];
    this.bullet = true;
    this.hitPoints = this.maxHit = 999999;
    this.damage = d.damage;
    this.FPS = 1000.0 / d.fps;
    this.speed = d.speed;
    this.gravity = d.gravity || 0;
    if (id === SPRITE_SPIDER_PROJ) {
      this.vy = -70;
      this.y += 10;
      this.x += 5 * dir;
    } else if (id === SPRITE_SHAPESHIFTER_PROJ) {
      this.y += 36;
      this.x += 16;
    } else if (isIsonianProj(id)) {
      this.x += 16 * dir;
      this.y += 12;
    }
    this.setImages(splice(d.sheet[0], d.sheet[1], d.sheet[2], 1, 1));
  }

  update(t, dt, level) {
    this.vy += dt * this.gravity;
    this.moveAmountX = dt * this.speed;
    this.moveAmountY = dt * this.vy;
    this.x += this.moveAmountX * this.direction;
    this.y += this.moveAmountY;
    if (this.id === SPRITE_HOVER_BULLET) this.moveAmountY = dt * this.speed;

    const testX = trunc((this.x + this.width / 2.0) / TILESIZE);
    if (this.id !== SPRITE_SPIDER_PROJ) {
      if (gfnSolid_Info(grid(level.INFO, testX, trunc((this.y + this.height / 2.0) / TILESIZE)))) {
        this.kill();
        if (this.id === SPRITE_ROBOT_RED_BULLET || isIsonianProj(this.id)) {
          level.sprite_Explosions.add(new Explode(this.x, this.y, this.id, this.direction, 0, 0));
        }
      }
    } else if (gfnSolid_Info(grid(level.INFO, testX, trunc((this.y + this.height) / TILESIZE)))) {
      // Spider spit leaves a puddle
      this.kill();
      level.sprite_Enemies.add(new EnemyPoison(this.x, this.y, this.id, this.direction));
    }

    if (this.x + this.width < 0 || this.x > level.width * TILESIZE || this.y + this.height < 0 || this.y > level.height * TILESIZE) this.kill();

    if (t - this.last_update > this.FPS) {
      this.frame += 1;
      if (this.frame >= this.images.length) {
        if (this.id !== SPRITE_SPIDER_PROJ) this.frame = 0;
        else this.frame -= 1;
      }
      this.last_update = t;
    }
    this.faceImage();
    this.updateSubRect();
    this.setDisplayRect(level);
  }
}

// Water / acid droplets that fall from the ceiling and respawn
let srfcDropBlank;
const srfcDropColours = {};

Boot.push(() => {
  srfcDropBlank = newSurface(1, 1);
  for (const c of [[0, 0, 255], [0, 255, 0]]) {
    const s = newSurface(1, 1);
    fillSurf(s, c);
    srfcDropColours[c.join(',')] = s;
  }
});

class EnemyDrop extends EnemyBase {
  constructor(x, y, id, dir) {
    super(x, y, id, dir);
    this.x += 8;
    this.y += 8;
    this.vx = 0;
    this.bullet = true;
    this.xi = this.x;
    this.yi = this.y;
    this.hitPoints = this.maxHit = 999999;
    this.damage = id === SPRITE_WATER_DROP ? 0 : 1;
    this.colour = id === SPRITE_WATER_DROP ? [0, 0, 255] : [0, 255, 0];
    this.image = srfcDropColours[this.colour.join(',')];
    this.speed = 0;
    this.gravity = 150;
    this.pause = 1 + trunc(rand() * 3);
    this.width = this.height = 1;
    this.rect = new Rect(pyround(this.x), pyround(this.y), 1, 1);
  }

  respawn(t) {
    this.x = this.xi;
    this.y = this.yi;
    this.vy = 0;
    this.last_update = t;
    this.image = srfcDropBlank;
    this.state = ENEMY_STATE_IDLE;
  }

  update(t, dt, level) {
    dt = Math.min(dt, 0.1);
    if (this.state === ENEMY_STATE_WALK) {
      this.vy += dt * this.gravity;
      this.moveAmountX = dt * this.speed;
      this.moveAmountY = dt * this.vy;
      this.x += this.moveAmountX * this.direction;
      this.y += this.moveAmountY;
      const tile = grid(level.INFO, trunc(this.x / TILESIZE), trunc(this.y / TILESIZE));
      if (gfnSolid_Info(tile) || gfnTile_Water(tile)) {
        if (this.inView(level)) playSound(SFX_ENEMY_DROPLET);
        for (let i = 0; i < 10; i++) level.sprite_Particles.add(new Particle(this.x, this.y, pTYPE_OTHER, 0, this.colour));
        this.respawn(t);
      }
      if (this.x + this.width < 0 || this.x > level.width * TILESIZE || this.y + this.height < 0 || this.y > level.height * TILESIZE) {
        this.respawn(t);
      }
    } else if (this.state === ENEMY_STATE_IDLE) {
      if ((t - this.last_update) / 1000.0 >= this.pause) {
        this.image = srfcDropColours[this.colour.join(',')];
        this.state = ENEMY_STATE_WALK;
      }
    }
    this.setDisplayRect(level);
  }
}

// Fading puddles (spider spit, slug slime)
class EnemyPoison extends EnemyBase {
  constructor(x, y, id, dir) {
    super(x / TILESIZE, y / TILESIZE, id, dir);
    this.x = x;
    this.y = y;
    this.hitPoints = this.maxHit = 999999;
    this.fixed = true;
    this.FPS = 1000.0 / 8;
    this.lifetime = 0;
    if (id === SPRITE_SPIDER_PROJ) {
      this.damage = 5;
      this.frame = 6;
      this.maxLife = 10;
      this.setImages(splice(16, 16, 'enemy_spider-proj.png', 1, 1));
    } else {
      this.damage = 1;
      this.frame = 0;
      this.maxLife = 12;
      this.setImages(splice(32, 32, 'enemy_slug-proj.png', 1, 1));
    }
  }

  update(t, dt, level) {
    this.lifetime += dt;
    if (!this.fixed && t - this.last_update > this.FPS) {
      this.frame += 1;
      if (this.frame >= this.images.length) this.frame = 0;
      this.last_update = t;
    }
    this.faceImage();
    const a = 255 - (this.lifetime / this.maxLife) * 255;
    this.image.set_alpha(a);
    if (a <= 100) this.kill();
    this.updateSubRect();
    this.setDisplayRect(level);
  }
}

// ---------------------------------------------------------------------------------------------
// Evil Keen

class EnemyEvilKeen extends EnemyBase {
  constructor(x, y, id, dir) {
    super(x, y, id, dir);
    this.vx = dir;
    this.hitPoints = this.maxHit = 2;
    this.damage = 1;
    this.FPS = 1000.0 / 8;
    this.walkFrame = 0;
    this.walkMax = 3;
    this.jumpFrame = 4;
    this.shootFrame = 8;
    this.shootFrameTimer = 0;
    this.shootFrameTimerMax = 0.5;
    this.dieFrame = 11;
    this.speedRun = 110;
    this.jumpAmount = -250;
    this.jumpFreq = 3;
    this.gravity = 450;
    this.bulletSprite = SPRITE_EVILKEEN_PROJ;
    this.shootProximityX = 150;
    this.shootProximityY = 10;
    this.shotDelay = 3;
    this.shotTimer = 0;
    this.speedDieX = 100;
    this.speedDieY = -200;
    this.gravityDie = 250;
    this.setImages(splice(38, 32, 'enemy_evilkeen.png', 1, 1));
  }

  update(t, dt, level, keen) {
    this.dirChange = Math.max(0, this.dirChange - dt);
    this.shotTimer = this.shotTimer > 0 ? this.shotTimer - dt : 0;
    this.shootFrameTimer = this.shootFrameTimer > 0 ? this.shootFrameTimer - dt : 0;

    if (this.state === ENEMY_STATE_WALK) {
      if (this.shootFrameTimer === 0) this.moveAmountX = dt * this.speedRun;
      if (this.onGround && trunc(rand() * (1 / dt) * this.jumpFreq) === 1) {
        this.vy = this.jumpAmount;
        this.moveAmountY = dt * this.vy;
        this.onGround = false;
      }
      if (this.shotTimer === 0 && this.canSee(keen)) {
        this.moveAmountX = 0;
        this.state = ENEMY_STATE_ATTACK;
        this.shotTimer = this.shotDelay;
      }
    } else if (this.state === ENEMY_STATE_ATTACK) {
      level.sprite_Enemies.add(new EnemyBullet(this.x / TILESIZE, this.y / TILESIZE, this.bulletSprite, this.direction));
      this.shootFrameTimer = this.shootFrameTimerMax;
      this.state = ENEMY_STATE_WALK;
    } else if (this.state === ENEMY_STATE_DIE) {
      this.x += dt * this.speedDieX;
      this.vy += dt * this.gravityDie;
      this.y += dt * this.vy;
    }

    if (this.state !== ENEMY_STATE_DIE) {
      if (this.shootFrameTimer > 0) {
        this.frame = this.onGround ? this.shootFrame : this.shootFrame + 1;
      } else if (this.onGround) {
        if (t - this.last_update > this.FPS) {
          this.frame += 1;
          if (this.frame > this.walkMax) this.frame = this.walkFrame;
          this.last_update = t;
        }
      } else {
        this.frame = this.vy <= 0 ? this.jumpFrame : this.jumpFrame + 1;
      }
    } else {
      this.frame = this.dieFrame;
    }
    this.faceImage();

    if (this.state !== ENEMY_STATE_DIE) {
      this.move(level);
      this.vy += dt * this.gravity;
      this.moveAmountY = dt * this.vy;
    }
    this.updateSubRect();
    this.setDisplayRect(level);

    // Remove once the dead body is well out of view
    if (this.state === ENEMY_STATE_DIE) {
      const r = this.rect;
      if (r.x + r.w + level.playWidth / 2 < 0 || r.x - level.playWidth / 2 > level.playWidth) this.kill();
      else if (r.y + r.h + level.playHeight / 2 < 0 || r.y - level.playHeight / 2 > level.playHeight) this.kill();
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Shapeshifter: dormant until Keen comes close

class EnemyShapeShifter extends EnemyBase {
  constructor(x, y, id, dir) {
    super(x, y, id, dir);
    this.vx = dir;
    this.state = ENEMY_STATE_IDLE;
    this.hitPoints = this.maxHit = 2;
    this.damage = 1;
    this.FPS = 1000.0 / 8;
    this.idleFrame = 0;
    this.idleMax = 12;
    this.idleLag = 0.75;
    this.walkFrame = 13;
    this.walkMax = 16;
    this.jumpFrame = 17;
    this.shootFrame = 20;
    this.shootRelease = 22;
    this.shootMax = 23;
    this.shootLag = 1;
    this.shootFrameTimer = 0;
    this.dieFrame = 26;
    this.dieMax = 35;
    this.dieLag = 1;
    this.speedRun = 60;
    this.jumpAmount = -190;
    this.jumpFreq = 3;
    this.gravity = 450;
    this.bulletSprite = SPRITE_SHAPESHIFTER_PROJ;
    this.shootProximityX = 100;
    this.shootProximityY = 20;
    this.shotDelay = 0.2;
    this.shotTimer = 0;
    this.setImages(splice(64, 64, 'enemy_shapeshifter.png', 1, 1), null, [24, 40, 16, 24]);
  }

  inRange(keen) {
    const ex = this.x + this.rectOffsetX + this.rectW / 2.0, ey = this.y + this.height;
    const kx = keen.x + keen.width / 2.0, ky = keen.y + keen.height;
    return Math.abs(ex - kx) < this.shootProximityX && Math.abs(ey - ky) < this.shootProximityY;
  }

  update(t, dt, level, keen) {
    this.dirChange = Math.max(0, this.dirChange - dt);
    this.shotTimer = this.shotTimer > 0 ? this.shotTimer - dt : 0;

    if (this.state === ENEMY_STATE_WALK) {
      if (this.shootFrameTimer === 0) this.moveAmountX = dt * this.speedRun;
      if (this.onGround && trunc(rand() * (1 / dt) * this.jumpFreq) === 1) {
        this.vy = this.jumpAmount;
        this.moveAmountY = dt * this.vy;
        this.onGround = false;
      }
      if (this.shotTimer === 0 && this.canSee(keen)) {
        this.moveAmountX = 0;
        this.state = ENEMY_STATE_ATTACK;
      }
    } else if (this.state === ENEMY_STATE_IDLE) {
      if (this.inRange(keen)) this.state = ENEMY_STATE_WAKEUP;
    } else if (this.state === ENEMY_STATE_ATTACK) {
      if (this.frame < this.shootFrame) {
        this.frame = this.shootFrame;
        this.last_update = t;
      } else if (t - this.last_update > this.FPS * this.shootLag) {
        this.frame += 1;
        this.last_update = t;
        if (this.frame === this.shootRelease) {
          level.sprite_Enemies.add(new EnemyBullet(this.x / TILESIZE, this.y / TILESIZE, this.bulletSprite, this.direction));
          this.shotTimer = this.shotDelay;
        } else if (this.frame > this.shootMax) {
          this.frame = this.walkFrame;
          this.state = ENEMY_STATE_WALK;
        }
      }
    } else if (this.state === ENEMY_STATE_DIE) {
      this.moveAmountX = 0;
      this.moveAmountY = 0;
      this.vy = 0;
    }

    if (this.state === ENEMY_STATE_IDLE) {
      this.frame = this.idleFrame;
    } else if (this.state === ENEMY_STATE_WAKEUP) {
      if (t - this.last_update > this.FPS * this.idleLag) {
        this.frame += 1;
        this.last_update = t;
        if (this.frame > this.idleMax) {
          this.frame = this.walkFrame;
          this.state = ENEMY_STATE_WALK;
        }
      }
    } else if (this.state === ENEMY_STATE_ATTACK) {
      // frames set above
    } else if (this.state !== ENEMY_STATE_DIE) {
      if (this.shootFrameTimer > 0) {
        this.frame = this.onGround ? this.shootFrame : this.shootFrame + 1;
      } else if (this.onGround) {
        if (t - this.last_update > this.FPS) {
          this.frame += 1;
          if (this.frame > this.walkMax) this.frame = this.walkFrame;
          this.last_update = t;
        }
      } else {
        this.frame = this.vy <= 0 ? this.jumpFrame : this.jumpFrame + 1;
      }
    } else if (this.frame < this.dieFrame) {
      this.frame = this.dieFrame;
      this.last_update = t;
    } else if (t - this.last_update > this.FPS * this.dieLag) {
      this.frame += 1;
      this.last_update = t;
      if (this.frame > this.dieMax) this.frame = this.dieMax;
    }
    this.faceImage();

    if (this.state !== ENEMY_STATE_DIE) {
      this.move(level);
      this.vy += dt * this.gravity;
      this.moveAmountY = dt * this.vy;
    }
    this.updateSubRect();
    this.setDisplayRect(level);
  }
}

// ---------------------------------------------------------------------------------------------
// Breakable rocks

function setInfo(level, x, y, v) {
  const col = level.INFO[x];
  if (col && y >= 0 && y < col.length) col[y] = v;
}

class EnemyRock extends EnemyBase {
  constructor(x, y, id, dir) {
    super(x, y, id, dir);
    this.hitPoints = this.maxHit = 2;
    this.damage = 0;
    this.frame = id - SPRITE_ROCK_GREY;
    this.FPS = 1000.0 / 8;
    this.setImages(splice(48, 48, 'enemy_rocks.png', 1, 1));
  }

  update(t, dt, level, keen) {
    if (this.state === ENEMY_STATE_DIE) {
      // Clear the solid INFO tiles under the rock (water if Keen is swimming)
      const tx = trunc(this.x / TILESIZE), ty = trunc(this.y / TILESIZE);
      const v = keen.state !== kIN_WATER ? 0 : INFO_WATER;
      for (let dy = 1; dy <= 2; dy++) for (let dx = 0; dx <= 2; dx++) setInfo(level, tx + dx, ty + dy, v);
      for (const mask of level.sprite_MaskAll) {
        if (mask.x === this.x + TILESIZE && mask.y === this.y + TILESIZE) mask.kill();
      }
      for (let i = 0; i < 10; i++) {
        const rx = trunc(pyround(rand() * 48)), ry = trunc(pyround(rand() * 48));
        level.sprite_Explosions.add(new Particle(this.x + rx, this.y + ry, this.id, 0, 0));
      }
      this.kill();
    }
    this.faceImage();
    this.updateSubRect();
    this.setDisplayRect(level);
  }
}

// ---------------------------------------------------------------------------------------------
// Tele turret: hides when Keen is level with it, otherwise fires

class EnemyTeleTurret extends EnemyBase {
  constructor(x, y, id, dir) {
    super(x, y, id, dir);
    this.y -= 8;
    this.hitPoints = this.maxHit = 2;
    this.damage = 0;
    this.FPS = 1000.0 / 10;
    this.walkFrame = 0;
    this.idleFrame = 8;
    this.idleMax = 15;
    this.shootFrame = 1;
    this.shootMax = 4;
    this.dieFrame = 16;
    this.dieMax = 21;
    this.bulletSprite = SPRITE_TELETURRET_PROJ;
    this.shootTimer = 0;
    this.shootDelay = 0.5;
    this.hideProximityY = 16;
    this.setImages(splice(33, 25, 'enemy_teleturret.png', 1, 1));
  }

  update(t, dt, level, keen) {
    this.shootTimer = this.shootTimer > 0 ? this.shootTimer - dt : 0;

    if (this.state === ENEMY_STATE_WALK) {
      this.frame = this.walkFrame;
      const facing = (this.direction === -1 && this.x > keen.x) || (this.direction === 1 && this.x < keen.x);
      if (Math.abs(this.y - keen.subRect.y) < this.hideProximityY && facing) {
        this.frame = this.walkFrame;
        this.hitPoints = 999999;
        this.state = ENEMY_STATE_IDLE;
      } else if (this.shootTimer === 0) {
        this.state = ENEMY_STATE_ATTACK;
        this.shootTimer = this.shootDelay;
      }
    } else if (this.state === ENEMY_STATE_IDLE) {
      if (this.frame < this.idleFrame) {
        this.frame = this.idleFrame;
        this.last_update = t;
      } else if (t - this.last_update > this.FPS) {
        this.frame += 1;
        this.last_update = t;
        if (this.frame > this.idleMax) {
          this.frame = this.idleMax;
          if (Math.abs(this.y - keen.subRect.y) > this.hideProximityY) {
            this.frame -= 1;
            this.state = ENEMY_STATE_WAKEUP;
          }
        }
      }
    } else if (this.state === ENEMY_STATE_WAKEUP) {
      if (t - this.last_update > this.FPS) {
        this.frame -= 1;
        this.last_update = t;
        if (this.frame < this.idleFrame) {
          this.hitPoints = this.maxHit;
          this.state = ENEMY_STATE_WALK;
        }
      }
    } else if (this.state === ENEMY_STATE_ATTACK) {
      if (this.frame < this.shootFrame) {
        this.frame = this.shootFrame;
        this.last_update = t;
      } else if (t - this.last_update > this.FPS) {
        this.frame += 1;
        this.last_update = t;
        if (this.frame > this.shootMax) {
          level.sprite_Enemies.add(new EnemyBullet(this.x / TILESIZE, this.y / TILESIZE, this.bulletSprite, this.direction));
          this.frame = this.walkFrame;
          this.state = ENEMY_STATE_WALK;
        }
      }
    } else if (this.state === ENEMY_STATE_DIE) {
      if (this.frame < this.dieFrame) {
        this.frame = this.dieFrame;
        this.last_update = t;
      } else if (t - this.last_update > this.FPS) {
        this.frame += 1;
        this.last_update = t;
        if (this.frame > this.dieMax) this.frame = this.dieMax;
      }
    }
    this.faceImage();
    this.updateSubRect();
    this.setDisplayRect(level);
  }
}
