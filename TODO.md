# Isis IIa – what is left to complete the game

Sources: `design/Isis2_2010.pdf` (story and level design doc), `design/notes.txt` (developer notes), and the current code.

The design doc has 16 levels, plus the secret level. The finished game split doc level 3 (Cave *or* Mountains) into two levels, so
every later level is one number higher than in the doc. The game has 16 save slots, so doc levels 15 and 16 (Rooftop Showdown #1
and #2, which "exist only to allow a cut-scene") are one game level with a dialogue in the middle.

| Game # | Doc # | Level | Status |
| ---: | ---: | --- | --- |
| 1–9 | 1–8 | Jungle, Jungle Nights, Mountain, Cave, Minefield, Artillery Division, Hangar, Central Command, Dungeon | Finished (original game) |
| – | – | Interlude (Isonian commander, before the Dungeon) | Finished (`cutscene9.png`) |
| 10 | 9 | Barracks | New, placeholder |
| 11 | 10 | Missile Tower & Launching Area | New, placeholder |
| 12 | 11 | Castle "Moat" (Ocean) | New, placeholder |
| 13 | 12 | Secret Level (Secret Island) | New, placeholder |
| 14 | 13 | Castle Garden | New, placeholder |
| 15 | 14 | Imperial Castle | New, placeholder |
| 16 | 15+16 | Rooftop Showdown (RoboKeen, then "Mort" the Shapeshifter) | New, placeholder |
| – | – | Epilogue ("To Be Continued...") | New, text cut-scene |

Legend: **[x]** done · **[~]** done with a placeholder (works end to end, but needs real art/AI later) · **[ ]** not done.

---

## Must have (game can be played start to finish)

### Engine / code
- [x] Level select / warp for testing: on-page "Warp to level" buttons (Shift+click plays the cut-scene first), `N`/`B` cheat
      keys for next/previous level, and every level unlocked in *Load Level* while cheat keys are on.
- [x] 16 levels wired up (`LEVEL_FILES`, music per level, save slots, world map, stats screen).
- [x] Exits to levels 10–16 (INFO exit tiles 1–16; previously only 1–11 were recognised).
- [x] Level 9 (Dungeon) exit leads on to level 10 instead of ending the game.
- [x] Level 12 (Ocean) has two exits: the normal one to level 14 and a hidden one to the secret level 13; level 13 exits to 14.
- [x] Mid-level dialogue: an exit whose number is the *current* level plays that level's dialogue and then carries on in the
      same level (used for the RoboKeen → Mort hand-over in level 16). Any other exit in the last level ends the game.
- [x] Ending: after level 16, the epilogue plays, then the title screen.
- [x] Tile sheet can grow: `tiles.png` extended vertically (6784 → 7808 tiles). INFO/SPRITE ids follow `MAXTILES`, and the
      TMX loader now maps tile ids using each file's own `firstgid`s, so older custom levels still load.
      `tools/extend_tiles.py <sheet.png>` appends another 512-px-wide sheet and renumbers every level file.
      (Limit: browsers cap canvases at about 32,767 px, i.e. ~2,000 tile rows, ~65,000 tiles.)
- [x] Level generator `tools/build_levels.py` (themes, tile kits, layout helpers) and preview renderer `tools/render_level.py`.
      Regenerate with `python3 tools/build_levels.py --preview && python3 tools/build_assets.py` (previews go to `/tmp/isis/prev/`).
      Editing a generated .tmx in Tiled is fine, but re-running the generator overwrites it.
- [x] Tested in the browser: all 16 levels load via warp, cut-scenes play, the level 16 dialogue and the epilogue play, the Ocean's
      island exit leads to 14 and the grotto exit to 13, poles, the two-way door and swimming out of the water work.
      Each new level has also been checked to be completable on paper, but has not been played through by hand.
- [~] Boss stand-ins: Robo Grey, Robo Blue and the Devil have sprite ids but no code. They now spawn as a tougher Grey Robot,
      Flasher and Demon. RoboKeen uses Evil Keen and "Mort" uses the Shapeshifter, both with boss hit points.

### Levels (tmx)
- [~] 10 Barracks (150x46) – three-storey base building (white platforms, blue panel walls, poles). Red key on the top floor opens
      the way out on the ground floor; a two-way door leads to a roof bonus area with the Pulsar. Lemmings, rats, truck guys on foot,
      grey/red robots. Beds etc. missing (see tiles).
- [~] 11 Missile Tower (82x112) – climb seven floors (poles and platform stairs); the yellow key halfway up opens the launch deck
      where Robo Grey (stand-in) guards the exit. Robo Blue (stand-in) mid-tower, Isonian fliers. Missile not drawn (no tiles; a
      parked ship stands in).
- [~] 12 Ocean Moat (172x66) – swim across to the island exit (to 14). A shaft in the sea floor leads to a fork with SGA signs:
      "TAKE THE BLUE PILL" loops back up to the sea, "TAKE THE RED PILL" leads down to a flooded brimstone grotto (lava pools hurt)
      with the Devil (stand-in), the Solarizer, Isis fruit and the secret exit (to 13). Fish, chompers, stingrays, urchins.
- [~] 13 Secret Island (124x42) – Keen 1/4 novelty level: EGA Keen, Yorps, Gargs, Slugs, Raygun and Neural Stunner (in a cave);
      cyan key on the cliff top opens the gate. Palm tree copied from `custom_maps/sample.tmx`.
- [~] 14 Castle Garden (152x46) – new garden tiles (hedges, plants); hedge stairs up to the green key, a pond with a swimming frog,
      garden critters; ends at the castle gate (green door) and entrance hall.
- [~] 15 Imperial Castle (140x58) – four stone storeys (dungeon tile set) with paintings, torches and cages: blue key opens the
      ground floor, yellow key opens the roof, exit at the roof stairs. Isonians (green/red/white), robots, Foog warriors.
- [~] 16 Rooftop Showdown (124x40) – arena 1 with RoboKeen (Evil Keen), the "314" door (exit 16 = mid-level dialogue, SGA
      "THREE ONE FOUR" sign), arena 2 with Mort (Shapeshifter), the HR-42 and the Plutezarp; the far exit plays the epilogue.

### Cut-scenes / story (text implemented over existing art, see `js/cutscenes.js`)
- [~] Level 10 – "Nobody here… they must be out boarding the fleet!"
- [~] Level 11 – (angry) "This won't be leaving Isis II…. Ever."
- [~] Level 12 – reprogramming the missile, the cliff panorama ("DO YOU HEAR ME??!"), Keen dives in.
- [~] Level 13 – secret island arrival (the doc leaves this blank; placeholder text).
- [~] Level 14 – "Keen races through into garden".
- [~] Level 15 – "Keen enters the Imperial Castle, preparing for the final showdown."
- [~] Level 16 – RoboKeen: "Greetings… You are obsolete… Toast… as the new Commander Keen!"
- [~] Level 16 mid-level – RoboKeen's last words ("…Teacher…"), the 314 door, Mort: "Welcome… Mister Three Fourteen…".
- [~] Epilogue – the Shapeshifter's confession, the INCOMING TRANSMISSION viewscreen, "PHASE 1 COMPLETE…", "To Be Continued...".
- [ ] Story naming: the doc calls the villain "the Teacher"; the finished game's interlude art (`cutscene9.png`) and README call
      him "the Grand Advisor". New cut-scenes use "the Grand Advisor" to match the existing art, with RoboKeen's line kept as
      "Teacher" only where the doc spells it out as a code-name. Decide which name to use everywhere.

---

## Nice to have (replace placeholders with real content)

### Cut-scene art (all new cut-scenes currently reuse existing pictures/backgrounds with text boxes)
- [ ] Barracks: door closing behind Keen in a long room of beds.
- [ ] Missile Tower: Keen facing a tower of white and grey beams.
- [ ] Ocean: Keen reprogramming the missile; panorama from the cliff with the two islands; Keen diving.
- [ ] Castle Garden: Keen emerging from the water into the garden.
- [ ] Imperial Castle: Keen at the foot of the castle.
- [ ] Rooftop: RoboKeen firing, Keen ducking, overhead panorama of the face-off.
- [ ] Rooftop mid-level: Keen standing over a sparking RoboKeen; the "314" door; Mort pulling an HR-32.
- [ ] Epilogue: Mort shifting back to a tree; viewscreen with an SGA "INCOMING TRANSMISSION" jagged wave.
- [ ] Doc level 1–7 pre-level animations are single frames today (optional: animate them).

### Parallax backgrounds (currently reused)
- [ ] Barracks: missile tower visible in the background (uses `bg6.png`, icy spires).
- [ ] Missile Tower: cloudy mountains, optionally a cloud effect above a certain height (uses `bg1.png` + cloud weather sprites).
- [ ] Ocean: underwater background (uses `bg5.png`).
- [ ] Secret level: Keen 4 style background (uses `bg1.png`).
- [ ] Castle levels and rooftop: "garden rainbows" (`bg7.png`) is used as the doc asks; the castle interior could use its own.

### Tiles (closest existing tiles used for now)
- [ ] Barracks: beds, bathrooms, windows, concrete walls (uses the white/blue underground-base tiles and pipes).
- [ ] Missile Tower: big black missile, steel girders, parked spaceships as background tiles (uses white base platforms + hangar crane).
- [ ] Ocean: sea-floor tiles, coral, brimstone (uses cave/dungeon tiles and the dungeon lava rock).
- [ ] Secret level: Keen 4 style tiles (uses the jungle tiles; Keen is switched to the EGA sprite for the novelty).
- [x] Castle Garden: lily pads (`Level.lily`, garden sheet rows 221–225) in the pond and across the lake.
- [ ] Castle Garden: cement bridges.
- [ ] Imperial Castle: swords, shields, guns, ammo, pictures of ships, throne room (red carpet, golden throne, chandeliers).
- [ ] Rooftop: castle roof/battlement tiles, the door with "314" on it.
- [ ] Dungeon extras from the doc: torture devices, flickering lights (partly there already).
- [ ] Slopes in new levels (the generator only builds flat ground and platforms).
- [ ] Edge tiles: the generator draws a top, surface and fill tile only, so block sides and undersides have no proper edge tiles.
- [ ] Ocean sea floor uses the grey mountain rock kit; the castle facade uses plain dungeon fill.

### Enemies – art, animation and AI
- [ ] **Isonians (notes.txt)**: Green walks and shoots on sight (done). Red (military) should teleport *towards* Keen when strong and
      away to recharge when weak (currently: all Isonians only teleport away when hurt). White (scientist) runs away from Keen and
      only fights back, hard, once attacked (it turns its back, but doesn't flee).
- [ ] **Robo Grey** (missile tower boss): sprite sheet, boss AI, and "reprograms the missile mid-fight" event.
- [ ] **Robo Blue** (fleet boss): sprite sheet, boss AI, and the scrambling-wave control that crashes the fleet.
- [ ] **Isis Plane Guy** (missile tower): the Isonian fighter exists but floats and never shoots; needs flying/strafing AI.
- [ ] **Devil** (secret grotto in the Ocean level): sprite sheet and AI (fight with the Solarizer).
- [ ] **RoboKeen**: proper sprite (Evil Keen is a stand-in) and boss AI (dodging, blaster patterns); "obsolete" taunts.
- [ ] **Shapeshifter / Mort**: Mort (MM) disguise form, tree ↔ worm shifts, HR-32 duel; the existing Shapeshifter is a stand-in.
- [ ] **Stingray (Floppy), Yellow fish, Green fish, Blue fish**: drawn but "unfinished" (they only drift); need swim/attack AI.
- [ ] **Bird, Dragonfly, Big Frog, Giant Isonians**: drawn, minimal/unfinished AI.
- [ ] **Owl or Bat** (doc level 2, nocturnal enemy): no art.
- [ ] **Plant-Guy** (doc level 1): art exists (`enemy_plantguy.png`), never placed; AI is a plain walker.
- [ ] **Yorp, Garg, Slug** (secret level): use the generic walker/shooter AI; Keen 1 behaviours (garg charge, slug slime) missing.
- [ ] Truck Guy 1/2 trucks (drive, explode, driver jumps out) are coded but unused; the Barracks uses the drivers on foot.
- [ ] Bosses should gate progress (e.g. drop a key or open a door when killed). Today the player can run past them.

### Weapons / items
- [ ] Plutezarp and HR-32 should be found in the story (Plutezarp + HR-32 are used on the Shapeshifter in the epilogue). The HR-42 /
      Plutezarp are placed in level 16 for the final fight. Decide on "HR-42" vs "HR-32" naming (HUD vs doc/help).
- [ ] Plutezarp "deadly residue" (help text) is not implemented.
- [ ] notes.txt: the Shield was meant to be time-limited and upgraded by the Battery; the Ion Scanner "wasn't a thing" originally.
      Currently both are battery-powered gadgets. Decide whether to keep.
- [ ] Ocean level: "you need FULL health to make the landing, beat the devil and swim in the lava" – not enforced.

### Music
- [ ] New tracks for levels 10–16 (reused for now: Barracks = The Core, Missile Tower = Flooded Flashback, Ocean = Branching
      Out Remix, Secret = Branching Out, Castle Garden = Art of Gardens, Imperial Castle = Cistern, Rooftop = Rhythm of a Robot).

---

## Optional

- [ ] Hand-tune the generated levels in Tiled (they are deliberately medium complexity and about a quarter of the original sizes).
- [ ] World map: the castle island / secret island artwork and route for levels 12–16 (positions exist in `js/worldmap.js`).
- [x] Update the README / page guide (levels, enemies, item tables) to cover levels 10–16.
- [x] `resources/maps/` now has plain and `-full` PNGs for levels 10–16 (`python3 tools/render_level.py --maps …`). `docs/img` still only has the original enemy/item crops.
- [ ] Mid-level dialogue could also be used elsewhere (e.g. the Missile Tower "reprogram the missile" moment).
- [ ] Shared save data: Load Level for a level reached only by warp restores default stats (no weapons).
