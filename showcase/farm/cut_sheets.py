#!/usr/bin/env python3
"""
Cuts the teacher's 5 Gemini pictures (PROMPTS.md, in order, copied into raw/ as
01.jpeg … 05.jpeg) into the named pictures in art/, which build.py reads. Both raw/
and art/ are committed, so the art can't be lost.

    python3 showcase/farm/cut_sheets.py

Gemini drew everything ISOMETRIC (diamond tiles), not the straight top-down view the
prompts asked for; the teacher chose to build the game isometric to match
(2026-11-17). Every drawing stands on a diamond of ground whose width is its
footprint: a field is one tile, the barn and farmhouse two by two. art/ keeps each
at twice the game's size, fitted so that diamond is `footprint × TILE_W × 2` across,
and build.py's origin for it is the diamond's middle.

The background is a dull magenta, about (192, 68, 128), the same all over each
sheet, so it's keyed by distance from the corner (Stack Shack's key_out). On the
crops sheet the ripe wheat touches the corn below it, so that sheet is cut by its
rows: each field from the bottom of the row above to the bottom of its own soil.
"""
import importlib.util
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
RAW, ART = HERE / "raw", HERE / "art"


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_sw = _load("sandwich_cut", HERE.parent / "sandwich" / "cut_sheets.py")
_rpg = _load("rpg_cut", HERE.parent / "rpg" / "cut_sheets.py")
GAME = {}
exec((HERE / "game" / "_1rules.py").read_text(), GAME)
TILE_W = GAME["TILE_W"]

CROPS = ["wheat", "corn", "carrot", "pumpkin"]
# Sheet 2, by where each drawing is (its box's middle, on the 2752 × 1536 sheet).
NATURE = [("soil", (348, 240)), ("soil_wet", (1036, 240)), ("grass_flowers", (1720, 232)), ("path", (2404, 236)),
          ("soil_2", (350, 614)), ("fence", (1034, 612)), ("fence_2", (1718, 612)), ("gate", (2402, 596)),
          ("boulder", (1718, 962)), ("bush", (2402, 960)), ("oak", (348, 1136)), ("pine", (1034, 1134)),
          ("stump", (1718, 1316)), ("pond", (2402, 1326))]
# Sheet 3: the farm buildings, with their footprints (tiles across).
BUILDINGS = [("barn", (556, 444), 2), ("house", (1576, 466), 2), ("silo", (2404, 406), 1),
             ("board", (352, 1186), 1), ("truck", (1052, 1206), 1), ("stand", (1720, 1200), 1), ("stand_2", (2402, 1176), 1)]
ICONS = ["wheat", "corn", "carrot", "pumpkin", "seeds", "coin", "star", "level", "lock", "clock",
         "sickle", "can", "crate", "barn", "order", "hammer", "saw", "axe", "pickaxe", "shovel"]


def save(pic, name):
    pic.save(ART / f"{name}.png", optimize=True)


def fitted(part, tiles):
    """A drawing at twice the game's size: its width (its ground diamond's) = tiles × TILE_W × 2."""
    k = tiles * TILE_W * 2 / part.width
    return part.resize((round(part.width * k), round(part.height * k)), Image.LANCZOS)


def nearest(boxes, at):
    return min(boxes, key=lambda b: ((b[0] + b[2]) / 2 - at[0]) ** 2 + ((b[1] + b[3]) / 2 - at[1]) ** 2)


def islands(im, keep):
    found = sorted(_rpg.islands(im), key=lambda b: -b[4])
    return [b[:4] for b in found[:keep]]


def main():
    ART.mkdir(exist_ok=True)
    # 1: crops, cut by rows (the ripe wheat touches the corn below it).
    im = _sw.key_out(Image.open(RAW / "01.jpeg"))
    boxes = islands(im, 22)
    cols = [(56, 644), (740, 1328), (1424, 2012), (2104, 2700)]
    bottoms = [388, 760, 1124, 1488]
    for r, crop in enumerate(CROPS):
        top = bottoms[r - 1] if r else 0
        for c, (x0, x1) in enumerate(cols):
            cell = im.crop((x0 - 8, top, x1 + 8, bottoms[r] + 4))
            part = cell.crop(cell.getbbox())
            # Its ground's width is the soil's, not a leaf that hangs over it.
            soil = (x1 - x0)
            k = TILE_W * 2 / soil
            save(part.resize((round(part.width * k), round(part.height * k)), Image.LANCZOS), f"crop_{crop}_{c}")
    # 2: fields and nature.
    im = _sw.key_out(Image.open(RAW / "02.jpeg"))
    boxes = islands(im, 14)
    for name, at in NATURE:
        b = nearest(boxes, at)
        save(fitted(_sw.own(im, b, boxes).crop(b), 1), name)
    # 3: buildings.
    im = _sw.key_out(Image.open(RAW / "03.jpeg"))
    boxes = islands(im, 7)
    for name, at, tiles in BUILDINGS:
        b = nearest(boxes, at)
        save(fitted(_sw.own(im, b, boxes).crop(b), tiles), name)
    # 4: icons, each on its cream tile, 128 across (the game shows them at 64).
    im = _sw.key_out(Image.open(RAW / "04.jpeg"))
    boxes = sorted(islands(im, 20), key=lambda b: (b[1] // 200, b[0]))
    for name, b in zip(ICONS, boxes):
        save(_sw.own(im, b, boxes).crop(b).resize((128, 128), Image.LANCZOS), f"icon_{name}")
    # 5: the title picture, at twice the game's size.
    view = (GAME["VIEW_W"], GAME["VIEW_H"])
    Image.open(RAW / "05.jpeg").convert("RGB").resize((view[0] * 2, view[1] * 2), Image.LANCZOS).save(ART / "title.png", optimize=True)
    print(f"{sum(1 for _ in ART.glob('*.png'))} pictures in {ART}")


if __name__ == "__main__":
    main()
