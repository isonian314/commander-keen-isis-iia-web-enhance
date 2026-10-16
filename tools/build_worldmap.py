#!/usr/bin/env python3
"""Build the world map images (resources/cutscenes/worldmap-*.png) from the painted sources in design/.

Each variant is scaled to 640x360 (twice the 320x180 map viewport), aligned to the day map so the level
markers line up, lightly sharpened and reduced to a 256 colour palette. Needs Pillow and NumPy.

    python3 tools/build_worldmap.py && python3 tools/build_assets.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "design"
OUT = ROOT / "resources" / "cutscenes"
W, H = 640, 360
VARIANTS = {"day": "isis_worldmap_source.jpg", "night": "isis_worldmap_night_source.jpg",
            "aftermath": "isis_worldmap_aftermath_source.jpg"}
MAX_SHIFT = 6


def edges(im):
    a = np.asarray(im.convert("L"), dtype=float)
    e = np.abs(np.diff(a, axis=0))[:, :-1] + np.abs(np.diff(a, axis=1))[:-1, :]
    return (e - e.mean()) / e.std()


def shift(im, dx, dy):
    """Translate by whole pixels, repeating the edge rows/columns that are uncovered."""
    a = np.roll(np.roll(np.asarray(im), dy, 0), dx, 1)
    if dx > 0:
        a[:, :dx] = a[:, dx:dx + 1]
    elif dx < 0:
        a[:, dx:] = a[:, dx - 1:dx]
    if dy > 0:
        a[:dy] = a[dy:dy + 1]
    elif dy < 0:
        a[dy:] = a[dy - 1:dy]
    return Image.fromarray(a)


def align(im, ref_edges):
    e = edges(im)
    m = MAX_SHIFT * 3
    _, dx, dy = max(((np.roll(np.roll(e, dy, 0), dx, 1)[m:-m, m:-m] * ref_edges[m:-m, m:-m]).mean(), dx, dy)
                    for dy in range(-MAX_SHIFT, MAX_SHIFT + 1) for dx in range(-MAX_SHIFT, MAX_SHIFT + 1))
    return shift(im, dx, dy), (dx, dy)


def main():
    images = {k: Image.open(SRC / f).convert("RGB").resize((W, H), Image.LANCZOS) for k, f in VARIANTS.items()}
    ref = edges(images["day"])
    for name, im in images.items():
        offset = (0, 0)
        if name != "day":
            im, offset = align(im, ref)
        im = im.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
        im = im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        out = OUT / f"worldmap-{name}.png"
        im.save(out, optimize=True)
        print(f"Wrote {out.relative_to(ROOT)} (aligned by {offset})")


if __name__ == "__main__":
    main()
