#!/usr/bin/env python3
"""
Builds the fourteenth showcase game, "Tabletop Siege", as a GameIDE project zip:
a snowball war between two snow forts across a frozen creek, one player against
another (or the computer). (It began as a battle across a kid's desk; the teacher
asked for a new setting, and the name stayed.)

    python3 showcase/siege/build.py      # → showcase/siege/out/Siege.zip

Against the computer, or another player in a room (a code, or "Find me a match").
The pictures are the teacher's, made with Gemini (PROMPTS.md), cut by
cut_sheets.py into art/ at twice the game's size.

THE GAME IS OBJECTS: Unit and its kinds (SnowKid, Snowman, Owl, Penguin, Yeti),
Building and its kinds (Tower, Keep, SnowWall), Shot, Snowball, IcePatch, Deploy (a card on
its way), Arena (the field and the clock), Hand (your cards), Hud, Cpu, Link (the
room: the host runs the battle, the other game shows it), Title. Every
number is in game/_1rules.py.
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
_tw = _load("thornwood_build", HERE.parent / "build.py")
_climb = _load("climber_build", HERE.parent / "climber" / "build.py")
RULES = {}
exec((HERE / "game" / "_1rules.py").read_text(), RULES)
VIEW_W, VIEW_H = RULES["VIEW_W"], RULES["VIEW_H"]


ART = HERE / "art"
_cut = _load("siege_cut", HERE / "cut_sheets.py")
STAND_IN_CARDS = {"sled": "sled", "bear": "yeti_blue_0", "foxes": "penguin_blue_0", "fairy": "owl_blue_0",
                  "cannon": "snow_wall", "avalanche": "heap", "cocoa": "mug", "icegolem": "snowman_blue_0",
                  # The eight to buy (2026-11-10): stand-ins until the teacher's pictures (PROMPTS 14-17).
                  "kangaroo": ("fox_blue_0", (224, 168, 106)), "salamander": ("fox_blue_0", (255, 106, 42)),
                  "moose": ("bear_blue_0", (176, 122, 72)), "hedgehog": ("chunk_blue", (154, 112, 72)),
                  "beaver": ("bridge", (122, 74, 34)), "campfire": ("pine_0", (255, 120, 40)),
                  "fireworks": ("sparkle", (255, 80, 200)), "squirrels": ("fox_blue_0", (200, 120, 58))}


def stand_in(name):
    """Another of the game's pictures for a card that has none yet, tinted if asked."""
    tint = None
    if isinstance(name, tuple):
        name, tint = name
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    if tint:
        im = _tw.tinted(im, tint, 0.55)
    return im
TROOPS = ["kid", "snowman", "owl", "penguin", "yeti", "sled", "bear", "fox", "fairy", "icegolem"]
GLIDE = {"owl", "fairy", "sled"}       # flying or sliding: their two frames aren't steps, so no legs-together frame
# How wide each picture is drawn in the game (pixels): build.py fits the teacher's drawings to these.
WIDE = {"snow": 256, "bridge": 64, "snow_wall": 48, "ice_patch": 2 * RULES["ICE_R"], "snowball_blue": 2 * RULES["SNOWBALL_R"] + 4,
        "snowball_red": 2 * RULES["SNOWBALL_R"] + 4, "puff": 30, "spark": 20, "snowshot": 12, "icicle": 14, "swirl": 30, "sparkle": 40,
        "avalanche": 2 * RULES["AVALANCHE_R"] + 10, "cocoa": 22, "heal": 2 * RULES["COCOA_R"], "ice_burst": 40,
        "pine_0": 26, "pine_1": 30, "pine_2": 36, "pine_3": 40, "sled": 34, "mug": 14, "cone": 12, "carrot": 16, "heap": 40}


def art(name, k=0.5):
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    return im if k == 1 else im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def fitted(name, width):
    """A drawing trimmed to what's drawn, `width` pixels across."""
    im = Image.open(ART / f"{name}.png").convert("RGBA")
    im = im.crop(im.getbbox())
    return im.resize((width, max(1, round(im.height * width / im.width))), Image.LANCZOS)


def passing(pic, legs_from=0.72, squeeze=0.55, lift=2):
    """
    The step between strides: the legs (below `legs_from` of the drawn height) drawn
    together under the body, the body a touch higher. Gemini's two walking frames came
    back almost the same pose, so walking looked like jittering on the spot (as in
    Undertow and Snowcap Scramble); now it's stride, together, stride.
    """
    box = pic.getbbox()
    if box is None:
        return pic.copy()
    top = box[1] + round((box[3] - box[1]) * legs_from)
    w, h = pic.size
    legs = pic.crop((0, top, w, h))
    lb = legs.getbbox()
    out = pic.copy()
    if lb is None:
        return out
    part = legs.crop(lb)
    narrow = part.resize((max(1, round(part.width * squeeze)), part.height), Image.NEAREST)
    out.paste((0, 0, 0, 0), (lb[0], top + lb[1], lb[2], top + lb[3]))
    mid = (lb[0] + lb[2]) // 2
    out.alpha_composite(narrow, (mid - narrow.width // 2, top + lb[1]))
    lifted = Image.new("RGBA", (w, h))
    lifted.alpha_composite(out.crop((0, lift, w, h)), (0, 0))
    return lifted


def icon_picture():
    """The snowman's card on an icy tile."""
    tile = Image.new("RGBA", (128, 128))
    ImageDraw.Draw(tile).rounded_rectangle((0, 0, 127, 127), radius=22, fill=(160, 205, 235, 255))
    tile.alpha_composite(art("card_snowman", 1).resize((108, 108), Image.LANCZOS), (10, 10))
    return tile


def make_sounds(P):
    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    P.sound("drop", join(tone(0.04, 300, 500, "square", 0.15), tone(0.05, 500, 700, "square", 0.12)))
    P.sound("pop", mix(tone(0.08, 700, 300, "sine", 0.35), lowpass(tone(0.06, 0, 0, "noise", 0.25, seed=2), 0.5, 0.1)))
    P.sound("hit", lowpass(tone(0.06, 0, 0, "noise", 0.4, seed=4), 0.5, 0.08))
    P.sound("twang", tone(0.1, 900, 300, "tri", 0.25))
    P.sound("shoot", tone(0.05, 600, 400, "square", 0.12))
    P.sound("crash", mix(lowpass(tone(0.5, 0, 0, "noise", 0.6, seed=7), 0.4, 0.03), tone(0.3, 160, 60, "sine", 0.5)))
    P.sound("tick", tone(0.03, 1200, 1100, "square", 0.1))
    P.sound("nope", tone(0.12, 180, 150, "square", 0.2))
    P.sound("overtime", join(*[tone(0.1, f, f, "square", 0.2) for f in (523, 659, 523, 659)]))
    P.sound("win", join(*[tone(0.12, f, f, "tri", 0.3) for f in (523, 659, 784)], tone(0.4, 1047, 1047, "tri", 0.3)))
    P.sound("lose", join(*[tone(0.18, f, f * 0.9, "tri", 0.3) for f in (392, 349, 330)], tone(0.4, 262, 250, "tri", 0.3)))
    # A bouncy winter march, C major, sleigh-bell bright.
    melody = [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 74, 0, 71, 0, 74, 0, 72, 0, 76, 0, 79, 0, 84, 0, 83, 79, 77, 74, 72, 0, 0, 0]
    bass = [48, 48, 55, 55, 53, 53, 55, 55, 48, 48, 55, 55, 53, 55, 48, 48]
    P.sound("music", _tw.music_loop(melody, bass, 120, seed=8), volume=0.5)


def build(out):
    P = _climb.Climb("Tabletop Siege")
    P.p["settings"]["pixelScaling"] = False
    P.p["settings"]["scoreboard"] = {"unit": "wins"}
    # One against one: rooms hold two, and the lobby offers "Find me a match".
    P.p["settings"]["netPlayers"] = 2
    P.sprite("icon", [icon_picture()], (64, 64))
    # The troops: a sprite for each kind and team, frames walking, walking, attacking (a owl:
    # flying, tilting, diving). Drawn facing right; the red side's are turned round. The origin
    # is a little below the middle: where the troop stands, for fights and the gap.
    for troop in TROOPS:
        for team in ("blue", "red"):
            frames = [art(f"{troop}_{team}_{k}") for k in range(3)]
            if troop not in GLIDE:
                frames[1] = passing(frames[0])
            w, h = frames[0].size
            P.sprite(f"{troop}_{team}", frames, (w // 2, round(h * 0.62)))
    for team in ("blue", "red"):
        frames = [art(f"tower_{team}_{k}") for k in range(3)]
        w, h = frames[0].size
        P.sprite(f"tower_{team}", frames, (w // 2, round(h * 0.72)))
    # An Ice Golem's chunks: one drawing each, walking with a legs-together step, and the
    # same drawing for a blow.
    for team in ("blue", "red"):
        c = art(f"chunk_{team}")
        P.sprite(f"chunk_{team}", [c, passing(c), c], (c.width // 2, round(c.height * 0.62)))
    for name in ("cannon_blue", "cannon_red", "cannon_fire"):
        im = art(name)
        P.sprite(name, [im], (im.width // 2, round(im.height * 0.7)))
    for name in ("castle_blue", "castle_red", "castle_broken"):
        im = art(name)
        P.sprite(name, [im], (im.width // 2, round(im.height * 0.62)))
    for name, width in WIDE.items():
        im = fitted(name, width) if name != "snow" else art(name).resize((width, width), Image.LANCZOS)
        if name == "bridge":
            im = im.resize((width, 2 * RULES["BRIDGE"] + 6), Image.LANCZOS)   # logs from bank to bank, a lane wide
        origin = (0, 0) if name == "snow" else (im.width // 2, im.height - 2) if name.startswith("pine") else (im.width // 2, im.height // 2)
        P.sprite(name, [im], origin)
    # The cards' pictures. Until the teacher's come for the eight new ones, each is a stand-in:
    # another picture of the game, framed like the rest (cut_sheets.framed).
    for card in RULES["ALL_CARDS"]:
        if (ART / f"card_{card}.png").exists():
            im = art(f"card_{card}")
        else:
            im = _cut.framed(stand_in(STAND_IN_CARDS[card])).resize((44, 44), Image.LANCZOS)
        P.sprite(f"card_{card}", [im], (im.width // 2, im.height // 2))
    title = art("title", 1)
    k = max(VIEW_W / title.width, VIEW_H / title.height)
    title = title.resize((round(title.width * k), round(title.height * k)), Image.LANCZOS)
    x, y = (title.width - VIEW_W) // 2, (title.height - VIEW_H) // 2
    P.picture("title", title.crop((x, y, x + VIEW_W, y + VIEW_H)))
    P.font("Ubuntu", HERE / "fonts" / "ubuntu-latin-700-normal.woff2")
    make_sounds(P)
    for f in sorted((HERE / "game").glob("_*.py")):
        head, _ = _tw.read_code(f)
        P.script(head.get("script", f.stem.strip("_")), f.read_text())

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
    # A kind with no depth of its own takes its parent's (and its parent's parent's).
    def depth_of(name):
        head = parsed[name][0]
        return int(head["depth"]) if "depth" in head else depth_of(head["parent"]) if head.get("parent") else 0
    for name in parsed:
        next(x for x in P.p["objects"] if x["name"] == name)["depth"] = depth_of(name)

    def room(name, placed):
        lid = _tw.new_id()
        P.p["rooms"].append({
            "id": _tw.new_id(), "name": name, "width": VIEW_W, "height": VIEW_H, "background": "#c8955a",
            "gridWidth": 16, "gridHeight": 16, "snap": False,
            "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
            "camera": {"enabled": False, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 1},
            "instances": [{"id": _tw.new_id(), "object": P.obj_id(o), "layer": lid, "x": 0, "y": 0,
                           "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""} for o in placed],
        })

    room("Title", ["Title"])
    room("Field", ["Arena", "Hand", "Hud", "Cpu", "Link"])
    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    print(f"{out}  {out.stat().st_size / 1e6:.2f} MB  {len(P.p['objects'])} objects")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Siege.zip")
