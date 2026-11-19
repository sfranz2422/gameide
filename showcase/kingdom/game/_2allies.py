# script: allies
# Phase 6: alliances among classmates (the server keeps them: alliances.py). Asking your
# alliance for troops (as much room as your alliance hall has), giving yours to an ally's
# request (one at a time, at most GIVE_MOST to one request), and taking what you're given
# into your army once (`gifts_taken`). Names and messages are numbers the server keeps and
# these lists turn into words. Nothing here draws.

try:
    ally_news
except NameError:               # an older GameIDE: no alliances, the game plays on without them
    def ally_news(): return None
    def ally_error(): return None
    def ally_create(*a): pass
    def ally_join(*a): pass
    def ally_leave(): pass
    def ally_ask(*a): pass
    def ally_give(*a): pass
    def ally_taken(*a): pass
    def ally_say(*a): pass


def load_allies(r):
    r.setdefault("gifts_taken", [])
    return r


def ally_name(words):
    return f"The {ALLY_FIRST[words[0] % len(ALLY_FIRST)]} {ALLY_SECOND[words[1] % len(ALLY_SECOND)]}"


def banner_colour(n):
    return BANNERS[n % len(BANNERS)]


def hall_room(r):
    return max([0] + [stat("alliance_hall", "room", b["level"]) for b in r["buildings"] if b["kind"] == "alliance_hall" and b["level"] > 0])


def my_alliance():
    news = ally_news()
    return news.get("alliance") if news else None


def can_ask(r):
    if my_alliance() is None:
        return "Join an alliance first."
    if hall_room(r) == 0:
        return "Build an alliance hall first: it holds the troops you're given."
    mine = [q for q in my_alliance()["requests"] if q["yours"]]
    if mine and mine[0]["filled"] < mine[0]["room"]:
        return "Your request is still open."
    return None


def ask_troops(r):
    why = can_ask(r)
    if why:
        return why
    ally_ask(hall_room(r))
    return "asked"


def gift_for(r, req):
    """The troop you'd give to a request: the kind you have most of that fits. None if none fits."""
    left = req["room"] - req["filled"]
    fits = [(n, k) for k, n in r["army"].items() if n > 0 and TROOPS[k]["space"] <= left]
    return max(fits)[1] if fits else None


def can_give(r, req):
    if req["yours"]:
        return "That's your own request."
    if req["gave"] >= GIVE_MOST:
        return f"You've given {GIVE_MOST} to that one."
    if gift_for(r, req) is None:
        return "None of your troops fit." if army_size(r) else "Train some troops to give."
    return None


def give_troop(r, req):
    """One of your troops to an ally's request: 'given', or why not in words. It leaves your
    army at once (the server agrees the same rules, so it won't be refused)."""
    why = can_give(r, req)
    if why:
        return why
    k = gift_for(r, req)
    r["army"][k] -= 1
    if not r["army"][k]:
        del r["army"][k]
    req["gave"] += 1
    req["filled"] += TROOPS[k]["space"]
    ally_give(req["id"], k, 1, TROOPS[k]["space"])
    tally(r, "gifts")
    return "given"


def take_gifts(r):
    """Gifts from allies, new since last time, into your army (once). What came, for a message."""
    al = my_alliance()
    if not al:
        return []
    fresh = [g for g in al["gifts"] if g["id"] not in r["gifts_taken"] and g["kind"] in TROOPS]
    for g in fresh:
        r["army"][g["kind"]] = r["army"].get(g["kind"], 0) + g["count"]
        r["gifts_taken"].append(g["id"])
    r["gifts_taken"] = r["gifts_taken"][-GIFTS_KEPT:]
    told(ally_taken, [g["id"] for g in al["gifts"]])
    return fresh


def told(say_to_server, ids):
    """Tells the server about these ids once: its news says they're new until it hears, and
    asking again every step until the next news (up to a minute) was a request a second."""
    sent = getattr(global_vars, "told_ids", set())
    fresh = [i for i in ids if (say_to_server.__name__, i) not in sent]
    if fresh:
        say_to_server(fresh)
        sent.update((say_to_server.__name__, i) for i in fresh)
        global_vars.told_ids = sent
