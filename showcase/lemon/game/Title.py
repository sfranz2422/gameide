# object: Title
# depth: 1000
# The front of the game: a new summer, or carry on with the one saved.

# === create
weather(None)
lighting(0)
global_vars.focus = None
saved = save_get("summer")
self.saved = saved
self.new = make_button(VIEW_W / 2 - 230, 474, 210, 50, "New summer", "new", size=22)
self.new.hot = True
self.cont = make_button(VIEW_W / 2 + 20, 474, 210, 50, "Continue", "continue", size=22)
self.cont.off = saved is None or saved.get("finished", False)
self.first = self.new if self.cont.off else self.cont

# === step
question_ok(True)
run_controls(self.first)

# === draw
draw_sprite("title", 0, 0, 0)     # the build makes it exactly the screen's size

# === draw_gui
text(VIEW_W / 2, 40, "Squeeze", GOLD, 72, "center")
text(VIEW_W / 2, 132, "A summer selling lemonade. Buy, mix, price it, and sell.", INK, 20, "center")
s = self.saved
if s is not None and not s.get("finished", False):
    text(VIEW_W / 2 + 125, 528, f"Day {s['day'] + 1} of {DAYS} · {money(s['money'])}", DIM, 14, "center")
elif s is not None:
    text(VIEW_W / 2, 528, f"Last summer: {money(s['money'])}, {rank_of(s['money'])}", DIM, 14, "center")
text(VIEW_W / 2, 552, "Click, or arrows and Space. Tab moves on too.", "#fff6d8", 14, "center")
