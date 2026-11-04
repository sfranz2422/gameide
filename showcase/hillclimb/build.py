#!/usr/bin/env python3
"""
Builds the sixth showcase game, "Ridgeline Rally", as a GameIDE project zip:
a side-view hill-climb driving game. Drive as far as you can up a long
bumpy road before the fuel runs out, without landing on your head; spend
the coins in the garage on upgrades, a truck and new stages.

    python3 showcase/hillclimb/build.py      # → showcase/hillclimb/out/HillClimb.zip

ALL ITS ART IS MADE HERE, with Pillow: the jeep, the truck, the driver,
the coins and cans, and each stage's sky and hills. The road is not a
picture at all: the game draws it every frame from game/_1stages.py, so
changing a hill there changes the road. If the teacher makes pictures with
Gemini from PROMPTS.md and saves them in ~/Downloads/hillclimb/ under the
names it gives, the build uses those instead (see `picture` below); any
picture not there is drawn here.

The cars are drawn from the same numbers the physics uses (game/_2car.py):
the wheels where the springs hold them, the driver's head where the game
checks it against the road. So moving the head in VEHICLES moves it in the
picture too.

The stages are checked before anything is built (check_stages): a road that
leaves the room, a stage longer than the room, or a hill too steep for the
jeep with no upgrades to climb, and the build refuses.

The game is game/*.py: _1stages.py (the roads), _2car.py (the physics),
_3run.py (a run), _4garage.py (what's saved, and buying), _5screen.py
(drawing), _6flow.py (camera, engine sound), and one object, Game.
"""
import importlib.util
import json
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


HERE = Path(__file__).resolve().parent
_tw = _load("thornwood_build", HERE.parent / "build.py")
GEMINI = Path("~/Downloads/hillclimb").expanduser()

GAME = {}
exec((HERE / "game" / "_1stages.py").read_text(), GAME)
exec((HERE / "game" / "_2car.py").read_text(), GAME)
STAGES, VEHICLES = GAME["STAGES"], GAME["VEHICLES"]
ROOM_W, ROOM_H = 60000, 6000     # the room: big enough for every stage (check_stages makes sure)
VIEW_W, VIEW_H = 640, 360
S = 4                            # pictures are painted 4 times bigger, then shrunk: smooth edges


class HillClimb(_tw.Project):
    def write(self, path):
        import zipfile
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n"
                       "All pictures and sounds were made for this game by its build script.\n")


# ---------------------------------------------------------------- the stages checked

def check_stages():
    """Every stage must fit the room and be drivable by the jeep with no upgrades."""
    problems = []
    jeep = VEHICLES["Jeep"]
    names = [s["name"] for s in STAGES]
    if len(set(names)) != len(names):
        problems.append("two stages have the same name")
    for s in STAGES:
        where = s["name"]
        try:
            road = GAME["build_ground"](s)
        except ValueError as e:
            problems.append(f"{where}: {e}")
            continue
        hs = road["heights"]
        if len(hs) * GAME["STEP"] > ROOM_W - VIEW_W:
            problems.append(f"{where}: {len(hs) * GAME['STEP'] // GAME['METRE']} m long, but the room fits {(ROOM_W - VIEW_W) // GAME['METRE']} m")
        if min(hs) < 400 or max(hs) > ROOM_H - 400:
            problems.append(f"{where}: the road goes {'above' if min(hs) < 400 else 'below'} the room")
        if s["gravity"] <= 0:
            problems.append(f"{where}: gravity must pull down (more than 0)")
        # The steepest climb, measured over 8 metres (a single rock is jumped, not climbed).
        # The jeep's engine can hold it on a slope while sin(slope) < power / gravity.
        most = jeep["power"] / s["gravity"]
        if most < 1:
            span = 4
            for i in range(len(hs) - span):
                rise = hs[i] - hs[i + span]                 # y grows downwards: rising road has falling y
                slope = math.atan2(rise, span * GAME["STEP"])
                if math.sin(slope) > most:
                    problems.append(f"{where}: a hill at {(i * GAME['STEP'] - GAME['START_X']) // GAME['METRE']} m is "
                                    f"{math.degrees(slope):.0f} degrees: too steep for the jeep (at most {math.degrees(math.asin(most)):.0f})")
                    break
    if problems:
        raise SystemExit("The stages:\n  " + "\n  ".join(problems))


# ---------------------------------------------------------------- painting helpers

def canvas(w, h):
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def shrink(im):
    return im.resize((im.width // S, im.height // S), Image.LANCZOS)


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mixc(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(w, h, top, bottom):
    im = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        d.line((0, y, w, y), fill=mixc(top, bottom, y / max(1, h - 1)) + (255,))
    return im


def picture(name, made):
    """The teacher's Gemini picture for `name` if it's in ~/Downloads/hillclimb/, made the
    size of ours (flat magenta cut away); otherwise ours."""
    for ext in ("png", "jpg", "jpeg", "webp"):
        f = GEMINI / f"{name}.{ext}"
        if f.exists():
            im = Image.open(f).convert("RGBA").resize(made.size, Image.LANCZOS)
            px = im.load()
            for y in range(im.height):
                for x in range(im.width):
                    r, g, b, a = px[x, y]
                    if r > 200 and b > 200 and g < 90:
                        px[x, y] = (0, 0, 0, 0)
            return im
    return made


OUTLINE = (40, 30, 40, 255)


# ---------------------------------------------------------------- the cars, from VEHICLES

def wheel_picture(r, hub):
    im, d = canvas(2 * r + 2, 2 * r + 2)
    c = (r + 1) * S
    R = r * S
    d.ellipse((c - R, c - R, c + R, c + R), fill=(38, 38, 46, 255))
    for k in range(12):                                        # the tread
        a = k * math.pi / 6
        x, y = c + math.cos(a) * (R - S), c + math.sin(a) * (R - S)
        d.ellipse((x - 1.6 * S, y - 1.6 * S, x + 1.6 * S, y + 1.6 * S), fill=(22, 22, 28, 255))
    ri = R * 0.55
    d.ellipse((c - ri, c - ri, c + ri, c + ri), fill=hub + (255,), outline=(60, 60, 70, 255), width=S)
    for k in range(5):                                         # spokes, so it's seen to turn
        a = k * 2 * math.pi / 5
        d.line((c, c, c + math.cos(a) * ri * 0.9, c + math.sin(a) * ri * 0.9), fill=(90, 90, 100, 255), width=int(1.5 * S))
    d.ellipse((c - ri * 0.3, c - ri * 0.3, c + ri * 0.3, c + ri * 0.3), fill=(230, 230, 236, 255))
    return shrink(im)


def driver(d, ox, oy, head, shirt, cap):
    """The driver: a body in the seat, an arm to the wheel, and the head where the game checks it."""
    hx, hy, hr = head
    P = lambda x, y: (ox + x * S, oy + y * S)
    # body
    bx, by = P(hx - 6, hy + hr - 1)
    ex, ey = P(hx + 5, hy + hr + 12)
    d.rounded_rectangle((bx, by, ex, ey), radius=3 * S, fill=shirt + (255,), outline=OUTLINE, width=S)
    # arm reaching forward to the steering wheel
    d.line((*P(hx + 2, hy + hr + 3), *P(hx + 13, hy + hr + 5)), fill=shirt + (255,), width=4 * S)
    d.ellipse((*P(hx + 12, hy + hr + 3), *P(hx + 16, hy + hr + 7)), fill=(250, 205, 160, 255))
    d.line((*P(hx + 15, hy + hr - 1), *P(hx + 15, hy + hr + 9)), fill=(50, 50, 60, 255), width=2 * S)   # the wheel
    # head
    x1, y1 = P(hx - hr, hy - hr)
    x2, y2 = P(hx + hr, hy + hr)
    d.ellipse((x1, y1, x2, y2), fill=(250, 205, 160, 255), outline=OUTLINE, width=S)
    # cap, with its peak forward
    d.chord((x1 - S, y1 - S, x2 + S, y2 - hr * S * 0.2), 180, 360, fill=cap + (255,), outline=OUTLINE, width=S)
    d.polygon([P(hx + hr - 2, hy - 2), P(hx + hr + 5, hy - 1), P(hx + hr - 1, hy + 1)], fill=cap + (255,))
    # a big eye and a grin
    d.ellipse((*P(hx + 1, hy - 3), *P(hx + 6, hy + 2)), fill=(255, 255, 255, 255), outline=OUTLINE, width=S // 2)
    d.ellipse((*P(hx + 3.2, hy - 1.6), *P(hx + 5.6, hy + 0.8)), fill=(20, 20, 30, 255))
    d.arc((*P(hx - 1, hy + 1), *P(hx + 7, hy + 6)), 20, 160, fill=OUTLINE, width=S)
    d.ellipse((*P(hx - 5, hy + 1), *P(hx - 2, hy + 4)), fill=(255, 150, 150, 200))     # a rosy cheek


def car_body(kind):
    """The body, around its middle (the sprite's origin): its box, the arches over its
    wheels, and the driver whose head is where VEHICLES says."""
    v = VEHICLES[kind]
    x1, y1, x2, y2 = v["body"]
    hx, hy, hr = v["head"]
    r = v["wheel_r"]
    left, top = min(x1, hx - hr) - 8, min(y1, hy - hr) - 6
    right, bottom = x2 + 6, y2 + 6
    w, h = right - left, bottom - top
    im, d = canvas(w, h)
    ox, oy = -left * S, -top * S
    P = lambda x, y: (ox + x * S, oy + y * S)
    if kind == "Jeep":
        paint, dark, shirt, cap = (230, 60, 50), (170, 35, 35), (60, 120, 220), (250, 200, 40)
    else:
        paint, dark, shirt, cap = (60, 170, 90), (30, 110, 60), (240, 140, 40), (40, 90, 200)
    # The roll bar behind the driver.
    d.line((*P(hx - hr - 3, y1), *P(hx - hr - 1, hy - hr + 2), *P(hx + 2, hy - hr - 1)), fill=(120, 120, 130, 255), width=3 * S, joint="curve")
    driver(d, ox, oy, v["head"], shirt, cap)
    # The body: a low tub at the back, a bonnet sloping down to the front.
    body = [P(x1, y1 - 2), P(hx - hr - 6, y1 - 2), P(hx - hr - 4, y1 + 1), P(x2 * 0.25, y1 + 1),
            P(x2 * 0.35, y1 - 1), P(x2 - 6, y1 + 1), P(x2, y1 + 5), P(x2 + 1, y2 - 2), P(x2 - 2, y2), P(x1 + 2, y2), P(x1, y2 - 3)]
    d.polygon(body, fill=paint + (255,), outline=OUTLINE, width=S)
    d.line((*P(x1 + 2, y2 - 4), *P(x2 - 2, y2 - 4)), fill=dark + (255,), width=3 * S)       # a stripe of shade
    # The arches: cut round each wheel, so the wheel sits in it.
    for mx, my in v["wheels"]:
        R = (r + 3) * S
        cx, cy = P(mx, my)
        d.pieslice((cx - R, cy - R, cx + R, cy + R), 180, 360, fill=(40, 30, 40, 255))
        R2 = (r + 1.5) * S
        d.pieslice((cx - R2, cy - R2, cx + R2, cy + R2), 180, 360, fill=(0, 0, 0, 0))
    # The windscreen, a headlight, a tail light, the door.
    d.line((*P(x2 * 0.3, y1), *P(x2 * 0.3 - 4, y1 - 13)), fill=(170, 220, 255, 255), width=2 * S)
    d.line((*P(x2 * 0.3 - 4, y1 - 13), *P(x2 * 0.3 + 1, y1 - 13)), fill=(120, 120, 130, 255), width=2 * S)
    d.ellipse((*P(x2 - 4, y1 + 4), *P(x2 + 1, y1 + 9)), fill=(255, 240, 150, 255), outline=OUTLINE, width=S // 2)
    d.rectangle((*P(x1, y1 + 1), *P(x1 + 3, y1 + 5)), fill=(255, 70, 60, 255))
    d.line((*P(hx - 4, y1 + 3), *P(hx - 4, y2 - 5)), fill=dark + (255,), width=S)
    if kind == "Truck":                                         # the truck's number plate panel and exhaust
        d.line((*P(x1 + 6, y1 - 2), *P(x1 + 6, y1 - 12)), fill=(110, 110, 120, 255), width=2 * S)
        d.ellipse((*P(x1 + 4, y1 - 16), *P(x1 + 9, y1 - 11)), fill=(90, 90, 100, 255))
    return shrink(im), (-left, -top)


# ---------------------------------------------------------------- things on the road

def coin_frames():
    frames = []
    for k in range(6):
        im, d = canvas(20, 20)
        squash = abs(math.cos(k * math.pi / 6))
        c, R = 10 * S, 9 * S
        rx = max(1.5 * S, R * squash)
        d.ellipse((c - rx, c - R, c + rx, c + R), fill=(200, 140, 20, 255))
        d.ellipse((c - rx * 0.85, c - R * 0.85, c + rx * 0.85, c + R * 0.85), fill=(255, 210, 60, 255))
        if squash > 0.4:
            pts = []
            for j in range(10):
                a = -math.pi / 2 + j * math.pi / 5
                rr = (R * 0.5 if j % 2 == 0 else R * 0.22)
                pts.append((c + math.cos(a) * rr * squash, c + math.sin(a) * rr))
            d.polygon(pts, fill=(255, 240, 150, 255))
        d.ellipse((c - rx * 0.5, c - R * 0.75, c - rx * 0.2, c - R * 0.45), fill=(255, 255, 230, 200))
        frames.append(shrink(im))
    return frames


def fuel_can(w=22, h=26):
    im, d = canvas(w, h)
    P = lambda x, y: (x * S, y * S)
    d.rounded_rectangle((*P(2, 5), *P(w - 2, h - 1)), radius=3 * S, fill=(220, 40, 40, 255), outline=OUTLINE, width=S)
    d.rectangle((*P(4, 1), *P(9, 6)), fill=(60, 60, 70, 255), outline=OUTLINE, width=S // 2)        # the spout
    d.rounded_rectangle((*P(11, 1), *P(w - 4, 5)), radius=S, outline=(60, 60, 70, 255), width=int(1.5 * S))  # the handle
    d.line((*P(5, 9), *P(w - 5, h - 4)), fill=(255, 120, 110, 255), width=int(1.5 * S))
    d.line((*P(w - 5, 9), *P(5, h - 4)), fill=(255, 120, 110, 255), width=int(1.5 * S))
    return shrink(im)


def sign_post():
    im, d = canvas(56, 66)
    P = lambda x, y: (x * S, y * S)
    d.rectangle((*P(26, 20), *P(30, 66)), fill=(110, 70, 40, 255), outline=OUTLINE, width=S // 2)
    d.rounded_rectangle((*P(2, 6), *P(54, 26)), radius=2 * S, fill=(245, 225, 170, 255), outline=(110, 70, 40, 255), width=2 * S)
    return shrink(im)


def finish_arch():
    im, d = canvas(150, 130)
    P = lambda x, y: (x * S, y * S)
    for x in (6, 138):
        d.rectangle((*P(x, 20), *P(x + 6, 130)), fill=(230, 230, 236, 255), outline=OUTLINE, width=S // 2)
    d.rectangle((*P(4, 4), *P(146, 30)), fill=(255, 255, 255, 255), outline=OUTLINE, width=S)
    for i in range(28):
        for j in range(2):
            if (i + j) % 2:
                d.rectangle((*P(5 + i * 5, 5 + j * 12.5), *P(10 + i * 5, 17.5 + j * 12.5)), fill=(30, 30, 40, 255))
    return shrink(im)


def flag(colour, w=30, h=60):
    im, d = canvas(w, h)
    P = lambda x, y: (x * S, y * S)
    d.rectangle((*P(1, 2), *P(3, h)), fill=(80, 80, 90, 255))
    d.polygon([P(3, 3), P(w - 1, 9), P(3, 17)], fill=colour + (255,), outline=OUTLINE)
    return shrink(im)


def flag_icon():
    im, d = canvas(14, 16)
    P = lambda x, y: (x * S, y * S)
    d.rectangle((*P(1, 1), *P(2, 16)), fill=(240, 240, 240, 255))
    for i in range(3):
        for j in range(2):
            d.rectangle((*P(2 + i * 4, 1 + j * 4), *P(6 + i * 4, 5 + j * 4)), fill=(30, 30, 30, 255) if (i + j) % 2 else (255, 255, 255, 255))
    return shrink(im)


def star():
    im, d = canvas(12, 12)
    pts = [(6 * S + math.cos(-math.pi / 2 + j * math.pi / 5) * (5.5 if j % 2 == 0 else 2.3) * S,
            6 * S + math.sin(-math.pi / 2 + j * math.pi / 5) * (5.5 if j % 2 == 0 else 2.3) * S) for j in range(10)]
    d.polygon(pts, fill=(255, 230, 80, 255), outline=OUTLINE)
    return shrink(im)


def decorations(n):
    """Four little things for the grass: what grows (or lies) on each stage."""
    frames = []
    rnd = random.Random(n)
    for k in range(4):
        im, d = canvas(24, 24)
        P = lambda x, y: (x * S, y * S)
        if n == 0:
            if k == 0:                                               # a tuft
                for j in range(5):
                    d.line((*P(12, 23), *P(6 + j * 3, 12 + abs(j - 2) * 2)), fill=(60, 150, 50, 255), width=int(1.5 * S))
            elif k == 1:                                             # a flower
                d.line((*P(12, 23), *P(12, 12)), fill=(60, 140, 50, 255), width=S)
                for j in range(5):
                    a = j * 2 * math.pi / 5
                    d.ellipse((*P(12 + math.cos(a) * 3 - 2, 10 + math.sin(a) * 3 - 2), *P(12 + math.cos(a) * 3 + 2, 10 + math.sin(a) * 3 + 2)), fill=(255, 255, 255, 255))
                d.ellipse((*P(10.5, 8.5), *P(13.5, 11.5)), fill=(255, 210, 60, 255))
            elif k == 2:                                             # a rock
                d.ellipse((*P(4, 15), *P(20, 25)), fill=(150, 150, 160, 255), outline=OUTLINE, width=S // 2)
                d.ellipse((*P(7, 16), *P(12, 19)), fill=(200, 200, 210, 255))
            else:                                                    # a red flower
                d.line((*P(12, 23), *P(13, 13)), fill=(60, 140, 50, 255), width=S)
                d.ellipse((*P(9, 8), *P(16, 15)), fill=(240, 70, 80, 255))
        elif n == 1:
            if k == 0:                                               # a little cactus
                d.rounded_rectangle((*P(10, 6), *P(15, 24)), radius=2 * S, fill=(70, 150, 70, 255), outline=OUTLINE, width=S // 2)
                d.rounded_rectangle((*P(4, 11), *P(9, 18)), radius=2 * S, fill=(70, 150, 70, 255), outline=OUTLINE, width=S // 2)
                d.line((*P(8, 17), *P(11, 17)), fill=(70, 150, 70, 255), width=2 * S)
            elif k == 1:                                             # a sandstone
                d.polygon([P(3, 24), P(7, 15), P(17, 14), P(21, 24)], fill=(200, 140, 80, 255), outline=OUTLINE)
            elif k == 2:                                             # a dry bush
                for j in range(7):
                    a = math.pi + j * math.pi / 6
                    d.line((*P(12, 23), *P(12 + math.cos(a) * 9, 23 + math.sin(a) * 9)), fill=(150, 110, 60, 255), width=S)
            else:                                                    # a bone
                d.line((*P(5, 21), *P(19, 19)), fill=(245, 240, 225, 255), width=2 * S)
                for x, y in ((5, 21), (19, 19)):
                    d.ellipse((*P(x - 2, y - 2.5), *P(x + 2, y + 1)), fill=(245, 240, 225, 255))
        else:
            if k in (0, 2):                                          # a moon rock
                w = 8 if k == 0 else 6
                d.ellipse((*P(12 - w, 16), *P(12 + w, 25)), fill=(120, 124, 136, 255), outline=OUTLINE, width=S // 2)
                d.ellipse((*P(12 - w + 3, 17), *P(12 - w + 7, 20)), fill=(170, 174, 186, 255))
            elif k == 1:                                             # a crystal
                d.polygon([P(9, 24), P(11, 12), P(14, 8), P(16, 24)], fill=(120, 220, 255, 255), outline=OUTLINE)
                d.polygon([P(11, 12), P(14, 8), P(13, 18)], fill=(200, 245, 255, 255))
            else:                                                    # a little flag, left by someone
                d.line((*P(12, 24), *P(12, 8)), fill=(200, 200, 210, 255), width=S)
                d.rectangle((*P(12, 8), *P(20, 13)), fill=(240, 80, 80, 255))
        frames.append(shrink(im))
    return frames


# ---------------------------------------------------------------- skies and hills, per stage

def sky(n):
    w, h = VIEW_W, VIEW_H
    rnd = random.Random(10 + n)
    if n == 0:
        im = gradient(w, h, rgb("#5ab4f0"), rgb("#cdeeff"))
        d = ImageDraw.Draw(im)
        d.ellipse((470, 40, 530, 100), fill=(255, 245, 190))
        d.ellipse((480, 50, 520, 90), fill=(255, 250, 220))
        for _ in range(6):
            x, y = rnd.randrange(0, w), rnd.randrange(20, 140)
            for j in range(4):
                r = rnd.randrange(12, 22)
                d.ellipse((x + j * 16 - r, y - r * 0.7, x + j * 16 + r, y + r * 0.7), fill=(255, 255, 255))
    elif n == 1:
        im = gradient(w, h, rgb("#f59a4a"), rgb("#ffe7a8"))
        d = ImageDraw.Draw(im)
        d.ellipse((420, 70, 520, 170), fill=(255, 240, 160))
        d.ellipse((435, 85, 505, 155), fill=(255, 250, 200))
    else:
        im = gradient(w, h, rgb("#05060f"), rgb("#1c2140"))
        d = ImageDraw.Draw(im)
        for _ in range(140):
            x, y = rnd.randrange(w), rnd.randrange(h)
            b = rnd.randrange(140, 255)
            r = rnd.choice((0.6, 0.8, 1.2))
            d.ellipse((x - r, y - r, x + r, y + r), fill=(b, b, b))
        # The Earth, far away.
        d.ellipse((470, 40, 540, 110), fill=(60, 120, 220))
        for x, y, r in ((490, 60, 14), (515, 85, 12), (505, 55, 8)):
            d.ellipse((x - r, y - r * 0.7, x + r, y + r * 0.7), fill=(80, 170, 90))
        d.chord((470, 40, 540, 110), 300, 120, fill=(20, 30, 70))
    return im.filter(ImageFilter.GaussianBlur(0.4))


def ridge(w, h, base, waves, colour, rnd):
    """A line of hills across the picture, made of sine waves that repeat every `w` pixels."""
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    phases = [rnd.uniform(0, 6.283) for _ in waves]
    pts = []
    for x in range(0, w + 1, 4):
        y = base
        for (k, amp), ph in zip(waves, phases):
            y -= amp * math.sin(2 * math.pi * k * x / w + ph)
        pts.append((x, y))
    d.polygon(pts + [(w, h), (0, h)], fill=colour)
    return im, pts


def back_layer(n, layer):
    # As tall as the screen, filled to the bottom: the game draws them high
    # up, and the road may dip below their hills (a ravine, a valley).
    w, h = 1024, VIEW_H
    rnd = random.Random(n * 10 + (layer == "near"))
    if n == 0:
        if layer == "far":
            im, _ = ridge(w, h, 90, [(2, 30), (5, 12), (11, 4)], (120, 170, 200, 255), rnd)
            snow = ImageDraw.Draw(im)
        else:
            im, pts = ridge(w, h, 130, [(3, 18), (7, 8)], (90, 170, 80, 255), rnd)
            d = ImageDraw.Draw(im)
            for _ in range(26):                                     # round trees on the hills
                i = rnd.randrange(len(pts))
                x, y = pts[i]
                r = rnd.randrange(8, 15)
                d.rectangle((x - 1.5, y - 2, x + 1.5, y + 6), fill=(100, 70, 40))
                d.ellipse((x - r, y - r * 2, x + r, y), fill=(60, 140, 60))
                d.ellipse((x - r * 0.6, y - r * 1.8, x + r * 0.1, y - r), fill=(90, 170, 80))
    elif n == 1:
        if layer == "far":
            im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            d = ImageDraw.Draw(im)
            for _ in range(7):                                      # mesas
                x, top, wid = rnd.randrange(0, w), rnd.randrange(50, 100), rnd.randrange(60, 140)
                for dx in (0, -w, w):
                    d.polygon([(x + dx, h), (x + dx + 14, top), (x + dx + wid - 14, top), (x + dx + wid, h)], fill=(214, 140, 90, 255))
                    d.rectangle((x + dx + 14, top, x + dx + wid - 14, top + 6), fill=(230, 160, 110, 255))
            d.rectangle((0, 150, w, h), fill=(224, 160, 100, 255))     # the desert floor between them
        else:
            im, pts = ridge(w, h, 135, [(3, 16), (6, 7)], (235, 190, 110, 255), rnd)
            d = ImageDraw.Draw(im)
            for _ in range(12):                                     # cacti
                x, y = pts[rnd.randrange(len(pts))]
                t = rnd.randrange(18, 34)
                d.rounded_rectangle((x - 3, y - t, x + 3, y + 4), radius=3, fill=(70, 140, 70))
                d.rounded_rectangle((x - 10, y - t * 0.7, x - 5, y - t * 0.35), radius=2, fill=(70, 140, 70))
                d.line((x - 6, y - t * 0.4, x - 2, y - t * 0.4), fill=(70, 140, 70), width=3)
    else:
        if layer == "far":
            im, _ = ridge(w, h, 100, [(2, 35), (6, 10), (13, 4)], (70, 74, 96, 255), rnd)
        else:
            im, pts = ridge(w, h, 140, [(4, 12), (9, 5)], (110, 114, 132, 255), rnd)
            d = ImageDraw.Draw(im)
            for _ in range(14):                                     # craters
                x, y = pts[rnd.randrange(len(pts))]
                r = rnd.randrange(10, 26)
                d.ellipse((x - r, y + 8, x + r, y + 8 + r * 0.45), fill=(85, 88, 104))
                d.arc((x - r, y + 8, x + r, y + 8 + r * 0.45), 180, 360, fill=(150, 154, 170), width=2)
    return im


def garage_room():
    """The garage, around the menu: walls, a big open door at the back (the stage shows through), a floor."""
    w, h = VIEW_W, VIEW_H
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    wall, plank = (120, 84, 60, 255), (104, 72, 52, 255)
    d.rectangle((0, 0, w, 236), fill=wall)
    for y in range(0, 236, 18):
        d.line((0, y, w, y), fill=plank, width=2)
    d.rectangle((24, 40, 282, 236), fill=(0, 0, 0, 0))               # the open door
    d.rectangle((18, 34, 288, 40), fill=(80, 56, 40, 255))
    for y in range(44, 236, 22):                                    # the rolled-up door's slats at the top
        pass
    d.rectangle((24, 40, 282, 52), fill=(170, 170, 180, 255))
    d.line((24, 52, 282, 52), fill=(110, 110, 120, 255), width=2)
    d.rectangle((0, 236, w, h), fill=(120, 124, 132, 255))           # the floor
    for x in range(-200, w, 60):
        d.line((x, h, x + 120, 236), fill=(110, 114, 122, 255), width=2)
    d.rectangle((0, 236, w, 240), fill=(90, 92, 100, 255))
    # Tyres stacked by the door, and a tool board.
    for k in range(3):
        y = 228 - k * 16
        d.ellipse((2, y - 8, 22, y + 8), fill=(40, 40, 46, 255), outline=(20, 20, 26, 255), width=2)
    d.rectangle((290, 60, 296, 236), fill=(90, 62, 44, 255))
    title = ImageDraw.Draw(im)
    return im


# ---------------------------------------------------------------- sounds

def engine_loop(f, rough, seconds=0.5):
    """An engine's hum at `f` Hz, a whole number of turns long so it loops without a click."""
    turns = max(1, round(seconds * f))
    n = round(turns * _tw.RATE / f)
    rnd = random.Random(int(f))
    out = []
    for i in range(n):
        ph = (i * turns / n) % 1
        v = (1 if ph < 0.3 else -0.4) * 0.5                       # a pulse: a cylinder firing
        v += math.sin(2 * math.pi * 2 * turns * i / n) * 0.25
        v += (rnd.random() * 2 - 1) * rough
        out.append(v * 0.5)
    # Smoothed twice round the loop, so its end runs into its start.
    y = 0.0
    smooth = []
    for s in out + out:
        y += 0.25 * (s - y)
        smooth.append(y)
    return smooth[n:]


def make_sounds(P):
    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    for k, (f, rough) in enumerate(((38, 0.15), (55, 0.12), (78, 0.1), (110, 0.08))):
        P.sound(f"engine_{k}", engine_loop(f, rough))
    P.sound("coin", join(tone(0.05, 1320, 1320, "square", 0.18), tone(0.16, 1760, 1760, "square", 0.18)))
    P.sound("fuel", join(*[tone(0.06, 420 - k * 50, 360 - k * 50, "sine", 0.5) for k in range(4)], tone(0.12, 880, 990, "tri", 0.35)))
    P.sound("flip", join(*[tone(0.07, f, f, "square", 0.16) for f in (523, 659, 784, 1047)]))
    P.sound("air", lowpass(tone(0.5, 0, 0, "noise", 0.4, seed=7), 0.02, 0.2))
    P.sound("land", mix(tone(0.18, 120, 50, "sine", 0.7), lowpass(tone(0.12, 0, 0, "noise", 0.5, seed=8), 0.2, 0.05)))
    P.sound("crash", mix(lowpass(tone(0.8, 0, 0, "noise", 0.8, seed=9), 0.6, 0.03), tone(0.4, 160, 40, "square", 0.3),
                         join([0.0] * 3000, tone(0.12, 900, 300, "square", 0.15))))
    P.sound("fuel_out", join(*[join(tone(0.07, 90, 70, "square", 0.3), [0.0] * 1600) for _ in range(4)]))
    P.sound("finish", join(*[tone(0.12, f, f, "square", 0.18) for f in (523, 659, 784)], tone(0.4, 1047, 1047, "square", 0.2)))
    P.sound("best", join(*[tone(0.09, f, f, "tri", 0.4) for f in (784, 988, 1175, 1568)]))
    P.sound("click", tone(0.03, 900, 700, "square", 0.12))
    P.sound("buy", join(tone(0.06, 1200, 1200, "square", 0.15), tone(0.18, 1800, 1800, "tri", 0.3)))
    P.sound("go", tone(0.5, 60, 180, "square", 0.25))


# ---------------------------------------------------------------- the project

def build(out):
    check_stages()
    P = HillClimb("Ridgeline Rally")
    P.p["settings"]["scoreboard"] = {"unit": "metres"}
    P.p["settings"]["pixelScaling"] = False

    for kind in VEHICLES:
        im, origin = car_body(kind)
        P.sprite(f"body_{kind}", [picture(f"body_{kind}", im)], origin)
        r = VEHICLES[kind]["wheel_r"]
        P.sprite(f"wheel_{kind}", [picture(f"wheel_{kind}", wheel_picture(r, (230, 230, 236) if kind == "Jeep" else (250, 200, 40)))], (r + 1, r + 1))
    for n in range(len(STAGES)):
        k = min(n, 2)                    # a stage added past the moon borrows the moon's look
        P.sprite(f"sky_{n}", [picture(f"sky_{n}", sky(k))], (0, 0))
        P.sprite(f"far_{n}", [picture(f"far_{n}", back_layer(k, "far"))], (0, 0))
        P.sprite(f"near_{n}", [picture(f"near_{n}", back_layer(k, "near"))], (0, 0))
        P.sprite(f"deco_{n}", decorations(k), (12, 24))
    P.sprite("coin", coin_frames(), (10, 10))
    P.sprite("fuel", [picture("fuel", fuel_can())], (11, 13))
    P.sprite("fuel_icon", [fuel_can(18, 20)], (0, 0))
    P.sprite("sign", [sign_post()], (28, 66))
    P.sprite("finish", [picture("finish", finish_arch())], (75, 130))
    P.sprite("best_flag", [flag((255, 200, 40))], (2, 60))
    P.sprite("flag_icon", [flag_icon()], (1, 16))
    P.sprite("star", [star()], (6, 6))
    P.sprite("garage", [picture("garage", garage_room())], (0, 0))
    make_sounds(P)

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
        "id": _tw.new_id(), "name": "Road", "width": ROOM_W, "height": ROOM_H, "background": "#5ab4f0",
        "gridWidth": 32, "gridHeight": 32, "snap": True,
        "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
        # The camera is moved by the game (follow_car, in flow), so it can look ahead of the car.
        "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 0},
        "instances": [{"id": _tw.new_id(), "object": P.obj_id("Game"), "layer": lid, "x": 0, "y": 0,
                       "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""}],
    })
    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(STAGES)} stages")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "HillClimb.zip")
