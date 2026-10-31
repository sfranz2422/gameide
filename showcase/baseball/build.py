#!/usr/bin/env python3
"""
Builds the seventh showcase game, "Moonshot", as a GameIDE project zip:
baseball seen from behind home plate. A Home Run Derby to start with, and
three-inning games against the computer or a friend on one keyboard.

    python3 showcase/baseball/build.py              # → showcase/baseball/out/Baseball.zip
    python3 showcase/baseball/build.py --assets DIR # where the teacher's pictures are

All its art is made here. The ballpark is painted pixel by pixel from the
same numbers the game plays by (game/_1rules.py): the camera behind the
plate, the bases, the mound, the fence and how far it is. So the painted
strike zone, the bases on the map and the fence a home run clears always
agree with the rules. The players are drawn here too, from stick-figure
poses filled out with jerseys, helmets and bats; the players on the map are
Kenney's Sports Pack (CC0), from the editor's art library.

The teacher can make nicer players, a crowd and a title with Gemini, from
PROMPTS.md, into ~/Downloads/baseball/. Any picture there is used in place
of the drawn one; the field itself is always painted here, because the
game's rules are measured on it.

The game is game/*.py: _1rules.py (every number), _2pitch.py (a pitch and
a swing), _3flight.py (a hit's flight and who fields it), _4derby.py,
_5innings.py (count, outs, bases, runs, innings), _6cpu.py (the computer),
_7controls.py, _8flow.py (pitch to pitch), _9screen.py (drawing), and the
object Game.
"""
import argparse
import importlib.util
import json
import math
import random
import sys
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


HERE = Path(__file__).resolve().parent
_tw = _load("thornwood_build", HERE.parent / "build.py")
font = _load("thornwood_font", HERE.parent / "font.py")
SPORTS = HERE.parent.parent / "frontend" / "public" / "library" / "kenney" / "sports"

R = {"math": math}
exec((HERE / "game" / "_1rules.py").read_text(), R)
VIEW_W, VIEW_H = R["VIEW_W"], R["VIEW_H"]
SKY_TOP, SKY_LOW = (24, 32, 84), (250, 160, 110)        # dusk: deep blue above, warm at the horizon


class Ballpark(_tw.Project):
    def write(self, path):
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n"
                       "Players on the map: Kenney's Sports Pack (kenney.nl), CC0. Everything else is drawn by its build.\n")


def rgb(hex_):
    return tuple(int(hex_[i:i + 2], 16) for i in (1, 3, 5))


# ---------------------------------------------------------------- the ground, as the rules have it

def fence_at(angle):
    """The rules' own fence (flight.fence_at), worked on whole arrays."""
    k = np.minimum(1, np.abs(angle) / 45)
    return R["FENCE_CENTRE"] - (R["FENCE_CENTRE"] - R["FENCE_LINE"]) * k ** 1.6


GRASS_A, GRASS_B = np.array((70, 150, 64)), np.array((84, 168, 74))
DIRT, DIRT_DARK = np.array((186, 128, 82)), np.array((160, 106, 66))
TRACK = np.array((150, 104, 70))
CHALK = np.array((246, 246, 240))


def paint_ground(x, y):
    """The colour of the field at every (x, y), in feet: arrays in, an
    RGB array out. Mown grass in a diamond check, the infield's dirt and its
    grass square, the mound, the dirt round home, the base paths, the foul
    lines, the batter's boxes, the bases and the warning track."""
    shape = x.shape
    out = np.zeros(shape + (3,))
    u, w = (x + y) / math.sqrt(2), (y - x) / math.sqrt(2)          # along the first- and third-base lines
    check = ((np.floor(u / 24) + np.floor(w / 24)) % 2).astype(bool)
    out[:] = GRASS_A
    out[check] = GRASS_B
    far = np.hypot(x, y)
    angle = np.degrees(np.arctan2(x, y))
    mound = (0.0, 60.5)
    dirt = (np.hypot(x - mound[0], y - mound[1]) < 95) & (u > -6) & (w > -6)
    square = (u > 6) & (u < 84) & (w > 6) & (w < 84)
    dirt &= ~square
    dirt |= np.hypot(x - mound[0], y - mound[1]) < 9
    dirt |= far < 13
    for bx, by in R["BASES"][1:]:
        dirt |= np.hypot(x - bx, y - by) < 7
    out[dirt] = DIRT
    speckle = (np.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 > 0.82
    out[dirt & speckle] = DIRT_DARK
    track = (far > fence_at(angle) - 14) & (y > 0)
    out[track] = TRACK
    # Chalk: the foul lines out to the fence, and the batter's boxes.
    lines = ((np.abs(w) < 0.35) | (np.abs(u) < 0.35)) & (far > 4) & (u > -1) & (w > -1)
    for side in (-1, 1):
        bx1, bx2 = sorted((side * 1.25, side * 5.2))
        box = (x > bx1) & (x < bx2) & (y > -3.3) & (y < 3.3)
        inner = (x > bx1 + 0.3) & (x < bx2 - 0.3) & (y > -3.0) & (y < 3.0)
        lines |= box & ~inner
    out[lines] = CHALK
    # The bases, the plate and the rubber.
    for bx, by in R["BASES"][1:]:
        out[(np.abs(x - bx) + np.abs(y - by)) < 2.0] = CHALK      # a bit big, so the map shows them
    plate = (np.abs(x) < 0.71) & (y < 0.71) & (np.abs(x) <= y + 0.71)       # a pentagon, its point to the catcher
    out[plate] = CHALK
    out[(np.abs(x) < 1) & (np.abs(y - 60.5) < 0.25)] = CHALK
    return out.reshape(shape + (3,))


def stands_rows(width, height, seed=5):
    """The crowd above the outfield wall: rows of seats, fans in both teams'
    colours and others, at dusk, with light towers."""
    rnd = random.Random(seed)
    im = Image.new("RGB", (width, height), (40, 40, 64))
    d = ImageDraw.Draw(im)
    fans = [(96, 165, 250), (248, 113, 113), (250, 250, 250), (250, 204, 21), (52, 211, 153), (167, 139, 250),
            (230, 180, 140), (120, 80, 60)]
    row_h = 6
    for r, y in enumerate(range(height - row_h, -row_h, -row_h)):
        d.rectangle((0, y + row_h - 2, width, y + row_h - 1), fill=(70, 70, 96))
        for x in range(rnd.randrange(3), width, 4):
            if rnd.random() < 0.85:
                c = rnd.choice(fans)
                d.rectangle((x, y + 1, x + 2, y + 3), fill=c)
                d.point((x + 1, y), fill=(222, 184, 150) if rnd.random() < 0.7 else (110, 70, 50))
    return im


def sky(width, height):
    im = Image.new("RGB", (width, height))
    px = im.load()
    for y in range(height):
        k = y / max(1, height - 1)
        c = tuple(int(SKY_TOP[i] + (SKY_LOW[i] - SKY_TOP[i]) * k ** 1.4) for i in range(3))
        for x in range(width):
            px[x, y] = c
    d = ImageDraw.Draw(im)
    rnd = random.Random(9)
    for _ in range(40):                                        # the first stars
        x, y = rnd.randrange(width), rnd.randrange(int(height * 0.5))
        d.point((x, y), fill=(255, 255, 230))
    return im


def moon(im, x, y, r):
    """The moon, full, a little cratered: what a moonshot is aimed at."""
    d = ImageDraw.Draw(im)
    glow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((x - r * 2, y - r * 2, x + r * 2, y + r * 2), fill=(255, 250, 220, 50))
    im.paste(glow.filter(ImageFilter.GaussianBlur(r)), (0, 0), glow.filter(ImageFilter.GaussianBlur(r)))
    d.ellipse((x - r, y - r, x + r, y + r), fill=(250, 246, 222))
    for cx, cy, cr in ((-0.3, -0.2, 0.22), (0.25, 0.3, 0.16), (0.35, -0.35, 0.1), (-0.1, 0.45, 0.12)):
        d.ellipse((x + cx * r - cr * r, y + cy * r - cr * r, x + cx * r + cr * r, y + cy * r + cr * r), fill=(226, 220, 196))


def light_tower(d, x, top, bottom):
    d.rectangle((x - 1, top + 10, x + 1, bottom), fill=(50, 54, 70))
    d.rectangle((x - 12, top, x + 12, top + 10), fill=(60, 64, 80))
    for i in range(4):
        for j in range(2):
            d.ellipse((x - 11 + i * 6, top + 1 + j * 5, x - 7 + i * 6, top + 5 + j * 5), fill=(255, 252, 214))


def stamp(im, x, y, words, colour, scale=1):
    """Writes in Thornwood's pixel font, for the numbers on the fence."""
    d = ImageDraw.Draw(im)
    for n, ch in enumerate(words):
        for r, row in enumerate(font.G.get(ch, ())):
            for c, bit in enumerate(row):
                if bit == "#":
                    px, py = x + (n * 6 + c) * scale, y + r * scale
                    d.rectangle((px, py, px + scale - 1, py + scale - 1), fill=colour)


# ---------------------------------------------------------------- the two backgrounds

def plate_view(backdrop=None):
    """The ballpark from behind home plate, 640 x 360. Every pixel below the
    wall is the ground point the game's own projection sends there."""
    B, H, F = R["CAM_BACK"], R["CAM_HIGH"], R["CAM_FOCAL"]
    hor, mid = R["CAM_HORIZON"], R["CAM_MIDDLE"]
    W, Hh = VIEW_W, VIEW_H
    # Where the wall stands in each column: walk out along the ground ray until the fence.
    us = np.arange(W) + 0.5
    wall_d = np.zeros(W)
    for i, u in enumerate(us):
        lo, hi = B + 1, B + 600
        for _ in range(40):
            d = (lo + hi) / 2
            x, y = (u - mid) * d / F, d - B
            if math.hypot(x, y) < float(fence_at(np.array(math.degrees(math.atan2(x, y))))):
                lo = d
            else:
                hi = d
        wall_d[i] = lo
    wall_bottom = hor + H * F / wall_d
    wall_top = hor + (H - R["FENCE_HIGH"]) * F / wall_d
    vv, uu = np.mgrid[0:Hh, 0:W] + 0.5
    below = vv > hor + 0.5
    depth = np.where(below, H * F / np.maximum(vv - hor, 1e-3), 1e9)
    gx, gy = (uu - mid) * depth / F, depth - B
    img = paint_ground(gx, gy)
    # Further away is a little hazier, as it is at dusk.
    haze = np.clip((depth - 60) / 500, 0, 0.35)[..., None]
    img = img * (1 - haze) + np.array(SKY_LOW) * 0.6 * haze
    ground = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    # Above the ground: sky, the moon, light towers and the crowd, then the wall.
    top = int(wall_top.min()) - 1
    stands_h = 30
    back = sky(W, Hh)
    moon(back, 520, 22, 13)
    d = ImageDraw.Draw(back)
    for x in (70, 250, 400, 590):
        light_tower(d, x, 4, top - stands_h + 2)
    crowd = stands_rows(W, stands_h)
    if backdrop is not None:
        crowd = backdrop.resize((W, stands_h + top), Image.BOX).crop((0, 0, W, stands_h + top))
        back.paste(crowd, (0, 0))
    else:
        back.paste(crowd, (0, top - stands_h))
    mask = Image.fromarray(np.where(vv >= wall_top[None, :], 255, 0).astype(np.uint8))
    back.paste(ground, (0, 0), Image.fromarray(np.where(vv >= wall_bottom[None, :], 255, 0).astype(np.uint8)))
    d = ImageDraw.Draw(back)
    for i in range(W):                                           # the padded wall, a yellow line on top
        d.line((i, wall_top[i], i, wall_bottom[i]), fill=(30, 92, 64))
        d.point((i, wall_top[i]), fill=(250, 204, 21))
        if (i // 26) % 2:
            d.point((i, (wall_top[i] + wall_bottom[i]) / 2), fill=(36, 104, 74))
    stamp(back, mid - 8, int((wall_top[mid] + wall_bottom[mid]) / 2) - 3, str(R["FENCE_CENTRE"]), (250, 250, 240))
    del mask
    return back.convert("RGBA")


def field_map(backdrop=None):
    """The field from above, 640 x 360: home plate at the bottom middle, the
    fence and the crowd round the top, at the rules' MAP_K pixels a foot."""
    W, Hh = VIEW_W, VIEW_H
    vv, uu = np.mgrid[0:Hh, 0:W] + 0.5
    x, y = (uu - R["MAP_X"]) / R["MAP_K"], (R["MAP_Y"] - vv) / R["MAP_K"]
    img = paint_ground(x, y)
    far, angle = np.hypot(x, y), np.degrees(np.arctan2(x, y))
    fence = fence_at(angle)
    fair = (np.abs(angle) <= 45) & (y > 0)
    beyond = (far > fence + 5) & fair | (far > R["FENCE_LINE"] * 1.03) & ~fair & (y > 0)
    wall = fair & (far >= fence) & (far <= fence + 5)
    im = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    crowd = stands_rows(W, Hh, seed=8) if backdrop is None else backdrop.resize((W, Hh), Image.BOX)
    im.paste(crowd, (0, 0), Image.fromarray(np.where(beyond, 255, 0).astype(np.uint8)))
    im.paste((30, 92, 64), (0, 0), Image.fromarray(np.where(wall, 255, 0).astype(np.uint8)))
    for a, label in ((-44, R["FENCE_LINE"]), (-22, None), (0, R["FENCE_CENTRE"]), (22, None), (44, R["FENCE_LINE"])):
        if label is None:
            continue
        r = float(fence_at(np.array(a))) - 9
        px = R["MAP_X"] + math.sin(math.radians(a)) * r * R["MAP_K"]
        py = R["MAP_Y"] - math.cos(math.radians(a)) * r * R["MAP_K"]
        stamp(im, int(px) - 9 + (14 if a < 0 else -14 if a > 0 else 0), int(py) - 4, str(label), (250, 250, 240))
    return im.convert("RGBA")


# ---------------------------------------------------------------- the players, drawn from poses

SKINS = [(232, 190, 150), (198, 140, 100), (140, 92, 60), (96, 62, 42)]
PANTS, SHOE, WOOD, WOOD_DARK = (236, 236, 232), (28, 28, 34), (196, 140, 80), (120, 80, 40)
OUTLINE = (20, 22, 34)


def figure(pose, ppf, colours, size, feet, skin=0):
    """One player, from a pose: joints in feet (x right, y up, from between
    his feet) joined by thick limbs with a dark outline. `size` is the canvas
    in feet, `feet` where his feet are on it (feet from its left and bottom)."""
    jersey, dark = colours
    W, Hh = round(size[0] * ppf), round(size[1] * ppf)
    k = 4                                             # drawn four times bigger, then shrunk: clean edges
    im = Image.new("RGBA", (W * k, Hh * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def at(p):
        return ((feet[0] + p[0]) * ppf * k, (size[1] - feet[1] - p[1]) * ppf * k)

    def limb(a, b, width, colour, edge=True):
        w = max(1, width * ppf * k)
        if edge:
            d.line((at(a), at(b)), fill=OUTLINE, width=int(w + 2.2 * k))
            for p in (a, b):
                x, y = at(p)
                r = (w + 2.2 * k) / 2
                d.ellipse((x - r, y - r, x + r, y + r), fill=OUTLINE)
        d.line((at(a), at(b)), fill=colour, width=int(w))
        for p in (a, b):
            x, y = at(p)
            d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=colour)

    def blob(p, r, colour):
        x, y = at(p)
        rr = r * ppf * k
        d.ellipse((x - rr - 1.1 * k, y - rr - 1.1 * k, x + rr + 1.1 * k, y + rr + 1.1 * k), fill=OUTLINE)
        d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=colour)

    skin_c = SKINS[skin % len(SKINS)]
    shade = tuple(int(c * 0.78) for c in PANTS)
    order = pose.get("order", ["back", "body", "front"])
    for part in order:
        if part == "bat" and "bat" in pose:
            a, b = pose["hands"], pose["bat"]
            limb(a, b, 0.2, WOOD)
            mx, my = (a[0] * 0.35 + b[0] * 0.65, a[1] * 0.35 + b[1] * 0.65)
            limb((mx, my), b, 0.3, WOOD, edge=False)
            limb(a, (a[0] + (b[0] - a[0]) * 0.06, a[1] + (b[1] - a[1]) * 0.06), 0.28, WOOD_DARK, edge=False)
        for leg in pose.get(part + "_legs", []):
            hip, knee, foot = leg
            c = shade if part == "back" else PANTS
            limb(hip, knee, 0.68, c)
            limb(knee, foot, 0.5, dark)
            limb(foot, (foot[0] + pose.get("toe", 0.45), foot[1]), 0.3, SHOE)
        for arm in pose.get(part + "_arms", []):
            sh, el, hand = arm[:3]
            limb(sh, el, 0.46, jersey if part != "back" else tuple(int(c * 0.8) for c in jersey))
            limb(el, hand, 0.36, skin_c)
            if len(arm) > 3 and arm[3] == "glove":
                blob(hand, 0.32, (130, 76, 36))
        if part == "body":
            hip, neck = pose["hip"], pose["neck"]
            limb(hip, neck, 1.4, jersey)
            limb((hip[0] - 0.05, hip[1] + 0.1), (hip[0] + 0.05, hip[1] - 0.15), 1.3, PANTS)
            limb((hip[0] - 0.05, hip[1] + 0.35), (hip[0] + 0.05, hip[1] + 0.35), 1.38, dark)   # the belt
            head = pose["head"]
            blob(head, 0.42, skin_c)
            face = pose.get("face", 1)
            if pose.get("helmet"):
                x, y = at(head)
                r = 0.47 * ppf * k
                d.pieslice((x - r - k, y - r - k, x + r + k, y + r + k), 180, 360, fill=OUTLINE)
                d.pieslice((x - r, y - r, x + r, y + r), 180, 360, fill=dark)
                d.ellipse((x - r * 0.6, y - r * 0.85, x - r * 0.1, y - r * 0.55), fill=tuple(min(255, c + 70) for c in dark))
                if face:
                    d.rectangle((x + face * r * 0.2, y - k, x + face * r * 1.25, y + k * 0.6), fill=dark)   # the brim
            else:                                                # a cap
                x, y = at(head)
                r = 0.44 * ppf * k
                d.pieslice((x - r, y - r * 1.05, x + r, y + r * 0.95), 180, 360, fill=dark)
                if face:
                    d.rectangle((x + (0 if face > 0 else -r * 1.3), y - r * 0.25, x + (r * 1.3 if face > 0 else 0), y), fill=dark)
            if face and ppf > 5:
                x, y = at((head[0] + 0.2 * face, head[1] + 0.05))
                d.ellipse((x - 0.6 * k, y - 0.6 * k, x + 0.6 * k, y + 0.6 * k), fill=OUTLINE)
    return im.resize((W, Hh), Image.BOX)


def batter_poses():
    """Right-handed, seen from behind the catcher: he faces the plate, to the right."""
    def legs(front_foot=(0.4, 0.05), front_knee=(0.55, 1.55), hip=(0, 2.9), heel=0.0):
        return {"back_legs": [((hip[0] - 0.15, hip[1]), (-0.25 - heel, 1.55), (-0.4 - heel, 0.0))],
                "front_legs": [((hip[0] + 0.1, hip[1]), front_knee, front_foot)], "hip": hip}

    stance = {**legs(), "neck": (-0.1, 4.85), "head": (0.05, 5.5), "hands": (-0.55, 4.95), "bat": (-1.45, 7.55),
              "back_arms": [((-0.05, 4.7), (0.35, 4.3), (-0.5, 4.95))],
              "front_arms": [((-0.25, 4.65), (-0.95, 4.35), (-0.6, 4.9))]}
    stride = {**legs((0.85, 0.15), (0.8, 1.6), (0.1, 2.85)), "neck": (-0.05, 4.8), "head": (0.1, 5.45),
              "hands": (-0.75, 4.85), "bat": (-2.05, 7.1),
              "back_arms": [((0.0, 4.65), (0.3, 4.2), (-0.7, 4.85))],
              "front_arms": [((-0.2, 4.6), (-1.0, 4.25), (-0.8, 4.8))]}
    swing = {**legs((0.85, 0.05), (0.75, 1.55), (0.25, 2.8)), "neck": (0.25, 4.75), "head": (0.45, 5.4),
             "hands": (0.15, 3.95), "bat": (-1.35, 3.35),
             "back_arms": [((0.4, 4.55), (0.55, 4.0), (0.2, 3.95))],
             "front_arms": [((0.1, 4.55), (-0.25, 4.0), (0.1, 3.9))], "order": ["back", "body", "front", "bat"]}
    contact = {**legs((0.9, 0.0), (0.8, 1.5), (0.35, 2.75), heel=0.2), "neck": (0.35, 4.7), "head": (0.55, 5.35),
               "hands": (0.75, 3.75), "bat": (3.55, 3.55),
               "back_arms": [((0.5, 4.5), (0.65, 3.95), (0.75, 3.75))],
               "front_arms": [((0.2, 4.5), (0.3, 3.9), (0.7, 3.7))], "order": ["back", "body", "bat", "front"]}
    follow = {**legs((0.85, 0.0), (0.75, 1.5), (0.3, 2.8), heel=0.35), "neck": (0.3, 4.8), "head": (0.35, 5.45),
              "hands": (-0.35, 5.3), "bat": (-2.5, 4.55), "face": 1,
              "back_arms": [((0.45, 4.6), (0.3, 5.4), (-0.3, 5.3))],
              "front_arms": [((0.1, 4.6), (-0.4, 4.8), (-0.4, 5.25))], "order": ["bat", "back", "body", "front"]}
    for p in (stance, stride, swing, contact, follow):
        p["helmet"] = True
        p.setdefault("order", ["bat", "back", "body", "front"])
    return [stance, stride, swing, contact, follow]


def pitcher_poses():
    """Right-handed, facing us from the mound. His glove is on his left hand (our right)."""
    base = {"hip": (0, 2.95), "neck": (0, 4.95), "head": (0, 5.6), "toe": 0.0}
    s = dict(base, back_legs=[((-0.2, 2.95), (-0.35, 1.6), (-0.45, 0.0))],
             front_legs=[((0.2, 2.95), (0.35, 1.6), (0.45, 0.0))],
             back_arms=[((-0.5, 4.7), (-0.7, 3.9), (-0.1, 4.1))],
             front_arms=[((0.5, 4.7), (0.7, 3.9), (0.1, 4.15), "glove")])
    kick = dict(base, back_legs=[((-0.15, 2.95), (-0.2, 1.6), (-0.25, 0.0))],
                front_legs=[((0.2, 2.95), (0.65, 3.4), (0.45, 2.1))],
                back_arms=[((-0.5, 4.7), (-0.75, 3.95), (-0.05, 4.2))],
                front_arms=[((0.5, 4.7), (0.65, 4.0), (0.05, 4.25), "glove")])
    reach = dict(base, hip=(0.1, 2.7), neck=(0.15, 4.7), head=(0.2, 5.35),
                 back_legs=[((-0.1, 2.7), (-0.45, 1.5), (-0.7, 0.2))],
                 front_legs=[((0.3, 2.7), (0.75, 1.3), (0.8, -0.1))],
                 back_arms=[((-0.4, 4.45), (-1.05, 4.85), (-1.15, 5.9))],
                 front_arms=[((0.6, 4.45), (1.2, 4.3), (1.4, 4.75), "glove")])
    throw = dict(base, hip=(0.2, 2.55), neck=(0.35, 4.3), head=(0.45, 4.95),
                 back_legs=[((0.0, 2.55), (-0.7, 1.8), (-1.0, 1.1))],
                 front_legs=[((0.35, 2.55), (0.75, 1.3), (0.75, -0.1))],
                 back_arms=[((0.0, 4.1), (0.55, 3.4), (0.95, 2.7))],
                 front_arms=[((0.7, 4.1), (1.0, 3.5), (0.6, 3.25), "glove")])
    return [s, kick, reach, throw]


def fielder_pose():
    return {"hip": (0, 2.3), "neck": (0, 4.0), "head": (0, 4.65), "toe": 0.0,
            "back_legs": [((-0.25, 2.3), (-0.75, 1.3), (-0.75, 0.0))],
            "front_legs": [((0.25, 2.3), (0.75, 1.3), (0.75, 0.0))],
            "back_arms": [((-0.5, 3.8), (-0.6, 2.9), (-0.3, 2.2))],
            "front_arms": [((0.5, 3.8), (0.6, 2.9), (0.35, 2.2), "glove")]}


# ---------------------------------------------------------------- the teacher's pictures, if there are any

def teachers(A, name, frames, canvas, feet_px, height):
    """Gemini's pose sheet `name` on magenta, if it's there: cut into
    figures, made pixels `height` tall, feet at the canvas's bottom middle."""
    for ext in ("png", "jpeg", "jpg", "webp"):
        f = A / f"{name}.{ext}"
        if f.is_file():
            break
    else:
        return None
    fb = _load("football_build", HERE.parent / "football" / "build.py")
    found = fb.figures(Image.open(f), frames)
    if not found:
        return None
    small = fb._mm.to_pixels(found, height)
    small += [small[-1]] * (frames - len(small))
    out = []
    for im in small[:frames]:
        # Lined up by the feet, not the middle: a batter's bat reaching out
        # over the plate would otherwise pull him off his spot.
        a = np.array(im.getchannel("A"))
        rows = a[-max(2, a.shape[0] // 10):]
        xs = np.nonzero(rows.any(axis=0))[0]
        mid = (xs.min() + xs.max()) / 2 if len(xs) else im.width / 2
        c = Image.new("RGBA", canvas, (0, 0, 0, 0))
        c.paste(im, (int(feet_px[0] - mid), int(feet_px[1] - im.height + 1)), im)
        out.append(c)
    return out


def picture(A, name):
    for ext in ("png", "jpeg", "jpg", "webp"):
        f = A / f"{name}.{ext}"
        if f.is_file():
            return Image.open(f).convert("RGB")
    return None


# ---------------------------------------------------------------- the build

def build(assets_dir, out):
    A = Path(assets_dir).expanduser()
    P = Ballpark("Moonshot")
    P.p["settings"]["pixelScaling"] = False
    made = []

    crowd = picture(A, "crowd")
    made.append("crowd" if crowd else None)
    P.sprite("plate_view", [plate_view(crowd)], (0, 0))
    P.sprite("field_map", [field_map(crowd)], (0, 0))

    teams = {t: (rgb(v["colour"]), rgb(v["dark"])) for t, v in R["TEAMS"].items()}
    # Each kind of player at the size the camera sees him: pixels a foot (the
    # game's screen.py scales by the same numbers, so a figure is drawn ~1:1).
    # The last number is the tallest the figure gets in any pose, in feet (the
    # batter with his bat up), which a picture of the teacher's is scaled to.
    kinds = {"batter": (17, batter_poses(), (6.6, 8.0), (2.8, 0.1), 0, 7.6),
             "pitcher": (6.8, pitcher_poses(), (3.4, 7.0), (1.6, 0.15), 1, 6.3),
             "fielder": (3.8, [fielder_pose()], (2.4, 5.4), (1.2, 0.1), 2, 5.0),
             "fielder_far": (2.05, [fielder_pose()], (2.4, 5.4), (1.2, 0.1), 2, 5.0)}
    for kind, (ppf, poses, size, feet, skin, tallest) in kinds.items():
        for team, colours in teams.items():
            frames = [figure(p, ppf, colours, size, feet, skin=skin + (team == "home")) for p in poses]
            origin = (round(feet[0] * ppf), round((size[1] - feet[1]) * ppf))
            key = f"{kind.split('_')[0]}-{team}"           # the far fielders are the near ones, smaller
            real = teachers(A, key, len(poses), frames[0].size, origin, round(tallest * ppf))
            if kind != "fielder_far":
                made.append(key if real else None)
            P.sprite(f"{kind}_{team}", real or frames, origin)

    players = Image.open(SPORTS / "players.png").convert("RGBA")
    for team, row, look in (("away", 0, 1), ("home", 2, 3)):
        im = players.crop((look * 24, row * 32, look * 24 + 24, row * 32 + 32))
        im = im.crop(im.getbbox())
        P.sprite(f"map_{team}", [im], (im.width // 2, im.height // 2))

    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    P.sound("click", tone(0.03, 1200, 900, "square", 0.12))
    P.sound("whoosh", lowpass(tone(0.3, 0, 0, "noise", 0.3, seed=61), 0.02, 0.2))
    P.sound("swish", lowpass(tone(0.18, 0, 0, "noise", 0.45, seed=62), 0.4, 0.05))
    P.sound("crack", mix(tone(0.05, 2400, 1800, "square", 0.35), lowpass(tone(0.12, 0, 0, "noise", 0.9, seed=63), 0.9, 0.3),
                         tone(0.1, 300, 140, "sine", 0.4)))
    P.sound("mitt", mix(lowpass(tone(0.08, 0, 0, "noise", 0.8, seed=64), 0.5, 0.1), tone(0.1, 160, 70, "sine", 0.6)))
    P.sound("cheer", mix(lowpass(tone(2.2, 0, 0, "noise", 0.6, seed=65), 0.3, 0.15),
                         lowpass(tone(2.2, 0, 0, "noise", 0.4, seed=66), 0.07, 0.04)))
    # The ballpark organ: the "Charge!" call and an answer, then round again.
    mel = [67, 0, 72, 0, 76, 0, 79, 79, 0, 0, 76, 0, 79, 79, 79, 0,
           72, 74, 76, 77, 79, 0, 81, 0, 79, 0, 76, 0, 72, 0, 0, 0,
           67, 0, 72, 0, 76, 0, 79, 79, 0, 0, 76, 0, 79, 79, 79, 0,
           81, 79, 77, 76, 74, 0, 71, 0, 72, 0, 0, 0, 0, 0, 0, 0]
    bass = [48, 0, 55, 0, 48, 0, 55, 0, 53, 0, 57, 0, 55, 0, 50, 0]
    P.sound("organ", _tw.music_loop(mel, bass, 132), volume=0.5)

    for f in sorted((HERE / "game").glob("_*.py")):
        head, _ = _tw.read_code(f)
        P.script(head.get("script", f.stem.strip("_")), f.read_text())
    files = sorted(f for f in (HERE / "game").glob("*.py") if not f.name.startswith("_"))
    parsed = {f.stem: _tw.read_code(f) for f in files}
    for name, (head, _) in parsed.items():
        P.obj(name, depth=int(head.get("depth", 0)))
    for name, (head, events) in parsed.items():
        o = next(x for x in P.p["objects"] if x["name"] == name)
        for ev, code in events:
            o["events"].append({"id": _tw.new_id(), "key": _tw.event_key(ev, P), "mode": "python", "code": code})

    lid = _tw.new_id()
    P.p["rooms"].append({
        "id": _tw.new_id(), "name": "Ballpark", "width": VIEW_W, "height": VIEW_H, "background": "#18204a",
        "gridWidth": 32, "gridHeight": 32, "snap": True,
        "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
        # The room is exactly the screen: the camera stands still (it's there so a home run can shake it).
        "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 0},
        "instances": [{"id": _tw.new_id(), "object": P.obj_id("Game"), "layer": lid, "x": 0, "y": 0,
                       "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""}],
    })
    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    real = [m for m in made if m]
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(real)} of {len(made)} pictures the teacher's, the rest drawn here")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--assets", default="~/Downloads/baseball")
    ap.add_argument("--out", default=str(HERE / "out" / "Baseball.zip"))
    a = ap.parse_args()
    build(a.assets, Path(a.out))
