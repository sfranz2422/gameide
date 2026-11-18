# script: campaign
# Phase 2's computer villages: each one's layout made from its number alone (the same
# every time), as a kingdom's buildings are kept, so a battle takes a village and (in
# phase 3) a classmate's kingdom in just the same way. Nothing here draws.
import random


def village_level(kind, keep):
    """A village's building of a kind at the best level its keep allows."""
    lv = 0
    for i, need in enumerate(BUILDINGS[kind]["keep"]):
        if need <= keep:
            lv = i + 1
    return max(1, lv)


def village_layout(i):
    """Village i's buildings: [{"kind", "gx", "gy", "level"}], walls included. The keep in
    the middle, its gold and food stores near it, the defenses round them, walls in
    rings (if it has any), and its mines, farms and huts outside."""
    v = CAMPAIGN[i]
    keep = v["keep"]
    rng = random.Random(4001 + i * 7919)
    out = []
    used = set()
    c = MID

    def ring_cells(rad):
        return [(x, y) for x in range(c - rad, c + rad) for y in range(c - rad, c + rad)
                if max(abs(x - c + 0.5), abs(y - c + 0.5)) >= rad - 0.5]

    rings = ([ring_cells(7)] if v["ring"] >= 1 else []) + ([ring_cells(12)] if v["ring"] >= 2 else [])
    wall_cells = {t for ring in rings for t in ring}

    def put(kind, near, far):
        """Somewhere `near` to `far` tiles from the keep; crowded, a little further out,
        until it fits (a village always has every building it's meant to)."""
        for grow in range(0, 30, 2):
            if place_one(kind, near, far + grow):
                return True
        return False

    def place_one(kind, near, far):
        n = BUILDINGS[kind]["size"]
        for _ in range(400):
            gx = c + rng.randint(-far, far) - n // 2
            gy = c + rng.randint(-far, far) - n // 2
            cells = {(gx + a, gy + b) for a in range(n) for b in range(n)}
            d = max(max(abs(x - c + 0.5), abs(y - c + 0.5)) for x, y in cells)
            if d < near or d > far:
                continue
            if cells & used or cells & wall_cells:
                continue
            # A tile's gap round every building, so troops can walk between them.
            ring = {(x + dx, y + dy) for x, y in cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
            if ring & used:
                continue
            used.update(cells)
            out.append({"kind": kind, "gx": gx, "gy": gy, "level": village_level(kind, keep)})
            return True
        return False

    used.update((c - 2 + a, c - 2 + b) for a in range(4) for b in range(4))
    out.append({"kind": "keep", "gx": c - 2, "gy": c - 2, "level": keep})
    inner = 6 if v["ring"] else 9
    put("treasury", 2, inner)
    put("granary", 2, inner)
    for _ in range(v["towers"]):
        put("archer_tower", 3, inner if v["ring"] < 2 else 11)
    for _ in range(v["ballistas"]):
        put("ballista", 3, inner if v["ring"] < 2 else 11)
    for _ in range(v["trebuchets"]):
        put("trebuchet", 2, inner)
    outside = 13 if v["ring"] >= 2 else 8 if v["ring"] else 10
    for kind in ("gold_mine", "farm", "gold_mine", "farm", "builder_hut", "army_camp", "barracks"):
        put(kind, outside, outside + 6)
    for x, y in sorted(wall_cells):
        if (x, y) not in used:
            out.append({"kind": "wall", "gx": x, "gy": y, "level": village_level("wall", keep)})
    return out


def village_loot(r, i):
    """What's still there to take in village i: [gold, food] (all of it, the first time)."""
    left = r["campaign_loot"].get(str(i))
    return left if left is not None else [CAMPAIGN[i]["gold"], CAMPAIGN[i]["food"]]


def village_open(r, i):
    """The first village is open; each after it once the one before has a star."""
    return i == 0 or r["campaign"].get(str(i - 1), 0) > 0


def start_raid(r, i):
    """A battle against village i with the army ready, or why not, in words."""
    if not village_open(r, i):
        return f"Win a star at {CAMPAIGN[i - 1]['name']} first."
    if army_size(r) == 0:
        return "Train an army first: tap a barracks, or the Army button."
    return new_battle(village_layout(i), r["army"], village_loot(r, i))


def finish_raid(r, i, b):
    """A battle against village i over: the troops sent are gone (the rest come home), the
    loot goes into storage (as much as it holds), the village keeps what's left, and its
    best stars are kept, with renown for each new one. What happened, for the screen:
    {"stars", "new_stars", "gold", "food" (kept), "lost" (didn't fit), "levels"}."""
    for k, n in b["sent"].items():
        r["army"][k] = r["army"].get(k, 0) - n
        if r["army"][k] <= 0:
            del r["army"][k]
    kept = [add(r, "gold", b["loot"][0]), add(r, "food", b["loot"][1])]
    left = village_loot(r, i)
    r["campaign_loot"][str(i)] = [max(0, left[0] - b["loot"][0]), max(0, left[1] - b["loot"][1])]
    best = r["campaign"].get(str(i), 0)
    new = max(0, b["stars"] - best)
    r["campaign"][str(i)] = max(best, b["stars"])
    levels = add_xp(r, new * CAMPAIGN_XP * (i + 1)) if new else []
    return {"stars": b["stars"], "new_stars": new, "gold": kept[0], "food": kept[1],
            "lost": b["loot"][0] + b["loot"][1] - kept[0] - kept[1], "levels": levels}
