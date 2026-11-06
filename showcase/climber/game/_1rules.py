# script: rules
# Snowcap Scramble's numbers, and the mountain itself.
#
# Every number the game plays by is here, so a change is made once: the
# generator below uses the jump's own numbers to make sure every ledge on the
# way up can be reached, and the tests read them too.
import bisect
import math
import random

VIEW_W, VIEW_H = 640, 360
ROOM_W = 3200              # five screens across: room to climb out of each other's sight
ROOM_H = 120000            # 5000 metres: as good as endless
GROUND_Y = ROOM_H - 40     # the snow at base camp
METER = 24                 # pixels to a metre
WALL_L, WALL_R = 56, ROOM_W - 56   # the cliff walls at either end

# The climber, in pixels and steps (60 a second).
GRAVITY = 0.42
MAX_FALL = 9.5
JUMP_V = -9.2              # about 100 pixels high, 4 metres
JUMP_CUT = -3.0            # letting go of jump early stops the rise here
RUN = 2.8
RUN_ACCEL = 0.35
ICE_ACCEL = 0.06           # on ice it takes a while to start, and to stop
SLIDY_ACCEL = 0.16         # a little slippery: cracked ledges and floating ice blocks
AIR_ACCEL = 0.22
COYOTE = 6                 # steps after running off a ledge when a jump still works
JUMP_BUFFER = 7            # steps before landing when a jump press still counts
HALF = 9                   # half the climber's width, for standing on an edge
THROW_EVERY = 20
SNOW_GRAVITY = 0.18
BIG_FALL = 12 * METER      # landing after a fall this long throws up snow

# The mountain.
SEED = 2026                # the same mountain for everyone, every time
ROUTES = 4                 # separate ways up, side by side, each one climbable
WIDTHS = (64, 96, 128, 160)
RISE_MIN = 50
CLEAR_Y = 90               # ledges that overlap across are at least this far apart up and down: room for a climber
CLEAR_X = 16               # ...unless there's at least this much gap between them across
CRUMBLE_W, PLANK_W, BLOCK_W = 72, 92, 50
CRUMBLE_STAND = 40         # steps standing on a cracking ledge before it breaks
CRUMBLE_BACK = 240         # steps until it's back
PLANK_SWING, PLANK_STEPS = 44, 220      # how far a plank swings each way, and how long a swing takes
BLOCK_BOB, BLOCK_STEPS = 14, 160
WIND_FROM = 150            # metres: the wind starts here
WIND_PUSH = 1.1            # pixels a full gust moves you each step in the air (running is 2.8)

# The bands of the mountain, by height in metres.
ZONES = [
    (0, "Base Camp"),
    (25, "Pine Slopes"),
    (75, "The Icefall"),
    (150, "Windy Ridge"),
    (300, "Aurora Heights"),
    (500, "The Endless Peaks"),
]


def zone_at(metres):
    name = ZONES[0][1]
    for start, z in ZONES:
        if metres >= start:
            name = z
    return name


def metres_at(y):
    return max(0, int((GROUND_Y - y) / METER))


def hardness(metres):
    """0 at the bottom, 1 from 300 metres up (Aurora Heights)."""
    return max(0.0, min(1.0, metres / 300))


def air_steps(rise):
    """How many steps a full jump takes to come back down to `rise` pixels above where it started, or None if it can't."""
    v, g = -JUMP_V, GRAVITY
    d = v * v - 2 * g * rise
    if d < 0:
        return None
    return (v + math.sqrt(d)) / g


def reach(rise):
    """How far across (edge to edge) a jump can get while rising `rise` pixels, with some to spare."""
    t = air_steps(rise)
    return 0 if t is None else t * RUN * 0.72


def can_reach(a, b):
    """
    Can a climber standing anywhere on ledge `a` jump onto ledge `b`? Moving ledges
    count at their worst: a plank swung as far as it goes, a block at its highest.
    """
    rise = a["y"] - b["y"] + (BLOCK_BOB if b["kind"] == "block" else 0) + (BLOCK_BOB if a["kind"] == "block" else 0)
    if rise < 0:
        return True          # it's below: just drop
    if air_steps(rise + 6) is None:
        return False
    swing = (PLANK_SWING if b["kind"] == "plank" else 0) + (PLANK_SWING if a["kind"] == "plank" else 0)
    gap = abs(a["x"] - b["x"]) - a["w"] / 2 - b["w"] / 2 - swing
    return gap <= reach(rise) - 2 * HALF


def _kind(rng, d):
    """What sort of ledge, higher up harder: rock, ice, crumble, plank, block."""
    weights = [
        ("rock", 1.0 - 0.7 * d),
        ("ice", 0.15 + 0.45 * d),
        ("crumble", 0.0 if d < 0.05 else 0.15 + 0.3 * d),
        ("plank", 0.0 if d < 0.2 else 0.12 + 0.25 * d),
        ("block", 0.0 if d < 0.45 else 0.22 * d),
    ]
    r = rng.random() * sum(w for _, w in weights)
    for kind, w in weights:
        r -= w
        if r <= 0:
            return kind
    return "rock"


def _width(rng, kind, d):
    if kind == "crumble":
        return CRUMBLE_W
    if kind == "plank":
        return PLANK_W
    if kind == "block":
        return BLOCK_W
    choices = [w for w in WIDTHS if w <= 160 - 100 * d] or [WIDTHS[0]]
    return rng.choice(choices)


class Plan:
    """
    The mountain as lists, made bottom to top from SEED as the climbers need it,
    so every climber on every computer gets the same one. `routes` are the ways
    up, ROUTES of them side by side, each ledge reachable from the one before it
    on its route; `path` is all of their ledges. `ledges` are those and the extra
    ones between, for other ways up and something to land on. `decor` stands on
    ledges. A route wanders, mostly within its own part of the mountain.
    """

    def __init__(self, seed=SEED):
        self.rng = random.Random(seed)
        self.path = []
        self.ledges = []      # every ledge, by its number "i"
        self.decor = []
        # (-y, number) in order, for finding what's near the camera quickly.
        self._ledge_order = []
        self._decor_order = []
        lane = (WALL_R - WALL_L) / ROUTES
        self.routes = [[] for _ in range(ROUTES)]
        self.lanes = [(WALL_L + k * lane, WALL_L + (k + 1) * lane) for k in range(ROUTES)]
        self.last = [{"kind": "rock", "x": round((a + b) / 2), "y": GROUND_Y, "w": 400} for a, b in self.lanes]
        self.top = GROUND_Y
        self.squeezed = 0     # ledges put where there wasn't really room (to keep a route going); the tests watch it

    def grow(self, until_y):
        """Makes the mountain up to height `until_y` (a smaller y is higher)."""
        while self.top > until_y and self.top > 300:
            # The route that's furthest behind goes next, so they rise together.
            k = max(range(ROUTES), key=lambda r: self.last[r]["y"])
            b = self._next(k)
            self.top = min(r["y"] for r in self.last)
            d = hardness(metres_at(b["y"]))
            self._extra(b, d)
            self._decorate(b)

    def _next(self, k):
        rng = self.rng
        a = self.last[k]
        d = hardness(metres_at(a["y"]))
        kind = _kind(rng, d)
        w = _width(rng, kind, d)
        rise = rng.uniform(RISE_MIN, RISE_MIN + 16 + 22 * d)
        # A route may stray a screen beyond its own part of the mountain, no further.
        left = max(WALL_L, self.lanes[k][0] - VIEW_W / 2)
        right = min(WALL_R, self.lanes[k][1] + VIEW_W / 2)
        b = None
        for _ in range(30):
            # Higher up, the gaps get longer: up to the whole of what a jump can do.
            gap = rng.uniform(CLEAR_X, max(CLEAR_X + 4, reach(rise) * (0.5 + 0.5 * d)))
            side = rng.choice((-1, 1))
            x = a["x"] + side * (a["w"] / 2 + gap + w / 2)
            if left + w / 2 + 6 <= x <= right - w / 2 - 6:
                b = {"kind": kind, "x": round(x), "y": round(a["y"] - rise), "w": w}
                if can_reach(a, b) and self.clear(b):
                    break
                b = None
        if b is None:
            # Nothing fitted: a plain small ledge just beside it, a short step up, on
            # whichever side has room (and, failing that, anyway: it always works).
            tries = [(side, r, far) for r in (RISE_MIN, RISE_MIN + 12, RISE_MIN + 24) for far in (0, 24, 48) for side in (1, -1)]
            for side, r, far in tries:
                x = min(max(a["x"] + side * (a["w"] / 2 + CLEAR_X + 32 + far), left + 40), right - 40)
                c = {"kind": "rock", "x": round(x), "y": round(a["y"] - r), "w": 64}
                if can_reach(a, c) and self.clear(c):
                    b = c
                    break
            if b is None:
                self.squeezed += 1
                b = {"kind": "rock", "x": round(min(max(a["x"], left + 40), right - 40)), "y": round(a["y"] - RISE_MIN), "w": 64}
        b["route"] = k
        self.path.append(b)
        self.routes[k].append(b)
        self._add(b)
        self.last[k] = b
        return b

    def clear(self, e):
        """Is there room for ledge `e`: nothing overlapping it across within CLEAR_Y up or down?"""
        i0 = bisect.bisect_left(self._ledge_order, (-(e["y"] + CLEAR_Y), -1))
        i1 = bisect.bisect_right(self._ledge_order, (-(e["y"] - CLEAR_Y), len(self.ledges)))
        for _, i in self._ledge_order[i0:i1]:
            o = self.ledges[i]
            swing = (PLANK_SWING if o["kind"] == "plank" else 0) + (PLANK_SWING if e["kind"] == "plank" else 0)
            if abs(o["x"] - e["x"]) - (o["w"] + e["w"]) / 2 - swing < CLEAR_X:
                return False
        return True

    def _add(self, e):
        e["i"] = len(self.ledges)
        self.ledges.append(e)
        bisect.insort(self._ledge_order, (-e["y"], e["i"]))

    def _extra(self, b, d):
        rng = self.rng
        if rng.random() > 0.45 - 0.3 * d:
            return
        w = rng.choice(WIDTHS[:3])
        # Somewhere on this screen's width either side of the route's ledge, clear of it.
        x = b["x"] + rng.choice((-1, 1)) * rng.uniform((w + b["w"]) / 2 + 30, VIEW_W * 0.6)
        if not WALL_L + w / 2 + 6 <= x <= WALL_R - w / 2 - 6:
            return
        kind = "ice" if rng.random() < 0.3 + 0.4 * d else "rock"
        e = {"kind": kind, "x": round(x), "y": round(b["y"] + rng.uniform(-16, 16)), "w": w}
        if self.clear(e):
            self._add(e)

    def _decorate(self, b):
        rng = self.rng
        if b["kind"] not in ("rock", "ice") or b["w"] < 96 or rng.random() > 0.35:
            return
        sprite = rng.choice(("pine_small", "pine_tall", "snowball_pile", "bird") if b["kind"] == "rock" else ("crystals", "crystals", "bird"))
        x = b["x"] + rng.choice((-1, 1)) * (b["w"] / 2 - 26)
        # Not under another ledge: a tree would stick up through it.
        for o in self.ledges_between(b["y"] - 100, b["y"] - 1, x - 200, x + 200):
            if abs(o["x"] - x) < o["w"] / 2 + 30:
                return
        d = {"sprite": sprite, "x": round(x), "y": b["y"], "i": len(self.decor)}
        self.decor.append(d)
        bisect.insort(self._decor_order, (-d["y"], d["i"]))

    @staticmethod
    def _between(things, order, high, low, left, right):
        i0 = bisect.bisect_left(order, (-low, -1))
        i1 = bisect.bisect_right(order, (-high, len(things)))
        return [things[i] for _, i in order[i0:i1] if left <= things[i]["x"] <= right]

    def ledges_between(self, high, low, left=0, right=ROOM_W):
        """The ledges with their tops between `high` and `low` (y: high is the smaller), and their middles between left and right."""
        return self._between(self.ledges, self._ledge_order, high, low, left, right)

    def decor_between(self, high, low, left=0, right=ROOM_W):
        return self._between(self.decor, self._decor_order, high, low, left, right)


def plan():
    """The mountain: one for the whole game, made as it's needed."""
    if not hasattr(global_vars, "plan"):
        global_vars.plan = Plan()
    return global_vars.plan
