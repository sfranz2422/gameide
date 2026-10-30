#!/usr/bin/env python3
"""
Makes the pictures the Art and Tiles lessons hand students
(public/tutorials/art/), from Kenney's CC0 downloads (see
make_kenney_library.py for where they come from):

    python3 frontend/scripts/make_tutorial_art.py PACKS_DIR

- robot-walk.png: Kenney's Toon Robot walking, 8 frames of 96 x 128 in a
  4 x 2 grid with 2 pixels between them. A sheet as students will meet them:
  the gaps are why lesson 1 teaches the Grid cut's spacing.
- town.png: Kenney's Roguelike/RPG sheet exactly as he ships it, 16-pixel
  tiles with 1 pixel between, which lesson 2 slices.
- garden.png: a garden path in the order autotiling reads, drawn here (no
  Kenney sheet has all 16 pieces): tile 0 to 15 are the path joined on no
  side, up, right, up and right… (up 1 + right 2 + down 4 + left 8), then
  grass, flowers, a bush and a pond, for lesson 3's "Take 16 in order".
"""
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "public" / "tutorials" / "art"
T = 16                                  # the garden's tiles
GRASS, GRASS_DARK = (106, 190, 48), (88, 168, 40)
PATH, PATH_EDGE, PEBBLE = (226, 196, 140), (190, 152, 98), (204, 172, 120)


def robot(packs):
    poses = packs / "toon-characters-1" / "u" / "Robot" / "PNG" / "Poses"
    frames = [Image.open(poses / f"character_robot_walk{i}.png").convert("RGBA") for i in range(8)]
    gap = 2
    sheet = Image.new("RGBA", (4 * 96 + 3 * gap, 2 * 128 + gap), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, ((i % 4) * (96 + gap), (i // 4) * (128 + gap)), f)
    sheet.save(OUT / "robot-walk.png", optimize=True)


def town(packs):
    shutil.copy(packs / "roguelikerpg-pack-1700-tiles" / "u" / "Spritesheet" / "roguelikeSheet_transparent.png", OUT / "town.png")


def grass(d, x, y, seed):
    d.rectangle((x, y, x + T - 1, y + T - 1), fill=GRASS)
    for k in range(3):                  # a few darker blades, the same in every tile so they tile
        bx, by = x + (seed * 5 + k * 6) % 14 + 1, y + (seed * 3 + k * 5) % 13 + 2
        d.line((bx, by, bx, by + 1), fill=GRASS_DARK)


def path_piece(d, x, y, mask):
    """The path in one tile: a middle, and an arm to each side it joins."""
    grass(d, x, y, 0)
    a, b = 4, 11                        # the path is 8 wide, in the middle
    up, right, down, left = (mask >> i & 1 for i in range(4))
    parts = [(a, a, b, b)]
    if up:
        parts.append((a, 0, b, a))
    if down:
        parts.append((a, b, b, T - 1))
    if left:
        parts.append((0, a, a, b))
    if right:
        parts.append((b, a, T - 1, b))
    for x1, y1, x2, y2 in parts:      # an edge, then the path over it
        d.rectangle((x + x1 - 1 if x1 else x, y + y1 - 1 if y1 else y, x + x2 + 1 if x2 < T - 1 else x + x2, y + y2 + 1 if y2 < T - 1 else y + y2), fill=PATH_EDGE)
    for x1, y1, x2, y2 in parts:
        d.rectangle((x + x1, y + y1, x + x2, y + y2), fill=PATH)
    d.point((x + 6, y + 6), fill=PEBBLE)
    d.point((x + 9, y + 9), fill=PEBBLE)


def garden():
    im = Image.new("RGBA", (8 * T, 3 * T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for mask in range(16):
        path_piece(d, (mask % 8) * T, (mask // 8) * T, mask)
    x0, y0 = 0, 2 * T                   # tile 16 on: grass, flowers, a bush, a pond
    grass(d, x0, y0, 1)
    grass(d, x0 + T, y0, 2)
    for fx, fy, c in ((4, 5, (255, 255, 255)), (10, 9, (250, 204, 21)), (6, 12, (244, 114, 182))):
        d.rectangle((x0 + T + fx, y0 + fy, x0 + T + fx + 1, y0 + fy + 1), fill=c)
    grass(d, x0 + 2 * T, y0, 3)
    d.ellipse((x0 + 2 * T + 1, y0 + 2, x0 + 3 * T - 2, y0 + T - 2), fill=(34, 120, 52))
    d.ellipse((x0 + 2 * T + 3, y0 + 3, x0 + 2 * T + 9, y0 + 8), fill=(60, 150, 70))
    grass(d, x0 + 3 * T, y0, 4)
    d.ellipse((x0 + 3 * T + 1, y0 + 2, x0 + 4 * T - 2, y0 + T - 2), fill=(56, 140, 210))
    d.line((x0 + 3 * T + 5, y0 + 7, x0 + 3 * T + 9, y0 + 7), fill=(160, 210, 245))
    im.save(OUT / "garden.png", optimize=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    packs = Path(sys.argv[1])
    robot(packs)
    town(packs)
    garden()
    shutil.copy(packs / "roguelikerpg-pack-1700-tiles" / "u" / "License.txt", OUT / "License-kenney.txt")
    for f in sorted(OUT.iterdir()):
        im = Image.open(f).size if f.suffix == ".png" else ""
        print(f.name, im, f.stat().st_size // 1024, "KB")
