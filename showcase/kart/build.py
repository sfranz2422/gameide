#!/usr/bin/env python3
"""
Builds the eighth showcase game, "Zoomtown Cup", as a GameIDE project zip: a
kart racer seen from just behind the kart, on a track laid flat (draw_floor).

    python3 showcase/kart/build.py      # → showcase/kart/out/Kart.zip

THE GAME IS OBJECTS: Kart with its children PlayerKart and ComputerKart; Hedge,
Tree, ItemBox, OilSlick and Bolt under Scenery; BoostPad, Ghost, and Game, the
referee and the view. The room is the track,
in the track's own pixels, so instances stand where they do on the picture and
the engine's collisions work as in any other game. Only draw_floor's view differs.

THE TRACKS ARE NEVER PICTURES FROM ELSEWHERE. Each is painted here from its
numbers in game/_1tracks.py, the same numbers the karts drive on, so the road
you see is the road you're on. Everything else (the kart, the scenery, the
sky) has a stand-in drawn here; a Gemini picture saved in ~/Downloads/kart/
under the name PROMPTS.md gives replaces it the next time this runs.

A track that can't be raced (too near the edge, passing itself so a kart
could skip a stretch, a bend too sharp) stops the build (track_problems).
"""
import colorsys
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
GEMINI = Path("~/Downloads/kart").expanduser()
MAP_INNER = 110

GAME = {}
# Every script only defines things at its top level, so the build can read their numbers.
for f in ("_1tracks.py", "_2kart.py", "_3race.py", "_4screen.py", "_6items.py"):
    exec((HERE / "game" / f).read_text(), GAME)
TRACKS, RACERS, STEP = GAME["TRACKS"], GAME["RACERS"], GAME["STEP"]
centre_line = GAME["centre_line"]
VIEW_W, VIEW_H, HORIZON, KART_W, BUSH_W, TREE_W, SKY_W = (GAME[k] for k in ("VIEW_W", "VIEW_H", "HORIZON", "KART_W", "BUSH_W", "TREE_W", "SKY_W"))
KART_H = 72
PAD_LONG, PAD_WIDE = 44, 28   # a boost pad on the track, and its object's box
S = 4                  # pictures are painted 4 times bigger, then shrunk: smooth edges


class Kart(_tw.Project):
    def write(self, path):
        import zipfile
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n")


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def picture(name, made):
    """The teacher's Gemini picture for `name` if it's in ~/Downloads/kart/, made the
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


# ---------------------------------------------------------------- the track

def quad(d, a, b, half, fill):
    """A stretch of road from a to b, `half` either side."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n * half, dx / n * half
    d.polygon([(a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny), (b[0] - nx, b[1] - ny), (a[0] - nx, a[1] - ny)], fill=fill)
    d.ellipse((a[0] - half, a[1] - half, a[0] + half, a[1] + half), fill=fill)


def paint_track(track):
    """The track's picture: hedge everywhere, grass near the road, then kerbs, road, and the line."""
    size, look = track["size"], track["look"]
    line = centre_line(track)
    n = len(line)
    half, wall = track["half"], track["half"] + track["verge"]
    im = Image.new("RGB", (size, size), rgb(look["hedge"]))
    d = ImageDraw.Draw(im)
    # Mown stripes, one mask over a checked lawn: they show how fast you're going.
    lawn = Image.new("RGB", (size, size), rgb(look["grass"]))
    ld = ImageDraw.Draw(lawn)
    for y in range(0, size, 48):
        for x in range((y // 48 % 2) * 48, size, 96):
            ld.rectangle((x, y, x + 47, y + 47), fill=rgb(look["grass2"]))
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    for i in range(n):
        quad(md, line[i], line[(i + 1) % n], wall, 255)
    im.paste(lawn, (0, 0), mask)
    # Kerbs, red and white, then the road in bands, then a dashed centre line.
    for i in range(n):
        quad(d, line[i], line[(i + 1) % n], half + 5, rgb(look["kerb1"] if (i // 2) % 2 else look["kerb2"]))
    for i in range(n):
        quad(d, line[i], line[(i + 1) % n], half, rgb(look["road"] if (i // 3) % 2 else look["road2"]))
    for i in range(0, n, 6):
        a, b = line[i], line[(i + 2) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        m = math.hypot(dx, dy) or 1
        nx, ny = -dy / m * 1.5, dx / m * 1.5
        d.polygon([(a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny), (b[0] - nx, b[1] - ny), (a[0] - nx, a[1] - ny)], fill=rgb(look["line"]))
    # Boost pads, from the same places the game puts its BoostPad objects: chevrons along the road.
    for x, y, a in GAME["pad_places"](track):
        r = math.radians(a)
        fx, fy = math.cos(r), -math.sin(r)
        nx, ny = -fy, fx
        P = lambda u, v: (x + fx * u + nx * v, y + fy * u + ny * v)
        d.polygon([P(-PAD_LONG / 2, -PAD_WIDE / 2), P(PAD_LONG / 2, -PAD_WIDE / 2), P(PAD_LONG / 2, PAD_WIDE / 2), P(-PAD_LONG / 2, PAD_WIDE / 2)], fill=(255, 150, 30))
        for u in range(-PAD_LONG // 2, PAD_LONG // 2 - 4, 10):
            d.polygon([P(u, -PAD_WIDE / 2 + 2), P(u + 5, -PAD_WIDE / 2 + 2), P(u + 10, 0), P(u + 5, PAD_WIDE / 2 - 2), P(u, PAD_WIDE / 2 - 2), P(u + 5, 0)], fill=(255, 240, 150))
    # The start line: a chequered band across the road at point 0.
    a, b = line[0], line[1]
    tx, ty = (b[0] - a[0]) / STEP, (b[1] - a[1]) / STEP
    nx, ny = -ty, tx
    SQ = 8
    for r in range(3):
        for c in range(-half // SQ, half // SQ + 1):
            col = (235, 235, 235) if (r + c) % 2 else (25, 25, 30)
            px = lambda u, v: (a[0] + tx * (r * SQ + u) + nx * (c * SQ + v), a[1] + ty * (r * SQ + u) + ny * (c * SQ + v))
            d.polygon([px(0, 0), px(SQ, 0), px(SQ, SQ), px(0, SQ)], fill=col)
    return im.convert("RGBA")


def paint_map(track):
    """The little map in the corner, from the same centre line."""
    size = MAP_INNER + 8
    im = Image.new("RGBA", (size * S, size * S), (20, 22, 40, 170))
    d = ImageDraw.Draw(im)
    k = MAP_INNER * S / track["size"]
    pts = [(4 * S + x * k, 4 * S + y * k) for x, y in centre_line(track)]
    d.line(pts + pts[:2], fill=(255, 255, 255, 255), width=int(3.5 * S), joint="curve")
    d.line(pts + pts[:2], fill=(120, 124, 140, 255), width=int(2 * S), joint="curve")
    return im.resize((size, size), Image.LANCZOS)


def paint_sky(track, seed):
    """Seamless across: the sky turns with you. Hills along the bottom meet the road's far edge."""
    look = track["look"]
    w, h = SKY_W, HORIZON
    im = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(im)
    top, low = rgb(look["sky_top"]), rgb(look["sky_low"])
    for y in range(h):
        t = y / (h - 1)
        d.line((0, y, w, y), fill=tuple(round(top[i] + (low[i] - top[i]) * t) for i in range(3)) + (255,))
    rnd = random.Random(seed)
    if look["stars"]:
        for _ in range(160):
            x, y = rnd.randrange(w), rnd.randrange(h - 24)
            v = rnd.randrange(150, 256)
            d.rectangle((x, y, x + (v > 225), y + (v > 225)), fill=(v, v, 255, 255))
    for _ in range(0 if look["stars"] else 9):
        x, y, r = rnd.randrange(w), rnd.randrange(10, 60), rnd.randrange(12, 26)
        for dx in (-w, 0, w):
            for k in range(5):
                ox = (k - 2) * r * 0.8
                rr = r * (1 - abs(k - 2) * 0.18)
                d.ellipse((x + dx + ox - rr, y - rr * 0.6, x + dx + ox + rr, y + rr * 0.6), fill=(255, 255, 255, 225))
    far = lambda x: h - 26 - 12 * math.sin(x * 2 * math.pi * 3 / w + 1) - 6 * math.sin(x * 2 * math.pi * 7 / w)
    near = lambda x: h - 12 - 7 * math.sin(x * 2 * math.pi * 5 / w) - 3 * math.sin(x * 2 * math.pi * 11 / w + 2)
    d.polygon([(0, h)] + [(x, far(x)) for x in range(0, w + 1, 4)] + [(w, h)], fill=rgb(look["hill_far"]) + (255,))
    d.polygon([(0, h)] + [(x, near(x)) for x in range(0, w + 1, 4)] + [(w, h)], fill=rgb(look["hill_near"]) + (255,))
    return im


# ---------------------------------------------------------------- the kart, a little model

def spin(p, yaw):
    x, y, z = p
    return (x * math.cos(yaw) - y * math.sin(yaw), x * math.sin(yaw) + y * math.cos(yaw), z)


def kart_view(k, paint=(232, 60, 44)):
    """One stand-in view: a small model of boxes turned k * 22.5 degrees and drawn
    furthest first, so every view of it agrees. Nose turned anticlockwise seen
    from above, so from behind it points left. Gemini's pictures replace these."""
    yaw = k * math.pi / 8
    tilt = math.radians(24)
    unit = 1.55 * S
    ox, oy = KART_W * S / 2, (KART_H - 8) * S
    def proj(p):
        x, y, z = spin(p, yaw)
        return (ox + x * unit, oy - (z * math.cos(tilt) + y * math.sin(tilt)) * unit), y * math.cos(tilt) - z * math.sin(tilt)
    tyre, dark = (30, 30, 38), tuple(c // 2 for c in paint)
    boxes = [
        ((-11, -13, 0), (-6, -5, 7), tyre), ((6, -13, 0), (11, -5, 7), tyre),      # the back wheels
        ((-10, 8, 0), (-6, 15, 6), tyre), ((6, 8, 0), (10, 15, 6), tyre),          # the front wheels
        ((-7, -14, 2), (7, 12, 6), paint),                                         # the floor
        ((-4, 12, 2), (4, 19, 5), paint),                                          # the nose
        ((-9, 16, 2), (9, 19, 4), dark),                                           # the bumper
        ((-6, -12, 6), (6, -4, 9), dark),                                          # the seat's back and engine
        ((-5, -6, 6), (5, 4, 13), (44, 110, 210)),                                 # the driver's body
        ((-9, -17, 11), (9, -14, 13), paint),                                      # the wing
        ((-7, -16, 5), (-5, -14, 11), dark), ((5, -16, 5), (7, -14, 11), dark),    # its posts
        ((-1, 4, 6), (1, 7, 11), (50, 50, 60)),                                    # the steering column
    ]
    faces = []
    for (x1, y1, z1), (x2, y2, z2), col in boxes:
        c = [(x, y, z) for z in (z1, z2) for y in (y1, y2) for x in (x1, x2)]
        for idx, shade in (((0, 1, 3, 2), 0.5), ((4, 5, 7, 6), 1.0), ((0, 1, 5, 4), 0.72), ((2, 3, 7, 6), 0.8), ((0, 2, 6, 4), 0.62), ((1, 3, 7, 5), 0.86)):
            pts = [proj(c[i]) for i in idx]
            depth = sum(p[1] for p in pts) / 4
            (ax, ay), (bx, by), (cx, cy) = pts[0][0], pts[1][0], pts[2][0]
            faces.append((depth, "poly", [p[0] for p in pts], tuple(round(v * shade) for v in col)))
    # The helmet: a ball, painted the racer's colour with a dark visor on its front.
    centre, depth = proj((0, 0, 17))
    faces.append((depth, "ball", centre, paint))
    im = Image.new("RGBA", (KART_W * S, KART_H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for _, kind, a, col in sorted(faces, key=lambda f: -f[0]):
        if kind == "poly":
            d.polygon(a, fill=col + (255,))
        else:
            r = 6.4 * unit
            d.ellipse((a[0] - r, a[1] - r, a[0] + r, a[1] + r), fill=col + (255,), outline=(30, 24, 30, 255), width=S)
            d.ellipse((a[0] - r * 0.55, a[1] - r * 0.75, a[0] - r * 0.1, a[1] - r * 0.3), fill=(255, 255, 255, 170))
            vx, vy = spin((0, 1, 0), yaw)[:2]
            if vy > -0.2:                                       # the visor, when its front is turned to us
                sx = a[0] + vx * r * 0.45
                d.ellipse((sx - r * 0.55, a[1] - r * 0.3, sx + r * 0.55, a[1] + r * 0.35), fill=(40, 44, 60, 255))
    return im.resize((KART_W, KART_H), Image.LANCZOS)


def repaint(im, colour):
    """A racer's kart: its red paint turned to their colour. Gemini's kart is red for this."""
    hue, _, _ = colorsys.rgb_to_hsv(*(c / 255 for c in rgb(colour)))
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > 0.45 and (h < 0.055 or h > 0.96):
                r2, g2, b2 = colorsys.hsv_to_rgb(hue, s, v)
                px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    return out


def kart_frames(colour):
    """The sixteen views: nine pictures, the other seven their mirrors."""
    views = [repaint(picture(f"kart_view_{k}", kart_view(k)), colour) for k in range(9)]
    return views + [views[k].transpose(Image.FLIP_LEFT_RIGHT) for k in range(7, 0, -1)]


# ---------------------------------------------------------------- the scenery

def bush(seed):
    w, h = BUSH_W, 124
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    for dark, shrink in (((36, 110, 48), 0), ((62, 150, 62), 0.28)):
        for k in range(8):
            x = (k + 0.5) / 8 * w
            r = rnd.uniform(28, 42) * (1 - shrink)
            y = h - r * (1.05 + shrink * 1.5) - rnd.uniform(0, 16)
            d.ellipse(((x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S), fill=dark + (255,))
    d.rectangle((0, (h - 24) * S, w * S, h * S), fill=(36, 110, 48, 255))
    return im.resize((w, h), Image.LANCZOS)


def tree(seed):
    w, h = TREE_W, 172
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    d.rectangle(((w / 2 - 8) * S, 96 * S, (w / 2 + 8) * S, h * S), fill=(110, 76, 46, 255))
    for col, cx, cy, r in (((44, 122, 56), 64, 70, 54), ((44, 122, 56), 34, 88, 30), ((44, 122, 56), 94, 88, 30), ((76, 160, 72), 54, 56, 32), ((104, 186, 88), 46, 44, 13)):
        r += rnd.uniform(-2, 2)
        d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=col + (255,))
    return im.resize((w, h), Image.LANCZOS)


def restyle(im, scene):
    """The meadow's hedges and trees for another place: only their greens change."""
    hue, sat, val = {"desert": (0.075, 0.62, 0.95), "snow": (0.58, 0.14, 1.28), "night": (0.68, 0.7, 0.5)}[scene]
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if 0.2 < h < 0.5 and s > 0.2:
                r2, g2, b2 = colorsys.hsv_to_rgb(hue, s * sat, min(1, v * val))
                px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    return out


# ---------------------------------------------------------------- items

def item_icon(k):
    """The four items, as the display and box show them: turbo, oil, bolt, shield."""
    w = 48
    im = Image.new("RGBA", (w * S, w * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    P = lambda *a: [v * S for v in a]
    ink = (30, 24, 40, 255)
    if k == 0:      # a turbo: a flame
        d.polygon(P(24, 3, 39, 26, 34, 42, 14, 42, 9, 26, 17, 19, 19, 27), fill=(255, 120, 30, 255), outline=ink, width=2 * S)
        d.polygon(P(24, 20, 31, 32, 28, 40, 20, 40, 17, 32), fill=(255, 225, 90, 255))
    elif k == 1:    # oil: a dark drop
        d.ellipse(P(10, 18, 38, 45), fill=(46, 40, 66, 255), outline=ink, width=2 * S)
        d.polygon(P(24, 3, 36, 26, 12, 26), fill=(46, 40, 66, 255))
        d.ellipse(P(16, 24, 22, 32), fill=(150, 140, 200, 255))
    elif k == 2:    # a bolt of lightning
        d.polygon(P(29, 2, 10, 27, 22, 27, 17, 46, 39, 19, 26, 19), fill=(255, 225, 60, 255), outline=ink, width=2 * S)
    else:           # a shield
        d.polygon(P(24, 4, 41, 10, 39, 28, 24, 45, 9, 28, 7, 10), fill=(80, 180, 240, 255), outline=ink, width=2 * S)
        d.polygon(P(24, 10, 35, 14, 33, 27, 24, 38), fill=(180, 228, 255, 255))
    return im.resize((w, w), Image.LANCZOS)


def box_picture():
    """An item box: a bright crate with a star on it, standing on the road."""
    w = 64
    im = Image.new("RGBA", (w * S, w * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    P = lambda *a: [v * S for v in a]
    ink = (40, 30, 60, 255)
    d.rounded_rectangle(P(6, 6, 58, 62), radius=8 * S, fill=(255, 200, 40, 255), outline=ink, width=3 * S)
    d.rounded_rectangle(P(13, 13, 51, 55), radius=5 * S, fill=(255, 225, 110, 255))
    pts = []
    for i in range(10):
        r = 18 if i % 2 == 0 else 8
        a = -math.pi / 2 + i * math.pi / 5
        pts += [32 + math.cos(a) * r, 34 + math.sin(a) * r]
    d.polygon(P(*pts), fill=(240, 90, 60, 255), outline=ink, width=S)
    return im.resize((w, w), Image.LANCZOS)


def slick_picture():
    w, h = 96, 34
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for x, y, rx, ry in ((48, 20, 44, 12), (22, 22, 18, 9), (72, 16, 20, 9)):
        d.ellipse(((x - rx) * S, (y - ry) * S, (x + rx) * S, (y + ry) * S), fill=(36, 30, 54, 255))
    d.ellipse((34 * S, 13 * S, 58 * S, 19 * S), fill=(120, 100, 190, 255))
    return im.resize((w, h), Image.LANCZOS)


# ---------------------------------------------------------------- sounds

def engine_loop(f, rough, seconds=0.5):
    """An engine's hum at `f` Hz, a whole number of turns long so it loops without a click."""
    turns = max(1, round(seconds * f))
    n = round(turns * _tw.RATE / f)
    rnd = random.Random(int(f))
    out = []
    for i in range(n):
        ph = (i * turns / n) % 1
        v = (1 if ph < 0.3 else -0.4) * 0.5
        v += math.sin(2 * math.pi * 2 * turns * i / n) * 0.25
        v += (rnd.random() * 2 - 1) * rough
        out.append(v * 0.5)
    y, smooth = 0.0, []
    for s in out + out:
        y += 0.25 * (s - y)
        smooth.append(y)
    return smooth[n:]


def make_sounds(P):
    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    for k, (f, rough) in enumerate(((60, 0.12), (92, 0.1), (130, 0.08), (175, 0.07))):
        P.sound(f"engine_{k}", engine_loop(f, rough))
    P.sound("beep", tone(0.16, 660, 660, "square", 0.25))
    P.sound("go", tone(0.5, 1320, 1320, "square", 0.25))
    P.sound("lap", join(*[tone(0.08, f, f, "square", 0.2) for f in (784, 988, 1175)]))
    P.sound("finish", join(*[tone(0.12, f, f, "square", 0.2) for f in (523, 659, 784)], tone(0.45, 1047, 1047, "square", 0.22)))
    P.sound("drift", lowpass(tone(0.25, 0, 0, "noise", 0.3, seed=3), 0.5, 0.2))
    P.sound("spark", tone(0.1, 1500, 2200, "tri", 0.3))
    P.sound("boost", mix(tone(0.5, 180, 620, "square", 0.22), lowpass(tone(0.5, 0, 0, "noise", 0.35, seed=4), 0.4, 0.1)))
    P.sound("bump", mix(tone(0.16, 130, 60, "sine", 0.7), lowpass(tone(0.12, 0, 0, "noise", 0.45, seed=5), 0.3, 0.05)))
    P.sound("click", tone(0.03, 900, 700, "square", 0.12))
    P.sound("pickup", join(*[tone(0.05, f, f, "square", 0.16) for f in (660, 880, 1100, 1320)]))
    P.sound("throw", tone(0.18, 900, 300, "tri", 0.3))
    P.sound("spin", mix(tone(0.6, 700, 180, "square", 0.16), lowpass(tone(0.5, 0, 0, "noise", 0.3, seed=6), 0.35, 0.1)))
    P.sound("shield", join(tone(0.08, 1000, 1400, "tri", 0.3), tone(0.2, 1400, 1800, "tri", 0.25)))


# ---------------------------------------------------------------- the project

def build(out):
    problems = [f"{t['name']}: {w}" for t in TRACKS for w in GAME["track_problems"](t)]
    if problems:
        raise SystemExit("The tracks:\n  " + "\n  ".join(problems))
    P = Kart("Zoomtown Cup")
    P.p["settings"]["pixelScaling"] = False
    for k, racer in enumerate(RACERS):
        s = P.sprite(f"kart_{k}", kart_frames(racer["paint"]), (KART_W // 2, KART_H - 8))
        # A circle round where the kart stands, scaled by the instance to KART_R on the track.
        s["mask"] = {"kind": "circle", "cx": KART_W // 2, "cy": KART_H - 8, "r": GAME["KART_R"] * KART_W / GAME["KART_WORLD"]}
    for n, track in enumerate(TRACKS):
        P.sprite(f"track_{n}", [paint_track(track)], (0, 0))
        P.sprite(f"map_{n}", [paint_map(track)], (0, 0))
        P.sprite(f"sky_{n}", [picture(f"sky_{n}", paint_sky(track, n + 1))], (0, 0))
    # The hedge's box lies along the road, reaching this far either side of where it stands.
    reach = 22 * BUSH_W / GAME["HEDGE_LONG"]
    bushes = [picture(f"bush_{k}", bush(k)) for k in range(3)]
    trees = [picture(f"tree_{k}", tree(k)) for k in range(3)]
    for n, track in enumerate(TRACKS):
        scene = track["look"]["scene"]
        P.sprite(f"bush_{n}", [restyle(b, scene) if scene else b for b in bushes], (BUSH_W // 2, 122),
                 mask=(0, 122 - reach, BUSH_W, 122 + reach))
        P.sprite(f"tree_{n}", [restyle(t, scene) if scene else t for t in trees], (TREE_W // 2, 170))
    P.sprite("items", [picture(f"item_{name}", item_icon(k)) for k, name in enumerate(GAME["ITEMS"])], (0, 0))
    s = P.sprite("item_box", [picture("item_box", box_picture())], (32, 62))
    s["mask"] = {"kind": "circle", "cx": 32, "cy": 62, "r": 32}
    s = P.sprite("oil_slick", [picture("oil_slick", slick_picture())], (48, 30))
    s["mask"] = {"kind": "circle", "cx": 48, "cy": 30, "r": 36}
    s = P.sprite("bolt", [picture("item_bolt", item_icon(2))], (24, 46))
    s["mask"] = {"kind": "circle", "cx": 24, "cy": 46, "r": 18}
    # Only the box matters: the picture of it is painted on the track, not drawn by the object.
    P.sprite("pad", [Image.new("RGBA", (PAD_LONG, PAD_WIDE), (0, 0, 0, 0))], (PAD_LONG // 2, PAD_WIDE // 2), mask=(0, 0, PAD_LONG, PAD_WIDE))
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
            o["events"].append({"id": _tw.new_id(), "key": _tw.event_key(ev, P), "mode": "python", "code": code})

    lid = _tw.new_id()
    P.p["rooms"].append({
        "id": _tw.new_id(), "name": "Race", "width": GAME["ROOM_SIZE"], "height": GAME["ROOM_SIZE"], "background": "#3f9be8",
        "gridWidth": 32, "gridHeight": 32, "snap": True,
        "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
        # The room is the track, with every instance at its place on it. The view stays
        # at the room's corner: it shows what's drawn from draw_floor, not the room itself.
        "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 0},
        "instances": [{"id": _tw.new_id(), "object": P.obj_id("Game"), "layer": lid, "x": 0, "y": 0,
                       "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""}],
    })
    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    lens = [len(centre_line(t)) * STEP for t in TRACKS]
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  tracks {lens} px")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Kart.zip")
