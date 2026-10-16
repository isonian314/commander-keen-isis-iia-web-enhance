'use strict';
// The player (isis_keen.py)

const sDIR_STILL = 0, sDIR_LEFT = -1, sDIR_RIGHT = 1;
const kSPRITE_NORMAL = 0, kSPRITE_GOD = 1, kSPRITE_CRAZY = 2, kSPRITE_EGA = 3, kSPRITE_DREAMS = 4;
const pwrNONE = 0, pwrSHOES = 1, pwrPOINTS = 2, pwrGOD = 3, pwrCRAZY = 4, pwrANTI = 5, pwrREGEN = 6, pwrDEGEN = 7;
const pwrTimes = [0, 10, 5, 10, 10, 3, 20, 20];
const physNORMAL = 0, physSHOES = 1, physGOD = 2, physCRAZY = 3;

// Keys 1-8 select weapons (the numbering on the HUD runs the other way to the weapon list)
const WEAPON_KEYS = { w1: 5, w2: 4, w3: 3, w4: 2, w5: 1, w6: 0, w7: 7, w8: 8 };

// gfn_GetInfoTiles: 9 INFO tiles around a box, with buffers on each side
function getInfoTiles(level, x, y, w, h, lb, rb, tb, bb) {
  const I = level.INFO;
  const cx = [trunc((x + lb) / TILESIZE), trunc((x + w / 2) / TILESIZE), trunc((x - rb + w) / TILESIZE)];
  const cy = [trunc((y + tb) / TILESIZE), trunc((y + h / 2) / TILESIZE), trunc((y - bb + h) / TILESIZE)];
  const out = [];
  for (const ty of cy) for (const tx of cx) out.push(grid(I, tx, ty));
  return out;
}

const upRight30 = (t) => gfnTile_UpRight30_1(t) || gfnTile_UpRight30_2(t);
const downRight30 = (t) => gfnTile_DownRight30_1(t) || gfnTile_DownRight30_2(t);

class Keen extends Sprite {
  constructor() {
    super();
    this.width = 48;
    this.height = 48;
    this.frame = 0;
    this.last_update = 0;
    this.state = kFALLING;
    this.delay = [7.5, 10.0, 9.0, 4.0];
    this.timeElapsed = 0.01;
    this.moveAmountX = 0;
    this.moveAmountY = 0;
    this.extraX = 0;
    this.extraY = 0;

    this.idleTimer = 0;
    this.idleMax = 10;
    this.idleLookTime = 1;
    this.idleShrugTime = 1.5;

    this.RUN_SPEED = [110, 140, 170, 50];
    this.SWIM_SPEED = [55, 60, 65, 35];
    this.SWIM_GRAVITY = 12;
    this.JUMP_AMOUNT = [-180, -220, -240, -150];
    this.JUMP_MAX = -100;
    this.jumpHold = 0.3;
    this.jumpTimer = 0;
    this.GRAVITY = [450, 450, 400, 450];
    this.POGO_IDLE_JUMP = [-200, -220, -230, -100];
    this.POGO_JUMP_AMOUNT = [-225, -265, -285, -205];
    this.POGO_MAX = -120;
    this.newPogoCurrent = 0;
    this.newPogoMax = 1;
    this.newPogoHold = 0.4;
    this.POLE_DOWN = 100;
    this.POLE_UP = 50;

    this.imgSprites = ['keen_sprites0-normal.png', 'keen_sprites1-god.png', 'keen_sprites2-crazy.png',
      'keen_sprites3-ega.png', 'keen_sprites4-dreams.png'].map((f) => splice(48, 48, f, 1, 1));
    this.image = this.imgSprites[0][0];

    this.SPRITE_RUN_LEFT = 0; this.SPRITE_JUMP_LEFT = 5; this.SPRITE_POGO_LEFT = 8;
    this.SPRITE_RUN_RIGHT = 13; this.SPRITE_JUMP_RIGHT = 18; this.SPRITE_POGO_RIGHT = 21;
    this.SPRITE_LEDGE_LEFT = 26; this.SPRITE_LEDGE_RIGHT = 31;
    this.SPRITE_POLE_LEFT = 39; this.SPRITE_POLE_RIGHT = 42; this.SPRITE_POLE_DOWN = 45;
    this.SPRITE_LOOK_UP = 52; this.SPRITE_LOOK_DOWN = 53; this.SPRITE_SHRUG = 55; this.SPRITE_DOOR = 56;
    this.SPRITE_TELEPORT = 65; this.SPRITE_PLATFORM = 78; this.SPRITE_SHIELD = 81; this.SPRITE_DIE = 86;
    this.SPRITE_SWIM_LEFT = 117; this.SPRITE_SWIM_RIGHT = 119; this.SPRITE_SWIM_DIE = 127;
    this.SPRITE_SPEW = 91; this.SPRITE_SPEW_MAX = 11;
    this.SPRITE_SHOOT_PLUTEZARP = 130; this.SPRITE_SHOOT_BLOWGUN = 138; this.SPRITE_SHOOT_HARPOON = 125;

    this.sprite = 0;
    this.x = 0;
    this.y = 0;
    this.rect = new Rect(0, 0, 48, 48);
    this.subRect = new Rect(11, 14, 26, 33);
    this.checkPoint = false;
    this.checkX = 0;
    this.checkY = 0;
    this.vx = 0;
    this.vy = 0;
    this.tilex = 0;
    this.tiley = 0;
    this.direction = 0;
    this.makeSplash = false;
    this.ledgeTimer = 0;
    this.ledgeClimb = 1;
    this.ledgeDelayTimer = 0;
    this.ledgeDelay = 0.25;
    this.ledgeFrame = 0;
    this.onPogo = false;

    this.lookUp = false;
    this.lookDown = false;
    this.lookSpeed = 50;
    this.lookSpeedReturn = 30;
    this.lookOffsetX = 0;
    this.lookOffsetY = 0;
    this.lookDelay = 0.001;
    this.lookMaxTime = 2;
    this.lookTimer1 = 0;
    this.lookTimer2 = 0;

    this.doorID = 0;
    this.doorToX = 0;
    this.doorToY = 0;

    this.hasKey = [false, false, false, false, false, false];
    this.itemTimer = 0;

    this.weapon = WEAPON;
    this.currentWeapon = -1;
    this.oldWeapon = -1;
    this.timerWeapon = 0;
    this.holdWeapon = 0.25;
    this.shootUp = false;
    this.shootDown = false;

    this.powerUp = pwrNONE;
    this.powerUpTimer = 0;
    this.pointMultiplier = 1;
    this.physics = 0;
    this.regenUpdate = 0;

    this.inventory = INVENTORY;
    this.invCurrent = -1;
    this.invRecharge = 2.0;
    this.invItemTime = 1.0;
    this.invMaxPower = 0;
    this.invShield = 0;
    this.invShieldTime = 0.5;

    this.health = 10;
    this.lives = 3;
    this.score = 0;
    this.canHurt = 0;
    this.HURT = 1;
    this.healTimer = 0;
    this.hurtTimer = 0;
    this.rectOffsetX = 15;
    this.rectOffsetY = 16;
    this.rectW = 20;
    this.rectH = 30;

    this.onPlatform = false;
    this.touchSwitch = false;
  }

  // Frame from the current sprite sheet; missing frames (the EGA sheet is shorter) keep the last image
  spr(i, sheet) {
    const img = this.imgSprites[sheet === undefined ? this.sprite : sheet][i];
    return img || this.image;
  }

  heal(amount) {
    if (this.health < 10) {
      this.health = Math.min(10, this.health + amount);
      this.healTimer = 1;
      this.hurtTimer = 0;
    }
  }

  hurt(amount, game, level) {
    if (this.canHurt !== 0) return;
    this.canHurt = this.HURT;
    this.health -= amount;
    this.hurtTimer = 1;
    this.healTimer = 0;
    if (this.health <= 0) {
      musicFadeout(500);
      playSound(SFX_KEEN_DIE);
      this.onPogo = false;
      this.lives -= 1;
      this.health = 10;
      const r = trunc(pyround(rand()));
      this.frame = (this.state !== kIN_WATER ? this.SPRITE_DIE : this.SPRITE_SWIM_DIE) + r;
      this.state = kDYING;
      this.vy = this.JUMP_AMOUNT[0];
      this.onPlatform = false;
      this.direction = this.x - level.mapX < level.playWidth / 2.0 ? 1 : -1;
      this.resetPowerUp();
    }
  }

  resetPowerUp() {
    this.powerUpTimer = 0;
    this.powerUp = pwrNONE;
    this.pointMultiplier = 1;
    this.sprite = kSPRITE_NORMAL;
    this.physics = physNORMAL;
  }

  // Game over / new game. Inventory and battery capacity are intentionally kept, as in the original.
  reset() {
    this.hasKey = [false, false, false, false, false, false];
    for (let i = 0; i < 9; i++) this.weapon[i].ammo = -1;
    this.lives = 3;
    this.health = 10;
    this.score = 0;
    this.currentWeapon = -1;
    this.invCurrent = -1;
    this.checkPoint = false;
    this.checkX = 0;
    this.checkY = 0;
    this.resetPowerUp();
  }

  updateSubRect() {
    this.subRect = new Rect(pyround(this.x) + this.rectOffsetX, pyround(this.y) + this.rectOffsetY, this.rectW, this.rectH);
  }

  update(t, dt, level, game) {
    this.timeElapsed = Math.min(dt, 0.1);
    const te = this.timeElapsed;

    this.timerWeapon = this.timerWeapon > 0 ? this.timerWeapon - te : 0;
    this.itemTimer = this.itemTimer > 0 ? this.itemTimer - te : 0;

    // Out of ammo and not shooting: choose another weapon
    if (this.currentWeapon === W_HARPOON) {
      if (this.weapon[W_HARPOON].ammo === 0 && this.timerWeapon === 0) this.currentWeapon = -1;
    } else if (this.currentWeapon >= 0) {
      if (this.weapon[this.currentWeapon].ammo === 0 && this.timerWeapon === 0) {
        if (this.currentWeapon === W_RAYGUN || this.currentWeapon === W_NEURAL) this.currentWeapon = W_BLOWGUN;
        let count = 0;
        while (this.weapon[this.currentWeapon].ammo <= 0 && count < 6) {
          this.currentWeapon += 1;
          if (this.currentWeapon === 6) this.currentWeapon = 0;
          count += 1;
        }
        if (count === 6) this.currentWeapon = -1;
      }
    }

    this.canHurt = this.canHurt > 0 ? this.canHurt - te : 0;

    // Powerups
    if (this.powerUpTimer > 0) {
      this.powerUpTimer -= te;
      if (this.powerUp === pwrREGEN || this.powerUp === pwrDEGEN) {
        if ((t - this.regenUpdate) / 1000.0 > 2.0) {
          if (this.powerUp === pwrREGEN) this.heal(1);
          else this.hurt(1, game, level);
          this.regenUpdate = t;
        }
      } else if (this.powerUp === pwrCRAZY) {
        if (trunc(rand() * (1.5 / te)) === 1) {
          this.RUN_SPEED[3] += trunc(rand() * 150) - 75;
          this.SWIM_SPEED[3] += trunc(rand() * 40) - 20;
          this.JUMP_AMOUNT[3] += trunc(rand() * 60) - 30;
          this.POGO_IDLE_JUMP[3] += trunc(rand() * 60) - 30;
          this.POGO_JUMP_AMOUNT[3] += trunc(rand() * 40) - 20;
          if (this.JUMP_AMOUNT[3] >= -50) this.JUMP_AMOUNT[3] = -50;
          if (this.POGO_IDLE_JUMP[3] >= -50) this.POGO_IDLE_JUMP[3] = -50;
          if (this.POGO_JUMP_AMOUNT[3] >= -50) this.POGO_JUMP_AMOUNT[3] = -50;
        }
      }
    } else if (this.powerUpTimer < 0) {
      if (this.powerUp === pwrCRAZY && this.state === kON_GROUND) {
        this.state = kSPEW;
        this.powerUpTimer = 0;
        this.frame = 0;
        this.image = this.spr(this.SPRITE_SPEW);
      } else {
        this.resetPowerUp();
      }
    }

    // Inventory
    const inv = this.inventory;
    if (this.invCurrent !== -1 && inv[this.invCurrent].power > 0) {
      if (this.invCurrent === 0) {
        inv[0].power -= te * (1 / this.invRecharge);
        for (let i = 1; i < 4; i++) {
          if (inv[i].power !== -1) {
            inv[i].power += te * (1 / this.invRecharge);
            if (inv[i].power >= this.invMaxPower) inv[i].power = this.invMaxPower;
          }
        }
      } else {
        inv[this.invCurrent].power -= te * (1 / this.invItemTime);
      }
      if (inv[this.invCurrent].power <= 0) {
        inv[this.invCurrent].power = 0;
        this.invCurrent = -1;
      }
    }
    if (inv[0].power !== -1 && inv[0].power < this.invMaxPower) {
      inv[0].power += te * (1 / (2 * this.invRecharge));
      if (inv[0].power >= this.invMaxPower) inv[0].power = this.invMaxPower;
    }
    if (this.invShield > 0) {
      this.invShield -= te;
      if (this.invShield <= 0) this.invShield = 0;
    }

    this.healTimer = this.healTimer > 0 ? this.healTimer - te : 0;
    this.hurtTimer = this.hurtTimer > 0 ? this.hurtTimer - te : 0;

    const keys = Input.keys();
    this.checkInput(keys, level, game);
    this.updatePosition(t, keys, level, game);
    this.selectFrame(t, keys, level);

    // Random bubbles while swimming
    if (this.state === kIN_WATER && trunc(rand() * (1.0 / te / 0.5)) === 1) {
      const offsetX = this.direction === sDIR_LEFT ? 10 : 48;
      for (let i = 0; i < 3; i++) level.sprite_Particles.add(new Particle(this.x + offsetX, this.y + 26, pTYPE_BUBBLE, 0, 0));
    }

    this.rect = new Rect(this.x - level.mapX + level.playX, this.y - level.mapY + level.playY, 48, 48);
    this.updateSubRect();
    this.tilex = trunc((this.x + this.width / 2) / TILESIZE);
    this.tiley = trunc((this.y + this.height) / TILESIZE);
  }

  enterWater() {
    this.state = kIN_WATER;
    this.makeSplash = true;
    this.frame = 0;
    this.vy = 0;
    this.onPogo = false;
    this.oldWeapon = this.currentWeapon;
    this.currentWeapon = this.weapon[W_HARPOON].ammo > 0 ? W_HARPOON : -1;
  }

  // Try to move Keen by at most 1px in one direction (gfn_Push).
  // byEnemy = true is the reduced variant used when enemies shove Keen (keenPush).
  push(level, ax, ay, byEnemy) {
    const full = !byEnemy;
    const g = (x, y) => grid(level.INFO, x, y);

    if (ax !== 0) {
      const right = ax > 0;
      if (right ? this.x + this.width < level.width * TILESIZE - 1 : this.x > 1) {
        this.x += ax;
        this.updateSubRect();
      }
      if (full) {
        const c = getInfoTiles(level, this.x, this.y, this.width, this.height, 0, 0, 0, 4);
        if (gfnTile_Water(c[7])) {
          if (this.state === kON_GROUND) this.enterWater();
        } else if (this.state === kIN_WATER) {
          this.state = kON_GROUND;
          this.currentWeapon = this.oldWeapon;
        }
      }
      const sr = this.subRect;
      const tx = trunc(sr.midbottomX / TILESIZE), ty = trunc(sr.bottom / TILESIZE);

      // Solid enemies (yorps) block Keen
      let yorpy = false;
      if (full) {
        for (const e of spritecollide(this, level.sprite_Enemies, collideRect)) {
          if (!collideMask(this, e)) continue;
          if (gfn_IsPushEnemy(e.id) && e.state !== ENEMY_STATE_DIE) {
            const kc = this.x + this.width / 2.0, ec = e.x + e.width / 2.0;
            if ((right ? kc < ec : kc > ec) || e.id === SPRITE_DRAGONFLY) {
              this.x -= ax;
              yorpy = true;
            }
          }
        }
      }
      if (yorpy) {
        // blocked
      } else {
        const climb45 = right ? gfnTile_UpRight45 : gfnTile_DownRight45;
        const climb30 = right ? upRight30 : downRight30;
        const desc45 = right ? gfnTile_DownRight45 : gfnTile_UpRight45;
        const desc30 = right ? downRight30 : upRight30;
        const canClimb = this.state === kON_GROUND || (full && this.state === kIN_WATER);
        const onGround = this.state === kON_GROUND;
        const mag = Math.abs(ax);
        if (climb45(g(tx, ty)) || climb45(g(tx, ty - 1))) {
          if (canClimb) { this.y -= 3 * mag / 4.0; this.x -= ax / 4.0; }
        } else if (climb30(g(tx, ty)) || climb30(g(tx, ty - 1))) {
          if (canClimb) this.y -= mag / 2.0;
        } else if (desc45(g(tx, ty)) || desc45(g(tx, ty + 1))) {
          if (onGround) this.y += mag;
        } else if (desc30(g(tx, ty)) || desc30(g(tx, ty + 1))) {
          if (onGround) this.y += mag / 2.0;
        } else {
          // Hit a wall
          let TileYpix = sr.y - pmod(sr.y, TILESIZE) + 1;
          const TestEndY = sr.y + sr.h - 1;
          let TileY = trunc(TileYpix / TILESIZE);
          if (right) {
            const TileX = trunc((sr.x + sr.w) / TILESIZE);
            for (; TileYpix <= TestEndY; TileY++, TileYpix += TILESIZE) {
              const behind = g(TileX - 1, TileY);
              if (gfnTile_SolidFromLeft(g(TileX, TileY)) && !gfnTile_UpRight45(behind) && !upRight30(behind)) {
                this.x = TileX * TILESIZE - sr.w - this.rectOffsetX - 1;
                if (full) this.newPogoCurrent = 0;
              }
            }
          } else {
            const TileX = trunc(sr.x / TILESIZE);
            for (; TileYpix <= TestEndY; TileY++, TileYpix += TILESIZE) {
              if (gfnTile_SolidFromRight(g(TileX, TileY)) && !gfnTile_DownRight45(g(TileX + 1, TileY)) &&
                !gfnTile_UpRight45(g(TileX + 1, TileY - 1)) && !downRight30(g(TileX + 1, TileY - 1))) {
                this.x = (TileX + 1) * TILESIZE - this.rectOffsetX;
                if (full) this.newPogoCurrent = 0;
              }
            }
          }
          // Walked off a ledge?
          let fall = true;
          let TileXpix = sr.x - pmod(sr.x, TILESIZE) + (right ? 4 : 2);
          const TestEndX = sr.x + sr.w - (right ? 2 : 4);
          const FY = trunc((sr.y + sr.h + 2) / TILESIZE);
          for (let TileX = trunc(TileXpix / TILESIZE); TileXpix <= TestEndX; TileX++, TileXpix += TILESIZE) {
            if (gfnTile_SolidFromTop(g(TileX, FY))) fall = false;
          }
          if (fall && this.state === kON_GROUND && !this.onPlatform) {
            this.vy = 0;
            this.state = kFALLING;
          }
        }
      }
    } else if (ay > 0) {
      if (this.y < level.height * TILESIZE - this.height - TILESIZE) {
        this.y += ay;
        this.updateSubRect();
      }
      const c = getInfoTiles(level, this.x, this.y, this.width, this.height, 0, 0, 0, 8);
      if (gfnTile_Water(c[7]) && this.state === kFALLING) this.enterWater();

      const sr = this.subRect;
      const TileX = trunc(sr.midbottomX / TILESIZE), TileY = trunc(sr.bottom / TILESIZE);
      const bm = pmod(sr.bottom, TILESIZE), mx = pmod(sr.midbottomX, TILESIZE);
      const t = g(TileX, TileY);
      const land = (surface) => {
        if (bm > surface) {
          this.y -= bm - surface;
          this.vy = 0;
          if (!full || this.state !== kIN_WATER) this.state = kON_GROUND;
        }
      };
      if (gfnTile_UpRight45(t)) land(TILESIZE - mx);
      else if (gfnTile_UpRight30_1(t)) land(TILESIZE - mx * 0.5);
      else if (gfnTile_UpRight30_2(t)) land(TILESIZE - (mx + TILESIZE) * 0.5);
      else if (gfnTile_DownRight45(t)) land(mx);
      else if (gfnTile_DownRight30_1(t)) land(mx * 0.5);
      else if (gfnTile_DownRight30_2(t)) land((mx + TILESIZE) * 0.5);
      else {
        let TileXpix = sr.x - pmod(sr.x, TILESIZE) + 2;
        const TestEnd = sr.x + sr.w - 2;
        const FY = trunc((sr.bottom + (full ? 1 : 0)) / TILESIZE);
        for (let tx = trunc(TileXpix / TILESIZE); TileXpix <= TestEnd; tx++, TileXpix += TILESIZE) {
          if (gfnTile_SolidFromTop(g(tx, FY))) {
            this.y = FY * TILESIZE - sr.h - this.rectOffsetY - 1;
            if (this.state === kFALLING) this.state = kON_GROUND;
            this.vy = 0;
          }
        }
      }
    } else if (ay < 0) {
      if (full ? this.y + this.subRect.y > TILESIZE : this.y > TILESIZE) {
        this.y += ay;
        this.updateSubRect();
      }
      const c = getInfoTiles(level, this.x, this.y, this.width, this.height, 16, 16, 16, 4);
      if (this.state === kIN_WATER && !gfnTile_Water(c[7])) {
        this.vy = this.JUMP_AMOUNT[this.sprite];
        this.state = kFALLING;
        this.currentWeapon = this.oldWeapon;
      }
      const sr = this.subRect;
      let TileXpix = sr.x - pmod(sr.x, TILESIZE);
      const TestEnd = sr.x + sr.w;
      const TileY = trunc(sr.y / TILESIZE);
      for (let tx = trunc(TileXpix / TILESIZE); TileXpix <= TestEnd; tx++, TileXpix += TILESIZE) {
        if (gfnTile_SolidFromBottom(g(tx, TileY))) {
          this.vy = 0;
          this.jumpTimer = 0;
          this.y -= ay;
        }
      }
    }
    this.updateSubRect();
  }

  keenPush(level, ax, ay) {
    this.push(level, ax, ay, true);
  }

  // Single key presses (gfnKeen_checkSingleKey)
  checkSingleKey(action, level, game) {
    const keys = Input.keys();
    if (action === 'pogo') {
      if (this.onPogo) {
        this.onPogo = false;
      } else if (this.state === kON_GROUND || this.state === kFALLING) {
        this.onPogo = true;
        this.state = kFALLING;
        this.lookUp = this.lookDown = false;
        this.newPogoCurrent = this.vx !== 0 ? this.direction * (this.moveAmountX / this.timeElapsed) : 0;
      }
    } else if (action === 'shoot') {
      if (this.state !== kON_LEDGE && this.state !== kIN_DOOR && this.state !== kDYING && this.powerUp !== pwrCRAZY && this.powerUp !== pwrGOD) {
        const wpn = this.currentWeapon >= 0 ? this.weapon[this.currentWeapon] : null;
        if (this.state !== kIN_WATER && wpn && wpn.ammo > 0) {
          if (!(this.state === kON_POLE && (this.currentWeapon === W_BLOWGUN || this.currentWeapon === W_PLUTEZARP)) || this.lookDown) {
            this.lookUp = this.lookDown = false;
            let shootUp = false, shootDown = false;
            playSound(this.currentWeapon);
            this.timerWeapon = this.holdWeapon;
            wpn.ammo -= 1;
            if (this.onPogo) this.onPogo = false;
            if (keys.up && this.currentWeapon !== W_BLOWGUN && this.currentWeapon !== W_PLUTEZARP) shootUp = true;
            else if (keys.down && this.state !== kON_GROUND) shootDown = true;
            level.sprite_Projectiles.add(new Shoot(this, shootUp, shootDown));
            this.idleTimer = 0;
          }
        } else if (this.state === kIN_WATER && this.currentWeapon === W_HARPOON && this.weapon[W_HARPOON].ammo > 0) {
          this.timerWeapon = this.holdWeapon;
          this.weapon[W_HARPOON].ammo -= 1;
          level.sprite_Projectiles.add(new Shoot(this, false, false));
          this.idleTimer = 0;
        }
      }
    } else if (action in WEAPON_KEYS) {
      const w = WEAPON_KEYS[action];
      if (this.weapon[w].ammo > 0 && this.state !== kIN_WATER) this.currentWeapon = w;
    } else if (/^inv[1-4]$/.test(action)) {
      const i = Number(action[3]) - 1;
      if (this.inventory[i].power >= 1 && (i !== 0 || this.powerUp !== pwrCRAZY)) {
        this.invCurrent = this.invCurrent !== i ? i : -1;
      }
    } else if (action === 'up') {
      if (this.state === kON_GROUND && this.vx === 0 && !this.touchSwitch) {
        for (const sw of spritecollide(this, level.sprite_Switches, collideRect)) {
          if (!collideMask(this, sw)) continue;
          sw.state = sw.state === DOOR_STATE_CLOSED ? DOOR_STATE_OPEN : DOOR_STATE_CLOSED;
          playSound(SFX_KEEN_SWITCH);
          this.touchSwitch = true;
          this.last_update = ticks();
          for (const p of level.sprite_Platforms) {
            if (p.switchNum === sw.switchNum) p.active = sw.state === DOOR_STATE_OPEN;
          }
        }
      }
    } else if (action.startsWith('dbg') && Settings.debugKeys) {
      const d = game.debug;
      switch (action) {
        case 'dbgHidden': d.hidden = !d.hidden; break;
        case 'dbgJump': d.jump = !d.jump; break;
        case 'dbgKeys': this.hasKey = [true, true, true, true, true, true]; break;
        case 'dbgLives': this.lives = 99; this.health = 10; break;
        case 'dbgWeapons':
          for (let i = 0; i < 9; i++) this.weapon[i].ammo = 99;
          this.currentWeapon = W_BLOWGUN;
          break;
        case 'dbgInventory':
          for (let i = 0; i < 4; i++) this.inventory[i].power = 20;
          this.invMaxPower = 20;
          break;
        case 'dbgStats': d.message = d.message !== DEBUG_STATS ? DEBUG_STATS : DEBUG_NIL; break;
        case 'dbgMessage': d.message = d.message !== DEBUG_HELLO ? DEBUG_HELLO : DEBUG_NIL; break;
        case 'dbgColour': d.messageCol = d.messageCol < d.COLS.length - 1 ? d.messageCol + 1 : 0; break;
      }
    }
  }

  poleSnap(rightSide) {
    const m = trunc(pmod(this.x, TILESIZE));
    if (rightSide) this.x += 7 - m;
    else if (m >= 8) this.x -= 1 + (m - 8);
    else this.x -= m + 8 + 1;
  }

  // Held keys (gfnKeen_checkInput)
  checkInput(keys, level, game) {
    const te = this.timeElapsed;

    // Look offsets drift back to centre
    if (this.lookOffsetY !== 0 && !this.lookUp && !this.lookDown) {
      this.lookTimer2 += te;
      if (this.lookTimer2 >= this.lookMaxTime) {
        this.lookOffsetY += (this.lookOffsetY > 0 ? -1 : 1) * te * this.lookSpeedReturn;
        if (Math.abs(this.lookOffsetY) < 1) {
          this.lookOffsetY = 0;
          this.lookTimer2 = 0;
          this.lookUp = this.lookDown = false;
        }
      }
    }
    if (this.lookOffsetX !== 0) {
      this.lookOffsetX += (this.lookOffsetX > 0 ? -1 : 1) * te * this.lookSpeedReturn;
      if (Math.abs(this.lookOffsetX) < 1) this.lookOffsetX = 0;
    }

    if (keys.up) {
      if (this.state === kON_GROUND && !(keys.left || keys.right) && !keys.jump && !this.onPogo) {
        const c = getInfoTiles(level, this.x, this.y, this.width, this.height, 0, 0, 0, 0);
        if (gfnTile_Door(c[4])) {
          let doorType = 0;
          this.state = kIN_DOOR;
          const doors = level.DoorList;
          for (let i = 0; i < doors.length; i++) {
            if (this.tilex === doors[i].x1 && this.tiley - 2 === doors[i].y1) {
              this.doorID = i;
              this.doorToX = (doors[i].x2 - 1) * TILESIZE;
              this.doorToY = (doors[i].y2 - 1) * TILESIZE;
              doorType = 0;
            } else if (this.tilex === doors[i].x2 && this.tiley - 2 === doors[i].y2) {
              this.doorID = i;
              this.doorToX = (doors[i].x1 - 1) * TILESIZE;
              this.doorToY = (doors[i].y1 - 1) * TILESIZE;
              doorType = 1;
            }
          }
          const door = doors[this.doorID];
          if (door) {
            const dx = doorType === 0 ? door.x1 : door.x2;
            this.x = (door.id % 2 === 1 ? dx + 1 : dx) * TILESIZE - this.width / 2.0;
          }
        } else if (level.playHeight - pmod(this.y - level.mapY, level.playHeight) > TILESIZE * 4 && trunc(level.mapY) > 0) {
          if (this.timerWeapon === 0) {
            let touching = false;
            for (const sw of spritecollide(this, level.sprite_Switches, collideRect)) {
              if (collideMask(this, sw)) touching = true;
            }
            if (!touching) {
              this.lookTimer1 += te;
              if (this.lookTimer1 > this.lookDelay) {
                this.lookOffsetY -= this.lookSpeed * te;
                this.lookUp = true;
                this.lookTimer2 = 0;
              }
            }
          }
        }
      } else if (this.state === kFALLING) {
        // Grab a pole while falling
        if (this.powerUp !== pwrCRAZY && this.vy >= 0) {
          const c = getInfoTiles(level, this.x, this.y, this.width, this.height, 28, 24, 24, 0);
          if (gfnTile_Pole(c[0]) && !gfnTile_Pole(c[1])) {
            this.state = kON_POLE;
            this.poleSnap(true);
          } else if (gfnTile_Pole(c[2])) {
            this.state = kON_POLE;
            this.poleSnap(false);
          }
        }
      }
    } else if (this.lookUp) {
      this.lookTimer1 = 0;
      this.lookUp = false;
    } else if (keys.down && !(keys.left || keys.right) && this.state === kON_GROUND && !this.onPogo) {
      const c = getInfoTiles(level, this.x, this.y, this.width, this.height, 28, 24, 0, 3);
      if (this.powerUp !== pwrCRAZY && gfnTile_Pole(c[6]) && !gfnTile_Pole(c[7])) {
        this.state = kON_POLE;
        this.direction = sDIR_RIGHT;
        this.poleSnap(true);
      } else if (this.powerUp !== pwrCRAZY && gfnTile_Pole(c[8])) {
        this.state = kON_POLE;
        this.direction = sDIR_LEFT;
        this.poleSnap(false);
      } else if (keys.jump) {
        // Jump down through one-way platforms
        const tx = trunc((this.x + this.width / 2.0) / TILESIZE);
        const ty = trunc((this.y + this.height + 5) / TILESIZE);
        if (!gfnTile_SolidFromBottom(grid(level.INFO, tx, ty))) {
          this.vy = 0;
          this.state = kFALLING;
          this.y += 16;
        }
      } else if (this.y - level.mapY > TILESIZE && trunc(level.mapY) < level.height * TILESIZE - level.playHeight) {
        this.lookTimer1 += te;
        if (this.lookTimer1 > this.lookDelay) {
          this.lookOffsetY += this.lookSpeed * te;
          this.lookDown = true;
          this.lookTimer2 = 0;
        }
      }
    } else if (this.lookDown) {
      this.lookTimer1 = 0;
      this.lookDown = false;
    } else if (!keys.up && !keys.down) {
      this.lookTimer1 = 0;
    }

    const speed = this.RUN_SPEED[this.physics];
    if (this.state === kON_GROUND || this.state === kFALLING || this.state === kON_POLE) {
      const pogoDrift = () => {
        if (this.newPogoCurrent < 0) { this.vx = -1; this.direction = sDIR_LEFT; }
        else if (this.newPogoCurrent > 0) { this.vx = 1; this.direction = sDIR_RIGHT; }
        return this.newPogoCurrent === 0;
      };
      const blocked = this.state === kON_GROUND && this.timerWeapon !== 0;
      if (keys.left && !blocked) {
        this.lookUp = this.lookDown = false;
        this.direction = this.powerUp !== pwrCRAZY ? sDIR_LEFT : sDIR_RIGHT;
        this.vx = -1;
        if (!this.onPogo) {
          this.moveAmountX = te * speed;
        } else {
          this.newPogoCurrent -= (te / this.newPogoHold) * this.newPogoMax * speed;
          if (this.newPogoCurrent < -this.newPogoMax * speed) this.newPogoCurrent = -this.newPogoMax * speed;
          if (pogoDrift()) this.vx = 0;
          this.moveAmountX = te * Math.abs(this.newPogoCurrent);
        }
      } else if (keys.right && !blocked) {
        this.lookUp = this.lookDown = false;
        this.direction = this.powerUp !== pwrCRAZY ? sDIR_RIGHT : sDIR_LEFT;
        this.vx = -1;
        if (!this.onPogo) {
          this.moveAmountX = te * speed;
        } else {
          this.newPogoCurrent += (te / this.newPogoHold) * this.newPogoMax * speed;
          if (this.newPogoCurrent > this.newPogoMax * speed) this.newPogoCurrent = this.newPogoMax * speed;
          if (pogoDrift() && this.extraX === 0) this.vx = 0;
          this.moveAmountX = te * Math.abs(this.newPogoCurrent);
        }
      } else if (this.onPogo) {
        if (pogoDrift() && this.extraX === 0) this.vx = 0;
        this.moveAmountX = te * Math.abs(this.newPogoCurrent);
      } else {
        this.vx = 0;
      }

      // Jump
      if (keys.jump) {
        this.lookUp = this.lookDown = false;
        if (this.state === kON_POLE && this.vy === 0) {
          this.vy = this.JUMP_AMOUNT[this.physics] * 0.5;
          this.state = kFALLING;
        } else if (this.state === kON_GROUND || game.debug.jump) {
          this.vy = this.onPogo ? this.POGO_JUMP_AMOUNT[this.physics] : this.JUMP_AMOUNT[this.physics];
          this.moveAmountY = te * this.vy;
          this.jumpTimer = 0.00001;
          this.state = kFALLING;
          if (!game.debug.jump) playSound(this.onPogo ? SFX_KEEN_POGO : SFX_KEEN_JUMP);
        } else if (this.jumpTimer !== 0) {
          // Holding jump increases height until jumpHold has passed
          this.jumpTimer += te;
          if (this.jumpTimer < this.jumpHold) this.vy += te * ((this.onPogo ? this.POGO_MAX : this.JUMP_MAX) / this.jumpHold);
          else this.jumpTimer = 0;
        }
      } else if (this.state === kON_GROUND && this.onPogo) {
        playSound(SFX_KEEN_POGO);
        this.vy = this.POGO_IDLE_JUMP[this.physics];
        this.moveAmountY = te * this.vy;
        this.state = kFALLING;
      }

      // Ledge grab
      if (this.state === kFALLING && this.vy >= 0 && (keys.left || keys.right) && !this.onPogo) {
        const ty1 = trunc((this.y + 16) / TILESIZE), ty2 = trunc((this.y + 17) / TILESIZE);
        if (keys.left && this.ledgeTimer <= 0) {
          const tx = trunc((this.x - 16 + this.width / 2.0) / TILESIZE);
          if (gfnTile_CanGrab(grid(level.INFO, tx, ty2)) && !gfnTile_SolidFromRight(grid(level.INFO, tx, ty1))) {
            this.state = kON_LEDGE;
            this.ledgeFrame = 0;
            this.x = tx * TILESIZE + 2;
          }
        }
        if (keys.right && this.ledgeTimer <= 0) {
          const tx = trunc((this.x + 16 + this.width / 2.0) / TILESIZE);
          if (gfnTile_CanGrab(grid(level.INFO, tx, ty2)) && !gfnTile_SolidFromLeft(grid(level.INFO, tx, ty1))) {
            this.state = kON_LEDGE;
            this.ledgeFrame = 0;
            this.x = (tx - 2) * TILESIZE - 3;
          }
        }
      }
    } else if (this.state === kON_LEDGE) {
      this.vx = 0;
      this.vy = 0;
      this.ledgeDelayTimer += te;
      const ready = this.ledgeTimer <= 0 && this.ledgeDelayTimer >= this.ledgeDelay;
      if (this.direction === sDIR_LEFT && (keys.up || keys.left) && ready) {
        this.ledgeTimer = this.ledgeClimb;
      } else if (this.direction === sDIR_RIGHT && (keys.up || keys.right) && ready) {
        this.ledgeTimer = this.ledgeClimb;
      } else if (this.ledgeTimer <= 0 && ((this.direction === sDIR_LEFT && keys.right) || (this.direction === sDIR_RIGHT && keys.left))) {
        this.ledgeTimer = 0;
        this.ledgeDelayTimer = 0;
        this.state = kFALLING;
      }
    } else if (this.state === kIN_WATER) {
      const fastSwim = keys.jump ? 1.5 : 1;
      const swim = this.SWIM_SPEED[this.physics];
      if (keys.left || keys.right) {
        const want = keys.left ? sDIR_LEFT : sDIR_RIGHT;
        this.direction = this.powerUp !== pwrCRAZY ? want : -want;
        this.vx = -1;
        this.moveAmountX = te * swim * fastSwim;
      } else {
        this.vx = 0;
        this.moveAmountX = 0;
      }
      if (keys.up) {
        this.vy -= te * (swim * 0.6);
        if (this.vy < -1.5 * this.SWIM_GRAVITY) this.vy = -1.5 * this.SWIM_GRAVITY;
        this.moveAmountY = -1 * te * (swim * 0.6) * fastSwim;
      } else if (keys.down) {
        this.moveAmountY = te * (swim * 1.0) * fastSwim;
      }
    }
  }

  updatePosition(t, keys, level, game) {
    const te = this.timeElapsed;
    const s = this.state;
    if (this.vx !== 0 && (s === kON_GROUND || s === kFALLING || s === kIN_WATER)) {
      for (let i = 0; i < trunc(Math.abs(this.moveAmountX)); i++) this.push(level, this.direction, 0);
      this.push(level, pmod(this.moveAmountX, 1) * this.direction, 0);
    }

    if (this.state === kON_GROUND || this.state === kFALLING || this.state === kIN_WATER) {
      if (this.moveAmountY < 0) {
        for (let i = 0; i < trunc(Math.abs(this.moveAmountY)); i++) this.push(level, 0, -1);
        this.push(level, 0, pmod(this.moveAmountY, -1));
      } else if (this.moveAmountY > 0) {
        for (let i = 0; i < trunc(Math.abs(this.moveAmountY)); i++) {
          if (this.state === kFALLING || this.state === kIN_WATER) this.push(level, 0, 1);
        }
        if (this.state === kFALLING || this.state === kIN_WATER) this.push(level, 0, pmod(this.moveAmountY, 1));
      }
      if (this.state === kFALLING) {
        this.vy += te * this.GRAVITY[this.sprite];
        if (this.vy > 400) this.vy = 400;
      } else if (this.state === kIN_WATER) {
        this.vy += te * this.SWIM_GRAVITY;
        if (this.vy > this.SWIM_GRAVITY && !keys.down) this.vy = this.SWIM_GRAVITY;
      } else {
        this.vy = 0;
      }
      this.moveAmountY = te * this.vy;
    } else if (this.state === kON_POLE) {
      this.vy = 0;
      if (keys.down) {
        this.y += te * this.POLE_DOWN;
        this.vy = 1;
        const c = getInfoTiles(level, this.x, this.y, this.width, this.height, 0, 16, 0, 20);
        if (!gfnTile_Pole(c[8])) this.state = kFALLING;
      } else if (keys.up) {
        const c = getInfoTiles(level, this.x, this.y, this.width, this.height, 0, 16, 0, 0);
        if (gfnTile_Pole(c[5])) {
          this.y -= te * this.POLE_UP;
          this.vy = -1;
        } else {
          this.vy = 0;
        }
      }
    } else if (this.state === kDYING) {
      this.x += te * this.RUN_SPEED[0];
      this.vy += te * this.GRAVITY[0];
      this.y += te * this.vy;
      if (this.y - level.mapY > level.playHeight) {
        game.wait(500);
        if (this.lives >= 1) {
          this.hasKey = [false, false, false, false, false, false];
          game.state = STATE_FADEOUT_KILL;
        } else {
          game.state = STATE_FADEOUT_GAMEOVER;
        }
        game.fadeTimer = game.fadeTime * 2;
      }
    }
  }

  shootFrameBase() {
    const offset = this.currentWeapon === W_RAYGUN || this.currentWeapon === W_NEURAL ? 2 : 0;
    return this.SPRITE_SHOOT_PLUTEZARP + (this.currentWeapon - offset) * 13;
  }

  // Animation & frame selection (gfnKeen_selectFrame)
  selectFrame(t, keys, level) {
    const lr = (left, right) => {
      if (this.direction === sDIR_LEFT) this.image = this.spr(left);
      else if (this.direction === sDIR_RIGHT) this.image = this.spr(right);
    };
    const cw = this.currentWeapon;
    const aimed = cw !== W_BLOWGUN && cw !== W_PLUTEZARP;

    if (this.state === kIN_WATER) {
      const offset = this.weapon[W_HARPOON].ammo > 0 ? 4 : 0;
      if (this.timerWeapon === 0) {
        lr(this.SPRITE_SWIM_LEFT + this.frame + offset, this.SPRITE_SWIM_RIGHT + this.frame + offset);
        if (t - this.last_update > 3 * 1000 / this.delay[this.sprite]) {
          this.frame += 1;
          if (this.frame >= 2) this.frame = 0;
          this.last_update = t;
          this.idleTimer = 0;
        }
      } else {
        lr(this.SPRITE_SHOOT_HARPOON, this.SPRITE_SHOOT_HARPOON + 1);
      }
    } else if (this.state === kSPEW) {
      const delayExtra = this.frame === 10 ? 6 : 1;
      if (t - this.last_update > delayExtra * 1000 / this.delay[0]) {
        this.frame += 1;
        this.image = this.spr(this.SPRITE_SPEW + this.frame);
        this.last_update = t;
        this.idleTimer = 0;
        if (this.frame >= this.SPRITE_SPEW_MAX) {
          this.frame = 1;
          this.sprite = kSPRITE_NORMAL;
          this.physics = physNORMAL;
          this.state = kON_GROUND;
          this.powerUp = pwrNONE;
        }
      }
    } else if (this.lookUp) {
      this.image = this.spr(this.SPRITE_LOOK_UP);
      this.idleTimer = 0;
    } else if (this.lookDown) {
      this.idleTimer = 0;
      this.image = this.spr(this.SPRITE_LOOK_DOWN + (this.lookTimer1 / this.lookDelay < 1.1 ? 0 : 1));
    } else if (this.state === kON_POLE) {
      if (this.timerWeapon !== 0) {
        const base = this.shootFrameBase();
        let offset = 0;
        if (aimed && this.shootUp) offset = 2;
        else if (aimed && this.shootDown) offset = 4;
        lr(base + 7 + offset, base + 8 + offset);
      } else if (this.vy > 0) {
        if (t - this.last_update > 1000 / this.delay[0]) {
          this.frame += 1;
          if (this.frame >= 4) this.frame = 0;
          this.image = this.spr(this.SPRITE_POLE_DOWN + this.frame);
          this.last_update = t;
        }
      } else if (this.vy < 0) {
        if (t - this.last_update > 1000 / this.delay[0]) {
          this.frame += 1;
          if (this.frame >= 3) this.frame = 0;
          lr(this.SPRITE_POLE_LEFT + this.frame, this.SPRITE_POLE_RIGHT + this.frame);
          this.last_update = t;
        }
      } else {
        lr(this.SPRITE_POLE_LEFT, this.SPRITE_POLE_RIGHT);
      }
    } else if (this.state === kIN_DOOR) {
      if (t - this.last_update > 1.5 * 1000 / this.delay[0]) {
        this.frame += 1;
        if (this.frame >= 5) {
          this.frame = 0;
          this.x = this.doorToX;
          this.y = this.doorToY;
          this.canHurt = this.HURT;
          this.state = kFALLING;
          this.vy = 0;
          this.doorID = 0;
          this.doorToX = 0;
          this.doorToY = 0;
          level.snapCamera(this);
        }
        this.image = this.spr(this.SPRITE_DOOR + this.frame);
        this.last_update = t;
      }
    } else if (this.state === kTELEPORT) {
      if (t - this.last_update > 1000 / this.delay[0]) {
        this.frame += 1;
        if (this.frame >= 11) {
          this.frame = 0;
          this.x = this.doorToX;
          this.y = this.doorToY;
          this.state = kFALLING;
          this.doorID = 0;
          this.doorToX = 0;
          this.doorToY = 0;
        }
        this.image = this.spr(this.SPRITE_TELEPORT + this.frame);
        this.last_update = t;
      }
    } else if (this.state === kFALLING) {
      this.idleTimer = 0;
      if (!this.onPogo) {
        if (this.invShield > 0) {
          lr(this.SPRITE_SHIELD + 2, this.SPRITE_SHIELD + 3);
        } else if (this.timerWeapon === 0) {
          if (Math.abs(this.vy) < Math.abs(this.JUMP_AMOUNT[this.sprite]) / 5.0) lr(this.SPRITE_JUMP_LEFT + 1, this.SPRITE_JUMP_RIGHT + 1);
          else if (this.vy < 0) lr(this.SPRITE_JUMP_LEFT, this.SPRITE_JUMP_RIGHT);
          else lr(this.SPRITE_JUMP_LEFT + 2, this.SPRITE_JUMP_RIGHT + 2);
        } else {
          const base = this.shootFrameBase();
          if (aimed && this.shootUp) this.image = this.spr(base + 5);
          else if (aimed && this.shootDown) this.image = this.spr(base + 6);
          else if (cw === W_BLOWGUN) lr(this.SPRITE_SHOOT_BLOWGUN + 3, this.SPRITE_SHOOT_BLOWGUN + 4);
          else lr(base + 3, base + 4);
        }
      } else {
        const crouch = this.vy < -120 || (keys.jump && this.vy < 0) ? 1 : 0;
        lr(this.SPRITE_POGO_LEFT + crouch, this.SPRITE_POGO_RIGHT + crouch);
      }
    } else if (this.state === kON_LEDGE) {
      if (this.ledgeTimer <= 0) {
        lr(this.SPRITE_LEDGE_LEFT + this.ledgeFrame, this.SPRITE_LEDGE_RIGHT + this.ledgeFrame);
        this.last_update = this.ledgeClimb;
      } else {
        this.ledgeDelayTimer = 0;
        this.ledgeTimer -= this.timeElapsed;
        if (this.last_update - this.ledgeTimer > this.ledgeClimb / 6.0) {
          this.ledgeFrame += 1;
          this.last_update = this.ledgeTimer;
          if (this.ledgeFrame === 1) {
            this.y -= 18;
          } else if (this.ledgeFrame === 5) {
            this.x += this.direction * 16;
            this.y -= 12;
            this.state = kON_GROUND;
            this.ledgeTimer = 0;
            this.lookOffsetX = 16 * this.direction * -1;
          }
          lr(this.SPRITE_LEDGE_LEFT + this.ledgeFrame, this.SPRITE_LEDGE_RIGHT + this.ledgeFrame);
          if (this.state === kON_GROUND) lr(this.SPRITE_RUN_LEFT, this.SPRITE_RUN_RIGHT);
        }
      }
    } else if (this.state === kON_GROUND) {
      if (!this.onPogo) {
        if (this.touchSwitch) {
          this.image = this.spr(this.SPRITE_DOOR);
          if (t - this.last_update > 2 * 1000 / this.delay[this.sprite]) this.touchSwitch = false;
        } else if (this.vx !== 0 && (keys.left || keys.right)) {
          if (t - this.last_update > 1000 / this.delay[this.sprite]) {
            this.frame += 1;
            if (this.frame >= 5) this.frame = 1;
            lr(this.SPRITE_RUN_LEFT + this.frame, this.SPRITE_RUN_RIGHT + this.frame);
            this.last_update = t;
            this.idleTimer = 0;
          }
        } else {
          this.idleTimer += this.timeElapsed;
          const it = this.idleTimer, im = this.idleMax;
          if (it > im && it < im + this.idleLookTime) {
            this.image = this.spr(this.SPRITE_LOOK_UP);
          } else if (it > im * 1.5 && it < im * 1.5 + this.idleShrugTime) {
            this.image = this.spr(this.SPRITE_SHRUG);
          } else if (this.invShield > 0) {
            lr(this.SPRITE_SHIELD, this.SPRITE_SHIELD + 1);
          } else if (this.onPlatform && this.timerWeapon === 0) {
            this.image = this.spr(this.SPRITE_PLATFORM);
          } else if (this.timerWeapon === 0) {
            lr(this.SPRITE_RUN_LEFT, this.SPRITE_RUN_RIGHT);
            this.frame = 0;
          } else {
            const base = this.shootFrameBase();
            if (aimed && this.shootUp) this.image = this.spr(base + 2);
            else if (cw === W_BLOWGUN) lr(this.SPRITE_SHOOT_BLOWGUN, this.SPRITE_SHOOT_BLOWGUN + 1);
            else lr(base, base + 1);
          }
          if (this.idleTimer >= im * 1.5 + this.idleShrugTime && this.sprite !== kSPRITE_CRAZY) this.idleTimer = 0;
          else if (this.idleTimer >= im * 3 + 5 && this.sprite === kSPRITE_CRAZY) this.idleTimer = 0;
        }
      }
    } else if (this.state === kDYING) {
      this.image = this.spr(this.frame);
    }

    // Flash while invincible
    if (this.state !== kDYING && this.canHurt > 0 && !this.onPlatform) {
      if (pmod(pmod(t, 1000), 200) < 100) this.image = this.imgSprites[0][10];
    }
  }
}
