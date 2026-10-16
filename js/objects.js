'use strict';
// Level objects: locked doors, platforms, switches, checkpoints and INFO-derived sprites
// (isis_doors.py, gcls_Mask/Hurt/Exit from isis_level.py, gcls_CheckPoint from isis_cutscenes.py)

let srfcDoors, srfcPlatforms, srfcSwitches, srfcCheckPoints, srfcMasks;

const MASK_SOLID = 0, MASK_UP_RIGHT_45 = 1, MASK_DOWN_RIGHT_45 = 2, MASK_UP_RIGHT_30_1 = 3, MASK_UP_RIGHT_30_2 = 4,
  MASK_DOWN_RIGHT_30_1 = 5, MASK_DOWN_RIGHT_30_2 = 6, MASK_ONE_WAY_UP = 7, MASK_ONE_WAY_DOWN = 8,
  MASK_ONE_WAY_LEFT = 9, MASK_ONE_WAY_RIGHT = 10;

Boot.push(() => {
  srfcDoors = splice(32, 64, 'doors.png', 1, 1);
  srfcPlatforms = splice(43, 32, 'platforms.png', 1, 1);
  srfcSwitches = splice(16, 16, 'switches.png', 1, 1);
  srfcCheckPoints = splice(16, 16, 'checkpoints.png', 1, 1);
  srfcMasks = splice(16, 16, 'tiles_masks.png', 0, 1);
});

// Sprites placed on a single tile; rect is in level coordinates until update() maps it to the screen
class TileSprite extends Sprite {
  constructor(x, y, id, image) {
    super();
    this.x = x * TILESIZE;
    this.y = y * TILESIZE;
    this.id = id;
    this.image = image;
    this.rect = new Rect(pyround(this.x), pyround(this.y), TILESIZE, TILESIZE);
  }

  update(level) {
    this.rect = new Rect(pyround(this.x - level.mapX) + level.playX, pyround(this.y - level.mapY) + level.playY, TILESIZE, TILESIZE);
  }
}

// Solid/slope overlay, shown with the "hidden areas" debug key. The alpha is set on the
// shared mask image, as in the original.
class MaskTile extends TileSprite {
  constructor(x, y, id) {
    super(x, y, id, srfcMasks[id]);
    this.image.set_alpha(0.5 * 255);
  }
}

class HurtTile extends TileSprite {
  constructor(x, y, id) {
    super(x, y, id, srfcMasks[0]);
  }
}

class ExitTile extends TileSprite {
  constructor(x, y, id) {
    super(x, y, id, srfcMasks[0]);
    this.image.set_alpha(0.5 * 255);
  }
}

class CheckPoint extends TileSprite {
  constructor(x, y) {
    super(x, y, 0, srfcCheckPoints[0]);
    this.active = true;
  }
}

// Door/teleporter pair: both ends are recorded while scanning the INFO layer
class DoorLink {
  constructor(id, x, y) {
    this.id = id;
    this.x1 = x;
    this.y1 = y;
    this.x2 = 0;
    this.y2 = 0;
  }

  update(x2, y2) {
    this.x2 = x2;
    this.y2 = y2;
  }
}

class EnemyTele {
  constructor(x, y) {
    this.x = x * TILESIZE;
    this.y = y * TILESIZE;
  }
}

// Locked door (opened with a key of the same colour)
class Door extends Sprite {
  constructor(x, y, id) {
    super();
    this.x = x * TILESIZE;
    this.y = y * TILESIZE;
    this.tileX = x;
    this.tileY = y;
    this.id = id;
    this.image = srfcDoors[id];
    this.width = this.image.get_width();
    this.height = this.image.get_height();
    this.rect = new Rect(pyround(this.x), pyround(this.y), this.width, this.height);
    this.state = DOOR_STATE_CLOSED;
    this.openSpeed = DOOR_OPEN_SPEED;
    this.timeElapsed = 0;
    this.oldTime = ticks();
    this.switchNum = 0;
  }

  update(t, level) {
    if (this.state === DOOR_STATE_OPEN) {
      this.timeElapsed = (t - this.oldTime) / 1000.0;
      if (this.tileY * TILESIZE - this.y > this.height - 16) {
        // Fully open: clear the solid INFO tiles and their masks
        for (let dy = 0; dy <= 2; dy++) setInfo(level, this.tileX, this.tileY + dy, 0);
        this.state = DOOR_STATE_FINISHED;
        for (const mask of level.sprite_MaskAll) {
          const mx = mask.x / TILESIZE, my = mask.y / TILESIZE;
          if (mx === this.tileX && my >= this.tileY && my <= this.tileY + 2) mask.kill();
        }
      } else {
        this.y -= this.openSpeed * this.timeElapsed;
      }
    }
    this.oldTime = t;
    this.rect = new Rect(pyround(this.x - level.mapX) + level.playX, pyround(this.y - level.mapY) + level.playY, this.width, this.height);
  }
}

// Moving platform, steered by direction tiles and optionally enabled by a switch
const PLATFORM_FRAMES = { [SPRITE_PLATFORM_1]: 11, [SPRITE_PLATFORM_2]: 1, [SPRITE_PLATFORM_3]: 6 };

class Platform extends Sprite {
  constructor(x, y, id, switchNum) {
    super();
    this.x = x * TILESIZE;
    this.y = y * TILESIZE;
    this.id = id;
    this.switchNum = switchNum;
    this.frame = 0;
    this.maxFrames = 4;
    this.FPS = 1000 / 8.0;
    this.timeElapsed = 0.1;
    this.oldTime = ticks();
    this.last_update = ticks();
    this.vx = 0;
    this.vy = 0;
    this.speed = 50;
    this.initFrame = PLATFORM_FRAMES[id];
    this.image = srfcPlatforms[this.initFrame];
    // The collision mask comes from the preceding frame of the sheet, as in the original
    this.mask = maskOf(srfcPlatforms[this.initFrame - 1]);
    this.width = this.image.get_width();
    this.height = this.image.get_height();
    this.rect = new Rect(pyround(this.x), pyround(this.y), this.width, this.height);
    this.active = switchNum === 0;
  }

  update(t, level, keen) {
    this.timeElapsed = (t - this.oldTime) / 1000.0;
    this.oldTime = t;
    if (this.active) {
      if (t - this.last_update > this.FPS) {
        this.frame += 1;
        if (this.frame >= this.maxFrames) this.frame = 0;
        this.image = srfcPlatforms[this.initFrame + this.frame];
        this.last_update = t;
      }
      const moveX = this.timeElapsed * this.speed * this.vx;
      const moveY = this.timeElapsed * this.speed * this.vy;
      this.x += moveX;
      this.y += moveY;

      // Carry Keen along
      if (keen.onPlatform && collideMask(this, keen)) {
        keen.x += moveX;
        keen.y += moveY;
        keen.rect = new Rect(keen.x - level.mapX + level.playX, keen.y - level.mapY + level.playY, 48, 48);
        keen.updateSubRect();
        level.updateCamera(keen);
      }

      this.rect = new Rect(pyround(this.x), pyround(this.y), this.width, this.height);
      for (const tile of spritecollide(this, level.sprite_PlatformDirections, collideRect)) {
        this.vx = tile.vx;
        this.vy = tile.vy;
      }
    }
    this.rect = new Rect(pyround(this.x - level.mapX) + level.playX, pyround(this.y - level.mapY) + level.playY, this.width, this.height);
  }
}

const PLATFORM_DIRECTIONS = {
  [INFO_PLATFORM_UP]: [0, -1], [INFO_PLATFORM_DOWN]: [0, 1], [INFO_PLATFORM_RIGHT]: [1, 0], [INFO_PLATFORM_LEFT]: [-1, 0],
  [INFO_PLATFORM_UP_RIGHT]: [1, -1], [INFO_PLATFORM_DOWN_LEFT]: [-1, 1], [INFO_PLATFORM_UP_LEFT]: [-1, -1],
  [INFO_PLATFORM_DOWN_RIGHT]: [1, 1],
};

class PlatformDirection extends Sprite {
  constructor(x, y, id) {
    super();
    this.x = x * TILESIZE;
    this.y = y * TILESIZE;
    this.id = id;
    this.width = this.height = TILESIZE;
    this.rect = new Rect(pyround(this.x), pyround(this.y), TILESIZE, TILESIZE);
    [this.vx, this.vy] = PLATFORM_DIRECTIONS[id] || [undefined, undefined];
  }
}

const SWITCH_FRAMES = { [SPRITE_SWITCH_1]: 0, [SPRITE_SWITCH_2]: 2, [SPRITE_SWITCH_3]: 4 };

class Switch extends Sprite {
  constructor(x, y, id, switchNum) {
    super();
    this.x = x * TILESIZE + 8;
    this.y = y * TILESIZE;
    this.id = id;
    this.switchNum = switchNum;
    this.state = DOOR_STATE_CLOSED;
    this.frame = SWITCH_FRAMES[id];
    this.onFrame = 0;
    this.image = srfcSwitches[this.frame];
    this.width = this.image.get_width();
    this.height = this.image.get_height();
    this.rect = new Rect(pyround(this.x), pyround(this.y), this.width, this.height);
  }

  update(t, level) {
    this.onFrame = this.state === DOOR_STATE_CLOSED ? 0 : 1;
    this.image = srfcSwitches[this.frame + this.onFrame];
    this.rect = new Rect(pyround(this.x - level.mapX) + level.playX, pyround(this.y - level.mapY) + level.playY, this.width, this.height);
  }
}
