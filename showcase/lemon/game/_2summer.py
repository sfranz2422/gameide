# script: summer
# The business: a summer's weather and prices, stock, the recipe, what a customer
# thinks, and the day's ledger. No drawing here, and nothing that needs a room, so
# the tests (and a student) can try any of it on its own.
#
# The whole summer is one dict, global_vars.s, kept with save_set("summer", s)
# after every day, so a student can come back to it tomorrow. The weather and the
# prices aren't kept: they're made again from the summer's seed (summer_plan),
# the same every time, so a summer can't be replayed for better weather.
import math
import random


_plans = {}


def month_events(seed, m):
    """A month's heat wave, rainy spell and parade: the days each starts, in that month."""
    rng = random.Random(seed * 1000003 + m)
    heat_start = rng.randint(8, MONTH - HEAT_WAVE_DAYS - 2)
    rain_start = rng.randint(3, MONTH - RAINY_WEEK_DAYS - 1)
    while abs(rain_start - heat_start) < HEAT_WAVE_DAYS + 2:
        rain_start = rng.randint(3, MONTH - RAINY_WEEK_DAYS - 1)
    return heat_start, rain_start, rng.randint(10, MONTH - 3)


def day_plan(seed, d):
    """Day d's weather, forecast, prices and events: the same for the same seed and day,
    whichever day it's asked for first (each day has its own random numbers), so the days
    go on for ever and a reload can't bring better weather."""
    if (seed, d) in _plans:
        return _plans[(seed, d)]
    m, k = divmod(d, MONTH)
    heat_start, rain_start, parade = month_events(seed, m)
    rng = random.Random(seed * 7919 + d * 104729 + 1)
    temp = TEMP_MID + TEMP_ARC * math.sin(math.pi * k / (MONTH - 1)) + rng.uniform(-TEMP_NOISE, TEMP_NOISE)
    heat = heat_start <= k < heat_start + HEAT_WAVE_DAYS
    rainy_week = rain_start <= k < rain_start + RAINY_WEEK_DAYS
    if heat:
        temp += HEAT_WAVE_EXTRA
    r = rng.random()
    sky = "rain" if rainy_week or (not heat and r < RAIN_CHANCE) else "cloudy" if r < RAIN_CHANCE + CLOUD_CHANCE else "sunny"
    temp = round(temp - (6 if sky == "rain" else 0))
    # The forecast: near enough, but not always right.
    guess = temp + rng.randint(-FORECAST_TEMP_ERROR, FORECAST_TEMP_ERROR)
    rain_pct = {"rain": rng.choice([60, 70, 80, 90]), "cloudy": rng.choice([10, 20, 30, 40]), "sunny": rng.choice([0, 0, 10, 20])}[sky]
    prices = {k2: round(rng.uniform(low, high) / 5) * 5 for k2, _, _, _, low, high in SUPPLIES}
    rival = round(rng.uniform(*RIVAL_PRICE) / 5) * 5 if d >= 3 and rng.random() < RIVAL_CHANCE else None
    trouble = trouble_on(seed, d)            # bad luck: its own random numbers, so nothing above changes
    if trouble and trouble["kind"] == "lemon_shortage":
        prices["lemons"] = round(prices["lemons"] * SHORTAGE_PRICE / 5) * 5
    if trouble and trouble["kind"] == "sugar_shortage":
        prices["sugar"] = round(prices["sugar"] * SHORTAGE_PRICE / 5) * 5
    out = {"day": d, "temp": temp, "sky": sky, "forecast": guess, "rain_pct": rain_pct, "prices": prices,
           "heat": heat, "parade": k == parade, "rival": rival, "rainy_week": rainy_week, "trouble": trouble}
    _plans[(seed, d)] = out
    return out


def summer_plan(seed, start=0, n=MONTH):
    """n days' plans from day `start` (a month's, unless asked otherwise)."""
    return [day_plan(seed, d) for d in range(start, start + n)]


def new_summer(seed):
    return {"seed": seed, "day": 0, "money": START_MONEY, "rep": START_REP,
            "lemons": [], "sugar": 0, "ice": 0.0, "cups": 0, "pitcher": 0, "kernels": 0, "bags": 0, "popped": 0,
            "upgrades": [], "places": [0], "history": [], "news": None, "phase": "morning", "contract": None, "offer": None,
            "plan": {"buy": {"lemons": 2, "sugar": 1, "ice": 1, "cups": 2},
                     "lemons": 4, "sugar": 4, "ice": 3, "price": 100, "place": 0, "pink": False,
                     "frozen": False, "popcorn": True, "pop_price": 100, "ad": 0, "combo_on": False, "combo": COMBO_START,
                     "second": new_second()}}


def new_second():
    """The second stand's plan: shut until it's set up; where, its price, cups to send."""
    return {"open": False, "place": None, "price": 100, "cups": 40}


def bring_up_to_date(s):
    """A summer saved before an update, as this version keeps it. Summers used to end on
    day 30: one that ended goes on. The old Second stand made you pour faster; that's the
    Helper now, so a summer that bought it keeps it (and gets the stand elsewhere too)."""
    s.pop("finished", None)
    if "second" in s["upgrades"] and "helper" not in s["upgrades"]:
        s["upgrades"].append("helper")
    s["plan"].setdefault("second", new_second())
    # 2026-11-19: popcorn, frozen lemonade.
    for k in ("kernels", "bags", "popped"):
        s.setdefault(k, 0)
    for k, v in (("frozen", False), ("popcorn", True), ("pop_price", 100), ("ad", 0), ("combo_on", False),
                 ("combo", COMBO_START)):
        s["plan"].setdefault(k, v)
    s.setdefault("contract", None)
    s.setdefault("offer", None)
    return s


def today(s):
    return day_plan(s["seed"], s["day"])


def has(s, key):
    return key in s["upgrades"]


# ---- stock

def lemon_count(s):
    return sum(n for _, n in s["lemons"])


def use_lemons(s, n):
    """Takes n lemons, the oldest first (they'd go soft first). False, taking none, if there aren't n."""
    if lemon_count(s) < n:
        return False
    for b in s["lemons"]:
        took = min(b[1], n)
        b[1] -= took
        n -= took
    s["lemons"] = [b for b in s["lemons"] if b[1] > 0]
    return True


def lemon_days(s):
    """How many days a lemon keeps: longer in a mini fridge."""
    return FRIDGE_LEMON_DAYS if has(s, "fridge") else LEMON_DAYS


def soften(s):
    """Lemons too old to use are thrown out as a day starts: how many."""
    keeps = lemon_days(s)
    soft = sum(n for day, n in s["lemons"] if day <= s["day"] - keeps)
    s["lemons"] = [b for b in s["lemons"] if b[0] > s["day"] - keeps]
    return soft


def sell_combo(s, t):
    """A cup and a bag, paid for as one (combo_price)."""
    pour_cup(s, t, False)
    made = sell_bag(s, t, False)
    s["money"] += t["combo_price"]
    t["combo_income"] += t["combo_price"]
    t["combos"] += 1
    return made


def next_day(s):
    """Overnight: the ice melts (a cooler keeps half), the day moves on, old lemons go soft."""
    kept = COOLER_KEPT_OVERNIGHT if has(s, "cooler") else ICE_KEPT_OVERNIGHT
    melted = int(s["ice"]) - int(s["ice"] * kept)
    s["ice"] = float(int(s["ice"] * kept))
    made = ICE_MAKER_CUBES if has(s, "icemaker") else 0
    s["ice"] += made          # the ice maker's night's work, after the melting
    s["pitcher"] = 0          # yesterday's lemonade is poured away
    s["popped"] = 0           # ...and yesterday's popcorn has gone stale
    s["day"] += 1
    s["news"] = {"melted": melted, "soft": soften(s), "made_ice": made}
    s["offer"] = None            # an offer not taken is gone
    s["phase"] = "morning"


def shopping_cost(s, buy=None):
    prices = today(s)["prices"]
    buy = s["plan"]["buy"] if buy is None else buy
    pop = sum(buy.get(k, 0) * pop_prices(s)[k] for k in POP_KEYS)
    return sum(buy.get(k, 0) * prices[k] for k in SUPPLY_KEYS) + pop


def pop_prices(s):
    """Today's popcorn supply prices: the day's own, from the seed (like the others')."""
    rng = random.Random(s["seed"] * 6151 + s["day"] * 3571 + 9)
    return {k: round(rng.uniform(low, high) / 5) * 5 for k, _, _, _, low, high in POP_SUPPLIES}


def selling_pop(s):
    """Popcorn's on sale today: there's a machine, and it's switched on."""
    return has(s, "popcorn") and bool(s["plan"]["popcorn"])


def place_now(s):
    return PLACES[s["plan"]["place"]]


def open_stand(s):
    """
    The morning's shopping and the day's rent, paid as the stand opens. Returns
    a problem in words (and changes nothing) if it can't be paid for.
    """
    cost = shopping_cost(s)
    rent = place_now(s)["rent"]
    if s["plan"]["place"] not in s["places"]:
        return "You haven't started selling there yet."
    sec = second_open(s)
    if sec:
        problem = second_problem(s)
        if problem:
            return problem
    extra = PLACES[sec["place"]]["rent"] + SECOND_WAGE if sec else 0
    ad = ad_now(s)              # paid here; `extra` is the second stand's, paid as it's sent
    if cost + rent + extra + ad[2] > s["money"]:
        return (f"That costs {money(cost + rent + extra + ad[2])} with the rent" + (" and the helper" if sec else "")
                + (" and the ad" if ad[2] else "") + f", and you have {money(s['money'])}.")
    t = {"day": s["day"], "place": s["plan"]["place"], "money_start": s["money"], "supplies": cost, "rent": rent,
         "income": 0, "cups": 0, "passers": 0, "rep_start": s["rep"], "said": {v: 0 for v in VERDICTS},
         "soft": (s["news"] or {}).get("soft", 0), "melted": (s["news"] or {}).get("melted", 0),
         "price": s["plan"]["price"], "recipe": [s["plan"]["lemons"], s["plan"]["sugar"], s["plan"]["ice"]],
         "pink": bool(s["plan"]["pink"] and has(s, "pink")), "temp": today(s)["temp"], "sky": today(s)["sky"],
         "frozen": bool(s["plan"]["frozen"] and has(s, "blender")),
         "popcorn": selling_pop(s), "pop_price": s["plan"]["pop_price"], "pop_income": 0, "pop_bags": 0,
         "combo": combo_on(s), "combo_price": s["plan"]["combo"], "combos": 0, "combo_income": 0,
         "ad": ad[0], "ad_cost": ad[2]}
    s["money"] -= cost + rent + ad[2]
    packs = dict((x[0], x[2]) for x in SUPPLIES + POP_SUPPLIES)
    for k in SUPPLY_KEYS + POP_KEYS:
        n = s["plan"]["buy"].get(k, 0) * packs[k]
        if k == "lemons" and n:
            s["lemons"].append([s["day"], n])
        elif k == "ice":
            s["ice"] += n
        elif k != "lemons":
            s[k] += n
    # The shopping stays as it was, so tomorrow's starts from today's (the teacher's ask,
    # 2026-11-19: it used to start from nothing every morning).
    if sec:
        t["second"] = send_second(s, extra)
    t["contract"] = deliver_contract(s, t)
    s["phase"] = "day"
    return t


# ---- the second stand

def second_open(s):
    """The second stand's plan if it opens today (it's been bought and is set to open), else None."""
    sec = s["plan"]["second"]
    return sec if has(s, "second") and sec["open"] else None


def second_places(s):
    """Where the second stand can go: a place you sell at, not where your own stand is today."""
    return [i for i in sorted(s["places"]) if i != s["plan"]["place"]]


def second_needs(s, cups=None):
    """What it takes from your shelf for its cups, at your recipe: whole pitchers' lemons
    and sugar, the ice for every cup, and the cups."""
    cups = s["plan"]["second"]["cups"] if cups is None else cups
    pitchers = math.ceil(cups / CUPS_PER_PITCHER)
    return {"lemons": pitchers * lemons_a_pitcher(s), "sugar": pitchers * s["plan"]["sugar"],
            "ice": cups * s["plan"]["ice"], "cups": cups}


def shelf_after_shopping(s):
    """What the shelf will hold once the morning's shopping is in."""
    packs = dict((x[0], x[2]) for x in SUPPLIES)
    have = {"lemons": lemon_count(s), "sugar": s["sugar"], "ice": int(s["ice"]), "cups": s["cups"]}
    return {k: have[k] + s["plan"]["buy"].get(k, 0) * packs[k] for k in SUPPLY_KEYS}


def second_problem(s):
    """Why the second stand can't open as planned, in words, or None."""
    sec = s["plan"]["second"]
    if sec["place"] not in second_places(s):
        return "Choose where your second stand goes: another place you sell at."
    if sec["cups"] < 1:
        return "Send your second stand some cups to sell."
    shelf = shelf_after_shopping(s)
    names = dict((x[0], x[3]) for x in SUPPLIES)
    for k, n in second_needs(s).items():
        if n > shelf[k]:
            return f"Your second stand needs {n - shelf[k]} more {names[k]}: buy more, or send it fewer cups."
    return None


def send_second(s, cost):
    """Takes the second stand's stock off the shelf, and pays its rent and its helper (in
    `cost`, already counted in the morning's check). Its part of the day's ledger."""
    sec = s["plan"]["second"]
    need = second_needs(s)
    taken = []                       # the lemon batches it took, oldest first, so what's left goes back as it was
    n = need["lemons"]
    for b in s["lemons"]:
        took = min(b[1], n)
        if took:
            taken.append([b[0], took])
        b[1] -= took
        n -= took
    s["lemons"] = [b for b in s["lemons"] if b[1] > 0]
    s["sugar"] -= need["sugar"]
    s["ice"] -= need["ice"]
    s["cups"] -= need["cups"]
    rent = PLACES[sec["place"]]["rent"]
    s["money"] -= cost
    return {"place": sec["place"], "price": sec["price"], "sent": need, "lemon_batches": taken,
            "rent": rent, "wage": SECOND_WAGE, "cups": 0, "income": 0, "passers": 0,
            "said": {v: 0 for v in VERDICTS}, "back": None}


def run_second(s, t):
    """The second stand's day, worked out in one go as yours ends: who walks past its
    place, who buys (the same rules as at yours, with no rival there), what they think
    (your reputation is the same one), the ice melting in the sun. The day's own random
    numbers, so a reload can't sell more. What's left goes back on your shelf."""
    sec = t["second"]
    day = today(s)
    rng = random.Random(s["seed"] * 31337 + s["day"] * 7 + 3)
    at = sec["place"]
    sent = sec["sent"]
    per = lemons_a_pitcher(s)
    pitchers = min(sent["lemons"] // per if per else 10 ** 6, sent["sugar"] // s["plan"]["sugar"] if s["plan"]["sugar"] else 10 ** 6)
    can_pour = min(sent["cups"], pitchers * CUPS_PER_PITCHER, SECOND_MOST)
    melt = max(ICE_MELT_LOW, min(ICE_MELT_HIGH, ICE_MELT_LOW + (day["temp"] - 55) / 45 * (ICE_MELT_HIGH - ICE_MELT_LOW)))
    if has(s, "cooler"):
        melt *= COOLER_MELT
    ice_used = 0
    tt = {"price": sec["price"], "pink": t["pink"], "said": sec["said"]}
    times = sorted(rng.uniform(0, SPAWN_UNTIL) for _ in range(crowd_size(s, day, at)))
    for when in times:
        who = new_customer(s, day, rng, at)
        sec["passers"] += 1
        choice = decide(s, who, tt, 0, None, rng)
        if choice == "pricey":
            heard(s, tt, "pricey")
        if choice != "buy":
            continue
        ice_left = (sent["ice"] - ice_used) * (1 - melt * when)
        if sec["cups"] >= can_pour or ice_left < s["plan"]["ice"]:
            heard(s, tt, "thirsty")
            continue
        sec["cups"] += 1
        ice_used += s["plan"]["ice"]
        sec["income"] += sec["price"]
        heard(s, tt, verdict(t["recipe"], who, t["pink"]))
    s["money"] += sec["income"]
    # Back on the shelf: what wasn't used. Pitchers are made as needed, so only the
    # lemons and sugar of the pitchers poured come off; ice melted as the day went.
    used_pitchers = math.ceil(sec["cups"] / CUPS_PER_PITCHER)
    lemons_back = sent["lemons"] - used_pitchers * per
    back = {"lemons": lemons_back, "sugar": sent["sugar"] - used_pitchers * s["plan"]["sugar"],
            "ice": int(max(0, sent["ice"] - ice_used) * (1 - melt)), "cups": sent["cups"] - sec["cups"]}
    # The lemons come back newest first: the oldest went into the pitchers.
    n = lemons_back
    for b in reversed(sec["lemon_batches"]):
        give = min(b[1], n)
        if give:
            s["lemons"].append([b[0], give])
        n -= give
    s["lemons"].sort(key=lambda b: b[0])
    s["sugar"] += back["sugar"]
    s["ice"] += back["ice"]
    s["cups"] += back["cups"]
    sec["back"] = back


def cups_from(s, stock):
    """About how many cups a stock makes at today's recipe: whatever runs out first."""
    big = 10 ** 6
    per = lemons_a_pitcher(s)
    pitchers = min(stock["lemons"] // per if per else big, stock["sugar"] // s["plan"]["sugar"] if s["plan"]["sugar"] else big)
    ice = stock["ice"] // s["plan"]["ice"] if s["plan"]["ice"] else big
    return max(0, min(stock["cups"], pitchers * CUPS_PER_PITCHER, ice))


def lemons_a_pitcher(s):
    n = s["plan"]["lemons"]
    if has(s, "juicer") and n > 0:
        return max(1, math.ceil(n * JUICER_SAVES))
    return n


def why_not(s):
    """Why the next cup can't be poured, in words, or None if it can."""
    if s["cups"] < 1:
        return "No cups left!"
    if s["ice"] < s["plan"]["ice"]:
        return "No ice left!"
    if s["pitcher"] == 0:
        if lemon_count(s) < lemons_a_pitcher(s):
            return "No lemons left!"
        if s["sugar"] < s["plan"]["sugar"]:
            return "No sugar left!"
    return None


def pour_cup(s, t, charge=True):
    """Sells one cup (why_not said it can). Returns True if a new pitcher had to be made first.
    charge=False: part of a combo, paid for as one."""
    made = False
    if s["pitcher"] == 0:
        use_lemons(s, lemons_a_pitcher(s))
        s["sugar"] -= s["plan"]["sugar"]
        s["pitcher"] = CUPS_PER_PITCHER
        made = True
    s["pitcher"] -= 1
    s["cups"] -= 1
    s["ice"] -= s["plan"]["ice"]
    if charge:
        s["money"] += t["price"]
        t["income"] += t["price"]
    t["cups"] += 1
    return made


# ---- popcorn

def pop_why_not(s):
    """Why the next bag of popcorn can't be handed over, in words, or None if it can."""
    if s["bags"] < 1:
        return "No popcorn bags left!"
    if s["popped"] == 0 and s["kernels"] < 1:
        return "No popcorn kernels left!"
    return None


def pop_would_pay(s, who):
    """The most they'd pay for a bag, in cents."""
    return int(who["budget"] * POP_PAY * (0.85 + PAY_REP * s["rep"]))


def wants_popcorn(s, who, t, rng=random):
    """Whether a passer-by stops for popcorn: on sale today, they notice you, they fancy
    some (kids more often), at a price they'd pay. Hot or cold, popcorn sells."""
    if not t.get("popcorn"):
        return False
    notice = NOTICE + (NOTICE_SIGN if has(s, "sign") else 0) + NOTICE_REP * s["rep"]
    if rng.random() > notice:
        return False
    if rng.random() > (POP_WANT_KID if CUSTOMERS[who["kind"]]["kid"] else POP_WANT):
        return False
    return pop_would_pay(s, who) >= t["pop_price"]


def salted(who):
    """Popcorn's salt: someone eating it is thirstier."""
    who["thirst"] = min(1.0, who["thirst"] + POP_THIRST)


def sell_bag(s, t, charge=True):
    """Sells one bag (pop_why_not said it can). True if a new batch had to be popped first.
    charge=False: part of a combo."""
    made = False
    if s["popped"] == 0:
        n = min(POP_BATCH, s["kernels"])
        s["kernels"] -= n
        s["popped"] = n
        made = True
    s["popped"] -= 1
    s["bags"] -= 1
    if charge:
        s["money"] += t["pop_price"]
        t["pop_income"] += t["pop_price"]
    t["pop_bags"] += 1
    return made


def melt_ice(s, temp, steps):
    """The ice in the sun: a share of it over the whole day, by temperature (a cooler halves it)."""
    share = max(ICE_MELT_LOW, min(ICE_MELT_HIGH, ICE_MELT_LOW + (temp - 55) / 45 * (ICE_MELT_HIGH - ICE_MELT_LOW)))
    if has(s, "cooler"):
        share *= COOLER_MELT
    s["ice"] = max(0.0, s["ice"] * (1 - share * steps / DAY_STEPS))


# ---- customers

def thirst_for(temp, rng=random):
    return max(0.0, min(1.0, (temp - THIRST_LOW) / (THIRST_HIGH - THIRST_LOW) + rng.uniform(-0.25, 0.25)))


def new_customer(s, day, rng=random, at=None):
    """Who's walking by (at your stand, or `at` another place): their kind, thirst,
    budget (cents) and taste."""
    place = PLACES[s["plan"]["place"] if at is None else at]
    kind = rng.choice(place["types"])
    c = CUSTOMERS[kind]
    temp = day["temp"]
    return {"kind": kind, "thirst": thirst_for(temp, rng),
            "budget": round(rng.uniform(*place["budget"]) * c["budget"]),
            "lemons": 4 + rng.choice([-1, 0, 0, 1]),
            "sugar": 4 + rng.choice([-1, 0, 0, 1]) + (1 if c["kid"] else 0),
            "ice": (2 if temp < 70 else 4 if temp < 88 else 5) + rng.choice([-1, 0, 1]),
            "fan": rng.random() < PINK_FANS}


def would_pay(s, who, pink, frozen=False):
    """The most they'd pay for a cup today, in cents (frozen: more on a hot day)."""
    pay = who["budget"] * (PAY_BASE + PAY_THIRST * who["thirst"]) * (0.85 + PAY_REP * s["rep"])
    if pink and who["fan"]:
        pay *= PINK_PAYS
    if frozen and today(s)["temp"] >= FROZEN_FROM:
        pay *= FROZEN_PAYS
    return int(pay)


def decide(s, who, t, queue, rival, rng=random):
    """
    What a passer-by does: "pass" (not thirsty, or didn't notice), "pricey" (wanted
    one, not at that price), "rival" (went to the cheaper stand), "full" (the queue's
    too long), or "buy".
    """
    if who["thirst"] < THIRSTY_ENOUGH:
        return "pass"
    notice = NOTICE + (NOTICE_SIGN if has(s, "sign") else 0) + NOTICE_REP * s["rep"]
    if rng.random() > notice:
        return "pass"
    if would_pay(s, who, t["pink"], t.get("frozen", False)) < t["price"]:
        return "pricey"
    if rival is not None and rival < t["price"] and rng.random() < RIVAL_STEALS:
        return "rival"
    if queue >= QUEUE_MAX + (QUEUE_SECOND_STAND if has(s, "helper") else 0):
        return "full"
    return "buy"


def verdict(recipe, who, pink=False, frozen=False):
    """What they think of it: lemons a pitcher, scoops a pitcher, cubes a cup, against what they
    like. Frozen lemonade is never too warm."""
    lemons, sugar, ice = recipe
    if lemons <= who["lemons"] - TASTE_SLACK:
        return "watery"
    if sugar >= who["sugar"] + TASTE_SLACK and sugar - who["sugar"] >= lemons - who["lemons"]:
        return "sweet"
    if lemons >= who["lemons"] + TASTE_SLACK or sugar <= who["sugar"] - TASTE_SLACK:
        return "sour"
    if ice <= who["ice"] - TASTE_SLACK and not frozen:
        return "warm"
    return "love" if pink and who["fan"] else "perfect"


def heard(s, t, said):
    """A customer said something: count it, and move the reputation."""
    t["said"][said] += 1
    s["rep"] = max(0.0, min(1.0, s["rep"] + REP_CHANGE[said]))


def crowd_size(s, day=None, at=None):
    """How many walk past the stand today (yours, or one at `at`, another place)."""
    day = day or today(s)
    place = place_now(s) if at is None else PLACES[at]
    temp = max(CROWD_TEMP_LOW, min(CROWD_TEMP_HIGH, CROWD_TEMP_LOW + (day["temp"] - 60) / 40 * (CROWD_TEMP_HIGH - CROWD_TEMP_LOW)))
    sky = place["rain"] if day["sky"] == "rain" else SKY_CROWD[day["sky"]]
    n = place["crowd"] * temp * sky * (CROWD_REP_BASE + CROWD_REP * s["rep"])
    if has(s, "sign"):
        n *= SIGN_CROWD
    if day["parade"] and place["key"] == "downtown":
        n *= PARADE_CROWD
    n *= trouble_crowd(day, PLACES.index(place))
    if at is None:
        n *= ad_now(s)[3]            # an ad brings people to your own stand
    return max(3, round(n))


# ---- the evening

def end_day(s, t):
    """The day's ledger, kept in the history. Money at the end is money at the start,
    less what was spent, plus what came in (at both stands)."""
    sec = t.get("second")
    if sec is not None:
        run_second(s, t)
    settle_contract(s, t)
    t["inspector"] = inspect(s, t)
    t["money_end"] = s["money"]
    t["profit"] = (t["income"] + t.get("pop_income", 0) + t.get("combo_income", 0) - t["supplies"] - t["rent"]
                   - t.get("ad_cost", 0))
    c = t.get("contract")
    if c and c["done"]:
        t["profit"] += c["pay"]
    if t["inspector"] == "fined":
        t["profit"] -= t["fine"]
    if sec is not None:
        t["profit"] += sec["income"] - sec["rent"] - sec["wage"]
    t["rep_end"] = s["rep"]
    t["left"] = {"lemons": lemon_count(s), "sugar": s["sugar"], "ice": int(s["ice"]), "cups": s["cups"],
                 "kernels": s["kernels"], "bags": s["bags"]}
    s["history"].append(t)
    s["offer"] = contract_offer(s, s["day"] + 1)     # tomorrow's, if any: taken or left in the evening
    s["phase"] = "evening"
    return t


def buy_upgrade(s, key):
    cost = next(u[2] for u in UPGRADES if u[0] == key)
    if has(s, key) or s["money"] < cost:
        return False
    s["money"] -= cost
    s["upgrades"].append(key)
    return True


def unlock_place(s, i):
    cost = PLACES[i]["unlock"]
    if i in s["places"] or s["money"] < cost:
        return False
    s["money"] -= cost
    s["places"].append(i)
    return True


def stars(rep):
    """Reputation as stars out of five, in halves."""
    return round(rep * 10) / 2


def best_day(s):
    return max(s["history"], key=lambda t: t["profit"]) if s["history"] else None


def keep(s):
    save_set("summer", s)
