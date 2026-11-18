# script: train
# Phase 4, the train's rules. From TRAIN_LEVEL it waits at the station with a few
# wagons, each wanting something from the barn and bringing a tool or a material in
# return (into the kit, as it's loaded). Every wagon loaded, or sent off early, it's
# away TRAIN_AWAY seconds on the real clock and comes back with new wagons.
#
# In the farm dict: train = {"wagons": [{"want": {item: n}, "prize", "xp", "loaded"}],
#   "back" (when it's next at the station), "left" (when it last left), "trips"}
import random


def train_open(f):
    return f["level"] >= TRAIN_LEVEL


def train_here(f):
    return train_open(f) and now() >= f["train"]["back"]


def make_wagons(f):
    """The next train's wagons: one thing each the farm can grow or make, a few of it."""
    tr = f["train"]
    rng = random.Random(f["seed"] * 7727 + tr["trips"])
    can = orderable(f)
    wagons = []
    for _ in range(TRAIN_WAGONS):
        item = rng.choice(can)
        n = rng.randint(4, 8) if item in CROPS else rng.randint(2, 3)
        wagons.append({"want": {item: n}, "prize": pick_weighted(rng, TRAIN_PRIZES), "xp": TRAIN_XP * n, "loaded": False})
    return wagons


def fill_train(f):
    """Once a second: a train at the station with no wagons gets them. True if it did."""
    if train_here(f) and not f["train"]["wagons"]:
        f["train"]["wagons"] = make_wagons(f)
        return True
    return False


def load_wagon(f, i):
    """Loads wagon i from the barn: 'loaded' (its prize into the kit, and XP), or why not:
    'away', 'done' (already), 'short'. The last wagon loaded sends the train off. The
    levels it brought."""
    if not train_here(f):
        return "away", []
    w = f["train"]["wagons"][i]
    if w["loaded"]:
        return "done", []
    if not can_deliver(f, w):
        return "short", []
    for k, n in w["want"].items():
        f["barn"][k] -= n
        if not f["barn"][k]:
            del f["barn"][k]
    w["loaded"] = True
    f["kit"][w["prize"]] = f["kit"].get(w["prize"], 0) + 1
    gained = add_xp(f, w["xp"])
    tally(f, "wagons")
    if all(x["loaded"] for x in f["train"]["wagons"]):
        send_train(f)
    return "loaded", gained


def send_train(f):
    """Off it goes, with what's loaded; back after TRAIN_AWAY with new wagons."""
    tr = f["train"]
    tr["left"] = now()
    tr["back"] = now() + TRAIN_AWAY
    tr["wagons"] = []
    tr["trips"] += 1


def train_left(f):
    """Seconds until the train is back (0 while it's here)."""
    return max(0, f["train"]["back"] - now())


def train_engine(f):
    """Where the engine is along the railway (a tile's gx, fractions too), or None when
    it's away out of sight: it rolls out speeding up, and backs in slowing down."""
    if not train_open(f):
        return None
    tr = f["train"]
    t = now()
    if t >= tr["back"]:
        return TRAIN_PARK
    if t - tr["left"] < TRAIN_ROLL:
        return TRAIN_PARK + ((t - tr["left"]) / TRAIN_ROLL) ** 2 * 10
    if tr["back"] - t < TRAIN_ROLL:
        return TRAIN_PARK + ((tr["back"] - t) / TRAIN_ROLL) ** 2 * 10
    return None
