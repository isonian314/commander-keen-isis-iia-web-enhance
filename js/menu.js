'use strict';
// Title menu: New game, Load level, Options, Quit; Help screens (isis_menu.py)

const MENU_MAIN = 0, MENU_HELP = 1, MENU_DISPLAYTEXT = 2, MENU_LOAD = 3, MENU_OPTIONS = 4;
const HELP_TEXT_NAMES = ['menu_controls.png', 'menu_story.png', 'menu_isis.png', 'menu_items.png', 'menu_history.png'];

class Menu {
  constructor() {
    this.menuType = MENU_MAIN;
    this.menuIndex = 0;
    this.menuIndexMax = 3;
    this.menuHelpIndex = 0;
    this.menuHelpIndexMax = 4;
    this.menuHelpTextY = 0;
    this.menuOptionsIndex = 0;
    this.menuOptionsMax = 3;
    this.moveSpeed = 100;
    this.active = true;
    this.menuLoadIndex = 0;
    this.menuLoadMax = 15;

    this.srfcBlank = loadImage('menu_blank.png', 'opaque');
    this.srfcMain = splice(320, 200, 'menu_main.png', 0, 0);
    this.srfcHelp = splice(320, 200, 'menu_help.png', 0, 0);
    this.srfcHelpText = null;
    this.srfcHelpTitles = splice(188, 18, 'menu_help_titles.png', 0, 0);
    this.srfcOptions = splice(320, 200, 'menu_options.png', 0, 0);
    this.srfcOnOff = splice(52, 10, 'menu_onoff.png', 0, 1);

    this.srfcCurrent = newSurface(320, 200);
    this.g = this.srfcCurrent.ctx();
    blit(this.g, this.srfcMain[0], 0, 0);
  }

  update(game) {
    const g = this.g;
    if (this.menuType === MENU_MAIN) {
      blit(g, this.srfcMain[this.menuIndex], 0, 0);
    } else if (this.menuType === MENU_HELP) {
      blit(g, this.srfcHelp[this.menuHelpIndex], 0, 0);
    } else if (this.menuType === MENU_OPTIONS) {
      blit(g, this.srfcOptions[this.menuOptionsIndex], 0, 0);
      blit(g, this.srfcOnOff[game.sound ? 0 : 1], 172, 84);
      blit(g, this.srfcOnOff[game.music ? 0 : 1], 172, 102);
    } else if (this.menuType === MENU_DISPLAYTEXT) {
      blit(g, this.srfcBlank, 0, 0);
      blitArea(g, this.srfcHelpText, 0, 58, 0, this.menuHelpTextY, 320, 84);
      blit(g, this.srfcHelpTitles[this.menuHelpIndex], 65, 37);
    } else if (this.menuType === MENU_LOAD) {
      blit(g, this.srfcBlank, 0, 0);
      blit(g, this.srfcHelpTitles[5], 65, 37);
      for (let i = 0; i < 16; i++) {
        const locked = trunc(game.SAVED_DATA[i].ranking) === -1 && i !== 0;
        const col = locked ? [100, 100, 200] : [255, 255, 255];
        blit(g, fontCK_SMALL.render('Level ' + (i + 1), 1, col), i < 8 ? 100 : 170, 62 + (i % 8) * 10);
      }
      const i = this.menuLoadIndex;
      drawRectOutline(g, [255, 0, 0], i < 8 ? 96 : 166, 60 + (i % 8) * 10, 50, 10);
    }
  }

  // One key press (gfn_MenuInput). Returns true when the player chose Quit.
  input(ev, game, keen, app) {
    const has = (a) => ev.actions.includes(a);
    const up = has('up'), down = has('down'), enter = has('enter'), esc = has('menu');
    let quit = false;

    if (this.menuType === MENU_MAIN) {
      if (down && this.menuIndex < this.menuIndexMax) this.menuIndex += 1;
      if (up && this.menuIndex > 0) this.menuIndex -= 1;
      if (ev.code === 'F1') this.menuType = MENU_HELP;
      if (esc) quit = true;
      if (enter) {
        if (this.menuIndex === 0) {
          keen.reset();
          game.level_ID = 1;
          game.loadCutScenes(0);
          game.cutScene_ID = 0;
          this.active = false;
        } else if (this.menuIndex === 1) this.menuType = MENU_LOAD;
        else if (this.menuIndex === 2) this.menuType = MENU_OPTIONS;
        else if (this.menuIndex === 3) quit = true;
      }
    } else if (this.menuType === MENU_LOAD) {
      if (down && this.menuLoadIndex < this.menuLoadMax && game.SAVED_DATA[this.menuLoadIndex + 1].ranking >= 0) this.menuLoadIndex += 1;
      if (up && this.menuLoadIndex > 0 && game.SAVED_DATA[this.menuLoadIndex - 1].ranking >= 0) this.menuLoadIndex -= 1;
      if (enter) {
        game.level_ID = this.menuLoadIndex + 1;
        game.cutScene_ID = 1;
        this.active = false;
        // Restore Keen from the save slot of the previous level (level 1 wraps to the last, default slot)
        const s = at(game.SAVED_DATA, game.level_ID - 2);
        keen.hasKey = [false, false, false, false, false, false];
        keen.lives = s.lives;
        keen.health = s.health;
        keen.score = s.points;
        for (let i = 0; i < 9; i++) keen.weapon[i].ammo = s.ammo[i];
        for (let i = 0; i < 4; i++) keen.inventory[i].power = s.inventory[i];
        keen.invMaxPower = s.inventory[4];
        keen.currentWeapon = 0;
        let count = 0;
        while (keen.weapon[keen.currentWeapon].ammo <= 0 && count < 6) {
          keen.currentWeapon += 1;
          if (keen.currentWeapon === 6) keen.currentWeapon = 0;
          count += 1;
        }
        if (count === 6) keen.currentWeapon = -1;
      }
      if (esc) this.menuType = MENU_MAIN;
    } else if (this.menuType === MENU_OPTIONS) {
      if (down && this.menuOptionsIndex < this.menuOptionsMax) this.menuOptionsIndex += 1;
      if (up && this.menuOptionsIndex > 0) this.menuOptionsIndex -= 1;
      if (enter) {
        if (this.menuOptionsIndex === 0) {
          app.chooseCustomLevel();
        } else if (this.menuOptionsIndex === 1) {
          game.toggleSound();
        } else if (this.menuOptionsIndex === 2) {
          game.toggleMusic();
        } else if (this.menuOptionsIndex === 3) {
          game.SAVED_DATA = clearSaveData();
          playSound(SFX_KEEN_SWITCH);
          this.menuLoadIndex = 0;
        }
      }
      if (esc) this.menuType = MENU_MAIN;
    } else if (this.menuType === MENU_HELP) {
      if (down && this.menuHelpIndex < this.menuHelpIndexMax) this.menuHelpIndex += 1;
      if (up && this.menuHelpIndex > 0) this.menuHelpIndex -= 1;
      if (enter) {
        this.menuType = MENU_DISPLAYTEXT;
        this.menuHelpTextY = 0;
        this.srfcHelpText = loadImage(HELP_TEXT_NAMES[this.menuHelpIndex], 'alpha');
      }
      if (esc) this.menuType = MENU_MAIN;
    } else if (this.menuType === MENU_DISPLAYTEXT) {
      if (esc) this.menuType = MENU_HELP;
    }
    return quit;
  }

  // Held-key scrolling of the help text (gfn_MenuInput2)
  scroll(dt) {
    const keys = Input.keys();
    const maxY = Math.max(0, this.srfcHelpText.get_height() - 84);
    if (keys.down) {
      if (this.menuHelpTextY < maxY) this.menuHelpTextY = Math.min(maxY, this.menuHelpTextY + dt * this.moveSpeed);
    } else if (keys.up && this.menuHelpTextY > 0) {
      this.menuHelpTextY = Math.max(0, this.menuHelpTextY - dt * this.moveSpeed);
    }
  }
}
