"""Read and write the game's Tiled (.tmx) levels (Python standard library only).

Layers are returned as lists of rows (layer[y][x]) of global tile ids, normalised to the
current tileset layout (see TILES/INFO_FIRST/SPRITE_FIRST below), whatever firstgids the
file itself uses.
"""
import base64
import gzip
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAYERS = ["TransBG", "BG1", "BG2", "FG1", "FG2", "TransFG", "Info", "Sprites"]
CONSTANTS_JS = ROOT / "js" / "constants.js"


def read_maxtiles():
    return int(re.search(r"const MAXTILES = (\d+);", CONSTANTS_JS.read_text(encoding="utf-8")).group(1))


# tiles.png is 32 tiles wide (16x16 tiles); its tile count is MAXTILES in js/constants.js
TILES_PER_ROW = 32
TILES = read_maxtiles()
INFO_COUNT = 144
INFO_FIRST = TILES + 1
SPRITE_FIRST = TILES + INFO_COUNT + 1


def info(n):
    """Global id of INFO tile n (1-based, as numbered in js/constants.js I())."""
    return TILES + n


def sprite(n):
    """Global id of SPRITE tile n (as numbered in js/constants.js S())."""
    return TILES + INFO_COUNT + n


def tile(col, row):
    """Global id of the graphics tile at (col, row) of tiles.png."""
    return row * TILES_PER_ROW + col + 1


def _firstgids(text):
    gids = {}
    for m in re.finditer(r'<tileset firstgid="(\d+)" name="([^"]+)"', text):
        gids[m.group(2)] = int(m.group(1))
    return gids


def _normalise(v, gids, tiles):
    if v == 0:
        return 0
    info0, spr0 = gids.get("tiles_info", tiles + 1), gids.get("tiles_sprites", tiles + INFO_COUNT + 1)
    if v >= spr0:
        return v - spr0 + tiles + INFO_COUNT + 1
    if v >= info0:
        return v - info0 + tiles + 1
    return v


def read_tmx(path, tiles=None):
    """Returns (width, height, layers); ids are renumbered for a tile sheet of `tiles` tiles (default: MAXTILES)."""
    tiles = tiles or TILES
    text = Path(path).read_text(encoding="utf-8")
    w = int(re.search(r'<map [^>]*\swidth="(\d+)"', text).group(1))
    h = int(re.search(r'<map [^>]*\sheight="(\d+)"', text).group(1))
    gids = _firstgids(text)
    layers = {}
    for m in re.finditer(r'<layer name="([^"]+)"[^>]*>\s*<data encoding="base64" compression="gzip">\s*([^<]+?)\s*</data>', text):
        raw = gzip.decompress(base64.b64decode(m.group(2)))
        vals = [_normalise(v, gids, tiles) for v in struct.unpack("<%dI" % (len(raw) // 4), raw)]
        layers[m.group(1)] = [vals[y * w:(y + 1) * w] for y in range(h)]
    return w, h, layers


def write_tmx(path, w, h, layers, tiles=None):
    tiles = tiles or TILES
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           f'<map version="1.0" orientation="orthogonal" width="{w}" height="{h}" tilewidth="16" tileheight="16">',
           ' <tileset firstgid="1" name="tiles" tilewidth="16" tileheight="16">',
           '  <image source="tiles.png" trans="81ff2c"/>',
           ' </tileset>',
           f' <tileset firstgid="{tiles + 1}" name="tiles_info" tilewidth="16" tileheight="16">',
           '  <image source="tiles_info.png" trans="81ff2c"/>',
           ' </tileset>',
           f' <tileset firstgid="{tiles + INFO_COUNT + 1}" name="tiles_sprites" tilewidth="16" tileheight="16">',
           '  <image source="tiles_sprites.png" trans="81ff2c"/>',
           ' </tileset>']
    for name in LAYERS:
        rows = layers.get(name) or [[0] * w for _ in range(h)]
        assert len(rows) == h and all(len(r) == w for r in rows), name
        flat = [v for r in rows for v in r]
        data = base64.b64encode(gzip.compress(struct.pack("<%dI" % len(flat), *flat), mtime=0)).decode("ascii")
        out += [f' <layer name="{name}" width="{w}" height="{h}">',
                '  <data encoding="base64" compression="gzip">',
                f'   {data}',
                '  </data>',
                ' </layer>']
    out.append('</map>')
    Path(path).write_text("\n".join(out) + "\n", encoding="utf-8")
