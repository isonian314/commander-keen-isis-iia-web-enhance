'use strict';
// Sound effects and music (isis_music.py)

// SFX ids index this list. Every weapon except the Neural Stunner uses the blowgun sound, as in the original.
const SFX_FILES = [
  'w_blowgun', 'w_blowgun', 'w_blowgun', 'w_blowgun', 'w_blowgun', 'w_blowgun', 'w_blowgun', 'w_blowgun', 'w_neural', 'w_hitwall',
  'item_points', 'item_weapon', 'item_weapon_neural', 'item_key', 'item_key_use', 'item_1up',
  'keen_jump', 'keen_pogo', 'keen_bubbles', 'keen_splash', 'keen_die', 'keen_switch',
  'enemy_droplet', 'enemy_slug', 'enemy_mine', 'enemy_shot1', 'enemy_shot2', 'enemy_shot3', 'enemy_shot4', 'enemy_shot5',
  'wx_rain', 'wx_lightning', 'level_start', 'level_finish', 'item_points_k4', 'enemy_foog_jump', 'enemy_splat',
].map((n) => n + '.ogg');

// Resolved against this script rather than the page, so pages in subfolders (fullscreen/) find it too
const MUSIC_BASE = new URL('../music/', document.currentScript.src);
const MUSIC = ['level01', 'level02', 'level03', 'level04', 'level05', 'level06', 'level07', 'level08', 'level09',
  'level0x', 'level0x', 'level0x', 'level0x', 'level0x', 'level0x', 'level0x'].map((n) => new URL(n + '.ogg', MUSIC_BASE).href);

// pygame's mixer has 8 channels; a sound is dropped when they are all busy
const MAX_VOICES = 8;

const Sound = {
  ctx: null,
  master: null,
  buffers: [],
  voices: 0,
  sfxOn: true,      // in-game Options menu toggle
  musicOn: true,
  music: null,
  musicSrc: null,
  fadeTimer: 0,

  async init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.applyVolume();
    const decoded = {};
    await Promise.all([...new Set(SFX_FILES)].map(async (name) => {
      const b64 = window.ISIS_ASSETS.sounds[name];
      if (!b64) return;
      try {
        const bytes = base64ToBytes(b64);
        decoded[name] = await this.ctx.decodeAudioData(bytes.buffer);
      } catch (e) {
        console.warn('Could not decode sound', name, e);
      }
    }));
    this.buffers = SFX_FILES.map((n) => decoded[n] || null);
  },

  // Browsers only start audio after a user gesture
  unlock() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (this.music && this.music.paused && this.wantMusic) this.music.play().catch(() => {});
  },

  applyVolume() {
    if (this.master) this.master.gain.value = this.sfxOn ? Settings.sfxVolume : 0;
    if (this.music) this.music.volume = this.musicVolume();
  },

  musicVolume() {
    return this.musicOn ? Settings.musicVolume : 0;
  },

  play(id) {
    const buf = this.buffers[id];
    if (!buf || !this.ctx || this.voices >= MAX_VOICES) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.master);
    this.voices++;
    src.onended = () => { this.voices--; };
    src.start();
  },

  // pygame.mixer.music.load + play(-1)
  playMusic(index) {
    this.stopMusic();
    const a = new window.Audio(MUSIC[index]);
    a.loop = true;
    a.volume = this.musicVolume();
    this.music = a;
    this.wantMusic = true;
    this.fadeTimer = 0;
    a.play().catch(() => {});
  },

  stopMusic() {
    if (this.music) {
      this.music.pause();
      this.music.removeAttribute('src');
      this.music.load();
    }
    this.music = null;
    this.wantMusic = false;
  },

  fadeout(ms) {
    if (!this.music) return;
    this.fadeStart = this.music.volume;
    this.fadeTotal = ms;
    this.fadeTimer = ms;
  },

  // Called each frame with real elapsed milliseconds
  tick(ms) {
    if (!this.music || this.fadeTimer <= 0) return;
    this.fadeTimer -= ms;
    if (this.fadeTimer <= 0) this.stopMusic();
    else this.music.volume = this.fadeStart * (this.fadeTimer / this.fadeTotal);
  },

  pause(paused) {
    if (this.ctx) paused ? this.ctx.suspend() : this.ctx.resume();
    if (this.music && this.wantMusic) paused ? this.music.pause() : this.music.play().catch(() => {});
  },
};

function playSound(id) {
  Sound.play(id);
}

function musicFadeout(ms) {
  Sound.fadeout(ms);
}
