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
# Phase 2 (pictures 6 to 10), each optional until it's come.
HOMES = ["coop", "cowshed", "sheep_pen"]
FACTORIES = ["feed_mill", "bakery", "dairy", "sugar_mill", "weaving_mill", "jam_kitchen"]
ANIMALS = [("chicken", 56), ("cow", 96), ("sheep", 80)]     # each animal's height in art/ (twice the game's)
POSES = ["stand", "walk", "eat", "ready"]
ICONS_2 = ["chicken_feed", "cow_feed", "sheep_feed", "egg", "milk", "wool", "bread", "corn_bread", "pie", "cream",
           "cheese", "butter", "sugarcane", "sugar", "cookies", "yarn", "sweater", "strawberry", "jam", "wheelbarrow"]


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


def drawings(im, rows, cols):
    """A sheet's drawings, row by row: its biggest patches if there are just the right
    number, in `rows` rows; otherwise the sheet cut as an even grid (patches that touch,
    as the crops did, would be one drawing)."""
    n = rows * cols
    found = islands(im, n + 8)
    big = [b for b in found if (b[2] - b[0]) * (b[3] - b[1]) > im.width * im.height / (n * 12)][:n]
    if len(big) == n:
        big.sort(key=lambda b: (b[1] + b[3]) / 2)
        out = []
        for r in range(rows):
            out += sorted(big[r * cols:(r + 1) * cols], key=lambda b: b[0])
        return out, big
    w, h = im.width / cols, im.height / rows
    cells = []
    for r in range(rows):
        for c in range(cols):
            cell = im.crop((int(c * w), int(r * h), int((c + 1) * w), int((r + 1) * h)))
            bb = cell.getbbox()
            cells.append([int(c * w) + bb[0], int(r * h) + bb[1], int(c * w) + bb[2], int(r * h) + bb[3]] if bb else [0, 0, 1, 1])
    return cells, cells


def apart(part, b):
    """The sheep pen's grass touches the farm stand drawn under it, so they're one patch:
    everything below the pen's lower-right grass edge (on the sheet, from (2192, 1095)
    to (2677, 830)) is the stand, and goes; then just the biggest piece left is kept."""
    px = part.load()
    for y in range(part.height):
        for x in range(part.width):
            sx, sy = x + b[0], y + b[1]
            if sy > 1095 or (sx > 2192 and sy > 1095 - (sx - 2192) * 0.546):
                px[x, y] = (0, 0, 0, 0)
    best = max(_rpg.islands(part), key=lambda i: i[4])
    return part.crop(tuple(best[:4]))


def shadow(part):
    """Gemini drew a shadow under each animal (though asked not to), a darker magenta
    that keying leaves on: made a soft dark shadow, so it isn't purple on the grass.
    Red combs and pink noses aren't touched: they're not blue enough."""
    px = part.load()
    for y in range(part.height):
        for x in range(part.width):
            r, g, b, a = px[x, y]
            if a and r > g + 50 and b > g + 30:
                px[x, y] = (20, 30, 10, min(a, 90))
    return part


def phase_2():
    if (RAW / "06.jpeg").exists():
        # Gemini added the order board, truck and stands again as a second row: the
        # homes are the top row's three, the drawings nearest these places.
        im = _sw.key_out(Image.open(RAW / "06.jpeg"))
        every = islands(im, 10)
        # (the sheep pen sits lower than the other two: its middle is about half way down)
        top = [b for b in every if (b[1] + b[3]) / 2 < im.height * 0.7 and b[1] < im.height * 0.4]
        boxes = sorted(sorted(top, key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))[:3], key=lambda b: b[0])
        for name, b in zip(HOMES, boxes):
            part = _sw.own(im, b, every).crop(b)
            if b[3] - b[1] > im.height * 0.6:
                part = apart(part, b)
            save(fitted(part, 2), name)
    if (RAW / "07.jpeg").exists():
        im = _sw.key_out(Image.open(RAW / "07.jpeg"))
        boxes, every = drawings(im, 3, 4)
        for r, (animal, tall) in enumerate(ANIMALS):
            row = boxes[r * 4:(r + 1) * 4]
            k = tall / max(b[3] - b[1] for b in row)       # one size for an animal's four poses
            for pose, b in zip(POSES, row):
                part = shadow(_sw.own(im, b, every).crop(b))
                save(part.resize((max(1, round(part.width * k)), max(1, round(part.height * k))), Image.LANCZOS), f"animal_{animal}_{pose}")
    if (RAW / "08.jpeg").exists():
        im = _sw.key_out(Image.open(RAW / "08.jpeg"))
        boxes, every = drawings(im, 2, 3)
        for name, b in zip(FACTORIES, boxes):
            save(fitted(_sw.own(im, b, every).crop(b), 2), name)
    if (RAW / "09.jpeg").exists():
        im = _sw.key_out(Image.open(RAW / "09.jpeg"))
        boxes, every = drawings(im, 4, 5)
        for name, b in zip(ICONS_2, boxes):
            save(_sw.own(im, b, every).crop(b).resize((128, 128), Image.LANCZOS), f"icon_{name}")
    if (RAW / "10.jpeg").exists():
        im = _sw.key_out(Image.open(RAW / "10.jpeg"))
        # Gemini drew three rows: sugarcane, then strawberries twice. The third row
        # (flowers, then berries) is the one the prompt asked for.
        # Rows by where the gaps between them are (fractions of the sheet's height).
        w = im.width / 4
        for (y0, y1), crop in (((0, 0.275), "sugarcane"), ((0.505, 0.77), "strawberry")):
            for c in range(4):
                cell = im.crop((int(c * w), int(y0 * im.height), int((c + 1) * w), int(y1 * im.height)))
                # just the field: the tips of the next row's leaves reach into the cell
                part = cell.crop(tuple(max(_rpg.islands(cell), key=lambda i: i[4])[:4]))
                # Its ground is the soil diamond: the widest part, at the bottom.
                k = TILE_W * 2 / part.width
                save(part.resize((round(part.width * k), round(part.height * k)), Image.LANCZOS), f"crop_{crop}_{c}")


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
    phase_2()
    print(f"{sum(1 for _ in ART.glob('*.png'))} pictures in {ART}")


if __name__ == "__main__":
    main()
