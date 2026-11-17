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
#   homes       [{"kind", "gx", "gy", "animals": [None, or when it was fed]}]     (phase 2)
#   mills       [{"kind", "gx", "gy", "queue": [{"item", "end"}]}]               (phase 2)
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
         "fields": [{"gx": gx, "gy": gy, "crop": None, "t": 0} for gx, gy in START_FIELDS],
         "homes": [], "mills": []}
    fill_orders(f)
    return f


def load_farm():
    """The saved farm, brought up to date: a farm saved before a phase added something
    gets it empty (a phase-1 farm has no animal homes or factories yet)."""
    f = save_get("farm", None)
    if f is None:
        return new_farm()
    f.setdefault("homes", [])
    f.setdefault("mills", [])
    return f


def item_info(k):
    """A crop's or a made good's name, sell price and XP."""
    return CROPS[k] if k in CROPS else GOODS[k]


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
    """What a level opens, in words, for the level-up note: crops, animal homes, factories."""
    return [c["name"] for c in list(CROPS.values()) + list(HOMES.values()) + list(FACTORIES.values()) if c["level"] == level]


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
    f["coins"] += item_info(item)["sell"] * n
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
    for b in f["homes"] + f["mills"]:
        used.update(footprint_tiles(b["kind"], b["gx"], b["gy"]))
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


# ---- building: animal homes and factories, one of each, where the player puts them

def building_info(kind):
    return HOMES[kind] if kind in HOMES else FACTORIES[kind]


def owned(f, kind):
    return any(b["kind"] == kind for b in f["homes"] + f["mills"])


def can_place_area(f, kind, gx, gy):
    """Every tile a building would cover is on the map and free."""
    used = taken(f)
    return all(on_map(*t) and t not in used for t in footprint_tiles(kind, gx, gy))


def build(f, kind, gx, gy):
    """'built', or why not: 'level', 'owned' (one of each), 'coins', 'taken'."""
    info = building_info(kind)
    if f["level"] < info["level"]:
        return "level"
    if owned(f, kind):
        return "owned"
    if f["coins"] < info["cost"]:
        return "coins"
    if not can_place_area(f, kind, gx, gy):
        return "taken"
    f["coins"] -= info["cost"]
    if kind in HOMES:
        f["homes"].append({"kind": kind, "gx": gx, "gy": gy, "animals": [None] * ANIMALS_EACH})
    else:
        f["mills"].append({"kind": kind, "gx": gx, "gy": gy, "queue": []})
    return "built"


def home_of(f, gx, gy):
    return next((b for b in f["homes"] if (gx, gy) in footprint_tiles(b["kind"], b["gx"], b["gy"])), None)


def mill_of(f, gx, gy):
    return next((b for b in f["mills"] if (gx, gy) in footprint_tiles(b["kind"], b["gx"], b["gy"])), None)


# ---- animals

def animal_state(home, i):
    """'hungry', 'eating' (making its good) or 'ready'."""
    t = home["animals"][i]
    if t is None:
        return "hungry"
    return "ready" if now() >= t + HOMES[home["kind"]]["time"] else "eating"


def animal_left(home, i):
    t = home["animals"][i]
    return 0 if t is None else max(0, t + HOMES[home["kind"]]["time"] - now())


def feed_home(f, home):
    """Feeds every hungry animal there's feed for in the barn. How many were fed."""
    feed = HOMES[home["kind"]]["feed"]
    fed = 0
    for i in range(len(home["animals"])):
        if animal_state(home, i) == "hungry" and f["barn"].get(feed, 0) > 0:
            f["barn"][feed] -= 1
            if not f["barn"][feed]:
                del f["barn"][feed]
            home["animals"][i] = now()
            fed += 1
    return fed


def collect_home(f, home):
    """Collects what every ready animal made, while the barn has room: they're hungry
    again. How many, and the levels they brought."""
    makes = HOMES[home["kind"]]["makes"]
    got, gained = 0, []
    for i in range(len(home["animals"])):
        if animal_state(home, i) == "ready" and barn_free(f) > 0:
            f["barn"][makes] = f["barn"].get(makes, 0) + 1
            home["animals"][i] = None
            got += 1
            gained += add_xp(f, GOODS[makes]["xp"])
    return got, gained


# ---- factories

def mill_done(m):
    """How many at the front of the queue are finished."""
    n = 0
    for job in m["queue"]:
        if now() < job["end"]:
            break
        n += 1
    return n


def make_in(f, m, item):
    """Starts making something: 'queued', or why not: 'full' (the queue), 'short' (the
    barn hasn't what it needs). It starts when the one before it finishes."""
    recipe = FACTORIES[m["kind"]]["makes"][item]
    if len(m["queue"]) >= FACTORY_QUEUE:
        return "full"
    if any(f["barn"].get(k, 0) < n for k, n in recipe["needs"].items()):
        return "short"
    for k, n in recipe["needs"].items():
        f["barn"][k] -= n
        if not f["barn"][k]:
            del f["barn"][k]
    start = max([now()] + [job["end"] for job in m["queue"]])
    m["queue"].append({"item": item, "end": start + recipe["time"]})
    return "queued"


def collect_mill(f, m):
    """Takes what's finished into the barn, front first, while it has room. How many,
    and the levels they brought."""
    got, gained = 0, []
    while m["queue"] and now() >= m["queue"][0]["end"] and barn_free(f) > 0:
        item = m["queue"].pop(0)["item"]
        f["barn"][item] = f["barn"].get(item, 0) + 1
        got += 1
        gained += add_xp(f, GOODS[item]["xp"])
    return got, gained


# ---- orders

def order_slots(f):
    return min(ORDER_SLOTS_MOST, ORDER_SLOTS + (f["level"] - 1) // ORDER_SLOT_LEVELS)


def orderable(f):
    """What an order may want: crops that can be grown now, and goods the farm can make
    (from an animal home or a factory it has)."""
    out = list(crops_open(f))
    for b in f["homes"]:
        out.append(HOMES[b["kind"]]["makes"])
    for b in f["mills"]:
        out += [k for k in FACTORIES[b["kind"]]["makes"] if not k.endswith("_feed")]
    return out


def make_order(f):
    """The next order: a few of what can be grown or made now, more as the farm grows,
    paying ORDER_PAY times what it would sell for (and XP for what it took)."""
    rng = random.Random(f["seed"] * 7919 + f["made"])
    f["made"] += 1
    can = orderable(f)
    kinds = rng.sample(can, rng.randint(1, min(3, len(can))))
    want = {k: (rng.randint(2, min(10, 2 + f["level"])) if k in CROPS else rng.randint(1, ORDER_GOODS_MOST)) for k in kinds}
    worth = sum(item_info(k)["sell"] * n for k, n in want.items())
    grew = sum((CROPS[k]["xp"] * math.ceil(n / CROPS[k]["yield"])) if k in CROPS else GOODS[k]["xp"] * n for k, n in want.items())
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
