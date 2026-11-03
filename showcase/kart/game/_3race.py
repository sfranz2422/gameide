# script: race
# One race's shared facts: who is racing, the track, the clock. Each kart is
# an instance (Kart counts its own laps); the Game object runs the clock.
import math

# top, accel and turn multiply the kart's numbers in STATS, so each racer drives
# differently; skill is how close to its top speed the computer drives them.
RACERS = [
    {"name": "Rosie", "paint": "#e8452e", "skill": 0.95, "top": 1.0, "accel": 1.0, "turn": 1.0},
    {"name": "Otto", "paint": "#2f7fe8", "skill": 0.97, "top": 1.04, "accel": 0.86, "turn": 0.94},
    {"name": "Juniper", "paint": "#35b84b", "skill": 0.95, "top": 0.98, "accel": 1.2, "turn": 1.0},
    {"name": "Mack", "paint": "#f2b81e", "skill": 0.93, "top": 1.03, "accel": 0.92, "turn": 0.9},
    {"name": "Wren", "paint": "#b04de0", "skill": 0.91, "top": 0.98, "accel": 1.0, "turn": 1.16},
    {"name": "Tully", "paint": "#f07a24", "skill": 0.89, "top": 1.02, "accel": 1.06, "turn": 0.92},
    {"name": "Pepper", "paint": "#ef5da8", "skill": 0.87, "top": 0.96, "accel": 1.24, "turn": 1.08},
    {"name": "Gus", "paint": "#30c4c0", "skill": 0.85, "top": 1.0, "accel": 0.94, "turn": 1.08},
]
POINTS = [10, 8, 6, 5, 4, 3, 2, 1]     # a cup's points, for 1st to 8th
COUNTDOWN = 180         # 3, 2, 1, each a second


RACE = {}


def start_race(track_i, player=None, rivals=True):
    """New karts on the grid, two by two behind the start line. `player` is the
    racer the keyboard drives (None: a race driving itself), at the back; the
    computer's drivers line up slowest in front. Without rivals, only the player."""
    for name in ("Kart", "OilSlick", "Bolt", "Ghost"):
        for old in instances(name):
            old.destroy()
    track = TRACKS[track_i]
    place_scenery(track_i)
    line = centre_line(track)
    n = len(line)
    ax, ay = line[0]
    bx, by = line[1]
    a = math.degrees(math.atan2(-(by - ay), bx - ax)) % 360
    RACE.clear()
    RACE.update(track=track, track_i=track_i, line=line, karts=[], steps=0, count=COUNTDOWN,
                lap_times=[], lap_began=0, wrong_way=0, rivals=rivals, path=[], final=None)
    others = sorted((w for w in range(len(RACERS)) if w != player), key=lambda w: RACERS[w]["skill"])
    grid = ([] if not rivals else others) + ([] if player is None else [player])
    for place, who in enumerate(grid):
        row, col = place // 2, place % 2
        i = (-2 - row * 3) % n
        px, py = line[i]
        qx, qy = line[(i + 1) % n]
        tx, ty = (qx - px) / STEP, (qy - py) / STEP
        off = -18 if col == 0 else 18
        kart = instance_create(px + -ty * off, py + tx * off, "PlayerKart" if who == player else "ComputerKart")
        racer = RACERS[who]
        kart.who = who
        kart.sprite = f"kart_{who}"
        kart.a = kart.move_a = a
        kart.i = i
        kart.progress = i - n         # below zero: it hasn't crossed the line yet
        kart.top_k, kart.accel_k, kart.turn_k = racer["top"], racer["accel"], racer["turn"]
        RACE["karts"].append(kart)
    # Whoever the view is about comes first: the player, or in a demo the back of the grid.
    RACE["karts"].sort(key=lambda c: c.who != player)
    place_karts()


def place_karts():
    """Who's where: finished karts by when they finished, then furthest along the road."""
    order = sorted(RACE["karts"], key=lambda c: (c.done is None, c.done or 0, -c.progress))
    for p, c in enumerate(order):
        c.place = p + 1


def race_over():
    return RACE["karts"][0].done is not None
