# script: kart
# What every kart shares: its numbers, and two questions Kart and
# ComputerKart ask. How a kart moves is in the Kart object's Step event; who
# presses its keys is in PlayerKart's and ComputerKart's Begin Step events.
# Angles are degrees, anticlockwise, 0 pointing right along the picture, as
# in draw_floor.
import math

STATS = {
    "top": 4.2,          # picture pixels a step, on the road, with no boost
    "accel": 0.045,
    "brake": 0.12,
    "coast": 0.012,      # slowing with nothing pressed
    "turn": 2.1,         # degrees a step at full lock
    "grass_top": 1.9,    # top speed on the grass
    "grass_drag": 0.13,
    "drift_turn": 2.4,   # a drift always turns this way...
    "drift_steer": 1.1,  # ...plus or minus this with the wheel
    "drift_min": 2.4,    # no drifting slower than this
    "boost_top": 5.6,
    "bump": 0.6,         # speed kept after hitting a hedge
}
SPARK_1, SPARK_2 = 45, 110        # steps of drifting to earn a small and a big boost
BOOST_1, BOOST_2 = 45, 90         # how many steps those boosts last
KART_R = 10                       # how close two karts get: their collision circles
LOST = 70                         # further than this past the hedge, a kart is put back on the road
UNSTICK = 2                       # pixels a step a kart inside a hedge is eased back towards the road
STUCK_STEPS = 45                  # a computer driver this long on the gas and barely moving is stuck...
BACK_OUT_STEPS = 40               # ...and backs out this long, steering the other way


def angle_diff(a, b):
    """The shortest turn from b to a, in degrees."""
    return (a - b + 180) % 360 - 180


def find_on_road(kart, line):
    """Where the kart is along the road. Only points near the last one are
    looked at, so two stretches of road never get mixed up, and a kart
    can't count a corner it didn't drive."""
    n = len(line)
    best, at = 1e18, kart.i
    for k in range(-14, 15):
        j = (kart.i + k) % n
        px, py = line[j]
        d = (kart.x - px) ** 2 + (kart.y - py) ** 2
        if d < best:
            best, at = d, j
    step = (at - kart.i + n // 2) % n - n // 2
    kart.progress += step
    kart.i = at
    # Measured to the line between the points, not to the nearest point:
    # otherwise the road's edge would be scalloped between points.
    ax, ay = line[at]
    bx, by = line[(at + 1) % n]
    tx, ty = (bx - ax) / STEP, (by - ay) / STEP
    kart.side = (kart.x - ax) * -ty + (kart.y - ay) * tx
    kart.off = abs(kart.side)


def computer_unstuck(kart, gas, steer):
    """A computer driver pressed against a hedge (the end of one, on the inside of a tight
    bend, can reach the grass) backs out and tries again, as a person would: with only
    the gas it pressed on there for the rest of the race. Answers (gas, brake, steer)."""
    if kart.backing > 0:
        kart.backing -= 1
        return False, True, -kart.back_steer
    moving_now = RACE["count"] == 0 and kart.spin == 0 and kart.done is None
    kart.stuck = kart.stuck + 1 if gas and moving_now and kart.v < 0.4 else 0
    if kart.stuck > STUCK_STEPS:
        kart.stuck = 0
        kart.backing = BACK_OUT_STEPS
        kart.back_steer = 1 if steer >= 0 else -1
    return gas, False, steer


def computer_keys(kart, skill):
    """What a computer driver presses: steer for a point ahead of it on the road
    (each keeps to its own lane, going round a kart in its way), and ease off
    for a sharp bend coming. Answers (gas, steer)."""
    line, track = RACE["line"], RACE["track"]
    n = len(line)
    ahead = 4 + int(kart.v * 1.6)
    tx, ty = line[(kart.i + ahead) % n]
    ux, uy = line[(kart.i + ahead + 1) % n]
    fx, fy = (ux - tx) / STEP, (uy - ty) / STEP
    lane = ((kart.who * 3) % 8 - 3.5) * track["half"] * 0.14
    # Without this a quicker kart sat behind a slower one all race, and every
    # driver finished within a second of the rest, whatever their skill.
    for o in RACE["karts"]:
        if o is not kart:
            ox, oy = o.x - kart.x, o.y - kart.y
            along = ox * fx + oy * fy
            if 0 < along < 54:
                across = ox * -fy + oy * fx
                if abs(across) < 22 and o.v <= kart.v + 0.2:
                    lane = kart.side + (-24 if across >= 0 else 24)
                    break
    lane = max(-track["half"] * 0.7, min(track["half"] * 0.7, lane))
    want = math.degrees(math.atan2(-(ty + fx * lane - kart.y), tx - fy * lane - kart.x))
    d = angle_diff(want, kart.a)
    steer = max(-1.0, min(1.0, -d / 22))
    # How much the road turns further on: a sharp bend means slowing down first.
    far = line[(kart.i + ahead + 10) % n]
    bend = abs(angle_diff(math.degrees(math.atan2(-(far[1] - ty), far[0] - tx)), want))
    gas = kart.v < STATS["top"] * kart.top_k * skill * (0.74 if bend > 42 else 1.0)
    return gas, steer
