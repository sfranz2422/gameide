# script: magic
# Phase 4 at home: the champions (their level is their altar's; their wounds heal on the
# real clock) and spells (brewed one after another in the mage tower for gold, kept in
# its room until a raid). Nothing here draws.
#
# In the kingdom dict:
#   champions  {kind: {"hurt": health lost, "t": when it was last counted}}
#   spells     {kind: how many are brewed};  brewing [kind, …];  brew_t when the front began


def load_magic(r):
    r.setdefault("champions", {})
    r.setdefault("spells", {})
    r.setdefault("brewing", [])
    r.setdefault("brew_t", now())
    return r


# ---- champions

def altar_of(r, kind):
    return next((b for b in r["buildings"] if b["kind"] == CHAMPIONS[kind]["altar"]), None)


def champ_level(r, kind):
    """The champion's level: their altar's (0 with no altar, or while it's first built)."""
    a = altar_of(r, kind)
    return a["level"] if a else 0


def champ_max(kind, level):
    return CHAMPIONS[kind]["hp"][max(1, level) - 1]


def champ_hp(r, kind):
    """Their health now: what they had, healed since at CHAMP_REST's pace."""
    lv = champ_level(r, kind)
    if lv == 0:
        return 0
    most = champ_max(kind, lv)
    c = r["champions"].get(kind)
    if not c:
        return most
    healed = most * max(0, now() - c["t"]) / CHAMP_REST
    return int(max(0, most - max(0, c["hurt"] - healed)))


def champ_ready(r, kind):
    """None if they can join a raid, or why not, in words."""
    a = altar_of(r, kind)
    if a is None or a["level"] == 0:
        return f"Build the {BUILDINGS[CHAMPIONS[kind]['altar']]['name'].lower()} first."
    if a["job"] is not None:
        return f"The {CHAMPIONS[kind]['name']} is busy while the altar is upgraded."
    if champ_hp(r, kind) < 1:
        return f"The {CHAMPIONS[kind]['name']} is resting."
    return None


def champs_for_battle(r):
    """{kind: [level, health]} for every champion who can come."""
    return {k: [champ_level(r, k), champ_hp(r, k)] for k in CHAMPIONS if champ_ready(r, k) is None}


def champs_home(r, b):
    """After a battle: each champion who went keeps the wounds they came back with."""
    for u in b["units"]:
        if u.get("champ"):
            r["champions"][u["kind"]] = {"hurt": u["max"] - max(0, u["hp"]) if not u["dead"] else u["max"], "t": now()}


# ---- spells

def tower_level(r):
    return max([0] + [b["level"] for b in r["buildings"] if b["kind"] == "mage_tower"])


def spell_room(r):
    return sum(stat("mage_tower", "room", b["level"]) for b in r["buildings"] if b["kind"] == "mage_tower" and b["level"] > 0)


def spells_used(r):
    queued = {}
    for k in r["brewing"]:
        queued[k] = queued.get(k, 0) + 1
    return sum(SPELLS[k]["space"] * n for k, n in list(r["spells"].items()) + list(queued.items()))


def can_brew(r, kind):
    s = SPELLS[kind]
    if tower_level(r) < s["tower"]:
        return f"Upgrade the mage tower to level {s['tower']} first."
    if spells_used(r) + s["space"] > spell_room(r):
        return "No room in the mage tower: upgrade it."
    if r["gold"] < s["cost"]:
        return f"That needs {s['cost']:,} gold."
    return None


def brew(r, kind):
    why = can_brew(r, kind)
    if why:
        return why
    r["gold"] -= SPELLS[kind]["cost"]
    if not r["brewing"]:
        r["brew_t"] = now()
    r["brewing"].append(kind)
    return "queued"


def unbrew(r, kind):
    for i in range(len(r["brewing"]) - 1, -1, -1):
        if r["brewing"][i] == kind:
            del r["brewing"][i]
            r["gold"] += SPELLS[kind]["cost"]
            if i == 0:
                r["brew_t"] = now()
            return True
    return False


def brew_tick(r):
    """The tower's queue on the real clock. How many were brewed."""
    n = 0
    while r["brewing"]:
        k = r["brewing"][0]
        if now() < r["brew_t"] + SPELLS[k]["time"]:
            break
        r["brewing"].pop(0)
        r["spells"][k] = r["spells"].get(k, 0) + 1
        r["brew_t"] += SPELLS[k]["time"]
        n += 1
    if not r["brewing"]:
        r["brew_t"] = now()
    return n


def brew_left(r):
    return 0 if not r["brewing"] else max(0, r["brew_t"] + SPELLS[r["brewing"][0]]["time"] - now())


def spells_home(r, b):
    """After a battle: the spells cast are gone."""
    for k, n in b["cast"].items():
        r["spells"][k] = r["spells"].get(k, 0) - n
        if r["spells"][k] <= 0:
            del r["spells"][k]
