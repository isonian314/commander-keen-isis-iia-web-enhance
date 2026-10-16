#!/usr/bin/env python3
"""Append a tile sheet to the bottom of resources/tiles/tiles.png and renumber everything that depends on its size.

    python3 tools/extend_tiles.py design/level13-castle_garden_tiles.png

The sheet must be 512 px wide (32 tiles) with a height that is a multiple of 16, drawn on the usual transparent
green (#81ff2c). INFO and SPRITE tile ids come straight after the graphics tiles, so growing tiles.png shifts them:
this updates MAXTILES in js/constants.js and rewrites every level file (resources/levels/*.tmx and
custom_maps/sample.tmx) with the new firstgids. custom_maps/tiles.png is kept in sync for editing in Tiled.

The game itself maps ids using each file's own firstgids, so custom levels made against an older tiles.png still load.
Browsers limit canvases to about 32,767 px, so tiles.png can grow to roughly 2,000 rows of tiles (~65,000 tiles).
Needs Pillow.
"""
import re
import shutil
import sys

from PIL import Image

import tmxlib

TILES_PNG = tmxlib.ROOT / "resources" / "tiles" / "tiles.png"
CUSTOM_TILES_PNG = tmxlib.ROOT / "custom_maps" / "tiles.png"
LEVEL_FILES = sorted((tmxlib.ROOT / "resources" / "levels").glob("*.tmx")) + [tmxlib.ROOT / "custom_maps" / "sample.tmx"]


def main(sheet_path):
    sheet = Image.open(sheet_path).convert("RGB")
    tiles = Image.open(TILES_PNG).convert("RGB")
    if sheet.width != tiles.width or sheet.height % 16:
        raise SystemExit(f"{sheet_path} must be {tiles.width} px wide and a multiple of 16 px high")
    old = tmxlib.read_maxtiles()
    if old != tiles.width // 16 * tiles.height // 16:
        raise SystemExit(f"MAXTILES ({old}) doesn't match {TILES_PNG.name} ({tiles.size})")

    levels = {p: tmxlib.read_tmx(p, tiles=old) for p in LEVEL_FILES if p.exists()}

    out = Image.new("RGB", (tiles.width, tiles.height + sheet.height))
    out.paste(tiles, (0, 0))
    out.paste(sheet, (0, tiles.height))
    out.save(TILES_PNG, optimize=True)
    if CUSTOM_TILES_PNG.exists():
        shutil.copy2(TILES_PNG, CUSTOM_TILES_PNG)
    new = out.width // 16 * out.height // 16

    js = tmxlib.CONSTANTS_JS.read_text(encoding="utf-8")
    tmxlib.CONSTANTS_JS.write_text(re.sub(r"const MAXTILES = \d+;", f"const MAXTILES = {new};", js), encoding="utf-8")

    for p, (w, h, layers) in levels.items():
        delta = new - old
        shifted = {k: [[v + delta if v > old else v for v in row] for row in rows] for k, rows in layers.items()}
        tmxlib.write_tmx(p, w, h, shifted, tiles=new)

    print(f"tiles.png: {old} -> {new} tiles (new sheet starts at row {tiles.height // 16}); "
          f"renumbered {len(levels)} level files. Run tools/build_assets.py next.")


if __name__ == "__main__":
    main(sys.argv[1])
