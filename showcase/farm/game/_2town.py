# script: town
# Phase 3, the town's rules: houses and the people in them, the room community
# buildings make, rent on the real clock, roads, visitors at the farm stand, and
# moving what you've built. Like the farm script, nothing here draws: the objects
# call these, so a tap, the keys and the tests' bots all play by the same rules.
#
# In the farm dict (global_vars.farm):
#   town      [{"kind", "gx", "gy", "t" (houses: when rent started counting)}]
#   roads     [[gx, gy]]             the player's; ROAD (the farm's dirt road) is the rules'
#   visitors  [{"want": {item: n}, "coins", "xp", "who"} or {"wait": when one comes}]
#   met       visitors so far (with `seed`, picks the next)
import random


def town_info(kind):
    return HOUSES[kind] if kind in HOUSES else COMMUNITY[kind]


def houses(f):
    """(index in the town, house) for every house, in the order they were built."""
    return [(i, b) for i, b in enumerate(f["town"]) if b["kind"] in HOUSES]


def town_cost(f, kind):
    """A community building's price, or the next house of a kind: each dearer than the last."""
    if kind in COMMUNITY:
        return COMMUNITY[kind]["cost"]
    return HOUSES[kind]["cost"] + HOUSES[kind]["step"] * sum(1 for _, b in houses(f) if b["kind"] == kind)


def room_in_town(f):
    """How many people the town has room for: BASE_ROOM, and what each community building adds."""
    return BASE_ROOM + sum(COMMUNITY[b["kind"]]["room"] for b in f["town"] if b["kind"] in COMMUNITY)


def housing(f):
    """People all the houses would hold."""
    return sum(HOUSES[b["kind"]]["people"] for _, b in houses(f))


def lived_in(f):
    """The houses whose people have room, oldest first; a house that doesn't fit stands
    empty until the town grows (a whole house moves in, never part of one)."""
    room, out = room_in_town(f), set()
    for i, b in houses(f):
        if HOUSES[b["kind"]]["people"] <= room:
            room -= HOUSES[b["kind"]]["people"]
            out.add(i)
    return out


def population(f):
    homes = lived_in(f)
    return sum(HOUSES[b["kind"]]["people"] for i, b in houses(f) if i in homes)


def build_town(f, kind, gx, gy):
    """'built' and the levels its XP brought, or why not: 'level', 'owned' (a community
    building is one of each), 'coins', 'taken'."""
    info = town_info(kind)
    if f["level"] < info["level"]:
        return "level", []
    if kind in COMMUNITY and any(b["kind"] == kind for b in f["town"]):
        return "owned", []
    cost = town_cost(f, kind)
    if f["coins"] < cost:
        return "coins", []
    if not can_place_area(f, kind, gx, gy):
        return "taken", []
    f["coins"] -= cost
    f["town"].append({"kind": kind, "gx": gx, "gy": gy, "t": now()})
    return "built", add_xp(f, info["xp"])


def town_of(f, gx, gy):
    """The town building on a tile (its index), or None."""
    return next((i for i, b in enumerate(f["town"]) if (gx, gy) in footprint_tiles(b["kind"], b["gx"], b["gy"])), None)


# ---- rent

def town_tick(f):
    """Once a second: an empty house's rent clock waits, so rent only counts while
    people live there."""
    homes = lived_in(f)
    for i, b in houses(f):
        if i not in homes:
            b["t"] = now()


def rent_left(f, i):
    b = f["town"][i]
    return max(0, b["t"] + HOUSES[b["kind"]]["every"] - now())


def rent_ready(f, i):
    b = f["town"][i]
    return b["kind"] in HOUSES and i in lived_in(f) and rent_left(f, i) == 0


def collect_rent(f, i):
    """The rent, if it's ready: coins in, the clock starts again. (coins, levels gained)."""
    if not rent_ready(f, i):
        return 0, []
    b = f["town"][i]
    f["coins"] += HOUSES[b["kind"]]["rent"]
    b["t"] = now()
    return HOUSES[b["kind"]]["rent"], add_xp(f, RENT_XP)


# ---- roads

def all_roads(f):
    return set(ROAD) | {tuple(r) for r in f["roads"]}


def buy_road(f, gx, gy):
    """'built', or why not: 'level', 'coins', 'taken'."""
    if f["level"] < ROAD_LEVEL:
        return "level"
    if f["coins"] < ROAD_COST:
        return "coins"
    if not can_place(f, gx, gy):
        return "taken"
    f["coins"] -= ROAD_COST
    f["roads"].append([gx, gy])
    return "built"


def walkers(f):
    """How many townspeople are out walking."""
    return min(WALKERS_MOST, population(f) // WALKER_PEOPLE)


# ---- visitors at the farm stand

def visitor_slots(f):
    p = population(f)
    return 0 if p == 0 else min(VISITORS_MOST, 1 + p // VISITOR_PEOPLE)


def make_visitor(f):
    """The next visitor: wants a few of one thing the farm can grow or make, and pays
    VISITOR_PAY times what it sells for."""
    rng = random.Random(f["seed"] * 104729 + f["met"])
    f["met"] += 1
    item = rng.choice(orderable(f))
    n = rng.randint(2, 6) if item in CROPS else rng.randint(1, 2)
    return {"want": {item: n}, "coins": round(item_info(item)["sell"] * n * VISITOR_PAY) + ORDER_TIP,
            "xp": VISITOR_XP * n, "who": rng.randrange(len(PEOPLE))}


def fill_visitors(f):
    """New places at the stand open as the town grows; an empty one fills after its wait."""
    while len(f["visitors"]) < visitor_slots(f):
        f["visitors"].append({"wait": now() + VISITOR_WAIT})
    for i, v in enumerate(f["visitors"]):
        if "wait" in v and now() >= v["wait"]:
            f["visitors"][i] = make_visitor(f)


def serve(f, i):
    """Gives visitor i what they want from the barn: 'served' (coins and XP in) or 'short'."""
    v = f["visitors"][i]
    if not can_deliver(f, v):
        return "short", []
    for k, n in v["want"].items():
        f["barn"][k] -= n
        if not f["barn"][k]:
            del f["barn"][k]
    f["coins"] += v["coins"]
    f["visitors"][i] = {"wait": now() + VISITOR_WAIT}
    return "served", add_xp(f, v["xp"])


def send_away(f, i):
    if "want" in f["visitors"][i]:
        f["visitors"][i] = {"wait": now() + VISITOR_WAIT}


# ---- moving what you've built: ("fields" | "trees" | "homes" | "mills" | "town" | "roads", index)

def thing_at(f, gx, gy):
    """What on this tile can be moved, or None (the farmhouse, barn and the rest stay put)."""
    i = town_of(f, gx, gy)
    if i is not None:
        return ("town", i)
    for name in ("homes", "mills"):
        for i, b in enumerate(f[name]):
            # The dock and the mine came with their land and stay there.
            if b["kind"] not in SITES and (gx, gy) in footprint_tiles(b["kind"], b["gx"], b["gy"]):
                return (name, i)
    for name in ("fields", "trees"):
        for i, fl in enumerate(f[name]):
            if (fl["gx"], fl["gy"]) == (gx, gy):
                return (name, i)
    for i, r in enumerate(f["roads"]):
        if (r[0], r[1]) == (gx, gy):
            return ("roads", i)
    return None


def thing_kind(f, ref):
    """What a moved thing is drawn and measured as: a building's kind, "soil" or "path"."""
    name, i = ref
    if name == "fields":
        return "soil"
    if name == "roads":
        return "path"
    return f[name][i]["kind"]


def thing_size(f, ref):
    kind = thing_kind(f, ref)
    return FOOTPRINT[kind] if kind in FOOTPRINT else 1


def thing_place(f, ref):
    name, i = ref
    if name == "roads":
        return f["roads"][i][0], f["roads"][i][1]
    return f[name][i]["gx"], f[name][i]["gy"]


def can_move(f, ref, gx, gy):
    n = thing_size(f, ref)
    used = taken(f, ref)
    return all(on_map(gx + a, gy + b) and (gx + a, gy + b) not in used for a in range(n) for b in range(n))


def move(f, ref, gx, gy):
    """'moved', or 'taken'. Everything on it goes with it: a crop keeps growing."""
    if not can_move(f, ref, gx, gy):
        return "taken"
    name, i = ref
    if name == "roads":
        f["roads"][i] = [gx, gy]
    else:
        f[name][i]["gx"], f[name][i]["gy"] = gx, gy
    return "moved"
