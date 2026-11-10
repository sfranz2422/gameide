#!/usr/bin/env python3
"""
Builds the showcase game "Pour Decisions" as a GameIDE project zip: a sorting
puzzle where you pour sand from tube to tube until every tube is one colour.

    python3 showcase/sand/build.py      # → showcase/sand/out/Sand.zip (and project.json)

Every picture is drawn here (glass, sand, the desert), so the repo is all it needs.
The build refuses a level that can't be finished, or whose par isn't the fewest
pours (solve.py), and refuses if the game's own pouring rule (game/_2sand.py)
and the checker's ever disagree.

THE GAME IS OBJECTS: each tube is a Tube, each pour a Pour, the Director runs a
level, and the buttons are children of Button.
"""
import importlib.util
import json
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import solve  # noqa: E402


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_tw = _load("thornwood_build", HERE.parent / "build.py")
GAME = {}
exec((HERE / "game" / "_1levels.py").read_text(), GAME)
exec((HERE / "game" / "_2sand.py").read_text(), GAME)
LEVELS, CAP, VIEW_W, VIEW_H = GAME["LEVELS"], GAME["CAP"], GAME["VIEW_W"], GAME["VIEW_H"]
S = 4   # pictures are drawn 4 times bigger and shrunk, for smooth edges


class Sand(_tw.Project):
    def write(self, path):
        import zipfile
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n"
                       "Every picture and sound was made for it by its build.\n")


# ---------------------------------------------------------------- checks

def level_problems():
    out = []
    for n, level in enumerate(LEVELS):
        tubes = [list(t) for t in level["tubes"]]
        name = f"{n + 1}. {level['name']}"
        counts = {}
        for t in tubes:
            if len(t) > CAP:
                out.append(f"{name}: a tube holds {len(t)}, more than {CAP}")
            for c in t:
                counts[c] = counts.get(c, 0) + 1
        for c, k in counts.items():
            if c not in GAME["COLOURS"]:
                out.append(f"{name}: no colour called {c}")
            if k != CAP:
                out.append(f"{name}: {k} layers of {c}, not {CAP}")
        r = solve.solve(tubes, CAP)
        if r is None:
            out.append(f"{name}: can't be finished")
        elif r[0] != level["par"]:
            out.append(f"{name}: par says {level['par']}, but the fewest pours is {r[0]}")
    return out


def rule_problems():
    """The game's pour and the checker's, tried side by side on random tubes."""
    rng = random.Random(7)
    g = dict(GAME)
    for _ in range(4000):
        state = [[rng.choice("RGB") for _ in range(rng.randint(0, CAP))] for _ in range(4)]
        theirs = {(i, j): k for i, j, k in solve.pours(tuple(tuple(t) for t in state), CAP)}
        for i in range(4):
            for j in range(4):
                if i == j:
                    continue
                a, b = list(state[i]), list(state[j])
                ok = g["can_pour"](a, b)
                pointless = not b and a and g["top_run"](a)[1] == len(a)
                if ok and not pointless:
                    k = g["pour"](a, b)
                    if theirs.get((i, j)) != k:
                        return [f"pouring {state[i]} into {state[j]}: the game moves {k}, the checker {theirs.get((i, j))}"]
                elif (i, j) in theirs:
                    return [f"pouring {state[i]} into {state[j]}: the checker can, the game can't"]
    return []


# ---------------------------------------------------------------- pictures

def shrink(im, w, h):
    return im.resize((w, h), Image.LANCZOS)


def tube_picture():
    """Glass: a lip at the mouth, a round bottom, a shine down one side. See-through, so the sand shows."""
    w, h = 64, 150
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    body = (8 * S, 6 * S, 56 * S, 148 * S)
    d.rounded_rectangle(body, radius=22 * S, fill=(220, 240, 255, 34), outline=(235, 248, 255, 225), width=3 * S)
    d.rectangle((10 * S, 6 * S, 54 * S, 20 * S), fill=(0, 0, 0, 0))   # an open top
    d.line([(9 * S, 8 * S), (9 * S, 40 * S)], fill=(235, 248, 255, 225), width=3 * S)
    d.line([(55 * S, 8 * S), (55 * S, 40 * S)], fill=(235, 248, 255, 225), width=3 * S)
    d.rounded_rectangle((3 * S, 0, 61 * S, 9 * S), radius=4 * S, fill=(240, 250, 255, 235), outline=(170, 200, 220, 255), width=S)
    shine = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(shine).rounded_rectangle((15 * S, 16 * S, 21 * S, 128 * S), radius=3 * S, fill=(255, 255, 255, 120))
    im = Image.alpha_composite(im, shine.filter(ImageFilter.GaussianBlur(S)))
    return shrink(im, w, h)


def sand_picture(seed, bottom):
    """One layer, nearly white so the game tints it any colour: grains, light and dark."""
    w, h = 44, 30
    rng = random.Random(seed)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for y in range(h):
        for x in range(w):
            v = rng.randint(205, 245)
            if rng.random() < 0.08:
                v = rng.randint(160, 190)
            elif rng.random() < 0.05:
                v = 255
            px[x, y] = (v, v, v, 255)
    if bottom:
        cut = Image.new("L", (w * S, h * S), 0)
        ImageDraw.Draw(cut).rounded_rectangle((0, -30 * S, w * S - 1, h * S - 1), radius=20 * S, fill=255)
        im.putalpha(shrink(cut.convert("RGBA"), w, h).split()[0])
    return im


def mark_pictures():
    """A shape for each colour (for telling colours apart without colour), and a ? for covered sand."""
    out = []
    for k in range(11):
        im = Image.new("RGBA", (20 * S, 20 * S), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        c, ink, line = 10 * S, (255, 255, 255, 255), (60, 40, 60, 200)
        r = 6 * S
        if k == 0:
            d.ellipse((c - r, c - r, c + r, c + r), fill=ink, outline=line, width=S)
        elif k == 1:
            d.rectangle((c - r, c - r, c + r, c + r), fill=ink, outline=line, width=S)
        elif k == 2:
            d.polygon([(c, c - r - S), (c + r + S, c + r), (c - r - S, c + r)], fill=ink, outline=line)
        elif k == 3:
            d.polygon([(c, c - r - 2 * S), (c + r + S, c), (c, c + r + 2 * S), (c - r - S, c)], fill=ink, outline=line)
        elif k == 4:
            import math
            pts = [(c + (r + 2 * S if i % 2 == 0 else r / 2.2) * math.sin(i * math.pi / 5), c - (r + 2 * S if i % 2 == 0 else r / 2.2) * math.cos(i * math.pi / 5)) for i in range(10)]
            d.polygon(pts, fill=ink, outline=line)
        elif k == 5:
            d.rectangle((c - 2 * S, c - r - S, c + 2 * S, c + r + S), fill=ink)
            d.rectangle((c - r - S, c - 2 * S, c + r + S, c + 2 * S), fill=ink)
        elif k == 6:
            d.line([(c - r, c - r), (c + r, c + r)], fill=ink, width=4 * S)
            d.line([(c - r, c + r), (c + r, c - r)], fill=ink, width=4 * S)
        elif k == 7:
            d.ellipse((c - r - S, c - r, c, c + S), fill=ink)
            d.ellipse((c, c - r, c + r + S, c + S), fill=ink)
            d.polygon([(c - r - S, c - 2 * S), (c + r + S, c - 2 * S), (c, c + r + 2 * S)], fill=ink)
        elif k == 8:
            d.ellipse((c - r - S, c - r - S, c + r + S, c + r + S), outline=ink, width=3 * S)
        elif k == 9:
            for dy in (-4, 0, 4):
                d.rectangle((c - r - S, c + dy * S - S, c + r + S, c + dy * S + S), fill=ink)
        else:
            d.text((c - 3 * S, c - 6 * S), "?", fill=(230, 220, 240, 255), font_size=14 * S) if hasattr(d, "text") else None
        out.append(shrink(im, 20, 20))
    return out


def cork_picture():
    im = Image.new("RGBA", (44 * S, 20 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((6 * S, 0, 38 * S, 19 * S), radius=4 * S, fill=(176, 122, 70, 255), outline=(110, 70, 38, 255), width=S)
    for x, y in ((12, 5), (22, 11), (30, 6), (16, 14)):
        d.ellipse(((x - 1) * S, (y - 1) * S, (x + 1) * S, (y + 1) * S), fill=(130, 86, 48, 255))
    return shrink(im, 44, 20)


def panel(w, h):
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w * S - 1, h * S - 1), radius=10 * S, fill=(150, 84, 60, 255), outline=(70, 34, 30, 255), width=2 * S)
    d.rounded_rectangle((3 * S, 3 * S, (w - 3) * S, (h - 3) * S), radius=8 * S, outline=(240, 180, 120, 255), width=S)
    return shrink(im, w, h)


def star_picture():
    import math
    im = Image.new("RGBA", (56 * S, 56 * S), (0, 0, 0, 0))
    c, R, r = 28 * S, 26 * S, 11 * S
    pts = [(c + (R if i % 2 == 0 else r) * math.sin(i * math.pi / 5), c - (R if i % 2 == 0 else r) * math.cos(i * math.pi / 5)) for i in range(10)]
    ImageDraw.Draw(im).polygon(pts, fill=(255, 210, 63, 255), outline=(150, 90, 20, 255))
    return shrink(im, 56, 56)


def desert_picture():
    """Dusk over the dunes: a sky going from violet to orange, three rows of dunes, a few stars."""
    w, h = VIEW_W, VIEW_H
    im = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(im)
    top, bottom = (54, 34, 88), (240, 140, 90)
    for y in range(h):
        f = min(1, y / (h * 0.75))
        d.line([(0, y), (w, y)], fill=tuple(int(a + (b - a) * f) for a, b in zip(top, bottom)) + (255,))
    rng = random.Random(3)
    for _ in range(60):
        x, y = rng.randrange(w), rng.randrange(int(h * 0.4))
        d.point((x, y), fill=(255, 240, 220, rng.randint(120, 255)))
    d.ellipse((760, 330, 880, 450), fill=(255, 200, 120, 255))
    import math
    for k, (base, colour, amp, freq, phase) in enumerate(((410, (196, 110, 86), 30, 0.006, 0.5), (460, (170, 86, 72), 26, 0.009, 2.1), (520, (128, 62, 62), 20, 0.012, 4.0))):
        pts = [(x, base + amp * math.sin(x * freq + phase) + amp * 0.5 * math.sin(x * freq * 2.3 + phase * 3)) for x in range(0, w + 8, 8)]
        d.polygon(pts + [(w, h), (0, h)], fill=colour + (255,))
    return im


def icon_picture():
    im = Image.new("RGBA", (64, 64), (54, 34, 88, 255))
    d = ImageDraw.Draw(im)
    for k, colours in enumerate((("#e5473b", "#3a6fd8", "#e5473b"), ("#3a6fd8", "#f4d23c", "#f4d23c"))):
        x = 12 + k * 24
        for i, c in enumerate(colours):
            d.rectangle((x, 52 - (i + 1) * 12, x + 16, 52 - i * 12), fill=c)
        d.rounded_rectangle((x - 2, 10, x + 18, 54), radius=6, outline=(235, 248, 255), width=2)
    return im


def make_sounds(P):
    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    P.sound("pick", tone(0.07, 520, 780, "tri", 0.35))
    P.sound("pour", mix(lowpass(tone(0.6, 0, 0, "noise", 0.35, seed=5), 0.35, 0.15), lowpass(tone(0.6, 0, 0, "noise", 0.15, seed=9), 0.8, 0.5)))
    P.sound("cork", join(tone(0.04, 300, 900, "sine", 0.6), tone(0.12, 1200, 1500, "tri", 0.25)))
    P.sound("nope", tone(0.16, 160, 120, "square", 0.18))
    P.sound("click", tone(0.03, 900, 700, "square", 0.12))
    P.sound("win", join(*[tone(0.11, f, f, "tri", 0.35) for f in (523, 659, 784, 1047)], tone(0.45, 1319, 1319, "tri", 0.3)))


def event_key(name, P):
    parts = name.split()
    if parts[0] == "mouse":
        return {"type": "mouse", "button": parts[-1], "edge": parts[-2], "global": parts[1] == "global"}
    return _tw.event_key(name, P)


def build(out):
    problems = level_problems() + rule_problems()
    if problems:
        raise SystemExit("The levels:\n  " + "\n  ".join(problems))
    P = Sand("Pour Decisions")
    P.p["settings"]["scoreboard"] = {"unit": "points"}
    P.p["settings"]["pixelScaling"] = False

    P.sprite("tube", [tube_picture()], (32, 0), mask=(0, 0, 64, 150))
    P.sprite("sand", [sand_picture(k, False) for k in range(3)], (22, 15))
    P.sprite("sand_bottom", [sand_picture(10 + k, True) for k in range(3)], (22, 15))
    P.sprite("mark", mark_pictures(), (10, 10))
    P.sprite("cork", [cork_picture()], (22, 8))
    P.sprite("button", [panel(150, 44)], (0, 0), mask=(0, 0, 150, 44))
    P.sprite("card", [panel(156, 58)], (0, 0), mask=(0, 0, 156, 58))
    P.sprite("star", [star_picture()], (28, 28))
    P.sprite("back", [desert_picture()], (0, 0))
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

    def room(name, placed):
        lid, bid = _tw.new_id(), _tw.new_id()
        P.p["rooms"].append({
            "id": _tw.new_id(), "name": name, "width": VIEW_W, "height": VIEW_H, "background": "#36225a",
            "gridWidth": 16, "gridHeight": 16, "snap": False,
            "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False},
                       {"id": bid, "name": "Desert", "kind": "background", "depth": 1000, "visible": True, "locked": False, "color": None,
                        "sprite": P.sprite_id("back"), "mode": "once", "hspeed": 0, "vspeed": 0, "parallax": 0}],
            "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 0},
            "instances": [{"id": _tw.new_id(), "object": P.obj_id(o), "layer": lid, "x": x, "y": y,
                           "scaleX": 1, "scaleY": 1, "angle": 0, "code": code} for o, x, y, code in placed],
        })

    # The title first: the game starts in the first room.
    cards = [("LevelCard", VIEW_W / 2 - 3 * 168 + 6 + (i % 6) * 168, 156 + (i // 6) * 72, f"self.i = {i}\n") for i in range(len(LEVELS))]
    room("Title", [("Title", 0, 0, ""), ("ShapesButton", VIEW_W / 2 - 75, 470, "")] + cards)
    buttons = ["LevelsButton", "UndoButton", "RestartButton", "TubeButton"]
    room("Play", [("Director", 0, 0, "")] + [(b, VIEW_W / 2 - 2 * 170 + 10 + k * 170, 520, "") for k, b in enumerate(buttons)])

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(LEVELS)} levels, {len(P.p['objects'])} objects")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Sand.zip")
