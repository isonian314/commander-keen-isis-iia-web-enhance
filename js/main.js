'use strict';
// Boot, main loop and game state machine (isis.py), plus the browser shell (scaling, settings panel)

// Game clock in ms (pygame.time.get_ticks). Time spent paused is excluded so timers don't jump.
const T0 = performance.now();
let pausedTotal = 0, pauseStart = 0;
function ticks() {
  return Math.floor((pauseStart || performance.now()) - T0 - pausedTotal);
}

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let game, menu, keen, level, hud, worldMap;
let levelData = [];             // parsed TMX for the original levels
let animFrame = 0, animLastUpdate = 0;
let lastTick = 0;
let fadeBuffer = null;
let paused = false;

// ---------------------------------------------------------------------------------------------
// Boot

function decodeImage(src) {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

async function boot() {
  Settings.load();
  layout();
  const A = window.ISIS_ASSETS;
  if (!A) throw new Error('data/assets.js is missing - run web/tools/build_assets.py');
  document.getElementById('favicon').href = A.images['icon.png'];

  // Loading screen first
  Images['cutscene-loading.png'] = await decodeImage(A.images['cutscene-loading.png']);
  ctx.drawImage(Images['cutscene-loading.png'], 0, 0, DISPLAY_W, DISPLAY_H);

  const imageJobs = Object.entries(A.images).map(async ([name, src]) => { Images[name] = await decodeImage(src); });
  const fontJobs = [['Gremlins', 'gremlins.ttf'], ['SGA', 'sga.ttf'], ['SGA Round', 'sga_round.ttf']].map(async ([family, file]) => {
    try {
      const face = new FontFace(family, base64ToBytes(A.fonts[file]).buffer);
      document.fonts.add(await face.load());
    } catch (e) {
      console.warn('Font failed to load', file, e);
    }
  });
  const levelJobs = LEVEL_FILES.map((f) => parseTMX(A.levels[f]));
  await Promise.all([...imageJobs, ...fontJobs, Sound.init()]);
  levelData = await Promise.all(levelJobs);

  fontCK_SMALL = new BitmapFont(base64ToBytes(A.fonts['ck_small.fon']));
  fontCK_MEDIUM = new BitmapFont(base64ToBytes(A.fonts['ck_medium.fon']));
  fontCK_LARGE = new BitmapFont(base64ToBytes(A.fonts['ck_large.fon']));
  fontGREMLINS = new WebFont('Gremlins', 18);
  fontSGA = new WebFont('SGA', 16);
  fontSGA_ROUND = new WebFont('SGA Round', 16);

  for (const fn of Boot) fn();

  game = new Game();
  menu = new Menu();
  keen = new Keen();
  level = new Level();
  worldMap = new WorldMap();
  game.fadeTimer = game.fadeTime;

  Input.attach(window);
  initShell();
  lastTick = ticks();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------------------------
// Main loop

function frame() {
  requestAnimationFrame(frame);
  if (paused) return;
  Input.pollGamepad();
  if (performance.now() < game.waitUntil) return;
  if (game.afterWait) {
    const fn = game.afterWait;
    game.afterWait = null;
    fn();
    lastTick = ticks();
    return;
  }
  const t = ticks();
  const dtMs = t - lastTick;
  if (dtMs <= 0) return;
  lastTick = t;
  Sound.tick(dtMs);
  const dt = dtMs / 1000.0;
  const events = Input.take();

  switch (game.state) {
    case STATE_MENU: stepMenu(events, dt); break;
    case STATE_CUTSCENE: stepCutscene(events, dt); break;
    case STATE_WORLDMAP: stepWorldMap(events, dt); break;
    case STATE_LEVEL: stepLevel(events, t, dt); break;
    case STATE_FADEOUT_NEXTLEVEL:
    case STATE_FADEOUT_KILL:
    case STATE_FADEOUT_GAMEOVER: stepFade(dt); break;
    case STATE_QUIT: stepQuit(events); break;
  }
}

let pendingCustom = null;

function stepMenu(events, dt) {
  menu.active = true;
  for (const ev of events) {
    if (menu.input(ev, game, keen, App)) {
      game.state = STATE_QUIT;
      return;
    }
  }
  if (pendingCustom) {
    // New game on a custom level (Options > Load custom level)
    keen.reset();
    game.level_ID = 1;
    game.loadCutScenes(0);
    game.cutScene_ID = 0;
    game.custom = true;
    game.customLevel = pendingCustom;
    menu.active = false;
    game.fadeOut = true;
    game.fadeTimer = 0;
    pendingCustom = null;
  }
  if (menu.menuType === MENU_DISPLAYTEXT) menu.scroll(dt);
  menu.update(game);
  blit(ctx, menu.srfcCurrent, 0, 0);
  if (!menu.active) {
    game.loadCutScenes(game.level_ID);
    game.state = STATE_CUTSCENE;
  }
}

function startLevel() {
  playSound(SFX_LEVEL_START);
  level.reset();
  loadLevelData();
  level.build(game, keen);
  hud = new HUD(keen, ctx);
  game.state = STATE_LEVEL;
  keen.timeElapsed = 0.01;
  keen.moveAmountX = 0;
  keen.moveAmountY = 0;
  keen.checkPoint = false;
  playLevelMusic();
}

function stepWorldMap(events, dt) {
  for (const ev of events) {
    if (ev.actions.includes('menu')) {
      game.state = STATE_MENU;
      game.cutScene_ID = 0;
      return;
    }
    worldMap.skip();
  }
  const finished = worldMap.update(dt);
  worldMap.draw(ctx);
  if (finished) startLevel();
}

function loadingText() {
  const txt = game.custom ? 'Loading custom level...' : `Loading level ${game.level_ID}: ${game.level_names[game.level_ID - 1]}...`;
  return fontCK_MEDIUM.render(txt, 1, [255, 255, 255]);
}

function loadLevelData() {
  tmxToLevel(game.custom ? game.customLevel : levelData[game.level_ID - 1], level);
}

function playLevelMusic() {
  Sound.playMusic(game.custom ? 15 : game.level_ID - 1);
}

function stepCutscene(events, dt) {
  for (const ev of events) {
    if (ev.actions.includes('menu')) {
      game.state = STATE_MENU;
      if (game.level_ID !== 0) game.cutScene_ID = 0;
    } else if (!game.fadeOut && !game.fadeIn) {
      if (game.cutScene_ID < game.srfcCutScenes.length - 1) {
        game.cutScene_ID += 1;
      } else {
        game.fadeOut = true;
        game.fadeTimer = game.fadeTime;
      }
    } else {
      game.fadeTimer = 0;
    }
  }

  game.cutScene_ID = Math.min(game.cutScene_ID, game.srfcCutScenes.length - 1);
  const cs = game.srfcCutScenes[game.cutScene_ID];
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
  blit(ctx, cs, 0, 0);

  if (game.fadeIn) {
    cs.set_alpha(255 - 255 * (game.fadeTimer / game.fadeTime));
    game.fadeTimer -= dt;
    if (game.fadeTimer <= 0) {
      game.fadeTimer = 0;
      game.fadeIn = false;
    }
  } else if (game.fadeOut) {
    cs.set_alpha(255 * (game.fadeTimer / game.fadeTime));
    game.fadeTimer -= dt;
    if (game.fadeTimer <= 0) {
      game.fadeOut = false;
      game.fadeIn = true;
      game.fadeTimer = game.fadeTime;
      game.cutScene_ID = 0;

      if (game.level_ID > 0 && game.level_ID <= game.level.length) {
        // World map, then start the level
        if (game.custom) {
          blit(ctx, splice(320, 200, 'custom.png', 0, 0)[0], 0, 0);
          game.waitThen(2000, startLevel);
        } else {
          worldMap.start(game);
          game.state = STATE_WORLDMAP;
        }
      } else if (game.level_ID === 0) {
        game.state = STATE_MENU;
        game.level_ID += 1;
      } else if (game.level_ID > game.level.length) {
        game.state = STATE_MENU;
        game.level_ID = 1;
        keen.reset();
      }
    }
  }
}

const BULLET_SURVIVES = new Set([SPRITE_SPIDER_PROJ, SPRITE_WATER_DROP, SPRITE_ACID_DROP, SPRITE_ISONIAN_GREEN, SPRITE_ISONIAN_RED, SPRITE_ISONIAN_WHITE]);

function stepLevel(events, t, dt) {
  for (const ev of events) {
    if (ev.actions.includes('menu')) {
      musicFadeout(500);
      keen.reset();
      game.reset();
      game.custom = false;
      game.state = STATE_MENU;
    } else {
      for (const a of ev.actions) keen.checkSingleKey(a, level, game);
    }
  }

  keen.update(t, dt, level, game);

  if (t - animLastUpdate > 1000 / ANIM_FPS) {
    animFrame += 1;
    animLastUpdate = t;
    if (animFrame > 3) animFrame = 0;
  }

  if (keen.state !== kDYING) level.updateCamera(keen);

  level.sprite_AnimBG.update(animFrame, level);
  level.sprite_AnimFG.update(animFrame, level);
  level.sprite_Items.update(animFrame, level, keen, level.sprite_Floats, game);
  level.sprite_Floats.update(t, level);
  level.sprite_Projectiles.update(dt, level, level.sprite_Enemies);
  level.sprite_Explosions.update(t, dt, level, keen, game);
  level.sprite_Particles.update(t, dt, level, keen, game);
  level.sprite_Enemies.update(t, dt, level, keen);
  level.sprite_Doors.update(t, level);
  level.sprite_Exits.update(level);
  level.sprite_CheckPoints.update(level);
  level.sprite_Hurt.update(level);
  level.sprite_WeatherBG.update(t, dt, level);
  level.sprite_WeatherFG.update(t, dt, level);
  level.sprite_Platforms.update(t, level, keen);
  level.sprite_Switches.update(t, level);

  if (keen.state !== kDYING && keen.state !== kIN_DOOR) checkCollisions();

  drawLevel(dt);
}

function checkCollisions() {
  const cx = keen.x + keen.width / 2, cy = keen.y + keen.height / 2;

  if (keen.makeSplash) {
    playSound(SFX_KEEN_SPLASH);
    keen.makeSplash = false;
    const lava = grid(level.FG_TRANS, trunc((keen.x + keen.width / 2.0) / TILESIZE), trunc((keen.y + keen.height) / TILESIZE)) === 2327;
    for (let i = 0; i < 50; i++) level.sprite_Particles.add(new Particle(cx, cy, lava ? pTYPE_SPLASH_LAVA : pTYPE_SPLASH, 0, [0, 0, 255]));
  }

  for (const item of spritecollide(keen, level.sprite_Items, collideRect)) {
    if (collideMask(keen, item)) item.collected = true;
  }

  if (keen.powerUp !== pwrGOD) {
    for (const h of spritecollide(keen, level.sprite_Hurt, collideRect)) {
      if (collideMask(keen, h)) keen.hurt(h.id, game, level);
    }
  }

  const exits = spritecollide(keen, level.sprite_Exits, collideRect);
  if (exits.length > 0) {
    musicFadeout(500);
    keen.sprite = 0;
    if (!game.custom) {
      const oldLevel = game.level_ID;
      game.level_ID = exits[0].id;
      game.mapRoute = { from: oldLevel, to: game.level_ID };
      game.loadCutScenes(game.level_ID);
      game.drawStats(level, keen, oldLevel, exits[0].id);
      game.state = STATE_FADEOUT_NEXTLEVEL;
      game.fadeTimer = game.fadeTime * 2;
      playSound(SFX_LEVEL_FINISH);
      keen.checkPoint = false;
    } else {
      game.fadeTimer = game.fadeTime * 2;
      playSound(SFX_LEVEL_FINISH);
      game.state = STATE_FADEOUT_GAMEOVER;
    }
  }

  if (keen.powerUp !== pwrGOD) {
    for (const e of spritecollide(keen, level.sprite_Enemies, collideRect)) {
      // The shield blocks bullets coming from the direction Keen faces
      const facing = (keen.direction === sDIR_RIGHT && keen.x < e.x) || (keen.direction === sDIR_LEFT && keen.x > e.x);
      if (e.bullet && (keen.state === kON_GROUND || keen.state === kFALLING) && keen.invCurrent === 1 && keen.inventory[1].power >= 0 && facing) {
        keen.invShield = keen.invShieldTime;
        e.kill();
      } else if (collideMask(keen, e) && e.state !== ENEMY_STATE_DIE) {
        if (e.id === SPRITE_SPIDER && keen.onPogo && keen.vy > 0) {
          e.state = ENEMY_STATE_DIE;
          e.vx = 0;
          e.moveAmountX = 0;
          playSound(SFX_ENEMY_SPLAT);
          level.stats_NumEnemies += 1;
        } else {
          if (e.damage > 0) keen.hurt(e.damage, game, level);
          if (e.bullet && !BULLET_SURVIVES.has(e.id)) e.kill();
        }
      }
    }
  }

  for (const door of spritecollide(keen, level.sprite_Doors, collideRect)) {
    if (keen.hasKey[door.id] && door.state === DOOR_STATE_CLOSED) {
      playSound(SFX_ITEM_KEY_USE);
      door.state = DOOR_STATE_OPEN;
      keen.hasKey[door.id] = false;
    }
  }

  for (const cp of spritecollide(keen, level.sprite_CheckPoints, collideRect)) {
    if (collideMask(keen, cp) && cp.active) {
      cp.active = false;
      cp.image = srfcCheckPoints[1];
      keen.checkPoint = true;
      level.initX = keen.checkX = cp.x;
      level.initY = keen.checkY = cp.y;
    }
  }

  for (const p of spritecollide(keen, level.sprite_Platforms, collideRect)) {
    if (collideMask(keen, p)) {
      keen.vy = 0;
      keen.onPlatform = true;
      keen.state = kON_GROUND;
      keen.idleTimer = 0;
    } else if (keen.onPlatform) {
      keen.onPlatform = false;
      keen.state = kFALLING;
    } else {
      keen.onPlatform = false;
    }
  }
}

function drawKeen() {
  blit(ctx, keen.image, pyround(keen.x - level.mapX) + level.playX, pyround(keen.y - level.mapY) + level.playY);
}

function drawLevel(dt) {
  level.drawParallax(ctx);
  level.sprite_WeatherBG.draw(ctx);
  level.drawBackground(ctx);

  level.sprite_AnimBG.draw(ctx);
  level.sprite_Items.draw(ctx);
  level.sprite_Particles.draw(ctx);
  level.sprite_Enemies.draw(ctx);
  level.sprite_Projectiles.draw(ctx);
  level.sprite_Explosions.draw(ctx);
  level.sprite_Doors.draw(ctx);
  level.sprite_Platforms.draw(ctx);
  level.sprite_Switches.draw(ctx);
  level.sprite_CheckPoints.draw(ctx);

  if (keen.invCurrent === iIonScanner) {
    for (const e of level.sprite_Enemies) if (e.state !== ENEMY_STATE_DIE && !e.bullet) ionScan(ctx, e);
  }

  if (keen.state !== kDYING) drawKeen();

  level.drawForeground(ctx);
  level.sprite_AnimFG.draw(ctx);
  level.drawForegroundTrans(ctx);
  level.sprite_Floats.draw(ctx);
  level.sprite_WeatherFG.draw(ctx);

  if (level.night) {
    if (level.totalNight <= level.maxNight) level.totalNight += dt;
    game.srfcNight.set_alpha((level.totalNight / level.maxNight) * 0.4 * 255);
    blit(ctx, game.srfcNight, level.playX, level.playY);
  }

  if (keen.state === kDYING) drawKeen();

  const dbg = game.debug;
  if (!dbg.on) {
    const col = dbg.COLS[dbg.messageCol];
    if (dbg.message === DEBUG_HELLO) {
      keen.message = String(Math.round(keen.extraX * 1000) / 1000);
    } else if (dbg.message === DEBUG_STATS) {
      levelStats(level).lines.forEach((line, i) => blit(ctx, fontCK_SMALL.render(line, 1, col), level.playX + 5, level.playY + 5 + i * 10));
    }
    if (dbg.hidden) {
      level.sprite_MaskAll.update(level);
      level.sprite_MaskAll.draw(ctx);
    }
  }

  // Drawn last so it covers sprites overlapping the playfield edge
  hud.update(keen, ctx);
}

function stepFade(dt) {
  if (game.fadeTimer === game.fadeTime * 2) {
    fadeBuffer = newSurface(DISPLAY_W, DISPLAY_H);
    fadeBuffer.ctx().drawImage(canvas, 0, 0);
  }
  fadeBuffer.set_alpha(255 * (game.fadeTimer / game.fadeTime));
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
  blit(ctx, fadeBuffer, 0, 0);
  game.fadeTimer -= dt;

  if (game.fadeTimer > 0) return;
  if (game.state === STATE_FADEOUT_NEXTLEVEL) {
    game.state = STATE_CUTSCENE;
  } else if (game.state === STATE_FADEOUT_KILL) {
    // Show the world map while the level reloads (the original blocks here while loading)
    if (game.custom) {
      blit(ctx, splice(320, 200, 'custom.png', 0, 0)[0], 0, 0);
      blit(ctx, loadingText(), 5, 185);
    } else {
      worldMap.drawStill(ctx, game, loadingText());
    }
    game.waitThen(750, () => {
      level.reset();
      loadLevelData();
      level.build(game, keen);
      keen.state = kFALLING;
      game.state = STATE_LEVEL;
      keen.timeElapsed = 0.01;
      keen.moveAmountX = 0;
      keen.moveAmountY = 0;
      playLevelMusic();
    });
  } else if (game.state === STATE_FADEOUT_GAMEOVER) {
    keen.reset();
    game.reset();
    game.custom = false;
    game.state = STATE_MENU;
  }
}

// Quit from the title menu: there is no window to close, so show a farewell screen
function stepQuit(events) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
  const lines = [['Thanks for playing!', [255, 255, 255]], ['The Mystery of Isis IIa', [100, 100, 255]],
    ['Press any key to return to the menu.', [170, 170, 170]]];
  lines.forEach(([txt, col], i) => {
    const s = fontCK_MEDIUM.render(txt, 1, col);
    blit(ctx, s, (DISPLAY_W - s.get_width()) / 2, 80 + i * 16);
  });
  if (events.length) {
    game.state = STATE_MENU;
    menu.menuType = MENU_MAIN;
  }
}

// ---------------------------------------------------------------------------------------------
// Browser shell: custom levels, scaling, pause, settings panel

const App = {
  chooseCustomLevel() {
    document.getElementById('customFile').click();
  },
};

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 4000);
}

function setPaused(p) {
  if (p === paused) return;
  paused = p;
  if (p) {
    pauseStart = performance.now();
  } else {
    const now = performance.now();
    pausedTotal += now - pauseStart;
    if (game) game.waitUntil += now - pauseStart;
    pauseStart = 0;
    lastTick = ticks();
  }
  Sound.pause(p);
  Input.clear();
}

function syncPause() {
  setPaused(document.hidden || panelOpen() || !Input.inView);
}

function layout() {
  const stage = document.getElementById('stage');
  const w = stage.clientWidth, h = stage.clientHeight;
  let s = Math.min(w / DISPLAY_W, h / DISPLAY_H);
  if (Settings.scale === 'integer') s = Math.max(1, Math.floor(s));
  canvas.style.width = Math.floor(DISPLAY_W * s) + 'px';
  canvas.style.height = Math.floor(DISPLAY_H * s) + 'px';
}

function keyLabel(code) {
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '')
    .replace(/(Left|Right)$/, ' $1').replace('Control', 'Ctrl').replace(/^ /, '');
}

function initShell() {
  window.addEventListener('resize', layout);
  document.addEventListener('visibilitychange', syncPause);

  // When the page has more below the game, scrolling the game mostly out of view pauses it and hands the keys back to the page
  if (window.IntersectionObserver) {
    new IntersectionObserver(([entry]) => {
      Input.inView = entry.intersectionRatio >= 0.5;
      syncPause();
    }, { threshold: [0, 0.5, 1] }).observe(canvas);
  }

  const file = document.getElementById('customFile');
  file.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    try {
      pendingCustom = await parseTMX(await f.text());
    } catch (e) {
      toast('Could not load level: ' + e.message);
    }
  });

  const panel = document.getElementById('settings');
  const open = () => {
    renderSettings();
    panel.hidden = false;
    Input.enabled = false;
    syncPause();
  };
  const close = () => {
    panel.hidden = true;
    Input.enabled = true;
    Settings.save();
    syncPause();
    canvas.focus({ preventScroll: true });
  };
  document.getElementById('gear').addEventListener('click', () => (panel.hidden ? open() : close()));
  document.getElementById('closeSettings').addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (rebinding) return;
    if (e.code === 'Backquote' || e.code === 'F10') {
      e.preventDefault();
      panel.hidden ? open() : close();
    } else if (e.code === 'Escape' && !panel.hidden) {
      e.preventDefault();
      close();
    }
  });

  const bindRange = (id, key) => {
    const el = document.getElementById(id);
    el.value = Math.round(Settings[key] * 100);
    el.addEventListener('input', () => {
      Settings[key] = el.value / 100;
      Sound.applyVolume();
    });
  };
  bindRange('sfxVolume', 'sfxVolume');
  bindRange('musicVolume', 'musicVolume');

  const scale = document.getElementById('scale');
  scale.value = Settings.scale;
  scale.addEventListener('change', () => { Settings.scale = scale.value; layout(); });

  const dbg = document.getElementById('debugKeys');
  dbg.checked = Settings.debugKeys;
  dbg.addEventListener('change', () => { Settings.debugKeys = dbg.checked; });

  const pad = document.getElementById('gamepad');
  pad.checked = Settings.gamepad;
  pad.addEventListener('change', () => { Settings.gamepad = pad.checked; });

  document.getElementById('fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.getElementById('stage').requestFullscreen().catch(() => {});
  });
  document.addEventListener('fullscreenchange', layout);

  document.getElementById('resetKeys').addEventListener('click', () => {
    Settings.resetBindings();
    renderSettings();
  });

  canvas.focus({ preventScroll: true });
}

function panelOpen() {
  return !document.getElementById('settings').hidden;
}

let rebinding = null;

function renderSettings() {
  const table = document.getElementById('bindings');
  table.textContent = '';
  for (const [action, label] of ACTIONS) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = label;
    const td = document.createElement('td');
    for (const code of Settings.bindings[action]) {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = keyLabel(code) + ' \u00d7';
      chip.title = 'Remove';
      chip.addEventListener('click', () => {
        Settings.bindings[action] = Settings.bindings[action].filter((c) => c !== code);
        renderSettings();
      });
      td.appendChild(chip);
    }
    const add = document.createElement('button');
    add.className = 'chip add';
    add.textContent = '+';
    add.title = 'Add a key';
    add.addEventListener('click', () => {
      add.textContent = 'press a key\u2026';
      rebinding = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.removeEventListener('keydown', rebinding, true);
        rebinding = null;
        if (e.code !== 'Escape' && !['Backquote', 'F10', 'Enter', 'NumpadEnter'].includes(e.code)) {
          for (const a of Object.keys(Settings.bindings)) {
            if (a !== action) Settings.bindings[a] = Settings.bindings[a].filter((c) => c !== e.code);
          }
          if (!Settings.bindings[action].includes(e.code)) Settings.bindings[action].push(e.code);
        }
        renderSettings();
      };
      window.addEventListener('keydown', rebinding, true);
    });
    td.appendChild(add);
    tr.append(th, td);
    table.appendChild(tr);
  }
}

boot().catch((e) => {
  console.error(e);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
  ctx.fillStyle = '#f66';
  ctx.font = '10px sans-serif';
  ctx.fillText('Failed to start: ' + e.message, 6, 100);
});
