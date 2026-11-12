# script: acts
# What every control does. A Button has an act (a word) and an arg; a Stepper has
# a key naming the number it changes. All of it is here, so a click, a tap, Space
# and a pad's A all end up in the same place.

_order = [0]


def make_button(x, y, wide, high, words, act, arg=None, size=18):
    b = instance_create(x, y, "Button")
    b.wide, b.high, b.words, b.act, b.arg, b.size = wide, high, words, act, arg, size
    _order[0] += 1
    b.order = _order[0]
    return b


def make_stepper(x, y, key, wide=300):
    st = instance_create(x, y, "Stepper")
    st.key, st.wide = key, wide
    _order[0] += 1
    st.order = _order[0]
    return st


# ---- steppers: what each key's number is, how far it goes, and how it reads

def _limits(key):
    s = global_vars.s
    if key.startswith("buy_"):
        return 0, MAX_PACKS, 1
    if key in ("lemons", "sugar", "ice"):
        return 0, RECIPE_MAX, 1
    if key == "price":
        return PRICE_MIN, PRICE_MAX, PRICE_STEP
    if key == "pink":
        return 0, 1, 1
    return 0, len(s["places"]) - 1, 1


def stepper_value(key):
    plan = global_vars.s["plan"]
    if key.startswith("buy_"):
        return plan["buy"][key[4:]]
    if key == "place":
        return sorted(global_vars.s["places"]).index(plan["place"])
    if key == "pink":
        return 1 if plan["pink"] else 0
    return plan[key]


def stepper_set(key, d):
    """Moves a stepper one step (d is -1 or 1). Returns the new number."""
    s = global_vars.s
    plan = s["plan"]
    low, high, step = _limits(key)
    v = max(low, min(high, stepper_value(key) + d * step))
    if key.startswith("buy_"):
        plan["buy"][key[4:]] = v
    elif key == "place":
        plan["place"] = sorted(s["places"])[v]
    elif key == "pink":
        plan["pink"] = bool(v)
    else:
        plan[key] = v
    global_vars.problem = ""
    return v


def stepper_words(key):
    """(label, the number as it reads, a note under it)."""
    s = global_vars.s
    plan = s["plan"]
    day = today(s)
    if key.startswith("buy_"):
        k = key[4:]
        _, name, pack, unit, _, _ = next(x for x in SUPPLIES if x[0] == k)
        n = plan["buy"][k]
        return name, f"{n} pack{'s' if n != 1 else ''}", f"{money(day['prices'][k])} for {pack} {unit}"
    if key == "lemons":
        juiced = f" (uses {lemons_a_pitcher(s)}: juicer)" if has(s, "juicer") and plan["lemons"] else ""
        return "Lemons a pitcher", str(plan["lemons"]), f"8 cups a pitcher{juiced}"
    if key == "sugar":
        return "Sugar a pitcher", f"{plan['sugar']} scoops", ""
    if key == "ice":
        return "Ice a cup", f"{plan['ice']} cubes", ""
    if key == "price":
        return "Price a cup", money(plan["price"]), ""
    if key == "pink":
        return "Pink lemonade", "Yes" if plan["pink"] else "No", "Pink fans pay more"
    place = PLACES[plan["place"]]
    return "Where", place["name"], f"Rent {money(place['rent'])} a day" if place["rent"] else "No rent"


# ---- buttons

def do_act(name, arg):
    s = getattr(global_vars, "s", None)
    if name == "new":
        import random as _r
        global_vars.s = new_summer(_r.randrange(1 << 30))
        global_vars.scored = False
        room_goto("Morning")
    elif name == "continue":
        global_vars.s = save_get("summer")
        global_vars.scored = False
        room_goto("Evening" if global_vars.s["phase"] == "evening" else "Morning")
    elif name == "open":
        t = open_stand(s)
        if isinstance(t, str):
            global_vars.problem = t
            sound_play("nope", volume=0.5)
        else:
            global_vars.t = t
            room_goto("Street")
    elif name == "speed":
        global_vars.speed = arg
    elif name == "upgrade":
        if buy_upgrade(s, arg):
            sound_play("coin", volume=0.6)
            keep(s)
    elif name == "unlock":
        if unlock_place(s, arg):
            s["plan"]["place"] = arg
            sound_play("coin", volume=0.6)
            keep(s)
    elif name == "next":
        next_day(s)
        keep(s)
        room_goto("Morning")
    elif name == "title":
        room_goto("Title")
