# script: acts
# What every Button does (its act and arg), and what a tap on each thing in the
# kitchen does. All of it is here, so a click, a tap, Space and a pad's A all end
# up in the same place.

_order = [0]


def make_button(x, y, wide, high, words, act, arg=None, size=18):
    b = instance_create(x, y, "Button")
    b.wide, b.high, b.words, b.act, b.arg, b.size = wide, high, words, act, arg, size
    _order[0] += 1
    b.order = _order[0]
    return b


def start_day(r, d):
    p = progress()
    global_vars.rest = r
    global_vars.k = new_day(r, d, p["ups"][r])
    global_vars.focus = None
    room_goto("Kitchen")


def do_act(what, arg):
    if what == "play" or what == "map":
        room_goto("Map")
    elif what == "title":
        room_goto("Title")
    elif what == "rest":
        global_vars.rest = arg
        global_vars.focus = None
        room_restart()
    elif what == "day":
        start_day(global_vars.rest, arg)
    elif what == "retry":
        start_day(global_vars.k["rest"], global_vars.k["day"])
    elif what == "next_day":
        start_day(global_vars.k["rest"], global_vars.k["day"] + 1)
    elif what == "shop":
        global_vars.focus = None
        room_goto("Shop")
    elif what == "buy":
        if buy_upgrade(global_vars.rest, arg):
            sound_play("coin", volume=0.6)
        else:
            sound_play("nope", volume=0.5)
        room_restart()
    elif what == "leave":
        room_goto("Map")


# What a tap in the kitchen sounds like, and how the cook looks for a moment after.
TAP_SOUND = {"start": "sizzle", "take": "pop", "add": "pop", "part": "pop", "paid": "coin",
             "bin": "bin", "nope": "nope", "wait": "tick", "select": "tick"}
TAP_POSE = {"start": "flip", "take": "carry", "add": "carry", "part": "carry", "paid": "carry", "nope": "worried"}


def tap(spot):
    """A tap on something in the kitchen: what it does is the kitchen script's."""
    k = global_vars.k
    if k is None or k["over"]:
        return None
    name = spot.object_name
    if name == "Cooker":
        res = tap_slot(k, spot.c, spot.s)
        if res == "start" and k["cookers"][spot.c]["slots"][spot.s]["item"] in DRINKS:
            res_sound = "pour"
        else:
            res_sound = None
    elif name == "Source":
        res, res_sound = tap_source(k, spot.part), None
    elif name == "Plate":
        res, res_sound = tap_plate(k, spot.i), None
    elif name == "Shelf":
        res, res_sound = tap_shelf(k, spot.i), None
    elif name == "Bin":
        res, res_sound = tap_bin(k), None
    elif name == "Customer":
        res, res_sound = serve(k, spot), None
    else:
        return None
    return feedback(res, res_sound)


def feedback(res, res_sound=None):
    """How a tap or a drop sounds, and how the cook looks for a moment after."""
    k = global_vars.k
    sound_play(res_sound or TAP_SOUND.get(res, "tick"), volume=0.5)
    if res in TAP_POSE:
        global_vars.pose = (TAP_POSE[res], 20)
    if res == "paid" and k["combo"] >= 3:
        global_vars.pose = ("cheer", 40)
    return res


# ---- the pointer: a tap, or a drag from one thing to another
#
# A press is a tap if it's let go where it started (within DRAG_START pixels), and a
# drag if it moves further: what's dragged is dropped on whatever it's let go over
# (drop() in the kitchen script). Both a mouse and a finger work this way.

def spot_at(x, y, but=None):
    """The kitchen thing under (x, y), nearest the front first."""
    best = None
    for s in instances("Spot"):
        if s is not but and s.shown and not s.off and inside(s, x, y):
            if best is None or s.depth < best.depth:
                best = s
    return best


def as_source(o):
    name = o.object_name
    if name == "Cooker":
        return ("cooker", o.c, o.s)
    if name == "Source":
        return ("source", o.part)
    if name == "Shelf":
        return ("shelf", o.i)
    if name == "Plate":
        return ("plate", o.i)
    return None


def drop_on(src, dst):
    k = global_vars.k
    if k is None or k["over"]:
        return None
    s = as_source(src)
    name = dst.object_name
    if s is None:
        return feedback("nope")
    if name == "Shelf" and s[0] == "cooker":
        return tap(src)                    # a drink or side dragged to the shelf: as a tap puts it there
    d = {"Plate": ("plate", getattr(dst, "i", 0)), "Bin": ("bin",), "Customer": ("customer",)}.get(name)
    if d is None:
        return feedback("nope")
    return feedback(drop(k, s, d, dst if name == "Customer" else None))


def dragged():
    """What's being dragged and has moved far enough to show under the pointer, or None."""
    d = getattr(global_vars, "drag", None)
    return d if d is not None and d["moved"] else None


def pointer():
    """Once a step in the kitchen: a press, a drag, a let-go."""
    d = getattr(global_vars, "drag", None)
    if mouse_check_pressed("left"):
        s = spot_at(mouse_x, mouse_y)
        d = {"from": s, "x": mouse_x, "y": mouse_y, "moved": False} if s is not None else None
        global_vars.drag = d
        if s is not None:
            global_vars.focus = s
    if d is None:
        return
    if point_distance(d["x"], d["y"], mouse_x, mouse_y) > DRAG_START:
        d["moved"] = True
    if mouse_check_released("left") or not mouse_check("left"):
        global_vars.drag = None
        if not d["moved"]:
            press(d["from"])
            return
        to = spot_at(mouse_x, mouse_y, but=d["from"])
        if to is not None:
            drop_on(d["from"], to)


def drag_picture(d):
    """What a drag carries, drawn under the pointer (None if it carries nothing)."""
    k = global_vars.k
    o = d["from"]
    name = o.object_name
    if name == "Source":
        return ("pic", PART_PICS.get(o.part, o.part))
    if name == "Shelf":
        item = k["shelf"][o.i]
        return ("pic", item_pic(item)) if item else None
    if name == "Cooker":
        slot = k["cookers"][o.c]["slots"][o.s]
        st = slot_state(k, slot)
        if st in ("ready", "burnt"):
            return ("pic", ITEMS[slot["item"]]["pics"][1 if st == "ready" else 2])
        return None
    if name == "Plate":
        plate = k["plates"][o.i]
        return ("dish", plate["parts"]) if plate else None
    return None
