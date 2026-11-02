# script: race
# One race: the grid, the computer's drivers, laps, places and the finish.
# The player's kart is RACE["karts"][0].
import math

RACERS = [
    {"name": "Rosie", "paint": "#e8452e", "skill": None},
    {"name": "Otto", "paint": "#2f7fe8", "skill": 0.97},
    {"name": "Juniper", "paint": "#35b84b", "skill": 0.95},
    {"name": "Mack", "paint": "#f2b81e", "skill": 0.93},
    {"name": "Wren", "paint": "#b04de0", "skill": 0.91},
    {"name": "Tully", "paint": "#f07a24", "skill": 0.89},
    {"name": "Pepper", "paint": "#ef5da8", "skill": 0.87},
    {"name": "Gus", "paint": "#30c4c0", "skill": 0.85},
]
COUNTDOWN = 180         # 3, 2, 1, each a second


RACE = {}


def start_race(track_i, player=True):
    """Lines the karts up two by two behind the start line, the player last."""
    track = TRACKS[track_i]
    line = centre_line(track)
    n = len(line)
    ax, ay = line[0]
    bx, by = line[1]
    a = math.degrees(math.atan2(-(by - ay), bx - ax)) % 360
    karts = []
    for k, racer in reversed(list(enumerate(RACERS))):
        # Row by row back from the line: the player (0) is at the back.
        place = len(RACERS) - 1 - k
        row, col = place // 2, place % 2
        i = (-2 - row * 3) % n
        px, py = line[i]
        qx, qy = line[(i + 1) % n]
        tx, ty = (qx - px) / STEP, (qy - py) / STEP
        off = -18 if col == 0 else 18
        kart = Kart(px + -ty * off, py + tx * off, a, k)
        kart.i = i
        kart.progress = i - n         # below zero: it hasn't crossed the line yet
        karts.append(kart)
    karts.sort(key=lambda c: c.who)
    RACE.clear()
    RACE.update(track=track, track_i=track_i, line=line, karts=karts, steps=0, count=COUNTDOWN,
                player=player, order=[], lap_times=[], lap_began=0, over=False, wrong_way=0)
    place_karts()


def place_karts():
    order = sorted(RACE["karts"], key=lambda c: (c.done is None, c.done or 0, -c.progress))
    for p, c in enumerate(order):
        c.place = p + 1
    return order


def computer_keys(kart, line, track, skill, others=()):
    """What a computer driver presses: steer for a point ahead of it on the road
    (each keeps to its own lane, going round a kart in its way), and ease off
    for a sharp bend coming."""
    n = len(line)
    ahead = 4 + int(kart.v * 1.6)
    tx, ty = line[(kart.i + ahead) % n]
    ux, uy = line[(kart.i + ahead + 1) % n]
    fx, fy = (ux - tx) / STEP, (uy - ty) / STEP
    lane = ((kart.who * 3) % 8 - 3.5) * track["half"] * 0.14
    # Without this a quicker kart sat behind a slower one all race, and every
    # driver finished within a second of the rest, whatever their skill.
    for o in others:
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
    gas = kart.v < STATS["top"] * skill * (0.74 if bend > 42 else 1.0)
    return gas, steer


def race_step(gas, brake, steer, drift):
    """One step of the race, given the player's keys. Answers what happened to
    the player's kart, for sounds and sparks."""
    r = RACE
    happened = []
    if r["count"] > 0:
        r["count"] -= 1
        if r["count"] == 0:
            happened.append("go")
        elif r["count"] % 60 == 0:
            happened.append("beep")
        return happened
    r["steps"] += 1
    n = len(r["line"])
    laps = r["track"]["laps"]
    for kart in r["karts"]:
        before = kart.lap
        racer = RACERS[kart.who]
        if kart.done is not None:
            # Past the line: it drives on by itself, slowing down.
            g, st = computer_keys(kart, r["line"], r["track"], 0.55)
            drive(kart, g, False, st, False, r["track"], r["line"])
            continue
        if kart.who == 0 and r["player"]:
            what = drive(kart, gas, brake, steer, drift, r["track"], r["line"])
            happened += what
        else:
            skill = racer["skill"] or 0.95
            g, st = computer_keys(kart, r["line"], r["track"], skill, r["karts"])
            drive(kart, g, False, st, False, r["track"], r["line"])
        # A lap is every point of the road, in order: going back over the line
        # takes the lap off again, so backing and forth over it pays nothing.
        kart.lap = max(0, int(kart.progress // n) + 1)
        if kart.lap > before and kart.who == 0:
            if kart.lap > 1:
                r["lap_times"].append(r["steps"] - r["lap_began"])
                r["lap_began"] = r["steps"]
                if kart.lap <= laps:
                    happened.append("lap")
            else:
                r["lap_began"] = r["steps"]
        if kart.progress >= laps * n and kart.done is None:
            kart.done = r["steps"]
            r["order"].append(kart.who)
            if kart.who == 0:
                happened.append("finish")
    bump_karts(r["karts"])
    place_karts()
    you = r["karts"][0]
    # Facing back down the road for a while: say so, it's easy to get lost after a spin.
    if not r["player"]:
        pass
    else:
        ax, ay = r["line"][you.i]
        bx, by = r["line"][(you.i + 1) % n]
        road = math.degrees(math.atan2(-(by - ay), bx - ax))
        back = abs(angle_diff(you.a, road)) > 110 and you.v > 0.3
        r["wrong_way"] = r["wrong_way"] + 1 if back else 0
    if you.done is not None and not r["over"]:
        r["over"] = True
    return happened
