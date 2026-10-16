'use strict';
// Heads-up display on the right of the playfield (isis_hud.py)

const POS_LIGHT = [264, 105], POS_FACE = [275, 5], POS_KEYS = [279, 142], POS_HEALTH = [269, 26],
  POS_WEAPONS = [295, 44], POS_LIVES = [302, 143], POS_SCORE = [270, 186], POS_POWERUPS = [267, 154],
  POS_INVENT_POWER = [305, 154], POS_INVENT_ICON = [285, 154], POS_INVENT_DOTS = [287, 174];

// Score digit x offsets (8 digits, grouped in threes)
const SCORE_X = [0, 5, 12, 17, 22, 29, 34, 39];

// Right-aligned digits of n in `slots` places; numbers that don't fit show as zeros
function digits(n, slots) {
  const s = String(n);
  const out = new Array(slots).fill(0);
  if (n >= 0 && s.length <= slots) for (let i = 0; i < s.length; i++) out[slots - s.length + i] = Number(s[i]);
  return out;
}

class HUD {
  constructor(keen, ctx) {
    this.flash = false;
    this.blueHealth = true;
    this.imgBlank = loadImage('hud_blank.png', 'key');
    this.imgFaces = splice(40, 38, 'hud_faces.png', 1, 1);
    this.imgHealth = splice(9, 79, 'hud_health.png', 1, 1);
    this.imgHealthBlue = splice(9, 79, 'hud_health_blue.png', 1, 1);
    this.imgLight = splice(17, 31, 'hud_light.png', 1, 1);
    this.imgWeapons = splice(19, 13, 'hud_weapons.png', 1, 1);
    this.imgPowerups = splice(17, 17, 'hud_powerups.png', 1, 1);
    this.imgKeys = splice(13, 9, 'hud_keys.png', 1, 1);
    this.imgFont1 = splice(5, 7, 'hud_font1.png', 1, 1);
    this.imgFont2 = splice(4, 7, 'hud_font2.png', 1, 1);
    this.imgInventory = splice(18, 17, 'hud_inventory.png', 1, 1);
    this.imgInventoryPwr = splice(11, 29, 'hud_inventory_power.png', 1, 1);
    this.imgInventoryDots = splice(17, 5, 'hud_inventory_dots.png', 1, 1);
    this.update(keen, ctx);
  }

  update(keen, ctx) {
    const at2 = (img, pos, dx = 0, dy = 0) => blit(ctx, img, pos[0] + dx, pos[1] + dy);
    blit(ctx, this.imgBlank, 0, 0);

    // Light globe
    if (keen.powerUp === pwrGOD) at2(this.imgLight[5], POS_LIGHT);
    else if (keen.powerUp === pwrCRAZY) at2(this.imgLight[6], POS_LIGHT);
    else if (keen.powerUp === pwrSHOES || keen.powerUp === pwrPOINTS) at2(this.imgLight[4], POS_LIGHT);
    else if (keen.healTimer > 0) at2(this.imgLight[2], POS_LIGHT);
    else if (keen.hurtTimer > 0) at2(this.imgLight[3], POS_LIGHT);
    else {
      const r = trunc(rand() * (1.0 / keen.timeElapsed / 3.0));
      at2(this.imgLight[this.flash ? 1 : 0], POS_LIGHT);
      if (r === 1) this.flash = !this.flash;
    }

    // Health
    if (this.blueHealth) at2(this.imgHealthBlue[0], POS_HEALTH);
    if (keen.health !== 10) at2(this.imgHealth[keen.health], POS_HEALTH);

    // Face
    let face = -1;
    if (keen.state === kDYING) face = 6;
    else if (keen.powerUp === pwrGOD) face = 2;
    else if (keen.powerUp === pwrCRAZY) face = 3;
    else if (keen.health > 6 && keen.itemTimer > 0) face = 1;
    else if (keen.health > 6) face = 0;
    else if (keen.health > 4) face = 4;
    else if (keen.health > 0) face = 5;
    if (face >= 0) at2(this.imgFaces[face], POS_FACE);

    for (let k = 0; k < 6; k++) if (keen.hasKey[k]) at2(this.imgKeys[k], POS_KEYS);

    // Weapons: grey if seen, coloured if it has ammo, highlighted when selected
    for (let w = 0; w < 7; w++) {
      const ammo = keen.weapon[w].ammo;
      const [n1, n2] = ammo !== -1 ? digits(ammo, 2) : [0, 0];
      const y = POS_WEAPONS[1] + w * 13 + w;
      const fy = y + 3 - (w === 6 ? 1 : 0);
      let frame = -1, font = 0;
      if (keen.currentWeapon === w) { frame = w * 3 + 2; font = 10; }
      else if (ammo > 0) frame = w * 3 + 1;
      else if (ammo > -1) frame = w * 3;
      if (frame < 0) continue;
      blit(ctx, this.imgWeapons[frame], POS_WEAPONS[0], y);
      blit(ctx, this.imgFont1[n1 + font], POS_WEAPONS[0] - 13, fy);
      blit(ctx, this.imgFont1[n2 + font], POS_WEAPONS[0] - 7, fy);
    }
    if (keen.currentWeapon === 7 || keen.currentWeapon === 8) {
      blit(ctx, this.imgWeapons[keen.currentWeapon * 3 + 2], POS_WEAPONS[0] - 29, POS_WEAPONS[1] + 112);
    }

    // Power-up with remaining seconds
    if (keen.powerUp > 0) {
      const idx = (keen.powerUp - 1) * 5;
      const offset = 4 - trunc(pyround((keen.powerUpTimer / pwrTimes[keen.powerUp]) * 4));
      at2(this.imgPowerups[idx + offset], POS_POWERUPS);
      const s = String(Math.max(0, trunc(pyround(keen.powerUpTimer))));
      const [n1, n2] = s.length === 1 ? [0, Number(s[0])] : [Number(s[0]), Number(s[1])];
      at2(this.imgFont1[n1 + 10], POS_POWERUPS, 3, 20);
      at2(this.imgFont1[n2 + 10], POS_POWERUPS, 9, 20);
    }

    // Inventory
    if (keen.invCurrent > -1) {
      at2(this.imgInventory[keen.invCurrent], POS_INVENT_ICON);
      const power = keen.inventory[keen.invCurrent].power;
      const img = this.imgInventoryPwr[keen.invCurrent];
      if (power === 20) {
        at2(img, POS_INVENT_POWER);
      } else {
        const offY = Math.min(29, 7 + 19 - power);
        blitArea(ctx, img, POS_INVENT_POWER[0], POS_INVENT_POWER[1] + offY, 0, offY, 11, 29 - offY);
      }
    }
    for (let i = 0; i < 4; i++) {
      const power = keen.inventory[i].power;
      if (power === -1) continue;
      if (power === keen.invMaxPower) at2(this.imgInventoryDots[i], POS_INVENT_DOTS);
      else if (power === 0) at2(this.imgInventoryDots[i + 8], POS_INVENT_DOTS);
      else at2(this.imgInventoryDots[i + 4], POS_INVENT_DOTS);
      if (keen.invCurrent === i) at2(this.imgInventoryDots[i + 12], POS_INVENT_DOTS);
    }

    const [l1, l2] = keen.lives !== -1 ? digits(keen.lives, 2) : [0, 0];
    at2(this.imgFont1[l1], POS_LIVES);
    at2(this.imgFont1[l2], POS_LIVES, 6);

    digits(keen.score, 8).forEach((d, i) => at2(this.imgFont2[d], POS_SCORE, SCORE_X[i]));
  }
}
