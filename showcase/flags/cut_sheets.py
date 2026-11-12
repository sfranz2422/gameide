#!/usr/bin/env python3
"""
Cuts the teacher's 9 Gemini pictures (PROMPTS.md, in order, copied into raw/ as
01.jpeg … 09.jpeg) into the named pictures in art/, which build.py reads. Both raw/
and art/ are committed, so the art can't be lost the way older games' was.

    python3 showcase/flags/cut_sheets.py

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

# A kid's frames, in the order the game numbers them (KID_FRAMES in the rules).
WALKS = ["down", "down_walk", "up", "up_walk", "side", "side_walk1", "side_walk2"]
# The action sheet's eight, as drawn: the first (a wind-up facing you) isn't used.
ACTIONS = [None, "throw_down", "throw_side", "throw_up", "scoop", "fallen", "dizzy", "cheer"]
KID_SIZE = (44, 52)        # in the game: a frame of a kid, feet on its bottom row
LOOKS = 4


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


def kids(team, walk_n, action_n):
    """A team's four kids: every frame of one kid at one scale, so they stay one size as they change."""
    wim, wboxes = sheet(walk_n, [7] * LOOKS)
    aim, aboxes = sheet(action_n, [8] * LOOKS)
    size = (KID_SIZE[0] * S, KID_SIZE[1] * S)
    for look in range(LOOKS):
        w = wboxes[look * 7:(look + 1) * 7]
        a = [b for b, name in zip(aboxes[look * 8:(look + 1) * 8], ACTIONS) if name]
        # The scale is the walking frames' (the actions are wider: a throw's arm, sitting in
        # the snow), so a kid is the same height walking as throwing; a wide action shrinks to fit.
        scale = fit(w, size)
        for b, name in zip(w, WALKS):
            save(place(wim, b, size, scale), f"kid_{team}_{look}_{name}")
        for b, name in zip(a, [n for n in ACTIONS if n]):
            k = min(scale, fit([b], size))
            save(place(aim, b, size, k), f"kid_{team}_{look}_{name}")


def without(im, boxes):
    """A copy of a keyed sheet with the drawings in `boxes` rubbed out (each filled from a solid pixel near its middle)."""
    from PIL import ImageDraw
    a = im.getchannel("A")
    for x0, y0, x1, y1 in boxes:
        seed = next(((x, y) for y in range((y0 + y1) // 2, y1) for x in range((x0 + x1) // 2, x1, 3)
                     if a.getpixel((x, y)) == 255), None)
        if seed is not None:
            ImageDraw.floodfill(a, seed, 0, thresh=200)
    out = im.copy()
    out.putalpha(a)
    return out


def cells(im, cols, rows, dark=90):
    """The tiles on sheet 6: squares on a dark ground, found by where the picture is bright."""
    g = im.convert("L")
    w, h = g.size
    px = g.load()
    col_lit = [sum(1 for y in range(0, h, 6) if px[x, y] > dark) > (h / 6) * 0.3 for x in range(w)]
    row_lit = [sum(1 for x in range(0, w, 6) if px[x, y] > dark) > (w / 6) * 0.3 for y in range(h)]

    def runs(lit):
        out, start = [], None
        for i, on in enumerate(lit + [False]):
            if on and start is None:
                start = i
            elif not on and start is not None:
                if i - start > 20:
                    out.append((start, i))
                start = None
        return out

    xs, ys = runs(col_lit), runs(row_lit)
    assert len(xs) == cols and len(ys) == rows, f"tiles: {len(xs)} columns, {len(ys)} rows"
    out = []
    for y0, y1 in ys:
        for x0, x1 in xs:
            # In past each square's edge: Gemini drew a faint frame round every one, which
            # showed as a line between every two tiles on the ground.
            m = round((x1 - x0) * 0.05)
            out.append(im.crop((x0 + m, y0 + m, x1 - m, y1 - m)))
    return out


TILES = [["snow", "snow2", "prints", "path_v", "path_h", "trodden_h"],
         ["ice", "ice2", "bridge", "grass", "bank_top", "twigs"],
         ["puddle", "bank_bottom", "edge_left", "edge_right", "path_cross", "twigs2"]]


def main():
    ART.mkdir(exist_ok=True)
    # 1-4: the kids, Red then Blue.
    kids("red", 1, 2)
    kids("blue", 3, 4)
    # 5: forts and flags. By rows (middles from the top): the two forts; the small flags,
    # a stick and a stand; the two big flags; the two dropped flags and the other stand.
    im, boxes = sheet(5, [2, 4, 2, 3])
    # The forts' boxes reach down over the tops of the small flags below them: stop short.
    forts = [(b[0], b[1], b[2], min(b[3], boxes[2][1] - 4)) for b in boxes[:2]]
    each(im, forts, ["fort_red", "fort_blue"], (224, 160))
    # At home: the small flags, each on its mound of snow. Carried: the big flags, pole and
    # cloth only (the bottom of the picture, where a mound is, cut off). The blue fort's
    # snowy base reaches into the small blue flag's box: the forts are rubbed out first.
    flags = without(im, boxes[:2])
    each(flags, boxes[2:6], ["flag_red", "flag_blue", None, "stand"], (40, 52))
    held = [(b[0], b[1], b[2], b[1] + round((b[3] - b[1]) * 0.78)) for b in boxes[6:8]]
    each(im, held, ["flag_red_held", "flag_blue_held"], (40, 52))
    each(im, boxes[8:10], ["flag_red_down", "flag_blue_down"], (44, 26))
    # 6: ground tiles.
    for name, tile in zip([n for row in TILES for n in row], cells(raw(6), 6, 3)):
        save(tile.resize((32 * S, 32 * S), Image.LANCZOS).convert("RGBA"), f"tile_{name}")
    # 7: trees, banks and the park's things.
    im, boxes = sheet(7, [4, 4, 4])
    sizes = {"pine_big": (56, 72), "pine": (48, 60), "pine_small": (36, 46), "oak": (60, 70),
             "bank": (64, 30), "drift": (44, 34), "hedge": (64, 34), "berries": (40, 40),
             "snowman": (32, 44), "sled": (44, 28), "bench": (52, 40), "lamp": (28, 64)}
    names = ["pine_big", "pine", "pine_small", "oak", "bank", "drift", "hedge", "berries", "snowman", "sled", "bench", "lamp"]
    for b, name in zip(boxes, names):
        each(im, [b], [name], sizes[name])
    # 8: snowballs, splats, footprints, a pile. The third splat is a cloud of loose dots,
    # no one drawing: it's cut from where it is on the sheet, between the second and the prints.
    im, boxes = sheet(8, [4, 4, 4], loose=False)
    each(im, boxes[:1], ["snowball"], (12, 12))
    each(im, boxes[3:4], ["snowball_flying"], (24, 14))
    each(im, boxes[4:6], ["splat_0", "splat_1"], (32, 32))
    dust = (boxes[5][2] + 40, boxes[5][1] - 90, boxes[6][0] - 40, boxes[5][3] + 50)
    each(im, [dust], ["splat_2"], (32, 32))
    each(im, boxes[6:7], ["prints"], (16, 14))
    each(im, boxes[7:8], ["pile"], (24, 20))
    # 9: the title, at twice the game's screen (640 × 360), like everything here.
    save(raw(9).resize((640 * S, 360 * S), Image.LANCZOS).convert("RGBA"), "title")
    print(len(list(ART.glob("*.png"))), "pictures in", ART)


if __name__ == "__main__":
    main()
