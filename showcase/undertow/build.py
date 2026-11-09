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
ART = HERE / "art"


class Under(_climb.Climb):
    def tileset(self, name, image, solid):
        t = super().tileset(name, image, solid)
        t["tileWidth"] = t["tileHeight"] = TILE      # Thornwood's tiles are 16
        return t


# The tileset: the floors in FLOORS' order, then the walls: fronts (a wall with floor
# below it, seen from the room) in several kinds, and a wall's top.
WALLS = ["wall", "wall_porthole", "wall_lamp", "wall_pipes", "wall_glass"]
WALL_FRONT = {name: len(FLOORS) + k for k, name in enumerate(WALLS)}
WALL_TOP = len(FLOORS) + len(WALLS)
SOLID = list(WALL_FRONT.values()) + [WALL_TOP]
# Each kind of job at a machine from the props sheet, and how big it stands (pixels).
MACHINES = {"wires": "desk", "crystals": "reef_tank", "valve": "pump", "scan": "lab_table"}
MACHINE_W = 44
# Things in the rooms (not in the way) and how wide they're drawn.
DECOR_SIZES = {"lockers": 56, "crate": 30, "sub": 96, "hose": 30, "fan": 30, "plant": 26, "bench": 52}
# What swims past outside, and how big.
SEA_LIFE = {"fish": 30, "school": 40, "jelly": 22, "turtle": 40, "ray": 44, "octopus": 32, "angler": 32, "seahorse": 16}


def art(name, k=0.5):
    """A picture from art/ (cut by cut_sheets.py at twice the game's size), scaled by k."""
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    return im if k == 1 else im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def trimmed(im):
    box = im.getbbox()
    return im.crop(box) if box else im


def fitted(name, width):
    """A drawing, trimmed to what's drawn, `width` pixels across."""
    im = trimmed(art(name, 1))
    return im.resize((width, max(1, round(im.height * width / im.width))), Image.LANCZOS)


def covered(im, w, h):
    """The picture filling w × h, cut to fit (the middle kept)."""
    k = max(w / im.width, h / im.height)
    big = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x, y = (big.width - w) // 2, (big.height - h) // 2
    return big.crop((x, y, x + w, y + h))


def wall_tile(name):
    """A square from the middle of a wall piece: its full height, as wide as it is tall."""
    im = trimmed(art(name, 1))
    side = im.height
    x = (im.width - side) // 2
    return im.crop((x, 0, x + side, side)).resize((TILE, TILE), Image.LANCZOS)


def tiles_picture():
    im = Image.new("RGBA", ((len(FLOORS) + len(WALLS) + 1) * TILE, TILE))
    for k, f in enumerate(FLOORS):
        im.alpha_composite(art(f"floor_{f}").resize((TILE, TILE), Image.LANCZOS), (k * TILE, 0))
    for name, k in WALL_FRONT.items():
        im.alpha_composite(wall_tile(name), (k * TILE, 0))
    # A wall's top: the dark of the wall pieces' top edge, with a rim.
    top = Image.new("RGBA", (TILE, TILE), (14, 24, 34, 255))
    ImageDraw.Draw(top).rectangle((0, 0, TILE - 1, TILE - 1), outline=(44, 70, 88, 255))
    im.alpha_composite(top, (WALL_TOP * TILE, 0))
    return im


def icon_picture():
    tile = Image.new("RGBA", (128, 128))
    ImageDraw.Draw(tile).rounded_rectangle((0, 0, 127, 127), radius=22, fill=(16, 52, 78, 255))
    tile.alpha_composite(art("face_coral", 1).resize((104, 104), Image.LANCZOS), (12, 12))
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

def wall_kind(c, r, below):
    """Which wall a front is: glass where Observation looks out, else plain with now and then a porthole, a lamp or pipes."""
    if below == "glass":
        return "wall_glass"
    k = (c * 7 + r * 3) % 13
    return "wall_porthole" if k == 0 else "wall_lamp" if k == 5 else "wall_pipes" if k == 9 else "wall"


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
                if below in (None, "wall"):
                    out[f"{c},{r}"] = WALL_TOP
                else:
                    out[f"{c},{r}"] = WALL_FRONT[wall_kind(c, r, below)]
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
    poses = ["stand", "walk1", "walk2", "work", "frozen", "ghost"]
    for name, _, _ in SUITS:
        sprite(f"crew_{name}", [art(f"crew_{name}_{pose}") for pose in poses], (20, 47), mask=(12, 38, 28, 48))
        sprite(f"face_{name}", [art(f"face_{name}")], (0, 0))
    for kind, machine in MACHINES.items():
        im = fitted(machine, MACHINE_W)
        sprite(f"station_{kind}", [im], (im.width // 2, im.height - 8))
        # The job's screen: its panel picture, cut to the panel's shape.
        x0, y0, x1, y1 = CREW["PANEL"]
        picture(f"panel_{kind}", covered(art(f"panel_{kind}", 1), x1 - x0, y1 - y0))
    im = fitted("beacon", 30)
    sprite("beacon", [im], (im.width // 2, im.height - 4))
    for name, width in DECOR_SIZES.items():
        im = fitted(name, width)
        sprite(name, [im], (im.width // 2, im.height))
    for name in ("mimic_suit", "mimic_open", "mimic_shown"):
        sprite(name, [art(name)], (32, 64))
    sprite("ice_burst", [fitted("ice_burst", 56)], (28, 28))
    for name, width in SEA_LIFE.items():
        im = fitted(name, width)
        sprite(name, [im], (im.width // 2, im.height // 2))
    sprite("icon", [icon_picture()], (64, 64))
    sea = art("ocean", 1)
    picture("ocean", sea.resize((round(VIEW_H * sea.width / sea.height), VIEW_H), Image.LANCZOS))
    picture("title", covered(art("title", 1), VIEW_W, VIEW_H))
    picture("meeting_room", covered(art("meeting_room", 1), VIEW_W, VIEW_H))
    ts = P.tileset("station", tiles_picture(), SOLID)
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
    placed.append(inst("Sea", 0, 0, lid))
    for name, c, r in MAP["DECOR"]:
        placed.append(inst("Decor", c * TILE + TILE // 2, (r + 1) * TILE, lid, f'self.sprite = "{name}"'))
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
