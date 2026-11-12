#!/usr/bin/env python3
"""
Builds the showcase game "Snowfort Flags" as a GameIDE project zip: capture the
flag as a snowball fight, in a park too big to see across.

    python3 showcase/flags/build.py      # → showcase/flags/out/Flags.zip (and project.json)

Alone: you and three computer kids (Red) against four (Blue). In a room (the
room script), everyone in one park, computer kids filling both teams.

The pictures are the teacher's Gemini art (PROMPTS.md), cut by cut_sheets.py
into art/ (committed). Without art/ every picture is a stand-in drawn here, so
the game still builds and plays with only this file and game/.

THE GAME IS OBJECTS: Kid and its three kinds (Player, Bot, Remote), Snowball,
Splat, Flag, Stand, Drift, Tree, Lump, Prop, Match (the match: makes everyone,
runs the referee), Tracks (footprints), Hud, Title. The park is game/_2map.py
(letters; this file paints it), every number is game/_1rules.py, every decision
is game/_3match.py, and a room is game/_7room.py.
"""
import importlib.util
import json
import math
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


HERE = Path(__file__).resolve().parent
_tw = _load("thornwood_build", HERE.parent / "build.py")
_climb = _load("climber_build", HERE.parent / "climber" / "build.py")
GAME = {}
exec((HERE / "game" / "_1rules.py").read_text(), GAME)
exec((HERE / "game" / "_2map.py").read_text(), GAME)
TILE, VIEW_W, VIEW_H = GAME["TILE"], GAME["VIEW_W"], GAME["VIEW_H"]
COLS, ROWS, GRID = GAME["COLS"], GAME["ROWS"], GAME["GRID"]
S = 4   # pictures are drawn 4 times bigger and shrunk, for smooth edges
ART = HERE / "art"
HAVE_ART = (ART / "kid_red_0_down.png").exists()
KID_W, KID_H = 44, 52      # a kid's frame (cut_sheets.KID_SIZE); feet on its bottom row


def art(name):
    """One of the teacher's pictures, at the game's size (art/ keeps them at twice it)."""
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    return im.resize((im.width // 2, im.height // 2), Image.LANCZOS)


class Flags(_climb.Climb):
    def tileset(self, name, image, solid):
        t = super().tileset(name, image, solid)
        t["tileWidth"] = t["tileHeight"] = TILE
        return t

    def write(self, path):
        import zipfile
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n"
                       "Pictures and sounds made for it by its build. Type: Ubuntu (Ubuntu Font Licence).\n")


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def shade(c, k):
    return tuple(max(0, min(255, round(v * k))) for v in c)


def small(im, w, h):
    return im.resize((w, h), Image.LANCZOS)


# ---------------------------------------------------------------- checks

def map_problems():
    """A park that can't be played: a floor nobody can reach, a fort without its stand, a team that can't reach the other's flag."""
    out = []
    walk = lambda ch: ch not in GAME["SOLID"] + GAME["WATER"]
    stands = [(c, r) for r in range(ROWS) for c in range(COLS) if GRID[r][c] == "S"]
    if len(stands) != 2:
        return [f"there must be one stand a side (S): there are {len(stands)}"]
    seen = {stands[0]}
    q = deque([stands[0]])
    while q:
        c, r = q.popleft()
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c + dc, r + dr)
            if 0 <= n[0] < COLS and 0 <= n[1] < ROWS and n not in seen and walk(GRID[n[1]][n[0]]):
                seen.add(n)
                q.append(n)
    if stands[1] not in seen:
        out.append("Red's stand can't reach Blue's")
    lost = [(c, r) for r in range(ROWS) for c in range(COLS) if walk(GRID[r][c]) and (c, r) not in seen]
    if lost:
        out.append(f"{len(lost)} tiles nobody can reach, e.g. {lost[:3]}")
    for c in range(COLS):
        if walk(GRID[0][c]) or walk(GRID[ROWS - 1][c]):
            out.append(f"the park's edge is open at column {c}")
            break
    return out


# ---------------------------------------------------------------- pictures (stand-ins)

def kid_frames(team, look):
    """Six poses of a kid in a puffy coat, seen from slightly above: stand, walk ×2, throw, down, cheer."""
    _, coat_hex, hat_hex = GAME["LOOKS"][team][look]
    coat, hat = rgb(coat_hex), rgb(hat_hex)
    skin, boot, line = (246, 206, 172), (60, 46, 40), (32, 30, 42)
    W, H = 32, 44
    frames = []
    for pose in ("stand", "walk1", "walk2", "throw", "down", "cheer"):
        im = Image.new("RGBA", (W * S, H * S))
        d = ImageDraw.Draw(im)
        s = lambda *v: [x * S for x in v]
        if pose == "down":
            # Sitting in the snow: a wide coat, legs out, the hat askew.
            d.ellipse(s(4, 30, 28, 44), fill=(230, 240, 250))
            d.ellipse(s(6, 22, 26, 40), fill=coat, outline=line, width=S)
            d.ellipse(s(9, 10, 23, 24), fill=skin, outline=line, width=S)
            d.pieslice(s(7, 6, 25, 22), 160, 340, fill=hat, outline=line, width=S)
            d.ellipse(s(3, 36, 11, 43), fill=boot)
            d.ellipse(s(21, 36, 29, 43), fill=boot)
        else:
            lift = {"walk1": (2, 0), "walk2": (0, 2)}.get(pose, (0, 0))
            d.rounded_rectangle(s(9, 34 - lift[0], 15, 43 - lift[0]), radius=2 * S, fill=boot)
            d.rounded_rectangle(s(17, 34 - lift[1], 23, 43 - lift[1]), radius=2 * S, fill=boot)
            d.rounded_rectangle(s(5, 18, 27, 37), radius=7 * S, fill=coat, outline=line, width=S)
            d.line(s(16, 20, 16, 35), fill=shade(coat, 0.75), width=S)
            arms = {"throw": [(5, 22, 0, 12), (27, 22, 31, 30)], "cheer": [(5, 22, 1, 8), (27, 22, 31, 8)]}
            for x0, y0, x1, y1 in arms.get(pose, [(5, 22, 2, 33), (27, 22, 30, 33)]):
                d.line(s(x0, y0, x1, y1), fill=shade(coat, 0.85), width=5 * S)
                d.ellipse(s(x1 - 3, y1 - 3, x1 + 3, y1 + 3), fill=shade(hat, 0.9))
            if pose == "throw":
                d.ellipse(s(-2, 7, 6, 15), fill=(255, 255, 255), outline=(170, 190, 210), width=S)
            d.ellipse(s(8, 4, 24, 21), fill=skin, outline=line, width=S)
            d.pieslice(s(7, 1, 25, 19), 180, 360, fill=hat, outline=line, width=S)
            d.ellipse(s(13, -2, 19, 4), fill=shade(hat, 1.15))
            d.ellipse(s(12, 12, 14, 14), fill=line)
            d.ellipse(s(18, 12, 20, 14), fill=line)
            d.rectangle(s(8, 18, 24, 21), fill=shade(hat, 0.8))
        frames.append(small(im, W, H))
    return frames


def kid_sprite_frames(team, look):
    """A kid's frames in KID_FRAMES' order: the teacher's pictures, or stand-ins on a frame of the same size."""
    if HAVE_ART:
        return [art(f"kid_{team}_{look}_{f}") for f in GAME["KID_FRAMES"]]
    old = kid_frames(team, look)   # stand, walk1, walk2, throw, down, cheer
    pick = {"down": 0, "down_walk": 1, "up": 0, "up_walk": 2, "side": 0, "side_walk1": 1, "side_walk2": 2,
            "throw_down": 3, "throw_side": 3, "throw_up": 3, "scoop": 3, "fallen": 4, "dizzy": 4, "cheer": 5}
    out = []
    for f in GAME["KID_FRAMES"]:
        im = Image.new("RGBA", (KID_W, KID_H))
        im.alpha_composite(old[pick[f]], ((KID_W - 32) // 2, KID_H - 44))
        out.append(im)
    return out


def splat_frames():
    if HAVE_ART:
        return [art(f"splat_{i}") for i in range(3)]
    out = []
    for i in range(3):
        im = Image.new("RGBA", (32 * S, 32 * S))
        d = ImageDraw.Draw(im)
        r = (5 + 4 * i) * S
        for k in range(8):
            a = k * math.pi / 4
            x, y = 16 * S + math.cos(a) * r, 16 * S + math.sin(a) * r
            d.ellipse((x - 2 * S, y - 2 * S, x + 2 * S, y + 2 * S), fill=(255, 255, 255, 230 - 60 * i))
        out.append(small(im, 32, 32))
    return out


def snowball_picture():
    r = GAME["HIT_REACH"]
    im = Image.new("RGBA", (2 * r * S, 2 * r * S))
    d = ImageDraw.Draw(im)
    c = r * S
    d.ellipse((c - 5 * S, c - 5 * S, c + 5 * S, c + 5 * S), fill=(255, 255, 255), outline=(150, 175, 200), width=S)
    d.ellipse((c - 3 * S, c - 3 * S, c, c), fill=(235, 245, 255))
    return small(im, 2 * r, 2 * r)


def flag_frames(team):
    col = rgb(GAME["TEAM_COLOURS"][team])
    out = []
    for lying in (False, True):
        im = Image.new("RGBA", (34 * S, 44 * S))
        d = ImageDraw.Draw(im)
        if lying:
            d.line((2 * S, 38 * S, 32 * S, 34 * S), fill=(120, 80, 48), width=2 * S)
            d.polygon([(20 * S, 34 * S), (33 * S, 26 * S), (34 * S, 38 * S)], fill=col, outline=shade(col, 0.6))
        else:
            d.line((6 * S, 4 * S, 6 * S, 43 * S), fill=(120, 80, 48), width=2 * S)
            d.polygon([(7 * S, 4 * S), (32 * S, 10 * S), (7 * S, 18 * S)], fill=col, outline=shade(col, 0.6))
            d.ellipse((4 * S, 1 * S, 9 * S, 6 * S), fill=(255, 220, 90))
        out.append(small(im, 34, 44))
    return out


def blob(w, h, fill, rim):
    im = Image.new("RGBA", (w * S, h * S))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, w * S - 1, h * S - 1), fill=rim)
    d.ellipse((S, S, w * S - 1 - S, h * S - 1 - 2 * S), fill=fill)
    return small(im, w, h)


def print_picture():
    im = Image.new("RGBA", (12 * S, 12 * S))
    d = ImageDraw.Draw(im)
    for y in (1, 7):
        d.ellipse((2 * S, y * S, 10 * S, (y + 4) * S), fill=(170, 195, 220, 200))
    return small(im, 12, 12)


TILES = ["snow", "path", "woods", "pine", "bank", "hedge", "wall", "ice", "bridge",
         "snow2", "grass", "twigs", "twigs2", "ice_l", "ice_r"]
# What stops a kid: pines, banks, hedges and fort walls (the Walls layer), and the
# creek's ice, its banks too (the Creek layer).
SOLID_TILES = [TILES.index(t) for t in ("pine", "bank", "hedge", "wall", "ice", "ice_l", "ice_r")]


def stand_in_tile(name):
    t = Image.new("RGBA", (TILE * S, TILE * S))
    d = ImageDraw.Draw(t)
    full = (0, 0, TILE * S, TILE * S)
    name = {"snow2": "snow", "grass": "snow", "twigs": "snow", "twigs2": "snow", "ice_l": "ice", "ice_r": "ice"}.get(name, name)
    if name in ("snow", "bank"):
        d.rectangle(full, fill=(240, 246, 252))
        d.ellipse((6 * S, 8 * S, 9 * S, 10 * S), fill=(222, 234, 246))
        d.ellipse((20 * S, 22 * S, 24 * S, 24 * S), fill=(222, 234, 246))
    if name == "path":
        d.rectangle(full, fill=(214, 222, 232))
        for x, y in ((5, 9), (19, 4), (12, 22), (26, 18)):
            d.ellipse((x * S, y * S, (x + 3) * S, (y + 2) * S), fill=(196, 206, 220))
    if name in ("woods", "pine"):
        d.rectangle(full, fill=(198, 214, 222))
        d.ellipse((4 * S, 20 * S, 10 * S, 23 * S), fill=(120, 140, 120))
    if name == "pine":
        d.rectangle((14 * S, 24 * S, 18 * S, 31 * S), fill=(96, 64, 40))
        for top, half, y1 in ((0, 9, 14), (6, 12, 21), (12, 15, 27)):
            d.polygon([(16 * S, top * S), ((16 - half) * S, y1 * S), ((16 + half) * S, y1 * S)], fill=(36, 92, 62), outline=(22, 60, 40))
            d.line(((16 - half + 2) * S, (y1 - 1) * S, (16 + half - 2) * S, (y1 - 1) * S), fill=(236, 244, 250), width=2 * S)
    if name == "bank":
        d.rounded_rectangle((1 * S, 6 * S, 31 * S, 31 * S), radius=10 * S, fill=(252, 254, 255), outline=(170, 190, 210), width=S)
        d.rounded_rectangle((4 * S, 9 * S, 28 * S, 18 * S), radius=6 * S, fill=(255, 255, 255))
    if name == "hedge":
        d.rectangle(full, fill=(240, 246, 252))
        d.rounded_rectangle((0, 4 * S, 32 * S, 30 * S), radius=8 * S, fill=(52, 104, 66), outline=(30, 70, 44), width=S)
        d.rounded_rectangle((2 * S, 4 * S, 30 * S, 11 * S), radius=4 * S, fill=(240, 246, 252))
    if name == "wall":
        d.rectangle(full, fill=(226, 236, 246))
        for y in (0, 8, 16, 24):
            off = 8 if (y // 8) % 2 else 0
            for x in range(-8, 32, 16):
                d.rectangle(((x + off) * S, y * S, (x + off + 15) * S, (y + 7) * S), outline=(170, 192, 214), width=S)
    if name == "ice":
        d.rectangle(full, fill=(150, 200, 230))
        d.line((4 * S, 6 * S, 14 * S, 2 * S), fill=(220, 240, 252), width=2 * S)
        d.line((16 * S, 24 * S, 28 * S, 18 * S), fill=(220, 240, 252), width=2 * S)
    if name == "bridge":
        d.rectangle(full, fill=(150, 200, 230))
        for y in range(0, 32, 6):
            d.rectangle((0, y * S, 32 * S, (y + 5) * S), fill=(150, 104, 66), outline=(98, 66, 40), width=S)
    return small(t, TILE, TILE)


def art_tile(name):
    """A ground tile from the teacher's sheet (6); the pines, banks and hedges are see-through (drawn as objects)."""
    if name in ("pine", "bank", "hedge"):
        return Image.new("RGBA", (TILE, TILE))
    if name == "path":
        # Packed snow: the trodden band across the middle of a trodden-path tile, stretched
        # to fill one and laid lightly over snow (alone, a whole fort of it was dark and busy).
        im = Image.open(ART / "tile_trodden_h.png").convert("RGBA")
        band = im.crop((0, round(im.height * 0.36), im.width, round(im.height * 0.62))).resize((TILE, TILE), Image.LANCZOS)
        snow = Image.open(ART / "tile_snow.png").convert("RGBA").resize((TILE, TILE), Image.LANCZOS)
        return Image.blend(snow, band, 0.4)
    if name == "woods":
        im = Image.open(ART / "tile_snow2.png").convert("RGBA").resize((TILE, TILE), Image.LANCZOS)
        return _shade_tile(im, 0.9)      # the woods' floor: a little darker snow
    if name == "wall":
        # The forts' pictures are drawn at a slant: their bricks don't tile, so the walls
        # keep the drawn bricks, in the same pale blues.
        return stand_in_tile("wall")
    if name == "bridge":
        # Planks across the way over: the creek runs down, the bridge goes across it.
        # (Its snowy ends trimmed, or two bridge tiles side by side showed a stripe of snow between.)
        im = Image.open(ART / "tile_bridge.png").convert("RGBA").rotate(90)
        return im.crop((0, round(im.height * 0.1), im.width, round(im.height * 0.9))).resize((TILE, TILE), Image.LANCZOS)
    src = {"snow": "snow", "snow2": "snow2", "grass": "grass", "twigs": "twigs", "twigs2": "twigs2",
           "ice": "ice", "ice_l": "edge_left", "ice_r": "edge_right"}[name]
    return Image.open(ART / f"tile_{src}.png").convert("RGBA").resize((TILE, TILE), Image.LANCZOS)


def _shade_tile(im, k):
    r, g, b, a = im.split()
    r, g, b = (ch.point(lambda v: round(v * k)) for ch in (r, g, b))
    return Image.merge("RGBA", (r, g, b, a))


def tiles_picture():
    im = Image.new("RGBA", (len(TILES) * TILE, TILE))
    for k, name in enumerate(TILES):
        im.alpha_composite(art_tile(name) if HAVE_ART else stand_in_tile(name), (k * TILE, 0))
    return im


def tile_layers():
    """The park as three tile layers: the ground under everything, the solid things on it, and the creek."""
    ground, walls, creek = {}, {}, {}
    under = {".": "snow", "D": "snow", ",": "path", "S": "path", "w": "woods", "T": "woods", "=": "bridge",
             "B": "snow", "H": "snow", "F": "snow"}
    on = {"T": "pine", "B": "bank", "H": "hedge", "F": "wall"}
    for r in range(ROWS):
        for c in range(COLS):
            ch = GRID[r][c]
            if ch in under:
                name = under[ch]
                if ch == ".":
                    # Open snow, varied (the same every build): mostly plain, now and then grass or twigs.
                    h = (c * 73 + r * 151 + c * r * 7) % 100
                    name = "snow2" if h < 14 else "grass" if h < 17 else "twigs" if h < 19 else "twigs2" if h < 21 else "snow"
                ground[f"{c},{r}"] = TILES.index(name)
            if ch in on:
                walls[f"{c},{r}"] = TILES.index(on[ch])
            if ch == "~":
                # The creek's banks, left and right, then ice.
                left = c == 0 or GRID[r][c - 1] not in "~="
                right = c == COLS - 1 or GRID[r][c + 1] not in "~="
                creek[f"{c},{r}"] = TILES.index("ice_l" if left else "ice_r" if right else "ice")
    return ground, walls, creek


def minimap_picture():
    colours = {".": (236, 242, 250), "D": (236, 242, 250), ",": (200, 208, 220), "S": (200, 208, 220),
               "w": (120, 160, 130), "T": (40, 90, 60), "B": (255, 255, 255), "H": (52, 104, 66),
               "F": (140, 160, 190), "~": (110, 170, 210), "=": (150, 104, 66)}
    im = Image.new("RGBA", (COLS, ROWS))
    for r in range(ROWS):
        for c in range(COLS):
            im.putpixel((c, r), colours[GRID[r][c]] + (255,))
    w, h = round(COLS * TILE * GAME["MAP_K"]), round(ROWS * TILE * GAME["MAP_K"])
    out = Image.new("RGBA", (w + 2, h + 2), (16, 32, 46, 255))
    out.alpha_composite(im.resize((w, h), Image.NEAREST), (1, 1))
    return out


def icon_picture():
    im = Image.new("RGBA", (128 * 2, 128 * 2))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 255, 255), radius=44, fill=(159, 208, 245))
    d.rectangle((0, 170, 255, 255), fill=(240, 246, 252))
    red, blue = (art("flag_red"), art("flag_blue")) if HAVE_ART else (flag_frames("red")[0], flag_frames("blue")[0])
    im.alpha_composite(red.resize((102, 132), Image.LANCZOS), (40, 60))
    im.alpha_composite(blue.resize((102, 132), Image.LANCZOS).transpose(Image.FLIP_LEFT_RIGHT), (116, 60))
    return im.resize((128, 128), Image.LANCZOS)


def make_sounds(P):
    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    puff = lambda s, v: lowpass(tone(s, 0, 0, "noise", v, seed=7), 0.5, 0.05)
    P.sound("throw", lowpass(tone(0.12, 0, 0, "noise", 0.25, seed=3), 0.2, 0.6))
    P.sound("hit", mix(puff(0.25, 0.6), tone(0.2, 300, 120, "sine", 0.3)))
    P.sound("thud", puff(0.18, 0.4))
    P.sound("scoop", lowpass(tone(0.1, 0, 0, "noise", 0.2, seed=9), 0.3, 0.1))
    P.sound("grab", join(tone(0.06, 660, 660, "square", 0.18), tone(0.1, 990, 990, "square", 0.18)))
    P.sound("return", join(tone(0.08, 784, 784, "tri", 0.25), tone(0.12, 523, 523, "tri", 0.25)))
    P.sound("capture", join(*[tone(0.09, f, f, "tri", 0.3) for f in (523, 659, 784, 1047)], tone(0.3, 1319, 1319, "tri", 0.3)))
    P.sound("win", join(*[tone(0.14, f, f, "square", 0.2) for f in (523, 659, 784, 659, 784)], tone(0.5, 1047, 1047, "square", 0.2)))
    P.sound("lose", join(*[tone(0.18, f, f * 0.95, "tri", 0.25) for f in (392, 349, 311)], tone(0.5, 262, 250, "tri", 0.25)))


# ---------------------------------------------------------------- the project

def build(out):
    problems = map_problems()
    if problems:
        sys.exit("The park can't be played:\n  " + "\n  ".join(problems))
    P = Flags("Snowfort Flags")
    P.p["settings"]["pixelScaling"] = True
    # The school's board counts the flags you've captured, all told.
    P.p["settings"]["scoreboard"] = {"unit": "captures"}
    sizes = {}

    def sprite(name, frames, origin, mask=None):
        s = P.sprite(name, frames, origin, mask=mask)
        sizes[name] = (s["width"], s["height"])
        return s

    for team in GAME["TEAMS"]:
        for look in range(len(GAME["LOOKS"][team])):
            # The box is the feet only, so in three-quarter view a head can pass in front of a bank.
            sprite(f"kid_{team}_{look}", kid_sprite_frames(team, look), (KID_W // 2, KID_H - 1),
                   mask=(KID_W // 2 - 8, KID_H - 10, KID_W // 2 + 8, KID_H))
        if HAVE_ART:
            home, held, down = art(f"flag_{team}"), art(f"flag_{team}_held"), art(f"flag_{team}_down")
        else:
            home, down = flag_frames(team)
            held = home
        sprite(f"flag_{team}", [home], (home.width // 2, home.height - 3))
        sprite(f"flag_{team}_held", [held], (held.width // 2, held.height - 1))
        sprite(f"flag_{team}_down", [down], (down.width // 2, down.height - 6))
    if HAVE_ART:
        # The ball's box is what reaches a kid's feet (HIT_REACH round its shadow): the
        # picture is smaller than that, so it sits in the middle of a frame that size.
        r = GAME["HIT_REACH"]
        ball = Image.new("RGBA", (2 * r, 2 * r))
        pic = art("snowball")
        ball.alpha_composite(pic, (r - pic.width // 2, r - pic.height // 2))
        sprite("snowball", [ball], (r, r))
        st = art("stand")
        sprite("stand", [st], (st.width // 2, st.height - 6))
        dr = art("drift")
        sprite("drift", [dr], (dr.width // 2, dr.height - 6))
        pr = art("prints")
        sprite("print", [pr], (pr.width // 2, pr.height // 2))
        pile = art("pile")
        sprite("pile", [pile], (pile.width // 2, pile.height // 2))
        for name in ("pine_big", "pine", "pine_small"):
            im = art(name)
            sprite(name, [im], (im.width // 2, im.height - 6))
        for name, size in (("bank", (44, 24)), ("hedge", (40, 24))):
            im = art(name).resize(size, Image.LANCZOS)
            sprite(f"lump_{name}", [im], (size[0] // 2, size[1] - 4))
        for kind in GAME["PROP_KINDS"]:
            im = art(kind)
            # Solid only at its feet: a strip at the bottom, so you walk round its base.
            w, h = im.size
            sprite(f"prop_{kind}", [im], (w // 2, h - 6), mask=(w // 2 - 10, h - 12, w // 2 + 10, h - 2))
        title = Image.open(ART / "title.png").convert("RGBA").resize((VIEW_W, VIEW_H), Image.LANCZOS)
        sprite("title_pic", [title], (0, 0))
    else:
        r = GAME["HIT_REACH"]
        sprite("snowball", [snowball_picture()], (r, r))
        sprite("stand", [blob(30, 14, (250, 252, 255), (180, 198, 216))], (15, 7))
        sprite("drift", [blob(46, 26, (255, 255, 255), (176, 196, 218))], (23, 18))
        sprite("print", [print_picture()], (6, 6))
    sprite("splat", splat_frames(), (16, 16))
    sprite("minimap", [minimap_picture()], (0, 0))
    sprite("icon", [icon_picture()], (64, 64))
    ts = P.tileset("park", tiles_picture(), SOLID_TILES)
    P.font("Ubuntu", HERE.parent / "undertow" / "fonts" / "ubuntu-latin-700-normal.woff2")
    make_sounds(P)

    for f in sorted((HERE / "game").glob("_*.py")):
        head, _ = _tw.read_code(f)
        P.script(head.get("script", f.stem.strip("_")), f.read_text())
    P.script("art", "# script: art\n# Written by build.py: how big each picture is, for drawing them to fit.\n"
             f"SIZES = {json.dumps({k: list(v) for k, v in sorted(sizes.items())})}\n")

    files = sorted(f for f in (HERE / "game").glob("*.py") if not f.name.startswith("_"))
    parsed = {f.stem: _tw.read_code(f) for f in files}
    for name, (head, _) in parsed.items():
        P.obj(name, depth=int(head.get("depth", 0)))
    for name, (head, events) in parsed.items():
        o = next(x for x in P.p["objects"] if x["name"] == name)
        if head.get("sprite"):
            o["sprite"] = P.sprite_id(head["sprite"])
        if head.get("parent"):
            o["parent"] = P.obj_id(head["parent"])
        for ev, code in events:
            o["events"].append({"id": _tw.new_id(), "key": _tw.event_key(ev, P), "mode": "python", "code": code})
    # A kid's sprite is picked by team and look as it's made; until then, any kid's, for its box.
    for name in ("Kid", "Player", "Bot", "Remote"):
        next(x for x in P.p["objects"] if x["name"] == name)["sprite"] = P.sprite_id("kid_red_0")
    if HAVE_ART:
        # Their pictures are picked as they're made; until then, one each, for its box.
        for name, pic in (("Tree", "pine"), ("Lump", "lump_bank"), ("Prop", "prop_snowman")):
            next(x for x in P.p["objects"] if x["name"] == name)["sprite"] = P.sprite_id(pic)
    # A prop is solid at its feet; the trees, banks and hedges stand on solid tiles already.
    next(x for x in P.p["objects"] if x["name"] == "Prop")["solid"] = True

    def inst(o, x, y, layer, code=""):
        return {"id": _tw.new_id(), "object": P.obj_id(o), "layer": layer, "x": x, "y": y,
                "scaleX": 1, "scaleY": 1, "angle": 0, "code": code}

    def layer(name, depth, tiles, visible=True):
        return {"id": _tw.new_id(), "name": name, "kind": "tiles", "depth": depth, "visible": visible, "locked": False,
                "tileset": ts["id"], "tiles": tiles}

    lid = _tw.new_id()
    P.p["rooms"].append({
        "id": _tw.new_id(), "name": "Title", "width": VIEW_W, "height": VIEW_H, "background": "#9fd0f5",
        "gridWidth": 16, "gridHeight": 16, "snap": False,
        "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
        "camera": {"enabled": False, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 1},
        "instances": [inst("Title", 0, 0, lid)],
    })

    lid = _tw.new_id()
    placed = [inst("Match", 0, 0, lid), inst("Tracks", 0, 0, lid), inst("Hud", 0, 0, lid)]
    for c, r in GAME["places"]("D"):
        x, y = GAME["tile_middle"](c, r)
        placed.append(inst("Drift", x, y, lid))
    if HAVE_ART:
        # The pictures standing on the solid tiles, and the park's things: each drawn in
        # front of whoever is behind it. (Stand-in tiles draw their own pines and banks.)
        for r in range(ROWS):
            for c in range(COLS):
                ch = GRID[r][c]
                x, y = c * TILE + TILE // 2, r * TILE + TILE - 4
                if ch == "T":
                    placed.append(inst("Tree", x, y, lid))
                elif ch in "BH":
                    placed.append(inst("Lump", x, y, lid))
        for c, r, kind in GAME["prop_spots"]():
            placed.append(inst("Prop", c * TILE + TILE // 2, r * TILE + TILE - 4, lid))
    ground, walls, creek = tile_layers()
    P.p["rooms"].append({
        "id": _tw.new_id(), "name": "Field", "width": COLS * TILE, "height": ROWS * TILE, "background": "#f0f6fc",
        "gridWidth": TILE, "gridHeight": TILE, "snap": True,
        "layers": [
            {"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False},
            layer("Walls", 95, walls),
            layer("Creek", 98, creek),
            layer("Ground", 100, ground),
        ],
        "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 1},
        "instances": placed,
    })

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    print(f"{out}  {out.stat().st_size / 1e6:.2f} MB  {len(P.p['objects'])} objects, {len(P.p['sprites'])} sprites")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Flags.zip")
