# script: keys
# Every screen plays from the keyboard or a gamepad as well as the mouse (the
# teacher's ask, 2026-11-12). Each action has a name, and act(name) asks the keys
# and the pad buttons together, so the two can never work differently.
#
# A cursor (global_vars.focus on the title and the Sorted! panel, the Director's
# .cursor on the tubes) shows once a key is used, and hides again when the mouse
# moves, so a mouse player never sees a gold box following nothing.

ACTIONS = {
    #  name:     (keys,                    pad buttons)
    "left":    (("left", "a"),            ("left",)),
    "right":   (("right", "d"),           ("right",)),
    "up":      (("up", "w"),              ("up",)),
    "down":    (("down", "s"),            ("down",)),
    "ok":      (("space", "enter"),       ("a",)),
    "back":    (("escape", "backspace"),  ("b",)),
    "undo":    (("z", "u"),               ("x",)),
    "restart": (("r",),                   ("select",)),
    "tube":    (("x",),                   ("y",)),
}
ARROWS = {"left": (-1, 0), "right": (1, 0), "up": (0, -1), "down": (0, 1)}
FOCUS_COLOUR = "#ffd23f"
CARDS_A_PAGE = 24


def act(name):
    """Was this action's key, or its pad button, pressed this step?"""
    keys, buttons = ACTIONS[name]
    hit = any(keyboard_check_pressed(k) for k in keys) or any(gamepad_check_pressed(b) for b in buttons)
    if hit:
        global_vars.keyed = True
    return hit


def track_mouse():
    """The cursor hides when the mouse moves: whoever's using it doesn't need the keys' box."""
    here = (mouse_x, mouse_y)
    if getattr(global_vars, "last_mouse", here) != here:
        global_vars.keyed = False
    global_vars.last_mouse = here


def keyed():
    return getattr(global_vars, "keyed", False)


def centre(o):
    """Where something is, for the arrows: a button's middle, or a tube's glass."""
    if hasattr(o, "wide"):
        return o.x + o.wide / 2, o.y + 25
    return o.home_x, o.home_y + 70


def step_focus(items, cur, dx, dy):
    """
    The nearest of `items` from `cur` the way the arrow points. Left and right stay
    in the row (past its end they go round to the other end: from the last card of
    a row, right never jumped down to a button below); up and down go to the
    nearest thing above or below, and stop at the edge.
    """
    if not items:
        return None
    if cur not in items:
        return items[0]
    cx, cy = centre(cur)
    best = None
    for o in items:
        if o is cur:
            continue
        x, y = centre(o)
        along = (x - cx) * dx + (y - cy) * dy
        across = abs(y - cy) if dx else abs(x - cx)
        if along > 1 and not (dx and across >= 20):
            score = along + 3 * across
            if best is None or score < best[0]:
                best = (score, o)
    if best:
        return best[1]
    if dx:
        row = [o for o in items if abs(centre(o)[1] - cy) < 20]
        return min(row, key=lambda o: centre(o)[0] * dx)
    return cur


def move_focus(items, cur):
    """Arrows move a cursor among `items`; returns where it is now."""
    for name, (dx, dy) in ARROWS.items():
        if act(name):
            cur = step_focus(items, cur, dx, dy)
    return cur


def press(button):
    """What a click on it would do."""
    if button is not None and not button.off:
        button.on_mouse_left_pressed()


def draw_focus(x1, y1, x2, y2):
    draw_set_color(FOCUS_COLOUR)
    for k in range(3):
        draw_rect(x1 - k, y1 - k, x2 + k, y2 + k, True)


def lay_out_cards():
    """The level cards of the page showing, in rows of six; the others off the screen."""
    for c in instances("LevelCard"):
        j = c.i - global_vars.page * CARDS_A_PAGE
        c.shown = 0 <= j < CARDS_A_PAGE
        if c.shown:
            c.x, c.y = VIEW_W / 2 - 3 * 168 + 6 + (j % 6) * 168, 156 + (j // 6) * 72
        else:
            c.x, c.y = -1000, -1000


def pages():
    return (len(LEVELS) + CARDS_A_PAGE - 1) // CARDS_A_PAGE
