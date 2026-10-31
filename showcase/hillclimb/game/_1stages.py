# script: stages
# The stages, as plain data: change a number here and the road changes.
# The ground is built from a list of pieces, one after another, in metres
# (10 pixels to a metre):
#
#   ("flat", length)                     level road
#   ("hills", length, height, every)     rolling hills, `height` metres tall, one every `every` metres
#   ("climb", length, rise)              a long slope up (or down, if `rise` is less than 0)
#   ("ramp", length, height)             a slope up to a sharp edge: you fly off it
#   ("dip", length, depth)               a valley
#   ("bumps", length, size)              rocks to bounce over, about `size` metres high
#   ("bridge", length)                   a wooden bridge over a gap: flat, and drawn over a ravine
#
# On top of that, every stage has a little "rough" ground made from random
# numbers (its `seed`), so no two stages ride alike. The stage ends where
# its pieces end, at the finish flag.
#
# gravity is pixels a step, each step (the moon's is a third of Earth's);
# grip is how well tyres hold (sand slips); fuel cans come every
# `fuel_every` metres, a little further apart each time, and coins in rows
# of five every `coins_every` metres.
import math
import random

METRE = 10           # pixels to a metre
STEP = 20            # the ground is a height every STEP pixels
BASE = 3000          # the y of the ground at the start (the room is 6000 tall)
START_X = 200        # where the car starts

STAGES = [
    {"name": "Countryside", "price": 0, "gravity": 0.22, "grip": 1.0, "seed": 4, "rough": 0.8,
     "fuel_every": 250, "coins_every": 45, "coin_value": 5,
     "look": {"grass": "#5cbf3a", "grass_top": "#8ee05a", "dirt": "#9a6a3e", "deep": "#7a5030"},
     "pieces": [
         ("flat", 40),
         ("hills", 200, 5, 50),
         ("ramp", 18, 5),
         ("flat", 30),
         ("hills", 160, 9, 80),
         ("bridge", 40),
         ("climb", 120, 22),
         ("bumps", 60, 0.8),
         ("hills", 150, 7, 60),
         ("climb", 100, -18),
         ("ramp", 20, 6),
         ("flat", 20),
         ("hills", 200, 10, 100),
         ("bridge", 50),
         ("dip", 90, 9),
         ("climb", 90, 18),
         ("hills", 120, 5, 60),
         ("flat", 40),
     ]},
    {"name": "Desert", "price": 600, "gravity": 0.22, "grip": 0.85, "seed": 11, "rough": 0.9,
     "fuel_every": 380, "coins_every": 50, "coin_value": 10,
     "look": {"grass": "#e8c472", "grass_top": "#f6dc98", "dirt": "#d9a95a", "deep": "#c08a44"},
     "pieces": [
         ("flat", 40),
         ("hills", 240, 10, 100),
         ("ramp", 20, 6),
         ("flat", 25),
         ("dip", 90, 12),
         ("hills", 200, 12, 110),
         ("climb", 170, 30),
         ("bridge", 60),
         ("bumps", 80, 1.0),
         ("climb", 120, -26),
         ("hills", 220, 11, 110),
         ("ramp", 22, 8),
         ("flat", 25),
         ("hills", 200, 10, 100),
         ("climb", 100, 20),
         ("flat", 40),
     ]},
    {"name": "Moon", "price": 1500, "gravity": 0.075, "grip": 0.9, "seed": 23, "rough": 1.0,
     "fuel_every": 540, "coins_every": 55, "coin_value": 20,
     "look": {"grass": "#b8bcc8", "grass_top": "#dfe2ea", "dirt": "#8d92a0", "deep": "#6e7383"},
     "pieces": [
         ("flat", 40),
         ("dip", 50, 6),
         ("hills", 200, 12, 100),
         ("ramp", 24, 8),
         ("flat", 40),
         ("dip", 60, 10),
         ("bumps", 80, 1.5),
         ("climb", 150, 35),
         ("ramp", 26, 10),
         ("flat", 40),
         ("hills", 260, 20, 130),
         ("dip", 80, 14),
         ("climb", 120, -30),
         ("ramp", 26, 10),
         ("flat", 50),
         ("hills", 200, 15, 100),
         ("flat", 40),
     ]},
]


def smoothstep(t):
    return t * t * (3 - 2 * t)


def build_ground(stage):
    """
    The stage's road, worked out from its pieces. Gives back a dict:
      heights: the ground's y every STEP pixels, from x = 0
      bridges: (x1, x2) of every bridge
      finish:  the x of the finish flag
    """
    rnd = random.Random(stage["seed"])
    level = 0.0                          # metres above the start
    heights, rough, bridges = [], [], []
    for piece in stage["pieces"]:
        kind, length = piece[0], piece[1]
        n = max(1, round(length * METRE / STEP))
        x0 = len(heights) * STEP
        start = level
        for k in range(n):
            t = (k + 1) / n
            m = t * length               # metres into the piece
            if kind == "flat" or kind == "bridge":
                h = start
            elif kind == "hills":
                height, every = piece[2], piece[3]
                waves = max(1, round(length / every))
                h = start + height * (1 - math.cos(2 * math.pi * waves * t)) / 2
            elif kind == "climb":
                h = start + piece[2] * smoothstep(t)
            elif kind == "ramp":
                h = start + piece[2] * t if k < n - 1 else start   # the last point drops off the edge
            elif kind == "dip":
                h = start - piece[2] * (1 - math.cos(2 * math.pi * t)) / 2
            elif kind == "bumps":
                h = start + (piece[2] * rnd.uniform(0.4, 1.0) if k % 3 == 1 else 0)
            else:
                raise ValueError(f"No such piece of road: {kind!r}")
            heights.append(h)
            # Rough ground everywhere but bridges and ramps, whose edges must stay
            # sharp, and the first 30 metres: a car on a slope at the start rolls
            # away before you've touched anything.
            rough.append(0 if kind in ("bridge", "ramp") or len(heights) * STEP < 30 * METRE else 1)
        if kind in ("climb",):
            level = start + piece[2]
        else:
            level = start
        if kind == "bridge":
            bridges.append((x0, len(heights) * STEP))
    finish = len(heights) * STEP + START_X
    # Some flat road after the finish, to stop on.
    heights.extend([level] * 60)
    rough.extend([0] * 60)

    # The rough ground: random heights every 16 m, eased between, faded out
    # near bridges and ramps (so they don't start with a step in the road).
    knots = [rnd.uniform(-1, 1) * stage["rough"] for _ in range(len(heights) // 8 + 3)]
    soft = rough[:]
    for _ in range(4):
        soft = [min(soft[max(0, i - 1)], soft[i], soft[min(len(soft) - 1, i + 1)]) * 0.5 + soft[i] * 0.5
                for i in range(len(soft))]
    out = []
    lead = [0.0] * (START_X // STEP)     # the start, before the first piece
    for i, h in enumerate(lead + heights):
        j = i - len(lead)
        noise = 0
        if j >= 0:
            a, f = divmod(j, 8)
            t = (1 - math.cos(math.pi * f / 8)) / 2
            noise = (knots[a] * (1 - t) + knots[a + 1] * t) * soft[j]
        out.append(BASE - (h + noise) * METRE)
    shift = len(lead) * STEP
    return {"heights": out, "bridges": [(a + shift, b + shift) for a, b in bridges], "finish": finish}


def ground_y(road, x):
    """The height of the road (its y) under x."""
    hs = road["heights"]
    i = int(x // STEP)
    if i < 0:
        return hs[0]
    if i >= len(hs) - 1:
        return hs[-1]
    t = (x - i * STEP) / STEP
    return hs[i] + (hs[i + 1] - hs[i]) * t


def place_things(stage, road):
    """Where the coins, fuel cans and distance signs go, from the stage's numbers."""
    coins, fuel, signs = [], [], []
    m = stage["coins_every"]
    while START_X + m * METRE < road["finish"]:
        for k in range(5):
            x = START_X + (m + k * 3) * METRE
            coins.append([x, ground_y(road, x) - 32, True])     # [x, y, still there]
        m += stage["coins_every"]
    m, gap = stage["fuel_every"], stage["fuel_every"]
    while START_X + m * METRE < road["finish"]:
        x = START_X + m * METRE
        fuel.append([x, ground_y(road, x) - 22, True])
        gap *= 1.1                        # each can a little further on than the last
        m += gap
    for m in range(100, int((road["finish"] - START_X) / METRE) + 1, 100):
        signs.append(m)
    return coins, fuel, signs
