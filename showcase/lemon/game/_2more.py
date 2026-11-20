# script: more
# The teacher's list (2026-11-19), part 2: hot cocoa, staff, the stand's own upgrades, and
# goals and trophies. (Seasons are in day_plan, the summer script.) No drawing here.
import random


# ---- hot cocoa

def selling_cocoa(s):
    return has(s, "cocoa") and bool(s["plan"].get("cocoa_on", True))


def chill(temp):
    """How cold it is, 0 (warm) to 1 (bitter): how much people want cocoa."""
    return max(0.0, min(1.0, (COCOA_FROM - temp) / COCOA_RANGE))


def cocoa_would_pay(s, who, temp):
    a, b = COCOA_PAY
    return int(who["budget"] * (a + b * chill(temp)) * (0.85 + PAY_REP * s["rep"]))


def wants_cocoa(s, who, t, rng=random):
    """Whether a passer-by stops for a mug: on sale, they notice you, it's cold enough for
    them to fancy one, at a price they'd pay."""
    if not t.get("cocoa"):
        return False
    if rng.random() > notice_chance(s):
        return False
    c = chill(t["temp"])
    if c <= 0 or rng.random() > COCOA_WANT * c:
        return False
    return cocoa_would_pay(s, who, t["temp"]) >= t["cocoa_price"]


def cocoa_why_not(s):
    if s["cups"] < 1:
        return "No cups left!"
    if s["cocoa"] < 1:
        return "No cocoa mix left!"
    return None


def sell_cocoa(s, t):
    s["cocoa"] -= 1
    s["cups"] -= 1
    s["money"] += t["cocoa_price"]
    t["cocoa_income"] += t["cocoa_price"]
    t["cocoa_cups"] += 1


# ---- noticing the stand (the stand's own upgrades make it easier)

def notice_chance(s):
    return NOTICE + (NOTICE_SIGN if has(s, "sign") else 0) + NOTICE_REP * s["rep"] + STAND_TIERS[s.get("tier", 0)]["notice"]


# ---- staff

def staff_level(s, who):
    return s.get("staff", {}).get(who, 1)


def can_train(s, who):
    """None if a staff member can be trained now, or why not in words."""
    if not has(s, who):
        return "Buy the " + ("Helper" if who == "helper" else "Second stand") + " first."
    lv = staff_level(s, who)
    if lv >= STAFF_TOP:
        return "As good as they get!"
    if s["money"] < TRAIN_COST[lv]:
        return f"Training costs {money(TRAIN_COST[lv])}."
    return None


def train(s, who):
    why = can_train(s, who)
    if why:
        return why
    lv = staff_level(s, who)
    s["money"] -= TRAIN_COST[lv]
    s.setdefault("staff", {})[who] = lv + 1
    return "trained"


def second_most(s):
    """How many cups the second stand's helper can pour in a day."""
    return SECOND_MOST + TRAIN_SECOND_MORE * (staff_level(s, "second") - 1)


# ---- the stand itself

def tier_now(s):
    return STAND_TIERS[s.get("tier", 0)]


def next_tier(s):
    t = s.get("tier", 0) + 1
    return STAND_TIERS[t] if t < len(STAND_TIERS) else None


def buy_tier(s):
    nxt = next_tier(s)
    if nxt is None or s["money"] < nxt["cost"]:
        return False
    s["money"] -= nxt["cost"]
    s["tier"] = s.get("tier", 0) + 1
    return True


# ---- goals and trophies

def goal_value(s, key):
    """How far along a goal is, from the history and the summer."""
    h = s["history"]
    if key == "cups":
        return sum(t["cups"] + (t["second"]["cups"] if t.get("second") else 0) for t in h)
    if key == "best_day":
        return max([0] + [t["profit"] for t in h])
    if key == "money":
        return s["money"]
    if key == "stars":
        return stars(s["rep"])
    if key == "places":
        return len(s["places"])
    if key == "contracts":
        return sum(1 for t in h if t.get("contract") and t["contract"]["done"])
    if key == "popcorn":
        return sum(t.get("pop_bags", 0) for t in h)
    if key == "cocoa":
        return sum(t.get("cocoa_cups", 0) for t in h)
    if key == "combos":
        return sum(t.get("combos", 0) for t in h)
    if key == "days":
        return len(h)
    return 0


def trophies_won(s, key):
    return s.get("trophies", {}).get(key, 0)


def award_trophies(s):
    """Every trophy newly reached: won, its prize paid. [(goal's name, tier 0-2), …]."""
    won = []
    for key, name, _, goals, _ in GOALS:
        have = trophies_won(s, key)
        v = goal_value(s, key)
        while have < len(goals) and v >= goals[have]:
            s["money"] += TROPHY_PRIZE[have]
            won.append((name, have))
            have += 1
        s.setdefault("trophies", {})[key] = have
    return won


def goal_words(key, n):
    unit = next(g[4] for g in GOALS if g[0] == key)
    return money(n) if unit == "money" else (f"{n:g}" if isinstance(n, float) else str(n))
