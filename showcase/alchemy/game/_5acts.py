# script: acts
# What every Button does, and what a tap or a drag does to a Spot: a thing in the
# collection (a "card") or one on the bench (a "piece"). All of it is here, so a
# drag, a tap, Space and a pad's A end up in the same place.
#
#   Drag a card onto the bench         a copy goes there (onto another piece: they mix)
#   Drag a piece onto another piece    they mix
#   Drag a piece back to the panel     it goes away
#   Tap a card                         a copy goes on the bench and is picked; tap a second
#                                      card and its copy mixes with the picked one
#   Tap a piece, then another          they mix (tap the same one again: unpicked)
import random

DRAG_START = 10             # pixels a press must move before it's a drag, not a tap

_order = [0]


def make_button(x, y, wide, high, words, act, arg=None, size=16):
    b = instance_create(x, y, "Button")
    b.wide, b.high, b.words, b.act, b.arg, b.size = wide, high, words, act, arg, size
    _order[0] += 1
    b.order = _order[0]
    return b


def make_spot(x, y, wide, high, what, key):
    o = instance_create(x, y, "Spot")
    o.wide, o.high, o.what, o.key = wide, high, what, key
    return o


# ---- the collection: one group at a time

def make_cards():
    for o in instances("Spot"):
        if o.what == "card":
            o.destroy()
    p = progress()
    keys = [k for k in THINGS if group_of(k) == global_vars.group]
    for i, k in enumerate(keys):
        if found(p, k):
            c, r = i % COLS, i // COLS
            make_spot(PANEL_X + 8 + c * CELL, 160 + r * CELL, CELL, CELL, "card", k)


# ---- the bench

def bench_free_spot(near=None):
    """Somewhere on the bench with room for one more, nearest `near` (or the middle)."""
    x1, y1, x2, y2 = BENCH
    nx, ny = near if near else ((x1 + x2) / 2, (y1 + y2) / 2)
    best = None
    for gy in range(int(y1) + 10, int(y2 - ICON - 6), 34):
        for gx in range(int(x1) + 10, int(x2 - ICON - 6), 34):
            clear = all(abs(o.x - gx) > ICON * 0.9 or abs(o.y - gy) > ICON * 0.9 for o in pieces())
            if clear:
                d = (gx + ICON / 2 - nx) ** 2 + (gy + ICON / 2 - ny) ** 2
                if best is None or d < best[0]:
                    best = (d, gx, gy)
    if best is None:
        return x1 + random.uniform(0, x2 - x1 - ICON), y1 + random.uniform(0, y2 - y1 - ICON)
    return best[1], best[2]


def pieces():
    return [o for o in instances("Spot") if o.what == "piece"]


def place_piece(key, x=None, y=None):
    """A thing on the bench, its top left at (x, y) (a free spot when not given)."""
    if x is None:
        x, y = bench_free_spot()
    x1, y1, x2, y2 = BENCH
    o = make_spot(clamp(x, x1, x2 - ICON), clamp(y, y1, y2 - ICON), ICON, ICON, "piece", key)
    o.born = global_vars.t
    old = sorted(pieces(), key=lambda q: q.born)
    while len(old) > BENCH_MOST:
        old.pop(0).destroy()
    return o


def picked():
    o = getattr(global_vars, "picked", None)
    return o if o is not None and instance_exists("Spot") and o in pieces() else None


def piece_on(o):
    """Another piece close enough to `o` to mix with (the nearest), or None."""
    best = None
    for q in pieces():
        if q is o:
            continue
        d = point_distance(o.x, o.y, q.x, q.y)
        if d < CATCH and (best is None or d < best[0]):
            best = (d, q)
    return best[1] if best else None


def mix(a, b):
    """Mixes two pieces (b is the one being mixed into). What they make appears where b was;
    if they make nothing, a is pushed away."""
    p = progress()
    global_vars.picked = None
    c, new = try_mix(p, a.key, b.key)
    if c is None:
        sound_play("nope", volume=0.5)
        a.x = clamp(a.x + (60 if a.x >= b.x else -60), BENCH[0], BENCH[2] - ICON)
        a.y = clamp(a.y + random.uniform(-30, 30), BENCH[1], BENCH[3] - ICON)
        a.shake = 18
        say(f"{name_of(a.key)} and {name_of(b.key)} make nothing.", "#d8d0ea")
    else:
        x, y = b.x, b.y
        a.destroy()
        b.destroy()
        o = place_piece(c, x, y)
        o.pop = 20
        effect("sparkle", x + ICON / 2, y + ICON / 2, None, 1.2 if new else 0.8)
        if new:
            sound_play("new", volume=0.7)
            global_vars.news = [c, 150]
            if group_of(c) == global_vars.group:
                make_cards()
        else:
            sound_play("pop", volume=0.6)
    for k in new_awards(p):
        global_vars.toasts.append([k, 200])
        sound_play("award", volume=0.6)
    return c


def say(words, colour=INK):
    global_vars.said = [words, colour, 150]


# ---- taps

def tap(o):
    if o.what == "card":
        if getattr(global_vars, "how_mode", False):
            global_vars.how = o.key
            sound_play("click", volume=0.4)
            return
        sel = picked()
        if sel is not None:
            x, y = bench_free_spot((sel.x + ICON, sel.y + ICON / 2))
            mix(place_piece(o.key, x, y), sel)
        else:
            sound_play("click", volume=0.4)
            global_vars.picked = place_piece(o.key)
    elif o.what == "piece":
        sel = picked()
        if sel is None:
            global_vars.picked = o
            sound_play("click", volume=0.4)
        elif sel is o:
            global_vars.picked = None
        else:
            mix(o, sel)


# ---- the pointer

def spot_at(x, y, but=None):
    """The Spot under (x, y): a piece on top of the others, the newest first."""
    hits = [o for o in instances("Spot") if o is not but and o.shown and inside(o, x, y)]
    if not hits:
        return None
    return max(hits, key=lambda o: (o.what == "piece", getattr(o, "born", 0)))


def dragged():
    return getattr(global_vars, "drag", None)


def on_bench(x, y):
    x1, y1, x2, y2 = BENCH
    return x1 <= x <= x2 and y1 <= y <= y2


def pointer():
    """Once a step in the lab: a press, a drag, a let-go."""
    d = dragged()
    if mouse_check_pressed("left"):
        o = spot_at(mouse_x, mouse_y)
        d = None
        if o is not None:
            d = {"from": o, "x": mouse_x, "y": mouse_y, "ox": mouse_x - o.x, "oy": mouse_y - o.y, "moved": False}
            global_vars.focus = o
        global_vars.drag = d
    if d is None:
        return
    o = d["from"]
    if not instance_exists("Spot") or o not in instances("Spot"):
        global_vars.drag = None
        return
    if point_distance(d["x"], d["y"], mouse_x, mouse_y) > DRAG_START:
        d["moved"] = True
    if d["moved"] and o.what == "piece":
        o.x, o.y = mouse_x - d["ox"], mouse_y - d["oy"]
    if mouse_check_released("left") or not mouse_check("left"):
        global_vars.drag = None
        if not d["moved"]:
            if spot_at(mouse_x, mouse_y) is o:
                press(o)
            return
        let_go(o)


def let_go(o):
    if o.what == "card":
        if not on_bench(mouse_x, mouse_y):
            return
        new = place_piece(o.key, mouse_x - ICON / 2, mouse_y - ICON / 2)
        other = piece_on(new)
        if other is not None:
            mix(new, other)
    else:
        if mouse_x >= PANEL_X:
            o.destroy()                 # back to the collection
            sound_play("whoosh", volume=0.3)
            return
        x1, y1, x2, y2 = BENCH
        o.x, o.y = clamp(o.x, x1, x2 - ICON), clamp(o.y, y1, y2 - ICON)
        other = piece_on(o)
        if other is not None:
            mix(o, other)


# ---- buttons

def keep_bench():
    """The bench, kept while you look at another screen."""
    global_vars.bench = [(o.key, o.x, o.y) for o in sorted(pieces(), key=lambda q: q.born)]


def do_act(what, arg):
    if what == "play":
        room_goto("Lab")
    elif what == "title":
        keep_bench()
        room_goto("Title")
    elif what == "awards":
        keep_bench()
        room_goto("Awards")
    elif what == "group":
        global_vars.group = arg
        make_cards()
    elif what == "clear":
        for o in pieces():
            o.destroy()
        global_vars.picked = None
        sound_play("whoosh", volume=0.4)
    elif what == "hint":
        if global_vars.hint_t > 0:
            sound_play("nope", volume=0.4)
            return
        h = use_hint(progress())
        if h is None:
            say("You've made everything there is!", GOLD)
            return
        a, c = h
        global_vars.hint_t = HINT_STEPS
        global_vars.hinted = h
        sound_play("hint", volume=0.6)
        say(f"Hint: {name_of(a)} can help make {name_of(c)}.", GOLD)
    elif what == "how":
        global_vars.how_mode = not getattr(global_vars, "how_mode", False)
        global_vars.how = None
        say("Tap anything in your collection to see how you made it." if global_vars.how_mode else "", MINT)
    elif what == "close_how":
        global_vars.how = None
