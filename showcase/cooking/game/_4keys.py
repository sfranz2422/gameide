# script: keys
# Every screen plays from the keyboard or a gamepad as well as the mouse or a tap,
# as in Pour Decisions and Squeeze. Each action has a name, and act(name) asks the
# keys and the pad buttons together, so the two can never work differently.
#
# What can be pressed is a Button (menus) or a Spot (in the kitchen: a cooker's
# slot, a source, a plate, the shelf, the bin, a customer). A gold box shows which
# one the keys are on once a key is used, and hides again when the mouse moves.

ACTIONS = {
    #  name:     (keys,                    pad buttons)
    "left":    (("left", "a"),            ("left",)),
    "right":   (("right", "d"),           ("right",)),
    "up":      (("up", "w"),              ("up",)),
    "down":    (("down", "s"),            ("down",)),
    "next":    (("tab",),                 ()),
    "ok":      (("space", "enter"),       ("a",)),
}
FOCUS_COLOUR = "#ffd23f"


def act(name):
    """Was this action's key, or its pad button, pressed this step?"""
    keys, buttons = ACTIONS[name]
    hit = any(keyboard_check_pressed(k) for k in keys) or any(gamepad_check_pressed(b) for b in buttons)
    if hit:
        global_vars.keyed = True
    return hit


def track_mouse():
    """The keys' box hides when the mouse moves: whoever's using it doesn't need it."""
    here = (mouse_x, mouse_y)
    if getattr(global_vars, "last_mouse", here) != here:
        global_vars.keyed = False
    global_vars.last_mouse = here


def keyed():
    return getattr(global_vars, "keyed", False)


def inside(o, x, y):
    return o.x <= x <= o.x + o.wide and o.y <= y <= o.y + o.high


def controls():
    """Everything pressable on show: Buttons in the order they were made, then Spots left to right, top to bottom."""
    buttons = sorted([b for b in instances("Button") if b.shown], key=lambda b: b.order)
    spots = sorted([s for s in instances("Spot") if s.shown], key=lambda s: (s.y // 100, s.x))
    return spots + buttons


def centre(o):
    return o.x + o.wide / 2, o.y + o.high / 2


def step_focus(items, cur, dx, dy):
    """The nearest control the way the arrow points; nothing that way, it stays."""
    cx, cy = centre(cur)
    best = None
    for o in items:
        if o is cur:
            continue
        x, y = centre(o)
        along = (x - cx) * dx + (y - cy) * dy
        across = abs(y - cy) if dx else abs(x - cx)
        if along > 1:
            score = along + 3 * across
            if best is None or score < best[0]:
                best = (score, o)
    return best[1] if best else cur


def run_controls(first=None):
    """The keys on a screen: arrows move the box, Tab goes on, Space presses."""
    track_mouse()
    items = controls()
    if not items:
        return
    cur = getattr(global_vars, "focus", None)
    if cur not in items:
        cur = first if first in items else next((o for o in items if not o.off), items[0])
    for name, (dx, dy) in (("left", (-1, 0)), ("right", (1, 0)), ("up", (0, -1)), ("down", (0, 1))):
        if act(name):
            cur = step_focus(items, cur, dx, dy)
    if act("next"):
        cur = items[(items.index(cur) + 1) % len(items)]
    global_vars.focus = cur
    if act("ok"):
        press(cur)


def press(o):
    """What a click, a tap and Space all do to a control."""
    if o is None or o.off:
        return
    if o.object_name == "Button":
        sound_play("click", volume=0.5)
        do_act(o.act, o.arg)
    else:
        tap(o)


def draw_focus(o):
    if keyed() and getattr(global_vars, "focus", None) is o:
        draw_set_color(FOCUS_COLOUR)
        for k in range(3):
            draw_rect(o.x - 3 - k, o.y - 3 - k, o.x + o.wide + 3 + k, o.y + o.high + 3 + k, True)
