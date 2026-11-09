#!/usr/bin/env python3
"""
Builds the fourteenth showcase game, "Tabletop Siege", as a GameIDE project zip:
toy soldiers, wind-up knights and paper planes battling across a kid's desk, one
player against another (or the computer).

    python3 showcase/siege/build.py      # → showcase/siege/out/Siege.zip

Against the computer, or another player in a room (a code, or "Find me a match"),
everything drawn by the game itself until the teacher's Gemini pictures come.

THE GAME IS OBJECTS: Unit and its kinds (Soldier, Knight, Plane, Archer, Golem),
Building and its kinds (Tower, Keep, Wall), Shot, Marble, Glue, Deploy (a card on
its way), Arena (the desk and the clock), Hand (your cards), Hud, Cpu, Link (the
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


def icon_picture():
    """For now: a blue pencil cup on a wooden tile."""
    tile = Image.new("RGBA", (128, 128))
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle((0, 0, 127, 127), radius=22, fill=(200, 149, 90, 255))
    d.ellipse((34, 44, 94, 104), fill=(61, 123, 255, 255), outline=(27, 18, 8, 255), width=4)
    for k, c in enumerate(((255, 210, 63), (62, 207, 142), (255, 122, 198))):
        d.line((52 + k * 12, 70, 48 + k * 14, 22), fill=c, width=7)
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
    # A bouncy march, C major, toy-box instruments.
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
    room("Desk", ["Arena", "Hand", "Hud", "Cpu", "Link"])
    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    print(f"{out}  {out.stat().st_size / 1e6:.2f} MB  {len(P.p['objects'])} objects")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Siege.zip")
