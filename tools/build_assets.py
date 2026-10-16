#!/usr/bin/env python3
"""Bundle the game's resources for the web port (Python standard library only).

Writes web/data/assets.js (images, sound effects, fonts and levels, inlined so the game also runs
from file://) and copies the music to web/music/ (streamed with <audio>, so it stays as files).

    python3 web/tools/build_assets.py
"""
import base64
import json
import shutil
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
# The web port sits either at the repo root or in /web next to /resources
RES = WEB / "resources" if (WEB / "resources").is_dir() else WEB.parent / "resources"
ROOT = RES.parent

IMAGE_DIRS = ["backgrounds", "cutscenes", "hud", "menu", "sprites", "tiles"]
SKIP_SUFFIXES = ("_bakup", "_WIP")


def b64(path):
    return base64.b64encode(path.read_bytes()).decode("ascii")


def main():
    assets = {"images": {}, "sounds": {}, "fonts": {}, "levels": {}}

    for d in IMAGE_DIRS:
        for p in sorted((RES / d).glob("*.png")):
            if p.stem.endswith(SKIP_SUFFIXES):
                continue
            if p.name in assets["images"]:
                raise SystemExit(f"duplicate image name: {p.name}")
            assets["images"][p.name] = "data:image/png;base64," + b64(p)

    for p in sorted((RES / "sounds").glob("*.ogg")):
        assets["sounds"][p.name] = b64(p)

    for p in sorted((RES / "fonts").iterdir()):
        if p.suffix.lower() in (".fon", ".ttf"):
            assets["fonts"][p.name] = b64(p)

    for p in sorted((RES / "levels").glob("*.tmx")):
        assets["levels"][p.name] = p.read_text(encoding="utf-8")

    out = WEB / "data" / "assets.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("window.ISIS_ASSETS = " + json.dumps(assets, separators=(",", ":")) + ";\n", encoding="utf-8")

    music = WEB / "music"
    music.mkdir(exist_ok=True)
    for p in sorted((RES / "music").glob("*.ogg")):
        dest = music / p.name
        if not dest.exists() or dest.stat().st_size != p.stat().st_size:
            shutil.copy2(p, dest)

    counts = ", ".join(f"{len(v)} {k}" for k, v in assets.items())
    print(f"Wrote {out.relative_to(ROOT)} ({out.stat().st_size / 1e6:.1f} MB: {counts}) and copied music to web/music/")


if __name__ == "__main__":
    main()
