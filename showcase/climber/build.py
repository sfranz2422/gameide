#!/usr/bin/env python3
"""
Builds the twelfth showcase game, "Snowcap Scramble", as a GameIDE project zip:
an endless climb up an icy mountain.

    python3 showcase/climber/build.py      # → showcase/climber/out/Climber.zip

The pictures are the teacher's, made with Gemini (PROMPTS.md), cut by
cut_sheets.py into art/ at twice the game's size; here each is made the size the
game draws it. Ledges come in pieces (an end, a middle, an end) and are put
together here in every width the mountain uses.

THE GAME IS OBJECTS: Ledge and its kinds (RockLedge, IceLedge, CrumbleLedge,
Plank, IceBlock, Ground), Climber and Player, Mountain (makes the part of the
mountain near the camera from the plan in game/_1rules.py), Walls, Decor, Bird,
Snowball, Splat, Hud, Title.
"""
import importlib.util
import io
import json
import math
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


HERE = Path(__file__).resolve().parent
ART = HERE / "art"
_tw = _load("thornwood_build", HERE.parent / "build.py")
RULES = {"global_vars": type("G", (), {})()}
exec((HERE / "game" / "_1rules.py").read_text(), RULES)
VIEW_W, VIEW_H, ROOM_W, ROOM_H, GROUND_Y = RULES["VIEW_W"], RULES["VIEW_H"], RULES["ROOM_W"], RULES["ROOM_H"], RULES["GROUND_Y"]
WIDTHS = RULES["WIDTHS"]
CLIMBERS = ["red", "teal", "purple", "orange", "penguin", "bear", "fox", "yeti"]
POSES = ["stand", "run1", "run2", "jump", "fall", "throw"]


def webp(im):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=88, method=6)
    return buf.getvalue()


class Climb(_tw.Project):
    def picture(self, name, im, origin=(0, 0)):
        """A big picture (a sky, the camp), kept as WebP: as PNG it's many times the size."""
        self.p["sprites"].append({"id": _tw.new_id(), "name": name, "width": im.width, "height": im.height,
                                  "originX": origin[0], "originY": origin[1], "frames": [self.asset(webp(im), "webp")]})

    def font(self, name, path):
        self.p["fonts"].append({"id": _tw.new_id(), "name": name, "asset": self.asset(path.read_bytes(), "woff2")})

    def write(self, path):
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n"
                       "Pictures made with Google Gemini. Type: Ubuntu (Ubuntu Font Licence).\n")


def art(name, k=0.5):
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    return im if k == 1 else im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def snow_top(im):
    """How far down the ledge's top is: the first row with any snow across its middle."""
    a = im.getchannel("A")
    mid = range(im.width // 3, 2 * im.width // 3)
    return next(y for y in range(im.height) if sum(1 for x in mid if a.getpixel((x, y)) > 128) > len(mid) * 0.6)


# The ledge pieces, scaled so a rock ledge is about 30 pixels thick.
LEDGE_K = 0.2
END_KEEP = 22        # pixels of each end piece kept: their outer edge, with its icicles


def ledge_picture(kind, w):
    left, mid, right = (art(f"{kind}_{p}", LEDGE_K) for p in "lmr")
    left = left.crop((0, 0, END_KEEP, left.height))
    right = right.crop((right.width - END_KEEP, 0, right.width, right.height))
    need = w - 2 * END_KEEP
    middle = Image.new("RGBA", (need, mid.height))
    x = 0
    while x < need:
        middle.alpha_composite(mid, (x, 0))
        x += mid.width
    h = max(left.height, middle.height, right.height)
    out = Image.new("RGBA", (w, h))
    out.alpha_composite(left, (0, 0))
    out.alpha_composite(middle, (END_KEEP, 0))
    out.alpha_composite(right, (w - END_KEEP, 0))
    return out


# Where a climber's legs start, down from the top of its picture.
LEGS = {"penguin": 0.8, "fox": 0.66}


def other_stride(pic, legs_from):
    """The same runner a step later: the legs (below `legs_from` of the height) flipped about their middle."""
    w, h = pic.size
    top = round(h * legs_from)
    legs = pic.crop((0, top, w, h))
    box = legs.getbbox()
    if box is None:
        return pic.copy()
    part = legs.crop(box).transpose(Image.FLIP_LEFT_RIGHT)
    out = pic.copy()
    out.paste((0, 0, 0, 0), (box[0], top + box[1], box[2], top + box[3]))
    out.alpha_composite(part, (box[0], top + box[1]))
    return out


def fade_ends(im, band):
    """The picture fading out at its left and right ends, so it melts into the snow either side."""
    out = im.copy()
    a = out.getchannel("A")
    px = a.load()
    for x in range(band):
        k = (x + 0.5) / band
        for xx in (x, im.width - 1 - x):
            for y in range(im.height):
                px[xx, y] = round(px[xx, y] * k)
    out.putalpha(a)
    return out


def snow_strip(camp, width=128, height=64):
    """
    A strip of snowy ground that repeats left to right, for either side of the camp:
    a thin dark edge, bright snow under it shading to blue, a gently bumpy top and a
    little sparkle, in the picture's style. Returns it and the camp row its top
    lines up with (where the camp's own ground starts at its right-hand end, which
    is only snow: the left has a pine tree on it).
    """
    import random
    a = camp.getchannel("A")
    cols = list(range(int(camp.width * 0.94), int(camp.width * 0.99)))
    tops = sorted(next(y for y in range(camp.height) if a.getpixel((x, y)) > 128) for x in cols)
    top = tops[len(tops) // 2]
    edge, light, white, low = (34, 64, 118), (210, 242, 255), (247, 252, 255), (150, 204, 238)
    out = Image.new("RGBA", (width, height))
    rng = random.Random(3)
    for x in range(width):
        # Bumps that join up at the ends: whole waves across the strip.
        lift = round(2 + 1.5 * math.sin(2 * math.pi * x / 64) + math.sin(2 * math.pi * x / 32 + 1))
        for y in range(lift, height):
            k = y - lift
            if k < 2:
                c = edge
            elif k < 5:
                c = light
            else:
                t = min(1.0, (k - 5) / (height - 12))
                c = tuple(round(white[i] + (low[i] - white[i]) * t * t) for i in range(3))
            out.putpixel((x, y), c + (255,))
    for _ in range(width // 5):
        x, y = rng.randrange(width), rng.randrange(10, height - 8)
        out.putpixel((x, y), (190, 225, 248, 255) if rng.random() < 0.6 else (255, 255, 255, 255))
    return out, top


def fitted(name, width):
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    return im.resize((width, max(1, round(im.height * width / im.width))), Image.LANCZOS)


def on_canvas(frames, size, at="top"):
    out = []
    for f in frames:
        c = Image.new("RGBA", size)
        c.alpha_composite(f, ((size[0] - f.width) // 2, 0 if at == "top" else size[1] - f.height))
        out.append(c)
    return out


def wall_picture(side):
    """A strip of the cliff for one side, darker toward the climb, so it reads as a wall in front."""
    im = art("wall")
    w = 72
    strip = im.crop((0, 0, w, im.height)) if side == "left" else im.crop((im.width - w, 0, im.width, im.height))
    shade = Image.new("RGBA", strip.size)
    d = ImageDraw.Draw(shade)
    for i in range(16):
        x = w - 1 - i if side == "left" else i
        d.line([(x, 0), (x, strip.height)], fill=(10, 24, 40, int(150 * (1 - i / 16))))
    strip.alpha_composite(shade)
    return strip


def make_sounds(P):
    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    P.sound("jump", tone(0.12, 330, 620, "square", 0.18))
    P.sound("land", lowpass(tone(0.08, 0, 0, "noise", 0.5, seed=5), 0.3, 0.05))
    P.sound("thud", mix(tone(0.2, 140, 50, "sine", 0.7), lowpass(tone(0.25, 0, 0, "noise", 0.6, seed=9), 0.25, 0.03)))
    P.sound("throw", lowpass(tone(0.12, 0, 0, "noise", 0.5, seed=3), 0.8, 0.2))
    P.sound("splat", mix(lowpass(tone(0.16, 0, 0, "noise", 0.6, seed=7), 0.5, 0.06), tone(0.06, 220, 120, "sine", 0.3)))
    P.sound("crack", mix(tone(0.1, 0, 0, "noise", 0.3, seed=6), tone(0.08, 2600, 1800, "sine", 0.2)))
    P.sound("break", mix(tone(0.3, 0, 0, "noise", 0.4, seed=8), tone(0.22, 2200, 900, "sine", 0.2), tone(0.18, 3100, 1500, "sine", 0.15)))
    P.sound("wind", lowpass(tone(2.2, 0, 0, "noise", 0.35, seed=11), 0.12, 0.02))
    P.sound("tweet", join(tone(0.05, 2400, 3200, "sine", 0.2), tone(0.06, 2800, 3600, "sine", 0.2)))
    P.sound("click", tone(0.03, 900, 700, "square", 0.12))
    P.sound("bonk", mix(tone(0.12, 520, 180, "tri", 0.45), lowpass(tone(0.1, 0, 0, "noise", 0.4, seed=12), 0.5, 0.1)))
    P.sound("zone", join(*[tone(0.1, f, f, "tri", 0.3) for f in (659, 784, 988)], tone(0.4, 1319, 1319, "tri", 0.3)))
    # A slow, cold little tune: A minor, two bars round.
    melody = [69, 0, 72, 0, 76, 74, 72, 0, 71, 0, 72, 74, 76, 0, 0, 0, 69, 0, 72, 0, 77, 76, 74, 0, 72, 0, 71, 0, 69, 0, 0, 0]
    bass = [45, 45, 45, 45, 41, 41, 41, 41, 43, 43, 43, 43, 45, 45, 45, 45]
    P.sound("music", _tw.music_loop(melody, bass, 92, seed=4), volume=0.8)


def build(out):
    P = Climb("Snowcap Scramble")
    P.p["settings"]["pixelScaling"] = False
    P.p["settings"]["scoreboard"] = {"unit": "m"}
    sizes = {}

    def sprite(name, frames, origin, mask=None, fps=None):
        s = P.sprite(name, frames, origin, mask=mask, fps=fps)
        sizes[name] = (s["width"], s["height"])
        return s

    def picture(name, im, origin=(0, 0)):
        P.picture(name, im, origin)
        sizes[name] = im.size

    # The climbers: one sprite each, its frames the poses. Feet at the origin.
    for c in CLIMBERS:
        frames = [art(f"climber_{c}_{p}") for p in POSES]
        # Gemini's two running frames came back nearly the same, so running looked
        # like sliding: the second is the first with its legs the other way round.
        frames[2] = other_stride(frames[1], LEGS.get(c, 0.72))
        sprite(f"climber_{c}", frames, (24, 56), mask=(15, 14, 33, 56))
        sprite(f"face_{c}", [art(f"face_{c}")], (0, 0))
    sprite("climber_red_0", [art("climber_red_stand")], (24, 56), mask=(15, 14, 33, 56))
    # The game's picture on My Games and in Explore: a sprite called "icon" (GameIDE's
    # rule, as in microStudio). The red-jacket climber's face, on a sky-blue tile.
    face = art("face_red", 1).resize((96, 96), Image.LANCZOS)
    tile = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rounded_rectangle((0, 0, 127, 127), radius=22, fill=(143, 201, 239, 255))
    tile.alpha_composite(face, (16, 24))
    sprite("icon", [tile], (64, 64))

    # Ledges: every width the plan uses, each kind. The origin is the middle of the top of the snow.
    for kind in ("rock", "ice"):
        for w in WIDTHS:
            im = ledge_picture(kind, w)
            top = snow_top(im)
            sprite(f"{kind}_{w}", [im], (w // 2, top), mask=(0, top, w, top + 12))
    crumble = [fitted(f"crumble_{i}", RULES["CRUMBLE_W"] if i < 2 else round(RULES["CRUMBLE_W"] * 300 / 298)) for i in range(3)]
    size = (max(f.width for f in crumble), max(f.height for f in crumble))
    frames = [Image.new("RGBA", size) for _ in crumble]
    for f, c in zip(frames, crumble):
        f.alpha_composite(c, (0, 0))
    top = snow_top(frames[0])
    sprite("crumble", frames, (RULES["CRUMBLE_W"] // 2, top), mask=(0, top, RULES["CRUMBLE_W"], top + 12))
    plank = fitted("plank", RULES["PLANK_W"])
    a = plank.getchannel("A")
    board = next(y for y in range(plank.height) if sum(1 for x in range(plank.width) if a.getpixel((x, y)) > 128) > plank.width * 0.7)
    sprite("plank", [plank], (plank.width // 2, board + 2), mask=(0, board, plank.width, board + 12))
    block = fitted("iceblock", RULES["BLOCK_W"])
    top = snow_top(block)
    sprite("iceblock", [block], (block.width // 2, top), mask=(0, top, block.width, top + 12))

    # Snowballs and their splat.
    balls = on_canvas([fitted("snowball", 14), fitted("snowball_fast", 18)], (18, 15))
    sprite("snowball", balls, (9, 7), mask=(3, 2, 15, 13))
    sprite("splat", [art(f"splat_{i}") for i in range(3)], (28, 30), fps=12)
    sprite("stars", [art("stars")], (20, 12))

    # Things on the mountain, standing on their feet.
    for name in ("pine_small", "pine_tall", "crystals", "snowball_pile", "bird", "sign", "flag", "icicles"):
        im = art(name, 0.25)
        sprite(name, [im], (im.width // 2, im.height))
    for i in range(6):
        im = art(f"cloud_{i}", 0.6)
        picture(f"cloud_{i}", im)

    # The big pictures.
    for name in ("sky_day", "sky_dusk", "sky_night"):
        picture(name, art(name, 1))
    picture("far_mountains", art("far_mountains"))
    picture("title", art("title"))
    camp = art("camp")
    # The camp stands on the ground at its snow line, found between the cabin and the fire
    # (right of the fire is a tent, whose top isn't the ground).
    a = camp.getchannel("A")
    snow = max(next(y for y in range(camp.height) if a.getpixel((x, y)) > 128) for x in range(int(camp.width * 0.45), int(camp.width * 0.49)))
    picture("camp", fade_ends(camp, 60), (camp.width // 2, snow + 6))
    # The snow either side of the camp: its own ground, row by row, made to repeat.
    strip, top = snow_strip(camp)
    picture("snow_ground", strip)
    ground_top = top - (snow + 6)
    for side in ("left", "right"):
        picture(f"wall_{side}", wall_picture(side))
    P.font("Ubuntu", HERE / "fonts" / "ubuntu-latin-700-normal.woff2")
    make_sounds(P)

    # Scripts: the rules, the screen's helpers, and the pictures' sizes (for drawing them to fit).
    for f in sorted((HERE / "game").glob("_*.py")):
        head, _ = _tw.read_code(f)
        P.script(head.get("script", f.stem.strip("_")), f.read_text())
    P.script("art", "# script: art\n# Written by build.py: how big each picture is, for drawing them to fit the screen.\n"
             f"SIZES = {json.dumps({k: list(v) for k, v in sorted(sizes.items())})}\n"
             "# Where the snow beside the camp starts, down from the ground's top (the camp's snow line).\n"
             f"GROUND_TOP = {ground_top}\n")

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
    # A child with no depth of its own takes its parent's.
    for name, (head, _) in parsed.items():
        if "depth" not in head and head.get("parent"):
            o = next(x for x in P.p["objects"] if x["name"] == name)
            o["depth"] = int(parsed[head["parent"]][0].get("depth", 0))

    def room(name, width, height, placed, camera):
        lid = _tw.new_id()
        P.p["rooms"].append({
            "id": _tw.new_id(), "name": name, "width": width, "height": height, "background": "#8fc9ef",
            "gridWidth": 16, "gridHeight": 16, "snap": False,
            "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
            "camera": {"enabled": camera, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 1},
            "instances": [{"id": _tw.new_id(), "object": P.obj_id(o), "layer": lid, "x": x, "y": y,
                           "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""} for o, x, y in placed],
        })

    room("Title", VIEW_W, VIEW_H, [("Title", 0, 0)], False)
    # Base camp is in the middle of the foot of the mountain.
    middle = ROOM_W // 2
    room("Mountain", ROOM_W, ROOM_H, [("Mountain", 0, 0), ("Walls", 0, 0), ("Hud", 0, 0), ("Camp", middle, GROUND_Y),
                                      ("Ground", middle, GROUND_Y), ("Player", middle, GROUND_Y), ("Crowd", 0, 0)], True)

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(P.p['objects'])} objects, {len(P.p['sprites'])} sprites")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Climber.zip")
