# script: cpu
# The computer, pitching and batting. It plays by the same rules as you: its
# pitches go through throw() and its swings through contact(), so all it
# chooses is what to throw and where, and when to swing. Make it better or
# worse with the numbers here.
import random

CPU_EYE = 1.0          # how badly it reads a pitch: times the pitch's "fool"
CPU_TIMING = 3.5       # steps its swing is off by, on a good day...
CPU_FOOLED = 8         # ...plus this many times the pitch's "fool"
CPU_AIM = 0.28         # feet its swing is off by, up or down
CPU_LIFT = -0.15       # feet under the ball it swings (less than 0 is over it: more grounders, fewer home runs)
CPU_CHASE = 0.45       # with two strikes, how often it throws one just off the plate


def cpu_pitch():
    """The computer's pitcher picks a pitch and a spot. Behind in the count
    (three balls) it throws one down the middle; with two strikes it often
    tries to make the batter chase one off the plate; otherwise it works
    the corners."""
    kind = random.choice([0, 0, 0, 1, 2, 3])
    if GAME["balls"] == 3:
        return kind, (random.uniform(-0.4, 0.4), random.uniform(2.0, 3.0))
    if GAME["strikes"] == 2 and random.random() < CPU_CHASE:
        if random.random() < 0.5:
            return kind, (random.choice([-1, 1]) * random.uniform(1.0, 1.3), random.uniform(1.8, 3.2))
        return kind, (random.uniform(-0.6, 0.6), random.uniform(1.0, 1.3))
    return kind, (random.uniform(-0.75, 0.75), random.uniform(1.7, 3.3))


def cpu_batter(pitch):
    """The moment a pitch leaves the hand, the computer's batter makes up
    its mind: where it thinks the ball will cross (a little wrong, more for
    a tricky pitch), whether that's a strike worth swinging at, and when.
    Returns {"swing": True/False, "press": the step to press swing, "aim": how high}."""
    fool = PITCHES[pitch["kind"]]["fool"]
    seen_x = pitch["x"] + random.gauss(0, fool * CPU_EYE)
    seen_z = pitch["z"] + random.gauss(0, fool * CPU_EYE)
    wider = 0.25 if GAME.get("strikes") == 2 else 0      # two strikes: protect the plate
    looks_good = abs(seen_x) <= PLATE_HALF + wider and ZONE_LOW - wider <= seen_z <= ZONE_HIGH + wider
    take = GAME.get("balls") == 3 and GAME.get("strikes", 0) < 2 and random.random() < 0.4
    swing = looks_good and not take and random.random() > 0.08
    late = round(random.gauss(0, CPU_TIMING + fool * CPU_FOOLED))
    aim = seen_z - CPU_LIFT + random.gauss(0, CPU_AIM)
    return {"swing": swing, "press": pitch["steps"] - SWING_STEPS + late, "aim": aim}
