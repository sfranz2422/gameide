# script: stack
# The rules of a sandwich, all in one place: where a layer lands, whether the pile
# holds, what falls off, the bites, which recipes it finds, and the book. The
# objects on screen only draw and call these, so a click, a tap, Space and the bot
# in the tests all build by the same rules.
#
# A sandwich is one dict, global_vars.s:
#   bread       the bread's key (BREADS)
#   layers      [{"k": key, "dx": how far its middle is right of the plate's, "dots": a sauce's squiggle}]
#               bottom first; the bottom slice is "bottom" and the top slice "top"
#   topped      True once the top slice is on and stayed on
#   side, drink what's beside the plate (a key, or None)
#   bites, side_bites, sips   how much has been eaten
#   lost        how many layers have fallen off, all told
import math
import random


def new_sandwich(bread):
    return {"bread": bread, "layers": [{"k": "bottom", "dx": 0.0}], "topped": False,
            "side": None, "drink": None, "bites": 0, "side_bites": 0, "sips": 0, "lost": 0}


def bread_of(key):
    return next(b for b in BREADS if b["key"] == key)


def thick(s, layer):
    """How much height a layer adds to the pile."""
    if layer["k"] in ("bottom", "top"):
        return bread_of(s["bread"])["thick"]
    return LAYERS[layer["k"]]["thick"]


def height(s):
    return sum(thick(s, l) for l in s["layers"])


def top_dx(s):
    return s["layers"][-1]["dx"]


def margin(weight):
    """How far off-centre what's on a layer can be before it slides off: less under a heavy pile."""
    return LAYER_W / 2 * SUPPORT * HEAVY / (HEAVY + weight)


def falls_from(s):
    """The lowest layer that slides off (and takes everything above it), or None if the pile holds.
    Every layer must have the middle of the weight on top of it over itself."""
    layers = s["layers"]
    for i in range(1, len(layers)):
        above = layers[i:]
        weight = sum(thick(s, l) for l in above)
        middle = sum(l["dx"] * thick(s, l) for l in above) / weight
        if abs(middle - layers[i - 1]["dx"]) > margin(weight):
            return i
    return None


def danger(s):
    """0 (steady) to 1 (about to go): the worst any layer is doing. The stack wobbles by it."""
    layers = s["layers"]
    worst = 0.0
    for i in range(1, len(layers)):
        above = layers[i:]
        weight = sum(thick(s, l) for l in above)
        middle = sum(l["dx"] * thick(s, l) for l in above) / weight
        worst = max(worst, abs(middle - layers[i - 1]["dx"]) / margin(weight))
    return min(1.0, worst)


def lean(s):
    """Which way a wobbling stack leans: the side its weight is on."""
    layers = s["layers"]
    if len(layers) < 2:
        return 0
    above = layers[1:]
    weight = sum(thick(s, l) for l in above)
    middle = sum(l["dx"] * thick(s, l) for l in above) / weight
    return 1 if middle >= layers[0]["dx"] else -1


def landing_dx(s, key, rng=random):
    """Where a tapped layer lands: over the one below, a little off, more for slippery things."""
    slip = LAYERS[key].get("slip", 0) if key in LAYERS else 0
    return top_dx(s) + rng.uniform(-JITTER, JITTER) + rng.uniform(-slip, slip)


def can_add(s):
    return not s["topped"] and s["bites"] == 0


def add_layer(s, key, dx, dots=None):
    """Puts a layer on at dx. Returns what fell off as a result (bottom first), [] if it held.
    The top slice is added this way too; if it falls, the sandwich isn't topped yet."""
    if not can_add(s):
        return []
    layer = {"k": key, "dx": float(dx)}
    if dots is not None:
        layer["dots"] = [list(d) for d in dots[:SAUCE_DOTS]]
    s["layers"].append(layer)
    i = falls_from(s)
    fell = []
    if i is not None:
        fell = s["layers"][i:]
        del s["layers"][i:]
        s["lost"] += len(fell)
    s["topped"] = s["layers"][-1]["k"] == "top"
    return fell


def undo(s):
    """Takes the last layer off again (never the bottom slice)."""
    if len(s["layers"]) > 1 and s["bites"] == 0:
        s["layers"].pop()
        s["topped"] = False
        return True
    return False


def auto_squiggle(rng=random):
    """A sauce tapped rather than drawn: a zigzag across the top."""
    n = 12
    return [[-LAYER_W * 0.4 + LAYER_W * 0.8 * i / (n - 1) + rng.uniform(-4, 4), (-10 if i % 2 else 8) + rng.uniform(-2, 2)]
            for i in range(n)]


def fill(s):
    """Everything between the slices, bottom first."""
    return [l["k"] for l in s["layers"] if l["k"] not in ("bottom", "top")]


def summary(s):
    return {"bread": s["bread"], "fill": fill(s)}


def recipes_in(s):
    """Every recipe this sandwich is (as names), in the book's order."""
    sm = summary(s)
    return [r["name"] for r in RECIPES if r["test"](sm)]


# ---- eating

def bite(s):
    """One bite of the sandwich. True when that was the last."""
    if not s["topped"] or s["bites"] >= BITES:
        return False
    s["bites"] += 1
    return s["bites"] == BITES


def eaten(s):
    return s["bites"] >= BITES


def bite_edge(s):
    """Where the sandwich now ends on the right, as a share of a slice's width from the left."""
    return 1 - s["bites"] / BITES


def reactions(s):
    """What you'd say eating this, best first; every bite says the next one."""
    keys = set(fill(s))
    said = []
    if any(LAYERS[k].get("spicy") for k in keys):
        said.append("Spicy!")
    if any(LAYERS[k].get("crunchy") for k in keys):
        said.append("Crunch!")
    if any(LAYERS[k].get("sweet") for k in keys) and any(LAYERS[k].get("meat") for k in keys):
        said.append("...interesting.")
    elif any(LAYERS[k].get("sweet") for k in keys):
        said.append("Sweet!")
    if sum(1 for k in fill(s) if LAYERS[k].get("cheese")) >= 2:
        said.append("So cheesy!")
    if len(fill(s)) >= 12:
        said.append("How do I fit this in?")
    if not keys:
        said.append("...it's just bread.")
    for w in ("Mmm!", "Yum!", "So good!"):
        if len(said) < BITES:
            said.append(w)
    return said


# ---- the book: saved, so it stays found

def book():
    return save_get("book", {})


def found_count():
    return len(book())


def unlocked(key):
    return LAYERS[key].get("unlock", 0) <= found_count()


def best():
    return save_get("best", 0)


def finish_meal(s):
    """The last bite: new recipes go in the book (with the sandwich that found them, to draw
    there), the tallest is kept and sent to the board, and anything newly unlocked is named."""
    was = found_count()
    b = book()
    new = [n for n in recipes_in(s) if n not in b]
    for n in new:
        b[n] = {"bread": s["bread"], "layers": [[l["k"], round(l["dx"], 1)] + ([l["dots"]] if "dots" in l else [])
                                                for l in s["layers"]]}
    save_set("book", b)
    tall = len(fill(s))
    if tall > best():
        save_set("best", tall)
    save_set("made", save_get("made", 0) + 1)
    high_score(best())
    opened = [LAYERS[k]["name"] for k in LAYERS if was < LAYERS[k].get("unlock", 0) <= len(b)]
    return new, opened, tall


def from_book(entry):
    """A sandwich as the book kept it, to draw."""
    s = new_sandwich(entry["bread"])
    s["layers"] = [{"k": l[0], "dx": l[1], **({"dots": l[2]} if len(l) > 2 else {})} for l in entry["layers"]]
    s["topped"] = True
    return s


def next_unlock():
    """The next thing to unlock, and how many more recipes it wants (or None)."""
    n = found_count()
    waiting = sorted((LAYERS[k]["unlock"], k) for k in LAYERS if LAYERS[k].get("unlock", 0) > n)
    if not waiting:
        return None
    need, k = waiting[0]
    return LAYERS[k]["name"], need - n
