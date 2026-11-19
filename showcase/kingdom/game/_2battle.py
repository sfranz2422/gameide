# script: battle
# Phase 2's battles, worked out with no drawing at all (so the tests, and a student, can
# play one out on its own): a layout of buildings (a computer village, or in phase 3 a
# classmate's kingdom) with its loot, an army to put down round it, troops finding their
# way to what they want and fighting it, defenses shooting back, walls in the way. The
# Battlefield object only shows it and passes on the taps.
#
# The battle is one dict:
#   bs      [{"kind", "gx", "gy", "n" (tiles across), "level", "hp", "max", "dead",
#             "loot": [gold, food] still in it, "cool" (a defense's wait)}]
#   cells   {(gx, gy): the building there}          (walls too)
#   units   [{"kind", "x", "y" (tiles, fractions), "hp", "max", "dead", "goal" (a building),
#             "hit" (what it's hitting now), "cool", "moving", "dir"}]
#   shots   [{"x", "y", "unit", "dmg", "splash", "kind", "from"}]
#   army    {kind: how many still to put down};  sent {kind: how many put down}
#   time, loot [gold, food] won so far, over, stars, flows {goal: (version, field)}
import heapq
import math


def new_battle(layout, army, loot, champs=None, spells=None, tower=1):
    """A battle against a layout ([{"kind", "gx", "gy", "level"}]) with `loot` ([gold,
    food]) to win, shared out among its keep, stores, mines and farms. `champs` {kind:
    [level, health]} and `spells` {kind: n} (at the mage tower's level) come too (phase 4)."""
    b = {"bs": [], "cells": {}, "units": [], "shots": [], "army": {k: n for k, n in army.items() if n > 0},
         "sent": {}, "time": 0.0, "loot": [0, 0], "over": False, "stars": 0, "flows": {}, "walls_v": 0, "ended": "",
         "replay": [], "champs": dict(champs or {}), "spells": {k: n for k, n in (spells or {}).items() if n > 0},
         "tower": max(1, tower), "cast": {}, "zones": []}
    for d in layout:
        n = BUILDINGS[d["kind"]]["size"]
        hp = stat(d["kind"], "hp", d["level"])
        x = {"kind": d["kind"], "gx": d["gx"], "gy": d["gy"], "n": n, "level": d["level"], "hp": hp, "max": hp,
             "dead": False, "loot": [0, 0], "cool": 0.0}
        b["bs"].append(x)
        for t in footprint(d["kind"], d["gx"], d["gy"]):
            b["cells"][t] = len(b["bs"]) - 1
    share_loot(b, loot)
    # Where troops may be put down: on the map, not within DEPLOY_GAP of anything.
    near = set()
    for (x, y) in b["cells"]:
        for dx in range(-DEPLOY_GAP, DEPLOY_GAP + 1):
            for dy in range(-DEPLOY_GAP, DEPLOY_GAP + 1):
                near.add((x + dx, y + dy))
    b["no_deploy"] = near
    return b


def share_loot(b, loot):
    """The loot shared out: gold among the keep, treasuries and gold mines, food among
    the keep, granaries and farms, each by how much it could hold."""
    for res, kinds in ((0, ("keep", "treasury", "gold_mine")), (1, ("keep", "granary", "farm"))):
        holders = [x for x in b["bs"] if x["kind"] in kinds]
        weight = [stat(x["kind"], "store" if x["kind"] in ("keep", "treasury", "granary") else "hold", x["level"]) for x in holders]
        total = sum(weight) or 1
        given = 0
        for x, w in zip(holders, weight):
            share = int(loot[res] * w / total)
            x["loot"][res] = share
            given += share
        if holders:
            holders[0]["loot"][res] += loot[res] - given        # what rounding left over


def standing(b):
    """The buildings still up, walls not counted (they don't count towards the stars)."""
    return [x for x in b["bs"] if x["kind"] != "wall" and not x["dead"]]


def destroyed_pct(b):
    every = [x for x in b["bs"] if x["kind"] != "wall"]
    if not every:
        return 100
    return int(100 * sum(1 for x in every if x["dead"]) / len(every))


def stars_now(b):
    """One star for half the buildings down, one for the keep, one for all of them."""
    pct = destroyed_pct(b)
    keep_down = any(x["kind"] == "keep" and x["dead"] for x in b["bs"])
    return (pct >= STAR_HALF) + keep_down + (pct >= 100)


# ---- putting troops down

def troop_stats(u):
    """A troop's numbers: a champion carries their own (by level), anyone else is TROOPS'."""
    return u.get("stats") or TROOPS[u["kind"]]


def can_deploy(b, kind, x, y):
    """None if a troop (or a champion) can be put down at (x, y) (tiles), or why not, in words."""
    if b["over"]:
        return "The battle's over."
    if kind in CHAMPIONS:
        if kind not in b["champs"]:
            return f"The {CHAMPIONS[kind]['name']} isn't here to send."
    elif b["army"].get(kind, 0) < 1:
        return f"No more {TROOPS[kind]['name'].lower()}s to send."
    t = (round(x), round(y))
    if not on_map(*t):
        return "That's off the map."
    if t in b["no_deploy"]:
        return "Too close: put troops down outside the village."
    return None


def deploy(b, kind, x, y):
    """Puts a troop down: 'sent', or why not in words."""
    why = can_deploy(b, kind, x, y)
    if why:
        return why
    if kind in CHAMPIONS:
        return deploy_champ(b, kind, x, y)
    b["army"][kind] -= 1
    if not b["army"][kind]:
        del b["army"][kind]
    b["sent"][kind] = b["sent"].get(kind, 0) + 1
    # The replay: when and where each troop went down (a battle is the same every time
    # from the same troops at the same moments, so the defender can watch it).
    b["replay"].append([round(b["time"], 3), kind, round(float(x), 3), round(float(y), 3)])
    t = TROOPS[kind]
    b["units"].append({"kind": kind, "x": float(x), "y": float(y), "hp": t["hp"], "max": t["hp"], "dead": False,
                       "goal": None, "hit": None, "cool": 0.0, "moving": False, "dir": (1, 1)})
    return "sent"


def deploy_champ(b, kind, x, y):
    """A champion down, at their level and with the health they came with."""
    level, hp = b["champs"].pop(kind)
    c = CHAMPIONS[kind]
    stats = {"name": c["name"], "speed": c["speed"], "reach": c["reach"], "wants": c["wants"],
             "damage": c["damage"][level - 1], "hp": c["hp"][level - 1]}
    b["replay"].append([round(b["time"], 3), f"{kind}_{level}_{int(hp)}", round(float(x), 3), round(float(y), 3)])
    b["units"].append({"kind": kind, "x": float(x), "y": float(y), "hp": float(hp), "max": stats["hp"], "dead": False,
                       "goal": None, "hit": None, "cool": 0.0, "moving": False, "dir": (1, 1), "rage": 0.0,
                       "champ": True, "stats": stats, "used": False})
    return "sent"


def champ_unit(b, kind):
    return next((u for u in b["units"] if u.get("champ") and u["kind"] == kind), None)


def can_ability(b, kind):
    u = champ_unit(b, kind)
    if u is None or u["dead"]:
        return f"The {CHAMPIONS[kind]['name']} isn't on the field."
    if u["used"]:
        return f"{CHAMPIONS[kind]['ability_name']} is used: once a battle."
    return None


def ability(b, kind):
    """A champion's ability, once a battle: the Warlord's Battle Cry (troops near him rage,
    and he's healed), the Huntress's Volley (arrows on every building near her)."""
    why = can_ability(b, kind)
    if why:
        return why
    u = champ_unit(b, kind)
    u["used"] = True
    b["replay"].append([round(b["time"], 3), CHAMPIONS[kind]["ability"], 0, 0])
    if kind == "warlord":
        for v in b["units"]:
            if not v["dead"] and math.hypot(v["x"] - u["x"], v["y"] - u["y"]) <= CRY_RADIUS:
                v["rage"] = max(v.get("rage", 0.0), CRY_RAGE)
        u["hp"] = min(u["max"], u["hp"] + u["max"] * CRY_HEAL)
    else:
        for i, x in enumerate(b["bs"]):
            if x["kind"] != "wall" and not x["dead"] and rect_dist(u["x"], u["y"], x) <= VOLLEY_RADIUS:
                hurt(b, i, u["stats"]["damage"] * VOLLEY_HITS)
    return "used"


def spell_power(b, kind):
    return SPELLS[kind]["power"] * (1 + SPELL_GROW * (b["tower"] - 1))


def can_cast(b, kind, x, y):
    if b["over"]:
        return "The battle's over."
    if b["spells"].get(kind, 0) < 1:
        return f"No {SPELLS[kind]['name']} spells left."
    if not on_map(round(x), round(y)):
        return "That's off the map."
    return None


def cast(b, kind, x, y):
    """A spell anywhere on the field (even inside the village): Lightning strikes at once,
    the others make a circle that lasts a while. 'cast', or why not in words."""
    why = can_cast(b, kind, x, y)
    if why:
        return why
    b["spells"][kind] -= 1
    if not b["spells"][kind]:
        del b["spells"][kind]
    b["cast"][kind] = b["cast"].get(kind, 0) + 1
    b["replay"].append([round(b["time"], 3), f"{kind}_{b['tower']}", round(float(x), 3), round(float(y), 3)])
    sp = SPELLS[kind]
    if kind == "lightning":
        for i, s in enumerate(b["bs"]):
            if not s["dead"] and rect_dist(x, y, s) <= sp["radius"]:
                hurt(b, i, spell_power(b, kind))
    else:
        b["zones"].append({"kind": kind, "x": float(x), "y": float(y), "r": sp["radius"], "left": float(sp["seconds"])})
    return "cast"


def zones_tick(b, dt):
    """The spells' circles: Heal heals, Rage enrages, Freeze stops the defenses inside."""
    for z in b["zones"]:
        z["left"] -= dt
        if z["kind"] == "freeze":
            for s in b["bs"]:
                if s["kind"] in DEFENSE_SHOTS and not s["dead"] and rect_dist(z["x"], z["y"], s) <= z["r"]:
                    s["frozen"] = max(s.get("frozen", 0.0), dt * 1.5)
            continue
        for u in b["units"]:
            if not u["dead"] and math.hypot(u["x"] - z["x"], u["y"] - z["y"]) <= z["r"]:
                if z["kind"] == "heal":
                    u["hp"] = min(u["max"], u["hp"] + spell_power(b, "heal") * dt)
                else:
                    u["rage"] = max(u.get("rage", 0.0), dt * 1.5)
    b["zones"] = [z for z in b["zones"] if z["left"] > 0]


def battle_act(b, code, x, y):
    """One thing done in a battle, as a replay keeps it: a troop's kind, a champion
    ("warlord_5_900": their level and health), a spell ("rage_3": the tower's level), or an
    ability ("cry", "volley"). How a replay plays the raid out again."""
    if code in ("cry", "volley"):
        return ability(b, next(k for k, c in CHAMPIONS.items() if c["ability"] == code))
    parts = code.split("_")
    if parts[0] in CHAMPIONS and len(parts) == 3:
        b["champs"].setdefault(parts[0], [int(parts[1]), int(parts[2])])
        return deploy(b, parts[0], x, y)
    if parts[0] in SPELLS and len(parts) == 2:
        b["tower"] = int(parts[1])
        b["spells"][parts[0]] = b["spells"].get(parts[0], 0) + 1
        return cast(b, parts[0], x, y)
    return deploy(b, code, x, y)


def replay_army(steps):
    """The troops a replay sends ({kind: n}); its champions and spells come with their steps."""
    army = {}
    for s in steps:
        if s[1] in TROOPS:
            army[s[1]] = army.get(s[1], 0) + 1
    return army


# ---- where troops go

def rect_dist(x, y, s):
    """How far a point (tiles) is from a building's edge (0 inside it)."""
    x0, y0 = s["gx"] - 0.5, s["gy"] - 0.5
    x1, y1 = x0 + s["n"], y0 + s["n"]
    dx = max(x0 - x, 0, x - x1)
    dy = max(y0 - y, 0, y - y1)
    return math.hypot(dx, dy)


def middle(s):
    return s["gx"] + (s["n"] - 1) / 2, s["gy"] + (s["n"] - 1) / 2


def wanted(b, wants):
    """What a troop goes for (its `wants`): its favourites if any stand, else any building."""
    live = standing(b)
    if wants == "walls":
        walls = [i for i, x in enumerate(b["bs"]) if x["kind"] == "wall" and not x["dead"]]
        if walls:
            return walls
    pick = {"defense": DEFENSES, "loot": LOOT_KINDS}.get(wants)
    if pick:
        fav = [i for i, x in enumerate(b["bs"]) if x["kind"] in pick and not x["dead"]]
        if fav:
            return fav
    return [b["bs"].index(x) for x in live]


def choose_goal(b, u):
    goals = wanted(b, troop_stats(u)["wants"])
    if not goals:
        return None
    return min(goals, key=lambda i: rect_dist(u["x"], u["y"], b["bs"][i]))


def flow(b, goal):
    """How far every tile is from a goal building, walking (8 ways; walls standing cost
    WALL_DETOUR more, other buildings can't be walked through): troops go downhill. Kept
    until a wall falls (a new way through)."""
    have = b["flows"].get(goal)
    if have is not None and have[0] == b["walls_v"]:
        return have[1]
    g = b["bs"][goal]
    dist = {}
    heap = []
    for t in footprint(g["kind"], g["gx"], g["gy"]):
        dist[t] = 0.0
        heap.append((0.0, t))
    heapq.heapify(heap)
    steps = ((1, 0, 1.0), (-1, 0, 1.0), (0, 1, 1.0), (0, -1, 1.0), (1, 1, 1.41), (1, -1, 1.41), (-1, 1, 1.41), (-1, -1, 1.41))
    cells = b["cells"]
    bs = b["bs"]
    while heap:
        d, (x, y) = heapq.heappop(heap)
        if d > dist.get((x, y), 1e18):
            continue
        for dx, dy, c in steps:
            t = (x + dx, y + dy)
            if not (0 <= t[0] < MAP_W and 0 <= t[1] < MAP_H):
                continue
            k = cells.get(t)
            if k is not None and k != goal:
                s = bs[k]
                if s["dead"]:
                    pass
                elif s["kind"] == "wall":
                    c += WALL_DETOUR
                else:
                    continue
            nd = d + c
            if nd < dist.get(t, 1e18):
                dist[t] = nd
                heapq.heappush(heap, (nd, t))
    b["flows"][goal] = (b["walls_v"], dist)
    return dist


def next_step(b, u, field):
    """The tile a troop walks to next: the neighbour nearest its goal."""
    cx, cy = round(u["x"]), round(u["y"])
    best, here = None, field.get((cx, cy), 1e18)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx or dy:
                t = (cx + dx, cy + dy)
                v = field.get(t)
                if v is not None and v < here:
                    here, best = v, t
    return best


# ---- the fighting

def hurt(b, i, dmg):
    """Damage to building i; its loot comes out as it's knocked about. True if it fell."""
    s = b["bs"][i]
    if s["dead"]:
        return False
    dealt = min(s["hp"], dmg)
    for res in (0, 1):
        got = int(s["loot"][res] * dealt / s["hp"]) if s["hp"] > 0 else 0
        s["loot"][res] -= got
        b["loot"][res] += got
    s["hp"] -= dealt
    if s["hp"] <= 0.001:
        s["hp"] = 0
        s["dead"] = True
        for res in (0, 1):
            b["loot"][res] += s["loot"][res]
            s["loot"][res] = 0
        if s["kind"] == "wall":
            b["walls_v"] += 1
        return True
    return False


def unit_tick(b, u, dt):
    t = troop_stats(u)
    rage = u.get("rage", 0.0) > 0
    if rage:
        u["rage"] -= dt
    u["moving"] = False
    # Hitting something already: keep at it while it stands.
    if u["hit"] is not None and not b["bs"][u["hit"]]["dead"]:
        s = b["bs"][u["hit"]]
        if u["kind"] == "sapper":
            # The keg goes off: every wall within a tile and a half is hit hard; the sapper's gone.
            mx, my = middle(s)
            for i, w in enumerate(b["bs"]):
                if w["kind"] == "wall" and not w["dead"] and math.hypot(w["gx"] - mx, w["gy"] - my) <= 1.5:
                    hurt(b, i, SAPPER_BLAST * TROOPS["footman"]["damage"])
            u["dead"] = True
            u["hp"] = 0
            return
        dmg = t["damage"] * dt * (LOOT_DOUBLE if u["kind"] == "raider" and s["kind"] in LOOT_KINDS else 1) * (RAGE_DAMAGE if rage else 1)
        hurt(b, u["hit"], dmg)
        return
    u["hit"] = None
    if u["goal"] is None or b["bs"][u["goal"]]["dead"]:
        u["goal"] = choose_goal(b, u)
        if u["goal"] is None:
            return
    g = b["bs"][u["goal"]]
    if rect_dist(u["x"], u["y"], g) <= t["reach"]:
        u["hit"] = u["goal"]
        return
    nxt = next_step(b, u, flow(b, u["goal"]))
    if nxt is None:
        return
    k = b["cells"].get(nxt)
    if k is not None and k != u["goal"] and not b["bs"][k]["dead"] and b["bs"][k]["kind"] == "wall":
        # A wall in the way (the way round is further): break through it.
        if rect_dist(u["x"], u["y"], b["bs"][k]) <= max(0.6, min(t["reach"], 0.6)):
            u["hit"] = k
            return
    dx, dy = nxt[0] - u["x"], nxt[1] - u["y"]
    d = math.hypot(dx, dy) or 1
    step = min(d, t["speed"] * dt * (RAGE_SPEED if rage else 1))
    u["x"] += dx / d * step
    u["y"] += dy / d * step
    u["moving"] = True
    u["dir"] = (dx / d, dy / d)


def defense_tick(b, i, dt):
    s = b["bs"][i]
    rule = DEFENSE_SHOTS[s["kind"]]
    if s.get("frozen", 0) > 0:
        s["frozen"] -= dt            # frozen (the Freeze spell): no shooting
        return
    s["cool"] -= dt
    if s["cool"] > 0:
        return
    mx, my = middle(s)
    reach = stat(s["kind"], "range", s["level"])
    best = None
    for j, u in enumerate(b["units"]):
        if u["dead"]:
            continue
        d = math.hypot(u["x"] - mx, u["y"] - my)
        if rule["least"] <= d <= reach and (best is None or d < best[0]):
            best = (d, j)
    if best is None:
        s["cool"] = 0.1
        return
    s["cool"] = rule["every"]
    b["shots"].append({"x": mx, "y": my, "unit": best[1], "dmg": stat(s["kind"], "damage", s["level"]) * rule["every"],
                       "splash": rule["splash"], "kind": rule["shot"], "from": i,
                       "tx": b["units"][best[1]]["x"], "ty": b["units"][best[1]]["y"]})


def shot_tick(b, sh, dt):
    """A shot flies at its troop (where it was, for a trebuchet's stone: it can be dodged
    by walking on). True once it's landed."""
    u = b["units"][sh["unit"]]
    if sh["splash"] == 0 and not u["dead"]:
        sh["tx"], sh["ty"] = u["x"], u["y"]
    dx, dy = sh["tx"] - sh["x"], sh["ty"] - sh["y"]
    d = math.hypot(dx, dy)
    step = SHOT_SPEED * dt
    if d > step:
        sh["x"] += dx / d * step
        sh["y"] += dy / d * step
        return False
    if sh["splash"]:
        for v in b["units"]:
            if not v["dead"] and math.hypot(v["x"] - sh["tx"], v["y"] - sh["ty"]) <= sh["splash"]:
                v["hp"] -= sh["dmg"]
                v["dead"] = v["hp"] <= 0
    elif not u["dead"]:
        u["hp"] -= sh["dmg"]
        u["dead"] = u["hp"] <= 0
    return True


def tick(b, dt=BATTLE_TICK):
    """One moment of the battle: troops move and fight, defenses shoot, the battle ends
    if it's over (time up, everything down, or nobody left to fight)."""
    if b["over"]:
        return
    if not b["units"]:
        return              # the clock starts with the first troop (looking round is free)
    b["time"] += dt
    zones_tick(b, dt)
    for u in b["units"]:
        if not u["dead"]:
            unit_tick(b, u, dt)
    for i, s in enumerate(b["bs"]):
        if s["kind"] in DEFENSE_SHOTS and not s["dead"]:
            defense_tick(b, i, dt)
    b["shots"] = [sh for sh in b["shots"] if not shot_tick(b, sh, dt)]
    b["stars"] = stars_now(b)
    if not standing(b):
        end_battle(b, "Everything's down!")
    elif b["time"] >= BATTLE_TIME:
        end_battle(b, "Time's up.")
    elif b["units"] and not b["army"] and not b["champs"] and all(u["dead"] for u in b["units"]):
        end_battle(b, "Your army has fallen.")


def end_battle(b, why="You called the troops home."):
    if not b["over"]:
        b["over"] = True
        b["ended"] = why
        b["stars"] = stars_now(b)


def battle_left(b):
    return max(0, BATTLE_TIME - b["time"])
