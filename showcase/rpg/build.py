#!/usr/bin/env python3
"""
Builds the eleventh showcase game, "The Lanterns of Hollowmere", as a GameIDE
project zip: a story RPG with turn-based battles.

    python3 showcase/rpg/build.py      # → showcase/rpg/out/Hollowmere.zip

The pictures are the teacher's Gemini art, cut and named in art/ (PROMPTS.md says
what each is), and committed, unlike older games, so they can't be lost. Anything
not there yet is drawn here as a stand-in, so the game always builds and plays.

Each map is a text file in maps/: a key at the top, one character per 32-pixel
tile, painted into a tile layer with its things placed as instances, as a student
would place them in the room editor. A map whose start can't reach everything
stops the build (reach).

THE GAME IS OBJECTS: Usable → Person → Oona, MapFoe → Thornling, Fighter →
HeroFighter. Scenery objects have no code at all, only a picture and a parent.
"""
import importlib.util
import json
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


HERE = Path(__file__).resolve().parent
ART = HERE / "art"
_tw = _load("thornwood_build", HERE.parent / "build.py")
TILE = 32
VIEW_W, VIEW_H = 640, 360
GROUND = ["grass", "path", "cobble", "planks", "forest", "cave", "mud", "flag", "edge", "bog"]
GROUND_COLOURS = {"grass": (92, 148, 74), "path": (176, 142, 98), "cobble": (138, 138, 146), "planks": (150, 106, 66),
                  "forest": (52, 84, 58), "cave": (66, 62, 70), "mud": (70, 88, 62), "flag": (86, 76, 104), "edge": (20, 26, 30), "bog": (24, 58, 60)}
GROUND_CHAR = {".": "grass", ":": "path", ",": "cobble", "=": "planks", "g": "forest", "n": "cave", "~": "mud", "%": "flag", "#": "edge", "w": "bog"}
# The ground that stops you: rock walls, and water too deep to wade.
SOLID_GROUND = ("edge", "bog")

# Scenery: the map character, its object, its picture's size and the solid part at its feet.
PROPS = {
    "t": ("Tree", (64, 80), (26, 18)), "p": ("Pine", (48, 80), (20, 16)), "u": ("Bush", (32, 28), (26, 14)), "o": ("Boulder", (40, 34), (34, 18)),
    "R": ("CottageRed", (112, 104), (104, 56)), "B": ("CottageBlue", (112, 104), (104, 56)), "I": ("Inn", (160, 128), (152, 70)), "S": ("Smithy", (128, 112), (120, 62)),
    "M": ("Stall", (72, 56), (66, 26)), "W": ("Well", (44, 48), (40, 24)), "F": ("Fence", (32, 32), (32, 12)), "C": ("Crates", (40, 40), (38, 20)),
    "f": ("Flowers", (32, 24), (0, 0)), "b": ("Bench", (48, 28), (46, 14)),
    "A": ("Beam", (32, 64), (12, 10)), "Y": ("Cart", (56, 44), (50, 18)), "G": ("GlowRock", (48, 48), (30, 16)), "E": ("MineMouth", (96, 80), (0, 0)),
    "T": ("Throne", (72, 112), (60, 22)), "d": ("DeadTree", (64, 80), (18, 14)), "q": ("Reeds", (32, 32), (24, 12)), "i": ("Pillar", (40, 88), (22, 14)),
}
PICTURE = {"Tree": "prop_tree", "Pine": "prop_pine", "Bush": "prop_bush", "Boulder": "prop_boulder", "CottageRed": "prop_cottage_red", "CottageBlue": "prop_cottage_blue",
           "Inn": "prop_inn", "Smithy": "prop_smithy", "Stall": "prop_stall", "Well": "prop_well", "Fence": "prop_fence", "Crates": "prop_crates", "Flowers": "prop_flowers", "Bench": "prop_bench",
           "Beam": "prop_beam", "Cart": "prop_cart", "GlowRock": "prop_crystal", "MineMouth": "prop_mine", "DeadTree": "prop_dead_tree", "Reeds": "prop_reeds", "Pillar": "prop_pillar", "Throne": "prop_throne"}
PROP_COLOURS = {"Tree": (40, 110, 60), "Pine": (28, 84, 66), "Bush": (58, 130, 70), "Boulder": (120, 120, 126), "CottageRed": (176, 70, 60), "CottageBlue": (70, 96, 170), "Inn": (150, 110, 70),
                "Smithy": (96, 90, 90), "Stall": (190, 150, 70), "Well": (130, 130, 140), "Fence": (130, 96, 60), "Crates": (150, 116, 70), "Flowers": (210, 110, 170), "Bench": (120, 86, 56),
                "Beam": (110, 76, 46), "Cart": (90, 90, 96), "GlowRock": (230, 130, 60), "MineMouth": (70, 66, 70), "DeadTree": (60, 50, 44), "Reeds": (90, 120, 60), "Pillar": (110, 104, 110), "Throne": (40, 30, 50)}

# Everyone and everything else on a map: character → (object, creation code).
THINGS = {
    "O": ("Oona", ""), "P": ("Pip", ""), "D": ("Dot", ""), "K": ("Tam", ""), "H": ("Shopkeeper", ""), "N": ("Innkeeper", ""), "L": ("Lantern", ""),
    "l": ("Lantern", "self.number = 2\n"), "a": ("Lantern", "self.number = 3\n"), "y": ("Lantern", "self.number = 4\n"), "Q": ("Bram", ""), "j": ("Jory", ""),
}
FOREST_THINGS = {
    "K": ("Mittens", ""), "e": ("Thornling", ""), "v": ("Bat", ""), "m": ("Shroom", ""), "h": ("Herb", ""), "X": ("Thornback", ""),
    "c": ("Chest", 'self.item = "ether"\n'),
}
MINE_THINGS = {
    "J": ("Jory", ""), "e": ("Beetle", ""), "v": ("Rockling", ""), "m": ("Mole", ""), "x": ("GlowCrystal", ""), "r": ("Rubble", ""), "Z": ("Lift", ""), "X": ("Golem", ""),
    "c": ("Chest", 'self.item = "ether"\n'), "k": ("Chest", 'self.item = "mine_key"\n'), "h": ("Chest", 'self.gear = "foreman_hammer"\n'),
}
MARSH_THINGS = {
    "K": ("Sedge", ""), "s": ("Sluice", ""), "x": ("Lily", ""), "$": ("Flood", ""), "e": ("Slime", ""), "v": ("Frog", ""), "m": ("Wisp", ""), "X": ("Knight", ""),
    "c": ("Chest", 'self.gold = 150\n'),
}
CHAPEL_THINGS = {**MARSH_THINGS, "c": ("Chest", 'self.gear = "drowned_mail"\n')}


def stairs(to, c, r, extra=""):
    return ("Stairs", f"self.to, self.at_x, self.at_y = \"{to}\", {c} * 32 + 16, {r} * 32 + 24\n{extra}")


TOWER_FOES = {"e": ("Wolf", ""), "v": ("Armour", ""), "h": ("OldLamp", "")}
TOWER1_THINGS = {**TOWER_FOES, "U": stairs("Tower2", 16, 15), "c": ("Chest", 'self.item = "potion"\n')}
TOWER2_THINGS = {**TOWER_FOES, "U": stairs("Tower3", 16, 13, 'self.needs_flag = "wizard_beaten"\nself.sorry = "Something is holding these stairs shut. It feels like being stared at."\n'),
                 "D": stairs("Tower1", 14, 3), "k": ("Wizard", ""), "c": ("Chest", 'self.item = "kite"\n'), "K": ("Chest", 'self.gold = 250\n')}
TOWER3_THINGS = {**TOWER_FOES, "D": stairs("Tower2", 14, 3), "X": ("King", "")}
DOORS = {
    ("Town", "1"): ("Forest", "self.to, self.at_x, self.at_y = \"Forest\", 18 * 32 + 16, 20 * 32 + 16\nself.needs = \"thorn_road\"\nself.sorry = \"Whisper Wood is no place to wander alone. Talk to Oona in the square first.\"\n"),
    ("Forest", "1"): ("Town", "self.to, self.at_x, self.at_y = \"Town\", 20 * 32 + 16, 2 * 32\n"),
    ("Town", "2"): ("Mine", "self.to, self.at_x, self.at_y = \"Mine\", 2 * 32 + 16, 13 * 32 + 24\nself.needs_flag = \"bram_joined\"\nself.sorry = \"The old mine road. Those tunnels are dangerous. Better ask someone who knows them.\"\n"),
    ("Mine", "1"): ("Town", "self.to, self.at_x, self.at_y = \"Town\", 37 * 32 + 16, 16 * 32 + 24\n"),
    ("MineDeep", "1"): ("Mine", "self.to, self.at_x, self.at_y = \"Mine\", 22 * 32 + 16, 6 * 32\n"),
    ("Town", "3"): ("Marsh", "self.to, self.at_x, self.at_y = \"Marsh\", 6 * 32 + 16, 2 * 32 + 24\nself.needs = \"ember_marsh\"\nself.sorry = \"The south road goes down to the Mistfen, and nobody goes there without a reason.\"\n"),
    ("Marsh", "1"): ("Town", "self.to, self.at_x, self.at_y = \"Town\", 19 * 32 + 16, 19 * 32 + 16\n"),
    ("Marsh", "2"): ("Chapel", "self.to, self.at_x, self.at_y = \"Chapel\", 12 * 32 + 16, 14 * 32 + 24\n"),
    ("Town", "4"): ("Tower1", "self.to, self.at_x, self.at_y = \"Tower1\", 17 * 32 + 16, 13 * 32 + 24\nself.needs = \"ember_tower\"\nself.sorry = \"The west road climbs to the Hollow Tower. Nobody goes up there. Nobody ever has.\"\n"),
    ("Tower1", "1"): ("Town", "self.to, self.at_x, self.at_y = \"Town\", 1 * 32 + 16, 16 * 32 + 24\n"),
    ("Chapel", "1"): ("Marsh", "self.to, self.at_x, self.at_y = \"Marsh\", 18 * 32 + 16, 21 * 32 + 16\n"),
}
BIG = {"npc": (32, 44), "foe": (72, 72), "boss": (240, 160), "hero": (64, 72), "walk": (32, 44), "face": (64, 64)}
HERO_COLOURS = {"wren": (190, 60, 50), "pip": (70, 110, 200), "bram": (70, 140, 80)}
NPC_COLOURS = {"bram": (70, 140, 80), "miner": (150, 130, 90), "oona": (220, 220, 230), "pip": (70, 110, 200), "baker": (230, 200, 150), "child": (240, 170, 80), "cat": (130, 90, 60), "shop": (150, 120, 180), "inn": (200, 140, 110), "witch": (90, 130, 80)}
FOE_COLOURS = {"thornling": (70, 120, 50), "bat": (90, 70, 120), "shroom": (170, 90, 90), "thornback": (120, 70, 50),
               "beetle": (60, 60, 130), "rockling": (90, 90, 96), "mole": (120, 80, 50), "golem": (110, 70, 50),
               "slime": (70, 150, 70), "frog": (90, 120, 70), "wisp": (150, 150, 230), "knight": (90, 80, 70),
               "wolf": (70, 50, 110), "armour": (150, 160, 180), "wizard": (60, 40, 90), "king": (40, 30, 50)}
BOSSES = ("thornback", "golem", "knight", "king")
# Bigger than an ordinary foe, smaller than a boss, and square.
MID_FOES = {"wizard": (120, 120)}
BACKS = {"back_fields": (70, 90, 110), "back_forest": (34, 60, 50), "back_mine": (50, 40, 36), "back_marsh": (40, 60, 50), "back_tower": (50, 36, 70), "ending": (40, 40, 60)}
FACES = {"bram": (70, 140, 80), "miner": (150, 130, 90), "golem": (110, 70, 50), "wren": (190, 60, 50), "pip": (70, 110, 200), "oona": (220, 220, 230), "baker": (230, 200, 150), "cat": (130, 90, 60), "thornback": (120, 70, 50), "witch": (90, 130, 80), "knight": (90, 80, 70), "king": (40, 30, 50)}


class Hollowmere(_tw.Project):
    def write(self, path):
        index = {i: f"assets/{i}.{ext}" for i, (_, ext) in self.assets.items()}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(self.p, indent=1))
            z.writestr("assets/index.json", json.dumps(index, indent=1))
            for i, (data, ext) in self.assets.items():
                z.writestr(index[i], data)
            z.writestr("README.txt", f"{self.p['name']}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n"
                       "Pictures made for this game with Google Gemini.\n")


def art(name, size):
    """The real picture if it has been cut yet, or None for a stand-in."""
    f = ART / f"{name}.png"
    return Image.open(f).convert("RGBA").resize(size, Image.LANCZOS) if f.exists() else None


def font(size):
    try:
        return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", size)
    except OSError:
        return ImageFont.load_default()


def label(im, words, fill=(255, 255, 255, 255)):
    d = ImageDraw.Draw(im)
    size = max(9, min(14, im.width // max(4, len(words))))
    d.text((3, 3), words, font=font(size), fill=fill)
    return im


def figure(size, colour, words=""):
    """A stand-in person: head and body, feet at the bottom."""
    w, h = size
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((w * 0.2, h * 0.38, w * 0.8, h * 0.98), radius=max(2, w // 8), fill=colour + (255,), outline=(20, 20, 30, 255))
    d.ellipse((w * 0.25, h * 0.04, w * 0.75, h * 0.45), fill=(240, 205, 170, 255), outline=(20, 20, 30, 255))
    return label(im, words) if words else im


def blob(size, colour, words=""):
    w, h = size
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((1, h * 0.15, w - 2, h - 2), fill=colour + (255,), outline=(20, 20, 30, 255), width=2)
    d.ellipse((w * 0.25, h * 0.4, w * 0.38, h * 0.55), fill=(255, 255, 255, 255))
    d.ellipse((w * 0.55, h * 0.4, w * 0.68, h * 0.55), fill=(255, 255, 255, 255))
    return label(im, words) if words else im


def block(size, colour, words=""):
    im = Image.new("RGBA", size, colour + (255,))
    ImageDraw.Draw(im).rectangle((0, 0, size[0] - 1, size[1] - 1), outline=(20, 20, 30, 255), width=2)
    return label(im, words) if words else im


def walk_frames(key, view):
    """The walking frames of one view (cut_sheets.py makes them), the first being a person standing still."""
    frames = [art(f"{key}_{view}_{n}", BIG["walk"]) for n in range(4)]
    if all(frames):
        return frames
    a = figure(BIG["walk"], HERO_COLOURS[key])
    return [a, a.transpose(Image.FLIP_LEFT_RIGHT)]


# Each ground is a block of tiles, so that a big texture shows across the map: one
# picture squeezed into a single 32-pixel tile was mush, repeating every step.
BLOCK = 4


def ground_tile(name, c, r):
    """The tile for a ground at map cell c, r: numbered across then down, as tilesets are."""
    return (r % BLOCK) * BLOCK * len(GROUND) + GROUND.index(name) * BLOCK + c % BLOCK


def deep_water(mud):
    """The marsh's mud under dark green water: there's no water picture, and this sits right beside it."""
    return Image.blend(mud.convert("RGBA"), Image.new("RGBA", mud.size, (14, 58, 62, 255)), 0.68)


def sluice_wheel():
    """An old wheel on a post, shut and open: the one thing here Gemini wasn't asked for."""
    frames = []
    for turned in (0, 30):
        wheel = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
        d = ImageDraw.Draw(wheel)
        d.ellipse((3, 3, 36, 36), outline=(58, 42, 34, 255), width=5)
        d.ellipse((5, 5, 34, 34), outline=(146, 88, 52, 255), width=2)
        d.line((20, 4, 20, 36), fill=(96, 62, 42, 255), width=4)
        d.line((4, 20, 36, 20), fill=(96, 62, 42, 255), width=4)
        d.ellipse((15, 15, 25, 25), fill=(58, 42, 34, 255))
        im = Image.new("RGBA", (40, 52), (0, 0, 0, 0))
        ImageDraw.Draw(im).rectangle((15, 16, 24, 52), fill=(92, 70, 52, 255), outline=(40, 30, 26, 255))
        im.alpha_composite(wheel.rotate(turned), (0, 0))
        frames.append(im)
    return frames


def ground_tileset(P):
    size = TILE * BLOCK
    im = Image.new("RGBA", (size * len(GROUND), size))
    for i, name in enumerate(GROUND):
        t = art(f"ground_{name}", (size, size))
        # Rock walls: the cave's own floor, nearly black, so the tunnels have an edge to them.
        if name == "edge" and art("ground_cave", (size, size)):
            t = art("ground_cave", (size, size)).point(lambda v: v // 3)
            t.putalpha(255)
        if name == "bog" and art("ground_mud", (size, size)):
            t = deep_water(art("ground_mud", (size, size)))
        if t is None:
            t = Image.new("RGBA", (size, size), GROUND_COLOURS[name] + (255,))
            d = ImageDraw.Draw(t)
            shade = tuple(max(0, c - 10) for c in GROUND_COLOURS[name])
            for k in range(0, size, 8):
                d.point((k, (k * 7) % size), fill=shade + (255,))
                d.point(((k * 5) % size, k), fill=shade + (255,))
        im.paste(t, (i * size, 0))
    t = P.tileset("Ground", im, [ground_tile(name, c, r) for name in SOLID_GROUND for c in range(BLOCK) for r in range(BLOCK)])
    t["tileWidth"], t["tileHeight"] = TILE, TILE
    return t


def read_map(path):
    head, rows = {}, []
    for line in path.read_text().splitlines():
        if line.startswith("# ") or not line.strip():
            continue
        if ": " in line and not rows and not line.startswith("#"):
            k, v = line.split(": ", 1)
            head[k] = v
        else:
            rows.append(line)
    w = max(len(r) for r in rows)
    return head, [r.ljust(w, "#") for r in rows]


def reach(rows, start, solid_props):
    """Every cell you could walk to, from the start: scenery and the edge stop you."""
    seen, todo = {start}, [start]
    while todo:
        c, r = todo.pop()
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c + dc, r + dr)
            if n in seen or not (0 <= n[1] < len(rows) and 0 <= n[0] < len(rows[0])):
                continue
            if rows[n[1]][n[0]] in "#w" or n in solid_props:
                continue
            seen.add(n)
            todo.append(n)
    return seen


def make_sounds(P):
    tone, lowpass, mix, join = _tw.tone, _tw.lowpass, _tw.mix, _tw.join
    P.sound("tick", tone(0.03, 900, 800, "square", 0.08))
    P.sound("click", tone(0.05, 660, 880, "square", 0.14))
    P.sound("nope", tone(0.12, 180, 120, "square", 0.2))
    P.sound("coin", join(tone(0.06, 880, 880, "square", 0.15), tone(0.12, 1320, 1320, "square", 0.15)))
    P.sound("quest", join(*[tone(0.1, f, f, "tri", 0.3) for f in (523, 659, 784)], tone(0.3, 1047, 1047, "tri", 0.3)))
    P.sound("light", mix(tone(0.8, 200, 900, "sine", 0.35), lowpass(tone(0.8, 0, 0, "noise", 0.2, seed=5), 0.3, 0.05)))
    P.sound("hit", mix(lowpass(tone(0.1, 0, 0, "noise", 0.5, seed=2), 0.5, 0.1), tone(0.08, 240, 120, "square", 0.2)))
    P.sound("foe_hit", mix(lowpass(tone(0.14, 0, 0, "noise", 0.5, seed=4), 0.3, 0.05), tone(0.1, 150, 70, "square", 0.25)))
    P.sound("magic", join(tone(0.1, 500, 900, "sine", 0.3), tone(0.2, 900, 1400, "sine", 0.3)))
    P.sound("heal", join(tone(0.1, 660, 660, "sine", 0.25), tone(0.1, 880, 880, "sine", 0.25), tone(0.2, 1100, 1100, "sine", 0.25)))
    P.sound("win", join(*[tone(0.12, f, f, "square", 0.2) for f in (523, 659, 784, 1047)], tone(0.4, 1319, 1319, "square", 0.2)))
    P.sound("lose", join(*[tone(0.22, f, f, "square", 0.2) for f in (392, 330, 262)], tone(0.6, 196, 196, "square", 0.2)))
    # A quiet walking tune, and something quicker for a fight.
    P.sound("theme", _tw.music_loop([262, 330, 392, 330, 294, 349, 440, 349, 262, 330, 392, 523, 494, 392, 330, 294], [131, 147, 131, 98], 72))
    P.sound("battle", _tw.music_loop([330, 392, 494, 392, 349, 440, 523, 440, 330, 392, 494, 587, 523, 440, 392, 349], [82, 87, 98, 87], 132))


def build(out):
    P = Hollowmere("The Lanterns of Hollowmere")
    P.p["settings"]["scoreboard"] = {"lowest": True, "unit": "time"}
    P.p["settings"]["pixelScaling"] = False

    # The party on the map. Only Wren is seen: the others walk with her, out of sight.
    box = (8, 34, 24, 44)
    for view in ("down", "up", "side"):
        P.sprite(f"wren_{view}", walk_frames("wren", view), (16, 40), mask=box, fps=8)
    for key, colour in NPC_COLOURS.items():
        P.sprite(f"npc_{key}", [art(f"npc_{key}", BIG["npc"]) or figure(BIG["npc"], colour, key[:5])], (16, 40), mask=box)
    for key, colour in HERO_COLOURS.items():
        frames = [art(f"fight_{key}_{n}", BIG["hero"]) or figure(BIG["hero"], colour, f"{key[:4]}{n}") for n in range(4)]
        P.sprite(f"fight_{key}", frames, (32, 68))
    for key, colour in FOE_COLOURS.items():
        size = BIG["boss"] if key in BOSSES else MID_FOES.get(key, BIG["foe"])
        P.sprite(f"foe_{key}", [art(f"foe_{key}", size) or blob(size, colour, key[:6])], (size[0] // 2, size[1] - 4))
    for key, colour in FACES.items():
        P.sprite(f"face_{key}", [art(f"face_{key}", BIG["face"]) or block(BIG["face"], colour, key[:6])], (0, 0))
    for name, colour in BACKS.items():
        P.sprite(name, [art(name, (VIEW_W, VIEW_H)) or block((VIEW_W, VIEW_H), colour, name)], (0, 0))
    P.sprite("title", [art("title", (VIEW_W, VIEW_H)) or block((VIEW_W, VIEW_H), (16, 20, 44))], (0, 0))

    # Things on the map.
    for name, (size, colour, words) in {"map_thornling": ((36, 36), FOE_COLOURS["thornling"], "tho"), "map_bat": ((36, 36), FOE_COLOURS["bat"], "bat"),
                                        "map_shroom": ((36, 36), FOE_COLOURS["shroom"], "shr"), "map_thornback": ((120, 80), FOE_COLOURS["thornback"], "BOSS"),
                                        "map_beetle": ((36, 36), FOE_COLOURS["beetle"], "bee"), "map_rockling": ((36, 36), FOE_COLOURS["rockling"], "roc"),
                                        "map_mole": ((36, 36), FOE_COLOURS["mole"], "mol"), "map_golem": ((120, 80), FOE_COLOURS["golem"], "BOSS"),
                                        "map_slime": ((36, 36), FOE_COLOURS["slime"], "sli"), "map_frog": ((36, 36), FOE_COLOURS["frog"], "fro"),
                                        "map_wisp": ((36, 36), FOE_COLOURS["wisp"], "wis"), "map_knight": ((120, 80), FOE_COLOURS["knight"], "BOSS"),
                                        "map_wolf": ((40, 36), FOE_COLOURS["wolf"], "wol"), "map_armour": ((36, 36), FOE_COLOURS["armour"], "arm"),
                                        "map_wizard": ((48, 48), FOE_COLOURS["wizard"], "wiz"), "map_king": ((120, 80), FOE_COLOURS["king"], "BOSS")}.items():
        pic = art(name, size) or art(name.replace("map_", "foe_"), size) or blob(size, colour, words)
        w, h = size
        P.sprite(name, [pic], (w // 2, h - 4), mask=(4, h // 2, w - 4, h))
    lit = art("lantern_lit", (40, 80))
    unlit = art("lantern_dark", (40, 80))
    if lit is None or unlit is None:
        unlit, lit = block((40, 80), (60, 60, 70), "dark"), block((40, 80), (240, 170, 70), "lit")
    P.sprite("lantern", [unlit, lit], (20, 76), mask=(8, 62, 32, 80))
    P.sprite("herb", [art("herb", (24, 24)) or blob((24, 24), (130, 220, 150))], (12, 20), mask=(2, 6, 22, 24))
    P.sprite("chest", [art("chest_shut", (32, 28)) or block((32, 28), (150, 106, 50), "?"), art("chest_open", (32, 28)) or block((32, 28), (90, 66, 40))], (16, 24), mask=(0, 8, 32, 28))
    P.sprite("door", [block((32, 32), (255, 255, 0))], (0, 0), mask=(0, 0, 32, 32))
    # A rockfall fills its tunnel from wall to wall: the mask is a whole tile wide.
    P.sprite("rubble", [art("prop_boulder", (40, 34)) or blob((40, 34), (120, 120, 126), "rock")], (20, 34), mask=(4, 10, 36, 34))
    P.sprite("lift", [art("prop_arch", (64, 88)) or block((64, 88), (70, 60, 56), "lift")], (32, 88), mask=(4, 60, 60, 88))
    P.sprite("glow_crystal", [art("prop_crystal", (28, 28)) or blob((28, 28), (230, 130, 60))], (14, 24), mask=(2, 8, 26, 28))
    P.sprite("sluice", sluice_wheel(), (20, 48), mask=(8, 34, 32, 52))
    P.sprite("lily", [art("prop_flowers", (24, 18)) or blob((24, 18), (230, 230, 240))], (12, 16), mask=(2, 2, 22, 18))
    flood = art("ground_mud", (32, 32))
    P.sprite("flood", [deep_water(flood) if flood else block((32, 32), GROUND_COLOURS["bog"])], (16, 32), mask=(0, 0, 32, 32))
    P.sprite("stairs", [art("prop_stairs", (64, 80)) or block((64, 80), (70, 60, 80), "stairs")], (32, 80))
    P.sprite("old_lamp", [art("prop_big_lantern", (44, 88)) or block((44, 88), (60, 50, 50), "lamp")], (22, 88), mask=(6, 70, 38, 88))
    make_sounds(P)
    ground = ground_tileset(P)

    # Objects from their files, then the scenery, which is a picture and a parent.
    files = sorted(f for f in (HERE / "game").glob("*.py") if not f.name.startswith("_"))
    for f in sorted((HERE / "game").glob("_*.py")):
        head, _ = _tw.read_code(f)
        P.script(head.get("script", f.stem.strip("_")), f.read_text())
    parsed = {f.stem: _tw.read_code(f) for f in files}
    for name, (head, _) in parsed.items():
        P.obj(name, depth=int(head.get("depth", 0)))
    for name in ("Thornling", "Bat", "Shroom", "Beetle", "Rockling", "Mole", "Slime", "Frog", "Wisp", "Wolf", "Armour"):
        P.obj(name, sprite=P.sprite_id(f"map_{name.lower()}"), parent=P.obj_id("MapFoe"))
    for ch, (name, size, feet) in PROPS.items():
        w, h = size
        im = art(PICTURE[name], size) or block(size, PROP_COLOURS[name], name[:6])
        fw, fh = feet
        mask = ((w - fw) // 2, h - fh, (w + fw) // 2, h) if fw else (0, 0, 0, 0)
        P.sprite(PICTURE[name], [im], (w // 2, h), mask=mask if fw else None)
        P.obj(name, sprite=P.sprite_id(PICTURE[name]), parent=P.obj_id("Prop"), solid=bool(fw))
    for name, (head, events) in parsed.items():
        o = next(x for x in P.p["objects"] if x["name"] == name)
        if head.get("sprite"):
            o["sprite"] = P.sprite_id(head["sprite"])
        if head.get("parent"):
            o["parent"] = P.obj_id(head["parent"])
        for ev, code in events:
            o["events"].append({"id": _tw.new_id(), "key": _tw.event_key(ev, P), "mode": "python", "code": code})
    # Flowers and the mine's mouth don't stop you, and the crystals light the tunnels.
    for o in P.p["objects"]:
        if o["name"] in ("Flowers", "MineMouth"):
            o["events"].append({"id": _tw.new_id(), "key": {"type": "create"}, "mode": "python", "code": "super().on_create()\nself.solid = False\n"})
        if o["name"] == "GlowRock":
            o["events"].append({"id": _tw.new_id(), "key": {"type": "step"}, "mode": "python", "code": "light(self.x, self.y - 20, 130, \"#ff9a4a\", 1)\n"})
        # A dark wolf on a dark floor needs something to give it away before it's on you.
        if o["name"] == "Wolf":
            o["events"].append({"id": _tw.new_id(), "key": {"type": "step"}, "mode": "python", "code": "super().on_step()\nlight(self.x, self.y - 12, 60, \"#b9a0ff\", 1)\n"})
        if o["name"] == "Wisp":
            o["events"].append({"id": _tw.new_id(), "key": {"type": "step"}, "mode": "python", "code": "super().on_step()\nlight(self.x, self.y - 16, 90, \"#a8b4ff\", 1)\n"})

    def plain_room(name, colour, objects):
        lid = _tw.new_id()
        P.p["rooms"].append({
            "id": _tw.new_id(), "name": name, "width": VIEW_W, "height": VIEW_H, "background": colour, "gridWidth": TILE, "gridHeight": TILE, "snap": True,
            "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False}],
            "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": None, "smoothing": 0},
            "instances": [{"id": _tw.new_id(), "object": P.obj_id(o), "layer": lid, "x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "angle": 0, "code": ""} for o in objects],
        })

    problems = []

    def map_room(path, things):
        head, rows = read_map(path)
        name = head["room"]
        lid, gid = _tw.new_id(), _tw.new_id()
        base = GROUND_CHAR[head.get("ground", ".")]
        tiles, instances, blocked, start, targets = {}, [], set(), None, []

        def place(obj, x, y, code=""):
            instances.append({"id": _tw.new_id(), "object": P.obj_id(obj), "layer": lid, "x": x, "y": y, "scaleX": 1, "scaleY": 1, "angle": 0, "code": code})

        for r, row in enumerate(rows):
            for c, ch in enumerate(row):
                x, y = c * TILE + TILE // 2, (r + 1) * TILE
                # Under a person or a tree, the ground of whatever's next to it: a patch of the
                # map's main ground would show round them on a cobbled square.
                nearby = [rows[y2][x2] for x2, y2 in ((c - 1, r), (c + 1, r), (c, r - 1), (c, r + 1)) if 0 <= y2 < len(rows) and 0 <= x2 < len(row) and rows[y2][x2] in GROUND_CHAR and rows[y2][x2] not in "#w"]
                tiles[f"{c},{r}"] = ground_tile("planks" if ch == "$" else GROUND_CHAR[ch] if ch in GROUND_CHAR else GROUND_CHAR[nearby[0]] if nearby else base, c, r)
                if ch in PROPS:
                    place(PROPS[ch][0], x, y)
                    if PROPS[ch][2][0]:
                        blocked.add((c, r))
                elif ch == "@":
                    start = (c, r)
                    place("Player", x, y)
                elif (name, ch) in DOORS:
                    place("Door", c * TILE, r * TILE, DOORS[(name, ch)][1])
                    targets.append((f"the door {ch}", c, r))
                elif ch in things:
                    obj, code = things[ch]
                    place(obj, x, y, code)
                    targets.append((obj, c, r))
                elif ch not in GROUND_CHAR:
                    problems.append(f"{name}: nothing is meant by {ch!r} at {c},{r}")
        place("Hud", 0, 0)
        if start is None:
            problems.append(f"{name}: no @ to start from")
        else:
            seen = reach(rows, start, blocked)
            for what, c, r in targets:
                # Solid things are reached by standing beside them.
                if not any((c + dc, r + dr) in seen for dc, dr in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1))):
                    problems.append(f"{name}: can't reach {what} at {c},{r}")
        for door in [k for k in DOORS if k[0] == name]:
            if not any(door[1] in row for row in rows):
                problems.append(f"{name}: door {door[1]} isn't on the map")
        h, w = len(rows), len(rows[0])
        P.p["rooms"].append({
            "id": _tw.new_id(), "name": name, "width": w * TILE, "height": h * TILE, "background": "#101418", "gridWidth": TILE, "gridHeight": TILE, "snap": True,
            "layers": [{"id": lid, "name": "Instances", "kind": "instances", "depth": 0, "visible": True, "locked": False},
                       {"id": gid, "name": "Ground", "kind": "tiles", "depth": 500, "visible": True, "locked": False, "tileset": ground["id"], "tiles": tiles}],
            "camera": {"enabled": True, "width": VIEW_W, "height": VIEW_H, "follow": P.obj_id("Player"), "smoothing": 0.15},
            "instances": instances,
        })

    # The title first: the game starts in the first room.
    plain_room("Title", "#10142c", ["Title"])
    map_room(HERE / "maps" / "Town.txt", THINGS)
    map_room(HERE / "maps" / "Forest.txt", FOREST_THINGS)
    map_room(HERE / "maps" / "Mine.txt", MINE_THINGS)
    map_room(HERE / "maps" / "MineDeep.txt", MINE_THINGS)
    map_room(HERE / "maps" / "Marsh.txt", MARSH_THINGS)
    map_room(HERE / "maps" / "Chapel.txt", CHAPEL_THINGS)
    map_room(HERE / "maps" / "Tower1.txt", TOWER1_THINGS)
    map_room(HERE / "maps" / "Tower2.txt", TOWER2_THINGS)
    map_room(HERE / "maps" / "Tower3.txt", TOWER3_THINGS)
    plain_room("Battle", "#202838", ["BattleDirector"])
    plain_room("GameOver", "#000000", ["GameOver"])
    plain_room("Ending", "#000000", ["Ending"])
    if problems:
        raise SystemExit("The maps:\n  " + "\n  ".join(problems))

    out.parent.mkdir(parents=True, exist_ok=True)
    P.write(out)
    (out.parent / "project.json").write_text(json.dumps(P.p, indent=1))
    print(f"{out}  {out.stat().st_size / 1e6:.1f} MB  {len(P.p['rooms'])} rooms, {len(P.p['objects'])} objects")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "Hollowmere.zip")
