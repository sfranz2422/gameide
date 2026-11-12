#!/usr/bin/env python3
"""
Cuts the teacher's 12 Gemini pictures (PROMPTS.md, in order, copied into raw/ as
01.jpeg … 12.jpeg) into the named pictures in art/, which build.py reads. Both raw/
and art/ are committed, so the art can't be lost the way older games' was.

    python3 showcase/lemon/cut_sheets.py

Pictures here are kept at twice the game's size; build.py shrinks them. The magenta
behind the drawings isn't one colour: some sheets came back a dull pink (about
(200, 64, 144)) and some a bright one ((255, 0, 250)), so the key is read from each
sheet's own corner (key_out, as Snowcap's cut does).
"""
import importlib.util
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
RAW, ART = HERE / "raw", HERE / "art"
S = 2
OWNER_TOP = 420     # sheet 2: where the second row's hats begin (the first row fades into them)


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_rpg = _load("rpg_cut", HERE.parent / "rpg" / "cut_sheets.py")
_climb = _load("climber_cut", HERE.parent / "climber" / "cut_sheets.py")
_build = _load("lemon_build", HERE / "build.py")
cut, place, fit = _rpg.cut, _rpg.place, _rpg.fit
key_out = _climb.key_out


def raw(n):
    return Image.open(RAW / f"{n:02d}.jpeg").convert("RGB")


def save(pic, name):
    pic.save(ART / f"{name}.png", optimize=True)


def sheet(n, shape, loose=True):
    im = key_out(raw(n))
    boxes = cut(im, shape, loose)
    assert len(boxes) == sum(shape), f"{n}: {len(boxes)} drawings"
    return im, boxes


def no_smear(im, rows):
    """
    Rubs out the pink left in the top `rows` of a keyed picture: the first row of
    sheet 2 fades, pink-tinted, into the second row's hats. The hats are tan and
    blue, so only pixels much redder-and-bluer than green go.
    """
    px = im.load()
    for y in range(min(rows, im.height)):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and ((r + b) / 2 - g > 50 or a < 230):     # pink, or the faint edge of the fade
                px[x, y] = (0, 0, 0, 0)
    return im


def size2(game_size):
    return (game_size[0] * S, game_size[1] * S)


def together(im, boxes, names, game_size):
    """Drawings that belong together (one person's frames, the four stands) at one scale."""
    size = size2(game_size)
    k = fit(boxes, size)
    for b, name in zip(boxes, names):
        save(place(im, b, size, k), name)


def apart(im, boxes, names, game_size):
    """Each drawing as big as its canvas allows (icons, bubbles)."""
    size = size2(game_size)
    for b, name in zip(boxes, names):
        save(centred(im, b, size, fit([b], size)), name)


def centred(im, box, size, scale):
    part = im.crop(box)
    part = part.resize((max(1, round(part.width * scale)), max(1, round(part.height * scale))), Image.LANCZOS)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(part, ((size[0] - part.width) // 2, (size[1] - part.height) // 2))
    return out


def wide(n, name):
    """
    A whole picture (a place, the title), at the screen's own size: they're only ever
    shown full screen, and at twice it the five came to 17 MB of the art's 21.
    """
    raw(n).convert("RGB").resize((_build.VIEW_W, _build.VIEW_H), Image.LANCZOS).save(ART / f"{name}.png", optimize=True)


def main():
    ART.mkdir(exist_ok=True)
    # 1: the four stands, in the order the game numbers them (plain, sign, cooler and juicer, pink).
    im, boxes = sheet(1, [4])
    together(im, boxes, [f"stand_{k}" for k in range(4)], _build.STAND)
    # 2: you, two rows of the same six poses. Gemini faded the first row's bodies into
    # the second row's hats, so the two can't be told apart as drawings: the sheet is
    # cut just above the second row's hats (OWNER_TOP), and only that row is used (it
    # shows more of the apron, and the counter hides the bottom anyway).
    im = no_smear(key_out(raw(2).crop((0, OWNER_TOP, 3168, 1344))), 40)
    boxes = cut(im, [6], False)
    together(im, boxes, [f"owner_{k}" for k in range(6)], _build.OWNER)
    # 3-5: twelve customers, four a sheet, five frames each, all facing right.
    for n, first in ((3, 0), (4, 4), (5, 8)):
        im, boxes = sheet(n, [5, 5, 5, 5])
        for row in range(4):
            kind = first + row
            together(im, boxes[row * 5:(row + 1) * 5], [f"cust_{kind}_{f}" for f in _build.PERSON_FRAMES], _build.PERSON)
    # 6-9: the places.
    for n, place_ in zip((6, 7, 8, 9), ("park", "beach", "ballpark", "downtown")):
        wide(n, f"place_{place_}")
    # 10: supplies and upgrades, 7 then 6.
    im, boxes = sheet(10, [7, 6])
    apart(im, boxes, [f"icon_{n}" for n in _build.ICON_NAMES], _build.ICON)
    # 11: the six thought bubbles.
    im, boxes = sheet(11, [6])
    apart(im, boxes, [f"bubble_{k}" for k in range(6)], _build.BUBBLE)
    # 12: the title.
    wide(12, "title")


if __name__ == "__main__":
    main()
