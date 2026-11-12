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


def summer_plan(seed):
    """Each day's weather, forecast, prices and events, the same for the same seed."""
    rng = random.Random(seed)
    heat_start = rng.randint(8, DAYS - HEAT_WAVE_DAYS - 2)
    rain_start = rng.randint(3, DAYS - RAINY_WEEK_DAYS - 1)
    while abs(rain_start - heat_start) < HEAT_WAVE_DAYS + 2:
        rain_start = rng.randint(3, DAYS - RAINY_WEEK_DAYS - 1)
    parade = rng.randint(10, DAYS - 3)
    days = []
    for d in range(DAYS):
        temp = TEMP_MID + TEMP_ARC * math.sin(math.pi * d / (DAYS - 1)) + rng.uniform(-TEMP_NOISE, TEMP_NOISE)
        heat = heat_start <= d < heat_start + HEAT_WAVE_DAYS
        rainy_week = rain_start <= d < rain_start + RAINY_WEEK_DAYS
        if heat:
            temp += HEAT_WAVE_EXTRA
        r = rng.random()
        sky = "rain" if rainy_week or (not heat and r < RAIN_CHANCE) else "cloudy" if r < RAIN_CHANCE + CLOUD_CHANCE else "sunny"
        temp = round(temp - (6 if sky == "rain" else 0))
        # The forecast: near enough, but not always right.
        guess = temp + rng.randint(-FORECAST_TEMP_ERROR, FORECAST_TEMP_ERROR)
        rain_pct = {"rain": rng.choice([60, 70, 80, 90]), "cloudy": rng.choice([10, 20, 30, 40]), "sunny": rng.choice([0, 0, 10, 20])}[sky]
        prices = {k: round(rng.uniform(low, high) / 5) * 5 for k, _, _, _, low, high in SUPPLIES}
        rival = round(rng.uniform(*RIVAL_PRICE) / 5) * 5 if d >= 3 and rng.random() < RIVAL_CHANCE else None
        days.append({"day": d, "temp": temp, "sky": sky, "forecast": guess, "rain_pct": rain_pct, "prices": prices,
                     "heat": heat, "parade": d == parade, "rival": rival, "rainy_week": rainy_week})
    return days


def new_summer(seed):
    return {"seed": seed, "day": 0, "money": START_MONEY, "rep": START_REP,
            "lemons": [], "sugar": 0, "ice": 0.0, "cups": 0, "pitcher": 0,
            "upgrades": [], "places": [0], "history": [], "news": None, "phase": "morning", "finished": False,
            "plan": {"buy": {"lemons": 2, "sugar": 1, "ice": 1, "cups": 2},
                     "lemons": 4, "sugar": 4, "ice": 3, "price": 100, "place": 0, "pink": False}}


def plan_of(s):
    return summer_plan(s["seed"])


def today(s):
    return plan_of(s)[s["day"]]


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


def soften(s):
    """Lemons too old to use are thrown out as a day starts: how many."""
    soft = sum(n for day, n in s["lemons"] if day <= s["day"] - LEMON_DAYS)
    s["lemons"] = [b for b in s["lemons"] if b[0] > s["day"] - LEMON_DAYS]
    return soft


def next_day(s):
    """Overnight: the ice melts (a cooler keeps half), the day moves on, old lemons go soft."""
    kept = COOLER_KEPT_OVERNIGHT if has(s, "cooler") else ICE_KEPT_OVERNIGHT
    melted = int(s["ice"]) - int(s["ice"] * kept)
    s["ice"] = float(int(s["ice"] * kept))
    s["pitcher"] = 0          # yesterday's lemonade is poured away
    s["day"] += 1
    s["news"] = {"melted": melted, "soft": soften(s)}
    s["phase"] = "morning"


def shopping_cost(s, buy=None):
    prices = today(s)["prices"]
    buy = s["plan"]["buy"] if buy is None else buy
    return sum(buy.get(k, 0) * prices[k] for k in SUPPLY_KEYS)


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
    if cost + rent > s["money"]:
        return f"That costs {money(cost + rent)} with the rent, and you have {money(s['money'])}."
    t = {"day": s["day"], "place": s["plan"]["place"], "money_start": s["money"], "supplies": cost, "rent": rent,
         "income": 0, "cups": 0, "passers": 0, "rep_start": s["rep"], "said": {v: 0 for v in VERDICTS},
         "soft": (s["news"] or {}).get("soft", 0), "melted": (s["news"] or {}).get("melted", 0),
         "price": s["plan"]["price"], "recipe": [s["plan"]["lemons"], s["plan"]["sugar"], s["plan"]["ice"]],
         "pink": bool(s["plan"]["pink"] and has(s, "pink")), "temp": today(s)["temp"], "sky": today(s)["sky"]}
    s["money"] -= cost + rent
    for k in SUPPLY_KEYS:
        n = s["plan"]["buy"].get(k, 0) * dict((x[0], x[2]) for x in SUPPLIES)[k]
        if k == "lemons" and n:
            s["lemons"].append([s["day"], n])
        elif k == "ice":
            s["ice"] += n
        elif k != "lemons":
            s[k] += n
    s["plan"]["buy"] = {k: 0 for k in SUPPLY_KEYS}    # bought: tomorrow starts from nothing
    s["phase"] = "day"
    return t


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


def pour_cup(s, t):
    """Sells one cup (why_not said it can). Returns True if a new pitcher had to be made first."""
    made = False
    if s["pitcher"] == 0:
        use_lemons(s, lemons_a_pitcher(s))
        s["sugar"] -= s["plan"]["sugar"]
        s["pitcher"] = CUPS_PER_PITCHER
        made = True
    s["pitcher"] -= 1
    s["cups"] -= 1
    s["ice"] -= s["plan"]["ice"]
    s["money"] += t["price"]
    t["income"] += t["price"]
    t["cups"] += 1
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


def new_customer(s, day, rng=random):
    """Who's walking by: their kind, thirst, budget (cents) and taste."""
    place = PLACES[s["plan"]["place"]]
    kind = rng.choice(place["types"])
    c = CUSTOMERS[kind]
    temp = day["temp"]
    return {"kind": kind, "thirst": thirst_for(temp, rng),
            "budget": round(rng.uniform(*place["budget"]) * c["budget"]),
            "lemons": 4 + rng.choice([-1, 0, 0, 1]),
            "sugar": 4 + rng.choice([-1, 0, 0, 1]) + (1 if c["kid"] else 0),
            "ice": (2 if temp < 70 else 4 if temp < 88 else 5) + rng.choice([-1, 0, 1]),
            "fan": rng.random() < PINK_FANS}


def would_pay(s, who, pink):
    """The most they'd pay for a cup today, in cents."""
    pay = who["budget"] * (PAY_BASE + PAY_THIRST * who["thirst"]) * (0.85 + PAY_REP * s["rep"])
    if pink and who["fan"]:
        pay *= PINK_PAYS
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
    if would_pay(s, who, t["pink"]) < t["price"]:
        return "pricey"
    if rival is not None and rival < t["price"] and rng.random() < RIVAL_STEALS:
        return "rival"
    if queue >= QUEUE_MAX + (QUEUE_SECOND_STAND if has(s, "second") else 0):
        return "full"
    return "buy"


def verdict(recipe, who, pink=False):
    """What they think of it: lemons a pitcher, scoops a pitcher, cubes a cup, against what they like."""
    lemons, sugar, ice = recipe
    if lemons <= who["lemons"] - TASTE_SLACK:
        return "watery"
    if sugar >= who["sugar"] + TASTE_SLACK and sugar - who["sugar"] >= lemons - who["lemons"]:
        return "sweet"
    if lemons >= who["lemons"] + TASTE_SLACK or sugar <= who["sugar"] - TASTE_SLACK:
        return "sour"
    if ice <= who["ice"] - TASTE_SLACK:
        return "warm"
    return "love" if pink and who["fan"] else "perfect"


def heard(s, t, said):
    """A customer said something: count it, and move the reputation."""
    t["said"][said] += 1
    s["rep"] = max(0.0, min(1.0, s["rep"] + REP_CHANGE[said]))


def crowd_size(s, day=None):
    """How many walk past the stand today."""
    day = day or today(s)
    place = place_now(s)
    temp = max(CROWD_TEMP_LOW, min(CROWD_TEMP_HIGH, CROWD_TEMP_LOW + (day["temp"] - 60) / 40 * (CROWD_TEMP_HIGH - CROWD_TEMP_LOW)))
    sky = place["rain"] if day["sky"] == "rain" else SKY_CROWD[day["sky"]]
    n = place["crowd"] * temp * sky * (CROWD_REP_BASE + CROWD_REP * s["rep"])
    if has(s, "sign"):
        n *= SIGN_CROWD
    if day["parade"] and place["key"] == "downtown":
        n *= PARADE_CROWD
    return max(3, round(n))


# ---- the evening

def end_day(s, t):
    """The day's ledger, kept in the history. Money at the end is money at the start, less what was spent, plus what came in."""
    t["money_end"] = s["money"]
    t["profit"] = t["income"] - t["supplies"] - t["rent"]
    t["rep_end"] = s["rep"]
    t["left"] = {"lemons": lemon_count(s), "sugar": s["sugar"], "ice": int(s["ice"]), "cups": s["cups"]}
    s["history"].append(t)
    s["phase"] = "evening"
    if s["day"] >= DAYS - 1:
        s["finished"] = True
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
