# script: awards
# Phase 7: what the kingdom has done (`stats`, counted by `tally` where the rules do each
# thing, so a tap, the keys and the tests' bots all count), the achievements made of it,
# the week's event, and the leagues. Nothing here draws.
#
# In the kingdom dict:
#   stats   {stat: how many so far}
#   awards  {achievement: tiers collected}
#   event   {"week", "kind", "got", "claimed"} or None


def load_awards(r):
    r.setdefault("stats", {})
    r.setdefault("awards", {})
    r.setdefault("event", None)
    return r


def tally(r, stat, n=1):
    """Counts n more of something the kingdom did, for its achievement and the week's event."""
    if n <= 0:
        return
    r["stats"][stat] = r["stats"].get(stat, 0) + n
    e = event_now(r)
    if e is not None and EVENTS[e["kind"]]["stat"] == stat:
        e["got"] += n


def progress(r, key):
    """How far along an achievement is: counted, or read from the kingdom itself (so a
    kingdom from before phase 7 has its keep, walls, villages and renown counted already)."""
    if key == "keep":
        return keep_level(r)
    if key == "trophies":
        return r.get("trophies", 0)
    if key == "renown":
        return r["level"]
    if key == "walls":
        return sum(1 for b in r["buildings"] if b["kind"] == "wall" and b["level"] >= 5)
    if key == "villages":
        return sum(1 for v in r.get("campaign", {}).values() if v >= 3)
    return r["stats"].get(key, 0)


# ---- achievements

def award_tier(r, key):
    return r["awards"].get(key, 0)


def award_ready(r, key):
    t = award_tier(r, key)
    goals = ACHIEVEMENTS[key]["goals"]
    return t < len(goals) and progress(r, key) >= goals[t]


def claim_award(r, key):
    """Collects an achievement's next tier: 'claimed', the prize and the levels its renown
    brought, or 'not yet'. Gold and food as far as storage holds."""
    if not award_ready(r, key):
        return "not yet", None, []
    t = award_tier(r, key)
    prize = AWARD_PRIZES[t]
    r["awards"][key] = t + 1
    add(r, "gold", prize["gold"])
    add(r, "food", prize["food"])
    return "claimed", prize, add_xp(r, prize["xp"])


# ---- the week's event

def week_now():
    return int((now() - WEEK_START) // WEEK)


def week_left():
    return WEEK_START + (week_now() + 1) * WEEK - now()


def can_count(r, stat):
    """Whether the kingdom can do what an event counts yet: an event about it would be fair."""
    if stat in ("built", "cleared"):
        return True
    if stat == "trained":
        return barracks_level(r) > 0
    if stat in ("stars", "loot"):
        return barracks_level(r) > 0
    if stat == "spells":
        return tower_level(r) > 0
    return False


def events_open(r):
    return [k for k, e in EVENTS.items() if can_count(r, e["stat"])]


def event_now(r):
    """This week's event: a new week starts a new one, chosen among those the kingdom can
    do then, kept all week (growing mid-week doesn't swap it)."""
    w = week_now()
    e = r.get("event")
    if e is None or e["week"] != w:
        can = events_open(r)
        e = {"week": w, "kind": can[w % len(can)], "got": 0, "claimed": 0}
        r["event"] = e
    return e


def event_reached(e):
    return sum(1 for g in EVENTS[e["kind"]]["goals"] if e["got"] >= g)


def claim_event(r):
    """The event's next prize: 'claimed', the prize and the levels, or 'not yet'."""
    e = event_now(r)
    if e["claimed"] >= event_reached(e):
        return "not yet", None, []
    prize = EVENT_PRIZES[e["claimed"]]
    e["claimed"] += 1
    add(r, "gold", prize["gold"])
    add(r, "food", prize["food"])
    return "claimed", prize, add_xp(r, prize["xp"])


def to_claim(r):
    """Prizes waiting to be collected (achievements' tiers and the event's)."""
    e = event_now(r)
    return sum(1 for k in ACHIEVEMENTS if award_ready(r, k)) + event_reached(e) - e["claimed"]


# ---- leagues

def league_of(trophies):
    """The league for so many trophies (its index in LEAGUES)."""
    return max(i for i, l in enumerate(LEAGUES) if trophies >= l["from"])


def league_bonus(r, stars):
    """What a raid on a classmate won with `stars` pays on top, in gold and food each."""
    return LEAGUES[league_of(r.get("trophies", 0))]["bonus"] * stars // 3
