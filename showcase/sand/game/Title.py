# object: Title
# The front of the game: its name, and the levels to choose from, a page at a
# time. Arrows choose a level (or a button) and Space plays it, like a click.

# === create
global_vars.shapes = save_get("shapes", False)
if not hasattr(global_vars, "level"):
    global_vars.level = 0
# Back from a level, the page it was on.
global_vars.page = min(global_vars.level // CARDS_A_PAGE, pages() - 1)
global_vars.focus = None

# === step
question_ok(True)
track_mouse()
lay_out_cards()
items = (sorted([c for c in instances("LevelCard") if c.shown and not c.off], key=lambda c: c.i)
         + sorted([b for b in instances("PageButton") if not b.off], key=lambda b: b.x)
         + list(instances("ShapesButton")))
focus = global_vars.focus
if focus not in items:
    # The level last played if it's on this page, else the page's first.
    focus = next((c for c in items if getattr(c, "i", None) == global_vars.level), items[0] if items else None)
global_vars.focus = move_focus(items, focus)
if act("ok"):
    press(global_vars.focus)

# === draw_gui
text(VIEW_W / 2, 22, "Pour Decisions", GOLD, 56, "center")
text(VIEW_W / 2, 92, "Pour the sand until every tube is one colour.", INK, 20, "center")
stars = sum(save_get(f"stars_{i}", 0) for i in range(len(LEVELS)))
text(VIEW_W / 2, 122, f"Stars: {stars} of {3 * len(LEVELS)}", MINT, 16, "center")
text(VIEW_W / 2, 530, "Click a level, or choose one with the arrows and press Space.", "#d8cfe0", 14, "center")
