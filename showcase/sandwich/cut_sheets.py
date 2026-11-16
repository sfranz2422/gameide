#!/usr/bin/env python3
"""
Cuts the teacher's 9 Gemini pictures (PROMPTS.md, in order, copied into raw/ as
01.jpeg … 09.jpeg) into the named pictures in art/, which build.py reads. Both raw/
and art/ are committed, so the art can't be lost.

    python3 showcase/sandwich/cut_sheets.py

Gemini drew every filling and slice from ABOVE, not from the side as asked. That
suits the game better: build.py squashes each one flat and gives it a side as thick
as the layer is (`slab`), so the pile is seen from a little above, as the plates
on the shelf are. So art/ keeps each drawing as Gemini drew it (food_<key>,
slice_<bread>), cropped, at most CAP pixels across; the build does the rest.

Sheet 3's top row is loaves again (sheet 2 has them on boards, which the game
uses), with a sourdough slice drawn loose between the rows; only its bottom row,
the slices, is used.
"""
import importlib.util
from pathlib import Path

import numpy as np
from scipy import ndimage
from PIL import Image

HERE = Path(__file__).resolve().parent
RAW, ART = HERE / "raw", HERE / "art"
CAP = 600


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_rpg = _load("rpg_cut", HERE.parent / "rpg" / "cut_sheets.py")
GAME = {}
exec((HERE / "game" / "_1rules.py").read_text(), GAME)


def key_out(im):
    """
    The magenta behind the drawings, read from the sheet's own corner (it's never
    quite #FF00FF), made see-through; the edge between is part see-through with
    the pink taken back out of its colour, so no outline keeps a pink rim. The same
    rule as Snowcap's key_out, done with numpy (these sheets are 4 megapixels).
    """
    p = np.asarray(im.convert("RGB")).astype(np.float64)
    bg = p[4:20, 4:20].reshape(-1, 3).mean(axis=0)
    d = np.sqrt(((p - bg) ** 2).sum(axis=2))
    # A narrow band: ham and roast beef are pinks and reds not far from magenta, and
    # with Snowcap's wider one (45-110) they came out part see-through and green.
    a = np.clip((d - 30) / 35, 0, 1)
    safe = np.where(a > 0, a, 1)[..., None]
    rgb = np.clip((p - (1 - a[..., None]) * bg) / safe, 0, 255)
    # Despill: near the edge, magenta that's still in a colour (red and blue both above
    # green) comes back out, or the boards and bottles keep a pink rim. Only near the
    # edge: ham, onions and jelly are rightly pink and purple inside.
    edge = ndimage.binary_dilation(a < 0.5, iterations=6) & (a > 0)
    spill = np.clip(np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1], 0, None)
    for c in (0, 2):
        rgb[..., c] = np.where(edge, rgb[..., c] - spill * 0.85, rgb[..., c])
    out = np.dstack([rgb, a * 255]).round().astype(np.uint8)
    out[a == 0] = 0
    return Image.fromarray(out, "RGBA")


def raw(n):
    return Image.open(RAW / f"{n:02d}.jpeg")


def sheet(n, shape):
    im = key_out(raw(n))
    boxes = _rpg.cut(im, shape, True)
    assert len(boxes) == sum(shape), f"{n}: {len(boxes)} drawings"
    return im, boxes


def own(im, box, boxes):
    """Just this drawing out of its box: a box can take in the edge of the next drawing
    (a cucumber's box held a sliver of the onion beside it). Each patch of drawing
    belongs to the box its middle is in, or the nearest; everything else is cleared."""
    a = np.asarray(im.getchannel("A"))
    labels, n = ndimage.label(a > 128)
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
        near = min(boxes, key=lambda b: max(b[0] - cx, cx - b[2], 0) ** 2 + max(b[1] - cy, cy - b[3], 0) ** 2)
        keep[i] = near == box
    mask = ndimage.binary_dilation(keep[labels], iterations=4)
    out = np.asarray(im).copy()
    out[..., 3] = np.where(mask, out[..., 3], 0)
    return Image.fromarray(out, "RGBA")


def save(im, box, name, turn=0, boxes=None):
    if boxes is not None:
        im = own(im, box, boxes)
    part = im.crop(box)
    if turn:
        part = part.rotate(turn, expand=True)
    if part.width > CAP:
        part = part.resize((CAP, round(part.height * CAP / part.width)), Image.LANCZOS)
    part.save(ART / f"{name}.png", optimize=True)


def whole(n, name, size):
    """A picture with no magenta (the kitchen, the book), at twice the game's size."""
    raw(n).convert("RGB").resize((size[0] * 2, size[1] * 2), Image.LANCZOS).save(ART / f"{name}.png", optimize=True)


def main():
    ART.mkdir(exist_ok=True)
    view = (GAME["VIEW_W"], GAME["VIEW_H"])
    breads = [b["key"] for b in GAME["BREADS"]]
    layers = GAME["LAYERS"]
    whole(1, "kitchen", view)
    whole(9, "book", view)
    # Loaves on their boards, turned to lie across (the handle to the left), as the knife cuts them.
    im, boxes = sheet(2, [6])
    for key, b in zip(breads, boxes):
        save(im, b, f"loaf_{key}", turn=90, boxes=boxes)
    im, boxes = sheet(3, [6, 1, 6])
    for key, b in zip(breads, boxes[7:]):
        # The baguette's slice stands on end (split lengthways); turned, it lies across like the rest.
        save(im, b, f"slice_{key}", turn=90 if key == "baguette" else 0, boxes=boxes)
    order = {4: "meat", 5: "veg", 6: "more"}
    for n, kind in order.items():
        im, boxes = sheet(n, [5, 5])
        for key, b in zip([k for k in layers if layers[k]["kind"] == kind], boxes):
            save(im, b, f"food_{key}", boxes=boxes)
    im, boxes = sheet(7, [6])
    for key, b in zip([k for k in layers if layers[k]["kind"] == "sauce"], boxes):
        save(im, b, f"bottle_{key}", boxes=boxes)
    im, boxes = sheet(8, [4, 4])
    for key, b in zip(list(GAME["SIDES"]) + list(GAME["DRINKS"]), boxes):
        save(im, b, f"side_{key}" if key in GAME["SIDES"] else f"drink_{key}", boxes=boxes)
    print(f"{sum(1 for _ in ART.glob('*.png'))} pictures in {ART}")


if __name__ == "__main__":
    main()
