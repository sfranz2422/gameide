# script: farm
# The rules of the farm, all in one place: planting and growing (on the real
# clock), harvesting into the barn, coins and XP and levels, buying fields, and
# the orders on the board. Objects on screen only draw and call these, so a
# click, a tap, a key and the bot in the tests all farm by the same rules.
#
# The farm is one dict, global_vars.farm, kept whole in the save:
#   coins, xp, level
#   fields      [{"gx", "gy", "crop" (or None), "t" (when planted, seconds)}]
#   barn        {item: how many}
#   orders      [{"want": {item: n}, "coins", "xp"} or {"wait": when it fills}]
#   made        orders made so far (with `seed`, picks the next one)
#   bought      fields bought so far (the next costs more)
import math
import random
import time


def now():
    """Seconds on the real clock. The tests move it on (global_vars.time_shift) to
    see a crop grow without waiting."""
    return time.time() + getattr(global_vars, "time_shift", 0)


def new_farm(seed=None):
    f = {"coins": START_COINS, "xp": 0, "level": 1, "barn": {}, "orders": [], "made": 0, "bought": 0,
         "seed": seed if seed is not None else random.randrange(1 << 30),
         "fields": [{"gx": gx, "gy": gy, "crop": None, "t": 0} for gx, gy in START_FIELDS]}
    fill_orders(f)
    return f


def load_farm():
    f = save_get("farm", None)
    return f if f is not None else new_farm()


def keep(f):
    save_set("farm", f)


# ---- levels

def xp_for(level):
    """XP needed to reach `level`."""
    if level <= len(LEVEL_XP):
        return LEVEL_XP[level - 1]
    return LEVEL_XP[-1] + (level - len(LEVEL_XP)) * LEVEL_STEP


def level_of(xp):
    level = 1
    while xp >= xp_for(level + 1):
        level += 1
    return level


def add_xp(f, n):
    """XP in, and any new levels: each one a present of coins. The levels gained (a list)."""
    f["xp"] += n
    gained = []
    while level_of(f["xp"]) > f["level"]:
        f["level"] += 1
        f["coins"] += LEVEL_COINS
        gained.append(f["level"])
    if gained:
        high_score(f["level"])
    return gained


def opened_at(level):
    """What a level opens, in words, for the level-up note."""
    return [c["name"] for c in CROPS.values() if c["level"] == level]


def crops_open(f):
    return [k for k, c in CROPS.items() if c["level"] <= f["level"]]


# ---- fields and crops

def field_at(f, gx, gy):
    return next((fl for fl in f["fields"] if fl["gx"] == gx and fl["gy"] == gy), None)


def stage(fl):
    """0 to STAGES - 1 while growing (the last is ready), or None for bare soil."""
    if fl["crop"] is None:
        return None
    done = (now() - fl["t"]) / CROPS[fl["crop"]]["grow"]
    return STAGES - 1 if done >= 1 else min(STAGES - 2, int(max(0, done) * (STAGES - 1)))


def ready(fl):
    return fl["crop"] is not None and stage(fl) == STAGES - 1


def time_left(fl):
    """Seconds until a growing crop is ready (0 when it is)."""
    if fl["crop"] is None:
        return 0
    return max(0, fl["t"] + CROPS[fl["crop"]]["grow"] - now())


def plant(f, fl, crop):
    """'planted', or why not: 'busy' (something's growing), 'locked', 'coins'."""
    if fl["crop"] is not None:
        return "busy"
    if crop not in crops_open(f):
        return "locked"
    if f["coins"] < CROPS[crop]["seed"]:
        return "coins"
    f["coins"] -= CROPS[crop]["seed"]
    fl["crop"], fl["t"] = crop, now()
    return "planted"


def harvest(f, fl):
    """'harvested' (into the barn, with XP), or why not: 'growing', 'empty', 'full'.
    The second value is the levels it brought (a list)."""
    if fl["crop"] is None:
        return "empty", []
    if not ready(fl):
        return "growing", []
    c = CROPS[fl["crop"]]
    if barn_free(f) < c["yield"]:
        return "full", []
    f["barn"][fl["crop"]] = f["barn"].get(fl["crop"], 0) + c["yield"]
    fl["crop"], fl["t"] = None, 0
    return "harvested", add_xp(f, c["xp"])


# ---- the barn

def barn_used(f):
    return sum(f["barn"].values())


def barn_free(f):
    return BARN_SPACE - barn_used(f)


def sell(f, item, n=1):
    """Sells up to n of something from the barn. How many were sold."""
    n = min(n, f["barn"].get(item, 0))
    if n <= 0:
        return 0
    f["barn"][item] -= n
    if not f["barn"][item]:
        del f["barn"][item]
    f["coins"] += CROPS[item]["sell"] * n
    return n


# ---- the map: what's where

def footprint_tiles(kind, gx, gy):
    n = FOOTPRINT[kind]
    return [(gx + i, gy + j) for i in range(n) for j in range(n)]


def taken(f):
    """Every tile with something on it: buildings, trees and rocks, the road, fields."""
    used = set(ROAD)
    for kind, gx, gy in START_FARM:
        used.update(footprint_tiles(kind, gx, gy))
    used.update((gx, gy) for _, gx, gy in DECOR)
    used.update((fl["gx"], fl["gy"]) for fl in f["fields"])
    return used


def on_map(gx, gy):
    return 0 <= gx < MAP_W and 0 <= gy < MAP_H


def can_place(f, gx, gy):
    return on_map(gx, gy) and (gx, gy) not in taken(f)


def most_fields(f):
    return len(START_FIELDS) + FIELDS_PER_LEVEL * f["level"]


def field_cost(f):
    return FIELD_COST + FIELD_COST_STEP * f["bought"]


def buy_field(f, gx, gy):
    """'bought', or why not: 'most' (as many as this level allows), 'coins', 'taken'."""
    if len(f["fields"]) >= most_fields(f):
        return "most"
    if f["coins"] < field_cost(f):
        return "coins"
    if not can_place(f, gx, gy):
        return "taken"
    f["coins"] -= field_cost(f)
    f["bought"] += 1
    f["fields"].append({"gx": gx, "gy": gy, "crop": None, "t": 0})
    return "bought"


# ---- orders

def order_slots(f):
    return min(ORDER_SLOTS_MOST, ORDER_SLOTS + (f["level"] - 1) // ORDER_SLOT_LEVELS)


def make_order(f):
    """The next order: a few of what can be grown now, more as the farm grows, paying
    ORDER_PAY times what it would sell for (and XP for what it took to grow)."""
    rng = random.Random(f["seed"] * 7919 + f["made"])
    f["made"] += 1
    kinds = rng.sample(crops_open(f), rng.randint(1, min(3, len(crops_open(f)))))
    want = {k: rng.randint(2, min(10, 2 + f["level"])) for k in kinds}
    worth = sum(CROPS[k]["sell"] * n for k, n in want.items())
    grew = sum(CROPS[k]["xp"] * math.ceil(n / CROPS[k]["yield"]) for k, n in want.items())
    return {"want": want, "coins": round(worth * ORDER_PAY) + ORDER_TIP, "xp": max(1, round(grew * ORDER_XP))}


def fill_orders(f):
    """Empty slots fill once their wait is over; the board grows with the level."""
    while len(f["orders"]) < order_slots(f):
        f["orders"].append({"wait": 0})
    for i, o in enumerate(f["orders"]):
        if "wait" in o and now() >= o["wait"]:
            f["orders"][i] = make_order(f)


def can_deliver(f, o):
    return "want" in o and all(f["barn"].get(k, 0) >= n for k, n in o["want"].items())


def deliver(f, i):
    """Fills order i from the barn: 'delivered' (coins and XP in) or 'short'. The levels it brought."""
    o = f["orders"][i]
    if not can_deliver(f, o):
        return "short", []
    for k, n in o["want"].items():
        f["barn"][k] -= n
        if not f["barn"][k]:
            del f["barn"][k]
    f["coins"] += o["coins"]
    f["orders"][i] = {"wait": now() + ORDER_WAIT}
    return "delivered", add_xp(f, o["xp"])


def discard(f, i):
    """Throws an order away; another comes after the wait."""
    if "want" in f["orders"][i]:
        f["orders"][i] = {"wait": now() + ORDER_WAIT}
