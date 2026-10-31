# script: flight
# A batted ball's whole flight, worked out the moment it's hit: up, down,
# bounces, the roll and the wall. Then who catches or fields it, and what
# that makes the play: a home run, an out, or a hit worth one to three bases.
# The field view only plays back what's decided here.
import math

STEP = FLIGHT_SPEED / 60          # seconds of the ball's flight shown each step


def fence_at(angle):
    """How far away the fence is at `angle` degrees from centre field."""
    k = min(1, abs(angle) / 45)
    return FENCE_CENTRE - (FENCE_CENTRE - FENCE_LINE) * k ** 1.6


def fly(hit):
    """The ball's path: one (x, y, z) a step, until it stops or leaves the
    park. Also says the step it first touched the ground ("landed", None if
    it never did), whether it went over the fence ("homer"), and how far it
    carried before it came down ("feet"; for a home run, where it would have)."""
    v = hit["mph"] * 5280 / 3600
    up, way = math.radians(hit["launch"]), math.radians(hit["spray"])
    vx, vy, vz = v * math.cos(up) * math.sin(way), v * math.cos(up) * math.cos(way), v * math.sin(up)
    x, y, z = 0.0, 1.0, 3.0
    path, landed, homer, carry = [], None, False, None
    for i in range(60 * 15):
        rolling = landed is not None and z <= 0 and vz == 0
        if rolling:
            speed = math.hypot(vx, vy)
            if speed < 1:
                break
            keep = max(0, speed - GROUND_FRICTION * STEP) / speed
            vx, vy = vx * keep, vy * keep
        else:
            speed = math.sqrt(vx * vx + vy * vy + vz * vz)
            vx -= DRAG * speed * vx * STEP
            vy -= DRAG * speed * vy * STEP
            vz -= (GRAVITY + DRAG * speed * vz) * STEP
        x, y, z = x + vx * STEP, y + vy * STEP, z + vz * STEP
        if z <= 0 and not rolling:
            z = 0
            # The first landing takes the most out of it; later little bounces
            # hardly slow it (when every bounce took as much, no grounder ever
            # got through the infield).
            keep = ROLL if landed is None else 0.95
            if landed is None:
                landed = i
            vz = -vz * BOUNCE if -vz * BOUNCE > 4 else 0      # a little bounce, then it rolls
            vx, vy = vx * keep, vy * keep
        far, angle = math.hypot(x, y), math.degrees(math.atan2(x, y))
        if abs(angle) <= FOUL_ANGLE and far >= fence_at(angle) and y > 0:
            if z > FENCE_HIGH and landed is None:
                homer = True
                path.append((x, y, z))
                # On into the seats: shown for a moment, and followed (unseen)
                # to where it would have come down, which is how far it went.
                while z > 0:
                    speed = math.sqrt(vx * vx + vy * vy + vz * vz)
                    vx -= DRAG * speed * vx * STEP
                    vy -= DRAG * speed * vy * STEP
                    vz -= (GRAVITY + DRAG * speed * vz) * STEP
                    x, y, z = x + vx * STEP, y + vy * STEP, z + vz * STEP
                    if len(path) < i + 30:
                        path.append((x, y, max(0, z)))
                carry = math.hypot(x, y)
                break
            # Off the wall: it drops, and comes back towards the infield, slowly.
            k = fence_at(angle) / far
            x, y = x * k * 0.995, y * k * 0.995
            vx, vy, vz = -vx * 0.25, -vy * 0.25, min(vz, 0)
            if landed is None:
                landed = i
        path.append((x, y, z))
    if carry is None:
        x, y, z = path[landed if landed is not None else -1]
        carry = math.hypot(x, y)
    return {"path": path, "landed": landed, "homer": homer, "feet": round(carry)}


def time_to(f, x, y):
    """Seconds fielder f takes to reach (x, y), from where he stands."""
    name, (fx, fy), speed = FIELDERS[f]
    return REACT + max(0, math.hypot(x - fx, y - fy) - REACH) / speed


def judge(hit, flight):
    """What the play is. Returns a dict: "result" is "foul", "homer", "out"
    or "hit"; "bases" (1 to 4) for a hit; "fielder" who made the play, and
    "step", the step of the path it's decided at; "words" to show."""
    path = flight["path"]
    feet = flight["feet"]
    if is_foul(hit):
        return {"result": "foul", "words": "Foul ball", "step": min(len(path) - 1, 40), "fielder": None, "feet": feet}
    if flight["homer"]:
        return {"result": "homer", "bases": 4, "words": f"HOME RUN!  {feet} ft", "step": len(path) - 1,
                "fielder": None, "feet": feet}
    for i, (x, y, z) in enumerate(path):
        t = (i + 1) * STEP
        if z > CATCH_HIGH:
            continue
        on_ground = flight["landed"] is not None and i >= flight["landed"]
        f = min(range(len(FIELDERS)), key=lambda k: time_to(k, x, y))
        if time_to(f, x, y) > t:
            continue
        who = FIELDERS[f][0]
        if not on_ground:
            kind = "Pop out" if hit["launch"] > 50 else "Line out" if hit["launch"] < 18 else "Fly out"
            return {"result": "out", "words": f"{kind} to {who}", "step": i, "fielder": f, "feet": feet}
        return fielded(f, i, t, x, y, feet)
    # Nobody got to it while it moved: whoever's nearest picks it up where it stopped.
    x, y, z = path[-1]
    f = min(range(len(FIELDERS)), key=lambda k: time_to(k, x, y))
    return fielded(f, len(path) - 1, max(len(path) * STEP, time_to(f, x, y)), x, y, feet)


def fielded(f, i, t, x, y, feet):
    """A ball on the ground, picked up by fielder f at (x, y), t seconds after
    the hit. In the infield he throws to first: if the throw beats the
    batter it's an out. In the outfield it's a hit, and the batter takes
    every base he can reach before the ball is thrown back in."""
    who = FIELDERS[f][0]
    batter_at_first = RUN_START + 90 / RUN
    if math.hypot(x, y) < INFIELD:
        throw_in = t + PICK_UP + math.hypot(x - BASES[1][0], y - BASES[1][1]) / THROW
        if throw_in < batter_at_first:
            return {"result": "out", "words": f"Ground out to {who}", "step": i, "fielder": f, "feet": feet}
        return {"result": "hit", "bases": 1, "words": "Infield single!", "step": i, "fielder": f, "feet": feet}
    back = t + PICK_UP + math.hypot(x - BASES[2][0], y - BASES[2][1]) / THROW
    bases = 1
    while bases < 3 and RUN_START + (bases + 1) * 90 / RUN <= back:
        bases += 1
    return {"result": "hit", "bases": bases, "words": ["Single!", "Double!", "Triple!"][bases - 1],
            "step": i, "fielder": f, "feet": feet}
