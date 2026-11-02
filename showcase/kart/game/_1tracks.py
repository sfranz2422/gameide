# script: tracks
# The tracks, as numbers. The build paints each track's picture from these,
# and the game drives on them, so what you see is what you drive on: change
# a corner here and the road, the kerbs, the hedges and the map all move.
import math

STEP = 16              # the road's centre line is a point every this many picture pixels

TRACKS = [
    {
        "name": "Sunny Meadow",
        "size": 2048,      # the picture is this many pixels square
        "half": 44,        # the road is this far either side of its centre line
        "verge": 40,       # grass this wide beyond the road, then the hedge
        "laps": 3,
        # The corners the centre line passes through, in driving order, closed into a loop.
        "points": [(300, 1000), (300, 620), (470, 330), (820, 270), (1090, 430), (1190, 700),
                   (1460, 620), (1650, 360), (1860, 560), (1800, 950), (1500, 1110), (1600, 1400),
                   (1800, 1560), (1650, 1800), (1240, 1760), (1020, 1500), (800, 1320), (640, 1540),
                   (440, 1640), (290, 1400)],
        "look": {"grass": "#58b348", "grass2": "#4fa641", "road": "#6d6d78", "road2": "#666672",
                 "line": "#f4f4f4", "kerb1": "#e8452e", "kerb2": "#f4f4f4", "hedge": "#2f7a35",
                 "sky_top": "#3f9be8", "sky_low": "#c9ecff"},
    },
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
    return problems
