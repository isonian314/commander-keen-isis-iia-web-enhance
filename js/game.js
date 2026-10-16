'use strict';
// Game state, save data, end-of-level statistics and debug flags (isis_cutscenes.py, isis_zip.py)

const STATE_MENU = 0, STATE_LEVEL = 1, STATE_CUTSCENE = 2, STATE_FADEOUT_NEXTLEVEL = 3, STATE_FADEOUT_KILL = 4,
  STATE_FADEOUT_GAMEOVER = 5, STATE_QUIT = 6, STATE_WORLDMAP = 7;

const DEBUG_NIL = 0, DEBUG_HELLO = 1, DEBUG_STATS = 2;

// Cut-scene sheet per level id (0 = intro, 10 = ending; frame 0 of a level's sheet is replaced by the stats screen)
const CS_NAMES = ['cutscene-intro.png', 'cutscene1.png', 'cutscene2.png', 'cutscene3.png', 'cutscene4.png', 'cutscene5.png',
  'cutscene6.png', 'cutscene7.png', 'cutscene8.png', 'cutscene9.png', 'cutscene-ending.png', 'cutscene5.png', 'cutscene5.png',
  'cutscene5.png', 'cutscene5.png', 'cutscene5.png', 'cutscene5.png', 'cutscene-ending.png'];

const LEVEL_FILES = ['level1-jungle.tmx', 'level2-jungle.tmx', 'level3-mountain.tmx', 'level4-cave.tmx', 'level5-minefield.tmx',
  'level6-artillery.tmx', 'level7-hangar.tmx', 'level8-central_command.tmx', 'level9-dungeon.tmx'];

const LEVEL_NAMES = ['Jungle', 'Jungle Nights', 'Mountain', 'Cave', 'Minefield', 'Artillery Division', 'Hangar',
  'Central Command', 'Dungeon', 'Barracks', 'Missile Tower', 'Ocean Moat', 'Secret Island', 'Castle Garden',
  'Imperial Castle', 'Rooftop Showdown'];

const BACKGROUNDS = ['bg0.png', 'bg1.png', 'bg2.png', 'bg3.png', 'bg4.png', 'bg5.png', 'bg6.png', 'bg7.png'];

// ---------------------------------------------------------------------------------------------
// Save data: one record per level slot (16), stored in localStorage

const SAVE_KEY = 'isis2.save', SAVE_BACKUP_KEY = 'isis2.save.bak';

function newSaveSlot() {
  return { ranking: -1, lives: 3, health: 10, points: 0, ammo: [-1, -1, -1, -1, -1, -1, -1, -1, -1], inventory: [-1, -1, -1, -1, 0] };
}

function defaultSaveData() {
  const data = [];
  for (let i = 0; i < 16; i++) data.push(newSaveSlot());
  data[0].ranking = 0;
  return data;
}

function loadSaveData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length === 16) return data.map((d) => ({ ...newSaveSlot(), ...d }));
    }
  } catch (e) {
    console.warn('Ignoring unreadable save data', e);
  }
  return defaultSaveData();
}

function writeSaveData(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
}

// Options > Clear statistics: back up the save and start fresh
function clearSaveData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    localStorage.removeItem(SAVE_BACKUP_KEY);
    if (raw) localStorage.setItem(SAVE_BACKUP_KEY, raw);
    localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* storage unavailable */ }
  return defaultSaveData();
}

// ---------------------------------------------------------------------------------------------

let srfcStarOutline, srfcStarFilled, srfcStarShadow, srfcBoxRed, srfcBoxGreen, srfcBoxGrey, srfcInventoryProgress;

Boot.push(() => {
  srfcStarOutline = loadImage('progress_star-outline.png', 'alpha');
  srfcStarFilled = loadImage('progress_star-filled.png', 'alpha');
  srfcStarShadow = loadImage('progress_star-shadow.png', 'alpha');
  srfcBoxRed = loadImage('progress_box-red.png', 'alpha');
  srfcBoxGreen = loadImage('progress_box-green.png', 'alpha');
  srfcBoxGrey = loadImage('progress_box-grey.png', 'alpha');
  srfcInventoryProgress = splice(16, 16, 'progress_inventory.png', 1, 1);
});

class Debug {
  constructor() {
    this.COLS = [[255, 255, 255], [128, 128, 128], [0, 0, 0]];
    this.on = false;
    this.hidden = false;
    this.message = DEBUG_NIL;
    this.messageCol = 0;
    this.jump = false;
  }
}

// str(round(x, 1)) for a Python float
function pyPercent(v) {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? r.toFixed(1) : String(r);
}

// Percentages shown on the stats screen / debug overlay (100 as an int when there is nothing to collect)
function levelStats(level) {
  const pct = (n, tot) => (tot !== 0 ? Math.round((n / tot) * 1000) / 10 : 100);
  const fmt = (n, tot) => (tot !== 0 ? pyPercent((n / tot) * 100) : '100');
  return {
    items: pct(level.stats_NumItems, level.stats_NumItems_Tot),
    lines: [
      `- Items Collected: ${level.stats_NumItems}/${trunc(level.stats_NumItems_Tot)} (${fmt(level.stats_NumItems, level.stats_NumItems_Tot)}%)`,
      `- Points Scored: ${level.stats_NumPoints}/${trunc(level.stats_NumPoints_Tot)} (${fmt(level.stats_NumPoints, level.stats_NumPoints_Tot)}%)`,
      `- Enemies Killed: ${level.stats_NumEnemies}/${trunc(level.stats_NumEnemies_Tot)} (${fmt(level.stats_NumEnemies, level.stats_NumEnemies_Tot)}%)`,
    ],
  };
}

class Game {
  constructor() {
    this.level = LEVEL_FILES;
    this.level_names = LEVEL_NAMES;
    this.level_ID = 0;
    this.CSNames = CS_NAMES;
    this.srfcCutScenes = splice(320, 200, CS_NAMES[0], 0, 0);
    this.cutScene_ID = 0;
    this.state = STATE_CUTSCENE;
    this.displayWidth = DISPLAY_W;
    this.displayHeight = DISPLAY_H;
    this.backgrounds = BACKGROUNDS;
    this.srfcNight = loadImage('night.png', 'opaque').copy();
    this.srfcNight.set_alpha(0.4 * 255);
    this.fadeIn = true;
    this.fadeOut = false;
    this.fadeTime = 0.5;
    this.fadeTimer = this.fadeTime;
    this.sound = true;
    this.music = true;
    this.SAVED_DATA = loadSaveData();
    this.debug = new Debug();
    this.custom = false;
    this.customLevel = null;
    // Emulated pygame.time.wait(): the main loop holds the current frame until this time
    this.waitUntil = 0;
    this.afterWait = null;
  }

  reset() {
    this.level_ID = 1;
    this.cutScene_ID = 0;
    this.custom = false;
    this.customLevel = null;
  }

  // Options menu Sound / Music switches
  toggleSound() {
    this.sound = !this.sound;
    Sound.sfxOn = this.sound;
    Sound.applyVolume();
    if (this.sound) playSound(SFX_KEEN_SWITCH);
  }

  toggleMusic() {
    this.music = !this.music;
    if (this.music) playSound(SFX_KEEN_SWITCH);
    Sound.musicOn = this.music;
    Sound.applyVolume();
  }

  wait(ms) {
    this.waitUntil = Math.max(this.waitUntil, performance.now() + ms);
  }

  // Wait, then run fn (used where the original blocks, then loads a level)
  waitThen(ms, fn) {
    this.wait(ms);
    this.afterWait = fn;
  }

  loadCutScenes(id) {
    this.srfcCutScenes = splice(320, 200, this.CSNames[id] || this.CSNames[0], 0, 0);
  }

  // Record progress and draw the "level complete" screen over frame 0 of the next cut-scene
  drawStats(level, keen, oldLevel, nextLevel) {
    const st = levelStats(level);
    const p = st.items;
    const rating = p === 100 ? 10 : p >= 90 ? 9 : p >= 80 ? 8 : p >= 70 ? 7 : p >= 60 ? 6 : p >= 50 ? 5 : p >= 40 ? 4 : p >= 30 ? 3 : p >= 20 ? 2 : 1;

    const slot = this.SAVED_DATA[oldLevel - 1];
    slot.ranking = rating;
    slot.lives = keen.lives;
    slot.health = keen.health;
    slot.points = keen.score;
    slot.ammo = keen.weapon.slice(0, 9).map((w) => w.ammo);
    slot.inventory = keen.inventory.slice(0, 4).map((i) => i.power);
    slot.inventory.push(keen.invMaxPower);
    const next = this.SAVED_DATA[nextLevel - 1];
    if (next && next.ranking === -1) next.ranking = 0;
    writeSaveData(this.SAVED_DATA);

    const txtH1 = 'Commander Keen in...';
    const txtH2 = 'The Mystery of Isis IIa';
    const txtH3 = `Level ${oldLevel} - '${this.level_names[oldLevel - 1]}' - Complete!`;
    const STAR_SPACING = 3;
    const [wH2] = fontGREMLINS.size(txtH2);
    const [wH3] = fontCK_MEDIUM.size(txtH3);
    const [, hItem] = fontCK_MEDIUM.size(st.lines[0]);
    const wStar = srfcStarOutline.get_width(), hStar = srfcStarOutline.get_height();
    const wStars = wStar * 10 + STAR_SPACING * 9;
    const wBox = srfcBoxRed.get_width(), hBox = srfcBoxRed.get_height();
    const wBoxes = wBox * 16;

    const POS_HEAD1 = [10, 10];
    const POS_HEAD2 = [(this.displayWidth - wH2) / 2.0, 20];
    const POS_HEAD3 = [(this.displayWidth - wH3) / 2.0, 50];
    const POS_INDENT = [40, 70];
    const POS_EXTRA = 3;
    const itemY = (i) => POS_INDENT[1] + (hItem + POS_EXTRA) * i;
    const POS_LEVEL_RATING = [POS_INDENT[0], itemY(3.6)];
    const POS_STAR = [(this.displayWidth - wStars) / 2.0, POS_LEVEL_RATING[1] + 14];
    const POS_GAME_PROGRESS = [POS_HEAD1[0], POS_STAR[1] + hStar + 10];
    const POS_BOXES = [(this.displayWidth - wBoxes) / 2.0, POS_GAME_PROGRESS[1] + 11];

    const W = [255, 255, 255];
    const surf = newSurface(320, 200);
    const g = surf.ctx();
    g.fillStyle = '#000';
    g.fillRect(0, 0, 320, 200);
    blit(g, fontCK_SMALL.render(txtH1, 1, W), ...POS_HEAD1);
    blit(g, fontGREMLINS.render(txtH2, 1, [100, 100, 100]), POS_HEAD2[0] + 1, POS_HEAD2[1] + 1);
    blit(g, fontGREMLINS.render(txtH2, 1, W), ...POS_HEAD2);
    blit(g, fontCK_MEDIUM.render(txtH3, 1, [100, 100, 255]), ...POS_HEAD3);
    st.lines.forEach((line, i) => blit(g, fontCK_MEDIUM.render(line, 1, W), POS_INDENT[0], itemY(i)));
    blit(g, fontCK_MEDIUM.render('Your rating:', 1, W), ...POS_LEVEL_RATING);
    blit(g, fontCK_SMALL.render('Overall Game Progress:', 1, W), ...POS_GAME_PROGRESS);

    for (let i = 0; i < 10; i++) {
      const x = POS_STAR[0] + (wStar + STAR_SPACING) * i, y = POS_STAR[1];
      blit(g, srfcStarShadow, x + 1, y + 1);
      blit(g, i < rating ? srfcStarFilled : srfcStarOutline, x, y);
    }

    for (let i = 0; i < 16; i++) {
      const x = POS_BOXES[0] + wBox * i, y = POS_BOXES[1];
      const r = this.SAVED_DATA[i].ranking;
      const txt = String(r);
      const [tw, th] = fontCK_SMALL.size(txt);
      if (r > 0) {
        blit(g, srfcBoxGreen, x, y);
        blit(g, fontCK_SMALL.render(txt, 1, W), x + (wBox - tw) / 2.0, y + (hBox - th) / 2.0);
      } else if (i < this.level.length) {
        blit(g, srfcBoxRed, x, y);
      } else {
        blit(g, srfcBoxGrey, x, y);
      }
    }
    this.srfcCutScenes[0] = surf;
  }
}
