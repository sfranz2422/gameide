#!/usr/bin/env python3
"""
Builds the showcase game, "Thornwood", as a GameIDE project zip.

    python3 showcase/build.py                 # → showcase/out/Thornwood.zip
    python3 showcase/build.py --assets DIR    # where the Legacy Fantasy packs are

The game is made from three things, all in this folder:

  game/*.py     every object's events and the shared scripts, as plain
                Python files with a small header (see read_code below);
  levels/*.txt  each level as a text map, one character per 16 px tile;
  this file     which picture is which sprite, and how a map becomes tiles.

THE ART IS NOT IN THIS REPOSITORY. It is Anokolisa's Legacy Fantasy series
(the High Forest pack and the level packs), which may be used in any game,
changed, and published inside one — but not handed out or sold as art. The
built zip carries the pictures inside the game, which the terms allow; the
repository carries only code that reads them from --assets. Credits are
optional; the game credits Anokolisa anyway (game/Title.py).

Nothing here is clever on purpose: a teacher should be able to open a level
map, move a wall, run this again and import the result.
"""
import argparse
import hashlib
import io
import json
import math
import random
import re
import struct
import wave
import zipfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
TILE = 16
VIEW_W, VIEW_H = 480, 270          # the camera: the forest backdrop is 480 × 272

# ---------------------------------------------------------------- ids

_ID_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"
_rng = random.Random(7)


def new_id():
    """GameIDE's id shape (project.ts newId). Seeded, so a rebuild makes the same ids."""
    return "".join(_rng.choice(_ID_CHARS) for _ in range(10))


def png_bytes(im):
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------- the project

class Project:
    def __init__(self, name):
        self.assets = {}   # id -> (bytes, extension)
        self.p = {
            "format": "gameide-project", "schemaVersion": 8, "id": new_id(), "name": name,
            "created": "2026-10-26T00:00:00.000Z", "modified": "2026-10-26T00:00:00.000Z",
            "settings": {"stepsPerSecond": 60, "pixelScaling": True},
            "sprites": [], "tilesets": [], "objects": [], "rooms": [], "scripts": [], "sounds": [], "fonts": [],
        }

    def asset(self, data, ext):
        i = new_id()
        self.assets[i] = (data, ext)
        return i

    # -- sprites
    def sprite(self, name, frames, origin, mask=None, fps=None):
        """
        Frames must all be one size (a sprite has one width and height).
        `mask` is (left, top, right, bottom) in the sprite's own pixels; every
        sprite of one character gets the same box around its origin, so
        changing animation never moves the box into a wall.
        """
        w, h = frames[0].size
        assert all(f.size == (w, h) for f in frames), name
        s = {"id": new_id(), "name": name, "width": w, "height": h,
             "originX": origin[0], "originY": origin[1],
             "frames": [self.asset(png_bytes(f), "png") for f in frames]}
        if mask:
            s["mask"] = {"kind": "rect", "left": mask[0], "top": mask[1], "right": mask[2], "bottom": mask[3]}
        if fps:
            s["fps"] = fps
        self.p["sprites"].append(s)
        return s

    def sprite_id(self, name):
        return next(s["id"] for s in self.p["sprites"] if s["name"] == name)

    # -- tilesets
    def tileset(self, name, image, solid):
        t = {"id": new_id(), "name": name, "image": self.asset(png_bytes(image), "png"),
             "imageWidth": image.width, "imageHeight": image.height, "tileWidth": TILE, "tileHeight": TILE,
             "offsetX": 0, "offsetY": 0, "spacingX": 0, "spacingY": 0, "solid": sorted(set(solid)), "autotiles": []}
        self.p["tilesets"].append(t)
        return t

    # -- sounds
    def sound(self, name, samples, volume=1.0):
        self.p["sounds"].append({"id": new_id(), "name": name, "asset": self.asset(wav_bytes(samples), "wav"), "volume": volume})

    # -- scripts and objects
    def script(self, name, code):
        self.p["scripts"].append({"id": new_id(), "name": name, "code": code})

    def obj(self, name, **kw):
        o = {"id": new_id(), "name": name, "sprite": None, "visible": True, "solid": False,
             "persistent": False, "depth": 0, "parent": None, "events": []}
        o.update(kw)
        self.p["objects"].append(o)
        return o

    def obj_id(self, name):
        return next(o["id"] for o in self.p["objects"] if o["name"] == name)

    def write(self, path):
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n"
                       "Art: Legacy Fantasy series by Anokolisa (anokolisa.itch.io), used under the author's terms.\n")


# ---------------------------------------------------------------- pictures

def sheet(path, frame_w, frame_h=None, pick=None):
    """A horizontal strip cut into frames; `pick` keeps some of them (a range or list)."""
    im = Image.open(path).convert("RGBA")
    frame_h = frame_h or im.height
    frames = [im.crop((i * frame_w, 0, (i + 1) * frame_w, frame_h)) for i in range(im.width // frame_w)]
    return [frames[i] for i in pick] if pick is not None else frames


def on_canvas(frames, size, at):
    """Each frame pasted onto a bigger canvas at `at`, so strips of different sizes can share an origin."""
    out = []
    for f in frames:
        c = Image.new("RGBA", size, (0, 0, 0, 0))
        c.alpha_composite(f, at)
        out.append(c)
    return out


def tile_image(tileset, n, cols=1, rows=1):
    """Tiles cut out of a tileset as one picture (for pickups drawn in the tileset)."""
    per_row = tileset.width // TILE
    x, y = (n % per_row) * TILE, (n // per_row) * TILE
    return tileset.crop((x, y, x + cols * TILE, y + rows * TILE))


def tinted(im, rgb, amount):
    """Mixes a picture towards a colour, keeping its shading: a recoloured boss."""
    r, g, b, a = im.split()
    base = Image.merge("RGB", (r, g, b))
    tint = Image.new("RGB", im.size, rgb)
    mixed = Image.blend(base, Image.composite(tint, base, base.convert("L").point(lambda v: 255)), amount)
    out = mixed.convert("RGBA")
    out.putalpha(a)
    return out


def scaled(frames, k):
    return [f.resize((f.width * k, f.height * k), Image.NEAREST) for f in frames]


# ---------------------------------------------------------------- sounds (sfxr-style, as starterSounds.ts)

RATE = 22050


def tone(seconds, f0, f1, kind="square", vol=0.3, seed=1):
    n = int(seconds * RATE)
    r = random.Random(seed)
    out, ph = [], 0.0
    for i in range(n):
        t = i / n
        ph += (f0 + (f1 - f0) * t) / RATE
        if kind == "square":
            v = 1 if ph % 1 < 0.5 else -1
        elif kind == "sine":
            v = math.sin(ph * 2 * math.pi)
        elif kind == "tri":
            v = 4 * abs(ph % 1 - 0.5) - 1
        else:
            v = r.random() * 2 - 1
        out.append(v * vol * min(1, i / 40) * (1 - t) ** 1.5)
    return out


def lowpass(samples, k0, k1):
    y, out, n = 0.0, [], len(samples)
    for i, s in enumerate(samples):
        k = k0 + (k1 - k0) * i / n
        y += k * (s - y)
        out.append(y)
    return out


def mix(*parts):
    n = max(len(p) for p in parts)
    return [sum(p[i] for p in parts if i < len(p)) for i in range(n)]


def join(*parts):
    return [s for p in parts for s in p]


def wav_bytes(samples):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32000)) for s in samples))
    return buf.getvalue()


def music_loop(notes, bass, bpm, bars_per_note=0.5, seed=3):
    """
    A short chiptune loop: a melody on a soft square wave over a triangle
    bass, one note per half beat. `notes` and `bass` are MIDI numbers (0 = rest).
    """
    step = 60 / bpm * bars_per_note
    out = []
    for i, n in enumerate(notes):
        b = bass[i % len(bass)]
        seg = [0.0] * int(step * RATE)
        if n:
            f = 440 * 2 ** ((n - 69) / 12)
            seg = mix(seg, [v * 0.6 for v in tone(step, f, f, "square", 0.09, seed)])
        if b:
            f = 440 * 2 ** ((b - 69) / 12)
            seg = mix(seg, tone(step, f, f, "tri", 0.16, seed))
        out.extend(seg)
    return out


# ---------------------------------------------------------------- code files

def read_code(path):
    """
    A game/*.py file: a header of `# key: value` lines, then events, each
    starting with a `# === <event>` line:

        # object: Player
        # sprite: hero_idle
        # depth: -10
        # === create
        self.hp = 3
        # === collision Enemy
        ...

    Events: create, step, begin_step, end_step, draw, draw_gui, destroy,
    room_start, room_end, game_start, animation_end, alarm N, collision Obj,
    key pressed|down|released NAME.
    """
    head, events, cur = {}, [], None
    for line in path.read_text().splitlines():
        m = re.match(r"# === (.+)$", line)
        if m:
            cur = [m.group(1).strip(), []]
            events.append(cur)
        elif cur is None:
            h = re.match(r"# (\w+): (.*)$", line)
            if h:
                head[h.group(1)] = h.group(2).strip()
        else:
            cur[1].append(line)
    return head, [(name, "\n".join(body).strip("\n") + "\n") for name, body in events]


def event_key(name, project):
    parts = name.split()
    if parts[0] == "collision":
        return {"type": "collision", "object": project.obj_id(parts[1])}
    if parts[0] == "alarm":
        return {"type": "alarm", "n": int(parts[1])}
    if parts[0] == "key":
        return {"type": "key", "kind": parts[1], "key": parts[2]}
    return {"type": parts[0]}


# ---------------------------------------------------------------- levels

class Theme:
    """How one tileset's pictures make walls: which tile is a top edge, a corner, a fill."""

    def __init__(self, name, image, ground, stone=None, plank=None, back=None, water=None, tips=None, decor=None):
        self.name, self.image = name, image
        self.ground, self.stone = ground, stone or ground
        self.plank, self.back, self.water, self.tips, self.decor = plank, back, water, tips, decor or {}


def pick(options, c, r):
    """One of several tiles, chosen by position: varied, but the same on every rebuild."""
    if isinstance(options, int):
        return options
    h = int(hashlib.md5(f"{c},{r}".encode()).hexdigest()[:6], 16)
    return options[h % len(options)]


SOLID = "#%"
OPEN_CAVE = "."


def edge_tile(set_, up, down, left, right, c, r):
    """
    The nine-slice choice. `up`… are True where that side is open (air,
    cave, water, a plank). Out of the map counts as solid, so the edges of the
    world have no rim.
    """
    if up:
        return set_["TL"] if left else set_["TR"] if right else pick(set_["T"], c, r)
    if down:
        return set_["BL"] if left else set_["BR"] if right else pick(set_["B"], c, r)
    if left:
        return pick(set_["L"], c, r)
    if right:
        return pick(set_["R"], c, r)
    return pick(set_["M"], c, r)


def read_level(path):
    """A level file: `key: value` lines, then the map after a line `map:`."""
    meta, rows, in_map = {}, [], False
    for line in path.read_text().splitlines():
        if in_map:
            if line.startswith(";"):        # a comment inside the map
                continue
            rows.append(line.rstrip("\n"))
        elif line.strip() == "map:":
            in_map = True
        elif ":" in line and not line.startswith("#"):
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    width = max(len(r) for r in rows)
    rows = [r.ljust(width) for r in rows]
    return meta, rows


def build_level(project, theme_ts, theme, meta, rows, objects):
    """
    Paints a map into tile layers and places its instances. Returns the room.

    Layers, back to front: Back (cave walls behind tunnels, no collision),
    Ground (the solid map), Front (grass tips and bushes over the hero's
    feet). Planks are on their own layer, "Planks", which is NOT solid: the
    Player lands on them from above in its own code (one-way platforms).
    """
    H, W = len(rows), len(rows[0])
    at = lambda c, r: rows[r][c] if 0 <= r < H and 0 <= c < W else "#"
    solid = lambda ch: ch in SOLID
    back, ground, front, planks = {}, {}, {}, {}
    instances = []

    def place(name, x, y, code=""):
        instances.append({"id": new_id(), "object": project.obj_id(name), "layer": "", "x": x, "y": y,
                          "scaleX": 1, "scaleY": 1, "angle": 0, "code": code})

    cave_open = lambda ch: ch == OPEN_CAVE
    for r in range(H):
        for c in range(W):
            ch = at(c, r)
            key = f"{c},{r}"
            # Cave back wall: behind '.', behind anything standing in a cave,
            # and behind the rock round a cave — edge tiles have see-through
            # bits, which would otherwise show the sky inside a tunnel.
            near_cave = any(cave_open(at(c + dc, r + dr)) for dc in (-1, 0, 1) for dr in (-1, 0, 1))
            if theme.back and (ch == "." or (ch not in " ~" and near_cave)):
                back[key] = theme.back[(r % 2) * 2 + (c % 2)]
            if solid(ch):
                set_ = theme.ground if ch == "#" else theme.stone
                up, down = not solid(at(c, r - 1)), not solid(at(c, r + 1))
                left, right = not solid(at(c - 1, r)), not solid(at(c + 1, r))
                ground[key] = edge_tile(set_, up, down, left, right, c, r)
                # Grass over a grass top, on the Front layer, if the cell above is air.
                if ch == "#" and up and theme.tips and at(c, r - 1) in " .":
                    tips = theme.tips
                    front[f"{c},{r - 1}"] = tips["L"] if left else tips["R"] if right else pick(tips["T"], c, r)
            elif ch == "=":
                left, right = at(c - 1, r) != "=", at(c + 1, r) != "="
                p = theme.plank
                planks[key] = p["L"] if left else p["R"] if right else p["M"]
                if p.get("top"):
                    planks[f"{c},{r - 1}"] = p["top"][0] if left else p["top"][2] if right else p["top"][1]
            elif ch == "~" and theme.water:
                ground[key] = pick(theme.water["top"] if at(c, r - 1) not in "~" else theme.water["body"], c, r)
            x, y = c * TILE + TILE // 2, (r + 1) * TILE      # standing in this cell, feet on its bottom
            if ch in objects:
                name, code = objects[ch]
                place(name, x, y, code)
            elif ch in theme.decor:
                front[key] = pick(theme.decor[ch], c, r)

    # Water: an invisible hazard object over each pool row, for the Player to collide with.
    width_px, height_px = W * TILE, H * TILE
    layers = [
        {"id": new_id(), "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False},
        {"id": new_id(), "name": "Front", "kind": "tiles", "depth": -20, "visible": True, "locked": False,
         "tileset": theme_ts["id"], "tiles": front},
        {"id": new_id(), "name": "Ground", "kind": "tiles", "depth": 100, "visible": True, "locked": False,
         "tileset": theme_ts["id"], "tiles": ground},
        {"id": new_id(), "name": "Planks", "kind": "tiles", "depth": 110, "visible": True, "locked": False,
         "tileset": theme_ts["id"], "tiles": planks},
        {"id": new_id(), "name": "Back", "kind": "tiles", "depth": 300, "visible": True, "locked": False,
         "tileset": theme_ts["id"], "tiles": back},
        {"id": new_id(), "name": "Background", "kind": "background", "depth": 1000, "visible": True, "locked": False,
         "color": meta.get("sky", "#8fd9de"), "sprite": None, "mode": "tile", "hspeed": 0, "vspeed": 0, "parallax": 0},
    ]
    for i in instances:
        i["layer"] = layers[0]["id"]
    room = {"id": new_id(), "name": meta["room"], "width": width_px, "height": height_px,
            "background": meta.get("sky", "#8fd9de"), "gridWidth": TILE, "gridHeight": TILE, "snap": True,
            "layers": layers, "instances": instances,
            "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": project.obj_id("Player"), "smoothing": 0.12}}
    return room


# ---------------------------------------------------------------- the game

def build(assets_dir, out, check=True, strict=True):
    A = Path(assets_dir).expanduser()
    HF = A / "Legacy-Fantasy - High Forest 2.3"
    BOAR = A / "Legacy Enemy - Wild Boar"
    for need in (HF, BOAR):
        if not need.is_dir():
            raise SystemExit(f"Missing {need}: download Anokolisa's packs there, or pass --assets.")
    P = Project("Thornwood")
    char = HF / "Character"
    mob = HF / "Mob"

    # ---- the hero. Feet at y 64 in every strip; the body's middle measured
    # from the hair (see the notes in showcase/README.md). One canvas size for
    # all, so the origin is the same point on every frame.
    HERO = (96, 80)
    OX, OY = 48, 64
    MASK = (OX - 6, OY - 38, OX + 6, OY)
    hero = {
        "hero_idle": (sheet(char / "Idle/Idle-Sheet.png", 64), (OX - 32, 0), 8),
        "hero_run": (sheet(char / "Run/Run-Sheet.png", 80), (OX - 46, -2), 14),
        "hero_attack": (sheet(char / "Attack-01/Attack-01-Sheet.png", 96, pick=range(0, 4)), (OX - 50, 0), 18),
        "hero_attack2": (sheet(char / "Attack-01/Attack-01-Sheet.png", 96, pick=range(4, 8)), (OX - 50, 0), 18),
        "hero_jump": (sheet(char / "Jumlp-All/Jump-All-Sheet.png", 64, pick=range(2, 7)), (OX - 26, 16), 12),
        "hero_fall": (sheet(char / "Jumlp-All/Jump-All-Sheet.png", 64, pick=range(7, 12)), (OX - 25, 16), 10),
        "hero_dead": (sheet(char / "Dead/Dead-Sheet.png", 80), (OX - 31, 16), 10),
    }
    for name, (frames, at, fps) in hero.items():
        P.sprite(name, on_canvas(frames, HERO, at), (OX, OY), MASK, fps)

    # ---- enemies. Origin at the feet, under the middle of the body.
    def mob_sprites(prefix, strips, box, fps=10, flying=False):
        """strips: name -> (path, frame width). `box`: the hit box, (width, height) above the feet."""
        cut = {n: sheet(p, w) for n, (p, w) in strips.items()}
        W = max(f[0].width for f in cut.values())
        Hh = max(f[0].height for f in cut.values())
        for n, frames in cut.items():
            # Bottom-aligned on a shared canvas, each strip centred on its own body.
            union = None
            for f in frames:
                bb = f.getchannel("A").getbbox()
                if bb:
                    union = bb if union is None else (min(union[0], bb[0]), min(union[1], bb[1]), max(union[2], bb[2]), max(union[3], bb[3]))
            cx = (union[0] + union[2]) // 2
            bottom = union[3] if not flying else frames[0].height // 2
            frames = on_canvas(frames, (W, Hh), (W // 2 - cx, (Hh - bottom) if not flying else (Hh // 2 - bottom)))
            ox, oy = W // 2, Hh if not flying else Hh // 2
            bw, bh = box
            mask = (ox - bw // 2, oy - bh, ox + bw // 2, oy) if not flying else (ox - bw // 2, oy - bh // 2, ox + bw // 2, oy + bh // 2)
            P.sprite(f"{prefix}_{n}", frames, (ox, oy), mask, fps)

    mob_sprites("snail", {"walk": (mob / "Snail/walk-Sheet.png", 48), "hide": (mob / "Snail/Hide-Sheet.png", 48),
                          "dead": (mob / "Snail/Dead-Sheet.png", 48)}, (22, 18), fps=8)
    mob_sprites("boar", {"idle": (mob / "Boar/Idle/Idle-Sheet.png", 48), "walk": (mob / "Boar/Walk/Walk-Base-Sheet.png", 48),
                         "run": (mob / "Boar/Run/Run-Sheet.png", 48), "hit": (mob / "Boar/Hit-Vanish/Hit-Sheet.png", 48)}, (30, 20), fps=10)
    mob_sprites("bee", {"fly": (mob / "Small Bee/Fly/Fly-Sheet.png", 64), "attack": (mob / "Small Bee/Attack/Attack-Sheet.png", 64),
                        "hit": (mob / "Small Bee/Hit/Hit-Sheet.png", 64)}, (16, 16), fps=12, flying=True)

    # ---- the first boss: the Wild Boar pack's big boar, twice the size, in its darkest coat.
    wb = lambda d, f, w: (BOAR / d / f, w)
    big = {"idle": wb("Idle", "Idle-Sheet - Color 3.png", 64), "walk": wb("Walk", "Walk-Sheet - Color 3.png", 96),
           "run": wb("Run", "Run-Sheet - Color 3.png", 96), "attack": wb("Attack", "Attack - Color 3.png", 64),
           "die": wb("Die", "Die-Sheet - Color 3.png", 96)}
    cut = {n: scaled(sheet(p, w), 2) for n, (p, w) in big.items()}
    BW = max(f[0].width for f in cut.values())
    BH = max(f[0].height for f in cut.values())
    for n, frames in cut.items():
        union = frames[0].getchannel("A").getbbox()
        for f in frames[1:]:
            bb = f.getchannel("A").getbbox()
            union = (min(union[0], bb[0]), min(union[1], bb[1]), max(union[2], bb[2]), max(union[3], bb[3]))
        cx = (union[0] + union[2]) // 2
        frames = on_canvas(frames, (BW, BH), (BW // 2 - cx, BH - frames[0].height))
        P.sprite(f"tusk_{n}", frames, (BW // 2, BH), (BW // 2 - 40, BH - 56, BW // 2 + 40, BH), 10)

    # ---- the forest tileset, and things cut out of it.
    tiles = Image.open(HF / "Assets/Tiles.png").convert("RGBA")
    P.sprite("potion", [tile_image(tiles, 565)], (8, 16), (3, 4, 13, 16))
    P.sprite("key", [tile_image(tiles, 515)], (8, 14), (2, 4, 14, 12))
    P.sprite("coin", [tile_image(tiles, 540)], (8, 14), (4, 3, 12, 15))
    P.sprite("moss_block", [tile_image(tiles, 335)], (8, 16), (0, 0, 16, 16))
    P.sprite("chest", [tile_image(tiles, 443, 2, 2)], (16, 32), (2, 6, 30, 32))
    P.sprite("chest_open", [tile_image(tiles, 445, 2, 2)], (16, 32), (2, 6, 30, 32))
    # The locked gate: a column of mossy stone, three tiles tall, the hero's height.
    gate = Image.new("RGBA", (16, 48))
    for i, n in enumerate((310, 335, 335)):
        gate.alpha_composite(tile_image(tiles, n), (0, i * 16))
    P.sprite("gate", [gate], (8, 48), (0, 0, 16, 48))

    # ---- the backdrop: the sky, and two rows of pines composed from the
    # pack's pieces into strips that repeat sideways (Backdrop draws them).
    sky = Image.open(HF / "Background/Background.png").convert("RGBA")
    P.sprite("bg_sky", [sky], (0, 0))
    trees = Image.open(HF / "Trees/Background.png").convert("RGBA")
    for name, x0 in (("bg_pines_far", 448), ("bg_pines_near", 0)):
        strip = trees.crop((x0, 0, x0 + 352, 256))
        P.sprite(name, [strip], (0, 0))

    # ---- the HUD, from the pack's own sheet: rounded squares for life points.
    hud = Image.open(HF / "HUD/Base-01.png").convert("RGBA")
    pip_full, pip_empty = hud.crop((3, 114, 14, 125)), hud.crop((3, 130, 14, 141))
    P.sprite("hud_pip_full", [pip_full], (0, 0))
    P.sprite("hud_pip_empty", [pip_empty], (0, 0))
    P.sprite("heart_up", [pip_full.resize((22, 22), Image.NEAREST)], (11, 22), (2, 2, 20, 22))

    # ---- props: a standing stone for checkpoints, a door for the exit, a rock.
    props = Image.open(HF / "Assets/Props-Rocks.png").convert("RGBA")
    stone = props.crop((117, 193, 157, 260))
    P.sprite("runestone", [stone], (stone.width // 2, stone.height), (8, 20, stone.width - 8, stone.height))
    rock = props.crop((128, 10, 144, 32))
    P.sprite("rock", [rock], (8, 11), (2, 3, 14, 19))
    buildings = Image.open(HF / "Assets/Buildings.png").convert("RGBA")
    door = buildings.crop((341, 122, 379, 176))
    P.sprite("exit_door", [door], (door.width // 2, door.height), (8, 10, door.width - 8, door.height))
    P.sprite("relic", [tile_image(tiles, 568)], (8, 16), (3, 3, 13, 16))

    # ---- invisible boxes: the sword's reach, a pool, the boss's tripwire.
    clear = lambda w, h: Image.new("RGBA", (w, h), (0, 0, 0, 0))
    P.sprite("slash_box", [clear(40, 36)], (20, 18), (0, 0, 40, 36))
    P.sprite("water_box", [clear(16, 16)], (8, 16), (0, 4, 16, 16))
    P.sprite("trigger_box", [clear(16, 192)], (8, 192), (0, 0, 16, 192))

    # ---- the pixel font (font.py): cream, gold and a dark shadow, at 1× and 2×.
    import font
    for scale in (1, 2):
        for tone_name, rgb in (("", (255, 246, 213)), ("_gold", (255, 209, 102)), ("_shadow", (20, 16, 12))):
            P.sprite(f"font{scale}{tone_name}", font.frames(rgb, Image, scale), (0, 0))

    # ---- an icon for My Games: the hero mid-swing.
    icon = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    icon.alpha_composite(sheet(char / "Attack-01/Attack-01-Sheet.png", 96)[1].crop((16, 0, 96, 80)).resize((64, 64), Image.NEAREST))
    P.sprite("icon", [icon], (0, 0))

    forest_ts = P.tileset("forest", tiles, solid=[])
    forest = Theme(
        "forest", tiles,
        ground={"TL": 25, "T": [26, 27, 28], "TR": 29, "L": [50, 75], "R": [54, 79], "M": [76, 77, 78, 76],
                "BL": 100, "B": [101, 102, 103], "BR": 104},
        stone={"TL": 150, "T": [151, 152, 153], "TR": 154, "L": [175, 200], "R": [179, 204], "M": [176, 177, 178, 201],
               "BL": 225, "B": [226, 227, 228], "BR": 229},
        plank={"L": 155, "M": 156, "R": 157, "top": [130, 131, 132]},
        back=[254, 255, 279, 280],
        water={"top": [481, 482, 483, 484], "body": [506, 507, 508, 509]},
        tips={"L": 0, "T": [1, 2, 3], "R": 4},
        decor={"m": [415, 420], "w": [447]},
    )
    # Solid: every ground and stone piece. (Water is a hazard object, not a wall.)
    solid = set()
    for s in (forest.ground, forest.stone):
        for v in s.values():
            solid.update(v if isinstance(v, list) else [v])
    forest_ts["solid"] = sorted(solid)

    # ---- sounds, made here (no sound in the packs).
    P.sound("jump", tone(0.16, 260, 560, "square", 0.18))
    P.sound("swing", lowpass(tone(0.14, 0, 0, "noise", 0.5, seed=4), 0.5, 0.05))
    P.sound("hit", join(tone(0.03, 300, 120, "square", 0.3), lowpass(tone(0.12, 0, 0, "noise", 0.45, seed=5), 0.4, 0.05)))
    P.sound("hurt", join(tone(0.08, 400, 180, "square", 0.25), tone(0.12, 180, 90, "square", 0.2)))
    P.sound("pickup", join(tone(0.06, 988, 988, "square", 0.18), tone(0.22, 1319, 1319, "square", 0.18)))
    P.sound("power", join(*[tone(0.08, f, f, "square", 0.18) for f in (523, 659, 784, 1047, 1319)]))
    P.sound("door", lowpass(tone(0.5, 0, 0, "noise", 0.6, seed=6), 0.15, 0.01))
    P.sound("roar", mix(tone(0.9, 140, 60, "square", 0.25), lowpass(tone(0.9, 0, 0, "noise", 0.5, seed=8), 0.2, 0.02)))
    P.sound("boom", lowpass(tone(0.8, 0, 0, "noise", 0.7, seed=9), 0.3, 0.01))
    P.sound("splash", lowpass(tone(0.35, 0, 0, "noise", 0.5, seed=10), 0.6, 0.05))
    P.sound("checkpoint", join(*[tone(0.1, f, f, "tri", 0.3) for f in (392, 523, 659, 784)]))
    # Music: a minor-key walk for the forest, and a faster one for bosses.
    A_ = [57, 0, 60, 64, 62, 0, 60, 59, 57, 0, 64, 0, 62, 60, 59, 0,
          57, 0, 60, 64, 67, 0, 65, 64, 62, 0, 60, 0, 59, 0, 0, 0]
    P.sound("music_forest", music_loop(A_ * 2, [45, 45, 52, 52, 41, 41, 48, 48, 43, 43, 50, 50, 40, 40, 47, 47], 104), volume=0.6)
    B_ = [57, 57, 60, 57, 63, 57, 62, 60, 57, 57, 60, 57, 64, 63, 62, 60]
    P.sound("music_boss", music_loop(B_ * 4, [33, 33, 45, 33, 36, 36, 48, 36], 150), volume=0.6)

    # ---- code: scripts first (every object can call them), then objects.
    P.script("font", "# Made by build.py from font.py: which frame of the font sprites is which character.\n"
             f"FONT_CHARS = {json.dumps(font.CHARS, ensure_ascii=False)}\n"
             "FONT_INDEX = {c: i for i, c in enumerate(FONT_CHARS)}\n")
    for f in sorted((HERE / "game").glob("_*.py")):
        head, _ = read_code(f)
        P.script(head.get("script", f.stem.strip("_")), f.read_text())
    files = sorted(f for f in (HERE / "game").glob("*.py") if not f.name.startswith("_"))
    parsed = {f.stem: read_code(f) for f in files}
    for name, (head, _) in parsed.items():
        P.obj(name, depth=int(head.get("depth", 0)), visible=head.get("visible", "yes") == "yes",
              persistent=head.get("persistent", "no") == "yes", solid=head.get("solid", "no") == "yes")
    for name, (head, events) in parsed.items():
        o = next(x for x in P.p["objects"] if x["name"] == name)
        if head.get("sprite"):
            o["sprite"] = P.sprite_id(head["sprite"])
        if head.get("parent"):
            o["parent"] = P.obj_id(head["parent"])
        for ev, code in events:
            o["events"].append({"id": new_id(), "key": event_key(ev, P), "mode": "python", "code": code})

    # ---- rooms: the title, then each level in order, then the ending.
    def plain_room(name, color, objs):
        lid = new_id()
        return {"id": new_id(), "name": name, "width": VIEW_W, "height": VIEW_H, "background": color,
                "gridWidth": TILE, "gridHeight": TILE, "snap": True,
                "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
                "camera": {"enabled": False, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 1},
                "instances": [{"id": new_id(), "object": P.obj_id(o), "layer": lid, "x": x, "y": y, "scaleX": 1, "scaleY": 1,
                               "angle": 0, "code": ""} for o, x, y in objs]}

    P.p["rooms"].append(plain_room("Title", "#0f1a17", [("Title", 0, 0)]))
    level_objects = {
        "P": ("Player", ""), "C": ("Checkpoint", ""), "s": ("Snail", ""), "b": ("Boar", ""), "e": ("Bee", ""),
        "h": ("Potion", ""), "k": ("Key", ""), "D": ("Gate", ""), "R": ("Relic", ""), "H": ("HeartUp", ""),
        "B": ("Tusk", ""), "T": ("BossTrigger", ""), "G": ("BossGate", ""), "X": ("Exit", ""), "c": ("Coin", ""),
        "M": ("MossBlock", ""), "~": ("Water", ""),
    }
    import reach
    cfg = reach.load_config(HERE)
    for f in sorted((HERE / "levels").glob("*.txt")):
        meta, rows = read_level(f)
        if check:
            problems = reach.check(rows, cfg)
            for problem in problems:
                print(f"  {f.name}: {problem}")
            if problems and strict:
                raise SystemExit(f"{f.name} can't be finished as drawn (--no-check to build anyway).")
        room = build_level(P, forest_ts, forest, meta, rows, level_objects)
        # Every level has its own Backdrop and HUD.
        lid = room["layers"][0]["id"]
        for o in ("Backdrop", "Hud"):
            room["instances"].insert(0, {"id": new_id(), "object": P.obj_id(o), "layer": lid, "x": 0, "y": 0,
                                         "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""})
        P.p["rooms"].append(room)
    P.p["rooms"].append(plain_room("Ending", "#0f1a17", [("Ending", 0, 0)]))

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    # project.json on its own too, for the playtest (frontend/src/showcase/).
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    size = out.stat().st_size
    print(f"{out}  {size / 1e6:.1f} MB  {len(P.p['sprites'])} sprites, {len(P.p['objects'])} objects, {len(P.p['rooms'])} rooms")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--assets", default="~/Downloads")
    ap.add_argument("--out", default=str(HERE / "out" / "Thornwood.zip"))
    ap.add_argument("--no-check", action="store_true", help="skip the route check (reach.py)")
    a = ap.parse_args()
    build(a.assets, Path(a.out), check=not a.no_check)
