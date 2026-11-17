#!/usr/bin/env python3
"""
Builds the showcase game "Cloverbrook" as a GameIDE project zip: a farm that grows
into a town (in the genre of Township, but its own). Phase 1: the farm — fields and
four crops growing on the real clock, the barn, the order board, coins, XP and
levels, buying fields — on an isometric map you drag around.

    python3 showcase/farm/build.py      # → showcase/farm/out/Farm.zip (and project.json)

The pictures are the teacher's Gemini art (PROMPTS.md), cut into art/ by
cut_sheets.py at twice the game's size. A picture missing from art/ gets a plain
stand-in, so the game still builds.

THE GAME IS OBJECTS: Title and Farm are the screens; on the map, each field is a
Field, each building, tree and rock a Thing, and the land one Ground picture made
here from the map in the rules (grass, the dirt road, the island's earthy edge).
Every number is game/_1rules.py; every rule of the farm is game/_2farm.py.
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
GAME = {}
exec((HERE / "game" / "_1rules.py").read_text(), GAME)
G = GAME
VIEW_W, VIEW_H, TW, TH = G["VIEW_W"], G["VIEW_H"], G["TILE_W"], G["TILE_H"]
ART = HERE / "art"
ICONS = ["wheat", "corn", "carrot", "pumpkin", "seeds", "coin", "star", "level", "lock", "clock",
         "sickle", "can", "crate", "barn", "order", "hammer", "saw", "axe", "pickaxe", "shovel"]
NATURE = ["soil", "soil_wet", "grass_flowers", "path", "fence", "gate", "boulder", "bush", "oak", "pine", "stump", "pond"]


class Farm(_tw.Project):
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
                       "Pictures made with Google Gemini. Type: Ubuntu (Ubuntu Font Licence).\n")


def half(name):
    """One of the teacher's pictures at the game's size (art/ keeps them at twice)."""
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    return im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.LANCZOS)


def stand_in(tiles, colour):
    """A plain diamond, for a picture not cut yet."""
    w, h = TW * tiles, TH * tiles
    im = Image.new("RGBA", (w, h + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(w / 2, 0), (w, h / 2), (w / 2, h), (0, h / 2)], fill=colour, outline=(40, 30, 20))
    return im


def standing(name, tiles=1, colour=(120, 90, 60)):
    """A picture standing on its ground diamond, and its origin: the diamond's middle."""
    im = half(name) if (ART / f"{name}.png").exists() else stand_in(tiles, colour)
    return im, (im.width // 2, im.height - TH * tiles // 2)


# ---------------------------------------------------------------- the land

def tile_xy(gx, gy):
    return G["ORIGIN_X"] + (gx - gy) * TW / 2, G["ORIGIN_Y"] + (gx + gy) * TH / 2


def make_ground():
    """The whole map as one picture: a grassy island with an earthy edge, and the dirt
    road (Gemini's path tile, mirrored where the road turns along the other axis)."""
    W, H = G["WORLD_W"], G["WORLD_H"]
    im = Image.new("RGBA", (W, H), (62, 112, 58, 255))
    d = ImageDraw.Draw(im)
    rng = random.Random(4)
    mw, mh = G["MAP_W"], G["MAP_H"]
    # The island's edge: earth below the front two sides.
    top, right, bottom, left = tile_xy(-0.5, -0.5), tile_xy(mw - 0.5, -0.5), tile_xy(mw - 0.5, mh - 0.5), tile_xy(-0.5, mh - 0.5)
    for k, col in ((34, (92, 62, 36)), (20, (120, 82, 46))):
        d.polygon([left, bottom, right, (right[0], right[1] + k), (bottom[0], bottom[1] + k), (left[0], left[1] + k)], fill=col)
    # Grass, tile by tile, a little different each, with tufts.
    for gx in range(mw):
        for gy in range(mh):
            x, y = tile_xy(gx, gy)
            g = 150 + rng.randint(-6, 6)
            d.polygon([(x, y - TH / 2), (x + TW / 2, y), (x, y + TH / 2), (x - TW / 2, y)], fill=(96, g + 26, 62))
            for _ in range(5):
                tx, ty = x + rng.uniform(-TW / 4, TW / 4), y + rng.uniform(-TH / 5, TH / 5)
                d.line([(tx, ty), (tx - 2, ty - 5)], fill=(70, 140, 50), width=2)
                d.line([(tx, ty), (tx + 2, ty - 5)], fill=(120, 190, 80), width=2)
    # The road: its tiles back to front, so each covers the edge of the one behind.
    road = set(G["ROAD"])
    if (ART / "path.png").exists():
        path = half("path")
        for gx, gy in sorted(road, key=lambda t: t[0] + t[1]):
            along_gx = (gx - 1, gy) in road or (gx + 1, gy) in road
            along_gy = (gx, gy - 1) in road or (gx, gy + 1) in road
            tile = path.transpose(Image.FLIP_LEFT_RIGHT) if along_gx and not along_gy else path
            x, y = tile_xy(gx, gy)
            im.alpha_composite(tile, (int(x - tile.width / 2), int(y - TH / 2)))
    return im


# ---------------------------------------------------------------- sounds

def make_sounds(P):
    tone, join, lowpass = _tw.tone, _tw.join, _tw.lowpass
    P.sound("click", tone(0.03, 900, 700, "square", 0.12))
    P.sound("nope", join(tone(0.08, 260, 200, "square", 0.15), tone(0.12, 180, 140, "square", 0.15)))
    P.sound("plant", lowpass(tone(0.12, 0, 0, "noise", 0.3, seed=5), 0.2, 0.05))
    P.sound("harvest", join(tone(0.05, 600, 900, "sine", 0.35), tone(0.08, 900, 1300, "sine", 0.3)))
    P.sound("coin", join(tone(0.05, 1568, 1568, "square", 0.16), tone(0.16, 2093, 2093, "square", 0.13)))
    P.sound("levelup", join(*[tone(0.09, f, f, "tri", 0.3) for f in (523, 659, 784, 1047)], tone(0.4, 1319, 1319, "tri", 0.25)))


# ---------------------------------------------------------------- the project

def build(out):
    P = Farm("Cloverbrook")
    # The board: each player's level (the teacher's choice): it measures everything, and only goes up.
    P.p["settings"]["scoreboard"] = {"unit": "level"}
    P.p["settings"]["pixelScaling"] = False
    P.font("Ubuntu", HERE.parent / "undertow" / "fonts" / "ubuntu-latin-700-normal.woff2")

    for crop in G["CROPS"]:
        for s in range(G["STAGES"]):
            im, origin = standing(f"crop_{crop}_{s}")
            P.sprite(f"crop_{crop}_{s}", [im], origin)
    for name in NATURE:
        im, origin = standing(name, 1, (110, 160, 80))
        P.sprite(name, [im], origin)
    for kind, tiles in G["FOOTPRINT"].items():
        im, origin = standing(kind, tiles, (170, 60, 50))
        P.sprite(kind, [im], origin)
    for name in ICONS:
        pic = half(f"icon_{name}") if (ART / f"icon_{name}.png").exists() else stand_in(1, (240, 220, 180)).resize((64, 64))
        P.sprite(f"icon_{name}", [pic], (32, 32))
    title = half("title") if (ART / "title.png").exists() else Image.new("RGBA", (VIEW_W, VIEW_H), (120, 190, 240, 255))
    P.sprite("title", [title], (0, 0))
    P.sprite("ground", [make_ground()], (0, 0))
    icon = half("icon_wheat").resize((64, 64)) if (ART / "icon_wheat.png").exists() else stand_in(1, (240, 200, 60)).resize((64, 64))
    P.sprite("icon", [icon], (0, 0))
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

    def room(name, w, h, placed, colour="#3e7038"):
        lid = _tw.new_id()
        P.p["rooms"].append({
            "id": _tw.new_id(), "name": name, "width": w, "height": h, "background": colour,
            "gridWidth": 16, "gridHeight": 16, "snap": False,
            "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
            "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 0},
            "instances": [{"id": _tw.new_id(), "object": P.obj_id(o), "layer": lid, "x": x, "y": y,
                           "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""} for o, x, y in placed],
        })

    # The title first: the game starts in the first room.
    room("Title", VIEW_W, VIEW_H, [("Title", 0, 0)], "#78bef0")
    room("Farm", G["WORLD_W"], G["WORLD_H"], [("Farm", 0, 0)])

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    pictures = sum(1 for _ in ART.glob("*.png")) if ART.exists() else 0
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(P.p['objects'])} objects, {pictures} of the teacher's pictures")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Farm.zip")
