#!/usr/bin/env python3
"""
Builds the showcase game "Squeeze" as a GameIDE project zip: a summer running a
lemonade stand. Buy supplies, set the recipe and the price, pick a spot, and watch
the day: who stops, who buys, and what they think.

    python3 showcase/lemon/build.py      # → showcase/lemon/out/Lemon.zip (and project.json)

The pictures are the teacher's Gemini art (PROMPTS.md), cut by cut_sheets.py into
art/ (once they've arrived). Any picture not in art/ is a stand-in drawn here, one
by one, so the game builds and plays with only this file and game/, and each
Gemini picture replaces its stand-in as soon as it's cut.

THE GAME IS OBJECTS: Title, Morning, Day (the street), Evening are the four
screens; Button and Stepper are the controls; Stand, Customer, Bubble and Cloud
are on the street. Every number is game/_1rules.py, the business is
game/_2summer.py, and what each control does is game/_5acts.py.
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
PLACES, CUSTOMERS = GAME["PLACES"], GAME["CUSTOMERS"]
ART = HERE / "art"
S = 4   # stand-ins are drawn 4 times bigger and shrunk, for smooth edges

# Sizes in the game. art/ keeps pictures at twice these (cut_sheets.py).
STAND = (240, 220)
OWNER = (130, 110)
PERSON = (120, 130)    # wide enough for a stroller or a dog alongside
ICON = (64, 64)
BUBBLE = (76, 76)
ICON_NAMES = ["lemon", "sugar", "ice", "cups", "pitcher", "pitcher_pink", "coin", "cooler", "juicer", "sign", "second", "strawberry", "soft_lemon"]
PERSON_FRAMES = ["walk1", "walk2", "stand", "drink", "happy"]


class Lemon(_tw.Project):
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
    """The teacher's picture if it's been cut, else the stand-in."""
    return art(name, size) if have(name) else stand_in()


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def canvas(size):
    return Image.new("RGBA", (size[0] * S, size[1] * S), (0, 0, 0, 0))


def done(im, size):
    return im.resize(size, Image.LANCZOS)


# ---------------------------------------------------------------- stand-ins

def stand_in_stand(k):
    w, h = STAND
    im = canvas(STAND)
    d = ImageDraw.Draw(im)
    wood, dark = (rgb("#e8a0b8") if k == 3 else (176, 116, 62)), (90, 54, 24)
    # posts, counter, front
    for x in (24, w - 34):
        d.rectangle((x * S, 70 * S, (x + 10) * S, (h - 4) * S), fill=dark)
    d.rectangle((14 * S, 118 * S, (w - 14) * S, (h - 4) * S), fill=wood, outline=dark, width=2 * S)
    d.rectangle((8 * S, 112 * S, (w - 8) * S, 126 * S), fill=(214, 160, 96), outline=dark, width=2 * S)
    for i in range(5):
        d.line([((30 + i * 40) * S, 130 * S), ((30 + i * 40) * S, (h - 8) * S)], fill=dark, width=S)
    # striped awning
    top, bot = 36, 70
    stripe = ((255, 214, 64), (255, 255, 255)) if k != 3 else ((255, 130, 170), (255, 255, 255))
    n = 8
    for i in range(n):
        x0 = 4 + i * (w - 8) / n
        d.polygon([(x0 * S, top * S), ((x0 + (w - 8) / n) * S, top * S), ((x0 + (w - 8) / n) * S, bot * S), (x0 * S, bot * S)], fill=stripe[i % 2])
        d.pieslice(((x0) * S, (bot - 10) * S, (x0 + (w - 8) / n) * S, (bot + 10) * S), 0, 180, fill=stripe[i % 2])
    d.rectangle((4 * S, top * S, (w - 4) * S, bot * S), outline=dark, width=2 * S)
    # pitcher on the counter
    lemonade = (255, 150, 190) if k == 3 else (255, 230, 90)
    d.rectangle(((w - 70) * S, 86 * S, (w - 46) * S, 112 * S), fill=lemonade, outline=dark, width=S)
    if k >= 1:   # the sign
        d.rectangle(((w / 2 - 60) * S, 0, (w / 2 + 60) * S, 32 * S), fill=(250, 240, 210), outline=dark, width=2 * S)
        d.ellipse(((w / 2 - 12) * S, 6 * S, (w / 2 + 12) * S, 26 * S), fill=(255, 214, 64), outline=dark, width=S)
    if k >= 2:   # cooler and juicer
        d.rectangle((0, (h - 50) * S, 40 * S, (h - 4) * S), fill=(60, 140, 220), outline=dark, width=2 * S)
        d.ellipse((40 * S, 98 * S, 64 * S, 114 * S), fill=(220, 220, 230), outline=dark, width=S)
    return done(im, STAND)


def stand_in_owner(k):
    w, h = OWNER
    im = canvas(OWNER)
    d = ImageDraw.Draw(im)
    cx = w / 2
    skin, apron, hat = (240, 196, 150), (255, 214, 64), (236, 210, 140)
    d.rectangle(((cx - 26) * S, 54 * S, (cx + 26) * S, h * S), fill=apron, outline=(90, 60, 20), width=S)
    d.ellipse(((cx - 18) * S, 18 * S, (cx + 18) * S, 54 * S), fill=skin, outline=(90, 60, 20), width=S)
    d.ellipse(((cx - 30) * S, 12 * S, (cx + 30) * S, 26 * S), fill=hat, outline=(90, 60, 20), width=S)
    d.rectangle(((cx - 16) * S, 2 * S, (cx + 16) * S, 20 * S), fill=hat, outline=(90, 60, 20), width=S)
    arm = [((cx + 24, 60), (cx + 44, 80)), ((cx + 24, 60), (cx + 50, 50)), ((cx + 24, 60), (cx + 56, 66)),
           ((cx + 24, 60), (cx + 40, 22)), ((cx + 24, 60), (cx + 14, 36)), ((cx + 24, 60), (cx + 36, 86))][k]
    d.line([(arm[0][0] * S, arm[0][1] * S), (arm[1][0] * S, arm[1][1] * S)], fill=skin, width=8 * S)
    if k == 3:
        d.line([((cx - 24) * S, 60 * S), ((cx - 40) * S, 22 * S)], fill=skin, width=8 * S)
    mouth = {0: "smile", 1: "smile", 2: "smile", 3: "open", 4: "flat", 5: "frown"}[k]
    if mouth == "smile":
        d.arc(((cx - 8) * S, 34 * S, (cx + 8) * S, 46 * S), 20, 160, fill=(90, 40, 20), width=S)
    elif mouth == "open":
        d.ellipse(((cx - 5) * S, 38 * S, (cx + 5) * S, 47 * S), fill=(90, 40, 20))
    elif mouth == "frown":
        d.arc(((cx - 8) * S, 40 * S, (cx + 8) * S, 50 * S), 200, 340, fill=(90, 40, 20), width=S)
    else:
        d.line([((cx - 6) * S, 42 * S), ((cx + 6) * S, 42 * S)], fill=(90, 40, 20), width=S)
    for ex in (-7, 7):
        d.ellipse(((cx + ex - 2) * S, 30 * S, (cx + ex + 2) * S, 34 * S), fill=(30, 20, 10))
    return done(im, OWNER)


PERSON_COLOURS = ["#e8452e", "#9a5bd0", "#3a6fd8", "#2fb07a", "#f08c2a", "#6d8b3a",
                  "#f4c430", "#222a44", "#d05b8e", "#3cc8e0", "#1f5aa8", "#4a6fa5"]


def stand_in_person(kind, f):
    w, h = PERSON
    im = canvas(PERSON)
    d = ImageDraw.Draw(im)
    kid = CUSTOMERS[kind]["kid"]
    top = 34 if kid else 6
    shirt = rgb(PERSON_COLOURS[kind])
    skin = [(240, 196, 150), (196, 140, 96), (150, 100, 66)][kind % 3]
    cx = w / 2
    body = (cx - 14, top + 30, cx + 14, h - 40)
    # legs: apart on the steps
    step = {0: 10, 1: -10}.get(f, 0)
    d.line([(cx * S, (h - 40) * S), ((cx + step) * S, (h - 2) * S)], fill=(60, 50, 70), width=7 * S)
    d.line([(cx * S, (h - 40) * S), ((cx - step) * S, (h - 2) * S)], fill=(60, 50, 70), width=7 * S)
    d.rounded_rectangle(tuple(v * S for v in body), radius=6 * S, fill=shirt, outline=(40, 30, 30), width=S)
    d.ellipse(((cx - 13) * S, top * S, (cx + 13) * S, (top + 28) * S), fill=skin, outline=(40, 30, 30), width=S)
    d.ellipse(((cx + 4) * S, (top + 9) * S, (cx + 8) * S, (top + 13) * S), fill=(20, 20, 20))
    if f == 3:       # drinking: an arm up, a cup at the mouth
        d.line([(cx * S, (top + 40) * S), ((cx + 16) * S, (top + 20) * S)], fill=skin, width=6 * S)
        d.rectangle(((cx + 12) * S, (top + 10) * S, (cx + 22) * S, (top + 24) * S), fill=(255, 255, 255), outline=(40, 30, 30), width=S)
    elif f == 4:     # happy: arms up, a big smile
        for sx in (-1, 1):
            d.line([(cx * S, (top + 40) * S), ((cx + 20 * sx) * S, (top + 14) * S)], fill=skin, width=6 * S)
        d.arc(((cx - 2) * S, (top + 12) * S, (cx + 10) * S, (top + 22) * S), 0, 180, fill=(90, 30, 20), width=2 * S)
    else:
        d.line([(cx * S, (top + 40) * S), ((cx + 4 - step / 2) * S, (top + 70) * S)], fill=skin, width=6 * S)
    return done(im, PERSON)


PLACE_LOOK = {
    "park": ((120, 196, 250), (160, 220, 120), (200, 190, 170)),
    "beach": ((110, 190, 245), (240, 220, 160), (190, 150, 100)),
    "ballpark": ((120, 180, 240), (150, 80, 60), (190, 190, 190)),
    "downtown": ((150, 190, 230), (120, 120, 140), (180, 180, 180)),
}


def stand_in_place(key):
    sky, mid, path = PLACE_LOOK[key]
    im = Image.new("RGBA", (VIEW_W, VIEW_H))
    d = ImageDraw.Draw(im)
    for y in range(VIEW_H):
        f = y / VIEW_H
        d.line([(0, y), (VIEW_W, y)], fill=tuple(int(c + (255 - c) * f * 0.5) for c in sky) + (255,))
    d.ellipse((860, 40, 940, 120), fill=(255, 236, 140))
    rng = random.Random(key)
    if key == "beach":
        d.rectangle((0, 300, VIEW_W, 400), fill=(60, 140, 210))
        d.rectangle((0, 400, VIEW_W, 470), fill=mid)
    elif key == "ballpark":
        d.rectangle((0, 210, VIEW_W, 470), fill=mid)
        for x in range(0, VIEW_W, 64):
            d.line([(x, 210), (x, 470)], fill=(120, 60, 44), width=2)
        for x in (120, 500, 880):
            d.rectangle((x, 90, x + 12, 210), fill=(80, 80, 90))
            d.rectangle((x - 30, 70, x + 42, 100), fill=(250, 250, 220))
    elif key == "downtown":
        for x in range(0, VIEW_W, 130):
            hgt = rng.randint(180, 360)
            d.rectangle((x, 470 - hgt, x + 120, 470), fill=tuple(c - rng.randint(0, 30) for c in mid))
            for wy in range(470 - hgt + 20, 450, 40):
                for wx in range(x + 14, x + 110, 30):
                    d.rectangle((wx, wy, wx + 14, wy + 20), fill=(250, 230, 150))
    else:
        d.rectangle((0, 330, VIEW_W, 470), fill=mid)
        for x in range(40, VIEW_W, 170):
            d.rectangle((x + 30, 240, x + 44, 340), fill=(110, 70, 40))
            d.ellipse((x - 10, 150, x + 84, 270), fill=(60, 150, 70))
    d.rectangle((0, 470, VIEW_W, VIEW_H), fill=path)
    d.line([(0, 470), (VIEW_W, 470)], fill=tuple(c - 50 for c in path), width=3)
    return im


def stand_in_icon(name):
    w, h = ICON
    im = canvas(ICON)
    d = ImageDraw.Draw(im)
    ink = (60, 40, 20)
    box = lambda *v: tuple(x * S for x in v)
    if name in ("lemon", "soft_lemon"):
        d.ellipse(box(10, 18, 54, 46), fill=(255, 226, 60) if name == "lemon" else (170, 140, 70), outline=ink, width=2 * S)
    elif name == "sugar":
        d.rectangle(box(16, 14, 48, 54), fill=(245, 245, 245), outline=ink, width=2 * S)
        d.rectangle(box(16, 14, 48, 22), fill=(90, 150, 220))
    elif name == "ice":
        for x, y in ((12, 26), (32, 20), (24, 38)):
            d.rectangle(box(x, y, x + 18, y + 18), fill=(200, 236, 255), outline=(90, 150, 200), width=2 * S)
    elif name == "cups":
        for i in range(3):
            d.polygon([((16 + i * 4) * S, (14 + i * 6) * S), ((48 - i * 4 + 4) * S, (14 + i * 6) * S), ((44) * S, 54 * S), (20 * S, 54 * S)], fill=(255, 255, 255), outline=ink)
    elif name in ("pitcher", "pitcher_pink"):
        d.rectangle(box(18, 16, 46, 54), fill=(255, 230, 90) if name == "pitcher" else (255, 150, 190), outline=ink, width=2 * S)
        d.arc(box(40, 22, 56, 44), 270, 90, fill=ink, width=3 * S)
    elif name == "coin":
        d.ellipse(box(12, 12, 52, 52), fill=(255, 200, 40), outline=ink, width=2 * S)
    elif name == "cooler":
        d.rectangle(box(8, 20, 56, 54), fill=(60, 140, 220), outline=ink, width=2 * S)
        d.rectangle(box(8, 14, 56, 22), fill=(240, 240, 240), outline=ink, width=2 * S)
    elif name == "juicer":
        d.ellipse(box(10, 34, 54, 54), fill=(220, 220, 230), outline=ink, width=2 * S)
        d.polygon([(32 * S, 12 * S), (44 * S, 38 * S), (20 * S, 38 * S)], fill=(230, 230, 240), outline=ink)
    elif name == "sign":
        d.rectangle(box(8, 12, 56, 40), fill=(250, 240, 210), outline=ink, width=2 * S)
        d.line([(32 * S, 40 * S), (32 * S, 58 * S)], fill=ink, width=3 * S)
    elif name == "second":
        d.rectangle(box(10, 30, 54, 56), fill=(176, 116, 62), outline=ink, width=2 * S)
        d.rectangle(box(6, 16, 58, 30), fill=(255, 214, 64), outline=ink, width=2 * S)
    elif name == "strawberry":
        d.polygon([(12 * S, 20 * S), (52 * S, 20 * S), (32 * S, 56 * S)], fill=(230, 50, 60), outline=ink)
        d.rectangle(box(24, 12, 40, 20), fill=(60, 160, 60))
    return done(im, ICON)


def stand_in_bubble(k):
    w, h = BUBBLE
    im = canvas(BUBBLE)
    d = ImageDraw.Draw(im)
    ink = (60, 40, 40)
    d.ellipse((4 * S, 4 * S, 72 * S, 62 * S), fill=(255, 255, 255), outline=ink, width=2 * S)
    d.ellipse((14 * S, 62 * S, 24 * S, 72 * S), fill=(255, 255, 255), outline=ink, width=S)
    c = (38, 33)
    box = lambda x1, y1, x2, y2: (x1 * S, y1 * S, x2 * S, y2 * S)
    if k in (0, 1, 5):   # faces: sour, sweet, sweating
        d.ellipse(box(c[0] - 18, c[1] - 18, c[0] + 18, c[1] + 18), fill=(255, 220, 90) if k != 5 else (255, 190, 120), outline=ink, width=S)
        for ex in (-7, 7):
            d.line([((c[0] + ex - 3) * S, (c[1] - 6) * S), ((c[0] + ex + 3) * S, (c[1] - 4) * S)], fill=ink, width=2 * S)
        if k == 0:
            d.ellipse(box(c[0] - 4, c[1] + 4, c[0] + 4, c[1] + 10), outline=ink, width=2 * S)
        elif k == 1:
            d.line([((c[0] - 8) * S, (c[1] + 7) * S), ((c[0] + 8) * S, (c[1] + 7) * S)], fill=ink, width=2 * S)
            d.ellipse(box(c[0] - 3, c[1] + 6, c[0] + 5, c[1] + 15), fill=(240, 90, 110))
        else:
            d.ellipse(box(c[0] + 12, c[1] - 14, c[0] + 18, c[1] - 4), fill=(90, 170, 240))
            d.arc(box(c[0] - 7, c[1] + 4, c[0] + 7, c[1] + 12), 200, 340, fill=ink, width=2 * S)
    elif k == 2:          # melting ice
        d.rectangle(box(c[0] - 13, c[1] - 14, c[0] + 13, c[1] + 10), fill=(200, 236, 255), outline=(90, 150, 200), width=2 * S)
        d.ellipse(box(c[0] - 18, c[1] + 8, c[0] + 18, c[1] + 18), fill=(150, 200, 240))
    elif k == 3:          # a coin flying off
        d.ellipse(box(c[0] - 12, c[1] - 12, c[0] + 12, c[1] + 12), fill=(255, 200, 40), outline=ink, width=2 * S)
        for sx in (-1, 1):
            d.polygon([((c[0] + 12 * sx) * S, (c[1] - 2) * S), ((c[0] + 26 * sx) * S, (c[1] - 14) * S), ((c[0] + 22 * sx) * S, (c[1] + 2) * S)], fill=(255, 255, 255), outline=ink)
    else:                 # a heart
        d.ellipse(box(c[0] - 16, c[1] - 12, c[0], c[1] + 4), fill=(235, 60, 90))
        d.ellipse(box(c[0], c[1] - 12, c[0] + 16, c[1] + 4), fill=(235, 60, 90))
        d.polygon([((c[0] - 16) * S, (c[1] - 2) * S), ((c[0] + 16) * S, (c[1] - 2) * S), (c[0] * S, (c[1] + 18) * S)], fill=(235, 60, 90))
    return done(im, BUBBLE)


def cloud_picture():
    im = canvas((200, 90))
    d = ImageDraw.Draw(im)
    for x, y, r in ((50, 55, 30), (90, 42, 38), (140, 52, 32), (110, 62, 30), (70, 64, 26)):
        d.ellipse(((x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S), fill=(255, 255, 255, 235))
    return done(im, (200, 90))


def stand_in_title():
    im = stand_in_place("park")
    over = Image.new("RGBA", im.size, (255, 200, 60, 70))
    im = Image.alpha_composite(im, over)
    stand = stand_in_stand(0).resize((STAND[0] * 2, STAND[1] * 2), Image.LANCZOS)
    im.alpha_composite(stand, (VIEW_W // 2 - STAND[0], 560 - STAND[1] * 2))
    return im


def icon_picture():
    im = Image.new("RGBA", (64, 64), (255, 214, 64, 255))
    d = ImageDraw.Draw(im)
    d.ellipse((8, 14, 56, 50), fill=(255, 238, 120), outline=(120, 90, 20), width=3)
    d.line([(32, 14), (40, 4)], fill=(60, 140, 50), width=4)
    return im


# ---------------------------------------------------------------- sounds

def make_sounds(P):
    tone, mix, join = _tw.tone, _tw.mix, _tw.join
    P.sound("click", tone(0.03, 900, 700, "square", 0.12))
    P.sound("tick", tone(0.025, 1200, 1100, "tri", 0.18))
    P.sound("nope", tone(0.16, 160, 120, "square", 0.18))
    P.sound("coin", join(tone(0.05, 1568, 1568, "square", 0.18), tone(0.18, 2093, 2093, "square", 0.15)))
    P.sound("yum", join(tone(0.06, 660, 660, "tri", 0.3), tone(0.1, 880, 990, "tri", 0.3)))
    P.sound("hmm", tone(0.14, 300, 220, "tri", 0.25))
    P.sound("bell", join(*[tone(0.12, f, f, "tri", 0.3) for f in (784, 659, 523)], tone(0.4, 392, 392, "tri", 0.25)))


# ---------------------------------------------------------------- the project

def event_key(name, P):
    parts = name.split()
    if parts[0] == "mouse":
        return {"type": "mouse", "button": parts[-1], "edge": parts[-2], "global": parts[1] == "global"}
    return _tw.event_key(name, P)


def build(out):
    P = Lemon("Squeeze")
    # The board: money at the end of a summer, in dollars (whole, as the board keeps them).
    P.p["settings"]["scoreboard"] = {"unit": "dollars"}
    P.p["settings"]["pixelScaling"] = False
    P.font("Ubuntu", HERE.parent / "undertow" / "fonts" / "ubuntu-latin-700-normal.woff2")

    P.sprite("stand", [picture(f"stand_{k}", STAND, lambda k=k: stand_in_stand(k)) for k in range(4)], (STAND[0] // 2, STAND[1]))
    P.sprite("owner", [picture(f"owner_{k}", OWNER, lambda k=k: stand_in_owner(k)) for k in range(6)], (OWNER[0] // 2, OWNER[1]))
    for kind in range(len(CUSTOMERS)):
        frames = [picture(f"cust_{kind}_{f}", PERSON, lambda f=f, kind=kind: stand_in_person(kind, PERSON_FRAMES.index(f)))
                  for f in PERSON_FRAMES]
        P.sprite(f"cust_{kind}", frames, (PERSON[0] // 2, PERSON[1]), mask=(40, 10, 80, PERSON[1]))
    for place in PLACES:
        key = place["key"]
        P.sprite(f"place_{key}", [picture(f"place_{key}", (VIEW_W, VIEW_H), lambda key=key: stand_in_place(key))], (0, 0))
    P.sprite("icons", [picture(f"icon_{n}", ICON, lambda n=n: stand_in_icon(n)) for n in ICON_NAMES], (ICON[0] // 2, ICON[1] // 2))
    P.sprite("bubbles", [picture(f"bubble_{k}", BUBBLE, lambda k=k: stand_in_bubble(k)) for k in range(6)], (BUBBLE[0] // 2, BUBBLE[1] // 2))
    P.sprite("cloud", [cloud_picture()], (100, 45))
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

    def room(name, placed, colour="#7ec8f0"):
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
    room("Morning", [("Morning", 0, 0)])
    room("Street", [("Day", 0, 0)])
    room("Evening", [("Evening", 0, 0)])

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    pictures = sum(1 for _ in ART.glob("*.png")) if ART.exists() else 0
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(P.p['objects'])} objects, {pictures} of the teacher's pictures")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Lemon.zip")
