#!/usr/bin/env python3
"""
Builds the fifth showcase game, "Greenside", as a GameIDE project zip:
nine holes of golf seen from above, for one to four players.

    python3 showcase/golf/build.py         # → showcase/golf/out/Golf.zip

All its art is in this repository: the golfers, their arms, the ball and
the club are Kenney's Sports Pack (CC0), as the editor's art library has
it (frontend/public/library/kenney/sports/), and every hole is painted here
from game/_1course.py, the same data the game plays on. So changing a hole
there changes it in both, and the checks below run on it before anything
is built: a cup off its green, a tee in the water, or a par the hole's
length doesn't fit, and the build refuses.

The game is game/*.py: _1course.py (the holes and clubs), _2ball.py (the
ground, a ball's flight and roll), _3play.py (turns and scores),
_4screen.py (drawing), and the objects Game and Ball.
"""
import importlib.util
import json
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


HERE = Path(__file__).resolve().parent
_tw = _load("thornwood_build", HERE.parent / "build.py")
SPORTS = HERE.parent.parent / "frontend" / "public" / "library" / "kenney" / "sports"

COURSE = {}
exec((HERE / "game" / "_1course.py").read_text(), COURSE)
HOLES, W, H = COURSE["HOLES"], COURSE["COURSE_W"], COURSE["COURSE_H"]

# Where things are on the library's sheets (scripts/make_sports_library.py).
PLAYER_ROWS = {"Blue": 0, "Green": 1, "Red": 2, "White": 3}   # rows of players.png, 24 x 32, an arm in column 10
LOOKS = [0, 3, 5, 7]                                            # a different face for each player
EQUIP = {"ball": 10, "club": 31}                                # cells of equipment.png, 32 x 32, 8 across

GREENS = {"rough": (74, 140, 62), "rough_dot": (66, 128, 56), "fairway": (100, 182, 80), "fairway_2": (110, 194, 88),
          "fringe": (112, 190, 86), "green": (132, 210, 102), "green_2": (140, 218, 110)}
SAND, SAND_EDGE = (236, 216, 160), (210, 186, 128)
WATER, WATER_EDGE, RIPPLE = (58, 142, 204), (40, 112, 172), (140, 200, 240)
LEAVES, LEAVES_LIT, SHADOW = (34, 100, 52), (56, 134, 66), (0, 0, 0, 70)


class Golf(_tw.Project):
    def write(self, path):
        import zipfile
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n"
                       "Golfers, ball and club: Kenney's Sports Pack (kenney.nl), CC0.\n")


# ---------------------------------------------------------------- the course checked

def check_course():
    """Every hole must be playable as drawn, before anything is built."""
    ball = {}
    src = (HERE / "game" / "_2ball.py").read_text()
    ball["point_distance"] = lambda x1, y1, x2, y2: math.hypot(x2 - x1, y2 - y1)
    ball.update(COURSE)
    exec(src, ball)
    problems = []
    for n, h in enumerate(HOLES, 1):
        where = f"hole {n} ({h['name']})"
        for name, (x, y) in (("tee", h["tee"]), ("cup", h["cup"])):
            if not (0 < x < W and 0 < y < H):
                problems.append(f"{where}: the {name} is off the course")
        if ball["ground"](h, *h["cup"]) != "green":
            problems.append(f"{where}: the cup isn't on the green")
        if ball["ground"](h, *h["tee"]) not in ("fairway", "rough"):
            problems.append(f"{where}: the tee is in the {ball['ground'](h, *h['tee'])}")
        for tx, ty, r in h["trees"]:
            if math.hypot(tx - h["cup"][0], ty - h["cup"][1]) < h["green"][2] + r * 0.8:
                problems.append(f"{where}: a tree at {tx},{ty} overhangs the green")
        d = math.hypot(h["cup"][0] - h["tee"][0], h["cup"][1] - h["tee"][1])
        fits = {3: (250, 470), 4: (600, 960), 5: (950, 1300)}[h["par"]]
        if not fits[0] <= d <= fits[1]:
            problems.append(f"{where}: {d:.0f} pixels long, but par {h['par']} wants {fits[0]} to {fits[1]}")
    if problems:
        raise SystemExit("The course:\n  " + "\n  ".join(problems))


# ---------------------------------------------------------------- a hole painted

def path_mask(size, paths, grow=0):
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    for points, width in paths:
        r = width / 2 + grow
        for (ax, ay), (bx, by) in zip(points, points[1:]):
            d.line((ax, ay, bx, by), fill=255, width=int(r * 2))
        for x, y in points:
            d.ellipse((x - r, y - r, x + r, y + r), fill=255)
    return m


def oval_mask(size, ovals, grow=0):
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    for x, y, rx, ry in ovals:
        d.ellipse((x - rx - grow, y - ry - grow, x + rx + grow, y + ry + grow), fill=255)
    return m


def stripes(size, a, b, width=26, slant=0.6):
    """Mown grass: bands of two greens, at a slant."""
    im = Image.new("RGB", size, a)
    d = ImageDraw.Draw(im)
    w, h = size
    for k in range(-h, w + h, width * 2):
        d.polygon([(k, 0), (k + width, 0), (k + width - h * slant, h), (k - h * slant, h)], fill=b)
    return im


def paint(h, seed):
    rnd = random.Random(seed)
    size = (W, H)
    im = Image.new("RGB", size, GREENS["rough"])
    d = ImageDraw.Draw(im)
    for _ in range(2600):                                   # tufts in the rough
        x, y = rnd.randrange(W), rnd.randrange(H)
        d.ellipse((x, y, x + 3, y + 2), fill=GREENS["rough_dot"])
    tee_path = [([h["tee"], (h["tee"][0] + 1, h["tee"][1])], 56)]
    edge = path_mask(size, h["fairway"] + tee_path, grow=4)
    im.paste(GREENS["fringe"], (0, 0), edge)
    im.paste(stripes(size, GREENS["fairway"], GREENS["fairway_2"]), (0, 0), path_mask(size, h["fairway"] + tee_path))
    # Water, then sand over it, then the green over everything: the order ground() reads them in.
    if h["water"]:
        im.paste(WATER_EDGE, (0, 0), oval_mask(size, h["water"], grow=4))
        im.paste(WATER, (0, 0), oval_mask(size, h["water"]))
        for x, y, rx, ry in h["water"]:
            for _ in range(int(rx * ry / 900)):
                px, py = x + rnd.uniform(-0.7, 0.7) * rx, y + rnd.uniform(-0.7, 0.7) * ry
                if ((px - x) / rx) ** 2 + ((py - y) / ry) ** 2 < 0.7:
                    d.line((px - 6, py, px + 6, py), fill=RIPPLE, width=2)
    if h["sand"]:
        im.paste(SAND_EDGE, (0, 0), oval_mask(size, h["sand"], grow=3))
        im.paste(SAND, (0, 0), oval_mask(size, h["sand"]))
        for x, y, rx, ry in h["sand"]:
            for _ in range(int(rx * ry / 40)):
                px, py = x + rnd.uniform(-0.85, 0.85) * rx, y + rnd.uniform(-0.85, 0.85) * ry
                if ((px - x) / rx) ** 2 + ((py - y) / ry) ** 2 < 0.8:
                    d.point((px, py), fill=SAND_EDGE)
    gx, gy, gr = h["green"]
    d.ellipse((gx - gr - 7, gy - gr - 7, gx + gr + 7, gy + gr + 7), fill=GREENS["fringe"])
    green = Image.new("L", size, 0)
    ImageDraw.Draw(green).ellipse((gx - gr, gy - gr, gx + gr, gy + gr), fill=255)
    im.paste(stripes(size, GREENS["green"], GREENS["green_2"], width=12, slant=-0.4), (0, 0), green)
    cx, cy = h["cup"]
    d.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=(236, 240, 236))
    d.ellipse((cx - 4.5, cy - 4.5, cx + 4.5, cy + 4.5), fill=(24, 30, 24))
    tx, ty = h["tee"]
    for dx in (-22, 22):                                    # the tee markers
        d.ellipse((tx + dx - 4, ty - 14, tx + dx + 4, ty - 6), fill=(250, 250, 250), outline=(60, 60, 60))
    # Trees: a soft shadow, then the leaves, lit from the top left.
    shade = Image.new("RGBA", size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for x, y, r in h["trees"]:
        sd.ellipse((x - r + 8, y - r * 0.8 + 10, x + r + 8, y + r * 0.8 + 10), fill=SHADOW)
    im = Image.alpha_composite(im.convert("RGBA"), shade.filter(ImageFilter.GaussianBlur(4)))
    d = ImageDraw.Draw(im)
    for x, y, r in h["trees"]:
        d.ellipse((x - r, y - r, x + r, y + r), fill=LEAVES)
        for _ in range(7):
            a, k = rnd.uniform(0, 6.283), rnd.uniform(0.2, 0.6)
            px, py, pr = x + math.cos(a) * r * k, y + math.sin(a) * r * k, r * rnd.uniform(0.35, 0.5)
            d.ellipse((px - pr, py - pr, px + pr, py + pr), fill=LEAVES)
        d.ellipse((x - r * 0.75, y - r * 0.8, x + r * 0.15, y + r * 0.1), fill=LEAVES_LIT)
    return im


# ---------------------------------------------------------------- Kenney's pictures, from the library's sheets

def cell(sheet, col, row, cw, ch):
    im = sheet.crop((col * cw, row * ch, col * cw + cw, row * ch + ch))
    return im.crop(im.getbbox())


def build(out):
    check_course()
    P = Golf("Greenside")
    P.p["settings"]["pixelScaling"] = False

    for n, h in enumerate(HOLES):
        P.sprite(f"hole_{n}", [paint(h, n + 1)], (0, 0))
    players = Image.open(SPORTS / "players.png").convert("RGBA")
    names = COURSE["PLAYER_NAMES"]
    for i, name in enumerate(names):
        body = cell(players, LOOKS[i], PLAYER_ROWS[name], 24, 32)
        P.sprite(f"golfer_{i}", [body], (body.width // 2, body.height // 2))
        arm = cell(players, 10, PLAYER_ROWS[name], 24, 32)
        P.sprite(f"arm_{i}", [arm], (0, arm.height // 2))        # from the shoulder: it turns about there
    gear = Image.open(SPORTS / "equipment.png").convert("RGBA")
    for name, k in EQUIP.items():
        im = cell(gear, k % 8, k // 8, 32, 32)
        P.sprite(name, [im], (im.width // 2, im.height // 2))

    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    P.sound("swing", mix(lowpass(tone(0.25, 0, 0, "noise", 0.5, seed=51), 0.05, 0.6), tone(0.05, 900, 600, "square", 0.1)))
    P.sound("putt", tone(0.06, 1400, 1100, "tri", 0.35))
    P.sound("cup", join(tone(0.05, 700, 650, "tri", 0.3), tone(0.05, 900, 850, "tri", 0.25), tone(0.12, 300, 120, "sine", 0.5)))
    P.sound("splash", lowpass(tone(0.6, 0, 0, "noise", 0.7, seed=52), 0.5, 0.05))

    for f in sorted((HERE / "game").glob("_*.py")):
        head, _ = _tw.read_code(f)
        P.script(head.get("script", f.stem.strip("_")), f.read_text())
    files = sorted(f for f in (HERE / "game").glob("*.py") if not f.name.startswith("_"))
    parsed = {f.stem: _tw.read_code(f) for f in files}
    for name, (head, _) in parsed.items():
        P.obj(name, depth=int(head.get("depth", 0)))
    for name, (head, events) in parsed.items():
        o = next(x for x in P.p["objects"] if x["name"] == name)
        for ev, code in events:
            o["events"].append({"id": _tw.new_id(), "key": _tw.event_key(ev, P), "mode": "python", "code": code})

    lid = _tw.new_id()
    P.p["rooms"].append({
        "id": _tw.new_id(), "name": "Course", "width": W, "height": H, "background": "#4a8c3e",
        "gridWidth": 32, "gridHeight": 32, "snap": True,
        "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
        # The camera follows whoever's ball it is: camera_follow, from the Game (aim_at_pin).
        "camera": {"enabled": True, "width": 640, "height": 360, "follow": None, "smoothing": 0.15},
        "instances": [{"id": _tw.new_id(), "object": P.obj_id("Game"), "layer": lid, "x": 0, "y": 0,
                       "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""}],
    })
    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(HOLES)} holes")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Golf.zip")
