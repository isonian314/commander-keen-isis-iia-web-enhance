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
const PLUTEZARP_LIFE = 0.75, PLUTE_MAXLENGTH = 100;
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
      case W_PLUTEZARP:
        this.x += 18 * dir;
        this.image = scaleSurf(P[PROJ_PLUTEZARP], 1, 32);
        this.image.set_alpha(0.01 * 255);
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
    } else if (this.id === W_PLUTEZARP) {
      const half = PLUTEZARP_LIFE / 2.0;
      if (this.timer < half) {
        const w = trunc(pyround(this.timer / half * PLUTE_MAXLENGTH));
        this.image = scaleSurf(P[PROJ_PLUTEZARP], w, 32);
        if (dir === -1) this.x = this.x0 - w + 13;
        this.image.set_alpha(Math.min(255, 255 * this.timer / half));
      } else if (this.timer < PLUTEZARP_LIFE) {
        this.image.set_alpha(Math.max(0, 255 - 255 * (this.timer - half) / half));
      } else {
        this.kill();
      }
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
      } else if (this.id === W_PLUTEZARP) {
        // no effect
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
      } else if (this.id === W_PLUTEZARP) {
        // no effect
      } else if (this.id === W_HARPOON) {
        addParticles(X, 20, this.x, this.y, () => [255, 255, 255]);
      } else if (this.id === W_PULSAR) {
        addParticles(X, 10, this.x, this.y, () => [200 + trunc(rand() * 40), 55 + trunc(rand() * 40), 200 + trunc(rand() * 40)]);
      } else {
        X.add(new Explode(this.x, this.y, this.id, dir, this.up, this.down));
      }

      enemy.hitPoints -= this.power;

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

      if (enemy.id === SPRITE_RAT && enemy.hitPoints <= 0 && this.id === W_SOLARIZER) {
        enemy.dieFrame = 14;
        enemy.dieMax = 19;
      }

      if (this.id === W_PULSAR) {
        if (!this.up && !this.down) this.x += enemy.width * dir;
        this.power = trunc(this.power / 2.0);
        if (this.power === 0) this.power = 1;
      } else {
        this.kill();
      }

      if (enemy.hitPoints <= 0) {
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
    }

    if (this.x < 0 || this.x > level.width * TILESIZE || this.y < 0 || this.y > level.height * TILESIZE) this.kill();
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
