#!/usr/bin/env python3
"""
Cuts the teacher's 8 Gemini pictures (PROMPTS.md, in order, copied into raw/ as
01.jpeg … 08.jpeg) into the named pictures in art/, which build.py reads. Both
raw/ and art/ are committed, so the art can't be lost.

    python3 showcase/siege/cut_sheets.py

Pictures here are kept at twice the game's size; build.py shrinks them.
"""
import importlib.util
import math
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
RAW, ART = HERE / "raw", HERE / "art"
S = 2


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_rpg = _load("rpg_cut", HERE.parent / "rpg" / "cut_sheets.py")
_climb = _load("climber_cut", HERE.parent / "climber" / "cut_sheets.py")
cut, place, fit = _rpg.cut, _rpg.place, _rpg.fit
key_out = _climb.key_out

TROOPS = ["soldier", "knight", "plane", "archer", "golem"]
# In the game, each troop's frame (the canvas its drawing stands on, feet on the bottom).
TROOP_SIZE = {"soldier": (24, 26), "knight": (32, 34), "plane": (30, 22), "archer": (26, 28), "golem": (44, 44)}


def raw(n):
    return Image.open(RAW / f"{n:02d}.jpeg").convert("RGB")


def save(pic, name):
    pic.save(ART / f"{name}.png", optimize=True)


def sheet(n, shape, loose=True):
    im = key_out(raw(n))
    boxes = cut(im, shape, loose)
    assert len(boxes) == sum(shape), f"{n}: {len(boxes)} drawings"
    return im, boxes


def each(im, boxes, names, game_size):
    size = (game_size[0] * S, game_size[1] * S)
    for b, name in zip(boxes, names):
        if name:
            save(place(im, b, size, fit([b], size)), name)


def group(im, boxes, names, game_size):
    """Drawings that belong together (a troop's poses): one scale for all, feet on the bottom."""
    size = (game_size[0] * S, game_size[1] * S)
    scale = fit(boxes, size)
    for b, name in zip(boxes, names):
        save(place(im, b, size, scale), name)


def level(pic):
    """A ruler drawn at a slant, turned to lie flat: the angle of its long axis, from its pixels."""
    a = pic.getchannel("A")
    w, h = pic.size
    pts = [(x, y) for y in range(0, h, 2) for x in range(0, w, 2) if a.getpixel((x, y)) > 128]
    mx = sum(p[0] for p in pts) / len(pts)
    my = sum(p[1] for p in pts) / len(pts)
    sxx = sum((p[0] - mx) ** 2 for p in pts)
    syy = sum((p[1] - my) ** 2 for p in pts)
    sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
    angle = 0.5 * math.degrees(math.atan2(2 * sxy, sxx - syy))
    flat = pic.rotate(angle, resample=Image.BICUBIC, expand=True)
    return flat.crop(flat.getbbox())


def largest_part(pic):
    """Only the biggest joined-up piece of a drawing (the blue marble caught a sliver of the red one beside it)."""
    a = pic.getchannel("A").load()
    w, h = pic.size
    seen, best = set(), []
    for y0 in range(h):
        for x0 in range(w):
            if a[x0, y0] < 40 or (x0, y0) in seen:
                continue
            part, todo = [], [(x0, y0)]
            seen.add((x0, y0))
            while todo:
                x, y = todo.pop()
                part.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and a[nx, ny] >= 40:
                        seen.add((nx, ny))
                        todo.append((nx, ny))
            if len(part) > len(best):
                best = part
    keep = set(best)
    out = pic.copy()
    px = out.load()
    for y in range(h):
        for x in range(w):
            if (x, y) not in keep:
                px[x, y] = (0, 0, 0, 0)
    return out


def main():
    ART.mkdir(exist_ok=True)
    # 1, 2: the troops, five rows of three (walking twice and attacking; a plane flying, tilting, diving).
    for n, team in ((1, "blue"), (2, "red")):
        im, boxes = sheet(n, [3] * 5)
        for r, troop in enumerate(TROOPS):
            group(im, boxes[r * 3:r * 3 + 3], [f"{troop}_{team}_{k}" for k in range(3)], TROOP_SIZE[troop])
    # 3: pencil cups (whole, cracked, knocked over) and lunchboxes.
    im, boxes = sheet(3, [3, 3, 3])
    group(im, boxes[0:3], ["cup_blue_0", "cup_blue_1", "cup_blue_2"], (44, 48))
    group(im, boxes[3:6], ["cup_red_0", "cup_red_1", "cup_red_2"], (44, 48))
    group(im, boxes[6:9], ["box_blue", "box_red", "box_broken"], (60, 56))
    # 4: the desk's wood.
    wood = raw(4)
    save(wood.resize((256 * S, 256 * S), Image.LANCZOS).convert("RGBA"), "wood")
    # 5: school supplies (the rulers and the little things for the desk's corners).
    im, boxes = sheet(5, [3, 5, 5])
    save(level(im.crop(boxes[0])), "ruler")
    each(im, boxes[2:8], ["scissors", "note", "clip", "coins", "crayon", "sharpener"], (40, 40))
    # 6: effects, and the blocks, glue and marbles again (sheet 5's have a stray head beside them).
    im, boxes = sheet(6, [3, 6, 5])
    each(im, boxes[3:9], ["puff", "spark", "band", "shaving", "key", "sparkle"], (24, 24))
    each(im, boxes[9:14], ["blocks", "glue_bottle", "glue_puddle", "marble_blue", "marble_red"], (32, 32))
    # 7: the cards' pictures.
    im, boxes = sheet(7, [4, 4])
    each(im, boxes, [f"card_{c}" for c in ("soldiers", "knight", "plane", "archer", "golem", "wall", "marble", "glue")], (44, 44))
    # 8: the title.
    save(raw(8).convert("RGBA"), "title")
    for name in ("marble_blue", "marble_red"):
        save(largest_part(Image.open(ART / f"{name}.png")), name)
    print(len(list(ART.glob("*.png"))), "pictures in", ART)


if __name__ == "__main__":
    main()
