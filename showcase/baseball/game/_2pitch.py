# script: pitch
# A pitch from the hand to the plate, the strike zone, and what a swing does
# to it. Everything a pitch or a swing can do is decided here, from the
# numbers in rules, for people and the computer alike.
import math
import random


def steps_to_plate(kind):
    """How many steps a pitch of this kind takes from the hand to the plate."""
    feet_a_second = PITCHES[kind]["mph"] * 5280 / 3600
    return round(RELEASE[1] / feet_a_second / SLOW_MOTION * 60)


def throw(kind, target):
    """A pitch aimed at `target` (x, z at the plate). No pitcher hits his
    spot every time: it lands a little off, more for a pitch that's harder
    to control. Returns the pitch, which knows where it really crosses."""
    p = PITCHES[kind]
    x = target[0] + random.gauss(0, p["control"])
    z = target[1] + random.gauss(0, p["control"])
    return {"kind": kind, "x": x, "z": max(0.3, z), "steps": steps_to_plate(kind)}


def ball_at(pitch, s):
    """Where a pitch is when it's `s` of the way to the plate (0 in the hand,
    1 over the plate, more once it's past): (x, y, z) in feet.

    It's pulled sideways and down at a steady rate the whole way, like a
    real pitch's spin: it starts off heading for the target less its "move",
    and bends onto the target at the plate. So a curveball looks high, then
    drops in."""
    rx, ry, rz = RELEASE
    mx, mz = PITCHES[pitch["kind"]]["move"]
    x = rx + (pitch["x"] - mx - rx) * s + mx * s * s
    z = rz + (pitch["z"] - mz - rz) * s + mz * s * s
    return x, ry * (1 - s), max(0.15, z)


def is_strike(x, z):
    """Over the plate, between the knees and the letters."""
    return abs(x) <= PLATE_HALF and ZONE_LOW <= z <= ZONE_HIGH


def contact(x, z, aim, late):
    """A swing at a ball crossing the plate at (x, z). `aim` is how high the
    batter swung; `late` is how many steps late the bat came (negative:
    early). Returns None for a miss, or the hit: its speed off the bat
    (mph), how steeply it goes up (degrees) and which way (degrees: 0 is
    centre field, less is left field, more is right)."""
    dz = z - aim                    # above the bat: the bat gets under it, and lifts it
    if abs(late) > TIMING_WINDOW or abs(dz) > BAT_REACH or abs(x) > BAT_SIDE:
        return None
    # Near enough is nearly as good: only the edges of the bat and of the
    # timing window really take the speed off.
    timing = 1 - (late / (TIMING_WINDOW + 3)) ** 2
    square = 1 - (dz / BAT_REACH) ** 4
    mph = WORST_MPH + (BEST_MPH - WORST_MPH) * timing * square
    launch = LAUNCH + dz * LIFT + random.uniform(-2, 2)
    spray = late * SPRAY + x * INSIDE + random.uniform(-3, 3)
    return {"mph": mph, "launch": launch, "spray": spray}


def is_foul(hit):
    return abs(hit["spray"]) > FOUL_ANGLE
