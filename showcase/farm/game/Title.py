# object: Title
# depth: 1000
# The front of the game: the valley, its name, and the way in.

# === create
global_vars.focus = None
weather(None)                       # the farm's season's snow or rain doesn't fall on the title
self.play = make_button(VIEW_W / 2 - 120, 430, 240, 56, "Play", "play", None, 26)
self.play.hot = True

# === step
question_ok(True)
track_mouse()
run_buttons(self.play)

# === draw
draw_sprite("title", 0, 0, 0)

# === draw_gui
text(VIEW_W / 2, 40, "Cloverbrook", "#fff8e0", 76, "center")
text(VIEW_W / 2, 130, "Grow crops, fill orders, and grow your farm into a town.", "#fff8e0", 20, "center")
f = save_get("farm", None)
if f:
    text(VIEW_W / 2, 500, f"Level {f['level']}  ·  {f['coins']} coins  ·  {len(f['fields'])} fields", "#fff8e0", 16, "center")
text(VIEW_W / 2, 540, "Drag to look around. Keys: arrows, Space, 1-4 to plant, B barn, O orders, F fields.", "#fff8e0", 14, "center")
