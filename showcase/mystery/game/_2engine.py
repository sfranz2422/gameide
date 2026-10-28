# script: engine
# How a point-and-click adventure works, LucasArts style.
#
# You pick a verb, then click a thing: "Pick up" + "camera". Use and Give
# take two: "Use" + "batteries" + "camera". Robin walks over, turns to it,
# and the story (story) says what happens — or a stock answer does.
#
# What happens is a QUEUE of small actions, played one after another:
# walk here, say this, wait, get that item, go to that room. The story
# fills the queue; Game's step plays it, a little each frame. While it
# plays, clicks only hurry the talking along.

import math

VERBS = [("open", "Open"), ("pick", "Pick up"), ("give", "Give"),
         ("close", "Close"), ("look", "Look at"), ("talk", "Talk to"),
         ("push", "Push"), ("use", "Use"), ("walk", "Walk to")]
VERB_NAMES = dict(VERBS)
TWO_THINGS = {"use": "with", "give": "to"}     # "Use hot sauce with Dot", "Give carton to Gus"

STATE = {}      # the game so far: kept by save_set, so Continue comes back to it
QUEUE = []      # the actions still to play
NOW = {}        # the action playing now, and how far it has got
SPEECH = {}     # who is talking, and what: shown over their head


def new_game():
    STATE.clear()
    STATE.update(room="newsroom", x=150, y=124, face="front", items=["notepad"], flags=[],
                 verb="walk", first=None, menu=None)
    QUEUE.clear()
    NOW.clear()
    SPEECH.clear()


def keep():
    save_set("game", {k: v for k, v in STATE.items() if k != "menu"})


def load_game():
    saved = save_get("game", None)
    if not saved:
        return False
    new_game()
    STATE.update(saved)
    STATE["menu"] = None
    return True


# ---------------------------------------------------------------- what's true

def has(item):
    return item in STATE["items"]


def flag(f):
    return f in STATE["flags"]


def holds(cond):
    """A spot's when=: "flag", "not:flag", "item:x" (carrying x), "no:x" (not carrying it)."""
    if cond is None:
        return True
    kind, _, name = cond.rpartition(":")
    return {"": flag, "not": lambda n: not flag(n), "item": has, "no": lambda n: not has(n)}[kind](name)


def spots():
    """The things in this room you can click now, people last (they stand in front)."""
    here = [s for s in ROOMS[STATE["room"]]["spots"] if holds(s.get("when"))]
    return [s for s in here if not s.get("actor")] + [s for s in here if s.get("actor")]


def spot(sid):
    return next((s for s in ROOMS[STATE["room"]]["spots"] if s["id"] == sid), None)


def thing_name(thing):
    """An item's name, or a spot's."""
    if thing in ITEMS:
        return ITEMS[thing][0]
    s = spot(thing)
    return s["name"] if s else thing


# ---------------------------------------------------------------- the queue
# The story's verbs. Each adds one action to the end of the queue.

def say_line(who, text):
    QUEUE.append(("line", who, text))


def walk(x, y):
    QUEUE.append(("walk", x, y))


def face(d):
    QUEUE.append(("face", d))


def wait(steps):
    QUEUE.append(("wait", steps))


def get(item):
    QUEUE.append(("call", lambda: STATE["items"].append(item) if item not in STATE["items"] else None))
    QUEUE.append(("sound", "pickup"))


def lose(item):
    QUEUE.append(("call", lambda: STATE["items"].remove(item) if item in STATE["items"] else None))


def set_flag(f):
    QUEUE.append(("call", lambda: STATE["flags"].append(f) if f not in STATE["flags"] else None))


def go(room, x, y, d="front"):
    QUEUE.append(("room", room, x, y, d))


def then(fn):
    QUEUE.append(("call", fn))


def sound(name):
    QUEUE.append(("sound", name))


def picture(name, steps=0):
    """A picture over the whole screen (the telescope's view) until a click, or for so many steps."""
    QUEUE.append(("picture", name, steps))


def menu(options_fn):
    """Things to say, in place of the verbs: options_fn() gives [(words, what happens), ...]."""
    QUEUE.append(("menu", options_fn))


def ending():
    QUEUE.append(("ending",))


# ---------------------------------------------------------------- playing it

def speech_steps(text):
    return 40 + len(text) * 4


def play_queue(clicked):
    """Plays the queue as far as it can this frame. True while something is still playing."""
    while QUEUE:
        a = QUEUE[0]
        kind = a[0]
        if kind == "walk":
            if step_walk(a[1], a[2]):
                return True
        elif kind == "line":
            if NOW.get("line") is not a:
                NOW["line"] = a
                NOW["left"] = speech_steps(a[2])
                SPEECH.update(who=a[1], text=a[2])
            NOW["left"] -= 1
            if NOW["left"] > 0 and not clicked:
                return True
            SPEECH.clear()
            NOW.pop("line", None)
            clicked = False          # one click finishes one line, not the whole conversation
        elif kind == "wait":
            if NOW.get("wait") is not a:
                NOW["wait"] = a
                NOW["left"] = a[1]
            NOW["left"] -= 1
            if NOW["left"] > 0:
                return True
            NOW.pop("wait", None)
        elif kind == "picture":
            if NOW.get("picture") is not a:
                NOW["picture"] = a
                NOW["left"] = a[2] or 10 ** 9
                NOW["shown"] = 0
            NOW["left"] -= 1
            NOW["shown"] += 1
            if NOW["left"] > 0 and not (clicked and NOW["shown"] > 10):
                return True
            NOW.pop("picture", None)
            clicked = False
        elif kind == "face":
            STATE["face"] = a[1]
        elif kind == "room":
            STATE.update(room=a[1], x=a[2], y=a[3], face=a[4])
            sound_play("door", volume=0.6)
            keep()
        elif kind == "sound":
            sound_play(a[1], volume=0.7)
        elif kind == "call":
            a[1]()
        elif kind == "menu":
            QUEUE.pop(0)
            options = a[1]()
            if options:
                STATE["menu"] = options
            return bool(options)
        elif kind == "ending":
            STATE["ended"] = True
            QUEUE.pop(0)
            return True
        QUEUE.pop(0)
    return False


def picture_now():
    a = NOW.get("picture")
    return a[1] if a else None


# ---------------------------------------------------------------- walking

WALK_SPEED = 1.4
DEPTH = 0.6


def inside(x, y, poly):
    """Is the point inside the room's walkable floor (a polygon)?"""
    n, hit = len(poly), False
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def onto_floor(x, y):
    """The nearest point of the floor to a click: a click on the wall walks to the foot of it."""
    poly = ROOMS[STATE["room"]]["walk"]
    if inside(x, y, poly):
        return x, y
    best, bd = (STATE["x"], STATE["y"]), 1e9
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % len(poly)]
        dx, dy = x2 - x1, y2 - y1
        t = clamp(((x - x1) * dx + (y - y1) * dy) / max(1e-9, dx * dx + dy * dy), 0, 1)
        px, py = x1 + t * dx, y1 + t * dy
        d = (px - x) ** 2 + (py - y) ** 2
        if d < bd:
            best, bd = (px, py), d
    # Just inside the edge, not on it.
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    return best[0] + (cx - best[0]) * 0.02, best[1] + (cy - best[1]) * 0.05


def step_walk(tx, ty):
    """One step towards (tx, ty). True while still walking. Up and down the
    screen is into and out of the room, so it goes slower than across."""
    x, y = STATE["x"], STATE["y"]
    ddx, ddy = tx - x, (ty - y) / DEPTH
    d = math.hypot(ddx, ddy)
    if d <= WALK_SPEED:
        STATE["x"], STATE["y"] = tx, ty
        STATE["walking"] = False
        return False
    STATE["x"] = x + ddx / d * WALK_SPEED
    STATE["y"] = y + ddy / d * WALK_SPEED * DEPTH
    STATE["face"] = ("right" if ddx > 0 else "left") if abs(ddx) >= abs(ddy) else ("back" if ddy < 0 else "front")
    STATE["walking"] = True
    return True


def scale_at(y):
    y1, s1, y2, s2 = ROOMS[STATE["room"]]["scale"]
    return clamp(s1 + (s2 - s1) * (y - y1) / max(1, y2 - y1), min(s1, s2), max(s1, s2))


# ---------------------------------------------------------------- clicking

DEFAULTS = {
    "look": "It's a {name}. Nothing special.",
    "pick": "I can't pick that up.",
    "talk": "I don't think the {name} wants to talk.",
    "open": "It doesn't open.",
    "close": "It doesn't close.",
    "push": "It won't budge.",
    "use": "I can't think how to use that.",
    "give": "I'd rather keep it.",
    "use2": "That doesn't do anything.",
    "give2": "I don't think they'd want that.",
}


def sentence(hover=None):
    """What the line under the room says: "Use hot sauce with Dot"."""
    v = STATE["verb"]
    words = VERB_NAMES[v]
    if STATE["first"]:
        words += " " + thing_name(STATE["first"]) + " " + TWO_THINGS[v]
    if hover:
        words += " " + thing_name(hover)
    return words


def click_thing(thing):
    """A thing clicked (a spot, or an item in the inventory) with the verb chosen."""
    v = STATE["verb"]
    if v in TWO_THINGS and STATE["first"] is None and thing in ITEMS and not used_alone(v, thing):
        STATE["first"] = thing           # "Use batteries" … with what?
        return
    first = STATE["first"]
    STATE["first"] = None
    STATE["verb"] = "walk"
    s = spot(thing) if thing not in ITEMS else None
    if s and (v != "walk" or s.get("exit")):
        walk(*s["stand"])
        face(s.get("face", "front"))
    elif s:
        walk(*onto_floor(*s["stand"]))
        return
    react(v, thing, first, s)


def used_alone(v, item):
    """An item that is only ever used by itself (the tinfoil, the notepad) needs no "with what?"."""
    return (v, item) in STORY and not any(len(k) == 3 and k[0] == v and item in k[1:] for k in STORY)


def react(v, thing, first, s):
    handler = None
    if first:
        handler = STORY.get((v, first, thing)) or STORY.get((v, thing, first))
    else:
        handler = STORY.get((v, thing))
    if handler:
        if isinstance(handler, str):
            say_line("robin", handler)
        else:
            handler()
        return
    if s and s.get("exit") and v in ("walk", "open", "use"):
        go(*s["exit"])
        return
    if v == "walk":
        return
    key = v + "2" if first else v
    say_line("robin", DEFAULTS[key].format(name=thing_name(thing)))
    sound("nope")


def click_floor(x, y):
    STATE["first"] = None
    STATE["verb"] = "walk"
    walk(*onto_floor(x, y))


def choose_option(i):
    """A line picked in a conversation: Robin says it, then what follows."""
    words, after = STATE["menu"][i]
    STATE["menu"] = None
    say_line("robin", words)
    after()
