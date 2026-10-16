#!/usr/bin/env python3
"""Render the documentation images in docs/img/ from the game's own bundled assets.

Sprites are cut from data/assets.js with the same frame sizes, 1px grid borders and colour key
the game uses (core.js splice / getMaster), so the pictures match what is drawn in play.
Needs Pillow (pip install pillow); the game itself has no dependencies.

    python3 tools/build_docs.py
"""
import base64
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "img"
SCALE = 2
GAP = 4

# Transparency colour, matched in RGB565 space like the game
KEY565 = (129 >> 3, 255 >> 2, 44 >> 3)


def load_assets():
    text = (ROOT / "data" / "assets.js").read_text(encoding="utf-8")
    return json.loads(text[text.index("=") + 1:].strip().rstrip(";"))


ASSETS = load_assets()
_cache = {}


def image(name, keyed=True):
    k = (name, keyed)
    if k not in _cache:
        data = base64.b64decode(ASSETS["images"][name].split(",", 1)[1])
        im = Image.open(io.BytesIO(data)).convert("RGBA")
        if keyed:
            px = im.load()
            for y in range(im.height):
                for x in range(im.width):
                    r, g, b, _ = px[x, y]
                    if (r >> 3, g >> 2, b >> 3) == KEY565:
                        px[x, y] = (0, 0, 0, 0)
        _cache[k] = im
    return _cache[k]


def splice(name, w, h, border=True, keyed=True):
    im = image(name, keyed)
    W, H = im.size
    if border:
        rows, cols = (H - 1) // (h + 1), (W - 1) // (w + 1)
        return [im.crop((1 + x * (w + 1), 1 + y * (h + 1), 1 + x * (w + 1) + w, 1 + y * (h + 1) + h))
                for y in range(rows) for x in range(cols)]
    rows, cols = H // h, W // w
    return [im.crop((x * w, y * h, x * w + w, y * h + h)) for y in range(rows) for x in range(cols)]


def strip(frames, trim=True):
    """Frames side by side; transparent margins shared by every frame are trimmed."""
    if trim:
        boxes = [f.getbbox() or (0, 0, 1, 1) for f in frames]
        top, bottom = min(b[1] for b in boxes), max(b[3] for b in boxes)
        frames = [f.crop((b[0], top, b[2], bottom)) for f, b in zip(frames, boxes)]
    w = sum(f.width for f in frames) + GAP * (len(frames) - 1)
    h = max(f.height for f in frames)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x = 0
    for f in frames:
        out.alpha_composite(f, (x, h - f.height))
        x += f.width + GAP
    return out


def save(im, name, scale=SCALE):
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    path = OUT / name
    im.save(path, optimize=True)
    return path


def pick(frames, idx):
    return [frames[i] for i in idx if i < len(frames)]


# ---------------------------------------------------------------------------------------------
# Enemies: (output name, sheet, frame w, frame h, frames to show). Frame ranges follow the
# walk / idle / attack / shoot ranges in js/enemies.js.

ENEMIES = [
    ("foog", "enemy_foog.png", 32, 32, [0, 1, 2, 3, 4, 6, 7, 8]),
    ("foog-warrior", "enemy_foog_warrior.png", 32, 32, [0, 1, 2, 3, 6, 7, 8]),
    ("frog", "enemy_frog_walk.png", 25, 23, [0, 1, 2, 3, 4, 5]),
    ("frog-swim", "enemy_frog_swim.png", 25, 23, [0, 1, 2, 3, 4, 5]),
    ("leafy", "enemy_plantguy.png", 32, 32, [0, 1, 2, 3, 4, 5]),
    ("redfish", "enemy_redfish.png", 32, 32, [0, 1]),
    ("chomper", "enemy_chomperfish.png", 32, 32, [0, 2, 4, 6, 7, 10, 13, 19, 20]),
    ("mine", "enemy_mine.png", 18, 14, [0, 1, 2, 3, 4]),
    ("yellow", "enemy_yellow.png", 32, 64, [0, 1, 2, 3, 4, 5, 7, 9]),
    ("floppy", "enemy_floppy.png", 96, 32, [0, 1, 2, 3]),
    ("holemonster", "enemy_holemonster.png", 38, 21, [0, 1, 2, 3, 5, 7, 9, 11]),
    ("urchin", "enemy_urchin.png", 16, 16, [0, 2, 4, 6, 8, 9, 10, 11]),
    ("bluemouth", "enemy_bluemouth.png", 64, 64, [0, 2, 4, 6, 8, 10, 12, 14]),
    ("caterpillar", "enemy_caterpillar.png", 75, 38, [0, 1, 3, 5, 6, 7, 8, 9]),
    ("snail", "enemy_snail.png", 64, 32, [0, 1]),
    ("garnak", "enemy_garnak.png", 96, 64, [0, 2, 4, 6, 8, 10]),
    ("truck-lemming", "enemy_truckguy2.png", 72, 64, [0, 1, 2, 3]),
    ("truck-alien", "enemy_truckguy1.png", 72, 64, [0, 1, 2, 3]),
    ("yorp", "enemy_yorp.png", 16, 24, [0, 1, 2, 3, 4, 5]),
    ("garg", "enemy_garg.png", 24, 32, [0, 1, 2, 3, 4, 5]),
    ("dragonfly", "enemy_dragonflyg.png", 62, 62, [0, 1, 2, 3]),
    ("fish-yellow", "enemy_yellowfish.png", 32, 64, [0]),
    ("fish-green", "enemy_greenfish.png", 64, 32, [0]),
    ("fish-blue", "enemy_bluefish.png", 128, 64, [0]),
    ("bigfrog", "enemy_bigfrog.png", 46, 46, [0]),
    ("bird", "enemy_bird.png", 64, 72, [0]),
    ("isonian-giant1", "enemy_isonian_giant1.png", 64, 96, [0]),
    ("isonian-giant2", "enemy_isonian_giant2.png", 64, 96, [0]),
    ("isonian-fly", "enemy_isonian-fly.png", 112, 38, [0]),
    ("spider", "enemy_spider.png", 32, 32, [0, 2, 4, 6, 8, 9, 10]),
    ("lemming", "enemy_lemming.png", 64, 48, [0, 2, 4, 6, 7, 8, 9]),
    ("truckie-lemming", "enemy_truckguy2_walk.png", 64, 48, [0, 2, 4, 6, 7, 8, 9]),
    ("truckie-alien", "enemy_truckguy1_walk.png", 64, 48, [0, 2, 4, 6, 7, 8, 9]),
    ("cyborg-lemming", "enemy_rat.png", 64, 48, [0, 2, 4, 6, 7, 8, 9]),
    ("cyborg-lemming-solarized", "enemy_rat.png", 64, 48, [14, 15, 16, 17, 18, 19]),
    ("robot-grey", "enemy_robot_grey.png", 32, 48, [0, 1, 2, 3, 4, 5, 6, 7, 8]),
    ("robot-red", "enemy_robot_red.png", 48, 48, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]),
    ("flasher", "enemy_flasher.png", 78, 46, [0, 1, 2, 3, 8, 10, 12]),
    ("hover", "enemy_hover.png", 47, 40, [0, 1, 2, 3, 4, 5, 6]),
    ("demon", "enemy_demon.png", 48, 48, [0, 1, 2, 3, 6, 9, 14, 15, 16]),
    ("slug", "enemy_slug.png", 32, 32, [0, 1, 2, 3]),
    ("isonian-green", "enemy_isonian-green.png", 30, 40, [0, 2, 4, 6, 11, 13, 15, 16, 18, 20]),
    ("isonian-red", "enemy_isonian-red.png", 30, 40, [0, 2, 4, 6, 11, 13, 15, 16, 18, 20]),
    ("isonian-white", "enemy_isonian-white.png", 30, 40, [0, 2, 4, 6, 11, 13, 15, 16, 18, 20]),
    ("teleturret", "enemy_teleturret.png", 33, 25, [0, 1, 2, 3, 4, 8, 11, 15]),
    ("shapeshifter", "enemy_shapeshifter.png", 64, 64, [0, 4, 8, 12, 13, 14, 15, 16, 20, 22]),
    ("evilkeen", "enemy_evilkeen.png", 38, 32, [0, 1, 2, 3, 4, 5, 8, 9]),
    ("rocks", "enemy_rocks.png", 48, 48, [0, 1, 2]),
    # Enemy projectiles
    ("proj-spider", "enemy_spider-proj.png", 16, 16, [0, 1, 2, 3, 4, 5, 6]),
    ("proj-lemming", "enemy_rat-proj.png", 64, 48, [0, 1]),
    ("proj-robot-grey", "enemy_robot_grey-proj.png", 32, 48, [0, 1]),
    ("proj-robot-red", "enemy_robot_red-proj.png", 48, 48, [0, 1]),
    ("proj-hover", "enemy_hover-proj.png", 47, 40, [0, 1]),
    ("proj-demon", "enemy_demon-proj.png", 48, 48, [0, 1, 2]),
    ("proj-slug", "enemy_slug-proj.png", 32, 32, [0]),
    ("proj-teleturret", "enemy_teleturret-proj.png", 33, 25, [0, 1, 2]),
    ("proj-isonian", "enemy_isonian-proj1.png", 12, 15, [0, 1, 2, 3]),
    ("proj-shapeshifter", "enemy_shapeshifter-proj.png", 32, 32, [0, 1]),
    ("proj-evilkeen", "enemy_evilkeen-proj.png", 32, 32, [0, 1]),
]

# Keen (keen.js SPRITE_* frame numbers, right-facing where there is a choice)
KEEN = [
    ("keen-run", 0, [13, 14, 15, 16, 17]),
    ("keen-jump", 0, [18, 19, 20]),
    ("keen-pogo", 0, [21, 22]),
    ("keen-pole", 0, [42, 43, 44, 45, 46, 47, 48]),
    ("keen-ledge", 0, [31, 32, 33, 34, 35, 36]),
    ("keen-look", 0, [52, 53, 54, 55]),
    ("keen-door", 0, [56, 57, 58, 59, 60]),
    ("keen-swim", 0, [119, 120, 123, 124]),
    ("keen-shield", 0, [81, 82, 83, 84]),
    ("keen-die", 0, [86, 87]),
    ("keen-shoot", 0, [139, 130, 131, 132, 133]),
    ("keen-god", 1, [13, 14, 15, 18]),
    ("keen-crazy", 2, [13, 14, 15, 18]),
    ("keen-spew", 2, list(range(91, 102))),
    ("keen-ega", 3, [13, 14, 15, 18]),
    ("keen-dreams", 4, [13, 14, 15, 18]),
]
KEEN_SHEETS = ["keen_sprites0-normal.png", "keen_sprites1-god.png", "keen_sprites2-crazy.png",
               "keen_sprites3-ega.png", "keen_sprites4-dreams.png"]

# Item ids in constants.js order; the item picture is frame id * 4 of items.png
ITEMS = ["key-red", "key-yellow", "key-green", "key-cyan", "key-blue", "key-magenta",
         "jbean-red", "jbean-yellow", "jbean-green", "jbean-cyan", "jbean-blue", "jbean-purple",
         "cola", "burger", "ginger", "sugar", "cereal",
         "pyapa", "peeta", "isis-fruit", "nephthys", "potion", "yorp",
         "shoes", "points", "god", "crazy", "anti", "regen", "degen",
         "w-blowgun", "w-zeffer", "w-pulsar", "w-solarizer", "w-hr42", "w-plutezarp", "w-harpoon", "w-raygun", "w-neural",
         "battery", "shield", "ionscanner", "unknown"]

# Player projectiles (weapons.js PROJ_* frames of projectiles.png)
PROJECTILES = [
    ("proj-blowgun", [0, 1]), ("proj-zeffer", [2, 3]), ("proj-pulsar", [4, 5, 6, 7]),
    ("proj-solarizer", [8, 9, 10]), ("proj-hr42", [11, 12, 13, 14]), ("proj-harpoon", [16]),
    ("proj-raygun", [17]), ("proj-neural", [18, 19, 20, 21]),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    written = []

    for name, sheet, w, h, idx in ENEMIES:
        written.append(save(strip(pick(splice(sheet, w, h), idx)), f"enemy-{name}.png"))

    sheets = [splice(s, 48, 48) for s in KEEN_SHEETS]
    for name, sheet, idx in KEEN:
        written.append(save(strip(pick(sheets[sheet], idx)), f"{name}.png"))

    items = splice("items.png", 24, 24)
    for i, name in enumerate(ITEMS):
        written.append(save(strip([items[i * 4]]), f"item-{name}.png"))
    for group, names in [("jbeans", ITEMS[6:12]), ("keys", ITEMS[0:6])]:
        written.append(save(strip([items[ITEMS.index(n) * 4] for n in names]), f"items-{group}.png"))

    proj = splice("projectiles.png", 32, 32)
    for name, idx in PROJECTILES:
        written.append(save(strip(pick(proj, idx)), f"{name}.png"))
    beam = proj[15].crop((0, 0, 1, 32)).resize((100, 32), Image.NEAREST)
    written.append(save(strip([beam]), "proj-plutezarp.png"))

    expl = splice("explosions.png", 32, 32)
    written.append(save(strip(expl[8:13]), "explode-solarizer.png"))

    # The HUD panel, the stats-screen stars and level boxes
    written.append(save(image("hud_blank.png", False).crop((256, 0, 320, 200)), "hud-panel.png"))
    written.append(save(strip(splice("hud_faces.png", 40, 38)[:7], trim=False), "hud-faces.png"))
    written.append(save(strip(splice("hud_light.png", 17, 31)[:7], trim=False), "hud-lights.png"))
    written.append(save(strip([image("progress_star-filled.png", False), image("progress_star-outline.png", False)]),
                        "stats-stars.png"))

    # Screens (1x; the pages scale them up)
    def cut(name, frame):
        return splice(name, 320, 200, border=False, keyed=False)[frame]

    for name, sheet, frame in [("story-intro", "cutscene-intro.png", 0), ("story-stealth", "cutscene1.png", 2),
                               ("story-landing", "cutscene1.png", 4), ("story-advisor", "cutscene9.png", 1),
                               ("story-trapdoor", "cutscene9.png", 10)]:
        written.append(save(cut(sheet, frame), f"{name}.png", scale=1))
    worldmap = image("worldmap-day.png", False)
    written.append(save(worldmap.resize((worldmap.width // 2, worldmap.height // 2), Image.LANCZOS),
                        "story-worldmap.png", scale=1))
    # The last frame of each level's cut-scene, which carries Keen's line
    for n, frame in [(2, 2), (3, 2), (4, 2), (5, 4), (6, 2), (7, 2), (8, 2)]:
        written.append(save(cut(f"cutscene{n}.png", frame), f"cutscene-{n}.png", scale=1))

    print(f"Wrote {len(written)} images to {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
