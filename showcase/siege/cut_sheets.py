#!/usr/bin/env python3
"""
Cuts the teacher's 13 Gemini pictures for the snowball fort war (PROMPTS.md, in
order, copied into raw/snow/ as 01.jpeg … 13.jpeg; 10-13 are the eight more cards) into the named pictures in
art/, which build.py reads. Both raw/ and art/ are committed, so the art can't be
lost. (raw/desk/ holds the first set, the desk, which the teacher replaced.)

    python3 showcase/siege/cut_sheets.py

Pictures here are kept at twice the game's size; build.py shrinks them.
"""
import importlib.util
import math
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
RAW, ART = HERE / "raw" / "snow", HERE / "art"
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

TROOPS = ["kid", "snowman", "owl", "penguin", "yeti"]
# In the game, each troop's frame (the canvas its drawing stands on, feet on the bottom).
TROOP_SIZE = {"kid": (24, 28), "snowman": (30, 34), "owl": (32, 26), "penguin": (24, 28), "yeti": (44, 46),
              "sled": (40, 28), "bear": (44, 32), "fox": (30, 20), "fairy": (22, 24), "icegolem": (36, 38)}
NEW_TROOPS = ["sled", "bear", "fox", "fairy", "icegolem"]


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


def bands(im, count):
    """The sheet's rows of drawings, top to bottom: the bands with clear space between them."""
    a = im.getchannel("A")
    w, h = im.size
    full = [any(a.getpixel((x, y)) > 40 for x in range(0, w, 3)) for y in range(h)]
    out, y = [], 0
    while y < h:
        if not full[y]:
            y += 1
            continue
        y0 = y
        while y < h and full[y]:
            y += 1
        if y - y0 > 12:
            out.append((y0, y))
    out.sort(key=lambda b: b[0])
    assert len(out) == count, f"{len(out)} rows, wanted {count}"
    return out


def row_boxes(im, counts):
    """Each row cut on its own (a pair of mittens is two pieces, which would throw a whole-sheet count)."""
    boxes = []
    for (y0, y1), n in zip(bands(im, len(counts)), counts):
        band = im.crop((0, y0, im.width, y1))
        for b in cut(band, [n], True):
            boxes.append((b[0], b[1] + y0, b[2], b[3] + y0))
    return boxes


def columns(im, count, min_gap=40):
    """
    A row's drawings by the clear columns between them: for drawings made of many small
    pieces (a burst of ice sparks, a swirl of snowflakes), which a count of pieces muddles.
    """
    a = im.getchannel("A")
    w, h = im.size
    used = [any(a.getpixel((x, y)) > 40 for y in range(0, h, 3)) for x in range(w)]
    spans, x = [], 0
    while x < w:
        if not used[x]:
            x += 1
            continue
        x0 = x
        while x < w and (used[x] or any(used[x:x + min_gap])):
            x += 1
        spans.append((x0, x))
    assert len(spans) == count, f"{len(spans)} columns, wanted {count}"
    boxes = []
    for x0, x1 in spans:
        part = im.crop((x0, 0, x1, h))
        b = part.getbbox()
        boxes.append((x0 + b[0], b[1], x0 + b[2], b[3]))
    return boxes


def framed(pic, size=88):
    """A card for a drawing Gemini didn't give one of its own: the same dark frame, a pale winter sky."""
    card = Image.new("RGBA", (size, size))
    from PIL import ImageDraw
    d = ImageDraw.Draw(card)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=6, fill=(35, 26, 46, 255))
    for y in range(4, size - 4):
        k = (y - 4) / (size - 8)
        d.line((4, y, size - 5, y), fill=(round(196 + 40 * k), round(226 + 20 * k), 250, 255))
    pic = pic.crop(pic.getbbox())
    k = min((size - 20) / pic.width, (size - 20) / pic.height)
    pic = pic.resize((round(pic.width * k), round(pic.height * k)), Image.LANCZOS)
    card.alpha_composite(pic, ((size - pic.width) // 2, (size - pic.height) // 2))
    return card


def main():
    ART.mkdir(exist_ok=True)
    for old in ART.glob("*.png"):
        old.unlink()
    # 1, 2: the troops, five rows of three (walking twice and attacking; an owl's wings up, down, diving).
    for n, team in ((1, "blue"), (2, "red")):
        im, boxes = sheet(n, [3] * 5)
        for r, troop in enumerate(TROOPS):
            group(im, boxes[r * 3:r * 3 + 3], [f"{troop}_{team}_{k}" for k in range(3)], TROOP_SIZE[troop])
    # 3: fort towers (whole, cracked, crumbled) and ice castles.
    im, boxes = sheet(3, [3, 3, 3])
    group(im, boxes[0:3], ["tower_blue_0", "tower_blue_1", "tower_blue_2"], (40, 52))
    group(im, boxes[3:6], ["tower_red_0", "tower_red_1", "tower_red_2"], (40, 52))
    group(im, boxes[6:9], ["castle_blue", "castle_red", "castle_broken"], (64, 54))
    # 4: the snowy ground.
    save(raw(4).resize((256 * S, 256 * S), Image.LANCZOS).convert("RGBA"), "snow")
    # 5: winter things: bridges, the sled; mittens, scarf, cocoa, pine cone, carrot; the wall, ice, a heap, snowballs.
    im = key_out(raw(5))
    boxes = row_boxes(im, [3, 6, 5])
    save(level(im.crop(boxes[0])), "bridge")
    each(im, [boxes[2]], ["sled"], (44, 30))
    each(im, boxes[3:9], [None, None, "scarf", "mug", "cone", "carrot"], (24, 24))
    each(im, boxes[9:14], ["snow_wall", "ice_patch", "heap", "snowball_blue", "snowball_red"], (48, 48))
    save(framed(im.crop(boxes[9])), "card_wall")
    save(framed(im.crop(boxes[12])), "card_snowball")
    save(framed(im.crop(boxes[10])), "card_ice")
    # 6: effects, one row.
    im = key_out(raw(6))
    each(im, columns(im, 6), ["puff", "spark", "snowshot", "icicle", "swirl", "sparkle"], (24, 24))
    # 7: pine trees for the field's edges.
    im, boxes = sheet(7, [4])
    for k, b in enumerate(boxes):
        each(im, [b], [f"pine_{k}"], (40, 52))
    # 8: the cards' pictures (Gemini drew three kids, and put the wall, snowball and ice on one card:
    # the first kid is Snow Kids; those three are framed from sheet 5, above).
    im, boxes = sheet(8, [4, 4])
    each(im, [boxes[0], boxes[3], boxes[4], boxes[5], boxes[6]],
         ["card_kids", "card_snowman", "card_owl", "card_penguin", "card_yeti"], (44, 44))
    # 9: the title.
    save(raw(9).convert("RGBA"), "title")
    # 10, 11: the eight new cards' troops (the teacher's ask, 2026-11-10), five rows of three.
    for n, team in ((10, "blue"), (11, "red")):
        im = key_out(raw(n))
        boxes = row_boxes(im, [3] * 5)
        for r, troop in enumerate(NEW_TROOPS):
            group(im, boxes[r * 3:r * 3 + 3], [f"{troop}_{team}_{k}" for k in range(3)], TROOP_SIZE[troop])
    # 12: cannons, the avalanche, cocoa and its warm glow, ice chunks and broken ice. Hearts,
    # broken ice and a cannon's shot are many small pieces: each row is cut by its columns.
    im = key_out(raw(12))
    boxes = []
    for y0, y1 in bands(im, 3):
        band = im.crop((0, y0, im.width, y1))
        boxes += [(b[0], b[1] + y0, b[2], b[3] + y0) for b in columns(band, 3)]
    group(im, boxes[0:3], ["cannon_blue", "cannon_red", "cannon_fire"], (44, 32))
    each(im, [boxes[3]], ["avalanche"], (60, 48))
    each(im, [boxes[4]], ["cocoa"], (26, 26))
    each(im, [boxes[5]], ["heal"], (40, 40))
    group(im, boxes[6:8], ["chunk_blue", "chunk_red"], (20, 20))
    each(im, [boxes[8]], ["ice_burst"], (40, 40))
    # 13: the new cards' pictures.
    im, boxes = sheet(13, [4, 4])
    each(im, boxes, [f"card_{c}" for c in ("sled", "bear", "foxes", "fairy", "cannon", "avalanche", "cocoa", "icegolem")], (44, 44))
    print(len(list(ART.glob("*.png"))), "pictures in", ART)


if __name__ == "__main__":
    main()
