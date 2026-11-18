# script: land
# Phase 4, the valley's rules: the land beyond the farm, bought a plot at a time; the
# trees and rocks growing wild on it (and on the farm), cleared with tools; the kit
# those tools are kept in, and where more come from; a bigger barn; and the orchard.
# Like the other rules scripts, nothing here draws.
#
# In the farm dict (global_vars.farm):
#   land        [plot index in LAND]   the plots bought
#   cleared     [[gx, gy]]             wild things (or the farm's DECOR) cleared away
#   kit         {tool or material: n}
#   barn_level  times the barn's been made bigger
#   drops       rolls for a lucky find so far (with `seed`, decides the next)
#   trees       [{"kind", "gx", "gy", "t" (when its fruit started growing)}]
import random

_wild = {}


def in_plot(p, gx, gy):
    return p["gx"] <= gx < p["gx"] + p["w"] and p["gy"] <= gy < p["gy"] + p["h"]


def land_at(gx, gy):
    """The plot a tile is in (its index in LAND), or None: the farm, or the station's yard."""
    return next((i for i, p in enumerate(LAND) if in_plot(p, gx, gy)), None)


def plot_tiles(i):
    p = LAND[i]
    return [(gx, gy) for gx in range(p["gx"], p["gx"] + p["w"]) for gy in range(p["gy"], p["gy"] + p["h"])]


def sign_tile(i):
    """Where a plot's "for sale" sign stands: its middle (nothing wild grows there)."""
    p = LAND[i]
    return p["gx"] + p["w"] // 2, p["gy"] + p["h"] // 2


def kept_clear():
    """Tiles nothing wild grows on: the road, the railway, the lake, the station, and
    the places that come with their land, and the signs."""
    out = set(ROAD) | set(RAIL) | set(LAKE) | set(footprint_tiles("station", *STATION))
    for kind, s in SITES.items():
        out.update(footprint_tiles(kind, s["gx"], s["gy"]))
    out.update(sign_tile(i) for i in range(len(LAND)))
    return out


def wilds():
    """Everything growing wild beyond the farm: {(gx, gy): kind}. The same for every
    player (WILD_SEED), so it's never kept in the save; only what's cleared is."""
    if not _wild:
        rng = random.Random(WILD_SEED)
        clear = kept_clear()
        for gx in range(MAP_W):
            for gy in range(MAP_H):
                if gx < HOME and gy < HOME:
                    continue
                i = land_at(gx, gy)
                wild = WILD[LAND[i]["wild"] if i is not None else "woods"]
                roll, pick = rng.random(), rng.random()      # both rolled for every tile, so one change moves nothing else
                if (gx, gy) in clear or roll >= wild["thick"]:
                    continue
                total = sum(wild["kinds"].values())
                for kind, n in wild["kinds"].items():
                    pick -= n / total
                    if pick < 0:
                        break
                _wild[(gx, gy)] = kind
        for kind, gx, gy in DECOR:
            if kind in CLEAR:
                _wild[(gx, gy)] = kind
    return _wild


def wild_left(f):
    """Tiles with something wild still on (the farm's own trees and rocks too, and the pond)."""
    gone = {(c[0], c[1]) for c in f["cleared"]}
    out = {t for t in wilds() if t not in gone}
    out.update((gx, gy) for kind, gx, gy in DECOR if kind not in CLEAR)
    return out


def wild_at(f, gx, gy):
    """What's growing on a tile that a tool could clear, or None."""
    kind = wilds().get((gx, gy))
    if kind is None or [gx, gy] in f["cleared"]:
        return None
    return kind


# ---- land

def locked(f, i):
    return i not in f["land"]


def locked_tiles(f):
    out = set()
    for i in range(len(LAND)):
        if locked(f, i):
            out.update(plot_tiles(i))
    return out


def is_locked(f, gx, gy):
    i = land_at(gx, gy)
    return i is not None and locked(f, i)


def buy_land(f, i):
    """'bought' (the places on it come with it) and the levels its XP brought, or why
    not: 'owned', 'level', 'coins'."""
    p = LAND[i]
    if not locked(f, i):
        return "owned", []
    if f["level"] < p["level"]:
        return "level", []
    if f["coins"] < p["cost"]:
        return "coins", []
    f["coins"] -= p["cost"]
    f["land"].append(i)
    for kind, s in SITES.items():
        if s["land"] == i:
            if "animal" in s:
                f["homes"].append({"kind": kind, "gx": s["gx"], "gy": s["gy"], "animals": [None] * ANIMALS_EACH})
            else:
                f["mills"].append({"kind": kind, "gx": s["gx"], "gy": s["gy"], "queue": []})
    return "bought", add_xp(f, LAND_XP)


def wild_in(f, i):
    """How many wild things are still on a plot."""
    gone = {(c[0], c[1]) for c in f["cleared"]}
    return sum(1 for t in plot_tiles(i) if t in wilds() and t not in gone)


# ---- clearing

def clear_wild(f, gx, gy):
    """Clears what's growing on a tile with its tool: 'cleared' (coins and XP in) and the
    levels it brought, or why not: 'nothing', 'locked', 'tool' (none in the kit)."""
    kind = wild_at(f, gx, gy)
    if kind is None:
        return "nothing", []
    if is_locked(f, gx, gy):
        return "locked", []
    tool = CLEAR[kind]
    if f["kit"].get(tool, 0) < 1:
        return "tool", []
    f["kit"][tool] -= 1
    f["cleared"].append([gx, gy])
    f["coins"] += CLEAR_COINS
    tally(f, "cleared")
    return "cleared", add_xp(f, CLEAR_XP)


# ---- the kit, and lucky finds

def lucky(f):
    """After a harvest or a collection: now and then (DROP_CHANCE) a tool or material is
    found, into the kit. What was found, or None."""
    rng = random.Random(f["seed"] * 15485863 + f["drops"])
    f["drops"] += 1
    if rng.random() >= DROP_CHANCE:
        return None
    item = pick_weighted(rng, DROPS)
    f["kit"][item] = f["kit"].get(item, 0) + 1
    return item


def pick_weighted(rng, weights):
    roll = rng.random() * sum(weights.values())
    for k, n in weights.items():
        roll -= n
        if roll < 0:
            return k
    return k


# ---- a bigger barn

def barn_needs(f):
    """What the next bigger barn takes: {material: n}."""
    n = BARN_NEEDS + f["barn_level"]
    return {"nails": n, "planks": n, "paint": n}


def can_grow_barn(f):
    return all(f["kit"].get(k, 0) >= n for k, n in barn_needs(f).items())


def grow_barn(f):
    """'bigger' (BARN_STEP more room) and the levels it brought, or 'short'."""
    if not can_grow_barn(f):
        return "short", []
    for k, n in barn_needs(f).items():
        f["kit"][k] -= n
    f["barn_level"] += 1
    return "bigger", add_xp(f, BARN_XP)


# ---- the orchard

def tree_cost(f, kind):
    return TREES[kind]["cost"] + TREES[kind]["step"] * sum(1 for t in f["trees"] if t["kind"] == kind)


def buy_tree(f, kind, gx, gy):
    """'planted', or why not: 'level', 'coins', 'taken'."""
    info = TREES[kind]
    if f["level"] < info["level"]:
        return "level"
    if f["coins"] < tree_cost(f, kind):
        return "coins"
    if not can_place(f, gx, gy):
        return "taken"
    f["coins"] -= tree_cost(f, kind)
    f["trees"].append({"kind": kind, "gx": gx, "gy": gy, "t": now()})
    return "planted"


def tree_at(f, gx, gy):
    return next((i for i, t in enumerate(f["trees"]) if (t["gx"], t["gy"]) == (gx, gy)), None)


def fruit_left(tr):
    return max(0, tr["t"] + TREES[tr["kind"]]["grow"] - now())


def fruit_ready(tr):
    return fruit_left(tr) == 0


def pick_fruit(f, i):
    """'picked' (into the barn, and it grows more), or why not: 'growing', 'full'. The
    levels it brought."""
    tr = f["trees"][i]
    info = TREES[tr["kind"]]
    if not fruit_ready(tr):
        return "growing", []
    if barn_free(f) < info["yield"]:
        return "full", []
    f["barn"][info["fruit"]] = f["barn"].get(info["fruit"], 0) + info["yield"]
    tr["t"] = now()
    tally(f, "fruit", info["yield"])
    return "picked", add_xp(f, info["xp"])
