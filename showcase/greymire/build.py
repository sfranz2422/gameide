#!/usr/bin/env python3
"""
Builds the second showcase game, "The Lantern of Greymire", as a GameIDE
project zip: an illustrated gamebook in the style of inkle's Sorcery!.

    python3 showcase/greymire/build.py              # → showcase/greymire/out/Greymire.zip
    python3 showcase/greymire/build.py --assets DIR # where the pictures are

THE PICTURES ARE NOT IN THIS REPOSITORY. The teacher made them with Google
Gemini from PROMPTS.md; they live in ~/Downloads/greymire/ under the names
used below. The fonts are here (fonts/, IM Fell by Igino Marini, under the
SIL Open Font License, which lets them travel inside a game).

The game itself is game/*.py, read the way Thornwood's are (../build.py's
read_code): the story in _1story.py, how the book works in _2book.py, the
drawing in _3screens.py, and one object, Book.

Gemini drew two expressions side by side in each portrait picture, and gave
Pip a body of willow leaves in every scene after the willow. The cutting
below and the story both follow the pictures as they came.
"""
import argparse
import importlib.util
import io
import json
import math
import random
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

HERE = Path(__file__).resolve().parent
# Thornwood's build.py: the project, the code reader and the sound makers. By
# its path, as "build" is this file's own name too.
_spec = importlib.util.spec_from_file_location("thornwood_build", HERE.parent / "build.py")
_tw = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_tw)
Project, RATE, event_key, join, lowpass, mix = _tw.Project, _tw.RATE, _tw.event_key, _tw.join, _tw.lowpass, _tw.mix
new_id, read_code, tone, wav_bytes = _tw.new_id, _tw.read_code, _tw.tone, _tw.wav_bytes

W, H = 1280, 720
PANEL = (480, 680)       # _3screens.py's PANEL_W, PANEL_H
FACE = (160, 200)        # _3screens.py's FACE_W, FACE_H

SCENES = {
    "title": "s01-title", "landing": "s02-landing", "ferry": "s03-ferry", "reeds": "s04-reeds",
    "willow": "s05-willow", "bridge": "s06-tollbridge", "chapel": "s07-chapel", "nave": "s08-nave",
    "door": "s09-riddle-door", "saltmere": "s10-saltmere", "street": "s11-street", "tower": "s12-belltower",
    "dawn": "s13-dawn", "dark": "s14-dark", "map": "map",
}
FACES = ["bearer", "marrow", "pip", "gallow", "keeper"]
FONTS = {"fell": "IMFeENrm28P.ttf", "fell_italic": "IMFeENit28P.ttf", "fell_sc": "IMFeENsc28P.ttf"}


def webp(im, quality=82):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6)
    return buf.getvalue()


class Book(Project):
    def picture(self, name, frames):
        """A sprite from finished pictures, kept as WebP: a painted scene as PNG is ten times the size."""
        w, h = frames[0].size
        self.p["sprites"].append({"id": new_id(), "name": name, "width": w, "height": h, "originX": 0, "originY": 0,
                                  "frames": [self.asset(webp(f), "webp") for f in frames]})

    def font(self, name, path):
        self.p["fonts"].append({"id": new_id(), "name": name, "asset": self.asset(path.read_bytes(), "ttf")})

    def write(self, path):
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n"
                       "Pictures made with Google Gemini. Type: IM Fell by Igino Marini (SIL Open Font License).\n")


def portrait(im, half):
    """One of the two portraits side by side in Gemini's picture, softly faded at the edges."""
    w, h = im.size
    part = im.crop((half * w // 2, 0, (half + 1) * w // 2, h)).convert("RGB")
    face = ImageOps.fit(part, FACE, Image.LANCZOS, centering=(0.5, 0.42))
    mask = Image.new("L", FACE, 0)
    ImageDraw.Draw(mask).ellipse((10, 8, FACE[0] - 10, FACE[1] - 8), fill=255)
    face.putalpha(mask.filter(ImageFilter.GaussianBlur(9)))
    return face


# ---------------------------------------------------------------- sounds

def env(n, attack=0.01, decay=3.0):
    return [min(1, i / (attack * RATE + 1)) * math.exp(-decay * i / RATE) for i in range(n)]


def partials(seconds, parts, vol):
    """Sines at (frequency, loudness, how fast it dies), summed: bells and metal."""
    n = int(seconds * RATE)
    out = [0.0] * n
    for f, a, d in parts:
        w = 2 * math.pi * f / RATE
        for i in range(n):
            out[i] += vol * a * math.sin(w * i) * math.exp(-d * i / RATE) * min(1, i / 60)
    return out


def marsh(seconds=16, seed=11):
    """The marsh at night, as a loop: wind in the reeds rising and falling, and now and then a frog."""
    r = random.Random(seed)
    n = int(seconds * RATE)
    y1 = y2 = 0.0
    out = []
    for i in range(n):
        y1 += 0.02 * (r.random() * 2 - 1 - y1)
        y2 += 0.08 * (y1 - y2)
        swell = 0.55 + 0.45 * math.sin(2 * math.pi * i / n * 2) * math.sin(2 * math.pi * i / n * 3 + 1)
        out.append(y2 * 2.4 * swell)
    for _ in range(9):     # frogs: a low, short, wobbling croak
        at = r.randrange(0, n - RATE)
        f = r.uniform(70, 110)
        for k in range(int(0.22 * RATE)):
            t = k / RATE
            v = (1 if math.sin(2 * math.pi * f * t) > 0 else -1) * (0.5 + 0.5 * math.sin(2 * math.pi * 28 * t))
            out[at + k] += 0.05 * v * math.sin(math.pi * k / (0.22 * RATE))
    fade = int(0.5 * RATE)  # the loop's ends meet without a click
    for k in range(fade):
        a = k / fade
        out[k] = out[k] * a + out[n - fade + k] * (1 - a)
    return lowpass(out[: n - fade], 0.5, 0.5)


# ---------------------------------------------------------------- the story check
#
# Like Thornwood's route checker: the book is read before it's built, and a
# book that can't be finished, or a page that runs off the bottom of the
# sheet, is refused. Nothing in the game would say so: a choice leading to a
# page that isn't there stops the game, and words past the sheet's edge are
# simply never seen.

def load_story():
    ns = {"clamp": lambda v, lo, hi: max(lo, min(hi, v))}
    for f in sorted((HERE / "game").glob("_*.py")):
        exec(f.read_text(), ns)
    return ns


def wrap(text, font, width):
    """string_wrap, in Pillow: the same greedy breaking between words."""
    lines = []
    for para in text.split("\n"):
        line = ""
        for word in para.split(" "):
            longer = f"{line} {word}" if line else word
            if line and font.getlength(longer) > width:
                lines.append(line)
                line = word
            else:
                line = longer
        lines.append(line)
    return lines


def check_story():
    from PIL import ImageFont
    ns = load_story()
    pages, endings, places, foes = ns["PAGES"], ns["ENDINGS"], ns["PLACES"], ns["FOES"]
    problems = []

    def targets(to):
        if to == "map":
            return []
        if to.startswith("end:"):
            if to[4:] not in endings:
                problems.append(f"no ending called {to[4:]!r}")
            return []
        if to.startswith("duel:"):
            f = foes.get(to[5:])
            if not f:
                problems.append(f"no foe called {to[5:]!r}")
                return []
            return [t for t in (f["win"], f["lose"]) if not t.startswith("end:")]
        return [to]

    links = {}
    for key, pg in pages.items():
        links[key] = []
        for c in pg["choices"]:
            for t in targets(c["to"]):
                if t not in pages:
                    problems.append(f"{key}: a choice leads to {t!r}, which isn't a page")
                else:
                    links[key].append(t)
    starts = ["intro"] + [p[k] for p in places.values() for k in ("first", "again")]
    seen, todo = set(), list(starts)
    while todo:
        k = todo.pop()
        if k in seen or k not in pages:
            continue
        seen.add(k)
        todo += links[k]
    problems += [f"{k}: no way to reach this page" for k in pages if k not in seen]

    size, lh = ns["TEXT_SIZE"], ns["TEXT_SIZE"] * 1.25      # string_height: 1.25 em a line
    roman = ImageFont.truetype(str(HERE / "fonts" / FONTS["fell"]), size)
    italic = ImageFont.truetype(str(HERE / "fonts" / FONTS["fell_italic"]), size)
    bottom = ns["PANEL_Y"] + ns["PANEL_H"] - 12
    for key, pg in pages.items():
        y = ns["PANEL_Y"] + 34 + (ns["FACE_H"] + 36 if pg["who"] else 0)
        y += len(wrap(ns["curly"](pg["text"]), roman, ns["TEXT_W"])) * lh + 22
        for c in pg["choices"]:      # every choice, as if all of them were shown at once
            y += len(wrap(c["text"], italic, ns["TEXT_W"] - 30)) * lh + 14
        if y - 8 > bottom:
            problems.append(f"{key}: runs {y - 8 - bottom:.0f} px off the bottom of the sheet")
    return problems, len(pages)


def build(assets_dir, out):
    A = Path(assets_dir).expanduser()
    missing = [n for n in list(SCENES.values()) + [f"p-{f}" for f in FACES] + ["paper"] if not (A / f"{n}.jpeg").is_file()]
    if missing:
        raise SystemExit(f"Missing from {A}: {', '.join(missing)} (.jpeg). Make them from PROMPTS.md.")
    problems, pages = check_story()
    for p in problems:
        print("  " + p)
    if problems:
        raise SystemExit("The story has problems (above); nothing was built.")
    P = Book("The Lantern of Greymire")
    # Painted pictures are scaled smoothly, not in whole steps.
    P.p["settings"]["pixelScaling"] = False

    for key, file in SCENES.items():
        im = ImageOps.fit(Image.open(A / f"{file}.jpeg").convert("RGB"), (W, H), Image.LANCZOS)
        P.picture(f"pic_{key}", [im])
    P.picture("paper", [Image.open(A / "paper.jpeg").convert("RGB").resize(PANEL, Image.LANCZOS)])
    for who in FACES:
        im = Image.open(A / f"p-{who}.jpeg")
        P.picture(f"face_{who}", [portrait(im, 0), portrait(im, 1)])
    for name, file in FONTS.items():
        P.font(name, HERE / "fonts" / file)

    P.sound("marsh", marsh(), volume=0.7)
    P.sound("page", lowpass(tone(0.3, 0, 0, "noise", 0.35, seed=21), 0.35, 0.03))
    P.sound("pick", tone(0.06, 880, 620, "sine", 0.22))
    P.sound("bell", partials(5.0, [(55, 0.5, 0.6), (110, 1.0, 0.8), (132, 0.5, 1.1), (165, 0.4, 1.4),
                                   (220, 0.35, 1.8), (277, 0.2, 2.4), (330, 0.15, 3.0)], 0.22))
    P.sound("hit", mix(lowpass(tone(0.2, 0, 0, "noise", 0.6, seed=22), 0.3, 0.05), tone(0.22, 160, 60, "sine", 0.5)))
    P.sound("hurt", mix(tone(0.3, 220, 100, "sine", 0.45), lowpass(tone(0.2, 0, 0, "noise", 0.3, seed=23), 0.2, 0.05)))
    P.sound("clash", mix(partials(0.6, [(1210, 1.0, 9), (1735, 0.7, 11), (2410, 0.5, 14)], 0.16),
                         tone(0.05, 0, 0, "noise", 0.4, seed=24)))
    P.sound("whistle", join(tone(0.45, 1500, 1650, "sine", 0.25), tone(0.6, 1650, 1580, "sine", 0.2)))
    P.sound("stone", lowpass(tone(0.8, 0, 0, "noise", 0.8, seed=25), 0.08, 0.02))
    P.sound("splash", lowpass(tone(0.45, 0, 0, "noise", 0.55, seed=26), 0.6, 0.05))

    for f in sorted((HERE / "game").glob("_*.py")):
        head, _ = read_code(f)
        P.script(head.get("script", f.stem.strip("_")), f.read_text())
    for f in sorted(f for f in (HERE / "game").glob("*.py") if not f.name.startswith("_")):
        head, events = read_code(f)
        o = P.obj(f.stem)
        for ev, code in events:
            o["events"].append({"id": new_id(), "key": event_key(ev, P), "mode": "python", "code": code})

    lid = new_id()
    P.p["rooms"].append({
        "id": new_id(), "name": "Greymire", "width": W, "height": H, "background": "#0d1214",
        "gridWidth": 16, "gridHeight": 16, "snap": True,
        "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
        "camera": {"enabled": False, "width": W, "height": H, "follow": None, "smoothing": 1},
        "instances": [{"id": new_id(), "object": P.obj_id("Book"), "layer": lid, "x": 0, "y": 0,
                       "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""}],
    })

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(P.p['sprites'])} sprites, {pages} pages")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--assets", default="~/Downloads/greymire")
    ap.add_argument("--out", default=str(HERE / "out" / "Greymire.zip"))
    a = ap.parse_args()
    build(a.assets, Path(a.out))
