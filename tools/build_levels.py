#!/usr/bin/env python3
"""Generate the placeholder levels 10-16 (resources/levels/level10-*.tmx ... level16-*.tmx).

    python3 tools/build_levels.py            # write the .tmx files
    python3 tools/build_levels.py --preview  # also render PNG previews to /tmp/isis/prev/ (needs Pillow)

Run `python3 tools/build_assets.py` afterwards so the game picks the levels up.

Levels are described on a logical grid (solid / one-way / water / lava / pole cells). Coordinates are tiles; rectangles
are inclusive. `floor` arguments are the row of the solid ground something stands on.

Graphics are built in passes, each one stacking on (or overwriting) the previous: background walls, terrain (kit blocks
with their edges), water/lava, poles, then explicit graphics (doors, props, signs). Terrain follows the original levels:
the block's left face is drawn on FG1 (one column outside the INFO solid, plus the edge column), its right face on BG2 one
column outside, one-way platforms are a two-row block on BG2. Anything later drawn on BG2 over a floor's top lip pushes the
lip down to BG1, so the ground runs continuously behind props and poles.
"""
import random
import sys
from functools import lru_cache

import tmxlib
from tmxlib import LAYERS, info, sprite, tile

T = lambda c, r: tile(c, r)


@lru_cache(maxsize=None)
def _sheet():
    from PIL import Image
    return Image.open(tmxlib.ROOT / "resources" / "tiles" / "tiles.png").convert("RGB")


@lru_cache(maxsize=None)
def blank(gid):
    """True if graphics tile gid is entirely colour-key green (so placing it would only erase what is underneath)."""
    im, i = _sheet(), gid - 1
    x0, y0 = (i % tmxlib.TILES_PER_ROW) * 16, (i // tmxlib.TILES_PER_ROW) * 16
    px = im.crop((x0, y0, x0 + 16, y0 + 16)).getdata()
    return all(abs(r - 129) < 8 and abs(g - 255) < 4 and abs(b - 44) < 8 for r, g, b in px)
EMPTY, SOLID, ONEWAY = 0, 1, 2

I_SOLID, I_ONEWAY, I_POLE, I_ENEMY_SOLID, I_ENEMY_LEFT, I_ENEMY_RIGHT = 2, 3, 25, 34, 35, 36
I_WATER, I_LAVA, I_DOOR, I_EXIT = 82, 84, 97, 128

# Sprite ids (S(n) in js/constants.js)
KEEN_R, KEEN_L, KEEN_R_WATER, EGA, CHECKPOINT = 1, 2, 3, 5, 50
KEYS = dict(red=14, yellow=15, green=16, cyan=17, blue=18, magenta=19)
DOOR_SPRITE = 33 - 14
BG, CLOUD = 20, 212
JB = [71, 72, 73, 74, 75, 76]
COLA, BURGER, GINGER, SUGAR, CEREAL = 91, 92, 93, 94, 95
PYAPA, PEETA, ISIS_FRUIT, NEPHTHYS, POTION, ONEUP = 128, 129, 130, 131, 132, 133
SHOES, SHIELD, BATTERY = 184, 169, 168
ZEFFER, PULSAR, SOLARIZER, HR42, PLUTEZARP, HARPOON, RAYGUN, NEURAL = 221, 222, 223, 224, 225, 226, 227, 228

# Enemy sprite ids and their height in tiles (they are placed standing on `floor` and settle under gravity)
FOOG, SPIDER, FROG, FROG_SWIM, DEMON = 77, 79, 80, 81, 86
REDFISH, CHOMPER, URCHIN, FLOPPY, YELLOWFISH, GREENFISH, BLUEFISH = 96, 97, 98, 99, 100, 101, 102
RAT, LEMMING, TRUCKGUY1, TRUCKGUY2, ROBOT_GREY, ROBOT_RED, FLASHER, HOVER = 115, 116, 119, 120, 121, 122, 123, 124
CATERPILLAR, SNAIL, BIGFROG, DRAGONFLY, BIRD, FOOG_WARRIOR, ROBO_GREY, ROBO_BLUE = 134, 135, 136, 137, 138, 139, 140, 141
SHAPESHIFTER, EVILKEEN = 142, 143
ISO_GREEN, ISO_RED, ISO_WHITE, ISO_FLY, DEVIL, YORP, GARG, SLUG = 153, 154, 155, 156, 159, 160, 161, 162
HEIGHT = {FOOG: 2, SPIDER: 2, FROG: 2, DEMON: 3, URCHIN: 2, RAT: 2, LEMMING: 3, TRUCKGUY1: 3, TRUCKGUY2: 3,
          ROBOT_GREY: 3, ROBOT_RED: 3, FLASHER: 3, HOVER: 3, CATERPILLAR: 3, SNAIL: 2, BIGFROG: 4, BIRD: 5,
          FOOG_WARRIOR: 3, ROBO_GREY: 4, ROBO_BLUE: 4, SHAPESHIFTER: 4, EVILKEEN: 3, ISO_GREEN: 3, ISO_RED: 3,
          ISO_WHITE: 3, DEVIL: 4, YORP: 2, GARG: 3, SLUG: 2}


class Kit:
    """Platform kit. Every theme on tiles.png repeats the jungle block layout relative to its top row r0 (mountain and cave
    sit one column further left: shift=1). Columns/rows of the block, as used by the original levels:

              10       11         12        13          14
        +0             top-left   top       top-right
        +1    sliver   surface    surface*  face
        +2    sliver   fill       fill*     step        face (2nd last row)
        +3    sliver   fill       corner    bottom-R    face (last row)

    (* = used in the right-most solid column). The sliver goes one column left of the INFO solid, the face one column right.
    Where a block's right face meets a lower floor of the same kit, the step piece (face + that floor's surface) replaces
    the face and the corner fill goes in the block's column one row down.
    """

    def __init__(self, r0, shift=0, alt=False):
        self.r0, self.shift = r0, shift
        self.top, self.surf, self.fill = self.t(12, 0), self.t(11, 1), self.t(11, 2)
        self.fill_alt = self.t(11, 3) if alt else self.fill

    def t(self, c, dr):
        return T(c - self.shift, self.r0 + dr)


KITS = {
    "jungle": Kit(1, alt=True),
    "jungle_dark": Kit(11),
    "mountain": Kit(53, 1),
    "cave": Kit(65, 1),
    "white": Kit(133),
    "blue": Kit(115),
    "green": Kit(159),
    "dungeon": Kit(178),
    "garden": Kit(213),
}

# Background (BG1) wall textures: f(x, y) -> tile
WALLS = {
    "blue": lambda x, y: T(x % 8, 125 + y % 4),
    "stone": lambda x, y: T(x % 32, 187 + y % 6),
    "lava": lambda x, y: T(x % 16, 193 + y % 6),
    "dirt": lambda x, y: T(11, 3),
    "dark": lambda x, y: T(26 + x % 2, 77 + y % 2),
}

# Multi-tile graphics: (col, row, width, height) on tiles.png
GFX = {
    "door_jungle": (6, 45, 2, 3),
    "door_base": (24, 149, 4, 3),
    "door_wood": (21, 179, 2, 3),
    "doorway_dark": (24, 179, 2, 3),
    "plant_pod": (16, 214, 5, 5),
    "plant_berry": (22, 213, 4, 4),
    "plant_flower": (26, 214, 5, 4),
    "garden_painting": (22, 218, 6, 6),
    "painting1": (0, 168, 6, 6),
    "painting2": (15, 163, 6, 8),
    "torch_yellow": (16, 193, 3, 5),
    "torch_blue": (19, 193, 3, 3),
    "cage": (26, 178, 2, 4),
    "cage_green": (28, 178, 2, 4),
    "cage_blue": (30, 178, 2, 4),
    "pipes_grey": (1, 130, 6, 3),
    "pipes_blue": (10, 130, 6, 3),
    "ship": (16, 148, 7, 3),
    "crane": (16, 151, 7, 7),
    "lab": (21, 164, 6, 4),
    "flasks": (21, 169, 8, 1),
    "monitor": (23, 160, 7, 2),
    "log_bridge": (1, 75, 3, 2),
}
# Graphics drawn in front of Keen by default (plants and bushes); everything else defaults to BG2
FG_GFX = {"plant_pod", "plant_berry", "plant_flower"}
# Alternative pieces a graphic picks at random per placement: (i, j, w, h) inside the graphic -> top-left [col, row] of
# the replacement on tiles.png. GFX_HOLES: cells inside the rectangle that belong to a neighbouring piece, never drawn.
GFX_ALT = {
    "plant_pod": [((0, 1, 2, 2), (16, 213)), ((0, 4, 4, 1), (16, 219))],   # other leaves; other grass
}


class LILY:
    """Garden lily pads (two rows: the top sits on the water's surface row, the bottom dips into the water). The primary
    pad is 4 wide with a berry cluster on its two middle columns; the blank pad stretches to any width (left cap, random
    middles, right cap) and takes berry clusters on its middle columns."""
    primary = [(17, 222), (18, 222), (19, 222), (20, 222)]
    left, mids, right = (10, 222), [(11, 222), (12, 222), (13, 222)], (14, 222)
    berry_l, berry_r = [(18, 222), (16, 222)], [(19, 222), (21, 222), (21, 223), (21, 224)]
    berry_pair = [(18, 221), (19, 221)]          # top row only
    berry_block = [(18, 224), (19, 224)]         # both rows


GFX_HOLES = {
    "plant_pod": [(0, 0), (1, 0)],   # the other leaves, beside the pod's crown
}


class Pole:
    """body: repeating tile(s) (alternate by row), top/bottom: end caps, hole: 3 tiles drawn on the row above a platform
    the pole passes through (pole in the middle one). Without a hole the platform's top lip is drawn in front instead."""

    def __init__(self, body, top=None, bottom=None, hole=None):
        self.body = [T(*b) for b in body]
        self.top = T(*top) if top else self.body[0]
        self.bottom = T(*bottom) if bottom else self.body[-1]
        self.hole = [T(*h) for h in hole] if hole else None


POLES = {
    "cyan": Pole([(31, 88)], (29, 88), (28, 88), [(25, 90), (26, 90), (27, 90)]),          # grey-rimmed hole
    "cyan_grass": Pole([(31, 88)], (29, 88), (28, 88), [(25, 88), (26, 88), (27, 88)]),    # green-rimmed hole
    "white": Pole([(31, 88)], (29, 88), (28, 88), [(25, 135), (26, 135), (27, 135)]),      # white-base floor hole
    "green": Pole([(21, 159)], (21, 158), (21, 160), [(18, 159), (19, 159), (20, 159)]),   # green-base floor hole
    "vine": Pole([(12, 91), (12, 92)]),
}
LAVA_SURF, LAVA_BODY = T(22, 71), T(22, 72)


class WATER:
    """Water block on tiles.png, as laid out in level 6: columns left edge / middle / right edge, rows top (back edge,
    drawn two rows above the water), surface (row above the water), body, bottom (row below the water)."""
    left, mid, right = 24, 25, 26
    top, surf, body, bottom = 70, 71, 72, 73
    wall_surf = T(28, 71)


class SGA:
    """Standard Galactic Alphabet font. Each glyph fills half a tile: letter k (a=0) is at column col + k % 13, row
    left + k // 13 (glyph in the left half) or right + k // 13 (right half). plain: blank board for a half with no letter.
    frame: the board's rim, drawn one tile outside the text (tl, t, tr, l, r, bl, b, br), b_post: bottom with a post,
    post: post foot standing on the floor."""

    def __init__(self, col, left, right, plain=None, frame=None, b_post=None, post=None):
        self.col, self.left, self.right = col, left, right
        self.plain = T(*plain) if plain else None
        self.frame = {k: T(*v) for k, v in frame.items()} if frame else None
        self.b_post, self.post = (T(*b_post), T(*post)) if b_post else (None, None)

    def glyph(self, ch, right):
        k = ord(ch) - 97
        return T(self.col + k % 13, (self.right if right else self.left) + k // 13)


SIGNS = {
    "wood": SGA(0, 22, 24, plain=(20, 23), b_post=(20, 24), post=(18, 25),
                frame=dict(tl=(19, 22), t=(20, 22), tr=(21, 22), l=(19, 23), r=(21, 23), bl=(19, 24), b=(17, 24),
                           br=(21, 24))),
    "blue": SGA(19, 143, 145),
}


class Level:
    def __init__(self, w, h, kit, bg, pole="cyan"):
        self.w, self.h, self.kit = w, h, KITS[kit]
        self.grid = [[EMPTY] * w for _ in range(h)]
        self.gkit = [[None] * w for _ in range(h)]
        self.wall = [[None] * w for _ in range(h)]
        self.water, self.lava, self.poles = set(), set(), set()
        self.info_ops, self.ops = {}, []  # explicit INFO cells; explicit graphics (layer, x, y, gid), drawn last
        self.lilies = {}                  # (x, y) -> gid of lily pad tiles, drawn on BG2 before the water
        self.L = {n: [[0] * w for _ in range(h)] for n in LAYERS}
        self.pole_style = POLES[pole]
        self.no_block = set()
        self.sprite(0, 0, BG + bg)

    # --- terrain -----------------------------------------------------------------------------------
    def rect(self, x0, y0, x1, y1, kind=SOLID, kit=None):
        for y in range(max(0, min(y0, y1)), min(self.h, max(y0, y1) + 1)):
            for x in range(max(0, min(x0, x1)), min(self.w, max(x0, x1) + 1)):
                self.grid[y][x] = kind
                self.gkit[y][x] = KITS[kit] if kit else None
        return self

    def solid(self, x0, y0, x1, y1, kit=None):
        return self.rect(x0, y0, x1, y1, SOLID, kit)

    def clear(self, x0, y0, x1, y1):
        return self.rect(x0, y0, x1, y1, EMPTY)

    def ground(self, x0, x1, y, kit=None):
        return self.solid(x0, y, x1, self.h - 1, kit)

    def ow(self, x0, x1, y, kit=None):
        return self.rect(x0, y, x1, y, ONEWAY, kit)

    def lily(self, x, y, w=4, berries=0.7, layer=None):
        """Lily pad w wide (>= 2) floating on the water whose surface row is y + 1 (the bank's surface row: pass the
        bank's floor - 1); its bottom row lies in the water's surface band and is one-way, so Keen stands level with
        the bank. Width 4 is the primary pad (always with berries); other widths are a blank pad with a berry cluster
        on each spare pair of middle columns, at chance `berries`. Variants are random, seeded by position. With
        `layer` it is a plain decoration on that layer (e.g. on land: y = floor - 2), no INFO."""
        rng = random.Random(f"lily:{x},{y},{w}")
        if w == 4:
            top, slots = list(LILY.primary), [1]
        else:
            top = [LILY.left] + [rng.choice(LILY.mids) for _ in range(w - 2)] + [LILY.right]
            slots = [i for i in range(1, w - 2, 3) if rng.random() < berries]
        bottom = [(c, r + 1) for c, r in top]
        if w == 3 and rng.random() < berries:
            top[1] = rng.choice(LILY.berry_l[1:] + LILY.berry_r[1:])   # the single-tile berries
        for i in slots:
            kind = rng.choice(("single", "single", "pair", "block"))
            if kind == "block":
                top[i:i + 2] = LILY.berry_block
                bottom[i:i + 2] = [(c, r + 1) for c, r in LILY.berry_block]
            elif kind == "pair":
                top[i:i + 2] = LILY.berry_pair
            else:
                top[i:i + 2] = [rng.choice(LILY.berry_l), rng.choice(LILY.berry_r)]
        for i in range(w):
            if layer:
                self.put(layer, x + i, y, T(*top[i])).put(layer, x + i, y + 1, T(*bottom[i]))
                continue
            self.lilies[(x + i, y)] = T(*top[i])
            self.lilies[(x + i, y + 1)] = T(*bottom[i])
            self.info(x + i, y + 1, I_ONEWAY)
        return self

    def bgwall(self, x0, y0, x1, y1, style):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.wall[y][x] = WALLS[style]
        return self

    def pole(self, x, y0, y1):
        for y in range(y0, y1 + 1):
            self.poles.add((x, y))
        return self

    def fill_water(self, x0, y0, x1, y1, lava=False):
        self.clear(x0, y0, x1, y1)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                (self.lava if lava else self.water).add((x, y))
        return self

    # --- things --------------------------------------------------------------------------------------
    def sprite(self, x, y, n):
        self.L["Sprites"][y][x] = sprite(n)
        return self

    def info(self, x, y, n):
        self.info_ops[(x, y)] = n
        return self

    def put(self, layer, x, y, gid):
        self.ops.append((layer, x, y, gid))
        return self

    def gfx(self, name, x, y, layer=None):
        layer = layer or ("FG1" if name in FG_GFX else "BG2")
        c, r, gw, gh = GFX[name]
        holes = GFX_HOLES.get(name, [])
        src = {(i, j): (c + i, r + j) for j in range(gh) for i in range(gw) if (i, j) not in holes}
        rng = random.Random(f"{name}:{x},{y}")
        for (ai, aj, aw, ah), (ac, ar) in GFX_ALT.get(name, []):
            if rng.random() < 0.5:
                src.update({(ai + i, aj + j): (ac + i, ar + j) for j in range(ah) for i in range(aw)})
        for (i, j), (sc, sr) in src.items():
            if not blank(T(sc, sr)):
                self.put(layer, x + i, y + j, T(sc, sr))
        return self

    def gfx_on(self, name, x, floor, layer=None):
        """Graphic standing on the floor (bottom row just above it)."""
        return self.gfx(name, x, floor - GFX[name][3], layer)

    def start(self, x, floor, left=False):
        return self.sprite(x, floor - 3, KEEN_L if left else KEEN_R)

    def start_water(self, x, y):
        return self.sprite(x, y, KEEN_R_WATER)

    def checkpoint(self, x, floor):
        return self.sprite(x, floor - 3, CHECKPOINT)

    def enemy(self, x, floor, n, facing=0):
        y = floor - HEIGHT.get(n, 3)
        self.sprite(x, y, n)
        if facing:
            self.info(x, y, I_ENEMY_LEFT if facing < 0 else I_ENEMY_RIGHT)
        return self

    def flyer(self, x, y, n):
        return self.sprite(x, y, n)

    def items(self, x0, x1, y, n, step=2):
        for x in range(x0, x1 + 1, step):
            self.sprite(x, y, n)
        return self

    def beans(self, x0, x1, y, step=2):
        for i, x in enumerate(range(x0, x1 + 1, step)):
            self.sprite(x, y, JB[(x0 + i) % len(JB)])
        return self

    def arc(self, x0, y0, n, n_item=None):
        """A little arc of items (rising then falling), e.g. over a gap."""
        for i in range(n):
            dy = -min(i, n - 1 - i)
            self.sprite(x0 + 2 * i, y0 + dy, n_item or JB[i % len(JB)])
        return self

    def key(self, x, floor, colour):
        return self.sprite(x, floor - 2, KEYS[colour])

    def lock(self, x, floor, colour, wall_top=None, kit=None):
        """Locked door (32x64 sprite) with the three INFO-solid cells it clears when opened. wall_top: also build the wall
        above the door (x..x+1, wall_top..floor-4) so it can't be jumped over."""
        self.clear(x, floor - 3, x, floor - 1)
        self.sprite(x, floor - 3, KEYS[colour] + DOOR_SPRITE)
        for y in range(floor - 3, floor):
            self.info(x, y, I_SOLID)
        if wall_top is not None:
            self.solid(x, wall_top, x + 1, floor - 4, kit)
        return self

    def door(self, n, a, b, gfx=None):
        """Two-way door n (1-8) between a=(x, floor) and b=(x, floor): press up on the 2-tile-wide spot to warp."""
        for x, floor in (a, b):
            self.info(x, floor - 2, I_DOOR + 2 * (n - 1))
            self.info(x + 1, floor - 2, I_DOOR + 2 * (n - 1) + 1)
            self.no_block.update({(x, floor - 1), (x + 1, floor - 1)})
            if gfx:
                gw = GFX[gfx][2]
                self.gfx_on(gfx, x - (gw - 2) // 2, floor)
        return self

    def exit(self, x, floor, n, height=4, gfx=None, width=2):
        for y in range(floor - height, floor):
            for i in range(width):
                self.info(x + i, y, I_EXIT + n)
        if gfx:
            gw = GFX[gfx][2]
            self.gfx_on(gfx, x - (gw - width) // 2, floor)
        return self

    def sign(self, x, y, text, style="wood", layers=("BG1", "BG2"), frame=None, post=False):
        """Standard Galactic Alphabet text from (x, y), two letters per tile: the left letter's left-half glyph on
        layers[0], the right letter's right-half glyph on layers[1]. Lines split on newlines; anything but a-z is a space.
        A tile with a single letter puts it on layers[1] over the plain board (if the style has one) on layers[0].
        frame (default: if the style has one) draws the board's rim one tile outside the text on layers[1]; post puts a
        post under its middle, two rows below the text."""
        st, (lo, hi) = SIGNS[style], layers
        lines = text.lower().split("\n")
        w, h = max((len(s) + 1) // 2 for s in lines), len(lines)
        letter = lambda ch: "a" <= ch <= "z"
        for j, line in enumerate(lines):
            line = line.ljust(2 * w)
            for i in range(w):
                a, b = line[2 * i], line[2 * i + 1]
                if letter(a) and letter(b):
                    self.put(lo, x + i, y + j, st.glyph(a, False)).put(hi, x + i, y + j, st.glyph(b, True))
                    continue
                if st.plain:
                    self.put(lo, x + i, y + j, st.plain)
                if letter(a) or letter(b):
                    self.put(hi, x + i, y + j, st.glyph(a, False) if letter(a) else st.glyph(b, True))
        if frame or (frame is None and st.frame):
            f, mid = st.frame, x + (w - 1) // 2
            self.put(hi, x - 1, y - 1, f["tl"]).put(hi, x + w, y - 1, f["tr"])
            self.put(hi, x - 1, y + h, f["bl"]).put(hi, x + w, y + h, f["br"])
            for i in range(w):
                self.put(hi, x + i, y - 1, f["t"])
                self.put(hi, x + i, y + h, st.b_post if post and x + i == mid else f["b"])
            for j in range(h):
                self.put(hi, x - 1, y + j, f["l"]).put(hi, x + w, y + j, f["r"])
            if post:
                self.put(hi, mid, y + h + 1, st.post)
        return self

    def sign_on(self, x, floor, text, style="wood", layers=("BG1", "BG2")):
        """Framed sign on a post standing on the floor; x is the first text tile."""
        return self.sign(x, floor - 2 - len(text.split("\n")), text, style, layers, frame=True, post=True)

    def stamp(self, src, sx, sy, sw, sh, dx, dy, layers=("BG1", "BG2", "FG1", "FG2")):
        """Copy graphics from another tmx file (path) region."""
        _, _, sl = tmxlib.read_tmx(src)
        for name in layers:
            for j in range(sh):
                for i in range(sw):
                    v = sl[name][sy + j][sx + i]
                    if v and v <= tmxlib.TILES:
                        self.put(name, dx + i, dy + j, v)
        return self

    def border(self):
        for x in range(self.w):
            for y in (0, self.h - 1):
                if self.grid[y][x] == EMPTY and (x, y) not in self.info_ops:
                    self.info_ops[(x, y)] = I_SOLID
        for y in range(self.h):
            for x in (0, self.w - 1):
                if self.grid[y][x] == EMPTY and (x, y) not in self.info_ops:
                    self.info_ops[(x, y)] = I_SOLID
        return self

    # --- output --------------------------------------------------------------------------------------
    def is_floor(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h and self.grid[y][x] != EMPTY

    def inside(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def crossing(self, x, y):
        """Pole cell passing through a platform (platform on both sides): drawn as platform, with the pole behind it."""
        G = self.grid
        return (x, y) in self.poles and G[y][x] == EMPTY and 0 < x < self.w - 1 \
            and G[y][x - 1] != EMPTY and G[y][x + 1] != EMPTY

    def terrain_cells(self):
        """Cells drawn as terrain -> (kit, front). front: solid ground, whose left face goes on FG1. One-way platforms get
        a second graphics row below them (they are drawn as a thin block)."""
        G, cells = self.grid, {}
        for y in range(self.h):
            for x in range(self.w):
                if G[y][x] != EMPTY:
                    cells[(x, y)] = (self.gkit[y][x] or self.kit, G[y][x] == SOLID)
        for (x, y) in self.poles:
            if self.crossing(x, y):
                k, front = cells[(x - 1, y)]
                cells[(x, y)] = (k, front and cells[(x + 1, y)][1])
        for (x, y), (k, front) in list(cells.items()):
            if not front and y + 1 < self.h and (x, y + 1) not in cells and G[y][x] == ONEWAY:
                cells[(x, y + 1)] = (k, False)
        return cells

    def render(self):
        L, G = self.L, self.grid
        lip = set()   # cells whose BG2 is a floor's top lip; anything later drawn on BG2 there pushes the lip to BG1

        def bg2(x, y, gid):
            if (x, y) in lip:
                L["BG1"][y][x] = L["BG2"][y][x]
                lip.discard((x, y))
            L["BG2"][y][x] = gid

        # 1. background walls
        for y in range(self.h):
            for x in range(self.w):
                if self.wall[y][x]:
                    L["BG1"][y][x] = self.wall[y][x](x, y)

        # 2. terrain: block body, left face (FG1 for solid ground), right face, then the top lips
        cells = self.terrain_cells()
        on = lambda x, y: (x, y) in cells or not self.inside(x, y)   # the map edge counts as solid: no faces there
        faces, lips, corners, steps = [], [], [], set()
        for (x, y), (k, front) in sorted(cells.items(), key=lambda c: (c[0][1], c[0][0])):
            top, bottom = not on(x, y - 1), not on(x, y + 1)
            left, right = not on(x - 1, y), not on(x + 1, y)
            if top:
                t = k.surf if not right or left else k.t(12, 1)
            elif bottom and right:
                t = k.t(13, 3)
            elif right:
                t = k.t(12, 2)
            else:
                t = k.fill if (x // 2 + y // 3) % 3 else k.fill_alt
            edge = "FG1" if front else "BG2"
            L[edge if left else "BG2"][y][x] = t
            if left and x > 0:
                L[edge][y][x - 1] = k.t(10, 1 if top else 3 if bottom else 2)
                if front and cells.get((x - 1, y + 1)) == (k, True) and on(x, y + 1):
                    # inner corner: the left face carries on in front of the lower floor's surface row
                    corners += [("FG1", x - 1, y + 1, k.t(10, 2)), ("FG1", x, y + 1, k.t(11, 2))]
            if right and x + 1 < self.w:
                if cells.get((x + 1, y + 1)) == (k, True):
                    # inner corner: the face comes down onto a lower floor (step piece: face + that floor's surface)
                    f = k.t(13, 2)
                    steps.add((x + 1, y))
                    if on(x, y + 1) and on(x - 1, y + 1):
                        corners.append(("BG2", x, y + 1, k.t(12, 3)))
                elif bottom:
                    f = k.t(14, 3)
                elif not on(x, y + 2):
                    f = k.t(14, 2)       # second-last row: the face tapers off
                else:
                    f = k.t(13, 1)
                faces.append((x + 1, y, f))
            if top and y > 0:
                lips.append((x, y - 1, k.t(11, 0) if left and not right else k.top))
                if right and x + 1 < self.w and not on(x + 1, y - 1):
                    lips.append((x + 1, y - 1, k.t(13, 0)))
        for x, y, f in faces:
            if not on(x, y):
                L["BG2"][y][x] = f
        for layer, x, y, t in corners:
            L[layer][y][x] = t
        for x, y, t in lips:
            if on(x, y) or (x, y) in steps:
                continue
            if L["BG2"][y][x]:
                L["BG1"][y][x] = t       # behind another block's face
            else:
                L["BG2"][y][x] = t
                lip.add((x, y))

        # 3. water: a block like the terrain kits (see WATER). Body and edges on TransFG; the surface row (the row above
        #    the water) also on BG2, and the top row above that on BG2 only. Half-tile edges: the left one goes one
        #    column outside the water, the right one in its last column; the bottom edge one row below the water.
        #    The water's top and surface go behind anything already on BG2 (one-way pads standing in it), except at the
        #    left bank: its face and lip give way to the water's corner, and the surface's left edge covers the bank's
        #    last column (bank tile moved to BG1), whether the bank is level with the surface or rises above it. Against a wall rising out of the water on the right, the water runs up to the wall's
        #    sliver with middle pieces and the half-width surface WATER.wall_surf.
        #    Lily pads go on BG2 first, so the water's surface lands behind them.
        for (x, y), gid in self.lilies.items():
            L["BG2"][y][x] = gid
        wet = lambda x, y: (x, y) in self.water and self.inside(x, y) and G[y][x] == EMPTY

        def tfg(x, y, gid):
            if self.inside(x, y):
                L["TransFG"][y][x] = gid

        def behind(x, y, gid, front=False):
            if not self.inside(x, y):
                return
            if not L["BG2"][y][x]:
                L["BG2"][y][x] = gid
            elif front:
                if (x, y) in cells or not L["BG1"][y][x]:
                    L["BG1"][y][x] = L["BG2"][y][x]
                L["BG2"][y][x] = gid
            elif not L["BG1"][y][x]:
                L["BG1"][y][x] = gid

        W = WATER
        for (x, y) in sorted(self.water):
            if not wet(x, y):
                continue
            first, last = not wet(x - 1, y), not wet(x + 1, y)
            top = y
            while wet(x, top - 1):
                top -= 1
            wall_r = last and on(x + 1, top - 2)
            col = W.right if last and not wall_r else W.mid
            rows = [(y, W.body)] + ([(y + 1, W.bottom)] if not wet(x, y + 1) else [])
            for yy, r in rows:
                tfg(x, yy, T(col, r))
                if first:
                    tfg(x - 1, yy, T(W.left, r))
            if wet(x, y - 1) or not self.inside(x, y - 1) or G[y - 1][x] != EMPTY:
                continue
            tfg(x, y - 1, W.wall_surf if wall_r else T(col, W.surf))
            behind(x, y - 1, T(col, W.surf), first)
            if first:
                tfg(x - 1, y - 1, T(W.left, W.surf))
                behind(x - 1, y - 1, T(W.left, W.surf), True)
            behind(x, y - 2, T(W.mid if first else W.right, W.top), first)
            if last and not wall_r and self.inside(x + 1, y - 2) and (x + 1, y - 2) not in cells:
                L["BG2" if not L["BG2"][y - 2][x + 1] else "BG1"][y - 2][x + 1] = T(W.right + 1, W.top)
        for (x, y) in self.lilies:
            if (x, y + 1) in self.lilies:
                L["TransFG"][y][x] = 0      # the pad's top floats above the surface; its bottom row stays tinted
        for (x, y) in self.lava:
            if G[y][x] != EMPTY:
                continue
            L["TransFG"][y][x] = LAVA_BODY
            if (x, y - 1) not in self.lava and G[y - 1][x] == EMPTY:
                L["TransFG"][y - 1][x] = LAVA_SURF

        # 4. poles: behind platforms they pass through (platform moved to FG1, a hole on the row above)
        P = self.pole_style
        for (x, y) in sorted(self.poles):
            body = P.body[y % len(P.body)]
            if (x, y) in cells and G[y][x] == EMPTY:
                if not L["FG1"][y][x]:
                    L["FG1"][y][x] = L["BG2"][y][x]
                L["BG2"][y][x] = body
            elif G[y][x] != EMPTY:
                L["FG1"][y][x] = body
            elif self.inside(x, y + 1) and (x, y + 1) in cells and self.crossing(x, y + 1):
                if P.hole:
                    for i, h in enumerate(P.hole):
                        L["BG2"][y][x - 1 + i] = h
                        lip.discard((x - 1 + i, y))
                else:
                    L["FG1"][y][x] = L["BG2"][y][x]
                    lip.discard((x, y))
                    L["BG2"][y][x] = body
            else:
                if (x, y - 1) not in self.poles and not on(x, y - 1):
                    body = P.top
                elif (x, y + 1) not in self.poles and not on(x, y + 1):
                    body = P.bottom
                bg2(x, y, body)

        # 5. explicit graphics (doors, props, signs, stamps), in the order they were added
        for layer, x, y, gid in self.ops:
            if self.inside(x, y):
                if layer == "BG2":
                    bg2(x, y, gid)
                else:
                    L[layer][y][x] = gid

        # 6. INFO
        for y in range(self.h):
            for x in range(self.w):
                if G[y][x] != EMPTY:
                    L["Info"][y][x] = info(I_SOLID if G[y][x] == SOLID else I_ONEWAY)
        for (x, y) in self.water | self.lava:
            if G[y][x] == EMPTY:
                L["Info"][y][x] = info(I_LAVA if (x, y) in self.lava else I_WATER)
        for (x, y) in self.poles:
            L["Info"][y][x] = info(I_POLE)
        for (x, y), n in self.info_ops.items():
            L["Info"][y][x] = info(n)
        # Invisible enemy blockers past the end of each walkable ledge
        for y in range(1, self.h - 1):
            for x in range(1, self.w - 1):
                if G[y][x] != EMPTY or L["Info"][y][x] or G[y + 1][x] != EMPTY or (x, y) in self.no_block:
                    continue
                if (x, y + 1) in self.water or (x, y + 1) in self.lava:
                    continue
                for nx in (x - 1, x + 1):
                    if G[y + 1][nx] != EMPTY and G[y][nx] == EMPTY:
                        L["Info"][y][x] = info(I_ENEMY_SOLID)
        return L

    def save(self, name):
        self.border()
        path = tmxlib.ROOT / "resources" / "levels" / name
        tmxlib.write_tmx(path, self.w, self.h, self.render())
        return path


# =====================================================================================================
# Level 10 - Barracks: an Isonian base building (white platforms, blue panel walls). Red key on the top floor opens
# the way out on the ground floor. A side door leads up onto the roof for a bonus.
# =====================================================================================================
def level10():
    lv = Level(150, 46, "white", 6, pole="white")
    G = 40
    lv.ground(0, 149, G)
    lv.bgwall(22, 14, 128, G - 1, "blue")
    lv.solid(20, 12, 130, 13)                 # roof (walkable on top)
    lv.solid(20, 14, 21, G - 5)               # left wall, entrance below
    lv.solid(129, 14, 130, G - 5)             # right wall, exit below
    lv.sign_on(8, G, "barracks")
    # floor 2 (y=31) with a pole hole at x=40, floor 3 (y=22) with a pole hole at x=100 and a drop at 114..117
    lv.solid(22, 31, 110, 32).clear(40, 31, 40, 32)
    lv.solid(30, 22, 128, 23).clear(100, 22, 100, 23).clear(114, 22, 117, 23)
    lv.pole(40, 24, G - 1).pole(100, 15, 30)
    # inner wall in front of the exit with the red door
    lv.solid(124, 24, 125, G - 4)
    lv.lock(124, G, "red")
    lv.exit(140, G, 11, gfx="door_base")
    # roof bonus via a two-way door
    lv.door(1, (70, G), (60, 12), gfx="door_base")
    lv.solid(54, 1, 55, 11).solid(98, 1, 99, 11)   # keep the roof bonus area closed off
    lv.beans(64, 90, 9, 2).sprite(92, 10, PULSAR).checkpoint(80, 12)
    # decoration
    lv.gfx_on("pipes_grey", 26, G).gfx_on("pipes_blue", 80, 31).gfx_on("monitor", 44, 22).gfx_on("lab", 60, G)
    lv.gfx_on("flasks", 52, G)
    # items
    lv.start(3, G)
    lv.beans(24, 36, G - 3).items(48, 56, G - 3, COLA, 4)
    lv.sprite(30, 28, ZEFFER).beans(44, 58, 28).items(72, 84, 28, BURGER, 6).sprite(104, 28, PYAPA)
    lv.key(34, 22, "red").beans(40, 60, 19).items(76, 92, 19, SUGAR, 4).sprite(122, 19, NEPHTHYS)
    lv.beans(84, 120, G - 3, 3).checkpoint(96, 31)
    # enemies
    lv.enemy(52, G, LEMMING).enemy(92, G, TRUCKGUY1).enemy(110, G, RAT)
    lv.enemy(70, 31, ROBOT_GREY).enemy(86, 31, RAT)
    lv.enemy(60, 22, ROBOT_RED).enemy(110, 22, LEMMING).enemy(80, 22, TRUCKGUY2)
    lv.enemy(144, G, LEMMING, -1)
    return lv.save("level10-barracks.tmx")


# =====================================================================================================
# Level 11 - Missile Tower: climb the tower (poles and platform stairs) floor by floor; the yellow key halfway up opens
# the launch deck, where Robo Grey guards the missile and the exit.
# =====================================================================================================
def level11():
    W, H, G = 82, 112, 106
    lv = Level(W, H, "white", 1, pole="white")
    lv.ground(0, W - 1, G, "mountain")
    lv.sprite(1, 30, CLOUD).sprite(2, 70, CLOUD)
    L, R = 24, 57                              # outer walls (2 thick)
    lv.bgwall(L + 2, 12, R - 1, G - 1, "blue")
    lv.solid(L, 1, L + 1, G - 5).solid(R, 1, R + 1, G - 5)
    floors = [94, 82, 70, 58, 46, 34, 22]
    for i, fy in enumerate(floors):
        lv.solid(L + 2, fy, R - 1, fy + 1)
        left_gap = i % 2 == 1
        gx0 = L + 2 if left_gap else R - 5
        lv.clear(gx0, fy, gx0 + 3, fy + 1)
        below = G if i == 0 else floors[i - 1]
        if i % 3 == 2:   # platform stairs up through the gap
            sx = gx0 - 6 if not left_gap else gx0 + 4
            for k, py in enumerate(range(below - 3, fy - 1, -3)):
                px = gx0 if k % 2 == 0 else sx
                lv.ow(px, px + 3, py)
        else:            # pole up through the gap
            px = gx0 + 1
            lv.pole(px, fy - 4, below - 1)
    # launch deck above the top floor: Robo Grey, yellow door, exit
    top = floors[-1]                           # arrive through the right-hand gap; door and exit are on the left
    lv.solid(34, 1, 35, top - 4).lock(34, top, "yellow")
    lv.gfx_on("ship", 39, top)
    lv.exit(28, top, 12, gfx="door_base")
    lv.enemy(44, top, ROBO_GREY, -1)
    # outside: start, a lemming and some sky decoration
    lv.start(4, G)
    lv.enemy(14, G, LEMMING).enemy(70, G, LEMMING)
    lv.beans(6, 20, G - 3, 2).sprite(72, G - 3, ZEFFER)
    # inside
    lv.enemy(36, G, ROBOT_GREY).enemy(44, 94, LEMMING).enemy(34, 82, RAT).enemy(40, 70, ROBOT_RED)
    lv.enemy(44, 58, ROBO_BLUE).enemy(32, 46, TRUCKGUY1).enemy(50, 34, ROBOT_GREY)
    lv.flyer(40, 62, ISO_FLY).flyer(36, 38, ISO_FLY)
    lv.key(50, 58, "yellow")
    lv.checkpoint(40, 58)
    lv.gfx_on("monitor", 30, G).gfx_on("pipes_blue", 40, 82).gfx_on("lab", 34, 46).gfx_on("pipes_grey", 36, 34)
    for i, fy in enumerate(floors):
        lv.beans(30 + (i % 2) * 6, 50 - (1 - i % 2) * 6, fy - 3, 3)
    lv.items(30, 50, 76, COLA, 10).items(30, 50, 52, BURGER, 10).sprite(52, 40, PULSAR).sprite(30, 28, POTION)
    return lv.save("level11-missile_tower.tmx")


# =====================================================================================================
# Level 12 - Ocean Moat: swim across to the island (exit to 14). Below the sea floor a fork: "take the blue pill" leads back
# up, "take the red pill" leads down into the lava grotto with the Devil, the Solarizer and the secret exit (to 13).
# =====================================================================================================
def level12():
    W, H = 172, 66
    lv = Level(W, H, "mountain", 5)
    WT, SEA = 8, 44                            # water surface row, sea floor
    lv.fill_water(1, WT, W - 2, H - 2)
    lv.ground(0, W - 1, SEA)
    # sea floor bumps and rock spires
    for x0, x1, top in ((18, 24, 40), (40, 44, 30), (62, 70, 38), (84, 87, 26), (118, 125, 34), (140, 146, 39)):
        lv.solid(x0, top, x1, SEA)
    lv.solid(52, 3, 55, 22).solid(104, 4, 107, 20).solid(130, 2, 132, 24)
    # island and normal exit
    lv.solid(156, WT - 1, W - 1, H - 1)
    lv.gfx_on("plant_berry", 157, WT - 1)
    lv.exit(166, WT - 1, 14, height=5)
    lv.sign_on(162, WT - 1, "castle")
    # secret (everything below the sea floor is flooded; the water set already covers it, carving is enough):
    # a shaft at 96..99 down to the fork corridor; blue pill (left) loops back up, red pill (right) goes down
    lv.clear(96, SEA, 99, 49).clear(60, 50, 139, 55).clear(60, SEA, 63, 49)
    lv.bgwall(60, 50, 139, 55, "lava")
    lv.sign(76, 51, "take the blue pill", "blue").sign(102, 51, "take the red pill")
    lv.clear(136, 56, 139, 57).clear(100, 58, 150, 62)
    lv.bgwall(100, 56, 150, 62, "lava")
    for x0 in (114, 126):
        lv.fill_water(x0, 63, x0 + 3, 64, lava=True)
    lv.exit(101, 63, 13, height=5)
    lv.sprite(106, 60, SOLARIZER).items(115, 127, 60, ISIS_FRUIT, 4).sprite(144, 60, POTION)
    lv.enemy(110, 63, DEVIL, -1)
    # start and sea life
    lv.start_water(4, 10)
    for x, y, n in ((20, 16, REDFISH), (34, 34, CHOMPER), (48, 12, FLOPPY), (66, 24, YELLOWFISH), (78, 36, GREENFISH),
                    (92, 14, REDFISH), (112, 30, BLUEFISH), (124, 16, CHOMPER), (138, 30, FLOPPY), (148, 14, REDFISH),
                    (120, 53, REDFISH), (72, 52, YELLOWFISH)):
        lv.flyer(x, y, n)
    lv.enemy(74, SEA, URCHIN).enemy(134, SEA, URCHIN)
    lv.beans(8, 30, 12, 3).beans(44, 60, 26, 2).beans(88, 100, 40, 2).items(108, 116, 12, ISIS_FRUIT, 4)
    lv.beans(64, 90, 52, 3).sprite(62, 46, HARPOON).items(140, 150, 20, COLA, 5)
    return lv.save("level12-ocean.tmx")


# =====================================================================================================
# Level 13 - Secret Island: Keen 1/4 novelty with EGA Keen, Yorps, Gargs and Slugs, the Raygun and the Neural Stunner.
# The cyan key on the cliff top opens the gate to the exit.
# =====================================================================================================
def level13():
    W, H, G = 124, 42, 34
    lv = Level(W, H, "jungle", 1)
    lv.sprite(1, 1, EGA)
    lv.ground(0, W - 1, G)
    lv.solid(18, 31, 28, G).solid(32, 28, 38, G)
    lv.clear(44, G, 54, G).fill_water(44, G + 1, 54, G + 4)
    lv.solid(43, G + 5, 55, H - 1)
    for x0, x1, y in ((58, 62, 30), (64, 68, 26), (58, 62, 22), (66, 70, 18)):
        lv.ow(x0, x1, y, "jungle_dark")
    lv.solid(74, 16, 96, G)                   # the cliff, with a cave opening on its left face
    lv.clear(74, 24, 90, 30).bgwall(75, 24, 90, 30, "dark")
    lv.solid(106, 1, 107, G - 4).lock(106, G, "cyan")
    lv.exit(116, G, 14, gfx="door_jungle")
    lv.stamp(tmxlib.ROOT / "custom_maps" / "sample.tmx", 45, 5, 13, 12, 20, 19)
    lv.start(3, G)
    lv.sprite(12, G - 3, RAYGUN).sprite(86, 28, NEURAL)
    lv.key(92, 16, "cyan")
    lv.beans(20, 28, 28).beans(32, 38, 25).arc(44, 30, 6).beans(58, 70, 15, 3).beans(98, 104, G - 3)
    lv.items(80, 84, 28, ONEUP, 4).sprite(110, G - 3, NEPHTHYS)
    lv.enemy(10, G, YORP).enemy(36, 28, YORP).enemy(60, G, YORP).enemy(100, G, YORP)
    lv.enemy(24, 31, GARG).enemy(88, 16, GARG).enemy(70, G, GARG)
    lv.enemy(40, G, SLUG).enemy(82, 31, SLUG).enemy(112, G, SLUG)
    return lv.save("level13-secret.tmx")


# =====================================================================================================
# Level 14 - Castle Garden: hedges, a pond, garden critters; the green key on the hedge stairs opens the castle gate.
# =====================================================================================================
def level14():
    D = 64                                    # the lake stretch; everything from x = 118 on sits D further right
    W, H, G = 152 + D, 46, 38
    lv = Level(W, H, "garden", 7)
    lv.ground(0, W - 1, G)
    lv.solid(15, 35, 20, G).solid(26, 32, 31, G)
    lv.ow(34, 38, 29).ow(41, 45, 26).ow(34, 38, 23).ow(41, 46, 20)
    # pond with lily pads
    lv.clear(52, G, 70, G).fill_water(52, G + 1, 70, G + 4)
    lv.lily(55, G - 1, 4).lily(62, G - 1, 5)
    # tall hedge with steps
    lv.ow(92, 95, 34).ow(96, 99, 31)
    lv.solid(100, 28, 106, G)
    lv.solid(112, 34, 116, G)
    # the lake: large pool before the castle, crossed on lily pads (gaps of 3)
    lv.clear(124, G, 170, G).fill_water(124, G + 1, 170, H - 2)
    for x, w in ((127, 4), (134, 6), (143, 3), (149, 9), (161, 4), (167, 3)):
        lv.lily(x, G - 1, w)
    # the castle: stone facade, gate (green door) and the entrance hall with the exit
    C = 128 + D
    lv.bgwall(C, 12, W - 2, G - 1, "stone")
    lv.solid(C, 8, W - 1, 11, "dungeon")
    for x in range(C, W - 1, 4):
        lv.solid(x, 6, x + 1, 7, "dungeon")
    lv.solid(C, 12, C + 1, G - 4, "dungeon").lock(C, G, "green")
    lv.ground(C, W - 1, G, "dungeon")
    lv.exit(145 + D, G, 15, gfx="doorway_dark")
    lv.gfx_on("torch_yellow", 134 + D, G - 2).gfx_on("torch_yellow", 140 + D, G - 2)
    # decoration
    lv.gfx_on("plant_berry", 76, G).gfx_on("plant_flower", 120 + D, G)
    lv.lily(84, G - 2, 4, layer="FG1").gfx_on("plant_flower", 44, G)
    for x in (6, 21, 32, 71, 88, 107, 118, 175):
        lv.gfx_on("plant_pod", x, G)
    # items and enemies
    lv.start(3, G)
    lv.key(43, 20, "green")
    lv.beans(16, 20, 32).beans(26, 31, 29).beans(34, 38, 26).items(41, 45, 23, PEETA, 2)
    lv.arc(54, 33, 8).items(100, 106, 25, ISIS_FRUIT, 3).beans(112, 116, 31).sprite(124 + D, G - 3, POTION)
    lv.enemy(24, G, FROG).enemy(60, G + 4, FROG_SWIM).enemy(80, G, CATERPILLAR).enemy(90, G, SNAIL)
    lv.enemy(103, 28, FOOG_WARRIOR).enemy(120 + D, G, FOOG_WARRIOR, -1).enemy(36, G, SNAIL)
    lv.flyer(70, 24, BIRD).flyer(40, 12, DRAGONFLY).flyer(110, 18, DRAGONFLY)
    return lv.save("level14-castle_garden.tmx")


# =====================================================================================================
# Level 15 - Imperial Castle: four storeys of stone. Blue key (floor 2) opens the ground floor; climb to floor 3, grab the
# yellow key and take the pole up to the roof; the yellow door on the roof leads to the stairs (exit).
# =====================================================================================================
def level15():
    W, H = 140, 58
    F1, F2, F3, F4 = 52, 40, 28, 16
    lv = Level(W, H, "dungeon", 7)
    lv.ground(0, 12, F1, "garden")
    lv.ground(13, W - 1, F1)
    lv.bgwall(15, F4 + 2, W - 2, F1 - 1, "stone")
    lv.solid(13, F4, 14, F1 - 5)                         # castle front wall, entrance below
    lv.gfx_on("doorway_dark", 13, F1)
    lv.gfx_on("plant_berry", 4, F1)
    lv.solid(13, F4, W - 1, F4 + 1)                      # roof, battlements at the far end
    for x in range(114, W - 1, 4):
        lv.solid(x, F4 - 2, x + 1, F4 - 1)
    lv.clear(21, F4, 21, F4 + 1)
    lv.solid(15, F2, 120, F2 + 1).clear(40, F2, 40, F2 + 1)
    lv.solid(70, F3 + 2, 71, F2 - 1)                     # splits floor 2: the left half is reached by the pole at 40
    lv.solid(24, F3, W - 2, F3 + 1).clear(122, F3, 122, F3 + 1)
    lv.pole(40, F2 - 6, F1 - 1).pole(122, F3 - 6, F1 - 1).pole(21, F4 - 5, F3 - 1)
    lv.solid(60, F2 + 2, 61, F1 - 4).lock(60, F1, "blue")
    lv.solid(110, 1, 111, F4 - 4).lock(110, F4, "yellow")
    lv.exit(132, F4, 16, gfx="door_wood")
    # decoration
    lv.gfx("painting1", 46, F1 - 9).gfx("painting2", 86, F2 - 10).gfx("painting1", 30, F2 - 8)
    for x in (20, 76, 100, 128):
        lv.gfx_on("torch_yellow", x, F1 - 2)
    lv.gfx("cage", 90, F2 + 2).gfx("cage_green", 96, F2 + 2).gfx("cage_blue", 50, F3 + 2)
    lv.gfx_on("torch_blue", 64, F3).gfx_on("torch_blue", 104, F3)
    # items, enemies
    lv.start(3, F1)
    lv.key(18, F2, "blue").key(30, F3, "yellow")
    lv.beans(18, 36, F1 - 3, 3).items(44, 56, F1 - 3, CEREAL, 6).beans(64, 118, F1 - 3, 4)
    lv.beans(20, 66, F2 - 3, 4).items(74, 116, F2 - 3, GINGER, 6)
    lv.beans(30, 118, F3 - 3, 4).sprite(126, F3 - 3, POTION).checkpoint(128, F3)
    lv.beans(24, 100, F4 - 4, 4).sprite(118, F4 - 3, ONEUP)
    lv.enemy(30, F1, ISO_GREEN).enemy(80, F1, ISO_RED).enemy(100, F1, FOOG_WARRIOR).enemy(116, F1, ROBOT_GREY)
    lv.enemy(52, F2, ISO_WHITE).enemy(90, F2, ROBOT_RED)
    lv.enemy(60, F3, ISO_GREEN).enemy(92, F3, ISO_RED).enemy(110, F3, FOOG_WARRIOR)
    lv.enemy(60, F4, FOOG_WARRIOR).flyer(90, F4 - 8, ISO_FLY).enemy(124, F4, ISO_WHITE)
    return lv.save("level15-castle.tmx")


# =====================================================================================================
# Level 16 - Rooftop Showdown: Keen starts on a high perch with the Plutezarp and a clear gallery (pillar + open air)
# to try the beam and its residue, then a pole down into arena 1 with RoboKeen (Evil Keen stand-in). The "314" door is
# exit 16 (mid-level dialogue). Behind it Mort (Shapeshifter stand-in) and the HR-42; the far exit ends the game.
# =====================================================================================================
def level16():
    W, H, G = 124, 40, 34
    L = 12                                   # start perch floor (high above the rooftop)
    lv = Level(W, H, "dungeon", 7)
    lv.ground(0, W - 1, G)
    for x in range(1, W - 1, 6):
        lv.solid(x, G - 2, x + 1, G - 1)
    lv.clear(4, G - 2, 50, G - 1).clear(60, G - 2, 118, G - 1)
    # start perch: pickup near Keen, empty gallery, a tall pillar to splat, hole + pole down into arena 1
    lv.solid(1, L, 28, L + 1)
    lv.solid(21, L - 5, 22, L - 1)
    lv.clear(26, L, 26, L + 1)
    lv.pole(26, L - 5, G - 1)
    # arena 1
    lv.ow(14, 19, G - 5).ow(26, 31, G - 8).ow(38, 43, G - 5)
    lv.solid(54, 1, 55, G - 5)
    lv.bgwall(56, 4, 57, G - 1, "stone").solid(56, 1, 57, 3)
    lv.gfx_on("door_wood", 52, G)
    lv.exit(52, G, 16, height=4)
    lv.sign(45, G - 8, "three one four")
    # arena 2
    lv.ow(70, 75, G - 5).ow(84, 89, G - 8).ow(98, 103, G - 5)
    lv.exit(118, G, 1, gfx="doorway_dark")
    lv.gfx_on("torch_yellow", 62, G).gfx_on("torch_yellow", 110, G)
    lv.start(3, L)
    lv.sprite(7, L - 2, PLUTEZARP)
    lv.enemy(34, G, EVILKEEN, -1)
    lv.sprite(60, G - 3, HR42).sprite(86, G - 11, POTION)
    lv.enemy(94, G, SHAPESHIFTER, -1)
    lv.beans(8, 12, G - 3).items(26, 31, G - 11, PYAPA, 5).items(14, 43, G - 8, COLA, 29)
    return lv.save("level16-rooftop.tmx")


LEVELS = [level10, level11, level12, level13, level14, level15, level16]

if __name__ == "__main__":
    paths = [f() for f in LEVELS]
    for p in paths:
        print("wrote", p.relative_to(tmxlib.ROOT))
    if "--preview" in sys.argv:
        import render_level
        out = "/tmp/isis/prev"
        import os
        os.makedirs(out, exist_ok=True)
        for p in paths:
            render_level.render(p, f"{out}/{p.stem}.png", show_info="--info" in sys.argv, scale=0.5)
        print("previews in", out)
