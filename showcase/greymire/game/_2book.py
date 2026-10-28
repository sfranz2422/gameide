# script: book
# How the book works: the journey's state, taking a choice, Rewind, saving,
# and the duels. The words are all in story; how it's drawn is in Book.

import copy
import random

MAX_STAMINA = 10
MAX_STRENGTH = 5          # in a duel: what you can put into one blow

ITEM_NAMES = {"whistle": "bone whistle", "horse": "wooden horse", "feather": "heron feather", "clapper": "bell-clapper"}

STATE = {}      # the journey so far: new_journey() fills it, save_set keeps it
HISTORY = []    # STATE as it was before each choice: what Rewind goes back to


def new_journey():
    STATE.clear()
    STATE.update(stamina=MAX_STAMINA, gold=5, items=[], flags=[], unlocked=[], visited=[],
                 at="landing", mode="page", page="intro", duel=None)
    HISTORY.clear()
    keep()


def load_journey():
    """The journey saved last time, if there is one. True if it was loaded."""
    saved = save_get("journey", None)
    if not saved or saved.get("page") == "intro" and saved.get("mode") == "page":
        return False
    STATE.clear()
    STATE.update(saved)
    HISTORY.clear()
    return True


def keep():
    save_set("journey", STATE)


def has(thing):
    """need="gold:3" is three gold or more; anything else is an item or something remembered."""
    if thing.startswith("gold:"):
        return STATE["gold"] >= int(thing[5:])
    return thing in STATE["items"] or thing in STATE["flags"]


def choices_of(key):
    """A page's choices, without the ones you can't take now."""
    return [c for c in PAGES[key]["choices"]
            if (c.get("need") is None or has(c["need"])) and (c.get("lack") is None or not has(c["lack"]))]


def remember():
    HISTORY.append(copy.deepcopy(STATE))
    del HISTORY[:-200]


def rewind():
    """Back to before the last choice. False when there's nothing to go back to."""
    if not HISTORY:
        return False
    STATE.clear()
    STATE.update(HISTORY.pop())
    keep()
    return True


def take(choice):
    """Takes a choice: what it changes, then where it leads."""
    remember()
    STATE["gold"] = max(0, STATE["gold"] + choice.get("gold", 0))
    STATE["stamina"] = clamp(STATE["stamina"] + choice.get("stamina", 0), 0, MAX_STAMINA)
    for kind, into in (("item", "items"), ("flag", "flags"), ("unlock", "unlocked")):
        if kind in choice and choice[kind] not in STATE[into]:
            STATE[into].append(choice[kind])
    if choice.get("drop") in STATE["items"]:
        STATE["items"].remove(choice["drop"])
    go_to(choice["to"])


def go_to(to):
    """Opens a page, the map, a duel or an ending. Out of stamina, everything leads to the dark."""
    if STATE["stamina"] <= 0 and not to.startswith("end:"):
        to = "end:dark"
    if to == "map":
        STATE["mode"] = "map"
    elif to.startswith("duel:"):
        start_duel(to[5:])
    elif to.startswith("end:"):
        STATE["mode"] = "end"
        STATE["page"] = to[4:]
        found = save_get("endings", [])
        if STATE["page"] not in found:
            save_set("endings", found + [STATE["page"]])
    else:
        STATE["mode"] = "page"
        STATE["page"] = to
    keep()


def travel(place):
    """Arrived at a place on the map: its first page, or the one for coming back."""
    remember()
    STATE["at"] = place
    p = PLACES[place]
    first = place not in STATE["visited"]
    if first:
        STATE["visited"].append(place)
    go_to(p["first"] if first else p["again"])


# ---------------------------------------------------------------- duels
#
# Sorcery!'s fight: each round you both choose how much strength to put
# into a blow. More than the other lands it; the same, and the blades lock.
# Strength spent is gone, and comes back slowly: one a round, two if you
# held back. So the question is never "attack?", it's "how much, now?" —
# and what the other one's face is telling you, which isn't always true.

FOES = {
    "gallow": {"name": "Gallow", "who": "gallow", "face": 0, "stamina": 8, "strength": 4, "honest": 0.7,
               "win": "gallow_beaten", "lose": "gallow_won", "lose_gold": 0.5, "floor": 3,
               "start": "Gallow twirls his staff and bows. \"Shall we?\""},
    "watch":  {"name": "The watchman", "who": None, "face": 0, "stamina": 6, "strength": 3, "honest": 1.0,
               "win": "street_won", "lose": "street_lost", "lose_gold": 1.0, "floor": 2,
               "start": "The watchman turns its empty helm towards you and lifts a sword red with rust."},
    "keeper": {"name": "Lady Ashveil", "who": "keeper", "face": 1, "stamina": 9, "strength": 5, "honest": 0.6,
               "win": "keeper_fades", "lose": "end:dark", "lose_gold": 1.0, "floor": 0,
               "start": "The wind of her anger tears at your cloak. Hold the lantern up, and hold on."},
}

TELLS = {
    "high": "{name} draws back for a mighty blow.",
    "mid": "{name} circles you, watching.",
    "low": "{name} seems to be catching breath.",
}


def start_duel(foe):
    f = FOES[foe]
    STATE["mode"] = "duel"
    STATE["duel"] = {"foe": foe, "hp": f["stamina"], "str": f["strength"], "mine": 3,
                     "said": f["start"], "over": None}
    plan_blow()


def plan_blow():
    """What the foe will put into its next blow — decided before you choose, and hinted at."""
    d = STATE["duel"]
    f = FOES[d["foe"]]
    s = d["str"]
    r = random.random()
    a = 0 if s == 0 or r > 0.82 else s if r < 0.45 else max(1, s // 2)
    kind = "high" if a >= 3 else "low" if a == 0 else "mid"
    if random.random() > f["honest"]:
        kind = random.choice([k for k in TELLS if k != kind])
    d["plan"] = a
    d["tell"] = TELLS[kind].format(name=f["name"])


def strike(n):
    """You put n strength into this round's blow."""
    d = STATE["duel"]
    f = FOES[d["foe"]]
    a = d["plan"]
    d["mine"] -= n
    d["str"] -= a
    name = f["name"]
    if n > a:
        hurt = 3 if n - a >= 3 else 2
        d["hp"] = max(0, d["hp"] - hurt)
        d["said"] = f"You put {n} into the blow, {name} only {a}. Yours lands!"
        d["sound"] = "hit"
    elif a > n:
        hurt = 3 if a - n >= 3 else 2
        STATE["stamina"] = max(0, STATE["stamina"] - hurt)
        d["said"] = f"{name} puts {a} into the blow, you only {n}. It catches you, hard."
        d["sound"] = "hurt"
    else:
        d["said"] = f"You both put {n} into it. The blows meet and lock, and you spring apart."
        d["sound"] = "clash"
    d["mine"] = min(MAX_STRENGTH, d["mine"] + (2 if n == 0 else 1))
    d["str"] = min(f["strength"], d["str"] + (2 if a == 0 else 1))
    if d["hp"] <= 0:
        d["over"] = "win"
    elif STATE["stamina"] <= 0:
        d["over"] = "lose"
    else:
        plan_blow()
    keep()


def end_duel():
    """The fight is over: on to what comes of it."""
    d = STATE["duel"]
    f = FOES[d["foe"]]
    remember()
    STATE["duel"] = None
    if d["over"] == "win":
        go_to(f["win"])
        return
    STATE["gold"] = int(STATE["gold"] * f["lose_gold"])
    STATE["stamina"] = max(STATE["stamina"], f["floor"])
    go_to(f["lose"])


def duel_choices():
    d = STATE["duel"]
    if d["over"]:
        return [{"text": "Go on", "duel": "end"}]
    out = [{"text": "Hold back, and catch your breath", "duel": 0}]
    for n in range(1, d["mine"] + 1):
        out.append({"text": f"Strike with {n} strength" if n > 1 else "A light blow: 1 strength", "duel": n})
    return out
