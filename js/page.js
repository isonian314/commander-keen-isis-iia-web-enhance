'use strict';
// Buttons under the game on the documentation page (index.html). Presses go through the same
// input queue as the keyboard, so they behave exactly like the keys they mirror.

(function () {
  const controls = document.getElementById('controls');
  if (!controls) return;

  const inLevel = () => game && game.state === STATE_LEVEL;

  // Toggle state shown on the button (aria-pressed)
  const STATE = {
    sound: () => game.sound,
    music: () => game.music,
    cheats: () => Settings.debugKeys,
    jump: () => game.debug.jump,
    stats: () => game.debug.message === DEBUG_STATS,
    hidden: () => game.debug.hidden,
    inv1: () => keen.invCurrent === 0,
    inv2: () => keen.invCurrent === 1,
    inv3: () => keen.invCurrent === 2,
  };

  controls.addEventListener('mousedown', (e) => {
    // Keep keyboard focus off the buttons, so Space and Enter keep going to the game
    if (e.target.closest('button')) e.preventDefault();
  });

  controls.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !game) return;
    Sound.unlock();
    const toggle = btn.dataset.toggle, press = btn.dataset.press;
    if (toggle === 'sound') game.toggleSound();
    else if (toggle === 'music') game.toggleMusic();
    else if (toggle === 'cheats') {
      Settings.debugKeys = !Settings.debugKeys;
      Settings.save();
    } else if (btn.id === 'btn-settings') document.getElementById('gear').click();
    else if (btn.id === 'btn-full') document.getElementById('stage').requestFullscreen().catch(() => {});
    else if (press) Input.press(press);
    if (Input.inView && btn.id !== 'btn-settings') document.getElementById('screen').focus({ preventScroll: true });
    refresh();
  });

  function refresh() {
    if (!game) return;
    for (const btn of controls.querySelectorAll('button')) {
      const key = btn.dataset.toggle || btn.dataset.press;
      if (STATE[key]) btn.setAttribute('aria-pressed', String(!!STATE[key]()));
      if (btn.dataset.needs === 'level') btn.disabled = !inLevel();
      else if (btn.dataset.needs === 'cheats') btn.disabled = !inLevel() || !Settings.debugKeys;
      else if (btn.dataset.needs === 'inventory') {
        const i = Number(btn.dataset.press.slice(3)) - 1;
        btn.disabled = !inLevel() || (keen.inventory[i].power < 1 && keen.invCurrent !== i);
      }
    }
    // Key hints follow the current bindings in the settings panel
    for (const kbd of controls.querySelectorAll('kbd[data-action]')) {
      const codes = Settings.bindings[kbd.dataset.action] || [];
      kbd.textContent = codes.length ? keyLabel(codes[0]) : '\u2013';
    }
    const status = document.getElementById('cheat-status');
    if (status) {
      status.textContent = !Settings.debugKeys ? 'Cheat keys are off.' : inLevel() ? '' : 'Cheats and inventory work once a level has started.';
    }
  }

  setInterval(refresh, 250);
})();
