#!/usr/bin/env python3
"""
Builds the thirteenth showcase game, "Undertow", as a GameIDE project zip: a
research station at the bottom of the sea, where a few of the crew are not who
they seem.

    python3 showcase/undertow/build.py      # → showcase/undertow/out/Undertow.zip

The station, its jobs, and the round in a room (who's a Mimic, freezing,
meetings and votes, who wins). The pictures are stand-ins drawn here
(the teacher's Gemini pictures, PROMPTS.md, replace them in phase 4), so the
game builds and plays without any art on disk.

THE GAME IS OBJECTS: Crew, Player and Other (another player), Director (the
room's side: runs the round in the host's game), Meeting, Body, Station (a job's panel), Job and its kinds
(WiresJob, CrystalsJob, ValveJob, ScanJob), Lamps, Beacon, Hud, Title. The map
is game/_1station.py: this file paints it.
"""
import importlib.util
import json
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
_climb = _load("climber_build", HERE.parent / "climber" / "build.py")
MAP = {}
exec((HERE / "game" / "_1station.py").read_text(), MAP)
exec((HERE / "game" / "_3room.py").read_text(), MAP)
CREW = {"global_vars": None}
exec((HERE / "game" / "_2crew.py").read_text(), CREW)
TILE, COLS, ROWS = MAP["TILE"], MAP["COLS"], MAP["ROWS"]
VIEW_W, VIEW_H = MAP["VIEW_W"], MAP["VIEW_H"]
FLOORS = MAP["FLOORS"]
SUITS = CREW["SUITS"]
# The tileset: the floors in FLOORS' order, then a wall's front (floor below it) and a wall's top.
WALL_FRONT, WALL_TOP = len(FLOORS), len(FLOORS) + 1
FLOOR_COLORS = {"metal": (74, 92, 110), "grating": (52, 66, 78), "glass": (30, 90, 120), "lab": (150, 170, 180),
                "concrete": (96, 100, 102), "rug": (120, 60, 70), "plates": (110, 84, 64)}


def rgb(hex_):
    return tuple(int(hex_[i:i + 2], 16) for i in (1, 3, 5))


def shade(c, k):
    return tuple(max(0, min(255, round(v * k))) for v in c)


class Under(_climb.Climb):
    def tileset(self, name, image, solid):
        t = super().tileset(name, image, solid)
        t["tileWidth"] = t["tileHeight"] = TILE      # Thornwood's tiles are 16
        return t


# ---------------------------------------------------------------- stand-in pictures

def crew_frames(color):
    """A diver: round glass helmet, suit in their colour, a lamp on the shoulder. 32 × 44, feet at the bottom."""
    c = rgb(color)
    dark = shade(c, 0.55)
    frames = []
    for pose in range(6):
        im = Image.new("RGBA", (32, 44))
        d = ImageDraw.Draw(im)
        if pose == 4:                                   # frozen: in a block of ice
            d.rounded_rectangle((2, 4, 29, 43), 4, fill=(170, 220, 255, 200), outline=(230, 250, 255, 255))
        step = {1: -3, 2: 3}.get(pose, 0)
        alpha = 120 if pose == 5 else 255
        legs = (dark[0], dark[1], dark[2], alpha)
        body = (c[0], c[1], c[2], alpha)
        if pose != 5:
            d.rectangle((10 + step, 34, 14 + step, 43), fill=legs)
            d.rectangle((18 - step, 34, 22 - step, 43), fill=legs)
        else:                                           # a ghost: a tail, no legs
            d.polygon([(9, 34), (23, 34), (16, 43)], fill=body)
        d.rounded_rectangle((8, 18, 24, 36), 4, fill=body, outline=(10, 20, 30, alpha))
        d.ellipse((7, 2, 25, 20), fill=(40, 70, 95, alpha), outline=(10, 20, 30, alpha))
        if pose != 3:                                   # the face through the glass (from behind at a panel: none)
            d.ellipse((11, 6, 21, 16), fill=(240, 200, 170, alpha))
            d.rectangle((13, 9, 14, 11), fill=(20, 20, 30, alpha))
            d.rectangle((18, 9, 19, 11), fill=(20, 20, 30, alpha))
        d.ellipse((10, 4, 15, 8), fill=(200, 240, 255, min(alpha, 160)))
        d.ellipse((21, 19, 26, 24), fill=(255, 230, 120, alpha))
        frames.append(im)
    return frames


def face(color):
    im = Image.new("RGBA", (64, 64))
    d = ImageDraw.Draw(im)
    c = rgb(color)
    d.rounded_rectangle((8, 44, 56, 64), 8, fill=c)
    d.ellipse((10, 4, 54, 50), fill=(40, 70, 95), outline=(10, 20, 30), width=2)
    d.ellipse((20, 14, 44, 40), fill=(240, 200, 170))
    d.rectangle((26, 22, 28, 26), fill=(20, 20, 30))
    d.rectangle((36, 22, 38, 26), fill=(20, 20, 30))
    d.arc((27, 28, 37, 34), 20, 160, fill=(120, 60, 50), width=2)
    d.ellipse((16, 8, 26, 16), fill=(200, 240, 255))
    return im


def tiles_picture():
    im = Image.new("RGBA", ((len(FLOORS) + 2) * TILE, TILE))
    d = ImageDraw.Draw(im)
    rng = random.Random(5)
    for k, f in enumerate(FLOORS):
        x0 = k * TILE
        c = FLOOR_COLORS[f]
        d.rectangle((x0, 0, x0 + TILE - 1, TILE - 1), fill=c)
        d.rectangle((x0, 0, x0 + TILE - 1, TILE - 1), outline=shade(c, 0.75))
        if f in ("metal", "plates"):
            for dx, dy in ((3, 3), (28, 3), (3, 28), (28, 28)):
                d.point((x0 + dx, dy), fill=shade(c, 1.4))
        elif f == "grating":
            for i in range(4, TILE, 6):
                d.line((x0 + i, 1, x0 + i, TILE - 2), fill=shade(c, 0.5))
        elif f == "glass":
            for _ in range(6):
                x, y = rng.randrange(TILE), rng.randrange(TILE)
                d.point((x0 + x, y), fill=(120, 200, 230))
        elif f == "rug":
            d.arc((x0 + 4, 8, x0 + 28, 24), 200, 340, fill=shade(c, 1.4), width=2)
        elif f == "lab":
            d.line((x0 + 16, 0, x0 + 16, TILE), fill=shade(c, 0.85))
            d.line((x0, 16, x0 + TILE, 16), fill=shade(c, 0.85))
    x0 = WALL_FRONT * TILE
    d.rectangle((x0, 0, x0 + TILE - 1, TILE - 1), fill=(46, 62, 78))
    d.rectangle((x0, 0, x0 + TILE - 1, 5), fill=(98, 122, 140))
    d.line((x0, 18, x0 + TILE, 18), fill=(36, 48, 60), width=2)
    x0 = WALL_TOP * TILE
    d.rectangle((x0, 0, x0 + TILE - 1, TILE - 1), fill=(24, 34, 46))
    d.rectangle((x0, 0, x0 + TILE - 1, TILE - 1), outline=(70, 92, 110))
    return im


def station_picture(kind):
    im = Image.new("RGBA", (32, 32))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((2, 4, 29, 30), 3, fill=(60, 78, 96), outline=(12, 20, 30))
    d.rectangle((6, 8, 25, 20), fill=(10, 30, 40))
    if kind == "wires":
        for k, c in enumerate(("#ff5a4f", "#ffd23f", "#4fa3ff", "#3ecf8e")):
            d.line((8, 10 + k * 3, 23, 18 - k * 3), fill=rgb(c), width=1)
    elif kind == "crystals":
        for k, c in enumerate(("#4fe3ff", "#ff6bd6", "#ffb84f")):
            d.polygon([(10 + k * 6, 10), (7 + k * 6, 18), (13 + k * 6, 18)], fill=rgb(c))
    elif kind == "valve":
        d.ellipse((9, 9, 22, 22), outline=(200, 60, 50), width=3)
    else:
        d.rectangle((8, 14, 23, 15), fill=(62, 207, 142))
    d.rectangle((6, 23, 25, 26), fill=(30, 44, 56))
    return im


def beacon_picture():
    im = Image.new("RGBA", (28, 32))
    d = ImageDraw.Draw(im)
    d.rectangle((8, 14, 19, 31), fill=(60, 78, 96), outline=(12, 20, 30))
    d.ellipse((2, 2, 25, 18), fill=(200, 50, 45), outline=(12, 20, 30))
    d.ellipse((7, 5, 14, 9), fill=(255, 150, 140))
    return im


def ocean_picture():
    im = Image.new("RGBA", (256, VIEW_H))
    d = ImageDraw.Draw(im)
    for y in range(VIEW_H):
        k = y / VIEW_H
        d.line((0, y, 256, y), fill=(round(8 + 10 * (1 - k)), round(30 + 40 * (1 - k)), round(55 + 50 * (1 - k))))
    rng = random.Random(9)
    for _ in range(5):                                  # kelp in silhouette
        x = rng.randrange(256)
        for y in range(VIEW_H - rng.randrange(80, 200), VIEW_H, 2):
            d.point((x + round(3 * __import__("math").sin(y / 9)), y), fill=(6, 30, 34))
    for _ in range(30):
        d.point((rng.randrange(256), rng.randrange(VIEW_H)), fill=(70, 140, 170))
    return im


def title_picture():
    im = ocean_picture().resize((VIEW_W, VIEW_H))
    d = ImageDraw.Draw(im)
    for cx, r in ((200, 70), (330, 100), (470, 60)):      # domes of the station on the sea floor
        d.ellipse((cx - r, 300 - r, cx + r, 300 + r), fill=(40, 70, 90), outline=(120, 180, 210), width=2)
        d.ellipse((cx - r // 3, 300 - r // 2, cx - r // 3 + 10, 300 - r // 2 + 10), fill=(255, 200, 110))
    d.rectangle((0, 300, VIEW_W, VIEW_H), fill=(18, 30, 36))
    return im


def icon_picture():
    tile = Image.new("RGBA", (128, 128))
    ImageDraw.Draw(tile).rounded_rectangle((0, 0, 127, 127), radius=22, fill=(16, 52, 78, 255))
    tile.alpha_composite(face(SUITS[0][2]).resize((96, 96), Image.NEAREST), (16, 20))
    return tile


def make_sounds(P):
    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    P.sound("click", tone(0.03, 900, 700, "square", 0.12))
    P.sound("plug", join(tone(0.04, 500, 500, "square", 0.2), tone(0.06, 800, 800, "square", 0.2)))
    P.sound("buzz", tone(0.18, 110, 100, "square", 0.25))
    P.sound("open", lowpass(tone(0.2, 0, 0, "noise", 0.4, seed=4), 0.6, 0.1))
    P.sound("beep", tone(0.06, 1200, 1200, "sine", 0.25))
    P.sound("alarm", join(*[tone(0.18, f, f * 0.8, "square", 0.22) for f in (880, 660, 880, 660)]))
    P.sound("freeze", mix(tone(0.4, 2400, 600, "sine", 0.25), lowpass(tone(0.4, 0, 0, "noise", 0.3, seed=13), 0.9, 0.2)))
    P.sound("done", join(*[tone(0.08, f, f, "tri", 0.3) for f in (523, 659, 784)], tone(0.25, 1047, 1047, "tri", 0.3)))
    # A slow, deep loop: D minor, sonar pings on top.
    melody = [62, 0, 0, 0, 65, 0, 69, 0, 0, 0, 67, 0, 65, 0, 0, 0, 62, 0, 0, 0, 65, 0, 70, 0, 69, 0, 0, 0, 0, 0, 0, 0]
    bass = [38, 38, 38, 38, 34, 34, 34, 34, 36, 36, 36, 36, 38, 38, 38, 38]
    P.sound("music", _tw.music_loop(melody, bass, 70, seed=6), volume=0.6)


# ---------------------------------------------------------------- the map

def station_tiles():
    """The station's tile layer: "column,row" → tile, from station_grid()."""
    grid = MAP["station_grid"]()
    out = {}
    for r in range(ROWS):
        for c in range(COLS):
            g = grid[r][c]
            if g is None:
                continue
            if g == "wall":
                below = grid[r + 1][c] if r + 1 < ROWS else None
                out[f"{c},{r}"] = WALL_FRONT if below not in (None, "wall") else WALL_TOP
            else:
                out[f"{c},{r}"] = FLOORS.index(g)
    return out


def build(out):
    P = Under("Undertow")
    P.p["settings"]["pixelScaling"] = True
    # Rooms of up to 25 (the server allows a game up to 25; others stay at 20).
    P.p["settings"]["netPlayers"] = MAP["MAX_PLAYERS"]
    sizes = {}

    def sprite(name, frames, origin, mask=None, fps=None):
        s = P.sprite(name, frames, origin, mask=mask, fps=fps)
        sizes[name] = (s["width"], s["height"])
        return s

    def picture(name, im, origin=(0, 0)):
        P.picture(name, im, origin)
        sizes[name] = im.size

    # The crew: a sprite a suit, its frames the poses. The box is the feet only, so in
    # three-quarter view a diver's helmet can pass in front of the wall above them.
    for name, _, color in SUITS:
        sprite(f"crew_{name}", crew_frames(color), (16, 43), mask=(8, 32, 24, 44))
        sprite(f"face_{name}", [face(color)], (0, 0))
    for kind in CREW["JOB_OBJECT"]:
        sprite(f"station_{kind}", [station_picture(kind)], (16, 16))
    sprite("beacon", [beacon_picture()], (14, 28))
    sprite("icon", [icon_picture()], (64, 64))
    picture("ocean", ocean_picture())
    picture("title", title_picture())
    ts = P.tileset("station", tiles_picture(), [WALL_FRONT, WALL_TOP])
    P.font("Ubuntu", HERE / "fonts" / "ubuntu-latin-700-normal.woff2")
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
    for name, (head, _) in parsed.items():
        if "depth" not in head and head.get("parent"):
            o = next(x for x in P.p["objects"] if x["name"] == name)
            o["depth"] = int(parsed[head["parent"]][0].get("depth", 0))
    # Crew sprites are picked by suit in Create, so a child without a sprite of its own gets the parent's.
    for name, (head, _) in parsed.items():
        o = next(x for x in P.p["objects"] if x["name"] == name)
        if o["sprite"] is None and head.get("parent") and parsed[head["parent"]][0].get("sprite"):
            o["sprite"] = P.sprite_id(parsed[head["parent"]][0]["sprite"])

    def inst(o, x, y, layer, code=""):
        return {"id": _tw.new_id(), "object": P.obj_id(o), "layer": layer, "x": x, "y": y,
                "scaleX": 1, "scaleY": 1, "angle": 0, "code": code}

    lid = _tw.new_id()
    P.p["rooms"].append({
        "id": _tw.new_id(), "name": "Title", "width": VIEW_W, "height": VIEW_H, "background": "#04121e",
        "gridWidth": 16, "gridHeight": 16, "snap": False,
        "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
        "camera": {"enabled": False, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 1},
        "instances": [inst("Title", 0, 0, lid)],
    })

    lid = _tw.new_id()
    px, py = MAP["tile_middle"](*MAP["START"])
    bx, by = MAP["tile_middle"](*MAP["BEACON"])
    placed = [inst("Director", 0, 0, lid), inst("Lamps", 0, 0, lid), inst("Hud", 0, 0, lid), inst("Beacon", bx, by, lid), inst("Player", px, py, lid)]
    for i, (kind, c, r) in enumerate(MAP["STATIONS"]):
        x, y = MAP["tile_middle"](c, r)
        placed.append(inst("Station", x, y, lid, f'self.i = {i}\nself.kind = "{kind}"\nself.sprite = "station_{kind}"'))
    P.p["rooms"].append({
        "id": _tw.new_id(), "name": "Station", "width": COLS * TILE, "height": ROWS * TILE, "background": "#04121e",
        "gridWidth": TILE, "gridHeight": TILE, "snap": True,
        "layers": [
            {"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False},
            {"id": _tw.new_id(), "name": "Station", "kind": "tiles", "depth": 100, "visible": True, "locked": False,
             "tileset": ts["id"], "tiles": station_tiles()},
            # The sea outside, past every glass wall: it drifts a little slower than the station.
            {"id": _tw.new_id(), "name": "Ocean", "kind": "background", "depth": 1000, "visible": True, "locked": False,
             "color": None, "sprite": P.sprite_id("ocean"), "mode": "tile_x", "hspeed": 0, "vspeed": 0,
             "parallax": 0.5, "parallaxY": 1, "offsetY": 0},
        ],
        "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 1},
        "instances": placed,
    })

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    print(f"{out}  {out.stat().st_size / 1e6:.2f} MB  {len(P.p['objects'])} objects, {len(P.p['sprites'])} sprites")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Undertow.zip")
