# script: extras
# The teacher's list (2026-11-19), part 1: advertising, snack combos, contracts, bad
# luck days and the Monday paper. Like the summer script: no drawing, nothing that
# needs a room, so the tests (and a student) can try any of it on its own.
import math
import random


# ---- advertising

def ad_now(s):
    """Today's ad: (key, name, cost, crowd ×)."""
    return ADS[s["plan"].get("ad", 0)]


# ---- snack combos

def combo_on(s):
    """A combo's offered today: popcorn's on sale, and a combo price is set."""
    return selling_pop(s) and s["plan"].get("combo_on", False)


def takes_combo(s, who, t, lem, pop):
    """Someone buying one of the two: do they take the combo instead? Only if what it
    costs on top is no more than COMBO_PULL × what they'd pay for the other."""
    if not t.get("combo") or lem == pop:
        return False
    if lem:
        extra = t["combo_price"] - t["price"]
        other = pop_would_pay(s, who)
    else:
        extra = t["combo_price"] - t["pop_price"]
        other = would_pay(s, who, t["pink"], t.get("frozen", False))
    return extra <= COMBO_PULL * other


# ---- contracts

def contract_offer(s, d):
    """The offer that comes the evening before day d, or None: the summer's seed and the
    day alone, so a reload can't bring a better one. Only kinds you can make."""
    if d < CONTRACT_FROM:
        return None
    rng = random.Random(s["seed"] * 7717 + d * 2903 + 5)
    if rng.random() > CONTRACT_CHANCE:
        return None
    kinds = [c for c in CONTRACTS if c[5] is None or has(s, c[5])]
    kind, who, cups, each, bags, needs = rng.choice(kinds)
    n = rng.randint(*cups)
    pay = round(rng.uniform(*each) / 5) * 5
    m = rng.randint(*bags) if bags[1] else 0
    return {"day": d, "kind": kind, "who": who, "cups": n, "each": pay, "bags": m,
            "pink": needs == "pink", "pay": n * pay + m * CONTRACT_BAG_PAY}


def contract_words(c):
    what = f"{c['cups']} cups" + (" of pink lemonade" if c["pink"] else "") + (f" and {c['bags']} bags of popcorn" if c["bags"] else "")
    return f"{c['who']} wants {what} tomorrow, for {money(c['pay'])}."


def contract_today(s):
    """The contract accepted for today, or None."""
    c = s.get("contract")
    return c if c is not None and c["day"] == s["day"] else None


def contract_needs(s, c):
    """What a contract takes from the shelf, at your recipe."""
    need = second_needs(s, c["cups"])
    need["kernels"] = c["bags"]
    need["bags"] = c["bags"]
    return need


def planned_shelf(s):
    """The shelf once the morning's shopping is in and the second stand has taken its
    share: what a contract can have."""
    packs = dict((x[0], x[2]) for x in POP_SUPPLIES)
    shelf = shelf_after_shopping(s)
    for k in POP_KEYS:
        shelf[k] = s[k] + s["plan"]["buy"].get(k, 0) * packs[k]
    if second_open(s):
        for k, n in second_needs(s).items():
            shelf[k] -= n
    return shelf


def shelf_now(s):
    return {"lemons": lemon_count(s), "sugar": s["sugar"], "ice": int(s["ice"]), "cups": s["cups"],
            "kernels": s["kernels"], "bags": s["bags"]}


def contract_short(s, c, shelf=None):
    """What's missing for the contract, in words, or None: on `shelf`, or the shelf the
    morning plans (planned_shelf)."""
    if c["pink"] and not (has(s, "pink") and s["plan"]["pink"]):
        return "it wants pink lemonade: choose Pink"
    shelf = planned_shelf(s) if shelf is None else shelf
    names = dict((x[0], x[3]) for x in SUPPLIES + POP_SUPPLIES)
    for k, n in contract_needs(s, c).items():
        if n > shelf.get(k, 0):
            return f"{n - shelf.get(k, 0)} more {names[k]}"
    return None


def deliver_contract(s, t):
    """As the stand opens: takes the contract's stock off the shelf, or it falls through.
    Its part of the day's ledger."""
    c = contract_today(s)
    if c is None:
        return None
    short = contract_short(s, c, shelf_now(s))    # the shopping's in, the second stand's share gone
    out = dict(c, done=short is None, why=short)
    if short is None:
        need = contract_needs(s, c)
        use_lemons(s, need["lemons"])
        for k in ("sugar", "cups", "kernels", "bags"):
            s[k] -= need[k]
        s["ice"] -= need["ice"]
    return out


def settle_contract(s, t):
    """In the evening: paid, or the reputation it cost."""
    c = t.get("contract")
    if c is None:
        return
    if c["done"]:
        s["money"] += c["pay"]
        s["rep"] = min(1.0, s["rep"] + CONTRACT_DONE_REP)
    else:
        s["rep"] = max(0.0, s["rep"] + CONTRACT_FAIL_REP)


# ---- bad luck

def trouble_on(seed, d):
    """Day d's bad luck, or None: (kind, place index for wasps and roadworks). Its own
    random numbers, so it changes nothing else about the day."""
    if d < TROUBLE_FROM:
        return None
    rng = random.Random(seed * 4093 + d * 6247 + 17)
    if rng.random() > TROUBLE_CHANCE:
        return None
    return {"kind": rng.choice(TROUBLES), "place": rng.randrange(len(PLACES))}


def trouble_crowd(day, at):
    """What bad luck leaves of a place's crowd."""
    tr = day.get("trouble")
    if tr and tr["place"] == at:
        return WASPS_CROWD if tr["kind"] == "wasps" else ROADWORKS_CROWD if tr["kind"] == "roadworks" else 1.0
    return 1.0


def trouble_words(day):
    tr = day.get("trouble")
    if not tr:
        return []
    where = PLACES[tr["place"]]["name"]
    return {"lemon_shortage": ["Lemon shortage: lemons cost", "twice as much today."],
            "sugar_shortage": ["Sugar shortage: sugar costs", "twice as much today."],
            "wasps": [f"Wasps at {where}!", "Fewer people will stop there."],
            "roadworks": [f"Roadworks at {where}:", "the crowds go elsewhere."],
            "inspector": ["The health inspector visits:", f"{INSPECTOR_ICE}+ cubes a cup, or a cooler."]}[tr["kind"]]


def inspect(s, t):
    """The health inspector's verdict, in the evening, or None: passed (cold enough) or a fine.
    The fine is at most what you have (it once left a summer at -$9.45, with nothing to buy
    anything with ever again); what was taken is t["fine"]."""
    tr = today(s).get("trouble")
    if not tr or tr["kind"] != "inspector":
        return None
    passed = has(s, "cooler") or s["plan"]["ice"] >= INSPECTOR_ICE
    if passed:
        s["rep"] = min(1.0, s["rep"] + INSPECTOR_PASS_REP)
    else:
        t["fine"] = min(INSPECTOR_FINE, max(0, s["money"]))
        s["money"] -= t["fine"]
        s["rep"] = max(0.0, s["rep"] + INSPECTOR_FAIL_REP)
    return "passed" if passed else "fined"


# ---- the Monday paper

def paper_due(s):
    """Monday morning (every WEEK days), and not read yet."""
    return s["day"] > 0 and s["day"] % WEEK == 0 and s.get("paper_read") != s["day"]


def price_trend(s, k):
    """This week's average price of a supply against last week's: (now, then, % change)."""
    d = s["day"]
    now_ = sum(day_plan(s["seed"], x)["prices"][k] for x in range(d, d + WEEK)) / WEEK
    then = sum(day_plan(s["seed"], x)["prices"][k] for x in range(max(0, d - WEEK), d)) / WEEK
    return now_, then, round((now_ - then) / then * 100) if then else 0


def week_ahead(s):
    """The week's news, from the forecasts (what a forecast would know): (day, words)."""
    out = []
    for x in range(s["day"], s["day"] + WEEK):
        p = day_plan(s["seed"], x)
        name = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(x - s["day"]) % 7]
        if p["heat"] and (x == s["day"] or not day_plan(s["seed"], x - 1)["heat"]):
            out.append((name, "a heat wave begins"))
        if p["rainy_week"] and (x == s["day"] or not day_plan(s["seed"], x - 1)["rainy_week"]):
            out.append((name, "a rainy spell begins"))
        if p["parade"]:
            out.append((name, "parade downtown"))
        if p["rival"] is not None:
            out.append((name, f"a rival stand, at {money(p['rival'])}"))
        tr = p.get("trouble")
        if tr:
            # A headline of its own: the forecast's first line was half a sentence here.
            where = PLACES[tr["place"]]["name"]
            out.append((name, {"lemon_shortage": "a lemon shortage (dear lemons)", "sugar_shortage": "a sugar shortage (dear sugar)",
                               "wasps": f"wasps at {where}", "roadworks": f"roadworks at {where}",
                               "inspector": "the health inspector visits"}[tr["kind"]]))
    return out


def last_week(s):
    """Last week's days: (cups, profit, best day's profit)."""
    days = s["history"][-WEEK:]
    if not days:
        return None
    return (sum(h["cups"] for h in days), sum(h["profit"] for h in days), max(h["profit"] for h in days))
