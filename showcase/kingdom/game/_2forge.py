# script: forge
# Phase 5's deeper upgrades: the forge researches a troop's level, one at a time, on the
# real clock, for gold, as high as the forge's own level + 1. A troop's level makes every
# one of that kind tougher and harder-hitting (`troop_at`). Nothing here draws.
#
# In the kingdom dict:
#   troop_levels  {kind: level}  (1 if not there)
#   research      None, or {"kind", "to", "end"}


def load_forge(r):
    r.setdefault("troop_levels", {})
    r.setdefault("research", None)
    return r


def troop_level(r, kind):
    return r["troop_levels"].get(kind, 1)


def forge_level(r):
    return max([0] + [b["level"] for b in r["buildings"] if b["kind"] == "forge"])


def research_top(r):
    """The highest level the forge can research now."""
    return min(TROOP_LEVEL_MOST, forge_level(r) + 1) if forge_level(r) else 1


def troop_at(kind, level):
    """A troop's numbers at a level: TROOPS', with health and damage grown."""
    t = dict(TROOPS[kind])
    up = max(0, level - 1)
    t["hp"] = round(t["hp"] * (1 + LEVEL_HP * up))
    t["damage"] = t["damage"] * (1 + LEVEL_DAMAGE * up)
    return t


def can_research(r, kind):
    """None if a troop's next level can be researched now, or why not, in words."""
    if forge_level(r) == 0:
        return "Build a forge first."
    forge = next(b for b in r["buildings"] if b["kind"] == "forge" and b["level"] == forge_level(r))
    if forge["job"] is not None:
        return "The forge is busy being upgraded."
    if r["research"] is not None:
        return "The forge is busy: one at a time."
    if barracks_level(r) < TROOPS[kind]["barracks"]:
        return f"Upgrade a barracks to level {TROOPS[kind]['barracks']} first."
    to = troop_level(r, kind) + 1
    if to > TROOP_LEVEL_MOST:
        return "As good as it gets!"
    if to > research_top(r):
        return f"Upgrade the forge to level {to - 1} first."
    if r["gold"] < RESEARCH_COST[to - 1]:
        return f"That needs {RESEARCH_COST[to - 1]:,} gold."
    return None


def research(r, kind):
    """'started', or why not in words."""
    why = can_research(r, kind)
    if why:
        return why
    to = troop_level(r, kind) + 1
    r["gold"] -= RESEARCH_COST[to - 1]
    r["research"] = {"kind": kind, "to": to, "end": now() + RESEARCH_TIME[to - 1]}
    return "started"


def research_tick(r):
    """Research whose time is up is done: that troop is a level up. True if one finished."""
    job = r["research"]
    if job is not None and now() >= job["end"]:
        r["troop_levels"][job["kind"]] = job["to"]
        r["research"] = None
        tally(r, "researched")
        return True
    return False


def research_left(r):
    return 0 if r["research"] is None else max(0, r["research"]["end"] - now())


def troop_levels_for(r):
    """{kind: level} for a battle (only those above level 1)."""
    return {k: v for k, v in r["troop_levels"].items() if v > 1}
