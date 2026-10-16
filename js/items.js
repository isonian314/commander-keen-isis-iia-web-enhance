'use strict';
// Collectable items and the floating score/pickup indicators (isis_items.py)

let srfcItems, srfcFloats;

Boot.push(() => {
  srfcItems = splice(24, 24, 'items.png', 1, 1);
  srfcFloats = splice(32, 32, 'floatups.png', 1, 1);
});

const POINT_VALUES = { [ITEM_COLA]: 200, [ITEM_BURGER]: 500, [ITEM_GINGER]: 1000, [ITEM_SUGAR]: 2000, [ITEM_CEREAL]: 5000 };
const HEAL_VALUES = { [ITEM_PYAPA_FRUIT]: 1, [ITEM_PEETA_BERRIES]: 3, [ITEM_ISIS_FRUIT]: 5, [ITEM_POTION]: 10 };
const ITEM_WEAPON = {
  [ITEM_BLOWGUN]: W_BLOWGUN, [ITEM_ZEFFER]: W_ZEFFER, [ITEM_PULSAR]: W_PULSAR, [ITEM_SOLARIZER]: W_SOLARIZER,
  [ITEM_HR42]: W_HR42, [ITEM_PLUTEZARP]: W_PLUTEZARP, [ITEM_HARPOON]: W_HARPOON, [ITEM_RAYGUN]: W_RAYGUN, [ITEM_NEURAL]: W_NEURAL,
};

// [powerUp, sprite sheet, physics, point multiplier, resets regen timer]
const POWERUPS = {
  [ITEM_SHOES]: () => [pwrSHOES, kSPRITE_NORMAL, physSHOES, 1],
  [ITEM_POINTS]: () => [pwrPOINTS, kSPRITE_NORMAL, null, 4],
  [ITEM_GOD]: () => [pwrGOD, kSPRITE_GOD, physGOD, 1],
  [ITEM_CRAZY]: () => [pwrCRAZY, kSPRITE_CRAZY, physCRAZY, 1],
  [ITEM_ANTI]: () => [pwrANTI, kSPRITE_NORMAL, physNORMAL, 1],
  [ITEM_REGEN]: () => [pwrREGEN, kSPRITE_NORMAL, physNORMAL, 1, true],
  [ITEM_DEGEN]: () => [pwrDEGEN, kSPRITE_NORMAL, physNORMAL, 1, true],
};

class Item extends Sprite {
  constructor(x, y, id) {
    super();
    this.x = x * TILESIZE;
    this.y = y * TILESIZE;
    this.id = id;
    this.image = srfcItems[id * 4];
    this.rect = new Rect(this.x + 4, this.y + 4, 24, 24);
    this.collected = false;
  }

  // Returns false if Keen can't take the item right now (it stays in the level)
  collect(keen, level, game) {
    const id = this.id;
    if (id >= ITEM_KEY_RED && id <= ITEM_KEY_MAGENTA && !keen.hasKey[id - ITEM_KEY_RED]) {
      playSound(SFX_ITEM_KEY);
      keen.hasKey[id - ITEM_KEY_RED] = true;
    } else if (id >= ITEM_JBEAN_RED && id <= ITEM_CEREAL && keen.score < 99999999) {
      playSound(SFX_ITEM_POINTS);
      const pts = POINT_VALUES[id] || 100;
      keen.score += pts * keen.pointMultiplier;
      level.stats_NumPoints += pts;
      level.stats_NumItems += 1;
    } else if (id >= ITEM_PYAPA_FRUIT && id <= ITEM_POTION && id !== ITEM_NEPHTHYS_FRUIT && keen.health < 10) {
      playSound(SFX_ITEM_POINTS);
      keen.heal(HEAL_VALUES[id]);
    } else if (id === ITEM_NEPHTHYS_FRUIT) {
      keen.hurt(3, game, level);
    } else if (id === ITEM_YORP && keen.lives < 99) {
      playSound(SFX_ITEM_1UP);
      keen.lives += 1;
    } else if (POWERUPS[id]) {
      const [pwr, sprite, physics, mult, regen] = POWERUPS[id]();
      keen.powerUp = pwr;
      keen.powerUpTimer = pwrTimes[pwr];
      keen.sprite = sprite;
      if (physics !== null) keen.physics = physics;
      keen.pointMultiplier = mult;
      if (regen) keen.regenUpdate = ticks();
    } else if (id in ITEM_WEAPON && keen.weapon[ITEM_WEAPON[id]].ammo < 99) {
      const w = ITEM_WEAPON[id];
      if (keen.currentWeapon === -1) {
        if (w === W_HARPOON) {
          if (keen.state === kIN_WATER) keen.currentWeapon = W_HARPOON;
        } else if (w !== W_RAYGUN && w !== W_NEURAL) {
          keen.currentWeapon = w;
        }
      }
      const wpn = keen.weapon[w];
      if (wpn.ammo === -1) wpn.ammo = 0;
      wpn.ammo = Math.min(99, wpn.ammo + 5);
      playSound(w === W_NEURAL ? SFX_ITEM_WEAPON_NEURAL : SFX_ITEM_WEAPON);
    } else if (id === ITEM_BATTERY) {
      playSound(SFX_ITEM_INVENTORY);
      if (keen.invMaxPower < 20) keen.invMaxPower += 1;
      const inv = keen.inventory[0];
      if (inv.power === -1) inv.power = 1;
      else if (inv.power < 20) inv.power += 1;
      level.stats_NumItems += 1;
    } else if (id >= ITEM_SHIELD && id <= ITEM_UNKNOWN) {
      playSound(SFX_ITEM_INVENTORY);
      const inv = keen.inventory[id - ITEM_BATTERY];
      if (inv.power === -1) inv.power = 1;
      level.stats_NumItems += 1;
    } else {
      return false;
    }
    return true;
  }

  update(frame, level, keen, floats, game) {
    this.rect = new Rect(this.x - level.mapX + 4, this.y - level.mapY + 5, 24, 24);
    this.image = srfcItems[this.id * 4 + frame];
    if (!this.collected) return;
    this.collected = this.collect(keen, level, game);
    if (this.collected) {
      keen.itemTimer = 0.5;
      if (keen.score > 99999999) keen.score = 99999999;
      if (keen.health > 10) keen.health = 10;
      if (keen.lives > 99) keen.lives = 99;
      floats.add(new Float(this.x, this.y, this.id, level));
      this.kill();
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Floats

const FLOAT_LENGTH = 2, FLOAT_SPEED = 20;
const FLOAT_KEY = 0, FLOAT_1UP = 18;
const FLOAT_IDS = {
  [ITEM_COLA]: 7, [ITEM_BURGER]: 8, [ITEM_GINGER]: 9, [ITEM_SUGAR]: 10, [ITEM_CEREAL]: 11,
  [ITEM_PYAPA_FRUIT]: 12, [ITEM_PEETA_BERRIES]: 13, [ITEM_ISIS_FRUIT]: 14, [ITEM_NEPHTHYS_FRUIT]: 16, [ITEM_POTION]: 15,
  [ITEM_YORP]: FLOAT_1UP,
  [ITEM_SHOES]: 27, [ITEM_POINTS]: 28, [ITEM_GOD]: 29, [ITEM_CRAZY]: 30, [ITEM_ANTI]: 31, [ITEM_REGEN]: 32, [ITEM_DEGEN]: 33,
  [ITEM_BATTERY]: 43, [ITEM_SHIELD]: 44, [ITEM_IONSCANNER]: 45, [ITEM_UNKNOWN]: 46,
  [ITEM_BLOWGUN]: 34, [ITEM_ZEFFER]: 35, [ITEM_PULSAR]: 36, [ITEM_SOLARIZER]: 37, [ITEM_HR42]: 38,
  [ITEM_PLUTEZARP]: 39, [ITEM_HARPOON]: 40, [ITEM_RAYGUN]: 41, [ITEM_NEURAL]: 42,
};

class Float extends Sprite {
  constructor(x, y, itemId, level) {
    super();
    this.x = x;
    this.y = y - 10;
    this.frame = 0;
    this.last_update = this.last_frame_update = ticks();
    this.timer = 0;
    if (itemId <= ITEM_KEY_MAGENTA) this.id = FLOAT_KEY;
    else if (itemId <= ITEM_JBEAN_PURPLE) this.id = 6;
    else this.id = FLOAT_IDS[itemId];
    if (itemId === ITEM_YORP) this.x -= 7;
    this.image = srfcFloats[this.id].copy();
    this.rect = new Rect(this.x - level.mapX + level.playX, this.y - level.mapY + level.playY, 24, 24);
  }

  update(t, level) {
    const since = (t - this.last_update) / 1000.0;
    this.timer += since;
    const frameAge = (t - this.last_frame_update) / 1000.0;
    if (frameAge > FLOAT_LENGTH / 7.0 && this.id === FLOAT_KEY && this.frame < 5) {
      this.frame += 1;
      this.last_frame_update = t;
    } else if (frameAge > FLOAT_LENGTH / 10.0 && this.id === FLOAT_1UP && this.frame < 7) {
      this.frame += 1;
      this.last_frame_update = t;
    }
    if (this.timer < FLOAT_LENGTH) {
      this.y -= since * FLOAT_SPEED;
      this.rect = new Rect(this.x - level.mapX + 4, this.y - level.mapY + 4, 24, 24);
      this.image = srfcFloats[this.id + this.frame].copy();
      if (this.timer > FLOAT_LENGTH / 2.0) {
        this.image.set_alpha(255 - ((this.timer - FLOAT_LENGTH / 2.0) / (FLOAT_LENGTH / 2.0)) * 255);
      }
    } else {
      this.kill();
    }
    this.last_update = t;
  }
}
