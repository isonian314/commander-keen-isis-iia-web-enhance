'use strict';
// Particles, weather and animated tiles (isis_particle.py, isis_weather.py, isis_tiles_anim.py)

const pTYPE_SPLASH = 0, pTYPE_OTHER = 1, pTYPE_ZEFFER = 2, pTYPE_RAIN = 3, pTYPE_BUBBLE = 4, pTYPE_SPLASH_LAVA = 5;
const LIFE = [1.0, 2.0, 1.0, 1.0, 1.0, 1.0];

let srfcBubbles, srfcRockShards, srfcTilesAnim, srfcClouds;

Boot.push(() => {
  srfcBubbles = [];
  for (let i = 0; i < 4; i++) {
    const s = newSurface(12, 12);
    drawCircleOutline(s.ctx(), [0, 0, 0], 5, 5, i + 1);
    srfcBubbles.push(s);
  }
  srfcRockShards = splice(16, 16, 'enemy_rocks-shards.png', 1, 1);
  srfcTilesAnim = splice(TILESIZE, TILESIZE, 'tiles_anim.png', 1, 1);
  srfcClouds = [loadImage('clouds_big0.png', 'alpha')];
});

// A small set of coloured pixels drawn directly (avoids one canvas per particle)
function drawPixels(ctx, pixels, x, y, alpha) {
  ctx.globalAlpha = alpha == null ? 1 : alpha / 255;
  for (const p of pixels) {
    ctx.fillStyle = p[2];
    ctx.fillRect(trunc(x) + p[0], trunc(y) + p[1], 1, 1);
  }
  ctx.globalAlpha = 1;
}

class Particle extends Sprite {
  constructor(X, Y, type, Ti, colour) {
    super();
    this.active = true;
    this.type = type;
    this.x0 = X;
    this.y0 = Y;
    this.image = null;
    this.pixels = null;
    this.alpha = null;
    const spray = () => {
      this.x = rand() * 10 - 5 + this.x0;
      this.y = rand() * 10 - 5 + this.y0;
      this.vx = rand() * 80 - 40;
      this.vy = rand() * 150 * -1;
      this.g = 200.0;
      this.width = this.height = 1;
    };
    const shard = (offset) => {
      this.lifetime = 1;
      this.x = X;
      this.y = Y;
      this.vx = rand() * 400 - 200;
      this.vy = (rand() * 500 - 100) * -1;
      this.g = 350.0;
      this.width = this.height = 16;
      this.image = srfcRockShards[trunc(pyround(rand() * 4)) + offset];
    };
    if (type === pTYPE_SPLASH || type === pTYPE_SPLASH_LAVA) {
      this.lifetime = LIFE[type];
      spray();
      const col = 255 - trunc(rand() * 100);
      this.pixels = [[0, 0, rgb(type === pTYPE_SPLASH ? [50, 50, col] : [col, 50, 50])]];
    } else if (type === pTYPE_OTHER) {
      this.lifetime = LIFE[type];
      spray();
      this.pixels = [[0, 0, rgb(colour)]];
    } else if (type === pTYPE_ZEFFER) {
      this.lifetime = LIFE[type];
      this.x = this.x0 + 16;
      this.y = this.y0 + 16;
      this.width = this.height = 1;
      this.pixels = [[0, 0, rgb(colour)]];
    } else if (type === pTYPE_RAIN) {
      this.lifetime = LIFE[type];
      this.x = trunc(rand() * 256);
      this.y = trunc(rand() * 192);
      this.width = 2;
      this.height = 4;
      const b = rgb([0, 0, 255]);
      this.pixels = [[0, 3, b], [0, 2, b], [1, 1, b], [1, 0, b]];
      this.vx = -50;
      this.vy = 150;
    } else if (type === pTYPE_BUBBLE) {
      this.lifetime = LIFE[type];
      this.x = this.x0 + trunc(rand() * 5) - 10;
      this.y = this.y0 + trunc(rand() * 5) - 10;
      this.width = this.height = 12;
      this.vx = 15;
      this.vy = 10;
      const r = trunc(rand() * 10);
      this.frame = r < 5 ? 0 : r < 8 ? 1 : 2;
      this.image = srfcBubbles[this.frame];
    } else if (type === SPRITE_ROCK_GREY || type === SPRITE_ROCK_MOSS) {
      shard(0);
    } else if (type === SPRITE_ROCK_BROWN) {
      shard(5);
    } else if (type === SPRITE_ROBOT_FLASHER) {
      shard(10);
    }
    this.rect = new Rect(this.x, this.y, this.width, this.height);
  }

  update(t, dt, level) {
    if (!this.active) return;
    this.lifetime -= dt;
    const type = this.type;
    if (type === pTYPE_SPLASH || type === pTYPE_SPLASH_LAVA) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += this.g * dt;
      if (this.lifetime <= 0) this.kill();
    } else if (type === pTYPE_OTHER) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += this.g * dt;
      if (this.x < 0 || this.x > level.width * TILESIZE || this.y > level.height * TILESIZE) {
        this.kill();
      } else if (gfnSolid_Info(grid(level.INFO, trunc(this.x / TILESIZE), trunc(this.y / TILESIZE)))) {
        this.kill();
      }
    } else if (type === pTYPE_ZEFFER) {
      this.alpha = Math.max(0, Math.min(255, trunc(255 * (this.lifetime / LIFE[type]))));
      if (this.lifetime <= 0) this.kill();
    } else if (type === pTYPE_RAIN) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.x < 0 || this.x > level.playWidth || this.y > level.playHeight) {
        this.x = trunc(rand() * 256);
        this.y = 0;
      }
    } else if (type === pTYPE_BUBBLE) {
      const direc = pyround(rand()) === 0 ? -1 : 1;
      this.x += this.vx * dt * direc;
      this.y -= this.vy * dt;
      if (grid(level.INFO, trunc(this.x / TILESIZE), trunc(this.y / TILESIZE)) !== INFO_WATER) this.kill();
      if (trunc(rand() * (1.0 / dt / 0.25)) === 1 && this.frame < 3) {
        this.frame += 1;
        this.image = srfcBubbles[this.frame];
      }
    }
    if (type === SPRITE_ROCK_GREY || type === SPRITE_ROCK_BROWN || type === SPRITE_ROCK_MOSS || type === SPRITE_ROBOT_FLASHER) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += this.g * dt;
      const ax = this.x - level.mapX + level.playX, ay = this.y - level.mapY + level.playY;
      if (ax < 0 || ax > level.playWidth || ay > level.playHeight) this.kill();
    }
    this.rect = new Rect(this.x - level.mapX + level.playX, this.y - level.mapY + level.playY, this.width, this.height);
  }

  draw(ctx) {
    if (this.pixels) drawPixels(ctx, this.pixels, this.rect.x, this.rect.y, this.alpha);
    else blit(ctx, this.image, this.rect.x, this.rect.y);
  }
}

// ---------------------------------------------------------------------------------------------
// Weather

const weatherRAIN = 0, weatherSNOW = 1, weatherCLOUDS1 = 2, weatherCLOUDS2 = 3, weatherLIGHTNING = 4;

class Weather extends Sprite {
  constructor(type, boundary) {
    super();
    this.type = type;
    this.boundary = boundary * TILESIZE;
    this.image = null;
    this.pixels = null;
    this.alpha = null;
    if (type === weatherRAIN) {
      this.x = trunc(rand() * 256);
      this.y = trunc(rand() * 192);
      this.width = 2;
      this.height = 4;
      const c = () => rgb([0, 0, 155 + trunc(rand() * 100)]);
      this.pixels = [[0, 3, c()], [0, 2, c()], [1, 1, c()], [1, 0, c()]];
      this.alpha = trunc(0.95 * 255);
      this.vx = -50;
      this.vy = 130;
    } else if (type === weatherSNOW) {
      this.x = trunc(rand() * 256);
      this.y = this.boundary + trunc(rand() * 192);
      this.width = this.height = 3;
      if (trunc(rand() * 2) === 0) {
        const col = 200 + trunc(rand() * 50);
        this.pixels = [[1, 1, rgb([col, col, col])]];
      } else {
        const col = 200 + trunc(rand() * 50);
        for (let i = 0; i < 4; i++) rand();
        const c = rgb([col, col, col]);
        this.pixels = [[1, 1, c], [0, 1, c], [2, 1, c], [1, 0, c], [1, 2, c]];
      }
      this.alpha = trunc(0.8 * 255);
      this.vx = trunc(rand() * 30) - 15;
      this.vy = 20;
    } else if (type === weatherCLOUDS1 || type === weatherCLOUDS2) {
      this.width = 640;
      this.height = 400;
      this.x = type === weatherCLOUDS1 ? 0 : this.width;
      this.y = this.boundary - this.height;
      this.image = srfcClouds[trunc(rand() * srfcClouds.length)];
      this.vx = -30;
    } else if (type === weatherLIGHTNING) {
      this.width = 320;
      this.height = 200;
      this.x = 0;
      this.y = 0;
      this.flash = 0;
      this.freq = 30;
      this.fade = 0.7;
    }
    this.rect = new Rect(this.x, this.y, this.width, this.height);
  }

  update(t, dt, level) {
    if (this.type === weatherRAIN || this.type === weatherSNOW) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.x < level.mapX || this.x > level.mapX + level.playWidth || this.y > level.mapY + level.playHeight) {
        this.x = level.mapX + trunc(rand() * level.playWidth);
        this.y = this.boundary + trunc(rand() * (level.height * TILESIZE - this.boundary)) - rand() * TILESIZE * 2;
      }
    } else if (this.type === weatherCLOUDS1 || this.type === weatherCLOUDS2) {
      this.x += this.vx * dt;
      if (this.x + this.width <= 0) {
        this.x = this.width;
        this.image = srfcClouds[trunc(rand() * srfcClouds.length)];
      }
    } else if (this.type === weatherLIGHTNING) {
      if (trunc(rand() * (1.0 / dt) * this.freq) === 1) {
        this.flash = 255;
        playSound(SFX_WX_LIGHTNING);
      }
      if (this.flash > 0) {
        this.flash = Math.max(0, trunc(this.flash - (dt / this.fade) * 255));
      }
    }
    if (this.type !== weatherLIGHTNING) {
      this.rect = new Rect(this.x - level.mapX + level.playX, this.y - level.mapY + level.playY, this.width, this.height);
    }
  }

  draw(ctx) {
    if (this.type === weatherLIGHTNING) {
      if (this.flash > 0) {
        ctx.globalAlpha = this.flash / 255;
        ctx.fillStyle = 'rgb(250,250,200)';
        ctx.fillRect(this.rect.x, this.rect.y, this.width, this.height);
        ctx.globalAlpha = 1;
      }
    } else if (this.pixels) {
      drawPixels(ctx, this.pixels, this.rect.x, this.rect.y, this.alpha);
    } else {
      blit(ctx, this.image, this.rect.x, this.rect.y);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Animated tiles

class AnimTile extends Sprite {
  constructor(x, y, id) {
    super();
    this.x = x * TILESIZE;
    this.y = y * TILESIZE;
    this.id = id;
    this.image = srfcTilesAnim[id * 4];
    this.rect = new Rect(this.x + 4, this.y + 4, 16, 16);
  }
  update(frame, level) {
    this.rect = new Rect(this.x - level.mapX + 4, this.y - level.mapY + 4, 16, 16);
    this.image = srfcTilesAnim[this.id * 4 + frame];
  }
}
