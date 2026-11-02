# script: kart
# A kart: how it speeds up, steers, drifts and boosts. Angles are degrees,
# anticlockwise, 0 pointing right along the picture, as in draw_floor.
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
KART_R = 10                       # how close two karts get


class Kart:
    def __init__(self, x, y, a, who):
        self.x, self.y, self.a = x, y, a
        self.who = who            # an index into RACERS
        self.v = 0.0
        self.move_a = a           # the way it's actually going; on a drift, not the way it points
        self.i = 0                # the nearest point of the centre line
        self.progress = 0.0       # points of centre line driven: backwards takes it down
        self.off = 0.0            # how far from the centre line
        self.side = 0.0           # the same, signed: left of the road is negative
        self.on_grass = False
        self.drift = 0            # -1 or 1 while drifting: the way it's turning
        self.charge = 0           # steps spent drifting
        self.boost = 0
        self.steer = 0.0          # how far the wheel is turned, for the picture
        self.hit = False          # hit a hedge this step
        self.lap = 0
        self.done = None          # the step it finished on
        self.place = 1


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
    # Measured to the road's edge line between the points, not to the nearest
    # point: otherwise the road's edge would be scalloped between points.
    ax, ay = line[at]
    bx, by = line[(at + 1) % n]
    tx, ty = (bx - ax) / STEP, (by - ay) / STEP
    kart.side = (kart.x - ax) * -ty + (kart.y - ay) * tx
    kart.off = abs(kart.side)
    return tx, ty


def drive(kart, gas, brake, steer, drift, track, line):
    """One step of one kart, whoever is driving it. steer is -1 (left) to 1
    (right). Answers what happened, for sounds and sparks."""
    happened = []
    s = STATS
    kart.steer += (steer - kart.steer) * 0.25
    top = s["grass_top"] if kart.on_grass else s["top"]

    if kart.boost > 0:
        kart.boost -= 1
        kart.v = min(s["boost_top"], kart.v + 0.15)
    elif gas:
        kart.v += s["accel"] * (1.15 - kart.v / s["top"]) * 2
    elif brake:
        kart.v -= s["brake"]
    else:
        kart.v -= s["coast"]
    if kart.v > top and kart.boost <= 0:
        kart.v -= s["grass_drag"] if kart.on_grass and kart.boost <= 0 else 0.05
        kart.v = max(kart.v, top) if not kart.on_grass else kart.v
    if brake and not gas and kart.v <= 0:
        kart.v = max(kart.v, -1.0)            # backing out of a hedge
    elif not brake:
        kart.v = max(kart.v, 0.0)

    # Drifting: start with the button while turning, fast enough. It then keeps
    # turning that way whatever the wheel says, the wheel only making it tighter
    # or wider, and letting go pays a boost for how long it lasted.
    if kart.drift == 0 and drift and abs(steer) > 0.1 and kart.v >= s["drift_min"] and not kart.on_grass:
        kart.drift = 1 if steer > 0 else -1
        kart.charge = 0
        happened.append("drift")
    if kart.drift:
        if not drift or kart.v < s["drift_min"] * 0.7:
            if drift is False and kart.charge >= SPARK_2:
                kart.boost = BOOST_2
                happened.append("boost")
            elif drift is False and kart.charge >= SPARK_1:
                kart.boost = BOOST_1
                happened.append("boost")
            kart.drift = 0
            kart.charge = 0
        else:
            kart.charge += 1
            kart.a -= kart.drift * (s["drift_turn"] + kart.drift * steer * s["drift_steer"])
            if kart.charge in (SPARK_1, SPARK_2):
                happened.append("spark")
    if not kart.drift and abs(kart.v) > 0.1:
        k = min(1.0, abs(kart.v) / 1.5)
        # Pressing right turns it clockwise, which is down the angles.
        kart.a -= steer * s["turn"] * k * (1 if kart.v > 0 else -1)
    kart.a %= 360

    # It goes the way it points, slowly on a drift: that's the slide.
    grip = 0.05 if kart.drift else 0.32
    kart.move_a = (kart.move_a + angle_diff(kart.a, kart.move_a) * grip) % 360
    r = math.radians(kart.move_a)
    kart.x += math.cos(r) * kart.v
    kart.y -= math.sin(r) * kart.v

    tx, ty = find_on_road(kart, line)
    kart.on_grass = kart.off > track["half"]
    wall = track["half"] + track["verge"]
    kart.hit = kart.off > wall
    if kart.hit:
        # Back to the hedge's line, along the road's sideways direction.
        back = kart.off - wall
        sign = 1 if kart.side > 0 else -1
        kart.x -= -ty * sign * back
        kart.y -= tx * sign * back
        kart.off = wall
        if kart.v > 1.5:
            happened.append("bump")
        kart.v *= s["bump"]
        kart.drift = 0
        kart.charge = 0
    return happened


def bump_karts(karts):
    """Two karts can't share a place: each is pushed half way out, and the one behind loses a little speed."""
    for i in range(len(karts)):
        a = karts[i]
        for j in range(i + 1, len(karts)):
            b = karts[j]
            dx, dy = b.x - a.x, b.y - a.y
            if abs(dx) > KART_R * 2 or abs(dy) > KART_R * 2:
                continue
            d = math.hypot(dx, dy)
            if 0.001 < d < KART_R * 2:
                push = (KART_R * 2 - d) / 2 / d
                a.x -= dx * push
                a.y -= dy * push
                b.x += dx * push
                b.y += dy * push
                behind = a if a.progress < b.progress else b
                behind.v *= 0.985
