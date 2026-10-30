#!/usr/bin/env python3
"""
Builds the fourth showcase game, "Under the Lights", as a GameIDE project
zip: an arcade American football game, 7 on 7, the Comets against the
Badgers on a Friday night.

    python3 showcase/football/build.py              # → showcase/football/out/Football.zip
    python3 showcase/football/build.py --assets DIR # where the pictures are

THE PICTURES ARE NOT IN THIS REPOSITORY. The teacher makes them with Google
Gemini from PROMPTS.md, into ~/Downloads/football/. Any picture not there
yet is drawn here as a stand-in, so the game can be built and played before
the art exists. The field itself is always drawn here — yard lines and
numbers must be exact, and Gemini's never are.

Gemini's pictures are made pixels again exactly as Mystery Meat's are (its
build.py does the cutting: magenta away, figures found by the gaps between
them, shrunk, a small palette, feet lined up).

The game is game/*.py: _1rules.py (the field, the teams, the playbook as
data), _2play.py (one play, snap to whistle), _3match.py (downs, score,
clock, the computer's coach), _4controls.py, _5screen.py (drawing),
_6flow.py (between plays), and the objects Game, Player, Ball, Referee.
"""
import argparse
import importlib.util
import json
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


HERE = Path(__file__).resolve().parent
_tw = _load("thornwood_build", HERE.parent / "build.py")
_mm = _load("mystery_build", HERE.parent / "mystery" / "build.py")
font = _load("thornwood_font", HERE.parent / "font.py")

RULES = {}
exec((HERE / "game" / "_1rules.py").read_text(), RULES)
YD, TOP, BOT, MID, HASH = RULES["YD"], RULES["TOP"], RULES["BOT"], RULES["MID"], RULES["HASH"]
END_L, GOAL_L, GOAL_R, END_R = RULES["END_L"], RULES["GOAL_L"], RULES["GOAL_R"], RULES["END_R"]
VIEW_W, VIEW_H = RULES["VIEW_W"], RULES["VIEW_H"]
ROOM_W, ROOM_H = END_R + END_L, BOT + 32

HEIGHTS = {"player": 32, "referee": 34, "mascot": 40}
POSES = 8                     # stance, ready, arm back, thrown, catching, diving, down, celebrating
CANVAS = (52, 42)             # every player frame, room for a dive and arms up; feet at the bottom middle
PICTURES = {"title": (VIEW_W, VIEW_H), "chalkboard": (VIEW_W, VIEW_H), "win": (VIEW_W, VIEW_H),
            "lose": (VIEW_W, VIEW_H), "scoreboard": (VIEW_W, 26)}
STANDS_SIZE = (192, TOP)
STANDS_CROP = 0.86            # Gemini drew a grey wall down the stands' right edge: cut off

# A sheet with fewer figures than poses: which figure stands in for each.
# Gemini drew the Badgers in 6 poses, not 8, leaving out the arm forward
# after a throw and lying down. Neighbours hold their places here; then
# REPAINT puts in the Comets' own two, repainted in the Badgers' colours.
PICK = {"p-away-poses": {6: [0, 1, 2, 2, 3, 4, 4, 5]}}
REPAINT = {"p-away-poses": {6: [3, 6]}}


def badgers(im):
    """A Comets figure in Badgers' colours: navy turns red, gold turns white,
    the white socks red. Skin, outlines and the face mask stay as they are."""
    import colorsys
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if 0.55 < h < 0.75 and s > 0.25 and v > 0.12:          # navy: jersey, helmet stripe
                nr, ng, nb = colorsys.hsv_to_rgb(0.0, min(1, s + 0.25), min(1, v * 1.9))
            elif 0.085 < h < 0.2 and s > 0.35:                      # gold, and its brown shading (skin is redder)
                k = min(1, 0.3 + v * 0.75)
                nr, ng, nb = k, k, min(1, k * 1.02)
            elif s < 0.12 and v > 0.8:                               # white socks
                nr, ng, nb = colorsys.hsv_to_rgb(0.0, 0.75, 0.78)
            else:
                continue
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return out


def rgb(hex_):
    return tuple(int(hex_[i:i + 2], 16) for i in (1, 3, 5))


UNIFORMS = {   # helmet, jersey, pants, socks
    "home": ((242, 194, 48), (43, 74, 168), (242, 194, 48), (240, 240, 240)),
    "away": ((240, 240, 240), (200, 53, 46), (240, 240, 240), (200, 53, 46)),
}
SKIN, CLEAT, BALL = (196, 140, 100), (30, 30, 30), (128, 74, 40)


# ---------------------------------------------------------------- stand-ins, until the pictures come

def figure(colors, legs=0, arms="down", ball=False, crouch=0):
    """A little footballer facing right, on a CANVAS-sized picture."""
    helmet, jersey, pants, socks = colors
    im = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, foot = CANVAS[0] // 2, CANVAS[1] - 1
    top = foot - 32 + crouch
    # legs: two, swinging
    for side, off in ((-1, legs), (1, -legs)):
        lx = cx + side * 2 + off
        d.rectangle((lx - 2, top + 22, lx + 1, foot - 3), fill=socks)
        d.rectangle((lx - 2, foot - 2, lx + 3, foot), fill=CLEAT)
    d.rectangle((cx - 5, top + 18, cx + 4, top + 23), fill=pants)
    d.rectangle((cx - 6, top + 9, cx + 5, top + 18), fill=jersey)               # shoulder pads and jersey
    arm = {"down": [(cx + 3, top + 11, cx + 6, top + 18)],
           "back": [(cx - 9, top + 2, cx - 6, top + 11)],
           "forward": [(cx + 5, top + 6, cx + 11, top + 9)],
           "up": [(cx - 4, top - 2, cx - 2, top + 9), (cx + 3, top - 2, cx + 5, top + 9)]}[arms]
    for a in arm:
        d.rectangle(a, fill=jersey)
    d.ellipse((cx - 5, top, cx + 5, top + 10), fill=helmet)                        # the helmet
    d.rectangle((cx + 3, top + 4, cx + 6, top + 7), fill=(140, 140, 150))          # face mask
    d.point((cx + 2, top + 5), fill=SKIN)
    if ball:
        d.ellipse((cx + 2, top + 11, cx + 8, top + 15), fill=BALL)
    return im


def stand_in_players(team):
    c = UNIFORMS[team]
    swing = [-3, -1, 2, 3, 1, -2]
    run = [figure(c, legs=s) for s in swing]
    carry = [figure(c, legs=s, ball=True) for s in swing]
    dive = figure(c, arms="forward").rotate(-80, expand=False, center=(18, 30))
    down = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    lying = figure(c).rotate(-90, expand=True)
    down.paste(lying, (0, CANVAS[1] - 14), lying)
    poses = [figure(c, crouch=6), figure(c), figure(c, arms="back", ball=False), figure(c, arms="forward"),
             figure(c, arms="up"), dive, down, figure(c, arms="up", crouch=-3)]
    return run, carry, poses


def stand_in_referee():
    out = []
    for arms in ("down", "up", "forward", "down", "back"):
        im = figure(((20, 20, 20), (235, 235, 235), (235, 235, 235), (20, 20, 20)), arms=arms)
        d = ImageDraw.Draw(im)
        for x in range(12, 24, 3):                     # the stripes
            d.line((x, 13, x, 22), fill=(15, 15, 15))
        out.append(im)
    return out


def stand_in_mascot():
    out = []
    for k in range(3):
        im = Image.new("RGBA", (40, 42), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.polygon([(6, 10 + k * 3), (20, 14), (20, 26), (2, 30 - k * 2)], fill=(242, 160, 40))
        d.ellipse((12, 8, 34, 30), fill=(242, 194, 48), outline=(120, 80, 10))
        d.ellipse((19, 15, 22, 18), fill=(0, 0, 0))
        d.ellipse((26, 15, 29, 18), fill=(0, 0, 0))
        d.rectangle((16, 30, 20, 40), fill=(43, 74, 168))
        d.rectangle((25, 30, 29, 40), fill=(43, 74, 168))
        out.append(im.rotate(180, center=(20, 21)) if k == 2 else im)
    return out


def stand_in_ball():
    out = []
    for w in (9, 7, 4, 7):
        im = Image.new("RGBA", (12, 10), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.ellipse((6 - w // 2 - 1, 3, 6 + w // 2, 7), fill=BALL, outline=(70, 40, 20))
        if w > 5:
            d.line((5, 5, 7, 5), fill=(255, 255, 255))
        out.append(im)
    tee = Image.new("RGBA", (12, 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(tee)
    d.ellipse((4, 0, 8, 7), fill=BALL, outline=(70, 40, 20))
    d.polygon([(3, 9), (9, 9), (7, 7), (5, 7)], fill=(255, 120, 20))
    out.append(tee)
    return out


def stand_in_coach():
    out = []
    for shout in (0, 1):
        im = Image.new("RGBA", (46, 46), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rectangle((6, 30, 40, 46), fill=(242, 194, 48))
        d.ellipse((12, 8, 34, 34), fill=SKIN)
        d.rectangle((10, 4, 36, 13), fill=(30, 45, 100))
        d.rectangle((8, 11, 40, 14), fill=(30, 45, 100))
        d.ellipse((17, 18, 20, 21), fill=(0, 0, 0))
        d.ellipse((26, 18, 29, 21), fill=(0, 0, 0))
        if shout:
            d.ellipse((18, 24, 28, 32), fill=(90, 20, 20))
        else:
            d.line((19, 28, 27, 28), fill=(90, 40, 30))
        out.append(im)
    return out


def stand_in_picture(key, size):
    w, h = size
    im = Image.new("RGB", size, (12, 18, 40))
    d = ImageDraw.Draw(im)
    if key == "chalkboard":
        im.paste((92, 64, 38), (0, 0, w, h))
        d.rectangle((6, 6, w - 7, h - 7), fill=(38, 72, 52))
    elif key == "scoreboard":
        im.paste((18, 22, 40), (0, 0, w, h))
        d.rectangle((0, h - 2, w, h), fill=(242, 194, 48))
    else:
        for i in range(0, w, 48):                          # floodlights
            d.ellipse((i + 10, 8, i + 30, 20), fill=(255, 250, 210))
        d.rectangle((0, h * 2 // 3, w, h), fill=(40, 120, 50))
        for x in range(0, w, 6):                           # the crowd
            d.point((x, h // 2 + (x * 7) % 11), fill=(240, 200, 60) if x % 4 else (60, 80, 180))
        if key == "lose":
            d.rectangle((0, 0, w, h), outline=(80, 80, 80))
    return im


def stand_in_stands():
    w, h = STANDS_SIZE
    im = Image.new("RGB", (w, h), (10, 14, 32))
    d = ImageDraw.Draw(im)
    for row in range(5):
        y = 18 + row * 8
        d.rectangle((0, y + 5, w, y + 7), fill=(60, 60, 70))
        for x in range(2 + (row % 2) * 3, w, 6):
            c = [(43, 74, 168), (242, 194, 48), (220, 220, 220)][(x * 3 + row) % 3]
            d.ellipse((x, y, x + 3, y + 4), fill=c)
    for x in (30, 130):                                   # light towers
        d.rectangle((x, 0, x + 2, 16), fill=(70, 70, 80))
        d.rectangle((x - 6, 0, x + 8, 4), fill=(255, 250, 210))
    d.rectangle((0, h - 6, w, h), fill=(24, 34, 70))      # the wall along the sideline
    return im


# ---------------------------------------------------------------- the field, always drawn here

def draw_text(im, x, y, text, color, scale=2):
    glyphs = font.frames(color, Image, scale)
    for i, ch in enumerate(text):
        g = glyphs[font.CHARS.index(ch)]
        im.alpha_composite(g, (x + i * font.CELL_W * scale, y))


def field():
    im = Image.new("RGBA", (ROOM_W, ROOM_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((0, TOP - 8, ROOM_W, ROOM_H), fill=(22, 72, 34))                  # the grass beyond the lines
    for i, x in enumerate(range(GOAL_L, GOAL_R, 5 * YD)):                          # mowed stripes, 5 yards each
        d.rectangle((x, TOP, x + 5 * YD - 1, BOT), fill=(46, 128, 56) if i % 2 else (52, 140, 62))
    for x0, team in ((END_L, "home"), (GOAL_R, "away")):                           # the end zones, striped
        col = rgb(RULES["TEAMS"][team]["color"])
        ez = Image.new("RGBA", (10 * YD, BOT - TOP + 1), col + (255,))
        e = ImageDraw.Draw(ez)
        for k in range(-ez.height, ez.width, 14):
            e.line((k, ez.height, k + ez.height, 0), fill=tuple(min(255, v + 18) for v in col), width=4)
        im.paste(ez, (x0, TOP))
    white = (245, 245, 240)
    d.rectangle((END_L, TOP, END_R, TOP + 1), fill=white)                         # sidelines
    d.rectangle((END_L, BOT - 1, END_R, BOT), fill=white)
    for x in (END_L, END_R - 1, GOAL_L - 1, GOAL_R):
        d.rectangle((x, TOP, x + 1, BOT), fill=white)
    for yd in range(5, 100, 5):
        x = GOAL_L + yd * YD
        d.rectangle((x - (yd % 10 == 0), TOP, x, BOT), fill=white)
    for yd in range(1, 100):                                                        # hash marks, every yard
        x = GOAL_L + yd * YD
        for y in (TOP + 3, MID - HASH, MID + HASH - 3, BOT - 6):
            d.line((x, y, x, y + 3), fill=white)
    for yd in range(10, 100, 10):                                                   # the numbers
        n = str(min(yd, 100 - yd))
        x = GOAL_L + yd * YD - len(n) * font.CELL_W
        draw_text(im, x, TOP + 12, n, white)
        draw_text(im, x, BOT - 34, n, white)
    for x0, team in ((END_L, "home"), (GOAL_R, "away")):
        t = RULES["TEAMS"][team]
        name = t["name"]
        draw_text(im, x0 + (10 * YD - len(name) * font.CELL_W * 2) // 2, MID - 10, name, rgb(t["trim"]))
    cx = GOAL_L + 50 * YD                                                           # the Comets' badge at midfield
    d.ellipse((cx - 16, MID - 12, cx + 16, MID + 12), fill=(43, 74, 168), outline=(242, 194, 48), width=2)
    d.polygon([(cx - 26, MID - 6), (cx - 6, MID - 4), (cx - 6, MID + 4), (cx - 26, MID + 8)], fill=(242, 160, 40))
    d.ellipse((cx - 8, MID - 7, cx + 8, MID + 7), fill=(242, 194, 48))
    gold = (250, 210, 40)
    for x in (END_L, END_R):                                                        # the goalposts
        d.line((x, MID, x, MID - 26), fill=gold, width=2)
        d.line((x, MID - 26 - 22, x, MID - 26 + 22), fill=gold, width=2)
        d.line((x, MID - 48, x, MID - 80), fill=gold, width=2)
        d.line((x, MID - 4, x, MID - 36), fill=gold, width=2)
    d.rectangle((0, BOT + 6, ROOM_W, ROOM_H), fill=(30, 34, 46))                  # the track
    return im


# ---------------------------------------------------------------- Gemini's pictures, made pixels

def figures(im, expect):
    """The figures on a sheet, left to right, each one connected shape.
    Mystery Meat's cutter splits a sheet at its empty columns, but a pose
    sheet's figures overlap side to side (a dive reaches over the player
    lying down), so here each figure is found as a shape of its own. Shapes
    much smaller than the biggest — the faint ghost helmets and stray balls
    Gemini leaves floating — are dropped."""
    import numpy as np
    from scipy import ndimage
    rgba = np.array(im.convert("RGBA"))
    r, g, b = (rgba[..., i].astype(int) for i in range(3))
    solid = ~((r > 150) & (b > 150) & (g < 110) & (abs(r - b) < 90))
    joined = ndimage.binary_closing(solid, iterations=2)     # a hand a pixel off its arm is still his
    labels, n = ndimage.label(joined)
    if n == 0:
        return []
    sizes = ndimage.sum(solid, labels, range(1, n + 1))
    keep = [i + 1 for i, a in enumerate(sizes) if a >= sizes.max() * 0.25]
    out = []
    for i in keep:
        ys, xs = np.nonzero(labels == i)
        y1, y2, x1, x2 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        part = rgba[y1:y2, x1:x2].copy()
        part[..., 3] = np.where((labels[y1:y2, x1:x2] == i) & solid[y1:y2, x1:x2], 255, 0)
        out.append(((x1 + x2) / 2, Image.fromarray(part)))
    out.sort(key=lambda p: p[0])
    if len(out) != expect:
        print(f"    (found {len(out)} figures, expected {expect})")
    return [f for _, f in out]


def cut(A, name, height, expect, each=False, ref=None):
    """A sheet of figures on magenta, as pixels. ref: the frame made `height`
    tall (the rest in proportion) — a standing pose, so a pose sheet's arms
    up don't shrink everyone to fit."""
    f = _mm.find(A, name)
    if not f:
        return None
    found = figures(Image.open(f), expect)
    count = len(found)
    pick = PICK.get(name, {}).get(len(found))
    if pick:
        found = [found[i] for i in pick]
    if ref is not None and len(found) > ref and not each:
        height = height * max(x.height for x in found) / found[ref].height
    frames = _Frames(_mm.to_pixels(found, round(height), each=each))
    frames.found = count
    if len(frames) < expect:                 # fewer figures than asked for: the last one stands in for the rest
        print(f"  {name}: {len(frames)} figures for {expect}")
        frames += [frames[-1]] * (expect - len(frames))
    out = _Frames(frames[:expect])
    out.found = count
    return out


class _Frames(list):
    """Cut frames, remembering how many figures the sheet really had."""
    found = 0


def fixed_canvas(frames, size):
    """Frames on one canvas of a set size, feet at the bottom middle (so a team's three sprites agree)."""
    out = []
    for f in frames:
        f = ImageOps.contain(f, (size[0], size[1] - 1), Image.NEAREST) if f.width > size[0] or f.height >= size[1] else f
        c = Image.new("RGBA", size, (0, 0, 0, 0))
        c.paste(f, ((size[0] - f.width) // 2, size[1] - 1 - f.height), f)
        out.append(c)
    return out


def build(assets_dir, out):
    A = Path(assets_dir).expanduser()
    P = _mm.Adventure("Under the Lights")
    P.p["settings"]["pixelScaling"] = True
    made = []
    feet = (CANVAS[0] // 2, CANVAS[1] - 1)

    home_poses = None
    for team in ("home", "away"):
        run, carry, poses = stand_in_players(team)
        for key, stand in ((f"p-{team}-run", run), (f"p-{team}-ball", carry), (f"p-{team}-poses", poses)):
            real = cut(A, key, HEIGHTS["player"], len(stand), each=key.endswith(("-run", "-ball")),
                       ref=1 if key.endswith("-poses") else None)
            if key == "p-home-poses":
                home_poses = real
            fill = REPAINT.get(key, {}).get(getattr(real, "found", None))
            if real and fill and home_poses:
                for i in fill:
                    real[i] = badgers(home_poses[i])
            made.append(key if real else None)
            frames = fixed_canvas(real, CANVAS) if real else stand
            P.sprite(f"{team}_{key.split('-')[2]}", frames, feet)

    ref = cut(A, "p-referee", HEIGHTS["referee"], 5)
    made.append("p-referee" if ref else None)
    P.sprite("referee", fixed_canvas(ref, (36, 38)) if ref else stand_in_referee(), (18, 37) if ref else feet)
    mas = cut(A, "p-mascot", HEIGHTS["mascot"], 3)
    made.append("p-mascot" if mas else None)
    P.sprite("mascot", fixed_canvas(mas, (44, 44)) if mas else stand_in_mascot(), (22, 43) if mas else (20, 41))

    f = _mm.find(A, "ball")
    if f:
        balls = [ImageOps.contain(b, (12, 10), Image.BOX) for b in _mm.cut_frames(Image.open(f), 5)]
        balls = _mm.to_pixels(balls, 10)[:5]
        balls += [balls[-1]] * (5 - len(balls))
        made.append("ball")
        balls = fixed_canvas(balls, (12, 10))
    else:
        balls = stand_in_ball()
    P.sprite("ball", balls, (6, 7))

    f = _mm.find(A, "coach")
    if f:
        faces = [ImageOps.contain(c, (46, 46), Image.BOX) for c in _mm.cut_frames(Image.open(f), 2)][:2]
        faces = fixed_canvas(_mm.to_pixels(faces, max(c.height for c in faces)), (46, 46))
        faces += [faces[-1]] * (2 - len(faces))
        made.append("coach")
    else:
        faces = stand_in_coach()
    P.sprite("coach", faces, (0, 0))

    for key, size in PICTURES.items():
        f = _mm.find(A, key)
        made.append(key if f else None)
        im = _mm.pixelate(Image.open(f), size) if f else stand_in_picture(key, size)
        P.sprite(key, [im.convert("RGBA")], (0, 0))
    f = _mm.find(A, "stands")
    made.append("stands" if f else None)
    if f:
        im = Image.open(f)
        stands = _mm.pixelate(im.crop((0, 0, int(im.width * STANDS_CROP), im.height)), STANDS_SIZE)
    else:
        stands = stand_in_stands()
    P.sprite("stands", [stands.convert("RGBA")], (0, 0))
    P.sprite("field", [field()], (0, 0))

    P.sprite("font", font.frames((255, 255, 255), Image, 1, shadow=(10, 10, 20)), (0, 0))
    P.sprite("font2", font.frames((255, 255, 255), Image, 2, shadow=(10, 10, 20)), (0, 0))
    P.script("font", "# Made by build.py from Thornwood's font.py: which frame of the font sprites is which character.\n"
             f"FONT_CHARS = {json.dumps(font.CHARS, ensure_ascii=False)}\n"
             "FONT_INDEX = {c: i for i, c in enumerate(FONT_CHARS)}\n")

    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    P.sound("click", tone(0.03, 1200, 900, "square", 0.12))
    P.sound("hike", mix(tone(0.14, 170, 110, "square", 0.25), lowpass(tone(0.12, 0, 0, "noise", 0.4, seed=41), 0.3, 0.1)))
    P.sound("whistle", join(*[tone(0.05, 2900, 2750, "sine", 0.22) for _ in range(5)], tone(0.3, 2900, 2800, "sine", 0.22)))
    P.sound("kick", mix(lowpass(tone(0.15, 0, 0, "noise", 0.7, seed=42), 0.25, 0.05), tone(0.12, 140, 60, "sine", 0.5)))
    P.sound("throw", lowpass(tone(0.16, 0, 0, "noise", 0.35, seed=43), 0.05, 0.5))
    P.sound("catch", tone(0.06, 660, 520, "square", 0.15))
    P.sound("tackle", mix(lowpass(tone(0.25, 0, 0, "noise", 0.8, seed=44), 0.15, 0.03), tone(0.2, 90, 45, "sine", 0.5)))
    P.sound("spin", tone(0.2, 300, 900, "tri", 0.2))
    P.sound("dive", lowpass(tone(0.15, 0, 0, "noise", 0.4, seed=45), 0.4, 0.1))
    P.sound("cheer", mix(lowpass(tone(1.8, 0, 0, "noise", 0.6, seed=46), 0.35, 0.2),
                         lowpass(tone(1.8, 0, 0, "noise", 0.4, seed=47), 0.08, 0.05)))
    # A fight song for the band in the stands: brassy, on the beat.
    mel = [67, 0, 72, 72, 72, 0, 74, 76, 77, 0, 76, 74, 72, 0, 0, 0,
           69, 0, 74, 74, 74, 0, 76, 77, 79, 0, 77, 76, 74, 0, 0, 0,
           67, 0, 72, 72, 72, 0, 74, 76, 77, 0, 79, 81, 79, 77, 76, 74,
           72, 0, 76, 0, 79, 0, 76, 0, 72, 0, 0, 0, 0, 0, 0, 0]
    bass = [48, 55, 48, 55, 53, 60, 53, 60, 50, 57, 50, 57, 55, 62, 55, 62]
    P.sound("fight", _tw.music_loop(mel, bass, 150), volume=0.5)

    for f in sorted((HERE / "game").glob("_*.py")):
        head, _ = _tw.read_code(f)
        P.script(head.get("script", f.stem.strip("_")), f.read_text())
    files = sorted(f for f in (HERE / "game").glob("*.py") if not f.name.startswith("_"))
    parsed = {f.stem: _tw.read_code(f) for f in files}
    for name, (head, _) in parsed.items():
        P.obj(name, depth=int(head.get("depth", 0)))
    for name, (head, events) in parsed.items():
        o = next(x for x in P.p["objects"] if x["name"] == name)
        if head.get("sprite"):
            o["sprite"] = P.sprite_id(head["sprite"])
        for ev, code in events:
            o["events"].append({"id": _tw.new_id(), "key": _tw.event_key(ev, P), "mode": "python", "code": code})

    lid = _tw.new_id()
    P.p["rooms"].append({
        "id": _tw.new_id(), "name": "Stadium", "width": ROOM_W, "height": ROOM_H, "background": "#0a1024",
        "gridWidth": YD, "gridHeight": YD, "snap": True,
        "layers": [
            {"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False},
            {"id": _tw.new_id(), "name": "Field", "kind": "background", "depth": 1000, "visible": True, "locked": False,
             "color": None, "sprite": P.sprite_id("field"), "mode": "once", "hspeed": 0, "vspeed": 0, "parallax": 0},
            {"id": _tw.new_id(), "name": "Stands", "kind": "background", "depth": 1001, "visible": True, "locked": False,
             "color": None, "sprite": P.sprite_id("stands"), "mode": "tile_x", "hspeed": 0, "vspeed": 0,
             "parallax": 0.3, "parallaxY": 0},
        ],
        # The room's camera follows the Ball (camera_follow in the Game's Create
        # would be undone: the room sets its camera up after Create runs).
        "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": P.obj_id("Ball"), "smoothing": 0.12},
        "instances": [{"id": _tw.new_id(), "object": P.obj_id("Game"), "layer": lid, "x": 0, "y": 0,
                       "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""}],
    })

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    real = [m for m in made if m]
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(real)} of {len(made)} pictures the teacher's, the rest stand-ins")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--assets", default="~/Downloads/football")
    ap.add_argument("--out", default=str(HERE / "out" / "Football.zip"))
    a = ap.parse_args()
    build(a.assets, Path(a.out))
