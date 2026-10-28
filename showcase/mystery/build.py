#!/usr/bin/env python3
"""
Builds the third showcase game, "Mystery Meat from Outer Space", as a
GameIDE project zip: a point-and-click adventure in the spirit of
LucasArts' Zak McKracken.

    python3 showcase/mystery/build.py              # → showcase/mystery/out/Mystery.zip
    python3 showcase/mystery/build.py --assets DIR # where the pictures are

THE PICTURES ARE NOT IN THIS REPOSITORY. The teacher makes them with Google
Gemini from PROMPTS.md, into ~/Downloads/mystery/. Any picture not there
yet is drawn here as a stand-in — a flat room with its clickable spots
boxed and named, a coloured figure for each pose — so the game can be
built and played before the art exists, and every spot's box can be
checked against the room it belongs to.

Gemini's "pixel art" is a big smooth picture of pixel art: its pixels are
blocks of uneven size, edged with blur. Each picture is shrunk to the
game's real size (320 x 144 for a room) and its colours cut to a small
palette, which makes them pixels again. Sprites come on flat magenta:
that is cut away, the frames found by the gaps between them, and every
frame put on one canvas with its feet in the same place.

The game is game/*.py, read as Thornwood's are: _1world.py (rooms, spots,
people, items), _2engine.py (verbs, walking, the action queue),
_3story.py (what everything does), _4screen.py (drawing), and Game.py.
"""
import argparse
import importlib.util
import json
import math
import random
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("thornwood_build", HERE.parent / "build.py")
_tw = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_tw)
_fspec = importlib.util.spec_from_file_location("thornwood_font", HERE.parent / "font.py")
font = importlib.util.module_from_spec(_fspec)
_fspec.loader.exec_module(font)

W, ROOM_H = 320, 144
HEIGHTS = {"robin": 50, "glorbin": 54, "hoover": 48, "gus": 56, "dot": 50}   # the tallest pose, in pixels
SHEETS = {"robin": ["c-robin-walk", "c-robin-poses"], "glorbin": ["c-glorbin"], "hoover": ["c-hoover"],
          "gus": ["c-gus"], "dot": ["c-dot"]}
PICTURES = {"title": ((320, 180), "title"), "telescope": ((200, 200), "telescope"), "newspaper": ((150, 200), "newspaper")}
COLORS = 48          # each picture's palette


class Adventure(_tw.Project):
    def write(self, path):
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n"
                       "Pictures made with Google Gemini.\n")


def load_world():
    ns = {}
    exec((HERE / "game" / "_1world.py").read_text(), ns)
    return ns


def find(A, name):
    for ext in ("png", "jpeg", "jpg", "webp"):
        if (A / f"{name}.{ext}").is_file():
            return A / f"{name}.{ext}"
    return None


# ---------------------------------------------------------------- making Gemini's pictures pixels again

def pixelate(im, size):
    """Shrunk to the game's own pixels (each the average of its block), then a small palette."""
    im = ImageOps.fit(im.convert("RGB"), size, Image.BOX)
    return im.quantize(COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")


def is_magenta(r, g, b):
    return r > 150 and b > 150 and g < 110 and abs(r - b) < 90


def cut_frames(im, expect=None):
    """Sprites on flat magenta: the magenta made clear, and each figure cut out, left to right."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if is_magenta(r, g, b):
                px[x, y] = (0, 0, 0, 0)
    alpha = im.getchannel("A")
    cols = [any(alpha.getpixel((x, y)) for y in range(0, h, 2)) for x in range(w)]
    runs, start = [], None
    for x, c in enumerate(cols + [False]):
        if c and start is None:
            start = x
        elif not c and start is not None:
            if x - start > w // 60:          # not a stray speck
                runs.append((start, x))
            start = None
    frames = []
    for x1, x2 in runs:
        part = im.crop((x1, 0, x2, h))
        box = part.getchannel("A").getbbox()
        if box:
            frames.append(part.crop(box))
    if expect and len(frames) != expect:
        print(f"    (found {len(frames)} figures, expected {expect})")
    return frames


def to_pixels(frames, height):
    """Every frame shrunk by the same amount (the tallest to `height`), its colours cut, its edges hard."""
    k = height / max(f.height for f in frames)
    out = []
    for f in frames:
        small = f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.BOX)
        rgb = small.convert("RGB").quantize(32, dither=Image.Dither.NONE).convert("RGB")
        a = small.getchannel("A").point(lambda v: 255 if v > 110 else 0)
        rgb.putalpha(a)
        out.append(rgb)
    return out


def on_canvas(frames):
    """All frames on one canvas, feet together at the bottom middle (the sprite's origin)."""
    cw = max(f.width for f in frames) + 2
    ch = max(f.height for f in frames) + 1
    out = []
    for f in frames:
        c = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        c.paste(f, ((cw - f.width) // 2, ch - 1 - f.height), f)
        out.append(c)
    return out, (cw // 2, ch - 1)


# ---------------------------------------------------------------- stand-ins, until the pictures come

TINY = ImageFont.load_default()
ROOM_TINTS = {"newsroom": (70, 60, 90), "hallway": (60, 80, 70), "cafeteria": (90, 80, 50), "kitchen": (60, 70, 80),
              "office": (80, 60, 50), "basement": (50, 45, 55), "roof": (25, 30, 60), "mothership": (40, 70, 70)}


def stand_in_room(key, room):
    c = ROOM_TINTS.get(key, (60, 60, 60))
    im = Image.new("RGB", (W, ROOM_H), c)
    d = ImageDraw.Draw(im)
    d.polygon(room["walk"], fill=tuple(int(v * 0.6) for v in c))
    for s in room["spots"]:
        if s.get("actor"):
            continue
        d.rectangle(s["box"], outline=(255, 230, 120))
        d.text((s["box"][0] + 2, s["box"][1] + 2), s["name"][:12], fill=(255, 255, 255), font=TINY)
    d.text((4, 2), room["name"], fill=(255, 255, 255), font=TINY)
    return im


def stand_in_figures(who, poses, color, size):
    w, h = size
    out = []
    for name, frame in sorted(((n, f) for n, fs in poses.items() for f in (fs if isinstance(fs, list) else [fs])), key=lambda p: p[1]):
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        low = name in ("asleep",)
        top = h // 2 if low else 4
        d.ellipse((w // 2 - 6, top, w // 2 + 6, top + 12), fill=color)
        d.rectangle((w // 2 - 7, top + 12, w // 2 + 7, h - 12), fill=tuple(int(v * 0.7) for v in color))
        step = frame % 2 * 3 if name == "walk" else 0
        d.rectangle((w // 2 - 6 + step, h - 12, w // 2 - 2 + step, h - 1), fill=(40, 40, 60))
        d.rectangle((w // 2 + 2 - step, h - 12, w // 2 + 6 - step, h - 1), fill=(40, 40, 60))
        d.text((1, top + 14), name[:4], fill=(0, 0, 0), font=TINY)
        out.append(im)
    return out


def stand_in_items(names):
    out = []
    for n in names:
        im = Image.new("RGBA", (33, 19), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rectangle((1, 1, 31, 17), fill=(90, 70, 140), outline=(200, 180, 255))
        d.text((3, 3), n[:5], fill=(255, 255, 255), font=TINY)
        out.append(im)
    return out


def stand_in_picture(key, size):
    im = Image.new("RGB", size, (20, 20, 40))
    d = ImageDraw.Draw(im)
    if key == "newspaper":
        im.paste((235, 230, 215), (0, 0, size[0], size[1]))
        d.rectangle((0, 8, size[0], 40), fill=(250, 248, 240))
        d.rectangle((22, 46, 128, 128), fill=(255, 255, 255), outline=(0, 0, 0))
        for y in range(136, 196, 8):
            d.line((10, y, size[0] - 10, y), fill=(160, 160, 160))
    elif key == "telescope":
        d.ellipse((10, 10, 190, 190), fill=(10, 10, 20))
        d.ellipse((60, 60, 140, 140), fill=(220, 220, 200))
        d.ellipse((120, 70, 170, 95), fill=(120, 230, 120))
    else:
        d.rectangle((0, size[1] * 2 // 3, size[0], size[1]), fill=(40, 40, 30))
        d.ellipse((size[0] // 2 - 30, 50, size[0] // 2 + 30, 70), fill=(120, 230, 120))
    d.text((4, size[1] - 12), key, fill=(255, 255, 255), font=TINY)
    return im


# ---------------------------------------------------------------- the Python puzzles, run in Python

def run_python(src):
    """What a program prints, and the name of the error it stopped on (or None)."""
    import contextlib
    import io
    out = io.StringIO()
    try:
        with contextlib.redirect_stdout(out):
            exec(src, {})
    except Exception as e:  # the wrong answers are meant to crash
        return out.getvalue(), type(e).__name__
    return out.getvalue(), None


def check_puzzles():
    """Every puzzle in game/_5code.py, run for real: the right answer must
    be the only one Python agrees with, a shown error must be the one
    Python gives, and it must all fit on the screen in the pixel font. A
    puzzle whose "right" answer is wrong would teach the wrong Python, and
    nothing in the game would ever show it."""
    ns = {}
    exec((HERE / "game" / "_5code.py").read_text(), ns)
    shown = {}
    exec("\n".join(l for l in (HERE / "game" / "_4screen.py").read_text().splitlines()
                   if l.startswith(("CODE_X", "CODE_SAY"))), shown)
    cols = (shown["CODE_W"] - 8) // 6
    problems = []
    for pid, p in ns["PUZZLES"].items():
        c = p.get("check", {})

        def run(answer):
            lines = list(p["code"])
            if "fix" in c:
                lines[c["fix"]] = answer
            src = f"def input(prompt=''):\n    return {answer!r}\n" + c.get("setup", "") + "\n" + "\n".join(lines)
            return run_python(src)

        rights = [a for a in p["answers"] if a[1]]
        if len(rights) != 1:
            problems.append(f"{pid}: {len(rights)} right answers")
        for words, right, why in p["answers"]:
            out, err = run(words)
            worked = err is None and out.strip() == c.get("goal", words)
            if worked != right:
                problems.append(f"{pid}: {words!r} is marked {'right' if right else 'wrong'}, but Python printed {out.strip()!r}" + (f" and raised {err}" if err else ""))
            talk = len(_wrap(why, shown["CODE_SAY_COLS"]))
            if talk > 3:
                problems.append(f"{pid}: what Robin says about {words!r} is {talk} lines; 3 fit under the screen")
            if len(words) > 52:
                problems.append(f"{pid}: answer {words!r} is too long for the panel")
        if p.get("error"):
            _, err = run_python("def input(prompt=''):\n    return '9001'\n" + c.get("setup", "") + "\n" + "\n".join(p["code"]))
            if not err or not p["error"].startswith(err):
                problems.append(f"{pid}: the screen says {p['error']!r}, Python raised {err}")
        for line in [p["title"], p["ask"], p.get("error", "")] + p["code"]:
            fits = cols - (2 if line in p["code"] else 0)    # code lines start after their numbers
            if len(line) > fits:
                problems.append(f"{pid}: {line!r} is wider than the screen ({fits} characters)")
            bad = set(line) - set(font.CHARS)
            if bad:
                problems.append(f"{pid}: the pixel font has no {''.join(sorted(bad))!r} for {line!r}")
        rows = 2 + len(p["code"]) + (1 if p.get("error") else 0) + 1
        bottom = shown["CODE_Y"] + 6 + 10 * rows + 2
        if bottom > ROOM_H - 2 - 30:
            problems.append(f"{pid}: the screen reaches y={bottom}, over where Robin's words go")
    if problems:
        raise SystemExit("Python puzzles:\n  " + "\n  ".join(problems))
    return len(ns["PUZZLES"])


def _wrap(text, cols):
    lines, line = [], ""
    for word in text.split(" "):
        if line and len(line) + 1 + len(word) > cols:
            lines.append(line)
            line = word
        else:
            line = f"{line} {word}" if line else word
    return lines + [line]


# ---------------------------------------------------------------- sounds

def sweep(seconds, f0, f1, vol=0.25):
    return _tw.tone(seconds, f0, f1, "sine", vol)


def build(assets_dir, out):
    print(f"  {check_puzzles()} Python puzzles, each answer run in Python")
    A = Path(assets_dir).expanduser()
    world = load_world()
    P = Adventure("Mystery Meat from Outer Space")
    P.p["settings"]["pixelScaling"] = True
    made = []

    for key, room in world["ROOMS"].items():
        f = find(A, room["pic"])
        made.append(room["pic"] if f else None)
        im = pixelate(Image.open(f), (W, ROOM_H)) if f else stand_in_room(key, room)
        P.sprite(f"room_{key}", [im.convert("RGBA")], (0, 0))
    for key, (size, file) in PICTURES.items():
        f = find(A, file)
        made.append(file if f else None)
        im = pixelate(Image.open(f), size) if f else stand_in_picture(key, size)
        P.sprite(f"pic_{key}", [im.convert("RGBA")], (0, 0))

    for who, a in world["ACTORS"].items():
        count = sum(len(v) if isinstance(v, list) else 1 for v in a["poses"].values())
        files = [find(A, s) for s in SHEETS[who]]
        if all(files):
            frames = []
            for f in files:
                frames += to_pixels(cut_frames(Image.open(f)), HEIGHTS[who])
            made += SHEETS[who]
            if len(frames) < count:      # fewer figures than poses: the last one stands in for the rest
                print(f"  {who}: {len(frames)} figures for {count} poses")
                frames += [frames[-1]] * (count - len(frames))
            frames = frames[:count]
        else:
            color = tuple(int(a["color"][i:i + 2], 16) for i in (1, 3, 5)) + (255,)
            frames = stand_in_figures(who, a["poses"], color, (28, HEIGHTS[who]))
        canvas, origin = on_canvas(frames)
        P.sprite(a["sprite"], canvas, origin)

    names = sorted(world["ITEMS"], key=lambda k: world["ITEMS"][k][1])
    f = find(A, "items")
    if f:
        icons = []
        sheet = Image.open(f).convert("RGBA")
        sw, sh = sheet.size
        for r in range(3):              # a 4 x 3 grid: each row cut on its own
            icons += cut_frames(sheet.crop((0, r * sh // 3, sw, (r + 1) * sh // 3)))
        icons = [ImageOps.contain(i, (31, 17), Image.BOX) for i in icons][:12]
        canvas = []
        for i in icons:
            c = Image.new("RGBA", (33, 19), (0, 0, 0, 0))
            c.paste(i, ((33 - i.width) // 2, (19 - i.height) // 2), i)
            canvas.append(c)
        made.append("items")
    else:
        canvas = stand_in_items(names)
    P.sprite("items", canvas, (0, 0))

    P.sprite("font", font.frames((255, 255, 255), Image, 1, shadow=(20, 16, 12)), (0, 0))
    P.script("font", "# Made by build.py from Thornwood's font.py: which frame of the font sprite is which character.\n"
             f"FONT_CHARS = {json.dumps(font.CHARS, ensure_ascii=False)}\n"
             "FONT_INDEX = {c: i for i, c in enumerate(FONT_CHARS)}\n")

    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    P.sound("click", tone(0.03, 1200, 900, "square", 0.12))
    P.sound("pickup", join(tone(0.06, 784, 784, "square", 0.15), tone(0.12, 1175, 1175, "square", 0.15)))
    P.sound("door", lowpass(tone(0.3, 0, 0, "noise", 0.5, seed=31), 0.2, 0.02))
    P.sound("nope", join(tone(0.08, 220, 220, "square", 0.15), tone(0.14, 165, 165, "square", 0.15)))
    P.sound("sizzle", lowpass(tone(0.7, 0, 0, "noise", 0.45, seed=32), 0.9, 0.3))
    P.sound("radio", mix(lowpass(tone(0.8, 0, 0, "noise", 0.3, seed=33), 0.6, 0.6),
                         join(*[tone(0.05, 1400 + 300 * (i % 3), 1400, "square", 0.08) + [0.0] * 800 for i in range(6)])))
    P.sound("teleport", mix(sweep(1.0, 200, 1800, 0.2), sweep(1.0, 300, 2400, 0.12)))
    P.sound("flash", join(tone(0.02, 0, 0, "noise", 0.5, seed=34), sweep(0.4, 2400, 800, 0.15)))
    # A jaunty theme, in the spirit of a 1988 adventure: a walking bass and a cheeky tune.
    mel = [72, 0, 76, 79, 77, 76, 74, 0, 72, 0, 74, 76, 72, 0, 67, 0,
           72, 0, 76, 79, 81, 79, 77, 76, 74, 77, 76, 74, 72, 0, 0, 0]
    bass = [48, 52, 55, 52, 53, 57, 60, 57, 55, 59, 62, 59, 48, 52, 55, 52]
    P.sound("theme", _tw.music_loop(mel * 2, bass, 132), volume=0.5)

    for f in sorted((HERE / "game").glob("_*.py")):
        head, _ = _tw.read_code(f)
        P.script(head.get("script", f.stem.strip("_")), f.read_text())
    for f in sorted(f for f in (HERE / "game").glob("*.py") if not f.name.startswith("_")):
        head, events = _tw.read_code(f)
        o = P.obj(f.stem)
        for ev, code in events:
            o["events"].append({"id": _tw.new_id(), "key": _tw.event_key(ev, P), "mode": "python", "code": code})

    lid = _tw.new_id()
    P.p["rooms"].append({
        "id": _tw.new_id(), "name": "School", "width": W, "height": 200, "background": "#000000",
        "gridWidth": 8, "gridHeight": 8, "snap": True,
        "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
        "camera": {"enabled": False, "width": W, "height": 200, "follow": None, "smoothing": 1},
        "instances": [{"id": _tw.new_id(), "object": P.obj_id("Game"), "layer": lid, "x": 0, "y": 0,
                       "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""}],
    })

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    real = [m for m in made if m]
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(real)} pictures of the teacher's, the rest stand-ins")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--assets", default="~/Downloads/mystery")
    ap.add_argument("--out", default=str(HERE / "out" / "Mystery.zip"))
    a = ap.parse_args()
    build(a.assets, Path(a.out))
