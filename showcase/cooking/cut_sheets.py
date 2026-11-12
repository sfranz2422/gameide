#!/usr/bin/env python3
"""
Cuts the teacher's 11 Gemini pictures (PROMPTS.md, in order, copied into raw/ as
01.jpeg … 11.jpeg) into the named pictures in art/, which build.py reads. Both raw/
and art/ are committed, so the art can't be lost the way older games' was.

    python3 showcase/cooking/cut_sheets.py

Pictures here are kept at twice the game's size; build.py shrinks them. The magenta
behind the drawings came back a dull pink, a little different on each sheet, so the
key is read from each sheet's own corner (key_out, as Snowcap's and Squeeze's cuts do).
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
_build = _load("cooking_build", HERE / "build.py")
cut, place, fit = _rpg.cut, _rpg.place, _rpg.fit
key_out = _climb.key_out


# Which drawing in a customer's row to use for each face (calm, happy, impatient, angry,
# eating), where Gemini drew someone else: the kid's impatient and angry faces are a man
# in a dark jacket, so the kid keeps their calm face for both; the rider's, critic's and
# hiker's calm faces wear other clothes (no neon jacket, a chef's coat, a brown coat), so
# their happy face, in the clothes of the rest of the row, stands in for calm.
SAME_PERSON = {4: [0, 1, 0, 0, 4], 5: [1, 1, 2, 3, 4], 6: [1, 1, 2, 3, 4], 7: [1, 1, 2, 3, 4]}


def raw(n):
    return Image.open(RAW / f"{n:02d}.jpeg").convert("RGB")


def save(pic, name):
    pic.save(ART / f"{name}.png", optimize=True)


def sheet(n, shape, loose=True):
    im = key_out(raw(n))
    boxes = cut(im, shape, loose)
    assert len(boxes) == sum(shape), f"{n}: {len(boxes)} drawings"
    return im, boxes


def size2(game_size):
    return (game_size[0] * S, game_size[1] * S)


def centred(im, box, size, scale):
    part = im.crop(box)
    part = part.resize((max(1, round(part.width * scale)), max(1, round(part.height * scale))), Image.LANCZOS)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(part, ((size[0] - part.width) // 2, (size[1] - part.height) // 2))
    return out


def standing(im, boxes, names, game_size):
    """Drawings that belong together (one person's faces, one cook's poses) at one scale, standing on the bottom."""
    size = size2(game_size)
    k = fit(boxes, size)
    for b, name in zip(boxes, names):
        if name:
            save(place(im, b, size, k), name)


def middled(im, boxes, names, game_size, margin=1.0):
    """
    Drawings at one scale, each in the middle of its canvas: the parts of a burger
    must be the same width as each other to stack (draw_dish stacks them by their
    middles), and a cooker's stages (raw, cooked, burnt) must stay one size.
    """
    size = size2(game_size)
    k = fit(boxes, size) * margin
    for b, name in zip(boxes, names):
        if name:
            save(centred(im, b, size, k), name)


def apart(im, boxes, names, game_size, margin=1.0):
    """Each drawing as big as its canvas allows (icons, a drink, a machine)."""
    size = size2(game_size)
    for b, name in zip(boxes, names):
        if name:
            save(centred(im, b, size, fit([b], size) * margin), name)


def wide(n, name):
    """A whole picture (a restaurant, the title) at the screen's own size: only ever shown full screen."""
    raw(n).resize((_build.VIEW_W, _build.VIEW_H), Image.LANCZOS).save(ART / f"{name}.png", optimize=True)


def main():
    ART.mkdir(exist_ok=True)
    food, machine = _build.FOOD, _build.MACHINE
    # 1, 2, 11: the two restaurants and the title.
    wide(1, "place_burger")
    wide(2, "place_noodle")
    wide(11, "title")
    # 3: the burger shack's machines (the plate stack and the cutting board aren't used).
    im, b = sheet(3, [4, 4])
    apart(im, b[:4], ["grill", "grill_hot", "fryer", "fountain"], machine)
    apart(im, [b[5]], ["plate"], _build.PLATE)
    apart(im, [b[6]], ["bin"], machine, 0.9)
    # 4: burger food. The patties, buns and fillings at one scale (they stack); the
    # fries and drinks at another, so a cup is as tall as a cone.
    im, b = sheet(4, [4, 6, 6])
    middled(im, b[:10], ["patty_raw", "patty_cooking", "patty_cooked", "patty_burnt",
                         "bun_bottom", "bun_top", "cheese", "lettuce", "tomato", "egg_fried"], food)
    middled(im, b[10:], ["fries_raw", "fries", "fries_burnt", "cola", "orange", "shake"], food, 0.95)
    # 5: the noodle bar's machines; its bowl and broth pot are food-sized, as they sit on a plate's spot.
    im, b = sheet(5, [4, 4])
    apart(im, b[:4], ["pot", "steamer", "steamer_open", "teapot"], machine)
    apart(im, [b[4]], ["bowl"], food, 0.92)
    apart(im, [b[6]], ["broth_pot"], food, 0.92)
    # 6: noodle food: the noodles' stages together, the toppings together, dumplings and drinks together.
    im, b = sheet(6, [4, 6, 6])
    middled(im, b[:4], ["noodles_dry", "noodles_boiling", "noodles_bowl", "noodles_soggy"], food, 0.95)
    apart(im, b[4:10], ["egg", "onion", "pork", "tofu", "seaweed", "chilli"], food, 0.85)
    middled(im, b[10:13], ["dumplings_raw", "dumplings", "dumplings_burnt"], food, 0.95)
    middled(im, b[13:], ["tea", "iced_tea", "rice"], food, 0.95)
    # 7, 8: eight customers, five faces each (calm, happy, impatient, angry, eating).
    for n, first in ((7, 0), (8, 4)):
        im, b = sheet(n, [5, 5, 5, 5])
        for row in range(4):
            kind = first + row
            cols = SAME_PERSON.get(kind, [0, 1, 2, 3, 4])
            boxes = [b[row * 5 + c] for c in cols]
            standing(im, boxes, [f"cust_{kind}_{f}" for f in _build.CUSTOMER_FRAMES], _build.PERSON)
    # 9: the two cooks, two rows of five each (ready, cooking, carrying a plate, cheering
    # or wiping their brow, worried). Rows 1-2 the burger cook, 3-4 the noodle cook.
    im, b = sheet(9, [5, 5, 5, 5])
    for cook, top in ((0, 0), (1, 10)):
        r1, r2 = b[top:top + 5], b[top + 5:top + 10]
        # COOK_POSES: ready, flip, carry, cheer, wipe, worried
        standing(im, [r1[0], r1[1], r1[2], r1[3], r2[3], r1[4]], [f"cook_{cook}_{p}" for p in _build.COOK_POSES], _build.COOK)
    # 10: icons; the first is the order bubble.
    im, b = sheet(10, [7, 7])
    # The bubble stretched to the order's shape: wider than Gemini drew it, to hold a dish and two extras.
    save(im.crop(b[0]).resize(size2(_build.BUBBLE), Image.LANCZOS), "bubble")
    apart(im, b[1:], ["heart", "heart_half", "coin", "star", "star_empty", "bell",
                      "clock", "flame", "up_grill", "up_fryer", "plant", "jukebox", "tipjar"], _build.ICON)
    print(f"{len(list(ART.glob('*.png')))} pictures in {ART}")


if __name__ == "__main__":
    main()
