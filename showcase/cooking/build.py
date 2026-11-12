#!/usr/bin/env python3
"""
Builds the showcase game "Order Up!" as a GameIDE project zip: a cooking rush in
two little restaurants, a burger shack and a noodle bar. Customers order at the
counter; cook it, build it, serve it before their patience runs out.

    python3 showcase/cooking/build.py      # → showcase/cooking/out/Cooking.zip (and project.json)

The pictures are the teacher's Gemini art (PROMPTS.md), cut by cut_sheets.py into
art/ (once they've arrived). Any picture not in art/ is a stand-in drawn here, one
by one, so the game builds and plays with only this file and game/, and each
Gemini picture replaces its stand-in as soon as it's cut.

THE GAME IS OBJECTS: Title, Map, Shop, Kitchen and Summary are the screens; in the
kitchen, every tappable thing is a Spot (Cooker, Source, Plate, Shelf, Bin,
Customer). Every number is game/_1rules.py, every rule of the kitchen is
game/_2kitchen.py, and what each tap and button does is game/_5acts.py.
"""
import importlib.util
import json
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
RESTAURANTS, CUSTOMERS = GAME["RESTAURANTS"], GAME["CUSTOMERS"]
CUSTOMER_FRAMES, COOK_POSES = GAME["CUSTOMER_FRAMES"], GAME["COOK_POSES"]
ART = HERE / "art"
S = 4   # stand-ins are drawn 4 times bigger and shrunk, for smooth edges

# Sizes in the game (art/ keeps pictures at twice these, cut_sheets.py).
FOOD = (72, 72)
MACHINE = (84, 76)
PLATE = (120, 64)
PERSON = (150, 160)
COOK = (130, 150)
ICON = (40, 40)
BUBBLE = (180, 100)

# Every picture by name, as cut_sheets.py names them, and its size.
FOODS = ["patty_raw", "patty_cooking", "patty_cooked", "patty_burnt", "bun_bottom", "bun_top", "cheese", "lettuce",
         "tomato", "egg_fried", "fries_raw", "fries", "fries_burnt", "cola", "orange", "shake",
         "noodles_dry", "noodles_boiling", "noodles_bowl", "noodles_soggy", "egg", "onion", "pork", "tofu", "seaweed",
         "chilli", "dumplings_raw", "dumplings", "dumplings_burnt", "tea", "iced_tea", "rice", "bowl", "broth_pot"]
MACHINES = ["grill", "grill_hot", "fryer", "fountain", "pot", "steamer", "steamer_open", "teapot", "bin"]
ICONS = ["heart", "heart_half", "coin", "star", "star_empty", "bell", "clock", "flame", "up_grill", "up_fryer",
         "plant", "jukebox", "tipjar"]


class Cooking(_tw.Project):
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


def art(name, size):
    """One of the teacher's pictures (art/ keeps them at twice the game's size), fitted to `size`."""
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    return im.resize(size, Image.LANCZOS)


def picture(name, size, stand_in):
    return art(name, size) if have(name) else stand_in()


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def canvas(size):
    return Image.new("RGBA", (size[0] * S, size[1] * S), (0, 0, 0, 0))


def done(im, size):
    return im.resize(size, Image.LANCZOS)


INK = (50, 30, 20)


def B(*v):
    return tuple(x * S for x in v)


# ---------------------------------------------------------------- stand-ins: food

def stand_in_food(name):
    im = canvas(FOOD)
    d = ImageDraw.Draw(im)
    w = 2 * S

    def disc(col, h=12, y=36):
        d.rounded_rectangle(B(10, y - h / 2, 62, y + h / 2), radius=6 * S, fill=col, outline=INK, width=w)

    def cup(col):
        d.polygon([B(22, 18), B(50, 18), B(46, 60), B(26, 60)], fill=(250, 250, 250), outline=INK)
        d.polygon([B(24, 26), B(48, 26), B(46, 56), B(26, 56)], fill=col)
        d.line([B(40, 8), B(36, 22)], fill=(220, 60, 60), width=3 * S)

    def bowl(fill=None):
        d.chord(B(10, 14, 62, 62), 0, 180, fill=(245, 245, 240), outline=INK, width=w)
        if fill:
            d.ellipse(B(14, 30, 58, 42), fill=fill)

    colours = {
        "patty_raw": (230, 120, 130), "patty_cooking": (180, 100, 80), "patty_cooked": (120, 70, 40), "patty_burnt": (40, 30, 30),
        "cheese": (255, 200, 40), "lettuce": (90, 190, 70), "tomato": (220, 50, 40), "pork": (230, 150, 140),
        "tofu": (245, 240, 220), "seaweed": (30, 60, 40), "egg": (255, 250, 240),
    }
    if name.startswith("patty"):
        disc(colours[name], 14)
        if name == "patty_burnt":
            d.ellipse(B(20, 10, 34, 22), fill=(120, 120, 120))
    elif name == "bun_bottom":
        d.rounded_rectangle(B(8, 30, 64, 46), radius=6 * S, fill=(220, 160, 80), outline=INK, width=w)
    elif name == "bun_top":
        d.chord(B(8, 14, 64, 58), 180, 360, fill=(225, 165, 80), outline=INK, width=w)
        for x in (24, 34, 46):
            d.ellipse(B(x, 22, x + 4, 25), fill=(255, 245, 210))
    elif name == "cheese":
        d.polygon([B(8, 32), B(64, 32), B(58, 40), B(14, 40)], fill=colours[name], outline=INK)
    elif name == "lettuce":
        for x in range(10, 60, 10):
            d.ellipse(B(x, 30, x + 14, 40), fill=colours[name], outline=(40, 120, 40))
    elif name == "tomato":
        for x in (12, 28, 44):
            d.ellipse(B(x, 30, x + 16, 40), fill=colours[name], outline=INK)
    elif name == "egg_fried":
        d.ellipse(B(10, 26, 62, 46), fill=(255, 255, 255), outline=INK, width=w)
        d.ellipse(B(28, 30, 44, 42), fill=(255, 190, 30))
    elif name.startswith("fries"):
        col = {"fries_raw": (240, 230, 180), "fries": (255, 200, 60), "fries_burnt": (70, 50, 30)}[name]
        for x in range(22, 52, 6):
            d.rectangle(B(x, 14, x + 4, 40), fill=col, outline=INK)
        d.polygon([B(18, 32), B(54, 32), B(48, 62), B(24, 62)], fill=(220, 50, 40), outline=INK)
    elif name in ("cola", "orange", "tea", "iced_tea", "shake"):
        cup({"cola": (90, 40, 20), "orange": (255, 140, 30), "tea": (150, 190, 90), "iced_tea": (230, 180, 70), "shake": (250, 200, 220)}[name])
    elif name == "noodles_dry":
        for k in range(6):
            d.arc(B(14 + k * 3, 18 + k * 2, 58 - k * 3, 54 - k * 2), 0, 360, fill=(240, 210, 120), width=2 * S)
    elif name in ("noodles_boiling", "noodles_soggy"):
        d.rounded_rectangle(B(10, 24, 62, 62), radius=6 * S, fill=(150, 160, 170), outline=INK, width=w)
        for k in range(4):
            d.arc(B(16 + k * 4, 18, 56 - k * 4, 40), 0, 180, fill=(240, 220, 140) if name == "noodles_boiling" else (200, 200, 170), width=2 * S)
    elif name == "noodles_bowl":
        bowl((200, 140, 70))
        for k in range(4):
            d.arc(B(18 + k * 5, 24, 54 - k * 5, 40), 180, 360, fill=(250, 220, 130), width=2 * S)
    elif name == "bowl":
        bowl()
    elif name == "broth_pot":
        d.rounded_rectangle(B(12, 26, 60, 62), radius=4 * S, fill=(150, 150, 160), outline=INK, width=w)
        d.ellipse(B(14, 22, 58, 34), fill=(190, 120, 60), outline=INK)
        d.line([B(46, 30), B(58, 6)], fill=INK, width=3 * S)
    elif name == "egg":
        d.ellipse(B(16, 18, 56, 56), fill=(255, 255, 250), outline=INK, width=w)
        d.ellipse(B(26, 28, 46, 46), fill=(255, 170, 30))
    elif name == "onion":
        for x in (16, 30, 44, 24, 38):
            d.ellipse(B(x, 28 + (x % 3) * 4, x + 12, 40 + (x % 3) * 4), outline=(80, 180, 70), width=3 * S)
    elif name in ("pork", "tofu", "seaweed"):
        for k in range(2):
            d.rectangle(B(14 + k * 22, 22 + k * 6, 34 + k * 22, 50 + k * 6), fill=colours[name], outline=INK, width=w)
    elif name == "chilli":
        for x in (20, 34, 48):
            d.ellipse(B(x - 5, 26, x + 5, 42), fill=(220, 40, 30), outline=INK)
    elif name.startswith("dumplings"):
        col = {"dumplings_raw": (250, 245, 235), "dumplings": (245, 225, 190), "dumplings_burnt": (60, 45, 35)}[name]
        for x in (12, 28, 44):
            d.chord(B(x, 20, x + 18, 54), 180, 360, fill=col, outline=INK, width=w)
            d.rectangle(B(x, 36, x + 18, 44), fill=col)
    elif name == "rice":
        bowl((250, 250, 250))
    return done(im, FOOD)


# ---------------------------------------------------------------- stand-ins: machines, people, icons, places

def stand_in_machine(name):
    im = canvas(MACHINE)
    d = ImageDraw.Draw(im)
    w = 2 * S
    if name.startswith("grill"):
        d.rectangle(B(4, 30, 80, 70), fill=(70, 70, 76), outline=INK, width=w)
        d.rectangle(B(8, 24, 76, 34), fill=(200, 80, 40) if name == "grill_hot" else (120, 120, 130), outline=INK, width=w)
    elif name == "fryer":
        d.rectangle(B(8, 22, 76, 72), fill=(190, 190, 200), outline=INK, width=w)
        d.rectangle(B(14, 26, 70, 40), fill=(230, 180, 60))
    elif name == "fountain":
        d.rectangle(B(10, 4, 74, 72), fill=(200, 40, 40), outline=INK, width=w)
        d.rectangle(B(30, 20, 54, 30), fill=(220, 220, 230))
    elif name == "pot":
        d.rectangle(B(10, 46, 74, 72), fill=(60, 60, 60), outline=INK, width=w)
        d.rounded_rectangle(B(14, 22, 70, 52), radius=4 * S, fill=(160, 165, 175), outline=INK, width=w)
    elif name.startswith("steamer"):
        d.ellipse(B(10, 30, 74, 72), fill=(200, 160, 100), outline=INK, width=w)
        d.ellipse(B(10, 24, 74, 50), fill=(220, 180, 120), outline=INK, width=w)
    elif name == "teapot":
        d.rectangle(B(12, 6, 72, 72), fill=(70, 110, 90), outline=INK, width=w)
        d.rectangle(B(30, 20, 54, 30), fill=(220, 220, 230))
    elif name == "bin":
        d.rectangle(B(16, 16, 68, 72), fill=(120, 130, 140), outline=INK, width=w)
        d.rectangle(B(12, 10, 72, 18), fill=(100, 110, 120), outline=INK, width=w)
    return done(im, MACHINE)


def stand_in_plate():
    im = canvas(PLATE)
    d = ImageDraw.Draw(im)
    d.ellipse(B(4, 8, 112, 36), fill=(250, 250, 250), outline=INK, width=2 * S)
    d.ellipse(B(20, 14, 96, 30), outline=(200, 200, 210), width=S)
    return done(im, PLATE)


SHIRTS = [(240, 170, 40), (230, 90, 160), (120, 140, 200), (60, 60, 90), (90, 180, 90), (200, 60, 50), (130, 60, 140), (40, 130, 120)]


def face(d, cx, cy, mood):
    for ex in (-9, 9):
        d.ellipse(B(cx + ex - 3, cy - 6, cx + ex + 3, cy), fill=INK)
    if mood in ("happy", "eating", "cheer", "carry", "ready", "flip"):
        d.arc(B(cx - 10, cy - 2, cx + 10, cy + 12), 20, 160, fill=INK, width=2 * S)
    elif mood in ("angry", "worried"):
        d.arc(B(cx - 10, cy + 6, cx + 10, cy + 18), 200, 340, fill=INK, width=2 * S)
        if mood == "angry":
            d.line([B(cx - 14, cy - 12), B(cx - 4, cy - 8)], fill=INK, width=2 * S)
            d.line([B(cx + 14, cy - 12), B(cx + 4, cy - 8)], fill=INK, width=2 * S)
    else:
        d.line([B(cx - 8, cy + 8), B(cx + 8, cy + 8)], fill=INK, width=2 * S)


def stand_in_person(kind, frame):
    mood = CUSTOMER_FRAMES[frame]
    im = canvas(PERSON)
    d = ImageDraw.Draw(im)
    shirt = SHIRTS[kind % len(SHIRTS)]
    d.rounded_rectangle(B(30, 96, 120, 162), radius=18 * S, fill=shirt, outline=INK, width=2 * S)
    d.ellipse(B(45, 30, 105, 96), fill=(240, 200, 160), outline=INK, width=2 * S)
    d.chord(B(43, 26, 107, 70), 180, 360, fill=(90 + kind * 15, 60, 30))
    face(d, 75, 66, mood)
    if mood == "impatient":
        d.ellipse(B(108, 40, 128, 60), outline=INK, width=2 * S)
    if mood == "eating":
        d.ellipse(B(60, 86, 90, 102), fill=(220, 160, 80), outline=INK)
    return done(im, PERSON)


def stand_in_cook(k, pose):
    im = canvas(COOK)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle(B(20, 92, 110, 152), radius=16 * S, fill=(250, 250, 250), outline=INK, width=2 * S)
    d.ellipse(B(35, 30, 95, 92), fill=(235, 190, 150), outline=INK, width=2 * S)
    hat = (210, 40, 40) if k == 0 else (30, 40, 90)
    d.rectangle(B(35, 22, 95, 44), fill=hat, outline=INK, width=2 * S)
    face(d, 65, 64, pose)
    if pose == "cheer":
        d.line([B(24, 100), B(8, 60)], fill=(235, 190, 150), width=8 * S)
        d.line([B(106, 100), B(122, 60)], fill=(235, 190, 150), width=8 * S)
    return done(im, COOK)


def stand_in_icon(name):
    im = canvas(ICON)
    d = ImageDraw.Draw(im)
    if name.startswith("heart"):
        col = (235, 60, 90)
        d.ellipse(B(4, 6, 21, 23), fill=col)
        d.ellipse(B(19, 6, 36, 23), fill=col)
        d.polygon([B(5, 18), B(35, 18), B(20, 36)], fill=col)
        if name == "heart_half":
            d.rectangle(B(20, 0, 40, 40), fill=(0, 0, 0, 0))
    elif name in ("star", "star_empty"):
        import math
        pts = []
        for i in range(10):
            r = 18 if i % 2 == 0 else 8
            a = -math.pi / 2 + i * math.pi / 5
            pts.append(B(20 + r * math.cos(a), 21 + r * math.sin(a)))
        d.polygon(pts, fill=(255, 205, 40) if name == "star" else (110, 100, 90), outline=INK)
    elif name == "coin":
        d.ellipse(B(4, 4, 36, 36), fill=(255, 200, 40), outline=INK, width=2 * S)
    else:
        d.rounded_rectangle(B(4, 4, 36, 36), radius=6 * S, fill=(200, 180, 140), outline=INK, width=2 * S)
    return done(im, ICON)


def stand_in_bubble():
    im = canvas(BUBBLE)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle(B(4, 4, 176, 84), radius=20 * S, fill=(255, 255, 255), outline=INK, width=2 * S)
    d.polygon([B(80, 82), B(100, 82), B(88, 98)], fill=(255, 255, 255), outline=INK)
    d.line([B(81, 83), B(99, 83)], fill=(255, 255, 255), width=3 * S)
    return done(im, BUBBLE)


def stand_in_place(key):
    im = Image.new("RGBA", (VIEW_W, VIEW_H), (0, 0, 0, 255))
    d = ImageDraw.Draw(im)
    top = GAME["COUNTER_Y"]
    if key == "burger":
        for y in range(0, top, 32):
            for x in range(0, VIEW_W, 32):
                d.rectangle((x, y, x + 31, y + 31), fill=(220, 60, 50) if (x // 32 + y // 32) % 2 else (245, 240, 230))
        d.rectangle((300, 50, 724, 200), fill=(150, 210, 250), outline=(80, 60, 50), width=6)
        d.rectangle((0, top, VIEW_W, VIEW_H), fill=(180, 186, 196))
        d.rectangle((0, top, VIEW_W, top + 10), fill=(140, 146, 156))
    else:
        d.rectangle((0, 0, VIEW_W, top), fill=(120, 70, 40))
        for x in range(0, VIEW_W, 64):
            d.line((x, 0, x, top), fill=(100, 56, 30), width=3)
        d.rectangle((300, 50, 724, 200), fill=(40, 50, 90), outline=(60, 30, 20), width=6)
        for x in (150, 870):
            d.ellipse((x - 30, 40, x + 30, 110), fill=(230, 70, 50))
        d.rectangle((0, top, VIEW_W, VIEW_H), fill=(170, 120, 80))
        d.rectangle((0, top, VIEW_W, top + 10), fill=(130, 90, 60))
    return im


def stand_in_title():
    im = stand_in_place("burger")
    over = Image.new("RGBA", im.size, (255, 180, 60, 90))
    im = Image.alpha_composite(im, over)
    im.alpha_composite(stand_in_cook(0, "flip").resize((COOK[0] * 2, COOK[1] * 2)), (VIEW_W // 2 - COOK[0], 470 - COOK[1] * 2))
    for i, n in enumerate(("bun_top", "fries", "noodles_bowl", "cola")):
        im.alpha_composite(stand_in_food(n).resize((144, 144)), (120 + i * 220 if i < 2 else 360 + i * 160, 330))
    return im


def icon_picture():
    im = Image.new("RGBA", (64, 64), (210, 60, 40, 255))
    d = ImageDraw.Draw(im)
    d.chord((8, 10, 56, 50), 180, 360, fill=(240, 170, 80))
    d.rectangle((10, 32, 54, 40), fill=(120, 70, 40))
    d.rectangle((10, 42, 54, 52), fill=(230, 160, 80))
    return im


# ---------------------------------------------------------------- sounds

def make_sounds(P):
    tone, join = _tw.tone, _tw.join
    P.sound("click", tone(0.03, 900, 700, "square", 0.12))
    P.sound("tick", tone(0.025, 1200, 1100, "tri", 0.18))
    P.sound("nope", tone(0.16, 160, 120, "square", 0.18))
    P.sound("pop", join(tone(0.03, 500, 900, "tri", 0.3), tone(0.03, 900, 700, "tri", 0.2)))
    P.sound("sizzle", tone(0.25, 3000, 2600, "noise", 0.12))
    P.sound("pour", tone(0.25, 500, 300, "noise", 0.08))
    P.sound("bin", join(tone(0.06, 200, 150, "noise", 0.2), tone(0.08, 120, 90, "square", 0.15)))
    P.sound("coin", join(tone(0.05, 1568, 1568, "square", 0.18), tone(0.18, 2093, 2093, "square", 0.15)))
    P.sound("angry", join(tone(0.12, 300, 220, "square", 0.18), tone(0.18, 220, 160, "square", 0.18)))
    P.sound("bell", join(*[tone(0.12, f, f, "tri", 0.3) for f in (784, 659, 523)], tone(0.4, 392, 392, "tri", 0.25)))
    P.sound("cheer", join(*[tone(0.09, f, f, "square", 0.15) for f in (523, 659, 784, 1047)], tone(0.3, 1047, 1047, "square", 0.12)))


# ---------------------------------------------------------------- the project

def event_key(name, P):
    parts = name.split()
    if parts[0] == "mouse":
        return {"type": "mouse", "button": parts[-1], "edge": parts[-2], "global": parts[1] == "global"}
    return _tw.event_key(name, P)


def build(out):
    P = Cooking("Order Up!")
    # The board: every star earned, all days of both restaurants.
    P.p["settings"]["scoreboard"] = {"unit": "stars"}
    P.p["settings"]["pixelScaling"] = False
    P.font("Ubuntu", HERE.parent / "undertow" / "fonts" / "ubuntu-latin-700-normal.woff2")

    for n in FOODS:
        P.sprite(n, [picture(n, FOOD, lambda n=n: stand_in_food(n))], (FOOD[0] // 2, FOOD[1] // 2))
    for n in MACHINES:
        P.sprite(n, [picture(n, MACHINE, lambda n=n: stand_in_machine(n))], (MACHINE[0] // 2, MACHINE[1] // 2))
    P.sprite("plate", [picture("plate", PLATE, stand_in_plate)], (PLATE[0] // 2, PLATE[1] // 2))
    for kind in range(len(CUSTOMERS)):
        frames = [picture(f"cust_{kind}_{f}", PERSON, lambda f=f, kind=kind: stand_in_person(kind, CUSTOMER_FRAMES.index(f)))
                  for f in CUSTOMER_FRAMES]
        P.sprite(f"cust_{kind}", frames, (PERSON[0] // 2, PERSON[1]))
    for k in range(2):
        frames = [picture(f"cook_{k}_{p}", COOK, lambda p=p, k=k: stand_in_cook(k, p)) for p in COOK_POSES]
        P.sprite(f"cook_{k}", frames, (COOK[0] // 2, COOK[1]))
    for n in ICONS:
        P.sprite(n, [picture(n, ICON, lambda n=n: stand_in_icon(n))], (ICON[0] // 2, ICON[1] // 2))
    P.sprite("bubble", [picture("bubble", BUBBLE, stand_in_bubble)], (BUBBLE[0] // 2, BUBBLE[1] // 2))
    for rs in RESTAURANTS:
        key = rs["key"]
        P.sprite(f"place_{key}", [picture(f"place_{key}", (VIEW_W, VIEW_H), lambda key=key: stand_in_place(key))], (0, 0))
    P.sprite("title", [picture("title", (VIEW_W, VIEW_H), stand_in_title)], (0, 0))
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

    def room(name, placed, colour="#2a1a10"):
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
    room("Map", [("Map", 0, 0)])
    room("Shop", [("Shop", 0, 0)])
    room("Kitchen", [("Kitchen", 0, 0)])
    room("Summary", [("Summary", 0, 0)])

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    pictures = sum(1 for _ in ART.glob("*.png")) if ART.exists() else 0
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(P.p['objects'])} objects, {pictures} of the teacher's pictures")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Cooking.zip")
