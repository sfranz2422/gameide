# object: Title
# The front of the game: its name, and the levels to choose from.

# === create
global_vars.shapes = save_get("shapes", False)
if not hasattr(global_vars, "level"):
    global_vars.level = 0

# === step
question_ok(True)

# === draw_gui
text(VIEW_W / 2, 22, "Pour Decisions", GOLD, 56, "center")
text(VIEW_W / 2, 92, "Pour the sand until every tube is one colour.", INK, 20, "center")
stars = sum(save_get(f"stars_{i}", 0) for i in range(len(LEVELS)))
text(VIEW_W / 2, 122, f"Stars: {stars} of {3 * len(LEVELS)}", MINT, 16, "center")
