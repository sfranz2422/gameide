# script: race
# One race's shared facts: who is racing, the track, the clock. Each kart is
# an instance (Kart counts its own laps); the Game object runs the clock.
import math

RACERS = [
    {"name": "Rosie", "paint": "#e8452e", "skill": 0.95},
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
    """New karts on the grid, two by two behind the start line, racer 0 at the back."""
    for old in instances("Kart"):
        old.destroy()
    track = TRACKS[track_i]
    line = centre_line(track)
    n = len(line)
    ax, ay = line[0]
    bx, by = line[1]
    a = math.degrees(math.atan2(-(by - ay), bx - ax)) % 360
    RACE.clear()
    RACE.update(track=track, track_i=track_i, line=line, karts=[], steps=0, count=COUNTDOWN,
                lap_times=[], lap_began=0, wrong_way=0)
    for who in range(len(RACERS)):
        place = len(RACERS) - 1 - who
        row, col = place // 2, place % 2
        i = (-2 - row * 3) % n
        px, py = line[i]
        qx, qy = line[(i + 1) % n]
        tx, ty = (qx - px) / STEP, (qy - py) / STEP
        off = -18 if col == 0 else 18
        kart = instance_create(px + -ty * off, py + tx * off, "PlayerKart" if player and who == 0 else "ComputerKart")
        kart.who = who
        kart.sprite = f"kart_{who}"
        kart.a = kart.move_a = a
        kart.i = i
        kart.progress = i - n         # below zero: it hasn't crossed the line yet
        RACE["karts"].append(kart)
    place_karts()


def place_karts():
    """Who's where: finished karts by when they finished, then furthest along the road."""
    order = sorted(RACE["karts"], key=lambda c: (c.done is None, c.done or 0, -c.progress))
    for p, c in enumerate(order):
        c.place = p + 1


def race_over():
    return RACE["karts"][0].done is not None
