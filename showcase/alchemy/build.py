#!/usr/bin/env python3
"""
Builds the showcase game "Mix Lab" as a GameIDE project zip: a combining game.
Start with Water, Fire, Earth and Air; drag one thing onto another and see what
they make, 144 things in all; what you make shows up living in a little world
along the top. Achievements, hints, and how you made each thing.

    python3 showcase/alchemy/build.py      # → showcase/alchemy/out/Alchemy.zip (and project.json)

The pictures are to be the teacher's Gemini art (PROMPTS.md), cut into art/ by
cut_sheets.py once they arrive. Any picture not in art/ is a stand-in drawn here,
so the game builds and plays with only this file and game/.

THE GAME IS OBJECTS: Title, Lab and Awards are the screens; World is the little
world; a Spot is a thing you tap or drag (in the collection, or on the bench).
Every thing and recipe is game/_1rules.py; every rule of mixing is game/_2mix.py.
"""
import importlib.util
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


HERE = Path(__file__).resolve().parent
_tw = _load("thornwood_build", HERE.parent / "build.py")
GAME = {}
exec((HERE / "game" / "_1rules.py").read_text(), GAME)
VIEW_W, VIEW_H = GAME["VIEW_W"], GAME["VIEW_H"]
THINGS, GROUPS, ICON = GAME["THINGS"], GAME["GROUPS"], GAME["ICON"]
ART = HERE / "art"
S = 4   # stand-ins are drawn 4 times bigger and shrunk, for smooth edges


class Alchemy(_tw.Project):
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
                       "Pictures made with Google Gemini (stand-ins drawn by its build). Type: Ubuntu (Ubuntu Font Licence).\n")


def have(name):
    return (ART / f"{name}.png").exists()


def fit_into(im, size):
    """A picture fitted inside `size` (its shape kept), in the middle of a clear box that size."""
    k = min(size[0] / im.width, size[1] / im.height)
    small = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(small, ((size[0] - small.width) // 2, (size[1] - small.height) // 2))
    return out


def picture(name, size, stand_in):
    if have(name):
        return fit_into(Image.open(ART / f"{name}.png").convert("RGBA"), size)
    return stand_in()


def canvas(size):
    return Image.new("RGBA", (size[0] * S, size[1] * S), (0, 0, 0, 0))


def done(im, size):
    return im.resize(size, Image.LANCZOS)


def B(*v):
    return tuple(x * S for x in v)


# ---------------------------------------------------------------- stand-ins

def stand_in_icon(key):
    """A rounded square in the thing's group colour with the start of its name on it."""
    name, group = THINGS[key]
    colour = next(c for g, _, c in GROUPS if g == group)
    rgb = tuple(int(colour[i:i + 2], 16) for i in (1, 3, 5))
    im = canvas((ICON, ICON))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle(B(4, 4, ICON - 4, ICON - 4), radius=14 * S, fill=rgb, outline=(40, 26, 58), width=3 * S)
    d.ellipse(B(12, 9, 30, 20), fill=tuple(min(255, v + 60) for v in rgb))
    font = ImageFont.load_default(size=22 * S)
    words = name if len(name) <= 4 else name[:3]
    w = d.textlength(words, font=font)
    d.text(((ICON * S - w) / 2, 19 * S), words, font=font, fill=(255, 255, 255))
    return done(im, (ICON, ICON))


def stand_in_bench():
    im = Image.new("RGBA", (VIEW_W, VIEW_H), (196, 142, 82, 255))
    d = ImageDraw.Draw(im)
    for y in range(0, VIEW_H, 48):
        d.rectangle((0, y, VIEW_W, y + 46), fill=(206 - (y // 48 % 2) * 14, 150 - (y // 48 % 2) * 10, 88))
        d.line((0, y + 47, VIEW_W, y + 47), fill=(140, 96, 52), width=2)
    return im


def icon_picture():
    im = Image.new("RGBA", (64, 64), (58, 42, 90, 255))
    d = ImageDraw.Draw(im)
    d.ellipse((10, 22, 38, 50), fill=(90, 170, 230))
    d.ellipse((26, 14, 54, 42), fill=(240, 120, 50))
    d.ellipse((24, 26, 40, 40), fill=(255, 220, 90))
    return im


# ---------------------------------------------------------------- sounds

def make_sounds(P):
    tone, join, lowpass = _tw.tone, _tw.join, _tw.lowpass
    P.sound("click", tone(0.03, 900, 700, "square", 0.12))
    P.sound("nope", join(tone(0.08, 260, 200, "square", 0.15), tone(0.12, 180, 140, "square", 0.15)))
    P.sound("whoosh", lowpass(tone(0.18, 0, 0, "noise", 0.3, seed=2), 0.05, 0.3))
    P.sound("pop", join(tone(0.04, 500, 900, "sine", 0.4), tone(0.06, 900, 1200, "sine", 0.3)))
    P.sound("new", join(*[tone(0.07, f, f, "tri", 0.3) for f in (523, 659, 784)], tone(0.3, 1047, 1047, "tri", 0.3)))
    P.sound("award", join(*[tone(0.09, f, f, "square", 0.14) for f in (784, 988, 1175, 1568)], tone(0.4, 1568, 1568, "square", 0.12)))
    P.sound("hint", join(tone(0.1, 1200, 1200, "sine", 0.3), tone(0.2, 1600, 1600, "sine", 0.25)))


# ---------------------------------------------------------------- the project

def event_key(name, P):
    return _tw.event_key(name, P)


def build(out):
    P = Alchemy("Mix Lab")
    # The board: how many things each player has found.
    P.p["settings"]["scoreboard"] = {"unit": "found"}
    P.p["settings"]["pixelScaling"] = False
    P.font("Ubuntu", HERE.parent / "undertow" / "fonts" / "ubuntu-latin-700-normal.woff2")

    for key in THINGS:
        P.sprite(f"icon_{key}", [picture(f"icon_{key}", (ICON, ICON), lambda key=key: stand_in_icon(key))], (ICON // 2, ICON // 2))
    P.sprite("bench", [picture("bench", (VIEW_W, VIEW_H), stand_in_bench)], (0, 0))
    P.sprite("icon", [icon_picture()], (0, 0))
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

    def room(name, placed, colour="#2a1a3a"):
        lid = _tw.new_id()
        P.p["rooms"].append({
            "id": _tw.new_id(), "name": name, "width": VIEW_W, "height": VIEW_H, "background": colour,
            "gridWidth": 16, "gridHeight": 16, "snap": False,
            "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
            "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 0},
            "instances": [{"id": _tw.new_id(), "object": P.obj_id(o), "layer": lid, "x": x, "y": y,
                           "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""} for o, x, y in placed],
        })

    # The title first: the game starts in the first room.
    room("Title", [("Title", 0, 0)])
    room("Lab", [("Lab", 0, 0), ("World", 0, 0)])
    room("Awards", [("Awards", 0, 0)])

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    pictures = sum(1 for _ in ART.glob("*.png")) if ART.exists() else 0
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(P.p['objects'])} objects, {pictures} of the teacher's pictures")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Alchemy.zip")
