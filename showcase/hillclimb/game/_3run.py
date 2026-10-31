# script: run
# One run up a stage: the car, the coins and fuel on the road, the
# distance, bonuses for flips and air time, and how the run ends:
#   "head"    the driver's head touched the road
#   "fuel"    out of fuel, and the car has stopped (or is rolling back)
#   "finish"  past the finish flag
#   "quit"    Escape
import math

RUN = {}
FLIP_BONUS = 10        # coins for a flip, times the stage's coin value
AIR_BONUS = 1          # coins for each half second in the air after the first second, times the coin value
STALL_STEPS = 150      # out of fuel and not moving on for this long: the run is over
GHOST_EVERY = 3        # the ghost keeps where the car was every 3 steps
FINISH_BONUS = 20      # coins for reaching the finish flag, times the coin value


def start_run(stage_name, kind, levels):
    stage = stage_by_name(stage_name)
    road = build_ground(stage)
    coins, fuel, signs = place_things(stage, road)
    RUN.clear()
    RUN.update(stage=stage, road=road, coins=coins, fuel=fuel, signs=signs,
               car=Car(kind, levels, road, START_X), steps=0, got=0, end=None,
               stalled=0, furthest=0, words=[], flips=0, path=[], new_best=False,
               ghost=load_ghost(stage_name))


def stage_by_name(name):
    for s in STAGES:
        if s["name"] == name:
            return s
    return STAGES[0]


def metres(x):
    return max(0, int((x - START_X) / METRE))


def run_step(gas, brake):
    """One step of the run. Gives back what happened this step, as a list of
    words like "coin", "fuel", "flip", "air", "land", "crash", "finish", "fuel_out"."""
    car, road, stage = RUN["car"], RUN["road"], RUN["stage"]
    happened = []
    if RUN["end"]:
        # The car still tumbles after the end (or brakes, past the finish flag).
        car_step(car, False, RUN["end"] == "finish", stage, road)
        return happened
    RUN["steps"] += 1
    was_air = car.air
    had_fuel = car.fuel > 0
    car_step(car, gas, brake, stage, road)
    if had_fuel and car.fuel <= 0:
        happened.append("fuel_out")
    RUN["furthest"] = max(RUN["furthest"], metres(car.x))
    if RUN["steps"] % GHOST_EVERY == 0:
        RUN["path"].append([round(car.x, 1), round(car.y, 1), round(car.a, 3)])

    # Coins and fuel: picked up when they're inside the car's reach.
    for c in RUN["coins"]:
        if c[2] and abs(c[0] - car.x) < 40 and abs(c[1] - car.y) < 44:
            c[2] = False
            RUN["got"] += stage["coin_value"]
            happened.append("coin")
    for f in RUN["fuel"]:
        if f[2] and abs(f[0] - car.x) < 40 and abs(f[1] - car.y) < 50:
            f[2] = False
            car.fuel = car.stats["tank"]
            happened.append("fuel")

    # Landing: count the flips and the air time.
    if was_air > 0 and car.air == 0:
        if was_air > 20:
            happened.append("land")
        flips = int((abs(car.air_spin) + 0.6) / (2 * math.pi))
        if flips and not car.head_hit:
            RUN["flips"] += flips
            bonus = FLIP_BONUS * stage["coin_value"] * flips
            RUN["got"] += bonus
            RUN["words"].append([("Double flip!" if flips == 2 else "Flip!" if flips == 1 else f"{flips} flips!") + f" +{bonus}", 90])
            happened.append("flip")
        elif was_air >= 90:
            bonus = AIR_BONUS * stage["coin_value"] * ((was_air - 60) // 30)
            RUN["got"] += bonus
            RUN["words"].append([f"Air time! +{bonus}", 90])
            happened.append("air")
        car.air_spin = 0.0

    # How the run ends.
    if car.head_hit:
        RUN["end"] = "head"
        happened.append("crash")
    elif car.x >= road["finish"]:
        RUN["end"] = "finish"
        bonus = FINISH_BONUS * stage["coin_value"]
        RUN["got"] += bonus
        RUN["words"].append([f"Finish! +{bonus}", 120])
        happened.append("finish")
    elif car.fuel <= 0:
        RUN["stalled"] = RUN["stalled"] + 1 if car.speed() < 0.4 else 0
        if RUN["stalled"] > STALL_STEPS:
            RUN["end"] = "fuel"
    for w in RUN["words"]:
        w[1] -= 1
    RUN["words"] = [w for w in RUN["words"] if w[1] > 0]
    return happened


def end_words():
    return {"head": "Ouch! The driver hit the ground.", "fuel": "Out of fuel!",
            "finish": "You made it to the finish!", "quit": "You stopped."}.get(RUN["end"], "")
