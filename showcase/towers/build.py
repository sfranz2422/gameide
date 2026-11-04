#!/usr/bin/env python3
"""
Builds the ninth showcase game, "Fort Bramble", as a GameIDE project zip: a
tower defense on real rooms, tiles and objects.

    python3 showcase/towers/build.py      # → showcase/towers/out/Towers.zip

The pictures are Kenney's Tower Defense pack (CC0), as the editor's art library
has it, and every level is built here from its numbers in game/_1levels.py:
the road's tiles, the Gate and Fort at its ends, the trees and rocks, and the
buttons, all placed as a student would place them in the room editor. Enemies
walk the same numbers. A level that can't be played stops the build
(level_problems).

THE GAME IS OBJECTS. Tower, Enemy, Shot, Decor and Button are parents; a new
tower or enemy is a child with its own numbers. Buttons use real Mouse events.
"""
import importlib.util
import json
import math
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
SHEET = Image.open(HERE.parent.parent / "frontend/public/library/kenney/tower-defense/tiles-towers-and-enemies.png").convert("RGBA")
GAME = {}
exec((HERE / "game" / "_1levels.py").read_text(), GAME)
LEVELS, CELL, COLS, ROWS = GAME["LEVELS"], GAME["CELL"], GAME["COLS"], GAME["ROWS"]
VIEW_W, VIEW_H = 1024, 576
ROAD_W = 44            # how wide the road is painted, in a 64-pixel cell


class Towers(_tw.Project):
    def write(self, path):
        import zipfile
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n"
                       "Pictures: Kenney's Tower Defense pack (kenney.nl), CC0.\n")


def tile(n):
    """One 64-pixel picture off Kenney's sheet."""
    x, y = n % 23 * 64, n // 23 * 64
    return SHEET.crop((x, y, x + 64, y + 64))


def over(*parts):
    out = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    for p in parts:
        out.alpha_composite(p)
    return out


def tinted(im, colour, k=0.6):
    """A picture leaning towards a colour, keeping its shading."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (round(r + (colour[0] - r) * k), round(g + (colour[1] - g) * k), round(b + (colour[2] - b) * k), a)
    return out


# ---------------------------------------------------------------- the road, as autotiles

def road_tileset(level, name):
    """Sixteen pieces of road on the level's ground, one per way a cell joins its
    neighbours (up 1, right 2, down 4, left 8), then the plain ground. Marked as an
    autotile set, so a student painting more road in the editor gets the right pieces."""
    ground, road = tile(level["ground"]), tile(level["road"])
    out = Image.new("RGBA", (64 * 17, 64))
    half = ROAD_W // 2
    lo, hi = 32 - half, 32 + half
    for mask in range(16):
        shape = Image.new("L", (64, 64), 0)
        d = ImageDraw.Draw(shape)
        d.rounded_rectangle((lo, lo, hi - 1, hi - 1), radius=8, fill=255)
        if mask & 1:
            d.rectangle((lo, 0, hi - 1, 32), fill=255)
        if mask & 2:
            d.rectangle((32, lo, 63, hi - 1), fill=255)
        if mask & 4:
            d.rectangle((lo, 32, hi - 1, 63), fill=255)
        if mask & 8:
            d.rectangle((0, lo, 32, hi - 1), fill=255)
        edge = Image.new("L", (64, 64), 0)
        ImageDraw.Draw(edge).rectangle((0, 0, 63, 63), fill=0)
        piece = ground.copy()
        shade = Image.new("RGBA", (64, 64), (0, 0, 0, 70))
        grown = shape.resize((64, 64))
        for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2)):
            piece.paste(shade, (dx, dy), grown)
        piece = ground.copy() if False else piece
        piece.paste(road, (0, 0), shape)
        out.paste(piece, (mask * 64, 0))
    out.paste(ground, (16 * 64, 0))
    t = {"id": _tw.new_id(), "name": name, "image": None, "imageWidth": out.width, "imageHeight": 64, "tileWidth": 64, "tileHeight": 64,
         "offsetX": 0, "offsetY": 0, "spacingX": 0, "spacingY": 0, "solid": [],
         "autotiles": [{"id": _tw.new_id(), "name": "road", "tiles": list(range(16))}]}
    return t, out


def road_map(cells):
    """Each road cell's piece, from the cells beside it. The ends run off towards their neighbour."""
    have = set(cells)
    out = {}
    for c, r in cells:
        mask = (1 if (c, r - 1) in have else 0) | (2 if (c + 1, r) in have else 0) | (4 if (c, r + 1) in have else 0) | (8 if (c - 1, r) in have else 0)
        out[f"{c},{r}"] = mask
    return out


# ---------------------------------------------------------------- pictures of our own

def panel(w, h):
    S = 4
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w * S - 1, h * S - 1), radius=8 * S, fill=(58, 72, 104, 255), outline=(22, 26, 44, 255), width=2 * S)
    d.rounded_rectangle((3 * S, 3 * S, (w - 3) * S, (h - 3) * S), radius=6 * S, outline=(100, 120, 160, 255), width=S)
    return im.resize((w, h), Image.LANCZOS)


def fort_picture():
    S = 4
    im = Image.new("RGBA", (64 * S, 64 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((6 * S, 16 * S, 58 * S, 60 * S), fill=(120, 128, 140, 255), outline=(50, 54, 70, 255), width=2 * S)
    for x in range(6, 58, 13):
        d.rectangle((x * S, 8 * S, (x + 7) * S, 18 * S), fill=(120, 128, 140, 255), outline=(50, 54, 70, 255), width=2 * S)
    d.rounded_rectangle((24 * S, 38 * S, 40 * S, 60 * S), radius=7 * S, fill=(70, 46, 34, 255))
    d.line((32 * S, 8 * S, 32 * S, -1), fill=(50, 54, 70, 255), width=2 * S)
    return im.resize((64, 64), Image.LANCZOS)


def gate_picture():
    S = 4
    im = Image.new("RGBA", (64 * S, 64 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((6 * S, 6 * S, 58 * S, 58 * S), fill=(40, 24, 40, 255), outline=(200, 70, 60, 255), width=3 * S)
    d.ellipse((16 * S, 16 * S, 48 * S, 48 * S), fill=(16, 10, 20, 255))
    return im.resize((64, 64), Image.LANCZOS)


# ---------------------------------------------------------------- sounds

def make_sounds(P):
    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    P.sound("shot", tone(0.05, 900, 400, "square", 0.14))
    P.sound("boom", mix(lowpass(tone(0.35, 0, 0, "noise", 0.6, seed=3), 0.4, 0.05), tone(0.2, 120, 40, "sine", 0.6)))
    P.sound("coin", join(tone(0.05, 1320, 1320, "square", 0.16), tone(0.14, 1760, 1760, "square", 0.16)))
    P.sound("build", join(tone(0.05, 220, 220, "square", 0.25), tone(0.08, 330, 330, "square", 0.25)))
    P.sound("upgrade", join(*[tone(0.06, f, f, "tri", 0.35) for f in (523, 659, 784, 1047)]))
    P.sound("click", tone(0.03, 900, 700, "square", 0.12))
    P.sound("nope", tone(0.14, 180, 140, "square", 0.2))
    P.sound("wave", join(tone(0.16, 330, 330, "square", 0.2), tone(0.28, 440, 440, "square", 0.22)))
    P.sound("hit", mix(tone(0.3, 160, 50, "square", 0.3), lowpass(tone(0.25, 0, 0, "noise", 0.5, seed=5), 0.3, 0.05)))
    P.sound("win", join(*[tone(0.12, f, f, "square", 0.2) for f in (523, 659, 784)], tone(0.5, 1047, 1047, "square", 0.22)))
    P.sound("lose", join(*[tone(0.2, f, f, "square", 0.2) for f in (392, 330, 262)], tone(0.5, 196, 196, "square", 0.22)))


# ---------------------------------------------------------------- the project

def circle(P, name, frames, r, origin=(32, 32)):
    s = P.sprite(name, frames, origin)
    s["mask"] = {"kind": "circle", "cx": origin[0], "cy": origin[1], "r": r}
    return s


def event_key(name, P):
    parts = name.split()
    if parts[0] == "mouse":
        glob = parts[1] == "global"
        edge, button = parts[-2], parts[-1]
        return {"type": "mouse", "button": button, "edge": edge, "global": glob}
    return _tw.event_key(name, P)


def build(out):
    problems = [f"{l['name']}: {w}" for l in LEVELS for w in GAME["level_problems"](l)]
    if problems:
        raise SystemExit("The levels:\n  " + "\n  ".join(problems))
    P = Towers("Fort Bramble")
    P.p["settings"]["scoreboard"] = {"unit": "points"}
    P.p["settings"]["pixelScaling"] = False

    # Towers: a base the object draws, and a turret it turns.
    for k, n in enumerate((180, 181, 182, 183)):
        s = P.sprite(f"base_{k + 1}", [tile(n)], (32, 32), mask=(4, 4, 60, 60))
    P.sprite("top_gun", [tile(203)], (32, 32))
    P.sprite("top_cannon", [tile(226)], (32, 32))
    P.sprite("top_rocket", [tile(206)], (32, 32))
    P.sprite("top_freeze", [tinted(tile(227), (120, 210, 255))], (32, 32))
    # Shots.
    circle(P, "pellet", [tile(272)], 8)
    circle(P, "shell", [tile(274)], 8)
    circle(P, "missile", [tile(251)], 8)
    circle(P, "snowball", [tile(275)], 8)
    # Enemies: Kenney's tanks are a body and a turret, here made one picture.
    circle(P, "scout", [tile(247)], 10)
    circle(P, "soldier", [tile(245)], 11)
    circle(P, "tank", [over(tile(268), tile(291))], 20)
    circle(P, "heavy", [over(tile(269), tile(292))], 22)
    circle(P, "plane", [tile(270)], 18)
    circle(P, "boss", [tinted(over(tile(269), tile(292)), (220, 60, 50), 0.55)], 22)
    # The field.
    circle(P, "tree", [tile(130)], 26)
    circle(P, "bush", [tile(131)], 14)
    circle(P, "rock", [tile(136)], 20)
    circle(P, "fort", [fort_picture()], 26)
    circle(P, "gate", [gate_picture()], 26)
    P.sprite("button", [panel(122, 56)], (0, 0), mask=(0, 0, 122, 56))
    P.sprite("card", [panel(232, 62)], (0, 0), mask=(0, 0, 232, 62))
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

    def room(name, level, placed):
        t, pic = road_tileset(level, name + " tiles")
        t["image"] = P.asset(_tw.png_bytes(pic), "png")
        P.p["tilesets"].append(t)
        lid, gid, rid = _tw.new_id(), _tw.new_id(), _tw.new_id()
        cells = GAME["road_cells"](level)
        ground = {f"{c},{r}": 16 for c in range(COLS) for r in range(ROWS + 1)}
        P.p["rooms"].append({
            "id": _tw.new_id(), "name": name, "width": VIEW_W, "height": VIEW_H, "background": "#26304a",
            "gridWidth": 64, "gridHeight": 64, "snap": True,
            "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False},
                       {"id": rid, "name": "Road", "kind": "tiles", "depth": 90, "visible": True, "locked": False, "tileset": t["id"], "tiles": road_map(cells)},
                       {"id": gid, "name": "Ground", "kind": "tiles", "depth": 100, "visible": True, "locked": False, "tileset": t["id"], "tiles": ground}],
            "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 0},
            "instances": [{"id": _tw.new_id(), "object": P.obj_id(o), "layer": lid, "x": x, "y": y,
                           "scaleX": 1, "scaleY": 1, "angle": 0, "code": code} for o, x, y, code in placed],
        })

    # The title first: the game starts in the first room.
    cards = [("LevelCard", 44 + i * 322, 240, f"self.i = {i}\n") for i in range(len(LEVELS))]
    room("Title", LEVELS[0], [("Title", 0, 0, "")] + cards)
    for level in LEVELS:
        pts = level["path"]
        mid = lambda c, r: GAME["cell_middle"](c, r)
        placed = [("Director", 0, 0, ""), ("Hud", 0, 0, ""),
                  ("Gate", *mid(*pts[0]), ""), ("Fort", *mid(*pts[-1]), "")]
        for what, c, r in level["decor"]:
            placed.append((what.capitalize(), *mid(c, r), ""))
        y = 8 * 64 + 4
        for k, kind in enumerate(("Gunner", "Cannon", "Rocket", "Freezer")):
            placed.append(("BuyButton", 6 + k * 126, y, f'self.kind = "{kind}"\n'))
        placed += [("UpgradeButton", 520, y, ""), ("SellButton", 646, y, ""), ("WaveButton", 896, y, "")]
        room(level["name"], level, placed)

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(LEVELS)} levels, {len(P.p['objects'])} objects")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Towers.zip")
