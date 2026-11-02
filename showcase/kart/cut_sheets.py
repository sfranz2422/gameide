#!/usr/bin/env python3
"""
Cuts the teacher's Gemini sheets into the pictures PROMPTS.md names, in
~/Downloads/kart/ (the build reads them there). Gemini draws many pictures on
one sheet and never uses our names, so this finds each drawing on the flat
magenta, top row first, and says which is which below.

    python3 showcase/kart/cut_sheets.py KART_SHEET SCENERY_SHEET SKY_STRIP
"""
import sys
from pathlib import Path

from PIL import Image

OUT = Path("~/Downloads/kart").expanduser()
KART = (96, 72, 64)        # width, height, and the row the wheels stand on (build.py: KART_H - 8)

# Which drawing on the sheet is which view, and whether it faces the wrong way.
# The game wants the nose turned to the LEFT in views 1-7; Gemini drew most of
# them nose right. Its 22.5-degree view never came: 1 and 2 are both about 45.
KART_CELLS = [(0, False), (1, True), (2, True), (3, True), (4, True), (5, False), (6, True), (7, True), (8, False)]


def magenta_to_alpha(im):
    """Flat magenta becomes see-through, its JPEG fringe becoming part see-through and losing its pink."""
    im = im.convert("RGB")
    out = Image.new("RGBA", im.size)
    src, dst = im.load(), out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = src[x, y]
            # How magenta: red and blue both far above green.
            m = min(r, b) - g
            a = 255 if m < 70 else 0 if m > 170 else round(255 * (170 - m) / 100)
            if 0 < a < 255:
                r, b = min(r, g + 60), min(b, g + 60)
            dst[x, y] = (r, g, b, a)
    return out


def drawings(im, gap=24):
    """Each separate drawing's box, row by row. Works on a shrunk copy of the alpha, for speed."""
    k = 4
    small = im.getchannel("A").resize((im.width // k, im.height // k), Image.BILINEAR)
    w, h = small.size
    px = small.load()
    seen = bytearray(w * h)
    boxes = []
    for y0 in range(h):
        for x0 in range(w):
            if px[x0, y0] < 128 or seen[y0 * w + x0]:
                continue
            stack, box = [(x0, y0)], [x0, y0, x0, y0]
            seen[y0 * w + x0] = 1
            while stack:
                x, y = stack.pop()
                box = [min(box[0], x), min(box[1], y), max(box[2], x), max(box[3], y)]
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny] >= 128 and not seen[ny * w + nx]:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            if (box[2] - box[0]) * (box[3] - box[1]) > 400:
                boxes.append([(box[0] - 1) * k, (box[1] - 1) * k, (box[2] + 2) * k, (box[3] + 2) * k])
    # Into rows: boxes whose middles are within a third of a box's height.
    boxes.sort(key=lambda b: b[1])
    rows = []
    for b in boxes:
        mid = (b[1] + b[3]) / 2
        for row in rows:
            if abs(row[0] - mid) < (b[3] - b[1]) / 3:
                row[1].append(b)
                break
        else:
            rows.append([mid, [b]])
    return [b for _, row in rows for b in sorted(row, key=lambda b: b[0])]


def place(im, box, size, scale, base, stretch=1.0, flip=False):
    """A drawing on a canvas, centred across, standing on row `base`."""
    part = im.crop(box)
    if flip:
        part = part.transpose(Image.FLIP_LEFT_RIGHT)
    part = part.resize((max(1, round(part.width * scale)), max(1, round(part.height * scale * stretch))), Image.LANCZOS)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(part, (max(0, (size[0] - part.width) // 2), max(0, base - part.height)))
    return out


def main(kart_sheet, scenery_sheet, sky_strip):
    OUT.mkdir(exist_ok=True)
    # Pictures keep four times the game's size here; picture() in build.py shrinks them, smoothly.
    S = 4
    im = magenta_to_alpha(Image.open(kart_sheet))
    boxes = drawings(im)
    assert len(boxes) == 9, f"{len(boxes)} karts on the sheet, not 9"
    # One scale for all nine, so the kart doesn't change size as it turns.
    scale = min((KART[0] * S) / max(b[2] - b[0] for b in boxes), (KART[2] * S) / max(b[3] - b[1] for b in boxes))
    for k, (cell, flip) in enumerate(KART_CELLS):
        place(im, boxes[cell], (KART[0] * S, KART[1] * S), scale, KART[2] * S, flip=flip).save(OUT / f"kart_view_{k}.png")

    im = magenta_to_alpha(Image.open(scenery_sheet))
    boxes = drawings(im)
    assert len(boxes) == 6, f"{len(boxes)} things on the sheet, not 6"
    bushes, trees = boxes[:3], boxes[3:]
    for k, b in enumerate(bushes):
        # A hedge is squashed in the game (HEDGE_LOW); drawn this low already, it's stretched first.
        scale = 192 * S / (b[2] - b[0])
        place(im, b, (192 * S, 124 * S), scale, 124 * S, stretch=1.9).save(OUT / f"bush_{k}.png")
    scale = min(128 * S / max(b[2] - b[0] for b in trees), 172 * S / max(b[3] - b[1] for b in trees))
    for k, b in enumerate(trees):
        place(im, b, (128 * S, 172 * S), scale, 172 * S).save(OUT / f"tree_{k}.png")

    # The sky turns with you, so its ends meet: the last stretch fades into the first.
    sky = Image.open(sky_strip).convert("RGB")
    fade = sky.width // 24
    px, w, h = sky.load(), sky.width - fade, sky.height
    for x in range(fade):
        t = x / fade
        for y in range(h):
            a, b = px[w + x, y], px[x, y]
            px[x, y] = tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))
    sky.crop((0, 0, w, h)).save(OUT / "sky_0.png")
    print("cut into", OUT)


if __name__ == "__main__":
    main(*sys.argv[1:4])
