# script: mix
# The rules of mixing, all in one place: what two things make, finding something
# new, hints, how you made a thing (step by step from the four you start with), and
# the achievements. Objects on screen only draw and call these, so a drag, a tap,
# Space and the bot in the tests all mix by the same rules.
#
# Progress is kept in the save, so it's there next time:
#   found      every key found, in the order found (the four you start with first)
#   how        {key: [a, b]}: the mix that first made it
#   fails      mixes that made nothing
#   hints      hints used; streak: things found since the last hint
#   awards     the achievements earned, in the order earned

# Both orders of every pair, looked up at once (made once, as the game starts).
MIXES = {}
for _a, _b, _c in RECIPES:
    MIXES[(_a, _b)] = _c
    MIXES[(_b, _a)] = _c
USED = {r[0] for r in RECIPES} | {r[1] for r in RECIPES}


def mix_of(a, b):
    """What a and b make, or None."""
    return MIXES.get((a, b))


def is_final(key):
    """Makes nothing more: shown with a gold edge."""
    return key not in USED


def name_of(key):
    return THINGS[key][0]


def group_of(key):
    return THINGS[key][1]


# ---- progress

def progress():
    p = save_get("progress", None)
    if p is None:
        p = {"found": list(START), "how": {}, "fails": 0, "hints": 0, "streak": 0, "awards": []}
    return p


def keep(p):
    save_set("progress", p)


def found(p, key):
    return key in p["found"]


def try_mix(p, a, b):
    """Mixes a and b. Returns (what it made or None, True if that's new). A new thing is
    kept with the mix that made it, the board hears the count, and achievements are checked."""
    c = mix_of(a, b)
    if c is None:
        p["fails"] += 1
        keep(p)
        return None, False
    new = c not in p["found"]
    if new:
        p["found"].append(c)
        p["how"][c] = [a, b]
        p["streak"] += 1
        high_score(len(p["found"]))
    keep(p)
    return c, new


# ---- hints

def hint(p):
    """Something you could make now from what you've found, and one of its two ingredients:
    (ingredient, result), or None when there's nothing left to make. The first such recipe in
    the list, so the hints lead through the game in order, simple things first."""
    for a, b, c in RECIPES:
        if c not in p["found"] and a in p["found"] and b in p["found"]:
            return a, c
    return None


def use_hint(p):
    h = hint(p)
    if h is not None:
        p["hints"] += 1
        p["streak"] = 0
        keep(p)
    return h


# ---- how you made it

def steps_to(p, key):
    """Every mix on the way to `key` as you first made it, in an order you could do them in:
    [(a, b, made)], starting from the four you start with."""
    out, seen = [], set(START)

    def walk(k):
        if k in seen or k not in p["how"]:
            return
        seen.add(k)
        a, b = p["how"][k]
        walk(a)
        walk(b)
        out.append((a, b, k))

    walk(key)
    return out


# ---- achievements

def in_group(p, group):
    return [k for k in p["found"] if group_of(k) == group]


def all_of(p, group):
    return all(k in p["found"] for k in THINGS if group_of(k) == group)


def earned(p, key):
    """Has the player earned this achievement? (key from ACHIEVEMENTS)"""
    f = set(p["found"])
    n = len(f)
    total = len(THINGS)
    return {
        "first": n > len(START),
        "ten": n >= 10,
        "quarter": n >= total / 4,
        "half": n >= total / 2,
        "all": n == total,
        "life": "life" in f,
        "weather": all_of(p, "weather"),
        "space": all_of(p, "space"),
        "zoo": len(in_group(p, "animals")) >= 10,
        "greenthumb": all_of(p, "plants"),
        "builder": {"house", "village", "city"} <= f,
        "royal": {"king", "castle"} <= f,
        "liftoff": {"astronaut", "space"} <= f,
        "dragons": "dragon" in f,
        "chef": all_of(p, "food"),
        "inventor": len(in_group(p, "inventions")) >= 10,
        "final": any(is_final(k) for k in f),
        "tryer": p["fails"] >= 25,
        "nohints": p["streak"] >= 15,
        "party": "party" in f,
        "sea": {"octopus", "crab", "jellyfish", "dolphin", "mermaid"} <= f,
        "spooky": {"ghost", "vampire", "witch", "mummy", "zombie"} <= f,
        "barnyard": {"cow", "horse", "chicken", "pig", "sheep"} <= f,
        "gadgets": {"phone", "tv", "camera", "computer"} <= f,
    }[key]


def new_awards(p):
    """Achievements earned just now (and kept, so each comes once)."""
    out = []
    for key, name, words in ACHIEVEMENTS:
        if key not in p["awards"] and earned(p, key):
            p["awards"].append(key)
            out.append(key)
    if out:
        keep(p)
    return out


def award(key):
    return next(a for a in ACHIEVEMENTS if a[0] == key)
