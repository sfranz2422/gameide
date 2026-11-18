# script: awards
# Phase 5's rules: what the farm has done (`stats`, counted by `tally` in the rules
# where each thing happens, so a tap, the keys and the tests' bots all count), the
# achievements made of it, the week's event, and the seasons. Nothing here draws.
#
# In the farm dict:
#   stats   {stat: how many so far}               (see ACHIEVEMENTS for the stats)
#   awards  {achievement: tiers collected}
#   event   {"week", "kind", "got" (counted this week), "claimed" (prizes collected)} or None
import time


def tally(f, stat, n=1):
    """Counts n more of something the farm did, for its achievement and the week's event."""
    if n <= 0:
        return
    f["stats"][stat] = f["stats"].get(stat, 0) + n
    e = event_now(f)
    if e is not None and EVENTS[e["kind"]]["stat"] == stat:
        e["got"] += n


def progress(f, stat):
    """How many of a stat so far. Land and houses are read from the farm itself, so a
    save from before phase 5 has its land and houses counted already."""
    if stat == "land":
        return len(f["land"])
    if stat == "houses":
        return sum(1 for b in f["town"] if b["kind"] in HOUSES)
    return f["stats"].get(stat, 0)


# ---- achievements

def award_tier(f, key):
    """Tiers collected (0 to 3)."""
    return f["awards"].get(key, 0)


def award_ready(f, key):
    t = award_tier(f, key)
    goals = ACHIEVEMENTS[key]["goals"]
    return t < len(goals) and progress(f, key) >= goals[t]


def claim_award(f, key):
    """Collects an achievement's next tier: 'claimed' (coins and XP in) and the levels it
    brought, or 'not yet'."""
    if not award_ready(f, key):
        return "not yet", []
    t = award_tier(f, key)
    f["coins"] += AWARD_COINS[t]
    f["awards"][key] = t + 1
    return "claimed", add_xp(f, AWARD_XP[t])


# ---- the week's event

def week_now():
    """Weeks since the real clock's start, each from Monday."""
    return int((now() - WEEK_START) // WEEK)


def week_left():
    """Seconds until this week's event ends."""
    return WEEK_START + (week_now() + 1) * WEEK - now()


def can_count(f, stat):
    """Whether the farm can do what a stat counts yet: an event about it would be fair."""
    if stat in ("crops", "orders", "cleared"):
        return True
    if stat == "animal":
        return any(b["kind"] in HOMES for b in f["homes"])
    if stat == "made":
        return any(b["kind"] in FACTORIES for b in f["mills"])
    if stat == "wagons":
        return train_open(f)
    if stat == "fruit":
        return bool(f["trees"])
    if stat == "fish":
        return owned(f, "dock")
    if stat == "mine":
        return owned(f, "mine")
    return False


def events_open(f):
    return [k for k, e in EVENTS.items() if can_count(f, e["stat"])]


def event_now(f):
    """This week's event, or None below EVENT_LEVEL. A new week starts a new one, chosen
    among those the farm can do then, and kept all week (growing mid-week doesn't swap it)."""
    if f["level"] < EVENT_LEVEL:
        return None
    w = week_now()
    e = f["event"]
    if e is None or e["week"] != w:
        can = events_open(f)
        e = {"week": w, "kind": can[w % len(can)], "got": 0, "claimed": 0}
        f["event"] = e
    return e


def event_reached(e):
    """How many of the event's goals are reached."""
    return sum(1 for g in EVENTS[e["kind"]]["goals"] if e["got"] >= g)


def claim_event(f):
    """Collects the event's next prize: 'claimed', the prize and the levels it brought,
    or 'not yet'."""
    e = event_now(f)
    if e is None or e["claimed"] >= event_reached(e):
        return "not yet", None, []
    prize = EVENT_PRIZES[e["claimed"]]
    e["claimed"] += 1
    f["coins"] += prize["coins"]
    for k, n in prize["kit"].items():
        f["kit"][k] = f["kit"].get(k, 0) + n
    return "claimed", prize, add_xp(f, prize["xp"])


def to_claim(f):
    """How many prizes are waiting to be collected (achievements' tiers and the event's)."""
    n = sum(1 for k in ACHIEVEMENTS if award_ready(f, k))
    e = event_now(f)
    if e is not None:
        n += event_reached(e) - e["claimed"]
    return n


# ---- the seasons

def season_now():
    """'spring', 'summer', 'autumn' or 'winter', from the real calendar."""
    month = time.gmtime(now()).tm_mon
    return next(k for k, s in SEASONS.items() if month in s["months"])


def in_season(item):
    return item in SEASONS[season_now()]["likes"]


def season_weather():
    """What falls on the farm now: 'snow', 'leaves', 'rain' (spring's showers come and go
    on the clock) or None."""
    kind = SEASONS[season_now()]["weather"]
    if kind == "rain" and now() % SHOWER_EVERY >= SHOWER_LONG:
        return None
    return kind
