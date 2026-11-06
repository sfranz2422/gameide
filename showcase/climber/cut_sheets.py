#!/usr/bin/env python3
"""
Cuts the teacher's 12 Gemini pictures (PROMPTS.md, in order, copied into raw/ as
01.jpeg … 12.jpeg) into the named pictures in art/, which build.py reads. Both
raw/ and art/ are committed, so the art can't be lost the way older games' was.

    python3 showcase/climber/cut_sheets.py

Pictures here are kept at twice the game's size; build.py shrinks them.
"""
import importlib.util
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
RAW, ART = HERE / "raw", HERE / "art"
S = 2

_spec = importlib.util.spec_from_file_location("rpg_cut", HERE.parent / "rpg" / "cut_sheets.py")
_rpg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_rpg)
cut, place, fit = _rpg.cut, _rpg.place, _rpg.fit


def key_out(im):
    """
    Gemini's "magenta" came back a darker pink, about (193, 58, 148), and not quite
    the same on every picture, so the colour is read from the corner. Near it is
    see-through; the edge between is part see-through, with the pink taken back
    out of its colour, or every outline would have a pink rim.
    """
    im = im.convert("RGB")
    bg = im.getpixel((4, 4))
    out = Image.new("RGBA", im.size)
    src, dst = im.load(), out.load()
    for y in range(im.height):
        for x in range(im.width):
            p = src[x, y]
            d = ((p[0] - bg[0]) ** 2 + (p[1] - bg[1]) ** 2 + (p[2] - bg[2]) ** 2) ** 0.5
            a = 0.0 if d < 45 else 1.0 if d > 110 else (d - 45) / 65
            if a == 0:
                dst[x, y] = (0, 0, 0, 0)
            elif a < 1:
                dst[x, y] = tuple(max(0, min(255, round((p[i] - (1 - a) * bg[i]) / a))) for i in range(3)) + (round(a * 255),)
            else:
                dst[x, y] = p + (255,)
    return out


def raw(n):
    return Image.open(RAW / f"{n:02d}.jpeg")


def sheet(n, shape, loose=True):
    im = key_out(raw(n))
    boxes = cut(im, shape, loose)
    assert len(boxes) == sum(shape), f"{n}: {len(boxes)} drawings"
    return im, boxes


def save(pic, name):
    pic.save(ART / f"{name}.png", optimize=True)


def crop_scaled(im, box, k):
    part = im.crop(box)
    return part.resize((max(1, round(part.width * k)), max(1, round(part.height * k))), Image.LANCZOS)


# The climbers' order, as the picker and the board know them.
CLIMBERS = ["red", "teal", "purple", "orange", "penguin", "bear", "fox", "yeti"]
POSES = ["stand", "run1", "run2", "jump", "fall", "throw"]
CLIMBER_SIZE = (48, 56)


def no_shadow(pic):
    """
    Gemini drew a shadow line under every climber, joined to the feet, so it came
    with them. It is dark magenta (the pink background mixed in); boots are dark
    navy or brown. Only the bottom of the picture is looked at.
    """
    px = pic.load()
    w, h = pic.size
    for y in range(int(h * 0.82), h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and g <= 50 and 35 <= r <= 150 and 35 <= b <= 150 and abs(r - b) < 50:
                px[x, y] = (0, 0, 0, 0)

    # Under the white animals the line is dark navy, like an outline: it is the solid
    # dark rows at the very bottom, wider than the feet above them on both sides.
    def row(y):
        xs = [x for x in range(w) if px[x, y][3] > 128]
        dark = sum(1 for x in xs if sum(px[x, y][:3]) < 200)
        return xs, dark

    y = h - 1
    while y > 0 and not row(y)[0]:
        y -= 1
    block = []
    while y > 0 and len(block) < 7:
        xs, dark = row(y)
        if not xs or dark < 0.95 * len(xs):
            break
        block.append((y, min(xs), max(xs)))
        y -= 1
    above = row(y)[0]
    if block and above and min(b[1] for b in block) <= min(above) - 2 and max(b[2] for b in block) >= max(above) + 2:
        for by, _, _ in block:
            for x in range(w):
                px[x, by] = (0, 0, 0, 0)
    return no_lines(pic)


def no_lines(pic):
    """
    Thin lines that aren't the climber (the row above's shadow, caught in this
    drawing's box) go: loose ones, and a dark bar along the top much wider than
    what's under it (one touched the bear's pom-pom, so it wasn't loose).
    """
    px = pic.load()
    w, h = pic.size

    def span(y):
        xs = [x for x in range(w) if px[x, y][3] > 20]
        return xs

    top = next((y for y in range(h) if span(y)), None)
    if top is not None:
        bar = [y for y in range(top, min(h, top + 7)) if len(span(y)) > 30]
        under = span(bar[-1] + 1) if bar else []
        if bar and len(bar) <= 6 and len(under) < 0.5 * len(span(bar[0])):
            for y in bar:
                for x in range(w):
                    px[x, y] = (0, 0, 0, 0)
    seen = bytearray(w * h)
    for y0 in range(h):
        for x0 in range(w):
            if px[x0, y0][3] < 40 or seen[y0 * w + x0]:
                continue
            stack, part = [(x0, y0)], []
            seen[y0 * w + x0] = 1
            while stack:
                x, y = stack.pop()
                part.append((x, y))
                for nx in (x - 1, x, x + 1):
                    for ny in (y - 1, y, y + 1):
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] >= 40:
                            seen[ny * w + nx] = 1
                            stack.append((nx, ny))
            xs = [p[0] for p in part]
            ys = [p[1] for p in part]
            if max(ys) - min(ys) <= 8 and max(xs) - min(xs) >= 16:
                for x, y in part:
                    px[x, y] = (0, 0, 0, 0)
    return pic


def climbers():
    for n, names in ((1, CLIMBERS[:4]), (2, CLIMBERS[4:])):
        # Small bits (the shadow line, the snowball in the throw, speed lines) are dropped:
        # the game draws its own snowball.
        im, boxes = sheet(n, [6, 6, 6, 6], loose=False)
        size = (CLIMBER_SIZE[0] * S, CLIMBER_SIZE[1] * S)
        for row, name in enumerate(names):
            mine = boxes[row * 6:row * 6 + 6]
            k = fit(mine, size)
            for b, pose in zip(mine, POSES):
                save(no_shadow(place(im, b, size, k)), f"climber_{name}_{pose}")


def faces():
    im, boxes = sheet(3, [4, 4])
    size = (64 * S, 64 * S)
    k = fit(boxes, size)
    for b, name in zip(boxes, CLIMBERS):
        save(place(im, b, size, k), f"face_{name}")


def snowballs():
    im, boxes = sheet(4, [3, 3])
    ball, squash, splat, burst, puffs, stars = boxes
    save(place(im, ball, (16 * S, 16 * S), fit([ball], (16 * S, 16 * S))), "snowball")
    save(place(im, squash, (20 * S, 16 * S), fit([squash], (20 * S, 16 * S))), "snowball_fast")
    k = fit([splat, burst, puffs], (56 * S, 48 * S))
    for b, name in ((splat, "splat_0"), (burst, "splat_1"), (puffs, "splat_2")):
        pic = place(im, b, (56 * S, 48 * S), k)
        if name == "splat_2":
            # Soft puffs, mostly see-through, kept the pink: snow-white, keeping their shape.
            pic = Image.merge("RGBA", (*Image.new("RGB", pic.size, (225, 238, 255)).split(), pic.getchannel("A")))
        save(pic, name)
    save(place(im, stars, (40 * S, 24 * S), fit([stars], (40 * S, 24 * S))), "stars")


def ledges():
    """The pieces at half the sheet's size; build.py puts ledges of each width together from them."""
    im, boxes = sheet(5, [3, 3, 3, 2])
    names = ["ice_l", "ice_m", "ice_r", "rock_l", "rock_m", "rock_r", "crumble_0", "crumble_1", "crumble_2", "plank", "iceblock"]
    for b, name in zip(boxes, names):
        save(crop_scaled(im, b, 0.5), name)


def decor():
    im, boxes = sheet(7, [4, 4])
    names = ["icicles", "pine_small", "pine_tall", "crystals", "flag", "snowball_pile", "sign", "bird"]
    for b, name in zip(boxes, names):
        save(crop_scaled(im, b, 0.4), name)


def camp():
    im = key_out(raw(8))
    box = im.getbbox()
    save(crop_scaled(im, box, 1280 / im.width), "camp")


def skies():
    """Three bands on one picture, with dark borders round them: each band is where the rows aren't dark."""
    im = raw(9).convert("RGB")
    w, h = im.size
    edge = im.getpixel((4, 4))
    px = im.load()

    def border(points):
        """A line that's (nearly) all the border's colour."""
        near = sum(1 for p in points if sum(abs(p[i] - edge[i]) for i in range(3)) < 40)
        return near > 0.97 * len(points)

    rows = [border([px[x, y] for x in range(0, w, 8)]) for y in range(h)]
    bands, start = [], None
    for y, b in enumerate(rows + [True]):
        if not b and start is None:
            start = y
        elif b and start is not None:
            if y - start > 100:
                bands.append((start, y))
            start = None
    assert len(bands) == 3, bands
    cols = [border([px[x, y] for y in range(bands[0][0], bands[0][1], 4)]) for x in range(w)]
    left = cols.index(False)
    right = w - list(reversed(cols)).index(False)
    for (top, bottom), name in zip(bands, ("sky_day", "sky_dusk", "sky_night")):
        # A few pixels in from the border on every side: its edge is soft.
        box = (left + 6, top + 6, right - 6, bottom - 6)
        part = im.crop(box)
        save(part.resize((1280, round(part.height * 1280 / part.width)), Image.LANCZOS).convert("RGBA"), name)


def mountains():
    im = key_out(raw(10))
    save(crop_scaled(im, im.getbbox(), 1280 / im.width), "far_mountains")


def clouds():
    im, boxes = sheet(11, [3, 3])
    for i, b in enumerate(boxes):
        save(crop_scaled(im, b, 0.35), f"cloud_{i}")


def wall():
    """
    Side to side it repeats; top to bottom it didn't (a hard line where one copy
    met the next), and the walls repeat top to bottom. So the bottom band is faded
    into the top: the picture loses that band's height and joins itself.
    """
    im = raw(6).convert("RGBA")
    im = im.resize((im.width // 4, im.height // 4), Image.LANCZOS)
    w, h = im.size
    band = 64
    out = im.crop((0, 0, w, h - band))
    for y in range(band):
        t = (y + 0.5) / band   # 0 at the top: all the bottom band; 1: all the picture's own top
        row = Image.blend(im.crop((0, h - band + y, w, h - band + y + 1)), im.crop((0, y, w, y + 1)), t)
        out.paste(row, (0, y))
    save(out, "wall")


def title():
    im = raw(12).convert("RGBA")
    save(im.resize((1280, 720), Image.LANCZOS), "title")


if __name__ == "__main__":
    ART.mkdir(exist_ok=True)
    for step in (climbers, faces, snowballs, ledges, decor, camp, skies, mountains, clouds, wall, title):
        step()
        print("done", step.__name__)
    print(len(list(ART.glob("*.png"))), "pictures in", ART)
