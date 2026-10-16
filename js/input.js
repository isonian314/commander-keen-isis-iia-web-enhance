'use strict';
// Keyboard / gamepad input and persistent settings

// Remappable actions, in the order shown in the settings panel
const ACTIONS = [
  ['up', 'Up / look up / use switch'], ['down', 'Down / look down'], ['left', 'Left'], ['right', 'Right'],
  ['jump', 'Jump'], ['pogo', 'Pogo'], ['shoot', 'Shoot'],
  ['w1', 'Weapon 1 (Blowgun)'], ['w2', 'Weapon 2 (Zeffer 3000)'], ['w3', 'Weapon 3 (Pulsar)'], ['w4', 'Weapon 4 (Solarizer)'],
  ['w5', 'Weapon 5 (HR-42)'], ['w6', 'Weapon 6 (Plutezarp)'], ['w7', 'Weapon 7 (Raygun)'], ['w8', 'Weapon 8 (Neural Stunner)'],
  ['inv1', 'Inventory 1 (Battery)'], ['inv2', 'Inventory 2 (Shield)'], ['inv3', 'Inventory 3 (Ion Scanner)'], ['inv4', 'Inventory 4'],
  ['dbgStats', 'Debug: statistics'], ['dbgColour', 'Debug: statistics colour'], ['dbgHidden', 'Debug: hidden areas'],
  ['dbgJump', 'Debug: jump cheat'], ['dbgKeys', 'Debug: all keys'], ['dbgLives', 'Debug: lives & health'],
  ['dbgWeapons', 'Debug: all weapons'], ['dbgInventory', 'Debug: full inventory'], ['dbgMessage', 'Debug: message'],
];

const DEFAULT_BINDINGS = {
  up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
  jump: ['ControlLeft', 'ControlRight', 'KeyZ'], pogo: ['ShiftLeft', 'ShiftRight', 'KeyX'], shoot: ['Space'],
  w1: ['Digit1'], w2: ['Digit2'], w3: ['Digit3'], w4: ['Digit4'], w5: ['Digit5'], w6: ['Digit6'], w7: ['Digit7'], w8: ['Digit8'],
  inv1: ['F1'], inv2: ['F2'], inv3: ['F3'], inv4: ['F4'],
  dbgStats: ['KeyS'], dbgColour: ['KeyC'], dbgHidden: ['KeyH'], dbgJump: ['KeyJ'], dbgKeys: ['KeyK'], dbgLives: ['KeyL'],
  dbgWeapons: ['KeyW'], dbgInventory: ['KeyI'], dbgMessage: ['KeyM'],
};

// Fixed keys (not remappable): Escape = back/quit, Enter = select, F1 also opens Help in the menu
const KEY_MENU = 'Escape', KEY_ENTER = ['Enter', 'NumpadEnter'];

const SETTINGS_KEY = 'isis2.settings';

const Settings = {
  bindings: JSON.parse(JSON.stringify(DEFAULT_BINDINGS)),
  sfxVolume: 1,
  musicVolume: 1,
  scale: 'fit',          // 'fit' or 'integer'
  debugKeys: true,       // the Python 3 version enables the debug keys by default
  gamepad: true,

  load() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      for (const k of ['sfxVolume', 'musicVolume', 'scale', 'debugKeys', 'gamepad']) if (k in s) this[k] = s[k];
      if (s.bindings) for (const [a] of ACTIONS) if (Array.isArray(s.bindings[a])) this.bindings[a] = s.bindings[a];
    } catch (e) {
      console.warn('Ignoring saved settings', e);
    }
  },

  save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        bindings: this.bindings, sfxVolume: this.sfxVolume, musicVolume: this.musicVolume,
        scale: this.scale, debugKeys: this.debugKeys, gamepad: this.gamepad,
      }));
    } catch (e) { /* storage unavailable */ }
  },

  resetBindings() {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  },
};

// Gamepad (standard mapping): d-pad/left stick move, A jump, B pogo, X/Y shoot, Start = Enter, Back = Escape
const PAD_BUTTONS = { 0: 'jump', 1: 'pogo', 2: 'shoot', 3: 'shoot', 12: 'up', 13: 'down', 14: 'left', 15: 'right', 9: 'enter', 8: 'menu' };

const Input = {
  held: new Set(),        // KeyboardEvent.code values currently down
  padHeld: new Set(),     // actions held on the gamepad
  queue: [],              // key presses since the last frame: { code, actions }
  enabled: true,
  inView: true,           // false while the game is scrolled out of view, so the page gets the keys

  actionsFor(code) {
    const out = [];
    for (const [a, codes] of Object.entries(Settings.bindings)) if (codes.includes(code)) out.push(a);
    if (code === KEY_MENU) out.push('menu');
    if (KEY_ENTER.includes(code)) out.push('enter');
    return out;
  },

  isHeld(action) {
    if (this.padHeld.has(action)) return true;
    for (const c of Settings.bindings[action] || []) if (this.held.has(c)) return true;
    return false;
  },

  keys() {
    return { up: this.isHeld('up'), down: this.isHeld('down'), left: this.isHeld('left'), right: this.isHeld('right'), jump: this.isHeld('jump') };
  },

  // A single press of an action from outside the keyboard (on-page buttons)
  press(action) {
    Sound.unlock();
    this.queue.push({ code: 'Button:' + action, actions: [action] });
  },

  take() {
    const q = this.queue;
    this.queue = [];
    return q;
  },

  clear() {
    this.held.clear();
    this.padHeld.clear();
    this.queue = [];
  },

  attach(target) {
    target.addEventListener('keydown', (e) => {
      if (!this.enabled || !this.inView) return;
      const actions = this.actionsFor(e.code);
      if (actions.length || /^F\d+$/.test(e.code) || e.code === 'Space') e.preventDefault();
      Sound.unlock();
      if (e.repeat) return;
      this.held.add(e.code);
      this.queue.push({ code: e.code, actions });
    });
    target.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });
    window.addEventListener('blur', () => this.clear());
    target.addEventListener('pointerdown', () => Sound.unlock());
  },

  pollGamepad() {
    if (!Settings.gamepad || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const pad = [...pads].find((p) => p && p.connected);
    const now = new Set();
    if (pad) {
      for (const [i, a] of Object.entries(PAD_BUTTONS)) if (pad.buttons[i] && pad.buttons[i].pressed) now.add(a);
      const [ax, ay] = [pad.axes[0] || 0, pad.axes[1] || 0];
      if (ax < -0.5) now.add('left');
      if (ax > 0.5) now.add('right');
      if (ay < -0.5) now.add('up');
      if (ay > 0.5) now.add('down');
    }
    for (const a of now) {
      if (!this.padHeld.has(a)) {
        Sound.unlock();
        this.queue.push({ code: 'Gamepad:' + a, actions: [a] });
      }
    }
    this.padHeld = now;
  },
};
