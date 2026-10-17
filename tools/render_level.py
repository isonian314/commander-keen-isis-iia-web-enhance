#!/usr/bin/env python3
"""Render a level (.tmx) to a PNG preview: parallax background, tile layers and sprite markers.

    python3 tools/render_level.py resources/levels/level14-castle_garden.tmx out.png [--info] [--scale 0.5]
    python3 tools/render_level.py --maps resources/levels/level1[0-6]-*.tmx

--info overlays the INFO layer (solid, water, doors, exits...) at half opacity. --maps writes resources/maps/<level>.png and
<level>-full.png (transparent background, full size; -full adds the INFO layer) for each level. Needs Pillow.
"""
import argparse
from pathlib import Path

from PIL import Image

import tmxlib

RES = tmxlib.ROOT / "resources"
KEY = (129, 255, 44)


def keyed(path):
    im = Image.open(path).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, _ = px[x, y]
            if r >> 3 == KEY[0] >> 3 and g >> 2 == KEY[1] >> 2 and b >> 3 == KEY[2] >> 3:
                px[x, y] = (0, 0, 0, 0)
    return im


def sheet_tiles(im):
    cols = im.width // 16
    return lambda i: im.crop(((i % cols) * 16, (i // cols) * 16, (i % cols) * 16 + 16, (i // cols) * 16 + 16))


def render(path, out, show_info=False, scale=1.0, background=True, info_alpha=110):
    w, h, L = tmxlib.read_tmx(path)
    tiles = sheet_tiles(keyed(RES / "tiles" / "tiles.png"))
    infos = sheet_tiles(keyed(RES / "tiles" / "tiles_info.png"))
    sprites = sheet_tiles(keyed(RES / "tiles" / "tiles_sprites.png"))
    cache = {}

    def get(v):
        if v not in cache:
            if v >= tmxlib.SPRITE_FIRST:
                cache[v] = sprites(v - tmxlib.SPRITE_FIRST)
            elif v >= tmxlib.INFO_FIRST:
                cache[v] = infos(v - tmxlib.INFO_FIRST)
            else:
                cache[v] = tiles(v - 1)
        return cache[v]

    bg_id = 0
    for row in L["Sprites"]:
        for v in row:
            if tmxlib.sprite(20) <= v < tmxlib.sprite(33):
                bg_id = v - tmxlib.sprite(20)
            elif v == tmxlib.sprite(49):
                bg_id = 13
    if background:
        img = Image.open(RES / "backgrounds" / f"bg{bg_id}.png").convert("RGBA").resize((w * 16, h * 16))
    else:
        img = Image.new("RGBA", (w * 16, h * 16))

    def layer(name, alpha=255):
        lay = Image.new("RGBA", img.size)
        for y in range(h):
            for x in range(w):
                v = L[name][y][x]
                if v and (name in ("Info", "Sprites") or v <= tmxlib.TILES):
                    lay.alpha_composite(get(v), (x * 16, y * 16))
        if alpha < 255:
            lay.putalpha(lay.getchannel("A").point(lambda a: a * alpha // 255))
        img.alpha_composite(lay)

    layer("TransBG", 127)
    layer("BG1")
    layer("BG2")
    layer("Sprites")
    layer("FG1")
    layer("FG2")
    layer("TransFG", 127)
    if show_info:
        layer("Info", info_alpha)
    if scale != 1.0:
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.NEAREST)
    (img if not background else img.convert("RGB")).save(out)


def render_maps(path):
    """resources/maps/<level>.png (tiles + sprites) and <level>-full.png (+ INFO layer), like the original maps."""
    stem = Path(path).stem
    render(path, RES / "maps" / f"{stem}.png", background=False)
    render(path, RES / "maps" / f"{stem}-full.png", show_info=True, background=False, info_alpha=170)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+", help="tmx out.png, or several tmx files with --maps")
    ap.add_argument("--maps", action="store_true")
    ap.add_argument("--info", action="store_true")
    ap.add_argument("--scale", type=float, default=1.0)
    a = ap.parse_args()
    if a.maps:
        for f in a.files:
            render_maps(f)
            print("wrote maps for", Path(f).stem)
    else:
        render(a.files[0], a.files[1], a.info, a.scale)
