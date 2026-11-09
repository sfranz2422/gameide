# script: rules
# Tabletop Siege's rules: the desk, the towers, the eight cards, and the clock.
# Every number the game plays by is here, so balancing it is changing numbers
# in this one file.
import math
import random

VIEW_W, VIEW_H = 640, 360

# ---- the desk: two desks pushed together, a gap down the middle, a ruler across each lane
TOP, BOTTOM = 20, 276          # the battlefield's top and bottom (the cards are below it)
MID = 320                      # the gap's middle
GAP = 14                       # half the gap's width: nothing on foot crosses it but by a ruler
LANES = [96, 200]              # the two lanes' heights
BRIDGE = 18                    # half a ruler's width
SIDE_COLOR = ["#3d7bff", "#ff4f4f"]   # blue (you, on the left), red (them)

# ---- towers: a pencil cup at the head of each lane, a lunchbox keep behind them
TOWERS = [  # (kind, x, y) for the left side; the right side's are mirrored
    ("tower", 116, LANES[0]), ("tower", 116, LANES[1]), ("keep", 54, (LANES[0] + LANES[1]) / 2),
]
TOWER_STATS = {
    #        hp,  damage, range, steps between shots, radius
    "tower": (1400, 40, 110, 48, 18),
    "keep": (2400, 50, 118, 48, 24),
}

# ---- the cards: everyone has the same eight
CARDS = {
    # name: cost, words, and its kind: "unit" (marches), "building" (stays), "marble", "glue"
    "soldiers": {"cost": 3, "name": "Toy Soldiers", "kind": "unit", "object": "Soldier", "count": 3,
                 "about": "Three cheap little fighters"},
    "knight": {"cost": 4, "name": "Wind-up Knight", "kind": "unit", "object": "Knight", "count": 1,
               "about": "Tough; slows as it unwinds"},
    "plane": {"cost": 3, "name": "Paper Plane", "kind": "unit", "object": "Plane", "count": 1,
              "about": "Flies; attacks towers only"},
    "archer": {"cost": 3, "name": "Band Archer", "kind": "unit", "object": "Archer", "count": 1,
               "about": "Shoots from afar, even at planes"},
    "golem": {"cost": 6, "name": "Eraser Golem", "kind": "unit", "object": "Golem", "count": 1,
              "about": "Huge and slow; goes for towers"},
    "wall": {"cost": 3, "name": "Block Wall", "kind": "building", "object": "Wall", "count": 1,
             "about": "Draws attackers to it"},
    "marble": {"cost": 2, "name": "Marble", "kind": "marble", "object": "Marble", "count": 1,
               "about": "Rolls down the desk, bowling things over"},
    "glue": {"cost": 2, "name": "Glue Puddle", "kind": "glue", "object": "Glue", "count": 1,
             "about": "Slows the other side's troops"},
}
DECK = ["soldiers", "knight", "plane", "archer", "golem", "wall", "marble", "glue"]
HAND = 4

# What each troop is like. targets: "ground" (troops on foot and buildings),
# "all" (flyers too), "buildings" (towers and walls only).
UNITS = {
    #          hp,  damage, range, rate, pace (pixels a step), radius, flies, targets
    "Soldier": (110, 22, 16, 48, 0.85, 6, False, "ground"),
    "Knight": (760, 82, 18, 66, 0.62, 10, False, "ground"),
    "Plane": (200, 64, 18, 58, 1.35, 8, True, "buildings"),
    "Archer": (170, 44, 92, 62, 0.7, 7, False, "all"),
    "Golem": (2000, 96, 20, 84, 0.34, 15, False, "buildings"),
}
SIGHT = 100                    # how near a troop notices something to fight
UNWIND = 1500                  # steps for a knight to slow to half speed
WALL_HP, WALL_LIFE = 800, 40 * 60
MARBLE_DAMAGE, MARBLE_TOWER, MARBLE_SPEED, MARBLE_R = 150, 80, 4.2, 11
GLUE_R, GLUE_LIFE, GLUE_SLOW = 42, 5 * 60, 0.45
WIND_UP = 60                   # steps between dropping a card and its troops arriving

# ---- the clock and energy ("wind-up", shown as a key)
MATCH_STEPS = 3 * 60 * 60
OVERTIME_STEPS = 60 * 60
ENERGY_MAX, ENERGY_START = 10, 5
ENERGY_STEPS = 168             # steps for one energy (half that in overtime)


def mirror_x(x, side):
    """A left-side x as `side` has it: the right side's desk is the left's, mirrored."""
    return x if side == 0 else VIEW_W - x


def forward(side):
    """Which way `side`'s troops march: +1 to the right, -1 to the left."""
    return 1 if side == 0 else -1


def lane_of(y):
    return min(range(len(LANES)), key=lambda k: abs(LANES[k] - y))


def own_half(side, x):
    return x < MID - GAP if side == 0 else x > MID + GAP


def can_drop(side, card, x, y):
    """Where a card may be dropped: troops and walls on your own half of the desk; a marble starts on your half; glue anywhere."""
    if not (TOP + 6 <= y <= BOTTOM - 6 and 8 <= x <= VIEW_W - 8):
        return False
    if CARDS[card]["kind"] == "glue":
        return True
    return own_half(side, x)


def on_the_gap(x, y):
    """In the gap between the desks and not on a ruler: where nothing on foot may stand."""
    return abs(x - MID) < GAP and all(abs(y - ly) > BRIDGE for ly in LANES)


def waypoint(x, y, tx, ty):
    """
    Where a troop on foot at (x, y) heads next to reach (tx, ty): straight there if
    it's on the same desk; if the gap is between them, to the near end of the nearer
    lane's ruler, then over it.
    """
    if (x < MID) == (tx < MID):
        return tx, ty
    ly = LANES[lane_of(y)]
    if abs(x - MID) <= GAP + 5 and abs(y - ly) <= BRIDGE - 4:
        return MID + (GAP + 10) * (1 if tx > MID else -1), ly       # on the ruler: across
    return MID - (GAP + 4) if x < MID else MID + (GAP + 4), ly      # to the ruler's near end
