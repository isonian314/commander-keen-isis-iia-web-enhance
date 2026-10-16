"""Print how the original levels build flat ground, one-way platforms, poles, doors and walls.

Used to work out tile "kits" for tools/build_levels.py. Tiles are printed as col,row in tiles.png.
    python3 tools/analyse_kits.py resources/levels/level1-jungle.tmx
"""
import sys
from collections import Counter

from tmxlib import INFO_FIRST, SPRITE_FIRST, TILES, info, read_tmx

GFX = ["BG1", "BG2", "FG1", "FG2"]
SOLID = info(2)
ONEWAY = info(3)
POLE = info(25)


def cr(t):
    if t == 0:
        return "  .  "
    if t >= SPRITE_FIRST:
        return "S%-4d" % (t - SPRITE_FIRST + 1)
    if t >= INFO_FIRST:
        return "I%-4d" % (t - TILES)
    return "%2d,%-3d" % ((t - 1) % 32, (t - 1) // 32)


def main(path):
    w, h, L = read_tmx(path)
    I = L["Info"]

    def g(lay, x, y):
        return L[lay][y][x] if 0 <= x < w and 0 <= y < h else 0

    def stack(x, y0, y1):
        return tuple(tuple(g(lay, x, y) for lay in GFX) for y in range(y0, y1))

    # Flat ground: surface tile solid, above not solid, below solid for 3 rows
    stacks = Counter()
    for y in range(2, h - 4):
        for x in range(w):
            if I[y][x] == SOLID and I[y - 1][x] != SOLID and all(I[y + k][x] == SOLID for k in (1, 2, 3)) \
                    and I[y][x - 1] == SOLID and I[y][min(w - 1, x + 1)] == SOLID and I[y - 1][x - 1] != SOLID:
                stacks[stack(x, y - 2, y + 4)] += 1
    print("== flat ground stacks (rows surface-2 .. surface+3; per row BG1 BG2 FG1 FG2)")
    for s, n in stacks.most_common(6):
        print(n)
        for k, row in enumerate(s):
            print("   %+d " % (k - 2) + " ".join(cr(t) for t in row))

    # One-way platforms
    plats = Counter()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if I[y][x] == ONEWAY:
                plats[tuple(tuple(g(lay, x, yy) for lay in GFX) for yy in (y - 1, y, y + 1))] += 1
    print("== one-way platform stacks (rows -1, 0, +1)")
    for s, n in plats.most_common(6):
        print(n, " | ".join(" ".join(cr(t) for t in row) for row in s))

    poles = Counter()
    for y in range(h):
        for x in range(w):
            if I[y][x] == POLE:
                poles[tuple(g(lay, x, y) for lay in GFX)] += 1
    print("== pole tiles")
    for s, n in poles.most_common(4):
        print(n, " ".join(cr(t) for t in s))

    print("== doors (info 97..112), 4 rows above to 1 below, cols -1..+2")
    shown = 0
    for y in range(h):
        for x in range(w):
            if info(97) <= I[y][x] <= info(112) and (I[y][x] - TILES) % 2 == 1 and shown < 3:
                shown += 1
                print("door at", x, y)
                for yy in range(y - 3, y + 3):
                    for lay in GFX:
                        print("   %+d %s " % (yy - y, lay) + " ".join(cr(g(lay, xx, yy)) for xx in range(x - 1, x + 3)))

    # Most common empty-space background (BG1 where info empty)
    bg = Counter()
    for y in range(h):
        for x in range(w):
            if I[y][x] == 0:
                bg[g("BG1", x, y)] += 1
    print("== BG1 in open space:", ", ".join("%s x%d" % (cr(t), n) for t, n in bg.most_common(8)))


if __name__ == "__main__":
    main(sys.argv[1])
