#!/usr/bin/env python3
"""
Cuts the teacher's 12 Gemini pictures (PROMPTS.md, in order, copied into raw/ as
01.jpeg … 12.jpeg) into the named pictures in art/, which build.py reads. Both
raw/ and art/ are committed, so the art can't be lost the way older games' was.

    python3 showcase/undertow/cut_sheets.py

Pictures here are kept at twice the game's size; build.py shrinks them.
"""
import importlib.util
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

SUITS = ["coral", "sea", "sun", "violet", "orange", "white", "black", "pink"]
POSES = ["stand", "walk1", "walk2", "work", "frozen", "ghost"]
CREW_SIZE = (40, 48)       # in the game: a frame of a crew sprite, feet on its bottom row


def raw(n):
    return Image.open(RAW / f"{n:02d}.jpeg").convert("RGB")


def save(pic, name):
    pic.save(ART / f"{name}.png", optimize=True)


def no_rules(im):
    """
    The crew and Mimic sheets have a thin line under each row, the feet standing on
    it, which would join a row's drawings into one. A line is a few pixel rows drawn
    most of the way across, with much less drawn just above and below it (big
    drawings side by side can fill a row too, but not just for a few rows).
    """
    px = im.load()
    w, h = im.size
    cover = [sum(1 for x in range(0, w, 4) if px[x, y][3] > 128) / (w // 4) for y in range(h)]
    y = 0
    while y < h:
        if cover[y] <= 0.55:
            y += 1
            continue
        end = y
        while end + 1 < h and cover[end + 1] > 0.55:
            end += 1
        above, below = cover[max(0, y - 8)], cover[min(h - 1, end + 8)]
        if end - y < 8 and above < cover[y] / 2 and below < cover[y] / 2:
            for yy in range(max(0, y - 1), min(h, end + 2)):
                for x in range(w):
                    px[x, yy] = (0, 0, 0, 0)
        y = end + 1
    return im


def sheet(n, shape, rules=False, loose=True):
    im = key_out(raw(n))
    if rules:
        im = no_rules(im)
    boxes = cut(im, shape, loose)
    assert len(boxes) == sum(shape), f"{n}: {len(boxes)} drawings"
    return im, boxes


def group(im, boxes, names, game_size):
    """Drawings that belong together, one scale for all, each standing on its canvas's bottom."""
    size = (game_size[0] * S, game_size[1] * S)
    scale = fit(boxes, size)
    for b, name in zip(boxes, names):
        if name:
            save(place(im, b, size, scale), name)


def each(im, boxes, names, game_size):
    size = (game_size[0] * S, game_size[1] * S)
    for b, name in zip(boxes, names):
        if name:
            save(place(im, b, size, fit([b], size)), name)


def grid(im, cols, rows, inset=0.0):
    """An edge-to-edge picture cut into equal cells, each trimmed by `inset` of its size (the cells' frames)."""
    w, h = im.size
    out = []
    for r in range(rows):
        for c in range(cols):
            x0, y0, x1, y1 = c * w / cols, r * h / rows, (c + 1) * w / cols, (r + 1) * h / rows
            dx, dy = (x1 - x0) * inset, (y1 - y0) * inset
            out.append(im.crop((round(x0 + dx), round(y0 + dy), round(x1 - dx), round(y1 - dy))))
    return out


def content(im):
    """
    The picture without the bands Gemini left round some (a beige one, then a grey
    one, right and bottom): pale and colourless, which nothing in these dark sea
    pictures is.
    """
    px = im.load()
    w, h = im.size
    pale = lambda p: min(p) > 90 and max(p) - min(p) < 32
    band = lambda pts: sum(1 for q in pts if pale(px[q])) > 0.9 * len(pts)
    x1 = w
    while x1 > w // 2 and band([(x1 - 1, y) for y in range(0, h, 8)]):
        x1 -= 1
    y1 = h
    while y1 > h // 2 and band([(x, y1 - 1) for x in range(0, x1, 8)]):
        y1 -= 1
    # A row or two of the band's soft edge stays: take off a few more.
    return im.crop((0, 0, max(1, x1 - 4), max(1, y1 - 4)))


def main():
    ART.mkdir(exist_ok=True)
    # 1, 2: the crew, four suits a sheet, six poses each.
    for n, suits in ((1, SUITS[:4]), (2, SUITS[4:])):
        im, boxes = sheet(n, [6] * 4, rules=True)
        names = [f"crew_{s}_{p}" for s in suits for p in POSES]
        group(im, boxes, names, CREW_SIZE)
    # 3: faces.
    im, boxes = sheet(3, [4, 4])
    each(im, boxes, [f"face_{s}" for s in SUITS], (64, 64))
    # 4: the Mimic.
    im, boxes = sheet(4, [3, 2], rules=True)
    group(im, boxes[:3], ["mimic_suit", "mimic_open", "mimic_shown"], (64, 64))
    each(im, boxes[3:], ["tentacle", "ice_burst"], (64, 40))
    # 5: floors, edge to edge, four by two.
    for name, cell in zip(["metal", "grating", "glass", "lab", "concrete", "rug", "plates", "guide"], grid(raw(5), 4, 2, 0.06)):
        side = min(cell.size)
        sq = cell.crop(((cell.width - side) // 2, (cell.height - side) // 2, (cell.width + side) // 2, (cell.height + side) // 2))
        save(sq.resize((32 * S, 32 * S), Image.LANCZOS).convert("RGBA"), f"floor_{name}")
    # 6: walls.
    im, boxes = sheet(6, [3, 4, 4])
    each(im, boxes, ["wall", "wall_porthole", "wall_glass", "corner_in", "corner_out", "door_shut", "door_open",
                     "wall_pipes", "wall_lamp", "hatch_shut", "hatch_open"], (64, 48))
    # 7: props.
    im, boxes = sheet(7, [4, 4, 4])
    each(im, boxes, ["desk", "pump", "reef_tank", "lab_table", "lockers", "sub", "beacon", "crate",
                     "hose", "fan", "plant", "bench"], (56, 56))
    # 8: the ocean, without the bands round it.
    save(content(raw(8)).convert("RGBA"), "ocean")
    # 9: sea life.
    im, boxes = sheet(9, [4, 4])
    each(im, boxes, ["fish", "school", "jelly", "turtle", "ray", "octopus", "angler", "seahorse"], (48, 32))
    # 10: the four job panels, side by side.
    for name, cell in zip(["panel_wires", "panel_crystals", "panel_valve", "panel_scan"], grid(raw(10), 4, 1, 0.0)):
        save(cell.convert("RGBA"), name)
    # 11, 12: the meeting room and the title.
    save(raw(11).convert("RGBA"), "meeting_room")
    save(content(raw(12)).convert("RGBA"), "title")
    print(len(list(ART.glob("*.png"))), "pictures in", ART)


if __name__ == "__main__":
    main()
