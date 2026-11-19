#!/usr/bin/env python3
"""
Builds the showcase game "Highmoor" as a GameIDE project zip: a medieval kingdom to
build up and wall in, and (from phase 2) armies to raid with — in the genre of the
base-building raid games, but its own. Phase 1: the kingdom — the keep, mines and
farms, treasuries and granaries, builders on the real clock, walls, towers, the army's
buildings, trees and rocks to clear, and renown.

    python3 showcase/kingdom/build.py      # → showcase/kingdom/out/Highmoor.zip (and project.json)

The pictures are the teacher's Gemini art (PROMPTS.md: realistic this time, at the
teacher's ask), cut into art/ by cut_sheets.py at twice the game's size. A picture
missing from art/ gets a plain stand-in, so the game still builds.

THE GAME IS OBJECTS: Title and Realm are the screens; on the map each building is a
Building, each wall, tree and rock a Prop (no events: there can be hundreds), and the
land one Ground picture made here. Every number is game/_1rules.py; every rule of the
kingdom is game/_2realm.py.
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
_farm = _load("farm_build", HERE.parent / "farm" / "build.py")
G = {}
exec((HERE / "game" / "_1rules.py").read_text(), G)
VIEW_W, VIEW_H, TW, TH = G["VIEW_W"], G["VIEW_H"], G["TILE_W"], G["TILE_H"]
ART = HERE / "art"
ICONS = ["gold", "food", "renown", "builder", "hammer", "clock", "shield", "sword", "up", "keep",
         "star", "attack", "army",     # phase 2: a battle's stars, the Attack! and Army buttons
         "trophy", "shield_on",        # phase 3: trophies, and a shield (stand-ins until Gemini's)
         "heal", "rage", "lightning", "freeze"]   # phase 4: the spells
# Stand-ins' colours: stone grey, timber brown, thatch… a plain block each, taller with each tier.
COLOURS = {"forge": (90, 70, 60), "warlord_altar": (150, 60, 50), "huntress_altar": (70, 120, 80), "mage_tower": (90, 80, 150),"keep": (150, 146, 138), "gold_mine": (120, 104, 84), "farm": (176, 150, 92), "treasury": (160, 150, 120),
           "granary": (170, 130, 80), "builder_hut": (140, 110, 80), "archer_tower": (140, 136, 128),
           "ballista": (120, 90, 60), "trebuchet": (110, 84, 56), "barracks": (130, 100, 76), "army_camp": (120, 110, 90)}
TALL = {"keep": 150, "archer_tower": 130, "trebuchet": 90, "army_camp": 30, "farm": 26}


def half(name):
    """One of the teacher's pictures at the game's size (art/ keeps them at twice)."""
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    return im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.LANCZOS)


def stand_in_building(kind, tier):
    """A block on a patch of earth, in the building's colour, taller each tier, with a
    pip a tier on its front: for a picture not cut yet."""
    n = G["BUILDINGS"][kind]["size"]
    w, h = TW * n, TH * n
    tall = TALL.get(kind, 60) + 18 * (tier - 1)
    im = Image.new("RGBA", (w, h + tall + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    top = tall + 20
    cx, cy = w / 2, top + h / 2
    d.polygon([(cx, top), (w, cy), (cx, top + h), (0, cy)], fill=(112, 104, 78), outline=(60, 52, 40))
    col = COLOURS.get(kind, (140, 120, 100))
    dark = tuple(int(c * 0.72) for c in col)
    bw, bh = w * 0.34, h * 0.34
    base = cy + 2
    d.polygon([(cx - bw, base), (cx, base + bh), (cx, base + bh - tall), (cx - bw, base - tall)], fill=col, outline=(40, 34, 28))
    d.polygon([(cx, base + bh), (cx + bw, base), (cx + bw, base - tall), (cx, base + bh - tall)], fill=dark, outline=(40, 34, 28))
    d.polygon([(cx - bw, base - tall), (cx, base + bh - tall), (cx + bw, base - tall), (cx, base - tall - bh)],
              fill=tuple(min(255, c + 30) for c in col), outline=(40, 34, 28))
    for k in range(tier):
        px = cx - bw / 2 - 8 + k * 9
        d.ellipse((px, base - 14 + k * 4, px + 7, base - 7 + k * 4), fill=(230, 200, 90), outline=(80, 60, 20))
    return im


def stand_in_trap(kind, tier):
    """A trap on its tile, for a picture not cut yet: spikes in a pit, a keg, a snare's arm."""
    im = Image.new("RGBA", (TW, TH + 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = TW / 2, 30 + TH / 2
    d.polygon([(cx, 30 + 4), (TW - 6, cy), (cx, 30 + TH - 4), (6, cy)], fill=(70, 56, 40), outline=(40, 30, 20))
    if kind == "spike_pit":
        for k in range(-2, 3):
            x = cx + k * 7
            d.polygon([(x - 3, cy + 4), (x, cy - 10 - tier * 2), (x + 3, cy + 4)], fill=(170, 170, 175))
    elif kind == "powder_keg":
        d.ellipse((cx - 10, cy - 18, cx + 10, cy + 4), fill=(110, 70, 30), outline=(40, 25, 10))
        d.line([(cx, cy - 18), (cx + 4, cy - 26)], fill=(220, 160, 60), width=2)
    else:
        d.line([(cx - 14, cy + 2), (cx + 12, cy - 14 - tier * 2)], fill=(120, 80, 40), width=4)
        d.ellipse((cx + 8, cy - 20 - tier * 2, cx + 18, cy - 10 - tier * 2), fill=(90, 70, 50))
    return im


def stand_in_wall(tier):
    im = Image.new("RGBA", (TW, TH + 34), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    col = [(150, 120, 80), (150, 146, 138), (110, 112, 120)][tier - 1]
    cx, cy, bw, bh, tall = TW / 2, 34 + TH / 2, TW * 0.38, TH * 0.38, 22 + 4 * tier
    d.polygon([(cx - bw, cy), (cx, cy + bh), (cx, cy + bh - tall), (cx - bw, cy - tall)], fill=col, outline=(40, 34, 28))
    d.polygon([(cx, cy + bh), (cx + bw, cy), (cx + bw, cy - tall), (cx, cy + bh - tall)], fill=tuple(int(c * 0.72) for c in col), outline=(40, 34, 28))
    d.polygon([(cx - bw, cy - tall), (cx, cy + bh - tall), (cx + bw, cy - tall), (cx, cy - tall - bh)], fill=tuple(min(255, c + 30) for c in col), outline=(40, 34, 28))
    return im


def stand_in_scaffold(n):
    w, h = TW * n, TH * n
    im = Image.new("RGBA", (w, h + 70), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = w / 2, 70 + h / 2
    d.polygon([(cx, 70), (w, cy), (cx, 70 + h), (0, cy)], fill=(120, 100, 70), outline=(60, 50, 36))
    for k in range(-2, 3):
        x = cx + k * w * 0.12
        d.line([(x, cy + 8 - abs(k) * 4), (x, cy - 60)], fill=(150, 110, 70), width=4)
    for yy in (cy - 20, cy - 45):
        d.line([(cx - w * 0.26, yy + 8), (cx + w * 0.26, yy - 8)], fill=(150, 110, 70), width=4)
    return im


TROOP_LOOK = {   # a stand-in troop: its tunic, what it carries, how big
    "footman": ((150, 40, 40), "sword", 1.0), "archer": ((60, 110, 50), "bow", 0.95), "brute": ((110, 110, 120), "mace", 1.35),
    "raider": ((120, 80, 40), "dagger", 0.9), "sapper": ((90, 70, 50), "keg", 0.95), "knight": ((200, 200, 210), "lance", 1.4),
    "ram": ((110, 80, 50), "ram", 1.6),
    "warlord": ((120, 30, 30), "mace", 1.5), "huntress": ((40, 90, 60), "bow", 1.25)}


def stand_in_troop(kind, view, frame):
    """A troop facing left, from the front (towards you) or the back, for a picture not
    drawn yet: frames 0 and 1 walking, 2 and 3 swinging."""
    coat, holds, size = TROOP_LOOK[kind]
    w, h = int(48 * size), int(64 * size)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = w / 2
    if kind == "ram":
        d.rectangle((4, h * 0.45, w - 4, h * 0.8), fill=(110, 80, 50), outline=(50, 35, 20))
        d.ellipse((4, h * 0.38, 18, h * 0.9), fill=(70, 70, 75))
        d.polygon([(8, h * 0.45), (cx, h * 0.15), (w - 8, h * 0.45)], fill=(140, 100, 60), outline=(60, 40, 20))
        for k in (0.3, 0.7):
            d.ellipse((w * k - 7, h * 0.75, w * k + 7, h * 0.97), fill=(40, 30, 20))
        if frame >= 2:
            d.rectangle((0, h * 0.55 - (frame - 2) * 3, 14, h * 0.65), fill=(80, 80, 85))
        return im
    s = size
    step = (3 if frame in (0, 2) else -3) * s
    d.line([(cx - 4 * s, h * 0.72), (cx - 4 * s - step, h - 2)], fill=(50, 40, 30), width=int(4 * s))
    d.line([(cx + 4 * s, h * 0.72), (cx + 4 * s + step, h - 2)], fill=(50, 40, 30), width=int(4 * s))
    if kind == "knight":
        d.ellipse((cx - 18 * s, h * 0.55, cx + 18 * s, h * 0.85), fill=(120, 90, 60), outline=(60, 40, 20))
    d.rounded_rectangle((cx - 9 * s, h * 0.32, cx + 9 * s, h * 0.74), radius=int(4 * s), fill=coat, outline=(40, 30, 20))
    face = (225, 190, 160) if view == "front" else (90, 60, 40)
    d.ellipse((cx - 7 * s, h * 0.1, cx + 7 * s, h * 0.33), fill=face, outline=(40, 30, 20))
    if kind in ("footman", "brute", "knight"):
        d.chord((cx - 8 * s, h * 0.06, cx + 8 * s, h * 0.26), 180, 360, fill=(150, 150, 160))
    swing = frame >= 2
    hx = cx - 12 * s
    if holds == "keg":
        d.ellipse((hx - 8 * s, h * 0.42, hx + 6 * s, h * 0.62), fill=(120, 80, 40), outline=(40, 30, 20))
    elif holds == "bow":
        d.arc((hx - 10 * s, h * 0.25, hx + 4 * s, h * 0.7), 90, 270, fill=(110, 70, 30), width=int(3 * s))
    else:
        length = {"sword": 16, "mace": 18, "dagger": 9, "lance": 30}[holds] * s
        a = (hx, h * 0.5)
        b = (hx - (length if swing else 4), h * 0.5 - (4 if swing else length))
        d.line([a, b], fill=(180, 180, 190), width=int(3 * s))
    return im


def stand_in_rubble(n):
    w, h = TW * n, TH * n
    im = Image.new("RGBA", (w, h + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = w / 2, 20 + h / 2
    d.polygon([(cx, 20), (w, cy), (cx, 20 + h), (0, cy)], fill=(96, 86, 70), outline=(60, 50, 40))
    rng = random.Random(n)
    for _ in range(10 * n):
        x, y = cx + rng.uniform(-w * 0.3, w * 0.3), cy + rng.uniform(-h * 0.25, h * 0.25)
        r = rng.uniform(3, 7)
        d.ellipse((x - r, y - r, x + r * 1.3, y + r * 0.8), fill=(130, 124, 116), outline=(70, 66, 60))
    return im


def stand_in_obstacle(kind):
    im = Image.new("RGBA", (TW, TH + 70), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = TW / 2, 70 + TH / 2
    if kind in ("oak", "pine"):
        d.rectangle((cx - 4, cy - 30, cx + 4, cy + 2), fill=(90, 64, 40))
        if kind == "oak":
            d.ellipse((cx - 26, cy - 80, cx + 26, cy - 24), fill=(70, 100, 50), outline=(40, 60, 30))
        else:
            d.polygon([(cx, cy - 88), (cx + 22, cy - 22), (cx - 22, cy - 22)], fill=(50, 84, 52), outline=(30, 50, 30))
    elif kind == "bush":
        d.ellipse((cx - 22, cy - 26, cx + 22, cy + 4), fill=(84, 110, 60), outline=(44, 64, 34))
    elif kind == "boulder":
        d.ellipse((cx - 24, cy - 30, cx + 24, cy + 6), fill=(130, 126, 120), outline=(70, 68, 64))
    else:
        d.ellipse((cx - 14, cy - 12, cx + 14, cy + 4), fill=(110, 80, 52), outline=(60, 44, 30))
    return im


WATER_TILE = 512
GROUND_STRIP = G["GROUND_STRIP"]


def water_tiles():
    """Two pictures of water that tile seamlessly (every wave a whole number of times
    across), which the Water object drifts in different directions round the island: the
    sea, blue-green with a gentle swell, and a see-through layer of wave crests, long thin
    broken streaks running across it. (The first water was dark, with dots for glints, and
    looked like space, 2026-11-18.)"""
    import numpy as np
    n = WATER_TILE
    y, x = np.mgrid[0:n, 0:n] / n * 2 * np.pi
    swell = (np.sin(2 * x + 3 * y) + 0.7 * np.sin(3 * x - 2 * y + 1.3) + 0.4 * np.sin(5 * x + 4 * y + 2.1)) / 2.1
    base = np.stack([46 + 9 * swell, 118 + 13 * swell, 146 + 14 * swell, np.full_like(swell, 255)], axis=-1)
    sea = Image.fromarray(base.clip(0, 255).astype("uint8"), "RGBA")
    # Crests: thin lines along x (sin of a high frequency in y, bent a little by x), each
    # broken into dashes by a slower wave along it.
    line = np.sin(14 * y + 1.2 * np.sin(2 * x) + 0.8 * np.sin(3 * x + 1.0))
    dash = (np.sin(4 * x + 2 * y) * 0.5 + 0.5) * (np.sin(7 * x - 3 * y + 0.7) * 0.5 + 0.5)
    a = ((line - 0.86).clip(0, None) / 0.14) ** 1.5 * (dash > 0.35) * 140
    crest = np.stack([np.full_like(a, 225), np.full_like(a, 242), np.full_like(a, 245), a], axis=-1)
    return sea, Image.fromarray(crest.clip(0, 255).astype("uint8"), "RGBA")


def ground():
    """The whole map as one picture: meadow grass, a little different tile by tile, a
    sandy shore all round, and an earthy edge below the front two sides. Outside the
    island it's see-through: the Water object's moving water is behind it."""
    W, H = G["WORLD_W"], G["WORLD_H"]
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(9)
    mw, mh = G["MAP_W"], G["MAP_H"]

    def xy(gx, gy):
        return G["ORIGIN_X"] + (gx - gy) * TW / 2, G["ORIGIN_Y"] + (gx + gy) * TH / 2
    top, right, bottom, left = xy(-0.5, -0.5), xy(mw - 0.5, -0.5), xy(mw - 0.5, mh - 0.5), xy(-0.5, mh - 0.5)
    for k, col in ((40, (74, 58, 40)), (22, (98, 78, 54))):
        d.polygon([left, bottom, right, (right[0], right[1] + k), (bottom[0], bottom[1] + k), (left[0], left[1] + k)], fill=col)
    # The shore: a band of sand just outside the grass, all the way round.
    s = 12
    d.polygon([(top[0], top[1] - s), (right[0] + 2 * s, right[1]), (bottom[0], bottom[1] + s), (left[0] - 2 * s, left[1])], fill=(196, 178, 128))
    for gx in range(mw):
        for gy in range(mh):
            x, y = xy(gx, gy)
            g = rng.randint(-5, 5)
            d.polygon([(x, y - TH / 2), (x + TW / 2, y), (x, y + TH / 2), (x - TW / 2, y)], fill=(94 + g, 122 + g, 70 + g))
            for _ in range(3):
                tx, ty = x + rng.uniform(-TW / 4, TW / 4), y + rng.uniform(-TH / 5, TH / 5)
                d.line([(tx, ty), (tx - 1, ty - 4)], fill=(72, 100, 52), width=1)
    return im


def make_sounds(P):
    tone, join, lowpass = _tw.tone, _tw.join, _tw.lowpass
    P.sound("click", tone(0.03, 700, 520, "square", 0.1))
    P.sound("nope", join(tone(0.08, 220, 170, "square", 0.14), tone(0.12, 150, 120, "square", 0.14)))
    P.sound("build", join(lowpass(tone(0.06, 0, 0, "noise", 0.35, seed=3), 0.3, 0.05), tone(0.05, 180, 140, "tri", 0.3)))
    P.sound("coin", join(tone(0.05, 1319, 1319, "tri", 0.2), tone(0.14, 1760, 1760, "tri", 0.16)))
    P.sound("levelup", join(*[tone(0.11, f, f, "tri", 0.28) for f in (392, 523, 659, 784)], tone(0.4, 1047, 1047, "tri", 0.22)))


def build(out):
    P = _farm.Farm("Highmoor")
    P.type_credit = "Lilita One by Juan Montoreano (SIL Open Font License 1.1, below)"
    P.type_licence = "\n\n" + (HERE / "fonts" / "LilitaOne-OFL.txt").read_text()     # the OFL asks for it to go with the font
    # The board: renown (it measures everything built and won, and only goes up).
    P.p["settings"]["scoreboard"] = {"unit": "level"}
    P.p["settings"]["pixelScaling"] = False
    # Lilita One (the teacher's ask: the chunky lettering of the genre; the free-for-personal-use
    # fonts like it couldn't go in a published game, so an open-licence one with that look).
    P.font("Lilita", HERE / "fonts" / "lilita-one-latin-400-normal.woff2")

    for kind, i in G["BUILDINGS"].items():
        n = i["size"]
        for t in (1, 2, 3):
            name = f"{kind}_{t}"
            if kind == "wall":
                im = half(name) if (ART / f"{name}.png").exists() else stand_in_wall(t)
            elif kind in G["TRAPS"]:
                im = half(name) if (ART / f"{name}.png").exists() else stand_in_trap(kind, t)
            else:
                im = half(name) if (ART / f"{name}.png").exists() else stand_in_building(kind, t)
            # Standing on the middle of its footprint's diamond.
            P.sprite(name, [im], (im.width // 2, im.height - TH * n // 2))
            if kind == "wall":
                # Gemini's walls run along gx (top left to bottom right); one along gy is the same, mirrored.
                P.sprite(f"{name}_gy", [im.transpose(Image.FLIP_LEFT_RIGHT)], (im.width // 2, im.height - TH * n // 2))
    for n in (2, 3, 4):
        im = half(f"scaffold_{n}") if (ART / f"scaffold_{n}.png").exists() else stand_in_scaffold(n)
        P.sprite(f"scaffold_{n}", [im], (im.width // 2, im.height - TH * n // 2))
    for kind in list(G["TROOPS"]) + list(G["CHAMPIONS"]):
        for view in ("front", "back"):
            name = f"troop_{kind}_{view}"
            frames = [half(f"{name}_{k}") if (ART / f"{name}_{k}.png").exists() else stand_in_troop(kind, view, k) for k in range(4)]
            P.sprite(name, frames, (frames[0].width // 2, frames[0].height - 4))     # on its feet
    for n in (1, 2, 3, 4):
        im = half(f"rubble_{n}") if (ART / f"rubble_{n}.png").exists() else stand_in_rubble(n)
        P.sprite(f"rubble_{n}", [im], (im.width // 2, im.height - TH * n // 2))
    for kind in G["OBSTACLES"]:
        im = half(kind) if (ART / f"{kind}.png").exists() else stand_in_obstacle(kind)
        P.sprite(kind, [im], (im.width // 2, im.height - TH // 2))
    for name in ICONS:
        pic = half(f"icon_{name}") if (ART / f"icon_{name}.png").exists() else _farm.stand_in_icon(name)
        P.sprite(f"icon_{name}", [pic], (32, 32))
    title = half("title") if (ART / "title.png").exists() else Image.new("RGBA", (VIEW_W, VIEW_H), (70, 86, 100, 255))
    P.sprite("title", [title], (0, 0))
    # The ground in strips no wider than GROUND_STRIP: some Chromebooks' graphics can't hold
    # a picture over 4096 pixels across, and the 70-tile map's is 4480.
    land = ground()
    for k in range(0, land.width, GROUND_STRIP):
        P.sprite(f"ground_{k // GROUND_STRIP}", [land.crop((k, 0, min(land.width, k + GROUND_STRIP), land.height))], (0, 0))
    deep, glint = water_tiles()
    P.sprite("water", [deep], (0, 0))
    P.sprite("water_glint", [glint], (0, 0))
    icon = half("icon_keep").resize((64, 64)) if (ART / "icon_keep.png").exists() else stand_in_building("keep", 3).resize((64, 64))
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
        for ev, code in events:
            o["events"].append({"id": _tw.new_id(), "key": _tw.event_key(ev, P), "mode": "python", "code": code})

    def room(name, w, h, placed, colour="#2e7692"):     # past the world's edge: the water's colour
        lid = _tw.new_id()
        P.p["rooms"].append({
            "id": _tw.new_id(), "name": name, "width": w, "height": h, "background": colour,
            "gridWidth": 16, "gridHeight": 16, "snap": False,
            "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
            "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 0},
            "instances": [{"id": _tw.new_id(), "object": P.obj_id(o), "layer": lid, "x": x, "y": y,
                           "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""} for o, x, y in placed],
        })

    room("Title", VIEW_W, VIEW_H, [("Title", 0, 0)], "#465664")
    room("Realm", G["WORLD_W"], G["WORLD_H"], [("Realm", 0, 0), ("Water", 0, 0)])
    room("Battle", G["WORLD_W"], G["WORLD_H"], [("Battlefield", 0, 0), ("Water", 0, 0)])

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    pictures = sum(1 for _ in ART.glob("*.png")) if ART.exists() else 0
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(P.p['objects'])} objects, {pictures} of the teacher's pictures")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Highmoor.zip")
