# script: levels
# Every level, as numbers. build.py places these as real instances in each
# level's room, and a level that couldn't stand up stops the build
# (level_problems). To make a level: add one here and build.
#
# A block is (object, x of its middle, how far its bottom is above the ground).
VIEW_W, VIEW_H = 1024, 576
GROUND_Y = 500                 # the top of the ground
SLING_X, SLING_Y = 120, 410    # where a shot sits, ready

# How big each shape is. "Jar" is a jelly in a jar, "Crate" goes bang,
# "Ledge" is bolted in the air and never moves or breaks.
SHAPES = {"Small": (35, 35), "Wide": (70, 35), "Long": (110, 35), "Tall": (35, 70), "Pillar": (35, 110), "Big": (70, 70), "Ball": (35, 35)}
SPECIAL = {"Jar": (38, 38), "Crate": (35, 35), "Ledge": (110, 35)}
MATERIALS = ("Wood", "Glass", "Stone", "Metal")
SHOTS = ("Rock", "Cannonball", "Bomb", "Trio")


def size_of(name):
    if name.startswith("Jar"):      # JarGreen and the other colours
        return SPECIAL["Jar"]
    if name in SPECIAL:
        return SPECIAL[name]
    for m in MATERIALS:
        if name.startswith(m):
            return SHAPES[name[len(m):]]
    raise KeyError(name)


def hut(x, y, stuff, post="Tall", roof="Long"):
    """Two posts and a roof across them, with its bottom y above the ground."""
    w = size_of(stuff + roof)[0]
    h = size_of(stuff + post)[1]
    gap = (w - 35) / 2
    return [(stuff + post, x - gap, y), (stuff + post, x + gap, y), (stuff + roof, x, y + h)]


def pile(x, y, *names):
    """Things stood on top of each other, in the order given, from y up."""
    out = []
    for name in names:
        out.append((name, x, y))
        y += size_of(name)[1]
    return out


LEVELS = [
    {"name": "First Fling", "theme": "grass", "shots": ["Rock", "Rock", "Rock"], "par": 1,
     "hint": "Press anywhere, pull back, and let go.",
     "blocks": pile(640, 0, "WoodSmall", "WoodSmall", "WoodSmall", "Jar")},
    {"name": "Two Huts", "theme": "grass", "shots": ["Rock", "Rock", "Rock"], "par": 2,
     "hint": "A jar breaks when something hits it hard, or when it falls.",
     "blocks": hut(560, 0, "Wood") + [("Jar", 560, 0)] + hut(800, 0, "Wood") + [("Jar", 800, 0)]},
    {"name": "Glass House", "theme": "grass", "shots": ["Rock", "Rock", "Rock"], "par": 1,
     "hint": "Glass is easy to break. Wood takes more.",
     "blocks": hut(700, 0, "Glass") + hut(700, 105, "Glass") + [("Jar", 700, 0), ("Jar", 700, 105), ("Jar", 700, 210)]},
    {"name": "Stone Cold", "theme": "desert", "shots": ["Cannonball", "Rock", "Rock"], "par": 2,
     "hint": "A cannonball is heavy, and it keeps going through what it breaks.",
     "blocks": hut(640, 0, "Stone") + [("Jar", 640, 0)] + pile(760, 0, "WoodWide", "WoodWide", "Jar")},
    {"name": "Handle With Care", "theme": "desert", "shots": ["Rock", "Rock", "Rock"], "par": 1,
     "hint": "Crates go bang when they're hit.",
     "blocks": hut(600, 0, "Stone") + [("Jar", 600, 0)] + [("Crate", 690, 0), ("Crate", 690, 35)] + hut(780, 0, "Stone") + [("Jar", 780, 0)]},
    {"name": "Bomb Squad", "theme": "desert", "shots": ["Bomb", "Bomb", "Rock"], "par": 2,
     "hint": "Click or tap while a bomb is flying to set it off.",
     "blocks": pile(560, 0, "StoneBig", "StoneBig") + hut(700, 0, "Wood") + [("Jar", 700, 0)] + hut(700, 105, "Wood") + [("Jar", 700, 105)]},
    {"name": "Three's a Crowd", "theme": "shroom", "shots": ["Trio", "Trio", "Rock"], "par": 1,
     "hint": "Click or tap while a Trio is flying and it splits into three.",
     "blocks": pile(620, 0, "GlassSmall", "Jar") + pile(760, 0, "GlassSmall", "GlassSmall", "Jar") + pile(900, 0, "GlassSmall", "Jar")},
    {"name": "Up on the Shelf", "theme": "shroom", "shots": ["Rock", "Trio", "Cannonball", "Rock"], "par": 2,
     "hint": "A shelf never moves, but what's on it can be knocked off.",
     "blocks": [("Ledge", 720, 200)] + pile(720, 235, "Jar") + [("Ledge", 880, 110)] + pile(880, 145, "WoodSmall", "Jar") + hut(600, 0, "Wood") + [("Jar", 600, 0)]},
    {"name": "The Big Wobble", "theme": "shroom", "shots": ["Cannonball", "Bomb", "Trio", "Rock", "Rock"], "par": 4,
     "hint": "Everything you've learned. Take your time.",
     "blocks": hut(620, 0, "Stone", "Pillar") + [("Jar", 620, 0), ("Crate", 620, 38)] + hut(620, 145, "Wood") + [("Jar", 620, 145)]
     + hut(780, 0, "Wood") + [("Jar", 780, 0)] + hut(780, 105, "Glass") + [("Jar", 780, 105)] + hut(780, 210, "Glass") + [("Jar", 780, 210)]
     + pile(920, 0, "MetalWide", "WoodBig", "Jar")},
    # The harder half. Fewer shots than you'd like, and something in the way.
    {"name": "Snowed In", "theme": "snow", "shots": ["Cannonball", "Bomb", "Rock"], "par": 2,
     "hint": "Stone over stone. Find the way in, or bring the roof down.",
     "blocks": hut(620, 0, "Stone") + [("Jar", 620, 0)] + pile(620, 105, "StoneWide", "StoneWide")
     + hut(800, 0, "Stone") + [("Jar", 800, 0)] + pile(800, 105, "StoneBig")},
    {"name": "Domino Row", "theme": "snow", "shots": ["Rock", "Rock"], "par": 1,
     "hint": "One good push goes a long way.",
     "blocks": [("WoodPillar", x, 0) for x in (420, 490, 560, 630, 700, 770, 840)] + [("Jar", 905, 0), ("GlassSmall", 960, 0), ("Jar", 960, 35)]},
    {"name": "Look Out Below", "theme": "snow", "shots": ["Rock", "Rock", "Rock"], "par": 2,
     "hint": "You can't reach the jars. What's over them can.",
     "blocks": [("StoneTall", 560, 0), ("Ledge", 630, 170), ("StoneBall", 660, 205), ("MetalTall", 700, 0), ("Jar", 660, 0)]
     + [("StoneTall", 800, 0), ("Ledge", 870, 240), ("StoneBall", 900, 275), ("MetalTall", 940, 0), ("Jar", 900, 0)]},
    {"name": "Wall of Iron", "theme": "snow", "shots": ["Bomb", "Cannonball", "Rock"], "par": 2,
     "hint": "Metal hardly ever breaks. Go over it.",
     "blocks": pile(600, 0, "MetalBig", "MetalBig", "MetalBig") + hut(760, 0, "Wood") + [("Jar", 760, 0)] + hut(760, 105, "Glass") + [("Jar", 760, 105)]
     + pile(900, 0, "MetalWide", "Jar")},
    {"name": "Sky Shelves", "theme": "snow", "shots": ["Trio", "Rock", "Rock"], "par": 2,
     "hint": "Each shelf has a wall on the side you'd like to hit.",
     "blocks": [("Ledge", 500, 290), ("StoneSmall", 460, 325), ("Jar", 515, 325)] + [("Ledge", 690, 200), ("StoneSmall", 650, 235), ("Jar", 705, 235)]
     + [("Ledge", 880, 330), ("StoneSmall", 840, 365), ("Jar", 895, 365)]},
    {"name": "Crate Expectations", "theme": "dusk", "shots": ["Rock", "Rock"], "par": 2,
     "hint": "Crates set off crates. Mind the wall.",
     "blocks": pile(470, 0, "MetalBig", "MetalBig", "MetalBig") + [("Crate", x, 0) for x in (560, 660, 860)]
     + [("Jar", 610, 0), ("Jar", 710, 0), ("Jar", 810, 0), ("Jar", 915, 0)]},
    {"name": "Tall Order", "theme": "dusk", "shots": ["Cannonball", "Trio", "Rock"], "par": 2,
     "hint": "The higher they are, the further they fall.",
     "blocks": hut(720, 0, "Stone") + [("Jar", 720, 0)] + hut(720, 105, "Stone") + [("Jar", 720, 105)] + hut(720, 210, "Wood") + [("Jar", 720, 210)]
     + hut(720, 315, "Glass") + [("Jar", 720, 315)]},
    {"name": "Bunker Hill", "theme": "dusk", "shots": ["Bomb", "Bomb", "Cannonball"], "par": 1,
     "hint": "A bomb reaches through walls, if you set it off close enough.",
     "blocks": pile(520, 0, "StoneBig", "StoneBig") + [("MetalTall", 620, 0), ("MetalTall", 710, 0), ("MetalTall", 800, 0), ("Jar", 665, 0), ("Jar", 755, 0)]
     + [("MetalWide", 665, 70), ("MetalWide", 755, 70), ("Jar", 665, 105), ("Jar", 755, 105)]},
    {"name": "Jelly Jackpot", "theme": "dusk", "shots": ["Cannonball", "Bomb", "Trio", "Rock"], "par": 3,
     "hint": "The last one. Every jar you've ever seen, and not enough shots.",
     "blocks": pile(440, 0, "MetalBig", "StoneBig") + hut(570, 0, "Stone", "Pillar") + [("Jar", 570, 0), ("Crate", 570, 38)] + hut(570, 145, "Wood") + [("Jar", 570, 145)]
     + [("Ledge", 720, 250), ("StoneBall", 745, 285), ("Jar", 700, 285)] + [("Jar", 750, 0), ("WoodTall", 700, 0), ("WoodTall", 800, 0)]
     + hut(900, 0, "Stone") + [("Jar", 900, 0)] + hut(900, 105, "Glass") + [("Jar", 900, 105)] + pile(900, 210, "Crate", "Jar")},
]


def block_box(block):
    """(left, right, bottom, top) in heights above the ground."""
    name, x, y = block
    w, h = size_of(name)
    return x - w / 2, x + w / 2, y, y + h


def level_problems(level):
    """Why a level couldn't be played, in words. The build refuses any of these."""
    problems = []
    blocks = level["blocks"]
    for s in level["shots"]:
        if s not in SHOTS:
            problems.append(f"there's no shot called {s}")
    if not level["shots"]:
        problems.append("it has no shots")
    if not any(b[0] == "Jar" for b in blocks):
        problems.append("it has no jars, so it's over as soon as it starts")
    if not 1 <= level["par"] <= len(level["shots"]):
        problems.append(f"its par of {level['par']} can't be scored with {len(level['shots'])} shots")
    try:
        boxes = [block_box(b) for b in blocks]
    except KeyError as e:
        return problems + [f"there's no block called {e.args[0]}"]
    for i, (b, box) in enumerate(zip(blocks, boxes)):
        left, right, bottom, top = box
        if left < SLING_X + 160 or right > VIEW_W - 10:
            problems.append(f"{b[0]} at {b[1]} is off the field or too near the sling")
        if bottom < 0 or GROUND_Y - top < 40:
            problems.append(f"{b[0]} at height {b[2]} is out of the sky or the ground")
        for other, obox in zip(blocks[:i], boxes):
            if left < obox[1] and obox[0] < right and bottom < obox[3] and obox[2] < top:
                problems.append(f"{b[0]} at {b[1]},{b[2]} is inside {other[0]} at {other[1]},{other[2]}")
        # What it stands on must reach both sides of its middle, or it tips at once.
        if b[0] != "Ledge" and bottom > 0:
            under = [o for o in boxes if o is not box and o[3] == bottom and o[0] < right and left < o[1]]
            middle = (left + right) / 2
            if not (any(o[0] <= middle for o in under) and any(o[1] >= middle for o in under)):
                problems.append(f"{b[0]} at {b[1]},{b[2]} has nothing holding it up")
    return problems
