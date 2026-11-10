# script: rules
# Tabletop Siege's rules: a snowball war between two snow forts, across a frozen
# creek. The field, the towers, the eight cards, and the clock. Every number the
# game plays by is here, so balancing it is changing numbers in this one file.
import json
import math
import random

VIEW_W, VIEW_H = 640, 360

# ---- the field: snow either side of a frozen creek, a log bridge across it in each lane
TOP, BOTTOM = 20, 276          # the battlefield's top and bottom (the cards are below it)
MID = 320                      # the creek's middle
GAP = 14                       # half the creek's width: nothing on foot crosses it but by a bridge
LANES = [96, 200]              # the two lanes' heights
BRIDGE = 18                    # half a bridge's width
SIDE_COLOR = ["#3d7bff", "#ff4f4f"]   # blue (you, on the left), red (them)

# Things on the snow (picture, x, y, turned by degrees): out of the lanes.
FIELD_THINGS = [("pine_0", 30, 34, 0), ("pine_2", 22, 262, 0), ("sled", 250, 252, -10), ("mug", 258, 36, 0),
                ("pine_1", 610, 34, 0), ("pine_3", 616, 258, 0), ("cone", 392, 36, 20), ("carrot", 400, 258, 30)]

# ---- towers: a snow-brick fort tower at the head of each lane, an ice castle (the keep) behind them
TOWERS = [  # (kind, x, y) for the left side; the right side's are mirrored
    ("tower", 116, LANES[0]), ("tower", 116, LANES[1]), ("keep", 54, (LANES[0] + LANES[1]) / 2),
]
TOWER_STATS = {
    #        hp,  damage, range, steps between shots, radius
    "tower": (1400, 40, 88, 48, 18),    # short of the other lane
    "keep": (2400, 50, 126, 48, 24),
}

# ---- the cards: everyone has the same eight
CARDS = {
    # name: cost, words, and its kind: "unit" (marches), "building" (stays), "snowball", "ice"
    "kids": {"cost": 3, "name": "Snow Kids", "kind": "unit", "object": "SnowKid", "count": 3,
             "about": "Three cheap little fighters"},
    "snowman": {"cost": 4, "name": "Snowman", "kind": "unit", "object": "Snowman", "count": 1,
                "about": "Tough; slows as it melts"},
    "owl": {"cost": 3, "name": "Snowy Owl", "kind": "unit", "object": "Owl", "count": 1,
            "about": "Flies; attacks towers only"},
    "penguin": {"cost": 3, "name": "Penguin", "kind": "unit", "object": "Penguin", "count": 1,
                "about": "A slingshot: shoots from afar, even at owls"},
    "yeti": {"cost": 6, "name": "Yeti", "kind": "unit", "object": "Yeti", "count": 1,
             "about": "Huge and slow; goes for towers"},
    "wall": {"cost": 3, "name": "Snow Wall", "kind": "building", "object": "SnowWall", "count": 1,
             "about": "Draws attackers to it, then melts"},
    "snowball": {"cost": 2, "name": "Big Snowball", "kind": "snowball", "object": "Snowball", "count": 1,
                 "about": "Rolls down a lane, bowling things over"},
    "ice": {"cost": 2, "name": "Ice Patch", "kind": "ice", "object": "IcePatch", "count": 1,
            "about": "Slows the other side's troops"},
}
DECK = ["kids", "snowman", "owl", "penguin", "yeti", "wall", "snowball", "ice"]
HAND = 4

# What each troop is like. targets: "ground" (troops on foot and buildings),
# "all" (flyers too), "buildings" (towers and walls only).
UNITS = {
    #          hp,  damage, range, rate, pace (pixels a step), radius, flies, targets
    "SnowKid": (110, 22, 16, 48, 0.85, 6, False, "ground"),
    "Snowman": (760, 82, 18, 66, 0.62, 10, False, "ground"),
    "Owl": (200, 64, 18, 58, 1.35, 8, True, "buildings"),
    "Penguin": (170, 44, 60, 62, 0.7, 7, False, "all"),     # in a tower's reach when it shoots one
    "Yeti": (2000, 96, 20, 84, 0.34, 15, False, "buildings"),
}
SIGHT = 100                    # how near a troop notices something to fight
LANE_SIGHT = 52                # ...and only in its own lane: no further up or down than this
MELT = 1500                    # steps for a snowman to melt to half speed
WALL_HP, WALL_LIFE, WALL_R = 800, 40 * 60, 22
SNOWBALL_DAMAGE, SNOWBALL_TOWER, SNOWBALL_SPEED, SNOWBALL_R = 150, 80, 4.2, 11
ICE_R, ICE_LIFE, ICE_SLOW = 42, 5 * 60, 0.45
WIND_UP = 60                   # steps between dropping a card and its troops arriving

# ---- the clock and energy (snow to build with: it piles up)
MATCH_STEPS = 3 * 60 * 60
OVERTIME_STEPS = 60 * 60
ENERGY_MAX, ENERGY_START = 10, 5
ENERGY_STEPS = 168             # steps for one energy (half that in overtime)


def mirror_x(x, side):
    """A left-side x as `side` has it: the right side's field is the left's, mirrored."""
    return x if side == 0 else VIEW_W - x


def forward(side):
    """Which way `side`'s troops march: +1 to the right, -1 to the left."""
    return 1 if side == 0 else -1


def lane_of(y):
    return min(range(len(LANES)), key=lambda k: abs(LANES[k] - y))


def own_half(side, x):
    return x < MID - GAP if side == 0 else x > MID + GAP


def can_drop(side, card, x, y):
    """Where a card may be dropped: troops and walls on your own side of the creek; a snowball starts on your half; ice anywhere."""
    if not (TOP + 6 <= y <= BOTTOM - 6 and 8 <= x <= VIEW_W - 8):
        return False
    if CARDS[card]["kind"] == "ice":
        return True
    return own_half(side, x)


def on_the_gap(x, y):
    """In the creek and not on a bridge: where nothing on foot may stand."""
    return abs(x - MID) < GAP and all(abs(y - ly) > BRIDGE for ly in LANES)


def waypoint(x, y, tx, ty):
    """
    Where a troop on foot at (x, y) heads next to reach (tx, ty): straight there if
    it's on the same side; if the creek is between them, to the near end of the nearer
    lane's bridge, then over it.
    """
    if (x < MID) == (tx < MID):
        return tx, ty
    ly = LANES[lane_of(y)]
    if abs(x - MID) <= GAP + 5 and abs(y - ly) <= BRIDGE - 4:
        return MID + (GAP + 10) * (1 if tx > MID else -1), ly       # on the bridge: across
    return MID - (GAP + 4) if x < MID else MID + (GAP + 4), ly      # to the bridge's near end
