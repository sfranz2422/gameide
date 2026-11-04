# script: battle
# The sums of a fight. The objects act it out: BattleDirector runs the turns,
# HeroFighter and FoeFighter stand there and get hit.
import math
import random


def hit_for(power, guard):
    """Attack against defence, with a little luck. Always at least 1, so nobody's stuck."""
    return max(1, round((power - guard * 0.5) * random.uniform(0.9, 1.1)))


def start_battle(foes, x, y, tag=None, run=True, then=None):
    """Off to the battle room. then names a function in the story script for after a win."""
    S["battle"] = {"foes": foes, "tag": tag, "run": run, "then": then, "room": S["room"]}
    S["at"] = [x, y]
    S["safe"] = 90
    room_goto("Battle")


def step_along(distance, direction):
    """How far across and down, going this far in a direction (degrees, 90 is up)."""
    a = math.radians(direction)
    return distance * math.cos(a), -distance * math.sin(a)
