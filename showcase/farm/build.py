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
         "sickle", "can", "crate", "barn", "order", "hammer", "saw", "axe", "pickaxe", "shovel",
         # phase 2: the goods, the new crops, and a wheelbarrow
         "chicken_feed", "cow_feed", "sheep_feed", "egg", "milk", "wool", "bread", "corn_bread", "pie", "cream",
         "cheese", "butter", "sugarcane", "sugar", "cookies", "yarn", "sweater", "strawberry", "jam", "wheelbarrow",
         # phase 3: the town
         "people", "house", "road", "move", "rent",
         # phase 4: the valley
         "nails", "planks", "paint", "fish", "gold", "apple", "cherry", "apple_juice", "cherry_juice", "train", "land", "up",
         # phase 5: awards, the week's event, the seasons
         "trophy", "ribbon", "gift", "calendar", "spring", "summer", "autumn", "winter"]
ANIMALS = {"chicken": (250, 250, 245), "cow": (240, 240, 240), "sheep": (245, 245, 235)}
POSES = ["stand", "walk", "eat", "ready"]
BUILT_COLOURS = {"coop": (200, 150, 90), "cowshed": (190, 70, 60), "sheep_pen": (170, 140, 110), "feed_mill": (200, 170, 110),
                 "bakery": (220, 120, 80), "dairy": (235, 235, 240), "sugar_mill": (150, 180, 210), "weaving_mill": (170, 120, 190),
                 "jam_kitchen": (220, 90, 120),
                 "cottage": (240, 210, 160), "family_house": (150, 190, 230), "townhouse": (230, 160, 140), "manor": (235, 225, 200),
                 "fountain": (170, 200, 220), "park": (90, 170, 90), "school": (210, 80, 70), "cafe": (240, 180, 90),
                 "town_hall": (220, 220, 230), "library": (160, 110, 80),
                 "station": (200, 90, 70), "dock": (170, 130, 90), "mine": (120, 110, 100), "juice_press": (240, 170, 60)}
TREE_FRUIT = {"apple_tree": (220, 40, 40), "cherry_tree": (150, 20, 50)}
PEOPLE_COLOURS = {"girl": (230, 90, 140), "boy": (70, 130, 220), "woman": (120, 180, 90), "grandpa": (150, 120, 90)}
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


def stand_in_building(kind):
    """A block with a roof on its grass diamond, in the building's colour, for a picture
    not cut yet."""
    tiles = G["FOOTPRINT"][kind]
    w, h = TW * tiles, TH * tiles
    top = 90
    im = Image.new("RGBA", (w, h + top), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = w / 2, top + h / 2
    d.polygon([(cx, top), (w, cy), (cx, top + h), (0, cy)], fill=(110, 170, 80), outline=(50, 80, 40))
    col = BUILT_COLOURS.get(kind, (180, 140, 100))
    dark = tuple(int(c * 0.75) for c in col)
    bw, bh = w * 0.32, h * 0.32
    base = cy + 4
    d.polygon([(cx - bw, base), (cx, base + bh), (cx, base + bh - 70), (cx - bw, base - 70)], fill=col, outline=(60, 40, 20))
    d.polygon([(cx, base + bh), (cx + bw, base), (cx + bw, base - 70), (cx, base + bh - 70)], fill=dark, outline=(60, 40, 20))
    d.polygon([(cx - bw - 6, base - 70), (cx, base + bh - 70), (cx + bw + 6, base - 70), (cx, base - 70 - bh - 26)], fill=(150, 60, 50), outline=(60, 30, 20))
    return im


def stand_in_animal(animal, pose):
    im = Image.new("RGBA", (48, 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    col = ANIMALS[animal]
    y = 4 if pose == "walk" else 6
    if animal == "chicken":
        d.ellipse((14, 14 + y - 6, 34, 34), fill=col, outline=(80, 60, 40))
        d.ellipse((26, 8 + y - 6 + (6 if pose == "eat" else 0), 36, 18 + y - 6 + (6 if pose == "eat" else 0)), fill=col, outline=(80, 60, 40))
        d.polygon([(30, 6 + y - 6), (34, 6 + y - 6), (32, 2 + y - 6)], fill=(220, 40, 40))
    else:
        d.ellipse((6, 12 + y - 6, 40, 34), fill=col, outline=(60, 50, 40))
        hx = 34 if pose != "eat" else 36
        d.ellipse((hx - 6, 10 + y - 6 + (8 if pose == "eat" else 0), hx + 8, 24 + y - 6 + (8 if pose == "eat" else 0)), fill=col, outline=(60, 50, 40))
        if animal == "cow":
            d.ellipse((14, 16, 24, 26), fill=(40, 40, 40))
    if pose == "ready":
        d.ellipse((2, 26, 14, 38), fill=(255, 220, 120), outline=(120, 80, 20))
    return im


def stand_in_person(who, pose, frame):
    """A little figure facing left, for a townsperson not drawn yet: front or back, two steps."""
    im = Image.new("RGBA", (32, 56), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    shirt = PEOPLE_COLOURS[who]
    small = who in ("girl", "boy")
    top = 14 if small else 4
    step = 3 if frame else -3
    d.line([(14, 44), (14 - step, 54)], fill=(60, 50, 70), width=4)
    d.line([(19, 44), (19 + step, 54)], fill=(60, 50, 70), width=4)
    d.rounded_rectangle((8, top + 14, 25, 46), radius=5, fill=shirt, outline=(50, 30, 20))
    d.ellipse((8, top, 24, top + 16), fill=(240, 200, 160) if pose == "front" else (110, 70, 40), outline=(50, 30, 20))
    if pose == "front":
        d.ellipse((11, top + 6, 13, top + 8), fill=(30, 20, 10))
    return im


def stand_in_tree(kind, fruit):
    """A round fruit tree on its grass diamond, its fruit on or not, for a picture not cut yet."""
    im = Image.new("RGBA", (TW, TH + 110), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = TW / 2, 110 + TH / 2
    d.polygon([(cx, 110), (TW, cy), (cx, 110 + TH), (0, cy)], fill=(110, 170, 80), outline=(50, 80, 40))
    d.rectangle((cx - 6, cy - 50, cx + 6, cy + 4), fill=(110, 70, 40), outline=(60, 40, 20))
    d.ellipse((cx - 44, cy - 120, cx + 44, cy - 34), fill=(70, 150, 60), outline=(40, 80, 30))
    if fruit:
        rng = random.Random(kind)
        for _ in range(9):
            x, y = cx + rng.uniform(-30, 30), cy + rng.uniform(-104, -50)
            d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=TREE_FRUIT[kind], outline=(70, 20, 20))
    return im


def stand_in_sign():
    im = Image.new("RGBA", (64, 90), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((29, 30, 35, 86), fill=(120, 80, 40), outline=(60, 40, 20))
    d.rectangle((8, 10, 56, 44), fill=(240, 220, 170), outline=(90, 60, 30), width=3)
    d.ellipse((24, 18, 40, 36), fill=(240, 190, 40), outline=(120, 80, 10))
    return im


def stand_in_car(engine, loaded):
    """A train car on the railway, going down-right along gx, for a picture not cut yet."""
    im = Image.new("RGBA", (130, 110), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    body = (60, 70, 90) if engine else (150, 90, 50)
    # A box drawn along the diamond's down-right edge.
    pts = [(10, 50), (100, 95), (120, 85), (30, 40)]
    d.polygon([(x, y - 30) for x, y in pts], fill=tuple(min(255, c + 40) for c in body), outline=(30, 20, 10))
    d.polygon([(10, 50 - 30), (100, 95 - 30), (100, 95), (10, 50)], fill=body, outline=(30, 20, 10))
    d.polygon([(100, 95 - 30), (120, 85 - 30), (120, 85), (100, 95)], fill=tuple(int(c * 0.7) for c in body), outline=(30, 20, 10))
    for x in (28, 82):
        d.ellipse((x - 9, 50 + (x - 10) / 2 - 2, x + 9, 50 + (x - 10) / 2 + 16), fill=(40, 40, 40))
    if engine:
        d.rectangle((84, 20, 96, 48), fill=(40, 40, 50), outline=(20, 20, 20))
        d.rectangle((20, 0, 50, 34), fill=(200, 60, 50), outline=(30, 20, 10))
    elif loaded:
        for k, (x, y) in enumerate(((36, 18), (60, 30), (84, 42))):
            d.rectangle((x - 10, y - 12, x + 10, y + 8), fill=(220, 170, 90), outline=(90, 60, 20))
    return im


def stand_in_icon(name):
    from PIL import ImageFont
    im = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((2, 2, 62, 62), radius=12, fill=(250, 240, 215), outline=(90, 60, 40), width=2)
    rng = random.Random(name)
    d.ellipse((14, 10, 50, 46), fill=(rng.randint(120, 230), rng.randint(90, 200), rng.randint(60, 160)))
    font = ImageFont.load_default(size=13)
    words = name.replace("_", " ")[:9]
    d.text((32 - d.textlength(words, font=font) / 2, 46), words, font=font, fill=(70, 40, 20))
    return im


def stand_in_crop(crop, stage):
    im = Image.new("RGBA", (TW, TH + 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = TW / 2, 30 + TH / 2
    d.polygon([(cx, 30), (TW, cy), (cx, 30 + TH), (0, cy)], fill=(110, 70, 40), outline=(60, 40, 20))
    rng = random.Random(f"{crop}{stage}")
    for _ in range(9):
        x, y = cx + rng.uniform(-36, 36), cy + rng.uniform(-14, 14)
        h = 6 + stage * 9
        d.line([(x, y), (x, y - h)], fill=(80, 170, 60), width=3)
        if stage == 3:
            col = (220, 40, 40) if crop == "strawberry" else (120, 200, 90)
            d.ellipse((x - 4, y - h - 4, x + 4, y - h + 4), fill=col)
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
    # The lake: a band of sand outside every edge where water meets grass, then the water
    # (whole diamonds, so neighbouring tiles join with no seam), and ripples.
    lake = set(G["LAKE"])
    sand = 12
    for gx, gy in lake:
        x, y = tile_xy(gx, gy)
        top, right, bottom, left = (x, y - TH / 2), (x + TW / 2, y), (x, y + TH / 2), (x - TW / 2, y)
        # Each side of the diamond, and the neighbour beyond it.
        for (dx, dy), (u, v) in (((0, -1), (top, right)), ((1, 0), (right, bottom)), ((0, 1), (bottom, left)), ((-1, 0), (left, top))):
            if (gx + dx, gy + dy) in lake:
                continue
            mx, my = (u[0] + v[0]) / 2 - x, (u[1] + v[1]) / 2 - y          # outwards from the middle
            ln = (mx * mx + my * my) ** 0.5
            ox, oy = mx / ln * sand, my / ln * sand
            d.polygon([u, v, (v[0] + ox, v[1] + oy), (u[0] + ox, u[1] + oy)], fill=(214, 196, 140))
            for w in (u, v):
                d.ellipse((w[0] - sand, w[1] - sand / 2, w[0] + sand, w[1] + sand / 2), fill=(214, 196, 140))
    for gx, gy in lake:
        x, y = tile_xy(gx, gy)
        d.polygon([(x, y - TH / 2), (x + TW / 2, y), (x, y + TH / 2), (x - TW / 2, y)], fill=(70, 150, 200))
    for gx, gy in sorted(lake):
        x, y = tile_xy(gx, gy)
        for _ in range(2):
            rx, ry = x + rng.uniform(-30, 30), y + rng.uniform(-10, 10)
            d.arc((rx - 12, ry - 4, rx + 12, ry + 4), 200, 340, fill=(190, 230, 250), width=2)
    # The railway: sleepers across, two rails along gx.
    if (ART / "rail.png").exists():
        rail = half("rail")
        for gx, gy in G["RAIL"]:
            x, y = tile_xy(gx, gy)
            im.alpha_composite(rail, (int(x - rail.width / 2), int(y - TH / 2)))
    else:
        for gx, gy in G["RAIL"]:
            x, y = tile_xy(gx, gy)
            d.polygon([(x, y - TH / 2), (x + TW / 2, y), (x, y + TH / 2), (x - TW / 2, y)], fill=(150, 130, 100))
            for k in range(4):
                a = -0.5 + (k + 0.5) / 4
                sx, sy = x + a * TW / 2, y + a * TH / 2
                d.line([(sx + 22, sy - 11), (sx - 22, sy + 11)], fill=(110, 70, 40), width=6)
        for off in (-12, 12):
            a = tile_xy(G["RAIL"][0][0] - 0.5, G["RAIL_GY"])
            b = tile_xy(G["RAIL"][-1][0] + 0.5, G["RAIL_GY"])
            d.line([(a[0] + off, a[1] - off / 2), (b[0] + off, b[1] - off / 2)], fill=(90, 90, 100), width=4)
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
            if (ART / f"crop_{crop}_{s}.png").exists():
                im, origin = standing(f"crop_{crop}_{s}")
            else:
                im = stand_in_crop(crop, s)
                origin = (im.width // 2, im.height - TH // 2)
            P.sprite(f"crop_{crop}_{s}", [im], origin)
    for name in NATURE:
        im, origin = standing(name, 1, (110, 160, 80))
        P.sprite(name, [im], origin)
    for kind, tiles in G["FOOTPRINT"].items():
        if kind in G["TREES"]:
            frames = [half(f"{kind}_{k}") if (ART / f"{kind}_{k}.png").exists() else stand_in_tree(kind, k) for k in range(2)]
            P.sprite(kind, frames, (frames[0].width // 2, frames[0].height - TH // 2))
            continue
        if (ART / f"{kind}.png").exists():
            im, origin = standing(kind, tiles)
        else:
            im = stand_in_building(kind)
            origin = (im.width // 2, im.height - TH * tiles // 2)
        P.sprite(kind, [im], origin)
    sign = half("sign") if (ART / "sign.png").exists() else stand_in_sign()
    P.sprite("sign", [sign], (sign.width // 2, sign.height - 6))
    for name, frames in (("train_engine", ["train_engine"]), ("train_wagon", ["train_wagon", "train_wagon_full"])):
        pics = [half(k) if (ART / f"{k}.png").exists() else stand_in_car(name == "train_engine", j == 1) for j, k in enumerate(frames)]
        # Standing on the middle of its rail tile, as everything stands on its tile.
        P.sprite(name, pics, (pics[0].width // 2, pics[0].height - TH // 2))
    for animal in ANIMALS:
        for pose in POSES:
            name = f"animal_{animal}_{pose}"
            im = half(name) if (ART / f"{name}.png").exists() else stand_in_animal(animal, pose)
            P.sprite(name, [im], (im.width // 2, im.height - 4))     # standing on its feet
    for who in G["PEOPLE"]:
        for pose in ("front", "back"):
            name = f"person_{who}_{pose}"
            frames = [half(f"{name}_{k}") if (ART / f"{name}_{k}.png").exists() else stand_in_person(who, pose, k) for k in range(2)]
            P.sprite(name, frames, (frames[0].width // 2, frames[0].height - 3))     # on their feet
    for name in ICONS:
        pic = half(f"icon_{name}") if (ART / f"icon_{name}.png").exists() else stand_in_icon(name)
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
