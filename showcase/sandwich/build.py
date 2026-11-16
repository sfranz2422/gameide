#!/usr/bin/env python3
"""
Builds the showcase game "Stack Shack" as a GameIDE project zip: a sandwich maker.
Pick a bread and cut it, pile on whatever you like (too far off the middle and the
pile slides off), squiggle on sauces, add a side and a drink, then eat it, one
bite at a time. Secret recipes go in a recipe book; the board is the tallest
sandwich eaten.

    python3 showcase/sandwich/build.py      # → showcase/sandwich/out/Sandwich.zip (and project.json)

The pictures are to be the teacher's Gemini art (PROMPTS.md), cut into art/ by
cut_sheets.py once they arrive. Any picture not in art/ is a stand-in drawn here,
so the game builds and plays with only this file and game/, and each Gemini
picture replaces its stand-in as soon as it's cut.

THE GAME IS OBJECTS: Title, Breads, Kitchen, Eat and Book are the screens; a Spot
is anything you tap or drag; a Faller is a layer dropping, a Tumble one falling
off. Every number is game/_1rules.py, every rule of the stack is game/_2stack.py.

Layers are cut into one frame per bite here (`bitten`): frame k has k bites gone
from the right, so a sandwich is eaten by drawing every layer at the same frame.
"""
import importlib.util
import json
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


HERE = Path(__file__).resolve().parent
_tw = _load("thornwood_build", HERE.parent / "build.py")
GAME = {}
exec((HERE / "game" / "_1rules.py").read_text(), GAME)
VIEW_W, VIEW_H = GAME["VIEW_W"], GAME["VIEW_H"]
LAYER_W, BITES = GAME["LAYER_W"], GAME["BITES"]
BREADS, LAYERS = GAME["BREADS"], GAME["LAYERS"]
SIDES, DRINKS, SIDE_BITES = GAME["SIDES"], GAME["DRINKS"], GAME["SIDE_BITES"]
ART = HERE / "art"
S = 4   # stand-ins are drawn 4 times bigger and shrunk, for smooth edges

# Sizes in the game (art/ keeps pictures at twice these, cut_sheets.py).
LOAF = (230, 150)
BOTTLE = (70, 150)
SIDE = (130, 100)
DRINK = (90, 170)
FOOD = (84, 74)             # a filling on a shelf plate, as drawn from above
INK = (70, 36, 16)


class Sandwich(_tw.Project):
    def font(self, name, path):
        self.p["fonts"].append({"id": _tw.new_id(), "name": name, "asset": self.asset(path.read_bytes(), "woff2")})

    def write(self, path):
        import zipfile
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n"
                       "Pictures made with Google Gemini (stand-ins drawn by its build). Type: Ubuntu (Ubuntu Font Licence).\n")


def have(name):
    return (ART / f"{name}.png").exists()


def fit_into(im, size):
    """A picture fitted inside `size` (its shape kept), in the middle of a clear box that size."""
    k = min(size[0] / im.width, size[1] / im.height)
    small = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(small, ((size[0] - small.width) // 2, (size[1] - small.height) // 2))
    return out


def picture(name, size, stand_in):
    if have(name):
        return fit_into(Image.open(ART / f"{name}.png").convert("RGBA"), size)
    return stand_in()


def canvas(size):
    return Image.new("RGBA", (size[0] * S, size[1] * S), (0, 0, 0, 0))


def done(im, size):
    return im.resize(size, Image.LANCZOS)


def B(*v):
    return tuple(x * S for x in v)


def darker(c, k=0.7):
    return tuple(int(v * k) for v in c[:3])


def lighter(c, k=0.35):
    return tuple(int(v + (255 - v) * k) for v in c[:3])


# ---------------------------------------------------------------- bites

def bitten(im, k, of):
    """The picture with k of `of` bites gone from the right. Each bite is round, as a mouth
    takes it, centred on the layer's face (its top part, seen from above), with the rest
    of the bitten end gone: a pile drawn at one frame shows a column of round bites."""
    if k == 0:
        return im
    w, h = im.size
    r = w * 0.2
    cut = w * (1 - k / of) + r * 0.55
    cy = h * 0.42
    mask = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(mask)
    if cut < w:
        d.rectangle((cut, 0, w, h), fill=0)
    d.ellipse((cut - r, cy - r, cut + r, cy + r), fill=0)
    # two small teeth marks either side of the big bite, so it reads as a bite, not a cut
    for ty in (cy - r * 0.95, cy + r * 0.95):
        d.ellipse((cut - r * 0.55, ty - r * 0.35, cut + r * 0.15, ty + r * 0.35), fill=0)
    out = im.copy()
    a = out.getchannel("A")
    out.putalpha(Image.composite(a, Image.new("L", (w, h), 0), mask))
    return out


def slab(top, thick, width):
    """A layer seen from a little above, from a picture drawn from above: squashed to SQUASH
    of its height, `width` across, with a side `thick` deep below it in its own colours,
    darker (a cheese slice a sliver, a patty a good edge). The picture is the face and the
    side together, so its middle is the middle of the layer's slot in the stack."""
    h = max(1, round(top.height * width / top.width * GAME["SQUASH"]))
    face = top.resize((width, h), Image.LANCZOS)
    side = Image.eval(face.convert("RGB"), lambda v: int(v * 0.78)).convert("RGBA")
    side.putalpha(face.getchannel("A"))
    out = Image.new("RGBA", (max(LAYER_W, width), h + thick), (0, 0, 0, 0))
    x = (out.width - width) // 2
    for k in range(thick, 0, -1):
        out.alpha_composite(side, (x, k))
    out.alpha_composite(face, (x, 0))
    return out


def eaten_frames(im, of):
    return [bitten(im, k, of) for k in range(of)]


# ---------------------------------------------------------------- stand-ins: layers

BREAD_COLOURS = {   # crumb, crust
    "white": ((248, 236, 206), (214, 152, 78)),
    "brown": ((196, 150, 100), (140, 90, 50)),
    "baguette": ((244, 226, 178), (214, 144, 56)),
    "sourdough": ((238, 224, 196), (176, 116, 60)),
    "brioche": ((255, 222, 140), (206, 112, 32)),
    "rye": ((116, 76, 52), (70, 42, 26)),
}


def stand_in_slice(bread, part):
    b = next(x for x in BREADS if x["key"] == bread)
    size = (LAYER_W, b["pic_h"])
    im = canvas(size)
    d = ImageDraw.Draw(im)
    crumb, crust = BREAD_COLOURS[bread]
    w, h = size
    if part == "bottom":
        d.rounded_rectangle(B(4, h * 0.22, w - 4, h - 3), radius=10 * S, fill=crust, outline=INK, width=2 * S)
        d.rounded_rectangle(B(10, h * 0.22 + 3, w - 10, h * 0.55), radius=6 * S, fill=crumb)
    else:
        d.chord(B(4, 3, w - 4, h * 1.7), 180, 360, fill=crust, outline=INK, width=2 * S)
        d.rectangle(B(6, h * 0.62, w - 6, h * 0.85), fill=crumb, outline=INK, width=S)
        d.arc(B(30, 10, w - 30, h * 1.2), 200, 340, fill=lighter(crust, 0.4), width=3 * S)
    if bread == "rye":
        rng = random.Random(7 if part == "bottom" else 8)
        for _ in range(14):
            x, y = rng.uniform(20, w - 20), rng.uniform(h * 0.35, h * 0.8)
            d.ellipse(B(x, y, x + 3, y + 2), fill=(200, 170, 120))
    return done(im, size)


SOLID = {
    "chicken": (240, 214, 170), "beef": (170, 70, 60), "ham": (242, 160, 165), "turkey": (236, 206, 170),
    "fish": (222, 160, 70), "patty": (110, 62, 36), "tofu": (246, 236, 200), "pb": (190, 120, 60),
    "jelly": (120, 40, 140), "pancake": (226, 160, 70),
}
DISCS = {   # fill, inside
    "salami": ((190, 50, 60), (230, 150, 150)), "tomato": ((222, 52, 40), (250, 120, 90)),
    "cucumber": ((70, 140, 50), (200, 236, 170)), "pickles": ((110, 150, 50), (170, 200, 90)),
    "mozzarella": ((250, 248, 240), (232, 228, 214)), "banana": ((250, 236, 170), (236, 214, 130)),
    "mushroom": ((210, 180, 140), (240, 220, 190)),
}
RINGS = {"onion": (160, 60, 150), "pepper": (60, 150, 40), "olives": (40, 36, 40), "jalapeno": (80, 160, 50)}


def stand_in_layer(key):
    L = LAYERS[key]
    size = (LAYER_W, L["pic_h"])
    w, h = size
    im = canvas(size)
    d = ImageDraw.Draw(im)
    rng = random.Random(key)
    mid = h / 2
    t = max(4, L["thick"])
    if key in SOLID:
        col = SOLID[key]
        top, bot = mid - t * 0.8, mid + t * 0.8
        d.rounded_rectangle(B(8, top, w - 8, bot), radius=min(t, 8) * S, fill=col, outline=INK, width=2 * S)
        if key in ("chicken", "beef", "ham", "turkey"):
            for x in range(20, w - 20, 34):       # folds
                d.arc(B(x, top - 3, x + 34, top + 8), 180, 360, fill=darker(col, 0.8), width=2 * S)
        if key == "patty":
            for x in range(40, w - 30, 40):
                d.line(B(x, top + 3, x + 16, bot - 3), fill=(60, 30, 16), width=3 * S)
        if key == "fish":
            for _ in range(30):
                x, y = rng.uniform(14, w - 14), rng.uniform(top + 2, bot - 2)
                d.ellipse(B(x, y, x + 2, y + 2), fill=(180, 110, 40))
        if key == "pancake":
            d.line(B(14, top + 3, w - 14, top + 3), fill=(250, 210, 140), width=2 * S)
    elif key in DISCS:
        col, inner = DISCS[key]
        n = 5 if key != "mozzarella" else 4
        dw = (w - 20) / n
        for i in range(n):
            x = 10 + i * dw + rng.uniform(-3, 3)
            d.ellipse(B(x - 4, mid - t, x + dw + 4, mid + t), fill=col, outline=INK, width=2 * S)
            d.ellipse(B(x + 4, mid - t * 0.55, x + dw - 4, mid + t * 0.4), fill=inner)
    elif key in RINGS:
        col = RINGS[key]
        for i in range(7):
            x = 16 + i * (w - 40) / 7 + rng.uniform(-4, 4)
            d.ellipse(B(x, mid - t, x + 30, mid + t * 0.9), outline=col, width=3 * S)
    elif key == "lettuce":
        for i in range(12):
            x = 2 + i * (w - 20) / 11
            d.ellipse(B(x - 4, mid - t * 1.6 + rng.uniform(-2, 2), x + 26, mid + t * 1.4), fill=(110, 196, 70), outline=(50, 120, 40), width=S)
    elif key == "bacon":
        for row in range(2):
            pts = [B(10 + x, mid - 3 + row * 6 + 4 * math.sin(x / 14)) for x in range(0, w - 20, 6)]
            d.line(pts, fill=(170, 60, 40), width=6 * S)
            d.line(pts, fill=(240, 200, 180), width=2 * S)
    elif key == "egg":
        d.ellipse(B(10, mid - t * 0.7, w - 10, mid + t * 1.1), fill=(255, 255, 252), outline=INK, width=2 * S)
        d.chord(B(w / 2 - 36, mid - t * 1.4, w / 2 + 36, mid + t * 1.2), 180, 360, fill=(255, 186, 30), outline=INK, width=2 * S)
    elif key in ("cheddar", "swiss"):
        col = (255, 176, 40) if key == "cheddar" else (250, 226, 120)
        d.polygon([B(0, mid - 3), B(w, mid - 3), B(w - 6, mid + h * 0.4), B(w - 18, mid + 3), B(18, mid + 3), B(6, mid + h * 0.4)], fill=col, outline=INK)
        if key == "swiss":
            for x in (40, 100, 160, 205):
                d.ellipse(B(x, mid - 2, x + 10, mid + 3), fill=(220, 190, 80))
    elif key == "avocado":
        for i in range(6):
            x = 12 + i * (w - 30) / 6
            d.chord(B(x, mid - t, x + 44, mid + t * 1.2), 180, 360, fill=(170, 210, 90), outline=(50, 100, 30), width=2 * S)
    elif key == "chips":
        for i in range(11):
            x = 8 + i * (w - 40) / 10 + rng.uniform(-3, 3)
            y = mid + rng.uniform(-t * 0.6, t * 0.2)
            d.ellipse(B(x, y - t * 0.7, x + 34, y + t * 0.7), fill=(250, 210, 90), outline=(190, 130, 40), width=S)
    elif key == "marshmallow":
        for i in range(7):
            x = 6 + i * (w - 12) / 7
            col = (255, 200, 220) if i % 2 else (255, 250, 250)
            d.rounded_rectangle(B(x, mid - t * 0.8, x + 30, mid + t * 0.8), radius=8 * S, fill=col, outline=INK, width=S)
    elif key == "gummy":
        for i, col in enumerate([(240, 60, 60), (250, 200, 40), (60, 180, 80), (60, 120, 230), (240, 120, 30)]):
            pts = [B(10 + x, mid + (i - 2) * 2 + 5 * math.sin(x / 11 + i)) for x in range(i * 8, w - 30 + i * 4, 5)]
            d.line(pts, fill=col, width=5 * S)
    return done(im, size)


# ---------------------------------------------------------------- stand-ins: loaves, bottles, sides, drinks, places

def stand_in_loaf(bread):
    im = canvas(LOAF)
    d = ImageDraw.Draw(im)
    crumb, crust = BREAD_COLOURS[bread]
    w, h = LOAF
    d.rounded_rectangle(B(6, h - 26, w - 6, h - 6), radius=6 * S, fill=(196, 150, 100), outline=INK, width=2 * S)
    if bread == "baguette":
        d.rounded_rectangle(B(4, h - 74, w - 4, h - 24), radius=24 * S, fill=crust, outline=INK, width=2 * S)
        for x in range(36, w - 30, 40):
            d.line(B(x, h - 64, x + 22, h - 46), fill=lighter(crust, 0.4), width=4 * S)
    elif bread in ("sourdough",):
        d.chord(B(30, h - 140, w - 30, h - 8), 180, 360, fill=crust, outline=INK, width=2 * S)
        d.rectangle(B(31, h - 76, w - 31, h - 26), fill=crust)
        d.line(B(w / 2 - 30, h - 120, w / 2 + 30, h - 90), fill=lighter(crust), width=3 * S)
        d.line(B(w / 2 + 30, h - 120, w / 2 - 30, h - 90), fill=lighter(crust), width=3 * S)
    else:
        top = h - 118 if bread != "brioche" else h - 130
        d.rounded_rectangle(B(26, top, w - 26, h - 24), radius=34 * S, fill=crust, outline=INK, width=2 * S)
        d.rounded_rectangle(B(w - 40, top + 16, w - 26, h - 30), radius=6 * S, fill=crumb)
        if bread == "brown":
            for x in range(50, w - 50, 16):
                d.ellipse(B(x, top + 6, x + 6, top + 10), fill=(230, 210, 170))
    return done(im, LOAF)


def stand_in_bottle(key):
    im = canvas(BOTTLE)
    d = ImageDraw.Draw(im)
    col = tuple(int(LAYERS[key]["ink"][i:i + 2], 16) for i in (1, 3, 5))
    w, h = BOTTLE
    d.rounded_rectangle(B(10, 44, w - 10, h - 4), radius=12 * S, fill=col, outline=INK, width=2 * S)
    d.polygon([B(18, 46), B(w - 18, 46), B(w / 2 + 6, 18), B(w / 2 - 6, 18)], fill=lighter(col, 0.2), outline=INK)
    d.rectangle(B(w / 2 - 3, 4, w / 2 + 3, 20), fill=lighter(col, 0.2), outline=INK)
    d.rounded_rectangle(B(16, 60, 24, h - 20), radius=3 * S, fill=lighter(col, 0.45))
    return done(im, BOTTLE)


def stand_in_side(key):
    im = canvas(SIDE)
    d = ImageDraw.Draw(im)
    w, h = SIDE
    if key == "soup":
        d.chord(B(8, 20, w - 8, h - 4), 0, 180, fill=(250, 248, 240), outline=INK, width=2 * S)
        d.ellipse(B(12, 44, w - 12, 64), fill=(220, 70, 40), outline=INK, width=S)
    elif key == "pickle_spear":
        d.ellipse(B(10, h - 34, w - 10, h - 6), fill=(250, 248, 240), outline=INK, width=2 * S)
        d.rounded_rectangle(B(26, h - 46, w - 26, h - 26), radius=10 * S, fill=(110, 150, 50), outline=INK, width=2 * S)
    else:
        col = (220, 50, 40) if key == "fries" else (250, 248, 240)
        for i in range(9):
            x = 22 + i * 10
            if key == "fries":
                d.rectangle(B(x, 14 + (i % 3) * 6, x + 7, 60), fill=(255, 206, 70), outline=(190, 130, 30), width=S)
            else:
                d.ellipse(B(x - 6, 24 + (i % 3) * 8, x + 18, 44 + (i % 3) * 8), fill=(250, 210, 90), outline=(190, 130, 40), width=S)
        d.polygon([B(14, 50), B(w - 14, 50), B(w - 26, h - 4), B(26, h - 4)], fill=col, outline=INK)
    return done(im, SIDE)


def stand_in_drink(key):
    im = canvas(DRINK)
    d = ImageDraw.Draw(im)
    w, h = DRINK
    col = {"lemonade": (250, 240, 150), "iced_tea": (200, 120, 40), "milk": (252, 252, 248), "juice": (255, 160, 30)}[key]
    d.polygon([B(10, 20), B(w - 10, 20), B(w - 18, h - 4), B(18, h - 4)], fill=(230, 244, 250), outline=INK)
    d.polygon([B(13, 42), B(w - 13, 42), B(w - 19, h - 8), B(19, h - 8)], fill=col)
    d.rectangle(B(18, 50, 24, h - 20), fill=(255, 255, 255))
    if key in ("lemonade", "iced_tea"):
        d.ellipse(B(w - 34, 8, w - 2, 40), fill=(180, 230, 80) if key == "lemonade" else (250, 230, 60), outline=INK, width=S)
    return done(im, DRINK)


def stand_in_kitchen():
    im = Image.new("RGBA", (VIEW_W, VIEW_H), (0, 0, 0, 255))
    d = ImageDraw.Draw(im)
    counter = 384
    for x in range(0, VIEW_W, 36):
        d.rectangle((x, 0, x + 17, counter), fill=(250, 238, 214))
        d.rectangle((x + 18, 0, x + 35, counter), fill=(242, 226, 196))
    d.rectangle((0, 300, VIEW_W, 312), fill=(150, 96, 52))
    d.rectangle((0, counter, VIEW_W, VIEW_H), fill=(176, 112, 62))
    for y in range(counter + 18, VIEW_H, 26):
        d.line((0, y, VIEW_W, y), fill=(150, 92, 48), width=2)
    d.rectangle((0, counter, VIEW_W, counter + 8), fill=(206, 140, 84))
    return im


def stand_in_book():
    im = Image.new("RGBA", (VIEW_W, VIEW_H), (176, 112, 62, 255))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((70, 40, VIEW_W - 70, VIEW_H - 70), radius=14, fill=(140, 40, 30))
    d.rectangle((88, 52, VIEW_W / 2 - 4, VIEW_H - 84), fill=(252, 244, 222))
    d.rectangle((VIEW_W / 2 + 4, 52, VIEW_W - 88, VIEW_H - 84), fill=(252, 244, 222))
    for y in range(70, VIEW_H - 90, 24):
        d.line((100, y, VIEW_W / 2 - 16, y), fill=(236, 226, 200))
        d.line((VIEW_W / 2 + 16, y, VIEW_W - 100, y), fill=(236, 226, 200))
    d.line((VIEW_W / 2, 50, VIEW_W / 2, VIEW_H - 82), fill=(200, 180, 150), width=3)
    d.rectangle((VIEW_W / 2 + 140, 40, VIEW_W / 2 + 156, VIEW_H - 30), fill=(200, 40, 50))
    return im


def icon_picture():
    im = Image.new("RGBA", (64, 64), (255, 190, 60, 255))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((8, 40, 56, 52), radius=4, fill=(214, 152, 78))
    d.rectangle((8, 34, 56, 40), fill=(220, 50, 40))
    d.rectangle((6, 28, 58, 34), fill=(110, 196, 70))
    d.rectangle((8, 24, 56, 28), fill=(255, 176, 40))
    d.chord((8, 8, 56, 40), 180, 360, fill=(214, 152, 78))
    return im


# ---------------------------------------------------------------- sounds

def make_sounds(P):
    tone, join, mix, lowpass = _tw.tone, _tw.join, _tw.mix, _tw.lowpass
    P.sound("click", tone(0.03, 900, 700, "square", 0.12))
    P.sound("nope", tone(0.16, 160, 120, "square", 0.18))
    P.sound("whoosh", lowpass(tone(0.18, 0, 0, "noise", 0.3, seed=2), 0.05, 0.3))
    P.sound("plop", join(tone(0.05, 300, 140, "sine", 0.6), tone(0.04, 140, 100, "sine", 0.3)))
    P.sound("squish", mix(tone(0.12, 220, 90, "sine", 0.5), lowpass(tone(0.12, 0, 0, "noise", 0.25, seed=4), 0.1, 0.02)))
    P.sound("squirt", lowpass(tone(0.12, 0, 0, "noise", 0.35, seed=5), 0.4, 0.08))
    P.sound("topple", join(*[mix(tone(0.07, 260 - i * 40, 200 - i * 40, "sine", 0.4), lowpass(tone(0.07, 0, 0, "noise", 0.2, seed=i), 0.2, 0.05))
                             for i in range(4)]))
    P.sound("chop", join(lowpass(tone(0.03, 0, 0, "noise", 0.6, seed=9), 0.6, 0.4), tone(0.08, 180, 90, "square", 0.25)))
    for i, k in enumerate((0.5, 0.35, 0.65)):
        bursts = [lowpass(tone(0.035, 0, 0, "noise", 0.55, seed=20 + i * 5 + j), k, k * 0.6) for j in range(3)]
        P.sound(f"crunch{i + 1}", join(*[b + [0.0] * 600 for b in bursts]))
    P.sound("slurp", lowpass(join(tone(0.1, 0, 0, "noise", 0.3, seed=30), tone(0.15, 0, 0, "noise", 0.25, seed=31)), 0.06, 0.15))
    P.sound("clink", join(tone(0.06, 2400, 2300, "sine", 0.3), tone(0.2, 3100, 3000, "sine", 0.18)))
    P.sound("page", lowpass(tone(0.15, 0, 0, "noise", 0.3, seed=40), 0.3, 0.05))
    P.sound("ding", join(tone(0.1, 1047, 1047, "sine", 0.35), tone(0.3, 1568, 1568, "sine", 0.3)))
    P.sound("fanfare", join(*[tone(0.09, f, f, "square", 0.15) for f in (523, 659, 784, 1047)], tone(0.35, 1047, 1047, "square", 0.12)))


# ---------------------------------------------------------------- the project

def event_key(name, P):
    return _tw.event_key(name, P)


def build(out):
    P = Sandwich("Stack Shack")
    # The board: the tallest sandwich eaten, in layers between the slices.
    P.p["settings"]["scoreboard"] = {"unit": "layers"}
    P.p["settings"]["pixelScaling"] = False
    P.font("Ubuntu", HERE.parent / "undertow" / "fonts" / "ubuntu-latin-700-normal.woff2")

    for b in BREADS:
        key, size = b["key"], (LAYER_W, b["pic_h"])
        for part in ("bottom", "top"):
            if have(f"slice_{key}"):
                im = slab(Image.open(ART / f"slice_{key}.png").convert("RGBA"), b["thick"], LAYER_W)
            else:
                im = stand_in_slice(key, part)
            P.sprite(f"{part}_{key}", eaten_frames(im, BITES), (im.width // 2, im.height // 2))
        P.sprite(f"loaf_{key}", [picture(f"loaf_{key}", LOAF, lambda key=key: stand_in_loaf(key))], (LOAF[0] // 2, LOAF[1] // 2))
    for key, L in LAYERS.items():
        if L["kind"] == "sauce":
            P.sprite(f"bottle_{key}", [picture(f"bottle_{key}", BOTTLE, lambda key=key: stand_in_bottle(key))], (BOTTLE[0] // 2, BOTTLE[1] // 2))
            continue
        if have(f"food_{key}"):
            food = Image.open(ART / f"food_{key}.png").convert("RGBA")
            im = slab(food, L["thick"], round(LAYER_W * GAME["FILL_W"]))
        else:
            im = food = stand_in_layer(key)
        P.sprite(f"layer_{key}", eaten_frames(im, BITES), (im.width // 2, im.height // 2))
        P.sprite(f"food_{key}", [fit_into(food, FOOD)], (FOOD[0] // 2, FOOD[1] // 2))   # on the shelf's plates
    for key in SIDES:
        im = picture(f"side_{key}", SIDE, lambda key=key: stand_in_side(key))
        P.sprite(f"side_{key}", eaten_frames(im, SIDE_BITES), (SIDE[0] // 2, SIDE[1] // 2))
    for key in DRINKS:
        P.sprite(f"drink_{key}", [picture(f"drink_{key}", DRINK, lambda key=key: stand_in_drink(key))], (DRINK[0] // 2, DRINK[1] // 2))
    P.sprite("kitchen", [picture("kitchen", (VIEW_W, VIEW_H), stand_in_kitchen)], (0, 0))
    P.sprite("book", [picture("book", (VIEW_W, VIEW_H), stand_in_book)], (0, 0))
    P.sprite("icon", [icon_picture()], (0, 0))
    make_sounds(P)

    for f in sorted((HERE / "game").glob("_*.py")):
        head, _ = _tw.read_code(f)
        P.script(head.get("script", f.stem.strip("_")), f.read_text())
    files = sorted(f for f in (HERE / "game").glob("*.py") if not f.name.startswith("_"))
    parsed = {f.stem: _tw.read_code(f) for f in files}
    for name, (head, _) in parsed.items():
        P.obj(name, depth=int(head.get("depth", 0)), visible=head.get("visible", "yes") == "yes")
    for name, (head, events) in parsed.items():
        o = next(x for x in P.p["objects"] if x["name"] == name)
        if head.get("sprite"):
            o["sprite"] = P.sprite_id(head["sprite"])
        if head.get("parent"):
            o["parent"] = P.obj_id(head["parent"])
        for ev, code in events:
            o["events"].append({"id": _tw.new_id(), "key": event_key(ev, P), "mode": "python", "code": code})

    def room(name, placed, colour="#ffb42a"):
        lid = _tw.new_id()
        P.p["rooms"].append({
            "id": _tw.new_id(), "name": name, "width": VIEW_W, "height": VIEW_H, "background": colour,
            "gridWidth": 16, "gridHeight": 16, "snap": False,
            "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
            "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 0},
            "instances": [{"id": _tw.new_id(), "object": P.obj_id(o), "layer": lid, "x": x, "y": y,
                           "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""} for o, x, y in placed],
        })

    # The title first: the game starts in the first room.
    room("Title", [("Title", 0, 0)])
    room("Breads", [("Breads", 0, 0)])
    room("Kitchen", [("Kitchen", 0, 0)])
    room("Eat", [("Eat", 0, 0)])
    room("Book", [("Book", 0, 0)])

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    pictures = sum(1 for _ in ART.glob("*.png")) if ART.exists() else 0
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(P.p['objects'])} objects, {pictures} of the teacher's pictures")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Sandwich.zip")
