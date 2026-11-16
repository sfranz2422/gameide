# object: Lab
# depth: 1000
# The lab: the little world along the top, the bench below it where things are
# mixed, and the collection on the right, one group at a time. This lays them out,
# runs the pointer and the keys, and draws the news: something new, achievements,
# hints, and how a thing was made.

# === create
global_vars.t = getattr(global_vars, "t", 0)
global_vars.focus = None
global_vars.drag = None
global_vars.picked = None
global_vars.news = None
global_vars.toasts = []
global_vars.said = None
global_vars.how = None
global_vars.how_mode = False
if getattr(global_vars, "group", None) is None:
    global_vars.group = "elements"
if getattr(global_vars, "hint_t", None) is None:
    global_vars.hint_t = 0          # the first hint is ready at once
make_cards()
for key, x, y in getattr(global_vars, "bench", None) or [(k, 120 + i * 120, 330) for i, k in enumerate(START)]:
    place_piece(key, x, y)
self.groups = []
for i, (g, words, colour) in enumerate(GROUPS):
    b = make_button(PANEL_X + 8 + (i % 5) * 66, 82 + (i // 5) * 30, 62, 26, words, "group", g, 10)
    b.key = g
    self.groups.append(b)
self.hint = make_button(PANEL_X + 8, 40, 80, 32, "Hint", "hint", None, 15)
self.how = make_button(PANEL_X + 92, 40, 74, 32, "How?", "how", None, 15)
make_button(PANEL_X + 170, 40, 84, 32, "Awards", "awards", None, 15)
make_button(PANEL_X + 258, 40, 76, 32, "Title", "title", None, 15)
make_button(BENCH[2] - 74, BENCH[3] - 32, 70, 28, "Clear", "clear", None, 13)

# === step
question_ok(dragged() is None)      # never while something's being dragged
global_vars.t += 1
if global_vars.how is not None:
    # How a thing was made is showing: any press, or Space, Enter or Escape, puts it away.
    if mouse_check_pressed("left") or keyboard_check_pressed("space") or keyboard_check_pressed("enter") or keyboard_check_pressed("escape"):
        global_vars.how = None
else:
    pointer()
    run_controls(None)
for b in self.groups:
    b.picked = b.key == global_vars.group
if global_vars.hint_t > 0:
    global_vars.hint_t -= 1
self.hint.words = "Hint" if global_vars.hint_t == 0 else f"{global_vars.hint_t // FPS + 1}s"
self.hint.hot = global_vars.hint_t == 0
self.how.picked = global_vars.how_mode
if global_vars.news is not None:
    global_vars.news[1] -= 1
    if global_vars.news[1] <= 0:
        global_vars.news = None
if global_vars.said is not None:
    global_vars.said[2] -= 1
    if global_vars.said[2] <= 0:
        global_vars.said = None
if global_vars.toasts:
    global_vars.toasts[0][1] -= 1
    if global_vars.toasts[0][1] <= 0:
        global_vars.toasts.pop(0)

# === draw
draw_sprite("bench", 0, 0, 0)
panel(PANEL_X, 0, VIEW_W, VIEW_H, 0.94)
draw_set_color("#2a1a3a")
draw_rect(BENCH[0], BENCH[1], BENCH[2], BENCH[3], True)

# === draw_gui
p = progress()
text(PANEL_X + 10, 10, f"Found {len(p['found'])} of {len(THINGS)}", GOLD, 18)
g = global_vars.group
keys = [k for k in THINGS if group_of(k) == g]
n = sum(1 for k in keys if found(p, k))
# The slots still to find, as question marks.
for i, k in enumerate(keys):
    if not found(p, k):
        c, r = i % COLS, i // COLS
        x, y = PANEL_X + 8 + c * CELL, 160 + r * CELL
        draw_set_alpha(0.25)
        draw_set_color("#000000")
        draw_rect(x + 3, y + 3, x + CELL - 3, y + CELL - 3)
        draw_set_alpha(1)
        text(x + CELL / 2, y + 14, "?", "#7a6a9a", 26, "center")
text(PANEL_X + 10, 558, f"{dict((a, b) for a, b, _ in GROUPS)[g]}: {n} of {len(keys)}", DIM, 13)
if not instances("Spot") or len(pieces()) == 0:
    text((BENCH[0] + BENCH[2]) / 2, (BENCH[1] + BENCH[3]) / 2 - 10, "Drag things here from your collection, then onto each other.", DIM, 16, "center")
# What's being dragged out of the collection, under the pointer.
d = dragged()
if d is not None and d["moved"] and d["from"].what == "card":
    icon(d["from"].key, mouse_x, mouse_y, 1, 0.85)
# Something new!
if global_vars.news is not None:
    key, left = global_vars.news
    a = min(1, left / 20)
    draw_set_alpha(0.85 * a)
    draw_set_color("#1a1030")
    draw_rect(110, 54, 570, 176)
    draw_set_alpha(a)
    icon(key, 170, 115, 1.4, a)
    text(225, 66, "New!", MINT, 22)
    text(225, 92, name_of(key), INK, 34)
    text(225, 138, "Makes nothing more!" if is_final(key) else f"{dict((x, y) for x, y, _ in GROUPS)[group_of(key)]}", GOLD if is_final(key) else DIM, 14)
    draw_set_alpha(1)
# Achievements, one at a time.
if global_vars.toasts:
    k, left = global_vars.toasts[0]
    _, name, words = award(k)
    a = min(1, left / 20)
    draw_set_alpha(0.9 * a)
    draw_set_color("#3a2a10")
    draw_rect(150, 186, 530, 232)
    draw_set_alpha(a)
    medal(176, 205, 14, "#e0913a", True)
    text(200, 190, f"Achievement: {name}", GOLD, 16)
    text(200, 210, words, INK, 12)
    draw_set_alpha(1)
if global_vars.said is not None and global_vars.said[0]:
    words, colour, left = global_vars.said
    draw_set_alpha(min(1, left / 20))
    text((BENCH[0] + BENCH[2]) / 2, BENCH[3] - 28, words, colour, 16, "center")
    draw_set_alpha(1)
# How a thing was made, every step from the four you start with.
if global_vars.how is not None:
    key = global_vars.how
    steps = steps_to(p, key)
    panel(40, 30, 640, 546, 0.97)
    icon(key, 90, 80, 1.1)
    text(130, 52, f"How you made {name_of(key)}", GOLD, 24)
    if not steps:
        text(130, 86, "You started with it.", DIM, 16)
    else:
        text(130, 86, f"{len(steps)} mix" + ("" if len(steps) == 1 else "es") + ", from the four you started with:", DIM, 14)
    per = 13
    for i, (a, b, c) in enumerate(steps[:2 * per]):
        x = 60 + (i // per) * 290
        y = 124 + (i % per) * 30
        text(x, y + 2, f"{i + 1}.", DIM, 13)
        icon(a, x + 34, y + 10, 0.36)
        text(x + 50, y + 2, "+", INK, 14)
        icon(b, x + 72, y + 10, 0.36)
        text(x + 88, y + 2, "=", INK, 14)
        icon(c, x + 110, y + 10, 0.36)
        text(x + 126, y + 2, name_of(c), INK, 13)
    text(340, 520, "Tap anywhere to close", DIM, 13, "center")
