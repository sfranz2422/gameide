# script: realm
# The rules of the kingdom, all in one place: building and upgrading (each a builder's
# job on the real clock), the mines and farms filling up and being collected into the
# keep, the treasuries and granaries, walls, trees and rocks, and renown. Objects on
# screen only draw and call these, so a click, a tap, the keys and the tests' bots all
# play by the same rules.
#
# The kingdom is one dict, global_vars.realm, kept whole in the save:
#   gold, food, xp, level (renown), seed
#   buildings  [{"kind", "gx", "gy", "level" (0 while first being built),
#                "job": None or {"to": level, "end": when, "paid": what it cost},
#                "t": when a mine or farm last started filling}]
#   obstacles  [[kind, gx, gy]]
#   grown      obstacles grown since the start, "grow_t" when the last one did
import math
import random
import time


def now():
    """Seconds on the real clock. The tests move it on (global_vars.time_shift)."""
    return time.time() + getattr(global_vars, "time_shift", 0)


def info(kind):
    return BUILDINGS[kind]


def levels(kind):
    """How many levels a kind has."""
    return len(info(kind)["cost"])


def stat(kind, name, level):
    """A building's number at a level (1 up): its damage at level 3, and so on."""
    return info(kind)[name][max(1, level) - 1]


# ---- a new kingdom, and an old one brought up to date

def new_realm(seed=None):
    r = {"gold": START_GOLD, "food": START_FOOD, "xp": 0, "level": 1, "map": MAP_W,
         "seed": seed if seed is not None else random.randrange(1 << 30),
         "buildings": [], "obstacles": [], "grown": 0, "grow_t": now()}
    for kind, gx, gy in START_BUILDINGS:
        r["buildings"].append(new_building(kind, gx, gy, 1))
    rng = random.Random(r["seed"] * 31 + OBSTACLE_SEED)
    kinds = list(OBSTACLES)
    tries = 0
    while len(r["obstacles"]) < START_OBSTACLES and tries < 2000:
        tries += 1
        gx, gy = rng.randrange(MAP_W), rng.randrange(MAP_H)
        if (gx, gy) not in taken(r):
            r["obstacles"].append([rng.choice(kinds), gx, gy])
    return load_army(r)


def new_building(kind, gx, gy, level=0):
    return {"kind": kind, "gx": gx, "gy": gy, "level": level, "job": None, "t": now()}


def load_realm():
    r = save_get("realm", None)
    if r is None:
        return new_realm()
    # A kingdom from a smaller map (40 × 40 before 2026-11-18): moved to the middle of this one.
    old = r.get("map", 40)
    if old != MAP_W:
        d = (MAP_W - old) // 2
        for b in r["buildings"]:
            b["gx"] += d
            b["gy"] += d
        for o in r["obstacles"]:
            o[1] += d
            o[2] += d
        r["map"] = MAP_W
    return load_army(r)


def keep_save(r):
    save_set("realm", r)


# ---- the keep, and what it allows

def keep_level(r):
    return next(b["level"] for b in r["buildings"] if b["kind"] == "keep")


def how_many(r, kind):
    return sum(1 for b in r["buildings"] if b["kind"] == kind)


def allowed(r, kind):
    """How many of a kind the keep allows now."""
    return info(kind)["count"][keep_level(r) - 1]


def top_level(r, kind):
    """The highest level of a kind the keep allows now."""
    k = keep_level(r)
    return max([0] + [i + 1 for i, need in enumerate(info(kind)["keep"]) if need <= k])


def keep_unlocks(r):
    """What the keep's next level allows that this one doesn't, in words."""
    k = keep_level(r)
    if k >= levels("keep"):
        return []
    out = []
    for kind, i in BUILDINGS.items():
        if kind in ("keep", "builder_hut"):
            continue
        more = i["count"][k] - i["count"][k - 1]
        if more > 0:
            out.append(f"{more} more {i['name'].lower()}{'s' if more > 1 and not i['name'].endswith('s') else ''}")
    return out


def builder_cost(r):
    """What the next builder's hut costs, or None if there are five."""
    n = how_many(r, "builder_hut")
    return BUILDER_COSTS[n] if n < len(BUILDER_COSTS) else None


# ---- builders

def builders(r):
    return how_many(r, "builder_hut")


def busy(r):
    return [b for b in r["buildings"] if b["job"] is not None]


def free_builders(r):
    return builders(r) - len(busy(r))


# ---- the map: what's where

def footprint(kind, gx, gy):
    n = info(kind)["size"]
    return [(gx + i, gy + j) for i in range(n) for j in range(n)]


def on_map(gx, gy):
    return 0 <= gx < MAP_W and 0 <= gy < MAP_H


def taken(r, skip=None):
    """Every tile with something on it. `skip`: a building being moved."""
    used = set()
    for b in r["buildings"]:
        if b is not skip:
            used.update(footprint(b["kind"], b["gx"], b["gy"]))
    used.update((o[1], o[2]) for o in r["obstacles"])
    return used


def fits(r, kind, gx, gy, skip=None):
    used = taken(r, skip)
    return all(on_map(*t) and t not in used for t in footprint(kind, gx, gy))


def building_at(r, gx, gy):
    return next((b for b in r["buildings"] if (gx, gy) in footprint(b["kind"], b["gx"], b["gy"])), None)


def obstacle_at(r, gx, gy):
    return next((o for o in r["obstacles"] if (o[1], o[2]) == (gx, gy)), None)


# ---- money: what's kept, and where

def capacity(r, res):
    """How much gold (or food) the kingdom can keep: the keep's share and its treasuries
    (or granaries). One being built for the first time holds nothing yet."""
    kind = "treasury" if res == "gold" else "granary"
    total = stat("keep", "store", keep_level(r))
    for b in r["buildings"]:
        if b["kind"] == kind and b["level"] > 0:
            total += stat(kind, "store", b["level"])
    return total


def add(r, res, n):
    """Puts n gold (or food) in, up to what can be kept. How much went in."""
    room = max(0, capacity(r, res) - r[res])
    put = max(0, min(n, room))
    r[res] += put
    return put


def can_pay(r, res, n):
    return r[res] >= n


# ---- mines and farms

def maker(b):
    return b["kind"] in ("gold_mine", "farm")


def makes(b):
    return "gold" if b["kind"] == "gold_mine" else "food"


def waiting(b):
    """What a mine or farm has made and not been collected: it fills at its rate, up to
    what it holds. Nothing while it's being built or upgraded."""
    if not maker(b) or b["level"] == 0 or b["job"] is not None:
        return 0
    rate, hold = stat(b["kind"], "rate", b["level"]), stat(b["kind"], "hold", b["level"])
    return int(min(hold, rate * max(0, now() - b["t"]) / 3600))


def collect(r, b):
    """Collects what a mine or farm has made, as much as there's room for (the rest
    waits there). How much was collected."""
    n = waiting(b)
    if n <= 0:
        return 0
    got = add(r, makes(b), n)
    # Whatever didn't fit stays: the clock is set as if the mine had just made that much
    # (moving it on by only what was taken refilled a full mine at once).
    b["t"] = now() - (n - got) / stat(b["kind"], "rate", b["level"]) * 3600
    return got


# ---- building and upgrading

def can_upgrade(r, b):
    """None if b can be upgraded now, or why not, in words."""
    kind = b["kind"]
    to = b["level"] + 1
    if kind == "builder_hut":
        return "A builder's hut doesn't upgrade."
    if b["job"] is not None:
        return "It's being built already."
    if to > levels(kind):
        return "It's as good as it gets!"
    need = info(kind)["keep"][to - 1]
    if need > keep_level(r):
        return f"Upgrade your keep to level {need} first."
    if kind != "wall" and free_builders(r) < 1:
        return "Every builder is busy."
    price = info(kind)["cost"][to - 1]
    if not can_pay(r, info(kind)["pays"], price):
        return f"That needs {price:,} {info(kind)['pays']}."
    return None


def start_job(r, b, to):
    """Pays for the next level and puts a builder on it (a wall's done at once). The levels its renown brought."""
    kind = b["kind"]
    price = info(kind)["cost"][to - 1]
    r[info(kind)["pays"]] -= price
    seconds = info(kind)["time"][to - 1]
    if maker(b):
        collect(r, b)
    if seconds <= 0:
        b["level"] = to
        return add_xp(r, build_xp(seconds))
    b["job"] = {"to": to, "end": now() + seconds, "paid": price}
    return []


def upgrade(r, b):
    """'started' (or 'done', for a wall), or why not in words. The levels it brought."""
    why = can_upgrade(r, b)
    if why:
        return why, []
    gained = start_job(r, b, b["level"] + 1)
    return ("done" if b["job"] is None else "started"), gained


def can_build(r, kind):
    """None if a new one of a kind can be bought now, or why not, in words."""
    if kind == "builder_hut":
        price = builder_cost(r)
        if price is None:
            return "You have every builder there is."
        return None if can_pay(r, "gold", price) else f"That needs {price:,} gold."
    if how_many(r, kind) >= allowed(r, kind):
        later = next((k + 1 for k, n in enumerate(info(kind)["count"]) if n > how_many(r, kind)), None)
        if later is None:
            return "You have all you can build."
        return f"Upgrade your keep to level {later} " + ("for another." if how_many(r, kind) else "first.")
    if info(kind)["keep"][0] > keep_level(r):
        return f"Upgrade your keep to level {info(kind)['keep'][0]} first."
    if kind != "wall" and free_builders(r) < 1:
        return "Every builder is busy."
    price = info(kind)["cost"][0]
    if not can_pay(r, info(kind)["pays"], price):
        return f"That needs {price:,} {info(kind)['pays']}."
    return None


def build(r, kind, gx, gy):
    """'built' (started, for a builder: done at once for walls and huts), 'taken', or
    why not in words. The levels it brought."""
    why = can_build(r, kind)
    if why:
        return why, []
    if not fits(r, kind, gx, gy):
        return "taken", []
    b = new_building(kind, gx, gy, 0)
    if kind == "builder_hut":
        # A hut is a builder at once: there's nobody to build it but itself.
        r["gold"] -= builder_cost(r)
        b["level"] = 1
        r["buildings"].append(b)
        return "built", []
    r["buildings"].append(b)
    return "built", start_job(r, b, 1)


def finish_jobs(r):
    """Every job whose time is up is finished: the building goes up a level, and its
    renown comes in. The levels it brought (a list)."""
    gained = []
    for b in r["buildings"]:
        job = b["job"]
        if job is not None and now() >= job["end"]:
            b["level"] = job["to"]
            b["job"] = None
            b["t"] = job["end"]
            gained += add_xp(r, build_xp(info(b["kind"])["time"][job["to"] - 1]))
    return gained


def time_left(b):
    return 0 if b["job"] is None else max(0, b["job"]["end"] - now())


def cancel(r, b):
    """Stops a job: half what it cost comes back, and a building that was new goes."""
    job = b["job"]
    if job is None:
        return False
    add(r, info(b["kind"])["pays"], int(job["paid"] * CANCEL_BACK))
    b["job"] = None
    if b["level"] == 0:
        r["buildings"].remove(b)
    return True


def move(r, b, gx, gy):
    if not fits(r, b["kind"], gx, gy, skip=b):
        return False
    b["gx"], b["gy"] = gx, gy
    return True


# ---- walls: many at once

def wall_upgrade_all(r, level):
    """Upgrades as many walls of a level as the gold allows, at once. How many."""
    n = 0
    for b in r["buildings"]:
        if b["kind"] == "wall" and b["level"] == level and can_upgrade(r, b) is None:
            upgrade(r, b)
            n += 1
    return n


# ---- trees and rocks

def clear(r, o):
    """Clears a tree or rock for its small price: 'cleared' and the levels its renown
    brought, or why not in words."""
    info_ = OBSTACLES[o[0]]
    if not can_pay(r, info_["pays"], info_["cost"]):
        return f"That needs {info_['cost']:,} {info_['pays']}.", []
    r[info_["pays"]] -= info_["cost"]
    r["obstacles"].remove(o)
    return "cleared", add_xp(r, info_["xp"])


def grow_obstacles(r):
    """Now and then (OBSTACLE_EVERY, real time) a tree or rock grows on a free tile, up
    to OBSTACLES_MOST. Which and where come from the seed, so a reload can't change it.
    How many grew."""
    n = 0
    while now() - r["grow_t"] >= OBSTACLE_EVERY:
        r["grow_t"] += OBSTACLE_EVERY
        if len(r["obstacles"]) >= OBSTACLES_MOST:
            continue
        rng = random.Random(r["seed"] * 7 + r["grown"])
        r["grown"] += 1
        used = taken(r)
        for _ in range(200):
            gx, gy = rng.randrange(MAP_W), rng.randrange(MAP_H)
            if (gx, gy) not in used:
                r["obstacles"].append([rng.choice(list(OBSTACLES)), gx, gy])
                n += 1
                break
    return n


# ---- renown

def build_xp(seconds):
    """Renown for building something: the square root of its seconds (at least 1)."""
    return max(1, int(math.sqrt(seconds)))


def xp_for(level):
    if level <= len(RENOWN_XP):
        return RENOWN_XP[level - 1]
    return RENOWN_XP[-1] + (level - len(RENOWN_XP)) * RENOWN_STEP


def add_xp(r, n):
    """Renown in; the levels it brought (a list). The board is the renown level."""
    r["xp"] += n
    gained = []
    while r["xp"] >= xp_for(r["level"] + 1):
        r["level"] += 1
        gained.append(r["level"])
    if gained:
        high_score(r["level"])
    return gained
