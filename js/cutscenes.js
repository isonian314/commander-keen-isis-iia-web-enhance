'use strict';
// Scripted cut-scenes for levels 10-16, the level 16 mid-level dialogue and the epilogue (story from design/Isis2_2010.pdf).
// The original cut-scenes are painted sheets; these are composed from existing art (parallax backgrounds, the world map,
// a strip of the level's ground tiles, character sprites) with caption text, until real cut-scene art is drawn.

// Ground strips: [top, surface, fill] tiles as [col, row] of tiles.png (the kits tools/build_levels.py uses)
const CS_GROUND = {
  base: [[12, 133], [11, 134], [11, 135]],
  rock: [[11, 53], [10, 54], [10, 55]],
  jungle: [[12, 1], [11, 2], [11, 3]],
  garden: [[12, 213], [11, 214], [11, 215]],
  castle: [[12, 178], [11, 179], [11, 180]],
};

// name: [frame width, height, sheet]
const CS_SHEETS = {
  keen: [48, 48, 'keen_sprites0-normal.png'],
  ega: [48, 48, 'keen_sprites3-ega.png'],
  robokeen: [38, 32, 'enemy_evilkeen.png'],
  shifter: [64, 64, 'enemy_shapeshifter.png'],
  yorp: [16, 24, 'enemy_yorp.png'],
  garg: [24, 32, 'enemy_garg.png'],
  isonian: [30, 40, 'enemy_isonian-green.png'],
  door: [32, 64, 'doors.png'],
  shot: [32, 32, 'enemy_evilkeen-proj.png'],
};

const CS_COLOURS = {
  Keen: [255, 255, 85], RoboKeen: [255, 85, 85], Mort: [255, 85, 255], Shapeshifter: [85, 255, 85], Isonian: [85, 255, 255],
};

// Keen sprite frames (keen.js)
const K_RUN_L = 0, K_RUN_R = 13, K_LOOK_UP = 52, K_LOOK_DOWN = 53, K_SHRUG = 55, K_SWIM_R = 119, K_STAND = 52;

const GROUND_Y = 168;

const SC = {
  barracks: { bg: 'bg8.png', ground: 'base', actors: [['keen', K_RUN_R, 120, GROUND_Y]] },
  barracksIn: { bg: 'bg8.png', ground: 'base', actors: [['keen', K_SHRUG, 150, GROUND_Y]] },
  tower: { bg: 'bg9.png', ground: 'rock', actors: [['keen', K_LOOK_UP, 140, GROUND_Y]], draw: drawGirders },
  towerTop: { bg: 'bg9.png', ground: 'base', actors: [['keen', K_LOOK_DOWN, 140, GROUND_Y]] },
  panorama: { map: ['worldmap-aftermath.png', 320, 160], actors: [['keen', K_RUN_R, 70, 128]] },
  dive: { bg: 'bg10.png', actors: [['keen', K_SWIM_R, 140, 120]] },
  secret: { bg: 'bg11.png', ground: 'jungle', actors: [['ega', K_STAND, 90, GROUND_Y], ['yorp', 0, 180, GROUND_Y], ['garg', 0, 230, GROUND_Y, true]] },
  garden: { bg: 'bg7.png', ground: 'garden', actors: [['keen', K_RUN_R, 120, GROUND_Y]] },
  castle: { bg: 'bg12.png', ground: 'castle', actors: [['keen', K_LOOK_UP, 70, GROUND_Y]], draw: drawCastle },
  faceoff: { bg: 'bg13.png', ground: 'castle', actors: [['keen', K_STAND, 60, GROUND_Y], ['robokeen', 10, 240, GROUND_Y]] },
  faceoffShoot: { bg: 'bg13.png', ground: 'castle', actors: [['keen', K_LOOK_DOWN, 60, GROUND_Y], ['robokeen', 8, 240, GROUND_Y, true], ['shot', 0, 130, GROUND_Y - 22]] },
  faceoffWide: { bg: 'bg13.png', ground: 'castle', actors: [['keen', K_RUN_R, 40, GROUND_Y], ['robokeen', 0, 270, GROUND_Y, true]] },
  robokeenDown: { bg: 'bg13.png', ground: 'castle', actors: [['keen', K_LOOK_DOWN, 120, GROUND_Y], ['robokeen', 11, 175, GROUND_Y]] },
  door314: { bg: 'bg12.png', ground: 'castle', actors: [['door', 0, 220, GROUND_Y], ['keen', K_RUN_R, 140, GROUND_Y]], draw: draw314 },
  mort: { bg: 'bg13.png', ground: 'castle', actors: [['keen', K_STAND, 80, GROUND_Y], ['shifter', 13, 230, GROUND_Y + 8, true]] },
  duel: { bg: 'bg13.png', ground: 'castle', actors: [['keen', K_RUN_R, 80, GROUND_Y], ['shifter', 20, 230, GROUND_Y + 8, true]] },
  tree: { bg: 'bg13.png', ground: 'castle', actors: [['keen', K_SHRUG, 80, GROUND_Y], ['shifter', 0, 220, GROUND_Y + 4, true]] },
  screen: { fill: '#000', draw: drawViewscreen },
  screenText: { fill: '#000', draw: (g) => drawViewscreen(g, ['PHASE 1 COMPLETE', 'Isis 2 military installations disabled.', '',
    'PHASE 2 UNDERWAY', 'Preparing interplanetary gravitational interlock.', '', 'THANK YOU', 'COMMANDER KEEN', 'HAVE A NICE DAY']) },
  end: { sheet: ['cutscene-ending.png', 1] },
};

// Each list is played in order; [scene, speaker or null for narration, text, options]
const CUTSCENE_SCRIPTS = {
  10: [
    [SC.barracks, null, 'Keen climbs out of the dungeon and slips through a side door. It closes behind him, and he finds himself in a long room full of beds.'],
    [SC.barracksIn, 'Keen', 'Nobody here... they must be out boarding the fleet!'],
  ],
  11: [
    [SC.tower, null, 'Past the barracks, Keen faces a tower of white and grey beams that goes up... and up... and up.'],
    [SC.tower, 'Keen', '(angrily) This won\'t be leaving Isis II... Ever.'],
  ],
  12: [
    [SC.towerTop, null, 'Keen reprograms the missile to self-destruct and sends a scrambling wave through the fleet\'s controls.'],
    [SC.towerTop, 'Keen', 'Well, those control modules won\'t be decrypted for a long time. This fleet and that missile aren\'t going anywhere! Now, what else did I have to do here...'],
    [SC.panorama, null, 'From the cliff, Keen sees two distant islands: one with a castle, the other with some other structure.'],
    [SC.panorama, 'Keen', 'I think I know who I\'m going to find over there. Earth isn\'t getting pushed around by the likes of you, do you hear me?'],
    [SC.panorama, null, 'DO YOU HEAR ME??!', { big: true }],
    [SC.dive, null, 'Keen dives into the Sea of Isis.'],
  ],
  13: [
    [SC.secret, null, 'Following the hints, Keen surfaces on a strange little island... and something about him looks different.'],
    [SC.secret, 'Keen', 'Yorps? Gargs? I haven\'t seen those since Vorticon VI! What are they doing out here?'],
  ],
  14: [
    [SC.garden, null, 'Keen emerges from the water and races into the castle\'s garden.'],
  ],
  15: [
    [SC.castle, null, 'Keen enters the Imperial Castle, preparing for the final showdown.'],
  ],
  16: [
    [SC.faceoff, 'RoboKeen', 'Greetings.'],
    [SC.faceoff, 'RoboKeen', 'They said you wouldn\'t make it this far.'],
    [SC.faceoff, 'RoboKeen', 'But it\'s no matter. You are obsolete. Irrelevant. And oh yes, let\'s not forget...'],
    [SC.faceoffShoot, null, '(RoboKeen fires his blaster. Keen ducks, and it only just misses him.)'],
    [SC.faceoffShoot, 'RoboKeen', 'Toast.'],
    [SC.faceoff, 'RoboKeen', 'The Teacher will be pleased. As will I...'],
    [SC.faceoff, 'RoboKeen', '...as the new Commander Keen!'],
    [SC.faceoff, 'Keen', '(gasps)'],
    [SC.faceoffWide, null, 'On the roof of the Imperial Castle, the two Keens face off.'],
  ],
  // Epilogue, after the last level
  17: [
    [SC.tree, null, 'Keen uses the Plutezarp and HR-32 on the shapeshifter, and it\'s hurt pretty bad. It shifts back to its tree form.'],
    [SC.tree, 'Keen', '(confused) Mort was a tree?? I\'m 1 IQ point dumber than a tree?!?'],
    [SC.tree, 'Shapeshifter', 'No... I took this form as it was one we knew you had encountered before.'],
    [SC.tree, 'Keen', '?'],
    [SC.tree, 'Shapeshifter', 'The people of Isis aren\'t your enemies. They are being controlled... they made me... I\'m sorry...'],
    [SC.screen, null, 'A viewscreen flickers on.'],
    [SC.screen, 'Shapeshifter', 'That... is who you are looking for.'],
    [SC.tree, 'Shapeshifter', 'Please save my people... before it\'s too late...'],
    [SC.tree, null, '(The shapeshifter passes out. Keen goes to the console and fiddles with some knobs.)'],
    [SC.screen, 'Keen', 'Come on... work...'],
    [SC.screenText, 'Keen', 'Aha! Terran translation... but... why would they have it...?'],
    [SC.screenText, null, '(Keen stares at the screen, stunned.)'],
    [SC.end, null, 'To Be Continued...', { big: true, y: 120 }],
  ],
};

// Mid-level dialogues, played when Keen reaches an exit numbered as the current level
const CUTSCENE_DIALOGUES = {
  16: [
    [SC.robokeenDown, 'RoboKeen', 'Bzzzt... it won\'t matter...'],
    [SC.robokeenDown, 'RoboKeen', 'you\'ll never stop...'],
    [SC.robokeenDown, 'RoboKeen', '...Teacher...'],
    [SC.door314, null, 'Keen heads for one more door. It has "314" emblazoned on it.'],
    [SC.mort, 'Keen', 'I knew this must have been you! I\'ve been meaning to finish this with you!'],
    [SC.mort, 'Mort', 'Welcome...'],
    [SC.mort, 'Mort', 'Mister Three Fourteen. You take out a planet almost as well as me.'],
    [SC.mort, 'Mort', 'Almost.'],
    [SC.mort, 'Keen', 'What do you want from me?'],
    [SC.mort, 'Mort', 'Isn\'t it obvious?'],
    [SC.mort, 'Keen', '(blank stare)'],
    [SC.mort, 'Mort', 'Of course not. What I want, Billy, is...'],
    [SC.duel, null, '(Mort pulls out an HR-32 and shoots. Keen pulls out his, and the two stop each other on the spot.)'],
    [SC.duel, 'Mort', 'You.'],
  ],
};

// ---------------------------------------------------------------------------------------------

const csSheetCache = {};
function csFrame(name, i) {
  const [w, h, file] = CS_SHEETS[name];
  const frames = csSheetCache[name] || (csSheetCache[name] = splice(w, h, file, 1, 1));
  return frames[Math.min(i, frames.length - 1)];
}

function wrapText(font, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (line && font.size(next)[0] > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function blitShadowed(g, font, text, x, y, colour) {
  blit(g, font.render(text, 1, [0, 0, 0]), x + 1, y + 1);
  blit(g, font.render(text, 1, colour), x, y);
}

function drawScene(g, scene) {
  g.fillStyle = scene.fill || '#000';
  g.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
  if (scene.bg) {
    // Parallax backgrounds are 640x480: show the middle at half size
    const bg = loadImage(scene.bg, 'opaque');
    g.drawImage(bg.canvas, 0, 0, bg.w, bg.h, 0, -20, DISPLAY_W, 240);
  } else if (scene.map) {
    const [file, sx, sy] = scene.map;
    const m = loadImage(file, 'opaque');
    g.drawImage(m.canvas, sx, sy, DISPLAY_W, DISPLAY_H, 0, 0, DISPLAY_W, DISPLAY_H);
  } else if (scene.sheet) {
    blit(g, splice(320, 200, scene.sheet[0], 0, 0)[scene.sheet[1]], 0, 0);
  }
  if (scene.draw) scene.draw(g);
  if (scene.ground) {
    const [top, surface, fill] = CS_GROUND[scene.ground];
    const tile = ([c, r]) => srfcTileSheet[r * 32 + c];
    for (let x = 0; x < DISPLAY_W; x += TILESIZE) {
      blit(g, tile(top), x, GROUND_Y - TILESIZE);
      blit(g, tile(surface), x, GROUND_Y);
      for (let y = GROUND_Y + TILESIZE; y < DISPLAY_H; y += TILESIZE) blit(g, tile(fill), x, y);
    }
  }
  for (const [name, frame, x, feetY, flip] of scene.actors || []) {
    let s = csFrame(name, frame);
    if (flip) s = flipH(s);
    blit(g, s, x - s.w / 2, feetY - s.h + (name === 'keen' || name === 'ega' ? 6 : 0));
  }
}

function drawCaption(g, who, text, opts) {
  if (opts.big) {
    const [w, h] = fontGREMLINS.size(text);
    blitShadowed(g, fontGREMLINS, text, (DISPLAY_W - w) / 2, opts.y || (DISPLAY_H - h) / 2 - 30, [255, 255, 255]);
    return;
  }
  const font = fontCK_MEDIUM;
  const lineH = font.size('Hg')[1] + 1;
  const lines = wrapText(font, text, DISPLAY_W - 20);
  const boxH = lines.length * lineH + (who ? lineH : 0) + 8;
  g.fillStyle = 'rgba(0, 0, 0, 0.6)';
  g.fillRect(4, 4, DISPLAY_W - 8, boxH);
  let y = 8;
  if (who) {
    blitShadowed(g, font, who + ':', 10, y, CS_COLOURS[who] || [255, 255, 255]);
    y += lineH;
  }
  for (const line of lines) {
    blitShadowed(g, font, line, 10, y, who ? [255, 255, 255] : [170, 255, 255]);
    y += lineH;
  }
}

// Frames for a script; frame 0 is left blank because the end-of-level stats screen is drawn over it
function buildScriptFrames(script) {
  const frames = [newSurface(DISPLAY_W, DISPLAY_H)];
  frames[0].ctx().fillRect(0, 0, DISPLAY_W, DISPLAY_H);
  for (const [scene, who, text, opts] of script) {
    const s = newSurface(DISPLAY_W, DISPLAY_H);
    const g = s.ctx();
    drawScene(g, scene);
    drawCaption(g, who, text, opts || {});
    frames.push(s);
  }
  return frames;
}

// ---- custom scene pieces --------------------------------------------------------------------

function drawGirders(g) {
  g.strokeStyle = '#d8d8e0';
  g.lineWidth = 2;
  for (const x of [200, 250]) {
    g.beginPath();
    g.moveTo(x, GROUND_Y);
    g.lineTo(x + (x === 200 ? 12 : -12), 0);
    g.stroke();
  }
  g.strokeStyle = '#8a8a96';
  for (let y = GROUND_Y - 20; y > 0; y -= 22) {
    const inset = (GROUND_Y - y) / GROUND_Y * 12;
    g.beginPath();
    g.moveTo(200 + inset, y);
    g.lineTo(250 - inset, y - 22);
    g.moveTo(250 - inset, y);
    g.lineTo(200 + inset, y - 22);
    g.stroke();
  }
}

function drawCastle(g) {
  const stone = srfcTileSheet[180 * 32 + 11];
  for (let x = 150; x < DISPLAY_W; x += TILESIZE) {
    for (let y = 40; y < GROUND_Y; y += TILESIZE) blit(g, stone, x, y);
  }
  for (let x = 150; x < DISPLAY_W; x += 32) {
    for (let y = 24; y < 40; y += TILESIZE) blit(g, stone, x, y);
  }
  g.fillStyle = '#000';
  g.fillRect(212, GROUND_Y - 56, 40, 56);
}

function draw314(g) {
  g.fillStyle = '#000';
  g.fillRect(200, GROUND_Y - 70, 40, 6);
  blitShadowed(g, fontCK_MEDIUM, '314', 211, GROUND_Y - 80, [255, 220, 80]);
}

function drawViewscreen(g, lines) {
  g.fillStyle = '#333344';
  g.fillRect(20, 20, 280, 170);
  g.fillStyle = '#062206';
  g.fillRect(28, 28, 264, 154);
  if (!lines) {
    g.strokeStyle = '#55ff55';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= 240; x += 6) {
      const y = 120 + (x % 12 === 0 ? -1 : 1) * (6 + ((x * 7) % 19));
      if (x === 0) g.moveTo(40 + x, y);
      else g.lineTo(40 + x, y);
    }
    g.stroke();
    const t = 'INCOMING TRANSMISSION';
    const [w] = fontSGA.size(t);
    blit(g, fontSGA.render(t, 1, [85, 255, 85]), (DISPLAY_W - w) / 2, 150);
    return;
  }
  lines.forEach((line, i) => {
    const [w] = fontCK_SMALL.size(line);
    blit(g, fontCK_SMALL.render(line, 1, [85, 255, 85]), (DISPLAY_W - w) / 2, 84 + i * 10);
  });
}
