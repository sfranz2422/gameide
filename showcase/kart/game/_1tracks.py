# script: tracks
# The tracks, as numbers. The build paints each track's picture from these,
# and the game places its Hedge and Tree instances from them, so what you see
# is what you drive on: change a corner here and the road, the kerbs, the
# hedges and the map all move.
import math

STEP = 16              # the road's centre line is a point every this many picture pixels

# boxes: rows of item boxes, as how far round the lap (0 to 1).
# pads: boost pads painted on the road, as (how far round, how far across, -1 to 1).
# grip: how quickly a kart goes where it points; low is slippery.
TRACKS = [
    {
        "name": "Sunny Meadow",
        "size": 2048,      # the picture is this many pixels square
        "half": 44,        # the road is this far either side of its centre line
        "verge": 40,       # grass this wide beyond the road, then the hedge
        "laps": 3,
        "grip": 1.0,
        # The corners the centre line passes through, in driving order, closed into a loop.
        "points": [(300, 1000), (300, 620), (470, 330), (820, 270), (1090, 430), (1190, 700),
                   (1460, 620), (1650, 360), (1860, 560), (1800, 950), (1500, 1110), (1600, 1400),
                   (1800, 1560), (1650, 1800), (1240, 1760), (1020, 1500), (800, 1320), (640, 1540),
                   (440, 1640), (290, 1400)],
        "boxes": [0.14, 0.42, 0.68, 0.9],
        "pads": [(0.3, -0.3), (0.78, 0.3)],
        "look": {"grass": "#58b348", "grass2": "#4fa641", "road": "#6d6d78", "road2": "#666672",
                 "line": "#f4f4f4", "kerb1": "#e8452e", "kerb2": "#f4f4f4", "hedge": "#2f7a35",
                 "sky_top": "#3f9be8", "sky_low": "#c9ecff", "hill_far": "#78aabe", "hill_near": "#468c50",
                 "scene": None, "stars": False},
    },
    {
        "name": "Cactus Canyon",
        "size": 2048,
        "half": 42,
        "verge": 34,
        "laps": 3,
        "grip": 1.0,
        "points": [(1000, 1840), (560, 1800), (260, 1560), (300, 1180), (640, 1060), (820, 800),
                   (620, 520), (300, 420), (420, 190), (900, 200), (1240, 360), (1240, 720),
                   (1100, 1040), (1300, 1260), (1560, 1100), (1500, 720), (1560, 300), (1810, 230),
                   (1860, 760), (1840, 1300), (1700, 1680), (1380, 1830)],
        "boxes": [0.1, 0.36, 0.6, 0.84],
        "pads": [(0.24, 0.3), (0.52, -0.3), (0.76, 0.3)],
        "look": {"grass": "#e0b070", "grass2": "#d6a564", "road": "#8a6a55", "road2": "#82634f",
                 "line": "#f6e3b8", "kerb1": "#c8502a", "kerb2": "#f6e3b8", "hedge": "#a8622f",
                 "sky_top": "#f09a4a", "sky_low": "#ffe6a8", "hill_far": "#d68a58", "hill_near": "#b86a3c",
                 "scene": "desert", "stars": False},
    },
    {
        "name": "Frostbite Pass",
        "size": 2048,
        "half": 46,
        "verge": 36,
        "laps": 3,
        "grip": 0.55,      # ice: it slides
        "points": [(1020, 240), (1500, 230), (1830, 460), (1800, 860), (1440, 980), (1140, 800),
                   (860, 620), (560, 720), (560, 1040), (880, 1180), (1280, 1240), (1680, 1300),
                   (1820, 1620), (1500, 1830), (1060, 1800), (640, 1820), (280, 1620), (230, 1100),
                   (240, 620), (420, 300), (720, 230)],
        "boxes": [0.12, 0.4, 0.64, 0.88],
        "pads": [(0.5, 0.0), (0.74, -0.3)],
        "look": {"grass": "#dcecf6", "grass2": "#d0e4f2", "road": "#9fb6cc", "road2": "#97aec6",
                 "line": "#ffffff", "kerb1": "#3a78c8", "kerb2": "#ffffff", "hedge": "#a8c4dc",
                 "sky_top": "#7fb4e0", "sky_low": "#eef6fc", "hill_far": "#b6cce0", "hill_near": "#e4eff8",
                 "scene": "snow", "stars": False},
    },
    {
        "name": "Starlight Speedway",
        "size": 2048,
        "half": 40,
        "verge": 30,
        "laps": 3,
        "grip": 1.0,
        "points": [(240, 1040), (240, 520), (520, 240), (960, 240), (1180, 500), (940, 760),
                   (600, 800), (540, 1120), (800, 1300), (1140, 1120), (1320, 780), (1560, 460),
                   (1820, 560), (1830, 1040), (1600, 1360), (1760, 1640), (1520, 1840), (1100, 1640),
                   (760, 1660), (480, 1840), (260, 1560)],
        "boxes": [0.08, 0.34, 0.6, 0.82],
        "pads": [(0.18, 0.3), (0.44, -0.3), (0.7, 0.3), (0.93, -0.3)],
        "look": {"grass": "#23264e", "grass2": "#1e2144", "road": "#3a3a5c", "road2": "#343454",
                 "line": "#7ff0ff", "kerb1": "#ff4fc3", "kerb2": "#4fe8ff", "hedge": "#14162f",
                 "sky_top": "#090b24", "sky_low": "#2a2360", "hill_far": "#1c1a48", "hill_near": "#121233",
                 "scene": "night", "stars": True},
    },
    {
        # Sand, sea and a boardwalk: wide and friendly.
        "name": "Boardwalk Beach",
        "size": 2048,
        "half": 46,
        "verge": 40,
        "laps": 3,
        "grip": 1.0,
        "points": [(1090, 270), (530, 120), (120, 300), (780, 940), (580, 1260), (540, 1760),
                   (910, 1910), (1370, 1930), (1770, 1750), (1720, 1100), (1790, 890), (1930, 570),
                   (1590, 390), (1400, 240)],
        "boxes": [0.12, 0.38, 0.62, 0.86],
        "pads": [(0.26, -0.3), (0.72, 0.3)],
        "look": {"grass": "#f0d9a0", "grass2": "#e8cf92", "road": "#a5774a", "road2": "#9c6f44", "line": "#fff4d6",
                 "kerb1": "#ff6b5b", "kerb2": "#ffffff", "hedge": "#3a9fd8", "sky_top": "#4fb6f0",
                 "sky_low": "#d8f4ff", "hill_far": "#8fd0e8", "hill_near": "#e8cf92", "scene": "beach",
                 "stars": False},
    },
    {
        # Old stone roads under the vines, a little loose underfoot.
        "name": "Jungle Ruins",
        "size": 2048,
        "half": 42,
        "verge": 36,
        "laps": 3,
        "grip": 0.95,      # a little loose
        "points": [(1270, 1580), (1700, 1670), (1860, 1500), (1640, 1170), (1940, 740), (1800, 360),
                   (1520, 110), (1130, 680), (550, 170), (330, 400), (280, 870), (110, 1100),
                   (130, 1650), (290, 1940), (820, 1770), (1120, 1710)],
        "boxes": [0.1, 0.35, 0.6, 0.84],
        "pads": [(0.2, 0.3), (0.48, -0.3), (0.77, 0.0)],
        "look": {"grass": "#3f8f3a", "grass2": "#38823a", "road": "#8c8a72", "road2": "#84826b", "line": "#e8e2c0",
                 "kerb1": "#c9a227", "kerb2": "#4a6b2a", "hedge": "#1f5a26", "sky_top": "#58a86a",
                 "sky_low": "#d6efc8", "hill_far": "#3f7f55", "hill_near": "#2b6a35", "scene": "jungle",
                 "stars": False},
    },
    {
        # A spooky forest at night.
        "name": "Hollow Woods",
        "size": 2048,
        "half": 40,
        "verge": 32,
        "laps": 3,
        "grip": 1.0,
        "points": [(1950, 510), (1720, 270), (1330, 170), (960, 490), (500, 100), (270, 400),
                   (460, 980), (230, 1280), (100, 1610), (390, 1850), (770, 1670), (960, 1850),
                   (1170, 1870), (1460, 1950), (1580, 1670), (1870, 1260)],
        "boxes": [0.08, 0.33, 0.58, 0.83],
        "pads": [(0.16, 0.3), (0.45, -0.3), (0.7, 0.3)],
        "look": {"grass": "#2e3b2c", "grass2": "#283426", "road": "#4a4458", "road2": "#443f52", "line": "#c9b6ff",
                 "kerb1": "#ff8a2a", "kerb2": "#2a2238", "hedge": "#1a1426", "sky_top": "#120d24",
                 "sky_low": "#4a2f5e", "hill_far": "#2a1f40", "hill_near": "#1a1530", "scene": "haunted",
                 "stars": True},
    },
    {
        # City blocks at night: square corners, one after another.
        "name": "Neon City",
        "size": 2048,
        "half": 40,
        "verge": 30,
        "laps": 3,
        "grip": 1.0,
        "points": [(850, 510), (510, 510), (160, 510), (160, 850), (160, 1200), (160, 1540),
                   (510, 1540), (850, 1540), (850, 1200), (850, 850), (1200, 850), (1200, 1200),
                   (1200, 1540), (1540, 1540), (1890, 1540), (1890, 1200), (1890, 850), (1890, 510),
                   (1540, 510), (1200, 510)],
        "boxes": [0.1, 0.36, 0.6, 0.85],
        "pads": [(0.22, 0.3), (0.5, -0.3), (0.74, 0.3), (0.94, -0.3)],
        "look": {"grass": "#3a3f4a", "grass2": "#353a44", "road": "#24252e", "road2": "#212229", "line": "#ffe14f",
                 "kerb1": "#ff3fa4", "kerb2": "#3ff0ff", "hedge": "#15161d", "sky_top": "#0b0d26",
                 "sky_low": "#5a2a6e", "hill_far": "#2a2e4e", "hill_near": "#1a1c30", "scene": "city", "stars": True},
    },
    {
        # Narrow rock roads over the lava, and loose ash: it slides.
        "name": "Lava Crater",
        "size": 2048,
        "half": 38,
        "verge": 30,
        "laps": 3,
        "grip": 0.8,      # it slides
        "points": [(540, 1740), (730, 1910), (1090, 1700), (1310, 1940), (1680, 1760), (1320, 1150),
                   (1600, 960), (1940, 710), (1600, 200), (1270, 240), (1060, 110), (700, 270),
                   (420, 180), (110, 600), (150, 1130), (170, 1580)],
        "boxes": [0.1, 0.34, 0.58, 0.82],
        "pads": [(0.2, 0.0), (0.46, 0.3), (0.7, -0.3)],
        "look": {"grass": "#3b2a2a", "grass2": "#34252a", "road": "#5a4a48", "road2": "#53443f", "line": "#ffb03a",
                 "kerb1": "#ff5a1f", "kerb2": "#2a1a18", "hedge": "#ff6a1a", "sky_top": "#3a0f0f",
                 "sky_low": "#ff7a3a", "hill_far": "#5a1f18", "hill_near": "#2e1612", "scene": "lava", "stars": False},
    },
    {
        # Chocolate roads round the funfair, twisting all the way.
        "name": "Candy Carnival",
        "size": 2048,
        "half": 40,
        "verge": 30,
        "laps": 3,
        "grip": 0.9,      # a little loose
        "points": [(510, 1620), (310, 1270), (480, 900), (100, 500), (380, 100), (940, 500),
                   (1170, 500), (1390, 120), (1740, 340), (1910, 600), (1690, 830), (1580, 1080),
                   (1950, 1660), (1510, 1950), (1130, 1850), (850, 1850)],
        "boxes": [0.12, 0.36, 0.6, 0.84],
        "pads": [(0.24, 0.3), (0.5, -0.3), (0.78, 0.3)],
        "look": {"grass": "#ffc7e3", "grass2": "#ffbedd", "road": "#7a4a32", "road2": "#734530", "line": "#ffffff",
                 "kerb1": "#ff4f7a", "kerb2": "#ffffff", "hedge": "#ff8fc8", "sky_top": "#ff9ad5",
                 "sky_low": "#fff0b8", "hill_far": "#ffb0dc", "hill_near": "#b8f0d8", "scene": "candy",
                 "stars": False},
    },
    {
        # A golden road on the clouds: the narrowest track of all.
        "name": "Cloud Kingdom",
        "size": 2048,
        "half": 36,
        "verge": 28,
        "laps": 3,
        "grip": 0.85,      # it slides
        "points": [(1810, 810), (1930, 1310), (1470, 1600), (1010, 1420), (630, 1930), (340, 1750),
                   (630, 1110), (310, 880), (120, 490), (480, 350), (840, 580), (1140, 120),
                   (1440, 250), (1720, 520)],
        "boxes": [0.1, 0.35, 0.6, 0.85],
        "pads": [(0.18, 0.3), (0.42, -0.3), (0.66, 0.3), (0.9, -0.3)],
        "look": {"grass": "#f4f8ff", "grass2": "#e8f0fc", "road": "#c9b46a", "road2": "#c2ad62", "line": "#ffffff",
                 "kerb1": "#ffd23f", "kerb2": "#7fb4ff", "hedge": "#9fd0ff", "sky_top": "#5aa8ff",
                 "sky_low": "#e8f6ff", "hill_far": "#d8ecff", "hill_near": "#ffffff", "scene": "cloud",
                 "stars": False},
    },
    {
        # The last race: the longest track, and four laps of it.
        "name": "Grand Circuit",
        "size": 2048,
        "half": 40,
        "verge": 30,
        "laps": 4,
        "grip": 1.0,
        "points": [(960, 1660), (620, 1950), (370, 1810), (160, 1550), (170, 1240), (440, 1040),
                   (100, 380), (410, 100), (950, 700), (1190, 800), (1560, 520), (1860, 680),
                   (1640, 1120), (1910, 1290), (1950, 1520), (1890, 1790), (1490, 1760), (1290, 1720)],
        "boxes": [0.08, 0.3, 0.52, 0.74, 0.92],
        "pads": [(0.16, 0.3), (0.4, -0.3), (0.64, 0.3), (0.86, -0.3)],
        "look": {"grass": "#4fa641", "grass2": "#469a3a", "road": "#5d5d66", "road2": "#57575f", "line": "#ffffff",
                 "kerb1": "#e8452e", "kerb2": "#ffffff", "hedge": "#2f6a35", "sky_top": "#2f7fd8",
                 "sky_low": "#f0e6c8", "hill_far": "#7a8aa0", "hill_near": "#3f7f45", "scene": None, "stars": False},
    },
]
ROOM_SIZE = 2048       # the one room is this big: every track must fit it

# The cups: four races each, in this order. A cup with "after" stays locked
# until every cup it names has been won (finished 1st, kept in the save).
CUPS = [
    {"name": "Zoomtown Cup", "tracks": [0, 1, 2, 3]},
    {"name": "Wild Cup", "tracks": [4, 5, 6, 7]},
    {"name": "Thunder Cup", "tracks": [8, 9, 10, 11], "after": [0, 1]},
]


def centre_line(track):
    """The loop through the track's corners (a Catmull-Rom curve), a point every STEP pixels."""
    pts = track["points"]
    n = len(pts)
    fine = []
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        for k in range(32):
            t = k / 32
            a, b, c = -t**3 + 2 * t**2 - t, 3 * t**3 - 5 * t**2 + 2, -3 * t**3 + 4 * t**2 + t
            d = t**3 - t**2
            fine.append(((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0]) / 2,
                         (a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]) / 2))
    # Evenly spaced, so a number of points is a distance, and a lap's progress is fair.
    out = [fine[0]]
    gone = 0.0
    for i in range(1, len(fine) + 1):
        ax, ay = fine[i - 1]
        bx, by = fine[i % len(fine)]
        seg = math.hypot(bx - ax, by - ay)
        while seg > 0 and gone + seg >= STEP:
            t = (STEP - gone) / seg
            ax, ay = ax + (bx - ax) * t, ay + (by - ay) * t
            out.append((ax, ay))
            seg = math.hypot(bx - ax, by - ay)
            gone = 0.0
        gone += seg
    if math.hypot(out[-1][0] - out[0][0], out[-1][1] - out[0][1]) < STEP / 2:
        out.pop()
    return out


def track_problems(track):
    """What's wrong with a track, in words. The build refuses a track with any."""
    problems = []
    line = centre_line(track)
    if track["size"] != ROOM_SIZE:
        problems.append(f"it is {track['size']} pixels across, but the room is {ROOM_SIZE}")
    wall = track["half"] + track["verge"]
    size = track["size"]
    for x, y in line:
        if min(x, y) < wall + 16 or max(x, y) > size - wall - 16:
            problems.append(f"the road comes within {wall + 16} pixels of the picture's edge near ({x:.0f}, {y:.0f})")
            break
    # Two stretches of road closer than this would share a hedge, and a kart
    # could cross from one to the other and skip part of the lap.
    n = len(line)
    apart = 2 * wall + 24
    skip = int(2 * apart / STEP)
    for i in range(0, n, 2):
        for j in range(i + skip, n, 2):
            if (i - j) % n < skip:
                continue
            if math.hypot(line[i][0] - line[j][0], line[i][1] - line[j][1]) < apart:
                problems.append(f"the road passes itself near ({line[i][0]:.0f}, {line[i][1]:.0f}): it needs {apart} pixels between stretches")
                return problems
    # A bend tighter than a kart can steer at full speed, even drifting.
    for i in range(n):
        ax, ay = line[i - 4]
        bx, by = line[i]
        cx, cy = line[(i + 4) % n]
        turn = abs((math.atan2(cy - by, cx - bx) - math.atan2(by - ay, bx - ax) + math.pi) % (2 * math.pi) - math.pi)
        if turn > 1.15:
            problems.append(f"the bend near ({bx:.0f}, {by:.0f}) is too sharp")
            break
    for what, where in (("box", track["boxes"]), ("pad", [p[0] for p in track["pads"]])):
        if any(not 0 < w < 1 for w in where):
            problems.append(f"a {what} isn't on the lap: it must be between 0 and 1 of the way round")
    return problems
