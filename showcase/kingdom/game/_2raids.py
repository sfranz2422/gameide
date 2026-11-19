# script: raids
# Phase 3: raiding classmates' kingdoms. The kingdom is shared with the server now and
# then (raid_share: only buildings that stand, the gold and food kept); a search asks it for
# someone at the same school near your trophies (raid_find, raid_found); the battle is the
# same as against a village; its result goes back (raid_finish), and raids on you come in
# the news (raid_news), their losses taken off once (`raids_applied`). The server decides
# the fair parts; outside a published game, signed in, there are no raids (raid_online).
#
# In the kingdom dict: trophies (as the server last said), raids_applied [raid ids]


# An older GameIDE (before 2026-11-19) has no raid_ functions: the game plays on without
# raids there instead of stopping with a NameError (it did, on the site, the day they came).
try:
    raid_online
except NameError:
    def raid_online(): return False
    def raid_share(*a, **k): pass
    def raid_find(): pass
    def raid_found(): return None
    def raid_finish(*a, **k): pass
    def raid_result(): return None
    def raid_news(): return None
    def raid_seen(ids): pass


def load_raids(r):
    r.setdefault("trophies", 0)
    r.setdefault("raids_applied", [])
    return r


def kingdom_for_raids(r):
    """What others raid: every building standing (one being built for the first time isn't)."""
    return [{"kind": b["kind"], "gx": b["gx"], "gy": b["gy"], "level": b["level"]} for b in r["buildings"] if b["level"] > 0]


def share_kingdom(r):
    if raid_online():
        raid_share(kingdom_for_raids(r), r["gold"], r["food"], keep_level(r))


def search_cost(r):
    return SEARCH_COST * keep_level(r)


def search(r):
    """Pays for a search and asks the server: 'searching', or why not, in words."""
    if not raid_online():
        return "Raiding classmates works in the published game, signed in."
    if army_size(r) == 0 and not champs_for_battle(r):
        return "Train an army first: tap a barracks, or the Army button."
    cost = search_cost(r)
    if r["gold"] < cost:
        return f"A search costs {cost:,} gold."
    r["gold"] -= cost
    raid_find()
    return "searching"


def found_layout(found):
    """A classmate's kingdom as a battle's layout: only kinds this game knows, at levels it has."""
    out = []
    for b in found.get("buildings", []):
        kind = b.get("kind")
        if kind in BUILDINGS and on_map(int(b["gx"]), int(b["gy"])):
            out.append({"kind": kind, "gx": int(b["gx"]), "gy": int(b["gy"]),
                        "level": max(1, min(levels(kind), int(b["level"])))})
    return out


def start_player_raid(r, found):
    """A battle against the kingdom found."""
    return new_battle(found_layout(found), r["army"], [found.get("gold", 0), found.get("food", 0)],
                      champs_for_battle(r), r["spells"], tower_level(r))


def expected_trophies(raid, stars, sent):
    """What the server will give for this result (the same rule as raids.trophy_change), to
    show while its answer comes."""
    if not sent:
        return 0
    return -raid["lose"] if stars == 0 else max(1, raid["win"] * stars // 3)


def finish_player_raid(r, raid, b):
    """A raid on a classmate over: the troops sent are gone, the loot comes home (as much as
    fits), renown for the stars, and the result goes to the server. As for the screen."""
    for k, n in b["sent"].items():
        r["army"][k] = r["army"].get(k, 0) - n
        if r["army"][k] <= 0:
            del r["army"][k]
    champs_home(r, b)
    spells_home(r, b)
    kept = [add(r, "gold", b["loot"][0]), add(r, "food", b["loot"][1])]
    levels_ = add_xp(r, RAID_XP * b["stars"]) if b["stars"] else []
    raid_finish(raid["id"], b["stars"], destroyed_pct(b), b["loot"][0], b["loot"][1], b["replay"])
    return {"stars": b["stars"], "new_stars": 0, "gold": kept[0], "food": kept[1],
            "lost": b["loot"][0] + b["loot"][1] - kept[0] - kept[1], "levels": levels_,
            "trophies": expected_trophies(raid, b["stars"], len(b["replay"]))}


def take_raids(r, news):
    """Raids on this kingdom, new since last time: their gold and food taken off (once), the
    trophies as the server has them. The new ones (for a message), and tells the server."""
    if not news:
        return []
    r["trophies"] = news.get("trophies", r["trophies"])
    fresh = [d for d in news.get("defenses", []) if d.get("new") and d["id"] not in r["raids_applied"]]
    for d in fresh:
        r["gold"] = max(0, r["gold"] - d["gold"])
        r["food"] = max(0, r["food"] - d["food"])
        r["raids_applied"].append(d["id"])
    r["raids_applied"] = r["raids_applied"][-APPLIED_KEPT:]
    ids = [d["id"] for d in news.get("defenses", []) if d.get("new")]
    if ids:
        raid_seen(ids)
    return fresh
