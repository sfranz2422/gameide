#!/usr/bin/env python3
"""
Cuts the teacher's 9 Gemini pictures (PROMPTS.md, in order, copied into raw/ as
01.jpeg … 09.jpeg) into the named pictures in art/, which build.py reads. Both raw/
and art/ are committed, so the art can't be lost.

    python3 showcase/alchemy/cut_sheets.py

Pictures 2 to 9 are the icon sheets, six icons a row and three rows, in THINGS' order
(_1rules.py), 18 to a sheet. The magenta is taken out as for Stack Shack (its key_out,
and `own` so a box never keeps a sliver of the next icon).

Gemini drew every sheet inside a wooden frame (the workbench it had just been asked
for), with the magenta only in the middle, so each sheet is cut down to its magenta
first (`magenta_box`). Picture 1 came back not as the workbench but as a sheet of 18
adventure things on magenta; they aren't in the game, but they're good art, so they're
cut too (EXTRAS, art/extra_*.png) for the art library. The bench stays the build's.
"""
import importlib.util
from pathlib import Path

import numpy as np
from scipy import ndimage
from PIL import Image

HERE = Path(__file__).resolve().parent
RAW, ART = HERE / "raw", HERE / "art"
CAP = 256


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_sw = _load("sandwich_cut", HERE.parent / "sandwich" / "cut_sheets.py")
_rpg = _load("rpg_cut", HERE.parent / "rpg" / "cut_sheets.py")
GAME = {}
exec((HERE / "game" / "_1rules.py").read_text(), GAME)
PER_SHEET = 18
EXTRAS = ["magnifier", "key", "compass", "binoculars", "lantern", "treasure_map", "chest", "shovel", "leaf",
          "fossil", "adventure_book", "bell", "butterfly", "stopwatch", "potion", "satchel", "lens", "camera"]


def magenta_box(im):
    """Just the magenta part of a sheet: the rows and columns that are mostly magenta,
    a few pixels in from where the wooden frame begins."""
    p = np.asarray(im.convert("RGB")).astype(int)
    m = (p[..., 0] > 170) & (p[..., 1] < 110) & (p[..., 2] > 170)
    rows = np.where(m.mean(axis=1) > 0.2)[0]
    cols = np.where(m.mean(axis=0) > 0.2)[0]
    return im.crop((cols.min() + 6, rows.min() + 6, cols.max() - 5, rows.max() - 5))


def key_magenta(im):
    """
    The magenta out, by how magenta a pixel is (red and blue both well above green),
    not by its distance from one corner's colour as Stack Shack's key_out does: these
    sheets' magenta is lighter in the middle than at the edges, and the animals' sheet
    came out as one big drawing.

    Only magenta-ish pixels joined to the sheet's edge go (and pure magenta anywhere,
    as in the gaps of a wheel): a pink flower's petals sit inside its dark outline, and
    were eaten when every pinkish pixel went. Gemini's pink glows lie outside the
    outlines, joined to the background, so they go, as they should.
    """
    p = np.asarray(im.convert("RGB")).astype(np.float64)
    score = np.minimum(p[..., 0], p[..., 2]) - p[..., 1]
    soft = np.clip((CLEAR - score) / (CLEAR - SOLID), 0, 1)
    labels, _ = ndimage.label(score > SOLID)
    edge = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    outside = np.isin(labels, list(edge)) | (score > CLEAR)
    a = np.where(outside, soft, 1.0)
    bg = p[score > CLEAR].mean(axis=0)
    safe = np.where(a > 0, a, 1)[..., None]
    rgb = np.clip((p - (1 - a[..., None]) * bg) / safe, 0, 255)
    out = np.dstack([rgb, a * 255]).round().astype(np.uint8)
    out[a == 0] = 0
    return Image.fromarray(out, "RGBA")


SOLID, CLEAR = 60, 125      # magenta-ness: at or under SOLID a pixel is drawing; over CLEAR, background


PINK = {"icon_flower"}       # pink all through, with gaps in its outline: keyed the old way (it came out dark red)


def icons(n, names):
    """A sheet's 18 icons, cut by the grid Gemini drew them on (six across, three down):
    each cell's drawing, cropped to what's drawn. (Finding drawings as patches joined
    fireworks, which are many small sparks, to the balloons beside them.) A bit of a
    neighbour reaching over the grid line is left out: a small patch touching the cell's
    side, when the cell's own drawing is much bigger."""
    sheet = magenta_box(Image.open(RAW / f"{n:02d}.jpeg"))
    im = key_magenta(sheet)
    old = _sw.key_out(sheet) if PINK & set(names) else None
    h, w = im.height, im.width
    for i, name in enumerate(names):
        c, r = i % 6, i // 6
        x0, x1, y0, y1 = w * c // 6, w * (c + 1) // 6, h * r // 3, h * (r + 1) // 3
        cell = (old if name in PINK else im).crop((x0, y0, x1, y1))
        a = np.asarray(cell.getchannel("A")) > 128
        labels, k = ndimage.label(a)
        sizes = ndimage.sum(a, labels, range(1, k + 1))
        keep = np.zeros(k + 1, bool)
        for j, sl in enumerate(ndimage.find_objects(labels), start=1):
            at_side = sl[1].start == 0 or sl[1].stop == a.shape[1] or sl[0].start == 0 or sl[0].stop == a.shape[0]
            keep[j] = not (at_side and sizes[j - 1] < 0.15 * sizes.max())
        mask = ndimage.binary_dilation(keep[labels], iterations=3)
        px = np.asarray(cell).copy()
        px[..., 3] = np.where(mask, px[..., 3], 0)
        cell = Image.fromarray(px, "RGBA")
        assert cell.getbbox(), f"{n}: nothing drawn for {name}"
        part = cell.crop(cell.getbbox())
        part.thumbnail((CAP, CAP), Image.LANCZOS)
        part.save(ART / f"{name}.png", optimize=True)


def main():
    ART.mkdir(exist_ok=True)
    icons(1, [f"extra_{k}" for k in EXTRAS])
    keys = list(GAME["THINGS"])
    for n in range(2, 2 + (len(keys) + PER_SHEET - 1) // PER_SHEET):
        icons(n, [f"icon_{k}" for k in keys[(n - 2) * PER_SHEET:(n - 1) * PER_SHEET]])
    print(f"{sum(1 for _ in ART.glob('*.png'))} pictures in {ART}")


if __name__ == "__main__":
    main()
