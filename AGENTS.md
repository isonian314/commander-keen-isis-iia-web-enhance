# Agent guide — Mystery of Isis IIa (web)

Vanilla-JS fan port of a PyGame Commander Keen game. The original 9 levels are finished; levels 10–16, their cut-scenes and the epilogue exist as playable placeholders. Open work (art, AI, tiles) lives in `TODO.md`. Story and intended design: `design/Isis2_2010.pdf` and `design/notes.txt`. Player-facing docs: `README.md` and the guide on `index.html`.

**Rule of thumb:** edit files under `resources/` or `js/`, then rebuild the asset bundle. The browser never reads `.tmx` or `.png` from `resources/` at runtime.

```
python3 tools/build_assets.py
```

Serve the repo (`python3 -m http.server`) and open `index.html`. After changing tiles or levels, hard-refresh.

---

## What to change for what

| Task | Primary files | Then |
| --- | --- | --- |
| Tweak generated levels 10–16 | `tools/build_levels.py` | `python3 tools/build_levels.py --preview && python3 tools/build_assets.py` |
| Hand-tune a generated `.tmx` in Tiled | `resources/levels/level1N-*.tmx` | `build_assets.py`. **Do not** re-run `build_levels.py` or it overwrites the file. |
| Edit original levels 1–9 | `resources/levels/level1-jungle.tmx` … `level9-dungeon.tmx` (Tiled) | `build_assets.py` |
| Preview a map | `tools/render_level.py <tmx> out.png [--info] [--scale 0.5]` | `--maps` writes `resources/maps/<name>.png` and `-full.png` |
| Add / grow `tiles.png` | `tools/extend_tiles.py <512px-wide sheet.png>` | Updates `MAXTILES`, every official `.tmx`, `custom_maps/`. Then `build_assets.py`. |
| New / changed sprite, enemy, HUD, bg, SFX | PNG/OGG under `resources/` | `build_assets.py` |
| New music track | `resources/music/*.ogg` | `build_assets.py` copies to `/music`; add an index in `js/audio.js` and `LEVEL_MUSIC` in `js/main.js` |
| Wire a new official level | See [Add an official level](#add-an-official-level) | Many files; save slots are currently 16. |
| Pre-level cut-scene or mid-level dialogue | `js/cutscenes.js` (`CUTSCENE_SCRIPTS`, `CUTSCENE_DIALOGUES`) | Levels 1–9 still use painted sheets in `resources/cutscenes/` listed by `CS_NAMES` in `js/game.js`. |
| Enemy AI / HP / spawn class | `js/enemies.js`, spawn table in `js/level.js` (`ENEMY_SPAWN`) | Add the sprite id to `gfn_IsEnemy` in `js/constants.js`. |
| Item / weapon pickup | `js/items.js`, `js/weapons.js`, `spriteToItem` in `js/level.js` | Contiguous sprite ranges; see `S()` ids in `js/constants.js`. |
| World-map route / travel | `js/worldmap.js` (`WORLDMAP_SITES`, `WORLDMAP_TRAVEL`, `worldMapPrevLevel`) | Art: `resources/backgrounds/worldmap-*.png` (or whatever `build_worldmap.py` writes). |
| Warp / cheat / Load Level unlock | `js/page.js` (warp buttons), `js/main.js` (`warpToLevel`, `dbgNext`/`dbgPrev`), `js/menu.js` (`levelUnlocked`) | Warp buttons are built from `LEVEL_NAMES`. |
| Player physics | `js/keen.js` | Poles: jump + hold Up; grab on the way down, not from standing. Swim Up to leave water. |
| Story / remaining content | `TODO.md`, `design/` | Prefer a placeholder (closest existing tile/enemy) and a `TODO.md` note over blocking. |

---

## Repo map

```
index.html              Playable page + in-page guide + warp buttons (#warp)
fullscreen/index.html   Same game, no page chrome. Keep js/ script list in sync (no page.js).
js/                     Game runtime (load order is the <script> list in index.html)
  core.js               Boot, image load, colour-key [129,255,44], blit helpers
  constants.js          MAXTILES, I()/S() ids, tile predicates
  tmx.js                Decode TMX; remaps INFO/SPRITE ids from each file's firstgid
  level.js              Build the live level from layers; spawn items/enemies/exits
  keen.js               Player
  enemies.js            Walker / shooter / Isonian / boss classes
  items.js, weapons.js, objects.js, effects.js, hud.js
  cutscenes.js          Scripted scenes for 10–16, dialogue 16, epilogue 17
  game.js               States, LEVEL_FILES / LEVEL_NAMES, save data (16 slots)
  menu.js               Title / Load Level / Options / Help
  worldmap.js           Pre-level travel animation
  main.js               Loop, exits, warp, music, dialogue
  page.js               index.html buttons (only if #controls exists)
  input.js              Bindings; dbgNext = N, dbgPrev = B
  audio.js              SFX + MUSIC list
data/assets.js          Generated bundle. Do not edit by hand.
resources/              Source art, levels, music, sounds, fonts
  levels/*.tmx          Official maps (base64+gzip, 8 layers)
  tiles/tiles.png       32 tiles wide, 16px tiles. Graphics ids 1..MAXTILES
  tiles/tiles_info.png  144 INFO tiles (collision, water, doors, exits)
  tiles/tiles_sprites.png  Placement icons for the Sprites layer
resources/maps/         PNG previews of official levels
tools/                  Python (stdlib + Pillow for image tools)
  build_assets.py       resources/ → data/assets.js + copy music/
  build_levels.py       Generates levels 10–16
  render_level.py       Preview PNG
  tmxlib.py             Read/write TMX; tile(col,row), info(n), sprite(n)
  extend_tiles.py       Append a 512px-wide sheet to tiles.png
  analyse_kits.py       Dump kit / door / pole usage from existing maps
  build_docs.py         Crop docs/img/ from sprite sheets
  build_worldmap.py     World-map art
custom_maps/            Tiled editing kit + sample.tmx (legacy Keen 1/4 enemies)
design/                 Spec PDF, notes.txt, garden tile sheet source
TODO.md                 What's left (placeholders vs real art/AI)
```

Script order (both HTML files): `assets → core → audio → input → constants → tmx → effects → weapons → items → enemies → objects → level → keen → hud → cutscenes → game → menu → worldmap → main`. `index.html` also loads `page.js`.

---

## Asset pipeline

`data/assets.js` inlines every PNG under `resources/{backgrounds,cutscenes,hud,menu,sprites,tiles}`, every OGG under `resources/sounds`, fonts, and the text of every `resources/levels/*.tmx`. Music stays as files under `/music`.

- Changing anything in those folders **and not** running `build_assets.py` means the running game is stale.
- Image names must be unique across those dirs. Stems ending `_bakup` or `_WIP` are skipped.
- Colour key is green `#81ff2c` / RGB `(129, 255, 44)` (`TRANSCOLOUR` in `js/core.js`).
- `MAXTILES` in `js/constants.js` must match `tiles.png` (`width/16 * height/16`). Today: **7808** (garden sheet starts at tile row 212).

`tiles.png` can grow vertically. Browsers cap canvases around 32,767 px (~2,000 tile rows). Always grow it with `extend_tiles.py`, never by pasting into the PNG alone.

---

## Level format

Tiled TMX, 16×16 tiles, 8 layers, encoding **base64 + gzip**. Layers in order:

`TransBG`, `BG1`, `BG2`, `FG1`, `FG2`, `TransFG`, `Info`, `Sprites`

Convention when editing: **BG1** = interior walls (hides parallax), **BG2** = platforms / kit surfaces, **FG1/FG2** = props in front, **TransFG** = water/lava body (and water surface one row above; the water's surface and back edge are also drawn on BG2, see Water below). Don't put INFO tiles on a graphics layer or the reverse.

Global ids:

- Graphics: `1 … MAXTILES` (`tile = row * 32 + col + 1`)
- INFO: `MAXTILES + n` (`I(n)` in JS; 144 tiles)
- SPRITE: `MAXTILES + 144 + n` (`S(n)`)

`js/tmx.js` remaps using the file's own `firstgid`s, so a custom map built against an older `tiles.png` still loads. Official files are rewritten to the current firstgids by `extend_tiles.py` / `tmxlib.write_tmx`.

### Placement (verified against levels 1–9)

`floor` = row of the solid cell the thing stands on.

| Thing | Where |
| --- | --- |
| Keen start `S1` right / `S2` left | `(x, floor − 3)`. Water: `S3`/`S4` on a water cell. |
| Checkpoint `S50` | `(x, floor − 3)` |
| Locked door `S33–38` (red…magenta) | Sprite at `(x, floor − 3)`. Put `I2` solid on `(x, floor−3 … floor−1)`. Opening clears those 3 INFO cells. Door graphic is 32×64. Wall the space above if it must not be jumped. |
| Two-way door | INFO pair **2 rows above the floor**, odd id on the left, even on the right (`I97/98` = door 1, `I99/100` = door 2, …). Same pair at both ends; first scan (`x` outer, `y` inner) is end 1. |
| Exit | Column of `I129+n` (`n` = exit id − 1). Exit **id** is the **next `level_ID`**, not “this level’s number”. |
| Enemy | Sprite at about `floor − height_in_tiles`; they fall. Optional `I35`/`I36` on the sprite cell for facing. Put `I34` (enemy-solid) at ledge ends so walkers don't walk off. |
| Background | `S20+n` anywhere (`n` = 0…7 → `bgN.png`). |
| Music override | `S39+n`. Default per-level track is `LEVEL_MUSIC` in `js/main.js`. |
| Weather | `S191` night, `S210` rain, `S211` snow, `S212` cloud, `S213` lightning. Height of the sprite matters. |
| EGA Keen | `S5` (secret level). |
| Water | `I82` on water cells, starting **one row below** the bank's surface (the bank's surface row is open air above the pool). Graphics are a 3×4 block (cols 24 left / 25 mid / 26 right, rows 70 top / 71 surface / 72 body / 73 bottom), laid out as in level 6: body + bottom (row below the water) on **TransFG**; surface (the air row above the water) on **TransFG and BG2**; top (two rows above) on BG2 only, `(25,70)` over the first column, `(26,70)` over the rest, `(27,70)` one column past the last. The left edge `24` goes one column *outside* the water; the right edge `26` is the last water column. The water's top and surface go *behind* (BG1) anything already on BG2, such as pads standing in the water. The exception is the left bank, whether level with the surface or rising above it (level 2): its face and lip move to BG1 behind the water's corner, and the surface's left edge `(24,71)` covers the bank's last column on BG2. A wall rising out of the water on the right (levels 2/3): middle pieces up to the wall's sliver, half-width surface `(28,71)` on TransFG, and no `(27,70)`. See `WATER` and pass 3 of `Level.render`. |
| Lily pad | `lv.lily(x, floor − 1, w)` in `build_levels.py`: 2 rows on BG2, bottom row in the water's surface band and one-way (`I3`), so Keen stands level with the bank. `layer="FG1"` (y = floor − 2) draws one as a land decoration with no INFO. Width 4 = primary pad `(17–20, 222–223)`; other widths = blank pad (cap `(10,222)`, random middles `11–13`, cap `(14,222)`) with random berry clusters. Berry variants: default `(18–19,222)`, pair `(18–19,221)`, 2×2 block `(18–19,224–225)`, single left `(16,222)` and right `(21,222–224)`; see `LILY`. Pads go on BG2 before the water pass so the surface lands behind them. |
| Lava | Hurt-in-water `I84` (`INFO_HURT_1w`) + lava tiles `(22,71)` surface / `(22,72)` body. Lava splash triggers if FG_TRANS gid is **2327**. |
| Pole | `I25` + pole graphic (cyan: cap `(29,88)`, body `(31,88)` repeating; `(29,91–93)` is a one-off 3-tile stick). Grab by jumping past it while holding Up. |
| Solid border | 1-tile `I2` around the map edge. |

### Exit / progress rules (`js/main.js`)

- Exit id `E` normally sets `level_ID = E` (so level 10's exit is **11**, not 10).
- If `E === current level_ID`, that is a **mid-level dialogue** (`CUTSCENE_DIALOGUES[E]`); the exit tiles are killed and play continues. Used in level 16 (`E === 16`).
- On the **last** official level, any *other* exit goes to `LEVEL_FILES.length + 1` (epilogue 17), then the title.
- Level 12: island exit **14**, grotto secret exit **13**. Level 13 exits **14**. `worldMapPrevLevel(14)` prefers 13 if the secret was completed.
- Recognised exit INFO range is `INFO_EXIT_1` … `+15` (ids 1–16).

### Physics budget (when laying out)

Normal jump ≈ 4.5 tiles, pogo ≈ 7. Keep steps ≤ 3 (≤ 6 with pogo), gaps ≤ 4. Keen is 48×48; corridors need ≥ 3–4 tiles of headroom.

### Theme kits (`[col, row]` on `tiles.png`)

Top tile sits in the row *above* the surface; surface on the solid row; fill below.

| Theme | top | surface | fill |
| --- | --- | --- | --- |
| jungle | (12,1) | (11,2) | (11,3) |
| jungle dark / one-way | (12,11) | (11,12) | (11,13) |
| mountain | (11,53) | (10,54) | (10,55) |
| cave | (11,65) | (10,66) | (10,67) |
| minefield dirt | (12,105) | (11,106) | (11,107) |
| blue base | (12,115) | (11,116) | (11,117) |
| white base | (12,133) | (11,134) | (11,135) |
| hangar brown | (12,149) | (11,150) | (11,151) |
| green base | (12,159) | (11,160) | (11,161) |
| dungeon | (12,178) | (11,179) | (11,180) |
| garden | (12,213) | (11,214) | (11,215) |

Kits (except mountain/cave, shifted one column left) match the jungle block layout: slopes in cols 0–9, solid block in 11–13. `tools/build_levels.py` `KITS` / `WALLS` / `GFX` / `POLES` is the live list. `GFX_ALT` lists alternative pieces a graphic swaps in at random per placement (seeded by name and position, so rebuilds are stable), e.g. the garden pod plant's two leaf and grass variants. Edges as in levels 1–9 (see the `Kit` docstring): left sliver col 10 one tile *outside* the solid, left column + sliver on **FG1**; right face col 13 (`14,+2/+3` on the last two rows) one tile outside on BG2. Inner corners (a block standing on a lower floor of the same kit): on the right the face's last row is the step piece `(13,+2)` (face + lower floor's surface, no top lip there) with `(12,+3)` in the block's column below it; on the left the sliver and left column carry on one row into the lower floor's surface on FG1 (`(10,+2)`, `(11,+2)`). A pole through a platform goes on BG2 with the platform copied to FG1 and a 3-tile hole on the row above. `build_levels.py` needs Pillow (it skips blank tiles in `GFX` rectangles). SGA letters are half a tile wide, two per tile: left-half glyph on BG1, right-half on BG2 (`Level.sign` / `sign_on`). Wood: a–m row 22 / n–z row 23 (left half), rows 24/25 (right half), cols 0–12; plain board `(20,23)`, rim `(19–21,22)` `(19,23)` `(21,23)` `(19,24)` `(17,24)` `(21,24)`, bottom-with-post `(20,24)`, post foot `(18,25)`. Blue: cols 19–31, rows 143/144 (left), 145/146 (right), no board.

Sprite numbers used in maps are the `S(n)` values in `js/constants.js` (keys 14–19, items, weapons 220–228, enemies 77+). `tools/build_levels.py` repeats the useful ones as names.

---

## Edit levels 10–16 (usual path)

1. Change the `level10()` … `level16()` builders in `tools/build_levels.py` (DSL: `solid`, `ow`, `pole`, `fill_water`, `key`/`lock`, `door`, `exit`, `enemy`, `start`, `sign`, `gfx`, …).
2. `python3 tools/build_levels.py --preview` — writes TMX and `/tmp/isis/prev/*.png`.
3. `python3 tools/build_assets.py`
4. In the browser: warp buttons 10–16 (Shift+click = cut-scene first). With cheat keys on, `N`/`B` warp next/prev.

If you instead open the generated `.tmx` in Tiled, treat `build_levels.py` as stale for that file until you port the tweak back.

`custom_maps/sample.tmx` is the Keen 1/4 sandbox (Yorps, Gargs, Slugs, Raygun, Neural). Level 13 stamps its palm tree from there.

---

## Add an official level

The game is built as **16 save slots**. Adding a 17th playable level means growing that everywhere, not only dropping in a TMX.

1. Create `resources/levels/levelNN-<slug>.tmx` (generator or Tiled). Include Keen start, a background sprite, a solid border, and an exit column.
2. Append the filename to `LEVEL_FILES` and the title to `LEVEL_NAMES` in `js/game.js`.
3. Add a music index to `LEVEL_MUSIC` in `js/main.js`.
4. Cut-scene: either add `cutsceneN.png` to `CS_NAMES` **or** a `CUTSCENE_SCRIPTS[NN]` entry in `js/cutscenes.js`.
5. World map: another `WORLDMAP_SITES` entry (index = level id; index 0 is the landing site) plus travel/via if needed.
6. Grow save data in `js/game.js` (`defaultSaveData` / `loadSaveData` length **16** today) and any UI that assumes 16 boxes.
7. Exit INFO ids only go through 16. If you need more, raise `INFO_EXIT_1 + 15` in `js/level.js` and the exit handling in `js/main.js`.
8. Point the previous level's exit at the new id. Last-level → epilogue uses `LEVEL_FILES.length`, so the old finale's “any other exit” rule moves automatically.
9. `build_assets.py`. Warp buttons follow `LEVEL_NAMES` automatically.

---

## Add tiles to the sheet

1. Draw a **512 px wide** strip (32 × 16 px tiles), height a multiple of 16, colour-key green `#81ff2c`.
2. `python3 tools/extend_tiles.py path/to/sheet.png` — appends to `resources/tiles/tiles.png` and `custom_maps/tiles.png`, sets `MAXTILES`, rewrites official TMX + `custom_maps/sample.tmx`.
3. New tiles start at the old height / 16 (garden is row 212). Empty rows 199–211 sit between dungeon lava and the garden sheet.
4. `build_assets.py`. If a kit is involved, add it to `KITS` in `build_levels.py` and `CS_GROUND` in `cutscenes.js`.

Do not hand-edit `MAXTILES` or firstgids.

---

## Add or replace an enemy

1. Art: `resources/sprites/enemy_*.png` (and a mask if others have one). `build_assets.py`.
2. Give it an `S(n)` in `js/constants.js` and add it to `gfn_IsEnemy`.
3. Map that id → class in `ENEMY_SPAWN` (`js/level.js`). Walkers vs shooters vs specials live in `js/enemies.js` (`WALKERS` / `SHOOTERS` tables).
4. Place `S(n)` on the Sprites layer. Bosses that should not appear in custom maps go in `ORIGINAL_ONLY` (currently Shapeshifter, Evil Keen, HR-42, Plutezarp).
5. Stand-ins already in use (replace these, don't add parallel ids): Robo Grey `S140` → tough Grey Robot; Robo Blue `S141` → Flasher; Devil `S159` → Demon; RoboKeen → Evil Keen `S143`; Mort → Shapeshifter `S142`.

Bosses do **not** currently gate progress (no key drop / door open on death).

---

## Cut-scenes and story text

- Levels 1–9 (+ intro): painted strips `resources/cutscenes/cutscene*.png`, listed in `CS_NAMES`. Frame 0 of a level sheet is replaced by the stats screen.
- Levels 10–16 and epilogue 17: `CUTSCENE_SCRIPTS` in `js/cutscenes.js` (text from the PDF over reused art).
- Mid-level: `CUTSCENE_DIALOGUES[levelId]` + an exit whose id equals the current level.
- Naming: the PDF says “the Teacher”; existing interlude art and the README say “the Grand Advisor”. New scripts follow the art except RoboKeen's “Teacher” line. Don't silently rename — see `TODO.md`.

---

## Test before calling a change done

UI / levels / routing need a real browser pass, not only a preview PNG.

1. `python3 tools/build_assets.py` (and `build_levels.py` if you regenerated).
2. Serve the folder, open `index.html`.
3. Warp the changed level (and any other level that shares its tiles, exits or state).
4. Exercise the path a player uses: walk, jump, pole, water, key+lock, two-way door, exit.
5. Confirm `fullscreen/index.html` still boots if you touched shared `js/` or the script list.
6. Watch the console. A missing TMX in `LEVEL_FILES` fails boot (every official level is parsed up front).

Cheat keys on: every Load Level slot unlocked; `N`/`B` warp. Warp from the title screen resets Keen; warp mid-run keeps weapons/inventory.

---

## Pitfalls

- **`build_levels.py` overwrites** `level10`–`level16` `.tmx` files. Hand edits in Tiled are lost unless copied back into the Python builder.
- **TMX width regex:** parsers must match `\swidth=` / `\sheight=`, not `width=` (that hits `tilewidth`). Use `tmxlib`.
- Layers in JS after load are `[x][y]` in the game; `tmxlib` stores `[y][x]`.
- Lava splash is hardcoded to graphics gid **2327** (`(22,72)` at the current sheet size). Growing `tiles.png` does **not** change that gid (it is a graphics tile, not INFO), but *moving* the lava tile would.
- `ORIGINAL_ONLY` hides some sprites in custom maps only; official levels still spawn them.
- Doc level numbers are one behind the game from the mountain/cave split onward. Doc 15+16 are one game level (16) plus a dialogue.
- Prefer the closest existing tile/enemy and a `TODO.md` checkbox over inventing new art in code.
}
