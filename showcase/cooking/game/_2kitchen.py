# script: kitchen
# The rules of a day in the kitchen, all in one place: what each tap does, how food
# cooks and burns, which plate a part goes on, serving, tips and stars. The objects
# on screen (Cooker, Source, Plate, Shelf, Bin, Customer) only draw and call tap();
# a click, a tap on a phone, Space on the keys' box and the bot in the tests all
# end up here, so they can't play by different rules.
#
# A day is one dict, global_vars.k:
#   rest, day             which restaurant (index) and which day (from 0)
#   t                     steps since opening
#   ups                   the upgrades owned here
#   cookers               [{"key", "slots": [{"item", "t"}]}]   t is None when empty
#   plates                [None or {"parts": [...]}]            what's built on each
#   sel                   the plate a new part goes to first
#   shelf                 [None or item]                        sides and drinks, ready
#   arrivals              [(step, kind, order)]                 still to come, in order
#   coins, served, lost, tips, burnt, combo, best_combo, goal (the most the day could make: every
#                         order paid for with the biggest plain tip)
import random


def rest_of(k):
    return RESTAURANTS[k["rest"]]


def on_menu(r, day, name):
    """Is this food (or part, or drink) on the menu yet on day `day`?"""
    first = RESTAURANTS[r]["intro"].get(name)
    return first is not None and day >= first


# ---- orders

def make_order(r, day, rng):
    """One customer's order: the dish's parts, and the extras (a side and/or a drink)."""
    rs = RESTAURANTS[r]
    plan = day_plan(day)
    tops = [p for p in (BURGER_TOPPINGS if rs["dish"] == "burger" else BOWL_TOPPINGS) if on_menu(r, day, p)]
    n = rng.randint(0, min(plan["toppings"], len(tops)))
    chosen = rng.sample(tops, n)
    if rs["dish"] == "burger":
        parts = ["bun", "patty"] + chosen + ["top"]
    else:
        parts = ["noodles", "broth"] + chosen
    extras = []
    sides = [c["slots"][0] for c in rs["cookers"] if c["slots"][0] not in DRINKS and ITEMS[c["slots"][0]]["goes"] == "shelf"]
    sides = [s for s in sides if on_menu(r, day, s)]
    if sides and rng.random() < plan["side"]:
        extras.append(rng.choice(sides))
    drinks = [d for d in DRINKS if on_menu(r, day, d) and any(d in c["slots"] for c in rs["cookers"])]
    if drinks and rng.random() < plan["drink"]:
        extras.append(rng.choice(drinks))
    return {"parts": parts, "extras": extras}


def order_price(order):
    dish = "burger" if "bun" in order["parts"] else "bowl"
    tops = len([p for p in order["parts"] if p in BURGER_TOPPINGS or p in BOWL_TOPPINGS])
    return PRICES[dish] + PRICES["topping"] * tops + sum(PRICES[e] for e in order["extras"])


def day_arrivals(r, day):
    """Who comes on a day, when, and what they want: the same every time that day is played."""
    rng = random.Random(1000 * r + day + 7)
    plan = day_plan(day)
    n = plan["customers"]
    span = DAY_STEPS * ARRIVE_UNTIL
    out = []
    for i in range(n):
        at = int(span * i / n + rng.uniform(0, span / n * 0.6)) + 30
        kind = rng.randrange(len(CUSTOMERS))
        out.append((at, kind, make_order(r, day, rng)))
    return out


def star_goals(goal):
    return [round(goal * s) for s in STAR_SHARES]


def stars_for(coins, goal):
    return sum(1 for g in star_goals(goal) if coins >= g)


# ---- a new day

def new_day(r, day, ups):
    rs = RESTAURANTS[r]
    cookers = []
    for c in rs["cookers"]:
        items = list(c["slots"])
        if "more" in c and c["more"][0] in ups:
            items.append(c["more"][1])
        cookers.append({"key": c["key"], "slots": [{"item": it, "t": None} for it in items if on_menu(r, day, it)]})
    arrivals = day_arrivals(r, day)
    k = {"rest": r, "day": day, "t": 0, "ups": list(ups), "cookers": cookers,
         "plates": [None] * PLATES, "sel": 0, "held": None, "shelf": [None] * SHELF_SLOTS, "arrivals": arrivals,
         "coins": 0, "served": 0, "lost": 0, "tips": 0, "burnt": 0, "combo": 0, "best_combo": 0,
         "goal": sum(order_price(o) + TIP_MAX for _, _, o in arrivals), "said": None, "over": False}
    return k


def has_up(k, key):
    return key in k["ups"]


# ---- cooking

def cook_steps(k, item):
    steps = ITEMS[item]["cook"]
    if has_up(k, "fast") and item not in DRINKS:
        steps *= FAST
    return steps


def slot_state(k, slot):
    """'empty', 'cooking', 'ready' or 'burnt' (soggy noodles count as burnt)."""
    if slot["t"] is None:
        return "empty"
    item = ITEMS[slot["item"]]
    done = cook_steps(k, slot["item"])
    if slot["t"] < done:
        return "cooking"
    if item["keep"] is None or slot["t"] < done + item["keep"]:
        return "ready"
    return "burnt"


def tick_kitchen(k):
    """One step of everything cooking (and drinks pouring again, with the auto upgrade)."""
    for c in k["cookers"]:
        for slot in c["slots"]:
            if slot["t"] is not None:
                slot["t"] += 1
            elif has_up(k, "auto") and slot["item"] in DRINKS:
                slot["t"] = 0


# ---- plates: what may go on next

def plate_takes(plate, part, dish):
    """Can `part` go on this plate (None: an empty one)? Burgers are built from the bottom bun up
    and closed with the top; a bowl takes noodles and broth in either order, toppings once there are noodles."""
    parts = plate["parts"] if plate else []
    if part in parts:
        return False
    if dish == "burger":
        if part == "bun":
            return not parts
        if not parts or parts[-1] == "top":
            return False
        if part == "top":
            return "patty" in parts
        return True
    if part in ("noodles", "broth"):
        return True
    return "noodles" in parts


def plate_done(plate, dish):
    if not plate:
        return False
    parts = plate["parts"]
    if dish == "burger":
        return parts[-1] == "top"
    return "noodles" in parts and "broth" in parts


def plate_matches(plate, order, dish):
    """A finished plate is what they ordered: the same parts (toppings in any order)."""
    return plate_done(plate, dish) and sorted(plate["parts"]) == sorted(order["parts"])


def add_part(k, part):
    """A part onto a plate: the selected one if it can take it, else the first that can."""
    dish = rest_of(k)["dish"]
    order = [k["sel"]] + [i for i in range(PLATES) if i != k["sel"]]
    for i in order:
        if plate_takes(k["plates"][i], part, dish):
            k["plates"][i] = {"parts": (k["plates"][i] or {"parts": []})["parts"] + [part]}
            k["sel"] = i
            return True
    return False


# ---- taps: what touching each thing does

def tap_slot(k, c, s):
    """A cooker's slot: empty starts it, ready takes it (to a plate or the shelf), burnt bins it."""
    slot = k["cookers"][c]["slots"][s]
    st = slot_state(k, slot)
    if st == "empty":
        slot["t"] = 0
        return "start"
    if st == "cooking":
        return "wait"
    if st == "burnt":
        slot["t"] = None
        k["burnt"] += 1
        return "bin"
    item = slot["item"]
    if ITEMS[item]["goes"] == "plate":
        if not add_part(k, item):
            return "nope"
    else:
        if None not in k["shelf"]:
            return "nope"
        k["shelf"][k["shelf"].index(None)] = item
    slot["t"] = None
    return "take"


def tap_source(k, part):
    return "add" if add_part(k, part) else "nope"


def tap_plate(k, i):
    k["sel"] = i
    return "select"


def tap_shelf(k, i):
    """
    A side or drink on the shelf: picked up (held), ready for the customer or the bin
    you tap next; tapped again, put back. It used to go straight in the bin, and a
    player who tapped the pop and then the customer, as anyone would, lost the pop.
    """
    if k["shelf"][i] is None:
        return "nope"
    k["held"] = None if k["held"] == i else i
    return "select"


def bin_shelf(k, i):
    k["shelf"][i] = None
    if k["held"] == i:
        k["held"] = None
    k["burnt"] += 1
    return "bin"


def tap_bin(k):
    """Bins what's held from the shelf, or else what's on the selected plate."""
    if k["held"] is not None and k["shelf"][k["held"]] is not None:
        return bin_shelf(k, k["held"])
    if not k["plates"][k["sel"]]:
        return "nope"
    k["plates"][k["sel"]] = None
    k["burnt"] += 1
    return "bin"


# ---- customers

def patience_full(k, kind):
    p = PATIENCE * CUSTOMERS[kind][2] * day_plan(k["day"])["patience"]
    for up in ("decor1", "decor2"):
        if has_up(k, up):
            p *= DECOR
    return p


def needs(cust):
    """What a customer still wants: the dish (if not had yet) and the extras not had."""
    out = [] if cust.got_dish else ["dish"]
    left = list(cust.order["extras"])
    for e in cust.got:
        left.remove(e)
    return out + left


def serve(k, cust):
    """Hands a customer every finished thing they ordered: a matching plate, and their sides and drinks
    from the shelf. Nothing they ordered is ready: 'nope'. All of it: they pay, and tip."""
    if cust.phase != "wait":
        return "nope"
    dish = rest_of(k)["dish"]
    gave = False
    if not cust.got_dish:
        for i, p in enumerate(k["plates"]):
            if plate_matches(p, cust.order, dish):
                k["plates"][i] = None
                cust.got_dish = True
                gave = True
                break
    for e in needs(cust):
        if e != "dish" and e in k["shelf"]:
            j = k["shelf"].index(e)
            k["shelf"][j] = None
            if k["held"] == j:
                k["held"] = None
            cust.got.append(e)
            gave = True
    if not gave:
        return "nope"
    return finish_serving(k, cust)


def finish_serving(k, cust):
    if needs(cust):
        return "part"
    pay(k, cust)
    return "paid"


# ---- dragging: one thing dropped on another

def drop(k, src, dst, cust=None):
    """
    Something dragged and let go over something else. `src` is ("cooker", c, s),
    ("source", part), ("shelf", i) or ("plate", i); `dst` is ("plate", i), ("bin",)
    or ("customer",) with the customer as `cust`. It does what tapping the two in
    turn would, so dragging and tapping can never disagree.
    """
    kind, where = src[0], dst[0]
    if where == "bin":
        if kind == "shelf":
            return bin_shelf(k, src[1]) if k["shelf"][src[1]] is not None else "nope"
        if kind == "plate":
            k["held"] = None
            k["sel"] = src[1]
            return tap_bin(k)
        if kind == "cooker":
            slot = k["cookers"][src[1]]["slots"][src[2]]
            if slot["t"] is None:
                return "nope"
            slot["t"] = None
            k["burnt"] += 1
            return "bin"
        return "nope"
    if where == "plate":
        if kind == "source":
            k["sel"] = dst[1]
            return tap_source(k, src[1])
        if kind == "cooker":
            k["sel"] = dst[1]
            return tap_slot(k, src[1], src[2])
        return "nope"
    if where == "customer":
        if cust is None or cust.phase != "wait":
            return "nope"
        if kind == "shelf":
            item = k["shelf"][src[1]]
            if item is None or item not in needs(cust):
                return "nope"
            k["shelf"][src[1]] = None
            if k["held"] == src[1]:
                k["held"] = None
            cust.got.append(item)
            return finish_serving(k, cust)
        if kind == "plate":
            if cust.got_dish or not plate_matches(k["plates"][src[1]], cust.order, rest_of(k)["dish"]):
                return "nope"
            k["plates"][src[1]] = None
            cust.got_dish = True
            return finish_serving(k, cust)
        if kind == "cooker":
            # A drink or side straight from its machine: onto the shelf, then to them.
            slot = k["cookers"][src[1]]["slots"][src[2]]
            item = slot["item"]
            if ITEMS[item]["goes"] != "shelf" or slot_state(k, slot) != "ready" or item not in needs(cust):
                return "nope"
            if tap_slot(k, src[1], src[2]) != "take":
                return "nope"
            return drop(k, ("shelf", k["shelf"].index(item)), dst, cust)
    return "nope"


def pay(k, cust):
    share = max(0, cust.wait) / cust.full
    if share >= COMBO_GOOD:
        k["combo"] += 1
    else:
        k["combo"] = 0
    k["best_combo"] = max(k["best_combo"], k["combo"])
    mult = min(COMBO_MAX, 1 + COMBO_STEP * max(0, k["combo"] - 1))
    tip = TIP_MAX * share * CUSTOMERS[cust.kind][3] * mult
    if has_up(k, "tips"):
        tip *= TIP_JAR
    tip = int(tip + 0.5)        # halves round up, as on paper (Python's round(4.5) is 4)
    price = order_price(cust.order)
    k["coins"] += price + tip
    k["tips"] += tip
    k["served"] += 1
    cust.paid = price + tip
    cust.phase = "eat"
    cust.timer = EAT_STEPS


def lose(k, cust):
    k["lost"] += 1
    k["combo"] = 0
    cust.phase = "angry"
    cust.timer = EAT_STEPS


def free_seat():
    taken = {c.seat for c in instances("Customer")}
    return next((i for i in range(SEATS) if i not in taken), None)


def arrive(k):
    """Seats whoever's due and has a free seat; someone kept at the door too long gives up."""
    while k["arrivals"] and k["arrivals"][0][0] <= k["t"]:
        at, kind, order = k["arrivals"][0]
        seat = free_seat()
        if seat is None:
            if k["t"] - at > DOOR_WAIT:
                k["arrivals"].pop(0)
                k["lost"] += 1
                k["combo"] = 0
                continue
            return
        k["arrivals"].pop(0)
        c = instance_create(SEAT_X[seat], COUNTER_Y, "Customer")
        c.seat, c.kind, c.order = seat, kind, order
        c.full = c.wait = patience_full(k, kind)


def waiting_at_door(k):
    return len([a for a in k["arrivals"] if a[0] <= k["t"]])


def day_finished(k):
    if k["t"] >= DAY_STEPS:
        return True
    return not k["arrivals"] and not instances("Customer")


# ---- progress, kept between visits: coins, the best stars of each day, upgrades

def progress():
    p = save_get("progress")
    if p is None:
        p = {"coins": 0, "stars": [[0] * DAYS_EACH for _ in RESTAURANTS], "ups": [[] for _ in RESTAURANTS]}
    return p


def keep_progress(p):
    save_set("progress", p)


def total_stars(p):
    return sum(sum(s) for s in p["stars"])


def day_open(p, r, d):
    """Day 1 is open; each next day once the one before has a star. The noodle bar opens
    once the burger shack's tenth day has a star."""
    if r > 0 and p["stars"][r - 1][DAYS_EACH - 1] == 0:
        return False
    return d == 0 or p["stars"][r][d - 1] > 0


def restaurant_open(p, r):
    return day_open(p, r, 0)


def finish_day(k):
    """The day's over: anyone still waiting goes home unserved; stars, coins and the board."""
    for c in instances("Customer"):
        if c.phase == "wait":
            k["lost"] += 1
    k["lost"] += len(k["arrivals"])
    k["arrivals"] = []
    st = stars_for(k["coins"], k["goal"])
    p = progress()
    before = total_stars(p)
    p["coins"] += k["coins"]
    p["stars"][k["rest"]][k["day"]] = max(p["stars"][k["rest"]][k["day"]], st)
    keep_progress(p)
    if total_stars(p) > before:
        high_score(total_stars(p))
    k["stars"] = st
    k["over"] = True
    return st


def buy_upgrade(r, key):
    p = progress()
    cost = next(c for u, _, c, _ in RESTAURANTS[r]["upgrades"] if u == key)
    if key in p["ups"][r] or p["coins"] < cost:
        return False
    p["coins"] -= cost
    p["ups"][r].append(key)
    keep_progress(p)
    return True
