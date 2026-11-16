# script: acts
# What every Button does (its act and arg), and what a tap or a drag does to each
# Spot: a loaf, a plate on the shelf, the sandwich being eaten. All of it is here,
# so a click, a tap on a phone, Space and a pad's A end up in the same place.
import random

DRAG_START = 12             # pixels a press must move before it's a drag, not a tap
CHOP_STEPS = 18             # the knife going down
SLICED_STEPS = 50           # the knife down, the slice falling away, then to the kitchen
SHELF_X, SHELF_Y = 26, 92   # the top left of the shelf's plates
CELL_W, CELL_H = 118, 106   # one plate's box
SHELF_COLS = 3

_order = [0]


def make_button(x, y, wide, high, words, act, arg=None, size=18):
    b = instance_create(x, y, "Button")
    b.wide, b.high, b.words, b.act, b.arg, b.size = wide, high, words, act, arg, size
    _order[0] += 1
    b.order = _order[0]
    return b


def make_spot(x, y, wide, high, what, key=None):
    o = instance_create(x, y, "Spot")
    o.wide, o.high, o.what, o.key = wide, high, what, key
    return o


def clear_spots():
    for o in instances("Spot"):
        o.destroy()


def sandwich():
    return global_vars.s


# ---- the kitchen's shelf: the plates of whichever tab is open

def tab_keys(tab):
    if tab == "sides":
        return list(SIDES)
    if tab == "drinks":
        return list(DRINKS)
    return [k for k in LAYERS if LAYERS[k]["kind"] == tab]


def make_shelf():
    clear_spots()
    tab = global_vars.tab
    what = "side" if tab == "sides" else "drink" if tab == "drinks" else "layer"
    for i, k in enumerate(tab_keys(tab)):
        c, r = i % SHELF_COLS, i // SHELF_COLS
        o = make_spot(SHELF_X + c * CELL_W, SHELF_Y + r * CELL_H, CELL_W - 8, CELL_H - 6, what, k)
        o.off = what == "layer" and not unlocked(k)
    global_vars.focus = None


def kitchen_scale(s):
    return stack_scale(s)


def top_y(s):
    """Where the top of the sandwich is on screen."""
    return PLATE_Y - height(s) * kitchen_scale(s)


def over_sandwich(s, x, y):
    ks = kitchen_scale(s)
    return abs(x - PLATE_X) < LAYER_W * ks * 0.9 and y < PLATE_Y + 30


# ---- dropping a layer: it falls (a Faller), then lands by the stack script's rules

def falling():
    f = instances("Faller")
    return f[0] if f else None


def drop(key, dx, from_y=-60):
    """Lets go of a layer at dx; it falls onto the sandwich. One still falling lands first."""
    s = sandwich()
    if not can_add(s):
        return None
    f = falling()
    if f is not None:
        land(f)
        if not can_add(s):
            return None
    f = instance_create(PLATE_X + dx * kitchen_scale(s), from_y, "Faller")
    f.key, f.dx, f.y0 = key, dx, from_y
    sound_play("whoosh", volume=0.25)
    return f


def land(f):
    """The layer lands: the stack's rules say whether the pile holds; what doesn't, tumbles."""
    s = sandwich()
    ks = kitchen_scale(s)
    fell = add_layer(s, f.key, f.dx)
    f.destroy()
    sound_play("squish" if f.key in ("egg", "tomato", "jelly", "avocado", "gummy") else "plop", volume=0.6)
    if fell:
        y = PLATE_Y - height(s) * ks
        way = 1 if sum(l["dx"] for l in fell) / len(fell) >= (s["layers"][-1]["dx"] if s["layers"] else 0) else -1
        for n, l in enumerate(fell):
            t = instance_create(PLATE_X + l["dx"] * ks, y, "Tumble")
            t.layer, t.bread, t.size = l, s["bread"], ks
            t.vx = way * (2.5 + n * 0.35 + random.uniform(0, 1.2))
            t.vy = -2 - random.uniform(0, 2)
            t.spin = -way * (3 + random.uniform(0, 4))
            y -= thick(s, l) * ks
        sound_play("topple", volume=0.7)
        camera_shake(5, 14)
        say("Whoa! It fell!" if len(fell) > 2 else "Oops!")
    elif f.key == "top":
        sound_play("ding", volume=0.5)
        global_vars.tab = "sides"
        make_shelf()


def say(words):
    global_vars.said = (words, 90)


# ---- taps

def tap(o):
    s = getattr(global_vars, "s", None)
    w = o.what
    if w == "bread":
        sound_play("click", volume=0.5)
        global_vars.picked = o.key
        global_vars.chop = 0
        clear_spots()
        make_spot(VIEW_W / 2 - 200, 200, 400, 260, "loaf", o.key)
    elif w == "loaf":
        if global_vars.chop == 0:
            global_vars.chop = 1
    elif w == "layer":
        if LAYERS[o.key]["kind"] == "sauce":
            add_sauce(o.key, auto_squiggle())
        else:
            drop(o.key, landing_dx(s, o.key))
    elif w == "side":
        s["side"] = None if s["side"] == o.key else o.key
        sound_play("plop", volume=0.5)
    elif w == "drink":
        s["drink"] = None if s["drink"] == o.key else o.key
        sound_play("clink", volume=0.5)
    elif w == "eat_sandwich":
        eat_bite()
    elif w == "eat_side":
        eat_side()
    elif w == "eat_drink":
        sip()


def add_sauce(key, dots):
    s = sandwich()
    f = falling()
    if f is not None:
        land(f)
    if not can_add(s) or len(dots) < 2:
        return
    add_layer(s, key, top_dx(s), dots)
    sound_play("squirt", volume=0.5)


# ---- the pointer: a press on a Spot is a tap if let go where it began, a drag if it moved

def spot_at(x, y):
    for o in instances("Spot"):
        if o.shown and inside(o, x, y):
            return o
    return None


def dragged():
    return getattr(global_vars, "drag", None)


def pointer():
    """Once a step on a screen with Spots: a press, a drag, a let-go."""
    d = dragged()
    if mouse_check_pressed("left"):
        o = spot_at(mouse_x, mouse_y)
        d = {"from": o, "x": mouse_x, "y": mouse_y, "moved": False, "dots": []} if o is not None else None
        global_vars.drag = d
        if o is not None:
            global_vars.focus = o
    if d is None:
        return
    o = d["from"]
    if point_distance(d["x"], d["y"], mouse_x, mouse_y) > DRAG_START and o.what in ("layer", "side", "drink") and not o.off:
        d["moved"] = True
    if d["moved"] and o.what == "layer" and LAYERS[o.key]["kind"] == "sauce":
        squiggle(d)
    if mouse_check_released("left") or not mouse_check("left"):
        global_vars.drag = None
        if not d["moved"]:
            if spot_at(mouse_x, mouse_y) is o:
                press(o)
            return
        let_go(d)


def squiggle(d):
    """A sauce being drawn: a dot wherever the bottle goes over the top of the sandwich."""
    s = sandwich()
    if not can_add(s) or not over_sandwich(s, mouse_x, mouse_y):
        return
    ks = kitchen_scale(s)
    x = (mouse_x - (PLATE_X + top_dx(s) * ks)) / ks
    y = (mouse_y - top_y(s)) / ks
    if abs(x) > LAYER_W * 0.46 or y < -60 or y > 40:
        return
    dot = [x, clamp(y, -16, 12)]       # on the top's face, which is seen from above
    dots = d["dots"]
    if not dots or point_distance(dots[-1][0], dots[-1][1], dot[0], dot[1]) > 9:
        if len(dots) < SAUCE_DOTS:
            dots.append(dot)
            if len(dots) % 3 == 1:
                sound_play("squirt", volume=0.25)


def let_go(d):
    o = d["from"]
    s = sandwich()
    if o.what == "layer":
        if LAYERS[o.key]["kind"] == "sauce":
            add_sauce(o.key, sorted(d["dots"]))
        elif over_sandwich(s, mouse_x, mouse_y):
            slip = LAYERS[o.key].get("slip", 0)
            dx = (mouse_x - PLATE_X) / kitchen_scale(s) + random.uniform(-slip, slip)
            drop(o.key, dx, min(mouse_y, top_y(s) - 20))
    elif mouse_y > 300:
        tap(o)          # a side or a drink dragged down onto the counter: the same as tapping it


# ---- eating

def eat_state():
    return global_vars.eat


def eat_bite():
    s, e = sandwich(), eat_state()
    if eaten(s):
        return
    edge_x = e["cx"] + (-LAYER_W / 2 + LAYER_W * bite_edge(s)) * e["scale"]
    last = bite(s)
    sound_play(random.choice(["crunch1", "crunch2", "crunch3"]), volume=0.8)
    mid_y = e["base"] - height(s) * e["scale"] / 2
    cols = [CRUMB.get(l["k"], "#e8c27a") for l in s["layers"]]
    particles(edge_x, mid_y, 18, cols, speed=4, size=5, life=40, gravity=0.35, spread=120, direction=20, shape="circle")
    camera_shake(2, 6)
    words = reactions(s)
    w = words[(s["bites"] - 1) % len(words)]
    e["words"].append([w, edge_x, mid_y - 40, 0])
    if w == "Spicy!":
        effect("smoke", edge_x, mid_y - 30, None, 1.2)
    if last:
        new, opened, tall = finish_meal(s)
        e["result"] = {"new": new, "opened": opened, "tall": tall, "all": recipes_in(s)}
        e["done_at"] = e["t"]
        sound_play("fanfare" if new else "ding", volume=0.6)
        if new:
            effect("confetti", VIEW_W / 2, 120, None, 1.5)


def eat_side():
    s, e = sandwich(), eat_state()
    if s["side"] is None or s["side_bites"] >= SIDE_BITES:
        return
    s["side_bites"] += 1
    sound_play("crunch2" if s["side"] in ("fries", "chips_side", "pickle_spear") else "slurp", volume=0.6)
    e["words"].append(["Mmm!" if s["side_bites"] < SIDE_BITES else "All gone!", e["side_x"], e["side_y"] - 70, 0])


def sip():
    s, e = sandwich(), eat_state()
    if s["drink"] is None or s["sips"] >= SIPS:
        return
    s["sips"] += 1
    sound_play("slurp", volume=0.6)
    e["words"].append(["Slurp!" if s["sips"] < SIPS else "Ahh!", e["drink_x"], e["drink_y"] - 100, 0])


# crumbs come off each layer in its own colour
CRUMB = {"bottom": "#e8c27a", "top": "#d9a456", "lettuce": "#6fc24a", "tomato": "#e0402e", "cheddar": "#ffb22a",
         "swiss": "#f8e27a", "bacon": "#b84a2a", "ham": "#f2a0a0", "chips": "#f5cf5a", "cucumber": "#8fd46a",
         "pickles": "#7aa83a", "salami": "#c23a3a", "beef": "#a8443a", "egg": "#ffffff", "jelly": "#7a2a8a"}


# ---- buttons

def do_act(what, arg):
    if what == "play" or what == "again":
        global_vars.picked = None
        room_goto("Breads")
    elif what == "book":
        global_vars.page = 0
        room_goto("Book")
    elif what == "title":
        room_goto("Title")
    elif what == "tab":
        global_vars.tab = arg
        make_shelf()
    elif what == "top":
        s = sandwich()
        drop("top", landing_dx(s, "top"))
    elif what == "undo":
        f = falling()
        if f is not None:
            f.destroy()
        elif undo(sandwich()):
            sound_play("plop", volume=0.4)
            if global_vars.tab in ("sides", "drinks"):
                global_vars.tab = "meat"
                make_shelf()
    elif what == "eat":
        f = falling()
        if f is not None:
            land(f)
        if sandwich()["topped"]:
            room_goto("Eat")
    elif what == "page":
        global_vars.page = max(0, min(pages() - 1, global_vars.page + arg))
        sound_play("page", volume=0.5)


PER_SPREAD = 8


def pages():
    return (len(RECIPES) + PER_SPREAD - 1) // PER_SPREAD
