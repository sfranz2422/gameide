#!/usr/bin/env python3
"""
Builds the tenth showcase game, "Jelly Jailbreak", as a GameIDE project zip: a
physics game where you fling things at wobbly towers to free jellies from jars.

    python3 showcase/smash/build.py      # → showcase/smash/out/Smash.zip

The pictures are Kenney's Physics Assets (CC0), in art/ with his licence, and each
level is built here from its numbers in game/_1levels.py: every block is an
instance placed as a student would place it in the room editor. A level that
couldn't stand up stops the build (level_problems).

THE GAME IS OBJECTS, three levels deep: Thing → Block → Wood → WoodLong. The shape
objects have no code at all, only a picture: physics makes the shape from it.
"""
import importlib.util
import json
import sys
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
GAME = {}
exec((HERE / "game" / "_1levels.py").read_text(), GAME)
LEVELS, VIEW_W, VIEW_H, GROUND_Y = GAME["LEVELS"], GAME["VIEW_W"], GAME["VIEW_H"], GAME["GROUND_Y"]

# Which of Kenney's pictures is which: whole, chipped, cracked.
PICTURES = {
    "Wood": {"Small": (10, 13, 45), "Wide": (11, 14, 46), "Long": (12, 15, 47), "Tall": (16, 21, 48), "Pillar": (19, 24, 51), "Big": (17, 22, 49), "Ball": (0, 6, 44)},
    "Glass": {"Small": (12, 15, 47), "Wide": (13, 16, 48), "Long": (14, 17, 49), "Tall": (18, 23, 50), "Pillar": (21, 26, 53), "Big": (19, 24, 51), "Ball": (2, 8, 46)},
    "Stone": {"Small": (11, 14, 46), "Wide": (12, 15, 47), "Long": (13, 16, 48), "Tall": (17, 22, 49), "Pillar": (20, 25, 52), "Big": (18, 23, 50), "Ball": (1, 7, 45)},
    "Metal": {"Small": (11, 14, 49), "Wide": (12, 15, 50), "Long": (13, 16, 51), "Tall": (17, 22, 52), "Pillar": (20, 25, 55), "Big": (18, 23, 53), "Ball": (1, 7, 45)},
}
JELLIES = ("Green", "Blue", "Pink", "Yellow", "Beige")
THEMES = {"grass": ("colored_grass", "grass"), "desert": ("colored_desert", "sand"), "shroom": ("colored_shroom", "dirt"), "snow": ("blue_grass", "snow"), "dusk": ("blue_desert", "sand")}


class Smash(_tw.Project):
    def write(self, path):
        import zipfile
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n"
                       "Pictures: Kenney's Physics Assets (kenney.nl), CC0.\n")


def pic(name, size=None):
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    return im.resize(size, Image.LANCZOS) if size else im


def element(material, n, size):
    return pic(f"element{material}{n:03d}", size)


def round_sprite(P, name, frames, r):
    w = frames[0].width
    s = P.sprite(name, frames, (w // 2, w // 2))
    s["mask"] = {"kind": "circle", "cx": w // 2, "cy": w // 2, "r": r}
    return s


def box_sprite(P, name, frames):
    w, h = frames[0].size
    return P.sprite(name, frames, (w // 2, h // 2), mask=(0, 0, w, h))


def panel(w, h):
    S = 4
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w * S - 1, h * S - 1), radius=9 * S, fill=(60, 96, 140, 255), outline=(30, 44, 70, 255), width=2 * S)
    d.rounded_rectangle((3 * S, 3 * S, (w - 3) * S, (h - 3) * S), radius=7 * S, outline=(120, 170, 215, 255), width=S)
    return im.resize((w, h), Image.LANCZOS)


def sling_picture():
    """Kenney's pack has no slingshot. A forked stick; the band is drawn by the game."""
    S = 4
    w, h = 44, 100
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    wood, dark = (150, 96, 52, 255), (92, 58, 34, 255)
    for colour, grow in ((dark, 2), (wood, 0)):
        k = (10 + grow * 2) * S
        d.line([(22 * S, 98 * S), (22 * S, 50 * S)], fill=colour, width=k)
        d.line([(22 * S, 54 * S), (6 * S, 12 * S)], fill=colour, width=k)
        d.line([(22 * S, 54 * S), (38 * S, 12 * S)], fill=colour, width=k)
    return im.resize((w, h), Image.LANCZOS)


def ground_picture(tile):
    """One long picture, not many tiles: planck snags a sliding block on every seam."""
    t = pic(tile, (76, 76))
    out = Image.new("RGBA", (1900, 76))
    for x in range(0, 1900, 76):
        out.paste(t, (x, 0))
    return out


def make_sounds(P):
    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    P.sound("twang", mix(tone(0.2, 170, 520, "tri", 0.5), tone(0.12, 900, 300, "square", 0.08)))
    P.sound("thud", mix(tone(0.12, 130, 50, "sine", 0.7), lowpass(tone(0.08, 0, 0, "noise", 0.4, seed=2), 0.3, 0.05)))
    P.sound("crack_wood", mix(lowpass(tone(0.14, 0, 0, "noise", 0.6, seed=4), 0.6, 0.1), tone(0.08, 260, 120, "square", 0.2)))
    P.sound("crack_glass", mix(tone(0.25, 0, 0, "noise", 0.3, seed=6), tone(0.2, 2400, 1700, "sine", 0.25), tone(0.14, 3300, 2600, "sine", 0.2)))
    P.sound("crack_stone", lowpass(tone(0.25, 0, 0, "noise", 0.8, seed=8), 0.3, 0.03))
    P.sound("bang", mix(lowpass(tone(0.5, 0, 0, "noise", 0.8, seed=3), 0.5, 0.04), tone(0.3, 120, 35, "sine", 0.7)))
    P.sound("split", join(tone(0.05, 700, 900, "square", 0.2), tone(0.08, 1100, 1400, "square", 0.2)))
    P.sound("yay", join(tone(0.07, 660, 780, "tri", 0.45), tone(0.14, 880, 1180, "tri", 0.45)))
    P.sound("load", tone(0.07, 320, 440, "tri", 0.3))
    P.sound("click", tone(0.03, 900, 700, "square", 0.12))
    P.sound("win", join(*[tone(0.12, f, f, "square", 0.2) for f in (523, 659, 784)], tone(0.5, 1047, 1047, "square", 0.22)))
    P.sound("lose", join(*[tone(0.2, f, f, "square", 0.2) for f in (392, 330, 262)], tone(0.5, 196, 196, "square", 0.22)))


def event_key(name, P):
    parts = name.split()
    if parts[0] == "mouse":
        return {"type": "mouse", "button": parts[-1], "edge": parts[-2], "global": parts[1] == "global"}
    return _tw.event_key(name, P)


def build(out):
    problems = [f"{l['name']}: {w}" for l in LEVELS for w in GAME["level_problems"](l)]
    if problems:
        raise SystemExit("The levels:\n  " + "\n  ".join(problems))
    P = Smash("Jelly Jailbreak")
    P.p["settings"]["pixelScaling"] = False

    # The pack's blocks are 70 pixels to the unit; here 35, so a tower fits one screen.
    shape_objects = []
    for material, shapes in PICTURES.items():
        for shape, numbers in shapes.items():
            size = GAME["SHAPES"][shape]
            frames = [element(material, n, size) for n in numbers]
            name = f"{material.lower()}_{shape.lower()}"
            if shape == "Ball":
                round_sprite(P, name, frames, 17)
            else:
                box_sprite(P, name, frames)
            shape_objects.append((f"{material}{shape}", material, name))
    box_sprite(P, "crate", [element("Explosive", n, (35, 35)) for n in (11, 14, 49)])
    for colour in JELLIES:
        box_sprite(P, f"jar_{colour.lower()}", [pic(f"alien{colour}_suit", (38, 38))])
        round_sprite(P, f"jelly_{colour.lower()}", [pic(f"alien{colour}_round", (36, 36))], 18)
        shape_objects.append((f"Jar{colour}", "Jar", f"jar_{colour.lower()}"))
    round_sprite(P, "rock", [element("Stone", 1, (30, 30))], 15)
    round_sprite(P, "cannonball", [element("Metal", 1, (34, 34))], 17)
    round_sprite(P, "bomb", [element("Explosive", 1, (32, 32))], 16)
    round_sprite(P, "trio", [element("Wood", 0, (30, 30))], 15)
    round_sprite(P, "bit", [element("Wood", 0, (20, 20))], 10)
    P.sprite("sling", [sling_picture()], (22, 100))
    P.sprite("button", [panel(122, 40)], (0, 0), mask=(0, 0, 122, 40))
    P.sprite("card", [panel(232, 56)], (0, 0), mask=(0, 0, 232, 56))
    P.sprite("star", [pic("starGold", (60, 60))], (30, 30))
    for theme, (back, tile) in THEMES.items():
        # The picture is square, and its hills are about halfway down it.
        P.sprite(f"back_{theme}", [pic(back).crop((0, 190, VIEW_W, 190 + VIEW_H))], (0, 0))
        im = ground_picture(tile)
        P.sprite(f"ground_{theme}", [im], (0, 0), mask=(0, 0, im.width, im.height))
    make_sounds(P)

    for f in sorted((HERE / "game").glob("_*.py")):
        head, _ = _tw.read_code(f)
        P.script(head.get("script", f.stem.strip("_")), f.read_text())
    files = sorted(f for f in (HERE / "game").glob("*.py") if not f.name.startswith("_"))
    parsed = {f.stem: _tw.read_code(f) for f in files}
    for name, (head, _) in parsed.items():
        P.obj(name, depth=int(head.get("depth", 0)), visible=head.get("visible", "yes") == "yes")
    # A shape is only a picture and a parent: everything else is inherited.
    for name, parent, sprite in shape_objects:
        P.obj(name, sprite=P.sprite_id(sprite), parent=P.obj_id(parent))
    for name, (head, events) in parsed.items():
        o = next(x for x in P.p["objects"] if x["name"] == name)
        if head.get("sprite"):
            o["sprite"] = P.sprite_id(head["sprite"])
        if head.get("parent"):
            o["parent"] = P.obj_id(head["parent"])
        for ev, code in events:
            o["events"].append({"id": _tw.new_id(), "key": event_key(ev, P), "mode": "python", "code": code})

    def room(name, theme, placed):
        lid, bid = _tw.new_id(), _tw.new_id()
        P.p["rooms"].append({
            "id": _tw.new_id(), "name": name, "width": VIEW_W, "height": VIEW_H, "background": "#d4f4f8",
            "gridWidth": 35, "gridHeight": 35, "snap": False,
            "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False},
                       {"id": bid, "name": "Hills", "kind": "background", "depth": 1000, "visible": True, "locked": False, "color": None,
                        "sprite": P.sprite_id(f"back_{theme}"), "mode": "once", "hspeed": 0, "vspeed": 0, "parallax": 0}],
            "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 0},
            "instances": [{"id": _tw.new_id(), "object": P.obj_id(o), "layer": lid, "x": x, "y": y,
                           "scaleX": 1, "scaleY": 1, "angle": 0, "code": code} for o, x, y, code in placed],
        })

    def ground(theme):
        return ("Ground", -400, GROUND_Y, f'self.sprite = "ground_{theme}"\n')

    # The title first: the game starts in the first room.
    cards = [("LevelCard", 24 + (i % 4) * 246, 140 + (i // 4) * 62, f"self.i = {i}\n") for i in range(len(LEVELS))]
    scene = []
    for k, (o, x, y) in enumerate(GAME["pile"](640, 0, "WoodSmall", "GlassSmall", "Jar") + GAME["pile"](880, 0, "StoneWide", "WoodSmall", "Jar")):
        if o == "Jar":
            o = f"Jar{JELLIES[k % len(JELLIES)]}"
        w, h = GAME["size_of"](o)
        scene.append((o, x, GROUND_Y - y - h / 2, ""))
    room("Title", "grass", [("Title", 0, 0, ""), ground("grass")] + scene + cards)
    for level in LEVELS:
        placed = [("Director", 0, 0, ""), ground(level["theme"]), ("Sling", GAME["SLING_X"], GROUND_Y + 2, ""),
                  ("GoButton", VIEW_W - 268, 8, 'self.words = "Levels"\n'),
                  ("GoButton", VIEW_W - 134, 8, 'self.words = "Retry"\nself.again = True\n')]
        jars = 0
        for name, x, y in level["blocks"]:
            if name == "Jar":
                name = f"Jar{JELLIES[jars % len(JELLIES)]}"
                jars += 1
            _, h = GAME["size_of"](name)
            placed.append((name, x, GROUND_Y - y - h / 2, ""))
        room(level["name"], level["theme"], placed)

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(LEVELS)} levels, {len(P.p['objects'])} objects")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Smash.zip")
