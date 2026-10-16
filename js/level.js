'use strict';
// Level state, construction from the TMX layers, camera and tile rendering (isis_level.py)

let srfcTileSheet, tileEmpty;

// Tiles are drawn colour keyed. Instead of pre-rendering whole-level surfaces like the original,
// visible tiles are drawn each frame; fully transparent tiles are skipped.
Boot.push(() => {
  srfcTileSheet = splice(TILESIZE, TILESIZE, 'tiles.png', 0, 1);
  const m = getMaster('tiles.png', 'key').canvas;
  const px = m.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, m.width, m.height).data;
  tileEmpty = new Uint8Array(srfcTileSheet.length);
  srfcTileSheet.forEach((t, i) => {
    let empty = 1;
    for (let y = 0; y < TILESIZE && empty; y++) {
      for (let x = 0, o = ((t.sy + y) * m.width + t.sx) * 4 + 3; x < TILESIZE; x++, o += 4) {
        if (px[o]) { empty = 0; break; }
      }
    }
    tileEmpty[i] = empty;
  });
});

const POINTS_TOTALS = { [ITEM_COLA]: 200, [ITEM_BURGER]: 500, [ITEM_GINGER]: 1000, [ITEM_SUGAR]: 2000, [ITEM_CEREAL]: 5000 };

// Sprite layer id -> enemy class
const ENEMY_SPAWN = new Map([
  ...[SPRITE_FOOG, SPRITE_FOOGJUMP, SPRITE_FROG_WALK, SPRITE_FROG_SWIM, SPRITE_HOLEMONSTER, SPRITE_BLUEMOUTH, SPRITE_GARNAK,
    SPRITE_YELLOW, SPRITE_PLANTGUY, SPRITE_REDFISH, SPRITE_CHOMPERFISH, SPRITE_URCHIN, SPRITE_FLOPPY, SPRITE_YELLOWFISH,
    SPRITE_GREENFISH, SPRITE_BLUEFISH, SPRITE_MINE, SPRITE_TRUCKGUY1, SPRITE_TRUCKGUY2, SPRITE_CATERPILLAR, SPRITE_SNAIL,
    SPRITE_BIGFROG, SPRITE_DRAGONFLY, SPRITE_BIRD, SPRITE_FOOG_WARRIOR, SPRITE_ISONIAN_GIANT1, SPRITE_ISONIAN_GIANT2,
    SPRITE_ISONIAN_FLY, SPRITE_YORPY, SPRITE_GARG].map((id) => [id, EnemyWalker]),
  ...[SPRITE_SPIDER, SPRITE_DEMON, SPRITE_RAT, SPRITE_LEMMING, SPRITE_TRUCKGUY1_WALK, SPRITE_TRUCKGUY2_WALK,
    SPRITE_ROBOT_GREY, SPRITE_ROBOT_RED, SPRITE_ROBOT_FLASHER, SPRITE_ROBOT_HOVER, SPRITE_SLUG].map((id) => [id, EnemyShooter]),
  ...[SPRITE_ROCK_GREY, SPRITE_ROCK_MOSS, SPRITE_ROCK_BROWN].map((id) => [id, EnemyRock]),
  ...[SPRITE_ISONIAN_GREEN, SPRITE_ISONIAN_RED, SPRITE_ISONIAN_WHITE].map((id) => [id, EnemyIsonian]),
  [SPRITE_TELETURRET, EnemyTeleTurret],
  [SPRITE_SHAPESHIFTER, EnemyShapeShifter],
  [SPRITE_EVILKEEN, EnemyEvilKeen],
  [SPRITE_WATER_DROP, EnemyDrop],
  [SPRITE_ACID_DROP, EnemyDrop],
]);
const ORIGINAL_ONLY = new Set([SPRITE_SHAPESHIFTER, SPRITE_EVILKEEN, SPRITE_HR42, SPRITE_PLUTEZARP]);

// Sprite layer id -> item id, for the contiguous item ranges
function spriteToItem(s) {
  const ranges = [
    [SPRITE_KEY_RED, 6, ITEM_KEY_RED], [SPRITE_JBEAN_RED, 6, ITEM_JBEAN_RED], [SPRITE_COLA, 5, ITEM_COLA],
    [SPRITE_PYAPA_FRUIT, 6, ITEM_PYAPA_FRUIT], [SPRITE_SHOES, 7, ITEM_SHOES], [SPRITE_BATTERY, 4, ITEM_BATTERY],
    [SPRITE_BLOWGUN, 9, ITEM_BLOWGUN],
  ];
  for (const [first, n, item] of ranges) if (s >= first && s < first + n) return item + (s - first);
  return -1;
}

const INFO_MASKS = {
  [INFO_SOLID]: MASK_SOLID, [INFO_SOLID_NO_GRAB]: MASK_SOLID, [INFO_UP_RIGHT_45]: MASK_UP_RIGHT_45,
  [INFO_DOWN_RIGHT_45]: MASK_DOWN_RIGHT_45, [INFO_UP_RIGHT_30_1]: MASK_UP_RIGHT_30_1, [INFO_UP_RIGHT_30_2]: MASK_UP_RIGHT_30_2,
  [INFO_DOWN_RIGHT_30_1]: MASK_DOWN_RIGHT_30_1, [INFO_DOWN_RIGHT_30_2]: MASK_DOWN_RIGHT_30_2,
  [INFO_SOLID_FROM_TOP]: MASK_ONE_WAY_UP, [INFO_SOLID_FROM_BOTTOM]: MASK_ONE_WAY_DOWN,
  [INFO_SOLID_FROM_LEFT]: MASK_ONE_WAY_LEFT, [INFO_SOLID_FROM_RIGHT]: MASK_ONE_WAY_RIGHT,
};
const INFO_HURT = {
  [INFO_HURT_1]: 1, [INFO_HURT_1w]: 1, [INFO_HURT_2]: 2, [INFO_HURT_2w]: 2, [INFO_HURT_5]: 5, [INFO_HURT_5w]: 5,
  [INFO_DIE]: 10, [INFO_DIEw]: 10,
};

const GROUPS = ['sprite_MaskAll', 'sprite_AnimBG', 'sprite_AnimFG', 'sprite_Items', 'sprite_Floats', 'sprite_Projectiles',
  'sprite_Explosions', 'sprite_Particles', 'sprite_Enemies', 'sprite_Doors', 'sprite_Exits', 'sprite_Hurt',
  'sprite_WeatherBG', 'sprite_WeatherFG', 'sprite_Platforms', 'sprite_PlatformDirections', 'sprite_Switches',
  'sprite_CheckPoints'];

class Level {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.background_ID = 0;
    this.music_ID = 0;
    this.night = false;
    this.initX = 0;
    this.initY = 0;
    this.initDirection = 0;
    this.initWater = false;
    this.mapX = 0;
    this.mapY = 0;
    this.playX = 4;
    this.playY = 4;
    this.playWidth = 256;
    this.playHeight = 192;
    this.bgX = 0;
    this.bgY = 0;
    this.bgMoveX = 0;
    this.bgMoveY = 0;
    for (const g of GROUPS) this[g] = new Group();
    this.maxNight = 60 * 10.0;
    this.reset();
  }

  reset() {
    for (const k of ['BG_TRANS', 'BG1', 'BG2', 'FG1', 'FG2', 'FG_TRANS', 'INFO', 'SPRITES']) this[k] = [];
    this.DoorList = [];
    this.TeleList = [];
    this.EnemyTeleList = [];
    this.night = false;
    this.srfcPBG = null;
    this.bgHidden = [];
    this.fgHidden = [];
    this.initX = 0;
    this.initY = 0;
    this.initDirection = 0;
    this.initWater = false;
    this.stats_NumItems = 0;
    this.stats_NumItems_Tot = 0.0;
    this.stats_NumPoints = 0;
    this.stats_NumPoints_Tot = 0.0;
    this.stats_NumEnemies = 0;
    this.stats_NumEnemies_Tot = 0.0;
    for (const g of GROUPS) this[g].empty();
    this.totalNight = 0;
  }

  // Build sprites and tile state from the loaded layers (gcls_Level.update)
  build(game, keen) {
    const W = this.width, H = this.height;
    const fixTile = (t) => (t === 0 || t > MAXTILES ? 1 : t);
    this.bgHidden = [];
    this.fgHidden = [];

    for (let x = 0; x < W; x++) {
      this.bgHidden.push(new Uint8Array(H));
      this.fgHidden.push(new Uint8Array(H));
      for (let y = 0; y < H; y++) {
        // Animated tiles become sprites; when on layer 1 the static tiles underneath are blanked
        for (let i = 0; i < ANIMATED_TILES.length; i++) {
          const anim = ANIMATED_TILES[i];
          if (this.BG1[x][y] === anim || this.BG2[x][y] === anim) {
            this.sprite_AnimBG.add(new AnimTile(x, y, i));
            if (this.BG1[x][y] === anim) this.bgHidden[x][y] = 1;
          }
          if (this.FG1[x][y] === anim || this.FG2[x][y] === anim) {
            this.sprite_AnimFG.add(new AnimTile(x, y, i));
            if (this.FG1[x][y] === anim) this.fgHidden[x][y] = 1;
          }
        }
        for (const k of ['BG_TRANS', 'BG1', 'BG2', 'FG1', 'FG2', 'FG_TRANS']) this[k][x][y] = fixTile(this[k][x][y]);

        const testSprite = this.SPRITES[x][y];
        const testInfo = this.INFO[x][y];
        let switchNum = 0;
        let tempDir = trunc(pyround(rand() * 1)) === 0 ? -1 : 1;

        if (testInfo !== 0) {
          if (testInfo in INFO_MASKS) {
            this.sprite_MaskAll.add(new MaskTile(x, y, INFO_MASKS[testInfo]));
          } else if (testInfo >= INFO_EXIT_1 && testInfo <= INFO_EXIT_1 + 10) {
            this.sprite_Exits.add(new ExitTile(x, y, testInfo - INFO_EXIT_1 + 1));
          } else if ((testInfo >= INFO_DOOR_1 && testInfo <= INFO_DOOR_1 + 15) || (testInfo >= INFO_TELE_1 && testInfo <= INFO_TELE_1 + 15)) {
            // Doors and teleporters share the list; ids are offset from the first door id
            const doorNum = testInfo - INFO_DOOR_1 + 1;
            let found = false;
            for (const door of this.DoorList) {
              if (door.id === doorNum) {
                found = true;
                door.update(x, y);
              }
            }
            if (!found) this.DoorList.push(new DoorLink(doorNum, x, y));
          } else if (testInfo >= INFO_PLATFORM_UP && testInfo <= INFO_PLATFORM_DOWN_RIGHT) {
            this.sprite_PlatformDirections.add(new PlatformDirection(x, y, testInfo));
          } else if (testInfo >= INFO_PLATFORM_1 && testInfo <= INFO_PLATFORM_8) {
            switchNum = testInfo - INFO_PLATFORM_1 + 1;
          } else if (testInfo in INFO_HURT) {
            this.sprite_Hurt.add(new HurtTile(x, y, INFO_HURT[testInfo]));
          } else if (testInfo === INFO_ENEMY_LEFT) {
            tempDir = -1;
          } else if (testInfo === INFO_ENEMY_RIGHT) {
            tempDir = 1;
          } else if (testInfo === INFO_ENEMY_TELE) {
            this.EnemyTeleList.push(new EnemyTele(x, y));
          }
        }

        if (testSprite !== 0) this.spawn(testSprite, x, y, tempDir, switchNum, game, keen);
      }
    }

    if (keen.health <= 0) keen.health = 1;

    keen.x = this.initX;
    keen.y = this.initY;
    keen.rect = new Rect(keen.x - this.mapX + this.playX, keen.y - this.mapY + this.playY, 48, 48);
    keen.direction = this.initDirection;
    keen.timeElapsed = 0.1;
    keen.state = this.initWater ? kIN_WATER : kFALLING;

    // Parallax background
    this.srfcPBG = loadImage(game.backgrounds[this.background_ID] || game.backgrounds[0], 'opaque');
    this.bgMoveX = (this.srfcPBG.get_width() - this.playWidth) / (W * TILESIZE);
    this.bgMoveY = (this.srfcPBG.get_height() - this.playHeight) / (H * TILESIZE);

    this.mapY = keen.y - this.playHeight / 2;
  }

  spawn(s, x, y, dir, switchNum, game, keen) {
    // Keen start position (or the last checkpoint)
    if (!keen.checkPoint) {
      if (s === SPRITE_KEEN_LEFT || s === SPRITE_KEEN_RIGHT || s === SPRITE_KEEN_LEFT_WATER || s === SPRITE_KEEN_RIGHT_WATER) {
        this.initX = x * TILESIZE;
        this.initY = y * TILESIZE;
        this.initDirection = s === SPRITE_KEEN_LEFT || s === SPRITE_KEEN_LEFT_WATER ? -1 : 1;
        if (s === SPRITE_KEEN_LEFT_WATER || s === SPRITE_KEEN_RIGHT_WATER) this.initWater = true;
      }
    } else {
      this.initX = keen.checkX;
      this.initY = keen.checkY;
      this.initDirection = 1;
    }

    const item = spriteToItem(s);
    const custom = game.custom && ORIGINAL_ONLY.has(s);
    if (s === SPRITE_HEALTH1) keen.health -= 1;
    else if (s === SPRITE_HEALTH2) keen.health -= 2;
    else if (s === SPRITE_HEALTH5) keen.health -= 5;
    else if (s === SPRITE_EGA) keen.sprite = kSPRITE_EGA;
    else if (s >= SPRITE_BG && s < SPRITE_BG + 10) this.background_ID = s - SPRITE_BG;
    else if (s >= SPRITE_MUSIC && s < SPRITE_MUSIC + 10) this.music_ID = s - SPRITE_MUSIC;
    else if (s === SPRITE_NIGHT) this.night = true;
    else if (s === SPRITE_RAIN || s === SPRITE_SNOW) {
      for (let i = 0; i < 40; i++) this.sprite_WeatherBG.add(new Weather(s === SPRITE_RAIN ? weatherRAIN : weatherSNOW, y));
    } else if (s === SPRITE_CLOUD) {
      this.sprite_WeatherFG.add(new Weather(weatherCLOUDS1, y + 2));
      this.sprite_WeatherFG.add(new Weather(weatherCLOUDS2, y + 2));
    } else if (s === SPRITE_LIGHTNING) {
      this.sprite_WeatherBG.add(new Weather(weatherLIGHTNING, y));
    } else if (s >= SPRITE_DOOR_RED && s <= SPRITE_DOOR_RED + 5) {
      this.sprite_Doors.add(new Door(x, y, s - SPRITE_DOOR_RED));
    } else if (s >= SPRITE_PLATFORM_1 && s <= SPRITE_PLATFORM_3) {
      this.sprite_Platforms.add(new Platform(x, y, s, switchNum));
    } else if (s >= SPRITE_SWITCH_1 && s <= SPRITE_SWITCH_3) {
      this.sprite_Switches.add(new Switch(x, y, s, switchNum));
    } else if (item >= 0 && !custom) {
      this.sprite_Items.add(new Item(x, y, item));
      if (item >= ITEM_JBEAN_RED && item <= ITEM_JBEAN_PURPLE) this.stats_NumPoints_Tot += 100;
      else if (item in POINTS_TOTALS) this.stats_NumPoints_Tot += POINTS_TOTALS[item];
    } else if (ENEMY_SPAWN.has(s) && !custom) {
      const Cls = ENEMY_SPAWN.get(s);
      this.sprite_Enemies.add(new Cls(x, y, s, s === SPRITE_RAT ? 1 : dir));
    } else if (s === SPRITE_CHECKPOINT) {
      this.sprite_CheckPoints.add(new CheckPoint(x, y));
    }

    if (gfn_IsEnemy(s)) this.stats_NumEnemies_Tot += 1;
    if (gfn_IsItem(s)) this.stats_NumItems_Tot += 1;
  }

  // Snap the camera straight to Keen (new level, doors). The vertical clamp in the original
  // assigns to an unused variable, so it has no effect; that is preserved.
  snapCamera(keen) {
    let midX = keen.x + keen.width / 2.0 - this.playWidth / 2;
    if (midX < 0) midX = 0;
    if (midX > this.width * TILESIZE - this.playWidth) midX = this.width * TILESIZE - this.playWidth;
    const midY = keen.y - this.playHeight / 2 + trunc(keen.lookOffsetY);

    if (keen.y - TILESIZE + trunc(keen.lookOffsetY) <= 0) {
      this.mapY = 0;
    } else if (keen.y + keen.height + TILESIZE * 2 + trunc(keen.lookOffsetY) >= this.height * TILESIZE) {
      this.mapY = this.height * TILESIZE - this.playHeight - 1;
    } else {
      this.mapX = midX;
      this.mapY = midY;
    }
  }

  updateCamera(keen) {
    if (keen.state === kON_LEDGE) return;

    // Horizontal: Keen can move within a central window before the camera scrolls
    const tileBuffer = 6.5 * TILESIZE;
    const kx = keen.x + keen.width / 2.0 + trunc(keen.lookOffsetX);
    if (kx - this.mapX < tileBuffer) this.mapX = kx - tileBuffer;
    else if (this.mapX + this.playWidth - kx < tileBuffer) this.mapX = kx + tileBuffer - this.playWidth;
    if (this.mapX < 0) this.mapX = 0;
    else if (this.mapX > this.width * TILESIZE - this.playWidth) this.mapX = this.width * TILESIZE - this.playWidth;

    // Vertical
    const cameraVy = 150;
    let middle = keen.y - this.playHeight / 2 + trunc(keen.lookOffsetY);
    if (middle < 0) middle = 0;
    if (middle > this.height * TILESIZE - this.playHeight) middle = this.height * TILESIZE - this.playHeight;

    if (keen.y - TILESIZE + trunc(keen.lookOffsetY) <= 0) {
      this.mapY = 0;
    } else if (keen.y + keen.height + TILESIZE * 2 + trunc(keen.lookOffsetY) >= this.height * TILESIZE) {
      this.mapY = this.height * TILESIZE - this.playHeight - 1;
    } else if (keen.state === kON_GROUND || keen.state === kIN_WATER || keen.state === kON_POLE || keen.state === kON_LEDGE) {
      if (this.mapY > middle) {
        this.mapY -= keen.timeElapsed * cameraVy;
        if (this.mapY < middle) this.mapY = middle;
      } else if (this.mapY < middle) {
        this.mapY += keen.timeElapsed * cameraVy;
        if (this.mapY > middle) this.mapY = middle;
      }
    } else if (keen.state === kFALLING) {
      if (keen.y + keen.height + TILESIZE * 2 > this.mapY + this.playHeight) {
        this.mapY = keen.y + keen.height + TILESIZE * 2 - this.playHeight;
      } else if (keen.y - TILESIZE < this.mapY) {
        this.mapY = keen.y - TILESIZE;
      }
      if (keen.lookOffsetY !== 0) keen.lookOffsetY += this.mapY - middle;
    }

    this.bgX = pyround(this.mapX * this.bgMoveX);
    this.bgY = pyround(this.mapY * this.bgMoveY);
    this.mapX = pyround(this.mapX);
    this.mapY = pyround(this.mapY);
  }

  // ---- Rendering --------------------------------------------------------------------------

  clip(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.playX, this.playY, this.playWidth, this.playHeight);
    ctx.clip();
  }

  // Draw tile layers (in order) for the visible part of the level
  drawTiles(ctx, layers, hidden, alpha) {
    const ox = pyround(this.mapX), oy = pyround(this.mapY);
    const x0 = Math.max(0, Math.floor(ox / TILESIZE)), y0 = Math.max(0, Math.floor(oy / TILESIZE));
    const x1 = Math.min(this.width - 1, Math.floor((ox + this.playWidth - 1) / TILESIZE));
    const y1 = Math.min(this.height - 1, Math.floor((oy + this.playHeight - 1) / TILESIZE));
    const sheet = srfcTileSheet[0].canvas;
    ctx.globalAlpha = alpha;
    for (let x = x0; x <= x1; x++) {
      const dx = this.playX + x * TILESIZE - ox;
      for (let y = y0; y <= y1; y++) {
        const dy = this.playY + y * TILESIZE - oy;
        for (const layer of layers) {
          const t = hidden && hidden[x][y] ? 1 : layer[x][y];
          if (tileEmpty[t - 1]) continue;
          const s = srfcTileSheet[t - 1];
          if (s) ctx.drawImage(sheet, s.sx, s.sy, TILESIZE, TILESIZE, dx, dy, TILESIZE, TILESIZE);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  drawParallax(ctx) {
    const bg = this.srfcPBG;
    if (bg) blitArea(ctx, bg, this.playX, this.playY, pyround(this.bgX), pyround(this.bgY), this.playWidth, this.playHeight);
  }

  drawBackground(ctx) {
    this.clip(ctx);
    this.drawTiles(ctx, [this.BG_TRANS], null, 127 / 255);
    this.drawTiles(ctx, [this.BG1, this.BG2], this.bgHidden, 1);
    ctx.restore();
  }

  drawForeground(ctx) {
    this.clip(ctx);
    this.drawTiles(ctx, [this.FG1, this.FG2], this.fgHidden, 1);
    ctx.restore();
  }

  drawForegroundTrans(ctx) {
    this.clip(ctx);
    this.drawTiles(ctx, [this.FG_TRANS], null, 127 / 255);
    ctx.restore();
  }
}
